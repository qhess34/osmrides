'use strict';
/* ══════════ VOIE : tronçons dessinés, supports, tunnels, gouttière, appareil de voie (préparés au chargement) ══════════ */
// Voie découpée en tronçons triés par hauteur (croisements dessus/dessous)
const TRO=Object.assign({lo:[150,156,164],hi:[198,204,210],edge:'#4a4f57',deck:'#565c65',rim:'#2f3339',shine:'rgba(255,255,255,.2)'},SITE.trough); // couleurs de la gouttière (bob), réglables par SITE.trough
// Coaster inversé (SITE.kind 'inverted') : poutre caisson en acier, deux rails de roulement, portiques de supports au-dessus de la voie, trains suspendus dessous.
// Couleurs par SITE.track = {spine, rail, support} (défaut : teintes acier sourdes).
// Coaster acier assis à rails tubulaires (SITE.kind 'steel') : deux rails tubulaires de roulement reliés par des entretoises, supports tubulaires en
// A au-dessus de 1,5 m (jambes écartées avec la hauteur), train posé sur la voie. Couleurs par SITE.track = {spine, rail, support}.
const TKC=Object.assign(STL?{spine:'#a88a2e',rail:'#c9a83c',support:'#8c3a2b'}:{spine:'#4a5d72',rail:'#2e3640',support:'#8c8577'},SITE.track),SUPW=2.3,WOODY=!BOB&&!INV&&!STL;
// tronçons du circuit en tunnel (OSM.tunnels, tunnels ESTIMÉS de SITE.tunnels). Tunnel sous un rocher (propriétaire, Trace du Hourra, 2026-11-16, lot 4 : les deux niveaux
// de voie passent DANS le rocher) : prolongé jusqu'aux bords du rocher (le tronçon OSM tagué tunnel peut être plus court que la traversée), portails au bord de la roche.
// Une voie sans aucun tunnel dans un rocher passe PAR-DESSUS (supports posés sur le rocher) : cas gardé pour un rocher OSM traversé sans tag tunnel.
const rockExt=t=>{const at=s=>{const q=TR[((Math.round(s/DS)%N)+N)%N].p;return ROCKP.find(P=>pipXZ(P,q.x,q.z));},R=at((t[0]+t[1])/2)||at(t[0])||at(t[1]);if(!R)return [t[0],t[1]];
  const inR=s=>{const q=TR[((Math.round(s/DS)%N)+N)%N].p;return pipXZ(R,q.x,q.z);};let a=t[0],b=t[1];while(a>t[0]-40&&inR(a-DS))a-=DS;while(b<t[1]+40&&inR(b+DS))b+=DS;return [a,b];};
// Polygones OSM man_made=tunnel (issue #42, propriétaire 20/11 : à Zeus, w1353118256 dessiné en tache brune qui débordait sur les voies voisines) : ils ne servent
// plus qu'à SITUER le tunnel. Tronçons du circuit dont le tracé est dans le polygone, regroupés en passages continus ; seul le passage le plus bas est couvert, avec ceux
// à moins de TPOLY_DH = 3 m (ESTIMÉ) au-dessus (une voie plus haute passe par-dessus le tunnel) ; passages de moins de 2 m ignorés. Un passage qui recoupe un tunnel
// OSM.tunnels ou SITE.tunnels {s} l'étend (réunion), sinon il devient un tunnel de plus, couvert le long de la voie comme les autres (drawTunnel ; eau ou rocher détectés comme pour OSM.tunnels, sinon galerie 'roof' ;
// SITE.tunnels:[{poly:'w123', under, w}] pour le régler).
const TPOLY_DH=3,TPOLY=OSM.feats.filter(f=>f.k==='man_made=tunnel'&&f.c&&f.p.length>3).flatMap(f=>{const runs=[];let r=null;
  for(let i=0;i<N;i++){const q=TR[i].p;if(pipXZ(f.p,q.x,q.z)){if(!r)runs.push(r={i0:i,i1:i,y:q.y});r.i1=i;r.y=Math.min(r.y,q.y);}else r=null;}
  if(runs.length>1&&runs[0].i0===0&&runs[runs.length-1].i1===N-1){const a=runs.shift(),b=runs[runs.length-1];b.i1=a.i1+N;b.y=Math.min(a.y,b.y);} // passage à cheval sur s = 0
  const lo=Math.min(...runs.map(r=>r.y));return runs.filter(r=>r.y<=lo+TPOLY_DH&&(r.i1-r.i0)*DS>=2).map(r=>({s:[r.i0*DS,r.i1*DS],id:f.id}));});
// liste commune des tunnels : [s0, s1, 'roof'?] et réglage SITE.tunnels (cf) ; polygones fondus dans le tunnel qu'ils recoupent
const TLIST=(function(){const CF=SITE.tunnels||[],cfO=CF.filter(c=>!c.s&&!c.poly),L=(OSM.tunnels||[]).map((r,ti)=>({r:rockExt(r).concat(r.slice(2)),cf:cfO[ti]||{}})).concat(CF.filter(c=>c.s).map(c=>({r:rockExt(c.s),cf:c})));
  for(const p of TPOLY){const o=L.find(t=>p.s[0]<=t.r[1]&&p.s[1]>=t.r[0]);if(o){o.r[0]=Math.min(o.r[0],p.s[0]);o.r[1]=Math.max(o.r[1],p.s[1]);}
    else L.push({r:rockExt(p.s),cf:Object.assign({dflt:'roof'},CF.find(c=>c.poly===p.id))});}
  return L;})();
const TUNS=TLIST.map(t=>t.r),inTunS=s=>TUNS.some(t=>s>=t[0]-1&&s<=t[1]+1);
const chunkH=new Float32Array(N+1),chunks=[],dirtP=new Path2D,wid=h=>BOB?1.5:INV?SUPW:h>ST_Y+.6?1.6+h*.2:1.85,DECKW=BOB?2.3:INV?1.05:STL?1.5:3.1;
// Bâtiment survolé par la voie (propriétaire, issue #14 : Au Dolmen Gourmand sous le lift de la Trace du Hourra) : quand la voie passe au-dessus de son emprise
// plus haut que lui partout (hauteur OSM `height`, sinon `building:levels` × 3 m, f.bh de tools/make_site.py ; sinon 7 m ESTIMÉ, 4 m un auvent, 12 m un hôtel),
// il est dessiné SOUS la voie, ses supports, les passerelles de service et les trains (drawWorld), l'ombre de la voie et des trains tombe sur son toit et les
// poteaux qui tombent dans son emprise sont posés sur le toit (raccourcis : supports moins écartés, ombre depuis le toit). Sinon l'ordre est inchangé.
// La gare, les toits effaçables (SITE.fade) et les bâtiments qui couvrent un chemin couvert gardent leur comportement.
const ROOFB=(()=>{ // BLD_H : engine/noyau/carte.js
  const near=(m,q)=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2],cv=(OSM.feats||[]).filter(f=>f.cv).map(f=>f.p),clr=INV?3.2:.4,hw=DECKW/2;
  const cand=(OSM.feats||[]).filter(f=>f.k.startsWith('building')&&f.c&&f.p.length>3).map(f=>({p:f.p,h:BLD_H(f.k,f)})).concat((SITE.buildings||[]).map(b=>({p:b.p,h:b.h||7})));
  return cand.filter(b=>{const m=[0,0];for(const q of b.p){m[0]+=q[0]/b.p.length;m[1]+=q[1]/b.p.length;}if(near(m,SITE.stationAt)||(SITE.fade||[]).some(q=>near(m,q))||cv.some(P=>P.some(q=>pipXZ(b.p,q[0],q[1]))))return false;
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of b.p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}b.bb=[x0,x1,z0,z1];
    let hit=0;for(let i=0;i<N;i++){const f=TR[i],q=f.p;if(q.x<x0-hw||q.x>x1+hw||q.z<z0-hw||q.z>z1+hw)continue;
      for(const e of [-hw,0,hw])if(pipXZ(b.p,q.x+f.R.x*e,q.z+f.R.z*e)){if(q.y<b.h+clr)return false;hit=1;}}
    return hit;});})(),roofH=(x,z)=>{for(const b of ROOFB)if(x>b.bb[0]&&x<b.bb[1]&&z>b.bb[2]&&z<b.bb[3]&&pipXZ(b.p,x,z))return b.h;return 0;};
// Gouttière étroite d'un bob (propriétaire, issue #6, générique kind:'bob') : là où la voie n'est pas inclinée — gare (st0 → st1 et toute la longueur des quais), lift (lift0 → lift1),
// zones de freinage (freins de bloc : patins BZ0 → point d'arrêt et train arrêté derrière ; frein final S_BRK → S_HOLD ; frein avant gare ; rail du pont droit R0 → R1)
// et voies de garage — la gouttière est rétrécie au gabarit du wagon (demi-largeur SITE.car.w/2 + BOB_RIM, engine/garage.js, ESTIMÉ) : le train touche le quai.
// Raccord progressif (courbe en S) sur TRN m à chaque extrémité. TRF(s) = facteur de largeur (1 = gouttière inclinée du parcours, demi-largeur 1,15 m). TRN = 3 m, ESTIMÉ.
const TRN=3,TRGAP=2*TRN+4,TRFN=BOB?Math.min(1,((SITE.car.w||.95)/2+BOB_RIM)/(DECKW/2)):1,TRF=(()=>{if(!BOB)return ()=>1;const Q=Object.assign({back:1.5,front:1.6},SITE.plat),fn=TRFN,
  R=[[Math.min(TAG.st0||0,S_ST-TLEN-Q.back),Math.max(TAG.st1!=null?TAG.st1:S_ST,S_ST+Q.front)]];
  R.push([S_LIFT0,S_LIFT1]);BLK.forEach((b,i)=>R.push([Math.min(BZ0[i],b-TLEN),b+.5]));
  if(TAG.brk!=null)R.push([S_BRK,Math.max(S_HOLD,TRAV?R1:S_HOLD)+.5]);if(TRAV)R.push([R0-.5,R1+.5]);if(PSB)R.push([Math.min(PSB_A,S_PSB-TLEN),S_PSB+.5]);
  // Zones étroites rapprochées (propriétaire, 2026-11-17) : si l'écart entre deux zones étroites est inférieur à TRGAP, la gouttière reste étroite entre elles
  // (pas de court renflement à pleine largeur entre deux raccords en S). TRGAP = 2 raccords + 4 m = 10 m, ESTIMÉ.
  const I=R.map(r=>{const a=((r[0]%L)+L)%L;return [a,a+(r[1]-r[0])];}).sort((p,q)=>p[0]-q[0]),J=[];
  for(const r of I){const c=J[J.length-1];if(c&&r[0]-c[1]<TRGAP)c[1]=Math.max(c[1],r[1]);else J.push(r.slice());}
  if(J.length>1){const a=J[J.length-1],b=J[0];if(b[0]+L-a[1]<TRGAP){b[0]=a[0]-L;b[1]=Math.max(b[1],a[1]-L);J.pop();}} // écart à cheval sur l'origine du circuit
  const M=J.map(r=>[(r[0]+r[1])/2,(r[1]-r[0])/2]);
  return s=>{let d=1e9;for(const m of M){const e=Math.abs(((s-m[0])%L+L*1.5)%L-L/2)-m[1];if(e<d)d=e;}if(d<=0)return fn;if(d>=TRN)return 1;const k=d/TRN;return fn+(1-fn)*k*k*(3-2*k);};})();
/* Espace balayé par l'appareil de voie (issue lot 14 ; issue #20 : partagé par les passerelles CATW et les poteaux de la voie) : pont droit = fosse du chariot
   (SWP[0]) et emprise des voies de garage (SWP[1]) ; aiguillage / table / rotatif = couloir autour du tronçon mobile SW_A → SW_B. inSweep(x, z, r, pit) : pit = fosse seule. */
const SWP=TRAV?(()=>{const dM=Math.max(...LANES.map(l=>l.d)),dm=Math.min(...LANES.map(l=>l.d)),vA=(RA?RET:GAP)+1.5,vB=-dM-1.6,Lr=R1-R0,
    gu0=LREV?laneU(LANES[0].end)-1:U_LANE-.4,gw=LANES[0].end-U_LANE+1.4;return [[-.7,Lr+.7,vB,vA],[gu0,gu0+gw,vB,-dm+1.6]];})()
  :(()=>{const P=[];for(let s=SW_A;s<=SW_B+1e-6;s+=.5){const f=TR[((Math.round(s/DS)%N)+N)%N].p;P.push([f.x,f.z]);}return P;})();
const inSweep=(x,z,r,pit)=>{if(TRAV){const dx=x-SW0.x,dz=z-SW0.z,u=dx*SW0.tx+dz*SW0.tz,v=dx*SW0.vx+dz*SW0.vz;return (pit?SWP.slice(0,1):SWP).some(b=>u>b[0]-r&&u<b[1]+r&&v>b[2]-r&&v<b[3]+r);}
  const lim=SW_D+1.5+r;return SWP.some(q=>Math.hypot(q[0]-x,q[1]-z)<lim);};
/* Poteaux de la voie (issue #20, propriétaire : « il manque les supports sur la dernière partie avec les zones de freinage ») : une voie inversée ou acier (INV, STL)
   reçoit ses supports dès qu'elle est à plus de 1,5 m au-dessus du sol ou du toit survolé (yg), et non plus seulement 1,5 m au-dessus de la GARE : sur OzIris
   la gare est à 4 m (train suspendu), donc frein final, rail du pont et attente avant gare (4 m) n'en avaient aucun. Exclus : l'emprise de la gare (voie tenue par
   le bâtiment), le tronçon porté par l'appareil de voie (sm.dev) et l'espace qu'il balaie (inSweep). Coaster inversé : poteau du côté libre (l'autre si le premier
   tombe dans l'espace balayé, une voie de garage ou sur une voie plus basse), aucun si les deux côtés sont pris. Bois et bob : inchangés. */
const STPL=STATION_GROW||SITE.stationPoly||[],poleFree=(x,z,y,s,low)=>{if(STPL.length>2&&pipXZ(STPL,x,z)||inSweep(x,z,.3))return false;if(!low)return true;
  for(let j=0;j<N;j+=2){const q=TR[j].p;if(q.y>y-1||Math.abs(((j*DS-s)%L+L*1.5)%L-L/2)<14)continue;if(Math.abs(q.x-x)<1.8&&Math.abs(q.z-z)<1.8&&Math.hypot(q.x-x,q.z-z)<1.8)return false;}return true;};
/* Emprise de la gare et des quais (issue #23, propriétaire, Zeus : « les garde-corps du coaster sont visibles en station ») : aucun garde-corps ni longeron
   de charpente de la voie (bois : lignes à ±1,5 m et ±wid, traverses de structure) dans le bâtiment de gare (STPL), sur les quais (de l'arrière du dernier wagon + plat.back
   à l'avant du premier + plat.front, de −plat.exit à plat.load ; côté sans quai de débarquement : jusqu'au gabarit de la charpente) ni dans la zone d'attente éditée (BAREA).
   Générique, tous les kinds (acier et inversé : supports déjà exclus de la gare par poleFree ; bob : gouttière rétrécie au gabarit en gare, TRF). */
const NORAIL=(()=>{const P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2,lo=-(P.exit||2.2)-.3,hi=P.load+.3; // repère de la travée la plus proche (gare courbe)
  return (x,z)=>{if(STPL.length>2&&pipXZ(STPL,x,z))return true;if(BAREA&&pipXZ(BAREA,x,z))return true;
    let k=0,d=1e9;BAYS.forEach((b,j)=>{const e=Math.hypot(x-b.x,z-b.z);if(e<d){d=e;k=j;}});const b=BAYS[k],dx=x-b.x,dz=z-b.z,u=dx*b.tx+dz*b.tz,v=dx*b.rx+dz*b.rz;
    return u>(k===NCARS-1?-bk:-CAR)&&u<(k===0?P.front:CAR)&&v>lo&&v<hi;};})();
function strip(sm){
  const o={h:0,sw:0,deck:new Path2D,spine:new Path2D,rail:new Path2D,hand:new Path2D,ties:new Path2D,str:new Path2D,sh:new Path2D,shb:new Path2D,rp:null,ch:null,bu:[],x0:1e9,x1:-1e9,z0:1e9,z1:-1e9},n=sm.length;
  const yg=q=>q.y-roofH(q.x,q.z),SB=q=>roofH(q.x,q.z); // yg : hauteur au-dessus du sol ou du toit d'un bâtiment survolé (ROOFB) ; SB : hauteur du pied du poteau (son ombre part de là)
  const side=(path,off,fn,mk)=>{let pen=false;sm.forEach(q=>{const k=fn?fn(yg(q))*off:off,x=q.x+q.nx*k,z=q.z+q.nz*k;if(mk&&NORAIL(x,z)){pen=false;return;}pen?path.lineTo(x,z):path.moveTo(x,z);pen=true;});}; // mk : interrompu dans la gare et sur les quais (NORAIL)
  let hs=0,uy=0;
  sm.forEach((q,i)=>{
    const sx=q.x+q.y*SHX,sz=q.z+q.y*SHZ;hs+=q.y;uy+=q.uy==null?1:q.uy;
    {const sp=STL?.42:0,x=q.x-(q.ux||0)*sp,z=q.z-(q.uz||0)*sp;i?o.spine.lineTo(x,z):o.spine.moveTo(x,z);} // poutre (tube central sous les rails) : vue du dessus, elle se déporte quand la voie pivote (vrilles, loopings)
    o.x0=Math.min(o.x0,q.x-9);o.x1=Math.max(o.x1,sx+9);o.z0=Math.min(o.z0,q.z-9);o.z1=Math.max(o.z1,sz+9);
    if(i){o.deck.lineTo(q.x,q.z);o.sh.lineTo(sx,sz);}else{o.deck.moveTo(q.x,q.z);o.sh.moveTo(sx,sz);}
    if(ROCKP.length&&q.i%4===0&&i<n-1&&sm.trk&&!inTunS(q.i*DS)&&ROCKP.some(P=>pipXZ(P,q.x,q.z))){ // voie qui passe AU-DESSUS d'un rocher : traverse et deux poteaux posés sur le rocher, dessinés avec le tronçon
      const w=(INV?SUPW:BOB?1.25:wid(q.y)*.7)+.15;o.rp=o.rp||new Path2D;o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      for(const e of [-1,1])o.rp.rect(q.x+q.nx*w*e-.22,q.z+q.nz*w*e-.22,.44,.44);}
    if(WOODY&&q.i%2===1){o.ties.moveTo(q.x-q.nx*.9,q.z-q.nz*.9);o.ties.lineTo(q.x+q.nx*.9,q.z+q.nz*.9);}
    if(STL){if(q.i%3===0){o.ties.moveTo(q.x-q.nx*.62,q.z-q.nz*.62);o.ties.lineTo(q.x+q.nx*.62,q.z+q.nz*.62);} // entretoises entre les deux rails tubulaires
      if(i<n-1&&q.i%10===0&&!sm.dev&&yg(q)>1.5&&poleFree(q.x,q.z,q.y,q.i*DS)){const sp=.55+Math.min(yg(q),40)*.07,gb=SB(q); // support en A : deux jambes qui s'écartent vers le sol, traverse à mi-hauteur
        for(const e of [-1,1]){const bx=q.x+q.nx*sp*e,bz=q.z+q.nz*sp*e;o.str.moveTo(q.x+q.nx*.45*e,q.z+q.nz*.45*e);o.str.lineTo(bx,bz);o.shb.moveTo(bx+gb*SHX,bz+gb*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}
        o.hand.moveTo(q.x-q.nx*sp*.7,q.z-q.nz*sp*.7);o.hand.lineTo(q.x+q.nx*sp*.7,q.z+q.nz*sp*.7);}}
    if(STL){}else if(INV){let e=(q.i/13)%2?1:-1;if(i<n-1&&q.i%13===0&&!sm.dev&&yg(q)>1.5&&(poleFree(q.x+q.nx*SUPW*e,q.z+q.nz*SUPW*e,q.y,q.i*DS,1)||poleFree(q.x-q.nx*SUPW*e,q.z-q.nz*SUPW*e,q.y,q.i*DS,1)&&(e=-e))){const w=SUPW*e,tx=q.nz,tz=-q.nx,bx=q.x+q.nx*w,bz=q.z+q.nz*w; // support en potence : poteau d'un côté (alterné), bras au-dessus de la voie
      o.str.moveTo(bx,bz);o.str.lineTo(q.x-q.nx*.6*e,q.z-q.nz*.6*e);o.hand.moveTo(bx-tx*.35,bz-tz*.35);o.hand.lineTo(bx+tx*.35,bz+tz*.35);o.shb.moveTo(bx+SB(q)*SHX,bz+SB(q)*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
    else if(i<n-1&&q.i%(BOB?12:6)===0&&(BOB||!NORAIL(q.x,q.z))){const w=wid(yg(q))*(BOB?sm.trk?TRF(q.i*DS):TRFN:1);o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      if(!BOB&&q.y>7.5&&i+6<n){const b=sm[i+6],w2=wid(yg(b)),e=(q.i/6)%2?1:-1;o.str.moveTo(q.x-q.nx*w*e,q.z-q.nz*w*e);o.str.lineTo(b.x+b.nx*w2*e,b.z+b.nz*w2*e);}
      for(const sg of (BOB?[0]:[-1.25,1.25])){const bx=q.x+q.nx*sg,bz=q.z+q.nz*sg,gb=SB(q);o.shb.moveTo(bx+gb*SHX,bz+gb*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
  });
  if(BOB){const f=sm.map(q=>sm.trk?TRF(q.i*DS):TRFN); // voies de garage (hors circuit) : étroites
    if(f.some(v=>v<.999)){ // tronçon de gare, de freinage, de garage (ou de raccord) : gouttière en polygones de largeur variable (TRF), dessinée par remplissage
      const poly=W=>{const p=new Path2D;sm.forEach((q,i)=>{const k=W*f[i];i?p.lineTo(q.x-q.nx*k,q.z-q.nz*k):p.moveTo(q.x-q.nx*k,q.z-q.nz*k);});
        for(let i=n-1;i>=0;i--){const q=sm[i],k=W*f[i];p.lineTo(q.x+q.nx*k,q.z+q.nz*k);}p.closePath();return p;};
      o.lay=[poly(DECKW/2),poly(1),poly(.45)];for(const e of [-1,1])sm.forEach((q,i)=>{const k=1.02*e*f[i],x=q.x+q.nx*k,z=q.z+q.nz*k;i?o.rail.lineTo(x,z):o.rail.moveTo(x,z);});}
    else{side(o.rail,-1.02);side(o.rail,1.02);}} // bords de la gouttière
  else if(INV){side(o.rail,-.5);side(o.rail,.5);} // rails de roulement de part et d'autre de la poutre caisson
  else if(STL){side(o.rail,-.62);side(o.rail,.62);} // deux rails tubulaires
  else{side(o.rail,-.6);side(o.rail,.6);side(o.hand,-1.5,0,1);side(o.hand,1.5,0,1);side(o.str,-1,wid,1);side(o.str,1,wid,1);} // bois : garde-corps et longerons interrompus dans la gare et sur les quais (NORAIL, issue #23)
  o.h=hs/n;o.inv=uy/n<0;const k=clamp(o.h/30,0,1); // o.inv : tronçon tête en bas (la poutre passe au-dessus des rails)o.col=BOB?`rgb(${lerp(TRO.lo[0],TRO.hi[0],k)|0},${lerp(TRO.lo[1],TRO.hi[1],k)|0},${lerp(TRO.lo[2],TRO.hi[2],k)|0})`:`rgb(${lerp(172,198,k)|0},${lerp(146,170,k)|0},${lerp(104,124,k)|0})`;
  return o;
}
const BZ=[],LCH=[]; // zones de freinage dessinées : {id, r0, r1, drive} ; LCH[j] : tronçon dessiné de la voie de garage j
(function buildChunks(){
  for(let i=0;i<=N;i++){const p=TR[i%N].p;i?dirtP.lineTo(p.x,p.z):dirtP.moveTo(p.x,p.z);}
  const iA=Math.round(SW_A/DS),iB=Math.round(SW_B/DS),cuts=new Set([iA,iB,N]);for(let i=0;i<N;i+=8)cuts.add(i);
  const cl=[...cuts].sort((a,b)=>a-b);
  for(let c=0;c<cl.length-1;c++){const sm=[];
    for(let i=cl[c];i<=cl[c+1];i++){const f=TR[i%N];sm.push({x:f.p.x,y:f.p.y,z:f.p.z,nx:f.R.x,nz:f.R.z,ux:f.U.x,uz:f.U.z,uy:f.U.y,i});} // R projeté (non normalisé) : vue du dessus, la voie qui pivote (dévers, vrilles, loopings) se resserre, largeur ∝ |cos θ|
    sm.trk=1;sm.dev=cl[c]>=iA&&cl[c+1]<=iB&&iA<iB;const o=strip(sm);o.sw=cl[c]>=iA&&cl[c+1]<=iB?1:0;chunks.push(o);
    if(!o.sw&&cl[c+1]!==iA){const a=TR[cl[c+1]%N].p,f=TR[(cl[c+1]+1)%N].p;o.deck.lineTo((a.x+f.x)/2,(a.z+f.z)/2);}
    for(let i=cl[c];i<cl[c+1];i++)chunkH[i]=o.h;}
  // tronçon en S (mobile) et voie de garage
  const grow=o=>{const e=CMAX+GAP+3;o.x0-=e;o.x1+=e;o.z0-=e;o.z1+=e;return o;}; // tronçons portés : visibles sur toute la course
  if(TRAV){ // pont droit : rail B porté par le chariot (décalé de devC()-GAP), voies droites fixes ; le rail A est le tronçon du circuit (sw)
    chunks.forEach(o=>{if(o.sw)grow(o);});
    const line=(u0,u1,v)=>{const q=[],n=Math.max(1,Math.ceil((u1-u0)/.5-.02));for(let k=0;k<=n;k++){const u=u0+(u1-u0)*k/n;q.push({x:SW0.x+SW0.tx*u-SW0.vx*v,y:ST_Y,z:SW0.z+SW0.tz*u-SW0.vz*v,nx:-SW0.tz,nz:SW0.tx,i:q.length});}return q;};
    if(!SG){const L0=line(0,R1-R0,0);L0.dev=1;const rb=strip(L0);rb.rb=1;chunks.push(grow(rb));} // rail unique (SG) : le tronçon du circuit est le seul rail porté
    // Voies fixes dessinées jusqu'au bout du rail porté (issue #16, propriétaire : « pas continus ») : comme le circuit, la voie fixe s'arrête à 4 cm du rail du chariot
    // (u = R1-R0 ou 0) et le tablier passe dessous ; le jeu de la simulation (yard.laneGap, U_LANE) est inchangé, seul le dessin comble l'écart.
    LANES.forEach((ln,j)=>{const o=strip(LREV?line(laneU(ln.end),-.04,ln.d):line(R1-R0+.04,ln.end,ln.d));LCH[j]=o;chunks.push(o);}); // yard.rev : voies en amont du chariot
  }else LANES.forEach((ln,j)=>{const GP=ln.path,gs=GP.map((q,i)=>{const a=GP[Math.max(0,i-1)],b=GP[Math.min(GP.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:q.x,y:ST_Y,z:q.z,nx:-(b.z-a.z)/l,nz:(b.x-a.x)/l,i};});
    const nl=LBK?Math.round(ln.link/.5):36,gl=gs.slice(0,nl+1);gl.dev=1;const sP=strip(gl);sP.lk=j+1;LCH[j]=strip(gs.slice(nl));LCH[j].nl=nl;chunks.push(sP,LCH[j]);});
  // Voies décoratives (OSM.deco, tools/make_site.py, issue #33, propriétaire 20/11) : tronçons roller_coaster=track non reliés au circuit, dessinés comme la voie
  // du site (même kind), immobiles : aucun train, aucune zone, aucun frein ; posés à la hauteur de la gare (ESTIMÉ, OSM ne donne pas leur hauteur).
  for(const d of OSM.deco||[]){const P=d.p||d;if(!P||P.length<2)continue;const cum=[0];for(let k=1;k<P.length;k++)cum.push(cum[k-1]+Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]));
    const L=cum[cum.length-1],n=Math.max(1,Math.round(L/.5)),gs=[];let j=0;
    for(let k=0;k<=n;k++){const u=L*k/n;while(j<P.length-2&&cum[j+1]<u)j++;const l=(cum[j+1]-cum[j])||1,f=(u-cum[j])/l,tx=(P[j+1][0]-P[j][0])/l,tz=(P[j+1][1]-P[j][1])/l;
      gs.push({x:P[j][0]+(P[j+1][0]-P[j][0])*f,y:ST_Y,z:P[j][1]+(P[j+1][1]-P[j][1])*f,nx:-tz,nz:tx,i:k});}
    const o=strip(gs);o.deco=1;chunks.push(o);}
  // Chaîne du lift et équipements de freinage : rattachés à leur tronçon (dessinés avec lui), donc toujours SOUS les trains qui y passent et sous les voies plus hautes
  const cOf=new Int32Array(N+1);for(let c=0;c<cl.length-1;c++)for(let i=cl[c];i<cl[c+1];i++)cOf[i]=c;
  const lc0=Math.round(S_LIFT0/DS),lc1=Math.round((S_LIFT1+3)/DS);
  for(let c=0;c<cl.length-1;c++){const a=Math.max(cl[c],lc0),b=Math.min(cl[c+1],lc1);if(a>=b)continue;const P=new Path2D;for(let i=a;i<=b;i++){const p=TR[i%N].p;i>a?P.lineTo(p.x,p.z):P.moveTo(p.x,p.z);}chunks[c].ch=P;}
  const zc=id=>ZONES.find(z=>z.id===id)||{};
  // zones de freinage dessinées (gare, freins de bloc ≈ 9 m de patins avant le point d'arrêt (estimé), frein final, rail du circuit du pont droit, frein avant gare) ; moteurs : SITE.zones … drive
  BZ.push({id:'St',r0:S_ST-TLEN+.4,r1:S_ST-.2});BLK.forEach((b,i)=>BZ.push({id:'B'+(i+1),r0:BZ0[i],r1:b}));
  BZ.push({id:'Fin',r0:S_BRK+3,r1:TRAV?S_PRE+.4:S_HOLD});if(TRAV)BZ.push({id:ZR,r0:R0+.3,r1:R1-.3});if(PSB)BZ.push({id:'Pre',r0:PSB_A+1,r1:S_PSB});
  if(TRAV&&!SG)BZ.push({id:'RB',r0:0,r1:0,car:1});
  for(const z of BZ)z.drive=!!zc(z.id).drive;
  LANES.forEach((_,j)=>BZ.push({id:'L'+(j+1),lane:j,drive:true})); // voies de garage : freins et pneus (Dispatch) sur toute la voie, comme le circuit (issue #16 ; disposition ESTIMÉE)
  const onDev=s=>!TRAV&&s>SW_A-1&&s<SW_B+1; // rien sur l'aiguillage lui-même (tronçon mobile)
  for(const z of BZ){let k=0;const add=(o,u)=>{u.id=z.id;u.ty=z.drive&&k%2===1;o.bu.push(u);k++;};
    if(z.lane!=null){const ln=LANES[z.lane],P=ln.path,o=LCH[z.lane];if(!o)continue; // voie : de son entrée (TRAV : U_LANE ; aiguillage : après le tronçon mobile) au heurtoir
      for(let i=TRAV?0:o.nl+1;i<P.length-1;i+=3){const q=P[i];if(TRAV&&(q.d<U_LANE+.3||q.d>ln.end-.6))continue;const a=P[Math.max(0,i-1)],b=P[i+1],l=Math.hypot(b.x-a.x,b.z-a.z)||1,tx=(b.x-a.x)/l,tz=(b.z-a.z)/l;
        add(o,{x:q.x,z:q.z,nx:-tz,nz:tx,tx,tz});}continue;}
    if(z.car){const rb=chunks.find(o=>o.rb);for(let u=.6;u<R1-R0-.3;u+=1.5)add(rb,{x:SW0.x+SW0.tx*u,z:SW0.z+SW0.tz*u,nx:-SW0.tz,nz:SW0.tx,tx:SW0.tx,tz:SW0.tz});continue;} // rail du chariot (pont droit à deux rails)
    for(let i=Math.round(z.r0/DS);i<Math.round(z.r1/DS);i+=3){const ii=((i%N)+N)%N;if(onDev(ii*DS))continue;const f=TR[ii],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(f.T.x,f.T.z)||1;
      add(chunks[cOf[ii]],{x:f.p.x,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:f.T.x/tl,tz:f.T.z/tl});}}
})();
const swz=o=>o.sw===1?raC():o.rb?devC()-GAP:o.lk?devC()-OFF[o.lk]:0; // déplacement des tronçons portés par le chariot (circuit, transfert vers la voie lk), le long de (SW0.vx, SW0.vz)
const rotC=()=>Math.cos(Math.PI*clamp(devC()/(SW_D||1),0,1)); // appareil rotatif : cos θ, θ = 0 sur le circuit, π sur la voie
const devHide=o=>o.lk&&YD.device==='table'&&o.lk!==devShown()||ROT&&(o.sw===1?rotC()<0:o.lk?rotC()>0:false)||ROT&&o.lk&&o.lk!==devShown();
// décalage ou rotation des tronçons portés par l'appareil ; rend true si un ctx.save() a été fait
function swPush(o){
  if(ROT){const c=(o.sw===1?rotC():o.lk?-rotC():1);if(c===1)return false;const a=1+(c-1)*SW0.vx*SW0.vx,b=(c-1)*SW0.vx*SW0.vz,d=1+(c-1)*SW0.vz*SW0.vz;
    ctx.save();ctx.translate(SW0.x,SW0.z);ctx.transform(a,b,b,d,0,0);ctx.translate(-SW0.x,-SW0.z);return true;} // un rail qui tourne autour de son axe vu du dessus : largeur ∝ cos θ
  const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);return true;}return false;} // pont transbordeur : un seul tronçon de transfert, celui de la voie visée

// Dégagement des portillons (propriétaire, OzIris, 2026-11-18, issue #19, générique) : le bord d'une allée de file visible (pas un couloir couvert) qui longe le quai
// d'embarquement reste à QGATE_CLR au moins de la ligne des portillons (PGATE) ; sinon l'allée est rétrécie à cet endroit, jusqu'à QGATE_WMIN au plus étroit (axe OSM
// conservé : si cela ne suffit pas, l'allée reste à QGATE_WMIN). QGATE_CLR = profondeur des travées d'attente
// GDEPTH + 0,2 m, ESTIMÉ (aucune allée ne touche la zone des portillons) ; QGATE_WMIN = 0,6 m, ESTIMÉ (une personne de face). Aucune mesure : à confirmer.
const QGATE_CLR=GDEPTH+.2,QGATE_WMIN=.6; // 2e demande (2026-11-18) : dégagement = profondeur des travées d'attente (GDEPTH, engine/garage.js) + 0,2 m, ESTIMÉ, GDEPTH réglable (GAME.board.depth, issue #27, lu au chargement)
function gateClear(S){for(const q of S){for(const b of BAYS){const dx=q.x-b.x,dz=q.z-b.z,u=dx*b.tx+dz*b.tz;if(Math.abs(u)>CAR/2+.3)continue;
  const lat=dx*b.rx+dz*b.rz;if(lat<PGATE||COV.some(P=>onPl(q,P,.3)))break;const m=2*(lat-PGATE-QGATE_CLR);if(q.w>m)q.w=Math.max(QGATE_WMIN,Math.min(q.w,m));break;}}}

/* Ce que le décor du noyau (engine/noyau/decor.js) demande à la couche : voie, garage, quais, gare */
extension({nom:'montagnes-russes',
  surVoieDeGarage(pts){if(!LANES.length||!pts.length)return false;let n=0;for(const q of pts)if(LANES.some(l=>l.path.some(r=>(r.x-q[0])**2+(r.z-q[1])**2<2.25)))n++;return n*2>=pts.length;}, // voie voisine OSM qui suit une voie de garage
  couvreVoie:pts=>LANES.some(l=>(l.path||[]).some(q=>pipXZ(pts,q.x,q.z))), // remise au-dessus d'une voie de garage (toit effaçable)
  sousVoie:p=>ROOFB.some(r=>r.p===p), // bâtiment survolé par la voie (ROOFB)
  pointsAbri(){const PQ=Object.assign({load:7.9,exit:0},SITE.plat),out=[];for(const B of BAYS)for(const l of [PQ.load/2,PQ.load-.3,-PQ.exit/2])if(l)out.push([B.x+B.rx*l,B.z+B.rz*l]);return out;}, // quais : un toit au-dessus est un abri
  presDeLaVoie(x,z,r){for(let i=0;i<N;i+=6){const p=TR[i].p;if((p.x-x)**2+(p.z-z)**2<r*r)return true;}for(const ln of LANES)for(let i=0;i<ln.path.length;i+=4){const p=ln.path[i];if((p.x-x)**2+(p.z-z)**2<(r+1.5)**2)return true;}return Math.hypot(x-SW0.x-SW0.tx*4.5,z-SW0.z-SW0.tz*4.5)<10+r;}, // pas d'arbre
  gareAgrandie:()=>STATION_GROW,
  degagement(S){gateClear(S);},
  horsGardeCorps:(x,z)=>BAYS.some(b=>{const dx=x-b.x,dz=z-b.z,u=dx*b.tx+dz*b.tz,lat=dx*b.rx+dz*b.rz;return Math.abs(u)<CAR/2&&lat>PGATE-.05&&lat<PGATE+GDEPTH+.05;}), // travées d'attente
  hauteurRocher(P){let ty=-1,tu=-1,to=1e9;for(let i=0;i<N;i+=2){const q=TR[i].p;if(pipXZ(P,q.x,q.z)){ty=Math.max(ty,q.y);if(inTunS(i*DS))tu=Math.max(tu,q.y);else to=Math.min(to,q.y);}}return {ty,tu,to};},
  angleQuai:()=>BAYS.length?Math.round(Math.atan2(BAYS[0].tz,BAYS[0].tx)*180/Math.PI)+90:0}); // lames et joints du quai en travers de la voie
