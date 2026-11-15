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
| 2026-11-15 | Tunnels génériques : `OSM.tunnels` exporté par `make_site.py` (tronçons `tunnel=yes` / `covered=yes` layer<0, converti en s du moteur), couverture (eau ou remblai, `SITE.tunnels`), portails, synoptique en pointillé, toits retirés ; OzIris (way 421460641, sous l'eau). |
| 2026-11-14 | Synoptique technique du circuit (plan, zones, freins de bloc, garage, trains numérotés en direct) au lieu du profil en hauteur ; bouton `#bSyn`, générique. |
| Circuit | Boucle fermée, abscisse `s` en mètres, 0 = début de gare. Repères `st0`, `st1`, `lift0`, `lift1`, `brk`, freins de bloc `blk1…`. |
| Cantonnement | `SITE.singleCourse:true` (sans frein de bloc) : un seul train entre la fin du lift et le frein final, le lift retient le train au sommet (chaîne arrêtée) tant qu'un train occupe cette zone (Goudurix) ; avec frein de bloc, le lift retient déjà le train tant que le premier canton est occupé. Un train par canton ; le lift et les freins de bloc retiennent un train si le canton suivant est occupé. Au moins un canton de plus qu'il n'y a de trains sur le circuit. |
| Freins | Frein final (`brk` → arrêt à `holdBack` avant la fin du circuit) et freins de bloc `blk1…` (repères de la spec, patins dessinés sur ≈ 9 m avant chaque point d'arrêt). Zones de freinage `Fin`, `B1…Bn` (et `RA` pour un pont droit, `RB` pour un pont à rail unique, `Pre` pour un frein avant gare `SITE.preBrake:{back, len, name}` : stockage d'un train juste avant la gare, avec pneus) : **AUTO par défaut** (cantonnement) ; chacune passe en MANU au pupitre (`#zFin_m`, `#zB<n>_m`), puis se serre / relâche (`#zFin_k`, `#zB<n>_k`) ; serrée, elle arrête le prochain train même si le canton suivant est libre ; relâchement refusé si la section suivante est occupée ; `#zAuto` remet tout en AUTO. |
| Quai | Un portillon par wagon. Le nombre de places par wagon **dépend de l'attraction** (`SITE.car.seats`, disposition côte à côte ou l'un derrière l'autre avec `car.inline`) ; au plus autant de visiteurs en attente au portillon que de places. Un wagon peut partir partiellement rempli (ex. Trace du Hourra : 1 ou 2 passagers). Embarquement d'un côté (`loadSide`), débarquement de l'autre. |
| Départ | Portillons ouverts et fermés **seulement au bouton** (`#bGate`, en auto aussi) → portillons fermés, deux opérateurs vérifient les lapbars → validation → départ. Un train prêt attend la fermeture des portillons. By-pass possible, avec risque d'amende. |
| Visiteurs (couloirs) | Aucun trajet en ligne droite à travers murs, voie ou portillons : embarquement file → `board.via` → couloir d'attente (`board.walk` m de la voie, derrière les portillons) → place d'attente de sa travée (un portillon par wagon, deux visiteurs par portillon) → portillon **ouvert** seulement (un portillon ne se referme pas sur un visiteur qui le franchit) → siège ; débarquement siège → quai de débarquement (côté opposé à `loadSide`, couloir à `plat.walkU` m de la voie, par défaut milieu de `plat.exit`) → `exit.door` (porte de sortie, dans le mur de la gare) → `exit.path` (qui commence à la porte) → `exit.tails` ; abandons et évacuations : retour par les tronçons de la file puis le chemin d'approche, demi-tour sur le chemin d'arrivée pour ceux qui n'ont pas encore atteint l'entrée ; promeneurs : les allées OSM sont coupées là où elles traversent la gare. `plat.exit` > 0 obligatoire (profondeur du quai de débarquement) ; `exit.door`, `plat.walkU`, `plat.exit` sont ESTIMÉS d'après le bâtiment OSM de la gare. |
| File | Chemins réels OSM, tronçons et fourches avec barrières pivotantes cliquables sur la carte. Les visiteurs ne quittent jamais les chemins et ne franchissent que les barrières ouvertes (sauf évacuation). |
| Commande | **Par zones, jamais par train** (T7) : sections Gare (`St`), Lift, Zones de freinage (`B<n>`, `Fin`, `RA`, `RB`, `Pre`), Garage (appareil + voies `L<k>` : freins, Reculer, Arrêt, **pas d'Avancer** ; l'entrée dans une voie est poussée par la zone porteuse `RB` / `St` / `Fin`), chacune avec freins (`_k`, sauf la gare : freins liés au départ, fermés tant qu'un train est à quai, relâchés par la seule séquence Départ ; pas de `#zSt_k`) et, selon `SITE.zones` (`{<id ou groupe B/L>:{brake, drive}}` ; défaut : moteurs partout sauf freins de bloc, à signaler comme estimé), moteurs Avancer / Reculer / Arrêt (`_f`, `_b`, `_x`) ; lift `#zLift_on/_off`. Ids et règles : `docs/manoeuvres.md`, `AGENTS.md`. |
| Garage | Toujours via `SITE.yard` (`at` gare ou frein final, `device` `'switch'`, `'table'` (transfert en S) ou `'traverser'` (pont droit qui emporte le train : `side`, `gap`, `pre`, `post`, `laneGap`, `lanes:[{name, d, len, cap}]`, `retract:{d, name, rest}` pour un rail du circuit escamotable indépendant du chariot, `single:true` pour un pont à **rail unique** (le rail du chariot EST le tronçon du circuit, zone `RB` « Rail du pont » AUTO/MANU, positions `#yP`, `#y1…#yN`, pas de `G` ; `railName`), `rev:true` pour des voies **en amont** du pont (le train y entre en marche arrière, poussé par le rail de garage `#zRB_b` ; il en sort par `#zL<k>_b`, étiqueté AV : `_b` = toujours « sortir de la voie vers l'appareil »), `devName`/`devLabel`), `back:true` (aiguillage EN AMONT de la gare, `at:'station'` : le train entre dans la voie en marche arrière depuis la gare, `a`/`b` = distances en remontant le circuit depuis l'arrêt de la tête du train, du bord de l'appareil côté gare puis de la pointe ; la voie recopie le circuit sur `b−a` m puis suit `lanes[].pts` ; zone Gare AR = entrée, voie AV = sortie), `rotary:true` (aiguillage rotatif : un rail qui tourne sur lui-même autour du tube, au lieu du tronçon coulissant ; durée `move.t`, `slide:1`), géométrie `a`/`b`/`slide`/`side`/`len`, `lanes:[{name, pts, cap, off}]`, `move:{v, t, vc}`) et les commandes de zone communes (`docs/manoeuvres.md`). Trains au garage au départ : tous sauf le premier, sur `SITE.trains[i].lane` ou la première voie libre. `SITE.maxRun` : nombre maximal de trains sur le circuit (défaut : tous) ; la sortie d'un train de plus est refusée. |
| Coaster inversé | `kind:'inverted'` : poutre caisson et rails (couleurs `SITE.track = {spine, rail, support}`), supports en potence au-dessus de la voie, trains suspendus **dessous** (dessinés avant la voie), ombre portée depuis le wagon ; `car.abreast` = places côte à côte par rangée (4 pour un inversé B&M, une seule rangée). |
| Coaster acier assis | `kind:'steel'` : deux rails tubulaires reliés par des entretoises (`SITE.track = {spine, rail, support}` : voie jaune et supports rouges pour Goudurix), supports en A au-dessus de 1,5 m dont les jambes s'écartent avec la hauteur, wagon posé sur la voie (`car.seats:4`, `car.abreast:2` = 2 rangées de 2). Les anneaux intérieurs des multipolygones OSM (lac dans une place piétonne) sont gérés par `tools/make_site.py` (`h` dans les éléments de décor) : à régénérer pour que les anciens sites en profitent. |
| Journée | Ouverture, fréquentation réglable, météo (pluie, orage = départs interdits), usure, pannes, maintenance, bilan de fin de journée. |
| Sauvegarde | **Automatique et générique** (`engine/save.js`, chargé en dernier) : état de la partie, trains, file, visiteurs, quai, garage, zones, maintenance, caméra, enregistré dans `localStorage` `t2z.save.<SITE.id>.<mode>` (fermeture, changement de page, lien, toutes les 30 s) et repris au chargement. Une nouvelle attraction l'obtient sans rien écrire, tant que `SITE.id` est unique : tout champ ajouté à `G` ou à un train (valeurs simples) est sauvegardé tout seul ; seul un nouvel objet partagé (liste, référence croisée) demande une ligne dans `capture()` / `restore()`. Une signature de géométrie (longueur du circuit, trains, voies, zones, file) invalide une sauvegarde devenue incompatible. |
| Mode | Carrière (budget, météo, pannes, usure) ou **bac à sable** (`G.sandbox`, `?mode=sandbox`, choix mémorisé `t2z.mode` depuis `index.html` ou « Nouvelle partie ») : `pay()` sans effet, pas de recettes, météo toujours claire, usure maintenue à 0 (donc ni panne de lift / freins / lapbars ni voie hors service), pas de verdict financier. Tout nouveau coût ou aléa doit respecter `G.sandbox`. |
| Textes | Français, vocabulaire du métier : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur. Messages du journal courts, factuels, avec la raison d'un refus. |

## 3. Rendu graphique (identique partout)

- **Vue aérienne 2D, vue du dessus**, à l'échelle réelle (mètres). Pas de perspective, pas de 3D, pas de sprites dessinés à la main.
- **Réalisme sobre** : couleurs sourdes et naturelles, aucun emoji, aucun pictogramme, rien d'enfantin ni de cartoon.
- Sols et matières : utiliser **uniquement les textures du moteur** (`TEX.grass`, `lawn`, `canopy`, `wood`, `sand`, `dirt`, `asph`, `stone`, `water`, `rows`), transmises aux dessins propres au site via `API` (`{lw, person, TEX}`).
- Ombres portées dans la direction commune du moteur (`SHX`, `SHZ`) ; un élément haut (statue, tour) projette son ombre dans `draw.shadows`.
- Toits de gare et de garage qui s'effacent quand on zoome (`fade`), charpente visible dessous (`draw.underRoof`).
- **Tunnels** (communs) : `OSM.tunnels` (tronçons du circuit tagués `tunnel=yes` / `covered=yes` + `layer<0` dans OSM, exportés par `tools/make_site.py` en abscisses du moteur) : voie et trains cachés par une couverture (eau `TEX.water` si le tunnel est sous un plan d'eau OSM, sinon remblai enherbé ; forçable par `SITE.tunnels:[{under,w}]`), portails en béton avec ouverture sombre, tracé en pointillé au synoptique, couverture translucide avec « Toits retirés ». Mettre dans le profil de la spec une hauteur sous le sol (profondeur ESTIMÉE) ; les polygones `man_made=tunnel` restent dessinés comme avant.
- Trains : couleurs du vrai matériel si connues, sinon teintes sourdes **signalées comme supposées**. Visiteurs : `person()` du moteur.
- Dessins spécifiques (statue, décor thématique) : seulement dans `SITE.draw.*` (`floor`, `shadows`, `stationRoof`, `underRoof`, `landmarks`), formes simples, matières mates, en restant cohérent avec le reste de la carte.
- Interface : thème de `jeu.html` (variables CSS `--bg #0f1626`, `--panel #18223a`, `--gold #f2c14e`, `--ok`, `--warn`, `--bad`, police système). Pupitre en boutons physiques (`.pb`, `.sel`, voyants `.lamp`), plaques de libellé `.plate`. Ne pas créer un autre style.
- **Synoptique** (commun, rien à écrire par attraction) : plan technique du circuit en haut à gauche de la vue (`drawSyn()`, `engine/render.js`), alimenté par la voie, les repères `blk<n>`, `SITE.yard` et l'état de jeu ; bouton `#bSyn`. Il remplace le profil en hauteur. Pas de pictogramme : traits fins, couleurs sourdes.
- **Plein écran et mobile** (commun, rien à écrire par attraction) : bouton « Plein écran » / « Quitter le plein écran » (`#bFs`, texte seulement) dans `#cams` ; API Fullscreen sur `#view`, repli CSS (la carte remplit la fenêtre) si indisponible (iOS) ; en plein écran le pupitre devient un tiroir (`#bDesk`) et la barre `#fsBar` donne heure, file, quai, dernier message, vitesse. Sous 900 px (ou paysage de téléphone) : carte pleine hauteur, pupitre et journal en tiroirs par les onglets `#tabs` (Carte / Pupitre / Journal), cibles tactiles >= 44 px, aucun défilement horizontal, `touch-action:none` sur le canevas (un doigt = déplacement, deux doigts = zoom, rayon de toucher >= 24 px sur barrières et numéros du synoptique). Tout nouveau contrôle doit respecter ces règles et rester utilisable au doigt ; ne pas ajouter de pictogramme.
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

- `node tools/check.js <id>` : journée complète (avec évacuations et abandons en pleine journée), **0 erreur de page**, ligne `offpath=<n>` (visiteurs hors des chemins, `tools/offpath.js` : voie, intérieur de la gare hors quais, bâtiments, zone entre voie et portillons fermés, hors de tout chemin) qui doit valoir 0 (échec au-delà de 2), PASS. Pour les nouvelles attractions, ajouter au besoin un scénario dans `tools/check.js` (garage, manœuvres).
- `node tools/check.js <id>` pour **chaque attraction existante** si le moteur a changé.
- Boutons du pupitre pour les scénarios : appareil `#yP`, `#y1`…`#yN`, `#yG`, `#yA0/#yA1` ; zones `#z<Zone>_<k|f|b|x|m>`, `#zLift_on/_off`, `#zAuto` ; `#bAuto`, `#bGate` (à presser pour ouvrir et fermer, journée complète comprise), `#bGo`, `#bStop`, `#bByp`.
- Captures regardées (vue d'ensemble, gare, garage pendant une manœuvre) : rendu cohérent avec Zeus.
- `python3 tools/build.py <id> dist/<id>.html` fonctionne.
- `node tools/mobile.js <id>` : PASS (tactile, onglets, plein écran, rotation, 0 erreur de page, pas de défilement horizontal) ; captures mobiles regardées.
- `node tools/save.js` : PASS (sauvegarde / reprise de zeus, hourra, oziris et bac à sable : état identique après départ vers `index.html` et retour, alternance entre attractions, « Nouvelle partie », stockage indisponible). `check.js` efface les sauvegardes au départ.
- Compte rendu au propriétaire : ce qui a été testé, ce qui ne l'a pas été (souris réelle, tactile, son), ce qui est estimé.

## 7. Économie de tokens

- Ne jamais lire en entier `sites/*.data.js` ni `parc/parc.data.js`.
- Lire seulement le module du moteur concerné ; partir de `sites/zeus.js` comme modèle.
- Une attraction = une session ; la conception moteur dans une session séparée si elle est lourde.

## 8. Tenue de ce document

Modifier ce fichier quand on ajoute ou change : un réglage `SITE`, une capacité du moteur, une convention de rendu ou d'interface, une étape de vérification. Ajouter une ligne au journal ci-dessous.

| Date | Changement |
|---|---|
| 2026-11-15 | Goudurix (propriétaire) : `SITE.singleCourse` (un seul train entre l'après-lift et le frein final, le lift s'arrête si la zone suivante est occupée, sans frein de bloc). |
| 2026-11-15 | Goudurix (propriétaire) : `yard.back` (garage en amont de la gare, entrée en marche arrière depuis la gare) et `yard.rotary` (aiguillage rotatif), scénario `tools/check.js` pour `back` (poussée par Gare AR) ; `tools/make_site.py` : `drop_ways`/`paths` ne dessinent plus le tronçon comme voie voisine ; cuvette avant le lift, portillons à l'ouest, trains rouges. |
| 2026-11-15 | Goudurix : `kind:'steel'` (coaster acier assis à rails tubulaires, supports en A), anneaux intérieurs des multipolygones OSM (`f.h`, lac sous le tracé), `tools/make_plan.py` (plan « tracé complet » : ronds tous les 50 m + tableau), aiguillage `yard.at:'station'` avec voie de garage qui recopie la courbe de sortie de gare (`yard.k` petit, `lanes[].pts` partant des points de contrôle du circuit). |
| 2026-11-15 | Sauvegarde automatique générique `engine/save.js` (clé `t2z.save.<site>.<mode>`, §2 « Sauvegarde », test `tools/save.js`) ; mode bac à sable `G.sandbox` (§2 « Mode »), choix sur `index.html` et dans « Nouvelle partie ». |
| 2026-11-15 | Pont droit à rail unique `yard.single` (OzIris, propriétaire : le rail du circuit vient chercher les trains) : positions P / 1…N, zone `RB` « Rail du pont » AUTO/MANU (stockage en P, zone porteuse face à une voie), circuit interrompu hors de P ; scénario `tools/check.js oziris` ; `docs/plans/oziris-garage.jpg`. |
| 2026-11-15 | Frein avant gare générique `SITE.preBrake:{back, len, name}` (zone `Pre`, AUTO/MANU, pneus, stockage d'un train avant la gare ; Trace du Hourra : 3 trains en attente Pre / RA / Fin) ; voies de garage sans bouton Avancer (entrée poussée par la zone porteuse `CARR` : `RB`, `St` ou `Fin` ; sortie par Reculer de la voie) ; scénarios `tools/check.js` mis à jour. |
| 2026-11-15 | OzIris : `kind:'inverted'` (rendu coaster inversé), `car.abreast`, `SITE.track`, `yard.rev` (voies du pont transbordeur en amont, entrée en marche arrière) ; `tools/check.js` : scénario pont à voies en amont, message de clic en échec. |
| 2026-11-15 | Plein écran de la carte (`#bFs`, repli CSS) et jeu sur mobile (onglets Carte / Pupitre / Journal, tiroirs, gestes tactiles, cibles >= 44 px) pour `jeu.html` et `parc.html` ; `tools/mobile.js`, `docs/plans/mobile.jpg`. |
| 2026-11-15 | Visiteurs hors des chemins (propriétaire, Zeus d'abord) : couloirs d'embarquement et de débarquement (`plat.exit`, `plat.walkU`, `exit.door`), portillon maintenu ouvert tant qu'un visiteur le franchit, demi-tour des arrivants par leur chemin, promeneurs exclus de la gare, contrôle `offpath` dans `tools/check.js` (`tools/offpath.js`). |
| 2026-11-15 | Freins de gare liés au départ (propriétaire) : plus de bouton `#zSt_k`, voyant `#zSt_fr` ; noms affichés « Rail mobile du parcours » (rail A, plaque « Rail parcours ») et « Rail du chariot » (rail B). |
| 2026-11-14 | T7 : pupitre par zones (Gare, Lift, Zones de freinage AUTO/MANU avec anti-collision, Garage), plus aucune commande par train ; `SITE.zones` ; portillons uniquement au bouton, en auto aussi ; `docs/plans/pupitre-zones.jpg`. |
| 2026-11-14 | Couleurs de la gouttière réglables par `SITE.trough` (Trace du Hourra : rouge, d'après photo). |
| 2026-11-14 | T8 (correction du propriétaire) : `yard.retract` — rail A (circuit) escamotable à 2 positions (`#yA0` sur le circuit, `#yA1` retiré), indépendant du chariot du rail B (`#yG`, `#y1…#yN`, plus de `#yP`) ; verrouillages croisés (rail B en ligne seulement rail A retiré, rail A de retour seulement rail B hors ligne) ; Trace du Hourra : poste de conduite déplacé au sud-est de la gare (estimé). |
| 2026-11-14 | T8 : appareil générique `device: 'traverser'` (pont transbordeur droit, deux rails parallèles, le chariot emporte le train ; position G `#yG` ; arrêt avant le pont quand aucun rail n'est en ligne ; durée de déplacement selon la course, `move.vc`) ; Trace du Hourra migrée, ancien transfert en S retiré pour elle ; scénario `tools/check.js` mis à jour. |
| 2026-11-14 | Commande par zones (freins, moteurs, lift, chariot) au lieu de commandes par train. |
| 2026-11-14 | T4 : Trace du Hourra. Freins de bloc commandables un par un au pupitre (`#bBk<n>`, `G.blkLock`), patins dessinés pour chaque frein de bloc, message au journal quand un train est arrêté par un frein fermé (bloc ou final) ; `SITE.maxRun` ; garage `at: 'brake'` + `device: 'table'` à 6 voies vérifié (scénario dans `tools/check.js`). |
| 2026-11-14 | T3 : garage générique `SITE.yard` (aiguillage ou pont transbordeur, N voies), boutons `#yP/#yk`, `#tG/#tF/#tB/#tX` ; `car.seats` dans le moteur. |
| 2026-11-14 | Places par wagon propres à chaque attraction (`car.seats`). |
| 2026-11-14 | Création : concepts, rendu, fidélité, étapes, définition de « fait ». |
