"""Local dashboard server for MicroRTS Agent experiment records."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = Path(__file__).resolve().parent
LOG_ROOT = ROOT / "logs" / "microrts" / "agent"
RUN_PATTERN = re.compile(r"^run-(\d{8})-(\d{6})\.json$")


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def summary(path: Path, payload: dict) -> dict:
    config = payload.get("configuration", {})
    episodes = payload.get("episodes", [])
    wins = sum(float(row.get("outcome", 0)) > 0 for row in episodes)
    replay = "replay-" + path.stem.replace("run-", "", 1) + "-episode-0.html"
    return {"id": path.stem, "file": path.name, "generatedAt": payload.get("generated_at"),
            "opponent": config.get("opponent", "unknown"), "episodes": len(episodes),
            "wins": wins, "winRate": wins / len(episodes) if episodes else 0, "seed": config.get("seed"),
            "mapPath": config.get("map_path"), "maxSteps": config.get("max_steps"),
            "decisionInterval": config.get("decision_interval"), "replayFile": replay,
            "hasReplay": (LOG_ROOT / replay).exists()}


def runs():
    records = []
    for path in LOG_ROOT.glob("run-*.json"):
        payload = read_json(path)
        if isinstance(payload, dict) and isinstance(payload.get("configuration"), dict) and isinstance(payload.get("episodes"), list):
            records.append((path, payload, summary(path, payload)))
    return sorted(records, key=lambda row: row[0].name, reverse=True)


def detail(run_id: str):
    path = LOG_ROOT / (run_id + ".json")
    if not RUN_PATTERN.match(path.name):
        return None
    payload = read_json(path)
    if not isinstance(payload, dict):
        return None
    episodes = []
    for row in payload.get("episodes", []):
        episodes.append({"episode": row.get("episode"), "steps": row.get("steps"), "outcome": row.get("outcome"),
                         "return": row.get("return"), "finalTactic": row.get("final_tactic"),
                         "decisions": row.get("decisions", [])})
    return {"summary": summary(path, payload), "configuration": payload.get("configuration", {}), "episodes": episodes}


def aggregate(rows):
    groups = {}
    for _, _, row in rows:
        group = groups.setdefault(row["opponent"], {"wins": 0, "episodes": 0, "runs": 0, "seeds": set()})
        group["wins"] += row["wins"]
        group["episodes"] += row["episodes"]
        group["runs"] += 1
        if row["seed"] is not None:
            group["seeds"].add(row["seed"])
    return {"updatedAt": datetime.now(timezone.utc).isoformat(), "runCount": len(rows), "opponents": [
        {"opponent": name, "wins": item["wins"], "episodes": item["episodes"], "runs": item["runs"],
         "winRate": item["wins"] / item["episodes"] if item["episodes"] else 0, "seeds": sorted(item["seeds"])}
        for name, item in sorted(groups.items())]}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def json_response(self, data, status=HTTPStatus.OK):
        output = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(output)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(output)

    def do_GET(self):
        parsed = urlparse(self.path)
        route = unquote(parsed.path)
        current = runs()
        if route == "/api/summary":
            return self.json_response(aggregate(current))
        if route == "/api/runs":
            opponent = parse_qs(parsed.query).get("opponent", ["all"])[0]
            selected = [row for _, _, row in current if opponent == "all" or row["opponent"] == opponent]
            return self.json_response({"runs": selected[:1000]})
        if route.startswith("/api/run/"):
            item = detail(route.rsplit("/", 1)[-1])
            return self.json_response(item or {"error": "Run not found"}, HTTPStatus.OK if item else HTTPStatus.NOT_FOUND)
        if route.startswith("/replays/"):
            candidate = LOG_ROOT / Path(route).name
            if candidate.suffix == ".html" and candidate.exists():
                content = candidate.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                return self.wfile.write(content)
            return self.send_error(HTTPStatus.NOT_FOUND, "Replay not found")
        return super().do_GET()


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("MicroRTS dashboard: http://127.0.0.1:" + str(args.port))
    print("Reading records from: " + str(LOG_ROOT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
