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
| Lift | Règle par défaut (propriétaire, 2026-11-15) : un seul train sur le lift ; le suivant, parti de la gare, attend au pied du lift. Le train arrivé en haut y est retenu (chaîne arrêtée pour lui) tant que la zone de freinage suivante (1er frein de bloc, sinon frein final) est occupée. |

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

**Pont à rail unique (`single: true`, OzIris ; propriétaire, 2026-11-15 : « c'est la voie du parcours qui vient chercher les trains au garage »).** Le chariot porte **un seul rail**, qui **est** le tronçon du circuit (fin du frein final) : pas de rail B distinct, pas de `gap`, pas de position `G`.
- Positions : `P` (`#yP`, rail en ligne avec le circuit) et `1…n` (`#y1…#yN`, le même rail face à la voie k ; le circuit est alors interrompu).
- Zone unique `RB`, nom `yard.railName` (défaut « Rail du pont ») : zone de freinage du circuit en `P` (**AUTO** par défaut, comme `RA` : un train s'y arrête, y est stocké et repart vers la gare dès qu'elle est libre ; MANU : freins `#zRB_k`, Avancer `#zRB_f`) **et** zone porteuse face à une voie (le train porté entre dans la voie au **Dispatch** de la voie, `#zL<k>_d` ; `#zRB_f`/`#zRB_b` refusés tant qu'un train est porté face à une voie).
- Garer : Rail du pont en MANU, freins serrés (`#zRB_m`, `#zRB_k`) ; Gare AV (train vide) : il s'arrête sur le rail ; pont sur une voie libre (`#y<k>`, il emporte le train) ; relâcher (`#zRB_k`) puis `#zL<k>_d` (il recule dans la voie) ; `#yP` (rail vide), TOUT AUTO.
- Sortir : pont (vide) face à la voie (`#y<k>`), `#zL<k>_d` (le train avance sur le rail), `#yP` (dernier canton libre, `maxRun`) : il retrouve le circuit sur le rail et, zone en AUTO, repart vers la gare dès qu'elle est libre.
- Verrouillages : ceux du chariot ci-dessous (pas de mouvement avec un train qui roule sur le rail ou s'en approche, qui n'y est qu'en partie ou qui a des passagers ; voie occupée ; retour en `P` refusé si un train **roule** dans le dernier canton **en amont** du pont (un train arrêté au frein final ne l'empêche pas, il y reste retenu par le cantonnement, propriétaire 2026-11-17) ; un train déjà passé au-delà du pont (frein avant gare, gare) ne l'empêche pas : le rail du pont, zone de freinage, retient le train remis en ligne jusqu'à ce que la section suivante se libère) ; rail hors de `P` : les trains du circuit s'arrêtent avant le pont (frein final en AUTO), le cantonnement retient les suivants ; un train porté ne tient le dernier canton pour occupé que si le rail est en `P` (voir « Train porté et cantonnement ») ; l'arrêt d'urgence fige le chariot. Synoptique : un seul rail, circuit coupé tant que le rail n'est pas en `P`.
- Vérifié par `tools/check.js oziris` (garer dans la voie 3, sortir les voies 1 et 2 ; refus : rail commandé pendant qu'un train y roule, train du circuit retenu rail hors de `P`, retour en `P` refusé avec un train qui roule dans le dernier canton (`refuseRollingLast`), autorisé avec un train arrêté avant le pont qui reste retenu (`backStopped2`, `held1`), arrêt d'urgence).

**Voies en amont du pont (`rev: true`, OzIris).** Les voies partent du bord amont du chariot, à côté du circuit, à contre-sens : le train porté entre dans la voie en **marche arrière** et en ressort en **marche avant**, les deux au **Dispatch** de la voie (`#zL<k>_d`), qui choisit le sens. Le moteur garde ses abscisses et ses verrouillages ; seule la géométrie (l'avant du train est en u = 2·G_B − g) est retournée.

**Rail mobile du parcours escamotable (`retract`, Trace du Hourra, prioritaire sur la description à deux rails ci-dessous).** Deux éléments mobiles indépendants :
- rail mobile du parcours (rail du circuit, zone de freinage) : deux positions seulement, sur le circuit (`#yA0`) ou retiré de `d` m à l'opposé du garage (`#yA1`) ; il ne porte jamais de train vers les voies ;
- chariot du rail du chariot (rail de garage, porte le train) : `G` (`#yG`, rail du chariot en ligne) ou face à la voie k (`#yk`) ; pas de position `P` (pas de `#yP`) ; au départ face à la voie `rest`.
- Verrouillages : le rail du chariot ne vient en ligne que si le rail mobile du parcours est retiré (et immobile) ; le rail mobile du parcours ne revient sur le circuit que si le chariot n'est ni en ligne ni en mouvement ; le rail mobile du parcours ne bouge pas si un train y est, y roule ou s'en approche ; le chariot garde les verrouillages ci-dessous (train en partie dessus, qui roule, passagers) ; les trains du circuit ne passent que si le rail mobile du parcours est sur le circuit ou le rail du chariot en ligne (règle « à vide » inchangée) ; l'arrêt d'urgence fige les deux.
- Séquences : voir « Commandes au pupitre par zones » ci-dessous.

- Le chariot porte deux rails **droits et parallèles**, chacun long d'un train, posés sur une ligne droite du circuit (le train arrêté au point de raccordement y tient entier). Rail mobile du parcours = rail du circuit (zone de freinage), rail du chariot = rail de garage (freins et pneus).
- Positions : `P` (rail mobile du parcours en ligne), `G` (rail du chariot en ligne, bouton `#yG`), `1…n` (rail du chariot face à la voie k). La durée d'un déplacement dépend de la course.
- Le train arrêté sur le rail du chariot est **emporté** par le chariot (il suit le décalage du chariot à l'écran et dans la simulation). Il entre dans la voie en marche avant (`AV`) et en ressort en arrière (`AR`) jusque sur le rail du chariot.
- Rail du circuit hors ligne : les trains du circuit s'arrêtent avant le chariot ; seul un train vide conduit par Frein final AV roule sur le rail du chariot en ligne, et il n'en repart vers la gare que sur Rail du chariot AV.
- Verrouillages propres : le chariot ne bouge pas si un train y roule, n'y est qu'en partie ou est en manœuvre ; il n'emporte qu'un train arrêté, vide, entièrement sur le rail du chariot ; il ne porte pas un train vers une voie occupée ; il ne remet un train sur le circuit (`G`) que si aucun train ne **roule** dans le dernier canton **en amont** du pont (train qui arriverait sur le rail) et que `maxRun` le permet ; un train **arrêté** sur le frein final ou avant le pont ne bloque pas (propriétaire, 2026-11-17, `anchorFree` dans `engine/sim.js` : seul `v ≥ 0,05 m/s` ou un train sur l'appareil bloque) : il est retenu par ses freins et le cantonnement tant que le rail du pont est occupé. **Le rail du chariot est aussi une zone d'attente temporaire** (propriétaire, 2026-11-17) : un train sur le frein avant gare ou en gare n'empêche pas le retour ; le train remis en ligne y reste freins serrés et n'avance que quand la section suivante est libre (cantonnement habituel). Vérifié par `tools/check.js` (`carHoldsAhead`).
- **Train porté et cantonnement** (propriétaire, 2026-11-17 : « la présence d'un train sur le chariot doit bloquer les sections précédentes uniquement si le chariot est sur le parcours ») : le train porté par le chariot (ou qui entre / sort d'une voie) ne compte dans le dernier canton que si le rail porteur est en ligne avec le circuit (`PC` : `G`, ou `P` pour un rail unique) ; chariot face à une voie ou en mouvement : il ne bloque pas. Un train du parcours franchit alors le dernier frein de bloc et est retenu au frein final avant le pont (aucun rail en ligne : `circIn`), jamais dans le vide ; avec un rail A escamotable sur le circuit, il roule sur le rail A comme d'habitude. Le retour du chariot en ligne avec un train est refusé tant qu'un train **roule** dans le dernier canton (« Dernier canton occupé ») ; une fois ce train arrêté au frein final, le retour est permis et il y reste retenu tant que le rail porteur est occupé. `engine/garage.js` `yardBlocks` ; `tools/check.js` ligne `carBlk:`.
- Chaque voie est un canton ; le rail du chariot en est un aussi.
- Dessin (issue #16) : les voies fixes sont dessinées jusqu'au bout du rail du chariot (jeu visuel 4 cm, le tablier passe dessous, comme pour le circuit) ; le jeu simulé `laneGap` ne change pas. Toutes les voies de garage (tous appareils) portent freins et pneus comme le circuit. Coaster inversé : le train garé ou porté est dessiné sous la poutre.
Au départ, tous les trains sauf le premier sont au garage (`SITE.trains[i].lane`, sinon première voie libre).

## Principe de commande (décision du propriétaire, 2026-11-14)

**Le joueur ne commande pas les trains, il commande les zones.** Chaque zone de voie a ses actionneurs ; les trains réagissent à ce qui se trouve sous eux.

| Zone | Actionneurs au pupitre |
|---|---|
| Gare | freins liés au départ (pas de bouton), moteurs (pneus) avancer / reculer |
| Lift | marche / arrêt |
| Zones de freinage (freins de bloc, frein final, rail du chariot) | freins serrés / relâchés ; moteurs avancer / reculer là où il y en a (freins de bloc : roues de propulsion en marche avant seule, avancer / arrêt) |
| Chariot / aiguillage | position (P ou voie k) |
| Voies de garage | bouton **Dispatch** (issue #11) : entrée ou sortie, sens choisi par le moteur ; freins automatiques, plus un bouton **F** de freins forcés (arrêt immédiat) |

Fait en T7 (ci-dessous). Les verrouillages restent valables.

**Complément du propriétaire** : les zones de freinage sont **automatiques** par défaut (cantonnement, anti-collision) ; chacune peut passer en manuel au pupitre, et revenir en auto.

## Commandes au pupitre par zones (T7, implémenté)

Le moteur découpe la voie en zones (`ZONES`, `tZone(t)` dans `engine/garage.js`) ; une commande agit sur le train qui se trouve dans la zone (`zoneCmd` dans `engine/sim.js`, `act('zone', '<zone>:<cmd>')`).

| Zone | Id | Commandes | Mode |
|---|---|---|---|
| Gare | `St` | **pas de bouton de frein** (freins serrés automatiquement tant qu'un train est à quai, relâchés par la seule séquence Départ), Avancer `f`, Reculer `b`, Arrêt `x` (déplacements à vide vers le garage) | manuel |
| Lift | `Lift` | Marche `on`, Arrêt `off` (chaîne stoppée : le train sur le lift y reste ; départs bloqués) | — |
| Freins de bloc | `B1…Bn` | freins `k`, roues de propulsion **marche avant seule** (`drive:'fwd'`, propriétaire 2026-11-17) : Avancer `f` (`#zB<k>_f`), Arrêt `x` — **pas de Reculer** | AUTO / MANU `m` |
| Frein final | `Fin` | freins `k`, `f`, `b`, `x` | AUTO / MANU `m` |
| Rail mobile du parcours du pont droit (rail A, plaque « Rail parcours ») | `RA` | freins `k`, `f`, `b`, `x` | AUTO / MANU `m` |
| Rail du chariot (rail B, chariot) | `RB` | freins `k`, `f` (rail en ligne : vers la gare ; face à une voie : refusé, Dispatch de la voie), `b` (refusé), `x` | manuel |
| Rail du pont (pont à rail unique, `single`) | `RB` | freins `k`, `f`, `x` (face à une voie : entrée au Dispatch de la voie) ; pas de `RA` | AUTO / MANU `m` |
| Frein avant gare (si `SITE.preBrake`) | `Pre` | freins `k`, `f` (vers la gare), `x` | AUTO / MANU `m` |
| Voies de garage | `L1…Ln` | **Dispatch** `d` (`#zL<k>_d`, propriétaire, issue #11) et freins forcés `k` (`#zL<k>_k`, Serrer / Relâcher) — pas d'Avancer, Reculer ni Arrêt | manuel |
| Appareil | — | positions `#yP`, `#y1…#yN`, `#yG` (deux rails), rail mobile du parcours `#yA0`/`#yA1` ; rail unique : `#yP`, `#y1…#yN` seulement | manuel |

- **Moteurs** : `SITE.zones = { <id ou groupe B / L> : {brake, drive} }`, `drive` = `true` (avancer / reculer / arrêt), `'fwd'` (avancer / arrêt, pas de bouton Reculer) ou `false`. Défaut : freins et moteurs partout ; freins de bloc en `'fwd'` (propriétaire, 2026-11-17 : « roues de propulsion sur les zones de break et boutons AV, les AR ne sont pas nécessaires » ; disposition des roues ESTIMÉE). Les AR des autres zones (gare, frein final, rails du pont) restent : ils servent aux manœuvres.
- **Frein de bloc à roues (MANU)** : un train arrêté au frein n'en repart pas au seul relâchement ; **Avancer** (`#zB<k>_f`) le pousse (jusqu'à sa vitesse d'entrée dans la zone, relance ci-dessous, au moins `VPROP` = `PH.vmin`, ESTIMÉ, puis gravité quand sa queue a passé le frein), freins relâchés requis, refusé au journal si le canton suivant est occupé ou l'appareil hors de P (règle de départ) ; Arrêt `x` l'arrête tant qu'il n'a pas passé le frein. Sans roues (`drive:false`), le relâchement suffit (ancien comportement). En AUTO : inchangé (cantonnement). `engine/garage.js` `BDRV`, `engine/sim.js` `t.bst` / `t.bgo`.
- **Relance à la vitesse d'entrée** (propriétaire, issue #33, 20/11 : « les waiting freinent aussi, ils font repartir le train à la même vitesse si arrêté » ; `waiting`, `brake_run` et `moving` sont toutes des zones d'attente qui freinent) : un train **arrêté** à un frein de bloc qui en repart (AUTO quand le canton se libère, MANU au bouton AV) est poussé par la zone jusqu'à la vitesse qu'il avait **en entrant** dans la zone (`t.bvin`, relevée au début de zone `BZ0`), ramenée à `trim.v` si la zone ralentit les trains, au moins `VPROP` ; accélération des roues v² / 2 `TLEN` entre 2 et 5 m/s² (ESTIMÉ), jusqu'à ce que la queue ait passé le point de frein, puis gravité (`blkRelaunch`, `engine/sim.js`). Un train qui passe sans s'arrêter n'est pas concerné. Frein final, rail du pont et frein avant gare : vitesse d'approche de la gare inchangée.
- **AUTO / MANU** (zones de freinage) : en AUTO (défaut) le cantonnement serre et relâche seul ; en MANU, `k` serre / relâche et les moteurs obéissent au pupitre. Passer en MANU serre les freins si un train y est arrêté. `#zAuto` remet toutes les zones en AUTO. En MANU, freins relâchés, le cantonnement reste actif (sécurité).
- **Anti-collision** : relâcher les freins d'une zone qui retient un train est refusé si la section suivante est occupée (canton suivant, chariot, gare).
- **Gare `f`** : le train **vide** quitte la gare (appareil hors de `P` : règle de départ ; le garage se commande au Dispatch de la voie) (départ à vide ; avec passagers, bouton Départ après les lapbars). Les freins de gare sont liés au départ : fermés tant qu'un train est à quai, ouverts uniquement par la séquence Départ (portillons fermés, lapbars validés).
- **Frein final `f`** : pont droit, rail du chariot en ligne : conduit le train **vide** arrêté avant le pont sur le rail du chariot (il s'y arrête) ; appareil sur une voie (raccordement au frein final) : refusé, l'entrée se commande au Dispatch de la voie ; sinon vers la gare. Frein final serré (MANU) : le train est retenu avant le pont (pont droit) ou au point d'arrêt (sinon). C'est ce qui remplace « Retenir pour le garage ».
- **Rail du chariot `f`** : rail du chariot en ligne : le train part vers la gare (jamais automatiquement) ; train porté face à une voie : refusé (Dispatch de la voie).
- **Dispatch des voies** (propriétaire, issue #11, remplace la poussée par la zone porteuse du 2026-11-15) : chaque voie `L<k>` n'a qu'un bouton, **Dispatch** (`#zL<k>_d`, `act('zone','L<k>:d')`, `laneDispatch` dans `engine/sim.js`). Le moteur décide :
  0. freins forcés de la voie serrés : refus (« … freins forcés serrés, relâchez-les ») ;
  1. appareil en mouvement ou pas en place sur la voie k : refus (« … n'est pas en place sur cette voie : positionnez-le d'abord sur k ») ; train de la voie déjà en mouvement : refus ;
  2. train de la voie arrêté pendant son entrée (arrêt d'urgence, Arrêt de la zone porteuse, freins forcés) : il reprend l'entrée ; arrêté pendant sa sortie (freins forcés) : il reprend la sortie ;
  3. train prêt sur la zone porteuse (`CARR` : `St` train vide à quai, portillons fermés, sécurités verrouillées ; `Fin` train arrêté sur le frein final ; `RB` train porté par le chariot) **et** place dans la voie (capacité ; pont droit : voie vide) : il **entre** (marche avant, ou arrière avec `rev` / `back`) ; freins de la zone porteuse serrés : refus ;
  4. **zone porteuse à un seul train** (propriétaire, issue #11 : « sur la voie chariot il n'y a la place que pour un train ») : si elle porte déjà un train (train prêt sans place dans la voie, ou, pont droit, tout train sur le chariot / rail du pont), le Dispatch ne fait **jamais** sortir le train garé : refus « … porte déjà un train (…), voie pleine … ». Le pont droit refuse déjà de porter un train face à une voie occupée (`yardPos` : « … ne peut pas y être porté ») ; cette garde couvre tout autre cas ;
  5. sinon, train dans la voie : le **train de tête** (le plus proche de l'appareil) **sort** vers l'appareil (rail du chariot / du pont, ou jusqu'en gare / sur le frein final ; arrière, ou avant avec `rev` / `back`), si la place d'arrivée est libre (`anchorFree`, rail du chariot libre, `maxRun`) ;
  6. sinon : refus (aucun train à faire entrer ni à sortir).
  Les refus de `yardFwd` / `yardBack` (passagers, portillons, sécurités, voie pleine, gare occupée…) sont repris tels quels au journal. Les freins des voies sont automatiques ; l'arrêt en fin de mouvement est automatique.
- **Freins forcés d'une voie** (propriétaire, issue #11 : « on peut forcer l'arrêt d'un brake manuellement ») : bouton **F** `#zL<k>_k` (`act('zone','L<k>:k')`, `G.zk.L<k>`, `zK`), bascule Serrer / Relâcher. Serrer arrête aussitôt le train qui entre dans la voie ou en sort (y compris la partie encore sur le chariot / la zone porteuse, `updateYard`) ; le Dispatch est refusé tant qu'ils sont serrés (raison au journal). Relâcher libère seulement : la reprise se fait au Dispatch. Bouton allumé = serrés ; voyant de voie orange si un train y est retenu, jamais vert. L'Arrêt `x` de la zone porteuse arrête encore le train qui entre. Avancer / Reculer de la zone porteuse ne poussent plus dans une voie (refus qui renvoie au Dispatch).
- **Marge au butoir** (propriétaire, issue #11) : un train qui entre s'arrête à `SITE.yard.buffer` m (défaut **2 m, ESTIMÉ**) du butoir, et à la même distance du train garé devant lui (`GSTEP` = un train + marge) ; point d'arrêt `LANES[k].stop`, capacité calculée avec lui. Voie trop courte : la marge se réduit à ce qui reste, l'arrière du train dégageant l'appareil d'au moins 0,2 m (OzIris, voies de 13,3 m relevées dans OSM : 0,7 m). Voies du pont droit sans `len` (Trace du Hourra, ESTIMÉ) : un train + marge + 0,2 m.
- **Positions lues dans OSM (2026-11-16)** : quand le circuit OSM porte ses zones (`roller_coaster:track=waiting|brake_run|…`, lues par `tools/make_site.py`), les repères `brk`/`fin` (frein final), `tr0`/`tr1` (rail de transfert d'un pont droit) et `pre0`/`pre1` (frein avant gare) fixent les positions sans réglage dans `SITE` : arrêt au frein final `S_HOLD` = `SITE.holdBack` s'il est donné, sinon fin du rail de transfert (pont droit), sinon fin du frein final OSM ; rail du pont de `tr0` à `tr1` si `yard.pre` n'est pas donné ; le train qui attend avant le pont s'arrête à la fin du frein final OSM (`fin`) ; `preBrake` sans `back`/`len` prend `pre0`/`pre1`. La commande reste par zones (Fin, RA/RB, Pre), rien ne change au pupitre.
- **Frein avant gare `Pre`** (`SITE.preBrake:{back, len, name}`, Trace du Hourra) : zone de freinage de stockage juste avant l'entrée en gare, un train de long (`len`, défaut un train + 0,5 m), point d'arrêt à `back` m (défaut 1) avant le début de la gare, pneus. En AUTO, le train qui quitte le frein final (ou le rail mobile du parcours) n'y va que si elle est libre, s'y arrête et attend que la gare soit libre ; en MANU, `k` serre / relâche (relâchement refusé gare occupée) et `f` envoie le train en gare. Le frein final et le rail mobile du parcours attendent donc « frein avant gare libre » au lieu de « gare libre ».
- Marche arrière refusée sur le circuit (gare, freins, rail mobile du parcours / rail du chariot).
- L'arrêt d'urgence arrête tous les moteurs et refuse toute commande de moteur.

Le joueur enchaîne lui-même ces commandes : rien n'est automatique entre deux étapes de manœuvre ; l'exploitation normale du circuit reste automatique (zones en AUTO).

### Portillons

Ils ne s'ouvrent et ne se ferment **qu'au bouton du pupitre** (`#bGate`), en auto comme en manuel. Un train prêt (départ décidé en auto) attend leur fermeture (indication au journal).

### Sécurités des passagers (lapbars, harnais)

Bouton **Sécurités** du pupitre (`#bRes`, `act('res')`, voyant `#lRes` : vert = verrouillées et fermées, ambre = ouvertes, clignotant = en mouvement), en auto comme en manuel ; type par attraction : `SITE.car.restraint` / `car.restraintPer` (`engine/core.js` `RES_KIND`, `RES_PER`, défauts par `kind`).
- À l'arrivée en gare, les sécurités restent **verrouillées** (rappel au journal) ; le débarquement ne commence qu'une fois ouvertes.
- **Ouvrir** : immédiat (`G.resOpen`), toutes les places s'ouvrent (~1,5 s). L'embarquement se fait sécurités ouvertes (un visiteur ne monte que si les sécurités de son wagon sont ouvertes).
- **Verrouiller** (portillons fermés, sinon refus au journal) : verrouille le système et **lance la vérification** (propriétaire : « le verrouillage des harnais lance la vérification des opérateurs, qui ferment les harnais ») : Op. 1 (avant) et Op. 2 (arrière) (postes d'attente et boutons de validation au bout de leur quai, toujours sur le quai : `opHome`, `opPost`, issue #23) passent wagon par wagon, ferment chaque harnais ou lapbar resté ouvert (`t.rcT`, `t.rc[k]` : animation de fermeture au passage) puis valident ; les deux validés → départ possible. By-pass : barres fermées sans contrôle.
- Portillons par rangée (`SITE.plat.gatesPer:'row'`, Goudurix, lot 6) : les opérateurs passent portillon par portillon (chaque rangée), ferment les sécurités du wagon au premier portillon et vérifient chaque rangée ; deux visiteurs par portillon. Bord de quai et portillons : `PEDGE`, `PGATE` (`engine/garage.js`) ; travées d'attente peu profondes : visiteurs collés à leur portillon, deux de front, rangs à 0,6 m (`SLOT0`, `SLOT_P`, `GDEPTH`, `BWALK`, ESTIMÉS, `SITE.plat.slot` pour forcer) ; une allée de file visible qui longe le quai d'embarquement reste hors de cette zone (`QGATE_CLR` = `GDEPTH` + 0,2 m, ESTIMÉ), sinon elle est dessinée plus étroite à cet endroit (0,6 m au plus étroit, `QGATE_WMIN`, ESTIMÉ ; `gateClear`, `engine/render.js`, issue #19). Bob : gouttière étroite (gabarit du wagon + `BOB_RIM`, ESTIMÉ) partout où la voie n'est pas inclinée — gare, lift, freins de bloc, frein final, frein avant gare, rail du pont, voies de garage — raccord en S sur 3 m (`TRF`, `engine/render.js`, issue #6) ; `PEDGE` suit ce gabarit. Garde-corps de la file sur le quai et dans les zones piétonnes (`engine/render.js` `buildRails`, issue #19) : jamais dans une travée d'attente, sur un palier, une fin d'escalier ou une autre allée ; jambes d'un lacet à moins de 1 m (ESTIMÉ) : un seul garde-corps partagé.
- Départ refusé tant que les sécurités sont ouvertes (journal, raison) ; manœuvre de garage depuis la gare (Dispatch) aussi. Ouvrir les portillons ou les sécurités pendant la vérification la reprend à zéro.
- Un train vide jamais déverrouillé (sorti du garage) part sans vérification. État sauvegardé (`engine/save.js`).

**Aiguillage rotatif** : dessiné seul (tronçon tournant, faces, supports), sans dalle au sol ; `yard.slab:true` pour en dessiner une (propriétaire, Goudurix : « pas de plateforme sous l'aiguillage »).

### Séquence type : rentrer un train au garage (raccordement en gare, Zeus)

1. Train vide à quai, portillons fermés ; aiguillage sur la voie `k` libre → attendre « en place ».
2. Dispatch de la voie (`#zL<k>_d`) : le train quitte la gare et roule jusqu'à 2 m du butoir. Aiguillage sur `P`.

### Séquence type : sortir un train (Zeus)

1. Gare libre (au besoin frein final en MANU et serré pour retenir l'autre train).
2. Aiguillage sur la voie, Dispatch de la voie : le train recule jusqu'en gare. Aiguillage sur `P`.

### Pont droit à rail mobile du parcours escamotable (Trace du Hourra)

**Stockage (propriétaire, 2026-11-15).** Le rail mobile du parcours est une **zone de freinage de stockage** : en AUTO, un train arrive au frein final, avance sur le rail mobile s'il est sur le circuit et libre, s'y arrête entièrement et y est retenu jusqu'à ce que la gare soit libre ; le train suivant est retenu au frein final derrière lui (le frein final et le rail mobile stockent un train chacun, le canton B3 retient le suivant). Le synoptique colore les deux zones (vert libre, ambre train retenu, rouge freins serrés). Avec le frein avant gare (propriétaire, 2026-11-15) : trois positions de stockage quand la gare est occupée — frein avant gare, rail mobile du parcours, frein final — puis chaque train entre en gare à son tour (Pre → gare, RA → Pre → gare, Fin → RA → Pre → gare). Vérifié par `tools/check.js hourra` (storePre, storeRA, storeFin, refusePre, enterA, enterB, enterC).

- Garer : train vide (Gare AV), frein final MANU serré (arrêt avant le pont), rail mobile du parcours retiré, chariot sur G, relâcher, Frein final AV (sur le rail du chariot), chariot sur une voie libre (il l'emporte), Dispatch de cette voie (il y entre), chariot au repos, rail mobile du parcours sur le circuit, TOUT AUTO.
- Sortir : chariot face à la voie, Dispatch de la voie (il recule sur le rail du chariot), rail mobile du parcours retiré, chariot sur G (dernier canton libre), Rail du chariot AV (vers le frein avant gare, puis la gare), chariot sur une voie, rail mobile du parcours sur le circuit.

## Verrouillages (sécurité, toujours actifs)

- L'appareil ne bouge pas si un train est dessus ou à moins d'une longueur de train de lui (train du garage sur le circuit, la liaison ou l'appareil ; train du circuit qui le franchit). Pas de nouvelle commande pendant qu'il bouge.
- Un train ne franchit l'appareil que si celui-ci est en place sur la voie qu'il vise.
- Un train n'entre pas sur une voie déjà occupée au-delà de sa capacité (`cap`).
- Appareil hors de `P` : l'entrée en gare (raccordement au frein final) est bloquée ; les départs (raccordement en gare) suivent la **règle de départ** ci-dessous.
- Un train avec passagers ne quitte jamais le circuit.
- Au plus `SITE.maxRun` trains sur le circuit : au-delà, la sortie du garage est refusée (Trace du Hourra : 5 sur 6).
- Raccordement au frein final : le train qui sort du garage occupe le dernier canton ; les trains du parcours sont retenus au dernier frein de bloc. Serrer un frein de bloc au pupitre (zone `B<n>` en MANU, `#zB<n>_k`) aide à libérer le dernier canton avant une sortie.
- L'arrêt d'urgence immobilise aussi les manœuvres (moteurs de zone arrêtés, il faut redonner l'ordre) et fige l'appareil.

Chaque refus s'affiche dans le journal avec la raison (« Voie 3 occupée », « Pont en mouvement »…).

## Règle de départ (propriétaire, 2026-11-15)

« Le train peut partir de la gare si l'aiguillage est activé, tant qu'une zone de frein peut le mettre en attente avant. »

- Appareil hors de `P` (ou manœuvre de garage en cours), raccordement en gare : le départ est **autorisé** si au moins une zone de freinage se trouve sur le trajet entre la gare et l'appareil ; le train y est alors **retenu automatiquement** (zone en AUTO ou MANU) tant que l'appareil n'est pas revenu sur `P` (journal : « Départ avec l'aiguillage hors de P : … sera retenu au frein de bloc n », puis « … retenu au frein de bloc n »). Relâcher cette zone au pupitre est refusé avec la même raison.
- Sinon (aucune zone de freinage avant l'appareil : aiguillage juste après le quai, Tonnerre 2 Zeus) : départ refusé, raison au journal (« … aiguillage hors de P, aucune zone de freinage entre la gare et l'aiguillage pour retenir le train »), au bouton Départ comme à Gare AV (le garage se commande au Dispatch de la voie).
- Moteur : `DEV_HOLD` (`engine/garage.js`) = dernier frein de bloc entre la gare et l'appareil (`yard.back`, aiguillage en amont : Goudurix, B1), `-1` sinon ; `devHoldAt(i)` retient le train dans `updateRun` ; `blockReason` ne refuse plus que si `DEV_HOLD<0`. L'appareil est verrouillé dès qu'un train a passé ce frein et roule vers lui. Avec l'aiguillage en amont (`yard.back`) et un frein de retenue, Gare AV fait partir le train à vide au lieu d'être refusé.
- Raccordement au frein final (Trace du Hourra, OzIris) : déjà le cas — le frein final / le rail du circuit retiennent le train avant le pont ; départ toujours autorisé.
- Vérifié par `tools/check.js <site>`, ligne `dep:` (`refuseNoBrake` pour Zeus ; `departOk heldBefore stillHeld released` pour les trois autres).

## Hypothèses à signaler

La position de l'appareil, l'orientation des voies, la longueur des wagons et les vitesses de manœuvre ne figurent pas dans OpenStreetMap.
Elles sont estimées ; le dire en commentaire dans `sites/<site>.js` et au propriétaire.


**Règle du lift (propriétaire, 2026-11-15)** : un seul train sur le lift ; en haut, le train attend tant que la zone de freinage suivante est occupée. Zone suivante = premier frein de bloc s'il y en a ; un train arrêté sur le frein final ne retient donc le lift que s'il n'existe aucun frein avant le frein final (ex. Zeus).


## Aiguillage rotatif en S, garage en amont (Goudurix) et frein de ralentissement

- `yard.back:true` (aiguillage en amont de la gare) : le train entre au garage en marche arrière depuis la gare (Dispatch de la voie, aiguillage sur la voie), en sort en marche avant (Dispatch). `a` / `b` : distances en remontant le circuit depuis l'arrêt de la tête du train.
- `yard.rotary:true` : l'aiguillage est un tronçon qui tourne autour de l'axe du tube (vu du dessus : largeur ∝ cos θ). `yard.s:true` : face droite = circuit, face en S (courbe de Bézier) = voie de garage ; `lanes[0].pts[0]` est le bout du S, `b − a` doit égaler sa longueur (avertissement console sinon).
- Frein de ralentissement : `SITE.zones.B<n>.trim:{v}` (m/s) : un frein de bloc en AUTO ramène le train à `v` puis le laisse continuer ; arrêt seulement si le canton suivant est occupé ou freins serrés (MANU).

## Frein de bloc en haut du lift (Trace du Hourra, propriétaire 2026-11-16)

Une zone de freinage qui suit immédiatement le lift (OSM `roller_coaster:track=waiting` au sommet) est un **frein de bloc** comme les autres (`B1`, AUTO/MANU au pupitre, `osm_brakes` de la spec : `blk1`). Cantonnement : `LIFT_NEXT` = ce frein ; la chaîne retient le train en haut tant que B1 est occupé, et B1 ne libère son train que si le canton suivant (jusqu'à B2) est libre. Rien de propre à l'attraction dans le moteur.

## Passerelles de service et évacuation (issue #7, 2026-11-16)

Lift et zones de freinage surélevées ont une passerelle de service (coaster inversé : plancher pleine largeur sous la voie, issue #20) et un escalier jusqu'au sol (`SITE.catwalks`, voir `docs/NOUVELLE-ATTRACTION.md` §3). Appareil de voie : ni passerelle ni poteau de voie sur le tronçon qu'il porte ni dans l'espace qu'il balaie (`inSweep`, `engine/render.js`) ; ailleurs, toute voie surélevée a ses poteaux. Pour l'instant **décor seulement** : l'équipe technique reste dessinée à `SITE.jobsites` et il n'existe pas d'évacuation d'un train arrêté en parcours. Suite possible : faire marcher les techniciens et les passagers évacués par ces passerelles (itinéraire déjà calculé : `CATW.walks[].segs`, `CATW.towers`).

## Évacuation de la file (issue #21, 2026-11-19)

« Évacuer la file » (`act('evac')`) fait ressortir tous les visiteurs de la file par l'entrée, au plus court, barrières franchies, **et** ceux qui attendent derrière les portillons : à leur place dans la travée (`G.plat`) ou en chemin vers elle (marcheurs `wait`, couloir d'attente `SITE.board.walk`). Trajet (`engine/queue.js` `platEvac`) : travée → couloir d'attente → `SITE.board.via` à rebours → toute la file à rebours → entrée ; le quai de débarquement, de l'autre côté de la voie, n'est jamais traversé. Les visiteurs assis ou qui franchissent le portillon pour embarquer restent. Commun à toutes les attractions, rien à écrire par site.

Zone d'attente éditée (issue #22, `GAME.boardAreas`) : les visiteurs qui attendent dans le polygone en ressortent par le même chemin intérieur, puis `board.via` à rebours et la file (`boardOut`). La zone se remplit (issue #24) : places des portillons d'abord, puis **réserve** `BRES` (rangs successifs au pas `RES_P` = 2,4 m ESTIMÉ, 4 × le pas des travées à la demande du propriétaire, `SITE.plat.slot.res`, dans tout le polygone derrière les places des portillons, 400 au plus) ; un visiteur de la réserve avance à une place de portillon libérée (`G.platR`, `resTo`) ; l'évacuation vide aussi la réserve. Profondeur des travées réglée (issue #27, `GAME.board.depth`, éditeur ; repli `SITE.plat.depth`) : nombre de rangs des travées, séparateurs, couloir d'attente `BWALK` juste derrière ; les rangs au-delà des places des portillons sont des places de réserve de leur portillon (avec ou sans zone éditée ; sans zone, on n'avance que dans sa travée, entrée et évacuation par le couloir d'attente) ; la réserve espacée de la zone éditée commence derrière le dernier rang. Sans valeur, rien ne change.

Train à quai (issue #26) : si les sécurités sont **ouvertes** (`G.resOpen`, train en phase `board`), l'évacuation fait aussi descendre ses passagers assis, un par un comme au débarquement (siège → quai de débarquement → `SITE.exit.door` → `SITE.exit.path`, `alightWalk`, `exitPath`), sans recette ni passager compté ; un visiteur encore en train de monter descend dès qu'il est assis ; pas d'embarquement pendant ce temps (`t.evq`). Le train reste en gare, vide. Sécurités **verrouillées** : rien ne change, les passagers restent assis ; un verrouillage pendant la descente l'arrête. Bouton « Évacuer la file » actif dès qu'il y a quelque chose à évacuer (`evacCan`, `engine/sim.js`). Contrôle : `tools/check.js` ligne `trainEvac`.

## Exploitation continue (propriétaire, 2026-11-17)

Pas de journée ni de remise à zéro : l'horloge boucle sur la plage d'ouverture (10:00–19:00, puis 10:00), les trains, la file, le quai, les zones et la météo gardent leur état. L'entrée de la file ne ferme qu'au bouton `#bOpen` du joueur (aucune fermeture à 18:00). Salaires prélevés en continu ; bilan cumulé au bouton `#bBil` ; budget sous −2 000 € en carrière : fin de partie (Recommencer).

## Hors périmètre

Barrières de la file (commande à la carte, barrière d'entrée et de sortie liées sur chaque chemin fermable ; barrière de fourche par défaut (issue #17) : une barrière par pointe, pivot sur la bordure à la pointe de l'angle intérieur, en travers du raccourci (A) ou de la boucle (B), les deux pointes d'une boucle liées ; raccourci court : chaque pivot à au plus L/4 de sa pointe, deux barrières distinctes ; éditeur : ajout `add:<tronçon>:<n>` et suppression `{off:true}`, `GAME.barriers`), file à la width OSM, escaliers (largeur du chemin, sortie 2 m, en applique, palier rectangulaire, raccord régulier), quais en béton clair et personnes du quai dessinées au-dessus de la voie et des portillons, passerelles et rochers (tunnel prolongé jusqu'aux bords) : `docs/NOUVELLE-ATTRACTION.md` §2–§3 ; ce ne sont pas des manœuvres de train et aucune commande par train ne s'y ajoute : une barrière se commande à la carte, par fourche (zone de la file), jamais par train.
