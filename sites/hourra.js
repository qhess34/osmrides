'use strict';
/* La Trace du Hourra — configuration de l'attraction pour le moteur (engine/*.js).
   Tracé, gare, file, sortie et bâtiment du garage : sites/hourra.data.js (OpenStreetMap). Ce qui est estimé est signalé « estimé ». */
const SITE=(()=>{
  const Q=OSM.paths.queue,LOOP=OSM.paths.queueLoop,PROM=OSM.paths.prom,ENTRY0=[59.2,16.15];
  const F=Q.length-2; // (11.5,-9) : fourche de la file avant l'entrée principale de la gare
  // Garage : 6 voies parallèles au frein final dans le bâtiment OSM 148160581 (à l'ouest du frein final).
  // Orientation et écartement des voies (3 m), position du pont transbordeur : estimés (non relevés).
  const lane=(n,x0,z0,x1,z1)=>({name:'Voie '+n,pts:[[x0,z0],[x1,z1]],cap:1});
  return {
    id:'hourra',title:'La Trace du Hourra',kind:'bob',trackName:'Gouttière',goal:900,lap:110,
    car:{len:1.55,n:7,seats:2,inline:true,w:.95},   // 7 bobs de 2 places l'une derrière l'autre (propriétaire) ; longueur et largeur d'un bob estimées
    // 6 trains (propriétaire), 5 au plus sur le parcours : les 5 autres démarrent chacun sur sa voie de garage. Teintes sourdes supposées (couleurs réelles non vérifiées).
    trains:[{name:'Train 1',col:'#8a3b33',col2:'#d9d4c8',wear:28},{name:'Train 2',col:'#3e5a74',col2:'#d9d4c8',wear:44,lane:1},
      {name:'Train 3',col:'#5b6b3e',col2:'#d9d4c8',wear:36,lane:2},{name:'Train 4',col:'#8c6d36',col2:'#d9d4c8',wear:52,lane:3},
      {name:'Train 5',col:'#5d4a63',col2:'#d9d4c8',wear:20,lane:4},{name:'Train 6',col:'#3f5f5a',col2:'#d9d4c8',wear:60,lane:5}],
    maxRun:5,   // au plus 5 trains sur le parcours (propriétaire) : la sortie d'un 6e est refusée
    stopBack:.5,holdBack:35,dropAfter:12,loadSide:-1,   // arrêt au frein final au début de la ligne droite, avant le pont (estimé)
    phys:{roll:.13,drag:.0016,vmin:3},
    // Garage sur le frein final, pont transbordeur à 7 positions (P, voies 1…6), un train par voie (propriétaire).
    // Emplacement du chariot (juste après le point d'arrêt), course (2 m par voie), longueur, vitesses : estimés.
    yard:{at:'brake',device:'table',a:1,b:9.6,slide:2,side:1,len:9.4,k:5.5,move:{v:1.8,t:7},
      lanes:[lane(1,-28.54,-17.68,-24.79,-5.76),lane(2,-31.4,-16.78,-27.65,-4.86),lane(3,-34.26,-15.88,-30.51,-3.96),
        lane(4,-37.12,-14.98,-33.37,-3.06),lane(5,-39.99,-14.08,-36.24,-2.16),lane(6,-42.85,-13.18,-39.1,-1.26)]},
    stationPoly:OSM.polys.station,stationAt:[1.5,1,9],
    fade:[[1.5,1,9],[-34,-7,12]],   // toits qui s'effacent : gare, garage
    plat:{load:5.9,exit:2.3,back:.6,front:1.2},
    booth:[8.3,4.1,.715],boothLabel:[11.5,7.5],beacon:[9.6,2.4],   // poste de conduite : emplacement estimé
    queue:{entry0:ENTRY0,link:[[61.1,16.8]],gate:{h:[58.35,14.71],a:[57.65,16.79],b:[56.27,14.0]},
      parts:[
        {pts:[ENTRY0].concat(Q.slice(0,F+1))},
        // fourche : raccourci direct vers l'entrée principale, ou boucle par les chemins voisins (OSM 1032685208, 1032685209) jusqu'à la seconde entrée
        {name:'boucle nord',short:[Q[F],Q[F+1]],
          loop:[Q[F],[5.6,-9.4],[3.3,-11.3]].concat(LOOP.slice().reverse().slice(1),[[0.4,-10.8],[0.2,-10.3],[0.9,-8.1],[0.7,-7.6],[1.6,-6.4],[2.6,-4.9],[2.9,-3.3],Q[F+1]]),
          gate:{h:[9.6,-10.1],a:[8.6,-7.9],b:[7.4,-10.0]}},
        {pts:[Q[F+1],[4.2,-1.1]]}]},
    approach:[{w:.5,pts:PROM.slice(0,4)},{w:.5,pts:PROM.slice(3).reverse()}],
    paths:[PROM,OSM.paths.exit],
    board:{via:[[3.6,-.6]],walk:5.2},
    exit:{path:[[-.3,5.3],[-.6,7]].concat(OSM.paths.exit.slice(1)),
      tails:[[[27.7,38.1],[42.8,43.4],[50.5,45.3],[52.9,52.8]],[[13.8,40],[2.2,44.3],[-1.4,49.1]]]},
    jobsites:{liftFix:[24,-6],chainRev:[24,-6],trackRev:[40,22],brakeFix:[-31,-38],brakeRev:[-31,-38],trainRev:[-30,-9],rearm:[1.5,-1.5]},
    view:{x:40,z:-28,w:190,h:150,bounds:[-130,200,-150,110]},
    cams:{gare:{label:'Gare',x:1.5,z:1,s:19},file:{label:'File',x:38,z:14,s:8},lift:{label:'Lift',x:38,z:-40,s:7},
      frein:{label:'Frein final',x:-26,z:-30,s:12},garage:{label:'Garage',x:-31,z:-18,s:11}},
    labels:()=>[['Gare',-6,-8],['Lift — 31 m',44,-50],['Frein final',-36,-42],['Garage',-40,-19],['Pont transbordeur',-12,-36],["File d'attente",40,8],['Entrée',67,23]],
    text:{storm:'Orage sur l\'attraction : aucun train ne doit partir.',great:'Excellente journée sur la Trace du Hourra !'},
    helpGarage:'<b>Garage</b> : six voies, un train par voie, desservies par un pont transbordeur branché sur le frein final ; manœuvre manuelle au pupitre. '
      +'Pour garer un train : bouton G du train (il part à vide et reste retenu sur le frein final), pont sur une voie libre (attendre qu\'il soit en place), puis AV : le train roule jusqu\'au fond de la voie. Remettez le pont sur P. '
      +'Pour sortir un train : dernier canton libre, pont sur la voie du train, puis AR : il recule jusqu\'au frein final ; pont sur P, il entre en gare. STOP arrête une manœuvre. '
      +'Le pont ne bouge pas si un train est dessus ou tout près, et un train avec passagers ne quitte jamais le circuit. Au plus cinq trains sur le parcours.'
  };
})();
