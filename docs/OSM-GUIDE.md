# Guide OpenStreetMap pour T2Z

À quoi sert ce guide : préparer OpenStreetMap (OSM) **avant** d'importer une attraction, pour que le jeu lise les données au lieu de les estimer.
Il dit quels objets et quels tags le jeu lit déjà, et lesquels il pourrait lire si on les ajoutait.

- **Lu** : déjà utilisé par `tools/make_site.py`, `tools/make_park.py` ou le moteur.
- **Prévu** : pas encore lu, mais le jeu le lira dès qu'il apparaît (à brancher au besoin).
- **Utile** : pas lu aujourd'hui, mais il remplacerait une estimation.

Règle générale : n'ajoute dans OSM que ce qui est vrai sur le terrain. N'invente pas de tag propre au jeu ; les tags de ce guide sont tous des tags OSM existants.
Après une session d'édition, il suffit de dire « OSM mis à jour » : le jeu retrouve tes changements du jour par l'historique des changesets (`docs/NOUVELLE-ATTRACTION.md` §4).

## 1. Voie du circuit

| Objet | Tags | Statut | Ce que le jeu en fait |
|---|---|---|---|
| Tronçons de voie | `roller_coaster=track` | Lu | Tracé du circuit, assemblé en boucle fermée. |
| Type de tronçon | `roller_coaster:track=station` | Lu | Gare (repères début et fin de quai). |
| | `roller_coaster:track=lift_hill` | Lu | Lift (début et fin de la chaîne). |
| | `roller_coaster:track=brake_run` / `block_brake` / `waiting` / `storage` / `transfer` | Lu | Zones de freinage : frein de bloc, frein final, frein avant gare, rail du pont transbordeur. |
| Tunnel | `tunnel=yes` (ou `covered=yes` + `layer` négatif) | Lu | Voie cachée sous une couverture : eau si un plan d'eau la recouvre, sinon remblai. |
| Galerie au-dessus du sol | `tunnel=yes` + `layer` positif | Lu | Voie sous un toit de béton. |
| Niveau | `layer=*` | Lu | Ordre des croisements (quelle voie passe dessus). |
| Looping, vrilles | voie dessinée dans OSM | Lu en partie | Un looping dessiné dans OSM est lu tel quel ; ses hauteurs et le type de figure viennent de la spec. |
| Pont transbordeur | `railway=traverser` | Lu via la spec | Position du chariot (l'identifiant du tronçon est repris dans `tools/specs/<site>.json`). |
| Aiguillage | nœud `railway=switch` | Lu via la spec | Pointe de l'aiguillage. |
| Voies de maintenance ou de garage | `roller_coaster=track` (hors circuit) | Lu via la spec | Voies du garage ; un `name` ou `service=*` aiderait à les reconnaître automatiquement. |
| Hauteur | `height=*` sur un tronçon ou un pylône | Utile | Aujourd'hui toutes les hauteurs sont estimées : une hauteur relevée remplacerait l'estimation. |
| Nom des figures | `name=*` sur un tronçon (ex. « Dive loop ») | Utile | Étiquette et caméra de la figure sans estimation de position. |

## 2. Gare, quais et postes

| Objet | Tags | Statut | Ce que le jeu en fait |
|---|---|---|---|
| Bâtiment de gare | `building=*` qui recouvre la voie de gare | Lu | Toit de la gare. Il doit couvrir **tout** le quai, sinon le jeu l'agrandit (estimé). |
| Quais | `railway=platform` ou `public_transport=platform` | Utile | Bord exact des quais, côté embarquement et côté sortie. |
| Entrées et sorties | nœud `entrance=*` sur le bâtiment ou le chemin | Lu | Portes d'entrée de la file et de sortie. |
| Poste de conduite | `building=*` ou nœud `man_made=*` + `name=Poste de conduite` | Utile | Position du pupitre sans estimation. |

## 3. File d'attente et chemins

| Objet | Tags | Statut | Ce que le jeu en fait |
|---|---|---|---|
| Chemins de file | `highway=footway` (+ `footway=*` ou un `name`) | Lu | Tracé de la file. La spec dit quels tronçons forment la file. |
| Largeur | `width=*` en mètres | Lu | Largeur exacte du chemin dessiné. Sans ce tag : 1 m pour la file, 2 m pour un escalier de sortie. |
| Escaliers | `highway=steps` (+ `incline=up/down`, `width=*`) | Lu | Marches, garde-corps, visiteurs ralentis ; largeur du chemin qu'ils prolongent. **`incline` (avec le sens du way) place le palier en HAUT de l'escalier** ; sans lui, le haut est deviné (côté gare / porte, puis passerelle), sinon pas de palier. |
| Passerelle | `bridge=yes` + `layer=*` | Lu | Chemin dessiné par-dessus la voie, visiteurs dessus. |
| Chemin couvert, souterrain | `tunnel=yes`, `covered=yes`, `indoor=yes` ou `layer` négatif | Lu | Couloir caché, visible avec « Masquer la gare ». |
| Barrière | nœud `barrier=swing_gate` (+ `swing_gate:hinge=left/right`, `ref=*`) | Prévu | Position exacte des barrières de file (voir §5). |
| Garde-corps | `barrier=fence` ou `barrier=handrail` | Lu comme décor | Dessinés comme décor ; pas encore utilisés pour délimiter la file (le jeu pose ses propres barrières). |

## 4. Décor

| Objet | Tags | Statut | Ce que le jeu en fait |
|---|---|---|---|
| Zone piétonne | `highway=pedestrian` + `area=yes`, `area:highway=*`, `place=square` | Lu | Surface praticable partout ; elle prime sur les chemins qu'elle contient. |
| Eau | `natural=water`, `water=*`, `waterway=*` | Lu | Bassins, lacs, tunnel sous l'eau. |
| Forêt, pelouse | `landuse=forest`, `natural=wood`, `landuse=grass`, `leisure=park` | Lu | Textures du sol. |
| Arbres | nœud `natural=tree` | Lu | Arbres isolés. |
| Rochers | `natural=rock` / `stone` | Lu | Massif en relief, tunnels de voie et de file dessous. |
| Bâtiments | `building=*` | Lu | Toits, avec `name` affiché. |
| Hauteur des bâtiments | `height=*`, `building:levels=*` | Utile | Ombres et ordre de dessin plus justes. |

## 5. Barrières de file : comment les dessiner

| Cas | Comment le dessiner dans OSM |
|---|---|
| Barrière simple qui ferme un chemin | Nœud `barrier=swing_gate` sur le chemin, à l'endroit de la fermeture. |
| Barrière basculante (ferme un chemin ou l'autre) | Nœud `barrier=swing_gate` sur le point de bifurcation : le pivot est sur la pointe. |
| Deux barrières parallèles qui bougent ensemble (boucle et raccourci) | Un nœud `barrier=swing_gate` sur chaque chemin, avec la même `ref=` (ex. `ref=B1`). |
| Côté du pivot | `swing_gate:hinge=left` ou `right`, vu dans le sens de dessin du chemin. |
| Entrée et sortie d'un même chemin fermable | Deux nœuds avec la même `ref=` : ils bougent ensemble. |

## 6. Avant d'importer une nouvelle attraction

1. Tous les tronçons de voie sont dessinés et forment une boucle fermée ; chaque tronçon a son `roller_coaster:track`.
2. Gare, lift, zones de freinage, tunnels et galeries sont tagués.
3. Le bâtiment de gare couvre tout le quai ; les entrées et sorties sont des nœuds `entrance=*`.
4. La file est dessinée en entier, de l'entrée à la gare, avec ses escaliers, passerelles, couloirs couverts et largeurs (`width=*`).
5. Les barrières de file sont des nœuds `barrier=swing_gate` (§5).
6. Le décor autour (eau, forêt, zones piétonnes, rochers) est à jour.
7. Si tu connais des hauteurs (lift, figures, rocher, passerelle), ajoute `height=*`.

Ce qui reste estimé après import est signalé dans `docs/<attraction>-notes.md` et dans `docs/plans/QUESTIONS.md`.
