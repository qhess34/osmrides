# T2Z — simulateurs d'exploitation d'attractions

Jeux de gestion en 2D vue du dessus : vous êtes chef d'attraction. Jeux de fan non officiels, sans lien avec le Parc Astérix.

| Attraction | État | Lien |
|---|---|---|
| Tonnerre 2 Zeus (montagnes russes en bois) | jouable | `jeu.html?site=zeus` |
| La Trace du Hourra (bobsleigh) | données prêtes, configuration à écrire | — |

## Jouer

Ouvrir `index.html` dans un navigateur et choisir une attraction (aucune installation, aucune dépendance).
Pour un fichier unique autonome : `python3 tools/build.py zeus dist/zeus.html`.

## Ce que fait le jeu

- Pupitre de commande : entrée de la file, départs auto ou manuels, portillons, arrêt d'urgence, aiguillage, blocage du frein final.
- Quai : un portillon par wagon, deux visiteurs au plus par portillon ; deux opérateurs vérifient les lapbars et valident avant le départ (by-pass possible).
- File d'attente : les visiteurs suivent les chemins ; des barrières pivotantes ouvrent ou court-circuitent des boucles.
- Garage : manœuvre manuelle par un tronçon en S coulissant.
- Maintenance, pannes, météo (pluie, orage), fréquentation réglable, bilan de fin de journée.

## Organisation

- `index.html` : choix de l'attraction. `jeu.html` : page de jeu commune.
- `game.js` : moteur (simulation, rendu, son), sans rien de propre à une attraction.
- `sites/<site>.data.js` : données OpenStreetMap générées. `sites/<site>.js` : configuration écrite à la main.
- `tools/make_site.py` + `tools/specs/<site>.json` : fabrication des données. `tools/build.py` : fichier unique.
- `AGENTS.md` : consignes de travail. `docs/` : notes de conception.

## Données et limites

Tracés au sol, gares, files et alentours : © contributeurs OpenStreetMap (licence ODbL).
Les hauteurs ne figurent pas dans OpenStreetMap : les profils sont estimés (lift, bosses, croisements vérifiés).
Certains éléments sont déduits ou supposés (position du pont transbordeur, longueur des wagons, couleurs) ; ils sont signalés dans les fichiers de configuration.
