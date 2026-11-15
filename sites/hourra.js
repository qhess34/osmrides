'use strict';
/* La Trace du Hourra — configuration de l'attraction pour le moteur (engine/*.js).
   Tracé, gare, file, sortie et bâtiment du garage : sites/hourra.data.js (OpenStreetMap). Ce qui est estimé est signalé « estimé ». */
const SITE=(()=>{
  const Q=OSM.paths.queue,LOOP=OSM.paths.queueLoop,PROM=OSM.paths.prom,ENTRY0=[59.2,16.15];
  const F=Q.length-2; // (11.5,-9) : fourche de la file avant l'entrée principale de la gare
  // Garage : 6 voies droites, parallèles au frein final, côte à côte à l'ouest du circuit, dans le bâtiment OSM 148160581
  // (son grand côté est parallèle à la ligne droite du frein final). d = distance (m) entre l'axe du circuit et l'axe de la voie.
  // Côté ouest, écartement 3,2 m, distance de la première voie (8 m), longueur (un train + 1,4 m) : ESTIMÉS (non relevés).
  const lane=(n,d)=>({name:'Voie '+n,d,cap:1});
  return {
    id:'hourra',title:'La Trace du Hourra',kind:'bob',trackName:'Gouttière',goal:900,lap:110,
    car:{len:1.55,n:7,seats:2,inline:true,w:.95},   // 7 bobs de 2 places l'une derrière l'autre (propriétaire) ; longueur et largeur d'un bob estimées
    // 6 trains (propriétaire), 5 au plus sur le parcours : les 5 autres démarrent chacun sur sa voie de garage. Teintes sourdes supposées (couleurs réelles non vérifiées).
    // Gouttière rouge foncé à nervures extérieures, bord rouge vif (photo du propriétaire, 2026-11-14)
    trough:{lo:[112,38,36],hi:[140,52,46],edge:'#5a1f1c',deck:'#6e2622',rim:'#b8322c',shine:'rgba(255,220,210,.12)'},
    // Tous les trains : bobs jaunes, intérieur noir (propriétaire, 2026-11-14)
    trains:[{name:'Train 1',col:'#d8a92a',col2:'#2a2a2c',wear:28},{name:'Train 2',col:'#d8a92a',col2:'#2a2a2c',wear:44,lane:1},
      {name:'Train 3',col:'#d8a92a',col2:'#2a2a2c',wear:36,lane:2},{name:'Train 4',col:'#d8a92a',col2:'#2a2a2c',wear:52,lane:3},
      {name:'Train 5',col:'#d8a92a',col2:'#2a2a2c',wear:20,lane:4},{name:'Train 6',col:'#d8a92a',col2:'#2a2a2c',wear:60,lane:5}],
    maxRun:5,   // au plus 5 trains sur le parcours (propriétaire) : la sortie d'un 6e est refusée
    stopBack:.5,holdBack:24,dropAfter:12,loadSide:-1,   // arrêt au frein final en bout de ligne droite, train entier sur le rail du pont (ESTIMÉ)
    phys:{roll:.13,drag:.0016,vmin:3},
    // Garage sur le frein final : pont transbordeur DROIT (propriétaire) — deux éléments mobiles indépendants, droits, d'un train de long :
    // rail mobile du parcours (rail A) = rail du circuit (zone de freinage), deux positions seulement : sur le circuit ou retiré vers l'est (retract) ;
    // chariot et rail du chariot (rail B ; garage, freins et pneus, porte le train) : en ligne avec le circuit (G, seulement rail A retiré) ou face à la voie k (ouest).
    // Le train y entre en marche avant et en ressort en arrière.
    // ESTIMÉS : emplacement (dernière ligne droite du frein final, s ≈ 736…748), course du rail A (3,2 m), vitesse du chariot et du rail A
    // (0,6 m/s, 4 s au moins par déplacement), vitesse de manœuvre des trains (1,8 m/s), sens d'entrée dans les voies, chariot au repos face à la voie 1.
    yard:{at:'brake',device:'traverser',side:1,gap:3.2,pre:.6,post:.6,laneGap:.8,move:{v:1.8,vc:.6,t:4},
      devName:'Chariot',devLabel:'le chariot',retract:{d:3.2,name:'Rail mobile du parcours',short:'Rail parcours',rest:1},
      lanes:[lane(1,8),lane(2,11.2),lane(3,14.4),lane(4,17.6),lane(5,20.8),lane(6,24)]},
    stationPoly:OSM.polys.station,stationAt:[1.5,1,9],
    fade:[[1.5,1,9],[-34,-7,12]],   // toits qui s'effacent : gare, garage
    plat:{load:5.9,exit:2.3,back:.6,front:1.2},
    // Poste de conduite : extrémité sud-est de la gare (propriétaire), côté sud-ouest de la voie, vitre tournée vers la voie, à 2,8 m de l'axe ;
    // emplacement exact ESTIMÉ (dans le décrochement sud du bâtiment OSM 148160006, là où la voie sort de la gare)
    booth:[2.8,8.0,-2.427],boothLabel:[0.4,11.6],beacon:[3.95,7.85],
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
    labels:()=>[['Gare',-6,-8],['Lift — 31 m',44,-50],['Frein final',-36,-42],['Garage',-31,-4],['Pont transbordeur',-38,-33],["File d'attente",40,8],['Entrée',67,23]],
    text:{storm:'Orage sur l\'attraction : aucun train ne doit partir.',great:'Excellente journée sur la Trace du Hourra !'},
    // Commande par zones : freins de bloc B1…B3 = freins seuls ; frein final, rail mobile du parcours, rail du chariot, voies = freins + moteurs (défauts du moteur, ESTIMÉ,
    // à confirmer par le propriétaire). Exemple pour changer : zones:{B:{drive:true}, RA:{drive:false}}.
    helpGarage:'<b>Garage</b> : six voies droites, un train par voie, desservies par un pont transbordeur droit sur le frein final, commandées par zones. Deux éléments mobiles : '
      +'le rail mobile du parcours (rail du circuit, zone de freinage), sur le circuit (C) ou retiré vers l\'est (E), et le chariot, qui porte le rail du chariot (rail de garage) et emporte le train : en ligne avec le circuit (G) ou face à une voie (1 à 6). '
      +'Pour garer un train : envoyez-le vide (Gare AV), frein final en MANU et serré (il s\'arrête avant le pont), rail parcours sur E, chariot sur G, relâchez le frein final puis Frein final AV : il roule sur le rail du chariot et s\'y arrête ; '
      +'chariot sur une voie libre (il emporte le train), Rail du chariot AV : il entre dans la voie ; chariot ramené sur la voie 1, rail parcours sur C, TOUT AUTO. '
      +'Pour sortir un train : chariot sur la voie du train, Voie k AR (il recule sur le rail du chariot), rail parcours sur E, chariot sur G avec le dernier canton libre, Rail du chariot AV : il entre en gare ; chariot sur une voie, puis rail parcours sur C. '
      +'Le chariot ne vient en ligne que si le rail mobile du parcours est retiré ; il ne revient que si le chariot n\'est pas en ligne. Ni l\'un ni l\'autre ne bouge si un train y roule ou n\'y est qu\'à moitié, ni avec des passagers. '
      +'Aucun rail du circuit en ligne : les trains attendent avant le pont. Au plus cinq trains sur le parcours.'
  };
})();
