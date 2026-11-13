# T2Z — simulateur d'exploitation de Tonnerre 2 Zeus

Jeu de gestion en 2D vue du dessus : vous êtes chef d'attraction des montagnes russes en bois
Tonnerre 2 Zeus (Parc Astérix). Jeu de fan non officiel, sans lien avec le Parc Astérix.

## Jouer

Ouvrir `index.html` dans un navigateur (aucune installation, aucune dépendance).

- Ouvrir ou fermer l'attraction, départs en mode auto ou manuel, arrêt d'urgence.
- Portillons de quai à ouvrir pour faire embarquer (28 passagers, 14 wagons de 2 places).
- Deux accès amovibles pour raccourcir ou allonger la file d'attente.
- Deux trains ; un tronçon en S coulissant envoie un train au garage ou l'en fait sortir.
- Maintenance : usure des trains, de la chaîne du lift, de la voie et des freins, pannes.
- Météo : pluie et orages (aucun départ sous l'orage).

## Fichiers

- `index.html` : page et interface.
- `game.js` : simulation, rendu et son.
- `data.js` : tracé au sol de l'attraction et alentours.

## Données et limites

Le tracé au sol, la gare, la voie de garage, la file d'attente et les alentours proviennent
d'OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL).

Les hauteurs ne figurent pas dans OpenStreetMap : le profil (lift de 30 m, bosses, descente dans
le tunnel) est estimé. La position du pont transbordeur est déduite de la carte.
