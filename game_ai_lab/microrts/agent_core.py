"""Runnable hierarchical agent components for MicroRTS tactical adaptation.

The module deliberately separates the three research claims from the simulator:
temporal opponent prediction (RQ1), outcome-conditioned retrieval (RQ2), and
high-level planning plus a legal-action executor (RQ3).
"""

from __future__ import annotations

import json
import random
from collections import Counter, deque
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np


TACTICS = ("economy", "scout", "defend", "rush")


@dataclass
class GameState:
    step: int
    own_units: dict[str, int]
    enemy_units: dict[str, int]
    own_combat: int
    enemy_combat: int
    own_workers: int
    enemy_workers: int
    own_centroid: tuple[float, float] | None
    enemy_centroid: tuple[float, float] | None
    enemy_distance: float
    own_positions: dict[int, str]
    enemy_positions: dict[int, str]
    own_base: tuple[float, float] | None
    enemy_base: tuple[float, float] | None
    resource_positions: list[tuple[int, int]]
    resource_total: float = 0.0

    def feature_vector(self) -> list[float]:
        return [
            float(self.own_combat),
            float(self.enemy_combat),
            float(self.own_workers),
            float(self.enemy_workers),
            round(self.enemy_distance, 2),
        ]


def decode_state(observation: np.ndarray, step: int, unit_names: list[str]) -> GameState:
    """Decode MicroRTS one-hot planes into an agent-facing state summary."""
    board = observation[0] if observation.ndim == 4 else observation
    player = np.argmax(board[:, :, 10:13], axis=2)
    # Plane 0 is "no unit"; remaining planes follow the unit-type table.
    unit_type = np.argmax(board[:, :, 13 : 14 + len(unit_names)], axis=2)

    def collect(owner: int) -> tuple[dict[str, int], tuple[float, float] | None, dict[int, str], tuple[float, float] | None]:
        locations = np.argwhere(player == owner)
        names: list[str] = []
        positions: dict[int, str] = {}
        base_positions: list[tuple[int, int]] = []
        for y, x in locations:
            encoded = int(unit_type[y, x])
            if encoded > 0 and encoded - 1 < len(unit_names):
                name = unit_names[encoded - 1]
                names.append(name)
                positions[int(y * board.shape[1] + x)] = name
                if name == "Base":
                    base_positions.append((int(x), int(y)))
        centroid = None
        if len(locations):
            centroid = (float(locations[:, 1].mean()), float(locations[:, 0].mean()))
        base_centroid = None
        if base_positions:
            base_centroid = (float(np.mean([point[0] for point in base_positions])), float(np.mean([point[1] for point in base_positions])))
        return dict(Counter(names)), centroid, positions, base_centroid

    own_units, own_centroid, own_positions, own_base = collect(1)
    enemy_units, enemy_centroid, enemy_positions, enemy_base = collect(2)
    if own_centroid is None or enemy_centroid is None:
        enemy_distance = 99.0
    else:
        enemy_distance = abs(own_centroid[0] - enemy_centroid[0]) + abs(own_centroid[1] - enemy_centroid[1])
    combat = {"Light", "Heavy", "Ranged"}
    return GameState(
        step=step,
        own_units=own_units,
        enemy_units=enemy_units,
        own_combat=sum(own_units.get(name, 0) for name in combat),
        enemy_combat=sum(enemy_units.get(name, 0) for name in combat),
        own_workers=own_units.get("Worker", 0),
        enemy_workers=enemy_units.get("Worker", 0),
        own_centroid=own_centroid,
        enemy_centroid=enemy_centroid,
        enemy_distance=enemy_distance,
        own_positions=own_positions,
        enemy_positions=enemy_positions,
        own_base=own_base,
        enemy_base=enemy_base,
        # Resource planes are categorical; index 0 is empty and positive
        # indices encode a resource amount.
        resource_positions=[
            (int(x), int(y))
            for y, x in np.argwhere(np.argmax(board[:, :, 5:10], axis=2) > 0)
        ],
        resource_total=float(np.sum(np.max(board[:, :, 5:10], axis=2))),
    )


class TemporalOpponentModel:
    """Online, inspectable predictor used as the RQ1 prototype.

    It predicts a short-horizon pressure label from a sequence rather than from
    a single frame. The serialized records make it possible to replace this
    heuristic with a trained TCN/Transformer without changing the agent API.
    """

    def __init__(self, window: int = 6):
        self.history: deque[GameState] = deque(maxlen=window)
        self.engaged = False

    def update(self, state: GameState) -> dict[str, Any]:
        self.history.append(state)
        first = self.history[0]
        latest = self.history[-1]
        combat_growth = latest.enemy_combat - first.enemy_combat
        distance_change = first.enemy_distance - latest.enemy_distance
        # Worker count alone is ambiguous: Coac and other macro opponents
        # deliberately grow workers while staying behind their bases. Treat
        # it as a rush only once the worker mass is both sizeable and close to
        # our centroid, or when the opponent is visibly closing the gap.
        worker_pressure = (
            latest.enemy_workers >= 3
            and (latest.enemy_distance <= 10.0 or distance_change > 2.0)
        )
        if latest.enemy_combat > 0 or worker_pressure:
            self.engaged = True
        if latest.enemy_combat >= 2 or (combat_growth > 0 and distance_change > 1.0) or worker_pressure:
            mode = "rush"
            pressure = max(0.7 if worker_pressure else 0.0, min(1.0, 0.55 + 0.12 * latest.enemy_combat + 0.04 * distance_change))
        elif latest.enemy_workers >= 2 and latest.enemy_combat == 0:
            mode, pressure = "economic", 0.25
        elif distance_change > 1.5:
            mode, pressure = "advance", 0.55
        else:
            mode, pressure = "balanced", 0.4
        # Keep a confirmed engagement signal for a short tactical episode.
        # Built-in opponents can lose a unit between frames; resetting to
        # economic in that gap makes the executor abandon an otherwise valid
        # counter-push.
        if self.engaged and latest.enemy_combat == 0 and latest.enemy_workers >= 3:
            mode = "rush"
            pressure = max(pressure, 0.65)
        return {
            "mode": mode,
            "attack_pressure": round(pressure, 3),
            "combat_growth": combat_growth,
            "distance_change": round(distance_change, 3),
            "window": len(self.history),
        }


class OutcomeConditionedMemory:
    """Persistent episodic memory, retrieved only from completed outcomes."""

    def __init__(self, path: Path):
        self.path = path
        self.records: list[dict[str, Any]] = []
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                try:
                    self.records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    def recommend(self, state: GameState, prediction: dict[str, Any]) -> tuple[str | None, dict[str, Any] | None]:
        candidates = [r for r in self.records if r.get("opponent_mode") == prediction["mode"] and r.get("outcome", 0) > 0]
        if not candidates:
            return None, None
        target = np.asarray(state.feature_vector(), dtype=float)
        def score(record: dict[str, Any]) -> tuple[float, float]:
            distance = float(np.abs(target - np.asarray(record["features"], dtype=float)).sum())
            return (distance, -float(record.get("return", 0.0)))
        best = min(candidates, key=score)
        return str(best["tactic"]), best

    def add(self, state: GameState, prediction: dict[str, Any], tactic: str, outcome: float, episode_return: float) -> None:
        record = {
            "features": state.feature_vector(),
            "opponent_mode": prediction["mode"],
            "tactic": tactic,
            "outcome": outcome,
            "return": episode_return,
        }
        self.records.append(record)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=True) + "\n")


class TacticalPlanner:
    def __init__(self, api_planner: Any | None = None):
        self.api_planner = api_planner

    def choose(self, state: GameState, prediction: dict[str, Any], recalled: str | None) -> tuple[str, str]:
        if recalled in TACTICS:
            # Episodic memory is advisory.  A successful historical rush is
            # unsafe when the current observation contains at least as many
            # Heavy units as our Ranged counter; let the live threat rule
            # override that stale recommendation.
            stale_rush = (
                recalled == "rush"
                and state.enemy_units.get("Heavy", 0) > 0
                and state.own_units.get("Ranged", 0) <= state.enemy_units.get("Heavy", 0)
            )
            if not stale_rush:
                return recalled, "memory"
        # The opening is the only window in which a worker-rush counter can
        # create contact before the opponent reaches our base. Keep the
        # executor in defensive mode while its dedicated builder transitions
        # to a Barracks.
        if state.step < 50:
            return "defend", "opening_rule"
        # Keep the opening economy focused until a Barracks is available. A
        # zero-vs-zero combat count must not be interpreted as a favorable
        # rush: it is simply the pre-tech state.
        if state.own_units.get("Barracks", 0) == 0:
            return ("defend", "pretech_rule") if prediction["attack_pressure"] >= 0.5 else ("economy", "pretech_rule")
        if self.api_planner is not None:
            prompt = json.dumps({"state": asdict(state), "prediction": prediction, "allowed_tactics": TACTICS}, ensure_ascii=True)
            try:
                response = self.api_planner.plan(
                    "Choose one MicroRTS tactic. Reply with exactly one allowed lowercase token.", prompt
                ).strip().lower()
                if response in TACTICS:
                    return response, "api"
            except RuntimeError:
                pass
        # Once an enemy combat unit is visible, passive defense lets a
        # production-focused rush outscale us. Convert the temporal warning
        # into an immediate counter-push; the executor still uses legal masks
        # and falls back to the enemy base when no local target is visible.
        if prediction["mode"] == "rush" and state.enemy_combat > 0:
            # Heavy units are the Coac-style hard counter to the opening
            # Light units.  Do not expose an equal-sized army while Ranged
            # production is coming online; hold the base and counter-push
            # only after the local combat count is no longer inferior.
            if (
                state.enemy_units.get("Heavy", 0) > 0
                and (
                    state.own_combat <= state.enemy_combat
                    or state.own_units.get("Ranged", 0) <= state.enemy_units.get("Heavy", 0)
                )
            ):
                return "defend", "heavy_hold"
            return "rush", "counter_push"
        # Separate a distant macro expansion from a worker rush. Coac grows
        # Workers behind its base; spending our entire opening on a push lets
        # its additional Barracks/Heavy production outscale us.
        if (
            state.enemy_combat == 0
            and state.enemy_workers >= 3
            and state.enemy_distance > 10.0
            and prediction["mode"] != "rush"
        ):
            return "economy", "macro_response"
        if state.own_workers < 2:
            return "economy", "rule"
        # Equal combat counts are not an attack opportunity: leaving the base
        # with no numerical advantage makes the freshly produced defender die
        # to the opponent's next unit. Reserve ``rush`` for a clear edge.
        if state.own_combat >= state.enemy_combat + 1:
            return "rush", "rule"
        if prediction["attack_pressure"] >= 0.6:
            return "defend", "rule"
        return "defend", "rule"


class MaskedTacticalExecutor:
    """Maps a tactical choice to legal GridNet actions using the environment mask."""

    # MicroRTS UnitAction types: none, move, harvest, return, produce, attack.
    def __init__(self, unit_names: list[str], seed: int = 7):
        self.unit_names = unit_names
        self.rng = random.Random(seed)
        self.type_index = {name: index for index, name in enumerate(unit_names)}
        self.builder_index: int | None = None
        # Keep the strongest observed composition for the whole episode. A
        # combat unit can disappear between decision points; forgetting it
        # would make production oscillate back to the default Light unit.
        self.enemy_seen_units: dict[str, int] = {}
        self.barracks_slots: dict[int, int] = {}

    @staticmethod
    def _valid(mask: np.ndarray, start: int, count: int) -> list[int]:
        return [index for index in range(count) if mask[start + index] > 0]

    def _toward_direction(self, source: tuple[int, int], target: tuple[float, float] | None, valid: list[int]) -> int:
        if not valid:
            return 0
        if target is None:
            return min(valid)
        dx, dy = target[0] - source[0], target[1] - source[1]
        desired = 1 if abs(dx) >= abs(dy) and dx > 0 else 3 if abs(dx) >= abs(dy) else 2 if dy > 0 else 0
        if desired in valid:
            return desired
        # A preferred direction is often blocked by the own Base/Barracks.
        # Choose the legal detour that minimizes post-move Manhattan distance
        # instead of randomly wandering, which is especially harmful on the
        # compact 10x10 maps.
        offsets = {0: (0, -1), 1: (1, 0), 2: (0, 1), 3: (-1, 0)}
        return min(
            valid,
            key=lambda direction: abs(target[0] - (source[0] + offsets[direction][0]))
            + abs(target[1] - (source[1] + offsets[direction][1])),
        )

    def _production_direction(
        self,
        source: tuple[int, int],
        valid: list[int],
        state: GameState,
        width: int,
        height: int,
    ) -> int:
        """Select an empty adjacent tile for worker construction.

        MicroRTS production directions point to the tile occupied by the new
        building. Pointing at the base itself is legal in the action mask but
        rejected by the engine, which otherwise looks like a resource failure.
        """
        if not valid:
            return 0
        occupied = set(state.own_positions) | set(state.enemy_positions)
        base = state.own_base or source
        offsets = {0: (0, -1), 1: (1, 0), 2: (0, 1), 3: (-1, 0)}
        candidates: list[tuple[float, int]] = []
        for direction in valid:
            dx, dy = offsets[direction]
            x, y = source[0] + dx, source[1] + dy
            if not (0 <= x < width and 0 <= y < height):
                continue
            index = y * width + x
            if index in occupied:
                continue
            candidates.append((abs(x - base[0]) + abs(y - base[1]), direction))
        if candidates:
            return min(candidates)[1]
        return self._toward_direction(source, base, valid)

    @staticmethod
    def _threat_target(
        source: tuple[int, int],
        state: GameState,
        width: int,
        combat_only: bool = True,
    ) -> int | None:
        """Choose a target by one-step threat/value rather than nearest cell."""
        if not state.enemy_positions:
            return None
        base = state.own_base or source
        candidates = []
        for index, name in state.enemy_positions.items():
            if combat_only and name not in {"Light", "Heavy", "Ranged"}:
                continue
            point = (index % width, index // width)
            travel = abs(point[0] - source[0]) + abs(point[1] - source[1])
            base_distance = abs(point[0] - base[0]) + abs(point[1] - base[1])
            type_value = {"Light": 1.2, "Heavy": 1.5, "Ranged": 1.4}.get(name, 0.5)
            # Smaller base distance means greater immediate threat. A small
            # travel penalty prevents all units from choosing a remote target.
            score = 5.0 / (base_distance + 1.0) + type_value - 0.12 * travel
            candidates.append((score, -travel, int(index)))
        return max(candidates)[2] if candidates else None

    def _action_type(self, source_type: str, tactic: str, legal: list[int], state: GameState, produce_types: list[int]) -> int:
        """Choose a skill action after identifying the source unit, not globally."""
        has_barracks = state.own_units.get("Barracks", 0) > 0
        if source_type == "Base":
            worker = self.type_index.get("Worker")
            # Reserve the opening resources for the first Barracks.  Producing
            # workers indefinitely is a common failure mode on the tiny map:
            # the base can legally queue workers while the worker tech
            # transition remains unaffordable.  Two starting workers plus one
            # replacement are enough to bootstrap the economy.
            # Once the Barracks exists, keep the two starting workers on the
            # resource loop. A third worker costs the same stock needed for
            # the first combat unit and arrives too late to stop a rush.
            macro_worker = (
                tactic == "economy"
                and state.enemy_combat == 0
                and state.own_workers < 3
            )
            return 4 if (
                worker in produce_types
                and ((not has_barracks and state.own_workers < 2) or macro_worker)
            ) else 0
        if source_type == "Barracks":
            light = self.type_index.get("Light")
            return 4 if light in produce_types else 0
        if source_type == "Worker":
            # If carrying a resource, return is the only valid worker-specific
            # action; otherwise select harvest before movement.
            return 3 if 3 in legal else 2 if 2 in legal else 1 if 1 in legal else 0
        if source_type in {"Light", "Heavy", "Ranged"}:
            return 5 if 5 in legal else 1 if 1 in legal else 0
        return 0

    def _produce_type(
        self,
        source_type: str,
        tactic: str,
        producible: list[int],
        source_index: int | None = None,
    ) -> int:
        desired = "Worker" if source_type == "Base" else "Light" if source_type == "Barracks" else "Barracks"
        if source_type == "Barracks":
            # Use the observed composition as a persistent signal. Heavy is
            # the robust close-range answer to both Heavy and Light in the
            # original MicroRTS unit table; the signal survives a transient
            # casualty.
            enemy = self.enemy_seen_units
            current_enemy = self._current_enemy_units
            if (
                current_enemy.get("Worker", 0) >= 3
                and not any(current_enemy.get(name, 0) for name in ("Light", "Heavy", "Ranged"))
                and not any(self.enemy_seen_units.get(name, 0) for name in ("Light", "Heavy", "Ranged"))
            ):
                # A growing worker mass with no visible army is the early
                # signature of Coac-style macro play. Queue a ranged unit
                # before the first Heavy becomes visible.
                desired = "Ranged"
            elif enemy.get("Heavy", 0) >= 1 and enemy.get("Ranged", 0) == 0:
                # Keep distance from Heavy units; their high melee damage
                # makes a mirrored Heavy exchange too slow to win against a
                # macro opponent with equal production.
                desired = "Ranged"
            elif enemy.get("Ranged", 0) >= 1 and enemy.get("Heavy", 0) == 0:
                # Close distance quickly against ranged pressure; Heavy is
                # slower and can be kited before reaching the firing line.
                desired = "Light"
            elif enemy.get("Heavy", 0) >= 1:
                desired = "Heavy"
            elif enemy.get("Light", 0) >= 1:
                # Against a pure Light rush, preserve throughput and meet the
                # opponent's cycle instead of waiting 120 ticks for Heavy.
                desired = "Light"
            elif source_index is not None:
                # Before the first combat observation, use the fast unit so
                # the opening production cycle is not lost to a 120-tick
                # Heavy queue; composition-specific responses take over once
                # a threat is observed.
                desired = "Light"
        preferred = self.type_index.get(desired, 0)
        return preferred if preferred in producible else (producible[0] if producible else 0)

    def actions(self, env: Any, state: GameState, tactic: str) -> np.ndarray:
        self._current_enemy_units = state.enemy_units
        for name, count in state.enemy_units.items():
            self.enemy_seen_units[name] = max(self.enemy_seen_units.get(name, 0), int(count))
        mask = env.get_action_mask()[0]
        # gym-microrts exposes the controllable source cells as indices. Older
        # forks called this array ``source_unit_mask``; support both layouts.
        if hasattr(env, "source_unit_mask"):
            source_mask = np.asarray(env.source_unit_mask[0]).reshape(-1)
            source_indices = np.flatnonzero(source_mask)
        else:
            source_indices = np.asarray(env.source_unit_idxs[0]).reshape(-1)
        width, height = env.width, env.height
        commands = np.zeros((width * height, 7), dtype=np.int32)
        worker_rush_counter = (
            tactic == "defend"
            and state.enemy_combat == 0
            # Two starting workers can move toward resources without rushing.
            # Require worker growth plus sustained proximity before committing
            # a free worker to interception. A third worker is the distinctive
            # WorkerRush signal on this map; waiting for contact is too late.
            and state.enemy_workers >= 3
        )
        builder_index: int | None = None
        construction_worker: int | None = None
        worker_indices = [
            int(index) for index in source_indices
            if state.own_positions.get(int(index)) == "Worker"
        ]
        combat_indices = [
            int(index) for index in source_indices
            if state.own_positions.get(int(index)) in {"Light", "Heavy", "Ranged"}
        ]
        guard_combat_index = min(combat_indices) if combat_indices else None
        focus_combat_enemy: int | None = None
        enemy_combat_indices = [
            int(index) for index, name in state.enemy_positions.items()
            if name in {"Light", "Heavy", "Ranged"}
        ]
        if enemy_combat_indices:
            focus_combat_enemy = self._threat_target(
                (int((state.own_base or (0.0, 0.0))[0]), int((state.own_base or (0.0, 0.0))[1])),
                state,
                width,
            )
        if worker_indices and state.own_base is not None:
            construction_worker = min(
                worker_indices,
                key=lambda index: abs((index % width) - state.own_base[0])
                + abs((index // width) - state.own_base[1]),
            )
        if state.own_units.get("Barracks", 0) == 0 and state.own_base is not None:
            # Keep one worker assigned to the tech transition across frames.
            # Re-selecting from only currently idle source cells can transfer
            # the builder role to the other worker while the first is busy.
            if self.builder_index is not None and state.own_positions.get(self.builder_index) == "Worker":
                builder_index = self.builder_index
            elif worker_indices:
                builder_index = min(
                    worker_indices,
                    key=lambda index: abs((index % width) - state.own_base[0])
                    + abs((index // width) - state.own_base[1]),
                )
                self.builder_index = builder_index
        for source_index in source_indices:
            source_index = int(source_index)
            legal_types = self._valid(mask[source_index], 0, 6)
            if not legal_types:
                continue
            source_type = state.own_positions.get(int(source_index), "Unknown")
            producible = self._valid(mask[source_index], 22, len(self.unit_names))
            action_type = self._action_type(source_type, tactic, legal_types, state, producible)
            x, y = int(source_index % width), int(source_index // width)
            nearest_enemy: tuple[float, float] | None = None
            nearest_enemy_distance = 99.0
            if state.enemy_positions:
                nearest_index = min(
                    state.enemy_positions,
                    key=lambda index: abs((index % width) - x) + abs((index // width) - y),
                )
                nearest_enemy = (float(nearest_index % width), float(nearest_index // width))
                nearest_enemy_distance = abs(nearest_enemy[0] - x) + abs(nearest_enemy[1] - y)
            nearest_combat_enemy: tuple[float, float] | None = None
            nearest_combat_distance = 99.0
            if source_type in {"Light", "Heavy", "Ranged"}:
                combat_indices = [
                    index for index, name in state.enemy_positions.items()
                    if name in {"Light", "Heavy", "Ranged"}
                ]
                if source_type == "Ranged":
                    heavy_indices = [
                        index for index, name in state.enemy_positions.items()
                        if name == "Heavy"
                    ]
                    if heavy_indices:
                        combat_indices = heavy_indices
                if combat_indices:
                    combat_index = min(
                        combat_indices,
                        key=lambda index: abs((index % width) - x) + abs((index // width) - y),
                    )
                    nearest_combat_enemy = (float(combat_index % width), float(combat_index // width))
                    nearest_combat_distance = abs(nearest_combat_enemy[0] - x) + abs(nearest_combat_enemy[1] - y)
                # Ranged units should not all chase the same global threat:
                # that makes them walk into a Heavy's melee range. Let each
                # Ranged unit keep its nearest local target so it can kite;
                # melee units still coordinate on the base-threatening unit.
                if focus_combat_enemy is not None and source_type != "Ranged":
                    nearest_combat_enemy = (
                        float(focus_combat_enemy % width),
                        float(focus_combat_enemy // width),
                    )
            nearest_enemy_barracks: tuple[float, float] | None = None
            if source_type in {"Light", "Heavy", "Ranged"}:
                barracks_indices = [
                    index for index, name in state.enemy_positions.items()
                    if name == "Barracks"
                ]
                if barracks_indices:
                    barracks_index = min(
                        barracks_indices,
                        key=lambda index: abs((index % width) - x) + abs((index // width) - y),
                    )
                    nearest_enemy_barracks = (
                        float(barracks_index % width),
                        float(barracks_index // width),
                    )
            counter_worker = (
                worker_rush_counter
                and source_type == "Worker"
                and source_index != builder_index
            )
            guard_worker = (
                worker_rush_counter
                and source_type == "Worker"
                and source_index != builder_index
                and state.enemy_distance > 5
            )
            combat_screen_worker = (
                source_type == "Worker"
                and state.enemy_combat > 0
                and state.own_combat <= state.enemy_combat
                and source_index != builder_index
                and source_index in sorted(worker_indices)[-2:]
            )
            if counter_worker:
                # Do not leave a worker harvesting or building while the rush
                # is already in contact range. Prefer a legal attack, then a
                # direct move toward the enemy centroid.
                if 5 in legal_types and nearest_enemy_distance <= 1:
                    action_type = 5
                elif 1 in legal_types:
                    action_type = 1
            command = commands[source_index]
            movement_target = state.enemy_base or state.enemy_centroid
            # Bind the economy to the resource nearest our base. Choosing the
            # globally nearest resource can silently send a worker across the
            # map after the first movement update (especially on symmetric
            # maps), starving the newly built Barracks.
            economy_anchor = state.own_base or (float(x), float(y))
            own_resource = min(
                state.resource_positions,
                key=lambda point: abs(point[0] - economy_anchor[0]) + abs(point[1] - economy_anchor[1]),
                default=None,
            )
            harvest_target = own_resource
            # The map starts with enough stock for one Barracks.  Against an
            # early rush, spending that stock on a worker cycle is fatal, so
            # commit one nearby worker to the tech transition immediately when
            # the legal mask exposes it.
            if (
                source_type == "Worker"
                and state.own_units.get("Barracks", 0) == 0
                and source_index == builder_index
                and not worker_rush_counter
                and 4 in legal_types
                and self.type_index.get("Barracks") in producible
            ):
                action_type = 4
            elif (
                source_type == "Worker"
                and state.own_units.get("Barracks", 0) == 0
                and source_index != builder_index
                and (not worker_rush_counter or source_index == builder_index)
            ):
                action_type = 3 if 3 in legal_types else 2 if 2 in legal_types else 1 if 1 in legal_types else 0
            elif guard_worker and 1 in legal_types:
                # Keep the non-builder close to the base while the builder
                # completes the long MicroRTS construction action.
                action_type = 1
            elif (
                source_type == "Worker"
                and state.own_units.get("Barracks", 0) < 3
                and state.own_combat >= 2
                and source_index == construction_worker
                and tactic in {"economy", "scout"}
                and not worker_rush_counter
                and 4 in legal_types
                and self.type_index.get("Barracks") in producible
            ):
                # Scale production after the first tech transition when the
                # map economy supports it. This is especially important
                # against MCTS/Coac, which expand multiple production sites.
                action_type = 4
            if source_type == "Worker" and state.own_units.get("Barracks", 0) == 0 and harvest_target is not None:
                resource_distance = abs(harvest_target[0] - x) + abs(harvest_target[1] - y)
                # First complete the gather-return loop. A production action is
                # legal in the mask before the player has enough resources, so
                # blindly selecting it leaves the opening permanently idle.
                if counter_worker:
                    # Preserve the counter-rush move/attack chosen above.
                    pass
                elif action_type != 4 and resource_distance > 1 and 1 in legal_types:
                    action_type = 1
                elif action_type != 4 and 2 in legal_types:
                    action_type = 2
                elif action_type != 4 and 3 in legal_types:
                    action_type = 3
            # Emergency re-tech after a production building is destroyed:
            # construction must override the normal harvest loop for any
            # worker that can legally place a Barracks. This also handles the
            # case where the original persistent builder was killed.
            if (
                source_type == "Worker"
                and state.own_units.get("Barracks", 0) == 0
                and not worker_rush_counter
                and 4 in legal_types
                and self.type_index.get("Barracks") in producible
            ):
                action_type = 4
            command[0] = action_type
            # A rush still needs an economy. Before a barracks exists, send
            # workers to resources rather than walking directly into combat.
            if source_type == "Worker" and state.own_units.get("Barracks", 0) == 0:
                movement_target = harvest_target or state.own_base or state.own_centroid
                if counter_worker and not guard_worker:
                    movement_target = nearest_enemy or state.enemy_centroid or state.enemy_base or movement_target
            elif source_type == "Worker":
                # Workers remain on the local economy after tech. The default
                # target is the enemy base, which is appropriate for combat
                # units but causes workers to walk into the rush themselves.
                movement_target = harvest_target or state.own_base or state.own_centroid
                if counter_worker and not guard_worker:
                    movement_target = nearest_enemy or state.enemy_centroid or state.enemy_base or movement_target
                if (
                    tactic == "defend"
                    and state.enemy_units.get("Heavy", 0) > 0
                    and state.own_units.get("Ranged", 0) < state.enemy_units.get("Heavy", 0)
                ):
                    # When the Heavy threat is numerically ahead, workers are
                    # more valuable alive and harvesting than as a screen
                    # that walks into the enemy army.  This branch is scoped
                    # to Heavy pressure, so WorkerRush interception remains
                    # unchanged.
                    movement_target = state.own_base or state.own_centroid or harvest_target
            if tactic == "defend" and source_type in {"Light", "Heavy", "Ranged"}:
                # Combat units intercept pressure; workers remain on the
                # economy unless the explicit worker-rush counter is active.
                # The 10x10 arena is compact; waiting for a global distance
                # threshold leaves equal-sized defenders idle while the enemy
                # continues producing. Always close on a combat target, while
                # falling back to the base when no such target exists.
                # Intercept as soon as a combat target is observed. Holding a
                # single guard until the global centroid is close lets a rush
                # reach and destroy a Barracks before the rest of the army can
                # engage; all combat units can return to the base fallback
                # when no enemy combat target is visible.
                # If the local combat count is not behind, interrupt the
                # opponent's production cycle; otherwise intercept the army
                # first so the base is not exposed.
                if (
                    state.enemy_units.get("Heavy", 0) > 0
                    and state.own_units.get("Ranged", 0) < state.enemy_units.get("Heavy", 0)
                ):
                    # A numerically superior Heavy army is a base-defense
                    # event, not a chase target. Keep the fragile Ranged
                    # screen near our production so it can fire when the
                    # threat enters range instead of exposing Barracks.
                    movement_target = state.own_base or state.own_centroid
                elif state.own_combat >= state.enemy_combat + 2 and nearest_enemy_barracks is not None:
                    movement_target = nearest_enemy_barracks
                else:
                    movement_target = nearest_combat_enemy or nearest_enemy or state.own_base or state.own_centroid
            elif tactic == "rush" and source_type in {"Light", "Heavy", "Ranged"}:
                # Make the planner's counter-push executable: attack the
                # nearest production building only with a non-inferior army;
                # otherwise converge on the common combat target first.
                if state.own_combat >= state.enemy_combat + 2 and nearest_enemy_barracks is not None:
                    movement_target = nearest_enemy_barracks
                else:
                    movement_target = nearest_combat_enemy or state.enemy_base or state.enemy_centroid
            if (
                source_type == "Ranged"
                and nearest_combat_enemy is not None
                and nearest_combat_distance <= 1
                and 1 in self._valid(mask[source_index], 6, 4)
            ):
                # Ranged units should kite a Heavy rather than trading at
                # point-blank range; one-step retreat keeps the firing line
                # alive for the next decision interval.
                enemy_x, enemy_y = nearest_combat_enemy
                movement_target = (
                    float(x + (x - enemy_x) * 2),
                    float(y + (y - enemy_y) * 2),
                )
            if counter_worker:
                movement_target = (
                    (nearest_enemy or state.enemy_centroid or state.enemy_base)
                    if not guard_worker
                    else (state.own_base or state.own_centroid or movement_target)
                )
            elif combat_screen_worker:
                # Spend one non-builder worker to delay a superior rush while
                # the production line completes its next combat unit.
                if nearest_enemy_distance <= 1 and 5 in legal_types:
                    action_type = 5
                elif 1 in legal_types:
                    action_type = 1
                movement_target = nearest_combat_enemy or nearest_enemy or state.enemy_centroid or movement_target
            command[1] = self._toward_direction((x, y), movement_target, self._valid(mask[source_index], 6, 4))
            command[2] = self._toward_direction((x, y), harvest_target, self._valid(mask[source_index], 10, 4))
            command[3] = self._toward_direction((x, y), state.own_base or state.own_centroid, self._valid(mask[source_index], 14, 4))
            production_dirs = self._valid(mask[source_index], 18, 4)
            if source_type in {"Worker", "Base", "Barracks"}:
                command[4] = self._production_direction((x, y), production_dirs, state, width, height)
            else:
                command[4] = self._toward_direction((x, y), state.enemy_centroid, production_dirs)
            command[5] = self._produce_type(source_type, tactic, producible, source_index)
            # Attack locations are encoded in MicroRTS's fixed 7x7 local window,
            # not as a full-map coordinate even on a 10x10 map.
            targets = self._valid(mask[source_index], 22 + len(self.unit_names), 49)
            if targets and state.enemy_positions:
                local_targets = []
                local_combat_targets = []
                for target_index in targets:
                    dx, dy = (target_index % 7) - 3, (target_index // 7) - 3
                    for enemy_index in state.enemy_positions:
                        enemy_x, enemy_y = enemy_index % width, enemy_index // width
                        if enemy_x - x == dx and enemy_y - y == dy:
                            local_targets.append(target_index)
                            if state.enemy_positions[enemy_index] in {"Light", "Heavy", "Ranged"}:
                                local_combat_targets.append(target_index)
                            break
                attack_targets = local_combat_targets or local_targets
                command[6] = min(attack_targets, key=lambda target: abs((target % 7) - 3) + abs((target // 7) - 3)) if attack_targets else min(targets)
            elif targets:
                command[6] = min(targets)
        return commands.reshape(1, -1)
