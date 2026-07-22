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

## Export JSON pour GitHub Pages

Le NAS peut continuer a produire ou synchroniser `tracker_snapshot.db`. Pour GitHub Pages, il vaut mieux publier des JSON optimises plutot que le fichier SQLite brut.

Commande:

```powershell
python scripts/export_static_data.py --clean
```

Sortie:

- `web/data/version.json`: version, date de generation, compteurs et derniere mise a jour prix.
- `web/data/series.json`: navigation series/extensions.
- `web/data/sets/{setId}.json`: cartes d'une extension avec dernier prix connu.
- `web/data/cards/{cardId}.json`: detail carte et historique.
- `web/data/search-index.json`: index compact pour la recherche et le screener statique.

Workflow NAS recommande:

1. Mettre a jour le snapshot SQLite.
2. Lancer `python scripts/export_static_data.py --clean`.
3. Commit uniquement `web/data/`.
4. Push vers GitHub.
5. GitHub Actions publie la nouvelle version Pages.

Script Windows/NAS:

```powershell
$env:POKEMON_TCG_TRACKER_DB="C:\chemin\vers\tracker_snapshot.db"
.\scripts\publish_static_data.ps1 -CommitMessage "Update static catalog data"
```

Prerequis sur le NAS:

- Python 3.12+;
- Git configure avec acces push au depot;
- variable `POKEMON_TCG_TRACKER_DB` pointant vers le snapshot SQLite a publier;
- tache planifiee apres la mise a jour du snapshot.
