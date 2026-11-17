# Éditeur T2Z (local, Docker)

Éditeur WYSIWYG des données **du jeu** d'une attraction (lot 1 : barrières de file et salle de contrôle). Il ouvre la vraie page `jeu.html` (bac à sable, simulation figée) et ajoute une couche d'édition par-dessus : ce qui est affiché est exactement le rendu du jeu. Il n'écrit qu'un fichier : `sites/<site>.game.js`. Décisions : `docs/ARCHITECTURE.md` (D1 à D6).

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
- **Salle de contrôle** (une seule par attraction, celle du pupitre) : sans `game.js`, le jeu prend `SITE.booth` ; l'éditeur propose de la reprendre (bouton « Reprendre la salle », ou automatiquement à la première modification). Glisser = déplacer, coins = redimensionner, rond = tourner (côté vitre vers la voie). Supprimer / créer (seulement s'il n'y en a pas).
- **Différences et enregistrement** : résumé avant / après, diff ligne à ligne du fichier, validation par le serveur, puis **Enregistrer**. **Recharger** abandonne les modifications.
- Surcharge orpheline (barrière qui n'existe plus, par exemple après un changement de file) : signalée en rouge, supprimée seulement au bouton.

## Format écrit

`sites/<site>.game.js` = un en-tête de commentaires puis `const GAME = { … };` dont le corps est du **JSON strict** (D1). Chargé par `jeu.html` après `sites/<site>.js` (absent : ignoré) et inclus par `tools/build.py` s'il existe. Priorité : `GAME` > `SITE` > calcul du moteur.

```js
const GAME = {
  "barriers": { "fork:boucle nord:fork0": { "x": 7.02, "z": 53.33, "a": { "ang": -90.4, "len": 3.44 }, "b": { "ang": 166.4, "len": 2.1 } } },
  "controlRooms": [ { "id": "poste", "x": 2.25, "z": 8.6, "angle": 90, "w": 2.06, "d": 0.94, "main": true } ]
};
```

- `barriers` : clé stable `entry` ou `fork:<nom du tronçon de SITE.queue.parts>:<rôle>` (rôle `fork0` / `fork1` = pointe de départ / de retour du raccourci, `loop0`, `short1`… = barrière en travers d'un chemin) ; `x`, `z` = pivot (m) ; `a`, `b` = positions (angle en degrés, `atan2(dz, dx)`, longueur en m). Entrée : A fermée, B ouverte ; fourche : A en travers du raccourci, B en travers de la boucle.
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

`NODE_PATH=$(npm root -g) node tools/editor-test.js [goudurix zeus] [--check]` : éditeur ouvert, barrière et salle modifiées à la souris, salle supprimée puis créée, diff, sauvegarde, relecture après redémarrage du serveur, application dans `jeu.html` (géométrie, dessin, clic sur la carte, visiteurs) ; `--check` lance aussi `tools/check.js` avec le `game.js` écrit. Les `game.js` de test sont retirés à la fin.
