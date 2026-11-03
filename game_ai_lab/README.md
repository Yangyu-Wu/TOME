# Game AI Lab

This directory contains two local research testbeds for adversarial game agents.

## Layout

- `microrts/`: deterministic RTS matches, trajectory logging, and an HTML replay.
- `minecraft/`: a local Minecraft server, a Mineflayer NPC, a browser viewer, and JSONL events.
- `logs/`: runtime output. It is intentionally excluded from source control by default.

## Experiment boundary

The policy loop is deliberately split into two rates:

1. The environment and skill policy act every game tick.
2. A high-level policy (eventually an API LLM) is called only on state changes or a fixed decision interval.

This prevents a language model from controlling frame-level actions, keeps API cost bounded, and makes the resulting trajectories reproducible.

## Prerequisites

- A 64-bit JDK 21. The Minecraft baseline is pinned to version 1.21.4, which supports this JDK. Scripts discover `JAVA_HOME`, `java` on `PATH`, or `tools/jdk-21`.
- Python 3.12 is supported by the pinned local environment; the runner uses the
  `gym-microrts` 0.4.3 Java bridge with Gym 0.26 compatibility.
- Node.js 20 or newer for Mineflayer (Node 24 is supported by this workspace setup).

## First run

MicroRTS:

```powershell
cd F:\myPapers\ACL2027\game_ai_lab\microrts
.\bootstrap-microrts.ps1
.\run-match.ps1
# Open logs/microrts/latest.html for a step-by-step browser replay. The page
# supports play/pause, frame stepping, seeking, and playback speed.
# Opens the native Swing visualizer (WorkerRush vs RandomAI):
.\run-visual.ps1
# Stable bot-vs-bot baseline matrix and CSV summary:
.\run-baseline.ps1 -Episodes 3
# TOME trajectory collection, TODM training, and ablation evaluation. The
# runner defaults to the two-worker 10x10 map used by the current experiments:
.\run-tome-experiments.ps1 -Command collect -Episodes 5
.\run-tome-experiments.ps1 -Command train
.\run-tome-experiments.ps1 -Command evaluate -Episodes 3
# Add -SaveReplays to write one HTML replay per method/opponent/episode under
# logs/microrts/tome/results/run-*/replays (use -FrameInterval to control size).
# Adaptive-agent prototype (our controlled player vs one built-in opponent):
.\run-agent.ps1 -Opponent WorkerRush -Episodes 3 -MaxSteps 1000
# Optional high-level API planner; URL, key, and optionally MODEL are read from .env:
.\run-agent.ps1 -Opponent WorkerRush -Episodes 1 -UseApi
```

The baseline runner evaluates RandomAI, PassiveAI, WorkerRush, LightRush,
Coac, and NaiveMCTS in every ordered matchup and writes per-game JSON plus a
summary CSV under `F:\myPapers\ACL2027\logs\microrts\baseline`. The `.env`
`URL` and `key` values are loaded by `microrts/api_client.py` for later
high-level planner experiments; the stable baseline intentionally makes no API
calls.

`run-agent.ps1` is the current implementation of the proposed adaptive RTS
agent. It writes full decision traces under
`F:\myPapers\ACL2027\logs\microrts\agent` and separates: (1) a temporal
opponent-pressure predictor, (2) retrieval from outcome-conditioned episodic
memory, (3) a high-level tactical planner, and (4) a legal-action masked
executor. The default planner is deterministic and does not make API calls;
`-UseApi` makes API planning an explicit experimental condition.

`microrts/tome_experiments.py` is the reproducible research runner. It creates
trajectory JSONL data with future tactical labels, trains NumPy-only temporal
feature baselines, and writes raw per-game records and summaries under
`logs/microrts/tome`. The API condition is always opt-in through
`run-tome-experiments.ps1 -Command evaluate -UseApi`; it is never called by
collection, training, the stable baseline, or the default TOME evaluation.
The current unit-aware executor maps production by source type (Base to Worker,
Worker to Barracks, Barracks to Light), uses resource positions from the
observation planes, selects local attack targets from the legal mask, and keeps
all generated actions mask-valid.

Minecraft:

```powershell
cd F:\myPapers\ACL2027\game_ai_lab\minecraft
.\bootstrap-minecraft.ps1
# Read the Minecraft EULA, then explicitly run .\accept-eula.ps1 if you agree.
.\start-server.ps1
# In a second PowerShell window:
node .\bot.mjs
```

Join the local world at `localhost:25565`; the bot viewer is at `http://localhost:3007`.
