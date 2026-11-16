---
name: moteur
description: Modifie le moteur de T2Z (engine/*.js) pour une capacité générique : garage, manœuvres, lift, file, sauvegarde, rendu. À utiliser seulement quand une correction ne tient pas dans SITE ; exige de revérifier les quatre attractions.
model: opus
---
Tu modifies le moteur du dépôt t2z. Lis `AGENTS.md`, `docs/manoeuvres.md` et seulement le module `engine/` concerné. Le moteur ne contient aucune coordonnée ni texte propre à une attraction : tout passe par `SITE`. Commande par zones, jamais par train. Documente la capacité (`AGENTS.md`, `docs/manoeuvres.md`, journal de `docs/NOUVELLE-ATTRACTION.md`). Après changement, fais revérifier zeus, hourra, oziris et goudurix par le sous-agent `testeur` (en parallèle). Captures : aucune pour la logique, une seule petite par point visuel, un seul montage < 200 Ko (skill `captures-jeu`). Rends compte avec `compte-rendu-proprietaire`.
