"""Create a deterministic MicroRTS smoke-test trajectory and browser replay."""

from __future__ import annotations

import argparse
import base64
from io import BytesIO
import json
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import gym_microrts
from gym_microrts.envs.new_vec_env import MicroRTSBotVecEnv
from gym_microrts.microrts_ai import workerRushAI, randomAI
from replay_viewer import write_replay_html


def rendered_frame(env: MicroRTSBotVecEnv, step: int, reward: float, total_reward: float, done: bool) -> dict:
    """Capture the Java renderer because bot-vs-bot observations are rewards only."""
    from PIL import Image
    image = Image.fromarray(np.asarray(env.render(mode="rgb_array")))
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {"step": step, "reward": reward, "total_reward": total_reward,
            "done": done, "image": "data:image/png;base64," + encoded}


ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "logs" / "microrts"


def run_episode(env: MicroRTSBotVecEnv, seed: int, episode: int) -> dict:
    # The Java simulator is deterministic; reset with a fixed seed selector.
    observation = env.reset()
    del seed
    done = False
    total_reward = 0.0
    frames: list[dict] = []
    step = 0

    while not done and step < 2_000:
        # Bot-vs-bot mode advances with a dummy discrete action; both Java AIs
        # choose their own legal game actions.
        action = np.zeros((1, 1, 1), dtype=np.int32)
        observation, reward, done, info = env.step(action)
        step_reward = float(np.asarray(reward).reshape(-1)[0])
        total_reward += step_reward
        if step % 10 == 0 or done:
            frames.append(rendered_frame(env, step, step_reward, total_reward, bool(done)))
        step += 1

    return {"episode": episode, "steps": step, "return": total_reward, "frames": frames}


def write_replay(result: dict, output: Path) -> None:
    # The viewer currently plays the first episode; all episodes remain in JSON.
    first = result["episodes"][0] if result.get("episodes") else {"frames": []}
    write_replay_html({
        "title": "MicroRTS bot-vs-bot replay",
        "meta": f"seed={result.get('seed')}; episode={first.get('episode')}; other episodes are in latest.json",
        "frames": first.get("frames", []),
    }, output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--episodes", type=int, default=4)
    args = parser.parse_args()
    random.seed(args.seed)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    env = MicroRTSBotVecEnv(
        ai1s=[workerRushAI],
        ai2s=[randomAI],
        max_steps=2000,
        map_path="maps/10x10/basesTwoWorkers10x10.xml",
    )
    episodes = [run_episode(env, args.seed, episode) for episode in range(args.episodes)]
    env.close()
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "episodes": episodes,
    }
    (LOG_DIR / "latest.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    write_replay(result, LOG_DIR / "latest.html")
    print(f"Wrote {LOG_DIR / 'latest.json'}")
    print(f"Open {LOG_DIR / 'latest.html'} in a browser.")


if __name__ == "__main__":
    main()
