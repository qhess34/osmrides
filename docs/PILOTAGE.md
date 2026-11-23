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

_Mis à jour le 2026-11-23 (soir) par le Chef moteur, session n° 1 (consigne de démarrage en tête de ce fichier)._

**Rôle** : Chef moteur d'`osmrides` = moteur + éditeur en librairie versionnée (D13, `docs/versions.md`). Jeux : `osmrides_parks` (Chef parcs, Parc Astérix, publié sur https://qhess34.github.io/osmrides_parks/), `osmrides_skiresort` (Chef stations), futur `osmrides_transports` (décision du propriétaire, rien à faire maintenant). Pages d'osmrides = présentation du moteur (`index.html`), ancien `jeu.html` = redirection, `sw.js` = retrait du hors-ligne.

**Versions** : étiquettes posées par le propriétaire seulement (push d'étiquette refusé aux sessions cloud). `0.0.1` posée. `0.1.0` (8e5f090 : noyau / voies / montagnes-russes, D14) et `0.2.0` (d2a6db9 : garage, appareils, arrêts, commande par zones dans `voies/`) publiées sur `main`, **étiquettes non posées** à ce jour.

**Décisions du propriétaire (23/11)** : trois couches (#51) ; `voies/` = mécanique sans dessin, cantonnement facultatif (trams et bus peuvent se rattraper) ; zone d'attente et météo dans le noyau ; le plus économique ; ordre : 0.2.0 (fait) → #53 → #54 ; décor de Zeus (`SITE.draw`) → « décors personnalisés » ajoutés dans l'éditeur (générique) ; quais OSM `railway=platform` + `roller_coaster:station=load|unload` ; hauteurs renvoyées en `ele` sur les nœuds de voie ; import gardé en Python (`make_site.py`, dans osmrides_parks), image Docker avec Node + Python ; horaires d'ouverture par lieu (nouveau niveau de configuration `lieux/<type>/<lieu>/`).

**Prochaine tâche : #53** (réglages dans l'éditeur, lots : 6+4 → 0.2.x, puis 1+3, puis 5 ; plus décors personnalisés, horaires par lieu, freins par zone, `holdBack` / `dropAfter` / `loadSide` déduits, borne des travées selon le quai). Le Chef parcs attend la fin de #53 pour copier `montagnes-russes/`. Puis **#54** (bouton d'import et « Vérifier » appelant les outils du dépôt de jeu).

**Tests** : clone `../osmrides_parks` ; tests de jeu avec moteur local `MOTEUR=../osmrides/engine/ node tools/check.js <el>` (depuis le clone) ; `tools/editor-test.js` et `osm-sync-test.js` ici. `editor-test.js` : 1 FAIL connu (Goudurix, travées, quai 3,9 m), à corriger dans #53. `cdn.jsdelivr.net` est autorisé dans l'environnement cloud.

**Points de vigilance** : Docker du propriétaire sans DNS (`codeload.github.com` introuvable) ; `apropos.html` non repris (Webmestre, historique 11d4e28) ; fiches `docs/ref/` citent parfois les anciens fichiers du moteur ; ne pas lire les transcriptions des agents ; renouveler la session après 3 ou 4 demandes.
