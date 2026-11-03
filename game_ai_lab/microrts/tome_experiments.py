"""Reproducible data, TODM, and ablation experiments for TOME.

This runner keeps experimental claims tied to artifacts: it generates supervised
trajectory data, trains NumPy-only temporal baselines, evaluates executable TOME
variants, and writes raw episode records plus summaries.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

if not hasattr(np, "int"):
    np.int = int  # type: ignore[attr-defined]

import jpype
from gym_microrts import microrts_ai
from gym_microrts.envs.new_vec_env import MicroRTSGridModeVecEnv

from agent_core import (
    MaskedTacticalExecutor,
    OutcomeConditionedMemory,
    TACTICS,
    TacticalPlanner,
    TemporalOpponentModel,
    decode_state,
)
from replay_viewer import snapshot, write_replay_html


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "logs" / "microrts" / "tome"
DATA_DIR = OUTPUT_DIR / "data"
MODEL_DIR = OUTPUT_DIR / "models"
RESULT_DIR = OUTPUT_DIR / "results"

OPPONENTS: dict[str, Any] = {
    "PassiveAI": microrts_ai.passiveAI,
    "RandomAI": microrts_ai.randomAI,
    "WorkerRush": microrts_ai.workerRushAI,
    "LightRush": microrts_ai.lightRushAI,
    "Coac": microrts_ai.coacAI,
    "NaiveMCTS": microrts_ai.naiveMCTSAI,
}
OPPONENT_PRIOR = {
    "PassiveAI": "economic",
    "RandomAI": "balanced",
    "WorkerRush": "rush",
    "LightRush": "rush",
    "Coac": "advance",
    "NaiveMCTS": "balanced",
}
MODE_TO_ID = {"economic": 0, "balanced": 1, "advance": 2, "rush": 3}
ID_TO_MODE = {value: key for key, value in MODE_TO_ID.items()}


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def terminal_outcome(info: Any) -> float:
    try:
        return float(info[0]["raw_rewards"][0])
    except (IndexError, KeyError, TypeError):
        return 0.0


def make_env(opponent: str, max_steps: int, map_path: str = "maps/10x10/basesTwoWorkers10x10.xml") -> MicroRTSGridModeVecEnv:
    return MicroRTSGridModeVecEnv(
        num_selfplay_envs=0,
        num_bot_envs=1,
        ai2s=[OPPONENTS[opponent]],
        max_steps=max_steps,
        map_path=map_path,
    )


def close_env(env: Any) -> None:
    if hasattr(env, "vec_client"):
        env.vec_client.close()


def unit_names(env: Any) -> list[str]:
    return [unit["name"] for unit in env.utt["unitTypes"]]


def target_offset(unit_count: int) -> int:
    return 22 + unit_count


def action_is_valid(env: Any, action: np.ndarray, names: list[str]) -> bool:
    """Validate submitted unit actions against the same mask CTPE receives."""
    mask = env.get_action_mask()[0]
    sources = env.source_unit_mask[0]
    commands = np.asarray(action).reshape(env.width * env.height, 7)
    for source in np.flatnonzero(sources):
        command = commands[source]
        kind = int(command[0])
        if kind < 0 or kind >= 6 or mask[source, kind] <= 0:
            return False
        if kind == 1 and mask[source, 6 + int(command[1])] <= 0:
            return False
        if kind == 2 and mask[source, 10 + int(command[2])] <= 0:
            return False
        if kind == 3 and mask[source, 14 + int(command[3])] <= 0:
            return False
        if kind == 4:
            if mask[source, 18 + int(command[4])] <= 0:
                return False
            produce_index = 22 + int(command[5])
            if produce_index >= target_offset(len(names)) or mask[source, produce_index] <= 0:
                return False
        if kind == 5:
            attack_index = target_offset(len(names)) + int(command[6])
            if attack_index >= len(mask[source]) or mask[source, attack_index] <= 0:
                return False
    return True


def pressure(state: Any) -> float:
    proximity = max(0.0, 14.0 - min(state.enemy_distance, 14.0)) / 14.0
    raw = 0.12 * state.enemy_workers + 0.35 * state.enemy_combat
    return round(float(min(1.0, raw * (0.5 + proximity))), 4)


def tactical_label(state: Any, opponent: str) -> str:
    """Observable label definition used consistently for collection and RQ1."""
    if state.enemy_combat >= 1 or (state.enemy_workers >= 3 and state.enemy_distance <= 10.0):
        return "rush"
    if opponent == "PassiveAI":
        return "economic"
    if opponent == "Coac" and state.enemy_distance <= 11.0:
        return "advance"
    return OPPONENT_PRIOR[opponent]


def random_tactic(step: int, rng: random.Random) -> str:
    if step % 50 == 0:
        return rng.choice(TACTICS)
    return "economy"


def collect(args: argparse.Namespace) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    output = DATA_DIR / f"trajectories-{now_stamp()}.jsonl"
    rng = random.Random(args.seed)
    trajectory_id = 0
    with output.open("w", encoding="utf-8") as handle:
        for opponent in args.opponents:
            env = make_env(opponent, args.max_steps, args.map)
            names = unit_names(env)
            try:
                for episode in range(args.episodes):
                    observation = env.reset()
                    executor = MaskedTacticalExecutor(names, seed=args.seed + trajectory_id)
                    frames: list[dict[str, Any]] = []
                    for step in range(args.max_steps):
                        state = decode_state(observation, step, names)
                        frames.append({
                            "step": step,
                            "features": state.feature_vector(),
                            "mode": tactical_label(state, opponent),
                            "pressure": pressure(state),
                        })
                        tactic = random_tactic(step, rng)
                        action = executor.actions(env, state, tactic)
                        observation, _, done, _ = env.step(action)
                        if bool(np.asarray(done).reshape(-1)[0]):
                            break
                    stride_frames = frames[:: args.stride]
                    horizon = max(1, args.horizon // args.stride)
                    for index, frame in enumerate(stride_frames):
                        future = stride_frames[min(index + horizon, len(stride_frames) - 1)]
                        row = {
                            "trajectory_id": trajectory_id,
                            "episode": episode,
                            "opponent": opponent,
                            "tick": frame["step"],
                            "features": frame["features"],
                            "mode": frame["mode"],
                            "pressure": frame["pressure"],
                            "future_mode": future["mode"],
                            "future_pressure": future["pressure"],
                        }
                        handle.write(json.dumps(row, ensure_ascii=True) + "\n")
                    trajectory_id += 1
                    print(f"collected opponent={opponent} episode={episode} frames={len(frames)}", flush=True)
            finally:
                close_env(env)
    if jpype.isJVMStarted():
        jpype.shutdownJVM()
    (DATA_DIR / "latest.jsonl").write_text(output.read_text(encoding="utf-8"), encoding="utf-8")
    return output


def load_rows(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def make_examples(rows: list[dict[str, Any]], window: int, kind: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[int], list[int]]:
    by_trajectory: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_trajectory[int(row["trajectory_id"])].append(row)
    features: list[np.ndarray] = []
    labels: list[int] = []
    pressures: list[float] = []
    groups: list[int] = []
    ticks: list[int] = []
    for trajectory_id, sequence in by_trajectory.items():
        sequence.sort(key=lambda item: item["tick"])
        values = np.asarray([item["features"] for item in sequence], dtype=float)
        for index, row in enumerate(sequence):
            start = max(0, index - window + 1)
            block = values[start : index + 1]
            if len(block) < window:
                block = np.vstack([np.repeat(block[[0]], window - len(block), axis=0), block])
            if kind == "single":
                vector = block[-1]
            elif kind == "stats":
                vector = np.concatenate([block.mean(axis=0), block.std(axis=0), block[-1] - block[0]])
            elif kind == "sequence":
                vector = block.reshape(-1)
            else:
                raise ValueError(f"Unknown feature kind: {kind}")
            features.append(vector)
            labels.append(MODE_TO_ID[row["future_mode"]])
            pressures.append(float(row["future_pressure"]))
            groups.append(trajectory_id)
            ticks.append(int(row["tick"]))
    return np.asarray(features), np.asarray(labels), np.asarray(pressures), groups, ticks


def standardize(train: np.ndarray, test: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    mean = train.mean(axis=0)
    scale = train.std(axis=0)
    scale[scale < 1e-6] = 1.0
    return (train - mean) / scale, (test - mean) / scale, mean, scale


def fit_softmax(x: np.ndarray, y: np.ndarray, classes: int, seed: int, epochs: int = 400, lr: float = 0.08) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    weights = rng.normal(0.0, 0.01, size=(x.shape[1], classes))
    bias = np.zeros(classes)
    one_hot = np.eye(classes)[y]
    for _ in range(epochs):
        logits = np.clip(x @ weights + bias, -40, 40)
        exp = np.exp(logits - logits.max(axis=1, keepdims=True))
        probabilities = exp / exp.sum(axis=1, keepdims=True)
        error = probabilities - one_hot
        weights -= lr * (x.T @ error / len(x) + 1e-4 * weights)
        bias -= lr * error.mean(axis=0)
    return weights, bias


def predict_softmax(x: np.ndarray, weights: np.ndarray, bias: np.ndarray) -> np.ndarray:
    return np.argmax(x @ weights + bias, axis=1)


def fit_ridge(x: np.ndarray, y: np.ndarray, alpha: float = 1e-3) -> tuple[np.ndarray, float]:
    augmented = np.column_stack([x, np.ones(len(x))])
    regularizer = np.eye(augmented.shape[1]) * alpha
    solution = np.linalg.solve(augmented.T @ augmented + regularizer, augmented.T @ y)
    return solution[:-1], float(solution[-1])


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    scores = []
    for label in range(len(MODE_TO_ID)):
        tp = int(np.sum((y_true == label) & (y_pred == label)))
        fp = int(np.sum((y_true != label) & (y_pred == label)))
        fn = int(np.sum((y_true == label) & (y_pred != label)))
        denom = 2 * tp + fp + fn
        scores.append(0.0 if denom == 0 else 2 * tp / denom)
    return float(np.mean(scores))


def train(args: argparse.Namespace) -> Path:
    rows = load_rows(Path(args.data))
    trajectory_ids = sorted({int(row["trajectory_id"]) for row in rows})
    heldout = {trajectory_id for trajectory_id in trajectory_ids if trajectory_id % 5 == 0}
    if not heldout:
        heldout = {trajectory_ids[-1]}
    summary: list[dict[str, Any]] = []
    models: dict[str, dict[str, Any]] = {}
    for kind in ("single", "stats", "sequence"):
        x, y, p, groups, ticks = make_examples(rows, args.window, kind)
        test_mask = np.asarray([group in heldout for group in groups])
        x_train, x_test = x[~test_mask], x[test_mask]
        y_train, y_test = y[~test_mask], y[test_mask]
        p_train, p_test = p[~test_mask], p[test_mask]
        x_train, x_test, mean, scale = standardize(x_train, x_test)
        weights, bias = fit_softmax(x_train, y_train, len(MODE_TO_ID), args.seed)
        regression_weights, regression_bias = fit_ridge(x_train, p_train)
        predicted = predict_softmax(x_test, weights, bias)
        pressure_prediction = x_test @ regression_weights + regression_bias
        test_groups = np.asarray(groups)[test_mask]
        test_ticks = np.asarray(ticks)[test_mask]
        delays = []
        for trajectory_id in sorted(set(test_groups)):
            indices = np.flatnonzero(test_groups == trajectory_id)
            truth_rush = test_ticks[indices][y_test[indices] == MODE_TO_ID["rush"]]
            predicted_rush = test_ticks[indices][predicted[indices] == MODE_TO_ID["rush"]]
            if len(truth_rush):
                first_truth = int(truth_rush.min())
                first_prediction = int(predicted_rush.min()) if len(predicted_rush) else int(test_ticks[indices].max())
                delays.append(max(0, first_prediction - first_truth))
        result = {
            "model": {"single": "Single frame", "stats": "Window statistics", "sequence": "Temporal sequence"}[kind],
            "feature_kind": kind,
            "mode_macro_f1": macro_f1(y_test, predicted),
            "pressure_mae": float(np.abs(pressure_prediction - p_test).mean()),
            "rush_response_delay_ticks": float(np.mean(delays)) if delays else None,
            "train_examples": int(len(x_train)),
            "test_examples": int(len(x_test)),
            "heldout_trajectories": sorted(heldout),
        }
        summary.append(result)
        models[kind] = {
            "mean": mean.tolist(),
            "scale": scale.tolist(),
            "weights": weights.tolist(),
            "bias": bias.tolist(),
            "pressure_weights": regression_weights.tolist(),
            "pressure_bias": regression_bias,
            "window": args.window,
        }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"created_at": datetime.now(timezone.utc).isoformat(), "data": str(Path(args.data)), "results": summary, "models": models}
    output = MODEL_DIR / f"todm-{now_stamp()}.json"
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (MODEL_DIR / "latest.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output


class VariantController:
    def __init__(self, method: str, names: list[str], memory_path: Path, seed: int, api_planner: Any | None = None, model_path: Path | None = None):
        self.method = method
        self.predictor = TemporalOpponentModel(1 if method == "state_only" else 6)
        self.learned_predictor = LearnedTemporalPredictor(model_path) if method == "tome_learned" and model_path else None
        self.executor = MaskedTacticalExecutor(names, seed)
        self.memory = OutcomeConditionedMemory(memory_path) if method not in {"no_ocem"} and not method.startswith("fixed_") else None
        self.planner = TacticalPlanner(api_planner if method == "tome_api" else None)
        self.tactic = "economy"
        self.last_state: Any | None = None
        self.last_prediction: dict[str, Any] = {"mode": "balanced", "attack_pressure": 0.4}
        self.decision_time = 0.0
        self.decisions = 0

    def decide(self, state: Any, step: int) -> str:
        started = time.perf_counter()
        if self.method.startswith("fixed_"):
            self.tactic = self.method.removeprefix("fixed_")
            prediction = {"mode": "balanced", "attack_pressure": 0.4}
        elif self.method == "no_todm":
            prediction = {"mode": "balanced", "attack_pressure": 0.4}
            self.tactic, _ = self.planner.choose(state, prediction, None)
        else:
            prediction = self.learned_predictor.update(state) if self.learned_predictor else self.predictor.update(state)
            recalled = None
            if self.memory is not None:
                recalled, _ = self.memory.recommend(state, prediction)
            self.tactic, _ = self.planner.choose(state, prediction, recalled)
        self.last_state, self.last_prediction = state, prediction
        self.decision_time += time.perf_counter() - started
        self.decisions += 1
        return self.tactic

    def action(self, env: Any, state: Any) -> np.ndarray:
        if self.method == "no_ctpe":
            return env.action_space.sample().reshape(1, -1).astype(np.int32)
        return self.executor.actions(env, state, self.tactic)

    def finish(self, outcome: float, total_return: float) -> None:
        if self.memory is not None and self.last_state is not None:
            self.memory.add(self.last_state, self.last_prediction, self.tactic, outcome, total_return)


class LearnedTemporalPredictor:
    """Inference wrapper for a trained NumPy TODM feature model."""

    def __init__(self, model_path: Path):
        payload = json.loads(model_path.read_text(encoding="utf-8"))
        self.model = payload["models"]["stats"]
        self.window = int(self.model["window"])
        self.history: deque[np.ndarray] = deque(maxlen=self.window)
        self.mean = np.asarray(self.model["mean"], dtype=float)
        self.scale = np.asarray(self.model["scale"], dtype=float)
        self.weights = np.asarray(self.model["weights"], dtype=float)
        self.bias = np.asarray(self.model["bias"], dtype=float)
        self.pressure_weights = np.asarray(self.model["pressure_weights"], dtype=float)
        self.pressure_bias = float(self.model["pressure_bias"])

    def update(self, state: Any) -> dict[str, Any]:
        self.history.append(np.asarray(state.feature_vector(), dtype=float))
        block = np.asarray(self.history, dtype=float)
        if len(block) < self.window:
            block = np.vstack([np.repeat(block[[0]], self.window - len(block), axis=0), block])
        feature = np.concatenate([block.mean(axis=0), block.std(axis=0), block[-1] - block[0]])
        normalized = (feature - self.mean) / self.scale
        logits = normalized @ self.weights + self.bias
        mode = ID_TO_MODE[int(np.argmax(logits))]
        predicted_pressure = float(np.clip(normalized @ self.pressure_weights + self.pressure_bias, 0.0, 1.0))
        return {"mode": mode, "attack_pressure": predicted_pressure, "source": "learned_stats"}


def evaluate(args: argparse.Namespace) -> Path:
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    run_dir = RESULT_DIR / f"run-{now_stamp()}"
    run_dir.mkdir()
    api_planner = None
    if "tome_api" in args.methods:
        if not args.use_api:
            raise SystemExit("tome_api requires --use-api so external calls are explicit")
        from api_client import ApiPlanner
        api_planner = ApiPlanner(ROOT / ".env")
    model_path = Path(args.todm_model) if args.todm_model else MODEL_DIR / "latest.json"
    if "tome_learned" in args.methods and not model_path.exists():
        raise SystemExit(f"tome_learned requires a trained TODM model at {model_path}")
    records: list[dict[str, Any]] = []
    for method in args.methods:
        for opponent in args.opponents:
            memory_path = run_dir / "memory" / f"{method}-{opponent}.jsonl"
            for episode in range(args.episodes):
                env = make_env(opponent, args.max_steps, args.map)
                names = unit_names(env)
                controller = VariantController(method, names, memory_path, args.seed + episode, api_planner, model_path)
                try:
                    observation = env.reset()
                    total_return = 0.0
                    invalid = 0
                    done = False
                    replay_frames: list[dict[str, Any]] = []
                    for step in range(args.max_steps):
                        state = decode_state(observation, step, names)
                        if step % args.decision_interval == 0:
                            controller.decide(state, step)
                        if args.save_replays and (step % args.frame_interval == 0):
                            replay_frames.append(snapshot(
                                observation, step, names,
                                tactic=getattr(controller, "tactic", None),
                                prediction=getattr(controller, "last_prediction", None),
                            ))
                        action = controller.action(env, state)
                        invalid += int(not action_is_valid(env, action, names))
                        observation, reward, done_array, info = env.step(action)
                        total_return += float(np.asarray(reward).reshape(-1)[0])
                        done = bool(np.asarray(done_array).reshape(-1)[0])
                        if done:
                            outcome = terminal_outcome(info)
                            if args.save_replays:
                                replay_frames.append(snapshot(observation, step + 1, names, done=True))
                            break
                    else:
                        outcome = 0.0
                    controller.finish(outcome, total_return)
                    if args.save_replays:
                        replay_dir = run_dir / "replays"
                        replay_dir.mkdir(parents=True, exist_ok=True)
                        replay_payload = {
                            "title": f"TOME: {method} vs {opponent} · episode {episode}",
                            "meta": f"map={args.map}; frames every {args.frame_interval} steps; outcome={outcome:+.0f}",
                            "frames": replay_frames,
                        }
                        replay_path = replay_dir / f"{method}-{opponent}-episode-{episode}.html"
                        write_replay_html(replay_payload, replay_path)
                    records.append({
                        "method": method,
                        "opponent": opponent,
                        "episode": episode,
                        "steps": step + 1,
                        "outcome": outcome,
                        "return": total_return,
                        "win": int(outcome > 0),
                        "invalid_action_rate": invalid / max(1, step + 1),
                        "planner_latency_ms": 1000 * controller.decision_time / max(1, controller.decisions),
                        "planner_decisions": controller.decisions,
                    })
                    print(f"evaluated method={method} opponent={opponent} episode={episode} outcome={outcome:+.0f}", flush=True)
                finally:
                    close_env(env)
    if jpype.isJVMStarted():
        jpype.shutdownJVM()
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[(record["method"], record["opponent"])].append(record)
    summary = []
    for (method, opponent), rows in sorted(grouped.items()):
        summary.append({
            "method": method,
            "opponent": opponent,
            "games": len(rows),
            "win_rate": float(np.mean([row["win"] for row in rows])),
            "mean_return": float(np.mean([row["return"] for row in rows])),
            "invalid_action_rate": float(np.mean([row["invalid_action_rate"] for row in rows])),
            "planner_latency_ms": float(np.mean([row["planner_latency_ms"] for row in rows])),
        })
    (run_dir / "records.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with (run_dir / "summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary[0]) if summary else [])
        writer.writeheader()
        writer.writerows(summary)
    (RESULT_DIR / "latest.json").write_text(json.dumps({"run_dir": str(run_dir), "summary": summary}, indent=2), encoding="utf-8")
    return run_dir


def bootstrap_interval(values: list[float], seed: int = 7, samples: int = 2000) -> tuple[float, float]:
    if not values:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    array = np.asarray(values, dtype=float)
    means = rng.choice(array, size=(samples, len(array)), replace=True).mean(axis=1)
    return (float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975)))


def aggregate(args: argparse.Namespace) -> Path:
    """Merge the most recent complete per-method runs without using partial runs."""
    candidates: dict[str, tuple[float, Path, list[dict[str, Any]]]] = {}
    expected = len(args.opponents) * args.episodes
    for directory in RESULT_DIR.glob("run-*"):
        records_path = directory / "records.json"
        if not records_path.exists():
            continue
        records = json.loads(records_path.read_text(encoding="utf-8"))
        # Evaluation can batch several methods in one run.  Select a complete
        # per-method slice instead of requiring one method per directory.
        for method in {record["method"] for record in records}:
            method_records = [record for record in records if record["method"] == method]
            if len(method_records) != expected:
                continue
            present_opponents = {record["opponent"] for record in method_records}
            if present_opponents != set(args.opponents):
                continue
            candidate = (directory.stat().st_mtime, directory, method_records)
            if method not in candidates or candidate[0] > candidates[method][0]:
                candidates[method] = candidate
    missing = [method for method in args.methods if method not in candidates]
    if missing:
        raise SystemExit(f"No complete run found for: {', '.join(missing)}")
    records = [record for method in args.methods for record in candidates[method][2]]
    summary: list[dict[str, Any]] = []
    for method in args.methods:
        method_rows = [row for row in records if row["method"] == method]
        for opponent in args.opponents + ["ALL"]:
            rows = method_rows if opponent == "ALL" else [row for row in method_rows if row["opponent"] == opponent]
            wins = [float(row["win"]) for row in rows]
            returns = [float(row["return"]) for row in rows]
            win_low, win_high = bootstrap_interval(wins, args.seed)
            return_low, return_high = bootstrap_interval(returns, args.seed)
            summary.append({
                "method": method,
                "opponent": opponent,
                "games": len(rows),
                "win_rate": float(np.mean(wins)),
                "win_rate_ci_low": win_low,
                "win_rate_ci_high": win_high,
                "mean_return": float(np.mean(returns)),
                "mean_return_ci_low": return_low,
                "mean_return_ci_high": return_high,
                "invalid_action_rate": float(np.mean([row["invalid_action_rate"] for row in rows])),
                "planner_latency_ms": float(np.mean([row["planner_latency_ms"] for row in rows])),
            })
    output = RESULT_DIR / f"final-summary-{now_stamp()}"
    output.mkdir(parents=True)
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "episodes_per_opponent": args.episodes,
        "opponents": args.opponents,
        "methods": args.methods,
        "source_runs": {method: str(candidates[method][1]) for method in args.methods},
        "records": records,
        "summary": summary,
    }
    (output / "summary.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with (output / "summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary[0]))
        writer.writeheader()
        writer.writerows(summary)
    (RESULT_DIR / "latest_complete.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--opponents", nargs="+", choices=sorted(OPPONENTS), default=list(OPPONENTS))
    common.add_argument("--episodes", type=int, default=3)
    common.add_argument("--max-steps", type=int, default=500)
    common.add_argument("--seed", type=int, default=7)
    common.add_argument("--map", default="maps/10x10/basesTwoWorkers10x10.xml")

    collect_parser = subparsers.add_parser("collect", parents=[common])
    collect_parser.add_argument("--stride", type=int, default=10)
    collect_parser.add_argument("--horizon", type=int, default=50)

    train_parser = subparsers.add_parser("train")
    train_parser.add_argument("--data", required=True)
    train_parser.add_argument("--window", type=int, default=6)
    train_parser.add_argument("--seed", type=int, default=7)

    evaluate_parser = subparsers.add_parser("evaluate", parents=[common])
    evaluate_parser.add_argument("--methods", nargs="+", default=["fixed_economy", "fixed_defend", "fixed_rush", "state_only", "no_todm", "no_ocem", "no_ctpe", "tome_rule"])
    evaluate_parser.add_argument("--decision-interval", type=int, default=50)
    evaluate_parser.add_argument("--use-api", action="store_true")
    evaluate_parser.add_argument("--todm-model")
    evaluate_parser.add_argument("--save-replays", action="store_true", help="write standalone HTML board replays")
    evaluate_parser.add_argument("--frame-interval", type=int, default=10, help="record one board frame every N simulator steps")

    aggregate_parser = subparsers.add_parser("aggregate", parents=[common])
    aggregate_parser.add_argument("--methods", nargs="+", default=["fixed_economy", "fixed_defend", "fixed_rush", "state_only", "no_todm", "no_ocem", "no_ctpe", "tome_rule", "tome_learned"])

    args = parser.parse_args()
    if args.command == "collect":
        output = collect(args)
    elif args.command == "train":
        output = train(args)
    elif args.command == "evaluate":
        output = evaluate(args)
    else:
        output = aggregate(args)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
