# Manœuvres communes à toutes les attractions

Ce document est la référence unique pour tout ce qui déplace un train hors du circuit normal : aiguillage, pont transbordeur, garage, marche arrière.
Chaque attraction décrit son installation dans `SITE.yard` (configuration) ; le moteur applique les règles ci-dessous sans rien savoir de l'attraction.
Une nouvelle attraction ne réécrit pas ces règles : elle déclare ses voies et ses positions.

## Vocabulaire

| Terme | Sens dans le jeu |
|---|---|
| Circuit | La boucle principale (gare → lift → parcours → frein final → gare). Abscisse `s`. |
| Point de raccordement | Endroit du circuit où l'on peut quitter la boucle : gare (`at: 'station'`) ou frein final (`at: 'brake'`). |
| Appareil de voie | Ce qui relie le circuit aux voies de garage : aiguillage (2 positions) ou pont transbordeur / rampe coulissante (N positions). |
| Position | Une valeur de l'appareil : `P` (circuit, voie principale) ou `1…n` (voie de garage n°k). |
| Tronçon de liaison | Voie courte entre le point de raccordement et l'appareil. |
| Voie de garage | Voie en impasse où l'on range un ou plusieurs trains. |
| Canton | Portion de voie qu'un seul train peut occuper. Le tronçon de liaison et chaque voie de garage sont des cantons. |

## Modèle de voies (`SITE.yard`)

```
yard: {
  at: 'station' | 'brake',        // point de raccordement sur le circuit
  device: 'switch' | 'table',     // aiguillage à 2 positions ou pont transbordeur à N+1 positions (P, 1…n)
  a, b,                           // l'appareil occupe le circuit de raccordement+a à raccordement+b (m)
  slide, side, len,               // course du chariot (m), côté du garage (-1/1), longueur dessinée du chariot
  lanes: [ {name, pts, cap, off}, … ], // voies : tracé (pts[0] = entrée de la voie), capacité (défaut : ce qui tient), décalage du chariot pour cette voie (défaut slide × k)
  move: { v: 2.4, t: 3 },         // vitesse de manœuvre (m/s) et durée d'un déplacement de l'appareil (s) — estimées
  devName, devLabel               // facultatif : nom au pupitre (« Aiguillage ») et dans une phrase (« l'aiguillage »)
}
```

Le tronçon de transfert de chaque voie est calculé par le moteur : courbe en S du circuit (raccordement + `a`) jusqu'à `pts[0]`.
L'appareil est un chariot qui coulisse à l'opposé du garage et porte le tronçon du circuit et le tronçon de transfert : en position `k`, le transfert de la voie `k` est en place.
Le train ne reste jamais sur le chariot pendant qu'il bouge : il franchit l'appareil une fois celui-ci en place (`table` : un seul tronçon de transfert dessiné, celui de la voie visée).
Zeus = `device: 'switch'`, 1 voie (trains en file, capacité calculée : 1). Trace du Hourra = `device: 'traverser'` (ci-dessous), 6 voies (un train par voie).

### Pont transbordeur droit qui emporte le train (`device: 'traverser'`)

```
yard: {
  at: 'brake', device: 'traverser',
  side: 1,                 // côté du garage (1 = droite du sens de marche) ; le rail A sort du circuit du côté opposé
  gap: 3.2,                // écart entre les axes des rails A (circuit) et B (garage) sur le chariot
  pre: .6, post: .6,       // rail au-delà du train arrêté au point de raccordement (arrière, avant) : rail = un train + pre + post
  laneGap: .8,             // jeu entre le bout du rail B et le début des voies
  lanes: [ {name, d, len, cap}, … ],  // voies droites parallèles aux rails ; d = distance de l'axe du circuit à l'axe de la voie
  move: { v: 1.8, vc: .6, t: 4 },     // vitesse des trains, vitesse du chariot (m/s), durée minimale d'un déplacement (s)
  retract: { d: 3.2, name: 'Rail A', rest: 1 }  // facultatif : rail A escamotable, indépendant du chariot (ci-dessous)
}
```

**Rail A escamotable (`retract`, Trace du Hourra, prioritaire sur la description à deux rails ci-dessous).** Deux éléments mobiles indépendants :
- rail A (rail du circuit, zone de freinage) : deux positions seulement, sur le circuit (`#yA0`) ou retiré de `d` m à l'opposé du garage (`#yA1`) ; il ne porte jamais de train vers les voies ;
- chariot du rail B (rail de garage, porte le train) : `G` (`#yG`, rail B en ligne) ou face à la voie k (`#yk`) ; pas de position `P` (pas de `#yP`) ; au départ face à la voie `rest`.
- Verrouillages : le rail B ne vient en ligne que si le rail A est retiré (et immobile) ; le rail A ne revient sur le circuit que si le chariot n'est ni en ligne ni en mouvement ; le rail A ne bouge pas si un train y est, y roule ou s'en approche ; le chariot garde les verrouillages ci-dessous (train en partie dessus, qui roule, passagers) ; les trains du circuit ne passent que si le rail A est sur le circuit ou le rail B en ligne (règle « à vide » inchangée) ; l'arrêt d'urgence fige les deux.
- Séquence pour garer : G du train (il s'arrête à vide avant le pont), rail A retiré, chariot sur G (le train s'arrête sur le rail B), chariot sur la voie k (il emporte le train), AV, chariot ramené au repos, rail A sur le circuit. Sortir : chariot sur la voie, AR, rail A retiré, chariot sur G (dernier canton libre), le train entre en gare, chariot sur une voie, rail A sur le circuit.

- Le chariot porte deux rails **droits et parallèles**, chacun long d'un train, posés sur une ligne droite du circuit (le train arrêté au point de raccordement y tient entier). Rail A = rail du circuit (zone de freinage), rail B = rail de garage (freins et pneus).
- Positions : `P` (rail A en ligne), `G` (rail B en ligne, bouton `#yG`), `1…n` (rail B face à la voie k). La durée d'un déplacement dépend de la course.
- Le train arrêté sur le rail B est **emporté** par le chariot (il suit le décalage du chariot à l'écran et dans la simulation). Il entre dans la voie en marche avant (`AV`) et en ressort en arrière (`AR`) jusque sur le rail B.
- Aucun rail en ligne (chariot en mouvement ou face à une voie) : les trains du circuit s'arrêtent avant le chariot. Un train retenu pour le garage (`G`) s'arrête aussi avant le chariot tant qu'il n'est pas sur `G`.
- Verrouillages propres : le chariot ne bouge pas si un train y roule, n'y est qu'en partie ou est en manœuvre ; il n'emporte qu'un train arrêté, vide, entièrement sur le rail B ; il ne porte pas un train vers une voie occupée ; il ne remet un train sur le circuit (`G`) que si le dernier canton est libre et que `maxRun` le permet. Tant qu'un train est sur le chariot, le dernier canton est tenu pour occupé.
- Chaque voie est un canton ; le rail B en est un aussi.
Au départ, tous les trains sauf le premier sont au garage (`SITE.trains[i].lane`, sinon première voie libre).

## Principe de commande (décision du propriétaire, 2026-11-14)

**Le joueur ne commande pas les trains, il commande les zones.** Chaque zone de voie a ses actionneurs ; les trains réagissent à ce qui se trouve sous eux.

| Zone | Actionneurs au pupitre |
|---|---|
| Gare | freins (serrer / relâcher), moteurs (pneus) avancer / reculer |
| Lift | marche / arrêt |
| Zones de freinage (freins de bloc, frein final, rail du chariot) | freins serrés / relâchés ; moteurs avancer / reculer là où il y en a |
| Chariot / aiguillage | position (P ou voie k) |
| Voies de garage | freins, moteurs avancer / reculer |

Les boutons « par train » (G, AV, AR, STOP) de T3 sont à remplacer par ces commandes par zone (tâche T7). Les verrouillages ci-dessous restent valables.

## Commandes au pupitre (version T3, à remplacer par la commande par zones)

1. **Positionner l'appareil** : choisir `P` ou une voie `k`. Le déplacement prend `move.t` secondes ; pendant ce temps aucun train ne franchit l'appareil.
2. **Avancer** (`AV`) : du point de raccordement vers la voie où est l'appareil (entrée au garage), ou vers le fond de sa voie. Le train s'arrête seul en butée ou derrière le train garé devant.
3. **Reculer** (`AR`) : de la voie vers le point de raccordement (sortie du garage) ; il s'arrête avant l'appareil si celui-ci n'est pas en place ou si le raccordement n'est pas libre.
4. **Arrêter** (`STOP`) la manœuvre en cours (le train s'immobilise sur place).

Aide conservée : le bouton `G` d'un train le retient vide au point de raccordement (en gare, ou sur le frein final), sans rien déclencher d'autre.
Boutons : appareil `#yP`, `#y1`…`#yN` ; trains `#tG<i>`, `#tF<i>`, `#tB<i>`, `#tX<i>`.

Le joueur enchaîne lui-même ces commandes : rien n'est automatique entre deux étapes. Le pupitre affiche pour chaque train sa position (circuit, liaison, voie k, appareil) et pour l'appareil sa position et son état (en place / en mouvement / verrouillé).

### Séquence type : rentrer un train au garage

1. Train vide, arrêté au point de raccordement (gare portillons fermés, ou frein final bloqué).
2. Portillons fermés, appareil sur la voie `k` libre → attendre « en place ».
3. Avancer le train : il quitte le circuit, traverse la liaison et l'appareil, s'arrête en bout de voie `k`.
4. Remettre l'appareil sur `P` pour rendre le circuit à l'exploitation.

### Séquence type : sortir un train

1. Point de raccordement libre (bloquer au besoin l'autre train au frein final).
2. Appareil sur la voie `k` du train → attendre « en place ».
3. Reculer le train jusqu'au point de raccordement.
4. Appareil sur `P`. Le train reprend l'exploitation depuis la gare.

## Verrouillages (sécurité, toujours actifs)

- L'appareil ne bouge pas si un train est dessus ou à moins d'une longueur de train de lui (train du garage sur le circuit, la liaison ou l'appareil ; train du circuit qui le franchit). Pas de nouvelle commande pendant qu'il bouge.
- Un train ne franchit l'appareil que si celui-ci est en place sur la voie qu'il vise.
- Un train n'entre pas sur une voie déjà occupée au-delà de sa capacité (`cap`).
- Appareil hors de `P` : les départs (raccordement en gare) ou l'entrée en gare (raccordement au frein final) sont bloqués.
- Un train avec passagers ne quitte jamais le circuit.
- Au plus `SITE.maxRun` trains sur le circuit : au-delà, la sortie du garage est refusée (Trace du Hourra : 5 sur 6).
- Raccordement au frein final : le train qui sort du garage occupe le dernier canton ; les trains du parcours sont retenus au dernier frein de bloc. Fermer un frein de bloc au pupitre (`#bBk<n>`) aide à libérer le dernier canton avant une sortie.
- L'arrêt d'urgence immobilise aussi les manœuvres (les trains s'arrêtent, il faut redonner l'ordre) et fige l'appareil.

Chaque refus s'affiche dans le journal avec la raison (« Voie 3 occupée », « Pont en mouvement »…).

## Hypothèses à signaler

La position de l'appareil, l'orientation des voies, la longueur des wagons et les vitesses de manœuvre ne figurent pas dans OpenStreetMap.
Elles sont estimées ; le dire en commentaire dans `sites/<site>.js` et au propriétaire.
