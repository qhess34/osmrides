'use strict';
/* Goudurix — configuration de l'attraction pour le moteur (engine/*.js).
   Montagnes russes en acier Vekoma MK-1200 à rails tubulaires, Parc Astérix (1989), sept inversions annoncées. Tracé, gare, chemins, voie de maintenance :
   sites/goudurix.data.js (OpenStreetMap). Ce qui est estimé est signalé « ESTIMÉ » ; caractéristiques et sources : docs/goudurix-notes.md. */
const SITE=(()=>{
  const PROM=OSM.paths.prom,PROM2=OSM.paths.prom2,QL=OSM.paths.qlink;
  // File (ESTIMÉE) : le chemin OSM 1102233771 (« Gouduriiiix Promenade », nord-sud) relie la promenade au côté est de la gare ; OSM ne cartographie pas la file.
  // Il est dans le sens gare → promenade : on le prend à l'envers, de l'entrée (sud, 23,8 ; 87,7) vers la gare (16,5 ; 11,6).
  const Q=OSM.paths.queue.slice().reverse(),ENTRY0=[Q[0][0]-.7,Q[0][1]+.9];
  // Garage (OSM) : voie de maintenance 1221386549 (45 m, butoir au sud) qui se détache du circuit au pied du lift (nœud railway=switch, -15,2 ; -4,5),
  // dans le prolongement de la sortie de gare. Le moteur ne sait brancher un aiguillage que juste après la gare (yard.at:'station') : la voie de garage commence donc
  // en gare et RECOPIE la courbe de sortie du circuit (points de contrôle de la voie, de la gare au pied du lift), puis suit la voie de maintenance OSM.
  const lanePts=OSM.cps.slice(7,15).map(r=>[r[0],r[2]]).concat(OSM.others[0].slice().reverse());
  return {
    id:'goudurix',title:'Goudurix',kind:'steel',trackName:'Voie tubulaire',goal:500,lap:120,
    // 2 trains de 7 wagons, 28 places = 4 par wagon en 2 rangées de 2 (RCDB, Wikipédia). Longueur (2,55 m) et largeur (1,5 m) d'un wagon ESTIMÉES.
    car:{len:2.55,n:7,seats:4,abreast:2,w:1.5},
    // Couleurs des trains SUPPOSÉES (non visibles sur la photo aérienne) ; voie tubulaire jaune et supports rouges d'après la photo du propriétaire (teintes assourdies).
    trains:[{name:'Train 1',col:'#7e2f2a',col2:'#c9a83c',wear:30},{name:'Train 2',col:'#7e2f2a',col2:'#c9a83c',wear:44}],
    track:{spine:'#a88a2e',rail:'#cdaa38',support:'#8e3b2c'},
    stopBack:.5,holdBack:5,dropAfter:16,loadSide:1,   // arrêt au frein final : tête du train 5 m avant la gare (ESTIMÉ) ; embarquement côté est, côté de la file
    phys:{roll:.06,drag:.0009,vmin:3},
    // Garage : aiguillage coulissant juste après la gare ; une seule voie (la voie de maintenance), 2 trains au plus. Course du chariot (slide) et vitesses ESTIMÉES.
    yard:{at:'station',device:'switch',a:.8,b:6.4,slide:1.2,side:-1,len:8.6,k:.6,lanes:[{name:'Garage',pts:lanePts,cap:2}],move:{v:2.4,t:3}},
    stationPoly:OSM.polys.station,stationAt:[.4,0,12],stationRoofCol:'#9b8f7d',
    fade:[[.4,0,12],[-16,-8,6]],   // toits qui s'effacent : gare, pied du lift
    // Quais ESTIMÉS (le bâtiment OSM, 6,8 m de large, ne couvre que la voie et ses abords) : embarquement à l'est, débarquement à l'ouest.
    plat:{load:7.0,exit:3.5,back:.6,front:1.6},
    booth:[6.4,-11.8,0],boothLabel:[9.5,-14.5],beacon:[5.6,-10.6],
    queue:{entry0:ENTRY0,link:[],gate:{h:[Q[0][0]+1.7,Q[0][1]+.6],a:[Q[0][0]-1.7,Q[0][1]+.6],b:[Q[0][0]+1.9,Q[0][1]-2]},
      parts:[{pts:[ENTRY0].concat(Q)}]},
    // Arrivée : promenade OSM depuis la plaine de jeux au nord-ouest (132709988) puis 132709980 jusqu'à l'entrée de la file.
    approach:[{w:1,pts:PROM2.slice().reverse().concat(PROM.slice().reverse().slice(1))}],
    paths:[PROM,PROM2,QL],
    // Couloir d'attente à 6,4 m de la voie, entrée par le sud-est de la gare
    board:{via:[[15.6,11.6],[11.4,11.4],[8.2,10.4],[6.4,9.2]],walk:6.4},
    // Sortie (ESTIMÉE) : porte dans le mur ouest de la gare, passage sous le pied du lift, rejoint la promenade OSM (-28 ; -2) vers le nord-ouest.
    exit:{door:[-4.4,-.6],path:[[-4.4,-.6],[-10,.8],[-20.5,1.6],[-28,-2]],
      tails:[[[-28,-2],[-43.6,-14.5],[-38.3,-19],[-35.3,-25.5],[-34.2,-27],[-24.1,-39.9],[-13.2,-44.7]]]},
    jobsites:{liftFix:[-6,36],chainRev:[-6,36],trackRev:[42,60],brakeFix:[8,32],brakeRev:[8,32],trainRev:[-10,12],rearm:[5,-3]},
    view:{x:25,z:52,w:200,h:190,bounds:[-90,120,-60,170]},
    cams:{gare:{label:'Gare',x:3,z:0,s:17},file:{label:'File',x:22,z:50,s:7},lift:{label:'Lift',x:-8,z:35,s:7},
      figures:{label:'Figures',x:48,z:50,s:5},frein:{label:'Frein final',x:3,z:32,s:10},garage:{label:'Garage',x:-12,z:14,s:11}},
    labels:()=>[['Gare',6,-4],['Lift — 36 m',-34,40],['Frein final',10,34],['Garage',-33,8],['Entrée',32,88],["File d'attente",34,45],['Sortie',-24,5]],
    strike:{area:[-60,100,-40,150]},
    text:{storm:'Orage sur Goudurix : aucun train ne doit partir.',great:'Excellente journée sur Goudurix !'},
    helpGarage:'<b>Garage</b> : une voie de maintenance au pied du lift, dans le prolongement de la sortie de gare. Pour garer un train : train vide à quai, portillons fermés, '
      +'aiguillage sur 1 (attendre qu\'il soit en place), puis Gare AV : les moteurs de gare poussent le train vers le fond de la voie. Remettez l\'aiguillage sur P. '
      +'Pour le sortir : gare libre (au besoin, frein final en MANU et serré pour retenir l\'autre train), aiguillage sur 1, puis Garage AR : il recule jusqu\'en gare ; aiguillage sur P. '
      +'L\'aiguillage ne bouge pas si un train est dessus ou tout près, et un train avec passagers ne quitte jamais le circuit.',
    draw:{}
  };
})();
