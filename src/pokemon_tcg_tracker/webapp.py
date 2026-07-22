from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from .config import HOST, PORT, PROJECT_ROOT
from .db import connect
from .schema import initialize_schema
from .tcgdex_client import (
    fetch_card_details_for_language,
    fetch_set_details,
)


WEB_DIR = PROJECT_ROOT / "web"


def build_card_image_url(image_base: str | None) -> str | None:
    if not image_base:
        return None
    return f"{image_base}/high.webp"


def build_asset_url(asset_base: str | None) -> str | None:
    if not asset_base:
        return None
    return f"{asset_base}.webp"


def build_cardmarket_product_url(product_id: object) -> str | None:
    if product_id in (None, ""):
        return None
    return f"https://www.cardmarket.com/fr/Pokemon/Products?idProduct={product_id}&language=2"


def extract_cardmarket_product_url(raw_pricing_json: str | None) -> str | None:
    if not raw_pricing_json:
        return None
    try:
        pricing = json.loads(raw_pricing_json)
    except json.JSONDecodeError:
        return None
    cardmarket = pricing.get("cardmarket") or {}
    return build_cardmarket_product_url(cardmarket.get("idProduct"))


def compute_percent_change(current: float | None, reference: float | None) -> float | None:
    if current is None or reference in (None, 0):
        return None
    return ((current - reference) / reference) * 100


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def build_local_ranges(history: list[dict[str, object]]) -> dict[str, float | None]:
    if not history:
        return {"local_30d": None, "local_90d": None, "local_180d": None}

    now_candidates = [
        parse_iso_datetime(str(entry.get("captured_at")))
        for entry in history
    ]
    now_candidates = [item for item in now_candidates if item is not None]
    if not now_candidates:
        return {"local_30d": None, "local_90d": None, "local_180d": None}

    latest_dt = max(now_candidates)
    points: list[tuple[datetime, float]] = []
    for entry in history:
        dt = parse_iso_datetime(str(entry.get("captured_at")))
        avg = entry.get("avg")
        if dt is None or avg is None:
            continue
        points.append((dt, float(avg)))

    def nearest_value(days: int) -> float | None:
        target = latest_dt - timedelta(days=days)
        eligible = [point for point in points if point[0] <= target]
        if eligible:
            eligible.sort(key=lambda item: item[0], reverse=True)
            return eligible[0][1]
        return None

    return {
        "local_30d": nearest_value(30),
        "local_90d": nearest_value(90),
        "local_180d": nearest_value(180),
    }


def build_local_trend_ranges(history: list[dict[str, object]]) -> dict[str, float | None]:
    if not history:
        return {"current_trend": None, "trend_7d": None, "trend_30d": None}

    points: list[tuple[datetime, float]] = []
    for entry in history:
        dt = parse_iso_datetime(str(entry.get("captured_at")))
        trend = entry.get("trend")
        avg = entry.get("avg")
        value = trend if trend is not None else avg
        if dt is None or value is None:
            continue
        points.append((dt, float(value)))

    if not points:
        return {"current_trend": None, "trend_7d": None, "trend_30d": None}

    points.sort(key=lambda item: item[0])
    latest_dt, latest_value = points[-1]

    def nearest_value(days: int) -> float | None:
        target = latest_dt - timedelta(days=days)
        eligible = [point for point in points if point[0] <= target]
        if not eligible:
            return None
        eligible.sort(key=lambda item: item[0], reverse=True)
        return eligible[0][1]

    return {
        "current_trend": latest_value,
        "trend_7d": nearest_value(7),
        "trend_30d": nearest_value(30),
    }


def build_catalog_slope_status(history: list[dict[str, object]]) -> dict[str, str | float | int | None]:
    if not history:
        return {"state": "stable", "label": "=", "delta_pct": None, "points": 0}

    points_by_day: dict[str, list[float]] = {}
    for entry in history:
        dt = parse_iso_datetime(str(entry.get("captured_at")))
        value = entry.get("trend")
        if value is None:
            value = entry.get("avg")
        if dt is None or value is None:
            continue
        day_key = dt.date().isoformat()
        points_by_day.setdefault(day_key, []).append(float(value))

    points: list[tuple[str, float]] = [
        (day_key, sum(values) / len(values))
        for day_key, values in points_by_day.items()
    ]

    if len(points) < 2:
        return {"state": "stable", "label": "=", "delta_pct": None, "points": len(points)}

    points.sort(key=lambda item: item[0])
    window = points[-6:]

    x_values = list(range(len(window)))
    y_values = [point[1] for point in window]
    x_mean = sum(x_values) / len(x_values)
    y_mean = sum(y_values) / len(y_values)
    denominator = sum((x - x_mean) ** 2 for x in x_values)
    if denominator == 0:
        return {"state": "stable", "label": "=", "delta_pct": None, "points": len(window)}

    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values)) / denominator
    projected_first = y_mean + slope * (x_values[0] - x_mean)
    projected_last = y_mean + slope * (x_values[-1] - x_mean)
    delta_pct = compute_percent_change(projected_last, projected_first)

    if delta_pct is None or abs(delta_pct) < 2.0:
        return {"state": "stable", "label": "=", "delta_pct": delta_pct, "points": len(window)}
    if delta_pct > 0:
        return {"state": "up", "label": "↑", "delta_pct": delta_pct, "points": len(window)}
    return {"state": "down", "label": "↓", "delta_pct": delta_pct, "points": len(window)}


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/series":
            self._send_json(self._load_series_payload())
            return

        if parsed.path.startswith("/api/sets/"):
            set_id = parsed.path.removeprefix("/api/sets/")
            self._send_json(self._load_set_payload(set_id))
            return

        if parsed.path.startswith("/api/cards/"):
            card_id = parsed.path.removeprefix("/api/cards/")
            payload = self._load_card_payload(card_id)
            if payload is None:
                self.send_error(HTTPStatus.NOT_FOUND, "Card not found")
                return
            self._send_json(payload)
            return

        if parsed.path == "/api/opportunities":
            params = parse_qs(parsed.query)
            budget = float(params.get("budget", ["10"])[0])
            limit = int(params.get("limit", ["30"])[0])
            self._send_json(self._load_opportunities_payload(budget=budget, limit=limit))
            return

        if parsed.path == "/api/search/cards":
            params = parse_qs(parsed.query)
            query = params.get("q", [""])[0]
            limit = int(params.get("limit", ["120"])[0])
            self._send_json(self._search_cards_payload(query=query, limit=limit))
            return

        if parsed.path == "/api/search/suggestions":
            params = parse_qs(parsed.query)
            query = params.get("q", [""])[0]
            limit = int(params.get("limit", ["8"])[0])
            self._send_json(self._search_suggestions_payload(query=query, limit=limit))
            return

        if parsed.path == "/" or parsed.path == "/index.html":
            self.path = "/index.html"

        super().do_GET()

    def log_message(self, format: str, *args) -> None:
        return

    def _load_series_payload(self) -> dict[str, object]:
        with connect() as connection:
            initialize_schema(connection)
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

        return {
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
        }

    def _load_set_payload(self, set_id: str) -> dict[str, object]:
        set_details = fetch_set_details(set_id)
        latest_snapshots = self._load_latest_snapshots_for_set(set_id)
        slope_by_card = self._load_slope_statuses_for_set(set_id)
        cards: list[dict[str, object]] = []

        for card in set_details.get("cards", []):
            image_url = build_card_image_url(card.get("image"))
            image_language = "fr"
            if image_url is None:
                image_url = self._load_english_fallback_image(card["id"])
                image_language = "en" if image_url else None

            cards.append(
                {
                    "id": card["id"],
                    "local_id": card.get("localId"),
                    "name": card["name"],
                    "set_name": set_details["name"],
                    "image_url": image_url,
                    "image_language": image_language,
                    "latest_price": latest_snapshots.get(card["id"]),
                    "slope": slope_by_card.get(card["id"]),
                }
            )

        card_count = set_details.get("cardCount") or {}
        serie = set_details.get("serie") or {}
        return {
            "id": set_details["id"],
            "name": set_details["name"],
            "logo_url": build_asset_url(set_details.get("logo")),
            "symbol_url": build_asset_url(set_details.get("symbol")),
            "release_date": set_details.get("releaseDate"),
            "official_count": card_count.get("official"),
            "total_count": card_count.get("total"),
            "serie": {
                "id": serie.get("id"),
                "name": serie.get("name"),
            },
            "cards": cards,
        }

    def _search_cards_payload(self, query: str, limit: int) -> dict[str, object]:
        normalized_query = query.strip()
        if not normalized_query:
            return {"query": "", "count": 0, "cards": []}

        like_query = f"%{normalized_query}%"
        with connect() as connection:
            initialize_schema(connection)
            rows = connection.execute(
                """
                SELECT
                    c.card_id,
                    c.local_id,
                    c.name,
                    c.set_name,
                    c.image_url,
                    ps.captured_at,
                    ps.avg,
                    ps.low,
                    ps.trend,
                    ps.avg1,
                    ps.avg7,
                    ps.avg30,
                    ps.avg_holo,
                    ps.low_holo,
                    ps.trend_holo,
                    ps.avg1_holo,
                    ps.avg7_holo,
                    ps.avg30_holo,
                    ps.raw_pricing_json,
                    ps.tcgplayer_currency,
                    ps.tcgplayer_normal_market,
                    ps.tcgplayer_reverse_market
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
                WHERE c.name LIKE ?
                ORDER BY c.name, c.set_name
                LIMIT ?
                """,
                (like_query, limit),
            ).fetchall()

            card_ids = [str(row["card_id"]) for row in rows]
            slope_by_card = self._load_slope_statuses_for_cards(card_ids)

        cards: list[dict[str, object]] = []
        for row in rows:
            image_url = build_card_image_url(row["image_url"])
            image_language = "fr"
            if image_url is None:
                image_url = self._load_english_fallback_image(str(row["card_id"]))
                image_language = "en" if image_url else None

            cards.append(
                {
                    "id": row["card_id"],
                    "local_id": row["local_id"],
                    "name": row["name"],
                    "set_name": row["set_name"],
                    "image_url": image_url,
                    "image_language": image_language,
                    "latest_price": {
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
                    },
                    "slope": slope_by_card.get(str(row["card_id"])),
                }
            )

        return {
            "query": normalized_query,
            "count": len(cards),
            "cards": cards,
        }

    def _search_suggestions_payload(self, query: str, limit: int) -> dict[str, object]:
        normalized_query = query.strip()
        if len(normalized_query) < 2:
            return {"query": normalized_query, "suggestions": []}

        like_query = f"%{normalized_query}%"
        prefix_query = f"{normalized_query}%"
        with connect() as connection:
            initialize_schema(connection)
            rows = connection.execute(
                """
                SELECT
                    c.name,
                    COUNT(*) AS card_count
                FROM cards c
                WHERE c.name LIKE ?
                GROUP BY c.name
                ORDER BY
                    CASE
                        WHEN LOWER(c.name) = LOWER(?) THEN 0
                        WHEN LOWER(c.name) LIKE LOWER(?) THEN 1
                        ELSE 2
                    END,
                    LENGTH(c.name),
                    c.name COLLATE NOCASE
                LIMIT ?
                """,
                (like_query, normalized_query, prefix_query, limit),
            ).fetchall()

        return {
            "query": normalized_query,
            "suggestions": [
                {
                    "name": row["name"],
                    "card_count": row["card_count"],
                }
                for row in rows
            ],
        }

    def _load_card_payload(self, card_id: str) -> dict[str, object] | None:
        with connect() as connection:
            initialize_schema(connection)
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
            history_rows = connection.execute(
                """
                SELECT
                    captured_at,
                    avg,
                    low,
                    trend,
                    avg1,
                    avg7,
                    avg30,
                    avg_holo,
                    low_holo,
                    trend_holo,
                    avg1_holo,
                    avg7_holo,
                    avg30_holo,
                    raw_pricing_json,
                    tcgplayer_currency,
                    tcgplayer_normal_market,
                    tcgplayer_reverse_market
                FROM price_snapshots
                WHERE card_id = ?
                ORDER BY captured_at ASC
                """,
                (card_id,),
            ).fetchall()

        if card_row is None:
            return None

        image_url = build_card_image_url(card_row["image_url"])
        image_language = "fr"
        if image_url is None:
            image_url = self._load_english_fallback_image(card_id)
            image_language = "en" if image_url else None

        history = [
            {
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
            for row in history_rows
        ]

        latest = history[-1] if history else None
        first = history[0] if history else None
        local_ranges = build_local_ranges(history)
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
            "image_url": image_url,
            "image_language": image_language,
            "latest_price": latest,
            "cardmarket_url": latest.get("cardmarket_url") if latest else None,
            "history": history,
            "history_meta": {
                "snapshot_count": len(history),
                **local_ranges,
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

    def _load_opportunities_payload(self, budget: float, limit: int) -> dict[str, object]:
        min_price = max(budget * 0.7, budget - 3)
        min_price = max(min_price, 0.25)

        with connect() as connection:
            initialize_schema(connection)
            rows = connection.execute(
                """
                SELECT
                    c.card_id,
                    c.local_id,
                    c.name,
                    c.set_id,
                    c.set_name,
                    c.image_url,
                    c.rarity,
                    c.illustrator,
                    latest.avg,
                    latest.low,
                    latest.trend,
                    latest.avg_holo,
                    latest.tcgplayer_reverse_market,
                    counts.snapshot_count
                FROM cards c
                INNER JOIN (
                    SELECT ps1.*
                    FROM price_snapshots ps1
                    INNER JOIN (
                        SELECT card_id, MAX(captured_at) AS max_captured_at
                        FROM price_snapshots
                        GROUP BY card_id
                    ) last_ps
                        ON last_ps.card_id = ps1.card_id
                        AND last_ps.max_captured_at = ps1.captured_at
                ) latest
                    ON latest.card_id = c.card_id
                INNER JOIN (
                    SELECT card_id, COUNT(*) AS snapshot_count
                    FROM price_snapshots
                    GROUP BY card_id
                ) counts
                    ON counts.card_id = c.card_id
                WHERE latest.avg IS NOT NULL
                  AND latest.avg > 0
                  AND latest.avg >= ?
                  AND latest.avg <= ?
                """,
                (min_price, budget),
            ).fetchall()

            card_ids = [str(row["card_id"]) for row in rows]
            trend_history_by_card: dict[str, list[dict[str, object]]] = {}
            if card_ids:
                placeholders = ", ".join("?" for _ in card_ids)
                history_rows = connection.execute(
                    f"""
                    SELECT
                        card_id,
                        captured_at,
                        avg,
                        trend
                    FROM price_snapshots
                    WHERE card_id IN ({placeholders})
                    ORDER BY captured_at ASC
                    """,
                    card_ids,
                ).fetchall()
                for history_row in history_rows:
                    trend_history_by_card.setdefault(str(history_row["card_id"]), []).append(
                        {
                            "captured_at": history_row["captured_at"],
                            "avg": history_row["avg"],
                            "trend": history_row["trend"],
                        }
                    )

        candidates: list[dict[str, object]] = []
        for row in rows:
            avg = float(row["avg"]) if row["avg"] is not None else None
            if avg is None:
                continue

            local_trends = build_local_trend_ranges(
                trend_history_by_card.get(str(row["card_id"]), [])
            )
            current_trend = local_trends["current_trend"]
            trend_7d = local_trends["trend_7d"]
            trend_30d = local_trends["trend_30d"]
            pct7 = compute_percent_change(current_trend, trend_7d)
            pct30 = compute_percent_change(current_trend, trend_30d)
            positive_7 = max(pct7 or 0.0, 0.0)
            positive_30 = max(pct30 or 0.0, 0.0)
            snapshot_count = int(row["snapshot_count"] or 0)
            snapshot_bonus = min(snapshot_count, 24) * 0.6
            price_efficiency = max(budget - avg, 0.0) / max(budget, 0.01) * 10
            score = positive_7 * 0.45 + positive_30 * 0.35 + snapshot_bonus + price_efficiency

            candidates.append(
                {
                    "card_id": row["card_id"],
                    "local_id": row["local_id"],
                    "name": row["name"],
                    "set_name": row["set_name"],
                    "current_avg": avg,
                    "current_low": row["low"],
                    "trend": current_trend,
                    "trend7": trend_7d,
                    "trend30": trend_30d,
                    "avg_holo": row["avg_holo"],
                    "reverse_market": row["tcgplayer_reverse_market"],
                    "snapshot_count": snapshot_count,
                    "pct7": pct7,
                    "pct30": pct30,
                    "score": round(score, 2),
                    "image_url": row["image_url"],
                }
            )

        candidates.sort(
            key=lambda item: (
                float(item["score"]),
                float(item["pct7"] or 0.0),
                float(item["pct30"] or 0.0),
            ),
            reverse=True,
        )

        finalists = candidates[:limit]
        for item in finalists:
            image_url = build_card_image_url(item.get("image_url"))
            image_language = "fr"
            if image_url is None:
                image_url = self._load_english_fallback_image(str(item["card_id"]))
                image_language = "en" if image_url else None
            item["image_url"] = image_url
            item["image_language"] = image_language

        return {
            "budget": budget,
            "min_price": round(min_price, 2),
            "limit": limit,
            "candidates": finalists,
        }

    def _load_latest_snapshots_for_set(self, set_id: str) -> dict[str, dict[str, object]]:
        with connect() as connection:
            initialize_schema(connection)
            rows = connection.execute(
                """
                SELECT
                    ps.card_id,
                    ps.captured_at,
                    ps.avg,
                    ps.low,
                    ps.trend,
                    ps.avg1,
                    ps.avg7,
                    ps.avg30,
                    ps.avg_holo,
                    ps.low_holo,
                    ps.trend_holo,
                    ps.avg1_holo,
                    ps.avg7_holo,
                    ps.avg30_holo,
                    ps.raw_pricing_json,
                    ps.tcgplayer_currency,
                    ps.tcgplayer_normal_market,
                    ps.tcgplayer_reverse_market
                FROM price_snapshots ps
                INNER JOIN (
                    SELECT card_id, MAX(captured_at) AS max_captured_at
                    FROM price_snapshots
                    GROUP BY card_id
                ) latest
                    ON latest.card_id = ps.card_id
                    AND latest.max_captured_at = ps.captured_at
                INNER JOIN cards c ON c.card_id = ps.card_id
                WHERE c.set_id = ?
                """,
                (set_id,),
            ).fetchall()

        return {
            str(row["card_id"]): {
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
            for row in rows
        }

    def _load_slope_statuses_for_set(self, set_id: str) -> dict[str, dict[str, object]]:
        with connect() as connection:
            initialize_schema(connection)
            rows = connection.execute(
                """
                SELECT
                    ps.card_id,
                    ps.captured_at,
                    ps.avg,
                    ps.trend
                FROM price_snapshots ps
                INNER JOIN cards c ON c.card_id = ps.card_id
                WHERE c.set_id = ?
                ORDER BY ps.card_id, ps.captured_at ASC
                """,
                (set_id,),
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

    def _load_slope_statuses_for_cards(self, card_ids: list[str]) -> dict[str, dict[str, object]]:
        if not card_ids:
            return {}

        with connect() as connection:
            initialize_schema(connection)
            placeholders = ", ".join("?" for _ in card_ids)
            rows = connection.execute(
                f"""
                SELECT
                    card_id,
                    captured_at,
                    avg,
                    trend
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

    def _load_english_fallback_image(self, card_id: str) -> str | None:
        try:
            english = fetch_card_details_for_language("en", card_id)
        except Exception:
            return None
        return build_card_image_url(english.get("image"))

    def _send_json(self, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_server(host: str = HOST, port: int = PORT) -> None:
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Web app available on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
