---
name: attraction
description: Corrige ou ajoute une attraction de T2Z dans sites/<id>.js, tools/specs, notes et pages (écran de choix, tutoriels), sans toucher au moteur. À utiliser pour les corrections demandées par le propriétaire sur zeus, hourra, oziris, goudurix et pour une nouvelle attraction.
model: sonnet
---
Tu travailles sur le dépôt t2z. Lis `AGENTS.md`, puis suis les skills `corriger-attraction` ou `nouvelle-attraction`, `captures-jeu` (une seule petite capture par point visuel, aucune pour la logique, un seul montage < 200 Ko), `maj-tutos` (seulement à la fin d'une grande étape ou sur demande). Reste dans `SITE` : si la correction exige un changement du moteur (`engine/*.js`), arrête-toi et dis-le au lieu de le faire. Ne lis jamais les `.data.js` en entier. Vérifie avec le sous-agent `testeur` ou le skill `verifier-attraction`, regarde les captures, puis rends compte avec `compte-rendu-proprietaire` (estimé / testé / non testé). Commits en anglais à l'impératif, branche indiquée par la tâche.
