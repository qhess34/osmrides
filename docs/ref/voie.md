# Voie, repères, tunnels, inversions

Quand la lire : toute tâche sur le tracé, les repères, la lecture OSM des tronçons, les tunnels, les inversions, les voies décoratives, le rendu de la voie.

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Voie (`OSM.cps`, repères, lecture OSM, tunnels, inversions)

Voie : `OSM.cps` = points `[x, hauteur, z, dévers, repère…]` (dévers en degrés, déroulé par le moteur : une vrille va de 0 à 720° ; `inversions` de la spec → vrilles, loopings insérés, `OSM.inversions` en s moteur ; voie qui pivote et train tête en bas dessinés par `engine/render.js`). Repères obligatoires : `st0`, `st1`, `lift0`, `lift1`, `brk`

- facultatifs : `stp` (arrêt de la tête en gare quand la gare OSM est prolongée par des tronçons `moving`, issue #13), `blk1`, `blk2`… (zones de freinage suivies d'un canton, point d'arrêt), `bz1`… (début de leur zone), `brk`/`fin` (dernière zone avant la gare ou le pont), `tr0`/`tr1` (rail de transfert d'un pont droit), `pre0`/`pre1` (zone entre le pont et la gare : elle n'existe que si OSM la donne). **Lus dans OSM** par `tools/make_site.py` quand les tronçons portent `roller_coaster:track` (`station`, `lift_hill`, `waiting`/`brake_run`/`moving` (+ anciens `block_brake`/`storage`/`transfer`) = zones de freinage où un train peut attendre, issue #33 ; **rôle déduit de la position** (propriétaire 20/11) : `brk`/`fin` = dernière zone avant la gare, ou avant le premier `moving` (rail du pont), précédentes = `blkN`, après elle `moving` = rail du pont / autre = `pre`, sauf `osm_brakes` de la spec, `moving` avant le lift ignoré ; ces rôles ne sont que des repères : toutes sont des zones de freinage ordinaires « Frein 1…m » (`docs/manoeuvres.md`, « Modèle ») ; la gare est une zone d'attente comme les autres et le tronçon entre la zone précédente et la gare un canton ordinaire (généralisation du garage à n'importe quelle zone : issue à part). ; `roles` force un rôle ; `tags` de la spec force un repère)
- un train **arrêté** à un frein de bloc en repart à sa vitesse d'entrée dans la zone (`blkRelaunch`, `engine/sim.js`, `docs/manoeuvres.md`)
- gares `roller_coaster:station=load|unload` (non officiel) → `OSM.stations` (seule la gare de départ est exploitée)
- quais déduits de la gare (un de chaque côté, `SITE.plat`), plus de `railway=platform`
- `roller_coaster:element` → `OSM.elements` (`{type, s0, s1, id}`, pour l'éditeur, non lu par le moteur)
- hauteurs : `ele` des nœuds de voie → points relevés du profil (`OSM.ele`, spec `ele_ground` / `ele_keep`), sinon profil ESTIMÉ
- le moteur en déduit les points d'arrêt et le rail du pont (`docs/manoeuvres.md`, « Modèle » ; `SITE.holdBack` et `SITE.preBrake` sont ignorés depuis #57 point 4). `OSM.tunnels=[[s0,s1(,'roof')],…]` (facultatif, plusieurs, s du moteur) : tronçons du circuit tagués `tunnel=yes` (ou `covered=yes` et `layer<0`) par `tools/make_site.py` (`'roof'` : `layer>0`, galerie couverte au-dessus du sol ; `tunnels_extra` de la spec : tunnels absents d'OSM)
- le moteur les cache sous une couverture (eau si le tunnel est sous un plan d'eau OSM, toit de béton pour `'roof'`, sinon remblai ; `SITE.tunnels:[{under:'water'|'ground'|'roof', w}]` dans l'ordre des tunnels OSM, puis `{s:[s0,s1],…}` pour un tunnel ESTIMÉ absent d'OSM) avec deux portails
- un tunnel enterré demande un profil sous le sol. Polygone `man_made=tunnel` (issue #42) : situe seulement un tunnel (passage le plus bas de la voie dans le polygone, `TPOLY`, fondu dans un tunnel qu'il recoupe, `TLIST`), couvert le long de la voie (galerie `roof` par défaut, eau / rocher détectés, `SITE.tunnels:[{poly:'w…'}]`), jamais rempli. Looping dessiné dans OSM : `inversions:[{type:'loop', osm:true, s0, s1, h}]`.

## Hauteurs réglées (`GAME.profile`)

`GAME.profile` = `[[s, h(, 'lin')], …]` (osmrides#53 lot 2, `engine/voies/trace.js`) : hauteur de la voie au-dessus de la gare (m, négative en tunnel enterré) selon l'abscisse `s` du tracé d'origine ; courbe lisse (cubique monotone, tangente nulle aux sommets, sans dépassement) ou segment droit (`'lin'`) jusqu'au point suivant ; périodique. Absent ou invalide : hauteurs d'`OSM.cps` inchangées, rien ne change.

- appliqué au chargement, **avant** pentes, physique et `dropAfter` (déduit du profil effectif) : remplace la hauteur de chaque point de contrôle ; la **gare** (`st0` à `st1`) et les **inversions** (`OSM.inversions`, vrilles et loopings dessinés dans les points de contrôle) gardent leurs hauteurs d'origine (le profil y est ignoré, des points d'ancrage les raccordent)
- la voie s'allonge ou se raccourcit avec la pente : `TAG`, `OSM.tunnels`, `OSM.inversions`, `OSM.elements` et `SITE.tunnels[].s` sont recalés sur la nouvelle abscisse (`PROF`, lu par l'éditeur : abscisses et hauteurs d'origine, `h(s)` effectif, zones figées)
- `faisabilite()` (`montagnes-russes/train.js`) : vitesse la plus basse du haut du lift (`S_REL`) au premier frein de bloc, avec l'accélération de `exploitation.js` sans le plancher `PH.vmin`, usure 30 (ESTIMÉE), sans freins de bloc : `bloque` si elle passe sous `PH.vmin`
- tunnel enterré : la profondeur vient de ce profil (hauteur négative) ; le dessin du tunnel suit la hauteur de la voie
- éditeur : section « Hauteurs du circuit » (`editor/README.md`, bornes : `editor/schema.js`)
- le Chef parcs peut retirer de `tools/specs/<el>.json` les `profile`, `level`, `flat` qu'il aura repris dans `GAME.profile`, sans obligation (l'import les garde comme hauteurs d'origine)

## Voies décoratives

Voies décoratives (issue #33, propriétaire 20/11) : tout tronçon `roller_coaster=track` sans `roller_coaster:track`, non relié au circuit ni à un autre circuit, plus proche de ce circuit que des autres et à moins de 25 m (ESTIMÉ) → `OSM.deco=[{p, id, v}]` (`tools/make_site.py`)

- dessiné comme la voie du site (même `kind`), immobile : aucun train, aucune zone, aucun frein (`engine/render.js` `buildChunks`, hauteur de la gare ESTIMÉE)
- Zeus `1353118255`.

## Rendu de la voie

Rendu : chaîne du lift (taquets qui défilent à la vitesse `CHAINE.v` de la chaîne entraînée, immobiles à l'arrêt : AUTO / MANU, `docs/manoeuvres.md`, issue #60) et équipements de freinage (mâchoires serrées / écartées, roues de propulsion des zones à moteurs, freins de bloc compris) appartiennent à leur tronçon de voie (coaster inversé : dessinés sous la poutre, au niveau du chariot suspendu, issue #32)

- un wagon est dessiné après le plus haut tronçon qu'il couvre (`osmrides_parks/docs/NOUVELLE-ATTRACTION.md` §3).

## Gare droite

Gare droite (issue #43) : voie entre `st0` et `st1` redressée en plan sur sa corde si elle s'en écarte de moins de 0,6 m (ESTIMÉ, `engine/core.js`). Garage : tronçon `OSM.others` qui suit une voie de garage non redessiné (`onYard`), remise au-dessus d'une voie de garage à toit opaque effacé comme celui de la gare (zoom, « Toits », « Masquer la gare » ; `b.yd`, `engine/render.js`).
