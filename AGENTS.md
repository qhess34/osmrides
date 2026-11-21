# AGENTS.md — consignes pour travailler sur ce dépôt

## Le projet

Simulateurs d'exploitation d'attractions du Parc Astérix, en 2D vue du dessus, sur le tracé réel d'OpenStreetMap. Le joueur est chef d'attraction : pupitre, trains, quai, file, garage, maintenance, météo. Jeu de fan non officiel. Interface et textes en français.

## Attentes du propriétaire

Règles d'ajout d'attraction : `docs/NOUVELLE-ATTRACTION.md`. Détail technique : fiches `docs/ref/` (ci-dessous).

- **Réalisme avant tout** : rendu aérien crédible, couleurs sourdes, aucun pictogramme ni emoji, rien d'enfantin.
- **Fidélité** : tracé, gare, file, garage pris dans OSM ; ce qui est estimé (hauteurs, longueurs, couleurs, pont transbordeur) est signalé dans le code et dit au propriétaire, jamais présenté comme mesuré.
- **Commande par zones, jamais par train** (gare, lift, freinage AUTO/MANU, appareil, voies) ; portillons et sécurités ouverts / verrouillés au bouton seulement ; barrières de file posées à la main dans l'éditeur, cliquées sur la carte.
- **Visiteurs** : ils ne marchent que sur les chemins, ne franchissent que les barrières ouvertes (évacués compris), ne se chevauchent jamais, sont tournés face à leur marche.
- Vocabulaire : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur.

## Organisation du code

Aucune dépendance, aucun serveur : tout marche en ouvrant le fichier (`file://`), sans `fetch` ni modules ES. Table détaillée : `docs/ref/fichiers.md`.

| Fichier | Rôle |
|---|---|
| `index.html`, `apropos.html`, `tutos.html`, `parc.html` | écran titre, présentation, leçons, plan du parc |
| `jeu.html` | page de jeu ; charge `sites/<site>.*` puis `engine/*.js` |
| `engine/*.js` | moteur générique (core, garage, state, queue, sim, ui, render, save), aucune coordonnée ni texte d'attraction |
| `sites/<site>.data.js` | `OSM` généré, jamais édité à la main |
| `sites/<site>.js` | `SITE` écrit à la main (référence : `zeus.js`) |
| `sites/<site>.game.js` | `GAME` écrit par l'éditeur seulement |
| `editor/` | éditeur local WYSIWYG (`editor/README.md`) |
| `tools/` | génération (`make_site.py`), tests, build, PWA |
| `docs/` | conception, notes par attraction, `ref/`, `journal/` |

### Repères du moteur

- Unités : mètres, secondes ; `x` est, `z` sud ; `s` = abscisse le long de la voie (0 = début de gare).
- `OSM.cps` = `[x, hauteur, z, dévers, repère…]`. Repères obligatoires : `st0`, `st1`, `lift0`, `lift1`, `brk` ; le reste : `docs/ref/voie.md`.
- Zones d'attente équivalentes (gare, freins de bloc, frein final) : `docs/ref/garage.md`, `docs/manoeuvres.md`.
- État `G`, trains `trains[]`, `act(nom, arg)`, `step(dt)`, `render(dt)`.

## Ajouter une attraction

1. Extrait OSM de la zone (« Accès réseau »).
2. Repérer tronçons `roller_coaster=track`, gare, file, sortie ; écrire `tools/specs/<site>.json`.
3. `python3 tools/make_site.py extrait.osm tools/specs/<site>.json sites/<site>.data.js apercu.png` ; croisements ≥ 3,2 m, vitesse plausible.
4. `sites/<site>.js` depuis `sites/zeus.js` ; capacité manquante : l'ajouter au moteur, générique, piloté par `SITE`.
5. Carte dans `index.html`, ligne dans `README.md`. Procédure complète : `docs/NOUVELLE-ATTRACTION.md`.

## Vérifier avant de dire que c'est fait

Playwright et Chromium sont préinstallés. Détail (boutons, sorties) : `docs/ref/tests.md`.

- `NODE_PATH=$(npm root -g) node tools/check.js <site> 2>&1 | tail -3` (PASS/FAIL, `offpath`, `overlapQ`…) ; `tools/mobile.js`, `tools/save.js`, `tools/editor-test.js` de même.
- Une attraction après l'autre, jamais en parallèle (clics ratés sous la charge).
- Moteur modifié : revérifier chaque attraction. Relever `pageerror`.
- Dire au propriétaire ce qui a été testé et non testé (souris réelle, son).

## Accès réseau (sessions cloud)

- `api.openstreetmap.org` fonctionne (`/api/0.6/map?bbox=2.560,49.130,2.582,49.142` = parc entier, ≈ 6 Mo, non versionné) ; mise à jour du propriétaire : ses changesets du jour (`docs/NOUVELLE-ATTRACTION.md` §4).
- `overpass-api.de` et miroirs : inutilisables. YouTube : connexion exigée, ne pas contourner, demander captures ou horodatages.
- Recherche web (RCDB, Coasterpedia) : les sources se contredisent parfois, le dire.

## Git

- Dépôt `qhess34/osmrides`, branche `main`, commits directs, messages en anglais à l'impératif.
- Rien poussé ailleurs sans demande ; pas de pull request sauf demande.

## Skills et sous-agents

- Skills `.claude/skills/` : `nouvelle-attraction`, `corriger-attraction`, `verifier-attraction`, `captures-jeu`, `maj-tutos`, `compte-rendu-proprietaire`.
- Agents `.claude/agents/` : `explorateur` (Haiku, lecture seule), `attraction` (Sonnet, `SITE`), `moteur` (Sonnet par défaut, Opus sur demande, `engine/*.js`, revérifie les 4 attractions), `testeur` (Haiku, réservé au pilote : un seul, tests l'un après l'autre).
- Petite correction : directement, sans sous-agent. Une session par tâche, `/compact` en fin.

## Pilotage

`docs/PILOTAGE.md` (à lire en premier par une session de pilotage).

## Économie de tokens (obligatoire)

- Commencer par `docs/ROADMAP.md` ; lire seulement la fiche `docs/ref/` utile, la section utile de `docs/manoeuvres.md` (grep).
- Ne jamais lire `sites/*.data.js` ni `parc/parc.data.js` en entier.
- Journal = `docs/journal/<mois>.md`, ajout en fin de fichier sans relire.
- Une règle n'est écrite qu'à un endroit ; ailleurs on renvoie.
- Captures : aucune pour la logique ; une petite (≈ 600×450, JPEG ≈ 70) par point visuel, regardée une fois ; un montage final `docs/plans/lot-<n>.jpg` < 200 Ko ; vignettes et tutos seulement en fin de grande étape ou sur demande.

## Fiches de référence (`docs/ref/`)

- `voie.md` : tracé, repères, lecture OSM, tunnels, inversions, voies décoratives, rendu de la voie.
- `decor.md` : zones piétonnes, chemins couverts, passerelles, escaliers, paliers, rochers, bâtiments survolés, toits.
- `file.md` : file, visiteurs, évacuation, barrières, `QPW`.
- `quai.md` : quai, portillons, travées, zones d'attente, gare.
- `garage.md` : commande par zones, cantonnement, garage (suite : `docs/manoeuvres.md`).
- `site.md` : clés `SITE` ; écrire ou corriger `sites/<site>.js`.
- `editeur.md` : éditeur et clés `GAME` ; toucher `game.js` ou l'éditeur.
- `tests.md` : ids des boutons, sorties des tests, mobile, toits, son.
- `fichiers.md` : table détaillée des fichiers, PWA, sauvegarde.

## État et suite

`docs/ROADMAP.md` (lots), `docs/ARCHITECTURE.md` (décisions), `docs/JOURNAL.md` (historique), notes `docs/hourra-notes.md`, `oziris-notes.md`, `goudurix-notes.md`. `tools/make_plan.py <site> out.png "Titre" ["Nom:s0:s1:n;…"]` : plans de `docs/plans/`.
