'use strict';
/* ══════════ APPAREIL DE VOIE (docs/manoeuvres.md, docs/ref/garage.md) ══════════
   Aiguillage (2 positions, en S, rotatif : géométrie dans engine/voies/garage.js) ou pont transbordeur (voie qui bouge : positions successives P, G, voies 1…n),
   rail escamotable du pont ; état G.dev / G.ra, verrouillages, commande de position, avancement. Aucun dessin (montagnes-russes/dessin.js, voie-dessin.js). */
// Décalages du chariot : P, voies 1…n, G (pont à deux rails), puis positions enregistrées sans voie en face (POSX, osmrides#64 : X1, X2…)
const OFF=[0].concat(LANES.map(l=>l.off),TRAV&&!SG?[GAP]:[],POSX),CMAX=Math.max(...OFF.map(Math.abs),RET);
const POS_ORDER=POS_REC||(TRAV?(RA?[]:[0]).concat(SG?[]:[PG],LANES.map((_,j)=>j+1)):OFF.map((_,p)=>p)),posId=p=>p===PG?'G':p>=PX0?'X'+(p-PX0+1):p||'P';
const posLane=p=>p>=1&&p<=LANES.length; // position en face d'une voie de garage
const DEV0=(()=>{if(SWI){const q=POS_ORDER.find(p=>!posLane(p));return q==null?0:q;}if(!RA)return 0;const r=YB.retract&&YB.retract.rest||1;return POS_ORDER.includes(r)?r:POS_ORDER.find(p=>p!==PG)||r;})(); // position du chariot au départ (rail A escamotable : face à une voie)
// Chariot généré (osmrides#64) : la fosse et le tablier couvrent toutes les positions (rail du circuit retiré, voies, positions sans voie en face)
const PIT_VA=Math.max(RA?RET:GAP,...POSX)+1.5,PIT_VB=Math.min(...LANES.map(l=>-l.d),...POSX.map(c=>c-GAP))-1.6;
// État de l'appareil : G.dev={pos, to, k, d} (position quittée, position visée, avancement 0…1, durée du déplacement)
// devOff : circuit non passant (aiguillage à deux groupes, SWI : tronçon droit hors ligne) ; devOn(j) : appareil en place sur la voie j (SWI : tronçon droit retiré aussi)
const devMoving=()=>G.dev.pos!==G.dev.to, devOff=()=>SWI?!raIn():devMoving()||G.dev.pos!==0, devOn=j=>!devMoving()&&G.dev.pos===j+1&&(!SWI||raOut());
const devC=()=>lerp(OFF[G.dev.pos],OFF[G.dev.to],G.dev.k), devShown=()=>G.dev.to||G.dev.pos||1;
const raMoving=()=>RM&&G.ra.pos!==G.ra.to, raIn=()=>!RM||(!raMoving()&&G.ra.pos===0), raOut=()=>RM&&!raMoving()&&G.ra.pos===1;
const raC=()=>RM?lerp(G.ra.pos*RET,G.ra.to*RET,G.ra.k):devC(); // décalage du rail A le long de (SW0.vx, SW0.vz)
const inLine=()=>RA?raIn()||(raOut()&&!devMoving()&&G.dev.pos===PG):!devMoving()&&(G.dev.pos===0||G.dev.pos===PG); // pont droit : un rail (A ou B) raccorde le circuit
const posName=p=>p===PG?'G (rail de garage sur le circuit)':p>=PX0?'la position « '+(POSN[p]||posId(p))+' » (aucune voie en face)':p?'voie '+p+' ('+LANES[p-1].name+')':SWI?'P (tronçon en S hors ligne)':'P (circuit)';
const bIn=()=>TRAV&&!SG&&!devMoving()&&G.dev.pos===PG&&(!RA||raOut()); // pont droit : rail B (garage) en ligne avec le circuit
const circIn=()=>TRAV&&(RA?raIn():!devMoving()&&G.dev.pos===0); // pont droit : rail A (circuit) en ligne
// aiguillage : train sur l'appareil, à moins d'une longueur, ou qui a passé le frein de retenue et se dirige vers l'appareil
const swLock=()=>VEHICULES.find(o=>nearDev(o)||(o.st==='run'&&((o.s>(LBK?SW_A-.5:ANCH+.2)&&o.s<SW_B+VL+1)||(HOLD_Z&&HOLD_Z!=='St'&&!ATT[HOLD_Z].bloc&&fournit('quitteAttente',false,o))||(HOLD_Z&&(HOLD_Z!=='St'||LBK&&YZ!=='St')&&dnS(HOLD_S,o.s)>.05&&dnS(HOLD_S,o.s)<dnS(HOLD_S,SW_A)))));
const raLock=()=>TRAV?VEHICULES.find(onRail):swLock(); // rail du circuit seul : immobile tant qu'un train y est, y roule ou s'en approche
const devLock=()=>TRAV?VEHICULES.find(o=>(onRail(o)&&!(RA&&raIn()&&G.dev.pos!==PG)&&!(atAnchor(o)&&G.dev.pos===PC&&!count(o)))||(onCar(o)&&(o.mv||o.lane>=0))):swLock();
function yardPos(p){
  if(G.estop)return refuse(DEVN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(devMoving())return refuse(DEVN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.dev.pos)return refuse(DEVN+' déjà sur '+posName(p)+'.');
  const o=devLock();if(o)return refuse(DEVN+' verrouillé : '+o.name+(TRAV&&o.st==='run'&&atAnchor(o)?' a des passagers sur '+(SG?zName('RB').toLowerCase():'le rail de garage')+'.':TRAV?' est sur le chariot sans y être arrêté, ou y roule.':' est sur l\'appareil ou à moins d\'une longueur de train.'));
  if(SWI&&posLane(p)&&!raOut())return refuse(DEVN+' : le tronçon en S ne vient sur une voie que si '+RAN.toLowerCase()+' est retiré'+(raMoving()?' (en mouvement).':' : il est sur le circuit.'));
  if(TRAV){ // pont droit : le chariot emporte le train arrêté sur le rail B
    if(RA&&p===PG&&!raOut())return refuse(DEVN+' : le rail de garage ne vient en ligne que si '+RAN+' est retiré'+(raMoving()?' (en mouvement).':' : '+RAN+' est sur le circuit.'));
    const c=VEHICULES.find(o=>onCar(o));
    if(c&&p===PC){const MR=SITE.maxRun||VEHICULES.length,run=VEHICULES.filter(o=>o.st!=='garage').length;
      if(run>=MR)return refuse('Déjà '+run+' VEHICULES sur le circuit (au plus '+MR+') : '+c.name+' reste sur le chariot.');
      if(!raccordLibre(c))return refuse('Dernier canton occupé : '+c.name+' ne peut pas être remis sur le circuit (fermez au besoin un frein de bloc).');}
    if(c&&posLane(p)&&VEHICULES.some(o=>o.st==='garage'&&o!==c&&o.lane===p-1))return refuse('Voie '+p+' ('+LANES[p-1].name+') occupée : '+c.name+' ne peut pas y être porté.');
    const r=VEHICULES.find(o=>o.st==='run'&&atAnchor(o)&&G.dev.pos===PC);
    if(r&&p!==PC){r.st='garage';r.lane=-1;r.g=G_B;r.mv=0;r.v=0;appel('quitteCircuit',r,true);
      log(r.name+' est emporté par le chariot.');}
  }
  G.dev.to=p;G.dev.k=0;G.dev.d=TRAV?Math.max(MV.t,Math.abs(OFF[p]-OFF[G.dev.pos])/MV.vc):MV.t;
  log(DEVN+' commandé vers '+posName(p)+(RA?(G.dev.pos===PG?' : plus aucun rail en ligne, VEHICULES retenus avant le pont.':'.'):TRAV?(p===PG||!p?'.':' : rail du circuit hors ligne, VEHICULES retenus avant le pont.'):SWI?(raIn()?' : '+RAN.toLowerCase()+' toujours en ligne, circuit passant.':'.'):p?(YZ==='St'&&!LBK?' : un véhicule vide part de '+ANCH_NAME+' vers le garage.':YZ==='St'||HOLD_Z==='St'?' : départs bloqués.':ATT[YZ].horsP&&!LBK?ATT[YZ].horsP:' : VEHICULES retenus '+zSur(HOLD_Z)+'.'):'.'));
  return true;
}
function raPos(p){ // rail A escamotable : 0 = sur le circuit, 1 = retiré
  if(!RM||(p!==0&&p!==1))return false;
  const nm=p?'retiré':'sur le circuit';
  if(G.estop)return refuse(RAN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(raMoving())return refuse(RAN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.ra.pos)return refuse(RAN+' déjà '+nm+'.');
  if(!p&&(devMoving()||(SWI?posLane(G.dev.pos):G.dev.pos===PG)))return refuse(RAN+' ne revient sur le circuit que si '+(SWI?'le tronçon en S n\'est ni en ligne ni en mouvement : écartez-le d\'abord de la voie.':'le rail de garage n\'est pas en ligne : écartez d\'abord '+DEVL+' vers une voie.'));
  const o=raLock();if(o)return refuse(RAN+' verrouillé : '+o.name+' y est, y roule ou s\'en approche.');
  G.ra.to=p;G.ra.k=0;G.ra.d=Math.max(MV.t,RET/MV.vc);
  log(RAN+' commandé '+(p?'vers l\'extérieur : circuit coupé, VEHICULES retenus avant '+(TRAV?'le pont':DEVL)+'.':'vers le circuit.'));return true;
}
// l'appareil ne bouge que sur commande de l'opérateur ; l'arrêt d'urgence le fige. Vrai quand l'appareil (G.dev) arrive en place.
function avanceAppareils(dt){
  if(raMoving()&&!G.estop){G.ra.k+=dt/(G.ra.d||MV.t);if(G.ra.k>=1){G.ra.k=1;G.ra.pos=G.ra.to;log(RAN+(G.ra.pos?' retiré.':' en place sur le circuit.'));}}
  if(devMoving()&&!G.estop){G.dev.k+=dt/(G.dev.d||MV.t);if(G.dev.k>=1){G.dev.k=1;G.dev.pos=G.dev.to;log(DEVN+' en place sur '+posName(G.dev.pos)+'.');return true;}}
  return false;}
/* Éditeur (osmrides#64) : rails mobiles, positions et repères d'aimantation, sans rien changer. Repère : origine SW0, u = (tx, tz), v = (vx, vz) ; un rail placé
   à la distance d du circuit (vers le garage) est en v = -d. pts = tracé du rail en d = 0 ; rail porté par le chariot (car) : d = -(c + vo), c = décalage du
   chariot ; axes = distances d où ce rail est en face du circuit ou d'une voie (l'aimant de l'éditeur s'y colle). */
function railsEd(){
  if(!(TRAV||(YD.device==='switch'&&!LBK&&!ROT))||!LANES.length)return null;
  const loc=(x,z)=>{const dx=x-SW0.x,dz=z-SW0.z;return [dx*SW0.tx+dz*SW0.tz,dx*SW0.vx+dz*SW0.vz];},r2=v=>Math.round(v*100)/100;
  const conn=p=>p===PG||(p===0&&!RM)?'circuit':posLane(p)?'voie '+p:null,lanes=LANES.map((l,j)=>({d:TRAV?l.d:-l.off,label:'voie '+(j+1)}));
  const rails=[];
  if(TRAV){const st=[[0,0],[R1-R0,0]];
    rails.push({id:'circuit',name:SG?zName('RB'):RA?RAN:'Rail du parcours',pts:st,car:!RA,vo:0,axes:[{d:0,label:'circuit'}].concat(SG?lanes:[])});
    if(!SG)rails.push({id:'garage',name:'Rail du chariot',pts:st,car:true,vo:-GAP,axes:[{d:0,label:'circuit'}].concat(lanes)});}
  else{const a=[];for(let s=SW_A;s<=SW_B+.01;s+=.5){const f=frameAt(s,mkF());a.push(loc(f.p.x,f.p.z));}
    rails.push({id:'circuit',name:SWI?RAN:'Rail du circuit',pts:a,car:!SWI,vo:0,axes:[{d:0,label:'circuit'}]});
    const P=LANES[0].path.filter(q=>q.d<=LANES[0].link+.01).map(q=>loc(q.x,q.z));
    rails.push({id:'garage',name:'Tronçon en S',pts:P,car:true,vo:-LANES[0].off,axes:[{d:0,label:'voie 1'}]});}
  for(const r of rails)r.d=r2(r.car?-(devC()+r.vo):-raC());
  return {device:TRAV?(SG?'single':'traverser'):'switch',rec:!!RLS,rails,master:CM||(SG||!TRAV?'circuit':'garage'),locked:TRAV?!SG&&!RA:!SWI,lockable:!SG,lockWhy:SG?'un seul rail mobile sur cet appareil':'',tol:RTOL,
    frame:{x:SW0.x,z:SW0.z,tx:SW0.tx,tz:SW0.tz,vx:SW0.vx,vz:SW0.vz},c:devC(),
    car:POS_ORDER.map(p=>({p,id:posId(p),name:String(POSN[p]||posId(p)),c:r2(OFF[p]),conn:conn(p)})),
    ra:RM?[{name:RA_NM[0],d:0,conn:'circuit'},{name:RA_NM[1],d:r2(-RET),conn:null}]:null};
}
