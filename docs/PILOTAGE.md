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

_Mis à jour le 2026-11-17 (soir) par la session de pilotage n° 3._

**Nouvelle orientation (propriétaire, 17/11)** : moteur d'attractions générique + éditeur WYSIWYG local sous Docker, création d'attraction sans IA. Lire d'abord `docs/ROADMAP.md` (lots 0–10, modèles) et `docs/ARCHITECTURE.md` (couches de données, décisions D1–D6, écarts OSM / jeu). L'ancienne feuille de route est `docs/JOURNAL.md`.

**Publié sur `main`** :
- Lots 10–12 du jeu : toits des abris effaçables, freins et pneus des voies de garage, rail du chariot continu (Hourra), train suspendu sous la poutre (OzIris), portillons ouverts vers le train sans dépasser le quai, réglage de patience (jusqu'à infinie), aide seulement au bouton « ? », barrières de file normalisées (#12) puis une barrière pivotante par pointe de fourche (#17), réimport OSM d'OzIris (#18).
- Lot 0 : nettoyage (45 images obsolètes supprimées), audit, roadmap.
- **Lot 1 fait** : éditeur `editor/` (Node sans dépendance, `compose.yaml`, port 127.0.0.1:8787), barrières (surcharges par clé stable `GAME.barriers`) et salle de contrôle unique (`GAME.controlRooms`, 0 ou 1) dans `sites/<site>.game.js` (facultatif, chargé par `jeu.html` et `build.py`). Test `tools/editor-test.js`. Aucun `game.js` réel encore : au propriétaire de corriger dans l'éditeur.

**Issues ouvertes** : #3 (vrai téléphone), #4 (vignettes / tutos), #5 (valeurs estimées), #18 (corrections de niveaux OSM d'OzIris à faire par le propriétaire, puis réimport).

**Décisions du propriétaire** : barrières = jeu (nœud OSM = position initiale) ; une seule salle de contrôle (pupitre), aiguillage plus tard.

**Prochaine tâche recommandée** : lot 2 (traçabilité OSM à l'import, Sonnet), puis lot 3 ou 5 en parallèle.

**Points de vigilance** :
- `check.js`, `save.js`, `mobile.js`, `sound.js` ignorent l'erreur de chargement attendue de `game.js` absent.
- Docker est utilisable dans les sessions cloud : `dockerd &` puis `docker compose up -d` (tester sur une copie appartenant à 1000:1000, le dépôt cloud appartient à root).
- Les sous-agents du dépôt (`moteur`, `attraction`) ne peuvent pas lancer `testeur` : ils testent eux-mêmes ; le pilote relance `check.js` ×4.
- Quotas : en cas de limite, reprendre l'agent (SendMessage) après la remise à zéro.
- Les sessions cloud ne peuvent pas ouvrir github.io ni Wikimedia ; `api.openstreetmap.org` fonctionne.
