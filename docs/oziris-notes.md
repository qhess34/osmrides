# OzIris — notes

Coaster inversé Bolliger & Mabillard, Parc Astérix (zone Égypte), ouvert le 7 avril 2012. Configuration : `sites/oziris.js` ; spec : `tools/specs/oziris.json` ; données : `sites/oziris.data.js`.

## Caractéristiques (sources)

| Donnée | Valeur | Source |
|---|---|---|
| Longueur | 1 000 m (3 280 ft) | Wikipédia (infobox d'après RCDB), coaster.cloud, annonce du parc 2012 (newsparcs) |
| Hauteur | 40 m | Wikipédia, annonce du parc |
| Chute | 35 m | Wikipédia |
| Vitesse | 90 km/h | Wikipédia, annonce du parc |
| Inversions | 5 | Wikipédia, annonce du parc, thrillzing |
| Durée | ≈ 2 min 15 | Wikipédia, coaster.cloud |
| Trains | **3** trains de 8 wagons, 4 places côte à côte (32 par train) | Wikipédia (d'après RCDB) |
| Capacité | 1 600 pers./h | coaster.cloud |
| Taille minimale | 1,30 m | OSM (nœud 1732704742) |
| Éléments | grande boucle plongeante (« dive loop », 30 m) après la chute (Wikipédia) ; looping vertical, Immelmann, vrille (thrillzing) ; roulis zéro-G cité ailleurs, non confirmé | Wikipédia, thrillzing |

Contradictions : CoasterBuzz donne **2** trains (Wikipédia/RCDB : 3) ; la liste des éléments diffère selon les sources (dive loop / Immelmann, zéro-G non confirmé). On a retenu 3 trains.
Accès : rcdb.com, wikipedia.org (WebFetch) et Coasterpedia n'étaient pas joignables depuis la session (réseau) ; chiffres pris des extraits de recherche web (RCDB 9675 cité par Wikipédia). À revérifier sur rcdb.com/9675.htm.

Sources : https://en.wikipedia.org/wiki/OzIris · https://coasterbuzz.com/RollerCoasters/oziris · https://coaster.cloud/en/attractions/b9362601-oziris · https://thrillzing.com/roller-coasters/oziris-parc-asterix/ · https://www.newsparcs.com/en/article/00005665-oziris_la_nouvelle_creation_a_sensations_fortes_du_parc_asterix

## Repères OSM (extrait du parc, origine [49.1343, 2.5665])

- Circuit (858 m au sol, 904 m en 3D estimés) : gare 937048122 → lift 541161843 → 937048120 → 541161845 → 541161844 → tunnel 421460641 (layer −1) → 541161850 → 1102773847 → 541161849 → 1101623925 → 541161848 → frein 541161847 (brake_run) → 937048121 → attente 1330192627 (waiting) → gare.
- Gare : bâtiment 420016980 (building=retail, 2 niveaux : gare surélevée et boutique), auvent 420016979, entrée `entrance=main` (−7,4 ; 4,3).
- Pont transbordeur : `railway=traverser` 1330192631 sur la fin du frein final (s ≈ 798…812) ; voies de maintenance 1330192628/29/30, 13,3 m, parallèles au frein final, **en amont** du pont, à ≈ 3 / 7 / 11 m de l'axe, côté nord-ouest ; bâtiment 420016988 (garage), halle 420016978.
- File : chemin 1073325805 (oneway), qui repasse par le nœud (−17 ; 57,3) : boucle ouest facultative = fourche ; liaison 1220633163 ; allée 421508668.

## Ce qui est estimé

- Profil en hauteur (lift 40 m, chute 35 m, cinq bosses pour les inversions à s ≈ 240, 340, 470–540, 610, 700) ; vitesse calculée max 26 m/s (93 km/h) ; croisements ≥ 4,4 m sauf s 493 × 558 (5,0 m).
- Frein de bloc B1 (s ≈ 520, haut de la grande courbe nord) : supposé (3 trains imposent au moins 4 cantons).
- Quais : embarquement à l'est (côté file), débarquement à l'ouest, sortie par un escalier et un passage sous la gare surélevée vers la boutique. Profondeurs de quai, poste de conduite.
- Pont : deux rails (circuit P, garage G) sur le même chariot, écart 3,2 m ; entrée dans les voies en marche arrière (déduit de la position des voies) ; vitesses.
- Longueur (1,55 m) et largeur (2,6 m) d'un wagon ; couleurs des trains et de la voie (non vérifiées).

## Questions ouvertes

Voir `docs/plans/QUESTIONS.md` (section OzIris) et `docs/ROADMAP.md`.
