from __future__ import annotations

import sqlite3


SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS series (
        serie_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logo_url TEXT,
        release_date TEXT,
        synced_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sets (
        set_id TEXT PRIMARY KEY,
        serie_id TEXT NOT NULL,
        name TEXT NOT NULL,
        logo_url TEXT,
        symbol_url TEXT,
        release_date TEXT,
        abbreviation TEXT,
        tcg_online_code TEXT,
        official_count INTEGER,
        total_count INTEGER,
        is_promo INTEGER,
        synced_at TEXT NOT NULL,
        FOREIGN KEY (serie_id) REFERENCES series(serie_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_sets_serie_id
    ON sets(serie_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS cards (
        card_id TEXT PRIMARY KEY,
        local_id TEXT,
        name TEXT NOT NULL,
        image_url TEXT,
        category TEXT,
        illustrator TEXT,
        rarity TEXT,
        set_id TEXT,
        set_name TEXT,
        set_official_count INTEGER,
        set_total_count INTEGER,
        dex_id TEXT,
        hp INTEGER,
        types TEXT,
        evolve_from TEXT,
        stage TEXT,
        suffix TEXT,
        retreat INTEGER,
        regulation_mark TEXT,
        legal_standard INTEGER,
        legal_expanded INTEGER,
        attacks_json TEXT,
        weaknesses_json TEXT,
        variants_json TEXT,
        source_updated_at TEXT,
        catalog_synced_at TEXT NOT NULL,
        details_synced_at TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS price_snapshots (
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
        FOREIGN KEY (card_id) REFERENCES cards(card_id),
        FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_snapshots_card_time
    ON price_snapshots(card_id, captured_at);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_cards_set_id
    ON cards(set_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        details_json TEXT
    );
    """,
]


def initialize_schema(connection: sqlite3.Connection) -> None:
    for statement in SCHEMA_STATEMENTS:
        connection.execute(statement)

    migration_statements = [
        "ALTER TABLE price_snapshots ADD COLUMN tcgplayer_currency TEXT",
        "ALTER TABLE price_snapshots ADD COLUMN tcgplayer_normal_market REAL",
        "ALTER TABLE price_snapshots ADD COLUMN tcgplayer_reverse_market REAL",
        "ALTER TABLE price_snapshots ADD COLUMN tcgplayer_updated TEXT",
    ]

    for statement in migration_statements:
        try:
            connection.execute(statement)
        except sqlite3.OperationalError:
            pass
