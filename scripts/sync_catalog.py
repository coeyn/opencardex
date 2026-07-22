from __future__ import annotations

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.db import connect
from pokemon_tcg_tracker.config import EXCLUDED_SERIES_IDS
from pokemon_tcg_tracker.repository import (
    finish_sync_run,
    start_sync_run,
    upsert_set,
    upsert_set_card_brief,
    upsert_serie,
    utc_now_iso,
)
from pokemon_tcg_tracker.schema import initialize_schema
from pokemon_tcg_tracker.tcgdex_client import fetch_series_details, fetch_series_list, fetch_set_details


def main() -> None:
    synced_at = utc_now_iso()
    series = [
        serie for serie in fetch_series_list()
        if serie["id"] not in EXCLUDED_SERIES_IDS
    ]

    with connect() as connection:
        initialize_schema(connection)
        sync_run_id = start_sync_run(connection, "sync_catalog", {"series_count": len(series)})
        synced_sets = 0
        synced_cards = 0
        try:
            for serie in series:
                serie_details = fetch_series_details(serie["id"])
                upsert_serie(connection, serie_details, synced_at)

                for set_brief in serie_details.get("sets", []):
                    set_details = fetch_set_details(set_brief["id"])
                    upsert_set(connection, set_details, serie["id"], synced_at)
                    synced_sets += 1

                    set_count = set_details.get("cardCount") or {}
                    for card in set_details.get("cards", []):
                        upsert_set_card_brief(
                            connection=connection,
                            card=card,
                            set_id=set_details["id"],
                            set_name=set_details["name"],
                            official_count=set_count.get("official"),
                            total_count=set_count.get("total"),
                            synced_at=synced_at,
                        )
                        synced_cards += 1

            finish_sync_run(
                connection,
                sync_run_id,
                "success",
                {
                    "series_count": len(series),
                    "set_count": synced_sets,
                    "card_count": synced_cards,
                },
            )
        except Exception as exc:
            finish_sync_run(connection, sync_run_id, "failed", {"error": str(exc)})
            raise

    print(
        f"Catalog synced: series={len(series)}, "
        f"sets={synced_sets}, cards={synced_cards}."
    )


if __name__ == "__main__":
    main()
