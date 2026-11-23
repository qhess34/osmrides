# Architecture OSMrides — état actuel, modèle cible, décisions

Document de référence pour les sessions de développement (court, à tenir à jour). Feuille de route : `docs/ROADMAP.md`.

## 1. État actuel (audit du 2026-11-17)

### Chaîne de données

```
OSM (api.openstreetmap.org, extrait .osm non versionné)
  │  tools/make_site.py extrait.osm tools/specs/<el>.json lieux/parc/asterix/<el>.data.js   (Python, sans dépendance)
  ▼
lieux/parc/asterix/<el>.data.js   const OSM={cps, feats, others, paths, polys, trees, pois, widths, stairs, doors, barriers, tunnels, inversions}
                       GÉNÉRÉ, jamais édité à la main. Coordonnées locales en m (x est, z sud), origine propre au site.
lieux/parc/asterix/<el>.js        const SITE={kind, car, trains, yard, zones, queue.parts, plat, booth, fade, cams, labels, draw.*…}
                       ÉCRIT À LA MAIN (JavaScript, avec fonctions draw.* et commentaires) : paramètres d'instance + corrections.
tools/specs/<site>.json  spec d'import : ways de la voie, profil en hauteur ESTIMÉ, inversions, chemins/polygones nommés.
engine/*.js            moteur commun, scripts classiques à globales partagées, aucune donnée propre à un site.
jeu.html?type=parc&lieu=asterix&el=<id>     charge data.js → site.js → engine/*.js (balises <script>, fonctionne en file://).
```

- `lieux/parc/asterix/plan.data.js` (plan du parc) : généré par `tools/make_park.py`.
- Publication : `.github/workflows/pages.yml` copie `*.html *.css *.webmanifest sw.js engine lieux icons img` dans `_site` à chaque push sur `main`, puis `tools/make_sw.py` (cache hors ligne). `docs/`, `tools/` et tout autre dossier ne sont **pas** publiés.
- Tests : `tools/check.js` (journée complète scriptée aux boutons, visiteurs hors chemins, barrières), `save.js`, `mobile.js`, `sound.js` (Playwright préinstallé).

### Ce que le moteur dérive lui-même (non stocké)

- Repères de voie (`st0`, `lift0`, `brk`, freins de bloc…) depuis les tags `roller_coaster:track` d'OSM.
- **Barrières de file** : posées à la main dans l'éditeur (D2, issue #37) ; plus de calcul ni de nœud OSM.
- Quai, portillons, opérateurs : depuis `SITE.plat`, `SITE.car`, la voie.
- **Poste de conduite** (salle de contrôle) : `SITE.booth=[x, z, angle, échelle]` (+ `boothLabel`, `beacon`), une seule par site, positions ESTIMÉES écrites à la main ; jamais importé d'OSM. Depuis le lot 1 : `GAME.controlRooms` (D3), repli `SITE.booth`.

### Limites constatées

- Pas d'identifiant OSM dans `OSM.feats` (traçabilité perdue après l'import) ; les barrières en gardent un `ref`, pas d'id.
- `lieux/parc/asterix/<el>.js` mélange paramètres d'instance (trains, couleurs), corrections de géométrie (positions de booth, files) et code de dessin propre au site : non éditable par un outil sans risque.
- Le moteur est centré coaster (voie unique continue `cps`, trains, freins) : la famille « parcours aquatique » réutilisera la voie et les trains, les flat rides non.
- Aucune notion de type / sous-type normalisés : `SITE.kind` (`wood|bob|inverted|steel`) fait office de sous-type coaster.

## 2. Séparation des données (cible)

| Couche | Fichier | Écrit par | Envoyé à OSM ? |
|---|---|---|---|
| Données OSM importées (référence) | `lieux/parc/asterix/<el>.data.js` (+ à terme `lieux/parc/asterix/<el>.osm.json` : objets avec id, version, tags) | importeur uniquement | non (c'est la copie) |
| Corrections locales des données OSM | `lieux/parc/asterix/<el>.osmfix.json` (lot 4) : `{id, version d'origine, avant, après}` | éditeur | oui, sur sélection, après diff (lot 6) |
| **Données propres au jeu (éditeur)** | **`lieux/parc/asterix/<el>.game.js`** (lot 1) : barrières, salles de contrôle, puis trains, couleurs, paramètres | éditeur | jamais |
| Paramètres écrits à la main (hérité) | `lieux/parc/asterix/<el>.js` (`SITE`) | développeur ; migré progressivement vers `game.js` | jamais |
| Données calculées | aucune (calculées au chargement par le moteur) | moteur | jamais |

Règle de priorité au chargement : `GAME` (éditeur) > `SITE` (main) > valeur calculée par le moteur. Une clé absente de `GAME` laisse le comportement actuel intact : **aucune migration destructive**, une attraction sans `game.js` se joue comme avant.

## 3. Décisions (ADR courtes)

- **D1 — Fichier `lieux/parc/asterix/<el>.game.js`** : `const GAME = {…};` dont le corps est du JSON strict (lisible par `JSON.parse` après retrait de l'en-tête), chargé par `jeu.html` après `lieux/parc/asterix/<el>.js` ; absent = `GAME` indéfini. Raison : fonctionne en `file://` sans `fetch`, publié par GitHub Pages sans changement, versionné et lisible en diff Git, aucune réécriture d'un fichier JavaScript écrit à la main.
- **D2 — Barrières posées à la main** (issue #37, 20/11, remplace les surcharges du lot 1) : aucune barrière calculée ; `GAME.barriers` = `{'b<n>': {x, z, ang, len, open?, sw?}}` (pivot, vantail fermé de `len` m vers `ang` degrés, ouvert à 90° dans le sens `sw`, `open` = ouverte au début de la partie). Chacune s'ouvre et se ferme seule ; fermée, elle arrête quiconque la franchit (évacués compris) ; itinéraire : plus court trajet vers la gare par des barrières ouvertes. Anciennes clés (`entry`, `fork:…`, `add:…`, `{off:true}`) converties à la lecture (`engine/queue.js` `barSpecs`), réécrites par l'éditeur à la première modification.
- **D3 — Salle de contrôle** : `GAME.controlRooms=[{id, x, z, angle, w, d, main}]` (angle en degrés, w × d en m) remplace `SITE.booth` quand il est présent ; liste vide = aucune salle (ni pupitre dessiné, ni opérateur, ni gyrophare, ni étiquette). **Décision du propriétaire (17/11) : une seule salle par attraction, celle du pupitre** ; le format liste est gardé pour évoluer (aiguillage, locaux techniques : plus tard), l'éditeur et la validation limitent à 0 ou 1 salle, `main` est toujours vrai. Dessin : pupitre actuel mis à l'échelle (3,75 × 1,7 m à l'échelle 1) ; gyrophare et étiquette (`SITE.beacon`, `SITE.boothLabel`) ramenés au repère de la salle et la suivent. À l'ouverture d'une attraction sans `GAME.controlRooms`, l'éditeur propose la salle déduite de `SITE.booth` (reprise à la première modification ou au bouton, écrite à la sauvegarde, `SITE` inchangé).
- **D7 — Zone d'attente du quai d'embarquement (issue #22, 19/11)** : `GAME.boardAreas=[{id, pts:[[x,z],…]}]`, un polygone simple par quai d'embarquement (le jeu n'en a qu'un : 0 ou 1 polygone, validé par `editor/schema.js`). Priorité `GAME` > calcul (travées `SLOT0` / `SLOT_P` / `GDEPTH` et couloir `BWALK`) ; sans la clé, rien ne change. Le moteur garde les places des travées (deux par portillon, un portillon par wagon ou par rangée, premier rang collé) mais seulement dans le polygone, et y fait marcher les visiteurs (plus court chemin intérieur) depuis `SITE.board.via` ; sol du quai, surface praticable, évacuation à rebours. L'éditeur part du polygone calculé (`boardAreaCalc`) ; « Revenir au calcul auto » retire la clé. Issue #24 : le polygone se remplit (réserve `BRES` derrière les places des portillons, `G.platR`) ; l'éditeur affiche la fin de la file (`boardViaEnd()` : dernière portion du trajet, point d'entrée, bords de l'allée) et y aimante les sommets (11 px, Alt = sans aimant).
- **D8 — Profondeur des travées d'attente (issue #27, 19/11)** : `GAME.board={depth}` (m, de la ligne des portillons au bout des séparateurs ; un quai d'embarquement par attraction), validé par `editor/schema.js` (0,5 à 6 m) ; repli `SITE.plat.depth` ; priorité `GAME` > `SITE` > calcul (`GDEPTH_CALC`, inchangé sans valeur). Le moteur (`engine/garage.js` `reDepth`) borne la valeur entre un rang (`SLOT0` + 0,4 m) et `DEPTH_MAX` = 6 m (ESTIMÉS) et en déduit le nombre de rangs `GROWS`, `GDEPTH` (séparateurs), `BWALK` (couloir d'attente juste derrière, plus loin que `board.walk` si besoin, jamais au-delà de `plat.load` - 0,3 m), `QGATE_CLR` (au chargement) et le départ de la réserve de la zone d'attente (derrière le dernier rang). Les places des portillons ne changent pas ; les rangs ajoutés sont des places de réserve de leur portillon (`BRES`, `t`, `u`), remplies quand les places du portillon sont prises, avec ou sans `GAME.boardAreas` (sans zone : on n'avance que dans sa travée). Éditeur : champ en m, poignée (losange orange) à glisser, valeur calculée affichée par défaut, « Revenir au calcul auto » retire la clé.
- **D9 — Paramètres d'instance éditables (lot 3, issue #31, 19/11)** : `GAME.site` = surcharges **partielles** de `SITE`, liste blanche stricte de clés : `kind` (`wood` | `bob` | `inverted` | `steel`), `car` (`len`, `n`, `seats`, `abreast`, `restraint`), `trains` (liste complète `{name, col, col2, wear, lane?}`, de 1 à 8 trains), `track` (`spine`, `rail`, `support`), `trough` (`lo`, `hi` = `[r, g, b]`, `edge`, `deck`, `rim` = `#rrggbb`, `shine` = `rgba(…)`), `phys` (`roll`, `drag`, `vmin`). Priorité `GAME.site` > `SITE` > calcul. Le moteur fusionne `GAME.site` dans `SITE` **au tout début de `engine/core.js`** (objets fusionnés en profondeur, tableaux remplacés ; clé hors liste ignorée), avant tout calcul : tout le moteur en profite sans autre changement ; `SITE_BASE` garde les valeurs d'origine (affichées par l'éditeur). `editor/schema.js` valide clé par clé (types, entiers, bornes, `#rrggbb`, énumérations) et **refuse** toute clé hors liste (contrairement aux clés inconnues du premier niveau, conservées) ; bornes ESTIMÉES : longueur de wagon 0,5 à 6 m, 1 à 30 wagons, train de 40 m au plus, 1 à 8 places, usure 0 à 100, voie de garage 1 à 8, roulement 0 à 0,3, traînée 0 à 0,01, vitesse minimale 1 à 6 m/s. Une clé absente = valeur de `SITE` ; une valeur égale à l'origine n'est pas écrite. Éditeur : section « Attraction » (valeur d'origine affichée, champ modifié mis en évidence, ↺ par champ) ; chaque modification recharge le jeu en cadre, le brouillon complet voyageant dans `window.name` du cadre (`t2z-draft:<JSON>`, lu par `engine/core.js` seulement avec `?editeur=` dans l'URL, jamais en jeu normal). Limites connues : changer `kind` ne refait ni la voie, ni la gare, ni le garage (avertissement affiché) ; un nombre de trains sans place au garage fait échouer le chargement (le moteur lève `pas de place au garage`, l'éditeur propose d'annuler la dernière modification) ; les couleurs des trains / de la voie d'une attraction restent des teintes SUPPOSÉES tant que le propriétaire ne les a pas confirmées.
- **D10 — Entrée de la file (issue #39, 20/11)** : `GAME.queueEntry={len, ang}` (m, 0 à 30 ; degrés, 0 = est, 90 = sud), validé par `editor/schema.js` ; priorité `GAME` > `SITE.queue` (`mouth`, `mouthMax`, `link`) > calcul (`queueMouth`, inchangé sans la clé). Le moteur (`engine/queue.js` `QENTRY`) annule le prolongement calculé et pose un segment droit depuis le début du chemin de file OSM (`ENTRY0`), raccourci au dernier point praticable (zone piétonne OSM hors trous, demi-largeur d'un chemin OSM, 1,2 m ESTIMÉ par défaut, accès écrits ou calculés, entrée calculée ; hors bâtiment ; raccord des accès praticable aussi) ; les accès (`SITE.approach`) vont jusqu'au bout, `gateAtMouth` s'applique ensuite ; barrières de `GAME.barriers` inchangées. `queueEntry()` : début, bout, calcul, longueur demandée et retenue. Éditeur : poignée, champs, « Revenir au calcul auto » ; chaque réglage recharge le jeu en cadre. Aimant des barrières (même jour) : `edgeSnap(x, z, r)` du moteur, bords des allées de file dessinées.
- **D11 — Apparence de la file et des quais (issue #45, 21/11)** : `GAME.look={queue:{col, tex}, plat:{col, tex}, rail, gate}`, chaque clé facultative, validé par `editor/schema.js` (`col`, `gate` : `#rrggbb` ; `tex` : `concrete` béton | `asphalt` asphalte | `sand` sable stabilisé | `pavers` pavés | `deck` platelage bois ; `rail` : `metal` | `wood` | `stone`). Priorité `GAME` > `SITE.platCol` > défaut du moteur ; sans la clé, rendu identique (`TEX.stone`, `PLAT_COL`, garde-corps métal, portillons vert / rouge). Textures générées par le moteur (`engine/render.js` `floorTex`, motifs de 8 m mis en cache, quai tourné dans l'axe de la gare), matériau des garde-corps (`QRAIL`, `QSIDE`, `QUG`, bordure des allées, `railDraw`, `RAILM`) et des vantaux des barrières pivotantes (`leaf`) ; couleur des portillons (vantaux et clôture fixe de leur ligne ; état lu à l'angle et au voyant du poteau). Relu à chaque image (`look()`, `drawWorld`) : l'éditeur l'applique à chaud sans recharger le cadre. Teintes et largeurs (muret ≈ 30 cm) ESTIMÉES.
- **D12 — Synchronisation vers OSM (propriétaire, 21/11, issue #46)** : un réglage de l'éditeur qui a un équivalent OSM est (1) lu dans OSM à l'import comme valeur par défaut, (2) marqué « OSM » / « modifié » dans l'éditeur, (3) renvoyable vers OSM à la demande (jamais automatiquement), avec la liste des écarts à valider par le propriétaire. Correspondances et mode d'envoi : issue #46. Tout nouveau réglage de l'éditeur dit s'il a un équivalent OSM. Réalisé (issue #46, décisions du propriétaire 21/11) : envoi direct OAuth2 PKCE depuis l'éditeur local ; sol du quai = polygone séparé sous le toit (`area:highway=footway` + `covered=yes`), toit = `roof:colour` du bâtiment de la gare (`GAME.look.roof`, D11 étendue) ; détail et fichiers : `docs/ref/editeur.md` « Synchronisation vers OSM ».
- **D13 — osmrides est une librairie versionnée (propriétaire, 23/11, issue #50)** : moteur et éditeur génériques, publiés par étiquette git numérotée (`0.0.1`…) ; le code propre à un type de lieu (parc, ski) vit dans le dépôt de jeu. Le jeu indique sa version (`MOTEUR` dans `jeu.html`) et charge le moteur en ligne (jsDelivr) par `engine/moteur.js` ; l'éditeur de la même version se lance sur le dépôt de jeu (`docker compose` du modèle `tools/jeu/compose.yaml`, ou `tools/editeur.sh`). Détail : `docs/versions.md`.
- **D4 — Éditeur local** : dossier `editor/` (non publié par Pages), serveur Node sans dépendance npm (`editor/server.js`) qui sert le dépôt en lecture et n'écrit que `lieux/parc/asterix/<el>.game.js` (liste blanche), avec validation et diff avant écriture ; aucune opération Git. Interface = page qui charge le vrai moteur (WYSIWYG : même rendu que le jeu) plus une couche d'édition. Réalisation (lot 1) : `editor/index.html` ouvre `jeu.html?type=parc&lieu=asterix&el=…&mode=sandbox` dans un cadre de même origine (même chargement que le jeu, pupitre masqué, simulation figée) et modifie en place l'objet `GAME` lu par le moteur ; validation, format et diff partagés par le serveur et l'interface (`editor/schema.js`).
- **D5 — Docker** : `compose.yaml` à la racine, image `node:22-alpine`, dépôt monté en volume (lecture seule, sauf `lieux/`), port lié à `127.0.0.1`, utilisateur non root, système de fichiers en lecture seule hors volume, pas de socket Docker.
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
