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

_Mis à jour le 2026-11-21 par la session de pilotage n° 7 (reprise de l'état de la n° 6)._

**Orientation (propriétaire)** : moteur générique + éditeur WYSIWYG local (Docker), création d'attraction sans IA. **OSM reste la référence** ; mais les **barrières de file ne viennent plus d'OSM** : posées à la main dans l'éditeur (#37). Lire `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` (D1–D10), `docs/manoeuvres.md` (section « Modèle »).

**Publié sur `main` pendant la session n° 6 (20/11)** :
- #32 éditeur : plafond de trains (`TRAIN_MAX`), réglages des trains à chaud, roues du coaster inversé sous la poutre.
- #33 importeur : `waiting` / `brake_run` / `moving` = zones d'attente qui freinent, rôle déduit de la position (« Frein final » = simple nom de la dernière zone avant la gare) ; quais déduits de la gare ; salle de contrôle OSM ; `ele` ; `roller_coaster:element` ; voies décoratives (`OSM.deco`) ; réimport des 4 attractions (Zeus complet, garage du Hourra depuis OSM).
- #36 zones toutes équivalentes, garage branchable sur n'importe quelle zone ; #38 aiguillage en amont d'un frein de bloc à marche arrière (essai `tools/yard-zone.js`).
- #34 puis #37 : barrières posées à la main (`GAME.barriers` `b<n>`), ouvertes / fermées une par une, une barrière fermée bloque tout le monde (évacués compris) ; file déduite d'OSM pour les 4 attractions (Zeus : raccourci w937019288).
- #39 éditeur : prolongement de l'entrée de file (`GAME.queueEntry`), largeur = chemin de file, aimant des barrières sur les bords d'allée (angle libre).
- #40 visiteurs en file devant une barrière fermée ; #41 voyant d'évacuation, barrière bloquante signalée, boutons du pupitre sans pictogramme ; #42 tunnels en galerie le long de la voie ; #43 Zeus : voie de maintenance qui cachait le train, gare redressée, hangar translucide ; #44 quai : arrivants qui respectent l'ordre de la zone d'attente.

**Issues ouvertes** : #5 (valeurs estimées, `ele`), #30, #31 et #32 à #44 faites et à valider / fermer par le propriétaire ; #35 (éditeur, plus tard : relier une voie décorative par un `moving` proche, lot 8).

**Réponses du propriétaire (21/11, session n° 7)** : hangar du garage de Zeus « comme les gares » → toit opaque effaçable, publié (f2ee3b3, #43) ; fin de file de Goudurix validée (#34) ; bug d'évacuation (#41) non reconstaté, considéré réglé. Reste sans issue : pitch / roll dans l'éditeur (depuis `roller_coaster:element`).

**Points de vigilance** :
- **Quota Opus** : les agents `moteur` ont été coupés deux fois par la limite de 5 h ; les reprendre par SendMessage après la remise à zéro (heure donnée dans la notification).
- **Un seul `editor-test` à la fois** : il retire puis restaure les `sites/*.game.js` du propriétaire (un passage en parallèle a effacé `goudurix.game.js`, restauré). Ne jamais commiter / pousser pendant qu'il tourne ; vérifier `git diff origin/main -- 'sites/*.game.js'` avant de publier.
- Agents en parallèle : worktree pour le second ; conflits fréquents sur `AGENTS.md` et le journal de `docs/NOUVELLE-ATTRACTION.md` (très longues lignes : fusion caractère par caractère depuis la version de base, script dans le scratchpad de la session n° 6, à refaire si besoin).
- Le propriétaire publie lui-même des `game.js` sur `main` : toujours `git fetch origin main` et fusionner avant de pousser.
- Tests en parallèle : échecs de clic sous la charge, relancer seul. Docker utilisable (`dockerd &`). `api.openstreetmap.org` fonctionne.
