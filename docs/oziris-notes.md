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
- Pont : longueur du rail (un train + 2 × 0,6 m), jeu rail / voies (0,8 m), vitesse du chariot (0,5 m/s) et des manœuvres (1,5 m/s) ; entrée dans les voies en marche arrière (déduit de la position des voies).
- Longueur (1,55 m) et largeur (2,6 m) d'un wagon ; couleurs des trains et de la voie (non vérifiées).

## Garage — réponse du propriétaire (2026-11-15)

« C'est la voie du parcours qui vient chercher les trains au garage. » Le pont porte **un seul rail**, le tronçon du circuit (fin du frein final) : `yard.single` (`docs/manoeuvres.md`, « Pont à rail unique »). P = en ligne ; 1…3 = face à la voie k, circuit interrompu (trains retenus avant le pont). Garer : le train vide s'arrête sur le rail (zone « Rail du pont » `RB` en MANU, freins serrés), le rail l'emporte devant la voie, Rail du pont AR le pousse dans la voie, le rail revient vide en P. Sortir : rail vide devant la voie, Voie k AV (sur le rail), rail en P, le train repart vers la gare. Captures : `docs/plans/oziris-garage.jpg`. Question 21 de `docs/plans/QUESTIONS.md` répondue (un rail) ; reste le sens de translation, déduit de la carte.

## Questions ouvertes

Voir `docs/plans/QUESTIONS.md` (section OzIris) et `docs/ROADMAP.md`.

## Documents fournis par le propriétaire (2026-11-15)

- Page de recherche d'images enregistrée : seules des **miniatures** (≈ 590 × 330 px) y figurent.
- `docs/sources/oziris-plan-figures-miniature.jpg` : panneau « OzIris » avec le **plan des figures** (tracé vu de dessus, noms des inversions en légende). À cette taille, les noms des figures sont **illisibles** ; seule la forme générale est exploitable. Demander au propriétaire l'image en grand (capture plein écran du panneau) pour placer les inversions.
- Une miniature d'article titre « Un quatrième train fera son arrivée sur le parcours d'OzIris » : **4 trains** possibles aujourd'hui (contre 3 dans la configuration). À confirmer par le propriétaire.
- Photos : voie et poutre **bleues**, supports **crème / sable**, sièges suspendus ; décor égyptien (gare à colonnes, bassins).
