'use strict';
/* Gare de triage générique (SITE.yard) — règles communes : docs/manoeuvres.md.
   Point de raccordement sur le circuit (gare ou frein final), appareil de voie (aiguillage à 2 positions ou pont transbordeur
   à N positions), voies de garage. Chaque voie k a son propre chemin : circuit jusqu'à SW_A, tronçon de transfert (courbe
   en S de SW_A jusqu'au début de la voie), puis la voie. Un train hors circuit (st==='garage') a une voie t.lane et une
   abscisse t.g (avant du train, 0 = point de raccordement), t.mv = +1 avance, -1 recule, 0 arrêté.
   L'appareil est un chariot coulissant le long de (SW0.vx, SW0.vz) qui porte le tronçon du circuit et le tronçon de
   transfert : position P = décalage 0, voie k = décalage OFF[k] (le tronçon de transfert de la voie k est alors en place). */
const YD=SITE.yard,TRAV=YD.device==='traverser',GSTEP=TLEN+1.2,MV=Object.assign({v:2.4,t:3,vc:.6},YD.move),
  DEVN=YD.devName||(YD.device==='switch'?'Aiguillage':'Pont transbordeur'),
  DEVL=YD.devLabel||(YD.device==='switch'?'l\'aiguillage':'le pont transbordeur'); // nom au pupitre, nom dans une phrase
/* Pont transbordeur droit (device:'traverser') : chariot à deux rails droits parallèles, longs d'un train, posés sur la ligne
   droite du point de raccordement. Rail A = rail du circuit (zone de freinage), rail B = rail de garage (freins et pneus),
   écartés de YD.gap. Repère du chariot : origine au début du rail A au repos (abscisse R0), u le long du rail (corde R0→R1),
   v = (SW0.vx, SW0.vz) sens où le rail A sort du circuit (à l'opposé du garage). Décalage c du chariot : rail A en v=c,
   rail B en v=c-gap. Positions : P (c=0, rail A sur le circuit), G (c=gap, rail B sur le circuit), voie k (rail B face à la
   voie k, d'axe v=-d_k). Le train posé sur le rail B est emporté par le chariot : st 'garage', lane -1, g = avant du train
   en u. Voies droites, parallèles aux rails, de u=U_LANE à u=end ; le train y entre en marche avant et en sort en arrière. */
const R0=TRAV?S_HOLD-TLEN-(YD.pre!=null?YD.pre:.6):0,R1=TRAV?S_HOLD+(YD.post!=null?YD.post:.6):0,G_B=S_HOLD-R0,
  GAP=YD.gap||3.2,U_LANE=R1-R0+(YD.laneGap!=null?YD.laneGap:.8),S_PRE=R0-.4; // S_PRE : arrêt avant le chariot quand aucun rail n'est en ligne
const ANCH=YD.at==='brake'?S_HOLD:S_ST,SW_A=TRAV?R0:ANCH+YD.a,SW_B=TRAV?R1:ANCH+YD.b,SW_D=YD.slide||0;
const SW0=(()=>{const f=frameAt(SW_A,mkF()),l=Math.hypot(f.R.x,f.R.z)||1;let tx=f.T.x,tz=f.T.z;
  if(TRAV){const b=frameAt(SW_B,mkF()).p,d=Math.hypot(b.x-f.p.x,b.z-f.p.z);tx=(b.x-f.p.x)/d;tz=(b.z-f.p.z)/d;} // rail droit : corde du circuit
  return {x:f.p.x,z:f.p.z,tx,tz,vx:-YD.side*f.R.x/l,vz:-YD.side*f.R.z/l};})(); // (vx,vz) : sens de coulissement du chariot (à l'opposé du garage)
const LANES=TRAV?YD.lanes.map((ln,j)=>{
  const end=U_LANE+(ln.len||TLEN+1.4),path=[];for(let u=0;u<=end+.01;u+=.5)path.push({x:SW0.x+SW0.tx*u-SW0.vx*ln.d,z:SW0.z+SW0.tz*u-SW0.vz*ln.d,d:u});
  return {name:ln.name||'Voie '+(j+1),path,d:ln.d,dev:U_LANE,end,off:GAP-ln.d,cap:ln.cap||Math.max(1,Math.floor((end-U_LANE-TLEN)/GSTEP)+1)};
}):YD.lanes.map((ln,j)=>{
  const P0=[SW0.x,SW0.z],T0=[SW0.tx,SW0.tz],P=ln.pts,P1=P[0],k=ln.k||YD.k||3.6,path=[],raw=[];
  let md=[P[1][0]-P1[0],P[1][1]-P1[1]];const ml=Math.hypot(md[0],md[1]);md=[md[0]/ml,md[1]/ml];
  const c1=[P0[0]+T0[0]*k,P0[1]+T0[1]*k],c2=[P1[0]-md[0]*k,P1[1]-md[1]*k];
  for(let i=0;i<=36;i++){const t=i/36,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;raw.push([a*P0[0]+b*c1[0]+c*c2[0]+d*P1[0],a*P0[1]+b*c1[1]+c*c2[1]+d*P1[1]]);}
  for(let q=1;q<P.length;q++){const A=P[q-1],B=P[q],l=Math.hypot(B[0]-A[0],B[1]-A[1]);for(let d=.5;d<=l;d+=.5)raw.push([A[0]+(B[0]-A[0])*d/l,A[1]+(B[1]-A[1])*d/l]);if(q<P.length-1&&l%.5>.01)raw.push(B);}
  let acc=0,link=0;raw.forEach((q,i)=>{if(i)acc+=Math.hypot(q[0]-raw[i-1][0],q[1]-raw[i-1][1]);path.push({x:q[0],z:q[1],d:acc});if(i===36)link=acc;});
  const dev=YD.a+link,end=acc+YD.a; // abscisses g : sortie de l'appareil (début de la voie), butée
  return {name:ln.name||'Voie '+(j+1),path,link,dev,end,off:ln.off!=null?ln.off:SW_D*(j+1),cap:ln.cap||Math.max(1,Math.floor((end-dev-TLEN)/GSTEP)+1)};
});
/* Frein avant gare (SITE.preBrake:{back, len, name}) : zone de freinage de stockage juste avant l'entrée en gare, un train de long, avec pneus.
   Arrêt de l'avant du train à S_PSB = L - back (back : distance au début de la gare, s=0) ; zone de PSB_A à S_PSB. Le train qui quitte
   le frein final (ou le rail mobile du parcours) va s'y arrêter et y attend que la gare soit libre. */
const PSB=SITE.preBrake||null,S_PSB=PSB?L-(PSB.back!=null?PSB.back:1):L,PSB_A=PSB?S_PSB-(PSB.len||TLEN+.5):L;
if(PSB&&PSB_A<S_HOLD+1)throw new Error('SITE.preBrake : pas de place entre le frein final et la gare');
const PG=TRAV?LANES.length+1:-1; // position G du pont droit : rail B en ligne avec le circuit
/* Rail A escamotable (traverser + YD.retract) : le rail A n'est pas porté par le chariot ; il a deux positions, sur le circuit
   (G.ra.pos 0, v=0) ou retiré (1, v=RET, du côté opposé au garage). Le chariot ne porte que le rail B : positions G et voies 1…n
   (pas de P). Verrouillages : le rail A ne revient que si le rail B n'est pas en ligne ; le rail B ne vient en ligne que si le
   rail A est retiré. */
const RA=TRAV&&!!YD.retract,RET=RA?(YD.retract.d||GAP):0,RAN=RA&&YD.retract.name||'Rail mobile du parcours',RAS=RA&&YD.retract.short||'Rail parcours'; // nom complet (phrases), forme courte (plaques)
const OFF=[0].concat(LANES.map(l=>l.off),TRAV?[GAP]:[]),CMAX=Math.max(...OFF.map(Math.abs),RET);
const POS_ORDER=TRAV?(RA?[]:[0]).concat([PG],LANES.map((_,j)=>j+1)):OFF.map((_,p)=>p),posId=p=>p===PG?'G':p||'P';
const DEV0=RA?(YD.retract.rest||1):0; // position du chariot au départ (rail A escamotable : face à une voie)
function gFrame(j,u,o){
  const GP=LANES[j].path;u=clamp(u,0,GP[GP.length-1].d);let i=1;while(i<GP.length-1&&GP[i].d<u)i++;
  const a=GP[i-1],b=GP[i],k=(u-a.d)/((b.d-a.d)||1),l=Math.hypot(b.x-a.x,b.z-a.z)||1;
  o.p.set(lerp(a.x,b.x,k),ST_Y,lerp(a.z,b.z,k));o.T.set((b.x-a.x)/l,0,(b.z-a.z)/l);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
// État de l'appareil : G.dev={pos, to, k, d} (position quittée, position visée, avancement 0…1, durée du déplacement)
const devMoving=()=>G.dev.pos!==G.dev.to, devOff=()=>devMoving()||G.dev.pos!==0, devOn=j=>!devMoving()&&G.dev.pos===j+1;
const devC=()=>lerp(OFF[G.dev.pos],OFF[G.dev.to],G.dev.k), devShown=()=>G.dev.to||G.dev.pos||1;
const raMoving=()=>RA&&G.ra.pos!==G.ra.to, raIn=()=>!RA||(!raMoving()&&G.ra.pos===0), raOut=()=>RA&&!raMoving()&&G.ra.pos===1;
const raC=()=>RA?lerp(G.ra.pos*RET,G.ra.to*RET,G.ra.k):devC(); // décalage du rail A le long de (SW0.vx, SW0.vz)
const inLine=()=>RA?raIn()||(raOut()&&!devMoving()&&G.dev.pos===PG):!devMoving()&&(G.dev.pos===0||G.dev.pos===PG); // pont droit : un rail (A ou B) raccorde le circuit
const posName=p=>p===PG?'G (rail de garage sur le circuit)':p?'voie '+p+' ('+LANES[p-1].name+')':'P (circuit)';
const onCar=o=>TRAV&&o.st==='garage'&&o.g-TLEN<U_LANE-.01; // train (en partie) sur le chariot du pont droit
function trFrame(t,k,o){ // pont droit : voiture k d'un train sur le chariot ou sur une voie
  const u=t.g-(k+.5)*CAR,v=t.lane>=0&&u>=U_LANE-.3?-LANES[t.lane].d:devC()-GAP;
  o.p.set(SW0.x+SW0.tx*u+SW0.vx*v,ST_Y,SW0.z+SW0.tz*u+SW0.vz*v);o.T.set(SW0.tx,0,SW0.tz);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
const raLock=()=>trains.find(onRail); // rail A : immobile tant qu'un train y est, y roule ou s'en approche
const nearDev=o=>TRAV?onCar(o):o.st==='garage'&&o.g-TLEN<LANES[o.lane].dev+.5;   // train sur le circuit, la liaison ou l'appareil
const yardBusy=o=>o.st==='garage'&&(nearDev(o)||(o.mv<0&&devOn(o.lane))); // train qui occupe ou va occuper le point de raccordement
const onRail=o=>o.st==='run'&&o.s>R0-2.5&&o.s-TLEN<R1&&!(o.v===0&&o.s<R0); // pont droit : train du circuit sur le chariot ou qui y roule
const devLock=()=>TRAV?trains.find(o=>(onRail(o)&&!(RA&&raIn()&&G.dev.pos!==PG)&&!(atAnchor(o)&&G.dev.pos===PG&&!count(o)))||(onCar(o)&&(o.mv||o.lane>=0)))
  :trains.find(o=>nearDev(o)||(o.st==='run'&&((o.s>ANCH+.2&&o.s<SW_B+TLEN+1)||(YD.at==='brake'&&o.entering))));
// Quai : une travée et un portillon par wagon
const BAYS=[];for(let k=0;k<NCARS;k++){const f=frameAt(S_ST-(k+.5)*CAR,mkF());BAYS.push({x:f.p.x,z:f.p.z,rx:f.R.x*LS,rz:f.R.z*LS,tx:f.T.x,tz:f.T.z});} // (rx,rz) pointe vers le quai d'embarquement
const slotPos=i=>{const b=BAYS[Math.floor(i/CSEATS)],d=3.45+(i%CSEATS)*.8;return [b.x+b.rx*d,0,b.z+b.rz*d];}; // une place d'attente par siège, en file derrière le portillon
// Couloirs des visiteurs sur les quais (jamais en ligne droite à travers la gare, la voie ou les portillons) :
//  embarquement : file → SITE.board.via → couloir d'attente (SITE.board.walk m de la voie, derrière les portillons) → place d'attente de la travée → (portillon ouvert seulement) → siège ;
//  débarquement : siège → quai de débarquement, côté opposé aux portillons (couloir à SITE.plat.walkU m de la voie, par défaut au milieu du quai) → travée de la porte → SITE.exit.door → SITE.exit.path.
const PLT=Object.assign({load:7.9,exit:0,back:.1,front:1.6},SITE.plat),ULAT=-(PLT.walkU||(PLT.exit?(1.3+PLT.exit)/2:1.8));
const bayAt=(k,lat,du)=>{const b=BAYS[k];return [b.x+b.rx*lat+b.tx*(du||0),0,b.z+b.rz*lat+b.tz*(du||0)];};
const DOOR=SITE.exit.door,DOORK=DOOR?BAYS.reduce((m,b,k)=>Math.hypot(b.x-DOOR[0],b.z-DOOR[1])<Math.hypot(BAYS[m].x-DOOR[0],BAYS[m].z-DOOR[1])?k:m,0):0;
function alightWalk(k,x,z){ // du siège au quai de débarquement, le long des travées jusqu'à la porte
  const pts=[[x,0,z],bayAt(k,ULAT)],st=k<DOORK?-1:1;for(let j=k;j!==DOORK;j-=st)pts.push(bayAt(j-st,ULAT));
  if(DOOR)pts.push([DOOR[0],0,DOOR[1]]);return pts;
}
const WALKS=[[bayAt(DOORK,ULAT),DOOR||bayAt(DOORK,ULAT)],[bayAt(0,ULAT),bayAt(NCARS-1,ULAT)],[bayAt(0,SITE.board.walk),bayAt(NCARS-1,SITE.board.walk)]]; // couloirs de quai (contrôle offpath)
// Deux opérateurs de quai vérifient les lapbars (moitié avant, moitié arrière) puis valident chacun sur un bouton
const opHome=i=>{const b=i?BAYS[NCARS-1]:BAYS[0],e=i?-1:1;return [b.x+b.tx*e*1.7+b.rx*1.95,b.z+b.tz*e*1.7+b.rz*1.95];};
const OPS=[0,1].map(i=>{const h=opHome(i);return {i,x:h[0],z:h[1],ok:false,st:'idle',k:0,w:0,mv:false};});
function startCheck(t){t.phase='check';for(const o of OPS){o.ok=false;o.st='go';o.k=o.i?NCARS-1:0;o.w=0;}}
function resetOps(){for(const o of OPS){o.ok=false;if(o.st!=='idle')o.st='back';}}
function stepOps(dt){
  for(const o of OPS){
    o.mv=false;if(o.st==='idle')continue;
    if(o.st==='press'){o.w-=dt;if(o.w<=0){o.ok=true;o.st='idle';}continue;}
    const b=BAYS[clamp(o.k,0,NCARS-1)],tg=o.st==='go'?[b.x+b.rx*1.95,b.z+b.rz*1.95]:opHome(o.i),dx=tg[0]-o.x,dz=tg[1]-o.z,d=Math.hypot(dx,dz),sp=3*dt;
    if(d>sp){o.x+=dx/d*sp;o.z+=dz/d*sp;o.mv=true;continue;}
    o.x=tg[0];o.z=tg[1];
    if(o.st==='go'){o.w+=dt;if(o.w>=.3){o.w=0;o.k+=o.i?-1:1;if(o.i?o.k<NCARS/2:o.k>=NCARS/2)o.st='ret';}}
    else if(o.st==='ret'){o.st='press';o.w=.45;}
    else o.st='idle';
  }
}
const zoneOf=s=>s<S_ST?'station':s<S_LIFT0?'prelift':s<S_REL?'lift':s<S_BRK?'course':'brake';

/* ══════════ COMMANDE PAR ZONES (docs/manoeuvres.md, « Principe de commande ») ══════════
   Le joueur commande des zones, jamais des trains : St (gare), Lift, B1…Bn (freins de bloc), Fin (frein final), RA / RB (pont droit :
   rail A du circuit, rail B du chariot), L1…Ln (voies de garage). Chaque zone a des freins (G.zk[z] = serrés) et, selon SITE.zones,
   des moteurs (pneus) Avancer / Reculer / Arrêt. Les zones de freinage B*, Fin, RA sont en AUTO par défaut (cantonnement) ;
   le joueur peut passer chacune en MANU (G.zm[z]) : ses freins et moteurs obéissent alors au pupitre. Gare, rail B et voies : toujours manuels.
   SITE.zones : { <zone ou groupe B / L> : {brake, drive} } ; défauts : freins partout, moteurs partout sauf freins de bloc (ESTIMÉ, à confirmer). */
const ZCFG=z=>Object.assign({brake:true,drive:!/^B\d/.test(z)},SITE.zones&&SITE.zones[z.replace(/\d+$/,'')],SITE.zones&&SITE.zones[z]);
const ZONES=[{id:'St',name:'Gare',sec:'st'},{id:'Lift',name:'Lift',sec:'lift'}]
  .concat(BLK.map((_,i)=>({id:'B'+(i+1),name:'Bloc '+(i+1),sec:'brk',auto:true})),[{id:'Fin',name:'Frein final',sec:'brk',auto:true}],
    TRAV?[{id:'RA',name:RA?RAS:'Rail du parcours',sec:'brk',auto:true},{id:'RB',name:'Rail du chariot',sec:'brk'}]:[],
    PSB?[{id:'Pre',name:PSB.name||'Frein avant gare',sec:'brk',auto:true}]:[],
    LANES.map((l,j)=>({id:'L'+(j+1),name:LANES.length>1?'Voie '+(j+1):l.name,sec:'gar'})))
  .map(Z=>Z.id==='Lift'?Z:Object.assign(Z,ZCFG(Z.id),Z.id==='St'?{brake:false}:{},Z.sec==='gar'?{fwd:false}:{})); // voies : pas d'Avancer (l'entrée est poussée par la zone porteuse CARR), Reculer et Arrêt seulement
const CARR=TRAV?'RB':YD.at==='station'?'St':'Fin'; // zone porteuse : pousse le train dans la voie en face de l'appareil (Avancer) // gare : pas de bouton de frein, freins liés au départ (stHeld)
const stHeld=()=>trains.some(t=>t.st==='station'&&!t.depReq); // freins de gare : serrés automatiquement tant qu'un train est à quai, relâchés par la seule séquence Départ
const zName=z=>(ZONES.find(o=>o.id===z)||{}).name||z;
const isAutoZ=z=>/^(B\d+|Fin|RA|Pre)$/.test(z);
const zK=z=>isAutoZ(z)?!!(G.zm[z]&&G.zk[z]):!!G.zk[z]; // freins serrés au pupitre (zone de freinage : seulement en MANU)
const bIn=()=>TRAV&&!devMoving()&&G.dev.pos===PG&&(!RA||raOut()); // pont droit : rail B (garage) en ligne avec le circuit
const circIn=()=>TRAV&&(RA?raIn():!devMoving()&&G.dev.pos===0); // pont droit : rail A (circuit) en ligne
function tZone(t){ // zone où se trouve un train
  if(t.st==='station')return 'St';
  if(t.st==='garage')return TRAV&&(t.lane<0||onCar(t))?'RB':'L'+(t.lane+1);
  const z=zoneOf(t.s);
  if(z==='station')return 'St';
  if(z==='lift'||z==='prelift')return 'Lift';
  if(z==='course'){for(let i=0;i<BLK.length;i++)if(t.s>BLK[i]-10&&t.s<BLK[i]+.6)return 'B'+(i+1);return '';}
  if(PSB&&t.s>PSB_A)return 'Pre';
  if(TRAV&&t.s>R0+.5)return bIn()?'RB':'RA';
  return 'Fin';
}
const zT=z=>trains.filter(t=>tZone(t)===z);
