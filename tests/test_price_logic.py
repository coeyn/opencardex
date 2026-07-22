import unittest
from datetime import datetime, timedelta, timezone

from pokemon_tcg_tracker.webapp import build_local_ranges, compute_percent_change


class PriceLogicTests(unittest.TestCase):
    def test_percent_change_ignores_missing_or_zero_reference(self):
        self.assertIsNone(compute_percent_change(None, 10))
        self.assertIsNone(compute_percent_change(10, None))
        self.assertIsNone(compute_percent_change(10, 0))

    def test_percent_change_returns_delta(self):
        self.assertEqual(compute_percent_change(12, 10), 20)
        self.assertEqual(compute_percent_change(8, 10), -20)

    def test_local_ranges_do_not_turn_missing_prices_into_zero(self):
        now = datetime.now(timezone.utc).replace(microsecond=0)
        history = [
            {"captured_at": (now - timedelta(days=40)).isoformat(), "avg": None},
            {"captured_at": now.isoformat(), "avg": 5.0},
        ]
        ranges = build_local_ranges(history)
        self.assertIsNone(ranges["local_30d"])
        self.assertIsNone(ranges["local_90d"])
        self.assertIsNone(ranges["local_180d"])


if __name__ == "__main__":
    unittest.main()
