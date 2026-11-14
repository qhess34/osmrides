# La Trace du Hourra — notes de conception (travail en cours)

## Fait (T4, 2026-11-14)

- `sites/hourra.js` écrit : l'attraction est jouable (`jeu.html?site=hourra`), `node tools/check.js hourra` passe (journée complète, manœuvres au pupitre, 0 erreur).
- Circuit fermé de 772 m (3D), 8 tronçons OSM, profil estimé, croisements ≥ 3,3 m, pointe ≈ 53 km/h avec `phys {roll: .13, drag: .0016}`.
- Cantonnement : gare, lift, puis 4 cantons de parcours séparés par 3 freins de bloc `blk1` (s ≈ 288), `blk2` (≈ 474), `blk3` (≈ 633), frein final `brk` (≈ 713). Positions des freins de bloc **estimées** (choisies sur des passages peu pentus, non relevées). Six cantons pour cinq trains : vérifié sans blocage avec 5 trains en piste.
- Chaque frein de bloc se ferme au pupitre (`#bBk1…3`), le frein final avec `#bHold`.
- 6 trains, 5 au plus en piste (`maxRun: 5`, la sortie d'un 6e est refusée) ; 7 bobs de 2 places l'une derrière l'autre ; un bob peut partir avec un seul passager.
- Garage `at: 'brake'`, `device: 'table'` : arrêt au frein final à s ≈ 736 (`holdBack: 35`, début de la ligne droite), chariot juste après, 6 voies d'un train, parallèles au frein final, dans le bâtiment OSM 148160581 (écartement 3 m).
- File : way 1032354546 depuis l'allée (barrière d'entrée cliquable), fourche en (11.5,-9) : raccourci vers l'entrée principale (4.8,-1.7) ou boucle nord par les ways 1032685208/1032685209 jusqu'à la seconde entrée (2.9,-3.3). Sortie : way 1032354545 puis allées vers le sud et l'est.

## Toujours estimé (à faire valider par le propriétaire)

- Fonctionnement réel du pont : le moteur ne porte pas le train sur le chariot ; il met en place un tronçon de transfert en S vers la voie choisie (voir `docs/manoeuvres.md`). Si le vrai chariot emporte le train latéralement, il faudra une capacité moteur.
- Emplacement du chariot sur le frein final, sens et écartement des voies dans le bâtiment, course du chariot (2 m par voie), vitesses de manœuvre (1,8 m/s, 7 s par déplacement du pont).
- Longueur (1,55 m) et largeur des bobs, couleurs des trains (teintes sourdes supposées), poste de conduite, freins de bloc, profil en hauteur.
- Raccords de la boucle de file vers la seconde entrée (quelques points ajoutés entre (0.7,-7.6) et (2.9,-3.3)) et tronçon (11.5,-9) → (5.6,-9.4), absents d'OSM.

## Garage — réponse du propriétaire (2026-11-14)

- **6 trains**, au plus **5 sur le parcours** : il y a toujours au moins un train au garage.
- **6 voies de garage**, un train par voie.
- Pont transbordeur : la portion du circuit adjacente au garage se dégage en glissant dans la direction opposée au garage ; une voie spéciale, portée par le même chariot, prend sa place et raccorde le parcours, puis translate jusqu'à chacune des 6 voies de garage.
- Interprétation retenue pour le moteur (à faire valider à l'écran) : chariot à 7 positions (`P` = circuit, `1…6` = voies) portant deux tronçons, celui du circuit et la voie de transfert, comme le tronçon en S de Zeus mais avec N voies. Modèle commun : `docs/manoeuvres.md` (`device: 'table'`).
- Toujours supposé : emplacement exact du chariot sur le circuit (gare ou frein final) et orientation des voies dans le bâtiment OSM 148160581.

## Demande initiale du propriétaire (historique)

- **Le garage a plusieurs voies (6, voir ci-dessus).** Le moteur ne gère qu'une voie de garage (trains rangés en file). Il faut un pont transbordeur desservant 5 voies parallèles, une par train, avec choix de la voie au pupitre.
  Le bâtiment candidat dans OSM est le way 148160581, à l'ouest du frein final : sommets (-47.1,-13.1) (-40.2,6.9) (-32.6,4.2) (-34,0.1) (-22,-4) (-27.5,-20.1) (-39.5,-15.9). Demander au propriétaire où se trouve le pont et dans quel sens sont les voies avant d'inventer.

## Caractéristiques relevées

- Propriétaire (2026-11-14) : 1 ou 2 visiteurs par wagon, assis l'un derrière l'autre (`car {seats: 2, inline: true}`), un wagon peut partir avec un seul passager.

- Bobsleigh Mack Rides, ouvert le 31 mars 2001, 900 m, 31 m de haut, 60 km/h.
- Trains : 7 wagons ; 14 passagers par train selon RCDB (2 par wagon, l'un derrière l'autre), 7 selon Coasterpedia. 5 ou 6 trains selon les sources. Couleurs des bobs non vérifiées.

## Repères (origine lat 49.13554, lon 2.56816 ; x est, z sud)

- Gare couverte : de (-7.57,-4.45) à (5.57,6.95), cap sud-est, 17,4 m. Puis lift rectiligne de (18.8,4) à (59.2,-82), sommet à s ≈ 129.
- Bâtiment de gare : way 148160006 (`OSM.polys.station`). Entrées côté nord-est (gauche du sens de marche) : (4.8,-1.7) principale, (2.9,-3.3). Sortie côté sud-ouest : (-0.6,7.0).
- File : way 1032354546 (`OSM.paths.queue`, 174 m, de (54.9,14.7) à (4.8,-1.7)). Deux ways voisins près de la gare : 1032685209 (`queueB`) et la boucle 1032685208 (`queueLoop`, 46 m) entre (0.6,-10.9) et (3.3,-11.3) : candidate pour une fourche avec barrière pivotante.
- Sortie : way 1032354545 (`OSM.paths.exit`), de (-0.6,7.0) à (25.8,38.3).
- Allée d'accès : way 1220633159 (`OSM.paths.prom`), passe à (61.1,16.8), à 6 m du début de la file.
- Ces quatre chemins sont retirés du décor par `make_site.py` : les redonner au moteur via `SITE.paths`.

## Configuration envisagée avant T4 (historique)

- `car {len: 1.55, n: 7, inline: true, w: .95}`, 6 trains (5 au plus en circulation) (un canton de plus qu'il n'y a de trains : gare, lift, 2 cantons de parcours).
- `stopBack: .5`, `holdBack: 27` (arrêt au frein final à s ≈ 752, avant la dernière courbe), `dropAfter: 12`.
- Fourche de file en F = (5.6,-9.4) : raccourci F → (5.9,-6.5) → (4.9,-5) → (3.6,-3.6) ; boucle par `queueLoop` puis (0.2,-10.3) (0.9,-8.1) (0.7,-7.6) (1.6,-6.4) (2.6,-4.9) → (3.6,-3.6). Barrière : pivot (4.55,-8.84), raccourci fermé (6.74,-9.07), boucle fermée (5.95,-10.54).
- Barrière d'entrée sur le raccord allée → file : pivot (58.35,14.71), fermée (57.65,16.79), ouverte (56.27,14.0) ; point d'attente extérieur (59.2,16.15).
- Poste de conduite près de l'avant du train, côté quai : ≈ (8.3,4.1), angle 0,715 rad.
- Vue : centre (43,-28), 190 × 150 m.

Toutes ces coordonnées sont calculées sur plan, pas vérifiées à l'écran.
