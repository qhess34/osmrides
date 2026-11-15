# Feuille de route T2Z

Tenue par le chef de projet. Une tâche = une session courte, qui lit ce fichier, `AGENTS.md` et seulement les modules concernés.

## Règles d'économie de tokens

- Ne jamais lire `sites/*.data.js` (fichiers générés, 60–70 Ko) : en extraire une valeur avec `grep -o` ou `node -e` si besoin.
- Lire le module du moteur concerné, pas le moteur entier (voir le découpage dans `AGENTS.md` une fois T1 faite).
- Vérifier avec `node tools/check.js <site>` (T1) : sortie courte OK/FAIL, pas de journal complet. Ne relancer les captures qu'au moment de conclure.
- Une question au propriétaire bloque une tâche ? La noter ici et passer à la suivante plutôt qu'inventer.
- Modèle selon la tâche : Haiku pour chercher et résumer, Sonnet pour le code mécanique (découpage, carte, interface), Fable/Opus seulement pour la conception du moteur (T3, T4). Le quota hebdomadaire Fable est presque épuisé (≈ 80 %) : le réserver à T3/T4.

## Tâches, dans l'ordre

| # | Tâche | Dépend de | Modèle | État |
|---|---|---|---|---|
| T0 | Plan, consignes communes de manœuvre (`docs/manoeuvres.md`) | — | Opus | fait |
| T1 | Découper `game.js` en modules (`engine/*.js`, scripts classiques, sans changement de comportement) + test rapide `tools/check.js` | — | Sonnet | fait |
| T2 | Carte du parc entier (`parc.html`) depuis l'extrait OSM du parc : allées, bâtiments, eau, tracés des attractions ; Tonnerre 2 Zeus et Trace du Hourra cliquables vers leur simulateur | T1 (pour le code de rendu partagé) | Sonnet | fait |
| T3 | Moteur : gare de triage générique `SITE.yard` (aiguillage ou pont à N positions, voies multiples, commandes Positionner / Avancer / Reculer / Arrêter, verrouillages) selon `docs/manoeuvres.md` ; migrer Zeus dessus sans régression | T1 | Fable ou Opus | fait |
| T4 | `sites/hourra.js` : Trace du Hourra jouable, garage à 6 voies sur pont transbordeur | T3 | Fable ou Opus | fait |
| T7 | Pupitre par zones : freins et moteurs avant/arrière par zone (gare, zones de freinage, voies de garage, rail du chariot), lift marche/arrêt, chariot ; supprime les commandes par train ; Zeus et Hourra revérifiés | T4 | Opus | fait (moteurs par zone estimés, à confirmer) |
| T8 | Trace du Hourra : pont transbordeur droit à deux rails parallèles (rail parcours = zone de freinage décalée vers l'est, rail garage qui porte le train), voies droites | T7, T9 | Opus | fait (avant T7, boutons par train conservés) |
| T9 | Plans des deux attractions avec repères numérotés à compléter par le propriétaire (`docs/plans/`) | — | Sonnet | en cours |
| T5 | Intégration progressive : depuis la carte du parc, chaque attraction s'ouvre à son emplacement ; état visible (ouverte, file) | T2, T4 | Sonnet | plus tard |
| T6 | Attractions suivantes (une session chacune, en suivant « Ajouter une attraction » d'`AGENTS.md`) | T3, T5 | Sonnet + Opus pour les besoins moteur | plus tard |

## Questions ouvertes au propriétaire

- Q4 (T7) : quelles zones ont des moteurs (pneus) ? Supposé : gare, frein final, rails A/B, voies de garage ; freins de bloc sans moteurs. Les freins de gare sont-ils commandés à la main ou liés au départ ? **Réponse (propriétaire, 2026-11-15) : liés au départ.** Le rail mobile du parcours (rail A, Hourra) doit-il être une zone distincte du frein final ? **Réponse (propriétaire, 2026-11-15) : oui, zone de freinage de stockage (un train sur le rail mobile en attendant la gare, le suivant au frein final).**

- ~~Q1~~ répondue le 2026-11-14 (voir `docs/hourra-notes.md`, « Garage — réponse du propriétaire »). Reste à confirmer à l'écran : position exacte du pont et orientation des voies dans le bâtiment OSM 148160581.
- ~~Q2~~ répondue : 6 trains, 5 au plus sur le parcours (toujours un au garage), 6 voies de garage.
- Q3 (Trace du Hourra) : en partie répondue (pont droit qui emporte le train, fait en T8). Reste à confirmer sur `docs/plans/hourra-garage-pont-droit.jpg` : voies à l'ouest du circuit dans le bâtiment 148160581 ? entrée en marche avant et sortie en arrière ? emplacement du chariot (dernière ligne droite du frein final) ? écartement et vitesse du chariot ?

## Journal

- 2026-11-14 — La session « Trace du Hourra (suite) » s'est arrêtée sur la limite d'usage pendant les essais de `sites/hourra.js` ; ce fichier n'a jamais été commité. On reprend T4 après T3, à partir des notes de `docs/hourra-notes.md`.
- 2026-11-14 — T3 fait : `SITE.yard` générique (aiguillage / pont transbordeur, N voies, boutons `#yP/#yk`, `#tF/#tB/#tX`, verrouillages, refus au journal), Zeus migré, scénario de manœuvre dans `tools/check.js` ; `car.seats` dans le moteur.
- 2026-11-14 — T4 fait : `sites/hourra.js` (6 trains, `maxRun` 5, garage `at:'brake'` + pont transbordeur à 6 voies, file à fourche, sortie), freins de bloc `blk1…blk3` ajoutés à la spec (estimés) et données régénérées, freins de bloc commandables au pupitre (`#bBk<n>`, moteur générique), lien générique depuis `parc.html`, scénario frein final / pont / frein de bloc dans `tools/check.js`. Emplacement du pont, orientation des voies, longueur des bobs, couleurs, vitesses : estimés (Q3).
- 2026-11-14 — T8 fait : `device: 'traverser'` générique (pont droit, rails A/B, position G `#yG`, le chariot emporte le train, voies droites, arrêt avant le pont si aucun rail en ligne, verrouillages) ; Trace du Hourra migrée (S retirés), `holdBack` 24 ; Zeus inchangé ; `check.js hourra` et `zeus` PASS ; captures `docs/plans/hourra-garage-pont-droit.jpg`. Côté ouest des voies, écartements, vitesses, sens d'entrée : estimés.
- 2026-11-14 — T8 corrigé (propriétaire) : rail A escamotable indépendant (`yard.retract`, `#yA0`/`#yA1`), chariot du rail B seul (`#yG`, `#y1…#y6`, plus de `#yP`), verrouillages croisés ; poste de conduite au sud-est de la gare (estimé) ; `check.js hourra` (refus compris) et `zeus` PASS ; captures `docs/plans/hourra-garage-pont-droit.jpg`.
- 2026-11-14 — Synoptique technique du circuit (plan nord en haut, gare, lift, freins de bloc B1…, frein final, garage agrandi avec rail A/chariot, trains numérotés en direct, clic = suivi) à la place du profil en hauteur ; bouton `#bSyn`, `docs/plans/synoptique.jpg`.
- 2026-11-14 — T7 fait : pupitre par zones (sections Gare, Lift, Zones de freinage, Garage ; ids `#z<Zone>_<cmd>`), commandes par train supprimées ; zones de freinage AUTO par défaut, MANU au choix, relâchement refusé si la section suivante est occupée, `#zAuto` ; `SITE.zones` (moteurs : défauts estimés) ; portillons seulement au bouton, en auto aussi (le train prêt attend leur fermeture) ; `check.js zeus`/`hourra` (+ `--build`) PASS avec scénarios par zones et portillons pressés toute la journée ; `docs/plans/pupitre-zones.jpg`.
- 2026-11-15 — Visiteurs hors des chemins corrigés (Zeus, Trace du Hourra) : couloirs de quai (`plat.exit`/`walkU`, `exit.door`, estimés), portillon tenu ouvert pendant le passage, demi-tour par le chemin d'arrivée, promeneurs hors de la gare ; `check.js` affiche `offpath=<n>` et échoue si n>2 (avant : Zeus 3525, Hourra 909 ; après : 0 et 0).
- 2026-11-15 — Plein écran de la carte (jeu et plan du parc, repli CSS sans API) et jeu sur mobile : onglets Carte / Pupitre / Journal, tiroir du pupitre, un doigt déplace, deux doigts zooment, cibles tactiles >= 44 px ; `tools/mobile.js` PASS (Zeus, Trace du Hourra, parc), `docs/plans/mobile.jpg` ; non testé sur appareil réel.
- 2026-11-15 — Frein avant gare (propriétaire) : zone `Pre` générique (`SITE.preBrake`, AUTO/MANU, pneus, position estimée sur la Trace du Hourra : 1 m avant la gare, un train de long) ; gare occupée = trois trains en attente (frein avant gare, rail mobile, frein final) ; voies de garage sans Avancer (Rail du chariot AV / Gare AV poussent dans la voie, Reculer de voie pour sortir) ; `check.js hourra`/`zeus` et `mobile.js` PASS.
