'use strict';
/* OzIris — configuration de l'attraction pour le moteur (engine/*.js).
   Coaster inversé Bolliger & Mabillard (Parc Astérix, 2012). Tracé, gare, file, garage (pont transbordeur et 3 voies de
   maintenance) : sites/oziris.data.js (OpenStreetMap). Ce qui est estimé est signalé « ESTIMÉ » ; caractéristiques et sources : docs/oziris-notes.md. */
const SITE=(()=>{
  const Q=OSM.paths.queue,PROM=OSM.paths.prom,QL=OSM.paths.qlink;
  // File (OSM 1073325805) : le chemin repasse par le même nœud (-17, 57.3) : boucle ouest facultative entre Q[9] et Q[27].
  const F0=9,F1=27,ENTRY0=[35.4,31.0];
  // Garage (OSM) : pont transbordeur (railway=traverser 1330192631) sur la fin du frein final, 3 voies de maintenance (1330192628…30)
  // parallèles au frein final, en AMONT du pont, côté nord-ouest, à 3,0 / 7,0 / 11,0 m de l'axe du circuit (relevé OSM, ±0,5 m), longues de 13,3 m.
  // Le train entre donc dans sa voie en marche arrière (yard.rev). Rail du circuit et rail de garage sur le même chariot (sans rail escamotable) :
  // choix le plus simple compatible avec la carte (le pont déborde de 2,9 m côté sud-est, la place du rail du circuit écarté) — ESTIMÉ, question au propriétaire.
  const lane=(n,d)=>({name:'Voie '+n,d,len:13.3,cap:1});
  return {
    id:'oziris',title:'OzIris',kind:'inverted',trackName:'Poutre caisson',goal:900,lap:140,
    // 3 trains de 8 wagons, 4 places côte à côte par wagon (Wikipedia, d'après RCDB) ; longueur (1,55 m) et largeur (2,6 m) d'un wagon ESTIMÉES.
    car:{len:1.55,n:8,seats:4,abreast:4,w:2.6},
    // Couleurs des trains et de la voie SUPPOSÉES (non vérifiées sur photo) : teintes sourdes.
    trains:[{name:'Train 1',col:'#2f5873',col2:'#c2a050',wear:26},{name:'Train 2',col:'#2f5873',col2:'#c2a050',wear:42,lane:1},
      {name:'Train 3',col:'#2f5873',col2:'#c2a050',wear:34,lane:2}],
    track:{spine:'#3e5a74',rail:'#262d36',support:'#a89a7c'},
    stopBack:.5,holdBack:46.9,dropAfter:50,loadSide:-1,   // arrêt au frein final : train entier sur le pont transbordeur (OSM : s ≈ 798…812) ; embarquement côté est (ESTIMÉ)
    phys:{roll:.06,drag:.0009,vmin:3},
    // Pont transbordeur : rail du circuit (A) et rail de garage (B) sur le même chariot, écartés de 3,2 m ; positions P, G, 1…3.
    // ESTIMÉS : écart des rails, vitesse du chariot (0,5 m/s, 4 s au moins), vitesse de manœuvre des trains (1,5 m/s), sens d'entrée (marche arrière, d'après la position des voies).
    yard:{at:'brake',device:'traverser',rev:true,side:-1,gap:3.2,pre:.6,post:.6,laneGap:.8,move:{v:1.5,vc:.5,t:4},
      devName:'Pont transbordeur',devLabel:'le pont transbordeur',lanes:[lane(1,3.0),lane(2,7.0),lane(3,11.0)]},
    stationPoly:OSM.polys.station,stationAt:[-7,-8,9],stationRoofCol:'#b9a27a',
    fade:[[-7,-8,9],[-24,-24,12],[-35,-25,8]],   // toits qui s'effacent : gare, halle du frein final et du pont, garage
    // Quais : embarquement côté est (file), débarquement côté ouest ; profondeurs ESTIMÉES d'après le bâtiment OSM 420016980.
    plat:{load:7.0,exit:3.5,back:.6,front:1.6},
    // Poste de conduite : côté embarquement, en tête de quai (ESTIMÉ), vitre tournée vers la voie.
    booth:[-10.9,0.2,2.008],boothLabel:[-6.5,2.6],beacon:[-9.7,-.6],
    queue:{entry0:ENTRY0,link:[[37.4,27.8]],gate:{h:[36.3,31.8],a:[34.5,30.2],b:[34.7,33.6]},
      parts:[
        {pts:[ENTRY0].concat(Q.slice(0,F0+1))},
        // fourche (OSM : le chemin de la file repasse par le nœud (-17, 57.3)) : boucle ouest ou raccourci direct ; barrière ESTIMÉE au carrefour
        {name:'boucle ouest',loop:Q.slice(F0,F1+1),short:[Q[F0],Q[10],Q[F1]],gate:{h:[-17,57.3],a:[-15.7,56.1],b:[-18.2,56.0]}},
        {pts:Q.slice(F1)}]},
    approach:[{w:.5,pts:[[57.4,-2.3],[50.4,21.4],[38.1,26.5]]},{w:.5,pts:[[-5.3,19.5],[34.4,27.3],[38.1,26.5]]}],
    paths:[PROM,QL],
    // Entrée de la gare (OSM entrance=main, (-7.4, 4.3)) puis couloir d'attente côté est
    board:{via:[[-7.3,1.5],[-7.1,-.6]],walk:6.4},
    // Sortie (ESTIMÉE) : escalier au milieu du quai de débarquement (ouest), passage sous la gare surélevée (OSM : layer=1, bâtiment à 2 niveaux),
    // boutique (bâtiment 420016980, building=retail), auvent 420016979, allée à l'est.
    exit:{door:[-11.4,-12.95],path:[[-11.4,-12.95],[-6.3,-10.6],[-1.5,-8.4],[3.5,-6.2],[10.6,-4.3]],
      tails:[[[11.1,-12.1],[14.8,-27.4],[39.5,-8.3],[50.7,-1.1]],[[10.4,-.7],[-1.3,9.0],[-5.3,19.5]]]},
    jobsites:{liftFix:[-45,40],chainRev:[-45,40],trackRev:[20,40],brakeFix:[-30,-8],brakeRev:[-30,-8],trainRev:[-36,-26],rearm:[-4,-8]},
    view:{x:-12,z:5,w:230,h:200,bounds:[-120,120,-110,110]},
    cams:{gare:{label:'Gare',x:-8,z:-9,s:17},file:{label:'File',x:-15,z:45,s:7},lift:{label:'Lift',x:-42,z:30,s:7},
      inversions:{label:'Inversions',x:38,z:40,s:5.5},frein:{label:'Frein final',x:-26,z:-20,s:11},garage:{label:'Garage',x:-27,z:-27,s:13}},
    labels:()=>[['Gare',-22,-18],['Lift — 40 m',-58,40],['Frein final',-44,-12],['Garage',-45,-30],['Pont transbordeur',-20,-46],
      ["File d'attente",-30,57],['Entrée',38,36],['Tunnel',24,4],['Boutique',6,-12]],
    strike:{area:[-90,90,-90,90]},
    text:{storm:'Orage sur l\'attraction : aucun train ne doit partir.',great:'Excellente journée sur OzIris !'},
    // Commande par zones : frein de bloc B1 (ESTIMÉ, emplacement supposé en haut de la grande courbe nord) = freins seuls ;
    // frein final, rail de garage, voies = freins + moteurs (défauts du moteur, ESTIMÉ, à confirmer).
    helpGarage:'<b>Garage</b> : trois voies de maintenance parallèles au frein final, en amont du pont transbordeur, un train par voie. '
      +'Le pont porte deux rails : le rail du circuit (P) et le rail de garage (G), qui emporte le train. Les voies étant en arrière du pont, le train y entre en marche arrière et en ressort en marche avant. '
      +'Pour garer un train : envoyez-le vide (Gare AV), frein final en MANU et serré (il s\'arrête avant le pont), pont sur G, relâchez puis Frein final AV : il roule sur le rail de garage et s\'y arrête ; '
      +'pont sur une voie libre (il emporte le train), Rail de garage AR : il recule dans la voie ; pont sur P, TOUT AUTO. '
      +'Pour sortir un train : pont face à sa voie, Voie k AV (il avance sur le rail de garage), pont sur G avec le dernier canton libre, Rail de garage AV : il part vers la gare ; pont sur P. '
      +'Le pont ne bouge pas si un train y roule, n\'y est qu\'à moitié, ou avec des passagers. Rail du circuit hors ligne : les trains attendent avant le pont.',
    draw:{
      floor(ctx,s,{lw}){ // escalier de sortie (ESTIMÉ) au milieu du quai de débarquement
        if(s>5){ctx.save();ctx.translate(-11.4,-12.95);ctx.rotate(Math.atan2(.906,-.424));ctx.fillStyle='#a8a296';ctx.fillRect(-1.2,-.7,2.4,1.4);
          ctx.strokeStyle='rgba(60,56,50,.6)';lw(.06,.5);ctx.beginPath();for(let x=-1.1;x<1.2;x+=.35){ctx.moveTo(x,-.65);ctx.lineTo(x,.65);}ctx.stroke();ctx.restore();}
      }}
  };
})();
