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
| Trains | **2** trains de 7 wagons, 28 places (4 par wagon, 2 rangées de 2) | RCDB, Wikipédia |
| Rénovations | nouveaux trains (caisses et retenues, châssis conservés) pour la saison 2025 ; re-tracking complet | recherche web |

Contradictions : une base (GPTKB) donne 1 150 m de long, écartée (toutes les autres : 950 m). La vitesse de 75 km/h parfois citée n'apparaît dans aucun résultat (90 km/h partout). Le tracé OSM fait 797 m **au sol** ; avec le profil estimé on obtient 809 m en 3D, contre 950 m annoncés : OSM simplifie les inversions (le tracé 2D d'un looping est quasi une ligne), l'écart est normal.
Accès : rcdb.com, wikipedia.org et Coasterpedia n'ont pas été lus directement (WebFetch non disponible dans cette session) ; les chiffres viennent des extraits de recherche web (RCDB 753 cité par Wikipédia). À revérifier sur rcdb.com/753.htm.

Sources : https://en.wikipedia.org/wiki/Goudurix · https://rcdb.com/753.htm · https://coaster.cloud/en/attractions/b9bff96f-goudurix · https://thrillzing.com/roller-coasters/goudurix-parc-asterix/ · https://www.pa-community.com/parques/parc-asterix/atracciones/goudurix

## Repères OSM (extrait du parc, origine [49,13204 ; 2,57090] = centre de la gare)

- Circuit (797 m au sol) : gare 937067647 (19 m, sens inverse de son tracé OSM, vers le nord) → sortie de gare 541092977 (nommée « launch_straight », en fait la courbe de sortie, parcourue à l'envers) → lift 541092979 (92 m) → 541092993 → 541092992 → 541092990 → 541092991 → 541092989 → 541092988 → 541092987 → 1181620312 → 541092986 → 1181620311 → 541092985 → 1181620310 → 1181620309 → 541092984 → 541092983 → 541092982 → frein final 937067646 (42 m, entre dans la gare par le sud). Tous `layer` 1 ou 2.
- Gare : bâtiment 148159470 (6,8 m × 19 m, ne couvre que la voie).
- Garage : voie de maintenance 1221386549 (`roller_coaster:track=maintenance`, 45 m, butoir au sud en (−16,7 ; 39,8), nœud `railway=switch` en (−15,2 ; −4,5)) : elle se détache du circuit **au pied du lift**, pas à la gare.
- File : OSM ne cartographie aucune file. On prend le chemin 1102233771 (« Gouduriiiix Promenade », 80 m, de l'entrée sud (23,8 ; 87,7) au côté est de la gare) ; arrivée par les chemins 132709980 / 132709988 depuis le nord-ouest ; liaison 161214274.
- Plan d'eau : multipolygone 7273043 (le lac sous le tracé ; la place piétonne en a un trou, d'où la gestion des anneaux intérieurs dans `tools/make_site.py`).

## Ce qui est estimé

- **Profil en hauteur** : lift 36 m, chute 32,9 m, bosses d'inversion à s ≈ 250, 450, 487, 557, 594, 650 ; vitesse maxi calculée 24,5 m/s (88 km/h) ; croisements ≥ 3,7 m. L'ordre et la place des sept inversions ne sont PAS connus : la photo montre deux figures en « ∞ » dans le lac (supposées batwing et papillon) et des enchaînements au sud (looping, double vrille) dont on ne sait pas l'ordre.
- Frein de bloc B1 (s ≈ 360, ligne droite est) : supposé (deux trains imposent au moins trois cantons).
- Frein final : tête du train à 5 m avant la gare (`holdBack`).
- Quais (7 m à l'est, 3,5 m à l'ouest), poste de conduite, porte et chemin de sortie, file (chemin choisi), barrière d'entrée.
- Garage : la voie de maintenance OSM part du pied du lift, mais le moteur ne sait brancher l'aiguillage qu'après la gare (`yard.at:'station'`) : la voie de garage RECOPIE donc la courbe de sortie de gare, puis suit la voie OSM. Course de l'aiguillage, vitesses de manœuvre.
- Longueur (2,55 m) et largeur (1,5 m) d'un wagon ; couleurs des trains (rouge sourd et or, non vérifiées) ; couleurs de la voie (jaune) et des supports (rouge rouille) d'après la photo, assourdies.
- Moteurs par zone : défauts du moteur (gare, frein final, voie = freins + pneus ; bloc = freins seuls), à confirmer.
