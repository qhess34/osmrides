# Versions du moteur et de l'éditeur

_Décision du propriétaire, 23/11/2026 (issue #50, décision D13 de `docs/ARCHITECTURE.md`)._

`osmrides` est une **librairie** : moteur (`engine/`) et éditeur (`editor/`), génériques. Ce qui est propre à un type de lieu (parc, station de ski…) est codé dans le dépôt de jeu (`osmrides_parks`, `osmrides_skiresort`). Une version = une étiquette git numérotée `0.0.1`, `0.0.2`, `0.1.0`… (posée par le propriétaire, jamais déplacée) ; le moteur et l'éditeur d'une même étiquette vont ensemble.

## Utiliser une version dans un dépôt de jeu

**Jeu** : `jeu.html` (page de jeu ; modèle : celle d'`osmrides_parks`), une seule ligne à régler :

```js
const MOTEUR='0.0.1';
```

Le jeu charge alors `https://cdn.jsdelivr.net/gh/qhess34/osmrides@0.0.1/engine/moteur.js`, qui charge le reste du moteur de la même version. Aucun dossier `engine/` dans le dépôt de jeu. Premier lancement : connexion Internet nécessaire ; ensuite le service worker garde le moteur pour jouer hors ligne (page publiée en https).

Essayer une autre version sans rien modifier : `jeu.html?…&moteur=0.0.2`, `moteur=main` (dernier état, pour essai), ou un clone voisin d'osmrides en `file://` : `moteur=../osmrides/engine/`.

**Éditeur avec Docker** : copier `tools/jeu/compose.yaml` à la racine du dépôt de jeu, puis

```sh
docker compose up -d
```

et ouvrir http://127.0.0.1:8787/. Le conteneur télécharge l'éditeur de la version écrite dans `jeu.html` (`MOTEUR`) ; essai d'une autre : `OSMRIDES=0.0.2 docker compose up -d`. L'éditeur affiche le jeu avec le moteur de sa propre version et n'écrit que `lieux/<type>/<lieu>/<el>.game.js`.

**Éditeur sans Docker** (Node 22) : `sh ../osmrides/tools/editeur.sh 0.0.1` depuis le dépôt de jeu.

**Tests** : les tests de jeu (`check.js`, `save.js`, `mobile.js`) sont dans le dépôt de jeu ; ceux de l'éditeur dans `osmrides` (sur un dépôt de jeu cloné à côté). Une session cloud d'un dépôt de jeu ne joint pas jsDelivr sans l'ajouter au réseau de son environnement (`cdn.jsdelivr.net`) ; sinon tester avec un clone voisin d'osmrides à l'étiquette voulue (`moteur=../osmrides/engine/`).

## Publier une version (Chef moteur)

1. `check.js` PASS sur les attractions, `save.js`, `mobile.js`, `editor-test.js`, `osm-sync-test.js`.
2. Ligne ci-dessous (ce qui change pour les jeux).
3. Le propriétaire pose l'étiquette (les sessions cloud ne peuvent pas pousser d'étiquette) ; puis issue `inter-equipe` aux chefs parcs et stations : « version disponible ».

## Notes de version

- **0.1.0** (à étiqueter par le propriétaire) : moteur rangé en trois couches, `engine/noyau/`, `engine/voies/`, `engine/montagnes-russes/` (`docs/ARCHITECTURE.md` D14), même rendu, mêmes règles, mêmes sauvegardes (clé et format de 0.0.1). Pour un jeu : rien d'obligatoire. Nouveau : `SITE.extensions` (liste des couches ; défaut transitoire `['voies','montagnes-russes']` ; un élément finissant par `/` est un dossier du dépôt du jeu, relatif à `jeu.html`). Éditeur : sections « Attraction » et travées fournies par la couche (`engine/montagnes-russes/schema.js`, `editeur.js`, `GET /api/couches`).
- **0.0.1** (23/11/2026, commit 7330a04) : moteur au moment de la séparation des dépôts (montagnes russes du Parc Astérix : gare, lift, freins, garage, file, visiteurs, météo, sauvegarde ; éditeur : barrières, salle de contrôle, zone d'attente, travées, entrée de file, attraction, apparence, envoi vers OSM). Point d'entrée `engine/moteur.js`. Éditeur ouvert sur tout `lieux/<type>/<lieu>/<el>` d'un dépôt de jeu. Page de jeu de référence : `jeu.html` d'`osmrides_parks` (celle de l'étiquette 0.0.1 n'accepte en `?moteur=` que des versions de la forme `v1`). Le code propre aux montagnes russes est encore dans le moteur : séparation prévue (#51).
