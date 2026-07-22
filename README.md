# OpenCardex

OpenCardex est un outil local et open source pour parcourir le catalogue Pokemon TCG, suivre les prix, organiser une collection en classeurs et préparer des estimations ou devis.

Le projet vient d'une application personnelle de rachat/devis. La direction actuelle est de faire du Web/PWA la source principale, puis de remplacer progressivement l'application Android native par une coque PWA/TWA.

## Fonctionnalites

- catalogue des series et extensions Pokemon TCG via TCGdex;
- recherche de cartes;
- details carte avec historique de prix;
- screener achat;
- devis exportable CSV/JSON;
- PWA installable;
- classeurs et collection locale en IndexedDB;
- export/import JSON de sauvegarde personnelle.

## Prerequis

- Python 3.12+.
- Aucune dependance Python externe obligatoire.
- Une base SQLite locale, creee ou fournie par snapshot.

## Installation

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

## Configuration

Copier `.env.example` si besoin et definir les variables dans l'environnement:

```powershell
$env:POKEMON_TCG_TRACKER_DB="C:\chemin\vers\tracker_snapshot.db"
$env:POKEMON_TCG_TRACKER_HOST="127.0.0.1"
$env:POKEMON_TCG_TRACKER_PORT="8765"
```

Si `POKEMON_TCG_TRACKER_DB` n'est pas defini, l'application utilise `data/tracker.db`. Un snapshot synchronise par Google Drive peut etre choisi explicitement avec `POKEMON_TCG_TRACKER_DRIVE_SNAPSHOT`.

## Utilisation

Initialiser la base:

```powershell
python scripts/init_db.py
```

Synchroniser le catalogue FR physique:

```powershell
python scripts/sync_catalog.py
```

Collecter les prix par lots:

```powershell
python scripts/collect_prices.py --batch-size 200
```

Lancer l'application Web/PWA:

```powershell
python scripts/run_app.py
```

Ouvrir `http://127.0.0.1:8765`.

## PWA

La PWA est servie depuis `web/`:

- `manifest.webmanifest`;
- `sw.js`;
- `offline.html`;
- `icons/icon.svg`.

Le service worker met en cache le squelette applicatif, pas les endpoints `/api/` de prix/catalogue. Les prix restent donc actualisables independamment du code.

## GitHub Pages

Le dossier `web/` est publie par GitHub Actions sur GitHub Pages:

```text
https://coeyn.github.io/opencardex/
```

Cette version Pages heberge l'application statique et la couche IndexedDB locale. Le catalogue, la recherche TCGdex locale et les prix demandent encore le serveur Python, car les routes `/api/...` ne sont pas disponibles sur GitHub Pages.

## Donnees locales

- Catalogue et prix: SQLite (`data/tracker.db` ou snapshot configure).
- Collection, classeurs, parametres: IndexedDB navigateur (`opencardex`).
- Devis historique actuel: `localStorage`, avec champs de prix au moment du devis.

Les exports JSON de collection contiennent les donnees personnelles, pas toute la base TCGdex.

## Tests

```powershell
python -m unittest discover -s tests
```

## Android

L'application Android native dans `android/` est conservee comme reference. Les nouvelles fonctions metier doivent etre ajoutees en priorite dans la PWA. Voir `docs/ANDROID_TWA.md`.

## Documentation

- `docs/AUDIT.md`
- `docs/MIGRATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/PRICE_DATA.md`
- `docs/ANDROID_TWA.md`

## Contribution et licence

Voir `CONTRIBUTING.md`. Aucune licence finale n'a encore ete choisie; `LICENSE` contient les options recommandees avant publication.
