# Données de prix

## Source actuelle

Les prix sont collectés par `scripts/collect_prices.py` à partir des détails carte TCGdex. Le script lit le catalogue SQLite, parcourt les cartes par batch et écrit dans `price_snapshots`.

Champs principaux:

- `source_name`: actuellement `cardmarket`.
- `captured_at`: date de capture locale.
- `source_updated_at`: date indiquée par la source si disponible.
- `avg`, `low`, `trend`, `avg1`, `avg7`, `avg30`.
- variantes holo et reverse selon les données disponibles.
- `raw_pricing_json`: payload prix brut.

## Snapshot Google Drive

Le code Python utilise `POKEMON_TCG_TRACKER_DB` si defini. Sinon, il peut utiliser `POKEMON_TCG_TRACKER_DRIVE_SNAPSHOT` si cette variable pointe vers un snapshot existant. A defaut, il retombe sur `data/tracker.db`.

Ce couplage doit être remplacé progressivement par une configuration explicite et documentée.

## Règles applicatives

- Ne pas mettre les prix en cache de manière agressive dans le service worker.
- Ne pas convertir un prix absent en zéro.
- Afficher la source et la date quand elles sont connues.
- Un devis conserve `market_price_at_quote` et `offered_unit_price`.
