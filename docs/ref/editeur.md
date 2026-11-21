# Éditeur et clés `GAME`

Quand la lire : éditeur local, `sites/<site>.game.js` (`barriers`, `controlRooms`, `boardAreas`, `board`, `site`, `queueEntry`, `look`…). Ne jamais écrire `game.js` à la main hors du format (`editor/schema.js`).

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Fichiers de l'éditeur

- `sites/<site>.game.js` | `const GAME={…}` (corps JSON strict) — données du jeu écrites **par l'éditeur** seulement (barrières, salle de contrôle) ; facultatif ; priorité `GAME` > `SITE` > calcul (`docs/ARCHITECTURE.md` D1-D3)
- `editor/`, `compose.yaml` | éditeur local WYSIWYG (lot 1, `editor/README.md`) : `editor/server.js` (Node 22 sans dépendance, n'écrit que `sites/<site>.game.js`), `editor/index.html` + `editor.js` (couche d'édition sur `jeu.html` en cadre), `editor/schema.js` (format, validation, diff) ; `docker compose up -d` → http://127.0.0.1:8787/ ; non publié

## Données de l'éditeur (`GAME`)

Données de l'éditeur (`GAME`, `engine/core.js` `GM` = `GAME` ou `{}`) : **`GAME.barriers`** (issue #37) = barrières de file posées à la main, clé `'b<n>'` : `{x, z, ang, len, open?, sw?}` (poteau-pivot, vantail fermé de `len` m vers `ang` degrés, ouvert rabattu à 90° dans le sens `sw` = 1 | -1, `open` = ouverte au début de la partie, absent = fermée)

- `engine/queue.js` `reBars` (croisements avec les allées `e.bx`), `qRoute` (itinéraire), `toggleBar` (clic sur la carte, une barrière seule), `barHit` (arrivants et évacués arrêtés devant un vantail fermé), `barPlace` (pose de l'éditeur en travers de l'allée cliquée)
- anciennes clés (`entry`, `fork:…`, `add:…` `{x, z, a, b}`, `{off:true}`) **converties à la lecture** (`barSpecs` : même position, A = fermée ; entrée et `loop…` ouvertes au départ, autres fermées ; `off` ignorée), réécrites au format `b<n>` par l'éditeur à la première modification d'une barrière
- éditeur : ajouter (bouton puis clic sur l'allée), glisser (déplacer), poignée A (tourner, longueur), champs, « Ouverte au début de la partie », sens d'ouverture, supprimer
- `gateList()`
- sauvegarde de partie : état de chaque barrière (`bars`). **`GAME.controlRooms`** = `[{id, x, z, angle (degrés), w, d, main}]`, une salle au plus (pupitre ; `[]` = aucune) : `engine/render.js` `ctlRooms()`, `mainRoom()`, `drawBooth` (pupitre de 3,75 x 1,7 m mis à l'échelle w/d), gyrophare `beaconAt()` et étiquette `boothLabelAt()` qui suivent la salle
- repli : salle OSM (`OSM.ctl`, bâtiment nommé « Salle de contrôle » / « control room », issue #33, `defRoom()`), puis `SITE.booth` (`B0`). **`GAME.boardAreas`** = `[{id, pts:[[x,z],…]}]`, un polygone simple (3 à 64 sommets) par quai d'embarquement, le premier sert (issue #22, `engine/garage.js` `reBoard`, `boardAreaCalc`, `boardArea()`) : absent = travées et couloir calculés, inchangés
- présent = les visiteurs quittent `board.via` au premier point dans le polygone (sinon au point du polygone le plus proche de son bout), marchent DANS le polygone (plus court chemin par ses sommets ramenés de `BA_IN` = 0,2 m ESTIMÉ, `routeA`) jusqu'aux places des travées (deux par portillon, un portillon par wagon ou par rangée, premier rang collé au portillon) gardées seulement dans le polygone (rangs suivants sinon, `BSLOTS`)
- évacuation à rebours (`boardOut`, `platEvac`)
- **la zone se remplit** (issue #24) : places des portillons, puis réserve `BRES` (rangs successifs au pas de 0,6 m ESTIMÉ dans tout le polygone, 400 au plus, `G.platR`), d'où l'on avance à une place de portillon libérée
- **ordre respecté** (issue #44) : une place de réserve libérée est reprise par celui qui attend juste derrière dans sa colonne (`sameCol`), l'arrivant prend la première place libre sans personne derrière elle, par un trajet qui garde 0,4 m de toute place occupée ou promise (`platPath`, `boardInA`, grille de 0,3 m ESTIMÉE), place sur le trajet d'un visiteur en marche donnée plus tard (`platCross`), entrée de la zone laissée libre (0,8 m)
- sans zone éditée : trajet par le couloir d'attente en face du bout de `board.via`, passage laissé libre en face de lui
- sol du quai (`drawStationFloor`), praticable (`tools/offpath.js`)
- éditeur : zone calculée en tirets, **fin de la file** en vert (`boardViaEnd()` : dernière portion du trajet, point d'entrée = dernier point de `board.via`, bords de l'allée au bout de la file), **aimant** (sommet glissé ou créé collé exactement au point ou à un bord à moins de 11 px, Alt = sans aimant), sommets à glisser, rond au milieu d'un bord = nouveau sommet, « Supprimer le sommet », « Revenir au calcul auto ». **`GAME.board`** = `{depth}` (issue #27, D8) : profondeur des travées d'attente en m depuis la ligne des portillons (repli `SITE.plat.depth`, sinon calcul `GDEPTH_CALC` ; bornée à un rang au moins et 6 m, ESTIMÉ ; `engine/garage.js` `reDepth`, `boardDepth()`) : nombre de rangs `GROWS`, séparateurs `GDEPTH`, `BWALK`, `QGATE_CLR`, départ de la réserve
- rangs au-delà des places des portillons = réserve de leur portillon (`BRES` `t`/`u`, avec ou sans zone éditée)
- éditeur : champ, poignée losange orange, « Revenir au calcul auto ». **`GAME.site`** (lot 3, D9) = surcharges partielles de `SITE` (liste blanche : `kind`, `car` {len, n, seats, abreast, restraint}, `trains` [{name, col, col2, wear, lane}], `track`, `trough`, `phys` {roll, drag, vmin}), fusionnées dans `SITE` au début de `engine/core.js` (objets en profondeur, tableaux remplacés ; `SITE_BASE` = valeurs d'origine)
- validées clé par clé et bornées par `editor/schema.js` (toute autre clé refusée)
- éditeur : section « Attraction » (bouton « Origine » par champ, couleurs / noms / usure des trains appliqués à chaud, sinon rechargement du jeu en cadre seul avec caméra et défilement gardés, nombre de trains borné à `TRAIN_MAX` avec message, brouillon dans `window.name` avec `?editeur=`). **`GAME.queueEntry`** = `{len, ang}` (issue #39, D10) : entrée de la file, segment droit de `len` m (0 à 30) orienté à `ang` degrés (0 = est, 90 = sud) depuis le début du chemin de file OSM, à la place du prolongement calculé (`mouth` / `mouthMax` / `link`)
- ramené au dernier point praticable (`engine/queue.js` `QENTRY`, `queueEntry()`)
- accès prolongés jusqu'au bout
- `gateAtMouth` ensuite
- barrières `GAME.barriers` non déplacées
- éditeur : poignée ronde bleue, champs, « Revenir au calcul auto » (rechargement du cadre). **`GAME.look`** (issue #45, D11) = `{queue:{col, tex}, plat:{col, tex}, rail, gate}`, chaque clé facultative : sol des allées de file et des quais (couleur `#rrggbb`, texture `concrete` | `asphalt` | `sand` | `pavers` | `deck` générée par le moteur, `floorTex`, quai tourné dans l'axe de la gare ; quai avec couleur seule : béton lissé de cette couleur), matériau des garde-corps / clôtures de file `metal` | `wood` | `stone` (`RAILM`, `railDraw` : `QRAIL`, `QSIDE`, `QUG`, bordure des allées) et des vantaux des barrières pivotantes (`leaf`), couleur des portillons du quai `gate` (état : angle et voyant du poteau)
- priorité `GAME` > `SITE.platCol` > défaut, sans la clé rendu identique
- relu à chaque image (`look()`), appliqué à chaud par l'éditeur (section « Apparence de la file et du quai », Origine par champ)
- teintes ESTIMÉES. **Aimant des barrières** (éditeur) : pivot collé au bord d'allée de file le plus proche
- bout du vantail collé au bord (opposé ou autre) que croise la direction choisie, **angle gardé** (jamais de perpendiculaire imposée), seule la longueur s'ajuste
- 11 px, Alt = libre (`edgeSnap`, bordure arrondie aux coudes). Ne jamais écrire `game.js` à la main hors du format (`editor/schema.js`).
