from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
EXPORTS_DIR = PROJECT_ROOT / "exports"


def resolve_db_path() -> Path:
    env_path = os.environ.get("POKEMON_TCG_TRACKER_DB")
    if env_path:
        return Path(env_path)

    drive_snapshot = os.environ.get("POKEMON_TCG_TRACKER_DRIVE_SNAPSHOT")
    if drive_snapshot and Path(drive_snapshot).exists():
        return Path(drive_snapshot)

    return DATA_DIR / "tracker.db"


DB_PATH = resolve_db_path()

API_BASE_URL = "https://api.tcgdex.net/v2/fr"
DEFAULT_BATCH_SIZE = 200
REQUEST_TIMEOUT_SECONDS = 30
EXCLUDED_SERIES_IDS = {"tcgp"}
HOST = os.environ.get("POKEMON_TCG_TRACKER_HOST", "127.0.0.1")
PORT = int(os.environ.get("POKEMON_TCG_TRACKER_PORT", "8765"))
