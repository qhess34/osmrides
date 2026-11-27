# AGENTS.md — consignes pour travailler sur ce dépôt

## Le projet

`osmrides` = **moteur et éditeur** génériques des jeux OSMrides, publiés par version (`docs/versions.md`, décision D13). Les jeux sont dans d'autres dépôts : `qhess34/osmrides_parks` (Parc Astérix), `qhess34/osmrides_skiresort` (stations). Organisation : `docs/ORGANISATION.md`. Jeu de fan non officiel ; textes en français.

## Attentes du propriétaire

- **Réalisme avant tout** : rendu aérien crédible, couleurs sourdes, aucun pictogramme ni emoji, rien d'enfantin.
- **Fidélité** : ce qui vient d'OSM est lu dans OSM ; ce qui est estimé est signalé dans le code et dit au propriétaire.
- **Pas de toit ni de couverture inventés** (propriétaire, 26/11) : un toit, un abri ou une halle n'est dessiné que s'il correspond à un bâtiment ou à un abri d'OSM ; sinon la voie n'est pas recouverte. Aucun toit estimé au-dessus d'un frein, d'un pont transbordeur ou d'un garage.
- **Synchronisation vers OSM** (issue #46, `docs/ARCHITECTURE.md` D12) : tout réglage de l'éditeur qui a un équivalent OSM est lu dans OSM et peut y être renvoyé à la demande.
- **Commande par zones, jamais par train** ; portillons et sécurités au bouton seulement ; barrières de file posées à la main.
- **Visiteurs** : seulement sur les chemins, seulement par les barrières ouvertes, jamais l'un sur l'autre, face à leur marche.
- **Générique, KISS, lisible** : aucune coordonnée ni texte propre à un lieu dans `engine/` ou `editor/` ; ce qui est propre aux parcs ou au ski est codé dans leur dépôt (#51).
- **Pas de « frein final » ni de « frein avant gare »** (propriétaire, 26/11) : ces notions n'existent pas ; il n'y a que des zones de freinage ordinaires (freins de bloc), toutes identiques au pupitre et dans l'éditeur. Aucun nouveau texte, bouton ou réglage ne les distingue ; l'existant (`Fin`, `Pre`, `holdBack`) se supprime avec #57 point 4.
- Vocabulaire : lapbars, portillons, pupitre, zone de freinage, canton, aiguillage, pont transbordeur.

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
| `tools/banc/`, `tools/batterie.js` | banc d'essai : mini-sites synthétiques et micro-tests du moteur, sans donnée de parc (`docs/ref/banc.md`) |
| `docs/` | `ARCHITECTURE.md` (décisions), `versions.md`, `ref/` (référence du moteur), `ROADMAP.md`, `journal/` |

Repères du moteur : mètres, secondes ; `x` est, `z` sud ; `s` = abscisse le long de la voie. `OSM.cps` = `[x, hauteur, z, dévers, repère…]` (`docs/ref/voie.md`). État `G`, `trains[]`, `act(nom, arg)`, `step(dt)`, `render(dt)`.

## Vérifier avant de dire que c'est fait

Playwright et Chromium sont préinstallés. **Règle d'économie** (propriétaire, 27/11) :

- **Un correctif ciblé se vérifie avec son micro-test du banc d'essai** (`docs/ref/banc.md`, sans aucune donnée de parc) : `node tools/batterie.js --seulement=<nom>` (quelques secondes, une ligne de sortie). Jamais avec la batterie complète ni avec les tests des parcs. Un défaut nouveau corrigé = un micro-test ajouté au banc (au besoin une option du constructeur `tools/banc/constructeur.js`).
- **La batterie complète** (`node tools/batterie.js`) **et les tests des parcs** (`--parcs=<dépôt de jeu>` : `check.js`, `save.js`, `mobile.js` de chaque attraction, moteur local) sont réservés à l'adoption ou à la publication d'une version, lancés une seule fois par un testeur, une attraction après l'autre, sans sous-agent.
- Pas de capture sauf point visuel : aucune pour la logique, une seule petite par point visuel (skill `captures-jeu`). Une ligne de sortie par test (`| tail -3` pour les tests de parcs).
- Éditeur : `NODE_PATH=$(npm root -g) node tools/editor-test.js 2>&1 | tail -2` puis `tools/osm-sync-test.js` (variable `JEU=` pour un autre dépôt de jeu ; les parcs sont clonés à côté, `../osmrides_parks`).
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
