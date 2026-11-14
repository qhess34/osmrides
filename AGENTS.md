# AGENTS.md — consignes pour travailler sur ce dépôt

## Le projet

Simulateurs d'exploitation d'attractions du Parc Astérix, en 2D vue du dessus, sur le tracé réel issu d'OpenStreetMap.
Le joueur est chef d'attraction : pupitre, trains, quai, file, garage, maintenance, météo.
Jeu de fan non officiel. Interface et textes en français.

## Attentes du propriétaire (à respecter)

- **Réalisme avant tout** : rendu aérien crédible, couleurs sourdes, aucun pictogramme ni emoji, rien d'enfantin.
- **Fidélité** : tracé au sol, gare, file, garage pris dans OpenStreetMap. Ce qui est estimé ou supposé (hauteurs, longueur des wagons, couleurs, position d'un pont transbordeur) doit être signalé dans le code et dit au propriétaire, jamais présenté comme mesuré.
- **Manœuvres manuelles** : aiguillage, envoi au garage, retour en marche arrière, portillons, validation des lapbars se commandent au pupitre ; les barrières de la file se cliquent sur la carte.
- **Visiteurs** : ils ne marchent que sur les chemins, ne franchissent que les barrières ouvertes (sauf évacuation), se répartissent à deux par portillon, un portillon par wagon.
- Vocabulaire : lapbars, portillons, pupitre, frein final, canton, aiguillage, pont transbordeur.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html` | menu des attractions |
| `jeu.html` | page de jeu commune ; charge `sites/<site>.data.js`, `sites/<site>.js`, puis `game.js` selon `?site=` |
| `game.js` | moteur : aucune coordonnée ni texte propre à une attraction |
| `sites/<site>.data.js` | `const OSM={cps, feats, trees, pois, others, paths, polys…}` — généré, ne pas éditer à la main |
| `sites/<site>.js` | `const SITE={…}` — configuration écrite à la main |
| `tools/make_site.py`, `tools/specs/<site>.json` | génération des données depuis un extrait `.osm` |
| `tools/build.py` | fichier HTML unique autonome |
| `docs/` | notes de conception (relevés, choix, points ouverts) |

Aucune dépendance, aucun serveur : tout doit fonctionner en ouvrant le fichier (`file://`). Pas de `fetch`, pas de modules ES.

### Repères du moteur

- Unités : mètres, secondes. `x` vers l'est, `z` vers le sud. `s` = abscisse le long de la voie (0 = début de gare).
- Voie : `OSM.cps` = points `[x, hauteur, z, dévers, repère]`. Repères obligatoires : `st0`, `st1`, `lift0`, `lift1`, `brk` ; facultatifs : `blk1`, `blk2`… (freins de bloc).
- Zones : gare, avant-lift, lift, parcours, frein final. Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre.
- `SITE` (voir `sites/zeus.js`, la référence) : `kind` (`wood` | `bob`), `car`, `trains`, `loadSide`, `phys`, `garage` (`at: 'station' | 'brake'`), `queue.parts` (tronçons et fourches, de l'entrée vers la gare), `approach`, `exit`, `board`, `plat`, `booth`, `fade`, `view`, `cams`, `labels`, `jobsites`, et `draw.*` pour les dessins propres au site.
- État global `G`, trains `trains[]`, actions joueur `act(nom, arg)`, pas de simulation `step(dt)`, rendu `render(dt)`.

## Ajouter une attraction

1. Récupérer un extrait OpenStreetMap de la zone (voir « Accès réseau »).
2. Repérer les tronçons `roller_coaster=track`, la gare, la file, la sortie ; écrire `tools/specs/<site>.json` (profil en hauteur estimé).
3. `python3 tools/make_site.py extrait.osm tools/specs/<site>.json sites/<site>.data.js apercu.png` : vérifier que tous les croisements ont au moins 3,2 m d'écart et que la vitesse reste plausible.
4. Écrire `sites/<site>.js` en partant de `sites/zeus.js`. Si le moteur manque d'une capacité, l'ajouter dans `game.js` de façon générique, pilotée par `SITE`.
5. Ajouter la carte dans `index.html` et la ligne dans `README.md`.

## Vérifier avant de dire que c'est fait

Playwright et Chromium sont préinstallés (`require('playwright')`, `chromium.launch()` sans option).
Ouvrir `file:///…/jeu.html?site=<site>`, fermer l'aide (`[data-act=closeHelp]`), puis dans `page.evaluate` :

- avancer vite : `act('speed',0)` puis boucler `step(.025)` ; figer la météo avec `G.wx.next=1e6` ;
- journée complète : boucler jusqu'à `G.dayDone`, en dépannant (`act('job','liftFix')`, `'brakeFix'`, `act('rearm',i)`) ;
- cliquer les vrais boutons du pupitre (`#bOpen`, `#bAuto`, `#bGate`, `#bGo`, `#bStop`, `#bSw`, `#bHold`, `#bByp`, `#tG0`, `#tS1`…) ;
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

Voir `docs/ROADMAP.md` (ordre des tâches, questions ouvertes) et `docs/hourra-notes.md` (données de la Trace du Hourra).
