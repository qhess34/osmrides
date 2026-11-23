# AGENTS.md — consignes pour travailler sur ce dépôt

## Le projet

`osmrides` = **moteur et éditeur** génériques des jeux OSMrides, publiés par version (`docs/versions.md`, décision D13). Les jeux sont dans d'autres dépôts : `qhess34/osmrides_parks` (Parc Astérix), `qhess34/osmrides_skiresort` (stations). Organisation : `docs/ORGANISATION.md`. Jeu de fan non officiel ; textes en français.

## Attentes du propriétaire

- **Réalisme avant tout** : rendu aérien crédible, couleurs sourdes, aucun pictogramme ni emoji, rien d'enfantin.
- **Fidélité** : ce qui vient d'OSM est lu dans OSM ; ce qui est estimé est signalé dans le code et dit au propriétaire.
- **Synchronisation vers OSM** (issue #46, `docs/ARCHITECTURE.md` D12) : tout réglage de l'éditeur qui a un équivalent OSM est lu dans OSM et peut y être renvoyé à la demande.
- **Commande par zones, jamais par train** ; portillons et sécurités au bouton seulement ; barrières de file posées à la main.
- **Visiteurs** : seulement sur les chemins, seulement par les barrières ouvertes, jamais l'un sur l'autre, face à leur marche.
- **Générique, KISS, lisible** : aucune coordonnée ni texte propre à un lieu dans `engine/` ou `editor/` ; ce qui est propre aux parcs ou au ski est codé dans leur dépôt (#51).
- Vocabulaire : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur.

## Organisation du code

Aucune dépendance, aucun serveur pour le jeu : `file://`, sans `fetch` ni modules ES.

| Fichier | Rôle |
|---|---|
| `index.html` | présentation du moteur (GitHub Pages) ; à mettre à jour à chaque version |
| `jeu.html`, `sw.js` | redirection de l'ancienne adresse du jeu, retrait de l'ancien mode hors ligne |
| `engine/moteur.js` | point d'entrée : charge le noyau puis les couches de `SITE.extensions` (manifeste `extension.js`), étape par étape (`docs/ARCHITECTURE.md` D14) |
| `engine/noyau/` | commun à tous les jeux : inscription des couches (`base.js`), carte, visiteurs, file, zone d'attente, météo, partie, sauvegarde |
| `engine/voies/` | mécanique partagée sans dessin : tracé, abscisse `s`, cantonnement facultatif, zones d'attente et arrêt, garage, aiguillage et pont transbordeur, commande par zones (le type déclare ses zones : `reseau.js`) |
| `engine/montagnes-russes/` | propre au type : physique, lift, freins, zones de freinage déclarées à `voies/`, quai à portillons, pupitre, tout le dessin ; `schema.js`, `editeur.js` (sections de l'éditeur) |
| `editor/` | éditeur local (`editor/README.md`) : sert `editor/` et `engine/` d'ici, `jeu.html` et `lieux/` du dépôt de jeu (`T2Z_ROOT`) |
| `tools/jeu/compose.yaml`, `tools/editeur.sh` | lancer l'éditeur d'une version depuis un dépôt de jeu |
| `docs/` | `ARCHITECTURE.md` (décisions), `versions.md`, `ref/` (référence du moteur), `ROADMAP.md`, `journal/` |

Repères du moteur : mètres, secondes ; `x` est, `z` sud ; `s` = abscisse le long de la voie. `OSM.cps` = `[x, hauteur, z, dévers, repère…]` (`docs/ref/voie.md`). État `G`, `trains[]`, `act(nom, arg)`, `step(dt)`, `render(dt)`.

## Vérifier avant de dire que c'est fait

Cloner `osmrides_parks` à côté (`../osmrides_parks`). Playwright et Chromium sont préinstallés.

- Éditeur : `NODE_PATH=$(npm root -g) node tools/editor-test.js 2>&1 | tail -2` puis `tools/osm-sync-test.js` (variable `JEU=` pour un autre dépôt de jeu).
- Moteur modifié : les tests de jeu de `osmrides_parks` (`check.js`, `save.js`, `mobile.js`) sur chaque attraction, une après l'autre, avec le moteur local (`jeu.html?…&moteur=../osmrides/engine/`). Relever `pageerror`.
- Dire au propriétaire ce qui a été testé et non testé.

## Versions

Publier : `docs/versions.md` (tests, note de version, mise à jour de `index.html`). L'étiquette est posée par le propriétaire (les sessions cloud ne peuvent pas pousser d'étiquette), puis issue `inter-equipe` aux chefs des jeux.

## Git

- Dépôt `qhess34/osmrides`, branche `main`, commits directs, messages en anglais à l'impératif ; pas de pull request sauf demande.

## Sous-agents

`.claude/agents/` : `explorateur` (Haiku, lecture seule), `moteur` (Sonnet par défaut, Opus sur demande), `testeur` (Haiku). Petite correction : directement.

## Pilotage et économie de tokens

- `docs/PILOTAGE.md` (« État courant ») à lire en premier par le Chef moteur.
- Lire seulement la fiche `docs/ref/` utile ; une règle n'est écrite qu'à un endroit ; journal = `docs/journal/<mois>.md`, ajout en fin sans relire.
- Captures : aucune pour la logique ; une petite par point visuel.
