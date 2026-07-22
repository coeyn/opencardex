# Contribuer à OpenCardex

## Développement local

1. Créer un environnement Python.
2. Initialiser ou fournir une base SQLite.
3. Lancer `python scripts/run_app.py`.
4. Ouvrir `http://127.0.0.1:8765`.

## Règles

- Ne pas committer de secrets.
- Ne pas committer `android/local.properties`, `.gradle/`, `build/`, `__pycache__/` ou les bases SQLite personnelles.
- Préserver les migrations de données utilisateur.
- Ajouter des tests pour les calculs de prix, devis et migrations de stockage.
- Garder Android natif en référence tant que la PWA reprend les fonctions.
