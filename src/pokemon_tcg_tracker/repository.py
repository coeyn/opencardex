from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def json_dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"))


def join_strings(values: list[Any] | None) -> str | None:
    if not values:
        return None
    return "|".join(str(item) for item in values)


def upsert_serie(
    connection: sqlite3.Connection,
    serie: dict[str, Any],
    synced_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO series (serie_id, name, logo_url, release_date, synced_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(serie_id) DO UPDATE SET
            name=excluded.name,
            logo_url=excluded.logo_url,
            release_date=excluded.release_date,
            synced_at=excluded.synced_at
        """,
        (
            serie["id"],
            serie["name"],
            serie.get("logo"),
            serie.get("releaseDate"),
            synced_at,
        ),
    )


def upsert_set(
    connection: sqlite3.Connection,
    set_payload: dict[str, Any],
    serie_id: str,
    synced_at: str,
) -> None:
    abbreviation = set_payload.get("abbreviation")
    official_abbreviation = None
    if isinstance(abbreviation, dict):
        official_abbreviation = abbreviation.get("official")

    card_count = set_payload.get("cardCount") or {}
    set_name = set_payload.get("name")
    is_promo = 1 if "promo" in set_name.lower() else 0 if isinstance(set_name, str) else None

    connection.execute(
        """
        INSERT INTO sets (
            set_id, serie_id, name, logo_url, symbol_url, release_date, abbreviation,
            tcg_online_code, official_count, total_count, is_promo, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(set_id) DO UPDATE SET
            serie_id=excluded.serie_id,
            name=excluded.name,
            logo_url=excluded.logo_url,
            symbol_url=excluded.symbol_url,
            release_date=excluded.release_date,
            abbreviation=excluded.abbreviation,
            tcg_online_code=excluded.tcg_online_code,
            official_count=excluded.official_count,
            total_count=excluded.total_count,
            is_promo=excluded.is_promo,
            synced_at=excluded.synced_at
        """,
        (
            set_payload["id"],
            serie_id,
            set_name,
            set_payload.get("logo"),
            set_payload.get("symbol"),
            set_payload.get("releaseDate"),
            official_abbreviation,
            set_payload.get("tcgOnline"),
            card_count.get("official"),
            card_count.get("total"),
            is_promo,
            synced_at,
        ),
    )


def upsert_set_card_brief(
    connection: sqlite3.Connection,
    card: dict[str, Any],
    set_id: str,
    set_name: str,
    official_count: int | None,
    total_count: int | None,
    synced_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO cards (
            card_id, local_id, name, image_url, set_id, set_name,
            set_official_count, set_total_count, catalog_synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(card_id) DO UPDATE SET
            local_id=excluded.local_id,
            name=excluded.name,
            image_url=COALESCE(excluded.image_url, cards.image_url),
            set_id=excluded.set_id,
            set_name=excluded.set_name,
            set_official_count=excluded.set_official_count,
            set_total_count=excluded.set_total_count,
            catalog_synced_at=excluded.catalog_synced_at
        """,
        (
            card["id"],
            card.get("localId"),
            card["name"],
            card.get("image"),
            set_id,
            set_name,
            official_count,
            total_count,
            synced_at,
        ),
    )


def upsert_card_details(
    connection: sqlite3.Connection,
    card: dict[str, Any],
    synced_at: str,
) -> None:
    set_info = card.get("set") or {}
    legal = card.get("legal") or {}

    dex_ids = card.get("dexId")
    dex_id = join_strings(dex_ids) if isinstance(dex_ids, list) else None

    connection.execute(
        """
        INSERT INTO cards (
            card_id, local_id, name, image_url, category, illustrator, rarity,
            set_id, set_name, set_official_count, set_total_count, dex_id, hp,
            types, evolve_from, stage, suffix, retreat, regulation_mark,
            legal_standard, legal_expanded, attacks_json, weaknesses_json,
            variants_json, source_updated_at, catalog_synced_at, details_synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(card_id) DO UPDATE SET
            local_id=excluded.local_id,
            name=excluded.name,
            image_url=COALESCE(excluded.image_url, cards.image_url),
            category=excluded.category,
            illustrator=excluded.illustrator,
            rarity=excluded.rarity,
            set_id=excluded.set_id,
            set_name=excluded.set_name,
            set_official_count=excluded.set_official_count,
            set_total_count=excluded.set_total_count,
            dex_id=excluded.dex_id,
            hp=excluded.hp,
            types=excluded.types,
            evolve_from=excluded.evolve_from,
            stage=excluded.stage,
            suffix=excluded.suffix,
            retreat=excluded.retreat,
            regulation_mark=excluded.regulation_mark,
            legal_standard=excluded.legal_standard,
            legal_expanded=excluded.legal_expanded,
            attacks_json=excluded.attacks_json,
            weaknesses_json=excluded.weaknesses_json,
            variants_json=excluded.variants_json,
            source_updated_at=excluded.source_updated_at,
            details_synced_at=excluded.details_synced_at
        """,
        (
            card["id"],
            card.get("localId"),
            card["name"],
            card.get("image"),
            card.get("category"),
            card.get("illustrator"),
            card.get("rarity"),
            set_info.get("id"),
            set_info.get("name"),
            (set_info.get("cardCount") or {}).get("official"),
            (set_info.get("cardCount") or {}).get("total"),
            dex_id,
            card.get("hp"),
            join_strings(card.get("types")),
            card.get("evolveFrom"),
            card.get("stage"),
            card.get("suffix"),
            card.get("retreat"),
            card.get("regulationMark"),
            _bool_to_int(legal.get("standard")),
            _bool_to_int(legal.get("expanded")),
            json_dumps(card.get("attacks")),
            json_dumps(card.get("weaknesses")),
            json_dumps(card.get("variants")),
            card.get("updated"),
            synced_at,
            synced_at,
        ),
    )


def insert_price_snapshot(
    connection: sqlite3.Connection,
    card_id: str,
    pricing: dict[str, Any],
    captured_at: str,
    source_updated_at: str | None,
    sync_run_id: int | None,
) -> None:
    cardmarket = pricing.get("cardmarket") or {}
    tcgplayer = pricing.get("tcgplayer") or {}
    tcgplayer_normal = tcgplayer.get("normal") or {}
    tcgplayer_reverse = tcgplayer.get("reverse-holofoil") or {}

    connection.execute(
        """
        INSERT INTO price_snapshots (
            card_id, captured_at, source_updated_at, source_name, currency, product_id,
            avg, low, trend, avg1, avg7, avg30, avg_holo, low_holo, trend_holo,
            avg1_holo, avg7_holo, avg30_holo, raw_pricing_json, sync_run_id,
            tcgplayer_currency, tcgplayer_normal_market, tcgplayer_reverse_market, tcgplayer_updated
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            card_id,
            captured_at,
            source_updated_at,
            "cardmarket",
            cardmarket.get("unit"),
            cardmarket.get("idProduct"),
            cardmarket.get("avg"),
            cardmarket.get("low"),
            cardmarket.get("trend"),
            cardmarket.get("avg1"),
            cardmarket.get("avg7"),
            cardmarket.get("avg30"),
            cardmarket.get("avg-holo"),
            cardmarket.get("low-holo"),
            cardmarket.get("trend-holo"),
            cardmarket.get("avg1-holo"),
            cardmarket.get("avg7-holo"),
            cardmarket.get("avg30-holo"),
            json_dumps(pricing),
            sync_run_id,
            tcgplayer.get("unit"),
            tcgplayer_normal.get("marketPrice"),
            tcgplayer_reverse.get("marketPrice"),
            tcgplayer.get("updated"),
        ),
    )


def get_state(connection: sqlite3.Connection, key: str) -> str | None:
    row = connection.execute(
        "SELECT value FROM app_state WHERE key = ?",
        (key,),
    ).fetchone()
    return None if row is None else str(row["value"])


def set_state(connection: sqlite3.Connection, key: str, value: str) -> None:
    connection.execute(
        """
        INSERT INTO app_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value=excluded.value,
            updated_at=excluded.updated_at
        """,
        (key, value, utc_now_iso()),
    )


def start_sync_run(connection: sqlite3.Connection, job_name: str, details: dict[str, Any]) -> int:
    cursor = connection.execute(
        """
        INSERT INTO sync_runs (job_name, started_at, status, details_json)
        VALUES (?, ?, ?, ?)
        """,
        (job_name, utc_now_iso(), "running", json_dumps(details)),
    )
    return int(cursor.lastrowid)


def finish_sync_run(
    connection: sqlite3.Connection,
    sync_run_id: int,
    status: str,
    details: dict[str, Any],
) -> None:
    connection.execute(
        """
        UPDATE sync_runs
        SET finished_at = ?, status = ?, details_json = ?
        WHERE id = ?
        """,
        (utc_now_iso(), status, json_dumps(details), sync_run_id),
    )


def _bool_to_int(value: bool | None) -> int | None:
    if value is None:
        return None
    return int(value)
