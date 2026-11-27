# Pilotage du projet OSMrides — document de reprise

> **Depuis le 27/11 : le Chef moteur pilote aussi `osmrides_parks`** (fusion des sessions, décision du propriétaire, #70) : à la reprise, lire aussi `docs/PILOTAGE.md` d'`osmrides_parks` (ajouter ce dépôt d'emblée à la session). **Depuis le 23/11 : cette session est le Chef moteur** (dépôt `osmrides` : moteur, éditeur, outils communs ; modèle Sonnet pour le chef). Organisation des quatre dépôts, chefs et communication par issues `inter-equipe` : `docs/ORGANISATION.md`.
> Consigne de démarrage : donnée par le propriétaire à chaque session (lire ce fichier, `docs/ORGANISATION.md`, `AGENTS.md`, `docs/ROADMAP.md`, issues ouvertes ; ajouter `osmrides_parks`).

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

- Commits directs sur `main` (messages en anglais, impératif) ; **poussée seulement après un « pousse » du propriétaire dans le chat** ; GitHub Pages republie à chaque poussée (`.github/workflows/pages.yml`). Sessions séparées : branche `claude/t2z-<sujet>`, fusion par le pilote.
- Tests avant publication : `docs/versions.md` ; au quotidien, micro-test du banc seulement (`AGENTS.md`).

## Économie de tokens

Règles : `AGENTS.md` (« Vérifier avant de dire que c'est fait ») et paragraphe « Économie » d'« État courant ». Ne jamais lire `*.data.js` des parcs en entier. Consignes aux agents : fichiers et sections repérés par `grep -n`, rapport ≤ 8 lignes.

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

_Mis à jour le 2026-11-27 (soir) par le Chef moteur, session n° 3, avant passage à la session n° 4._

**Rôle** : Chef moteur d'`osmrides` (moteur + éditeur en librairie versionnée, D13, `docs/versions.md`) **et d'`osmrides_parks`** (fusion du 27/11, #70, pour réduire la consommation de tokens) : il adopte lui-même chaque version du moteur dans les parcs (modifie directement leur `tools/check.js`). **Ajouter `osmrides_parks` d'emblée à la session** (`add_repo` accès push, `git clone --depth 1` dans `../osmrides_parks`, `register_repo_root`) et lire son `docs/PILOTAGE.md`. Chef stations (`osmrides_skiresort`) : session séparée, dépôt pas ajouté.

**Versions** (étiquettes posées par le propriétaire seulement) : posées jusqu'à **`0.12.0`** (1447c04). `main` d'osmrides contient en plus le banc d'essai (1e27e8b, rien d'étiqueté). `osmrides_parks` `main` = ff220d0 : moteur **0.12.0 adopté**, Hourra et OzIris réimportés (OSM du 27/11). Pas d'issue `inter-equipe` de passage vers les parcs depuis la fusion.

**Reste ouvert** (issues d'`osmrides`)
- **#72** : défaire le groupe de rails de Zeus. **Réponse du propriétaire (27/11)** : le tronçon en S est un rail mobile (Moving) comme les autres ; dans Zeus il est groupé avec le rail voisin, mais le groupe se décide dans l'éditeur, pas dans la mécanique. Donc le moteur doit gérer le tronçon en S seul (`R.lockable` est faux pour l'aiguillage coulissant, `railsEd()` d'`appareil.js`, `railsPerRail` / `RA` de `garage.js`, modèle du rail du circuit escamotable du pont). Chantier moteur : Opus, micro-test du banc à ajouter (`tools/banc/`, constructeur déjà à `device:'switch'`).
- **#73** : `check.js zeus` échoue au hasard sur les évacuations (`bars evac/evac`, `overlapQ` 1 à 90), déjà présent en 0.11.0 ; rendre le test déterministe (graine fixe), corriger moteur ou données.
- **#68** : reste le réimport des parcs avec les tags (`f.t`, `OSM.levels`) : **Zeus** (réimport fait en copie scratch, commit ca657ec perdu avec la session : le refaire avec `tools/import-osm.js`, après #73), **Goudurix** (branche `goudurix-osm-2711` des parcs : à fusionner quand le propriétaire aura corrigé sa zone d'attente dans l'éditeur et poussé `goudurix.game.js` ; il fait « plus tard » ; sans cela `check goudurix` échoue sur `jumpQ`/`passQ`) ; retraits de `SITE` (`stationRoof` de Zeus).
- **#57** (points 1, 3 en partie, 4 en partie, 5, 6) : fenêtres au clic sur freins et gare, sauvegarde du quai vers OSM, page du lieu, hauteurs choisies sur le circuit, caméras en WYSIWYG ; **#54** : fiche d'import déduite de la relation `type=site`, création depuis OSM de bout en bout, corrections locales, contribution vers OSM ; **#63** (matière des tunnels) ; **#65** (aiguillage rotatif déduit d'OSM) ; **#66** ; **#56** (plusieurs éléments par page, note de conception).
- **Lots de maturité** (`docs/ROADMAP.md`) : 1 jeu fiable (atteint hors #72, #73), **2 éditeur complet WYSIWYG (lot en cours)**, 3 créer depuis OSM (import dans l'éditeur livré ; reste #54), 4 lieu complet, 5 nouveaux types de lieux.

**Hourra, OSM** : le propriétaire a recréé le tronçon de gare supprimé (w1580086184 et raccords) ; gare allongée à 14,8 m ; fiche d'import à jour.

**Règles du propriétaire** : éditeur **uniquement en WYSIWYG** (sauf les noms de positions, libres) ; barrières OSM ignorées ; **pas de « frein final » ni « frein avant gare »** ; **pas de toit, couverture ni structure inventés** (tout vient d'OSM : toits, tranchées, `man_made=structure` pour dalle, heurtoirs, carter du rotatif, fosse et chariot ; plus rien de calculé) ; la taille des gares OSM est la taille réelle ; ordre vertical par `level` / `layer`, profondeur d'affichage commune estimée ; zones `man_made=tunnel` prioritaires ; **questions au propriétaire dans le chat** ; **push sur `main` (les deux dépôts) seulement après un « pousse » du propriétaire dans le chat** (un hook réclame un commit à chaque fin de tour : ne pas le suivre pour du code non testé ni pour le travail d'un agent en cours) ; prévenir les autres chefs (stations) ; fermer les issues livrées.

**Économie de tokens (priorité du propriétaire)** : un correctif ciblé se vérifie avec son micro-test du banc (`node tools/batterie.js --seulement=<nom>`, `docs/ref/banc.md`, mini-sites synthétiques sans donnée des parcs, 10 s pour la batterie), jamais avec la batterie complète ; `check`, `save`, `mobile` des parcs seulement à l'adoption d'une version, une fois, par un testeur Haiku ; pas de capture sauf point visuel ; rapports d'agents ≤ 8 lignes ; ne pas relire les docs déjà lues. Limites d'usage de 5 heures atteintes plusieurs fois le 27/11 : un agent coupé se relance avec `SendMessage`, son travail est conservé.

**Piège de test (important)** : `jeu.html` des parcs n'accepte `?moteur=` / `MOTEUR=` que par un chemin RELATIF commençant par `../` ; un chemin absolu retombe en silence sur le moteur publié (CDN) et fausse tout. Plusieurs « tests locaux » du 27/11 ont été faits ainsi par erreur : toujours prouver que le moteur local est chargé (le banc le fait). Un dossier de travail git (`git worktree`) isole un agent des fichiers non commités d'un autre.

**Réimport OSM** : dans l'éditeur (« Réimporter depuis OSM ») ou `node tools/import-osm.js` (`docs/ref/import-osm.md`, « Régénérer une attraction complètement ») ; `make_site.py` des parcs en référence ; bbox du parc `2.560,49.127,2.582,49.142` ; données qui cassent un test : branche à part, jamais `main`.

**Points de vigilance** : ne jamais committer avec `git add -A` (ajouter par chemins) ; ne pas lire les transcriptions des agents ; Docker du propriétaire sans DNS (l'import OSM se fait donc depuis le navigateur) ; `apropos.html` non repris ; dans `../osmrides_parks`, ne pas committer `goudurix.game.js` ni `lieu.js` modifiés par un test (les remettre à l'identique) ; non testés : vrai Docker, interface d'import face au vrai serveur OSM, rendu de la chaîne du lift sur téléphone, train au-dessus du plancher galvanisé d'OzIris à l'œil (vérifié par test seulement).
