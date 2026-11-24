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

_Mis à jour le 2026-11-24 par le Chef moteur, session n° 1 (consigne de démarrage en tête de ce fichier)._

**Rôle** : Chef moteur d'`osmrides` = moteur + éditeur en librairie versionnée (D13, `docs/versions.md`). Jeux : `osmrides_parks` (Chef parcs), `osmrides_skiresort` (Chef stations). La session a accès en écriture à `osmrides_parks` (issues `inter-equipe`, pas de commit sur leur code).

**Versions** : étiquettes posées par le propriétaire seulement. Posées : `0.0.1`, `0.2.0`. Non posées : `0.1.0` (8e5f090, facultative), **`0.3.0`** (5bd63d4, lot 1 de #53, publié sur `main`).

**Décisions du propriétaire (24/11)** : hauteurs vers OSM = `ele` (altitude du sol **saisie dans l'éditeur** + hauteur de voie ; une IA peut aider, pas obligatoire) ; nouveaux réglages = version mineure (0.x.0), corrections = 0.x.1 ; horaires par lieu dans `lieux/<type>/<lieu>/lieu.js` (section « Lieu »). Le propriétaire a demandé si la couche montagnes russes n'est pas le travail du Chef parcs : réponse donnée (faite ici par accord du 23/11 dans #53, avant son déplacement) ; il peut demander de laisser le reste au Chef parcs.

**#53** : lot 1 fait (0.3.0). Reste lot 2 (couleurs de voie sans OSM, hauteurs `ele`, tunnel d'OzIris, `dropAfter` depuis le profil) puis lot 3 (ponts transbordeurs). Limites connues du lot 1 : `preBrake` seulement s'il existe dans `SITE` ; caméra de `SITE` non supprimable ; seuls les freins de bloc par zone. Puis **#54**.

**Inter-équipe** : `osmrides_parks#7` (adoption de 0.3.0 : créer `lieu.js` ou élargir le filtre des tests, sinon `check/save/mobile` échouent sur l'erreur « fichier introuvable »).

**Tests** : depuis `../osmrides_parks`, `MOTEUR=../osmrides/engine/ NODE_PATH=$(npm root -g) node tools/check.js <el>` (idem `save.js`, `mobile.js`) ; sans `lieu.js` ils échouent avec 0.3.0 (créer un `lieu.js` temporaire pour tester, puis le retirer). Ici : `tools/editor-test.js` (avec `JEU=../osmrides_parks`), `tools/osm-sync-test.js` : PASS au 24/11. Mesure : agent `moteur` Sonnet lot 1 ≈ 307 000 tokens, 33 min.

**Points de vigilance** : Docker du propriétaire sans DNS ; `apropos.html` non repris ; fiches `docs/ref/` citent parfois les anciens fichiers ; ne pas lire les transcriptions des agents ; renouveler la session après 3 ou 4 demandes (2 traitées dans cette session).
