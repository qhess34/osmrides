---
name: nouvelle-attraction
description: Ajouter une nouvelle attraction au jeu T2Z (données OSM, SITE, écran de choix, tutoriels, docs). À utiliser dès que le propriétaire demande une nouvelle attraction.
---
Règles complètes : `docs/NOUVELLE-ATTRACTION.md` (à lire, ne pas réécrire). Ne jamais lire `sites/*.data.js` ni `parc/parc.data.js` en entier.

1. Lire `docs/ROADMAP.md`, puis la note de l'attraction la plus proche (`docs/*-notes.md`) ; créer `docs/<id>-notes.md` (caractéristiques, sources, ce qui est estimé).
2. Extrait OSM (`api.openstreetmap.org`, bbox du parc), `tools/specs/<id>.json`, puis `python3 tools/make_site.py extrait.osm tools/specs/<id>.json sites/<id>.data.js apercu.png` ; croisements ≥ 3,2 m, vitesse plausible.
3. `sites/<id>.js` en partant de `sites/zeus.js` ; garage : règles de `docs/manoeuvres.md`. Moteur modifié seulement si nécessaire, de façon générique, puis revérifier toutes les attractions.
4. Branchement : carte `a.card[data-site]` dans l'écran de choix de `index.html`, vignette (`tools/thumbs.js`, ajouter l'id), `site` dans `parc/parc.data.js` via `tools/make_park.py`, note dans l'article « Garer et sortir un train » de `tutos.html`, ligne du README, tâche du ROADMAP, journal de `docs/NOUVELLE-ATTRACTION.md`.
5. Vérifier avec le skill `verifier-attraction`, regarder les captures, puis rendre compte avec `compte-rendu-proprietaire` (tout ce qui est estimé doit être dit, jamais présenté comme mesuré).
