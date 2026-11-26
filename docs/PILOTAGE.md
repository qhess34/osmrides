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

_Mis à jour le 2026-11-26 par le Chef moteur, session n° 2 (consigne de démarrage en tête de ce fichier)._

**Rôle** : Chef moteur d'`osmrides` = moteur + éditeur en librairie versionnée (D13, `docs/versions.md`). Jeux : `osmrides_parks` (Chef parcs, session `session_01UxooiVFPvJEwhWCYLay6Ap`), `osmrides_skiresort` (Chef stations). Accès en écriture à `osmrides_parks` (ajouter le dépôt à la session, cloner dans `../osmrides_parks`) pour les issues `inter-equipe` ; pas de commit sur leur code.

**Versions** (étiquettes posées par le propriétaire seulement) : posées jusqu'à **`0.6.0`** (5a6a748, ponts transbordeurs : lot 3 de #53). **`0.7.0`** poussée sur `main` (cd45bf2, #57 point 2 : `lap` mesuré en jeu, `maxRun` dans la section des trains, textes / éclairs / `dropAfter` retirés de l'éditeur) : **étiquette à poser par le propriétaire**, puis prévenir le Chef parcs (issue `inter-equipe` ; osmrides_parks#8 couvre 0.6.0).

**Décisions du propriétaire** : voir les commentaires de #53 et #56. Mode « un élément » conservé, plusieurs éléments par page à prévoir ; éléments non commandés dans l'état laissé par le joueur, passables en auto (#56). Nouveaux réglages = 0.x.0, corrections = 0.x.1.

**À faire, dans l'ordre proposé** :
1. **#58** (bugs de jeu, reçu 26/11) : bugs 1 à 3 d'abord (reprise de partie Zeus, barrière B3 fermée, fin d'orage), chacun avec son test ; puis audit du pupitre (tableau avant / après dans la note de version) et voies de garage de Zeus en WYSIWYG (aiguillage en S, mouvement synchronisé) : tâche difficile, agent Opus conseillé. **Question ouverte au propriétaire : usure (bug 4), maintenance explicite sans remise à zéro automatique ?**
2. **#57** : reste le point 3 (quais WYSIWYG lus dans OSM et renvoyables), puis 4 (fenêtres au clic, fin du « frein final » à part), 1 (page du lieu), 5 (hauteurs au clic), 6 (caméras), 7 (réimport sélectif : à rattacher à #54).
3. **#56** (plusieurs éléments par page) : note de conception, après #58 et #57.
4. #54 (import depuis OSM).

**Tests** : depuis `../osmrides_parks`, `MOTEUR=../osmrides/engine/ NODE_PATH=$(npm root -g) node tools/check.js <el>` (idem `save.js`, `mobile.js`), une attraction après l'autre ; ici `JEU=../osmrides_parks node tools/editor-test.js` et `tools/osm-sync-test.js`. PASS au 26/11. `mobile.js oziris` : un échec isolé relancé en PASS (probable charge). Mesures : lot 3 ≈ 164 k tokens, point 2 de #57 ≈ 142 k.

**Points de vigilance** : push sur `main` refusé par le classificateur sans « pousse » explicite du propriétaire dans le chat (un hook le réclame à chaque commit) ; ne pas committer avec `git add -A` ; limite hebdomadaire d'usage atteinte le 24/11 (remise à zéro le 26/11) ; Docker du propriétaire sans DNS ; `apropos.html` non repris ; fiches `docs/ref/` citent parfois les anciens fichiers ; dessin du pont avec valeurs réglées et dessin du tunnel d'OzIris non regardés en image ; ne pas lire les transcriptions des agents ; **session à renouveler** (cinq demandes traitées).
