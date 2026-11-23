# Organisation du code (table détaillée)

Quand la lire : savoir quel fichier fait quoi, génération des données, PWA, sauvegarde, éditeur.

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Table des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | écran titre de jeu, plein écran sans défilement : fond canvas (plan du parc, `parc/parc.data.js`), menu Continuer (dernière sauvegarde, `ts`) / Jouer (`#jouer` : vignettes `a.card[data-site]` + `.prog` « Partie en cours », mode carrière / bac à sable) / Plan du parc / Tutoriels / Installer ; vignettes `img/accueil/<site>.jpg` (captures du jeu, à refaire pour une nouvelle attraction) ; style `site.css` |
| `apropos.html` | présentation du jeu (fonctions, données, limites) |
| `tutos.html`, `img/tutos/` | six leçons illustrées en français (numérotées, bouton Essayer = `jeu.html?site=…&mode=sandbox`) (premiers pas, zones de freinage, garage avec une note par attraction, file, mobile, bac à sable et sauvegarde) ; captures JPEG < 120 Ko prises avec Playwright sur de vraies parties. À mettre à jour avec le jeu (libellés, boutons) |
| `parc.html` | plan du parc entier (canvas, déplacement/zoom) ; charge `parc/parc.data.js` ; les attractions avec `site` ouvrent `jeu.html?site=…` |
| `parc/parc.data.js` | `const PARK={…}` — généré par `tools/make_park.py` depuis l'extrait du parc, ne pas éditer à la main |
| `tools/make_park.py` | `python3 tools/make_park.py extrait.osm parc/parc.data.js` (origine = Trace du Hourra) |
| `jeu.html` | page de jeu commune ; charge `sites/<site>.data.js`, `sites/<site>.js`, `sites/<site>.game.js` (facultatif : absent, on continue), puis `engine/*.js` selon `?site=` |
| `engine/*.js` | moteur (aucune coordonnée ni texte propre à une attraction), scripts classiques à variables globales partagées, chargés dans cet ordre : |
| `engine/core.js` | utilitaires, vecteurs, construction de la voie, constantes dérivées de `SITE` |
| `engine/garage.js` | gare de triage `SITE.yard` (`YD`, `LANES`, `SW0`, `gFrame`, état de l'appareil `G.dev`, verrouillages), quai, opérateurs, zones |
| `engine/state.js` | état `G`, trains, son, cantonnement, maintenance |
| `engine/queue.js` | visiteurs, file (étapes, fourches), marcheurs |
| `engine/sim.js` | trains, gare, parcours, manœuvres (`yardPos`, `yardFwd`, `yardBack`, `yardHalt`), météo, `step` (jeu continu : horloge qui boucle 10:00–19:00, salaires horaires, fin de partie budget, bilan `#bBil`), `act` |
| `engine/ui.js` | pupitre et interface DOM |
| `engine/render.js` | dessin canvas, caméra, boucle d'animation |
| `engine/save.js` | sauvegarde automatique (`localStorage` `t2z.save.<site>.<mode>`, `career` ou `sandbox`) et reprise avant la 1re image ; bouton « Nouvelle partie » (`#bNew` dans l'aide, fenêtre `#mNew` : `#bNewCareer`, `#bNewSandbox`, `#bNewCancel`) ; `window.t2zSave` ; `index.html` affiche « Partie en cours » |
| `sites/<site>.data.js` | `const OSM={cps, feats, trees, pois, others, deco, paths, polys, src, ctl, stations, elements, ele…}` (`deco` : voies décoratives, ci-dessous) — généré, ne pas éditer à la main ; **traçabilité OSM** (lot 2, `docs/OSM-GUIDE.md` §7) : `feats[]` et `stairs[]` portent `id` (`w123`, `n456`, `r789`) et `v` (version) ; `doors`, `barriers`, `pois`, `widths` les ont **en fin de tableau** (`barriers` : `[x,z,ref,hinge,tx,tz,bout,id,v]`, indices 0-6 inchangés) ; `OSM.src` = `{track, others, trees, paths, polys}` pour le reste (listes `[id, v]`) ; le moteur n'y touche pas, sauf `OSM.attrs` (issue #46, D12) = `[{role: 'queue'\|'plat'\|'rail'\|'roof'\|'track', id, v, l (m), t: tags OSM bruts, h: couleurs normalisées #rrggbb, p: tracé du chemin (rôle queue seulement, issue #45)}]`, objets portant `surface` / `colour` (chemins de file de `queue_paths` de la spec, polygone de sol du quai `area:highway=footway` + `covered=yes`, tronçons de voie), `material` (garde-corps le long des allées), `roof:colour` (bâtiment de la gare) : valeur par défaut de `GAME.look` (`docs/ref/editeur.md`), absent sans ces tags |
| `sites/<site>.js` | `const SITE={…}` — configuration écrite à la main |
| `sites/<site>.game.js` | `const GAME={…}` (corps JSON strict) — données du jeu écrites **par l'éditeur** seulement (barrières, salle de contrôle) ; facultatif ; priorité `GAME` > `SITE` > calcul (`docs/ARCHITECTURE.md` D1-D3) |
| `editor/`, `compose.yaml` | éditeur local WYSIWYG (lot 1, `editor/README.md`) : `editor/server.js` (Node 22 sans dépendance, n'écrit que `sites/<site>.game.js`), `editor/index.html` + `editor.js` (couche d'édition sur `jeu.html` en cadre), `editor/schema.js` (format, validation, diff) ; `docker compose up -d` → http://127.0.0.1:8787/ ; non publié |
| `tools/make_site.py`, `tools/specs/<site>.json` | génération des données depuis un extrait `.osm` |
| `tools/build.py` | fichier HTML unique autonome (inclut `sites/<site>.game.js` s'il existe) |
| `manifest.webmanifest`, `icons/`, `sw.js` | application installable (PWA) : manifeste, icônes PNG générées depuis le logo vectoriel `img/logo/logo.svg` (carte pliée + montagnes russes de profil ; `img/logo/logo-titre.svg` avec le nom) par `NODE_PATH=$(npm root -g) node tools/make_icons.js icons` ; logo aussi sur l'écran titre (`.hero h1 .logo`), service worker hors ligne. Les pages l'enregistrent seulement en http(s) (rien sous `file://`). |
| `tools/make_sw.py` | à la publication, `python3 tools/make_sw.py _site` écrit dans `_site/sw.js` la liste de TOUS les fichiers du site et une version (empreinte) : **une nouvelle attraction n'exige rien de plus**, tant que ses fichiers sont copiés dans `_site` par `.github/workflows/pages.yml` (ajouter là tout nouveau dossier ou type de fichier à la racine : `*.html *.css *.webmanifest sw.js engine sites parc icons img`). Sans injection, `sw.js` met en cache à la volée. |
| `docs/OSM-GUIDE.md` | éléments OSM lus ou utiles au jeu, et liste de préparation OSM avant d'importer une attraction (à tenir à jour quand `make_site.py` lit un nouveau tag) |
| `docs/` | notes de conception (relevés, choix, points ouverts) |

Aucune dépendance, aucun serveur : tout doit fonctionner en ouvrant le fichier (`file://`). Pas de `fetch`, pas de modules ES.

## État global

- État global `G`, trains `trains[]`, actions joueur `act(nom, arg)`, pas de simulation `step(dt)`, rendu `render(dt)`.

## Accès réseau (texte d'origine)

- `api.openstreetmap.org` fonctionne : `https://api.openstreetmap.org/api/0.6/map?bbox=2.560,49.130,2.582,49.142` donne le parc entier (≈ 6 Mo). L'extrait n'est pas versionné.
- Mise à jour OSM du propriétaire : filtrer par ses changesets du jour (`/api/0.6/changesets?bbox=…&time=…`, puis `/api/0.6/changeset/<id>/download`), voir `docs/NOUVELLE-ATTRACTION.md` §4.
- `overpass-api.de` et ses miroirs coupent la connexion : inutilisables.
- YouTube exige une connexion pour les accès automatisés : les vidéos embarquées ne sont pas exploitables. Ne pas contourner ; demander au propriétaire des captures ou des horodatages.
- La recherche web fonctionne pour les caractéristiques (RCDB, Coasterpedia) ; les sources se contredisent parfois, le dire.
`nouvelle-attraction`, `corriger-attraction`, `verifier-attraction`, `captures-jeu`, `maj-tutos`, `compte-rendu-proprietaire` : procédures courtes qui renvoient à ce fichier et à `docs/`. Captures : `tools/captures.js` (tutoriels), `tools/thumbs.js` (vignettes).
Voir `docs/ROADMAP.md` (lots, vision), `docs/ARCHITECTURE.md` (données, décisions), `docs/JOURNAL.md` (historique, questions ouvertes), `docs/hourra-notes.md` (données de la Trace du Hourra) et `docs/oziris-notes.md` (OzIris) et `docs/goudurix-notes.md` (Goudurix). `tools/make_plan.py <site> out.png "Titre" ["Nom:s0:s1:n;…"]` fabrique le plan « tracé complet » (ou, avec la liste de figures, le plan des figures) de `docs/plans/`.
