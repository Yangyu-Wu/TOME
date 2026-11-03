"""Run reproducible MicroRTS bot-vs-bot baseline matches."""

from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import jpype
from gym_microrts.envs.new_vec_env import MicroRTSBotVecEnv
from gym_microrts.microrts_ai import (
    coacAI,
    lightRushAI,
    naiveMCTSAI,
    passiveAI,
    randomAI,
    workerRushAI,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "logs" / "microrts" / "baseline"
AI_FACTORIES = {
    "RandomAI": randomAI,
    "PassiveAI": passiveAI,
    "WorkerRush": workerRushAI,
    "LightRush": lightRushAI,
    "Coac": coacAI,
    "NaiveMCTS": naiveMCTSAI,
}


def play(ai1_name: str, ai2_name: str, map_path: str, max_steps: int) -> dict:
    env = MicroRTSBotVecEnv(
        ai1s=[AI_FACTORIES[ai1_name]],
        ai2s=[AI_FACTORIES[ai2_name]],
        max_steps=max_steps,
        map_path=map_path,
    )
    try:
        env.reset()
        total_reward = 0.0
        terminal_win_loss = 0.0
        step = 0
        done = False
        while not done and step < max_steps:
            _, reward, done, info = env.step(np.zeros((1, 1, 1), dtype=np.int32))
            total_reward += float(np.asarray(reward).reshape(-1)[0])
            if info and isinstance(info[0], dict):
                raw = np.asarray(info[0].get("raw_rewards", [])).reshape(-1)
                if len(raw):
                    terminal_win_loss = float(raw[0])
            step += 1
        return {
            "steps": step,
            "return": total_reward,
            "done": bool(done),
            "winner": "ai1" if terminal_win_loss > 0 else "ai2" if terminal_win_loss < 0 else "draw",
        }
    finally:
        # gym-microrts shuts down the JVM in env.close(), but JPype cannot
        # restart a JVM in the same Python process. Close only this client;
        # the experiment shuts down the shared JVM once at the end.
        if hasattr(env, "vec_client"):
            env.vec_client.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--max-steps", type=int, default=2000)
    parser.add_argument("--map", default="maps/10x10/basesTwoWorkers10x10.xml")
    parser.add_argument("--ais", nargs="+", default=list(AI_FACTORIES))
    args = parser.parse_args()
    unknown = sorted(set(args.ais) - set(AI_FACTORIES))
    if unknown:
        raise SystemExit(f"Unknown AI(s): {', '.join(unknown)}")
    random.seed(args.seed)
    np.random.seed(args.seed)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    for ai1 in args.ais:
        for ai2 in args.ais:
            if ai1 == ai2:
                continue
            for episode in range(args.episodes):
                # The Java bot simulator is deterministic for a fixed reset; the
                # explicit seed identifies the reproducible run in the manifest.
                result = play(ai1, ai2, args.map, args.max_steps)
                records.append({"seed": args.seed + episode, "episode": episode, "ai1": ai1, "ai2": ai2, "map": args.map, **result})
                print(f"{ai1:12s} vs {ai2:12s} ep={episode} steps={result['steps']} return={result['return']:.1f} winner={result['winner']}", flush=True)

    summary: list[dict] = []
    for ai in args.ais:
        rows = [r for r in records if r["ai1"] == ai or r["ai2"] == ai]
        wins = sum((r["winner"] == "ai1" and r["ai1"] == ai) or (r["winner"] == "ai2" and r["ai2"] == ai) for r in rows)
        draws = sum(r["winner"] == "draw" for r in rows)
        losses = len(rows) - wins - draws
        # Return is always from player-0/ai1 perspective in gym-microrts;
        # normalize it to the focal AI's perspective for side-independent stats.
        focal_returns = [r["return"] if r["ai1"] == ai else -r["return"] for r in rows]
        summary.append({"ai": ai, "games": len(rows), "wins": wins, "draws": draws, "losses": losses, "win_rate": wins / len(rows) if rows else 0.0, "mean_return": sum(focal_returns) / len(focal_returns) if focal_returns else 0.0, "mean_steps": sum(r["steps"] for r in rows) / len(rows) if rows else 0.0})
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "episodes": args.episodes,
        "map": args.map,
        "ais": args.ais,
        "reproducibility_note": "The gym-microrts bot wrapper accepts a player selector, not a Java RNG seed; seed is retained as the experiment run label. RandomAI may vary across JVM launches.",
        "records": records,
        "summary": summary,
    }
    json_path = OUTPUT_DIR / f"baseline_{stamp}.json"
    csv_path = OUTPUT_DIR / f"baseline_{stamp}.csv"
    json_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=summary[0].keys())
        writer.writeheader()
        writer.writerows(summary)
    (OUTPUT_DIR / "latest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "latest.csv").write_text(csv_path.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Wrote {json_path}")
    print(f"Wrote {csv_path}")
    if jpype.isJVMStarted():
        jpype.shutdownJVM()


if __name__ == "__main__":
    main()
