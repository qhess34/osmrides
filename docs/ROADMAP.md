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
| T1 | Découper `game.js` en modules (`engine/*.js`, scripts classiques, sans changement de comportement) + test rapide `tools/check.js` | — | Sonnet | en cours |
| T2 | Carte du parc entier (`parc.html`) depuis l'extrait OSM du parc : allées, bâtiments, eau, tracés des attractions ; Tonnerre 2 Zeus et Trace du Hourra cliquables vers leur simulateur | T1 (pour le code de rendu partagé) | Sonnet | à faire |
| T3 | Moteur : gare de triage générique `SITE.yard` (aiguillage ou pont à N positions, voies multiples, commandes Positionner / Avancer / Reculer / Arrêter, verrouillages) selon `docs/manoeuvres.md` ; migrer Zeus dessus sans régression | T1 | Fable ou Opus | à faire |
| T4 | `sites/hourra.js` : Trace du Hourra jouable, garage à 5 voies sur pont transbordeur | T3 + réponse du propriétaire (Q1) | Fable ou Opus | bloquée |
| T5 | Intégration progressive : depuis la carte du parc, chaque attraction s'ouvre à son emplacement ; état visible (ouverte, file) | T2, T4 | Sonnet | plus tard |
| T6 | Attractions suivantes (une session chacune, en suivant « Ajouter une attraction » d'`AGENTS.md`) | T3, T5 | Sonnet + Opus pour les besoins moteur | plus tard |

## Questions ouvertes au propriétaire

- **Q1 (bloque T4)** — Garage de la Trace du Hourra : où est le pont transbordeur (ou la rampe) et dans quel sens partent les 5 voies ? Bâtiment candidat OSM : way 148160581, à l'ouest du frein final. Une capture de carte ou un croquis suffit.
- **Q2** — Trace du Hourra : combien de trains en exploitation (5 ou 6 selon les sources) ?

## Journal

- 2026-11-14 — La session « Trace du Hourra (suite) » s'est arrêtée sur la limite d'usage pendant les essais de `sites/hourra.js` ; ce fichier n'a jamais été commité. On reprend T4 après T3, à partir des notes de `docs/hourra-notes.md`.
