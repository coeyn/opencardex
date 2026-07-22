from __future__ import annotations

import argparse
import time

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.config import DEFAULT_BATCH_SIZE
from pokemon_tcg_tracker.db import connect
from pokemon_tcg_tracker.repository import (
    finish_sync_run,
    get_state,
    insert_price_snapshot,
    set_state,
    start_sync_run,
    upsert_card_details,
    utc_now_iso,
)
from pokemon_tcg_tracker.schema import initialize_schema
from pokemon_tcg_tracker.tcgdex_client import fetch_card_details


CURSOR_KEY = "price_collection_cursor"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect card prices from TCGdex.")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--reset-cursor", action="store_true")
    parser.add_argument(
        "--run-all",
        action="store_true",
        help="Loop automatically until every card has been scanned once.",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=0.0,
        help="Optional pause between batches when using --run-all.",
    )
    return parser.parse_args()


def load_card_ids() -> list[str]:
    with connect() as connection:
        initialize_schema(connection)
        rows = connection.execute(
            """
            SELECT c.card_id
            FROM cards c
            INNER JOIN sets s ON s.set_id = c.set_id
            ORDER BY c.card_id
            """
        ).fetchall()
    return [str(row["card_id"]) for row in rows]


def get_start_index(card_count: int) -> int:
    with connect() as connection:
        initialize_schema(connection)
        cursor_value = get_state(connection, CURSOR_KEY)
    start_index = int(cursor_value) if cursor_value is not None else 0
    return start_index % card_count


def reset_cursor() -> None:
    with connect() as connection:
        initialize_schema(connection)
        set_state(connection, CURSOR_KEY, "0")


def collect_single_batch(
    card_ids: list[str],
    batch_size: int,
    batch_number: int | None = None,
    batch_total: int | None = None,
) -> dict[str, int | list[str] | bool]:
    if not card_ids:
        raise RuntimeError("No cards found in catalog. Run sync_catalog.py first.")

    with connect() as connection:
        initialize_schema(connection)

        start_index = get_state(connection, CURSOR_KEY)
        current_index = int(start_index) if start_index is not None else 0
        current_index %= len(card_ids)

        end_index = min(current_index + batch_size, len(card_ids))
        batch_ids = card_ids[current_index:end_index]
        captured_at = utc_now_iso()

        sync_run_id = start_sync_run(
            connection,
            "collect_prices",
            {
                "batch_size": batch_size,
                "start_index": current_index,
                "end_index": end_index,
                "batch_number": batch_number,
                "batch_total": batch_total,
            },
        )

        processed = 0
        priced = 0
        failed_ids: list[str] = []

        try:
            for position, card_id in enumerate(batch_ids, start=1):
                absolute_position = current_index + position
                prefix = (
                    f"[batch {batch_number}/{batch_total}] "
                    if batch_number is not None and batch_total is not None
                    else ""
                )
                try:
                    details = fetch_card_details(card_id)
                    upsert_card_details(connection, details, captured_at)
                    pricing = details.get("pricing") or {}
                    if pricing.get("cardmarket") or pricing.get("tcgplayer"):
                        insert_price_snapshot(
                            connection,
                            card_id=card_id,
                            pricing=pricing,
                            captured_at=captured_at,
                            source_updated_at=(pricing.get("cardmarket") or {}).get("updated"),
                            sync_run_id=sync_run_id,
                        )
                        priced += 1
                        status = (
                            f"price={((pricing.get('cardmarket') or {}).get('avg'))} "
                            f"reverse={((pricing.get('tcgplayer') or {}).get('reverse-holofoil') or {}).get('marketPrice')}"
                        )
                    else:
                        status = "price=none"
                    processed += 1
                    print(
                        f"{prefix}{position}/{len(batch_ids)} "
                        f"(global {absolute_position}/{len(card_ids)}) "
                        f"{card_id} OK {status}"
                    )
                except Exception as exc:
                    failed_ids.append(card_id)
                    print(
                        f"{prefix}{position}/{len(batch_ids)} "
                        f"(global {absolute_position}/{len(card_ids)}) "
                        f"{card_id} ERROR {exc}"
                    )

            next_index = 0 if end_index >= len(card_ids) else end_index
            completed_cycle = next_index == 0
            set_state(connection, CURSOR_KEY, str(next_index))
            finish_sync_run(
                connection,
                sync_run_id,
                "success",
                {
                    "processed": processed,
                    "priced": priced,
                    "failed_count": len(failed_ids),
                    "failed_ids": failed_ids,
                    "next_index": next_index,
                    "completed_cycle": completed_cycle,
                },
            )
        except Exception as exc:
            finish_sync_run(
                connection,
                sync_run_id,
                "failed",
                {"error": str(exc), "processed": processed, "failed_ids": failed_ids},
            )
            raise

    print(
        f"Batch done: processed={processed}, priced={priced}, failed={len(failed_ids)}, "
        f"next_cursor={next_index}, completed_cycle={completed_cycle}"
    )
    return {
        "processed": processed,
        "priced": priced,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids,
        "next_index": next_index,
        "completed_cycle": completed_cycle,
    }


def run_all_batches(card_ids: list[str], batch_size: int, sleep_seconds: float) -> None:
    start_index = get_start_index(len(card_ids))
    remaining = len(card_ids) - start_index
    batch_total = (remaining + batch_size - 1) // batch_size

    total_processed = 0
    total_priced = 0
    total_failed = 0

    print(
        f"Starting continuous scan from cursor {start_index}/{len(card_ids)} "
        f"with batch_size={batch_size}. Estimated batches: {batch_total}."
    )

    for batch_number in range(1, batch_total + 1):
        result = collect_single_batch(
            card_ids=card_ids,
            batch_size=batch_size,
            batch_number=batch_number,
            batch_total=batch_total,
        )
        total_processed += int(result["processed"])
        total_priced += int(result["priced"])
        total_failed += int(result["failed_count"])

        print(
            f"Progress: batches={batch_number}/{batch_total}, "
            f"processed={total_processed}/{remaining}, priced={total_priced}, failed={total_failed}"
        )

        if bool(result["completed_cycle"]):
            print("Full scan completed.")
            break

        if sleep_seconds > 0:
            time.sleep(sleep_seconds)


def main() -> None:
    args = parse_args()

    if args.batch_size <= 0:
        raise ValueError("--batch-size must be greater than 0")

    if args.reset_cursor:
        reset_cursor()

    card_ids = load_card_ids()

    if args.run_all:
        run_all_batches(
            card_ids=card_ids,
            batch_size=args.batch_size,
            sleep_seconds=args.sleep_seconds,
        )
        return

    collect_single_batch(card_ids=card_ids, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
