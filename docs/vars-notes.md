# Vars Les Claux : notes d'étude (domaine skiable, issue #48)

Étude seule, rien n'est codé. Contexte : `docs/hierarchie.md` (type « domaine skiable » → lieu Vars Les Claux → éléments = remontées). Source : API OSM du 23/11/2026, 6 extraits de 0,045 x 0,05 degré (bbox 6,62 à 6,755 E, 44,52 à 44,62 N, ≈ 22 Mo, 88 753 nœuds, hors dépôt). Les Claux (front de neige) ≈ 44,572 N, 6,679 E : confirmé par les gares aval de Chabrières V4, Mayt V5, Escondus V15, Claux V1.

## 1. Remontées du secteur Les Claux (OSM)

Longueur calculée sur le tracé du way (hors pente). Dénivelé : aucun `ele` sur les tracés ni les pylônes (135 nœuds avec `ele` sur 88 753, aucun sur ces lignes). Vitesse = longueur / `duration`.

| Nom | `aerialway` | Places | Débit/h | Durée | Long. m | Détails OSM |
|---|---|---|---|---|---|---|
| Chabrières V4 | mixed_lift | 6 | 2643 | 4 min | 1283 | Leitner, `oneway=no` (à confirmer), `bubble=no`, 11 pylônes, gares `access=both` |
| Mayt V5 | chair_lift | 6 | 2800 | - | 2181 | Leitner, détachable, `oneway=yes`, 16 pylônes, entrée + sortie |
| Escondus V15 | chair_lift | 4 | 2000 | 5,5 min | 1367 | Leitner, détachable, `oneway=no` (à corriger), 14 pylônes, entrée + sortie, SEM SEDEV |
| Sibières V14 | chair_lift | 6 | 1800 | 5,17 min | 1462 | Leitner, détachable, `oneway=yes`, 16 pylônes ; les 2 gares sont `entry` (erreur) |
| Peyniers V9 | chair_lift | 4 | - | - | 1240 | CCM, fixe, 18 pylônes ; gare aval nommée « Peyniers V10 » |
| Plans V10 | chair_lift | 4 | - | - | 589 | CCM, fixe, 9 pylônes |
| Fontbonne V11 | chair_lift | 4 | 1754 | - | 232 | fixe, 4 pylônes |
| Écrins V6 | platter | 1 | - | - | 347 | `oneway=yes` |
| Écrins V3 / Claux V1 / Centre / Zakopane | magic_carpet | 1 ou - | - | - | 92 / 143 / 35 / 42 | tapis ; Écrins V3 et Zakopane `covered=yes` |

Autres du domaine (hors Claux) : Vars Speed Master (chair 6, 1438 m), Bois Noir V12 (chair 6, 1948 m), Sainte-Marie V18 (chair 4, 1456 m), Peyrol V16, Crévoux/Eyssina (tire-fesses), secteur Sainte-Marie (R1 à R16, Platte de la Nonne R5, Peyrefolle R6…). Total : 50 ways `aerialway` + 76 nœuds `aerialway=station`.

## 2. Ce qu'OSM donne

- Tracé de la ligne (way ordonné aval vers amont pour les `oneway=yes`), pylônes `aerialway=pylon` (349), gares `aerialway=station` avec `aerialway:access=entry|exit|both` (pas partout), nom, `operator=SEM SEDEV`, `opening_hours` (09:00 à 16:30 environ).
- Débit, places par véhicule, détachable ou non, durée du trajet, constructeur, bulle, chauffage, `ref:FR:CAIRN` (n° de registre STRMTG).
- Bâtiments de gare (`aerialway=station` + `building=yes`), parfois partagés (un seul bâtiment pour Mayt V5, Chabrières V4 et Claux V1 aux Claux).
- Domaine : `landuse=winter_sports` (Vars/Risoul, Vars, Risoul), relations `site=piste` (« Forêt Blanche : Vars/Risoul », 214 membres). Pistes : 206 ways `piste:type=downhill` (104 easy, 36 novice, 44 intermediate, 12 advanced, 1 expert, 4 freeride), nordiques, sled, snow_park ; noms pour une partie seulement (pas de `ref`).
- Voies d'accès autour de la gare aval : `highway` footway, path, track, service, residential, une `secondary` près d'Escondus.

## 3. Ce qu'OSM ne donne pas (nécessaire à l'exploitation)

- Altitudes : aucune sur les lignes ; le profil (dénivelé, pente, tension) doit venir d'un MNT externe, ou d'`ele` ajouté par le propriétaire.
- Gare aval / amont : implicite par l'ordre des nœuds, `access` parfois absent ou faux (Sibières). Pas de poulie motrice, de tendeur, de contrepoids, d'aiguillage.
- Véhicules : nombre de sièges sur le câble, espacement, vitesse nominale, sens de défilement (les ways `oneway=no` ne le disent pas), type de pince.
- Embarquement : pas de zone de file (aucune zone `highway=pedestrian` ou `area` dédiée à la file), pas de tourniquets, pas de portillons de gare aval, pas de tapis d'embarquement. À reconstruire à la main comme pour les attractions.
- Exploitation : pas de vent maximal, pas de consignes de câble, pas de fréquentation, pas de cadence ; seules les heures `opening_hours` existent.
- Pistes : pas de lien remontée vers pistes (une piste arrive à une gare, mais aucune relation), pas de dénivelé, pas d'enneigement.

## 4. Premier élément jouable proposé : Escondus V15

Télésiège débrayable 4 places, 1367 m, 5,5 min, 2000 p/h, Leitner, 14 pylônes, gares entrée (44,5716 N, 6,6799 E) et sortie (44,5611 N, 6,6709 E) bien taguées, un bâtiment aval (way 1034567095), voies d'accès (footway, service, secondary) à moins de 60 m. Vitesse ≈ 4,1 m/s (plausible). Pas de zone d'attente à reconstruire côté amont. Défaut OSM : `oneway=no` (à corriger en `yes`, trace du way déjà dans le bon sens). Variantes : Mayt V5 (mieux placé mais 2181 m et sans `duration`), Sibières V14 (6 places, 5,17 min, gare amont mal taguée).

## 5. Ce que le joueur commanderait

- Vitesse du câble : arrêt, lent (embarquement difficile, évacuation), nominale, rapide (limitée par le vent) ; démarrage et arrêt progressifs.
- Embarquement : ouverture/verrouillage du portillon de gare, tapis d'embarquement, nombre de personnes par siège, débit demandé (régler la cadence plutôt que par siège).
- Arrêt d'urgence, redémarrage après contrôle, évacuation (fermeture des gares, descente par secours).
- Vent : alerte, ralentissement, arrêt au-delà du seuil ; neige, gel, visibilité ; fermeture si inspection de ligne.
- Gares : surveillance de l'arrivée (débarquement), régulation de la file, ouverture matin / fermeture soir (`opening_hours`).
- Commande par zones et jamais par siège (règle du dépôt).

## 6. Réutilisable du moteur actuel / nouveau

Réutilisable tel quel ou presque : lecture et import OSM (`tools/make_site.py` à adapter), tracé et abscisse `s`, caméra, rendu des sols, chemins et visiteurs, files et barrières (`docs/ref/file.md`), portillons (`docs/ref/quai.md`), commande par zones, éditeur et envoi vers OSM, sauvegarde, tests (`tools/check.js`).
À adapter : `OSM.cps` suppose `st0`, `st1`, `lift0`, `lift1`, `brk` (voie de montagnes russes) ; une remontée est une boucle ouverte sans freins ni aiguillages.
Nouveau : modèle de véhicules sur câble (sièges à intervalle fixe, vitesse du câble commune, pas de train), débrayage en gare (ralentissement dans la gare), météo (vent, neige), profil réel (MNT), bâtiments de gare à plusieurs niveaux, pylônes, skieurs qui embarquent sur le tapis / chargent le siège et qui descendent par des pistes (au minimum arrivée amont puis disparition). Vocabulaire propre au type dans `engine/types/ski.js` (`docs/hierarchie.md` §2.4), le cœur reste sans vocabulaire de parc.

## 7. Ce que le propriétaire pourrait ajouter dans OSM

- `ele` sur les nœuds de gare aval et amont de chaque remontée, et sur quelques pylônes.
- Corriger `oneway` (Escondus V15, Chabrières V4 : `yes` pour un siège ; `no` pour une télécabine ne se justifie que si les deux sens sont utilisés), et `aerialway:access` (Sibières V14, Mayt V5 déjà bien).
- `aerialway:duration`, `aerialway:capacity`, `aerialway:occupancy` manquants (Mayt V5 sans durée ; Peyniers V9, Plans V10 sans débit).
- Zone de file en gare aval : `highway=pedestrian` + `area=yes` + `name=File <remontée>`, ou barrières `barrier=gate` / `barrier=turnstile` (portillons de gare).
- Zone d'attente en gare amont (sortie), bâtiments de gare séparés par remontée (au lieu d'un bâtiment partagé).
- `ref:FR:CAIRN` complet, `aerialway:speed` (m/s) si connue.

## 8. Questions au propriétaire (5 max)

1. Es-tu d'accord pour Escondus V15 comme premier élément (4 places, 5,5 min), ou préfères-tu une autre remontée du secteur (Mayt V5, Sibières V14) ?
2. Combien de véhicules sur le câble, vitesse nominale et sens de rotation d'Escondus V15 sont-ils connus (affiches, STRMTG) ? Sinon j'estime et je le signale.
3. Le profil en hauteur : je prends un MNT externe (IGN RGE ALTI, hors OSM), ou tu ajoutes `ele` dans OSM ?
4. Le sol : les pistes (`piste:type=downhill`, relation `site=piste`) sont-elles à afficher dès le départ, ou seulement la remontée et la gare ?
5. Vent et neige : veux-tu une météo simulée d'emblée (vent, visibilité), ou seulement la cadence et l'embarquement pour ce premier élément ?
