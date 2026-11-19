# Éditeur OSMrides (local, Docker)

Éditeur WYSIWYG des données **du jeu** d'une attraction (lot 1 : barrières de file et salle de contrôle ; issue #22 : zone d'attente du quai d'embarquement ; issue #27 : profondeur des travées d'attente ; lot 3 : paramètres de l'attraction). Il ouvre la vraie page `jeu.html` (bac à sable, simulation figée) et ajoute une couche d'édition par-dessus : ce qui est affiché est exactement le rendu du jeu. Il n'écrit qu'un fichier : `sites/<site>.game.js`. Décisions : `docs/ARCHITECTURE.md` (D1 à D9).

Le dossier `editor/` et `compose.yaml` ne sont pas publiés par GitHub Pages ; le jeu publié n'a besoin ni de l'éditeur ni de Docker.

## Démarrer / arrêter

```sh
export T2Z_UID=$(id -u) T2Z_GID=$(id -g)   # les fichiers écrits appartiendront à votre utilisateur (défaut 1000:1000)
docker compose up -d                        # image node:22-alpine, aucune installation npm
# ouvrir http://127.0.0.1:8787/  (redirige vers /editor/?site=…)
docker compose logs -f                      # chaque écriture est journalisée
docker compose down
```

Sans Docker : `node editor/server.js` (Node 22, aucune dépendance ; `PORT`, `HOST`, `T2Z_ROOT` facultatifs).

## Utilisation

- Choisir l'attraction en haut. La carte se déplace et se zoome comme dans le jeu.
- **Barrières** (liste à droite ; sur la carte : orange = entrée, cyan = fourche ; point vert = barrière corrigée ; trait plein = position A, tirets = position B) : cliquer pour sélectionner, glisser pour déplacer le pivot, glisser les poignées **A** / **B** pour orienter et allonger chaque position. **Revenir au calcul auto** supprime la surcharge. Valeurs fines facultatives dans le panneau « Sélection ».
- **Supprimer la barrière** (barrière sélectionnée) : barrière calculée → surcharge `{"off": true}` (croix rouge sur la carte, « supprimée » dans la liste ; ignorée par le dessin, le clic et la logique du jeu ; **Rétablir la barrière** retire la surcharge) ; barrière ajoutée → retirée de `game.js`.
- **Ajouter une barrière** (sous la liste) : choisir la fourche, cliquer le bouton puis le pivot sur la carte ; A est posée en travers du raccourci, B en travers de la boucle (à ajuster aux poignées). Elle bascule avec sa fourche et se clique sur la carte du jeu. Une barrière ajoutée se rattache à une autre fourche par le choix **Fourche** du panneau « Sélection » (la clé `add:<fourche>:<n>` est renommée, la géométrie est conservée). Une barrière calculée supprimée reste listée (« supprimée ») et peut être rétablie, même après l'ajout d'une barrière sur la même fourche.
- **Salle de contrôle** (une seule par attraction, celle du pupitre) : sans `game.js`, le jeu prend `SITE.booth` ; l'éditeur propose de la reprendre (bouton « Reprendre la salle », ou automatiquement à la première modification). Glisser = déplacer, coins = redimensionner, rond = tourner (côté vitre vers la voie). Supprimer / créer (seulement s'il n'y en a pas).
- **Zone d'attente du quai** (section « Zone d'attente du quai », ou clic dans la zone sur la carte) : polygone entre la fin de la file et les portillons, où les visiteurs attendent juste derrière les portillons. Sans `game.js`, la zone calculée par le jeu est dessinée **en tirets** (travées et couloir d'attente) ; la première modification la reprend dans `game.js` (trait plein). Zone sélectionnée : glisser un **sommet** (carré) pour le déplacer, glisser ou cliquer un **rond** (milieu d'un bord) pour ajouter un sommet, glisser l'intérieur pour tout déplacer ; un sommet sélectionné se règle aussi au clavier (x, z) et se retire par **Supprimer le sommet** (3 sommets au moins). **Revenir au calcul auto** retire la zone de `game.js`. Les places d'attente sont recalculées en direct : deux par portillon, premier rang collé au portillon, puis une **réserve** en rangs successifs dans tout le polygone (la zone se remplit quand les places des portillons sont prises ; on avance à une place libérée), jamais hors du polygone. **Fin de la file** (toujours affichée, trait vert épais) : dernière portion du trajet des visiteurs vers le quai (fin du dernier tronçon de file puis `SITE.board.via`), **losange vert plein cerclé** = point où ils entrent dans la zone, losanges creux = bords de l'allée au bout de la file. **Aimant** : un sommet glissé (ou créé par un rond) se colle exactement au point de fin de file à moins de 11 px écran (sinon à un bord de l'allée) ; maintenir **Alt** pour le poser librement. Le polygone doit toucher la fin de la file ; les garde-corps de file qu'il recouvre disparaissent au rechargement du jeu.
- **Profondeur des travées d'attente** (section « Zone d'attente du quai », issue #27) : distance de la ligne des portillons au bout des séparateurs, en m. Valeur calculée par le jeu affichée par défaut (trait orange en tirets sur la carte) ; saisir une valeur ou glisser la **poignée** (losange orange, au portillon du milieu) la règle (`game.js`, trait plein) ; **Revenir au calcul auto** retire la clé. Le jeu en déduit le nombre de rangs (un au moins, 6 m au plus, ESTIMÉ), les séparateurs dessinés, le couloir d'attente juste derrière et le départ de la réserve ; les rangs au-delà des places des portillons servent de réserve à leur portillon (remplis quand les places du portillon sont prises). Le dégagement des allées de file le long du quai suit au rechargement du jeu.
- **Attraction** (section « Attraction », lot 3, D9) : règle sans code ce qui est écrit dans `SITE` : **sous-type** (bois, bobsleigh, inversé, acier ; avertissement : voie, gare et garage ne sont pas refaits), **wagons** (longueur, nombre par train, places, places côte à côte, sécurités ; longueur du train affichée, 40 m au plus), **trains** (nom, deux couleurs, usure, voie de garage au départ ; ajouter / retirer, de 1 à 8 ; le premier est à quai, chaque train garé a besoin d'une place au garage), **couleurs de la voie** (inversé / acier : poutre, rails, supports) ou **de la gouttière** (bobsleigh), **physique de base** (roulement, traînée, vitesse minimale). Chaque champ montre la valeur d'origine de `SITE` ; un champ modifié est entouré en doré ; **↺** revient à la valeur d'origine (la surcharge est retirée de `game.js`). Chaque modification **recharge le jeu en cadre** pour montrer l'effet (le brouillon non enregistré, barrières et zones comprises, est conservé). Valeur hors bornes : erreur dans « Fichier » et refus à l'enregistrement. Si le jeu ne se charge plus (par exemple trop de trains pour le garage), le bouton « Annuler la dernière modification » apparaît. Les valeurs de `SITE` sont des réglages de jeu, souvent ESTIMÉES (couleurs de train supposées, longueur de wagon) : ne pas les présenter comme mesurées.
- **Différences et enregistrement** : résumé avant / après, diff ligne à ligne du fichier, validation par le serveur, puis **Enregistrer**. **Recharger** abandonne les modifications.
- Surcharge orpheline (barrière qui n'existe plus, par exemple après un changement de file) : signalée en rouge, supprimée seulement au bouton.

## Format écrit

`sites/<site>.game.js` = un en-tête de commentaires puis `const GAME = { … };` dont le corps est du **JSON strict** (D1). Chargé par `jeu.html` après `sites/<site>.js` (absent : ignoré) et inclus par `tools/build.py` s'il existe. Priorité : `GAME` > `SITE` > calcul du moteur.

```js
const GAME = {
  "barriers": { "fork:boucle nord:fork0": { "x": 7.02, "z": 53.33, "a": { "ang": -90.4, "len": 3.44 }, "b": { "ang": 166.4, "len": 2.1 } } },
  "controlRooms": [ { "id": "poste", "x": 2.25, "z": 8.6, "angle": 90, "w": 2.06, "d": 0.94, "main": true } ],
  "boardAreas": [ { "id": "quai", "pts": [ [-1.2, 3.4], [9.8, 3.4], [9.8, 6.1], [-1.2, 6.1] ] } ],
  "board": { "depth": 2.6 },
  "site": { "trains": [ { "name": "Train 1", "col": "#2c4f8c", "col2": "#cfd3da", "wear": 26 } ], "phys": { "drag": 0.0012 } }
};
```

- `barriers` : clé stable `entry` ou `fork:<nom du tronçon de SITE.queue.parts>:<rôle>` (rôle `fork0` / `fork1` = pointe de départ / de retour du raccourci, `loop0`, `short1`… = barrière en travers d'un chemin), valeur `{x, z, a, b}` ou `{"off": true}` (supprimée) ; `add:<nom du tronçon>:<n>` = barrière ajoutée à la fourche de ce tronçon, `{x, z, a, b}` seulement ; `x`, `z` = pivot (m) ; `a`, `b` = positions (angle en degrés, `atan2(dz, dx)`, longueur en m). Entrée : A fermée, B ouverte ; fourche : A en travers du raccourci, B en travers de la boucle.
- `boardAreas` : 0 ou 1 polygone `{id, pts:[[x, z], …]}` (3 à 64 sommets, en m, bords qui ne se croisent pas, 0,5 m² au moins) ; absent ou `[]` = zone calculée par le jeu.
- `board` : `{depth}` = profondeur des travées d'attente derrière les portillons (m, de 0,5 à 6 ; le jeu garde au moins un rang) ; absent = calcul du jeu. Priorité `GAME` > `SITE.plat.depth` > calcul.
- `site` : surcharges partielles de `SITE`, clés autorisées seulement : `kind`, `car` (`len` 0,5 à 6 m, `n` 1 à 30, `seats` et `abreast` 1 à 8, `restraint` `lapbar` | `otsr` | `belt` ; `len` x `n` au plus 40 m), `trains` (liste complète de 1 à 8 : `name`, `col`, `col2` en `#rrggbb`, `wear` 0 à 100, `lane` 1 à 8 facultatif), `track` (`spine`, `rail`, `support` en `#rrggbb`), `trough` (`lo`, `hi` en `[r, g, b]`, `edge`, `deck`, `rim` en `#rrggbb`, `shine` en `rgba(…)`), `phys` (`roll` 0 à 0,3 ; `drag` 0 à 0,01 ; `vmin` 1 à 6). Fusion dans `SITE` au début de `engine/core.js` (objets en profondeur, tableaux remplacés) ; toute autre clé est refusée par la validation. Bornes ESTIMÉES.
- `controlRooms` : 0 ou 1 salle `{id, x, z, angle (degrés), w, d (m), main}` ; `[]` = aucune salle (ni pupitre dessiné, ni gyrophare, ni étiquette).
- Clés inconnues de l'éditeur (lots futurs) : conservées telles quelles, signalées.

## Sécurité

- Port publié sur `127.0.0.1` seulement ; le serveur refuse tout autre en-tête `Host` (rebinding DNS) et les écritures d'une autre origine ou non JSON.
- Conteneur : utilisateur non root (`T2Z_UID:T2Z_GID`), système de fichiers en lecture seule (`/tmp` en tmpfs), `cap_drop: ALL`, `no-new-privileges`, pas de socket Docker. Dépôt monté **en lecture seule**, sauf `sites/`.
- Le serveur sert le dépôt en lecture (GET), sans fichiers cachés (`.git`…) ni traversée de chemin, et n'écrit que `sites/<site>.game.js` pour un `<site>` dont `sites/<site>.js` existe, après validation (types, bornes, clés connues, 1 salle au plus ; `editor/schema.js`), par écriture atomique. Aucune opération Git, aucun accès réseau sortant.

## Flux Git → Pages

1. Éditer, voir les différences, enregistrer (fichier écrit sur l'hôte).
2. Vérifier dans le jeu : ouvrir `jeu.html?site=<site>` (fichier local) ; tests : `node tools/check.js <site>`.
3. `git diff sites/<site>.game.js`, puis commit et push sur `main` vous-même : GitHub Pages publie `sites/` (dont `game.js`) avec le jeu.

## Tests

`NODE_PATH=$(npm root -g) node tools/editor-test.js [goudurix zeus] [--check]` : éditeur ouvert, barrière et salle modifiées à la souris, barrière supprimée, barrière ajoutée puis supprimée puis rajoutée, salle supprimée puis créée, zone d'attente (sommet déplacé, ajouté, supprimé, retour au calcul, sommet déplacé de nouveau ; fin de file affichée, aimant au point de fin de file et au bord de l'allée, Alt sans aimant), diff, sauvegarde, relecture après redémarrage du serveur, application dans `jeu.html` (géométrie, dessin, clic sur la carte, visiteurs, visiteurs à leur place dans le polygone, deux par portillon au plus, évacuation depuis le polygone, réserve remplie, entrée au point de fin de file), profondeur des travées (calcul affiché, poignée glissée, valeur saisie, bornes, retour au calcul ; dans le jeu, avec et sans zone éditée : visiteurs dans les rangs ajoutés, à la profondeur choisie, évacuation) ; paramètres de l'attraction (couleur d'un train, trains retiré puis ajouté, sous-type, physique ; brouillon conservé au rechargement ; hors bornes signalé et refusé par le serveur, clé hors liste refusée, ↺ ; sauvegarde, relecture après redémarrage, SITE fusionné dans le jeu) ; `--check` lance aussi `tools/check.js` avec le `game.js` écrit. Les `game.js` de test sont retirés à la fin.
