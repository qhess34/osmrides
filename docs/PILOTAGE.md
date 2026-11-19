# Pilotage du projet T2Z — document de reprise

Ce fichier est la **mémoire du pilotage**. Toute session de pilotage le lit en premier et le met à jour avant de se terminer.
Il remplace l'historique des conversations : une nouvelle session doit pouvoir reprendre le travail avec lui seul, `AGENTS.md` et les issues GitHub.

## Rôle de la session de pilotage

- Chef de projet du jeu T2Z pour le propriétaire (francophone, joue sur téléphone, édite OpenStreetMap lui-même).
- Elle **ne code presque pas** : elle reçoit les demandes, crée ou met à jour les issues, lance des sessions ou sous-agents, vérifie (tests + un seul montage), publie, fait un compte rendu court en français.
- Réponses au propriétaire en français, courtes, en langage non technique ; toujours dire ce qui est testé, non testé, estimé.

## Fonctionnement par issues

- Dépôt `qhess34/t2z`. Chaque demande ou bug = **une issue** (titre court, besoin, attraction, critères de fin, étiquette : `attraction`, `moteur`, `osm`, `bug`, `question`, `docs`, `test-reel`). Les captures envoyées par le propriétaire sont décrites dans l'issue (ou copiées dans `docs/sources/` et référencées).
- Les questions au propriétaire sont posées dans une issue `question` ; il peut y répondre depuis GitHub.
- Réalisation : **une session neuve par issue** (ou petit lot d'issues liées), créée avec `create_session` sur la branche de travail, ou un sous-agent du dépôt (`.claude/agents/`) si la tâche est petite. La session lit l'issue, `AGENTS.md` et les fichiers concernés, rien d'autre.
- Choix du modèle : `testeur`/`explorateur` = Haiku ; `attraction` (corrections dans `sites/*.js`, specs, docs) = Sonnet ; `moteur` (`engine/*.js`, générique, revérifie les 4 attractions) = Opus. Fable seulement si le propriétaire le demande.
- Petite correction (une ligne, une couleur) : la faire directement, sans sous-agent.

## Branches et publication

- Branche de travail : `claude/t2z-token-optimization-eukolz`. Publication : pousser la même révision sur `main` (`git push origin HEAD:main`) → GitHub Pages republie https://qhess34.github.io/t2z/ (workflow `.github/workflows/pages.yml`).
- Les sessions séparées travaillent sur leur propre branche (`claude/t2z-<sujet>`) ; le pilotage fusionne, relance les tests, publie.
- Avant de publier : `NODE_PATH=$(npm root -g) node tools/check.js zeus|hourra|oziris|goudurix` (PASS, offpath=0, strollQ=0, gatesMove=ok, 0 erreur). Un échec de clic sous la charge (tests en parallèle) se relance seul.

## Économie de tokens (règles du propriétaire)

- Captures : aucune pour la logique ; une petite capture par point visuel ; un seul montage par lot ; vignettes et tutos seulement en fin de grande étape (détail dans `AGENTS.md`).
- Ne jamais lire `sites/*.data.js` ni `parc/parc.data.js` en entier.
- Le pilote regarde le montage une seule fois et ne relit pas les rapports en détail inutilement.

## Renouvellement de la session de pilotage

Quand **l'un** de ces cas arrive :
- la conversation de pilotage devient longue (beaucoup d'échanges, ou plusieurs lots terminés depuis le début de la session) ;
- une grande étape est terminée et publiée ;
- le propriétaire le demande ;

la session de pilotage :
1. termine ou met en pause proprement les tâches en cours (rien de non commité, branches poussées) ;
2. met à jour la section **« État courant »** ci-dessous (date, ce qui est publié, ce qui est en cours, issues ouvertes importantes, décisions récentes du propriétaire, points de vigilance) et commite ce fichier ;
3. crée une nouvelle session de pilotage (`create_session`, dépôt `qhess34/t2z`, branche de travail, modèle choisi par le propriétaire ou celui de la session actuelle) avec pour consigne : « Tu es la session de pilotage de T2Z. Lis `docs/PILOTAGE.md` (dont « État courant »), `AGENTS.md`, puis la liste des issues ouvertes de qhess34/t2z. Reprends le pilotage et applique le mécanisme de renouvellement décrit dans `docs/PILOTAGE.md`. » ;
4. donne au propriétaire le nom de la nouvelle session et lui demande d'archiver l'ancienne (une session ne peut pas s'archiver elle-même).

## État courant

_Mis à jour le 2026-11-19 par la session de pilotage n° 4._

**Orientation (propriétaire, 17/11)** : moteur d'attractions générique + éditeur WYSIWYG local sous Docker, création d'attraction sans IA. Lire `docs/ROADMAP.md` (lots 0–10) et `docs/ARCHITECTURE.md` (décisions D1–D7). Historique : `docs/JOURNAL.md`, journal de `docs/NOUVELLE-ATTRACTION.md`.

**Publié sur `main` pendant la session n° 4 (18–19/11)** :
- #19 OzIris : réimports de la file souterraine (changesets 192117430, 192118796), raccourci B2 supprimé ; chemins de niveau -1/-2 masqués dans la gare tant qu'elle est affichée ; fin d'escalier -1 → 0 ; travées d'attente raccourcies (visiteurs collés au portillon) ; allées écartées des portillons ; garde-corps sans chevauchement (`buildRails`) ; allée 1580105935 jusqu'à la porte ; point « couvert / souterrain » seulement s'il longe le couloir (`onPl`) ; clôture de séparation prolongée (`qrailEnd`).
- #20 coaster inversé : plancher galvanisé pleine largeur (3,2 m sur OzIris, validé) ; supports dès 1,5 m au-dessus du sol (Goudurix en reçoit aussi, voulu).
- #21 (fermée) : chemin couvert sous un simple toit effaçable montré au zoom (escalier de Zeus) ; évacuation des travées d'attente par l'entrée de la file (validé).
- #22 éditeur : zone d'attente du quai en polygone (`GAME.boardAreas`, D7) ; le propriétaire en a dessiné une pour Zeus. Files souterraines : mêmes garde-corps que les autres, visibles gare masquée.
- #23 Zeus : garde-corps de la voie en bois retirés de la gare et des quais (`NORAIL`) ; opérateurs bornés au quai (`OPLIM`).
- Lot 2 fait : `id` / `v` OSM dans les données, `OSM.src`, catégories lues dans `docs/OSM-GUIDE.md` §7.
- Réimport de Zeus, Hourra, Goudurix (19/11) : `natural=bare_rock` = rocher (relation r22083041 de Hourra), 8 tronçons de voie de Goudurix retouchés, niveaux `lv`.

**Issues ouvertes** : #3 (vrai téléphone), #4 (vignettes / tutos, captures dépassées), #5 (valeurs estimées), #18 (niveaux OSM d'OzIris), #19, #20, #22, #23 (faites, à valider puis fermer par le propriétaire).

**Décisions du propriétaire (18–19/11)** : pas de barrière B2 sur OzIris ; couloir d'attente de Zeus à 3,1 m de la voie validé ; poteaux toujours présents sur voie surélevée ; `bare_rock` est un rocher ; files souterraines avec les mêmes garde-corps ; évacués des portillons repartent par l'entrée de la file.

**Prochaine tâche recommandée** : lot 3 (paramètres d'instance éditables, Sonnet) ou lot 4 (corrections locales OSM, Opus) ; #4 (vignettes / tutos) en fin de grande étape.

**Points de vigilance** :
- Le dépôt GitHub a été renommé `qhess34/osmrides` (redirection active depuis `qhess34/t2z`) ; mettre à jour l'URL du remote et les mentions du nom quand le propriétaire le confirme.
- Le propriétaire publie lui-même des `sites/*.game.js` sur `main` (éditeur) : toujours `git fetch origin main` et fusionner avant de pousser ; ne jamais réécrire ses réglages.
- `editor-test.js --check` échoue sur `gatesMove` pour Hourra et OzIris (barrières ajoutées par le test lui-même ; déjà le cas avant #22) : à corriger dans le test.
- Tests lancés en parallèle par deux agents : échecs de clic sous la charge, relancer seul.
- Deux agents en même temps : le second en worktree (`isolation: worktree`), sans pousser ; le pilote fusionne puis supprime le worktree. `.claude/worktrees/` est ignoré via `.git/info/exclude` (local).
- Quota hebdomadaire Opus atteint le 18/11 au soir (remis à zéro le 19/11, 11 h UTC) : reprendre l'agent avec SendMessage après la remise à zéro.
- `check.js`, `save.js`, `mobile.js`, `sound.js` ignorent l'erreur de chargement attendue de `game.js` absent.
- Docker utilisable dans les sessions cloud : `dockerd &` puis `docker compose up -d`.
- Les sessions cloud ne peuvent pas ouvrir github.io ni Wikimedia ; `api.openstreetmap.org` fonctionne.
