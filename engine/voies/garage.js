'use strict';
/* Gare de triage générique (SITE.yard) — règles communes : docs/manoeuvres.md.
   Point de raccordement sur le circuit (zone d'attente quelconque : gare ou zone de freinage ; issue #36), appareil de voie (aiguillage à 2 positions ou pont transbordeur
   à N positions), voies de garage. Chaque voie k a son propre chemin : circuit jusqu'à SW_A, tronçon de transfert (courbe
   en S de SW_A jusqu'au début de la voie), puis la voie. Un train hors circuit (st==='garage') a une voie t.lane et une
   abscisse t.g (avant du train, 0 = point de raccordement), t.mv = +1 avance, -1 recule, 0 arrêté.
   L'appareil est un chariot coulissant le long de (SW0.vx, SW0.vz) qui porte le tronçon du circuit et le tronçon de
   transfert : position P = décalage 0, voie k = décalage OFF[k] (le tronçon de transfert de la voie k est alors en place). */
/* Couche « voies » (docs/ARCHITECTURE.md D14) : aucun dessin ; le type déclare zones d'attente et véhicules (engine/voies/reseau.js). VL : longueur d'un véhicule. */
const VL=VOIES.long,Y_GAR=VOIES.hauteur;
/* Marge de garage (propriétaire, issue #11) : un train garé s'arrête à BUF m du butoir et à BUF m du train garé devant lui.
   BUF = SITE.yard.buffer, défaut 2 m : ESTIMÉ (pas de relevé). Voie trop courte : la marge est réduite à ce qui reste (le train doit avoir dégagé l'appareil). */
const YD=SITE.yard,TRAV=YD.device==='traverser',BUF=YD.buffer!=null?YD.buffer:2,GSTEP=VL+BUF,MV=Object.assign({v:2.4,t:3,vc:.6},YD.move),
  DEVN=YD.devName||(YD.device==='switch'?'Aiguillage':'Pont transbordeur'),
  DEVL=YD.devLabel||(YD.device==='switch'?'l\'aiguillage':'le pont transbordeur'); // nom au pupitre, nom dans une phrase
/* Réglages chiffrés du pont de 0.6.0 (GAME.site.yard.post, laneGap, retract.d, laneD) : remplacés par les positions des rails mobiles réglées sur la carte
   (osmrides#64, SITE.yard.rails ci-dessous) ; tolérés dans un GAME.site existant mais IGNORÉS : seules les valeurs d'origine de SITE comptent (SITE_BASE.yard). */
const YB=typeof SITE_BASE!=='undefined'&&SITE_BASE.yard||YD;
/* Pont transbordeur droit (device:'traverser') : chariot à deux rails droits parallèles, longs d'un train, posés sur la ligne
   droite du point de raccordement. Rail A = rail du circuit (zone de freinage), rail B = rail de garage (freins et pneus),
   écartés de YD.gap. Repère du chariot : origine au début du rail A au repos (abscisse R0), u le long du rail (corde R0→R1),
   v = (SW0.vx, SW0.vz) sens où le rail A sort du circuit (à l'opposé du garage). Décalage c du chariot : rail A en v=c,
   rail B en v=c-gap. Positions : P (c=0, rail A sur le circuit), G (c=gap, rail B sur le circuit), voie k (rail B face à la
   voie k, d'axe v=-d_k). Le train posé sur le rail B est emporté par le chariot : st 'garage', lane -1, g = avant du train
   en u. Voies droites, parallèles aux rails, de u=U_LANE à u=end ; le train y entre en marche avant et en sort en arrière. */
/* Pont droit à rail unique (traverser + YD.single) : le chariot porte UN rail, qui EST le tronçon du circuit (zone de freinage RB,
   « Rail du pont ») : P = rail en ligne avec le circuit, 1…n = le même rail face à la voie k (circuit alors interrompu). Pas de rail B
   distinct ni de position G : GAP = 0, le train arrêté à vide sur le rail en P est emporté par le chariot vers une voie. */
const SG=TRAV&&!!YD.single;
// Rail du pont : de R0 à R1 ; R0 = début du rail de transfert OSM (repère tr0) si yard.pre n'est pas donné et que le rail est assez long, sinon un train + pre.
const R0=TRAV?(YD.pre==null&&TAG.tr0!=null&&TAG.tr0<ANCH-VL?TAG.tr0:ANCH-VL-(YD.pre!=null?YD.pre:.6)):0,R1=TRAV?ANCH+(YB.post!=null?YB.post:.6):0,G_B=ANCH-R0,
  GAP=SG?0:YD.gap||3.2,U_LANE=R1-R0+(YB.laneGap!=null?YB.laneGap:.8);
/* yard.s : le tronçon mobile (rotatif) a deux faces, l'une porte le tronçon droit du circuit, l'autre un S vers la voie de garage (courbe de Bézier, première partie de la voie). Aiguillage EN AMONT de la zone de raccordement (yard.back, appareil à aiguillage seulement ; gare, ou toute zone de freinage dont les moteurs ont la marche arrière,
   SITE.zones.<zone>.drive:true, issue #38) : le train entre dans la voie de garage en MARCHE ARRIÈRE depuis cette zone, la voie se détache du circuit en amont.
   yard.a / yard.b = distances (m), mesurées en remontant le circuit depuis le point d'arrêt de l'avant du train dans la zone (ANCH), du bord de l'appareil
   le plus proche de la gare (a) et du bord le plus éloigné, la pointe où la voie se détache (b). La logique du moteur reste celle de l'aiguillage en aval (abscisse g de l'avant du
   train = recul depuis la gare) ; seule la géométrie change (carFrame) : le wagon k est à q=(k+.5)·CAR+g en amont de l'arrêt, orienté vers l'avant du circuit ; la voie de garage
   recopie d'abord le circuit sur la longueur de l'appareil (b−a), puis suit yard.lanes[].pts (le premier point est remplacé par la pointe).
   yard.rotary : appareil rotatif (un rail qui tourne sur lui-même autour de l'axe du tube) au lieu du tronçon coulissant : vue du dessus, le tronçon se resserre puis s'ouvre (largeur ∝ cos θ). */
const LBK=!TRAV&&!!YD.back,ROT=!TRAV&&!!YD.rotary;
const LBKW=LBK&&(YZ==='St'||ANCH<YD.b)?L:0,SW_A=TRAV?R0:LBK?ANCH-YD.b+LBKW:ANCH+YD.a,SW_B=TRAV?R1:LBK?ANCH-YD.a+LBKW:ANCH+YD.b,SW_D=YD.slide||0;
const SW0=(()=>{const f=frameAt(SW_A,mkF()),l=Math.hypot(f.R.x,f.R.z)||1;let tx=f.T.x,tz=f.T.z;
  if(TRAV){const b=frameAt(SW_B,mkF()).p,d=Math.hypot(b.x-f.p.x,b.z-f.p.z);tx=(b.x-f.p.x)/d;tz=(b.z-f.p.z)/d;} // rail droit : corde du circuit
  return {x:f.p.x,z:f.p.z,tx,tz,vx:-YD.side*f.R.x/l,vz:-YD.side*f.R.z/l};})(); // (vx,vz) : sens de coulissement du chariot (à l'opposé du garage)
/* Voies en arrière du chariot (traverser + YD.rev) : les voies partent du bord amont du chariot, parallèles au circuit, à contre-sens ;
   le train y entre en marche ARRIÈRE et en ressort en marche avant. Le moteur garde ses abscisses g (g croissant = vers le fond de la
   voie) ; seule la géométrie est retournée : l'avant du train est en u = 2·G_B − g (repère du chariot), son orientation ne change pas.
   laneU(g) : abscisse u (repère du chariot) d'un point de voie d'abscisse g, pour le dessin des voies fixes. */
const LREV=TRAV&&!!YD.rev,laneU=g=>LREV?2*G_B-VL-g:g;
const LANES=TRAV?YD.lanes.map((ln,j)=>{
  const end=U_LANE+(ln.len||VL+BUF+.2),path=[];for(let g=0;g<=end+.01;g+=.5){const u=laneU(g);path.push({x:SW0.x+SW0.tx*u-SW0.vx*ln.d,z:SW0.z+SW0.tz*u-SW0.vz*ln.d,d:g});}
  return {name:ln.name||'Voie '+(j+1),path,d:ln.d,dev:U_LANE,end,off:GAP-ln.d,cap:ln.cap||Math.max(1,Math.floor((end-U_LANE-VL)/GSTEP)+1)};
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
  const end=YD.a+acc-VL,dev=YD.a+link-2*VL; // butée : arrière du train au bout de la voie ; appareil franchi quand l'arrière a dépassé la pointe
  return {name:ln.name||'Voie '+(j+1),path,link,dev,end,off:ln.off!=null?ln.off:SW_D*(j+1),cap:ln.cap||Math.max(1,Math.floor((end-dev-VL)/GSTEP)+1)};
}):YD.lanes.map((ln,j)=>{
  const P0=[SW0.x,SW0.z],T0=[SW0.tx,SW0.tz],P=ln.pts,P1=P[0],k=ln.k||YD.k||3.6,path=[],raw=[];
  let md=[P[1][0]-P1[0],P[1][1]-P1[1]];const ml=Math.hypot(md[0],md[1]);md=[md[0]/ml,md[1]/ml];
  const c1=[P0[0]+T0[0]*k,P0[1]+T0[1]*k],c2=[P1[0]-md[0]*k,P1[1]-md[1]*k];
  for(let i=0;i<=36;i++){const t=i/36,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;raw.push([a*P0[0]+b*c1[0]+c*c2[0]+d*P1[0],a*P0[1]+b*c1[1]+c*c2[1]+d*P1[1]]);}
  for(let q=1;q<P.length;q++){const A=P[q-1],B=P[q],l=Math.hypot(B[0]-A[0],B[1]-A[1]);for(let d=.5;d<=l;d+=.5)raw.push([A[0]+(B[0]-A[0])*d/l,A[1]+(B[1]-A[1])*d/l]);if(q<P.length-1&&l%.5>.01)raw.push(B);}
  let acc=0,link=0;raw.forEach((q,i)=>{if(i)acc+=Math.hypot(q[0]-raw[i-1][0],q[1]-raw[i-1][1]);path.push({x:q[0],z:q[1],d:acc});if(i===36)link=acc;});
  const dev=YD.a+link,end=acc+YD.a; // abscisses g : sortie de l'appareil (début de la voie), butée
  return {name:ln.name||'Voie '+(j+1),path,link,dev,end,off:ln.off!=null?ln.off:SW_D*(j+1),cap:ln.cap||Math.max(1,Math.floor((end-dev-VL)/GSTEP)+1)};
});
// Point d'arrêt du train de tête dans chaque voie (avant du train) : BUF avant le butoir, sinon au moins 0,2 m au-delà de l'appareil ; capacité recalculée avec ce point.
LANES.forEach((l,j)=>{l.stop=Math.max(Math.min(l.end,l.dev+VL+.2),l.end-BUF);if(!YD.lanes[j].cap)l.cap=Math.max(1,Math.floor((l.stop-l.dev-VL)/GSTEP)+1);});
const PG=TRAV&&!SG?LANES.length+1:-1,PC=SG?0:PG; // position G du pont droit : rail B en ligne avec le circuit ; PC : position où le rail porteur raccorde le circuit (P si rail unique)
/* Rail A escamotable (traverser + YD.retract) : le rail A n'est pas porté par le chariot ; il a deux positions, sur le circuit
   (G.ra.pos 0, v=0) ou retiré (1, v=RET, du côté opposé au garage). Le chariot ne porte que le rail B : positions G et voies 1…n
   (pas de P). Verrouillages : le rail A ne revient que si le rail B n'est pas en ligne ; le rail B ne vient en ligne que si le
   rail A est retiré. */
/* Positions des rails mobiles réglées sur la carte de l'éditeur (osmrides#64, docs/manoeuvres.md « Positions des rails mobiles ») : SITE.yard.rails
   (écrit par l'éditeur dans GAME.site.yard.rails) = {circuit: {pos:[{name, d}, …]} | {lock:'garage'}, garage: {…}} ; d = distance (m) de l'axe du rail à l'axe
   du circuit, comptée vers le garage (comme yard.lanes[].d). Rails : 'circuit' = rail du circuit (rail A du pont, rail unique, tronçon droit de l'aiguillage),
   'garage' = rail du chariot (rail B) ou tronçon en S de l'aiguillage. lock = le rail bouge avec l'autre (chariot commun) ; aiguillage : toujours ensemble.
   Une position est en face du circuit ou d'une voie à RTOL près (sinon : « non connectée », le train ne peut ni entrer ni sortir) ; l'aiguillage relie la voie k à la
   position où son tronçon en S est en place (course yard.slide ou lanes[].off). Absent : positions d'origine (P, G, voies 1…n, yard.retract) inchangées. */
const RTOL=.3; // ESTIMÉ (m) ; l'éditeur aimante exactement
/* Format à groupes (osmrides#69, écrit par l'éditeur depuis 0.12) : {groups:[{rails:['circuit','garage'], pos:[{name, d:{circuit, garage}}, …]}, …]} ; un groupe = rails
   verrouillés ensemble (déplacés d'un bloc), chaque position donne la distance de chacun de ses rails. Ramené ici au format par rail ci-dessus (le rail du circuit porte
   les positions, l'autre lui est verrouillé) : une seule mécanique pour le pont transbordeur, le rail unique et l'aiguillage coulissant. */
const railsPerRail=R=>{if(!R||!Array.isArray(R.groups))return R;const o={};
  for(const g of R.groups){if(!g||!Array.isArray(g.rails)||!g.rails.length||!Array.isArray(g.pos))continue;const h=g.rails.includes('circuit')?'circuit':g.rails[0];
    o[h]={pos:g.pos.map(q=>({name:q&&q.name,d:q&&q.d&&+q.d[h]}))};for(const id of g.rails)if(id!==h)o[id]={lock:h};}
  return o;};
const RLS=YD.rails&&typeof YD.rails==='object'&&(TRAV||(YD.device==='switch'&&!LBK&&!ROT))?railsPerRail(YD.rails):null;
const rPos=id=>RLS&&RLS[id]&&Array.isArray(RLS[id].pos)&&RLS[id].pos.length?RLS[id].pos.filter(q=>q&&isFinite(q.d)):null;
const RLOCK=!!RLS&&(!!(RLS.circuit&&RLS.circuit.lock==='garage')||!!(RLS.garage&&RLS.garage.lock==='circuit'));
const RA=TRAV&&!SG&&(RLS&&rPos('circuit')&&!RLOCK?true:RLS&&RLOCK?false:!!YB.retract); // rail du circuit indépendant du chariot (escamotable)
const RAP=RA&&rPos('circuit'),RAX=RAP&&RAP.find(q=>Math.abs(q.d)>=RTOL)||null,RAI=RAP&&RAP.find(q=>Math.abs(q.d)<RTOL)||null;
const RET=RA?(RAX?-RAX.d:YB.retract&&YB.retract.d||GAP):0,RAN=RA&&YB.retract&&YB.retract.name||'Rail mobile du parcours',RAS=RA&&YB.retract&&YB.retract.short||'Rail parcours'; // nom complet (phrases), forme courte (plaques)
const RA_NM=[RAI?RAI.name:'sur le circuit',RAX?RAX.name:'retiré']; // noms des deux positions du rail du circuit escamotable
// Chariot (G.dev) : rail qui porte les positions enregistrées (CM) et décalage c du chariot pour chacune (rail A en v=c, rail B en v=c-GAP, rail unique ou aiguillage : v=c ; v=-d)
const CM=!RLS?null:SG||!TRAV?'circuit':RA?'garage':RLOCK&&!rPos('garage')?'circuit':'garage';
const CPOS=CM&&rPos(CM)?rPos(CM).map(q=>({name:String(q.name||''),c:-q.d+(TRAV&&!SG&&CM==='garage'?GAP:0)})):null;
const PX0=LANES.length+1+(TRAV&&!SG?1:0),POSX=[],POSN={}; // positions sans voie en face : indices PX0, PX0+1… (décalages POSX) ; POSN : noms enregistrés
const POS_REC=CPOS?(()=>{const R=[];
  for(const q of CPOS){let p=-1;
    if(TRAV){if(!RA&&Math.abs(q.c)<RTOL)p=0;else if(!SG&&Math.abs(q.c-GAP)<RTOL)p=PG;else{const j=LANES.findIndex(l=>Math.abs(q.c-(GAP-l.d))<RTOL);if(j>=0)p=j+1;}}
    else if(Math.abs(q.c)<RTOL)p=0;else{const j=LANES.findIndex(l=>Math.abs(q.c-l.off)<RTOL);if(j>=0)p=j+1;} // aiguillage : tronçon en S en place sur la voie j
    if(p<0){p=PX0+POSX.length;POSX.push(q.c);}
    if(!R.includes(p)){R.push(p);POSN[p]=q.name;}}
  const need=TRAV&&!SG?PG:0;if(!R.includes(need)){R.unshift(need);console.warn('SITE.yard.rails : aucune position ne raccorde le circuit ; position '+(need?'G':'P')+' ajoutée.');}
  return R;})():null;
function gFrame(j,u,o){
  const GP=LANES[j].path;u=clamp(u,0,GP[GP.length-1].d);let i=1;while(i<GP.length-1&&GP[i].d<u)i++;
  const a=GP[i-1],b=GP[i],k=(u-a.d)/((b.d-a.d)||1),l=Math.hypot(b.x-a.x,b.z-a.z)||1;
  o.p.set(lerp(a.x,b.x,k),Y_GAR,lerp(a.z,b.z,k));o.T.set((b.x-a.x)/l,0,(b.z-a.z)/l);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
const onCar=o=>TRAV&&o.st==='garage'&&o.g-VL<U_LANE-.01; // train (en partie) sur le chariot du pont droit
function trFrame(t,k,o){ // pont droit : voiture k d'un train sur le chariot ou sur une voie
  const u=LREV?2*G_B-t.g-(k+.5)*CAR:t.g-(k+.5)*CAR,v=t.lane>=0&&(LREV?u<=laneU(U_LANE)+.3:u>=U_LANE-.3)?-LANES[t.lane].d:devC()-GAP;
  o.p.set(SW0.x+SW0.tx*u+SW0.vx*v,Y_GAR,SW0.z+SW0.tz*u+SW0.vz*v);o.T.set(SW0.tx,0,SW0.tz);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
/* Règle de retenue avant l'appareil (propriétaire, 2026-11-15 : « le train peut partir de la gare si l'aiguillage est activé, tant qu'une zone de frein peut le mettre
   en attente avant » ; issue #36 : règle uniforme, quelle que soit la zone) : appareil hors de P, ou manœuvre de garage en cours, la DERNIÈRE zone d'attente avant
   l'appareil (HOLD_Z) retient le train. Candidates : la zone de raccordement YZ, puis chaque zone d'attente (WZ, ordre du circuit) dont le point d'arrêt est après celui
   de YZ (gare : après que le train l'a quittée, ANCH + VL) et à plus de 0,5 m avant l'appareil (SW_A). Si HOLD_Z est la gare, « retenir » = refuser le départ
   (blockReason) ; sinon la zone garde le train freiné (zone suivie d'un canton : cantonnement ; dernières zones : attente de la section suivante). Pont transbordeur droit : le
   train est retenu avant le chariot quand aucun rail n'est en ligne (S_PRE, circIn), HOLD_Z = null. DEV_HOLD : indice du frein de bloc HOLD_Z, sinon -1 (compatibilité). */
// distances mesurées vers l'aval depuis ANCH (dnS) : aiguillage en amont (yard.back), l'appareil est un tour de circuit plus loin, la zone de raccordement ne retient donc pas (issue #38)
const HOLD_Z0=TRAV?null:WZ.reduce((h,z)=>{const d=dnS(ANCH,zStop(z));return z!==YZ&&d>(YZ==='St'?VL:0)&&d<dnS(ANCH,SW_A)-.5&&(h===YZ||d>dnS(ANCH,zStop(h)))?z:h;},YZ);const HOLD_Z=HOLD_Z0===YZ&&LBK&&YZ!=='St'?'St':HOLD_Z0,HOLD_S=HOLD_Z?zStop(HOLD_Z):null;
const devHoldOn=()=>!!HOLD_Z&&(devOff()||VEHICULES.some(o=>yardBusy(o))),devHoldIn=z=>z===HOLD_Z&&devHoldOn();
const nearDev=o=>TRAV?onCar(o):o.st==='garage'&&o.g-VL<LANES[o.lane].dev+.5;   // train sur le circuit, la liaison ou l'appareil
const yardBusy=o=>o.st==='garage'&&(nearDev(o)||(o.mv<0&&devOn(o.lane))); // train qui occupe ou va occuper le point de raccordement
/* Cantonnement et garage (propriétaire, 2026-11-17 : « la présence d'un train sur le chariot doit bloquer les sections précédentes uniquement si le chariot est sur le parcours ») :
   pont droit, le train porté (ou qui entre / sort d'une voie) ne compte dans le dernier canton que si le rail porteur est en place sur le circuit (PC : G, ou P pour un rail unique).
   Chariot face à une voie ou en mouvement : il ne bloque pas ; le train qui arrive est alors retenu à la zone de freinage avant le pont (aucun rail en ligne, circIn), jamais dans le vide. */
// Canton qui mène à la zone de raccordement (issue #36) : se termine à son point d'arrêt (frein de bloc k : canton du frein k-1 ou du lift), ou à la fin du circuit
// (dernières zones de freinage : dernier canton, blkEnd = L). Un train de garage qui occupe ou va occuper le raccordement (yardBusy) occupe CE canton (b = fin du canton testé, absent : ce canton) ; gare : stationBusy.
const Y_CEND=YZ==='St'?null:ATT[YZ].bloc?ANCH:L;
const yardBlocks=(self,b)=>Y_CEND!=null&&(b==null||(Y_CEND>=L?b>=L:Math.abs(b-Y_CEND)<.01))&&(!TRAV||(!devMoving()&&G.dev.pos===PC))&&VEHICULES.some(o=>o!==self&&yardBusy(o));
const onRail=o=>o.st==='run'&&o.s>R0-2.5&&o.s-VL<R1&&!(o.v===0&&o.s<R0); // pont droit : train du circuit sur le chariot ou qui y roule
/* ══════════ MANŒUVRES DE GARAGE (docs/manoeuvres.md) : entrée, sortie, « Envoyer le train » d'une voie ══════════ */
const refuse=msg=>{log(msg,'warn');return false;};
// véhicule à l'arrêt au point de raccordement (zone YZ, issue #36) : à l'arrêt (gare), selon le type (aQuai) ; sinon arrêté au point d'arrêt ANCH de la zone
const atAnchor=t=>YZ!=='St'?(t.st==='run'&&t.v===0&&Math.abs(t.s-ANCH)<.4):fournit('aQuai',false,t);
const raccordLibre=t=>fournit('raccordLibre',true,t); // le raccordement peut recevoir t qui sort du garage (règle du type : cantons, arrêt)
const zoneDe=t=>fournit('zoneDe','',t); // zone où se trouve le véhicule (déclarée par le type)
const sameLane=t=>VEHICULES.filter(o=>o!==t&&o.st==='garage'&&o.lane===t.lane);
function fwdLim(t){if(t.lane<0)return t.g;let m=LANES[t.lane].stop;for(const o of sameLane(t))if(o.g>t.g)m=Math.min(m,o.g-GSTEP);return m;}
function backLim(t){
  if(TRAV){if(t.lane<0)return t.g;const m=U_LANE+VL; // pont droit : sortie de voie sur le rail B, s'il est en face et libre
    return t.g>=m-.01&&(!devOn(t.lane)||VEHICULES.some(o=>o!==t&&onCar(o)))?m:G_B;}
  const L_=LANES[t.lane];let m=0;for(const o of sameLane(t))if(o.g<t.g)m=Math.max(m,o.g+GSTEP);
  if(t.g-VL>=L_.dev-.01&&(!devOn(t.lane)||!raccordLibre(t)))m=Math.max(m,L_.dev+VL+.6); // reste sur sa voie, avant l'appareil
  return m;
}
function yardFwd(t){
  if(G.estop)return refuse(t.name+' : manœuvre refusée, arrêt d\'urgence enclenché.');
  if(TRAV&&t.st==='garage'&&t.lane<0){ // pont droit : du rail B vers la voie en face
    if(t.mv)return false;
    if(devMoving()||!posLane(G.dev.pos))return refuse(t.name+' : '+DEVL+' n\'est pas en place face à une voie de garage.');
    const j=G.dev.pos-1;if(VEHICULES.some(o=>o.st==='garage'&&o!==t&&o.lane===j))return refuse('Voie '+(j+1)+' ('+LANES[j].name+') occupée.');
    t.lane=j;t.mv=1;t.ld=1;log(t.name+' entre'+(LREV?' en marche arrière':'')+' sur '+posName(j+1)+'.');return true;
  }
  if(TRAV&&t.st!=='garage')return refuse(t.name+' : le chariot emporte le train. Pont sur G, train arrêté à vide sur le rail de garage, puis pont sur une voie libre.');
  if(t.st==='garage'){
    const L_=LANES[t.lane];
    if(t.mv>0)return false;
    if(t.g-VL<L_.dev-.01&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(fwdLim(t)-t.g<.05)return refuse(t.name+(t.g>=L_.stop-.05?' est déjà en bout de voie.':' est bloqué par le train garé devant lui.'));
    t.mv=1;t.ld=1;log(t.name+(LREV||LBK?' recule':' avance')+' vers le fond de '+posName(t.lane+1)+'.');return true;
  }
  if(!atAnchor(t))return refuse(t.name+' doit être arrêté '+(YZ==='St'?'en gare, à quai':ANCH_ON)+' pour quitter le circuit.');
  if(count(t)>0)return refuse(t.name+' a des passagers : il ne quitte jamais le circuit.');
  {const r=fournit('refusQuitter','',t);if(r)return refuse(r);} // motif propre au type (portillons, sécurités)
  if(devMoving())return refuse(DEVN+' en mouvement : '+t.name+' ne peut pas le franchir.');
  if(!G.dev.pos)return refuse(DEVN+' sur P : positionnez-le d\'abord sur une voie de garage.');
  if(!posLane(G.dev.pos))return refuse(DEVN+' sur '+posName(G.dev.pos)+' : positionnez-le d\'abord sur une voie de garage.');
  const j=G.dev.pos-1,n=VEHICULES.filter(o=>o.st==='garage'&&o.lane===j).length;
  if(n>=LANES[j].cap)return refuse('Voie '+(j+1)+' ('+LANES[j].name+') pleine ('+LANES[j].cap+' train'+(LANES[j].cap>1?'s':'')+').');
  if(VEHICULES.some(o=>o!==t&&nearDev(o)))return refuse('Manœuvre déjà en cours près de '+DEVL+'.');
  t.st='garage';t.lane=j;t.g=0;t.mv=1;t.ld=1;t.v=0;appel('quitteCircuit',t,false);
  log(t.name+(LBK?' recule '+('de '+ANCH_NAME).replace(/^de le /,'du ')+' vers ':' quitte le circuit vers ')+posName(j+1)+'.');return true;
}
function yardBack(t){
  if(G.estop)return refuse(t.name+' : manœuvre refusée, arrêt d\'urgence enclenché.');
  if(t.st!=='garage')return refuse(t.name+' est sur le circuit : la marche arrière ne sert qu\'à sortir du garage.');
  if(t.mv<0)return false;
  if(G.job&&G.job.t===t)return refuse(t.name+' est en révision.');
  const MR=SITE.maxRun||VEHICULES.length,run=VEHICULES.filter(o=>o.st!=='garage').length; // au plus SITE.maxRun VEHICULES sur le circuit
  if(run>=MR&&!sameLane(t).some(o=>o.g<t.g))return refuse('Déjà '+run+' VEHICULES sur le circuit (au plus '+MR+') : '+t.name+' reste au garage.');
  if(TRAV&&t.lane<0)return refuse(t.name+' est sur le chariot : positionnez '+DEVL+' sur '+posId(PC)+' pour le remettre sur le circuit.');
  const L_=LANES[t.lane],out=t.g-VL>=L_.dev-.01,lim=backLim(t);
  if(TRAV&&t.g-lim<.05)return refuse(t.name+' reste sur sa voie : '+(devOn(t.lane)?'le rail de garage est occupé.':DEVL+' n\'est pas en place face à '+posName(t.lane+1)+'.'));
  if(t.g-lim<.05){
    if(out&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(out&&!raccordLibre(t))return refuse(ANCH_NAME[0].toUpperCase()+ANCH_NAME.slice(1)+' n\'est pas libre : '+t.name+' reste au garage'+(ATT[YZ].conseil||'.'));
    return refuse(t.name+' est bloqué par un autre train garé derrière lui.');
  }
  t.mv=-1;t.ld=-1;log(t.name+(LREV||LBK?' avance':' recule')+(TRAV?' vers le rail de garage du pont.':lim<=0?' vers '+ANCH_NAME+'.':'.'));return true;
}
function updateYard(t,dt){
  if(!t.mv||G.estop)return;
  {const z=zoneDe(t);if(zK(z)){t.mv=0;log(t.name+' arrêté : freins de '+zName(z)+' serrés.','warn');return;}} // freins de la zone porteuse serrés au pupitre (les voies n'ont que des freins automatiques, issue #61)
  if(t.mv>0){const m=fwdLim(t);t.g=Math.min(m,t.g+MV.v*dt);
    if(t.g>=m-1e-6){t.mv=0;t.ld=0;log(t.g>=LANES[t.lane].stop-.05?t.name+' est garé en bout de '+posName(t.lane+1)+'.':t.name+' arrêté derrière le train garé devant lui.');}}
  else if(TRAV){const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=m+1e-6){t.mv=0;t.ld=0;if(m<=G_B+1e-6){t.lane=-1;log(t.name+' est sur le chariot. Positionnez '+DEVL+' sur '+posId(PC)+' pour le remettre sur le circuit.','good');}
      else log(t.name+' arrêté en sortie de voie : '+DEVL+' n\'est pas en place ou le rail de garage est occupé.','warn');}}
  else{const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=1e-6){t.g=0;t.mv=0;t.ld=0;t.seats.fill(null);appel('retourRaccord',t);} // revenu au raccordement : le type le remet dans sa zone
    else if(t.g<=m+1e-6){t.mv=0;log(t.name+' arrêté avant '+DEVL+(devOn(t.lane)?' : '+ANCH_NAME+' n\'est pas libre.':' : il n\'est pas en place.'),'warn');}}
}
/* « Envoyer le train » d'une voie de garage (propriétaire, issues #11 et #61) : un seul bouton par voie, le moteur choisit le sens d'après la position de l'appareil.
   Appareil en place sur la voie j : train arrêté en cours d'entrée → il reprend l'entrée ; train prêt sur la zone porteuse (train vide à quai / sur la zone de freinage,
   ou train sur le chariot d'un pont droit) et place dans la voie → il entre ; sinon le train de tête de la voie sort vers l'appareil (rail du pont, gare, zone de freinage).
   Freins des voies automatiques (aucun bouton de frein, issue #61), arrêt automatique en fin de mouvement ; verrouillages de yardFwd / yardBack inchangés. */
function laneDispatch(j){
  const N=zName('L'+(j+1));
  if(G.estop)return refuse(N+' : envoi refusé, arrêt d\'urgence enclenché.');
  if(devMoving())return refuse(N+' : '+DEVN+' en mouvement, attendez qu\'il soit en place.');
  if(!devOn(j))return refuse(N+' : '+DEVN+' n\'est pas en place sur cette voie : positionnez-le d\'abord sur '+posId(j+1)+'.');
  const inL=VEHICULES.filter(o=>o.st==='garage'&&o.lane===j);
  if(inL.some(o=>o.mv))return refuse(N+' : manœuvre déjà en cours.');
  const r=inL.find(o=>o.ld>0&&fwdLim(o)-o.g>.05);if(r)return yardFwd(r); // entrée interrompue : elle reprend
  {const x=inL.find(o=>o.ld<0);if(x)return yardBack(x);} // sortie interrompue (arrêt d'urgence, freins de la zone porteuse) : elle reprend
  const e=VEHICULES.find(o=>!o.mv&&(TRAV?o.st==='garage'&&o.lane<0:atAnchor(o))),room=TRAV?!inL.length:inL.length<LANES[j].cap;
  if(e&&room){const z=zoneDe(e);if(zK(z))return refuse('Freins de '+zName(z)+' serrés : relâchez-les pour que '+e.name+' entre dans '+N+'.');return yardFwd(e);}
  // zone porteuse à un seul train (propriétaire, issue #11 : « sur la voie chariot il n'y a la place que pour un train ») : si elle porte déjà un train,
  // « Envoyer le train » ne fait jamais sortir le train garé ; il ne peut que faire entrer le train porté, et refuse si la voie est pleine
  const carried=e||(TRAV&&VEHICULES.find(o=>o.st==='garage'&&!inL.includes(o)&&(o.lane<0||onCar(o))));
  if(carried)return refuse(N+' : '+zName(CARR).toLowerCase()+' porte déjà un train ('+carried.name+')'+(e===carried?', voie pleine : il n\'y entre pas':'')+(inL.length?', aucun train ne sort de la voie.':'.'));
  if(inL.length){const t=inL.slice().sort((a,b)=>a.g-b.g)[0];
    if(TRAV&&zK('RB'))return refuse('Freins de '+zName('RB').toLowerCase()+' serrés : aucun train ne sort de '+N+'.');
    return yardBack(t);}
  return refuse(N+' : aucun train à faire entrer ('+(TRAV?'aucun train sur le chariot':'aucun train vide arrêté '+ANCH_ON)+') ni à sortir.');
}
