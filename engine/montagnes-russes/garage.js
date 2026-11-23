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
