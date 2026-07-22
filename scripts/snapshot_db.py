from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.config import DB_PATH


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a safe SQLite snapshot copy.")
    parser.add_argument(
        "--output",
        required=True,
        help="Destination path for the snapshot database file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_path = Path(DB_PATH)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(source_path) as source:
        with sqlite3.connect(output_path) as destination:
            source.backup(destination)

    print(f"Snapshot created: {output_path}")


if __name__ == "__main__":
    main()
