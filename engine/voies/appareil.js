'use strict';
/* ══════════ APPAREIL DE VOIE (docs/manoeuvres.md, docs/ref/garage.md) ══════════
   Aiguillage (2 positions, en S, rotatif : géométrie dans engine/voies/garage.js) ou pont transbordeur (voie qui bouge : positions successives P, G, voies 1…n),
   rail escamotable du pont ; état G.dev / G.ra, verrouillages, commande de position, avancement. Aucun dessin (montagnes-russes/dessin.js, voie-dessin.js). */
const OFF=[0].concat(LANES.map(l=>l.off),TRAV&&!SG?[GAP]:[]),CMAX=Math.max(...OFF.map(Math.abs),RET);
const POS_ORDER=TRAV?(RA?[]:[0]).concat(SG?[]:[PG],LANES.map((_,j)=>j+1)):OFF.map((_,p)=>p),posId=p=>p===PG?'G':p||'P';
const DEV0=RA?(YD.retract.rest||1):0; // position du chariot au départ (rail A escamotable : face à une voie)
// État de l'appareil : G.dev={pos, to, k, d} (position quittée, position visée, avancement 0…1, durée du déplacement)
const devMoving=()=>G.dev.pos!==G.dev.to, devOff=()=>devMoving()||G.dev.pos!==0, devOn=j=>!devMoving()&&G.dev.pos===j+1;
const devC=()=>lerp(OFF[G.dev.pos],OFF[G.dev.to],G.dev.k), devShown=()=>G.dev.to||G.dev.pos||1;
const raMoving=()=>RA&&G.ra.pos!==G.ra.to, raIn=()=>!RA||(!raMoving()&&G.ra.pos===0), raOut=()=>RA&&!raMoving()&&G.ra.pos===1;
const raC=()=>RA?lerp(G.ra.pos*RET,G.ra.to*RET,G.ra.k):devC(); // décalage du rail A le long de (SW0.vx, SW0.vz)
const inLine=()=>RA?raIn()||(raOut()&&!devMoving()&&G.dev.pos===PG):!devMoving()&&(G.dev.pos===0||G.dev.pos===PG); // pont droit : un rail (A ou B) raccorde le circuit
const posName=p=>p===PG?'G (rail de garage sur le circuit)':p?'voie '+p+' ('+LANES[p-1].name+')':'P (circuit)';
const bIn=()=>TRAV&&!SG&&!devMoving()&&G.dev.pos===PG&&(!RA||raOut()); // pont droit : rail B (garage) en ligne avec le circuit
const circIn=()=>TRAV&&(RA?raIn():!devMoving()&&G.dev.pos===0); // pont droit : rail A (circuit) en ligne
const raLock=()=>VEHICULES.find(onRail); // rail A : immobile tant qu'un train y est, y roule ou s'en approche
const devLock=()=>TRAV?VEHICULES.find(o=>(onRail(o)&&!(RA&&raIn()&&G.dev.pos!==PG)&&!(atAnchor(o)&&G.dev.pos===PC&&!count(o)))||(onCar(o)&&(o.mv||o.lane>=0)))
  :VEHICULES.find(o=>nearDev(o)||(o.st==='run'&&((o.s>(LBK?SW_A-.5:ANCH+.2)&&o.s<SW_B+VL+1)||(HOLD_Z&&HOLD_Z!=='St'&&!ATT[HOLD_Z].bloc&&fournit('quitteAttente',false,o))||(HOLD_Z&&(HOLD_Z!=='St'||LBK&&YZ!=='St')&&dnS(HOLD_S,o.s)>.05&&dnS(HOLD_S,o.s)<dnS(HOLD_S,SW_A))))); // train qui a passé le frein de retenue et se dirige vers l'appareil
function yardPos(p){
  if(G.estop)return refuse(DEVN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(devMoving())return refuse(DEVN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.dev.pos)return refuse(DEVN+' déjà sur '+posName(p)+'.');
  const o=devLock();if(o)return refuse(DEVN+' verrouillé : '+o.name+(TRAV&&o.st==='run'&&atAnchor(o)?' a des passagers sur '+(SG?zName('RB').toLowerCase():'le rail de garage')+'.':TRAV?' est sur le chariot sans y être arrêté, ou y roule.':' est sur l\'appareil ou à moins d\'une longueur de train.'));
  if(TRAV){ // pont droit : le chariot emporte le train arrêté sur le rail B
    if(RA&&p===PG&&!raOut())return refuse(DEVN+' : le rail de garage ne vient en ligne que si '+RAN+' est retiré'+(raMoving()?' (en mouvement).':' : '+RAN+' est sur le circuit.'));
    const c=VEHICULES.find(o=>onCar(o));
    if(c&&p===PC){const MR=SITE.maxRun||VEHICULES.length,run=VEHICULES.filter(o=>o.st!=='garage').length;
      if(run>=MR)return refuse('Déjà '+run+' VEHICULES sur le circuit (au plus '+MR+') : '+c.name+' reste sur le chariot.');
      if(!raccordLibre(c))return refuse('Dernier canton occupé : '+c.name+' ne peut pas être remis sur le circuit (fermez au besoin un frein de bloc).');}
    if(c&&p&&p!==PG&&VEHICULES.some(o=>o.st==='garage'&&o!==c&&o.lane===p-1))return refuse('Voie '+p+' ('+LANES[p-1].name+') occupée : '+c.name+' ne peut pas y être porté.');
    const r=VEHICULES.find(o=>o.st==='run'&&atAnchor(o)&&G.dev.pos===PC);
    if(r&&p!==PC){r.st='garage';r.lane=-1;r.g=G_B;r.mv=0;r.v=0;appel('quitteCircuit',r,true);
      log(r.name+' est emporté par le chariot.');}
  }
  G.dev.to=p;G.dev.k=0;G.dev.d=TRAV?Math.max(MV.t,Math.abs(OFF[p]-OFF[G.dev.pos])/MV.vc):MV.t;
  log(DEVN+' commandé vers '+posName(p)+(RA?(G.dev.pos===PG?' : plus aucun rail en ligne, VEHICULES retenus avant le pont.':'.'):TRAV?(p===PG||!p?'.':' : rail du circuit hors ligne, VEHICULES retenus avant le pont.'):p?(YZ==='St'||HOLD_Z==='St'?' : départs bloqués.':ATT[YZ].horsP&&!LBK?ATT[YZ].horsP:' : VEHICULES retenus '+zSur(HOLD_Z)+'.'):'.'));
  return true;
}
function raPos(p){ // rail A escamotable : 0 = sur le circuit, 1 = retiré
  if(!RA||(p!==0&&p!==1))return false;
  const nm=p?'retiré':'sur le circuit';
  if(G.estop)return refuse(RAN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(raMoving())return refuse(RAN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.ra.pos)return refuse(RAN+' déjà '+nm+'.');
  if(!p&&(devMoving()||G.dev.pos===PG))return refuse(RAN+' ne revient sur le circuit que si le rail de garage n\'est pas en ligne : écartez d\'abord '+DEVL+' vers une voie.');
  const o=raLock();if(o)return refuse(RAN+' verrouillé : '+o.name+' y est, y roule ou s\'en approche.');
  G.ra.to=p;G.ra.k=0;G.ra.d=Math.max(MV.t,RET/MV.vc);
  log(RAN+' commandé '+(p?'vers l\'extérieur : circuit coupé, VEHICULES retenus avant le pont.':'vers le circuit.'));return true;
}
// l'appareil ne bouge que sur commande de l'opérateur ; l'arrêt d'urgence le fige. Vrai quand l'appareil (G.dev) arrive en place.
function avanceAppareils(dt){
  if(raMoving()&&!G.estop){G.ra.k+=dt/(G.ra.d||MV.t);if(G.ra.k>=1){G.ra.k=1;G.ra.pos=G.ra.to;log(RAN+(G.ra.pos?' retiré.':' en place sur le circuit.'));}}
  if(devMoving()&&!G.estop){G.dev.k+=dt/(G.dev.d||MV.t);if(G.dev.k>=1){G.dev.k=1;G.dev.pos=G.dev.to;log(DEVN+' en place sur '+posName(G.dev.pos)+'.');return true;}}
  return false;}
