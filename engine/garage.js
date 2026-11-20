'use strict';
/* Gare de triage générique (SITE.yard) — règles communes : docs/manoeuvres.md.
   Point de raccordement sur le circuit (zone d'attente quelconque : gare, frein de bloc, frein final, frein avant gare ; issue #36), appareil de voie (aiguillage à 2 positions ou pont transbordeur
   à N positions), voies de garage. Chaque voie k a son propre chemin : circuit jusqu'à SW_A, tronçon de transfert (courbe
   en S de SW_A jusqu'au début de la voie), puis la voie. Un train hors circuit (st==='garage') a une voie t.lane et une
   abscisse t.g (avant du train, 0 = point de raccordement), t.mv = +1 avance, -1 recule, 0 arrêté.
   L'appareil est un chariot coulissant le long de (SW0.vx, SW0.vz) qui porte le tronçon du circuit et le tronçon de
   transfert : position P = décalage 0, voie k = décalage OFF[k] (le tronçon de transfert de la voie k est alors en place). */
/* Marge de garage (propriétaire, issue #11) : un train garé s'arrête à BUF m du butoir et à BUF m du train garé devant lui.
   BUF = SITE.yard.buffer, défaut 2 m : ESTIMÉ (pas de relevé). Voie trop courte : la marge est réduite à ce qui reste (le train doit avoir dégagé l'appareil). */
const YD=SITE.yard,TRAV=YD.device==='traverser',BUF=YD.buffer!=null?YD.buffer:2,GSTEP=TLEN+BUF,MV=Object.assign({v:2.4,t:3,vc:.6},YD.move),
  DEVN=YD.devName||(YD.device==='switch'?'Aiguillage':'Pont transbordeur'),
  DEVL=YD.devLabel||(YD.device==='switch'?'l\'aiguillage':'le pont transbordeur'); // nom au pupitre, nom dans une phrase
/* Pont transbordeur droit (device:'traverser') : chariot à deux rails droits parallèles, longs d'un train, posés sur la ligne
   droite du point de raccordement. Rail A = rail du circuit (zone de freinage), rail B = rail de garage (freins et pneus),
   écartés de YD.gap. Repère du chariot : origine au début du rail A au repos (abscisse R0), u le long du rail (corde R0→R1),
   v = (SW0.vx, SW0.vz) sens où le rail A sort du circuit (à l'opposé du garage). Décalage c du chariot : rail A en v=c,
   rail B en v=c-gap. Positions : P (c=0, rail A sur le circuit), G (c=gap, rail B sur le circuit), voie k (rail B face à la
   voie k, d'axe v=-d_k). Le train posé sur le rail B est emporté par le chariot : st 'garage', lane -1, g = avant du train
   en u. Voies droites, parallèles aux rails, de u=U_LANE à u=end ; le train y entre en marche avant et en sort en arrière. */
/* Pont droit à rail unique (traverser + YD.single, OzIris) : le chariot porte UN rail, qui EST le tronçon du circuit (zone de freinage RB,
   « Rail du pont ») : P = rail en ligne avec le circuit, 1…n = le même rail face à la voie k (circuit alors interrompu). Pas de rail B
   distinct ni de position G : GAP = 0, le train arrêté à vide sur le rail en P est emporté par le chariot vers une voie. */
const SG=TRAV&&!!YD.single;
// Rail du pont : de R0 à R1 ; R0 = début du rail de transfert OSM (repère tr0) si yard.pre n'est pas donné et que le rail est assez long, sinon un train + pre.
// S_PRE : arrêt avant le chariot (aucun rail en ligne, frein final serré, rail occupé) = fin du frein final OSM (repère fin) si elle est avant le pont.
const R0=TRAV?(YD.pre==null&&TAG.tr0!=null&&TAG.tr0<S_HOLD-TLEN?TAG.tr0:S_HOLD-TLEN-(YD.pre!=null?YD.pre:.6)):0,R1=TRAV?S_HOLD+(YD.post!=null?YD.post:.6):0,G_B=S_HOLD-R0,
  GAP=SG?0:YD.gap||3.2,U_LANE=R1-R0+(YD.laneGap!=null?YD.laneGap:.8),S_PRE=TAG.fin!=null&&TAG.fin<R0-.4&&TAG.fin>S_BRK?TAG.fin:R0-.4; // S_PRE : arrêt avant le chariot quand aucun rail n'est en ligne
/* yard.s : le tronçon mobile (rotatif) a deux faces, l'une porte le tronçon droit du circuit, l'autre un S vers la voie de garage (courbe de Bézier, première partie de la voie). Aiguillage EN AMONT de la zone de raccordement (yard.back, appareil à aiguillage seulement ; gare, ou toute zone de freinage dont les moteurs ont la marche arrière,
   SITE.zones.<zone>.drive:true, issue #38) : le train entre dans la voie de garage en MARCHE ARRIÈRE depuis cette zone, la voie se détache du circuit en amont.
   yard.a / yard.b = distances (m), mesurées en remontant le circuit depuis le point d'arrêt de l'avant du train dans la zone (ANCH), du bord de l'appareil
   le plus proche de la gare (a) et du bord le plus éloigné, la pointe où la voie se détache (b). La logique du moteur reste celle de l'aiguillage de Zeus (abscisse g de l'avant du
   train = recul depuis la gare) ; seule la géométrie change (carFrame) : le wagon k est à q=(k+.5)·CAR+g en amont de l'arrêt, orienté vers l'avant du circuit ; la voie de garage
   recopie d'abord le circuit sur la longueur de l'appareil (b−a), puis suit yard.lanes[].pts (le premier point est remplacé par la pointe).
   yard.rotary : appareil rotatif (un rail qui tourne sur lui-même autour de l'axe du tube) au lieu du tronçon coulissant : vue du dessus, le tronçon se resserre puis s'ouvre (largeur ∝ cos θ). */
/* Frein avant gare (SITE.preBrake:{back, len, name}) : zone de freinage de stockage juste avant l'entrée en gare, un train de long, avec pneus.
   Arrêt de l'avant du train à S_PSB = L - back (back : distance au début de la gare, s=0) ; zone de PSB_A à S_PSB. Le train qui quitte
   le frein final (ou le rail mobile du parcours) va s'y arrêter et y attend que la gare soit libre. */
// Repères OSM pre0/pre1 (tools/make_site.py) : utilisés si back / len ne sont pas donnés.
const PSB=SITE.preBrake||null,S_PSB=PSB?(PSB.back==null&&TAG.pre1!=null?Math.min(TAG.pre1,L-.5):L-(PSB.back!=null?PSB.back:1)):L,
  PSB_A=PSB?(PSB.len==null&&TAG.pre0!=null&&TAG.pre0<S_PSB-TLEN?TAG.pre0:S_PSB-(PSB.len||TLEN+.5)):L;
if(PSB&&PSB_A<S_HOLD+1)throw new Error('SITE.preBrake : pas de place entre le frein final et la gare');
/* Zones toutes équivalentes (propriétaire, issue #36) : la gare est une zone d'attente comme les autres ; entre deux zones d'attente consécutives, un canton ordinaire ;
   le garage est branché sur une zone d'attente quelconque du circuit, YZ = SITE.yard.at : 'St' (gare), 'B<k>' (frein de bloc k), 'Fin' (frein final), 'Pre' (frein avant gare) ;
   alias compatibles 'station' = 'St', 'brake' = 'Fin'. ANCH = point d'arrêt de l'avant du train dans cette zone (point de raccordement). « Frein final » n'est plus qu'un nom.
   Pont transbordeur droit : seulement sur le frein final (sa géométrie suit le rail de transfert OSM, S_HOLD). Aiguillage en amont (yard.back) : gare ou zone à marche arrière (contrôle après ZONES). */
const YZ=(a=>a==null||a==='station'?'St':a==='brake'?'Fin':String(a))(YD.at);
if(!/^(St|Fin|Pre|B\d+)$/.test(YZ)||(YZ==='Pre'&&!PSB)||(YZ[0]==='B'&&!(+YZ.slice(1)>=1&&+YZ.slice(1)<=BLK.length)))throw new Error('SITE.yard.at : zone d\'attente inconnue « '+YD.at+' » (St, B1…B'+BLK.length+', Fin'+(PSB?', Pre':'')+', ou les alias station / brake)');
const LBK=!TRAV&&!!YD.back,ROT=!TRAV&&!!YD.rotary;
if(TRAV&&YZ!=='Fin')throw new Error('SITE.yard : pont transbordeur droit seulement sur le frein final (at:\'brake\')');
const zStop=z=>z==='St'?S_ST:z==='Fin'?S_HOLD:z==='Pre'?S_PSB:BLK[+z.slice(1)-1]; // point d'arrêt de l'avant du train dans une zone d'attente
const ANCH=zStop(YZ),LBKW=LBK&&(YZ==='St'||ANCH<YD.b)?L:0,SW_A=TRAV?R0:LBK?ANCH-YD.b+LBKW:ANCH+YD.a,SW_B=TRAV?R1:LBK?ANCH-YD.a+LBKW:ANCH+YD.b,SW_D=YD.slide||0;
const SW0=(()=>{const f=frameAt(SW_A,mkF()),l=Math.hypot(f.R.x,f.R.z)||1;let tx=f.T.x,tz=f.T.z;
  if(TRAV){const b=frameAt(SW_B,mkF()).p,d=Math.hypot(b.x-f.p.x,b.z-f.p.z);tx=(b.x-f.p.x)/d;tz=(b.z-f.p.z)/d;} // rail droit : corde du circuit
  return {x:f.p.x,z:f.p.z,tx,tz,vx:-YD.side*f.R.x/l,vz:-YD.side*f.R.z/l};})(); // (vx,vz) : sens de coulissement du chariot (à l'opposé du garage)
/* Voies en arrière du chariot (traverser + YD.rev) : les voies partent du bord amont du chariot, parallèles au circuit, à contre-sens ;
   le train y entre en marche ARRIÈRE et en ressort en marche avant. Le moteur garde ses abscisses g (g croissant = vers le fond de la
   voie) ; seule la géométrie est retournée : l'avant du train est en u = 2·G_B − g (repère du chariot), son orientation ne change pas.
   laneU(g) : abscisse u (repère du chariot) d'un point de voie d'abscisse g, pour le dessin des voies fixes. */
const LREV=TRAV&&!!YD.rev,laneU=g=>LREV?2*G_B-TLEN-g:g;
const LANES=TRAV?YD.lanes.map((ln,j)=>{
  const end=U_LANE+(ln.len||TLEN+BUF+.2),path=[];for(let g=0;g<=end+.01;g+=.5){const u=laneU(g);path.push({x:SW0.x+SW0.tx*u-SW0.vx*ln.d,z:SW0.z+SW0.tz*u-SW0.vz*ln.d,d:g});}
  return {name:ln.name||'Voie '+(j+1),path,d:ln.d,dev:U_LANE,end,off:GAP-ln.d,cap:ln.cap||Math.max(1,Math.floor((end-U_LANE-TLEN)/GSTEP)+1)};
}):LBK?YD.lanes.map((ln,j)=>{
  const path=[],P=ln.pts;let acc=0,prev=null,link=YD.b-YD.a;
  const push=(x,z)=>{if(prev)acc+=Math.hypot(x-prev[0],z-prev[1]);path.push({x,z,d:acc});prev=[x,z];};
  let A;
  if(YD.s){ // tronçon mobile en S (yard.s) : courbe de Bézier du circuit (bord côté gare, tangente = marche arrière) jusqu'au premier point de la voie (P[0], tangente vers P[1])
    const fN=frameAt(SW_B,mkF()),N=[fN.p.x,fN.p.z],Tb=[-fN.T.x,-fN.T.z],F=P[0],md=[P[1][0]-F[0],P[1][1]-F[1]],ml=Math.hypot(md[0],md[1]);md[0]/=ml;md[1]/=ml;
    const ch=Math.hypot(F[0]-N[0],F[1]-N[1]),k=(ln.k||.4)*ch,c1=[N[0]+Tb[0]*k,N[1]+Tb[1]*k],c2=[F[0]-md[0]*k,F[1]-md[1]*k],raw=[];
    for(let i=0;i<=60;i++){const t=i/60,u=1-t,w=[u*u*u*N[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*F[0],u*u*u*N[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*F[1]];raw.push(w);}
    let ra=0;const cum=[0];for(let i=1;i<raw.length;i++){ra+=Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]);cum.push(ra);}
    let m=0;for(let d=0;d<=ra+.001;d+=.5){while(m<cum.length-2&&cum[m+1]<d)m++;const f=(d-cum[m])/((cum[m+1]-cum[m])||1);push(raw[m][0]+(raw[m+1][0]-raw[m][0])*f,raw[m][1]+(raw[m+1][1]-raw[m][1])*f);}
    push(F[0],F[1]);link=acc;A=F;
    if(Math.abs(link-(YD.b-YD.a))>.6)console.warn('SITE.yard.s : longueur de l\'appareil '+link.toFixed(2)+' m ≠ b−a = '+(YD.b-YD.a).toFixed(2)+' m');
  }else{
    for(let d=0;d<=link+.001;d+=.5){const f=frameAt(SW_B-d,mkF());push(f.p.x,f.p.z);} // recopie du circuit, du bord côté gare à la pointe
    A=[SW0.x,SW0.z];}
  for(let q=1;q<P.length;q++){const B=P[q],l=Math.hypot(B[0]-A[0],B[1]-A[1]);for(let d=.5;d<=l;d+=.5)push(A[0]+(B[0]-A[0])*d/l,A[1]+(B[1]-A[1])*d/l);if(l%.5>.01)push(B[0],B[1]);A=B;}
  const end=YD.a+acc-TLEN,dev=YD.a+link-2*TLEN; // butée : arrière du train au bout de la voie ; appareil franchi quand l'arrière a dépassé la pointe
  return {name:ln.name||'Voie '+(j+1),path,link,dev,end,off:ln.off!=null?ln.off:SW_D*(j+1),cap:ln.cap||Math.max(1,Math.floor((end-dev-TLEN)/GSTEP)+1)};
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
// Point d'arrêt du train de tête dans chaque voie (avant du train) : BUF avant le butoir, sinon au moins 0,2 m au-delà de l'appareil ; capacité recalculée avec ce point.
LANES.forEach((l,j)=>{l.stop=Math.max(Math.min(l.end,l.dev+TLEN+.2),l.end-BUF);if(!YD.lanes[j].cap)l.cap=Math.max(1,Math.floor((l.stop-l.dev-TLEN)/GSTEP)+1);});
const PG=TRAV&&!SG?LANES.length+1:-1,PC=SG?0:PG; // position G du pont droit : rail B en ligne avec le circuit ; PC : position où le rail porteur raccorde le circuit (P si rail unique)
/* Rail A escamotable (traverser + YD.retract) : le rail A n'est pas porté par le chariot ; il a deux positions, sur le circuit
   (G.ra.pos 0, v=0) ou retiré (1, v=RET, du côté opposé au garage). Le chariot ne porte que le rail B : positions G et voies 1…n
   (pas de P). Verrouillages : le rail A ne revient que si le rail B n'est pas en ligne ; le rail B ne vient en ligne que si le
   rail A est retiré. */
const RA=TRAV&&!!YD.retract,RET=RA?(YD.retract.d||GAP):0,RAN=RA&&YD.retract.name||'Rail mobile du parcours',RAS=RA&&YD.retract.short||'Rail parcours'; // nom complet (phrases), forme courte (plaques)
const OFF=[0].concat(LANES.map(l=>l.off),TRAV&&!SG?[GAP]:[]),CMAX=Math.max(...OFF.map(Math.abs),RET);
const POS_ORDER=TRAV?(RA?[]:[0]).concat(SG?[]:[PG],LANES.map((_,j)=>j+1)):OFF.map((_,p)=>p),posId=p=>p===PG?'G':p||'P';
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
  const u=LREV?2*G_B-t.g-(k+.5)*CAR:t.g-(k+.5)*CAR,v=t.lane>=0&&(LREV?u<=laneU(U_LANE)+.3:u>=U_LANE-.3)?-LANES[t.lane].d:devC()-GAP;
  o.p.set(SW0.x+SW0.tx*u+SW0.vx*v,ST_Y,SW0.z+SW0.tz*u+SW0.vz*v);o.T.set(SW0.tx,0,SW0.tz);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
/* Règle de retenue avant l'appareil (propriétaire, 2026-11-15 : « le train peut partir de la gare si l'aiguillage est activé, tant qu'une zone de frein peut le mettre
   en attente avant » ; issue #36 : règle uniforme, quelle que soit la zone) : appareil hors de P, ou manœuvre de garage en cours, la DERNIÈRE zone d'attente avant
   l'appareil (HOLD_Z) retient le train. Candidates : la zone de raccordement YZ, puis chaque zone d'attente (WZ, ordre du circuit) dont le point d'arrêt est après celui
   de YZ (gare : après que le train l'a quittée, ANCH + TLEN) et à plus de 0,5 m avant l'appareil (SW_A). Si HOLD_Z est la gare, « retenir » = refuser le départ
   (blockReason) ; sinon la zone garde le train freiné (frein de bloc : cantonnement, frein final / frein avant gare : leur attente). Pont transbordeur droit : le
   train est retenu avant le chariot quand aucun rail n'est en ligne (S_PRE, circIn), HOLD_Z = null. DEV_HOLD : indice du frein de bloc HOLD_Z, sinon -1 (compatibilité). */
const WZ=['St'].concat(BLK.map((_,i)=>'B'+(i+1)),['Fin'],PSB?['Pre']:[]); // zones d'attente du circuit, dans l'ordre de marche
// distances mesurées vers l'aval depuis ANCH (dnS) : aiguillage en amont (yard.back), l'appareil est un tour de circuit plus loin, la zone de raccordement ne retient donc pas (issue #38)
const dnS=(a,b)=>(((b-a)%L)+L)%L,HOLD_Z0=TRAV?null:WZ.reduce((h,z)=>{const d=dnS(ANCH,zStop(z));return z!==YZ&&d>(YZ==='St'?TLEN:0)&&d<dnS(ANCH,SW_A)-.5&&(h===YZ||d>dnS(ANCH,zStop(h)))?z:h;},YZ);const HOLD_Z=HOLD_Z0===YZ&&LBK&&YZ!=='St'?'St':HOLD_Z0,HOLD_S=HOLD_Z?zStop(HOLD_Z):null;
const DEV_HOLD=HOLD_Z&&HOLD_Z[0]==='B'?+HOLD_Z.slice(1)-1:-1;
const devHoldOn=()=>!!HOLD_Z&&(devOff()||trains.some(o=>yardBusy(o))),devHoldIn=z=>z===HOLD_Z&&devHoldOn(),devHoldAt=i=>devHoldIn('B'+(i+1));
const raLock=()=>trains.find(onRail); // rail A : immobile tant qu'un train y est, y roule ou s'en approche
const nearDev=o=>TRAV?onCar(o):o.st==='garage'&&o.g-TLEN<LANES[o.lane].dev+.5;   // train sur le circuit, la liaison ou l'appareil
const yardBusy=o=>o.st==='garage'&&(nearDev(o)||(o.mv<0&&devOn(o.lane))); // train qui occupe ou va occuper le point de raccordement
/* Cantonnement et garage (propriétaire, 2026-11-17 : « la présence d'un train sur le chariot doit bloquer les sections précédentes uniquement si le chariot est sur le parcours ») :
   pont droit, le train porté (ou qui entre / sort d'une voie) ne compte dans le dernier canton que si le rail porteur est en place sur le circuit (PC : G, ou P pour un rail unique).
   Chariot face à une voie ou en mouvement : il ne bloque pas ; le train qui arrive est alors retenu au frein final avant le pont (aucun rail en ligne, circIn), jamais dans le vide. */
// Canton qui mène à la zone de raccordement (issue #36) : se termine à son point d'arrêt (frein de bloc k : canton du frein k-1 ou du lift), ou à la fin du circuit
// (frein final, frein avant gare : dernier canton, blkEnd = L). Un train de garage qui occupe ou va occuper le raccordement (yardBusy) occupe CE canton (b = fin du canton testé, absent : ce canton) ; gare : stationBusy.
const Y_CEND=YZ==='St'?null:YZ[0]==='B'?ANCH:L;
const yardBlocks=(self,b)=>Y_CEND!=null&&(b==null||(Y_CEND>=L?b>=L:Math.abs(b-Y_CEND)<.01))&&(!TRAV||(!devMoving()&&G.dev.pos===PC))&&trains.some(o=>o!==self&&yardBusy(o));
const onRail=o=>o.st==='run'&&o.s>R0-2.5&&o.s-TLEN<R1&&!(o.v===0&&o.s<R0); // pont droit : train du circuit sur le chariot ou qui y roule
const devLock=()=>TRAV?trains.find(o=>(onRail(o)&&!(RA&&raIn()&&G.dev.pos!==PG)&&!(atAnchor(o)&&G.dev.pos===PC&&!count(o)))||(onCar(o)&&(o.mv||o.lane>=0)))
  :trains.find(o=>nearDev(o)||(o.st==='run'&&((o.s>(LBK?SW_A-.5:ANCH+.2)&&o.s<SW_B+TLEN+1)||((HOLD_Z==='Fin'||HOLD_Z==='Pre')&&(o.entering||o.toPre))||(HOLD_Z&&(HOLD_Z!=='St'||LBK&&YZ!=='St')&&dnS(HOLD_S,o.s)>.05&&dnS(HOLD_S,o.s)<dnS(HOLD_S,SW_A))))); // train qui a passé le frein de retenue et se dirige vers l'appareil
// Quai : une travée et un portillon par wagon
const BAYS=[];for(let k=0;k<NCARS;k++){const f=frameAt(S_ST-(k+.5)*CAR,mkF());BAYS.push({x:f.p.x,z:f.p.z,rx:f.R.x*LS,rz:f.R.z*LS,tx:f.T.x,tz:f.T.z});} // (rx,rz) pointe vers le quai d'embarquement
// Bord de quai collé au gabarit des wagons (propriétaire, 2026-11-16, lot 6, générique : aucun vide où un passager pourrait tomber) : PEDGE = demi-largeur du wagon
// (SITE.car.w) + roues qui débordent (bois .2 m, acier .12 m) ou rebord de la gouttière de gare d'un bob (BOB_RIM), + 8 cm de jeu ; SITE.plat.edge pour forcer.
// Les portillons sont rapprochés du bord : PGATE = PEDGE + SITE.plat.gateGap (défaut .8 m, ESTIMÉ : couloir des opérateurs, qui y marchent à POPL) ; places d'attente derrière.
// Bob (propriétaire, issue #6) : dans la gare la gouttière est rétrécie au gabarit du wagon (engine/render.js TRF), demi-largeur = SITE.car.w/2 + BOB_RIM ;
// le quai suit : PEDGE = demi-largeur du wagon + rebord + 8 cm. BOB_RIM = 0,10 m, ESTIMÉ (épaisseur du rebord de la gouttière de gare, non mesurée).
const BOB_RIM=.1;
const PLT0=SITE.plat||{};
const PEDGE=(SITE.plat&&SITE.plat.edge)||+((SITE.car.w||1.24)/2+(SITE.kind==='wood'?.2:SITE.kind==='steel'?.12:SITE.kind==='bob'?BOB_RIM:0)+.08).toFixed(2);
const PGATE=+(PEDGE+((SITE.plat&&SITE.plat.gateGap)||.8)).toFixed(2),POPL=(PEDGE+PGATE)/2;
// Portillons : un par wagon (défaut) ou un par rangée de places (SITE.plat.gatesPer:'row', Goudurix, propriétaire, lot 6) ; deux visiteurs par portillon pour des rangées de 2.
// GUNITS[u] = {k : wagon, w : rangée, c : centre le long du wagon (m, vers l'avant), h : demi-longueur} ; seatUnit(i) = {u : portillon, j : rang dans sa file d'attente}.
const GPR=SITE.plat&&SITE.plat.gatesPer==='row'?S_ROWS:1,NGATES=NCARS*GPR,GUNITS=[];
for(let k=0;k<NCARS;k++)for(let w=0;w<GPR;w++)GUNITS.push({k,w,c:CAR/2-(w+.5)*CAR/GPR,h:CAR/GPR/2});
const seatUnit=i=>{const k=Math.floor(i/CSEATS),r=i%CSEATS;return GPR>1?{u:k*GPR+Math.floor(r/S_COLS),j:r%S_COLS}:{u:k,j:r};};
const unitAt=(u,lat)=>{const g=GUNITS[u],b=BAYS[g.k];return [b.x+b.tx*g.c+b.rx*lat,b.z+b.tz*g.c+b.rz*lat];};
// Toit de gare trop petit pour ses quais (bâtiment OSM qui ne couvre que la voie) : si, au milieu du train, un quai (plat.load / plat.exit) sort de plus de 0,8 m de
// SITE.stationPoly, le bâtiment de gare est agrandi à l'enveloppe convexe du polygone et des quais (+0,3 m) : sol, toit, effacement et contrôle offpath suivent. ESTIMÉ.
const STATION_GROW=(()=>{const P=SITE.stationPoly;if(!P||P.length<3)return null;const Q=Object.assign({load:7.9,exit:0,back:.1,front:1.6},SITE.plat),a=BAYS[NCARS-1],b=BAYS[0],m=BAYS[NCARS>>1],h=CAR/2,C=[],M=[];
  // quais sur toute leur longueur (arrière du dernier wagon + plat.back, avant du premier + plat.front) : le toit couvre TOUT le quai (propriétaire, Tonnerre 2 Zeus, lot 6)
  for(const l of [Q.load+.3,-(Q.exit?Q.exit+.3:1.6)]){C.push([a.x-a.tx*(h+Q.back)+a.rx*l,a.z-a.tz*(h+Q.back)+a.rz*l],[b.x+b.tx*Math.max(h,Q.front)+b.rx*l,b.z+b.tz*Math.max(h,Q.front)+b.rz*l]);M.push([m.x+m.rx*l,m.z+m.rz*l]);}
  const pin=(x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const dE=(x,z)=>{let m=1e9;for(let i=0,j=P.length-1;i<P.length;j=i++){const A=P[j],B=P[i],dx=B[0]-A[0],dz=B[1]-A[1],l=dx*dx+dz*dz||1e-9,t=clamp(((x-A[0])*dx+(z-A[1])*dz)/l,0,1);m=Math.min(m,Math.hypot(A[0]+dx*t-x,A[1]+dz*t-z));}return m;};
  if(!M.concat(C).some(c=>!pin(c[0],c[1])&&dE(c[0],c[1])>.8))return null; // débord latéral (milieu) ou en bout de quai
  const pts=P.concat(C).sort((p,q)=>p[0]-q[0]||p[1]-q[1]),cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]),lo=[],hi=[];
  for(const p of pts){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(const p of pts.slice().reverse()){while(hi.length>1&&cr(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
  const H=lo.slice(0,-1).concat(hi.slice(0,-1)).map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]);return H.concat([H[0]]);})();
if(STATION_GROW)SITE.stationPoly=STATION_GROW;
// Travées d'attente (propriétaire, OzIris, 2026-11-18, issue #19, générique : toutes les attractions ont le même défaut) : visiteurs COLLÉS à leur portillon,
// deux de front quand le portillon fait au moins 1,1 m (deux par portillon), rangées suivantes derrière. Premier rang à SLOT0 = 0,4 m de la ligne des portillons,
// rangs espacés de SLOT_P = 0,6 m (une personne debout, pas plus serré) ; profondeur de la travée GDEPTH = dernier rang + 0,4 m (séparateurs, engine/render.js
// drawGates). Couloir d'attente BWALK ramené juste derrière les travées (GDEPTH + 0,6 m) si SITE.board.walk est plus loin. Toutes ces valeurs sont ESTIMÉES
// (aucun relevé) ; SITE.plat.slot = {first, pitch} les force par attraction.
const SLOT0=(PLT0.slot&&PLT0.slot.first)||.4,SLOT_P=(PLT0.slot&&PLT0.slot.pitch)||.6;
const RES_P=(PLT0.slot&&PLT0.slot.res)||1.5*SLOT_P; // pas de la réserve de la zone d'attente (propriétaire, 2026-11-19 : « 4x plus espacé ») : 2,4 m ESTIMÉ, SITE.plat.slot.res pour forcer
const GCOLS=u=>{const n=GPR>1?S_COLS:CSEATS;return n>1&&2*GUNITS[u].h>=1.1?2:1;};
const GDEPTH_CALC=Math.max(...GUNITS.map((g,u)=>SLOT0+(Math.ceil((GPR>1?S_COLS:CSEATS)/GCOLS(u))-1)*SLOT_P+.4));
/* Profondeur des travées réglée (propriétaire, issue #27, éditeur : GAME.board={depth}, en m depuis la ligne des portillons ; repli SITE.plat.depth ; priorité GAME > SITE >
   calcul GDEPTH_CALC). Sans valeur, rien ne change. Bornes ESTIMÉES : un rang au moins (SLOT0 + 0,4 m), DEPTH_MAX = 6 m au plus. Le moteur en déduit :
   - GROWS = nombre de rangs des travées (premier rang à SLOT0, pas SLOT_P, 0,4 m derrière le dernier) et GDEPTH (séparateurs, engine/render.js drawGates) ;
   - les places des portillons ne changent pas (deux par portillon, premier rang collé) ; travée plus courte que ces places : les rangs en trop attendent juste derrière ;
   - travée plus longue : les rangs supplémentaires (jusqu'à GROWS) deviennent des places de réserve de leur portillon (BRES, `t:1`, `u` = portillon), remplies quand
     les places du portillon sont prises, avec ou sans zone d'attente éditée ; le visiteur avance à la place du portillon libérée ;
   - BWALK (couloir d'attente) juste derrière la travée (GDEPTH + 0,6 m), plus loin que SITE.board.walk si besoin mais pas au-delà du quai (plat.load - 0,3 m) ;
   - QGATE_CLR (engine/render.js, au chargement) = GDEPTH + 0,2 m ; réserve de la zone d'attente éditée : premier rang derrière le dernier rang des travées. */
const DEPTH_MIN=+(SLOT0+.4).toFixed(2),DEPTH_MAX=6;
let GDEPTH=GDEPTH_CALC,GROWS=1,BDEPTH=null,BWALK=Math.min(SITE.board.walk,PGATE+GDEPTH+.6);
function reDepth(){const B=GM.board&&typeof GM.board==='object'?GM.board:null,v=B&&B.depth!=null?+B.depth:PLT0.depth!=null?+PLT0.depth:NaN;
  BDEPTH=isFinite(v)&&v>0?clamp(v,DEPTH_MIN,DEPTH_MAX):null;GDEPTH=BDEPTH!=null?BDEPTH:GDEPTH_CALC;GROWS=Math.max(1,Math.floor((GDEPTH-SLOT0-.4)/SLOT_P+1e-6)+1);
  const wl=BDEPTH!=null?Math.max(SITE.board.walk,(PLT0.load||7.9)-.3):SITE.board.walk;BWALK=Math.min(wl,PGATE+Math.max(GDEPTH,GDEPTH_CALC)+.6);
  try{WALKS[2]=[bayAt(0,BWALK),bayAt(NCARS-1,BWALK)];}catch(e){} // couloir de quai (contrôle offpath) : WALKS est défini plus bas (premier appel : pas encore)
}
const boardDepth=()=>({calc:+GDEPTH_CALC.toFixed(2),depth:+GDEPTH.toFixed(2),set:BDEPTH!=null,game:!!(GM.board&&GM.board.depth!=null),min:DEPTH_MIN,max:DEPTH_MAX,rows:GROWS,pgate:PGATE,
  u:(()=>{const u=NGATES>>1,g=GUNITS[u],b=BAYS[g.k];return {o:[b.x+b.tx*g.c+b.rx*PGATE,b.z+b.tz*g.c+b.rz*PGATE],r:[b.rx,b.rz]};})()}); // éditeur : valeur, bornes, poignée
const slotAt=(u,row,col)=>{const c=GCOLS(u),g=GUNITS[u],b=BAYS[g.k],off=c>1?(col-.5)*Math.min(.6,g.h):0,q=unitAt(u,PGATE+SLOT0+row*SLOT_P);return [q[0]+b.tx*off,0,q[1]+b.tz*off];};
const slotCalc=i=>{const s=seatUnit(i),c=GCOLS(s.u);return slotAt(s.u,Math.floor(s.j/c),s.j%c);}; // places d'attente collées au portillon, deux de front
const slotPos=i=>BSLOTS?BSLOTS[i]:slotCalc(i); // zone d'attente éditée (GAME.boardAreas) : places recalculées dans le polygone (reBoard)
/* Zone d'attente d'embarquement éditée (propriétaire, issue #22, éditeur : GAME.boardAreas=[{id, pts:[[x,z],…]}], un polygone par quai d'embarquement ; le jeu n'a qu'un quai,
   le premier polygone sert). Priorité GAME > calcul : sans GAME.boardAreas, rien ne change (travées et couloir d'attente ci-dessus). Avec un polygone :
   - places : celles des travées (deux par portillon, un portillon par wagon ou par rangée, premier rang à SLOT0 de la ligne des portillons, rangs à SLOT_P), mais seulement
     dans le polygone, à BA_IN au moins de son bord ; une place hors du polygone est remplacée par le rang suivant de la même travée (plus loin des portillons), sinon (polygone
     trop court) par le point du polygone le plus proche de la place calculée ; jamais devant la ligne des portillons ;
   - trajet : SITE.board.via jusqu'au premier point situé dans le polygone (sinon jusqu'au bout, puis point du polygone le plus proche : le polygone doit toucher la fin de la
     file), puis plus court chemin DANS le polygone (sommets ramenés de BA_IN vers l'intérieur) jusqu'à la place ; évacuation (platEvac) : le même chemin à rebours ;
   - sol dessiné comme le quai (engine/render.js drawStationFloor), surface praticable (tools/offpath.js), aucun garde-corps de file dedans (buildRails, au chargement).
   BA_IN = 0,2 m, ESTIMÉ (une demi-personne). L'éditeur part du polygone calculé boardAreaCalc() : de la ligne des portillons au couloir d'attente (BWALK) + 0,4 m. */
const BA_IN=.2,BR_MAX=400;let BAREA=null,BSLOTS=null,BVIA=null,BNODES=[],BRES=[];
const pipA=(P,x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
const nearEdgeA=(P,x,z)=>{let m=1e9,q=null,n=null;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[j],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1e-9,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/l,0,1),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(px-x,pz-z);
  if(d<m){m=d;q=[px,pz];const ll=Math.sqrt(l);n=[-dz/ll,dx/ll];}}return {d:m,q,n};};
const latA=(x,z)=>{let bk=BAYS[0],bd=1e9;for(const b of BAYS){const d=Math.hypot(x-b.x,z-b.z);if(d<bd){bd=d;bk=b;}}return (x-bk.x)*bk.rx+(z-bk.z)*bk.rz;}; // distance latérale à la voie (côté embarquement > 0)
const inA=(x,z,m)=>pipA(BAREA,x,z)&&nearEdgeA(BAREA,x,z).d>=m;
function intoA(x,z){ // point du polygone (à BA_IN du bord, derrière les portillons) le plus proche de (x, z)
  if(inA(x,z,BA_IN)&&latA(x,z)>=PGATE+.2)return [x,z];const e=nearEdgeA(BAREA,x,z);
  for(const k of [1,2,4,8])for(const s of [1,-1]){const p=[e.q[0]+e.n[0]*s*BA_IN*k,e.q[1]+e.n[1]*s*BA_IN*k];if(inA(p[0],p[1],BA_IN*.9)&&latA(p[0],p[1])>=PGATE+.2)return p;}
  let best=null,bd=1e9;for(const p of BNODES){const d=Math.hypot(p[0]-x,p[1]-z);if(d<bd){bd=d;best=p;}}return best||e.q;}
function boardAreaCalc(){ // polygone de départ de l'éditeur : travées et couloir d'attente, de l'avant du premier portillon à l'arrière du dernier
  const l0=PGATE+.05,l1=Math.max(BWALK,PGATE+GDEPTH)+.4,F=[],B=[];
  for(let k=0;k<=NCARS;k++){const b=BAYS[Math.min(k,NCARS-1)],e=k<NCARS?CAR/2:-CAR/2;F.push([b.x+b.tx*e+b.rx*l0,b.z+b.tz*e+b.rz*l0]);B.push([b.x+b.tx*e+b.rx*l1,b.z+b.tz*e+b.rz*l1]);}
  const P=F.concat(B.reverse()),out=[]; // sommets alignés (gare droite) retirés : polygone simple à éditer
  for(let i=0;i<P.length;i++){const a=P[(i+P.length-1)%P.length],b=P[i],c=P[(i+1)%P.length],cr=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(cr)/(Math.hypot(c[0]-a[0],c[1]-a[1])||1)>.05)out.push(b);}
  return out.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]);}
const boardArea=()=>BAREA||boardAreaCalc();
function segInA(a,b){ // segment a-b entièrement dans le polygone (aucun bord coupé, milieu dedans)
  const P=BAREA,cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  for(let i=0,j=P.length-1;i<P.length;j=i++){const c=P[j],d=P[i],d1=cr(a,b,c),d2=cr(a,b,d),d3=cr(c,d,a),d4=cr(c,d,b);if(d1*d2<0&&d3*d4<0)return false;}
  for(const t of [.25,.5,.75])if(!pipA(P,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false;return true;}
function routeA(a,b){ // plus court chemin de a à b dans le polygone (sommets intérieurs BNODES) : liste des points après a, b compris
  if(segInA(a,b))return [b];const N=[a].concat(BNODES,[b]),n=N.length,D=new Array(n).fill(1e9),pr=new Array(n).fill(-1),done=new Array(n).fill(false);D[0]=0;
  for(;;){let u=-1;for(let i=0;i<n;i++)if(!done[i]&&D[i]<1e9&&(u<0||D[i]<D[u]))u=i;if(u<0||u===n-1)break;done[u]=true;
    for(let v=0;v<n;v++){if(done[v]||v===u)continue;const w=D[u]+Math.hypot(N[v][0]-N[u][0],N[v][1]-N[u][1]);if(w<D[v]&&segInA(N[u],N[v])){D[v]=w;pr[v]=u;}}}
  if(pr[n-1]<0)return [b];const out=[];for(let v=n-1;v>0;v=pr[v])out.unshift(N[v]);return out;}
function resRows(keep){ // rangs supplémentaires des travées réglées (issue #27) : places de réserve de chaque portillon, du rang des places du portillon jusqu'à GROWS
  const out=[];if(BDEPTH==null)return out;
  for(let u=0;u<NGATES;u++){const c=GCOLS(u),n0=Math.ceil((GPR>1?S_COLS:CSEATS)/c);for(let row=n0;row<GROWS;row++)for(let col=0;col<c;col++){const p=slotAt(u,row,col);
    if(keep(p)){p.u=u;p.t=1;out.push(p);}}}return out;}
function reBoard(){ // (re)lit GAME.boardAreas et GAME.board : polygone, places, entrée depuis la file, profondeur des travées (appelé au chargement et par l'éditeur)
  reDepth();
  const A=Array.isArray(GM.boardAreas)&&GM.boardAreas[0];BAREA=A&&Array.isArray(A.pts)&&A.pts.length>=3?A.pts.map(p=>[+p[0],+p[1]]):null;BSLOTS=null;BVIA=null;BNODES=[];BRES=[];
  if(!BAREA){ // travées calculées : réserve = rangs supplémentaires des travées (sur le quai : en deçà du couloir d'attente)
    const V=(SITE.board.via||[]).slice(-1)[0]||[0,0],b0=BAYS[0],lo=(x,z)=>(x-b0.x)*b0.tx+(z-b0.z)*b0.tz,lv=latA(V[0],V[1]);
    BRES=resRows(p=>latA(p[0],p[2])<=BWALK-.4&&!(Math.abs(lo(p[0],p[2])-lo(V[0],V[1]))<.6&&latA(p[0],p[2])>lv-.6)); // issue #44 : place libre en face du bout de via (passage vers le couloir d'attente)
    BRES.sort((p,q)=>(latA(p[0],p[2])-latA(q[0],q[2]))||(Math.hypot(p[0]-V[0],p[2]-V[1])-Math.hypot(q[0]-V[0],q[2]-V[1])));return;}
  const P=BAREA,n=P.length;let ar=0;for(let i=0,j=n-1;i<n;j=i++)ar+=P[j][0]*P[i][1]-P[i][0]*P[j][1];const sg=ar>0?1:-1; // orientation : normale intérieure des bords
  for(let i=0;i<n;i++){const a=P[(i+n-1)%n],b=P[i],c=P[(i+1)%n],n1=[-(b[1]-a[1]),b[0]-a[0]],n2=[-(c[1]-b[1]),c[0]-b[0]],l1=Math.hypot(...n1)||1,l2=Math.hypot(...n2)||1;
    let m=[(n1[0]/l1+n2[0]/l2)*sg,(n1[1]/l1+n2[1]/l2)*sg];const ml=Math.hypot(m[0],m[1]);if(ml<.1)continue;m=[m[0]/ml,m[1]/ml];
    for(const k of [1.5,3]){const q=[b[0]+m[0]*BA_IN*k,b[1]+m[1]*BA_IN*k];if(inA(q[0],q[1],BA_IN*.9)&&latA(q[0],q[1])>=PGATE+.2){BNODES.push(q);break;}}}
  BSLOTS=new Array(SEATS);
  for(let u=0;u<NGATES;u++){const ids=[];for(let i=0;i<SEATS;i++)if(seatUnit(i).u===u)ids.push(i);ids.sort((p,q)=>seatUnit(p).j-seatUnit(q).j);
    const c=GCOLS(u),got=[];for(let row=0;row<60&&got.length<ids.length;row++)for(let col=0;col<c&&got.length<ids.length;col++){const p=slotAt(u,row,col);if(inA(p[0],p[2],BA_IN))got.push(p);}
    ids.forEach((i,j)=>{if(got[j])BSLOTS[i]=got[j];else{const s=seatUnit(i),q=slotAt(u,Math.floor(s.j/c),s.j%c),r=intoA(q[0],q[2]);BSLOTS[i]=[r[0],0,r[1]];}});}
  const V=(SITE.board.via||[]).map(q=>[q[0],q[1]]),k=V.findIndex(q=>pipA(P,q[0],q[1]));
  BVIA=k>=0?{pre:V.slice(0,k).map(q=>[q[0],0,q[1]]),e:intoA(V[k][0],V[k][1])}:{pre:V.map(q=>[q[0],0,q[1]]),e:V.length?intoA(V[V.length-1][0],V[V.length-1][1]):null};
  // Réserve (propriétaire, issue #24 : « aucun visiteur dans le polygone excepté ceux des portillons ») : la zone d'attente se remplit. Places supplémentaires BRES, rangs
  // successifs derrière les places des portillons (BSLOTS), pas SLOT_P le long de la voie et en profondeur, dans tout le polygone (à BA_IN du bord, prolongé au-delà des
  // wagons de tête et de queue tant que le polygone le permet), triées de la plus proche des portillons à la plus lointaine ; BR_MAX = 400 places au plus (garde-fou).
  // Les visiteurs y entrent quand toutes les places des portillons sont prises (ou que d'autres attendent déjà dans la réserve), puis avancent à une place de portillon
  // libérée (engine/sim.js updatePlatform). Pas RES_P = 4 × SLOT_P = 2,4 m (propriétaire : visiteurs 4x plus espacés), rangs et places dans le rang : ESTIMÉ.
  // Travées réglées (issue #27, GAME.board.depth) : rangs supplémentaires des travées d'abord (places de réserve de leur portillon, dans le polygone), puis la réserve
  // espacée commence derrière le dernier rang des travées.
  const BT=resRows(p=>inA(p[0],p[2],BA_IN)&&!BSLOTS.some(q=>Math.hypot(q[0]-p[0],q[2]-p[2])<.3)),TS=BSLOTS.concat(BT);
  BRES=[];const RD=RES_P*.75,lmax=Math.max(...TS.map(p=>latA(p[0],p[2])),BDEPTH!=null?PGATE+GDEPTH-.4:-1e9)+Math.max(.5,RES_P/2),far=p=>TS.some(q=>Math.hypot(q[0]-p[0],q[2]-p[1])<Math.max(.45,RES_P*.45))||BRES.some(q=>Math.hypot(q[0]-p[0],q[2]-p[1])<RD);
  for(let row=0;row<80&&BRES.length<BR_MAX;row++){const lat=lmax+row*RES_P; // premier rang à RES_P/2 (0,5 m au moins) derrière le dernier rang des portillons
    BAYS.forEach((b,i)=>{const ext=(i===0||i===BAYS.length-1)?12:0;for(let u=-CAR/2-ext+RES_P/2;u<=CAR/2+ext&&BRES.length<BR_MAX;u+=RES_P){const p=[b.x+b.tx*u+b.rx*lat,b.z+b.tz*u+b.rz*lat];
      if(inA(p[0],p[1],BA_IN)&&latA(p[0],p[1])>=lmax-.05&&!far(p))BRES.push([p[0],0,p[1]]);}});}
  const e0=BVIA.e||[0,0];BRES=BT.concat(BRES).filter(p=>Math.hypot(p[0]-e0[0],p[2]-e0[1])>=.8); // issue #44 : entrée de la zone laissée libre (0,8 m, ESTIMÉ) : les arrivants ne marchent pas sur quelqu'un
  BRES.sort((p,q)=>(latA(p[0],p[2])-latA(q[0],q[2]))||(Math.hypot(p[0]-e0[0],p[2]-e0[1])-Math.hypot(q[0]-e0[0],q[2]-e0[1])));}
// trajet dans la zone éditée : de la file au point p ([x,0,z] : place i d'un portillon ou place de réserve) (sans le point de départ) ; à rebours pour l'évacuation
// travées calculées (pas de zone éditée) : place de réserve p d'une travée réglée (p.u = portillon) atteinte comme une place de portillon, par via et le couloir d'attente
const bwalkAt=u=>{const g=GUNITS[u||0],b=BAYS[g.k];return [b.x+b.rx*BWALK+b.tx*g.c,0,b.z+b.rz*BWALK+b.tz*g.c];};
const resUnit=p=>{if(p.u!=null)return p.u;const q=BRES.find(r=>Math.hypot(r[0]-p[0],r[2]-p[2])<.02);return q?q.u:null;}; // après une reprise de sauvegarde : retrouvée par position
function boardInP(p){if(!BAREA){const V=(SITE.board.via||[]).map(q=>[q[0],0,q[1]]),w=bwalkAt(resUnit(p)),v=V[V.length-1],c=v&&BAYS[0]?atP(lonP(v),latP(w)):null; // issue #44 : jusqu'au couloir d'attente en face du bout de via, puis le long du couloir (pas en biais à travers les travées)
  return V.concat(c&&Math.hypot(c[0]-v[0],c[2]-v[2])>.3?[c]:[],[w,p]);}const e=BVIA.e||[p[0],p[2]];return BVIA.pre.concat([[e[0],0,e[1]]],routeA(e,[p[0],p[2]]).slice(0,-1).map(q=>[q[0],0,q[1]]),[p]);}
function boardOutP(p){if(!BAREA)return [p,bwalkAt(resUnit(p))].concat((SITE.board.via||[]).slice().reverse().map(q=>[q[0],0,q[1]]));const e=BVIA.e||[p[0],p[2]];return [p].concat(routeA([p[0],p[2]],e).map(q=>[q[0],0,q[1]]),BVIA.pre.slice().reverse());}
const boardIn=i=>boardInP(slotPos(i)),boardOut=i=>boardOutP(slotPos(i));
// Ordre sur le quai (propriétaire, issue #44 : un arrivant ne passe ni au travers ni par-dessus ceux qui attendent) : repère du quai (BAYS[0] : lon le long de la voie,
// lat en s'éloignant de la voie) ; une COLONNE = les places de même lon (à 0,3 m près). Dans la zone éditée, l'arrivant longe l'ALLÉE derrière toutes les places
// occupées ou promises (0,6 m au-delà de la plus éloignée de la voie, ESTIMÉ), puis avance tout droit dans la colonne de sa place, dont les places de derrière sont
// libres (resFree, engine/sim.js) ; allée hors de la zone : trajet direct d'avant (boardInP).
const PB=()=>BAYS[0],lonP=p=>{const b=PB();return (p[0]-b.x)*b.tx+(p[2]-b.z)*b.tz;},latP=p=>{const b=PB();return (p[0]-b.x)*b.rx+(p[2]-b.z)*b.rz;},
  atP=(lo,la)=>{const b=PB();return [b.x+b.tx*lo+b.rx*la,0,b.z+b.tz*lo+b.rz*la];},sameCol=(p,q)=>Math.abs(lonP(p)-lonP(q))<.3;
const PGRID=.3,PCLR=.4; // pas de la grille de recherche du trajet (ESTIMÉ) ; écart gardé aux places occupées (QD)
function platOcc(p){const Q=[];G.plat.forEach((r,i)=>{if(r){const q=slotPos(i);if(Math.hypot(q[0]-p[0],q[2]-p[2])>.05)Q.push(q);}});
  (G.platR||[]).forEach((r,j)=>{const q=BRES[j];if(r&&q&&Math.hypot(q[0]-p[0],q[2]-p[2])>.05)Q.push(q);});return Q;}
// trajet de E à p dans la zone éditée qui garde PCLR de toute place occupée ou promise (grille de pas PGRID, plus court chemin, raccourci en lignes droites) ; null si aucun
function platPath(E,p,Q){const lo0=Math.min(lonP(E),lonP(p)),la0=Math.min(latP(E),latP(p));let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const q of BAREA){const P=[q[0],0,q[1]],a=lonP(P),b=latP(P);x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);}
  const W=Math.ceil((x1-x0)/PGRID)+1,H=Math.ceil((y1-y0)/PGRID)+1;if(W*H>40000)return null;const free=(x,z)=>inA(x,z,.1)&&Q.every(q=>Math.hypot(q[0]-x,q[2]-z)>=PCLR);
  const id=(a,b)=>b*W+a,pt=k=>atP(x0+(k%W)*PGRID,y0+Math.floor(k/W)*PGRID),cell=P=>id(clamp(Math.round((lonP(P)-x0)/PGRID),0,W-1),clamp(Math.round((latP(P)-y0)/PGRID),0,H-1));
  const s0=cell(E),t0=cell(p),ok=new Map(),okA=k=>{if(!ok.has(k)){const q=pt(k);ok.set(k,free(q[0],q[2]));}return ok.get(k);};
  const prev=new Map([[s0,-1]]),Fq=[s0];let found=false;
  for(let h=0;h<Fq.length;h++){const k=Fq[h];if(k===t0){found=true;break;}const a=k%W,b=Math.floor(k/W);
    for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const na=a+da,nb=b+db;if(na<0||nb<0||na>=W||nb>=H)continue;const n=id(na,nb);if(prev.has(n))continue;if(n!==t0&&!okA(n))continue;prev.set(n,k);Fq.push(n);}}
  if(!found)return null;const C=[];for(let k=t0;k>=0;k=prev.get(k))C.unshift(pt(k));C[0]=[E[0],0,E[2]];C[C.length-1]=p;
  const vis=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.1);for(let k=1;k<n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[2]+(b[2]-a[2])*k/n;if(Q.some(q=>Math.hypot(q[0]-x,q[2]-z)<.37)||!inA(x,z,.1)&&Math.hypot(x-p[0],z-p[2])>PCLR)return false;}return true;};
  const out=[];for(let i=0;i<C.length-1;){let j=C.length-1;while(j>i+1&&!vis(C[i],C[j]))j--;out.push(C[j]);i=j;}return out;}
function boardInA(p){if(!BAREA)return boardInP(p);const e=BVIA.e,E=[e[0],0,e[1]],r=platPath(E,p,platOcc(p));return r?BVIA.pre.concat([E],r):boardInP(p);}
// place p sur le reste du trajet d'un visiteur qui gagne déjà sa place (à moins de PCLR + 0,05 m), où il passera après t s (arrivée du nouvel occupant, moins
// 0,3 s) : on ne la donne pas encore (il passerait au travers de celui qui s'y tient) ; plen3 = longueur d'un trajet
const plen3=P=>{let d=0;for(let i=1;i<P.length;i++)d+=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);return d;};
function platCross(p,t){t=t||0;for(const k of G.walkers){if(k.kind!=='wait'||k.i>=k.pts.length)continue;const T=k.pts[k.pts.length-1];if(Math.hypot(T[0]-p[0],T[2]-p[2])<.05)continue;let a=[k.x,0,k.z],d=0;
    for(let i=k.i;i<k.pts.length;i++){const b=k.pts[i],dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz),u=L?clamp(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(L*L),0,1):0;
      if(Math.hypot(a[0]+dx*u-p[0],a[2]+dz*u-p[2])<PCLR+.05&&(d+L*u)/(k.sp||3)>t-.3)return true;d+=L;a=b;}}
  return false;}
const platTo=(a,p)=>{if(!BAREA)return null;const r=platPath(a,p,platOcc(p));return r?[a].concat(r):null;}; // d'une place à une autre sans frôler personne (réserve → portillon, avance d'une place)
const platReach=p=>{if(!BAREA)return true;const E=[BVIA.e[0],0,BVIA.e[1]];return !!platPath(E,p,platOcc(p))||!platPath(E,p,[]);}; // place atteignable sans frôler personne (grille sans issue même à vide, zone de forme étroite : trajet direct d'avant)
const resStep=(k,j)=>{const a=BRES[k],p=BRES[j];if(!BAREA)return [a,p];return [a].concat(routeA([a[0],a[2]],[p[0],p[2]]).slice(0,-1).map(q=>[q[0],0,q[1]]),[p]);}; // d'une place de réserve à une autre, plus avant (issue #44)
const resTo=(j,i)=>{const a=BRES[j],p=slotPos(i);if(!BAREA)return [a,p];return [a].concat(routeA([a[0],a[2]],[p[0],p[2]]).slice(0,-1).map(q=>[q[0],0,q[1]]),[p]);}; // de la réserve j à la place i
/* Fin de la file à raccorder à la zone d'attente (issue #24, éditeur) : dernière portion du trajet des visiteurs vers le quai (8 m de la fin du dernier tronçon de file,
   puis SITE.board.via), point d'extrémité `end` (dernier point de board.via, sinon fin de la file : c'est là que les visiteurs quittent le chemin pour la zone), et bords
   de l'allée au bout de la file (`edges`, largeur dessinée qwAt, engine/render.js). Coordonnées arrondies au cm : un sommet aimanté y est posé exactement. */
function boardViaEnd(){const Q=SEG_OUT.P,R=v=>+v.toFixed(2),qe=Q[Q.length-1],tail=[[qe[0],qe[1]]];let d=0;
  for(let i=Q.length-2;i>=0&&d<8;i--){d+=Math.hypot(Q[i+1][0]-Q[i][0],Q[i+1][1]-Q[i][1]);tail.unshift([Q[i][0],Q[i][1]]);}
  const V=(SITE.board.via||[]).map(q=>[q[0],q[1]]),pts=tail.concat(V),end=pts[pts.length-1],a=Q[Q.length-2]||qe,l=Math.hypot(qe[0]-a[0],qe[1]-a[1])||1,n=[-(qe[1]-a[1])/l,(qe[0]-a[0])/l];
  let w=1;try{w=qwAt(qe[0],qe[1]);}catch(e){}const hw=w/2;
  return {pts:pts.map(q=>[R(q[0]),R(q[1])]).filter((q,i,A)=>!i||q[0]!==A[i-1][0]||q[1]!==A[i-1][1]),end:[R(end[0]),R(end[1])],queueEnd:[R(qe[0]),R(qe[1])],w:R(w),edges:[[R(qe[0]+n[0]*hw),R(qe[1]+n[1]*hw)],[R(qe[0]-n[0]*hw),R(qe[1]-n[1]*hw)]]};}
reBoard();
// Couloirs des visiteurs sur les quais (jamais en ligne droite à travers la gare, la voie ou les portillons) :
//  embarquement : file → SITE.board.via → couloir d'attente (SITE.board.walk m de la voie, derrière les portillons) → place d'attente de la travée → (portillon ouvert seulement) → siège ;
//  débarquement : siège → quai de débarquement, côté opposé aux portillons (couloir à SITE.plat.walkU m de la voie, par défaut au milieu du quai) → travée de la porte → SITE.exit.door → SITE.exit.path.
const PLT=Object.assign({load:7.9,exit:0,back:.1,front:1.6},SITE.plat),ULAT=-(PLT.walkU||(PLT.exit?(PEDGE+PLT.exit)/2:1.8));
const bayAt=(k,lat,du)=>{const b=BAYS[k];return [b.x+b.rx*lat+b.tx*(du||0),0,b.z+b.rz*lat+b.tz*(du||0)];};
const DOOR=SITE.exit.door,DOORK=DOOR?BAYS.reduce((m,b,k)=>Math.hypot(b.x-DOOR[0],b.z-DOOR[1])<Math.hypot(BAYS[m].x-DOOR[0],BAYS[m].z-DOOR[1])?k:m,0):0;
function alightWalk(k,x,z){ // du siège au quai de débarquement, le long des travées jusqu'à la porte
  const pts=[[x,0,z],bayAt(k,ULAT)],st=k<DOORK?-1:1;for(let j=k;j!==DOORK;j-=st)pts.push(bayAt(j-st,ULAT));
  if(DOOR)pts.push([DOOR[0],0,DOOR[1]]);return pts;
}
const WALKS=[[bayAt(DOORK,ULAT),DOOR||bayAt(DOORK,ULAT)],[bayAt(0,ULAT),bayAt(NCARS-1,ULAT)],[bayAt(0,BWALK),bayAt(NCARS-1,BWALK)]]; // couloirs de quai (contrôle offpath)
// Deux opérateurs de quai (moitié avant, moitié arrière) ferment les sécurités wagon par wagon après le verrouillage au pupitre, les vérifient, puis valident chacun sur un bouton
// Poste d'attente et poste de validation (bouton) de chaque opérateur, au bout de SON quai (issue #23, propriétaire, Zeus : « un opérateur est en dehors de la gare ») :
// 1,7 m au-delà du milieu du wagon d'extrémité au plus, ramené dans le quai (arrière : CAR/2 + plat.back, avant : plat.front, comme drawStationFloor), poste 0,7 m plus loin
// ou au bout du quai moins 0,3 m ; à défaut de place, à côté du wagon d'extrémité. Toujours dans le couloir entre le bord du quai et les portillons (POPL).
const OPLIM=i=>i?CAR/2+(PLT0.back!=null?PLT0.back:1.5):(PLT0.front!=null?PLT0.front:1.6),OPD=i=>clamp(OPLIM(i)-1,0,1.7),OPPD=i=>Math.max(OPD(i)+.3,Math.min(OPD(i)+.7,OPLIM(i)-.3));
const opAt=(i,d)=>{const b=i?BAYS[NCARS-1]:BAYS[0],e=i?-1:1;return [b.x+b.tx*e*d+b.rx*POPL,b.z+b.tz*e*d+b.rz*POPL];};
const opHome=i=>opAt(i,OPD(i)),opPost=i=>opAt(i,OPPD(i)); // dans le couloir entre le bord du quai et les portillons
const OPS=[0,1].map(i=>{const h=opHome(i);return {i,x:h[0],z:h[1],ok:false,st:'idle',k:0,w:0,mv:false};});
function startCheck(t){t.phase='check';for(const o of OPS){o.ok=false;o.st='go';o.k=o.i?NGATES-1:0;o.w=0;}} // o.k : portillon (wagon, ou rangée avec gatesPer:'row') vérifié
function resetOps(){for(const o of OPS){o.ok=false;if(o.st!=='idle')o.st='back';}}
function stepOps(dt){
  for(const o of OPS){
    o.mv=false;if(o.st==='idle')continue;
    if(o.st==='press'){o.w-=dt;if(o.w<=0){o.ok=true;o.st='idle';}continue;}
    const u=clamp(o.k,0,NGATES-1),ck=GUNITS[u].k,tg=o.st==='go'?unitAt(u,POPL):opHome(o.i),dx=tg[0]-o.x,dz=tg[1]-o.z,d=Math.hypot(dx,dz),sp=3*dt;
    if(d>sp){o.x+=dx/d*sp;o.z+=dz/d*sp;o.mv=true;continue;}
    o.x=tg[0];o.z=tg[1];
    if(o.st==='go'){const T=trains.find(x=>x.st==='station'&&x.phase==='check');if(T){T.rcT&=~(1<<ck);if(T.rc[ck]>.05)continue;} // l'opérateur ferme les sécurités du wagon devant lui, puis le contrôle
      o.w+=dt;if(o.w>=.3){o.w=0;o.k+=o.i?-1:1;if(o.i?o.k<NGATES/2:o.k>=NGATES/2)o.st='ret';}}
    else if(o.st==='ret'){o.st='press';o.w=.45;}
    else o.st='idle';
  }
}
const zoneOf=s=>s<S_ST?'station':s<S_LIFT0?'prelift':s<S_REL?'lift':s<S_BRK?'course':'brake';

/* ══════════ COMMANDE PAR ZONES (docs/manoeuvres.md, « Principe de commande ») ══════════
   Le joueur commande des zones, jamais des trains : St (gare), Lift, B1…Bn (freins de bloc), Fin (frein final), RA / RB (pont droit :
   rail A du circuit, rail B du chariot), L1…Ln (voies de garage). Chaque zone a des freins (G.zk[z] = serrés) et, selon SITE.zones,
   des moteurs (pneus / roues de propulsion) Avancer / Reculer / Arrêt ; drive:'fwd' = marche avant seule (Avancer / Arrêt, pas de Reculer). Les zones de freinage B*, Fin, RA sont en AUTO par défaut (cantonnement) ;
   le joueur peut passer chacune en MANU (G.zm[z]) : ses freins et moteurs obéissent alors au pupitre. Gare, rail B et voies : toujours manuels.
   SITE.zones : { <zone ou groupe B / L> : {brake, drive} } (drive : true | 'fwd' | false) ; défauts : freins et moteurs partout, freins de bloc en marche avant seule
   (drive:'fwd', propriétaire 2026-11-17 : roues de propulsion et bouton AV, pas d'AR ; disposition ESTIMÉE). */
const ZCFG=z=>Object.assign({brake:true,drive:/^B\d/.test(z)?'fwd':true},SITE.zones&&SITE.zones[z.replace(/\d+$/,'')],SITE.zones&&SITE.zones[z]);
const ZONES=[{id:'St',name:'Gare',sec:'st'},{id:'Lift',name:'Lift',sec:'lift'}]
  .concat(BLK.map((_,i)=>({id:'B'+(i+1),name:'Bloc '+(i+1),sec:'brk',auto:true})),[{id:'Fin',name:'Frein final',sec:'brk',auto:true}],
    SG?[{id:'RB',name:YD.railName||'Rail du pont',sec:'brk',auto:true}]:TRAV?[{id:'RA',name:RA?RAS:'Rail du parcours',sec:'brk',auto:true},{id:'RB',name:'Rail du chariot',sec:'brk'}]:[],
    PSB?[{id:'Pre',name:PSB.name||'Frein avant gare',sec:'brk',auto:true}]:[],
    LANES.map((l,j)=>({id:'L'+(j+1),name:LANES.length>1?'Voie '+(j+1):l.name,sec:'gar'})))
  .map(Z=>Z.id==='Lift'?Z:Object.assign(Z,ZCFG(Z.id),Z.id==='St'?{brake:false}:{},Z.sec==='gar'?{brake:false,drive:false}:{})); // voies : bouton Dispatch (issue #11, laneDispatch dans engine/sim.js), freins automatiques, plus un bouton de freins forcés #zL<k>_k (G.zk.L<k>, zK)
/* Frein de ralentissement (SITE.zones.B1.trim:{v}) : en passage normal (zone en AUTO, canton suivant libre), le train y est ramené à la vitesse v (m/s) puis continue ; il s'arrête
   seulement si le canton suivant est occupé ou si les freins sont serrés au pupitre. Par zone de frein de bloc : BTRIM[i] (m/s, 0 = pas de ralentissement). */
const BTRIM=BLK.map((_,i)=>{const Z=ZONES.find(o=>o.id==='B'+(i+1));return Z&&Z.trim&&Z.trim.v||0;});
/* Roues de propulsion des freins de bloc (BDRV[i]) : en MANU, un train arrêté au frein n'en repart qu'au bouton AV (#zB<k>_f, freins relâchés, canton suivant libre),
   poussé jusqu'à VPROP puis rendu à la gravité quand sa queue a passé le frein ; sans roues (drive:false), le relâchement suffit. En AUTO : inchangé. VPROP = PH.vmin, ESTIMÉ. */
// Aiguillage en amont (issue #38) : hors gare, la zone de raccordement doit avoir des moteurs en marche arrière (bouton AR, SITE.zones.<zone>.drive:true) ; a > un train : le train arrêté dans la zone est hors de l'appareil
if(LBK&&YZ!=='St'){if((ZONES.find(o=>o.id===YZ)||{}).drive!==true)throw new Error('SITE.yard.back : la zone '+YZ+' doit avoir la marche arrière (SITE.zones.'+YZ+'.drive:true)');
  if(YD.a<TLEN+1)console.warn('SITE.yard.back : a = '+YD.a+' m, moins d\'un train : le train arrêté '+YZ+' est sur l\'appareil');}
const BDRV=BLK.map((_,i)=>!!(ZONES.find(o=>o.id==='B'+(i+1))||{}).drive),VPROP=PH.vmin;
const CARR=TRAV?'RB':YZ; // zone porteuse : zone d'où un train entre dans la voie en face de l'appareil (au Dispatch de la voie) ; son Arrêt arrête aussi ce train // gare : pas de bouton de frein, freins liés au départ (stHeld)
const stHeld=()=>trains.some(t=>t.st==='station'&&!t.depReq); // freins de gare : serrés automatiquement tant qu'un train est à quai, relâchés par la seule séquence Départ
const zName=z=>(ZONES.find(o=>o.id===z)||{}).name||z;
const isAutoZ=z=>/^(B\d+|Fin|RA|Pre)$/.test(z)||(SG&&z==='RB'),ZR=SG?'RB':'RA'; // ZR : zone du rail du circuit sur le pont droit (rail unique : RB, zone de freinage ET zone porteuse)
const zK=z=>z[0]==='L'?!!G.zk[z]:isAutoZ(z)?!!(G.zm[z]&&G.zk[z]):!!G.zk[z]; // freins serrés au pupitre (zone de freinage : seulement en MANU)
const bIn=()=>TRAV&&!SG&&!devMoving()&&G.dev.pos===PG&&(!RA||raOut()); // pont droit : rail B (garage) en ligne avec le circuit
const circIn=()=>TRAV&&(RA?raIn():!devMoving()&&G.dev.pos===0); // pont droit : rail A (circuit) en ligne
function tZone(t){ // zone où se trouve un train
  if(t.st==='station')return 'St';
  if(t.st==='garage')return TRAV&&(t.lane<0||onCar(t))?'RB':'L'+(t.lane+1);
  const z=zoneOf(t.s);
  if(z==='station')return 'St';
  if(z==='lift'||z==='prelift')return 'Lift';
  if(z==='course'){for(let i=0;i<BLK.length;i++)if(t.s>BLK[i]-10&&t.s<BLK[i]+.6)return 'B'+(i+1);return '';}
  if(PSB&&t.s>PSB_A)return 'Pre';
  if(TRAV&&t.s>R0+.5)return SG||bIn()?'RB':'RA';
  return 'Fin';
}
const zT=z=>trains.filter(t=>tZone(t)===z);
