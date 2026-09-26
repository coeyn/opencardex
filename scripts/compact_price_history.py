from __future__ import annotations

import argparse
import shutil
import sqlite3
from pathlib import Path

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.config import DB_PATH


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compact duplicate daily price snapshots.")
    parser.add_argument("--db-path", type=Path, default=DB_PATH)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply cleanup. Without this flag, only prints diagnostics.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating a .bak copy before applying cleanup.",
    )
    parser.add_argument(
        "--vacuum",
        action="store_true",
        help="Run VACUUM after cleanup to shrink the SQLite file.",
    )
    return parser.parse_args()


def connect(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def print_diagnostics(connection: sqlite3.Connection) -> None:
    total_rows = connection.execute("SELECT COUNT(*) FROM price_snapshots").fetchone()[0]
    duplicate_row = connection.execute(
        """
        SELECT COUNT(*) AS duplicate_groups, COALESCE(SUM(c - 1), 0) AS duplicate_extra_rows
        FROM (
            SELECT COUNT(*) AS c
            FROM price_snapshots
            GROUP BY card_id, source_name, substr(captured_at, 1, 10)
            HAVING c > 1
        )
        """
    ).fetchone()
    raw_row = connection.execute(
        """
        SELECT
            SUM(raw_pricing_json IS NOT NULL) AS raw_rows,
            COALESCE(SUM(LENGTH(raw_pricing_json)), 0) AS raw_bytes
        FROM price_snapshots
        """
    ).fetchone()

    print(f"price_snapshots rows: {total_rows}")
    print(f"duplicate daily groups: {duplicate_row['duplicate_groups']}")
    print(f"duplicate extra rows: {duplicate_row['duplicate_extra_rows']}")
    print(f"rows with raw_pricing_json: {raw_row['raw_rows']}")
    print(f"raw_pricing_json size: {raw_row['raw_bytes'] / 1024 / 1024 / 1024:.2f} GB")


def backup_database(db_path: Path) -> Path:
    backup_path = db_path.with_suffix(db_path.suffix + ".bak")
    shutil.copy2(db_path, backup_path)
    return backup_path


def compact_history(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA foreign_keys=OFF")
    connection.execute("PRAGMA temp_store=FILE")
    connection.execute("DROP TABLE IF EXISTS price_snapshots_compact")
    connection.execute(
        """
        CREATE TABLE price_snapshots_compact (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            source_updated_at TEXT,
            source_name TEXT NOT NULL,
            currency TEXT,
            product_id INTEGER,
            avg REAL,
            low REAL,
            trend REAL,
            avg1 REAL,
            avg7 REAL,
            avg30 REAL,
            avg_holo REAL,
            low_holo REAL,
            trend_holo REAL,
            avg1_holo REAL,
            avg7_holo REAL,
            avg30_holo REAL,
            raw_pricing_json TEXT,
            sync_run_id INTEGER,
            tcgplayer_currency TEXT,
            tcgplayer_normal_market REAL,
            tcgplayer_reverse_market REAL,
            tcgplayer_updated TEXT,
            FOREIGN KEY (card_id) REFERENCES cards(card_id),
            FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO price_snapshots_compact (
            id, card_id, captured_at, source_updated_at, source_name, currency, product_id,
            avg, low, trend, avg1, avg7, avg30, avg_holo, low_holo, trend_holo,
            avg1_holo, avg7_holo, avg30_holo, raw_pricing_json, sync_run_id,
            tcgplayer_currency, tcgplayer_normal_market, tcgplayer_reverse_market, tcgplayer_updated
        )
        SELECT
            id, card_id, captured_at, source_updated_at, source_name, currency, product_id,
            avg, low, trend, avg1, avg7, avg30, avg_holo, low_holo, trend_holo,
            avg1_holo, avg7_holo, avg30_holo, NULL, sync_run_id,
            tcgplayer_currency, tcgplayer_normal_market, tcgplayer_reverse_market, tcgplayer_updated
        FROM price_snapshots
        WHERE id IN (
            SELECT MAX(id)
            FROM price_snapshots
            GROUP BY card_id, source_name, substr(captured_at, 1, 10)
        )
        """
    )
    connection.execute("DROP TABLE price_snapshots")
    connection.execute("ALTER TABLE price_snapshots_compact RENAME TO price_snapshots")
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_price_snapshots_card_time
        ON price_snapshots(card_id, captured_at)
        """
    )
    connection.execute(
        """
        UPDATE sqlite_sequence
        SET seq = COALESCE((SELECT MAX(id) FROM price_snapshots), 0)
        WHERE name = 'price_snapshots'
        """
    )
    connection.execute("PRAGMA foreign_keys=ON")


def main() -> None:
    args = parse_args()
    db_path = args.db_path
    if not db_path.exists():
        raise FileNotFoundError(db_path)

    with connect(db_path) as connection:
        print("Before cleanup:")
        print_diagnostics(connection)

    if not args.apply:
        print("Dry run only. Re-run with --apply to compact the database.")
        return

    if not args.no_backup:
        backup_path = backup_database(db_path)
        print(f"Backup created: {backup_path}")

    with connect(db_path) as connection:
        compact_history(connection)
        connection.commit()
        if args.vacuum:
            print("Running VACUUM. This can take several minutes.")
            connection.execute("VACUUM")
        print("After cleanup:")
        print_diagnostics(connection)


if __name__ == "__main__":
    main()
