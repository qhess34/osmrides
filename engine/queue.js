'use strict';
/* ══════════ VISITEURS (chemins réels : accès, file, sortie) ══════════ */
const SP=.42,QS=SITE.queue,ENTRY0=QS.entry0,ENTRY_GATE=Object.assign({t:1},QS.gate); // gate.a : fermé en travers du chemin, gate.b : ouvert le long de la bordure
function pathPos(P,C,d,o,side){
  d=clamp(d,0,C[C.length-1]);let i=1;while(i<C.length-1&&C[i]<d)i++;
  const a=P[i-1],b=P[i],k=(d-C[i-1])/((C[i]-C[i-1])||1),dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
  o.x=a[0]+dx*k-dz/l*side;o.z=a[1]+dz*k+dx/l*side;o.y=0;return o;
}
// Distance d'un point à une polyligne [[x,z]…].
const dPl=(x,z,P)=>{let m=1e9;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1e-9,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/l,0,1);m=Math.min(m,Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z));}return m;};
// Passerelles OSM (f.br, tools/make_site.py) : largeur (width OSM + garde-corps, sinon 2,4 m), hauteur ESTIMÉE (voie franchie + 2,9 m ; voie à plus de 7 m : la passerelle passe
// dessous, 2,4 m ; sans voie : 0,3 m ; SITE.bridges[k]={h} force la hauteur, k = rang OSM). Dessin : engine/render.js (drawBridge).
const BRIDGE_DEF=OSM.feats.filter(f=>f.br).map((f,k)=>{const P=f.p,w=f.w?Math.max(1,f.w)+.3:2.4;let ty=-1;for(let i=0;i<N;i+=2){const q=TR[i].p;if(dPl(q.x,q.z,P)<w/2+2)ty=Math.max(ty,q.y);}
  const cf=(SITE.bridges||[])[k]||{},h=cf.h!=null?cf.h:ty<0?.3:ty<7?ty+2.9:2.4;return {P,f,w,h,ty};});
// Escaliers OSM (OSM.stairs, highway=steps, tools/make_site.py) : praticables, les visiteurs y marchent plus lentement (STEP_K).
// Escaliers d'une passerelle (propriétaire, 2026-11-16) : à chaque extrémité d'une passerelle surélevée (h > 1 m) sans escalier OSM, un escalier est ajouté le long du
// chemin raccordé (file, sortie ou allée), sur 1,65 m par mètre de hauteur (marches de 17 x 28 cm) ; o.gen = 1 (ESTIMÉ). Largeur o.w : finalisée par engine/render.js
// (width OSM de l'escalier ou du chemin raccordé, sinon largeur de la file à cet endroit, 1,2 à 2 m ; jamais plus large que la file ; pas de chevauchement entre escaliers voisins).
const STAIRS=(OSM.stairs||OSM.feats.filter(f=>f.k==='highway=steps'&&!f.c).map(f=>({p:f.p,up:0}))).map(o=>Object.assign({},o)); // données anciennes (sans OSM.stairs) : escaliers du décor, sens inconnu
(function bridgeStairs(){
  const lines=Object.values(OSM.paths||{}).concat(SITE.paths||[],OSM.feats.filter(f=>f.k.startsWith('highway=')&&f.k!=='highway=steps'&&!f.c&&!f.br).map(f=>f.p));
  const ends=P=>[P[0],P[P.length-1]],at=(q,E,r)=>Math.hypot(q[0]-E[0],q[1]-E[1])<r;
  for(const b of BRIDGE_DEF){if(b.h<1||!(b.ty>=0&&b.h>b.ty))continue; // seulement une passerelle qui franchit la voie
    // escalier OSM à un bout (directement, ou au bout d'un court palier de moins de 5 m de chemin : propriétaire, Trace du Hourra, 2026-11-16, lot 4) ou autre passerelle :
    // ouvrage déjà décrit par OSM, rien n'est ajouté (le mécanisme ne sert que si OSM n'a aucun escalier)
    const nearSt=E=>{if(STAIRS.some(o=>ends(o.p).some(q=>at(q,E,1.2))))return true;
      for(const P of lines)for(let j=0;j<P.length;j++){if(!at(P[j],E,.6))continue;for(const dir of [1,-1]){let acc=0;for(let k=j+dir;k>=0&&k<P.length;k+=dir){acc+=Math.hypot(P[k][0]-P[k-dir][0],P[k][1]-P[k-dir][1]);if(acc>5)break;if(STAIRS.some(o=>ends(o.p).some(q=>at(q,P[k],.6))))return true;}}}return false;};
    if(ends(b.P).some(E=>nearSt(E)||BRIDGE_DEF.some(c=>c!==b&&ends(c.P).some(q=>at(q,E,1.2)))))continue;
    for(const E of ends(b.P)){const F=at(E,b.P[0],.01)?b.P[b.P.length-1]:b.P[0];
      let best=null;
      for(const P of lines)for(let j=0;j<P.length;j++){if(Math.hypot(P[j][0]-E[0],P[j][1]-E[1])>.6)continue;const thr=P.some(q=>at(q,F,.6))?1000:0; // de préférence le chemin qui passe par la passerelle (file)
        for(const dir of [1,-1]){const R=[E];let k=j+dir,acc=0;
          if(k<0||k>=P.length||dPl(P[k][0],P[k][1],b.P)<.5)continue; // direction qui repart le long de la passerelle : non
          const need=b.h*1.65;
          for(;k>=0&&k<P.length&&acc<need;k+=dir){const a=R[R.length-1],l=Math.hypot(P[k][0]-a[0],P[k][1]-a[1]);
            if(acc+l>=need){const t=(need-acc)/(l||1);R.push([a[0]+(P[k][0]-a[0])*t,a[1]+(P[k][1]-a[1])*t]);acc=need;break;}R.push(P[k]);acc+=l;}
          if(!best||acc+thr>best.sc)best={R,acc,sc:acc+thr};}}
      if(best&&best.acc>1)STAIRS.push({p:best.R.slice().reverse(),up:1,gen:1,w:b.f.w||0,h:b.h});}}
})();
for(const o of STAIRS){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of o.p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}Object.assign(o,{x0:x0-1.5,x1:x1+1.5,z0:z0-1.5,z1:z1+1.5});}
const STEPS=STAIRS,STEP_K=.6;
function stepK(x,z){for(const o of STEPS){if(x<o.x0||x>o.x1||z<o.z0||z>o.z1)continue;if(dPl(x,z,o.p)<(o.w||1.5)/2+.3)return STEP_K;}return 1;}
// Réseau de la file, décrit de l'entrée vers la gare par SITE.queue.parts : tronçons simples et fourches.
// À chaque fourche, un vantail pivote autour d'un poteau en bordure (gate.h) pour fermer soit le raccourci (gate.a), soit la boucle (gate.b) ; on = boucle en service.
// Variante à plusieurs barrières (gates:[{h,a,b,loop:true},{h,a,b}], ou posées par le moteur : {on:'loop'|'short', at, end}, voir gateAt) : une en travers de l'entrée de la boucle, une en travers du raccourci, liées (l'une s'ouvre quand
// l'autre se ferme) ; a = position fermée (en travers), b = ouverte (le long de la bordure) ; chacune se clique sur la carte.
const mkSeg=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));return {P:pts,C,len:C[C.length-1],list:[]};};
// Barrière posée par le moteur : {on:'loop'|'short', at:d, end:true?, loop:bool} = en travers du chemin (boucle ou raccourci) à d m de son début (de sa fin si end),
// poteau en bordure (h), fermée en travers (a), ouverte le long de la bordure (b) ; half : demi-largeur couverte (défaut 1,1 m).
function gateAt(P,d,end,half){P=end?P.slice().reverse():P;const hw=half||1.1;let i=1,acc=0;
  while(i<P.length-1&&acc+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1])<d){acc+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);i++;}
  const a=P[i-1],b=P[i],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,tx=(b[0]-a[0])/l,tz=(b[1]-a[1])/l,k=Math.min(l,d-acc),c=[a[0]+tx*k,a[1]+tz*k];
  return {h:[c[0]-tz*hw,c[1]+tx*hw],a:[c[0]+tz*hw,c[1]-tx*hw],b:[c[0]-tz*hw+tx*2*hw,c[1]+tx*hw+tz*2*hw]};}
// Règle des barrières (propriétaire, 2026-11-16, toutes les attractions) : un chemin de file fermable a une barrière à son ENTRÉE et une à sa SORTIE (celle-ci empêche
// de remonter le chemin fermé par l'autre bout), qui bougent ensemble. Toute barrière posée par le moteur ({on, at}) reçoit donc sa jumelle à l'autre bout du même chemin
// ({end} inversé), sauf si la configuration la donne déjà ou si pair:false.
const pairGates=gs=>gs.concat(gs.filter(g=>g.on&&g.pair!==false&&!gs.some(o=>o!==g&&o.on===g.on&&!!o.end!==!!g.end)).map(g=>Object.assign({},g,{end:!g.end})));
const plen=P=>P.reduce((n,q,i)=>i?n+Math.hypot(q[0]-P[i-1][0],q[1]-P[i-1][1]):0,0); // chemin court (moins de 2·at + 0,8 m) : barrières à 20 % de sa longueur de chaque bout
// Barrière de fourche pivotante {on:'fork', end, half} (propriétaire, 2026-11-16, lot 4 : OzIris, raccourci des lacets ; Trace du Hourra, boucle) : UN vantail, poteau
// dans la pointe de la fourche (entre la boucle et le raccourci, là où ils s'écartent de 1,6 m), qui ferme SOIT le raccourci (a : boucle en service), SOIT la boucle (b).
// end:true : même barrière à l'autre bout (là où la boucle rejoint le raccourci). Avec pairGates, deux barrières parallèles qui bougent ensemble : boucle ouverte, les deux
// en travers du raccourci ; boucle fermée, l'une en travers de l'entrée de la boucle, l'autre de sa sortie.
const ptAt=(P,d)=>{let acc=0;for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(acc+l>=d){const k=(d-acc)/(l||1);return [P[i-1][0]+(P[i][0]-P[i-1][0])*k,P[i-1][1]+(P[i][1]-P[i-1][1])*k];}acc+=l;}return P[P.length-1];};
function forkGate(g,p){const rv=P=>g.end?P.slice().reverse():P,PL=rv(p.loop),PS=rv(p.short),hw=g.half||1.1,mx=Math.min(6,plen(PL)*.45,plen(PS)*.45);
  let d=.3,A,B;for(;d<=mx;d+=.1){A=ptAt(PL,d);B=ptAt(PS,d);if(Math.hypot(A[0]-B[0],A[1]-B[1])>=1.6)break;}A=ptAt(PL,Math.min(d,mx));B=ptAt(PS,Math.min(d,mx));
  const h=[(A[0]+B[0])/2,(A[1]+B[1])/2],ext=(Q)=>{const dx=Q[0]-h[0],dz=Q[1]-h[1],l=Math.hypot(dx,dz)||1;return [Q[0]+dx/l*hw,Q[1]+dz/l*hw];};
  return {h,a:ext(B),b:ext(A),loop:false,fork:1};}
const resolveGate=(g,p)=>{if(g.h)return g;if(g.on==='fork')return forkGate(g,p);const P=g.on==='short'?p.short:p.loop,L=plen(P),d=g.at||1.6;return Object.assign(gateAt(P,L<2*d+.8?Math.max(.15,L*.2):d,g.end,g.half),{loop:g.loop!=null?!!g.loop:g.on!=='short'});};
// Escalier « en applique » (propriétaire, Goudurix, 2026-11-16, lot 4) : un escalier OSM dont l'axe tombe dans l'emprise de la gare (agrandie à ses quais, STATION_GROW),
// qui la longe (parallèle à la voie de gare) et dont le sommet est à moins de 4 m d'une porte OSM (entrance=*) est dessiné À L'EXTÉRIEUR, collé au mur : décalé perpendiculairement à la voie, côté extérieur, jusqu'à ce que son bord
// intérieur (largeur APPW) touche le mur. Les points de la file, de la sortie et des allées posés sur lui sont décalés d'autant (visiteurs sur l'escalier). o.app={nx,nz,top}
// sert au palier rectangulaire dessiné à son sommet (engine/render.js). Décalage = ESTIMÉ (il dépend de la largeur estimée des quais).
const APPW=2;
(function stairsOutside(){const SPo=SITE.stationPoly;if(!SPo||SPo.length<3||!BAYS.length)return;const pin=(x,z)=>{let c=false;for(let i=0,j=SPo.length-1;i<SPo.length;j=i++)if((SPo[i][1]>z)!==(SPo[j][1]>z)&&x<(SPo[j][0]-SPo[i][0])*(z-SPo[i][1])/(SPo[j][1]-SPo[i][1])+SPo[i][0])c=!c;return c;};
  const tx=BAYS[0].tx,tz=BAYS[0].tz,cx=BAYS.reduce((n,b)=>n+b.x,0)/BAYS.length,cz=BAYS.reduce((n,b)=>n+b.z,0)/BAYS.length,moves=[];
  for(const o of STAIRS){if(o.gen)continue;const P=o.p,A=P[0],B=P[P.length-1],l=Math.hypot(B[0]-A[0],B[1]-A[1])||1,ux=(B[0]-A[0])/l,uz=(B[1]-A[1])/l;
    if(Math.abs(ux*tx+uz*tz)<.8)continue; // pas parallèle à la gare
    const smp=[];for(let i=1;i<P.length;i++)for(let k=0;k<=4;k++)smp.push([P[i-1][0]+(P[i][0]-P[i-1][0])*k/4,P[i-1][1]+(P[i][1]-P[i-1][1])*k/4]);
    if(!smp.some(q=>pin(q[0],q[1])))continue;
    {const T=o.up<0?A:B;if(!(OSM.doors||[]).some(d=>Math.hypot(d[0]-T[0],d[1]-T[1])<4))continue;} // sommet à moins de 4 m d'une porte de la gare : escalier qui monte au niveau de la gare
    let nx=-tz,nz=tx;const mx=(A[0]+B[0])/2,mz=(A[1]+B[1])/2;if((mx-cx)*nx+(mz-cz)*nz<0){nx=-nx;nz=-nz;} // vers l'extérieur de la gare
    let d=0;while(d<12&&smp.some(q=>pin(q[0]+nx*(d-APPW/2),q[1]+nz*(d-APPW/2))))d+=.05;d+=.05;
    const top=o.up<0?A:B;moves.push([P.map(q=>q.slice()),nx*d,nz*d]);o.p=P.map(q=>[q[0]+nx*d,q[1]+nz*d]);o.app={nx,nz,top:[top[0]+nx*d,top[1]+nz*d],ux:o.up<0?-ux:ux,uz:o.up<0?-uz:uz};
    o.x0+=Math.min(0,nx*d);o.x1+=Math.max(0,nx*d);o.z0+=Math.min(0,nz*d);o.z1+=Math.max(0,nz*d);}
  if(!moves.length)return;
  const done=new WeakSet,fix=L=>{if(!L)return;for(const q of L){if(!Array.isArray(q)||typeof q[0]!=='number'||done.has(q))continue;done.add(q);for(const [P,dx,dz] of moves)if(P.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<.3)){q[0]+=dx;q[1]+=dz;break;}}};
  const seen=new Set,fixOnce=L=>{if(L&&!seen.has(L)){seen.add(L);fix(L);}};
  for(const p of QS.parts){fixOnce(p.pts);fixOnce(p.loop);fixOnce(p.short);}fixOnce(SITE.exit&&SITE.exit.path);for(const p of SITE.paths||[])fixOnce(p);
})();
const STAGES=[],LOOPS=[],SEGS=[];
QS.parts.forEach((p,si)=>{
  if(p.pts){const s=mkSeg(p.pts);s.si=si;STAGES.push({seg:s});SEGS.push(s);}
  else{const gs=pairGates(p.gates||[p.gate]).map(g=>resolveGate(g,p)),l={name:p.name,on:true,t:1,g:gs[0],gs,loop:mkSeg(p.loop),short:mkSeg(p.short)};l.loop.si=l.short.si=si;LOOPS.push(l);STAGES.push({fork:l});SEGS.push(l.loop,l.short);}
});
SEGS.reverse(); // traités de la gare vers l'entrée, pour libérer la place devant avant d'avancer
const SEG_IN=STAGES[0].seg,SEG_OUT=STAGES[STAGES.length-1].seg;
let QLEN=0;
function buildQueue(){QLEN=STAGES.reduce((n,st)=>n+(st.seg?st.seg.len:st.fork.on?st.fork.loop.len:st.fork.short.len),0);}
buildQueue();
const settled=l=>l.t===(l.on?1:0);
function nextSeg(s){const st=STAGES[s.si+1];if(!st)return null;if(st.seg)return st.seg;return settled(st.fork)?(st.fork.on?st.fork.loop:st.fork.short):null;}
function prevSeg(s,evac){const st=STAGES[s.si-1];if(!st)return null;if(st.seg)return st.seg;return evac||!st.fork.on?st.fork.short:st.fork.loop;}
const room=e=>!e.list.length||e.len-e.list[e.list.length-1].r>=SP;
function removeVisitor(v){const i=G.queue.indexOf(v);if(i>=0)G.queue.splice(i,1);if(v.e){const l=v.e.list,j=l.indexOf(v);if(j>=0)l.splice(j,1);}}
function clearQueue(){G.queue.length=0;for(const s of SEGS)s.list.length=0;}
const P3=(a,j)=>a.map(p=>[p[0]+rnd(-j,j),0,p[1]+rnd(-j,j)]);
function approach(){let r=Math.random()*SITE.approach.reduce((n,a)=>n+a.w,0);for(const a of SITE.approach){r-=a.w;if(r<=0)return a.pts;}return SITE.approach[0].pts;}
function leavePath(v){return [[v.x,0,v.z]].concat(v.pts.slice(0,v.i).reverse().map(p=>[p[0],0,p[2]]));} // demi-tour : repart par où il est venu (jamais en ligne droite vers l'entrée)
function backPath(v,evac){ // sortie à contre-sens par la file. Abandon : uniquement par les chemins ouverts. Évacuation : au plus court, barrières franchies.
  if(v.mode!=='q')return leavePath(v);
  const pts=[[v.x,0,v.z]];let e=v.e,ds=e.len-v.r;
  while(e){for(let i=e.P.length-1;i>=0;i--)if(e.C[i]<ds-.01)pts.push([e.P[i][0]+rnd(-.3,.3),0,e.P[i][1]+rnd(-.3,.3)]);e=prevSeg(e,evac);ds=1e9;}
  return pts.concat(P3(approach().slice().reverse(),.7));
}
function exitPath(pre){const X=SITE.exit,t=X.tails[Math.floor(Math.random()*X.tails.length)];return pre.concat(P3(X.path,.35).slice(X.door?1:0),P3(t,.7));} // pre : trajet jusqu'à la porte (alightWalk) ; X.path commence à la porte
function walker(pts,ci,done,sp,emo,kind){G.walkers.push({kind,pts,i:1,x:pts[0][0],y:pts[0][1],z:pts[0][2],ci,done,sp:sp||2.6,ph:rnd(0,6)});if(emo)emote(emo,pts[0]);}
function moveAlong(k,dt){
  let st=k.sp*dt*stepK(k.x,k.z);
  while(st>0&&k.i<k.pts.length){
    const g=k.pts[k.i],dx=g[0]-k.x,dy=g[1]-k.y,dz=g[2]-k.z,d=Math.hypot(dx,dy,dz);
    if(d<=st){k.x=g[0];k.y=g[1];k.z=g[2];k.i++;st-=d;}else{k.x+=dx/d*st;k.y+=dy/d*st;k.z+=dz/d*st;st=0;}
  }
  return k.i>=k.pts.length;
}
function joinQueue(){
  if(G.queue.length*SP+1>QLEN){G.sat=clamp(G.sat-.01,0,100);G.stats.turned++;return;}
  const pts=P3(approach(),.7);pts.push([ENTRY0[0],0,ENTRY0[1]]);
  G.queue.push({ci:Math.floor(Math.random()*12),w:0,pat:rnd(220,420),mode:'app',side:Math.random()<.5?-1:1,sp:3.2,ph:rnd(0,6),pts,i:1,x:pts[0][0],y:0,z:pts[0][2],mv:true});
}
const _qp={x:0,y:0,z:0,side:0};
function updateVisitors(dt){
  const w=G.wx.type,Q=G.queue;
  for(const l of LOOPS)l.t=clamp(l.t+(l.on?dt:-dt)/.9,0,1);
  ENTRY_GATE.t=clamp(ENTRY_GATE.t+(G.open?-dt:dt)/.9,0,1);
  if(G.open){
    const hourF=.6+.8*Math.sin(Math.PI*clamp((G.time-600)/480,0,1)),wxF=w==='storm'?.25:w==='rain'?.6:1;
    // fréquentation réglable : au-delà de 100 %, les visiteurs viennent même si la file est déjà longue, jusqu'à la remplir
    const rate=.42*G.crowd*hourF*wxF*(.5+G.sat/100)*Math.max(.1,1-Q.length*SP/QLEN/Math.max(1,G.crowd*G.crowd))*dt;
    for(let n=Math.floor(rate)+(Math.random()<rate%1?1:0);n>0;n--)joinQueue();
  }
  const imp=w==='storm'?3:w==='rain'?1.5:1;
  for(let i=Q.length-1;i>=0;i--){
    const v=Q[i];v.w+=dt*imp;
    if(v.w>v.pat){const p=backPath(v);removeVisitor(v);G.stats.quits++;G.sat=clamp(G.sat-.35,0,100);walker(p,C_GREY,null,3,0,'quit');continue;}
    if(v.mode==='app'&&moveAlong(v,dt)){ // arrivé devant la barrière d'entrée : seul passage vers la file
      if(!G.open){Q.splice(i,1);G.stats.turned++;walker(leavePath(v),v.ci,null,3,0,'turn');continue;}
      if(ENTRY_GATE.t>.02)continue;
      if(!room(SEG_IN))continue; // patiente devant la barrière le temps que la file avance
      v.mode='q';v.e=SEG_IN;v.r=SEG_IN.len;SEG_IN.list.push(v);
    }
  }
  // avance dans la file : chacun reste derrière celui qui le précède et ne franchit une fourche que par la barrière ouverte
  for(const e of SEGS){
    const l=e.list;
    for(let j=0;j<l.length;j++){const v=l[j],nr=Math.max(j?l[j-1].r+SP:0,v.r-4.5*dt*stepK(v.x,v.z));v.mv=v.r-nr>1e-4;v.r=nr;pathPos(e.P,e.C,e.len-nr,_qp,v.side*.36);v.x=_qp.x;v.z=_qp.z;}
    const h=l[0],nk=h&&h.r<=1e-3?nextSeg(e):null;
    if(nk&&room(nk)){l.shift();h.e=nk;h.r=nk.len;nk.list.push(h);}
  }
  for(let i=G.walkers.length-1;i>=0;i--){const k=G.walkers[i];if(moveAlong(k,dt)){if(k.done)k.done();G.walkers.splice(i,1);}}
}

