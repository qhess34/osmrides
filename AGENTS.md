# AGENTS.md — consignes pour travailler sur ce dépôt

## Le projet

Simulateurs d'exploitation d'attractions du Parc Astérix, en 2D vue du dessus, sur le tracé réel issu d'OpenStreetMap.
Le joueur est chef d'attraction : pupitre, trains, quai, file, garage, maintenance, météo.
Jeu de fan non officiel. Interface et textes en français.

## Attentes du propriétaire (à respecter)

Règles complètes : `docs/NOUVELLE-ATTRACTION.md` — à tenir à jour à chaque ajout.


- **Réalisme avant tout** : rendu aérien crédible, couleurs sourdes, aucun pictogramme ni emoji, rien d'enfantin.
- **Fidélité** : tracé au sol, gare, file, garage pris dans OpenStreetMap. Ce qui est estimé ou supposé (hauteurs, longueur des wagons, couleurs, position d'un pont transbordeur) doit être signalé dans le code et dit au propriétaire, jamais présenté comme mesuré.
- **Commande par zones, jamais par train** : gare, lift, zones de freinage (AUTO par défaut, MANU au choix), appareil, voies de garage ; portillons ouverts et fermés seulement au bouton (en auto aussi), validation des lapbars au pupitre ; les barrières de la file se cliquent sur la carte.
- **Visiteurs** : ils ne marchent que sur les chemins, ne franchissent que les barrières ouvertes (sauf évacuation), se répartissent à deux par portillon, un portillon par wagon.
- Vocabulaire : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html` | menu des attractions |
| `parc.html` | plan du parc entier (canvas, déplacement/zoom) ; charge `parc/parc.data.js` ; les attractions avec `site` ouvrent `jeu.html?site=…` |
| `parc/parc.data.js` | `const PARK={…}` — généré par `tools/make_park.py` depuis l'extrait du parc, ne pas éditer à la main |
| `tools/make_park.py` | `python3 tools/make_park.py extrait.osm parc/parc.data.js` (origine = Trace du Hourra) |
| `jeu.html` | page de jeu commune ; charge `sites/<site>.data.js`, `sites/<site>.js`, puis `engine/*.js` selon `?site=` |
| `engine/*.js` | moteur (aucune coordonnée ni texte propre à une attraction), scripts classiques à variables globales partagées, chargés dans cet ordre : |
| `engine/core.js` | utilitaires, vecteurs, construction de la voie, constantes dérivées de `SITE` |
| `engine/garage.js` | gare de triage `SITE.yard` (`YD`, `LANES`, `SW0`, `gFrame`, état de l'appareil `G.dev`, verrouillages), quai, opérateurs, zones |
| `engine/state.js` | état `G`, trains, son, cantonnement, maintenance |
| `engine/queue.js` | visiteurs, file (étapes, fourches), marcheurs |
| `engine/sim.js` | trains, gare, parcours, manœuvres (`yardPos`, `yardFwd`, `yardBack`, `yardHalt`), météo, `step`, fin de journée, `act` |
| `engine/ui.js` | pupitre et interface DOM |
| `engine/render.js` | dessin canvas, caméra, boucle d'animation |
| `sites/<site>.data.js` | `const OSM={cps, feats, trees, pois, others, paths, polys…}` — généré, ne pas éditer à la main |
| `sites/<site>.js` | `const SITE={…}` — configuration écrite à la main |
| `tools/make_site.py`, `tools/specs/<site>.json` | génération des données depuis un extrait `.osm` |
| `tools/build.py` | fichier HTML unique autonome |
| `docs/` | notes de conception (relevés, choix, points ouverts) |

Aucune dépendance, aucun serveur : tout doit fonctionner en ouvrant le fichier (`file://`). Pas de `fetch`, pas de modules ES.

### Repères du moteur

- Unités : mètres, secondes. `x` vers l'est, `z` vers le sud. `s` = abscisse le long de la voie (0 = début de gare).
- Voie : `OSM.cps` = points `[x, hauteur, z, dévers, repère]`. Repères obligatoires : `st0`, `st1`, `lift0`, `lift1`, `brk` ; facultatifs : `blk1`, `blk2`… (freins de bloc). `OSM.tunnels=[[s0,s1],…]` (facultatif, s du moteur) : tronçons du circuit tagués `tunnel=yes` (ou `covered=yes` et `layer<0`) par `tools/make_site.py` ; le moteur les cache sous une couverture (eau si le tunnel est sous un plan d'eau OSM ou si `SITE.tunnels:[{under:'water'|'ground', w}]`, sinon remblai) avec deux portails ; le profil de la spec doit passer sous le sol.
- Zones : gare, avant-lift, lift, parcours, frein final. Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre.
- `SITE` (voir `sites/zeus.js`, la référence) : `kind` (`wood` | `bob` | `inverted`), `car` (`len`, `n`, `seats` = places par wagon, défaut 2, `abreast` = places côte à côte par rangée, défaut 2, `inline`, `w`), `track` (couleurs d'un coaster inversé : `spine`, `rail`, `support`), `trains` (`lane` facultatif : voie de garage au départ), `loadSide`, `phys`, `trough` (couleurs de la gouttière d'un bob : `lo`, `hi`, `edge`, `deck`, `rim`, `shine`), `yard` (garage : `at: 'station' | 'brake'`, `device: 'switch' | 'table' | 'traverser'` ; `switch`/`table` : `a`, `b`, `slide`, `side`, `len`, `lanes:[{name, pts, cap, off}]` ; `traverser` (pont droit qui emporte le train) : `side` (côté du garage, 1 = droite du sens de marche), `gap` (écart des rails A/B), `pre`/`post` (rail au-delà du train arrêté), `laneGap`, `lanes:[{name, d, len, cap}]` (d = distance de l'axe du circuit), `rev` (voies en amont du pont : le rail de garage pousse le train dans la voie en marche arrière, `#zRB_b` ; sortie par `#zL<k>_b`, étiqueté AV), `retract:{d, name, rest}` (rail A escamotable indépendant : 2 positions, circuit / retiré de `d` m à l'opposé du garage ; le chariot ne porte alors que le rail B, au repos face à la voie `rest`), `single:true` (rail unique = tronçon du circuit, positions P / 1…N, zone `RB` nommée `railName`, AUTO/MANU ; pas de `gap` ni de `G`), `devName`/`devLabel` ; `move:{v, t, vc}` — voir `docs/manoeuvres.md`), `preBrake` (frein avant gare : `{back, len, name}`, zone `Pre`), `zones` (moteurs par zone : `{<id ou groupe B / L>:{brake, drive}}`, voir `docs/manoeuvres.md`), `helpGarage`, `queue.parts` (tronçons et fourches, de l'entrée vers la gare), `approach`, `exit` (`path` commençant à la porte `door`, `tails`), `board` (`via`, `walk`), `plat` (`load`, `exit` = quai de débarquement, `walkU`, `back`, `front`), `booth`, `fade`, `view`, `cams`, `labels`, `jobsites`, et `draw.*` pour les dessins propres au site.
- État global `G`, trains `trains[]`, actions joueur `act(nom, arg)`, pas de simulation `step(dt)`, rendu `render(dt)`.

## Ajouter une attraction

1. Récupérer un extrait OpenStreetMap de la zone (voir « Accès réseau »).
2. Repérer les tronçons `roller_coaster=track`, la gare, la file, la sortie ; écrire `tools/specs/<site>.json` (profil en hauteur estimé).
3. `python3 tools/make_site.py extrait.osm tools/specs/<site>.json sites/<site>.data.js apercu.png` : vérifier que tous les croisements ont au moins 3,2 m d'écart et que la vitesse reste plausible.
4. Écrire `sites/<site>.js` en partant de `sites/zeus.js`. Si le moteur manque d'une capacité, l'ajouter dans le module `engine/` concerné de façon générique, pilotée par `SITE`.
5. Ajouter la carte dans `index.html` et la ligne dans `README.md`.

## Vérifier avant de dire que c'est fait

Playwright et Chromium sont préinstallés (`require('playwright')`, `chromium.launch()` sans option).
Ouvrir `file:///…/jeu.html?site=<site>`, fermer l'aide (`[data-act=closeHelp]`), puis dans `page.evaluate` :

- avancer vite : `act('speed',0)` puis boucler `step(.025)` ; figer la météo avec `G.wx.next=1e6` ;
- journée complète : boucler jusqu'à `G.dayDone`, en dépannant (`act('job','liftFix')`, `'brakeFix'`, `act('rearm',i)`) ;
- cliquer les vrais boutons du pupitre (`#bOpen`, `#bAuto`, `#bGate` (seul moyen d'ouvrir / fermer les portillons), `#bGo`, `#bStop`, `#bByp` ; zones (`engine/garage.js` `ZONES`, `act('zone','<id>:<cmd>')`) : ids `St` (gare), `B1…Bn` (freins de bloc), `Fin` (frein final), `RA`/`RB` (pont droit : rail mobile du parcours = rail A, rail du chariot = rail B ; pont à rail unique `single` : `RB` seul, « Rail du pont », zone de freinage AUTO/MANU en P et zone porteuse face à une voie), `Pre` (frein avant gare, si `SITE.preBrake`), `L1…Ln` (voies : freins, Reculer `_b`, Arrêt `_x`, pas de `_f` ; l'entrée est poussée par la zone porteuse `RB` / `St` / `Fin`), boutons `#z<id>_k` (freins serrer/relâcher ; pas pour la gare `St` : freins liés au départ, voyant `#zSt_fr`), `#z<id>_f` / `_b` / `_x` (moteurs Avancer / Reculer / Arrêt, si la zone en a), `#z<id>_m` (AUTO/MANU, zones de freinage), `#zLift_on` / `#zLift_off`, `#zAuto` (toutes les zones de freinage en AUTO), voyant `#lz<id>` ; appareil de voie `#yP` (P, sauf pont droit à rail A escamotable), `#y1`…`#yN`, `#yG` (pont droit à deux rails : rail de garage en ligne ; absent pour un rail unique) ; rail A escamotable `#yA0` (sur le circuit), `#yA1` (retiré) ; synoptique du circuit (plan nord en haut, zones, freins de bloc B1…, garage, trains numérotés ; bouton `#bSyn`, choix gardé dans `localStorage` `t2z.syn`, masqué par défaut sous 600 px ; clic sur un numéro = caméra de suivi) dessiné par `drawSyn()` dans `engine/render.js` ; aucune commande par train) ;
- mobile et plein écran : `node tools/mobile.js [zeus hourra] [--shots=DIR] [--montage=f.jpg]` (iPhone 13 portrait 390x844, 360x640, paysage 844x390, tactile réel CDP : un doigt = déplacement, deux doigts = zoom, toucher barrière / numéro du synoptique, onglets, plein écran en repli CSS, rotation, `parc.html`) ; ids : `#bFs` (Plein écran / Quitter le plein écran, dans `#cams`), `#fsBar` (barre du plein écran : `#fsHud`, `#fsMsg`, `#bDesk` = tiroir du pupitre, Quitter), `#tabs` (`data-act=tab` : `carte`, `pupitre`, `journal`) ; classes de `body` : `dm` (téléphone / tablette étroite : pupitre et journal en tiroirs), `fs` (plein écran), `fsdesk` (tiroir ouvert en plein écran) ; `setFs()`, `setTab()` ; en plein écran `#side` est déplacé dans `#view` ;
- test rapide : `node tools/check.js <site>` (manœuvre de garage scriptée aux boutons de zone + journée complète avec portillons pressés au bouton, `--build` pour le fichier unique, `--shots=DIR` captures du garage à pont droit ; sortie courte PASS/FAIL avec `offpath=<n>` (visiteurs hors des chemins, `tools/offpath.js`, échec si n>2), capture `/tmp/t1/<site>.png`) ;
- relever `pageerror` ; faire des captures (`cam.g={x,z,s}` puis `render(.05)` plusieurs fois) et **les regarder**.

Toute modification du moteur doit être revérifiée sur chaque attraction. Annoncer au propriétaire ce qui a été testé et ce qui ne l'a pas été (la souris réelle et le son ne sont pas testables ici).

## Accès réseau (sessions cloud)

- `api.openstreetmap.org` fonctionne : `https://api.openstreetmap.org/api/0.6/map?bbox=2.560,49.130,2.582,49.142` donne le parc entier (≈ 6 Mo). L'extrait n'est pas versionné.
- `overpass-api.de` et ses miroirs coupent la connexion : inutilisables.
- YouTube exige une connexion pour les accès automatisés : les vidéos embarquées ne sont pas exploitables. Ne pas contourner ; demander au propriétaire des captures ou des horodatages.
- La recherche web fonctionne pour les caractéristiques (RCDB, Coasterpedia) ; les sources se contredisent parfois, le dire.

## Git

- Dépôt `qhess34/t2z`, branche `main`, commits directs. Messages en anglais, à l'impératif.
- Ne rien pousser ailleurs sans demande explicite. Pas de pull request sauf demande.

## Économie de tokens (obligatoire)

- Commencer par `docs/ROADMAP.md` : il dit quelle tâche faire et quels fichiers lire.
- Ne jamais lire `sites/*.data.js` en entier (généré, 60–70 Ko).
- Garage, aiguillage, pont transbordeur, marche arrière : règles communes dans `docs/manoeuvres.md`, à appliquer sans les réécrire par attraction.

## État et suite

Voir `docs/ROADMAP.md` (ordre des tâches, questions ouvertes), `docs/hourra-notes.md` (données de la Trace du Hourra) et `docs/oziris-notes.md` (OzIris).
