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

- **0.4.0** (à étiqueter par le propriétaire ; osmrides#55) : éditeur, une seule section **« Sol de la file »** (fusion de « Sol des allées de file » et « Sol d'un chemin de file ») : « Tous » choisi par défaut écrit chaque chemin (`look.ways`, renvoyable vers OSM : `surface`, `colour`) et `look.queue` (prolongement d'entrée et raccords du quai suivent la même valeur) ; un chemin choisi dans la liste ou sur la carte garde son réglage propre ; origine : revêtement OSM, sinon béton clair. Moteur inchangé : les `game.js` qui ont `look.queue` sont lus à l'identique.
- **0.3.0** (à étiqueter par le propriétaire ; osmrides#53, lot 1) : l'éditeur règle dans `GAME.site` (liste blanche avec bornes ESTIMÉES, valeur absente = valeur de `SITE`) : objectif (`goal`), caméras (`cams`, « cadrage courant »), textes d'orage et de bilan (`text`), éclairs (`strike`), postes de maintenance (`jobsites`, posés au clic), et pour les montagnes russes `lap`, `stopBack`, `maxRun`, `preBrake`, `zones`, `yard.move` / `devName` / `devLabel`, `car.w` / `inline` / `pitch`, `plat`. **Freins de bloc par zone** : `zones.B<k>` = `trim.v` (vitesse limite), `launch` (vitesse de lancement), `stop` (arrêt obligatoire), `hold` (temps d'arrêt). **Déduits** (priorité `GAME` > `SITE` > déduction) : `holdBack`, `dropAfter`, `loadSide` ; **`SITE` peut les retirer** si la déduction convient. Salle de contrôle : `controlRooms[i].beacon` / `label` (gyrophare, étiquette). **Horaires par lieu** : `lieux/<type>/<lieu>/lieu.js` (`const LIEU={hours:{open:'10:00',close:'19:00'}}`, facultatif, chargé par `engine/moteur.js`, section « Lieu » de l'éditeur) ; absent = 10:00 à 19:00 comme avant. Profondeur des travées bornée aussi par le quai (Goudurix : ≈ 1,7 m). Pour un jeu : rien d'obligatoire ; ses outils de test qui comptent les erreurs de la console doivent tolérer l'absence de `lieu.js` comme celle de `game.js` (le navigateur signale le fichier introuvable). Sauvegardes inchangées (heure hors plage ramenée à l'ouverture).
- **0.2.0** (à étiqueter par le propriétaire) : la couche `engine/voies/` porte la mécanique partagée sans dessin (arrêt et zones d'attente, garage, aiguillage et pont transbordeur, commande par zones), pour un futur tram, métro ou bus ; `montagnes-russes/` garde la physique, le lift, les freins, le quai à portillons et tout le dessin, et déclare ses zones à `voies/` (`docs/ARCHITECTURE.md` D14). Nouvelle étape de chargement `reseau` (entre `modele` et `personnes`). Même rendu, mêmes règles, mêmes refus, mêmes sauvegardes (clé et format de 0.0.1). Pour un jeu : rien d'obligatoire.
- **0.1.0** (à étiqueter par le propriétaire) : moteur rangé en trois couches, `engine/noyau/`, `engine/voies/`, `engine/montagnes-russes/` (`docs/ARCHITECTURE.md` D14), même rendu, mêmes règles, mêmes sauvegardes (clé et format de 0.0.1). Pour un jeu : rien d'obligatoire. Nouveau : `SITE.extensions` (liste des couches ; défaut transitoire `['voies','montagnes-russes']` ; un élément finissant par `/` est un dossier du dépôt du jeu, relatif à `jeu.html`). Éditeur : sections « Attraction » et travées fournies par la couche (`engine/montagnes-russes/schema.js`, `editeur.js`, `GET /api/couches`).
- **0.0.1** (23/11/2026, commit 7330a04) : moteur au moment de la séparation des dépôts (montagnes russes du Parc Astérix : gare, lift, freins, garage, file, visiteurs, météo, sauvegarde ; éditeur : barrières, salle de contrôle, zone d'attente, travées, entrée de file, attraction, apparence, envoi vers OSM). Point d'entrée `engine/moteur.js`. Éditeur ouvert sur tout `lieux/<type>/<lieu>/<el>` d'un dépôt de jeu. Page de jeu de référence : `jeu.html` d'`osmrides_parks` (celle de l'étiquette 0.0.1 n'accepte en `?moteur=` que des versions de la forme `v1`). Le code propre aux montagnes russes est encore dans le moteur : séparation prévue (#51).
