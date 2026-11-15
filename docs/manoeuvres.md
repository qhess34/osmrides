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
  side: 1,                 // côté du garage (1 = droite du sens de marche) ; le rail mobile du parcours sort du circuit du côté opposé
  gap: 3.2,                // écart entre les axes des rails A (circuit) et B (garage) sur le chariot
  pre: .6, post: .6,       // rail au-delà du train arrêté au point de raccordement (arrière, avant) : rail = un train + pre + post
  laneGap: .8,             // jeu entre le bout du rail du chariot et le début des voies
  lanes: [ {name, d, len, cap}, … ],  // voies droites parallèles aux rails ; d = distance de l'axe du circuit à l'axe de la voie
  move: { v: 1.8, vc: .6, t: 4 },     // vitesse des trains, vitesse du chariot (m/s), durée minimale d'un déplacement (s)
  retract: { d: 3.2, name: 'Rail mobile du parcours', short: 'Rail parcours', rest: 1 }  // facultatif : rail mobile du parcours escamotable, indépendant du chariot (ci-dessous)
}
```

**Rail mobile du parcours escamotable (`retract`, Trace du Hourra, prioritaire sur la description à deux rails ci-dessous).** Deux éléments mobiles indépendants :
- rail mobile du parcours (rail du circuit, zone de freinage) : deux positions seulement, sur le circuit (`#yA0`) ou retiré de `d` m à l'opposé du garage (`#yA1`) ; il ne porte jamais de train vers les voies ;
- chariot du rail du chariot (rail de garage, porte le train) : `G` (`#yG`, rail du chariot en ligne) ou face à la voie k (`#yk`) ; pas de position `P` (pas de `#yP`) ; au départ face à la voie `rest`.
- Verrouillages : le rail du chariot ne vient en ligne que si le rail mobile du parcours est retiré (et immobile) ; le rail mobile du parcours ne revient sur le circuit que si le chariot n'est ni en ligne ni en mouvement ; le rail mobile du parcours ne bouge pas si un train y est, y roule ou s'en approche ; le chariot garde les verrouillages ci-dessous (train en partie dessus, qui roule, passagers) ; les trains du circuit ne passent que si le rail mobile du parcours est sur le circuit ou le rail du chariot en ligne (règle « à vide » inchangée) ; l'arrêt d'urgence fige les deux.
- Séquences : voir « Commandes au pupitre par zones » ci-dessous.

- Le chariot porte deux rails **droits et parallèles**, chacun long d'un train, posés sur une ligne droite du circuit (le train arrêté au point de raccordement y tient entier). Rail mobile du parcours = rail du circuit (zone de freinage), rail du chariot = rail de garage (freins et pneus).
- Positions : `P` (rail mobile du parcours en ligne), `G` (rail du chariot en ligne, bouton `#yG`), `1…n` (rail du chariot face à la voie k). La durée d'un déplacement dépend de la course.
- Le train arrêté sur le rail du chariot est **emporté** par le chariot (il suit le décalage du chariot à l'écran et dans la simulation). Il entre dans la voie en marche avant (`AV`) et en ressort en arrière (`AR`) jusque sur le rail du chariot.
- Rail du circuit hors ligne : les trains du circuit s'arrêtent avant le chariot ; seul un train vide conduit par Frein final AV roule sur le rail du chariot en ligne, et il n'en repart vers la gare que sur Rail du chariot AV.
- Verrouillages propres : le chariot ne bouge pas si un train y roule, n'y est qu'en partie ou est en manœuvre ; il n'emporte qu'un train arrêté, vide, entièrement sur le rail du chariot ; il ne porte pas un train vers une voie occupée ; il ne remet un train sur le circuit (`G`) que si le dernier canton est libre et que `maxRun` le permet. Tant qu'un train est sur le chariot, le dernier canton est tenu pour occupé.
- Chaque voie est un canton ; le rail du chariot en est un aussi.
Au départ, tous les trains sauf le premier sont au garage (`SITE.trains[i].lane`, sinon première voie libre).

## Principe de commande (décision du propriétaire, 2026-11-14)

**Le joueur ne commande pas les trains, il commande les zones.** Chaque zone de voie a ses actionneurs ; les trains réagissent à ce qui se trouve sous eux.

| Zone | Actionneurs au pupitre |
|---|---|
| Gare | freins liés au départ (pas de bouton), moteurs (pneus) avancer / reculer |
| Lift | marche / arrêt |
| Zones de freinage (freins de bloc, frein final, rail du chariot) | freins serrés / relâchés ; moteurs avancer / reculer là où il y en a |
| Chariot / aiguillage | position (P ou voie k) |
| Voies de garage | freins, moteurs reculer / arrêt (pas d'Avancer : l'entrée dans la voie est poussée par la zone porteuse) |

Fait en T7 (ci-dessous). Les verrouillages restent valables.

**Complément du propriétaire** : les zones de freinage sont **automatiques** par défaut (cantonnement, anti-collision) ; chacune peut passer en manuel au pupitre, et revenir en auto.

## Commandes au pupitre par zones (T7, implémenté)

Le moteur découpe la voie en zones (`ZONES`, `tZone(t)` dans `engine/garage.js`) ; une commande agit sur le train qui se trouve dans la zone (`zoneCmd` dans `engine/sim.js`, `act('zone', '<zone>:<cmd>')`).

| Zone | Id | Commandes | Mode |
|---|---|---|---|
| Gare | `St` | **pas de bouton de frein** (freins serrés automatiquement tant qu'un train est à quai, relâchés par la seule séquence Départ), Avancer `f`, Reculer `b`, Arrêt `x` (déplacements à vide vers le garage) | manuel |
| Lift | `Lift` | Marche `on`, Arrêt `off` (chaîne stoppée : le train sur le lift y reste ; départs bloqués) | — |
| Freins de bloc | `B1…Bn` | freins `k` (moteurs si `SITE.zones`) | AUTO / MANU `m` |
| Frein final | `Fin` | freins `k`, `f`, `b`, `x` | AUTO / MANU `m` |
| Rail mobile du parcours du pont droit (rail A, plaque « Rail parcours ») | `RA` | freins `k`, `f`, `b`, `x` | AUTO / MANU `m` |
| Rail du chariot (rail B, chariot) | `RB` | freins `k`, `f` (zone porteuse : pousse le train dans la voie en face), `b` (refusé), `x` | manuel |
| Frein avant gare (si `SITE.preBrake`) | `Pre` | freins `k`, `f` (vers la gare), `x` | AUTO / MANU `m` |
| Voies de garage | `L1…Ln` | freins `k`, **Reculer** `b`, Arrêt `x` — **pas d'Avancer** (propriétaire, 2026-11-15) | manuel |
| Appareil | — | positions `#yP`, `#y1…#yN`, `#yG`, rail mobile du parcours `#yA0`/`#yA1` (inchangé) | manuel |

- **Moteurs** : `SITE.zones = { <id ou groupe B / L> : {brake, drive} }`. Défaut : freins partout ; moteurs partout sauf sur les freins de bloc (estimé, à confirmer par attraction).
- **AUTO / MANU** (zones de freinage) : en AUTO (défaut) le cantonnement serre et relâche seul ; en MANU, `k` serre / relâche et les moteurs obéissent au pupitre. Passer en MANU serre les freins si un train y est arrêté. `#zAuto` remet toutes les zones en AUTO. En MANU, freins relâchés, le cantonnement reste actif (sécurité).
- **Anti-collision** : relâcher les freins d'une zone qui retient un train est refusé si la section suivante est occupée (canton suivant, chariot, gare).
- **Gare `f`** : appareil sur une voie (raccordement en gare) : le train vide à quai part au garage (règles d'Avancer ci-dessous) ; sinon le train **vide** quitte la gare (départ à vide ; avec passagers, bouton Départ après les lapbars). Les freins de gare sont liés au départ : fermés tant qu'un train est à quai, ouverts uniquement par la séquence Départ (portillons fermés, lapbars validés).
- **Frein final `f`** : pont droit, rail du chariot en ligne : conduit le train **vide** arrêté avant le pont sur le rail du chariot (il s'y arrête) ; appareil sur une voie (raccordement au frein final) : le train quitte le circuit vers la voie ; sinon vers la gare. Frein final serré (MANU) : le train est retenu avant le pont (pont droit) ou au point d'arrêt (sinon). C'est ce qui remplace « Retenir pour le garage ».
- **Rail du chariot `f`** : train porté par le chariot face à une voie : il entre dans la voie (marche avant) ; rail du chariot en ligne : il part vers la gare (jamais automatiquement).
- **Zone porteuse (`CARR`) et voies** (propriétaire, 2026-11-15) : les voies de garage n'ont **pas de bouton Avancer**. L'entrée dans une voie est poussée par la zone porteuse, appareil en place face à la voie : `RB` (Rail du chariot) pour un pont droit, `St` (Gare) pour un raccordement en gare (Zeus), `Fin` pour un raccordement au frein final sans pont droit. Avancer de la zone porteuse sans train dans la zone reprend la poussée d'un train arrêté à l'entrée de la voie ; son Arrêt `x` arrête aussi le train qu'elle pousse. La sortie se fait au **Reculer de la voie** (`#zL<k>_b`) : sur le rail du chariot (pont droit, chariot face à la voie, rail du chariot libre) ou jusqu'en gare (aiguillage sur la voie, gare libre). `x` de la voie arrête ses moteurs. Freins de voie serrés : la voie ne bouge plus ; on n'y entre pas. Verrouillages inchangés (train vide, appareil en place, capacité de la voie, `maxRun`, arrêt d'urgence).
- **Frein avant gare `Pre`** (`SITE.preBrake:{back, len, name}`, Trace du Hourra) : zone de freinage de stockage juste avant l'entrée en gare, un train de long (`len`, défaut un train + 0,5 m), point d'arrêt à `back` m (défaut 1) avant le début de la gare, pneus. En AUTO, le train qui quitte le frein final (ou le rail mobile du parcours) n'y va que si elle est libre, s'y arrête et attend que la gare soit libre ; en MANU, `k` serre / relâche (relâchement refusé gare occupée) et `f` envoie le train en gare. Le frein final et le rail mobile du parcours attendent donc « frein avant gare libre » au lieu de « gare libre ».
- Marche arrière refusée sur le circuit (gare, freins, rail mobile du parcours / rail du chariot).
- L'arrêt d'urgence arrête tous les moteurs et refuse toute commande de moteur.

Le joueur enchaîne lui-même ces commandes : rien n'est automatique entre deux étapes de manœuvre ; l'exploitation normale du circuit reste automatique (zones en AUTO).

### Portillons

Ils ne s'ouvrent et ne se ferment **qu'au bouton du pupitre** (`#bGate`), en auto comme en manuel. Un train prêt (départ décidé en auto) attend leur fermeture (indication au journal) ; la vérification des lapbars commence portillons fermés.

### Séquence type : rentrer un train au garage (raccordement en gare, Zeus)

1. Train vide à quai, portillons fermés ; aiguillage sur la voie `k` libre → attendre « en place ».
2. Gare AV (zone porteuse) : les moteurs de gare poussent le train hors du circuit jusqu'en bout de voie. Aiguillage sur `P`.

### Séquence type : sortir un train (Zeus)

1. Gare libre (au besoin frein final en MANU et serré pour retenir l'autre train).
2. Aiguillage sur la voie, Garage AR (Reculer de la voie) : le train recule jusqu'en gare. Aiguillage sur `P`.

### Pont droit à rail mobile du parcours escamotable (Trace du Hourra)

**Stockage (propriétaire, 2026-11-15).** Le rail mobile du parcours est une **zone de freinage de stockage** : en AUTO, un train arrive au frein final, avance sur le rail mobile s'il est sur le circuit et libre, s'y arrête entièrement et y est retenu jusqu'à ce que la gare soit libre ; le train suivant est retenu au frein final derrière lui (le frein final et le rail mobile stockent un train chacun, le canton B3 retient le suivant). Le synoptique colore les deux zones (vert libre, ambre train retenu, rouge freins serrés). Avec le frein avant gare (propriétaire, 2026-11-15) : trois positions de stockage quand la gare est occupée — frein avant gare, rail mobile du parcours, frein final — puis chaque train entre en gare à son tour (Pre → gare, RA → Pre → gare, Fin → RA → Pre → gare). Vérifié par `tools/check.js hourra` (storePre, storeRA, storeFin, refusePre, enterA, enterB, enterC).

- Garer : train vide (Gare AV), frein final MANU serré (arrêt avant le pont), rail mobile du parcours retiré, chariot sur G, relâcher, Frein final AV (sur le rail du chariot), chariot sur une voie libre (il l'emporte), Rail du chariot AV (il le pousse dans la voie), chariot au repos, rail mobile du parcours sur le circuit, TOUT AUTO.
- Sortir : chariot face à la voie, Voie k AR (sur le rail du chariot), rail mobile du parcours retiré, chariot sur G (dernier canton libre), Rail du chariot AV (vers le frein avant gare, puis la gare), chariot sur une voie, rail mobile du parcours sur le circuit.

## Verrouillages (sécurité, toujours actifs)

- L'appareil ne bouge pas si un train est dessus ou à moins d'une longueur de train de lui (train du garage sur le circuit, la liaison ou l'appareil ; train du circuit qui le franchit). Pas de nouvelle commande pendant qu'il bouge.
- Un train ne franchit l'appareil que si celui-ci est en place sur la voie qu'il vise.
- Un train n'entre pas sur une voie déjà occupée au-delà de sa capacité (`cap`).
- Appareil hors de `P` : les départs (raccordement en gare) ou l'entrée en gare (raccordement au frein final) sont bloqués.
- Un train avec passagers ne quitte jamais le circuit.
- Au plus `SITE.maxRun` trains sur le circuit : au-delà, la sortie du garage est refusée (Trace du Hourra : 5 sur 6).
- Raccordement au frein final : le train qui sort du garage occupe le dernier canton ; les trains du parcours sont retenus au dernier frein de bloc. Serrer un frein de bloc au pupitre (zone `B<n>` en MANU, `#zB<n>_k`) aide à libérer le dernier canton avant une sortie.
- L'arrêt d'urgence immobilise aussi les manœuvres (moteurs de zone arrêtés, il faut redonner l'ordre) et fige l'appareil.

Chaque refus s'affiche dans le journal avec la raison (« Voie 3 occupée », « Pont en mouvement »…).

## Hypothèses à signaler

La position de l'appareil, l'orientation des voies, la longueur des wagons et les vitesses de manœuvre ne figurent pas dans OpenStreetMap.
Elles sont estimées ; le dire en commentaire dans `sites/<site>.js` et au propriétaire.
