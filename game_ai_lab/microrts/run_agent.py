"""Run the adaptive hierarchical agent against a built-in MicroRTS opponent."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

# gym-microrts 0.4.3 still references this NumPy alias during observation encoding.
if not hasattr(np, "int"):
    np.int = int  # type: ignore[attr-defined]

import jpype
from gym_microrts import microrts_ai
from gym_microrts.envs.new_vec_env import MicroRTSGridModeVecEnv

from agent_core import MaskedTacticalExecutor, OutcomeConditionedMemory, TacticalPlanner, TemporalOpponentModel, decode_state
from replay_viewer import snapshot, write_replay_html


ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "logs" / "microrts" / "agent"
OPPONENTS: dict[str, Any] = {
    "RandomAI": microrts_ai.randomAI,
    "WorkerRush": microrts_ai.workerRushAI,
    "LightRush": microrts_ai.lightRushAI,
    "Coac": microrts_ai.coacAI,
    "NaiveMCTS": microrts_ai.naiveMCTSAI,
}


def terminal_outcome(info: Any) -> float:
    try:
        return float(info[0]["raw_rewards"][0])
    except (IndexError, KeyError, TypeError):
        return 0.0


def run_episode(env: Any, unit_names: list[str], args: argparse.Namespace, episode: int, memory: OutcomeConditionedMemory, planner: TacticalPlanner) -> dict[str, Any]:
    observation = env.reset()
    predictor = TemporalOpponentModel(args.window)
    executor = MaskedTacticalExecutor(unit_names, seed=args.seed + episode)
    tactic, source = "economy", "initial"
    trace: list[dict[str, Any]] = []
    total_reward = 0.0
    final_state = decode_state(observation, 0, unit_names)
    final_prediction: dict[str, Any] = {"mode": "balanced", "attack_pressure": 0.4}
    done = False
    replay_frames: list[dict[str, Any]] = []

    for step in range(args.max_steps):
        state = decode_state(observation, step, unit_names)
        prediction = predictor.update(state)
        if step % args.decision_interval == 0:
            recalled, record = memory.recommend(state, prediction)
            tactic, source = planner.choose(state, prediction, recalled)
            trace.append({
                "step": step,
                "tactic": tactic,
                "planner_source": source,
                "prediction": prediction,
                "recalled": record,
                "features": state.feature_vector(),
                "own_units": state.own_units,
                "enemy_units": state.enemy_units,
                "own_positions": state.own_positions,
                "enemy_positions": state.enemy_positions,
                "resource_total": state.resource_total,
            })
        if args.save_replay and step % args.frame_interval == 0:
            replay_frames.append(snapshot(
                observation, step, unit_names, tactic=tactic, prediction=prediction,
            ))
        action = executor.actions(env, state, tactic)
        observation, reward, done_array, info = env.step(action)
        total_reward += float(np.asarray(reward).reshape(-1)[0])
        final_state, final_prediction = state, prediction
        done = bool(np.asarray(done_array).reshape(-1)[0])
        if done:
            outcome = terminal_outcome(info)
            if args.save_replay:
                replay_frames.append(snapshot(
                    observation, step + 1, unit_names, tactic=tactic,
                    prediction=prediction, done=True,
                ))
            break
    else:
        outcome = 0.0
    memory.add(final_state, final_prediction, tactic, outcome, total_reward)
    return {
        "episode": episode,
        "steps": step + 1,
        "outcome": outcome,
        "return": total_reward,
        "final_tactic": tactic,
        "decisions": trace,
        "replay_frames": replay_frames,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--opponent", choices=sorted(OPPONENTS), default="WorkerRush")
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--max-steps", type=int, default=1000)
    parser.add_argument("--decision-interval", type=int, default=50)
    parser.add_argument("--window", type=int, default=6)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--use-api", action="store_true")
    parser.add_argument("--map-path", default="maps/10x10/basesTwoWorkers10x10.xml")
    parser.add_argument("--fresh-memory", action="store_true")
    parser.add_argument("--save-replay", action="store_true", help="write a standalone browser replay for episode 0")
    parser.add_argument("--frame-interval", type=int, default=10, help="capture one replay frame every N simulator steps")
    args = parser.parse_args()
    api = None
    if args.use_api:
        from api_client import ApiPlanner
        api = ApiPlanner(ROOT / ".env")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    if args.fresh_memory:
        memory_path = LOG_DIR / f"memory-fresh-{os.getpid()}.jsonl"
        if memory_path.exists():
            memory_path.unlink()
    else:
        memory_path = LOG_DIR / "memory.jsonl"
    memory = OutcomeConditionedMemory(memory_path)
    planner = TacticalPlanner(api)
    env = MicroRTSGridModeVecEnv(
        num_selfplay_envs=0,
        num_bot_envs=1,
        ai2s=[OPPONENTS[args.opponent]],
        max_steps=args.max_steps,
        map_path=args.map_path,
    )
    unit_names = [unit["name"] for unit in env.utt["unitTypes"]]
    try:
        episodes = [run_episode(env, unit_names, args, episode, memory, planner) for episode in range(args.episodes)]
    finally:
        env.vec_client.close()
        jpype.shutdownJVM()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "configuration": vars(args),
        "episodes": episodes,
    }
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output = LOG_DIR / f"run-{stamp}.json"
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    (LOG_DIR / "latest.json").write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    if args.save_replay and episodes:
        first = episodes[0]
        replay_payload = {
            "title": f"Adaptive Agent vs {args.opponent}: episode 0",
            "meta": (
                f"map={args.map_path}; seed={args.seed}; outcome={first['outcome']:+.0f}; "
                f"frames every {args.frame_interval} steps"
            ),
            "frames": first["replay_frames"],
        }
        replay_output = LOG_DIR / f"replay-{stamp}-episode-0.html"
        write_replay_html(replay_payload, replay_output)
        write_replay_html(replay_payload, LOG_DIR / "latest-replay.html")
        print(f"Replay: {replay_output}")
    wins = sum(episode["outcome"] > 0 for episode in episodes)
    print(f"Wrote {output}")
    print(f"Agent vs {args.opponent}: {wins}/{len(episodes)} wins")


if __name__ == "__main__":
    main()
