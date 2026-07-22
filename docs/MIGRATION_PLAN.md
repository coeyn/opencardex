# Plan de migration OpenCardex

## Principe

La migration doit conserver l'application existante et déplacer progressivement la logique vers le Web/PWA. L'ancienne application Android reste une référence fonctionnelle, mais ne reçoit plus de nouvelles fonctions métier.

## Phase 1: stabiliser le Web comme PWA

A conserver:

- serveur Python local;
- base SQLite de catalogue/prix;
- scripts `sync_catalog.py` et `collect_prices.py`;
- UI Web existante de catalogue, screener et devis.

A adapter:

- ajouter manifeste, service worker, page hors ligne et détection de version;
- sortir les données personnelles de `localStorage` vers IndexedDB;
- ajouter classeurs et cartes possédées côté Web;
- garder le devis existant mais enregistrer un prix historique au moment de l'ajout.

A ajouter:

- `web/storage.js` pour IndexedDB;
- modèles `Binder` et `OwnedCard` côté Web;
- export/import JSON de sauvegarde personnelle;
- documentation PWA et Android TWA.

## Phase 2: isoler le domaine

Structure cible adaptée à l'existant:

```text
opencardex/
├── apps/
│   ├── web/              # futur emplacement de web/
│   └── android-twa/      # future coque
├── packages/
│   ├── domain/           # modèles et calculs purs
│   ├── data/             # TCGdex, prix, stockage local
│   └── shared/           # formatage, validation
├── services/
│   └── price-worker/     # scripts de prix existants
├── docs/
└── .github/
```

Migration progressive recommandée:

1. Garder `src/`, `scripts/`, `web/` au départ.
2. Extraire d'abord les fonctions pures Web dans des modules JS sans bundler.
3. Ajouter des tests sur les calculs de prix, devis et migrations.
4. Introduire ensuite un vrai workspace seulement si le besoin de packaging augmente.
5. Déplacer les scripts de prix vers `services/price-worker/` quand la CI et la documentation sont prêtes.

## Phase 3: fournisseur de prix

Objectif:

```ts
interface PriceProvider {
  getCardPrice(cardId: string): Promise<CardPrice | null>;
  getLastUpdate(): Promise<string | null>;
  refresh(): Promise<void>;
}
```

Première implémentation:

- fournisseur basé sur l'API Web actuelle;
- aucune mise en cache agressive des prix;
- afficher `N/A` ou "prix indisponible" quand un prix manque;
- ne jamais remplacer silencieusement un prix manquant par zéro.

Evolution:

- fichier version;
- prix par série ou lot;
- diff incrémental;
- date de dernière mise à jour;
- source affichée dans l'UI.

## Phase 4: Android

A conserver:

- projet Android actuel comme référence;
- import manuel de snapshot SQLite.

A remplacer plus tard:

- application native complète par une Trusted Web Activity pointant vers la PWA.

A archiver:

- écrans Compose du catalogue/screener quand la PWA aura repris les fonctions utiles.

Pré-requis TWA:

- PWA servie en HTTPS;
- manifeste stable;
- icônes adaptées;
- relation Digital Asset Links;
- stratégie de versions et cache validée.

## Risques et migrations de données

- Les devis existants en `localStorage` doivent être migrés ou gardés lisibles.
- Les nouvelles données personnelles doivent rester exportables en JSON.
- Toute restructuration SQLite doit prévoir migration et backup.
- Le chemin Google Drive direct doit être remplacé par configuration documentée.
- Les fichiers générés Android/Python doivent être exclus avant publication open source.
