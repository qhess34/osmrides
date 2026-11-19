# Guide OpenStreetMap pour OSMrides

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
| Niveau souterrain | `layer=-1`, `-2`… (ou `level` négatif) sur le chemin ou l'escalier | Lu | Sous la gare : rien n'est montré (ni tracé, ni visiteurs) tant que la gare est affichée. L'escalier couvert dont le **haut** (`incline=up` dans le sens du way) débouche sur un chemin non couvert (niveau 0) garde sa **fin d'escalier** visible. Mettre `incline` sur l'escalier qui remonte au niveau 0. |
| Barrière | nœud `barrier=swing_gate` (ou `gate`, `lift_gate`…) (+ `swing_gate:hinge=left/right`, `ref=*`) | Lu | Barrières de file du jeu (règle du §5) : le nœud donne la **position** ; le jeu la pose **en travers du chemin**, de la **largeur du chemin** (`width=*`), poteau côté `hinge`. Elle remplace toute barrière posée par le jeu. Position initiale seulement : une barrière corrigée dans l'éditeur (`GAME.barriers`, lot 1) l'emporte. |
| Garde-corps | `barrier=fence` ou `barrier=handrail` | Lu comme décor | Dessinés comme décor ; pas encore utilisés pour délimiter la file (le jeu pose ses propres barrières). |

## 4. Décor

| Objet | Tags | Statut | Ce que le jeu en fait |
|---|---|---|---|
| Zone piétonne | `highway=pedestrian` + `area=yes`, `area:highway=*`, `place=square` | Lu | Surface praticable partout ; elle prime sur les chemins qu'elle contient. |
| Eau | `natural=water`, `water=*`, `waterway=*` | Lu | Bassins, lacs, tunnel sous l'eau. |
| Forêt, pelouse | `landuse=forest`, `natural=wood`, `landuse=grass`, `leisure=park` | Lu | Textures du sol. |
| Arbres | nœud `natural=tree` | Lu | Arbres isolés. |
| Rochers | `natural=rock` / `stone` / `bare_rock` (way fermé ou relation multipolygone, trous compris) | Lu | Massif en relief (`bare_rock` compris depuis le 19/11 : `make_site.py` l'écrit `natural=rock`), tunnels de voie et de file dessous. Un rocher en relation est assemblé à partir de ses tronçons. |
| Bâtiments | `building=*` | Lu | Toits, avec `name` affiché. |
| Hauteur des bâtiments | `height=*`, sinon `building:levels=*` (× 3 m) | Lu | Longueur de l'ombre ; un bâtiment que la voie survole plus haut que lui est dessiné sous la voie (sans hauteur : 7 m estimé). |

## 5. Barrières de file : comment les dessiner

**Règle commune à toutes les files** (décision du propriétaire, 17/11, issue #12 ; `engine/queue.js`). OSM donne la **position** d'une barrière, pas son orientation ni sa longueur ; le jeu complète ainsi :

| Ce qui est dessiné | D'où cela vient |
|---|---|
| Position | Le nœud `barrier=*` (`swing_gate`, `gate`, `lift_gate`) **posé sur le chemin de file** (nœud du way, pas à côté). |
| Orientation | **Perpendiculaire au chemin** au droit du nœud. |
| Longueur | **Largeur du chemin**, d'une bordure à l'autre : `width=*` du chemin si présent, sinon largeur par défaut du chemin dessiné (**ESTIMÉE**). |
| Poteau | Côté `swing_gate:hinge=left` / `right` (vu dans le sens de dessin du chemin) ; sans `hinge`, à droite du sens de la file. Ouverte, la barrière se rabat le long de sa bordure. |
| Barrière posée à la main par une attraction | **Aucune** quand OSM en donne une. |
| Fourche (issue #17, croquis `docs/sources/goudurix-barrieres-fourche-2026-11-17.png`) | **Une seule barrière par pointe** (là où le raccourci quitte la boucle, et là où il la rejoint ; les deux d'une même boucle basculent ensemble). Le nœud OSM, au milieu du chemin, donne seulement **l'emplacement de la fourche** ; le **poteau-pivot** est sur la **bordure**, à la **pointe de l'angle intérieur** entre les deux chemins (coin où leurs bordures se rejoignent). Position A (boucle en service) : en travers du **raccourci**, de ce coin à la bordure opposée, perpendiculaire au raccourci ; position B : pivotée autour du même coin, en travers de la **boucle**. Longueur = largeur du chemin barré dans chaque position (peut différer entre A et B). Clic sur la carte = bascule A ↔ B, animée. Pointe sans nœud OSM : même barrière, posée par le jeu (**ESTIMÉE**). Raccourci si court (1 à 2 m) que les vantaux des deux pointes se croiseraient : chaque pivot est ramené près de sa pointe (deux barrières distinctes). |

Les visiteurs ne franchissent que les barrières ouvertes (sauf évacuation) ; chaque barrière se clique sur la carte. Les barrières d'une même boucle bougent ensemble.

| Cas | Comment le dessiner dans OSM |
|---|---|
| Barrière d'entrée de la file | Nœud `barrier=swing_gate` sur le chemin de file, dans ses 15 premiers mètres (`ref` libre, ex. « Entrée Goudurix ») : la file commence au nœud. |
| Barrière qui ferme un chemin de file (boucle ou raccourci) | Nœud `barrier=swing_gate` sur ce chemin, à l'endroit de la fermeture. |
| Barrière de fourche (cas normal) | Un nœud `barrier=swing_gate` **sur le point commun aux deux chemins**, à chaque pointe (départ et retour du raccourci), même `ref=` pour les deux pointes d'une boucle. Le jeu reconnaît un nœud à moins de 3 m d'une pointe ; il en déduit le coin de bordure (pivot) et les deux positions. Pas de `hinge` à donner. |
| Barrière au milieu d'une boucle ou d'un raccourci | Nœud sur ce chemin à plus de 3 m des pointes : barrière simple en travers de ce chemin, liée à la fourche (cas rare). |
| Largeur exacte | `width=*` sur le way du chemin de file (sinon largeur estimée). |
| Côté du poteau | `swing_gate:hinge=left` ou `right`, vu dans le sens de dessin du chemin. |
| Barrières liées | Même `ref=` (ex. `ref=B1`). |

## 6. Avant d'importer une nouvelle attraction

1. Tous les tronçons de voie sont dessinés et forment une boucle fermée ; chaque tronçon a son `roller_coaster:track`.
2. Gare, lift, zones de freinage, tunnels et galeries sont tagués.
3. Le bâtiment de gare couvre tout le quai ; les entrées et sorties sont des nœuds `entrance=*`.
4. La file est dessinée en entier, de l'entrée à la gare, avec ses escaliers, passerelles, couloirs couverts et largeurs (`width=*`).
5. Les barrières de file sont des nœuds `barrier=swing_gate` (§5).
6. Le décor autour (eau, forêt, zones piétonnes, rochers) est à jour.
7. Si tu connais des hauteurs (lift, figures, rocher, passerelle), ajoute `height=*`.

Ce qui reste estimé après import est signalé dans `docs/<attraction>-notes.md` et dans `docs/plans/QUESTIONS.md`.

## 7. Traçabilité à l'import et catégories lues (lot 2)

Chaque objet importé garde son origine : **id OSM** préfixé (`w123` tronçon, `n456` nœud, `r789` relation) et **version** dans l'extrait (entier). C'est la base du réimport sélectif (lot 7) et des corrections locales (lot 4). Le moteur ignore ces champs (aucun conflit : vérifié par grep dans `engine/` et `editor/`).

| Donnée de `OSM.*` | Où est l'origine |
|---|---|
| `feats[]`, `stairs[]` (objets) | champs `id` et `v` ; un multipolygone assemblé (rocher, zone piétonne) porte l'id de la **relation** (`r…`), son anneau n'est pas rattaché à un tronçon |
| `doors[]`, `barriers[]`, `pois[]`, `widths[]` (tableaux positionnels) | **fin de tableau**, indices existants inchangés : `doors` `[x,z,type,nom, id, v]`, `barriers` `[x,z,ref,hinge,tx,tz,bout, id, v]`, `pois` `[[x,z],nom, id, v]`, `widths` `[w,pts, id, v]` |
| `others[]`, `trees[]`, `paths{}`, `polys{}`, voie `cps` (listes de points ou dictionnaires parcourus par le moteur) | **`OSM.src`** : `track` = tronçons du circuit dans l'ordre de marche `[[id, v]…]` ; `others` et `trees` = même ordre que `OSM.others` / `OSM.trees` ; `paths` = `{nom: [[id, v]…]}` (tronçons mis bout à bout) ; `polys` = `{nom: [[id, v]]}` |

Une version `null` (ou un objet sans `id`) veut dire « origine connue, version d'import inconnue » : donnée reprise d'un import plus ancien dont l'objet OSM a été modifié depuis. Un réimport complet les remplace.

### Catégories lues par `tools/make_site.py` (tirées du code)

| Catégorie | Objets OSM | Tags lus | Sortie |
|---|---|---|---|
| Voie et tronçons | tronçons listés dans la spec (`track_ways`) | `roller_coaster:track` = `station`, `lift_hill`, `brake_run`, `waiting`, `block_brake`, `storage`, `transfer` (autre = parcours) ; `tunnel` (`yes`, `true`, `1`, `building_passage`, `culvert`), `covered=yes` avec `layer<0`, `layer>0` (galerie couverte `'roof'`) ; la hauteur, le profil, les dévers sont ESTIMÉS (spec) | `cps`, `tunnels`, `inversions`, `src.track` |
| Autres voies voisines | tronçons `roller_coaster=*` hors circuit, hors `drop_ways`/`paths` | `roller_coaster` | `others`, `src.others` |
| Gare, file, sortie, garage | tronçons et polygones nommés par la spec (`paths`, `polys`) | géométrie seule (+ `highway`, `layer`, `covered`, `bridge` si le chemin reste aussi dans le décor) | `paths`, `polys`, `src.paths`, `src.polys` |
| Bâtiments et abris | ways / multipolygones fermés | `building` (dont `roof`), `height`, `building:levels` (×3 m), `name` | `feats` (`k=building=…`, `bh`) |
| Chemins | `highway=*` non fermés | `highway`, `name`, `layer`, `level` (souterrain `lv`), `tunnel`, `covered`, `indoor` (couvert `cv`), `bridge` + `layer` (passerelle `br`), `width` | `feats` (`cv`, `lv`, `br`, `w`, `in` : fondu dans une zone piétonne), `widths` |
| Zones piétonnes | `highway=pedestrian`+`area=yes`, `area:highway=*`, `place=square`, multipolygones `highway=pedestrian` (anneaux `inner` en trous) | idem | `feats` (`k=highway=pedestrian`, fermé, `h`) |
| Escaliers | `highway=steps` | `incline` (up / down / pente), `width` (sinon chemin raccordé), `layer`, `level`, `covered`, `tunnel`, `indoor` | `stairs` |
| Entrées / sorties | nœuds | `entrance=*`, `name` | `doors` |
| Barrières de file | nœuds posés sur un chemin | `barrier` = `swing_gate`, `gate`, `lift_gate` ; `ref`, `swing_gate:hinge` ; direction du chemin au nœud | `barriers` |
| Eau | ways / multipolygones | `natural=water`, `water`, `waterway` | `feats` |
| Végétation | ways / multipolygones ; nœuds | `landuse` (forêt, herbe…), `natural` (bois…), `leisure` ; nœuds `natural=tree` | `feats`, `trees`, `src.trees` |
| Rochers | ways / multipolygones (anneaux assemblés) | `natural=rock`, `natural=stone` ; `natural=bare_rock` EST un rocher (décision du propriétaire 19/11 ; `make_site.py` l'écrit `natural=rock`) | `feats` |
| Autres éléments de décor | ways / multipolygones | première clé présente parmi `building highway natural landuse leisure water waterway barrier amenity tourism man_made railway` (`landuse=commercial` ignoré) | `feats` |
| Lieux nommés | nœuds | `name` | `pois` |

Hors de ces listes, un tag n'est pas lu. Toute évolution de `make_site.py` qui lit un nouveau tag met à jour ce tableau.

### Réimport et dérive

`make_site.py` régénère tout le fichier `sites/<site>.data.js` ; il n'y a pas encore de réimport sélectif (lot 7). Avant d'accepter un réimport : comparer à l'ancien fichier (ids et versions), signaler au propriétaire tout objet dont la géométrie ou le tag a changé (exemple 19/11/2026 : rocher d'Hourra retagué `natural=bare_rock`, voie de Goudurix retouchée de 0,5 m au plus le 18/11).
