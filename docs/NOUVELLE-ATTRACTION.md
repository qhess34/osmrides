# Ajouter une attraction — règles communes

Document de référence pour toute IA (Claude ou autre) ou personne qui ajoute une attraction à T2Z.
Il garantit que chaque nouvelle attraction reprend les mêmes concepts, le même rendu et le même pupitre que les précédentes.
**Le maintenir à jour** : toute session qui ajoute une capacité au moteur, un réglage `SITE` ou une convention graphique met ce fichier à jour dans le même commit.

Lire aussi : `AGENTS.md` (organisation du code, vérification), `docs/manoeuvres.md` (garage, aiguillage, pont transbordeur), `docs/ROADMAP.md` (ordre des tâches).

## 1. Principe

- Un seul moteur (`engine/*.js`) pour toutes les attractions. Une attraction = **des données** (`sites/<id>.data.js`, générées depuis OpenStreetMap) + **une configuration** (`sites/<id>.js`, écrite à la main). Rien de propre à une attraction dans le moteur : ni coordonnée, ni nom, ni texte.
- Si l'attraction a besoin d'une capacité absente (nouveau type de véhicule, de garage, de file…), on l'ajoute au moteur **de façon générique, pilotée par `SITE`**, on la documente ici, et on revérifie toutes les attractions existantes.
- Le joueur est toujours **chef d'attraction** : il ouvre la file, commande le pupitre, valide les départs, gère les pannes, la météo et le garage. Pas de construction de parc, pas de gestion de boutiques.

## 2. Concepts communs (ne pas réinventer)

| Concept | Règle |
|---|---|
| 2026-11-14 | Synoptique technique du circuit (plan, zones, freins de bloc, garage, trains numérotés en direct) au lieu du profil en hauteur ; bouton `#bSyn`, générique. |
| Circuit | Boucle fermée, abscisse `s` en mètres, 0 = début de gare. Repères `st0`, `st1`, `lift0`, `lift1`, `brk`, freins de bloc `blk1…`. |
| Cantonnement | Un train par canton ; le lift et les freins de bloc retiennent un train si le canton suivant est occupé. Au moins un canton de plus qu'il n'y a de trains sur le circuit. |
| Freins | Frein final (`brk` → arrêt à `holdBack` avant la fin du circuit) et freins de bloc `blk1…` (repères de la spec, patins dessinés sur ≈ 9 m avant chaque point d'arrêt). Chaque frein se ferme au pupitre, individuellement : `#bHold` (frein final), `#bBk1…#bBkN` (freins de bloc, `act('blk', n)`). Fermé, il arrête le prochain train même si le canton suivant est libre (message au journal) ; libéré, le cantonnement automatique reprend. Fermer est toujours permis. Voyant orange : un train est arrêté sur ce frein. |
| Quai | Un portillon par wagon. Le nombre de places par wagon **dépend de l'attraction** (`SITE.car.seats`, disposition côte à côte ou l'un derrière l'autre avec `car.inline`) ; au plus autant de visiteurs en attente au portillon que de places. Un wagon peut partir partiellement rempli (ex. Trace du Hourra : 1 ou 2 passagers). Embarquement d'un côté (`loadSide`), débarquement de l'autre. |
| Départ | Portillons fermés → deux opérateurs vérifient les lapbars → validation → départ. By-pass possible, avec risque d'amende. |
| File | Chemins réels OSM, tronçons et fourches avec barrières pivotantes cliquables sur la carte. Les visiteurs ne quittent jamais les chemins et ne franchissent que les barrières ouvertes (sauf évacuation). |
| Commande | **Par zones, jamais par train** : gare, lift, zones de freinage, chariot/aiguillage, voies de garage, chacune avec ses freins et moteurs (`docs/manoeuvres.md`). |
| Garage | Toujours via `SITE.yard` (`at` gare ou frein final, `device` `'switch'`, `'table'` (transfert en S) ou `'traverser'` (pont droit qui emporte le train : `side`, `gap`, `pre`, `post`, `laneGap`, `lanes:[{name, d, len, cap}]`, `retract:{d, name, rest}` pour un rail du circuit escamotable indépendant du chariot, `devName`/`devLabel`), géométrie `a`/`b`/`slide`/`side`/`len`, `lanes:[{name, pts, cap, off}]`, `move:{v, t, vc}`) et les commandes communes Positionner / Avancer / Reculer / Arrêter (`docs/manoeuvres.md`). Trains au garage au départ : tous sauf le premier, sur `SITE.trains[i].lane` ou la première voie libre. `SITE.maxRun` : nombre maximal de trains sur le circuit (défaut : tous) ; la sortie d'un train de plus est refusée. |
| Journée | Ouverture, fréquentation réglable, météo (pluie, orage = départs interdits), usure, pannes, maintenance, bilan de fin de journée. |
| Textes | Français, vocabulaire du métier : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur. Messages du journal courts, factuels, avec la raison d'un refus. |

## 3. Rendu graphique (identique partout)

- **Vue aérienne 2D, vue du dessus**, à l'échelle réelle (mètres). Pas de perspective, pas de 3D, pas de sprites dessinés à la main.
- **Réalisme sobre** : couleurs sourdes et naturelles, aucun emoji, aucun pictogramme, rien d'enfantin ni de cartoon.
- Sols et matières : utiliser **uniquement les textures du moteur** (`TEX.grass`, `lawn`, `canopy`, `wood`, `sand`, `dirt`, `asph`, `stone`, `water`, `rows`), transmises aux dessins propres au site via `API` (`{lw, person, TEX}`).
- Ombres portées dans la direction commune du moteur (`SHX`, `SHZ`) ; un élément haut (statue, tour) projette son ombre dans `draw.shadows`.
- Toits de gare et de garage qui s'effacent quand on zoome (`fade`), charpente visible dessous (`draw.underRoof`).
- Trains : couleurs du vrai matériel si connues, sinon teintes sourdes **signalées comme supposées**. Visiteurs : `person()` du moteur.
- Dessins spécifiques (statue, décor thématique) : seulement dans `SITE.draw.*` (`floor`, `shadows`, `stationRoof`, `underRoof`, `landmarks`), formes simples, matières mates, en restant cohérent avec le reste de la carte.
- Interface : thème de `jeu.html` (variables CSS `--bg #0f1626`, `--panel #18223a`, `--gold #f2c14e`, `--ok`, `--warn`, `--bad`, police système). Pupitre en boutons physiques (`.pb`, `.sel`, voyants `.lamp`), plaques de libellé `.plate`. Ne pas créer un autre style.
- **Synoptique** (commun, rien à écrire par attraction) : plan technique du circuit en haut à gauche de la vue (`drawSyn()`, `engine/render.js`), alimenté par la voie, les repères `blk<n>`, `SITE.yard` et l'état de jeu ; bouton `#bSyn`. Il remplace le profil en hauteur. Pas de pictogramme : traits fins, couleurs sourdes.
- Carte du parc (`parc.html`) : même palette ; les attractions avec simulateur sont en doré.

## 4. Fidélité et honnêteté

- Tracé, gare, file, sortie, garage : **pris dans OpenStreetMap**. Origine : `[lat, lon]` dans `tools/specs/<id>.json`, x vers l'est, z vers le sud.
- Tout ce qui est estimé (hauteurs, profil, longueur des wagons, couleurs, position du pont, sens des voies, vitesses) est **commenté comme estimé** dans `sites/<id>.js` ou dans la spec, et **annoncé au propriétaire**. Jamais présenté comme mesuré.
- Caractéristiques (longueur, hauteur, vitesse, nombre de trains) : sources citées dans `docs/<id>-notes.md` ; si elles se contredisent, le dire.
- En cas de doute sur l'exploitation réelle (garage, sens d'une voie), **poser la question au propriétaire** (noter la question dans `docs/ROADMAP.md`) plutôt qu'inventer.

## 5. Étapes

1. **Notes** : créer `docs/<id>-notes.md` (caractéristiques, sources, repères OSM, questions ouvertes).
2. **Données** : extrait OSM (`https://api.openstreetmap.org/api/0.6/map?bbox=…`), spec `tools/specs/<id>.json`, puis `python3 tools/make_site.py extrait.osm tools/specs/<id>.json sites/<id>.data.js apercu.png`. Croisements ≥ 3,2 m d'écart, vitesse plausible.
3. **Configuration** : `sites/<id>.js` en partant de `sites/zeus.js` (référence) ; garage dans `SITE.yard`, places par wagon dans `car.seats`. Ne jamais éditer `sites/<id>.data.js` à la main.
4. **Moteur** : seulement si nécessaire, générique, documenté ici, toutes les attractions revérifiées.
5. **Branchement** : carte dans `index.html`, `site` renseigné pour l'attraction dans `parc/parc.data.js` (via `tools/make_park.py`) et lien depuis `parc.html`, ligne dans `README.md`, tâche cochée dans `docs/ROADMAP.md`.
6. **Vérification** (voir § 6), puis commit.

## 6. Définition de « fait »

- `node tools/check.js <id>` : journée complète, **0 erreur de page**, PASS. Pour les nouvelles attractions, ajouter au besoin un scénario dans `tools/check.js` (garage, manœuvres).
- `node tools/check.js <id>` pour **chaque attraction existante** si le moteur a changé.
- Boutons du pupitre pour les scénarios : appareil `#yP`, `#y1`…`#yN` ; par train `#tG<i>` (retenir pour le garage), `#tF<i>` (Avancer), `#tB<i>` (Reculer), `#tX<i>` (Arrêter) ; `#bAuto`, `#bGate`, `#bGo`, `#bStop`, `#bHold`, `#bBk<n>`, `#bByp`.
- Captures regardées (vue d'ensemble, gare, garage pendant une manœuvre) : rendu cohérent avec Zeus.
- `python3 tools/build.py <id> dist/<id>.html` fonctionne.
- Compte rendu au propriétaire : ce qui a été testé, ce qui ne l'a pas été (souris réelle, tactile, son), ce qui est estimé.

## 7. Économie de tokens

- Ne jamais lire en entier `sites/*.data.js` ni `parc/parc.data.js`.
- Lire seulement le module du moteur concerné ; partir de `sites/zeus.js` comme modèle.
- Une attraction = une session ; la conception moteur dans une session séparée si elle est lourde.

## 8. Tenue de ce document

Modifier ce fichier quand on ajoute ou change : un réglage `SITE`, une capacité du moteur, une convention de rendu ou d'interface, une étape de vérification. Ajouter une ligne au journal ci-dessous.

| Date | Changement |
|---|---|
| 2026-11-14 | Couleurs de la gouttière réglables par `SITE.trough` (Trace du Hourra : rouge, d'après photo). |
| 2026-11-14 | T8 (correction du propriétaire) : `yard.retract` — rail A (circuit) escamotable à 2 positions (`#yA0` sur le circuit, `#yA1` retiré), indépendant du chariot du rail B (`#yG`, `#y1…#yN`, plus de `#yP`) ; verrouillages croisés (rail B en ligne seulement rail A retiré, rail A de retour seulement rail B hors ligne) ; Trace du Hourra : poste de conduite déplacé au sud-est de la gare (estimé). |
| 2026-11-14 | T8 : appareil générique `device: 'traverser'` (pont transbordeur droit, deux rails parallèles, le chariot emporte le train ; position G `#yG` ; arrêt avant le pont quand aucun rail n'est en ligne ; durée de déplacement selon la course, `move.vc`) ; Trace du Hourra migrée, ancien transfert en S retiré pour elle ; scénario `tools/check.js` mis à jour. |
| 2026-11-14 | Commande par zones (freins, moteurs, lift, chariot) au lieu de commandes par train. |
| 2026-11-14 | T4 : Trace du Hourra. Freins de bloc commandables un par un au pupitre (`#bBk<n>`, `G.blkLock`), patins dessinés pour chaque frein de bloc, message au journal quand un train est arrêté par un frein fermé (bloc ou final) ; `SITE.maxRun` ; garage `at: 'brake'` + `device: 'table'` à 6 voies vérifié (scénario dans `tools/check.js`). |
| 2026-11-14 | T3 : garage générique `SITE.yard` (aiguillage ou pont transbordeur, N voies), boutons `#yP/#yk`, `#tG/#tF/#tB/#tX` ; `car.seats` dans le moteur. |
| 2026-11-14 | Places par wagon propres à chaque attraction (`car.seats`). |
| 2026-11-14 | Création : concepts, rendu, fidélité, étapes, définition de « fait ». |
