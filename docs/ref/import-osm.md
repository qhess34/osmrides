# Import OSM d'un élément (éditeur, réimport sélectif)

Quand la lire : (ré)import des données OSM d'une attraction (`lieux/<type>/<lieu>/<el>.data.js`), fiche d'import `tools/specs/<el>.json` du dépôt de jeu, bouton « Réimporter depuis OSM » de l'éditeur. Issues osmrides#54 (création depuis OSM) et #57 point 7 (réimport sélectif). Format des données lues par le moteur : `fichiers.md`, `decor.md` (« Tags OSM transportés »), `voie.md`.

## Ce que fait `tools/make_site.py` (dépôt de jeu, référence)

- Entrées : un extrait OSM (`.osm` XML de l'API 0.6, zone du parc) et la fiche `tools/specs/<el>.json`.
- Fiche : `origin` (point 0, 0), `bbox` (zone gardée, m), `track_ways` + `start_way` (circuit fermé assemblé), `profile`, `level`, `flat`, `keep`, `smooth`, `cp_step`, `inversions`, `tags` (repères forcés, `null` retire), `roles`, `osm_brakes`, `tunnels_extra`, `tunnels_ignore`, `ele_ground`, `ele_keep`, `paths` / `queue_paths` (chemins de file et autres, un tronçon ou une liste), `polys` (gare, garage…), `drop_ways`, `skip` (clés non écrites), `phys`, `base` (ancien mode « décor seul »). Les clés `note*` sont des commentaires.
- Sortie : `const OSM={…}` : `cps`, `widths`, `stairs`, `doors`, `barriers`, `tunnels`, `inversions`, `feats`, `others`, `paths`, `polys`, `trees`, `pois`, `deco`, `src`, `ctl`, `elements`, `stations`, `ele`, `attrs` (traçabilité : `id` / `v` de chaque objet).

## Portage JavaScript : `editor/import-osm.js`

- Module sans dépendance, chargé par le serveur de l'éditeur (Node), par les tests et par la page de l'éditeur (`window.ImportOSM`, plan de téléchargement). Aucun nom ni coordonnée de lieu : tout vient de la fiche.
- **Même sortie que `make_site.py`, octet pour octet** (vérifié sur le même extrait : Zeus, OzIris, Goudurix ; `tools/import-osm-test.js`) : arrondis et `repr` des flottants de Python, entiers Python gardés entiers, `sum` compensée, `hypot` correctement arrondi. Seule la première ligne (commentaire) diffère.
- **En plus** : `f.t` (tags transportés : bâtiments, `man_made=tunnel|excavation|structure`, tout objet à `layer` / `level` ; liste des clés : `decor.md`) et `OSM.levels` (tronçons du circuit à `layer`, sinon `level`, non nul ; s du moteur). `--sans-nouveaux` (ligne de commande) les retire pour comparer avec `make_site.py`.
- Erreurs qui arrêtaient `make_site.py` (circuit ouvert, tronçon supprimé, chemin de la fiche absent) : **avertissement**, la partie concernée du fichier actuel est gardée (ex. Trace du Hourra, tronçon de gare supprimé dans OSM).
- Mode `base` de la fiche : non repris (plus utilisé).
- Ligne de commande : `node tools/import-osm.js <extrait.osm|.json>[,…] <fiche.json> <sortie.data.js> [--actuel=…] [--cats=…] [--sans-nouveaux] [--log]`.

## Téléchargement : navigateur, puis serveur local

- Le serveur de l'éditeur (Docker du propriétaire) n'a pas de DNS : **le navigateur** télécharge (l'API OSM répond avec CORS) puis envoie les objets au serveur local, qui calcule, montre l'aperçu et écrit. Pas d'Overpass.
- Zone : `bbox` de la fiche + 60 m (ESTIMÉ), ou `osm_bbox` `[ouest, sud, est, nord]` en degrés si la fiche le donne ; découpée en tuiles de 0,01° au plus (`/api/0.6/map.json`).
- Compléments (`needed`) : tronçon de la fiche absent → `/way/<id>/full.json` ; multipolygone coupé par la zone → `/relation/<id>/full.json` (règle le cas OzIris, relation 8427077). Les extraits sont fusionnés et triés par id comme un extrait unique.
- Serveur OSM : `api` de `editor/osm.local.json` (même configuration que l'envoi vers OSM), sinon `https://api.openstreetmap.org`.

## Réimport sélectif

Catégories (cases à cocher, toutes cochées par défaut) : circuit et tronçons (`cps`, `tunnels`, `inversions`, `elements`, `stations`, `ele`, `levels`, `others`, `deco`) ; bâtiments et toits (`building*`, `polys`, `ctl`) ; chemins (`highway*`, `paths`, `stairs`, `widths`, `doors`, `barriers`) ; eau (`natural=water`, `waterway`, `water`) ; structures (`man_made*`, `railway*`) ; sol, végétation et autres (reste des `feats`, `trees`, `pois`) ; attributs (`f.t`, `attrs`). `src` suit la catégorie de chaque partie.

- Une catégorie non cochée reste **au caractère près** celle du fichier actuel (objets gardés, ordre gardé) ; cochée, ses objets sont remplacés, ajoutés ou retirés (identité : `id` + `k` + rang). Tout coché (et circuit relu) : exactement la sortie de l'import.
- Aperçu avant écriture : écarts par catégorie (`+` ajouté, `-` retiré, `~` modifié : géométrie, version, tags), nombre d'objets, avertissements.
- Écriture : seulement `lieux/<type>/<lieu>/<el>.data.js`, sur le bouton « Écrire », après l'aperçu ; puis l'éditeur recharge le jeu (le moteur charge-t-il ?) et affiche les nombres d'objets.

## Fiche d'import déduite d'OSM (à venir, #54)

Ce qui se déduit d'une relation `type=site` (décisions du 23/11, #54) : `track_ways` (membres `roller_coaster=track`), `start_way` (tronçon `station`), `polys.station` (bâtiment qui contient la gare), `paths` / `queue_paths` (chemins `oneway=yes` membres, file finissant sur `entrance=main`, sortie partant de `entrance=exit`), `origin` et `bbox` (emprise + marge). Ce que l'utilisateur confirme dans l'éditeur : profil (tant que `ele` manque), repères forcés, zones `keep`, figures, physique, clés `skip`. La fiche gardera ces réponses ; elle reste dans le dépôt de jeu (`tools/specs/<el>.json`).
