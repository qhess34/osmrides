# Pilotage du projet OSMrides — document de reprise

> **Depuis le 23/11 : cette session est le Chef moteur** (dépôt `osmrides` : moteur, éditeur, outils communs ; modèle Sonnet pour le chef). Organisation des quatre dépôts, chefs et communication par issues `inter-equipe` : `docs/ORGANISATION.md`.
> Consigne de démarrage : « Tu es le Chef moteur d'OSMrides pour le dépôt osmrides. Lis `docs/PILOTAGE.md` (dont « État courant »), `docs/ORGANISATION.md`, `AGENTS.md` et les issues ouvertes, dont celles étiquetées `inter-equipe`. Reprends le travail, présente-toi en 3 lignes au propriétaire, puis attends ses demandes en français. »

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

_Mis à jour le 2026-11-23 (fin de matinée) par la session de pilotage n° 9._

**Orientation (propriétaire)** : moteur générique + éditeur WYSIWYG local, création sans IA ; OSM reste la référence ; réglages synchronisables avec OSM (D12) ; code KISS ; briques réutilisables pour d'autres simulations OSM. **Hiérarchie type → lieu → éléments en place** (#48, `docs/hierarchie.md`).

**Publié sur `main` pendant la session n° 9 (23/11)** :
- #44 : l'arrivant entre toujours dans la zone d'attente, avance au portillon par ordre d'arrivée (mesure `directQ` dans `check.js`).
- #45 : en métal, garde-corps de l'entrée prolongée (`QSIDE`, main courante sur poteaux) sur toutes les bordures de file (`QSIDE0`).
- #48 : migration faite. Fichiers dans `lieux/<type>/<lieu>/` (`lieux/index.js` = catalogue, `lieux/parc/asterix/<el>.data.js|.js|.game.js`, `plan.data.js`) ; `sites/`, `parc/` supprimés, `parc.html` → `plan.html` ; URL `jeu.html?type=parc&lieu=asterix&el=zeus` (`?site=` plus lu, sauf adresse interne de l'éditeur) ; sauvegardes `t2z.save.<type>.<lieu>.<el>.<mode>` (anciennes converties une fois). Points laissés : en-tête écrit par `editor/schema.js` cite encore `sites/` ; `tools/build.py` pose type/lieu en dur ; éditeur figé sur `lieux/parc/asterix`.
- Éditeur : choix « Tous » dans la liste des chemins de file (même sol sur chaque way).
- `docs/vars-notes.md` : étude OSM de Vars Les Claux (#49).

**Issues ouvertes** : #49 (Vars : réponses reçues, **prochaine grande tâche**), #48 (migration faite, à valider), #44 / #45 (à valider), #46 (OAuth2 OSM à enregistrer par le propriétaire), #5.

**Séparation faite (23/11, Chef moteur)** : le jeu du Parc Astérix (pages, `lieux/`, images, tests de jeu, skills, publication Pages) est dans `osmrides_parks` (copié par le Chef parcs, commit db9c5d2) et retiré d'ici. `osmrides` = `engine/`, `editor/`, `tools/jeu/`, tests de l'éditeur (sur `../osmrides_parks`), docs ; Pages = présentation du moteur (`index.html`), redirection de l'ancien `jeu.html`, `sw.js` de retrait. Docs de jeu encore ici (`NOUVELLE-ATTRACTION.md`, notes d'attractions, `ref/site.md`, `ref/tests.md`, `plans/`, `sources/`) : à retirer quand `osmrides_parks` les aura repris (osmrides_parks#3).

**Organisation (23/11)** : quatre dépôts créés et équipés (`AGENTS.md`, `docs/PILOTAGE.md`, agents explorateur / testeur / ouvrier) : `osmrides_parks`, `osmrides_skiresort`, `osmrides_website`. **osmrides = librairie versionnée** (propriétaire, 23/11, D13, `docs/versions.md`) : chaque jeu indique sa version (`MOTEUR='0.0.1'`) et charge le moteur en ligne ; l'éditeur se lance par version (`docker compose`, modèle `tools/jeu/compose.yaml`) ; le code propre aux parcs / au ski va dans leurs dépôts. `0.0.1` étiquetée par le propriétaire le 23/11 (#50) ; étiquettes posées par le propriétaire (push d'étiquette refusé aux sessions cloud). Reste au Chef moteur : retirer d'`osmrides` ce qui a été déplacé une fois les autres dépôts publiés ; v2 = sortir du moteur ce qui est propre aux montagnes russes (points d'extension).

**#49 passe au Chef stations** (`osmrides_skiresort`). Ancienne note : premier jeu « télésiège »** (Escondus V15, Vars Les Claux) dans `lieux/ski/vars/` : décisions du propriétaire : sièges, vitesse, sens, altitude **estimés et signalés** ; pistes affichées avec choix été / hiver ; premier jalon = cadence et embarquement seulement (pas de météo). Réutiliser visiteurs, file, pupitre, sauvegarde ; isoler ce qui est propre aux montagnes russes (KISS). Données OSM : tuiles ≤ 0,045 × 0,05° (limite 50 000 nœuds de l'API). Tâche lourde : session dédiée ou agent `moteur` en Opus.

**Points de vigilance** :
- Un seul `editor-test` à la fois ; vérifier `git diff origin/main -- 'lieux/**/*.game.js'` avant de publier ; toujours `git fetch origin main` et fusionner (le propriétaire publie ses `game.js`, désormais dans `lieux/parc/asterix/`).
- `.claude/worktrees/` à ajouter à `.git/info/exclude` dans chaque nouveau conteneur.
- Conflit attendu sur `docs/journal/2026-11.md` à chaque fusion de worktree : garder toutes les lignes.
- `check.js` peut échouer une fois sur un clic sous la charge : relancer seul.
- Les sous-agents ne lisent pas toujours les issues (GraphQL bloqué) : leur donner les réponses du propriétaire dans la consigne.
- Renouveler la session de pilotage après 3 ou 4 demandes.
