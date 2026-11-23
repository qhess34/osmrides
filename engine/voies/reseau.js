'use strict';
/* ══════════ RÉSEAU : ce que le type déclare à la couche « voies » (docs/ARCHITECTURE.md D14) ══════════
   Étape « modele » : le type (montagnes-russes, plus tard tram, métro…) range ses véhicules dans VEHICULES et remplit VOIES :
   - long : longueur d'un véhicule (m) ; hauteur : hauteur des voies de garage (m) ;
   - attentes : zones d'attente du circuit, DANS L'ORDRE DE MARCHE, [{id, s (point d'arrêt de l'avant du véhicule), bloc (la zone ferme un canton),
     dit (nom dans une phrase : « la gare »), horsP (fin du message quand l'appareil quitte P et que la zone est celle du raccordement), conseil}] ;
     l'arrêt (une gare = un arrêt) a l'id 'St' ;
   - raccord : id de la zone d'attente où le garage est branché (SITE.yard.at, alias résolus par le type).
   Étape « reseau » : engine/voies/ construit arrêts, garage, appareil de voie et commande par zones ; puis le type déclare ses zones (ZONES) et son exploitation.
   Règles propres au type, demandées par voies/ au moment voulu (extension({…}), engine/noyau/base.js : fournit / appel) :
   zoneDe(t) (zone où est le véhicule), aQuai(t) (véhicule vide prêt à manœuvrer à l'arrêt), raccordLibre(t) (le raccordement peut recevoir t qui sort du garage),
   refusQuitter(t) (motif propre au type de garder t sur le circuit, '' sinon), quitteCircuit(t, chariot) (remise à zéro de l'état du type), retourRaccord(t)
   (t revenu du garage au raccordement), quitteAttente(o) (o quitte une zone d'attente de fin de circuit vers l'arrêt), sectionOccupee(z, t) (refus du
   relâchement des freins), commandeZone(Z, c) (zone propre au type : réponse, ou undefined), moteursZone(Z, c) (Avancer / Reculer / Arrêt). */
const VEHICULES=[]; // véhicules du réseau (trains des montagnes russes) : st 'run' (sur le circuit), 'station' (à l'arrêt), 'garage' (hors circuit)
Object.assign(VOIES,{long:0,hauteur:0,attentes:[],raccord:'St'});
const count=t=>t.seats.reduce((n,s)=>n+(s?1:0),0); // voyageurs à bord (places prises)
