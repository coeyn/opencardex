import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

from pokemon_tcg_tracker.repository import insert_price_snapshot
from pokemon_tcg_tracker.schema import initialize_schema

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import compact_price_history  # noqa: E402


def make_connection(path: str = ":memory:") -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    initialize_schema(connection)
    connection.execute(
        "INSERT INTO cards (card_id, name, catalog_synced_at) VALUES (?, ?, ?)",
        ("card-1", "Card", "now"),
    )
    return connection


class PriceStorageTests(unittest.TestCase):
    def test_insert_price_snapshot_updates_same_card_source_and_day(self):
        connection = make_connection()
        pricing_a = {"cardmarket": {"unit": "EUR", "idProduct": 123, "avg": 1.0}}
        pricing_b = {"cardmarket": {"unit": "EUR", "idProduct": 123, "avg": 2.5}}

        insert_price_snapshot(
            connection,
            "card-1",
            pricing_a,
            "2026-09-26T08:00:00+00:00",
            None,
            None,
        )
        insert_price_snapshot(
            connection,
            "card-1",
            pricing_b,
            "2026-09-26T18:00:00+00:00",
            None,
            None,
        )

        rows = connection.execute(
            "SELECT captured_at, avg, raw_pricing_json FROM price_snapshots"
        ).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["captured_at"], "2026-09-26T18:00:00+00:00")
        self.assertEqual(rows[0]["avg"], 2.5)
        self.assertIsNone(rows[0]["raw_pricing_json"])

    def test_compact_history_keeps_latest_daily_snapshot_and_drops_raw_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "tracker.db"
            connection = make_connection(str(db_path))
            try:
                for avg in (1.0, 2.0, 3.0):
                    connection.execute(
                        """
                        INSERT INTO price_snapshots (
                            card_id, captured_at, source_name, avg, raw_pricing_json
                        )
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            "card-1",
                            f"2026-09-26T0{int(avg)}:00:00+00:00",
                            "cardmarket",
                            avg,
                            '{"x":1}',
                        ),
                    )
                connection.commit()
                compact_price_history.compact_history(connection)
                connection.commit()

                row = connection.execute(
                    """
                    SELECT COUNT(*) AS rows, MAX(avg) AS latest_avg,
                        SUM(raw_pricing_json IS NOT NULL) AS raw_rows
                    FROM price_snapshots
                    """
                ).fetchone()
                self.assertEqual(row["rows"], 1)
                self.assertEqual(row["latest_avg"], 3.0)
                self.assertEqual(row["raw_rows"], 0)
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
