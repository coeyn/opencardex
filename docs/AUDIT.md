# Audit OpenCardex

Date d'audit: 2026-07-22.

## Structure actuelle

Le projet est aujourd'hui un dépôt local nommé `pokemon_tcg_tracker - Copie`, sans métadonnées Git dans ce dossier.

- `src/pokemon_tcg_tracker/`: application Python standard-library, serveur Web local, client TCGdex, schéma SQLite et fonctions de repository.
- `scripts/`: scripts opérationnels (`init_db.py`, `sync_catalog.py`, `collect_prices.py`, `snapshot_db.py`, `run_app.py`).
- `web/`: interface Web statique (`index.html`, `app.css`, `app.js`) servie par le serveur Python.
- `android/`: application Android native Kotlin/Jetpack Compose.
- `data/tracker.db`: base SQLite locale existante.

Etat observé de `data/tracker.db`:

- `series`: 18 lignes.
- `sets`: 182 lignes.
- `cards`: 21434 lignes.
- `price_snapshots`: 18972 lignes.
- `app_state`: 1 ligne.
- `sync_runs`: 403 lignes.
- dernier snapshot de prix: `2026-07-09T17:55:10+00:00`.

## Technologies et build

### Web

L'application Web est une application HTML/CSS/JavaScript sans bundler, sans `package.json` et sans dépendance Node. Elle est servie par `src/pokemon_tcg_tracker/webapp.py` via `ThreadingHTTPServer` et `SimpleHTTPRequestHandler`.

Point de lancement:

```powershell
python scripts/run_app.py
```

URL par défaut: `http://127.0.0.1:8765`.

### Backend local et scripts

Le backend local utilise Python 3.12+ et uniquement la bibliothèque standard. La base est SQLite, initialisée dans `src/pokemon_tcg_tracker/schema.py`.

Variables/configurations actuelles:

- `POKEMON_TCG_TRACKER_DB` peut surcharger le chemin de base.
- `API_BASE_URL = "https://api.tcgdex.net/v2/fr"`.
- `HOST = "127.0.0.1"`, `PORT = 8765`.
- un chemin Google Drive Windows absolu etait teste directement avant la premiere phase: `J:\Mon Drive\pokemon_tcg_tracker\tracker_snapshot.db`. Il est maintenant opt-in via `POKEMON_TCG_TRACKER_DRIVE_SNAPSHOT`.

### Android

L'application Android est un projet Gradle Kotlin DSL:

- Android Gradle Plugin `9.2.1`.
- Kotlin Compose plugin `2.2.10`.
- Jetpack Compose BOM `2026.02.01`.
- minSdk 26, targetSdk 36, compileSdk 36.1.
- UI native en Jetpack Compose.
- persistance Android via `SharedPreferences` pour l'URI de base sélectionnée et copie locale de `tracker_snapshot.db`.

## Modèles de données et logique métier

### SQLite

Le modèle central est dans `src/pokemon_tcg_tracker/schema.py`:

- `series`
- `sets`
- `cards`
- `price_snapshots`
- `app_state`
- `sync_runs`

Les fonctions d'écriture/migration sont dans `src/pokemon_tcg_tracker/repository.py`.

### Web

La logique UI et une partie de la logique métier Web sont dans `web/app.js`:

- tri séries/cartes;
- recherche;
- construction d'historique de prix;
- calculs de variation;
- devis stocké en `localStorage`;
- export/import JSON et CSV du devis.

### Android

La logique Android est concentrée dans:

- `android/app/src/main/java/com/example/pokemon_tcg_tracker/DataLayer.kt`: modèles Kotlin, repository SQLite, calculs de prix/tendance, formatage.
- `MainViewModel.kt`: état UI et orchestration.
- `AppScreen.kt` et `MainActivity.kt`: interface Compose.

## Appels TCGdex

Les appels TCGdex Python sont dans `src/pokemon_tcg_tracker/tcgdex_client.py`:

- `/series`
- `/series/{id}`
- `/sets/{id}`
- `/cards/{id}`
- fallback image anglais via `/v2/en/cards/{id}`.

L'application Android réimplémente aussi un fallback anglais dans `DataLayer.kt` via `HttpURLConnection`.

## Récupération et utilisation des prix

Les prix sont récupérés par `scripts/collect_prices.py`. Le script:

- lit les `card_id` depuis SQLite;
- avance par curseur `price_collection_cursor` dans `app_state`;
- appelle TCGdex carte par carte;
- extrait `pricing.cardmarket` et `pricing.tcgplayer`;
- insère les lignes dans `price_snapshots`.

Le mécanisme NAS/Google Drive n'est pas directement présent sous forme de script de synchronisation cloud dans ce dossier. Le code utilise néanmoins une base snapshot Google Drive si `J:\Mon Drive\pokemon_tcg_tracker\tracker_snapshot.db` existe. Android demande à l'utilisateur de sélectionner un fichier de base puis le copie localement.

## Fonctionnalités existantes

- Recherche de cartes: Web via `/api/search/cards` et suggestions `/api/search/suggestions`; Android par filtrage local dans la liste active.
- Navigation séries/extensions: Web via `/api/series` et `/api/sets/{id}`; Android via SQLite local.
- Détail carte: Web via `/api/cards/{id}`; Android via `loadCardDetail`.
- Historique prix: présent Web et Android.
- Screener achat: présent Web et Android.
- Devis: présent Web uniquement, stocké dans `localStorage`.
- Quantités devis: présent Web.
- Export CSV/JSON devis: présent Web.
- Import JSON devis: présent Web.
- Stockage local collection/classeurs: absent avant cette phase.
- Gestion états/langue/variante possédée: absent avant cette phase.

## Duplications Web/Android

Les duplications les plus visibles:

- modèles de données carte/prix;
- formatage prix/date/pourcentage;
- tri séries/extensions/cartes;
- calculs de variation;
- construction de timeline;
- calcul de tendance/slope;
- extraction URL Cardmarket;
- construction URL image TCGdex;
- accès SQLite aux mêmes tables.

## Risques techniques

- Pas de `.gitignore`: `__pycache__`, `.gradle`, `build/`, APK debug et base SQLite peuvent être versionnés par erreur.
- `android/local.properties` contient un chemin SDK local `F:\android_sdk`; ce fichier ne doit pas être versionné.
- `data/tracker.db` est une donnée générée lourde et potentiellement personnelle/opérationnelle.
- Le chemin `J:\Mon Drive\...` couplait le projet à une machine Windows précise; la premiere phase le rend explicite via variable d'environnement.
- La source Google Drive est utilisée comme fichier direct, sans abstraction ni métadonnées de version.
- Le devis Web était uniquement en `localStorage`, insuffisant pour une PWA avec données personnelles plus riches.
- Certains textes affichent des caractères mal encodés dans le fichier joint et dans l'UI existante (`â‚¬`, `Ã—`, flèches encodées).
- Le Web mélange logique métier, DOM et stockage dans un seul fichier.
- Android et Web évolueront difficilement tant que les calculs sont dupliqués.
- Aucun test automatisé Python ou Web n'a été trouvé.
- Pas de licence explicite.

## Hypothèses d'audit

Le script NAS mentionné par la demande n'est pas dans ce dossier. L'audit considère donc `scripts/collect_prices.py`, `data/tracker.db`, le chemin Google Drive et l'import Android de snapshot comme le mécanisme disponible localement.
