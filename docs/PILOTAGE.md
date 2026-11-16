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

_Mis à jour le 2026-11-16 par la session « Optimisation tokens T2Z »._

**Publié sur `main`** (tout est aussi sur la branche de travail) :
- 4 attractions jouables : Tonnerre 2 Zeus, La Trace du Hourra, OzIris, Goudurix ; plan du parc ; écran titre, tutoriels, À propos ; PWA installable et hors ligne ; mobile et plein écran.
- Moteur commun : commande par zones (AUTO/MANU), règle du lift, règle de départ avec appareil hors de P, garages (aiguillage, pont transbordeur deux rails et rail unique, aiguillage rotatif en S), sécurités (lapbars/harnais, vérification par les opérateurs), synoptique, sauvegarde automatique, bac à sable, sons synthétisés, inversions (loop, vrilles), tunnels/rochers/passerelles/escaliers/zones piétonnes lus dans OSM, barrières de file (entrée/sortie liées, parallèles, pivotantes).
- Lot 6 (dernier) : quais au gabarit, portillons rapprochés, 14 portillons Goudurix, paliers en haut des escaliers, toit de Zeus sur tout le quai, files prolongées dans les zones piétonnes, pointillé des files couvertes. Guide `docs/OSM-GUIDE.md`.

**Issues ouvertes** : #1 questions du lot 6 ; #2 OSM barrières/escaliers/largeurs puis lecture par le jeu (le propriétaire édite OSM, attendre son « OSM mis à jour ») ; #3 vérifications sur un vrai téléphone ; #4 vignettes et tutos à rafraîchir en fin d'étape ; #5 valeurs encore estimées.

**Rien en cours** au moment du renouvellement : aucun sous-agent, aucune autre session active.

**Points de vigilance** :
- Les quotas : Opus/Fable peuvent atteindre la limite de 5 h ; reprendre l'agent (SendMessage) après la remise à zéro plutôt que d'en relancer un.
- Les sessions cloud ne peuvent pas ouvrir github.io ni Wikimedia ; `api.openstreetmap.org` fonctionne.
- Questions et réponses du propriétaire : historique dans `docs/plans/QUESTIONS.md` et `docs/*-notes.md` ; décisions de manœuvre dans `docs/manoeuvres.md`.
