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
- Choix du modèle : `testeur`/`explorateur` = Haiku ; `attraction` (corrections dans `sites/*.js`, specs, docs) = Sonnet ; `moteur` (`engine/*.js`, générique, revérifie les 4 attractions) = **Sonnet par défaut** (propriétaire 21/11, économie de tokens) ; Opus (`model: 'opus'` à l'appel) seulement pour une tâche difficile (garage, manœuvres, cantonnement) ou à la demande du propriétaire. Fable seulement si le propriétaire le demande.
- Consignes aux agents : donner fichiers, fonctions et sections à lire (repérés par `grep -n` du pilote), pour qu'ils ne cherchent pas eux-mêmes. Pas de testeurs en parallèle : l'agent teste lui-même, une attraction après l'autre. Mesure : #45 (éditeur, Opus) ≈ 180 000 tokens.
- Petite correction (une ligne, une couleur) : la faire directement, sans sous-agent.

## Branches et publication

- Branche de travail : `claude/t2z-token-optimization-eukolz`. Publication : pousser la même révision sur `main` (`git push origin HEAD:main`) → GitHub Pages republie https://qhess34.github.io/osmrides/ (workflow `.github/workflows/pages.yml`).
- Les sessions séparées travaillent sur leur propre branche (`claude/t2z-<sujet>`) ; le pilotage fusionne, relance les tests, publie.
- Avant de publier : `NODE_PATH=$(npm root -g) node tools/check.js zeus|hourra|oziris|goudurix` (PASS, offpath=0, strollQ=0, gatesMove=ok, 0 erreur). Un échec de clic sous la charge (tests en parallèle) se relance seul.

## Économie de tokens (règles du propriétaire)

- Captures : aucune pour la logique ; une petite capture par point visuel ; un seul montage par lot ; vignettes et tutos seulement en fin de grande étape (règle dans `AGENTS.md`).
- Ne jamais lire `sites/*.data.js` ni `parc/parc.data.js` en entier.
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

_Mis à jour le 2026-11-21 par la session de pilotage n° 7._

**Orientation (propriétaire)** : moteur générique + éditeur WYSIWYG local (Docker), création d'attraction sans IA. **OSM reste la référence** ; barrières de file posées à la main dans l'éditeur (#37). **Nouveau (D12, #46)** : tout réglage de l'éditeur qui a un équivalent OSM est lu dans OSM par défaut et renvoyable vers OSM à la demande (envoi direct OAuth2 depuis l'éditeur local) ; à prévoir pour chaque nouveau réglage.

**Publié sur `main` pendant la session n° 7 (21/11)** :
- #43 : hangar du garage de Zeus à toit opaque effacé comme la gare (choix du propriétaire).
- #45 : éditeur « Apparence de la file et du quai » (`GAME.look` : sol des allées et des quais, couleur + texture, garde-corps métal / bois / pierre, couleur des portillons), D11.
- #46 : `OSM.attrs` (surface, colour, material, roof:colour lus à l'import), badges « OSM » / « modifié », couleur du toit de la gare, bouton « Envoyer vers OSM » (`editor/osm-sync.js`, OAuth2 PKCE, contrôle de version, changeset) ; testé sur faux serveur seulement. Sol du quai en OSM = polygone `area:highway=footway` + `covered=yes` + `level=0` sous le toit (validé par le propriétaire).
- Économie de tokens : `AGENTS.md` 48 → 7 Ko, détail dans `docs/ref/*.md`, journal dans `docs/journal/2026-11.md` (ajout en fin sans relire), agent `moteur` en Sonnet par défaut, plus de testeurs en parallèle (l'agent teste lui-même, une attraction après l'autre).
- Mesures : #45 (Opus, ancien AGENTS.md) ≈ 180 k tokens ; réorganisation des docs (Sonnet) ≈ 125 k ; #46 (Sonnet, grosse tâche) ≈ 233 k.

**Issues ouvertes** : #5 (valeurs estimées) ; #30, #31, #32 à #46 faites, à valider / fermer par le propriétaire ; #35 (plus tard, lot 8).

**À faire par le propriétaire (#46)** : enregistrer l'application OAuth2 dans son compte OSM (redirection `http://127.0.0.1:8787/osm/callback`, client public, `write_api`), `editor/osm.local.json` (modèle `.example`), ouvrir http://127.0.0.1:8787/ (pas `localhost`) ; premier essai conseillé sur le serveur de développement OSM. Vrai envoi et vraie connexion jamais testés ici.

**Questions / suites possibles** : pitch / roll dans l'éditeur (depuis `roller_coaster:element`, pas d'issue) ; découper `docs/manoeuvres.md` et `engine/render.js` (économie de tokens, reporté). Hourra et OzIris ont des changements OSM récents non importés (salle de contrôle, quelques points) : réimport complet à proposer.

**Points de vigilance** :
- **Un seul `editor-test` à la fois** (il retire puis restaure les `sites/*.game.js` du propriétaire) ; vérifier `git diff origin/main -- 'sites/*.game.js'` avant de publier.
- Le propriétaire publie lui-même des `game.js` sur `main` : toujours `git fetch origin main` et fusionner avant de pousser.
- Un sous-agent ne peut pas lancer de sous-agent : il teste lui-même.
- Renouveler la session de pilotage après 3 ou 4 demandes. `api.openstreetmap.org` fonctionne ; Docker utilisable (`dockerd &`).
