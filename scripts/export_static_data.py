from __future__ import annotations

import argparse
import json
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.config import PROJECT_ROOT
from pokemon_tcg_tracker.db import connect
from pokemon_tcg_tracker.schema import initialize_schema
from pokemon_tcg_tracker.webapp import (
    build_asset_url,
    build_card_image_url,
    build_catalog_slope_status,
    build_local_ranges,
    compute_percent_change,
    extract_cardmarket_product_url,
)


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "web" / "data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export SQLite catalog and prices as static JSON.")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="SQLite database to export. Defaults to POKEMON_TCG_TRACKER_DB or the project config.",
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--clean", action="store_true", help="Remove the output directory before exporting.")
    return parser.parse_args()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def format_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{secs:02d}s"
    if minutes:
        return f"{minutes}m{secs:02d}s"
    return f"{secs}s"


def print_progress(label: str, current: int, total: int, started_at: float) -> None:
    elapsed = time.monotonic() - started_at
    if current <= 0 or total <= 0:
        eta = "?"
        percent = 0.0
    else:
        percent = (current / total) * 100
        rate = elapsed / current
        eta = format_duration(rate * (total - current))
    message = (
        f"\r{label}: {current}/{total} "
        f"({percent:5.1f}%) elapsed {format_duration(elapsed)} ETA {eta}"
    )
    print(message, end="", flush=True)
    if current >= total:
        print(flush=True)


def latest_price_select(prefix: str = "ps") -> str:
    return f"""
        {prefix}.captured_at,
        {prefix}.avg,
        {prefix}.low,
        {prefix}.trend,
        {prefix}.avg1,
        {prefix}.avg7,
        {prefix}.avg30,
        {prefix}.avg_holo,
        {prefix}.low_holo,
        {prefix}.trend_holo,
        {prefix}.avg1_holo,
        {prefix}.avg7_holo,
        {prefix}.avg30_holo,
        {prefix}.raw_pricing_json,
        {prefix}.tcgplayer_currency,
        {prefix}.tcgplayer_normal_market,
        {prefix}.tcgplayer_reverse_market
    """


def row_latest_price(row: object) -> dict[str, object]:
    return {
        "captured_at": row["captured_at"],
        "avg": row["avg"],
        "low": row["low"],
        "trend": row["trend"],
        "avg1": row["avg1"],
        "avg7": row["avg7"],
        "avg30": row["avg30"],
        "avg_holo": row["avg_holo"],
        "low_holo": row["low_holo"],
        "trend_holo": row["trend_holo"],
        "avg1_holo": row["avg1_holo"],
        "avg7_holo": row["avg7_holo"],
        "avg30_holo": row["avg30_holo"],
        "cardmarket_url": extract_cardmarket_product_url(row["raw_pricing_json"]),
        "tcgplayer_currency": row["tcgplayer_currency"],
        "tcgplayer_normal_market": row["tcgplayer_normal_market"],
        "tcgplayer_reverse_market": row["tcgplayer_reverse_market"],
    }


def load_slope_statuses(connection, card_ids: list[str]) -> dict[str, dict[str, object]]:
    if not card_ids:
        return {}
    placeholders = ",".join("?" for _ in card_ids)
    rows = connection.execute(
        f"""
        SELECT card_id, captured_at, avg, trend
        FROM price_snapshots
        WHERE card_id IN ({placeholders})
        ORDER BY card_id, captured_at ASC
        """,
        card_ids,
    ).fetchall()
    history_by_card: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        history_by_card.setdefault(str(row["card_id"]), []).append(
            {
                "captured_at": row["captured_at"],
                "avg": row["avg"],
                "trend": row["trend"],
            }
        )
    return {
        card_id: build_catalog_slope_status(history)
        for card_id, history in history_by_card.items()
    }


def export_series(connection, output_dir: Path) -> None:
    print("Exporting series navigation...", flush=True)
    series_rows = connection.execute(
        """
        SELECT
            s.serie_id,
            s.name,
            s.logo_url,
            COUNT(st.set_id) AS set_count,
            SUM(COALESCE(st.total_count, 0)) AS total_cards
        FROM series s
        LEFT JOIN sets st ON st.serie_id = s.serie_id
        GROUP BY s.serie_id, s.name, s.logo_url
        ORDER BY MAX(COALESCE(st.release_date, '0000-01-01')) DESC, s.name
        """
    ).fetchall()
    set_rows = connection.execute(
        """
        SELECT
            s.set_id,
            s.serie_id,
            s.name,
            s.logo_url,
            s.symbol_url,
            s.release_date,
            s.abbreviation,
            s.official_count,
            s.total_count,
            COUNT(DISTINCT ps.card_id) AS priced_count
        FROM sets s
        LEFT JOIN cards c ON c.set_id = s.set_id
        LEFT JOIN price_snapshots ps ON ps.card_id = c.card_id
        GROUP BY
            s.set_id,
            s.serie_id,
            s.name,
            s.logo_url,
            s.symbol_url,
            s.release_date,
            s.abbreviation,
            s.official_count,
            s.total_count
        ORDER BY s.release_date DESC, s.name
        """
    ).fetchall()
    sets_by_serie: dict[str, list[dict[str, object]]] = {}
    for row in set_rows:
        sets_by_serie.setdefault(str(row["serie_id"]), []).append(
            {
                "id": row["set_id"],
                "name": row["name"],
                "logo_url": build_asset_url(row["logo_url"]),
                "symbol_url": build_asset_url(row["symbol_url"]),
                "release_date": row["release_date"],
                "abbreviation": row["abbreviation"],
                "official_count": row["official_count"],
                "total_count": row["total_count"],
                "priced_count": row["priced_count"],
            }
        )
    write_json(
        output_dir / "series.json",
        {
            "series": [
                {
                    "id": row["serie_id"],
                    "name": row["name"],
                    "logo_url": build_asset_url(row["logo_url"]),
                    "set_count": row["set_count"],
                    "total_cards": row["total_cards"],
                    "sets": sets_by_serie.get(str(row["serie_id"]), []),
                }
                for row in series_rows
            ]
        },
    )
    print(f"Series exported: {len(series_rows)} series, {len(set_rows)} sets", flush=True)


def export_sets_and_search(connection, output_dir: Path) -> dict[str, list[str]]:
    started_at = time.monotonic()
    set_rows = connection.execute(
        """
        SELECT set_id, serie_id, name, logo_url, symbol_url, release_date, official_count, total_count
        FROM sets
        ORDER BY release_date DESC, name
        """
    ).fetchall()
    all_search_cards: list[dict[str, object]] = []
    card_ids_by_set: dict[str, list[str]] = {}
    total_sets = len(set_rows)
    for index, set_row in enumerate(set_rows, start=1):
        card_rows = connection.execute(
            f"""
            SELECT
                c.card_id,
                c.local_id,
                c.name,
                c.set_name,
                c.image_url,
                {latest_price_select("ps")}
            FROM cards c
            LEFT JOIN (
                SELECT ps1.*
                FROM price_snapshots ps1
                INNER JOIN (
                    SELECT card_id, MAX(captured_at) AS max_captured_at
                    FROM price_snapshots
                    GROUP BY card_id
                ) latest
                    ON latest.card_id = ps1.card_id
                    AND latest.max_captured_at = ps1.captured_at
            ) ps
                ON ps.card_id = c.card_id
            WHERE c.set_id = ?
            ORDER BY c.local_id, c.name
            """,
            (set_row["set_id"],),
        ).fetchall()
        card_ids = [str(row["card_id"]) for row in card_rows]
        card_ids_by_set[str(set_row["set_id"])] = card_ids
        slopes = load_slope_statuses(connection, card_ids)
        cards: list[dict[str, object]] = []
        for row in card_rows:
            card = {
                "id": row["card_id"],
                "set_id": set_row["set_id"],
                "local_id": row["local_id"],
                "name": row["name"],
                "set_name": row["set_name"],
                "image_url": build_card_image_url(row["image_url"]),
                "image_language": "fr" if row["image_url"] else None,
                "latest_price": row_latest_price(row),
                "slope": slopes.get(str(row["card_id"])),
            }
            cards.append(card)
            all_search_cards.append(card)
        serie_row = connection.execute(
            "SELECT serie_id, name FROM series WHERE serie_id = ?",
            (set_row["serie_id"],),
        ).fetchone()
        write_json(
            output_dir / "sets" / f"{set_row['set_id']}.json",
            {
                "id": set_row["set_id"],
                "name": set_row["name"],
                "logo_url": build_asset_url(set_row["logo_url"]),
                "symbol_url": build_asset_url(set_row["symbol_url"]),
                "release_date": set_row["release_date"],
                "official_count": set_row["official_count"],
                "total_count": set_row["total_count"],
                "serie": {
                    "id": serie_row["serie_id"] if serie_row else set_row["serie_id"],
                    "name": serie_row["name"] if serie_row else None,
                },
                "cards": cards,
            },
        )
        print_progress(
            "Exporting set cards",
            index,
            total_sets,
            started_at,
        )
    write_json(
        output_dir / "search-index.json",
        {
            "cards": all_search_cards,
        },
    )
    print(f"Search index exported: {len(all_search_cards)} cards", flush=True)
    return card_ids_by_set


def export_card_details(connection, output_dir: Path, card_ids_by_set: dict[str, list[str]]) -> None:
    started_at = time.monotonic()
    items = list(card_ids_by_set.items())
    total_sets = len(items)
    exported_cards = 0
    for index, (set_id, card_ids) in enumerate(items, start=1):
        cards_payload: dict[str, dict[str, object]] = {}
        for card_id in card_ids:
            card_payload = build_card_detail_payload(connection, card_id)
            if card_payload is not None:
                cards_payload[card_id] = card_payload
                exported_cards += 1
        write_json(output_dir / "card-details" / f"{set_id}.json", {"cards": cards_payload})
        print_progress("Exporting card details", index, total_sets, started_at)
    print(f"Card details exported: {exported_cards} cards", flush=True)


def build_card_detail_payload(connection, card_id: str) -> dict[str, object] | None:
        card_row = connection.execute(
            """
            SELECT
                card_id,
                local_id,
                name,
                set_id,
                set_name,
                rarity,
                illustrator,
                image_url,
                types,
                hp,
                stage,
                suffix
            FROM cards
            WHERE card_id = ?
            """,
            (card_id,),
        ).fetchone()
        if card_row is None:
            return None
        history_rows = connection.execute(
            f"""
            SELECT {latest_price_select("price_snapshots")}
            FROM price_snapshots
            WHERE card_id = ?
            ORDER BY captured_at ASC
            """,
            (card_id,),
        ).fetchall()
        history = [row_latest_price(row) for row in history_rows]
        latest = history[-1] if history else None
        first = history[0] if history else None
        return {
            "id": card_row["card_id"],
            "local_id": card_row["local_id"],
            "name": card_row["name"],
            "set_id": card_row["set_id"],
            "set_name": card_row["set_name"],
            "rarity": card_row["rarity"],
            "illustrator": card_row["illustrator"],
            "types": card_row["types"],
            "hp": card_row["hp"],
            "stage": card_row["stage"],
            "suffix": card_row["suffix"],
            "image_url": build_card_image_url(card_row["image_url"]),
            "image_language": "fr" if card_row["image_url"] else None,
            "latest_price": latest,
            "cardmarket_url": latest.get("cardmarket_url") if latest else None,
            "history": history,
            "history_meta": {
                "snapshot_count": len(history),
                **build_local_ranges(history),
            },
            "change_pct": {
                "avg": compute_percent_change(
                    latest["avg"] if latest else None,
                    first["avg"] if first else None,
                ),
                "avg_holo": compute_percent_change(
                    latest["avg_holo"] if latest else None,
                    first["avg_holo"] if first else None,
                ),
            },
        }


def export_version(connection, output_dir: Path) -> None:
    print("Exporting version metadata...", flush=True)
    row = connection.execute("SELECT MAX(captured_at) AS last_price_update FROM price_snapshots").fetchone()
    counts = {
        table_name: connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        for table_name in ("series", "sets", "cards", "price_snapshots")
    }
    write_json(
        output_dir / "version.json",
        {
            "schema": 1,
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "last_price_update": row["last_price_update"] if row else None,
            "counts": counts,
        },
    )
    print("Version metadata exported", flush=True)


def main() -> None:
    started_at = time.monotonic()
    args = parse_args()
    db_label = args.db_path if args.db_path else "configured DB_PATH"
    print(f"Static export started from {db_label}", flush=True)
    if args.clean and args.output_dir.exists():
        print(f"Cleaning output directory: {args.output_dir}", flush=True)
        shutil.rmtree(args.output_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    connection_context = connect(args.db_path) if args.db_path else connect()
    with connection_context as connection:
        initialize_schema(connection)
        export_series(connection, args.output_dir)
        card_ids_by_set = export_sets_and_search(connection, args.output_dir)
        export_card_details(connection, args.output_dir, card_ids_by_set)
        export_version(connection, args.output_dir)
    print(
        f"Static data exported to {args.output_dir} in {format_duration(time.monotonic() - started_at)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
