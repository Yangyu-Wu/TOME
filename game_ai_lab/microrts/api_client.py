"""Small OpenAI-compatible chat client for later high-level planning experiments."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


class ApiPlanner:
    def __init__(self, dotenv_path: Path | None = None, timeout: float = 30.0):
        if dotenv_path is not None:
            load_dotenv(dotenv_path)
        self.url = os.environ.get("URL", "").strip()
        self.key = os.environ.get("key", os.environ.get("KEY", "")).strip()
        self.timeout = timeout
        if not self.url or not self.key:
            raise ValueError("API configuration requires URL and key in .env")

    def plan(self, system: str, user: str, model: str | None = None) -> str:
        payload = {
            "model": model or os.environ.get("MODEL", ""),
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0,
        }
        if not payload["model"]:
            payload.pop("model")
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.key}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as exc:
            raise RuntimeError(f"Planner API request failed: {exc}") from exc
        try:
            return str(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("Planner API response has no choices[0].message.content") from exc
