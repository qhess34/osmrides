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
- Les questions au propriétaire sont posées **dans le chat** (décision du 26/11), plus dans des issues `question` ; ses réponses sont recopiées dans l'issue concernée.
- À chaque issue `inter-equipe` ouverte chez un autre chef, le prévenir par un message de session d'une ligne (numéro seulement). Fermer les issues livrées (commentaire de clôture) ; demander le même ménage aux autres chefs.
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

_Mis à jour le 2026-11-26 (soir) par le Chef moteur, session n° 3 (consigne de démarrage en tête de ce fichier)._

**Rôle** : Chef moteur d'`osmrides` = moteur + éditeur en librairie versionnée (D13, `docs/versions.md`). Jeux : `osmrides_parks` (Chef parcs, session `session_01UxooiVFPvJEwhWCYLay6Ap`), `osmrides_skiresort` (Chef stations, dépôt pas ajouté à la session). **À chaque nouvelle session, ajouter `osmrides_parks` d'emblée** (consigne du propriétaire 26/11 : `add_repo` accès push, `git clone --depth 1` dans `../osmrides_parks`, `register_repo_root`), sans attendre un test. Accès en écriture à `osmrides_parks` : l'ajouter à la session (`add_repo`, accès push), cloner dans `../osmrides_parks`, puis `register_repo_root` ; pas de commit sur leur code.

**Versions** (étiquettes posées par le propriétaire seulement) : posées jusqu'à **`0.9.0`** ; 0.10.0 posée (#60) ; **0.11.0 préparée, à étiqueter** (frein final supprimé, #57 point 4 en partie ; #67) (0.9.0 : abadae6, pupitre simplifié, #61 et #58 points 6 à 9 ; étiquette posée par le propriétaire le 26/11). Chef parcs prévenu de chaque version par une issue `inter-equipe` (osmrides_parks#8 à #15) et un message de session d'une ligne. **À son adoption de 0.9.0** : `check.js` et `tutos.html` à adapter (osmrides_parks#15 ; l'échec de `check.js` est voulu) ; le Chef parcs n'a pas été prévenu par message de session (refusé par le classificateur) : le propriétaire le prévient.

**Lots de maturité** (`docs/ROADMAP.md`, décision du propriétaire 26/11) : 1 jeu fiable sur le parc existant (presque atteint), **2 éditeur complet d'une attraction en WYSIWYG (lot en cours)**, 3 créer une attraction depuis OSM, 4 le lieu complet, 5 nouveaux types de lieux. Sous-tâches et modèles par lot dans la feuille de route ; les sous-issues « à créer » s'ouvrent au fur et à mesure.

**À faire, dans l'ordre**
1. _(fait : #61 et #58 livrés en 0.9.0)_
2. _(fait : #60 livré en 0.10.0, commit 03a9bb9)_ lift animé, AUTO (démarre un peu avant l'arrivée du train, rampes) ou MANU (marche / arrêt). Sonnet.
3. **#57 points 3 à 7** : quais en WYSIWYG lus dans OSM et renvoyables ; fenêtres au clic sur freins, gare, voies `moving` et fin du « frein final » à part (Opus) ; page du lieu ; hauteurs choisies sur le circuit ; caméras en WYSIWYG ; réimport sélectif (avec #54).
4. **#63** : matière des tunnels lue dans OSM (tag `material`, toutes les valeurs d'OSM), réglable dans l'éditeur et renvoyée vers OSM. Sonnet.
5. **#65** : aiguillage rotatif déduit du nœud OSM à trois branches (`railway=switch`, valeurs à vérifier), sans réglage dans l'éditeur ; le rotatif est la règle du type coaster (voie ferrée : aiguille ; ride aquatique : planche aiguille pivotant sur la pointe) ; Zeus est un rail coulissant qui ne porte pas de train (couvert par #64). Opus.
6. **#66** (à terme) : aiguillages hors zone de garage (Pégase Express, Toutatix), note de conception d'abord.
7. **#56** : plusieurs éléments par page : note de conception (mode « un élément » conservé ; éléments non commandés dans l'état laissé, passables en auto ; rôle par lieu avec des types d'objectifs différents). **#54** : création depuis OSM. #53 reste ouverte (lots 1 et 2 de l'issue livrés, lot 3 refait dans #64, reste du point 6 par #57). #48 et #49 : questions du propriétaire.

**Règles du propriétaire (26/11)** : **pas de « frein final » ni de « frein avant gare »** comme notions (zones de freinage ordinaires, règle dans `AGENTS.md`, suppression du code avec #57 point 4) ; **`osmrides_parks` ajouté d'emblée à chaque session** (règle `add_repo` dans `.claude/settings.json`) ; éditeur **uniquement en WYSIWYG** (pas de valeur à saisir) ; **barrières OSM ignorées** (seules les barrières posées dans l'éditeur existent) ; **usure** : pas un bug, rien à changer ; **« Départ »** envoie le train hors de la gare (garage ou circuit selon l'aiguillage) ; **questions au propriétaire dans le chat**, pas dans des issues ; **push sur `main` seulement après un « pousse » du propriétaire dans le chat** (le classificateur le refuse sinon ; un hook le réclame à chaque commit : ne pas le suivre pour du code non testé ni pour le travail d'un agent en cours) ; prévenir les autres chefs par message de session à chaque issue `inter-equipe` ; fermer les issues livrées (commentaire de clôture) et demander le même ménage aux chefs ; **tests sans doublon** (osmrides_parks#12 : la note de version fait foi ; un seul `check.js` à l'adoption sans changement de `SITE`).

**Tests** : depuis `../osmrides_parks`, `MOTEUR=../osmrides/engine/ NODE_PATH=$(npm root -g) node tools/check.js <el>` (idem `save.js`, `mobile.js`), une attraction après l'autre, jamais en parallèle ; ici `JEU=../osmrides_parks NODE_PATH=$(npm root -g) node tools/editor-test.js`, `tools/osm-sync-test.js`, `tools/bugs58-test.js`, `bugs59`, `bugs62`. PASS au 26/11 (0.8.0), sauf `check.js zeus` (échec voulu, voir plus haut). Un échec isolé de `mobile.js` (OzIris) et de `check.js` (Goudurix, `overlapQ`) est déjà arrivé, relancé en PASS (probable charge).

**Mesures de tokens (agents)** : lot 3 de #53 ≈ 164 k (Sonnet), #57 point 2 ≈ 142 k, #58 bugs 1 et 2 ≈ 235 k, bug 3 ≈ 92 k, #59 ≈ 134 k, #62 ≈ 160 k (Opus), #64 ≈ 299 k (Opus). Limites d'usage atteintes le 24/11 (hebdomadaire) et le 26/11 (5 heures, remise à zéro 16 h UTC) : un agent coupé se relance avec `SendMessage`, son travail est conservé.

**Points de vigilance** : ne jamais committer avec `git add -A` (ajouter par chemins) ; ne pas lire les transcriptions des agents ; Docker du propriétaire sans DNS ; `apropos.html` non repris ; fiches `docs/ref/` citent parfois les anciens fichiers ; historique des barrières « déduites » (journal du 20/11, ROADMAP) remplacé par #37 ; dans la copie locale `../osmrides_parks`, `lieux/parc/asterix/goudurix.game.js` apparaît modifié (trace d'un test de l'éditeur, pas du propriétaire : ne pas le committer, le remettre à l'identique avant de tester) ; non regardés en image : dessin du pont avec positions réglées (capture `docs/plans/issue-64.jpg` : étiquettes qui se chevauchent un peu sur Hourra), tunnel d'OzIris avec profil négatif ; non testés : glisser à la main dans le vrai Docker, `check`/`save`/`mobile` avec positions de rails dans un `game.js`.
