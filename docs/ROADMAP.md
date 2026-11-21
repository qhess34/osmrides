# Feuille de route OSMrides — moteur d'attractions générique et éditeur WYSIWYG

Vision : un moteur de simulation d'attractions réutilisable (plusieurs parcs, plusieurs familles), et un éditeur local (Docker) qui permet de créer, corriger et configurer intégralement une attraction à partir d'OSM, **sans IA**. Les fichiers du dépôt sont la seule source de vérité ; Git versionne ; GitHub Pages publie le jeu ; OSM reste la référence géographique et reçoit, sur validation explicite, les corrections proposées.

À long terme (propriétaire, 21/11) :
- **Code lisible par des humains et simple (KISS)** : fonctions courtes et nommées clairement, pas d'abstraction sans besoin réel, commentaires en français là où la règle métier n'est pas évidente ; simplifier plutôt qu'empiler des cas particuliers.
- **Composants réutilisables hors attractions** : certaines briques (lecture et import OSM, voie et abscisse `s`, cantonnement et commande par zones, visiteurs sur chemins et files, éditeur, synchronisation OSM) devront pouvoir servir à d'autres simulations fondées sur OSM, par exemple des transports en commun ou des domaines skiables. Les garder génériques, sans vocabulaire propre aux montagnes russes dans leur cœur, quand on les touche.

Architecture, séparation des données et décisions : `docs/ARCHITECTURE.md`. Historique et questions ouvertes de l'ancienne feuille de route : `docs/JOURNAL.md`.

## Principes

- Chaque lot est livrable seul, testé (`tools/check.js` ×4 + tests propres au lot), sans régression du jeu publié.
- Aucune donnée perdue : une attraction existante s'ouvre, se corrige, se sauvegarde et se rejoue ; ce que l'éditeur ne sait pas encore éditer reste intact.
- Données OSM, corrections locales d'OSM, données du jeu et données calculées restent séparées (`ARCHITECTURE.md` §2).
- Aucun envoi à OSM, aucun commit ou push sans action explicite de l'utilisateur.
- Modèles : **Haiku 5.5** (recherches, tests, tâches répétitives), **Sonnet 5.5** (l'essentiel du développement), **Opus 5.5** (arbitrages d'architecture, moteur), **Fable 5.2** seulement sur demande.

## Lots

| Lot | Objet | Dépend de | Complexité | Modèle |
|---|---|---|---|---|
| 0 | Nettoyage, audit, roadmap | — | faible | Opus (pilotage) — **fait 2026-11-17** |
| 1 | Éditeur v1 (Docker) : barrières et salles de contrôle | 0 | moyenne | Opus (modèle de surcharge + moteur), Sonnet (interface) — **fait 2026-11-17** |
| 2 | Traçabilité OSM à l'import | 0 | faible | Sonnet |
| 3 | Paramètres d'instance éditables (trains, couleurs, sous-type) | 1 | moyenne | Sonnet |
| 4 | Édition des objets OSM importés (corrections locales) | 1, 2 | élevée | Opus (modèle) + Sonnet |
| 5 | Files d'attente complètes (tronçons, fourches, raccords) | 1 | moyenne | Sonnet |
| 6 | Contribution OSM (diff, sélection, envoi authentifié) | 4 | élevée | Opus |
| 7 | Réimport sélectif OSM par catégorie | 2, 4 | élevée | Opus |
| 8 | Création complète d'une attraction depuis OSM dans l'éditeur | 3, 5, 7 | élevée | Opus + Sonnet |
| 9 | Types et sous-types : registre, puis famille parcours aquatique | 3 | élevée | Opus |
| 10 | Flat rides | 9 | élevée | Opus |
| — | Assistant IA facultatif (suggestions, détection d'anomalies) | 8 | — | plus tard, jamais requis |

Chemin critique vers l'autonomie : 1 → 2 → 4 → 7 → 8. Les lots 3, 5, 9 peuvent avancer en parallèle (sessions distinctes) une fois le lot 1 livré.

---

### Lot 1 — Éditeur v1 : barrières et salles de contrôle (fait 2026-11-17 : `editor/README.md`, test `tools/editor-test.js`)

- **Objectif** : premier éditeur local, WYSIWYG, sur les 4 attractions existantes.
- **Fonctions** : choisir une attraction ; voir file, barrières (entrée, fourches) et salles de contrôle sur le vrai rendu du jeu ; sélectionner, déplacer, tourner une barrière, ajuster sa longueur, revenir au calcul automatique ; salles : sélectionner, déplacer, tourner, redimensionner, créer, supprimer ; diff avant sauvegarde ; sauvegarde dans `sites/<site>.game.js` ; rechargement à l'identique.
- **Tâches** :
  1. Moteur : charger `sites/<site>.game.js` (facultatif) dans `jeu.html` et `tools/build.py` ; `GAME.barriers` (surcharges par clé stable) dans `engine/queue.js` ; `GAME.controlRooms` dans `engine/render.js` / `engine/garage.js` (repli `SITE.booth`). — Opus, moyenne, risque : régression des files → `check.js` ×4.
  2. Serveur `editor/server.js` (Node, sans dépendance) : fichiers statiques du dépôt, API liste des sites / lecture / validation / diff / écriture de `game.js` seulement. — Sonnet, faible.
  3. Interface `editor/index.html` : moteur réel + couche d'édition (sélection, poignées, panneau de valeurs, diff, sauvegarde). — Sonnet, moyenne.
  4. Docker : `compose.yaml`, documentation `editor/README.md`. — Haiku/Sonnet, faible.
  5. Tests : `tools/editor-test.js` (ouvrir, modifier, sauvegarder, relire, jouer) + `check.js` ×4. — Sonnet.
- **Livrables** : `editor/`, `compose.yaml`, `sites/<site>.game.js` (créé à la première sauvegarde), moteur compatible, tests, doc.
- **Validation** : sur une attraction existante, une barrière et une salle modifiées, sauvegardées, relues après redémarrage du conteneur, visibles et fonctionnelles dans `jeu.html` ; `check.js` ×4 PASS ; attraction sans `game.js` inchangée.

### Lot 2 — Traçabilité OSM à l'import

- **Objectif** : chaque objet importé garde son origine.
- **Tâches** : `make_site.py` ajoute l'id OSM (`w123`, `n456`) et la version aux `feats`, `others`, `stairs`, `doors`, `barriers` ; liste des catégories réellement lues, tirée du code de l'importeur (base du réimport sélectif) ; réimport des 4 sites sans changement de géométrie.
- **Validation** : diff des `data.js` limité aux nouveaux champs ; `check.js` ×4 PASS. — Sonnet, faible.
- **Fait (19/11/2026)** : champs `id` / `v` (+ `OSM.src`), catégories lues dans `docs/OSM-GUIDE.md` §7, 4 sites réimportés avec géométrie inchangée (diff = champs de traçabilité seuls) ; changements OSM détectés depuis le dernier import (rocher d'Hourra retagué `bare_rock`, voie de Goudurix retouchée, `lv` des chemins souterrains) **non repris**, à décider avec le propriétaire (lot 7).

### Lot 3 — Paramètres d'instance éditables

- **Objectif** : régler dans l'éditeur ce qui est aujourd'hui écrit à la main dans `SITE` sans code : nombre et couleurs des trains, couleurs de voie et supports, sous-type (`kind`), wagons, physique de base.
- **Tâches** : schéma de validation par clé ; lecture `GAME` > `SITE` pour ces clés ; panneau de formulaire dans l'éditeur. — Sonnet, moyenne.
- **Fait (19/11/2026)** : `GAME.site` (D9, `docs/ARCHITECTURE.md`), section « Attraction » de l'éditeur, validation clé par clé, tests `tools/editor-test.js` ×4 ; capture `docs/plans/lot-3.jpg`.

### Lot 4 — Corrections locales des objets OSM

- **Objectif** : modifier, ajouter, supprimer un objet d'origine OSM (chemin, bâtiment, nœud) en gardant avant / après et l'identifiant.
- **Avant de commencer** : `docs/OSM-LIMITES.md` (issue #30) : ce qui se corrige directement dans OSM, ce qui reste local ; proposition de lot réduit.
- **Tâches** : format `sites/<site>.osmfix.json` (opérations par id + version d'origine) ; application au chargement (moteur) et dans l'éditeur ; affichage des objets corrigés. — Opus (format), Sonnet (outils), élevée.

### Lot 5 — Files d'attente complètes

- **Objectif** : définir dans l'éditeur les tronçons, les fourches, les raccords et la bouche de file (aujourd'hui `SITE.queue.parts`, écrit à la main), avec validation (visiteurs uniquement sur des chemins).
- Avant de commencer : `docs/OSM-LIMITES.md` (issue #30) : tronçons, boucles et raccourcis déductibles d'OSM (chemins à sens unique et nœuds communs ; barrières OSM plus lues, issue #34).
- Sonnet, moyenne ; dépend du lot 1 (barrières liées aux fourches).
- **Fait en partie (20/11, issue #34)** : barrières de file **déduites** par le moteur (entrée au début de la file, une par pointe de fourche, liées), nœuds OSM `barrier=*` ignorés, `GAME.barriers` inchangé (aucune clé orpheline) ; **tronçons, boucles et raccourcis déduits** des chemins de file OSM et de leur sens (`SITE.queue.ways`, `engine/queue.js` `deduceParts`) pour Trace du Hourra, OzIris, Goudurix ; `SITE.queue.parts` gardé en repli (Zeus : raccourci ouest absent d'OSM, file à la main). Ligne `queue=auto(…)|manuel gameOrphans=` de `tools/check.js`.
- **Reste** : trouver les chemins de file sans liste d'ids dans la spec (importeur : `oneway`, de la barrière d'entrée à `entrance=main`) ; montrer la file déduite dans l'éditeur ; raccord d'entrée, bouche, accès encore dans `SITE`.

### Lot 6 — Contribution OSM

- **Objectif** : proposer les corrections du lot 4 à OSM : liste des objets, valeurs d'origine / nouvelles, diff, sélection, validation explicite, envoi par changeset authentifié (OAuth 2 OSM), détection des conflits de version, journal des envois.
- Opus, élevée ; aucun envoi automatique ; la publication Pages n'implique jamais un envoi OSM.

### Lot 7 — Réimport sélectif OSM

- **Objectif** : synchronisation contrôlée, pas un remplacement : choisir les catégories (issues de l'importeur, lot 2 : voie et tronçons, gare et quais, bâtiments et abris, entrées/sorties, chemins et escaliers, passerelles et tunnels, eau, végétation, barrières indicatives), récupérer OSM, comparer par id avec `data.js`, présenter ajouts / modifications / suppressions, détecter les conflits avec `osmfix.json` (garder local / prendre OSM / examiner), appliquer catégorie par catégorie.
- Règles : `game.js` jamais touché ; aucune suppression d'élément du jeu sans validation ; surcharges orphelines signalées.
- Opus, élevée ; dépend des lots 2 et 4.

### Lot 8 — Création complète depuis OSM

- **Objectif** : nouvelle attraction de bout en bout dans l'éditeur : choix de la zone, import, désignation des tronçons (gare, lift, freins), profil en hauteur éditable, garage, file, quais, salles, trains, test en jeu, ajout au menu.
- Remplace `tools/specs/<site>.json` écrit à la main par un fichier produit par l'éditeur. Opus + Sonnet, élevée.

### Lot 9 — Types et sous-types

- **Objectif** : `type` (famille, d'après `attraction=*` OSM) + `subtype` (registre : valeurs par défaut, dessin, simulation), puis première famille nouvelle : parcours aquatique (bateaux, chute, pas de lapbars). Opus, élevée.

### Lot 10 — Flat rides

- Nouveau module de simulation sans voie (cycles, nacelles). Opus, élevée.

## Décisions du propriétaire

- 2026-11-17 — **Barrières** : relèvent du jeu ; le nœud OSM `barrier=*` ne donne que la position initiale, la position finale est celle de l'éditeur.
- 2026-11-17 — **Salle de contrôle** : une seule par attraction, celle du pupitre (poste de conduite). Postes d'aiguillage et autres locaux : plus tard.
