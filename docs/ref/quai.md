# Quai, portillons, travées, zones d'attente, gare

Quand la lire : bord de quai, portillons, places d'attente, zone d'attente éditée, toit et emprise de la gare, files couvertes sous la gare. Format `GAME.boardAreas` / `GAME.board` : `editeur.md`.

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Quai

Quai (`engine/garage.js`, `engine/render.js`) : bord du quai **collé au gabarit des wagons** (`PEDGE` = demi-largeur `car.w` + roues, ou rebord `BOB_RIM` d'un bob, + 8 cm ; bob : gouttière étroite au gabarit du wagon en gare, au lift, sur les zones de freinage et les voies de garage, raccord en S de 3 m, `TRF` dans `engine/render.js` ; deux zones étroites à moins de `TRGAP` = 10 m (ESTIMÉ) l'une de l'autre : gouttière étroite continue entre elles ; `plat.edge` pour forcer ; tablier de voie plus large redessiné sous le quai, `drawLip`), portillons à `PGATE` = `PEDGE` + `plat.gateGap` (0,8 m, couloir des opérateurs), places d'attente derrière

- un portillon par wagon ou par rangée (`GUNITS`, `seatUnit`), opérateurs qui vérifient chaque portillon
- sol en béton clair (`PLAT_COL`)
- aucun garde-corps ni longeron de la voie dans la gare, sur les quais ni dans `GAME.boardAreas` (`NORAIL`, `engine/render.js`, issue #23)
- postes et boutons de validation des opérateurs toujours sur le quai (`opHome`, `opPost`, bornés par `plat.back` / `plat.front`)
- opérateurs et visiteurs debout du quai dessinés après la voie, les trains et les portillons (`drawStationPeople`), sous le toit affiché, au-dessus du toit effacé
- visiteurs assis avec leur wagon.

## Gare (arrêt, toit, travées, files couvertes)

Gare : arrêt `S_ST` avancé (jusqu'à `st1`) si l'arrière du train dépasserait du bâtiment `SITE.stationPoly`

- bâtiment agrandi à ses quais (`STATION_GROW`, `engine/garage.js`) s'il ne couvre pas tout le quai (débord latéral ou en bout : le toit couvre tout le quai, lot 6). File couverte, gare affichée : pointillé très discret de son tracé, **sauf** chemin souterrain (`layer` / `level` OSM < 0, `f.lv`) dans l'emprise de la gare : rien du tout (ni pointillé, ni visiteurs) tant que la gare est affichée (`COVD.ug`, issue #19)
- un point de file n'appartient à un chemin couvert ou souterrain que s'il le **longe** (à moins de 0,3 m d'un tronçon à peu près parallèle, `onPl`, `engine/queue.js`) : une allée qui le croise en plan reste dessinée et clôturée
- de même, un visiteur de la file n'est caché comme dans un couloir couvert que si le tronçon de son allée où il se tient est un morceau de ce couloir (deux bouts et milieu à moins de 0,3 m, `inCovQ`, `engine/render.js`, issue #29) : une allée de niveau 0 au-dessus d'un couloir souterrain, même presque parallèle, garde ses visiteurs
- haut d'un escalier couvert qui débouche hors des couloirs (transition -1 → 0) : **fin d'escalier** visible gare affichée (trémie de 1,8 m ESTIMÉE, marches assombries vers le bas, garde-corps, visiteurs dessus ; `MOUTHS`, `drawMouths`, `engine/render.js`). Travées d'attente (`engine/garage.js`) : visiteurs collés au portillon, deux de front si le portillon fait ≥ 1,1 m, premier rang à 0,4 m de la ligne des portillons, rangs à 0,6 m (`SLOT0`, `SLOT_P`, `SITE.plat.slot={first, pitch, res}` pour forcer ; réserve de la zone d'attente au pas `RES_P` = 4 × 0,6 = 2,4 m ESTIMÉ, `slot.res`), profondeur `GDEPTH` (séparateurs), couloir d'attente `BWALK` = `board.walk` ramené à `PGATE + GDEPTH + 0,6` m au plus
- **zone d'attente éditée** (issue #22, `GAME.boardAreas`, ci-dessous) : remplace travées et couloir pour les visiteurs qui attendent
- allée de file visible le long du quai d'embarquement : bord à `GDEPTH + 0,2` m au moins des portillons (`QGATE_CLR`), sinon rétrécie jusqu'à 0,6 m (`QGATE_WMIN`, `gateClear`)
- valeurs ESTIMÉES. Bouton « Masquer la gare » (`#bHideSt`, `act('hidest')`, `G.hideSt`) : bâtiment de gare, toits effaçables, couvertures de tunnels et rochers masqués, couloirs couverts éclairés visibles — **seul moyen** de voir les files couvertes et leurs visiteurs (masquées au zoom et toits retirés).

## Ordre d'arrivée sur le quai (issue #44, 23/11)

Un arrivant de la file ne dépasse jamais ceux qui attendent : jamais de place de portillon devant quelqu'un qui attend derrière elle dans la même colonne de travée (`behind`, `pick`, `engine/sim.js`) ; il prend la place permise la plus en avant du wagon le moins occupé (la travée se remplit de l'avant vers l'arrière), sinon la réserve. Une place libérée est reprise par celui qui attend juste derrière (rang par rang, portillons ouverts ou fermés, avec ou sans `GAME.boardAreas`). Test : `passQ` de `tools/check.js` (arrivants dont la place est devant quelqu'un qu'ils ont dû dépasser), en échec si > 0.

Premier arrivé, premier servi sur tout le quai : tant que quelqu'un attend en réserve (n'importe quelle travée), un arrivant de la file va derrière, jamais à une place de portillon (`rb`, `engine/sim.js`). Mesure `jumpQ` (`tools/check.js`) : arrivants qui obtiennent une place de portillon alors que quelqu'un attend en réserve ou à un rang plus en arrière ; en échec si > 0.

Zone d'attente d'abord (issue #44, retour du 23/11) : avec une réserve (`BRES`, zone éditée ou rangs `board.depth`), un arrivant de la file entre toujours dans la réserve (place libre la plus proche des portillons) et n'avance vers une place de portillon que lorsqu'elle se libère ; il ne va droit à un portillon que si la réserve est pleine. Celui qui avance est le plus ancien de la réserve (`n`, ordre d'arrivée), sauf si quelqu'un de sa colonne est devant lui sur le chemin. Mesure `directQ` (`tools/check.js`) : arrivants qui vont droit à un portillon alors que la réserve a de la place ; en échec si > 0.
