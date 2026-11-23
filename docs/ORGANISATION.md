# Organisation en quatre dépôts et agents responsables

_Décision du propriétaire, 23/11/2026. Proposition de mise en œuvre par la session de pilotage n° 9, à valider._

## Dépôts

| Dépôt | Contenu | Pages |
|---|---|---|
| `qhess34/osmrides` | moteur générique (`engine/`), éditeur (`editor/`), outils communs (`tools/` : lecture OSM, tests génériques, build, PWA), docs d'architecture | démo technique + **moteur publié par version** |
| `qhess34/osmrides_parks` | parcs d'attractions : `lieux/parc/<lieu>/…` (données OSM, `SITE`, `game.js`), pages de jeu des parcs, tutos des parcs | jeux des parcs |
| `qhess34/osmrides_skiresort` | stations de ski : `lieux/ski/<lieu>/…`, ce qui est propre aux remontées, pages de jeu | jeux des stations |
| `qhess34/osmrides_website` | site d'accueil : présentation, jeux (liens), concepts, contribution (OSM, éditeur) | site d'accueil |

**Partage du moteur (recommandé)** : `osmrides` publie des versions (`v1`, `v2`… étiquettes git). Chaque dépôt de jeu **copie** une version figée du moteur dans `engine/` par un script (`tools/sync-engine.sh vN`), commitée. Raisons : le jeu doit marcher en `file://` sans serveur ni `fetch` (règle du projet) ; une version figée évite qu'un changement du moteur casse un jeu sans test. Monter de version = une tâche du chef de dépôt, tests à l'appui.

**Éditeur** : reste dans `osmrides` (générique) ; il ouvre un lieu de n'importe quel dépôt de jeu cloné à côté (`T2Z_ROOT`).

## Agents

Quatre **chefs** (orchestrateurs), un par dépôt, chacun dans sa propre session longue lancée par le propriétaire. Ils codent peu : ils lisent les issues, découpent, délèguent, vérifient, publient, rendent compte en français.

| Chef | Dépôt | Modèle du chef | Rôle |
|---|---|---|---|
| **Chef moteur** | `osmrides` | Sonnet | capacités génériques, éditeur, versions du moteur ; seul à modifier `engine/` |
| **Chef parcs** | `osmrides_parks` | Sonnet | attractions, données OSM des parcs, montée de version du moteur côté parcs |
| **Chef stations** | `osmrides_skiresort` | Sonnet | stations, remontées (Vars Les Claux, Escondus V15 en premier) |
| **Webmestre** | `osmrides_website` | Haiku | met le site à jour à chaque nouvelle fonctionnalité publiée |

Sous-agents (`.claude/agents/` de chaque dépôt), modèle selon la complexité :
- **Haiku** : `explorateur` (recherche en lecture seule), `testeur` (tests, résumé PASS/FAIL).
- **Sonnet** : `ouvrier` (corrections, données, pages, nouvelles attractions ou remontées).
- **Opus** : `architecte` (seulement dans `osmrides` : changement profond du moteur ; sur demande ailleurs).

## Communication entre chefs

- **Par issues GitHub, d'abord** (durable, lisible par le propriétaire, peu coûteux) : un chef qui a besoin d'un autre ouvre une issue **dans le dépôt de l'autre**, étiquette `inter-equipe`, avec le besoin, le critère de fin et le lien vers son issue d'origine.
  - Chef parcs ou stations → Chef moteur : « capacité générique manquante » ; le moteur répond par une version `vN` et une note de version.
  - Tout chef → Webmestre : « nouvelle fonctionnalité publiée » (titre, 3 lignes, lien, une capture si visuelle).
- **Par message de session** (`send_message`) seulement pour prévenir qu'une issue `inter-equipe` attend (une ligne avec le numéro), jamais pour transporter le contenu.
- Le propriétaire reste l'arbitre : toute question de fond passe par une issue `question` dans le dépôt concerné.

## Économie de tokens (règles communes)

- Le chef ne lit que : son `AGENTS.md`, son « État courant », les issues ouvertes. Le reste par `explorateur` (Haiku).
- Un sous-agent par tâche, consigne autonome (réponses du propriétaire recopiées dedans), rapport ≤ 8 lignes.
- Tests un par un par `testeur` (Haiku) ; captures seulement pour un point visuel (une petite, regardée une fois).
- Le Webmestre ne lit que les issues `inter-equipe` qui lui sont adressées et les fichiers du site.
- Chaque chef tient un `docs/PILOTAGE.md` court (« État courant ») et se renouvelle après 3 ou 4 demandes.

## Mise en place (ordre)

1. Propriétaire : installer l'application GitHub Claude sur les trois nouveaux dépôts (accès en écriture).
2. Chef moteur (session actuelle) : écrire `AGENTS.md`, `.claude/agents/` et `docs/PILOTAGE.md` de chaque dépôt ; créer l'étiquette `inter-equipe`.
3. Déplacer Parc Astérix vers `osmrides_parks` (données, pages, tutos), avec copie du moteur v1 ; vérifier les 4 attractions et la sauvegarde.
4. Déplacer l'écran titre, « À propos » et la présentation vers `osmrides_website` ; liens vers les jeux.
5. Créer `osmrides_skiresort` avec copie du moteur v1 et la note `docs/vars-notes.md` ; démarrer #49 (Escondus V15).
6. Propriétaire : lancer les quatre sessions de chefs avec la consigne de démarrage de leur `docs/PILOTAGE.md`.
