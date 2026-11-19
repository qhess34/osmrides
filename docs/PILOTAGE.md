# Pilotage du projet OSMrides — document de reprise

Ce fichier est la **mémoire du pilotage**. Toute session de pilotage le lit en premier et le met à jour avant de se terminer.
Il remplace l'historique des conversations : une nouvelle session doit pouvoir reprendre le travail avec lui seul, `AGENTS.md` et les issues GitHub.

## Rôle de la session de pilotage

- Chef de projet du jeu OSMrides pour le propriétaire (francophone, joue sur téléphone, édite OpenStreetMap lui-même).
- Elle **ne code presque pas** : elle reçoit les demandes, crée ou met à jour les issues, lance des sessions ou sous-agents, vérifie (tests + un seul montage), publie, fait un compte rendu court en français.
- Réponses au propriétaire en français, courtes, en langage non technique ; toujours dire ce qui est testé, non testé, estimé.

## Fonctionnement par issues

- Dépôt `qhess34/osmrides`. Chaque demande ou bug = **une issue** (titre court, besoin, attraction, critères de fin, étiquette : `attraction`, `moteur`, `osm`, `bug`, `question`, `docs`, `test-reel`). Les captures envoyées par le propriétaire sont décrites dans l'issue (ou copiées dans `docs/sources/` et référencées).
- Les questions au propriétaire sont posées dans une issue `question` ; il peut y répondre depuis GitHub.
- Réalisation : **une session neuve par issue** (ou petit lot d'issues liées), créée avec `create_session` sur la branche de travail, ou un sous-agent du dépôt (`.claude/agents/`) si la tâche est petite. La session lit l'issue, `AGENTS.md` et les fichiers concernés, rien d'autre.
- Choix du modèle : `testeur`/`explorateur` = Haiku ; `attraction` (corrections dans `sites/*.js`, specs, docs) = Sonnet ; `moteur` (`engine/*.js`, générique, revérifie les 4 attractions) = Opus. Fable seulement si le propriétaire le demande.
- Petite correction (une ligne, une couleur) : la faire directement, sans sous-agent.

## Branches et publication

- Branche de travail : `claude/t2z-token-optimization-eukolz`. Publication : pousser la même révision sur `main` (`git push origin HEAD:main`) → GitHub Pages republie https://qhess34.github.io/osmrides/ (workflow `.github/workflows/pages.yml`).
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
3. crée une nouvelle session de pilotage (`create_session`, dépôt `qhess34/osmrides`, branche de travail, modèle choisi par le propriétaire ou celui de la session actuelle) avec pour consigne : « Tu es la session de pilotage de OSMrides. Lis `docs/PILOTAGE.md` (dont « État courant »), `AGENTS.md`, puis la liste des issues ouvertes de qhess34/osmrides. Reprends le pilotage et applique le mécanisme de renouvellement décrit dans `docs/PILOTAGE.md`. » ;
4. donne au propriétaire le nom de la nouvelle session et lui demande d'archiver l'ancienne (une session ne peut pas s'archiver elle-même).

## État courant

_Mis à jour le 2026-11-19 (soir) par la session de pilotage n° 5._

**Orientation (propriétaire)** : moteur générique + éditeur WYSIWYG local (Docker), création d'attraction sans IA. **OSM reste la référence** (19/11) : ne rien éditer hors OSM qui puisse y être ; voir `docs/OSM-LIMITES.md` (#30). Lire `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` (D1–D9).

**Publié sur `main` pendant la session n° 5 (19/11)** :
- #24 éditeur : fin de file visible et aimant des sommets de la zone d'attente ; zone qui se remplit (réserve `BRES`, pas 2,4 m à la demande du propriétaire, `slot.res`).
- #26 évacuation : passagers assis d'un train à quai descendus par la sortie si sécurités ouvertes.
- #27 éditeur : profondeur des travées (`GAME.board.depth`, D8).
- #28 file : plus aucun chevauchement (`QPW`, `segSpots`, `qBehind`, `qBlocked`, mesure `overlapQ`).
- #29 OzIris : visiteurs visibles sur l'allée w1580105935 (`inCovQ`).
- #25 renommage en **OSMrides** (dépôt `qhess34/osmrides`, Pages https://qhess34.github.io/osmrides/) ; clés `t2z.*` gardées volontairement (sauvegardes).
- Logo `img/logo/` (carte pliée + montagnes russes de profil, choix du propriétaire), icônes par `tools/make_icons.js`, logo sur l'écran titre.
- #30 inventaire `docs/OSM-LIMITES.md` (analyse seule).
- #31 lot 3 fait : `GAME.site` (D9), section « Attraction » de l'éditeur (boutons « Origine », pas de pictogramme).

**Issues ouvertes** : #3 (vrai téléphone), #4 (vignettes / tutos à refaire, dont le nouveau nom et le logo), #5, #18 ; #19 à #29 et #31 faites, à valider puis fermer par le propriétaire ; **#30 : 8 questions au propriétaire en attente** (freins `waiting` → `brake_run`, garage du Hourra absent d'OSM, barrières de Zeus, quais `railway=platform`, salle de contrôle de Zeus depuis OSM, `roller_coaster:element`, périmètre des lots 4/5, réimport complet de Zeus).

**Prochaine tâche** : attendre les réponses à #30 avant tout développement des lots 4 et 5 (lot 5 peut-être presque automatique : files `oneway=yes`, barrières de même `ref` aux pointes). Sinon #4 (vignettes / tutos) ou corrections demandées.

**Décisions du propriétaire (19/11)** : OSM reste la référence ; nom OSMrides ; logo en profil ; réserve de la zone d'attente 4× plus espacée (2,4 m) ; « profondeur des portillons » = profondeur des travées.

**Points de vigilance** :
- Le remote git local pointe encore sur `qhess34/t2z` (redirection, poussées OK) ; les outils GitHub acceptent `qhess34/t2z`.
- Le propriétaire publie lui-même des `sites/*.game.js` sur `main` : toujours `git fetch origin main` et fusionner avant de pousser ; ne jamais réécrire ses réglages.
- Quota Opus : les agents Opus ont été coupés par la limite de 5 h (reprise par SendMessage après la remise à zéro) ; lot 3 fait avec Sonnet sans problème.
- Deux agents en même temps : le second en worktree (`isolation: worktree`), le pilote fusionne puis supprime le worktree. `.claude/worktrees/` exclu via `.git/info/exclude` (local).
- Tests en parallèle : échecs de clic sous la charge, relancer seul.
- Docker utilisable dans les sessions cloud : `dockerd &` puis `docker compose up -d`. github.io et le wiki OSM inaccessibles d'ici ; `api.openstreetmap.org` fonctionne.
