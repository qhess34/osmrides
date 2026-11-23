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
- Choix du modèle : `testeur`/`explorateur` = Haiku ; `attraction` (corrections dans `lieux/parc/asterix/*.js`, specs, docs) = Sonnet ; `moteur` (`engine/*.js`, générique, revérifie les 4 attractions) = **Sonnet par défaut** (propriétaire 21/11, économie de tokens) ; Opus (`model: 'opus'` à l'appel) seulement pour une tâche difficile (garage, manœuvres, cantonnement) ou à la demande du propriétaire. Fable seulement si le propriétaire le demande.
- Consignes aux agents : donner fichiers, fonctions et sections à lire (repérés par `grep -n` du pilote), pour qu'ils ne cherchent pas eux-mêmes. Pas de testeurs en parallèle : l'agent teste lui-même, une attraction après l'autre. Mesure : #45 (éditeur, Opus) ≈ 180 000 tokens.
- Petite correction (une ligne, une couleur) : la faire directement, sans sous-agent.

## Branches et publication

- Branche de travail : `claude/t2z-token-optimization-eukolz`. Publication : pousser la même révision sur `main` (`git push origin HEAD:main`) → GitHub Pages republie https://qhess34.github.io/osmrides/ (workflow `.github/workflows/pages.yml`).
- Les sessions séparées travaillent sur leur propre branche (`claude/t2z-<sujet>`) ; le pilotage fusionne, relance les tests, publie.
- Avant de publier : `NODE_PATH=$(npm root -g) node tools/check.js zeus|hourra|oziris|goudurix` (PASS, offpath=0, strollQ=0, gatesMove=ok, 0 erreur). Un échec de clic sous la charge (tests en parallèle) se relance seul.

## Économie de tokens (règles du propriétaire)

- Captures : aucune pour la logique ; une petite capture par point visuel ; un seul montage par lot ; vignettes et tutos seulement en fin de grande étape (règle dans `AGENTS.md`).
- Ne jamais lire `lieux/parc/asterix/*.data.js` ni `lieux/parc/asterix/plan.data.js` en entier.
- Le pilote regarde le montage une seule fois et ne relit pas les rapports en détail inutilement.

## Renouvellement de la session de pilotage

Quand **l'un** de ces cas arrive :
- la conversation de pilotage devient longue (3 ou 4 demandes traitées, ou un lot terminé depuis le début de la session) ;
- une grande étape est terminée et publiée ;
- le propriétaire le demande ;

la session de pilotage :
1. termine ou met en pause proprement les tâches en cours (rien de non commité, branches poussées) ;
2. met à jour la section **« État courant »** ci-dessous (date, ce qui est publié, ce qui est en cours, issues ouvertes importantes, décisions récentes du propriétaire, points de vigilance) et commite ce fichier ;
3. crée une nouvelle session de pilotage (`create_session`, dépôt `qhess34/osmrides`, branche de travail, modèle choisi par le propriétaire ou celui de la session actuelle) avec pour consigne : « Tu es la session de pilotage de OSMrides. Lis `docs/PILOTAGE.md` (dont « État courant »), `AGENTS.md`, puis la liste des issues ouvertes de qhess34/osmrides. Reprends le pilotage et applique le mécanisme de renouvellement décrit dans `docs/PILOTAGE.md`. » ;
4. donne au propriétaire le nom de la nouvelle session et lui demande d'archiver l'ancienne (une session ne peut pas s'archiver elle-même).

## État courant

_Mis à jour le 2026-11-23 par la session de pilotage n° 8._

**Orientation (propriétaire)** : moteur générique + éditeur WYSIWYG local (Docker), création d'attraction sans IA ; OSM reste la référence ; réglages synchronisables avec OSM (D12). **Vision long terme ajoutée** (`docs/ROADMAP.md`) : code lisible et KISS ; briques réutilisables pour d'autres simulations OSM (transports en commun, domaines skiables) ; hiérarchie type → lieu (plusieurs par type) → éléments (#48, analyse seule d'abord).

**Publié sur `main` pendant la session n° 8 (21-23/11)** :
- Vision KISS / réutilisable / hiérarchie dans `docs/ROADMAP.md` et une ligne dans `AGENTS.md`.
- #47 : toits des bâtiments verts (remplissage commenté par erreur dans `drawBld`), corrigé, fermé.
- #45 suite : sol par chemin de file (`GAME.look.ways`), garde-corps dessinés comme le vantail de la barrière d'entrée (interprétation à confirmer), couleur des portillons sur les séparateurs des travées.
- #44 2e passe : premier arrivé premier servi sur tout le quai, mesures `passQ` / `jumpQ` dans `check.js` ; **cas du propriétaire non reproduit** (jumpQ=0 avant correction) : capture et attraction demandées dans l'issue.
- #30 fermée ; #5 : valeurs estimées à rendre réglables dans l'éditeur en synchro OSM (roll : aucun tag OSM établi).

**Issues ouvertes** : #44 (attente capture), #45 (à valider), #46 (OAuth2 OSM à enregistrer par le propriétaire), #5 (à détailler), #48 (hiérarchie, analyse).

**Prochaine tâche** : réponses du propriétaire sur #44 / #45 ; proposition d'analyse #48 ; lot 5 (file trouvée dans OSM sans liste, file visible dans l'éditeur) ; réimport Hourra / OzIris.

**Points de vigilance** :
- Un seul `editor-test` à la fois ; vérifier `git diff origin/main -- 'lieux/parc/asterix/*.game.js'` avant de publier ; toujours `git fetch origin main` et fusionner.
- `.claude/worktrees/` à ajouter à `.git/info/exclude` dans chaque nouveau conteneur (sinon le hook d'arrêt réclame un commit).
- Un agent `moteur` relancé par SendMessage peut renvoyer son compte rendu plusieurs fois : l'arrêter (TaskStop) une fois le rapport reçu.
- Deux agents en parallèle (le second en worktree) ont fonctionné ; conflit attendu sur `docs/journal/2026-11.md` (garder les deux lignes).
- Renouveler la session de pilotage après 3 ou 4 demandes.
