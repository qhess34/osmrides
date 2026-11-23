# Versions du moteur et de l'éditeur

_Décision du propriétaire, 23/11/2026 (issue #50, décision D13 de `docs/ARCHITECTURE.md`)._

`osmrides` est une **librairie** : moteur (`engine/`) et éditeur (`editor/`), génériques. Ce qui est propre à un type de lieu (parc, station de ski…) est codé dans le dépôt de jeu (`osmrides_parks`, `osmrides_skiresort`). Une version = une étiquette git `vN` sur `osmrides`, jamais déplacée ; le moteur et l'éditeur d'une même étiquette vont ensemble.

## Utiliser une version dans un dépôt de jeu

**Jeu** : `jeu.html`, une seule ligne :

```js
const MOTEUR='v1';
```

Le jeu charge alors `https://cdn.jsdelivr.net/gh/qhess34/osmrides@v1/engine/moteur.js`, qui charge les autres fichiers du moteur de la même version. Aucun dossier `engine/` dans le dépôt de jeu. Premier lancement : connexion Internet nécessaire ; ensuite le service worker garde le moteur pour jouer hors ligne (page publiée en https seulement).

Essayer une autre version sans rien modifier : `jeu.html?…&moteur=v2`, `moteur=main` (dernier état, pour essai), ou un clone voisin d'osmrides en `file://` : `moteur=../osmrides/engine/`.

**Éditeur** : depuis le dépôt de jeu,

```sh
sh ../osmrides/tools/editeur.sh v1
```

(télécharge la version une fois dans `~/.cache/osmrides/v1`, puis ouvre http://127.0.0.1:8787/). L'éditeur affiche le jeu avec **son** moteur (même version), et n'écrit que `lieux/<type>/<lieu>/<el>.game.js` du dépôt de jeu.

**Tests** : `tools/check.js` et les autres outils de test restent dans `osmrides` pour l'instant. Une session cloud d'un dépôt de jeu ne joint pas jsDelivr sans l'ajouter au réseau de son environnement (`cdn.jsdelivr.net`) ; sinon tester avec un clone voisin (`moteur=../osmrides/engine/`) à l'étiquette voulue.

## Publier une version (Chef moteur)

1. `check.js` PASS sur les attractions, `save.js`, `mobile.js`, `editor-test.js`, `osm-sync-test.js`.
2. Ligne ci-dessous (ce qui change pour les jeux).
3. `git tag vN && git push origin vN`, puis issue `inter-equipe` aux chefs parcs et stations : « vN disponible ».

## Notes de version

- **v1** (23/11/2026) : état du moteur au moment de la séparation des dépôts (montagnes russes du Parc Astérix : gare, lift, freins, garage, file, visiteurs, météo, sauvegarde ; éditeur : barrières, salle de contrôle, zone d'attente, travées, entrée de file, attraction, apparence, envoi vers OSM). Point d'entrée `engine/moteur.js`. Éditeur ouvert sur n'importe quel `lieux/<type>/<lieu>/<el>`. Le code propre aux montagnes russes est encore dans le moteur : il sera séparé en v2 (issue à venir).
