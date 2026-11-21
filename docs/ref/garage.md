# Zones, cantonnement, garage

Quand la lire : zones de freinage, cantonnement, règle de retenue, garage. Les manœuvres détaillées sont dans `docs/manoeuvres.md` (non recopié ; lire la section utile par grep).

Fiche de référence (extraite d'`AGENTS.md`, 21/11). Une règle n'est écrite qu'ici ; ailleurs on renvoie.

## Commande

**Commande par zones, jamais par train** : gare, lift, zones de freinage (AUTO par défaut, MANU au choix), appareil, voies de garage

- portillons ouverts et fermés seulement au bouton (en auto aussi), sécurités (lapbars, harnais) ouvertes et verrouillées au bouton, le verrouillage lançant la fermeture et la vérification par les deux opérateurs (`docs/manoeuvres.md`)
- les barrières de la file se cliquent sur la carte.

## Zones et cantonnement

Zones : gare, avant-lift, lift, parcours, frein final. Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre

- pont droit : un train porté par le chariot ne compte dans le dernier canton que chariot en ligne avec le circuit (`yardBlocks`)
- retour du chariot en ligne refusé seulement si un train ROULE dans le dernier canton ou est sur l'appareil, un train arrêté au frein final y reste retenu (`anchorFree`, `docs/manoeuvres.md`).

Zones toutes équivalentes (issue #36, `docs/manoeuvres.md` « Modèle ») : la gare est une zone d'attente comme les autres (`St`, `B1…Bn`, `Fin`, `Pre`, point d'arrêt `zStop`), un canton ordinaire entre deux zones consécutives, « Frein final » n'est qu'un nom affiché (ids `Fin`, `#zFin_…` inchangés)

- garage branché sur une zone quelconque (`SITE.yard.at` = `'St'|'B<k>'|'Fin'|'Pre'`, alias `'station'`, `'brake'` ; `YZ`, `ANCH`, `CARR`, `yardBlocks(self,b)`, `anchorFree`, `placeAt` ; pont droit : frein final seulement ; aiguillage en amont `back` : gare ou zone à marche arrière, issue #38 ; essai `node tools/yard-zone.js <site> <zone> [back]`).

Règle de retenue : appareil hors de P (ou manœuvre de garage), la dernière zone d'attente avant l'appareil (`HOLD_Z`, `engine/garage.js`) retient le train

- si c'est la gare, départ refusé avec la raison (`docs/manoeuvres.md`).
