# Décor OSM, escaliers, bâtiments survolés, toits

Quand la lire : zones piétonnes, chemins couverts, passerelles, escaliers, paliers, rochers, bâtiment survolé par la voie, toits effaçables.

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Décor OSM (`tools/make_site.py`)

Décor OSM (`tools/make_site.py`) : zones piétonnes (`highway=pedestrian` + `area=yes`, `area:highway`, `place=square`, multipolygones assemblés avec leurs trous) → surfaces praticables partout (rendu sable, `tools/offpath.js`)

- chemins à l'intérieur → `f.in` (non dessinés)
- chemins couverts (`tunnel`, `covered`, `indoor`, `layer<0`) → `f.cv` : le bâtiment qui les couvre s'efface au zoom et ils sont redessinés dessous, les visiteurs y passent sous la voie
- entrées / sorties (`entrance=*`) → `OSM.doors`
- passerelles (`bridge=*`) → `f.br` (`f.w` = width ; dessinées au-dessus de la voie qu'elles franchissent, visiteurs dessus ; escaliers ajoutés à leurs bouts par le moteur seulement si OSM n'en a aucun à moins de 5 m de chemin, `engine/queue.js` `STAIRS`)
- escaliers (`highway=steps`) → `OSM.stairs` (`{p, up, w}` : marches, garde-corps, visiteurs ralentis ; **largeur du chemin dessiné qu'ils prolongent** (file, passerelle), sinon width OSM, sinon 2 m (sortie), sans chevauchement, allées coupées dessus ; escalier parallèle à la gare près d'une porte et dans son emprise : **en applique** hors de la gare, palier jusqu'au mur, `LANDS` ; **palier rectangulaire au HAUT de chaque escalier** (lot 6), de sa largeur, aligné sur lui, aucun en bas : haut = sens OSM `incline` (`o.up`), sinon l'extrémité dans la gare / près d'une porte, puis au bout d'une passerelle (`o.top`, `engine/queue.js` `stairTops`) ; sommet sur le quai : le quai sert de palier ; sens inconnu : pas de palier ; allée coupée sous le palier, `LANDC`, `LANDG`)
- rochers (`natural=rock|stone`) : massif en relief, voie en tunnel dessous (tunnel prolongé jusqu'aux bords du rocher, portails sombres), voie sans tunnel par-dessus (poteaux), file en tunnel dessous, s'efface au zoom / toits retirés
- jonctions continues (couloir couvert et escalier au sol et à la bordure du chemin extérieur, bordures masquées dans les zones piétonnes)
- barrières de file : **posées à la main dans l'éditeur, jamais calculées ni lues dans OSM** (décision du propriétaire, issue #37, 20/11, `osmrides_parks/docs/OSM-GUIDE.md` §5 ; `barrier=*` reste importé dans `OSM.barriers`, ignoré par le moteur ; règles : `GAME.barriers` ci-dessous)
- **file déduite** (lot 5, issue #34) : `SITE.queue.ways` = chemins de file OSM (`OSM.paths`, sens de marche) → tronçons, boucles (plus long chemin) et raccourcis (plus court) déduits des nœuds communs et du sens, du début du premier chemin au nœud le plus proche de `entrance=main` (`deduceParts`, bilan `QS.auto`, nom de fourche repris de `queue.parts` si les pointes coïncident)
- `SITE.queue.parts` en repli (échec, ou `ways` absent ; les 4 attractions sont déduites depuis l'issue #37, Zeus avec son raccourci ouest OSM 937019288)
- rochers et autres multipolygones assemblés à partir de leurs tronçons
- spec `base` (décor seul, voie gardée ; plus utilisé depuis le réimport complet de Zeus, issue #33)
- spec `skip` (clés non exportées, tous modes)
- `tunnels_ignore` de la spec : tag tunnel OSM ignoré
- `paths` de la spec : un tronçon ou une liste de tronçons mis bout à bout.

## Bâtiment survolé par la voie

Bâtiment survolé par la voie (issue #14, `engine/render.js` `ROOFB`, `drawBld`) : la voie passe au-dessus de toute son emprise plus haut que lui (hauteur OSM `height`, sinon `building:levels` × 3 m, `f.bh` de `tools/make_site.py` ; sinon 7 m ESTIMÉ, 4 m auvent, 12 m hôtel) → toit dessiné sous la voie, ses supports, les passerelles et les trains, ombres de la voie / des trains / des passerelles portées sur le toit, poteaux posés sur le toit (raccourcis : `roofH`)

- sinon ordre inchangé
- gare, toits effaçables (`SITE.fade`) et bâtiments sur chemin couvert exclus.

## Tags OSM transportés (`f.t`, issue #68)

Format d'import (à produire par `tools/make_site.py` des jeux) : chaque objet de `OSM.feats` peut porter `t`, table des tags OSM bruts **utiles au moteur**, valeurs telles qu'OSM les donne (chaînes) ; clés absentes = non transmises ; `t` absent = comportement d'avant. Exemple : `{"k":"building=yes","c":1,"p":[…],"id":"w148160405","v":11,"t":{"height":"8","min_height":"5","roof:shape":"gabled","roof:orientation":"along","roof:height":"2","roof:colour":"#ccb281"}}`.

- clés lues : `height`, `min_height`, `building:levels`, `roof:shape`, `roof:orientation`, `roof:height`, `roof:angle`, `roof:colour` (bâtiments) ; `layer`, `level`, `material` (tous objets, dont `man_made=tunnel`, `man_made=excavation`, `man_made=structure`, plans d'eau, chemins). Lecture : `tagOf`, `numOf`, `lvOf`, `colOf` (`engine/noyau/carte.js`).
- objets à exporter avec `t` : bâtiments (`building=*`), `man_made=tunnel|excavation|structure`, et tout objet portant `layer` / `level`.
- les anciennes clés restent lues : `f.bh` (hauteur), `f.lv` (niveau < 0 d'un chemin).

## Toits lus dans OSM

Toit d'un bâtiment OSM (`roofGeom`, `drawPans`) : `roof:shape=flat` (ou forme inconnue) : toit plat d'avant ; `gabled` : deux pans ; `hipped` : quatre pans. Faîtage sur le rectangle d'emprise minimal du polygone, dans le sens de sa plus grande longueur (`roof:orientation=along`, défaut OSM) ou en travers (`across`) ; pente = `roof:height` sur la demi-largeur, sinon `roof:angle`, sinon 30° ESTIMÉ (ombrage seul). Pans éclairés selon leur orientation (lumière du nord-ouest), faîtage clair. Couleur `roof:colour` (hex, ou nom courant ramené à une teinte sourde) ; hauteur `height`, sinon `building:levels` × 3 m, sinon `f.bh`, sinon ESTIMÉE (« Bâtiment survolé ») ; `min_height` lu (`b.mh`), sans effet en vue aérienne.

- gare : couleur `GAME.look.roof` > `roof:colour` OSM (`OSM.attrs` ou `f.t`) > `SITE.stationRoofCol` ; forme OSM > `SITE.draw.stationRoof` (ancien dessin d'un jeu, gardé seulement si OSM ne donne aucune `roof:shape`). Le toit est le polygone OSM tel quel (`quai.md`).
- jamais de toit hors d'un bâtiment ou abri OSM (`AGENTS.md`).
