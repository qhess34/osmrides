# Zones, cantonnement, garage

Quand la lire : zones de freinage, cantonnement, règle de retenue, garage. Les manœuvres détaillées sont dans `docs/manoeuvres.md` (non recopié ; lire la section utile par grep).

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Commande

**Commande par zones, jamais par train** : gare, lift, zones de freinage (AUTO par défaut, MANU au choix), appareil, voies de garage

- portillons ouverts et fermés seulement au bouton (en auto aussi), sécurités (lapbars, harnais) ouvertes et verrouillées au bouton, le verrouillage lançant la fermeture et la vérification par les deux opérateurs (`docs/manoeuvres.md`)
- les barrières de la file se cliquent sur la carte.

## Zones et cantonnement

Zones : gare, avant-lift, lift, parcours, zones de freinage. Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre

- pont droit : un train porté par le chariot ne compte dans le dernier canton que chariot en ligne avec le circuit (`yardBlocks`)
- retour du chariot en ligne refusé seulement si un train ROULE dans le dernier canton ou est sur l'appareil, un train arrêté à la dernière zone de freinage (`ZF`) y reste retenu (`anchorFree`, `docs/manoeuvres.md`).

Zones toutes équivalentes (issue #36, `docs/manoeuvres.md` « Modèle ») : la gare est une zone d'attente comme les autres (`St`, `B1…Bm`, point d'arrêt `zStop`), un canton ordinaire entre deux zones consécutives ; zones de freinage toutes ordinaires « Frein 1…m » (#57 point 4 : ids `Fin` / `Pre` devenus `B<n+1>` / `B<n+2>`, boutons `#zB<k>_…`)

- garage branché sur une zone quelconque (`SITE.yard.at` = `'St'|'B<k>'`, alias `'station'`, `'brake'`, `'Fin'`, `'Pre'` ; `YZ`, `ANCH`, `CARR`, `yardBlocks(self,b)`, `anchorFree`, `placeAt` ; pont droit : `ZF` seulement ; aiguillage en amont `back` : gare ou zone à marche arrière, issue #38 ; essai `node tools/yard-zone.js <site> <zone> [back]`).

Règle de retenue : appareil hors de P (ou manœuvre de garage), la dernière zone d'attente avant l'appareil (`HOLD_Z`, `engine/voies/garage.js`) retient le train

- si c'est la gare, départ vers le circuit refusé avec la raison (`docs/manoeuvres.md`) ; gare de raccordement à aiguillage en aval : Départ envoie le train vide au garage (`versGarage`, `departGarage`, `engine/montagnes-russes/exploitation.js`, issue #62).
