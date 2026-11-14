# La Trace du Hourra — notes de conception (travail en cours)

## Fait

- `tools/specs/hourra.json` + `sites/hourra.data.js` : circuit fermé de 779 m au sol (8 tronçons OSM), profil estimé, tous les croisements ≥ 3,3 m d'écart, pointe ≈ 53 km/h avec `phys {roll: .13, drag: .0016}`.
- Le moteur sait déjà : piste en gouttière (`kind: 'bob'`), passagers l'un derrière l'autre (`car.inline`), quai côté gauche (`loadSide: -1`), freins de bloc (`blk1` à s ≈ 478), garage branché sur le frein final (`garage.at: 'brake'`), plusieurs trains au garage en file.
- Rien de cela n'a encore tourné sur la Trace du Hourra : **`sites/hourra.js` n'existe pas**.

## Demande du propriétaire non traitée

- **Le garage a 5 voies.** Le moteur ne gère qu'une voie de garage (trains rangés en file). Il faut un pont transbordeur desservant 5 voies parallèles, une par train, avec choix de la voie au pupitre.
  Le bâtiment candidat dans OSM est le way 148160581, à l'ouest du frein final : sommets (-47.1,-13.1) (-40.2,6.9) (-32.6,4.2) (-34,0.1) (-22,-4) (-27.5,-20.1) (-39.5,-15.9). Demander au propriétaire où se trouve le pont et dans quel sens sont les voies avant d'inventer.

## Caractéristiques relevées

- Bobsleigh Mack Rides, ouvert le 31 mars 2001, 900 m, 31 m de haut, 60 km/h.
- Trains : 7 wagons ; 14 passagers par train selon RCDB (2 par wagon, l'un derrière l'autre), 7 selon Coasterpedia. 5 ou 6 trains selon les sources. Couleurs des bobs non vérifiées.

## Repères (origine lat 49.13554, lon 2.56816 ; x est, z sud)

- Gare couverte : de (-7.57,-4.45) à (5.57,6.95), cap sud-est, 17,4 m. Puis lift rectiligne de (18.8,4) à (59.2,-82), sommet à s ≈ 129.
- Bâtiment de gare : way 148160006 (`OSM.polys.station`). Entrées côté nord-est (gauche du sens de marche) : (4.8,-1.7) principale, (2.9,-3.3). Sortie côté sud-ouest : (-0.6,7.0).
- File : way 1032354546 (`OSM.paths.queue`, 174 m, de (54.9,14.7) à (4.8,-1.7)). Deux ways voisins près de la gare : 1032685209 (`queueB`) et la boucle 1032685208 (`queueLoop`, 46 m) entre (0.6,-10.9) et (3.3,-11.3) : candidate pour une fourche avec barrière pivotante.
- Sortie : way 1032354545 (`OSM.paths.exit`), de (-0.6,7.0) à (25.8,38.3).
- Allée d'accès : way 1220633159 (`OSM.paths.prom`), passe à (61.1,16.8), à 6 m du début de la file.
- Ces quatre chemins sont retirés du décor par `make_site.py` : les redonner au moteur via `SITE.paths`.

## Configuration envisagée pour `sites/hourra.js`

- `car {len: 1.55, n: 7, inline: true, w: .95}`, 3 trains pour commencer (un canton de plus qu'il n'y a de trains : gare, lift, 2 cantons de parcours).
- `stopBack: .5`, `holdBack: 27` (arrêt au frein final à s ≈ 752, avant la dernière courbe), `dropAfter: 12`.
- Fourche de file en F = (5.6,-9.4) : raccourci F → (5.9,-6.5) → (4.9,-5) → (3.6,-3.6) ; boucle par `queueLoop` puis (0.2,-10.3) (0.9,-8.1) (0.7,-7.6) (1.6,-6.4) (2.6,-4.9) → (3.6,-3.6). Barrière : pivot (4.55,-8.84), raccourci fermé (6.74,-9.07), boucle fermée (5.95,-10.54).
- Barrière d'entrée sur le raccord allée → file : pivot (58.35,14.71), fermée (57.65,16.79), ouverte (56.27,14.0) ; point d'attente extérieur (59.2,16.15).
- Poste de conduite près de l'avant du train, côté quai : ≈ (8.3,4.1), angle 0,715 rad.
- Vue : centre (43,-28), 190 × 150 m.

Toutes ces coordonnées sont calculées sur plan, pas vérifiées à l'écran.
