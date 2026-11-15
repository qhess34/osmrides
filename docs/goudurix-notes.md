# Goudurix — notes

Montagnes russes en acier Vekoma (modèle MK-1200, rails tubulaires), Parc Astérix, ouvertes en 1989. Configuration : `sites/goudurix.js` ; spec : `tools/specs/goudurix.json` ; données : `sites/goudurix.data.js` (généré). Photo aérienne du propriétaire : `docs/sources/goudurix-vue-aerienne.jpg` (voie tubulaire jaune, supports rouges, tracé au-dessus d'un plan d'eau).

## Caractéristiques (sources)

| Donnée | Valeur | Source |
|---|---|---|
| Longueur | ≈ 950 m (3 117 ft) | Wikipédia, RCDB, coaster.cloud, thrillzing |
| Hauteur / chute | 36 m / 32,9 m | Wikipédia |
| Vitesse | 90 km/h (56 mph) | Wikipédia, RCDB |
| Inversions | 7 : looping vertical (1), batwing (2), papillon / butterfly (2), double vrille (2) | Wikipédia, RCDB |
| Durée | 1 min 20 | Wikipédia |
| Trains | **2** trains **rouges** de 7 wagons, 28 places (4 par wagon, 2 rangées de 2) | RCDB, Wikipédia ; rouges et 2 trains : propriétaire (2026-11-15) |
| Rénovations | nouveaux trains (caisses et retenues, châssis conservés) pour la saison 2025 ; re-tracking complet | recherche web |

Contradictions : une base (GPTKB) donne 1 150 m de long, écartée (toutes les autres : 950 m). La vitesse de 75 km/h parfois citée n'apparaît dans aucun résultat (90 km/h partout). Le tracé OSM fait 797 m **au sol** ; avec le profil estimé on obtient 809 m en 3D, contre 950 m annoncés : OSM simplifie les inversions (le tracé 2D d'un looping est quasi une ligne), l'écart est normal.
Accès : rcdb.com, wikipedia.org et Coasterpedia n'ont pas été lus directement (WebFetch non disponible dans cette session) ; les chiffres viennent des extraits de recherche web (RCDB 753 cité par Wikipédia). À revérifier sur rcdb.com/753.htm.

Sources : https://en.wikipedia.org/wiki/Goudurix · https://rcdb.com/753.htm · https://coaster.cloud/en/attractions/b9bff96f-goudurix · https://thrillzing.com/roller-coasters/goudurix-parc-asterix/ · https://www.pa-community.com/parques/parc-asterix/atracciones/goudurix

## Repères OSM (extrait du parc, origine [49,13204 ; 2,57090] = centre de la gare)

- **Sens de marche (corrigé par le propriétaire, 2026-11-15 : « le lift est la montée après la gare »)** : la gare est parcourue vers le sud, dans le sens de son tracé OSM ; le lift est la ligne droite nord-sud qui suit (OSM `brake_run` 937067646 + début de 541092982, s ≈ 44 → 136 m) ; le retour se fait par la diagonale ouest (OSM `lift_hill` 541092979, ici zone de freinage) et la courbe nord (OSM `launch_straight` 541092977) : **les étiquettes OSM `lift_hill` / `launch_straight` / `brake_run` sont donc inversées par rapport au sens de marche**. Première version (sens inverse) abandonnée.
- Circuit (797 m au sol), dans le sens de marche : gare 937067647 (19 m, vers le sud) → 937067646 → 541092982 (lift) → 541092983 → 541092984 → 1181620309 → 1181620310 → 541092985 → 1181620311 → 541092986 → 1181620312 → 541092987 → 541092988 → 541092989 → 541092991 → 541092990 → 541092992 → 541092993 → 541092979 (diagonale ouest, frein final) → 541092977 (courbe nord) ; ancien ordre, à lire à l'envers : 541092993 → 541092992 → 541092990 → 541092991 → 541092989 → 541092988 → 541092987 → 1181620312 → 541092986 → 1181620311 → 541092985 → 1181620310 → 1181620309 → 541092984 → 541092983 → 541092982 → frein final 937067646 (42 m, entre dans la gare par le sud). Tous `layer` 1 ou 2.
- Gare : bâtiment 148159470 (6,8 m × 19 m, ne couvre que la voie).
- Garage : voie de maintenance 1221386549 (`roller_coaster:track=maintenance`, 45 m, butoir au sud en (−16,7 ; 39,8), nœud `railway=switch` en (−15,2 ; −4,5)) : elle se raccorde au **retour**, à ≈ 30 m avant la gare (fin de la diagonale ouest, début de la courbe nord).
- File : OSM ne cartographie aucune file. On prend le chemin 1102233771 (« Gouduriiiix Promenade », 80 m, de l'entrée sud (23,8 ; 87,7) au côté est de la gare) ; arrivée par les chemins 132709980 / 132709988 depuis le nord-ouest ; liaison 161214274.
- Plan d'eau : multipolygone 7273043 (le lac sous le tracé ; la place piétonne en a un trou, d'où la gestion des anneaux intérieurs dans `tools/make_site.py`).

## Ce qui est estimé

- **Profil en hauteur** : lift 36 m (s 44 → 136), chute 32,9 m, bosses d'inversion à s ≈ 236, 310, 360, 500, 545 ; vitesse maxi calculée 23,8 m/s (85 km/h) ; croisements ≥ 3,6 m. L'ordre et la place des sept inversions ne sont PAS connus : la photo montre deux figures en « ∞ » dans le lac (supposées batwing et papillon) et des enchaînements au sud (looping, double vrille) dont on ne sait pas l'ordre.
- Pas de frein de bloc : **un seul train entre l'après-lift et le frein final** (propriétaire, 2026-11-15) ; le lift s'arrête (train retenu au sommet) tant qu'un train occupe cette zone (`SITE.singleCourse`). Frein de bloc B1 supposé précédemment : supprimé.
- Frein final : la diagonale ouest (s ≈ 680 → 773) ; le train s'arrête, tête à l'aiguillage du garage, ≈ 28 m avant la gare (`holdBack`).
- Quais (7 m à l'est, 3,5 m à l'ouest), poste de conduite, porte et chemin de sortie, file (chemin choisi), barrière d'entrée.
- Garage : aiguillage branché au frein final (`yard.at:'brake'`), à l'emplacement du nœud OSM `railway=switch`. La voie repart vers le sud à contre-sens du retour : le train y entre par un virage serré (sens d'entrée inconnu). Course de l'aiguillage, vitesses de manœuvre.
- Longueur (2,55 m) et largeur (1,5 m) d'un wagon ; couleurs des trains (rouge sourd et or, non vérifiées) ; couleurs de la voie (jaune) et des supports (rouge rouille) d'après la photo, assourdies.
- Moteurs par zone : défauts du moteur (gare, frein final, voie = freins + pneus ; bloc = freins seuls), à confirmer.

## Réponses du propriétaire (2026-11-15)

- **Sens de marche** : le lift est la montée juste après la gare (voir plus haut).
- **Cuvette** : « une petite cuvette juste avant le lift » : le profil descend de 3 m (gare) à ≈ 0,9 m entre s ≈ 22 et 43 m, le lift remonte de là (hauteur de la cuvette estimée).
- **Trains** : 2 trains rouges (teinte et liseré gris sombre estimés).
- **Garage** : « les trains vont au garage en marche arrière de la gare si l'aiguillage est orienté vers la voie ; l'aiguillage est un rail qui tourne sur lui-même avec pour axe le tube de rail ». Fait : `yard.back` (le train recule de la gare, remonte le circuit sur 44 m puis entre dans la voie de maintenance OSM, nœud `railway=switch` comme pointe) et `yard.rotary` (aiguillage rotatif : vu du dessus, le tronçon se resserre en largeur ∝ cos θ puis s'ouvre sur l'autre branche ; carter du tambour dessiné autour). Estimés : longueur de l'appareil (5,6 m), durée de rotation (4 s).
- **Portillons à l'ouest de la gare** : embarquement à l'ouest, débarquement à l'est. La file (promenade OSM de l'entrée sud jusqu'à (−28 ; −2) puis raccord estimé vers le quai ouest, 150 m environ) passe sous le retour (diagonale ouest) ; sortie par l'est (allée 161214274 et pont de bois 161214279) ; arrivée des visiteurs par le pont de bois et le chemin 1102233771.
- **Un seul train sur le parcours** (après-lift → frein final) : le lift retient le train au sommet si la zone suivante est occupée. Devenu la règle par défaut du moteur pour toutes les attractions (décision du propriétaire) : un seul train sur le lift, le suivant attend au pied ; train retenu en haut tant que la zone suivante est occupée.
- **Sortie du garage** (propriétaire) : le train repart en marche avant de la voie vers la gare (Garage AV, aiguillage sur la voie puis sur P) ; déjà le comportement de `yard.back`.
