# OSMrides — moteur et éditeur

Librairie sans dépendance pour simuler l'exploitation d'installations réelles (attractions, remontées…) vues du dessus, sur le tracé d'OpenStreetMap. Jeux de fan non officiels.

Présentation : https://qhess34.github.io/osmrides/ (`index.html`).

| Dossier | Rôle |
|---|---|
| `engine/` | moteur ; point d'entrée `engine/moteur.js` |
| `editor/` | éditeur local WYSIWYG (`editor/README.md`) |
| `tools/jeu/compose.yaml` | modèle à copier dans un dépôt de jeu pour lancer l'éditeur avec Docker |
| `tools/editeur.sh` | éditeur d'une version sans Docker |
| `tools/editor-test.js`, `tools/osm-sync-test.js` | tests de l'éditeur, sur un dépôt de jeu cloné à côté |
| `docs/` | architecture, versions, références |

Versions et mode d'emploi : `docs/versions.md`.

## Jeux

- Parcs d'attractions : https://github.com/qhess34/osmrides_parks (jeu : https://qhess34.github.io/osmrides_parks/).
- Stations de ski : https://github.com/qhess34/osmrides_skiresort.

Le jeu du Parc Astérix était publié ici jusqu'au 23/11/2026 : l'ancienne adresse `jeu.html?…` redirige vers `osmrides_parks`, les sauvegardes sont conservées.

Données cartographiques © les contributeurs d'OpenStreetMap (ODbL).
