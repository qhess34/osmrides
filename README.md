# T2Z — simulateurs d'exploitation d'attractions

Jeux de gestion en 2D vue du dessus : vous êtes chef d'attraction. Jeux de fan non officiels, sans lien avec le Parc Astérix.

| Attraction | État | Lien |
|---|---|---|
| Tonnerre 2 Zeus (montagnes russes en bois) | jouable | `jeu.html?site=zeus` |
| La Trace du Hourra (bobsleigh) | jouable (garage et pont transbordeur estimés) | `jeu.html?site=hourra` |
| OzIris (coaster inversé) | jouable (profil, garage et quais estimés) | `jeu.html?site=oziris` |
| Goudurix (acier à rails tubulaires, 7 inversions) | jouable (profil, inversions, file, garage et quais estimés) | `jeu.html?site=goudurix` |

Plan du parc entier : `parc.html` (carte OpenStreetMap déplaçable et zoomable ; chaque attraction dotée d'un simulateur l'ouvre d'un clic).

## Jouer

Ouvrir `index.html` (écran titre : Continuer, Jouer = choix de l'attraction et du mode, Plan du parc, Tutoriels, Installer ; présentation dans `apropos.html`) dans un navigateur et choisir une attraction (aucune installation, aucune dépendance).
Sur téléphone, le jeu s'installe comme une application (une fois ouvert depuis https://qhess34.github.io/t2z/) et fonctionne ensuite hors ligne : Android / Chrome, bouton « Installer l'application » de la page d'accueil (ou menu du navigateur) ; iPhone / iPad (Safari) : Partager → Sur l'écran d'accueil.
Pour un fichier unique autonome : `python3 tools/build.py zeus dist/zeus.html`.

## Ce que fait le jeu

- Pupitre de commande : entrée de la file, départs auto ou manuels, portillons, arrêt d'urgence, aiguillage ou pont transbordeur, blocage du frein final et de chaque frein de bloc.
- Quai : un portillon par wagon, deux visiteurs au plus par portillon ; deux opérateurs vérifient les lapbars et valident avant le départ (by-pass possible).
- File d'attente : les visiteurs suivent les chemins ; des barrières pivotantes ouvrent ou court-circuitent des boucles.
- Garage : manœuvre manuelle par un tronçon en S coulissant.
- Maintenance, pannes, météo (pluie, orage), fréquentation réglable, jeu continu (pas de journée ni de remise à zéro), bilan cumulé, fin de partie si le budget plonge.

## Organisation

- `index.html` : écran titre plein écran (fond animé du plan du parc, menu en boutons de pupitre, choix de l'attraction en vignettes `img/accueil/`). `apropos.html` : présentation du jeu. `tutos.html` : six leçons illustrées (captures `img/tutos/`, bouton Essayer en bac à sable). `site.css` : style commun. `jeu.html` : page de jeu commune.
- Moteur (scripts classiques chargés dans cet ordre, sans rien de propre à une attraction) :
  - `engine/core.js` : utilitaires, vecteurs, construction de la voie, constantes dérivées de `SITE`
  - `engine/garage.js` : voie de garage, aiguillage/pont (`GAR`, `SW0`, `gFrame`), quai, opérateurs, zones
  - `engine/state.js` : état `G`, trains, son, cantonnement, maintenance
  - `engine/queue.js` : visiteurs, file (étapes, fourches), marcheurs
  - `engine/sim.js` : trains, gare, parcours, météo, `step` (jeu continu), `act`
  - `engine/ui.js` : pupitre et interface DOM
  - `engine/render.js` : dessin canvas, caméra, boucle d'animation
- `sites/<site>.data.js` : données OpenStreetMap générées. `sites/<site>.js` : configuration écrite à la main.
- `tools/make_site.py` + `tools/specs/<site>.json` : fabrication des données. `tools/build.py` : fichier unique.
- `AGENTS.md` : consignes de travail. `docs/` : notes de conception.

## Données et limites

Tracés au sol, gares, files et alentours : © contributeurs OpenStreetMap (licence ODbL).
Les hauteurs ne figurent pas dans OpenStreetMap : les profils sont estimés (lift, bosses, croisements vérifiés).
Certains éléments sont déduits ou supposés (position du pont transbordeur, longueur des wagons, couleurs) ; ils sont signalés dans les fichiers de configuration.
