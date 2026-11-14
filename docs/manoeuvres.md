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
Zeus = `device: 'switch'`, 1 voie (trains en file, capacité calculée : 1). Trace du Hourra = `device: 'table'`, 6 voies (un train par voie).
Au départ, tous les trains sauf le premier sont au garage (`SITE.trains[i].lane`, sinon première voie libre).

## Commandes au pupitre (identiques pour toutes les attractions)

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
- L'arrêt d'urgence immobilise aussi les manœuvres (les trains s'arrêtent, il faut redonner l'ordre) et fige l'appareil.

Chaque refus s'affiche dans le journal avec la raison (« Voie 3 occupée », « Pont en mouvement »…).

## Hypothèses à signaler

La position de l'appareil, l'orientation des voies, la longueur des wagons et les vitesses de manœuvre ne figurent pas dans OpenStreetMap.
Elles sont estimées ; le dire en commentaire dans `sites/<site>.js` et au propriétaire.
