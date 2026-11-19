# Architecture T2Z — état actuel, modèle cible, décisions

Document de référence pour les sessions de développement (court, à tenir à jour). Feuille de route : `docs/ROADMAP.md`.

## 1. État actuel (audit du 2026-11-17)

### Chaîne de données

```
OSM (api.openstreetmap.org, extrait .osm non versionné)
  │  tools/make_site.py extrait.osm tools/specs/<site>.json sites/<site>.data.js   (Python, sans dépendance)
  ▼
sites/<site>.data.js   const OSM={cps, feats, others, paths, polys, trees, pois, widths, stairs, doors, barriers, tunnels, inversions}
                       GÉNÉRÉ, jamais édité à la main. Coordonnées locales en m (x est, z sud), origine propre au site.
sites/<site>.js        const SITE={kind, car, trains, yard, zones, queue.parts, plat, booth, fade, cams, labels, draw.*…}
                       ÉCRIT À LA MAIN (JavaScript, avec fonctions draw.* et commentaires) : paramètres d'instance + corrections.
tools/specs/<site>.json  spec d'import : ways de la voie, profil en hauteur ESTIMÉ, inversions, chemins/polygones nommés.
engine/*.js            moteur commun, scripts classiques à globales partagées, aucune donnée propre à un site.
jeu.html?site=<id>     charge data.js → site.js → engine/*.js (balises <script>, fonctionne en file://).
```

- `parc/parc.data.js` (plan du parc) : généré par `tools/make_park.py`.
- Publication : `.github/workflows/pages.yml` copie `*.html *.css *.webmanifest sw.js engine sites parc icons img` dans `_site` à chaque push sur `main`, puis `tools/make_sw.py` (cache hors ligne). `docs/`, `tools/` et tout autre dossier ne sont **pas** publiés.
- Tests : `tools/check.js` (journée complète scriptée aux boutons, visiteurs hors chemins, barrières), `save.js`, `mobile.js`, `sound.js` (Playwright préinstallé).

### Ce que le moteur dérive lui-même (non stocké)

- Repères de voie (`st0`, `lift0`, `brk`, freins de bloc…) depuis les tags `roller_coaster:track` d'OSM.
- **Barrières de file** : `engine/queue.js` `osmGates` les calcule à chaque chargement depuis les nœuds OSM `barrier=*` (`OSM.barriers`) et la géométrie des fourches de `SITE.queue.parts` (pivot à la pointe, longueur = largeur du chemin) ; pointes sans nœud : ESTIMÉES. Depuis le lot 1, une barrière corrigée dans l'éditeur est stockée dans `GAME.barriers` (D2) ; les autres restent calculées.
- Quai, portillons, opérateurs : depuis `SITE.plat`, `SITE.car`, la voie.
- **Poste de conduite** (salle de contrôle) : `SITE.booth=[x, z, angle, échelle]` (+ `boothLabel`, `beacon`), une seule par site, positions ESTIMÉES écrites à la main ; jamais importé d'OSM. Depuis le lot 1 : `GAME.controlRooms` (D3), repli `SITE.booth`.

### Limites constatées

- Pas d'identifiant OSM dans `OSM.feats` (traçabilité perdue après l'import) ; les barrières en gardent un `ref`, pas d'id.
- `sites/<site>.js` mélange paramètres d'instance (trains, couleurs), corrections de géométrie (positions de booth, files) et code de dessin propre au site : non éditable par un outil sans risque.
- Le moteur est centré coaster (voie unique continue `cps`, trains, freins) : la famille « parcours aquatique » réutilisera la voie et les trains, les flat rides non.
- Aucune notion de type / sous-type normalisés : `SITE.kind` (`wood|bob|inverted|steel`) fait office de sous-type coaster.

## 2. Séparation des données (cible)

| Couche | Fichier | Écrit par | Envoyé à OSM ? |
|---|---|---|---|
| Données OSM importées (référence) | `sites/<site>.data.js` (+ à terme `sites/<site>.osm.json` : objets avec id, version, tags) | importeur uniquement | non (c'est la copie) |
| Corrections locales des données OSM | `sites/<site>.osmfix.json` (lot 4) : `{id, version d'origine, avant, après}` | éditeur | oui, sur sélection, après diff (lot 6) |
| **Données propres au jeu (éditeur)** | **`sites/<site>.game.js`** (lot 1) : barrières, salles de contrôle, puis trains, couleurs, paramètres | éditeur | jamais |
| Paramètres écrits à la main (hérité) | `sites/<site>.js` (`SITE`) | développeur ; migré progressivement vers `game.js` | jamais |
| Données calculées | aucune (calculées au chargement par le moteur) | moteur | jamais |

Règle de priorité au chargement : `GAME` (éditeur) > `SITE` (main) > valeur calculée par le moteur. Une clé absente de `GAME` laisse le comportement actuel intact : **aucune migration destructive**, une attraction sans `game.js` se joue comme avant.

## 3. Décisions (ADR courtes)

- **D1 — Fichier `sites/<site>.game.js`** : `const GAME = {…};` dont le corps est du JSON strict (lisible par `JSON.parse` après retrait de l'en-tête), chargé par `jeu.html` après `sites/<site>.js` ; absent = `GAME` indéfini. Raison : fonctionne en `file://` sans `fetch`, publié par GitHub Pages sans changement, versionné et lisible en diff Git, aucune réécriture d'un fichier JavaScript écrit à la main.
- **D2 — Barrières = surcharges** : le moteur garde son calcul (valeurs par défaut) ; `GAME.barriers` stocke seulement les barrières corrigées, par clé stable (type + tronçon de file + pointe), avec position, orientation, longueurs. Une surcharge dont la clé n'existe plus est signalée par l'éditeur, jamais supprimée en silence. **Filet de sécurité (propriétaire, 17/11)** : supprimer une barrière calculée = surcharge `{"off": true}` (barrière ignorée par le dessin, le clic et la logique ; le calcul n'est jamais effacé, « Rétablir » retire la surcharge) ; ajouter une barrière = clé `add:<nom du tronçon de SITE.queue.parts>:<n>`, même format `{x, z, a, b}`, liée à la fourche de ce tronçon (bascule avec elle) ; une barrière ajoutée se supprime en retirant sa clé. Les nœuds OSM `barrier=*` restent un indice d'import ; la barrière elle-même relève du jeu (**confirmé par le propriétaire le 17/11 : le nœud OSM ne donne que la position initiale, la position finale est celle de l'éditeur**).
  - Clé (lot 1) : `entry` (barrière d'entrée) ou `fork:<name du tronçon de SITE.queue.parts, sinon part<i>>:<rôle>`, rôle = `<on><bout>` de la barrière calculée : `fork0` / `fork1` (pointe de départ / de retour du raccourci), `loop0`, `short1`… (barrière en travers d'un chemin, nœud OSM au milieu), `site<k>` (barrière donnée par `SITE`), suffixe `#2` en cas de doublon. Elle ne dépend ni des coordonnées ni de l'ordre des nœuds OSM : elle survit à un réimport tant que le tronçon garde son nom.
  - Valeur : `{x, z, a:{ang, len}, b:{ang, len}}` = pivot (m) et positions A / B (angle en **degrés**, `atan2(dz, dx)`, longueur en m). Le moteur (`engine/queue.js` `gameGates`) remplace la géométrie après chaque calcul ; la barrière corrigée sert au dessin, au clic sur la carte et reste liée à sa fourche (les visiteurs ne passent que par le chemin ouvert : logique topologique inchangée).
- **D3 — Salle de contrôle** : `GAME.controlRooms=[{id, x, z, angle, w, d, main}]` (angle en degrés, w × d en m) remplace `SITE.booth` quand il est présent ; liste vide = aucune salle (ni pupitre dessiné, ni opérateur, ni gyrophare, ni étiquette). **Décision du propriétaire (17/11) : une seule salle par attraction, celle du pupitre** ; le format liste est gardé pour évoluer (aiguillage, locaux techniques : plus tard), l'éditeur et la validation limitent à 0 ou 1 salle, `main` est toujours vrai. Dessin : pupitre actuel mis à l'échelle (3,75 × 1,7 m à l'échelle 1) ; gyrophare et étiquette (`SITE.beacon`, `SITE.boothLabel`) ramenés au repère de la salle et la suivent. À l'ouverture d'une attraction sans `GAME.controlRooms`, l'éditeur propose la salle déduite de `SITE.booth` (reprise à la première modification ou au bouton, écrite à la sauvegarde, `SITE` inchangé).
- **D7 — Zone d'attente du quai d'embarquement (issue #22, 19/11)** : `GAME.boardAreas=[{id, pts:[[x,z],…]}]`, un polygone simple par quai d'embarquement (le jeu n'en a qu'un : 0 ou 1 polygone, validé par `editor/schema.js`). Priorité `GAME` > calcul (travées `SLOT0` / `SLOT_P` / `GDEPTH` et couloir `BWALK`) ; sans la clé, rien ne change. Le moteur garde les places des travées (deux par portillon, un portillon par wagon ou par rangée, premier rang collé) mais seulement dans le polygone, et y fait marcher les visiteurs (plus court chemin intérieur) depuis `SITE.board.via` ; sol du quai, surface praticable, évacuation à rebours. L'éditeur part du polygone calculé (`boardAreaCalc`) ; « Revenir au calcul auto » retire la clé.
- **D4 — Éditeur local** : dossier `editor/` (non publié par Pages), serveur Node sans dépendance npm (`editor/server.js`) qui sert le dépôt en lecture et n'écrit que `sites/<site>.game.js` (liste blanche), avec validation et diff avant écriture ; aucune opération Git. Interface = page qui charge le vrai moteur (WYSIWYG : même rendu que le jeu) plus une couche d'édition. Réalisation (lot 1) : `editor/index.html` ouvre `jeu.html?site=…&mode=sandbox` dans un cadre de même origine (même chargement que le jeu, pupitre masqué, simulation figée) et modifie en place l'objet `GAME` lu par le moteur ; validation, format et diff partagés par le serveur et l'interface (`editor/schema.js`).
- **D5 — Docker** : `compose.yaml` à la racine, image `node:22-alpine`, dépôt monté en volume (lecture seule, sauf `sites/`), port lié à `127.0.0.1`, utilisateur non root, système de fichiers en lecture seule hors volume, pas de socket Docker.
- **D6 — Sans IA** : toute fonction de l'éditeur est déterministe ; une assistance IA éventuelle sera un module séparé et facultatif.

## 4. OSM ↔ modèle du jeu (cartographie des écarts)

| Donnée du jeu | Dans OSM ? | Traitement |
|---|---|---|
| Tracé au sol de la voie | oui, `roller_coaster=track` | importé |
| Rôle des tronçons (gare, lift, freins, garage, transfert) | oui, `roller_coaster:track=*` | importé |
| Hauteur / profil, dévers, inversions | partiel (`height` max, rarement par tronçon) | estimé (spec), à éditer (lot 7) ; proposition OSM possible (`ele`/`height` par nœud) |
| Gare, quais, bâtiments, abris | oui (`building=*`, `building=roof`, `layer`) | importé ; largeur de quai ESTIMÉE |
| File d'attente (chemins, fourches) | oui (`highway=footway`, `layer`, `width`) | importé ; découpage en tronçons/fourches dans `SITE.queue.parts` (à éditer, lot 5) |
| Entrées / sorties | oui (`entrance=*`) | importé |
| Escaliers, passerelles, tunnels | oui (`highway=steps`, `bridge`, `tunnel`, `incline`) | importé |
| **Barrières de file** (position, pivot, longueur, liaison) | nœud indicatif seulement | **jeu** (`GAME.barriers`, lot 1) |
| **Salles de contrôle** | non | **jeu** (`GAME.controlRooms`, lot 1) |
| Trains (nombre, wagons, places, couleurs) | non (parfois `name`, `manufacturer`) | jeu (lot 3) |
| Couleurs de voie, supports | rarement (`colour`) | jeu ; `colour` OSM lu si présent (proposition OSM possible) |
| Garage : appareil, voies, capacités | tronçons `storage`/`transfer` seulement | jeu (lot 3) + géométrie OSM |
| Zones de freinage, moteurs, AUTO/MANU | non | jeu |
| Physique, météo, économie | non | jeu |
| Type d'attraction | `attraction=roller_coaster|water_slide|…` | importé |
| Sous-type (bois, bob, inversé, acier…) | partiel (`roller_coaster=*`, `material`) | jeu, prérempli depuis OSM |

## 5. Familles d'attractions (anticipation, rien à coder avant le lot 8)

- Commun : site, décor OSM, file et barrières, salles de contrôle, quai et portillons, visiteurs, économie, pupitre.
- Coaster (actuel) : voie continue `cps`, trains, cantonnement, garage, lift.
- Parcours aquatique : même voie et cantonnement, bateaux au lieu de trains, chute/lift à bande, eau (pas de lapbars).
- Flat ride : pas de voie ; cycle (montée, rotation, arrêt), nacelles ; nouveau module de simulation.
- Mécanisme : `type` (famille, valeur OSM `attraction=*`) + `subtype` (registre de sous-types fournissant valeurs par défaut et fonctions de dessin) + paramètres d'instance dans `GAME`. Le moteur choisit ses modules selon `type`.
