# Feuille de route OSMrides — moteur d'attractions générique et éditeur WYSIWYG

Vision : un moteur de simulation d'attractions réutilisable (plusieurs parcs, plusieurs familles), et un éditeur local (Docker) qui permet de créer, corriger et configurer intégralement une attraction à partir d'OSM, **sans IA**. Les fichiers du dépôt sont la seule source de vérité ; Git versionne ; GitHub Pages publie le jeu ; OSM reste la référence géographique et reçoit, sur validation explicite, les corrections proposées.

À long terme (propriétaire, 21/11) :
- **Code lisible par des humains et simple (KISS)** : fonctions courtes et nommées clairement, pas d'abstraction sans besoin réel, commentaires en français là où la règle métier n'est pas évidente ; simplifier plutôt qu'empiler des cas particuliers.
- **Composants réutilisables hors attractions** : certaines briques (lecture et import OSM, voie et abscisse `s`, cantonnement et commande par zones, visiteurs sur chemins et files, éditeur, synchronisation OSM) devront pouvoir servir à d'autres simulations fondées sur OSM, par exemple des transports en commun ou des domaines skiables. Les garder génériques, sans vocabulaire propre aux montagnes russes dans leur cœur, quand on les touche.
- **Hiérarchie du jeu** (propriétaire, 23/11, issue #48, à étudier) : type (parc d'attractions / transport en commun / domaine skiable) → lieu (Parc Astérix, une station…) → éléments (attractions, lignes, remontées).

Architecture, séparation des données et décisions : `docs/ARCHITECTURE.md`. Historique et questions ouvertes de l'ancienne feuille de route : `docs/JOURNAL.md`.

## Principes

- Chaque lot est livrable seul, testé (`tools/check.js` ×4 + tests propres au lot), sans régression du jeu publié.
- Aucune donnée perdue : une attraction existante s'ouvre, se corrige, se sauvegarde et se rejoue ; ce que l'éditeur ne sait pas encore éditer reste intact.
- Données OSM, corrections locales d'OSM, données du jeu et données calculées restent séparées (`ARCHITECTURE.md` §2).
- Aucun envoi à OSM, aucun commit ou push sans action explicite de l'utilisateur.
- **Réglages de l'éditeur : uniquement du WYSIWYG** (propriétaire, 26/11) : sélection et déplacement sur la carte, pas de valeur numérique à saisir ; une fenêtre au clic ne contient que des actions.
- **Barrières OSM ignorées** (propriétaire, 26/11) : seules existent pour le moteur les barrières posées dans l'éditeur.
- Modèles : **Haiku 5.5** (recherches, tests, tâches répétitives), **Sonnet 5.5** (l'essentiel du développement), **Opus 5.5** (arbitrages d'architecture, moteur), **Fable 5.2** seulement sur demande.

## Lots de maturité (depuis le 26/11/2026)

Décision du propriétaire (26/11) : les lots marquent la **maturité de l'application dans son ensemble**, pas une grosse fonctionnalité chacun. Un lot est franchi quand son critère de sortie est vérifié sur toute l'application (tests et jeu). Chaque issue est rattachée à un lot ; les issues en cours sont sur le lot en cours.

| Lot | Maturité visée | Critère de sortie | Issues | Statut |
|---|---|---|---|---|
| 1 | **Jeu fiable sur le parc existant** | les 4 attractions du Parc Astérix se jouent sans bug connu ; pupitre cohérent (boutons sans doublon ni effet nul) ; tests `check`, `save`, `mobile` PASS | fin de #58 (audit du pupitre), #61, #60 ; livrés : #44, #59, #62, bugs 1 à 3 de #58 | **presque atteint** |
| 2 | **Éditeur complet d'une attraction existante, en WYSIWYG** | plus aucune valeur à saisir ni à écrire dans `SITE` pour régler une attraction ; tout se règle sur la carte | #64, #57 (points 3 à 6), #63 ; livrés : barrières, salles de contrôle, profil, couleurs, exploitation, #45, #46 | **lot en cours** |
| 3 | **Créer une attraction depuis OSM, sans fichier écrit à la main** | une nouvelle attraction se fait de bout en bout dans l'éditeur (import, désignation, test en jeu, ajout au menu) | #54, #57 (point 7, réimport sélectif) ; anciens lots 4, 6, 7, 8 | à faire |
| 4 | **Le lieu complet** | un parc entier se joue dans une page ; page du lieu ; rôle par lieu avec des types d'objectifs différents | #56, #57 (page du lieu) | à faire (note de conception) |
| 5 | **Nouveaux types de lieux** | un deuxième type de lieu jouable (domaine skiable : Vars Les Claux), puis parcours aquatique, flat rides, transport | #48, #49 ; anciens lots 9 et 10 | à faire |

### Sous-tâches et modèles par lot

Règle de modèle (`docs/PILOTAGE.md`) : **Sonnet** par défaut ; **Opus** pour les tâches difficiles (garage, manœuvres, cantonnement, format de données, conception du noyau) ; **Haiku** pour les recherches (`explorateur`) et les tests (`testeur`). Les chefs (Moteur, Parcs, Stations) sont des sessions Sonnet ; le Webmestre est Haiku. « À créer » : sous-issue pas encore ouverte.

**Lot 1 : jeu fiable sur le parc existant**

| Sous-tâche | Issue | Modèle |
|---|---|---|
| Garages sans freins manuels, un seul bouton « Envoyer le train » (Zeus : envoi depuis la gare déjà livré) | #61 | Opus (manœuvres) |
| Audit du pupitre zone par zone, AUTO et MANU : doublons Frein / Stop, AR du lift, bouton F, libellés ; tableau avant / après | #58 (points 6 à 9) | Sonnet (audit), Opus si un changement touche les manœuvres |
| Lift animé : AUTO (démarre un peu avant le train, rampes), MANU (marche / arrêt) | #60 | Sonnet |
| Adaptation de `check.js` (Zeus) et de `tutos.html` côté parcs | issue `inter-equipe` (osmrides_parks#13) | Chef parcs, `ouvrier` Sonnet |
| Passage de la batterie de tests et note de version | — | `testeur` Haiku (une seule batterie, sans doublon chez les parcs) |

**Lot 2 : éditeur complet d'une attraction existante, en WYSIWYG**

| Sous-tâche | Issue | Modèle |
|---|---|---|
| Rails `moving` : format des positions, chariot généré, verrouillage, magnétisme (étape A) | #64 | Opus |
| Rails `moving` : édition sur la carte, tag « non connecté » (étape B) | #64 | Opus (en cours) ou Sonnet si découpée |
| Quais en WYSIWYG, lus dans OSM, renvoyables | #57 (point 3) | Sonnet ; importeur côté parcs : `ouvrier` Sonnet |
| Fenêtres au clic (freins, gare, voies `moving`) | #57 (point 4) | Sonnet |
| Suppression du « frein final » à part (règle commune de retenue, `holdBack`, `Fin`) | #57 (point 4) | Opus (cantonnement) |
| Hauteurs choisies sur le circuit, sur la carte | #57 (point 5) | Sonnet |
| Caméras en WYSIWYG | #57 (point 6) | Sonnet |
| Matière des tunnels (lue, réglée, renvoyée vers OSM) | #63 | Sonnet ; liste des valeurs OSM : `explorateur` Haiku |
| Retrait de `SITE` des valeurs devenues réglables | issues `inter-equipe` | Chef parcs, `ouvrier` Sonnet |

**Lot 3 : créer une attraction depuis OSM, sans fichier écrit à la main**

| Sous-tâche | Issue | Modèle |
|---|---|---|
| Import depuis l'éditeur, fiche d'import déduite, figures, vérification | #54 | Opus (format et déduction), Sonnet (interface) |
| Réimport sélectif par catégorie, sans perdre la relation 8427077 d'OzIris | #57 (point 7), #54 | Opus |
| Corrections locales d'objets OSM (avant / après, identifiant) | à créer (ancien lot 4) | Opus (format), Sonnet (outils) |
| Contribution vers OSM (diff, sélection, envoi authentifié) | à créer (ancien lot 6) | Opus |
| Essai de bout en bout sur une attraction nouvelle | à créer | Sonnet + `testeur` Haiku |

**Lot 4 : le lieu complet**

| Sous-tâche | Issue | Modèle |
|---|---|---|
| Note de conception : état de jeu à plusieurs éléments, niveaux de détail, simulation à deux régimes, chargement | #56 | Opus |
| Noyau : plusieurs éléments dans un état de jeu, simulation agrégée | à créer (sous #56) | Opus |
| Niveaux de détail du dessin (zoom du lieu, plein détail sur un élément) | à créer (sous #56) | Sonnet |
| Page du lieu : horaires, postes de maintenance, objectifs communs | #57 (point 1) | Sonnet |
| Rôle par lieu, types d'objectifs différents | à créer (sous #56) | Sonnet après la conception |
| Essai à 40 éléments fictifs, cadence ≥ 30 images/s | à créer (sous #56) | `testeur` Haiku |

**Lot 5 : nouveaux types de lieux**

| Sous-tâche | Issue | Modèle |
|---|---|---|
| Vision : hiérarchie type / lieu / éléments | #48 | Opus (conception) |
| Domaine skiable : Vars Les Claux, Escondus, remontées | #49, issues à créer chez osmrides_skiresort | Chef stations (Sonnet) ; extension de type dans `osmrides` : Opus |
| Parcours aquatique (bateaux, chute, pas de lapbars) | à créer (ancien lot 9) | Opus |
| Flat rides | à créer (ancien lot 10) | Opus |

## Historique : anciens lots 0 à 10 (jusqu'au 26/11/2026)

Conservés pour mémoire : découpe par grosse fonctionnalité, remplacée le 26/11 par les lots de maturité ci-dessus. Statuts à jour au 26/11.

| Lot | Objet | Dépend de | Complexité | Modèle |
|---|---|---|---|---|
| 0 | Nettoyage, audit, roadmap | — | faible | Opus (pilotage) — **fait 2026-11-17** |
| 1 | Éditeur v1 (Docker) : barrières et salles de contrôle | 0 | moyenne | Opus (modèle de surcharge + moteur), Sonnet (interface) — **fait 2026-11-17** |
| 2 | Traçabilité OSM à l'import | 0 | faible | Sonnet |
| 3 | Paramètres d'instance éditables (trains, couleurs, sous-type) | 1 | moyenne | Sonnet — **fait 19/11** ; prolongé dans le lot de maturité 2 (versions 0.3.0 à 0.8.0) |
| 4 | Édition des objets OSM importés (corrections locales) | 1, 2 | élevée | Opus (modèle) + Sonnet |
| 5 | Files d'attente complètes (tronçons, fourches, raccords) | 1 | moyenne | Sonnet — **fait en partie** |
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
- **Fonctions** : choisir une attraction ; voir file, barrières (entrée, fourches) et salles de contrôle sur le vrai rendu du jeu ; sélectionner, déplacer, tourner une barrière, ajuster sa longueur, revenir au calcul automatique ; salles : sélectionner, déplacer, tourner, redimensionner, créer, supprimer ; diff avant sauvegarde ; sauvegarde dans `lieux/parc/asterix/<el>.game.js` ; rechargement à l'identique.
- **Tâches** :
  1. Moteur : charger `lieux/parc/asterix/<el>.game.js` (facultatif) dans `jeu.html` et `tools/build.py` ; `GAME.barriers` (surcharges par clé stable) dans `engine/queue.js` ; `GAME.controlRooms` dans `engine/render.js` / `engine/garage.js` (repli `SITE.booth`). — Opus, moyenne, risque : régression des files → `check.js` ×4.
  2. Serveur `editor/server.js` (Node, sans dépendance) : fichiers statiques du dépôt, API liste des sites / lecture / validation / diff / écriture de `game.js` seulement. — Sonnet, faible.
  3. Interface `editor/index.html` : moteur réel + couche d'édition (sélection, poignées, panneau de valeurs, diff, sauvegarde). — Sonnet, moyenne.
  4. Docker : `compose.yaml`, documentation `editor/README.md`. — Haiku/Sonnet, faible.
  5. Tests : `tools/editor-test.js` (ouvrir, modifier, sauvegarder, relire, jouer) + `check.js` ×4. — Sonnet.
- **Livrables** : `editor/`, `compose.yaml`, `lieux/parc/asterix/<el>.game.js` (créé à la première sauvegarde), moteur compatible, tests, doc.
- **Validation** : sur une attraction existante, une barrière et une salle modifiées, sauvegardées, relues après redémarrage du conteneur, visibles et fonctionnelles dans `jeu.html` ; `check.js` ×4 PASS ; attraction sans `game.js` inchangée.

### Lot 2 — Traçabilité OSM à l'import

- **Objectif** : chaque objet importé garde son origine.
- **Tâches** : `make_site.py` ajoute l'id OSM (`w123`, `n456`) et la version aux `feats`, `others`, `stairs`, `doors`, `barriers` ; liste des catégories réellement lues, tirée du code de l'importeur (base du réimport sélectif) ; réimport des 4 sites sans changement de géométrie.
- **Validation** : diff des `data.js` limité aux nouveaux champs ; `check.js` ×4 PASS. — Sonnet, faible.
- **Fait (19/11/2026)** : champs `id` / `v` (+ `OSM.src`), catégories lues dans `osmrides_parks/docs/OSM-GUIDE.md` §7, 4 sites réimportés avec géométrie inchangée (diff = champs de traçabilité seuls) ; changements OSM détectés depuis le dernier import (rocher d'Hourra retagué `bare_rock`, voie de Goudurix retouchée, `lv` des chemins souterrains) **non repris**, à décider avec le propriétaire (lot 7).

### Lot 3 — Paramètres d'instance éditables

- **Objectif** : régler dans l'éditeur ce qui est aujourd'hui écrit à la main dans `SITE` sans code : nombre et couleurs des trains, couleurs de voie et supports, sous-type (`kind`), wagons, physique de base.
- **Tâches** : schéma de validation par clé ; lecture `GAME` > `SITE` pour ces clés ; panneau de formulaire dans l'éditeur. — Sonnet, moyenne.
- **Fait (19/11/2026)** : `GAME.site` (D9, `docs/ARCHITECTURE.md`), section « Attraction » de l'éditeur, validation clé par clé, tests `tools/editor-test.js` ×4 ; capture `docs/plans/lot-3.jpg`.

### Lot 4 — Corrections locales des objets OSM

- **Objectif** : modifier, ajouter, supprimer un objet d'origine OSM (chemin, bâtiment, nœud) en gardant avant / après et l'identifiant.
- **Avant de commencer** : `osmrides_parks/docs/OSM-LIMITES.md` (issue #30) : ce qui se corrige directement dans OSM, ce qui reste local ; proposition de lot réduit.
- **Tâches** : format `lieux/parc/asterix/<el>.osmfix.json` (opérations par id + version d'origine) ; application au chargement (moteur) et dans l'éditeur ; affichage des objets corrigés. — Opus (format), Sonnet (outils), élevée.

### Lot 5 — Files d'attente complètes

- **Objectif** : définir dans l'éditeur les tronçons, les fourches, les raccords et la bouche de file (aujourd'hui `SITE.queue.parts`, écrit à la main), avec validation (visiteurs uniquement sur des chemins).
- Avant de commencer : `osmrides_parks/docs/OSM-LIMITES.md` (issue #30) : tronçons, boucles et raccourcis déductibles d'OSM (chemins à sens unique et nœuds communs ; barrières OSM plus lues, issue #34).
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

## Versions publiées du moteur et suite (26/11/2026)

Le moteur est publié par version (`docs/versions.md`, D13) ; une issue `inter-equipe` prévient chaque chef de jeu.

| Versions | Contenu | Issues | Lot |
|---|---|---|---|
| 0.3.0 à 0.5.0 | réglages d'exploitation et freins par zone, horaires par lieu, hauteurs du circuit (`GAME.profile`), couleurs de voie | #53 (lots 1 et 2 de l'issue), #55 | 2 |
| 0.6.0 | pont transbordeur par champs numériques : **à remplacer** par #64 (WYSIWYG) | #53 (lot 3 de l'issue) | 2 |
| 0.7.0 | `lap` mesuré en jeu ; `text`, `strike`, `dropAfter` retirés de l'éditeur | #57 (point 2) | 2 |
| 0.7.1 à 0.7.4 | reprise de partie, barrière de fourche, fin d'orage, barrière fermée en évacuation, « Départ » vers le garage | #58 (bugs 1 à 3), #59, #62 | 1 |

Rattachement aux lots de maturité ci-dessus (le lot 2 est le lot en cours) :

**À faire, dans l'ordre**
1. **#64** (0.8.0, **lot 2**) : rails `moving` en WYSIWYG : positions enregistrées en déplaçant le rail et nommées, magnétisme, chariot généré, verrouillage de deux rails (Zeus), tag « non connecté » (Hourra). Remplace les champs de 0.6.0 et le point 5 de #58.
2. **#61** (**lot 1**) : garages sans freins manuels, un seul bouton « Envoyer le train » ; avec l'audit du pupitre de **#58** (points 6 à 9 : boutons en double, AR du lift, bouton F).
3. **#60** (**lot 1**) : lift animé, AUTO (démarre un peu avant l'arrivée du train, rampes) ou MANU (marche / arrêt).
4. **#57** (points 3 à 6 : **lot 2** ; page du lieu : **lot 4** ; point 7, réimport sélectif : **lot 3**) : quais en WYSIWYG lus dans OSM et renvoyables ; fenêtres au clic ; page du lieu ; hauteurs choisies sur le circuit ; caméras en WYSIWYG ; réimport sélectif (= lot 7, à suivre avec #54).
5. **#63** (**lot 2**) : matière des tunnels lue dans OSM (tag `material`), réglable dans l'éditeur et renvoyée vers OSM.
6. **#56** (**lot 4**) : plusieurs éléments par page (mode « un élément » conservé ; éléments non commandés dans l'état laissé par le joueur, passables en auto ; rôle par lieu avec des types d'objectifs différents) : note de conception.
7. **#54** (**lot 3**) : création d'une attraction depuis OSM dans l'éditeur (lots 7 et 8).

## Décisions du propriétaire

- 2026-11-17 — **Barrières** : relèvent du jeu ; le nœud OSM `barrier=*` ne donne que la position initiale, la position finale est celle de l'éditeur.
- 2026-11-17 — **Salle de contrôle** : une seule par attraction, celle du pupitre (poste de conduite). Postes d'aiguillage et autres locaux : plus tard.
- 2026-11-26 — **Éditeur** : uniquement du WYSIWYG, pas de valeur à saisir (rails `moving` : positions enregistrées en déplaçant le rail). **Barrières OSM** ignorées. **Usure** : pas de changement (retour à 0 % au garage voulu). **« Départ »** envoie le train hors de la gare, vers le garage ou le circuit selon l'aiguillage. **Lift** : AUTO ou marche / arrêt en MANU, démarrage et arrêt progressifs. **Questions au propriétaire** : dans le chat, pas dans des issues.
