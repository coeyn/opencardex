# Architecture OpenCardex

OpenCardex repose actuellement sur trois couches.

- Catalogue/prix: SQLite local alimenté par les scripts Python et TCGdex.
- API locale: serveur Python exposant les endpoints `/api/...`.
- Interface: application Web statique installable en PWA.

Les données personnelles de collection sont stockées côté navigateur en IndexedDB. Elles ne sont pas mélangées à la base SQLite de catalogue/prix.

## Données distantes et locales

- TCGdex fournit les séries, extensions, cartes, images et prix bruts accessibles via l'API TCGdex.
- `price_snapshots` conserve l'historique local des prix collectés.
- IndexedDB conserve les classeurs, cartes possédées, paramètres et sauvegardes importées.

## Frontières importantes

- Le code UI ne doit pas dépendre directement de Google Drive.
- Les prix manquants restent manquants et ne deviennent pas `0`.
- Un devis conserve son prix au moment de sa création.
- Android natif ne reçoit plus de nouvelles fonctions métier.
