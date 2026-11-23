'use strict';
/* Couche « voies » (docs/ARCHITECTURE.md D14) : mécanique partagée des véhicules guidés (montagnes russes ; plus tard tram, métro, bus), sans aucun dessin :
   tracé et abscisse s (trace.js), cantonnement facultatif (cantons.js), ce que le type déclare (reseau.js), arrêt et zones d'attente (arrets.js), garage ou dépôt
   (garage.js), aiguillage et pont transbordeur (appareil.js), commande par zones (zones.js). Manifeste lu par engine/moteur.js : étape « reseau » après « modele »,
   où le type a déclaré ses véhicules et ses zones d'attente. */
extension({nom:'voies',fichiers:{modele:['trace','cantons','reseau'],reseau:['arrets','garage','appareil','zones']}});
