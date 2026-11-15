'use strict';
/* Goudurix — configuration de l'attraction pour le moteur (engine/*.js).
   Montagnes russes en acier Vekoma MK-1200 à rails tubulaires, Parc Astérix (1989), sept inversions annoncées. Tracé, gare, chemins, voie de maintenance :
   sites/goudurix.data.js (OpenStreetMap). Ce qui est estimé est signalé « ESTIMÉ » ; caractéristiques et sources : docs/goudurix-notes.md. */
const SITE=(()=>{
  const PROM=OSM.paths.prom,PROM2=OSM.paths.prom2,QL=OSM.paths.qlink;
  // Embarquement à l'OUEST de la gare, portillons à l'ouest (propriétaire, 2026-11-15). OSM ne cartographie pas la file : on prend la promenade « Gouduriiiix Promenade »
  // (132709980) de l'entrée sud (23,8 ; 87,7) jusqu'à (-28 ; -2), puis un raccord ESTIMÉ vers le quai ouest. Le chemin 1102233771 (côté est, nord-sud) sert d'arrivée et de sortie.
  const QP=PROM.slice(0,8),ENTRY0=[QP[0][0]-.7,QP[0][1]+.9];
  const EAST=OSM.paths.queue; // 1102233771 : de (16,5 ; 11,6) vers l'entrée sud (23,8 ; 87,7)
  // Sens de marche (propriétaire, 2026-11-15 : « le lift est la montée après la gare ») : gare vers le sud, lift droit sur l'axe nord-sud (s 44 → 136, OSM
  // « brake_run » + début de 541092982), puis les figures dans le lac, retour par la diagonale ouest (OSM « lift_hill », ici zone de freinage) et la courbe nord (OSM « launch_straight »).
  // Garage (OSM) : voie de maintenance 1221386549 (45 m, butoir au sud) qui se raccorde à ce retour, au nœud railway=switch (-15,2 ; -4,5), à 30 m avant la gare.
  // Propriétaire : « les trains vont au garage en marche arrière de la gare si l'aiguillage est orienté vers la voie ; l'aiguillage est un rail qui tourne sur lui-même, avec pour axe
  // le tube de rail » : yard.back (entrée en marche arrière depuis la gare, appareil en amont) et yard.rotary (rail rotatif). « L'aiguillage est un S » (propriétaire, 2026-11-15) :
  // yard.s, le tronçon mobile a deux faces (HYPOTHÈSE : une face droite = circuit, une face en S = voie de garage), le S est une courbe qui part du circuit au nœud OSM railway=switch
  // (bord de l'appareil côté gare, à 44,4 m en amont de l'arrêt de la tête du train) et rejoint la voie de maintenance OSM (3,4 m plus loin latéralement, ≈ 6 m en amont). Longueur
  // du S et durée de rotation (4 s) : ESTIMÉES.
  const lanePts=OSM.paths.garage.slice().reverse().slice(2),BRIDGE=[[42.3,9.7],[87.8,21.7],[89.9,26.6]]; // pont de bois OSM 161214279 (layer 1)
  return {
    id:'goudurix',title:'Goudurix',kind:'steel',trackName:'Voie tubulaire',goal:500,lap:120,
    // 2 trains de 7 wagons, 28 places = 4 par wagon en 2 rangées de 2 (RCDB, Wikipédia). Longueur (2,55 m) et largeur (1,5 m) d'un wagon ESTIMÉES.
    car:{len:2.55,n:7,seats:4,abreast:2,w:1.5},
    // Trains rouges (propriétaire, 2026-11-15) ; teinte exacte et liseré gris sombre SUPPOSÉS ; voie tubulaire jaune et supports rouges d'après la photo du propriétaire (teintes assourdies).
    trains:[{name:'Train 1',col:'#9a2d28',col2:'#3a3a3e',wear:30},{name:'Train 2',col:'#9a2d28',col2:'#3a3a3e',wear:44}],
    track:{spine:'#a88a2e',rail:'#cdaa38',support:'#8e3b2c'},
    // (propriétaire) un seul train sur le lift ; le lift retient le train en haut si la zone de freinage suivante est occupée : comportement par défaut du moteur
    // Deux zones de freinage (propriétaire) : frein de bloc B1 (repère blk1) juste avant la portion droite sous le lift, frein final (brk) sur la voie parallèle à la gare. Position d'après le propriétaire, emplacement exact ESTIMÉ.
    stopBack:.5,holdBack:5,dropAfter:35,loadSide:1,   // frein final : tête du train 5 m avant la gare (ESTIMÉ) ; le train roule vers le sud : loadSide 1 = embarquement à l'OUEST (portillons à l'ouest, propriétaire)
    phys:{roll:.02,drag:.0004,vmin:3},
    // Garage : une seule voie (la voie de maintenance OSM), 2 trains au plus. Durée de rotation (4 s) et vitesse de manœuvre ESTIMÉES.
    yard:{at:'station',device:'switch',back:true,rotary:true,s:true,a:44.4,b:50.4,slide:1,side:-1,len:5.6,devName:'Aiguillage',devLabel:'l\'aiguillage',lanes:[{name:'Garage',pts:lanePts,cap:2}],move:{v:2.4,t:4}},
    stationPoly:OSM.polys.station,stationAt:[.4,0,12],stationRoofCol:'#9b8f7d',
    fade:[[.4,0,12]],   // toits qui s'effacent : gare
    // Quais ESTIMÉS (le bâtiment OSM, 6,8 m de large, ne couvre que la voie et ses abords) : embarquement à l'ouest (portillons), débarquement à l'est.
    plat:{load:7.0,exit:3.5,back:.6,front:1.6},
    booth:[6.4,-11.8,0],boothLabel:[9.5,-14.5],beacon:[5.6,-10.6],
    queue:{entry0:ENTRY0,link:[],gate:{h:[QP[0][0]+1.7,QP[0][1]+.6],a:[QP[0][0]-1.7,QP[0][1]+.6],b:[QP[0][0]+1.9,QP[0][1]-2]},
      parts:[{pts:[ENTRY0].concat(QP,[[-20.5,2.8],[-13.5,5.2]])}]},   // raccord (-28 ; -2) → quai ouest ESTIMÉ
    // Arrivée : depuis le pont de bois et l'allée est (OSM 161214279, 161214274), puis le chemin 1102233771 vers l'entrée sud.
    approach:[{w:1,pts:BRIDGE.slice().reverse().concat([[34,7.5],[29.9,7.7],[18,4.2]],EAST)}],
    paths:[PROM,PROM2,QL,EAST],
    // Couloir d'attente à 6,4 m de la voie, côté ouest, entrée par le sud
    board:{via:[[-11,6.2],[-8.4,7.9],[-6.4,6.9]],walk:6.4},
    // Sortie (ESTIMÉE) : porte dans le mur est de la gare, allée OSM 161214274 vers l'est puis le pont de bois ; tail inverse : chemin nord-sud (1102233771).
    exit:{door:[4.4,.6],path:[[4.4,.6],[10,2.4],[18,4.2]],
      tails:[[[18,4.2],[29.9,7.7],[34,7.5]].concat(BRIDGE)]},
    jobsites:{liftFix:[8,70],chainRev:[8,70],trackRev:[42,60],brakeFix:[-10,30],brakeRev:[-10,30],trainRev:[-10,12],rearm:[5,-3]},
    view:{x:25,z:52,w:200,h:190,bounds:[-90,120,-60,170]},
    // Figures (affiche du plan des figures, docs/sources/goudurix-plan-figures-affiche.png, recalée sur le tracé OSM par la forme ; positions ESTIMÉES) : après la grande descente,
    // Butterfly (2 inversions, S de (29..48 ; 62..78), s ≈ 206–272), Loop (1, ligne droite nord, s ≈ 280–304), Batwing (2, ∞ au bord du lac, s ≈ 312–382), Double Corkscrew (2, S de l'extrémité sud-ouest, s ≈ 540–590).
    cams:{gare:{label:'Gare',x:3,z:0,s:17},file:{label:'File',x:22,z:50,s:7},lift:{label:'Lift',x:6,z:78,s:6.5},descente:{label:'Grande descente',x:29,z:96,s:8},
      butterfly:{label:'Butterfly',x:38,z:70,s:11},loop:{label:'Loop',x:46,z:50,s:11},batwing:{label:'Batwing',x:55,z:28,s:11},corkscrew:{label:'Double Corkscrew',x:19,z:92,s:9},
      frein:{label:'Frein final',x:-6,z:30,s:8},garage:{label:'Garage',x:-14,z:10,s:11}},
    labels:()=>[['Gare',6,-4],['Lift — 36 m',12,78],['Grande descente',38,100],['Virage à 180°',14,128],['Butterfly',52,66],['Loop',34,50],['Batwing',60,22],['Double Corkscrew',3,92],
      ['Frein final',-32,35],['Garage',-32,12],['Entrée',32,88],["File d'attente",-42,52],['Sortie',14,-3]],
    strike:{area:[-60,100,-40,150]},
    // Le premier frein du parcours (B1) RALENTIT nettement le train (propriétaire) : vitesse ramenée à 8 m/s (≈ 29 km/h, ESTIMÉ) en passage normal ; arrêt seulement si le canton suivant est occupé.
    zones:{B1:{trim:{v:8}}},
    text:{storm:'Orage sur Goudurix : aucun train ne doit partir.',great:'Excellente journée sur Goudurix !'},
    helpGarage:'<b>Garage</b> : une voie de maintenance, en amont de la gare (≈ 44 m avant l\'arrêt du train). L\'aiguillage est un rail rotatif : il tourne sur lui-même autour du tube de rail, pour présenter le circuit (P) ou la voie (1). '
      +'Pour garer un train : train vide à quai, portillons fermés, aiguillage sur 1 (attendre la fin de la rotation), puis Gare AR : le train recule de la gare jusqu\'au fond de la voie. Remettez l\'aiguillage sur P. '
      +'Pour le sortir : gare libre (au besoin, frein final en MANU et serré pour retenir l\'autre train), aiguillage sur 1, puis Garage AV : il avance jusqu\'en gare ; aiguillage sur P. '
      +'L\'aiguillage ne tourne pas si un train est dessus ou tout près, et un train avec passagers ne quitte jamais le circuit.',
    draw:{}
  };
})();
