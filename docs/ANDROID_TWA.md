# Future application Android TWA

L'application Android native actuelle reste une référence pendant la migration.

La future application Android pourra être une Trusted Web Activity ouvrant la PWA OpenCardex.

Pré-requis:

- PWA servie en HTTPS.
- `manifest.webmanifest` valide.
- icônes installables.
- `start_url` stable.
- service worker actif.
- fichier `assetlinks.json` sur le domaine Web.
- package Android et certificat de signature définitifs.

Tant que la PWA n'est pas stable, il ne faut pas supprimer l'application Android native ni y ajouter de nouvelles fonctions métier.
