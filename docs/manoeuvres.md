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
  device: 'switch' | 'table',     // aiguillage à 2 positions ou pont transbordeur à N positions
  link: {...},                    // géométrie du tronçon de liaison (depuis OSM ou estimée — le signaler)
  lanes: [ {name, pts, cap}, … ], // voies de garage : tracé, nombre de trains qu'elle contient
  move: { v: 1.2, t: 6 }          // vitesse de manœuvre (m/s) et durée de déplacement de l'appareil (s) — estimées
}
```

Zeus = `device: 'switch'`, 1 voie (trains en file). Trace du Hourra = `device: 'table'`, 5 voies (un train par voie).
Le moteur actuel ne gère que le cas Zeus (`SITE.garage`) ; la généralisation est la tâche T3 de `docs/ROADMAP.md`.

## Commandes au pupitre (identiques pour toutes les attractions)

1. **Positionner l'appareil** : choisir `P` ou une voie `k`. Le déplacement prend `move.t` secondes ; pendant ce temps aucun train ne franchit l'appareil.
2. **Avancer** un train sélectionné : vers l'appareil puis la voie choisie (entrée au garage), ou de la voie vers l'appareil.
3. **Reculer** un train sélectionné : marche arrière sur sa voie, sur le tronçon de liaison, ou du tronçon vers le point de raccordement.
4. **Arrêter** la manœuvre en cours (le train s'immobilise sur place).

Le joueur enchaîne lui-même ces commandes : rien n'est automatique entre deux étapes. Le pupitre affiche pour chaque train sa position (circuit, liaison, voie k, appareil) et pour l'appareil sa position et son état (en place / en mouvement / verrouillé).

### Séquence type : rentrer un train au garage

1. Train vide, arrêté au point de raccordement (gare portillons fermés, ou frein final bloqué).
2. Appareil sur la voie `k` libre → attendre « en place ».
3. Avancer le train : il quitte le circuit, traverse la liaison et l'appareil, s'arrête en bout de voie `k`.
4. Remettre l'appareil sur `P` pour rendre le circuit à l'exploitation.

### Séquence type : sortir un train

1. Point de raccordement libre (bloquer au besoin l'autre train au frein final).
2. Appareil sur la voie `k` du train → attendre « en place ».
3. Reculer (ou avancer, selon le sens des voies) le train jusqu'au point de raccordement.
4. Appareil sur `P`. Le train reprend l'exploitation depuis la gare.

## Verrouillages (sécurité, toujours actifs)

- L'appareil ne bouge pas si un train est dessus ou à moins d'une longueur de train de lui.
- Un train ne franchit l'appareil que si celui-ci est en place sur la voie qu'il vise.
- Un train n'entre pas sur une voie déjà occupée au-delà de sa capacité (`cap`).
- Appareil hors de `P` : les départs (raccordement en gare) ou l'entrée en gare (raccordement au frein final) sont bloqués.
- Un train avec passagers ne quitte jamais le circuit.
- L'arrêt d'urgence immobilise aussi les manœuvres.

Chaque refus s'affiche dans le journal avec la raison (« Voie 3 occupée », « Pont en mouvement »…).

## Hypothèses à signaler

La position de l'appareil, l'orientation des voies, la longueur des wagons et les vitesses de manœuvre ne figurent pas dans OpenStreetMap.
Elles sont estimées ; le dire en commentaire dans `sites/<site>.js` et au propriétaire.
