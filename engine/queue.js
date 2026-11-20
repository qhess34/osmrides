'use strict';
/* ══════════ VISITEURS (chemins réels : accès, file, sortie) ══════════ */
const SP=.42,QS=SITE.queue;
// Écart entre visiteurs de la file (propriétaire, issue #28, générique) : un visiteur est dessiné comme une ellipse de 0,54 x 0,34 m (engine/render.js person),
// tourné face à sa marche dans la file (v.hd : épaules en travers) ; QPW = épaisseur dessinée (0,34 m) = écart minimal centre à centre exigé (mesure overlapQ de
// tools/check.js) ; QD = garde appliquée par le moteur (0,40 m, marge). Pas le long du chemin SP = 0,42 m.
// Causes des chevauchements relevées (issue #28) : décalage latéral fixe de 0,36 m même sur une allée étroite (lacets voisins, corps hors de l'allée), coins
// intérieurs des virages (deux visiteurs à 0,42 m le long du chemin, 0,1 m à vol d'oiseau), jonctions de tronçons et fourche (branche fermée qui se vide),
// arrivants empilés au même point devant la barrière d'entrée. Remèdes : décalage borné par la largeur dessinée (segSpots) et garde de proximité (qBlocked) :
// un visiteur n'avance pas à moins de QD d'un visiteur qui le précède dans l'ordre de la file (rang v.rk = reste à parcourir jusqu'à la gare ; arrivants
// après toute la file, par distance à la barrière d'entrée) ; écart le long du chemin agrandi là où il se replie (qBehind) ; le premier de la file n'est jamais retenu : aucun blocage mutuel. Les arrivants attendent ainsi en ligne sur l'accès.
const QPW=.34,QD=.4;var QHW_OK=0;
// BARRIÈRES DE FILE (propriétaire, issue #37, décision du 20/11, toutes les attractions ; remplace les barrières déduites des issues #12 / #17 / #34) :
//  - AUCUNE barrière automatique : chacune est posée à la main dans l'éditeur (GAME.barriers, clé 'b<n>' : {x, z, ang, len, open?, sw?}) : poteau-pivot (x, z), vantail
//    fermé de len m dans la direction ang (degrés, atan2(dz, dx)), ouvert rabattu à 90° (sw = 1 ou -1 : sens de rotation) ; open = état au début de la partie (absent : fermée) ;
//  - chaque barrière s'ouvre et se ferme SEULE au clic sur la carte (toggleBar) : plus de barrières liées, plus de bascule de fourche ;
//  - une barrière fermée BLOQUE tous ceux qui essaient de la franchir : visiteur de la file arrêté 0,3 m avant le point où son allée croise le vantail (e.bx, reBars),
//    arrivant (qWalk) et visiteur évacué (marcheur 'evac', propriétaire 20/11 : le joueur doit l'ouvrir lui-même) arrêtés devant le vantail ; les abandons passent ;
//  - à chaque embranchement, le visiteur prend le plus court trajet jusqu'à la gare qui ne franchit que des barrières ouvertes ; aucun : le plus court trajet, arrêt
//    devant la première barrière fermée (qRoute) ; barrière fermée en travers du début de la file = plus personne n'entre ;
//  - évacuation en cours (marcheurs 'evac', evacOn) : plus personne n'entre ni n'avance vers la gare, les arrivants repartent ;
//  - anciennes données ('entry', 'fork:…', 'add:…' = {x, z, a:{ang, len}, b:{ang, len}}) : converties à la LECTURE (barSpecs) en barrières indépendantes à la même position
//    (A = fermée, B = ouverte ; au départ : entrée et 'loop…' ouvertes, les autres fermées, comme l'ancienne boucle en service) ; {off:true} ignorée ; le fichier n'est
//    réécrit que par l'éditeur. Les fourches et tronçons restent déduits d'OSM (deduceParts).
const _np=(P,x,z)=>{let bd=1e9,best=0,acc=0,t=[1,0];for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),k=L?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(L*L))):0,d=Math.hypot(a[0]+dx*k-x,a[1]+dz*k-z);if(d<bd){bd=d;best=acc+L*k;t=L?[dx/L,dz/L]:t;}acc+=L;}return {d:bd,at:best,t};};
// FILE DÉDUITE D'OSM (lot 5, issue #34) : SITE.queue.ways = chemins de file OSM (polylignes de OSM.paths, dans le sens OSM, oneway=yes) ; le moteur en déduit les
// tronçons, boucles et raccourcis (deduceParts) : graphe des nœuds partagés, plus court trajet du début du premier chemin (début de la file) au nœud le plus proche de
// l'entrée de la gare (OSM.doors entrance=main ; SITE.queue.end pour forcer) = file de base ; tout autre chemin qui la quitte et la rejoint plus loin = fourche, le plus
// long des deux chemins = boucle, le plus court = raccourci. Sens : celui des chemins OSM (oneway) ; si le graphe orienté n'a pas de trajet, sens déduit du trajet
// lui-même (QS.auto.dir = 0). Nom d'une fourche : celui du tronçon de SITE.queue.parts dont les pointes coïncident (clés GAME.barriers inchangées), sinon 'fourche <n>'.
// Repli : SITE.queue.parts écrit à la main, gardé tant que la déduction échoue (pas de trajet, fourches imbriquées) ou que ways est absent. QS.auto = bilan (outil, éditeur).
function deduceParts(W,end){ // points repris par référence (pas de copie) : les décalages ultérieurs (escaliers en applique) suivent board.via, comme pour parts
  const K=q=>q[0].toFixed(2)+','+q[1].toFixed(2),N=new Map(),node=q=>{const k=K(q);if(!N.has(k))N.set(k,{k,p:q,o:[],i:[]});return N.get(k);};
  for(const P of W)for(let j=1;j<P.length;j++){const a=node(P[j-1]),b=node(P[j]);if(a===b)continue;const l=Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1]);a.o.push({n:b,l});b.i.push({n:a,l});}
  const s=N.get(K(W[0][0]));if(!s)return null;let t=null,bd=1e9;for(const n of N.values()){const d=Math.hypot(n.p[0]-end[0],n.p[1]-end[1]);if(d<bd){bd=d;t=n;}}
  const path=dir=>{const D=new Map([[s,0]]),pr=new Map(),todo=new Set([s]);while(todo.size){let u=null;for(const n of todo)if(!u||D.get(n)<D.get(u))u=n;todo.delete(u);if(u===t)break;
      for(const e of dir?u.o:u.o.concat(u.i)){const d=D.get(u)+e.l;if(!D.has(e.n)||d<D.get(e.n)-1e-9){D.set(e.n,d);pr.set(e.n,u);todo.add(e.n);}}}
    if(!D.has(t))return null;const S=[t];while(S[0]!==s)S.unshift(pr.get(S[0]));return S;};
  let dir=1,S=path(1);if(!S){dir=0;S=path(0);}if(!S||S.length<2)return null;
  const ix=new Map(S.map((n,j)=>[n,j])),onS=new Set(S.map((n,j)=>j?S[j-1].k+'>'+n.k:'')),F=[],used=new Set();
  for(const u of S)for(const e of dir?u.o:u.o.concat(u.i)){if(onS.has(u.k+'>'+e.n.k)||onS.has(e.n.k+'>'+u.k)||used.has(u.k+'>'+e.n.k))continue;
    const B=[u],seen=new Set([u]);let c=e.n,ok=true;while(!ix.has(c)){if(seen.has(c)){ok=false;break;}seen.add(c);B.push(c);
      const nx=(dir?c.o:c.o.concat(c.i)).filter(f=>!seen.has(f.n)||(ix.has(f.n)&&f.n!==u));if(nx.length!==1){ok=false;break;}c=nx[0].n;}
    if(!ok)continue;B.push(c);for(let j=1;j<B.length;j++){used.add(B[j-1].k+'>'+B[j].k);used.add(B[j].k+'>'+B[j-1].k);}
    if(ix.get(c)>ix.get(u))F.push({i:ix.get(u),j:ix.get(c),loop:B.map(n=>n.p)});}
  F.sort((a,b)=>a.i-b.i);const parts=[];let cur=0;
  for(const f of F){if(f.i<cur)return {fail:'fourches imbriquées'};if(f.i>cur)parts.push({pts:S.slice(cur,f.i+1).map(n=>n.p)});else if(!parts.length)return {fail:'file qui commence par une fourche'};
    const sh=S.slice(f.i,f.j+1).map(n=>n.p),lo=f.loop;parts.push(plen(lo)>=plen(sh)?{short:sh,loop:lo}:{short:lo,loop:sh});cur=f.j;}
  if(cur<S.length-1)parts.push({pts:S.slice(cur).map(n=>n.p)});
  return {parts,dir,start:S[0].p.slice(),end:t.p.slice(),endGap:+bd.toFixed(2)};}
const plen=P=>P.reduce((n,q,i)=>i?n+Math.hypot(q[0]-P[i-1][0],q[1]-P[i-1][1]):0,0); // chemin court (moins de 2·at + 0,8 m) : barrières à 20 % de sa longueur de chaque bout
QS.auto=(()=>{if(!QS.ways||!QS.ways.length)return {used:false,why:'SITE.queue.ways absent : SITE.queue.parts écrit à la main'};
  const door=(OSM.doors||[]).filter(d=>d[2]==='main').map(d=>[d[0],d[1]]),last=QS.ways[QS.ways.length-1],E=QS.end||door.sort((a,b)=>Math.hypot(a[0]-last[last.length-1][0],a[1]-last[last.length-1][1])-Math.hypot(b[0]-last[last.length-1][0],b[1]-last[last.length-1][1]))[0]||last[last.length-1];
  const r=deduceParts(QS.ways,E);if(!r||r.fail)return {used:false,why:'déduction impossible ('+(r&&r.fail||'pas de trajet')+') : SITE.queue.parts gardé'};
  const H=QS.parts||[];let n=0;for(const p of r.parts)if(p.loop){const m=H.find(h=>h.loop&&h.short&&[0,1].every(e=>{const a=e?p.short[p.short.length-1]:p.short[0],b=e?h.short[h.short.length-1]:h.short[0];return Math.hypot(a[0]-b[0],a[1]-b[1])<3;}));
    p.name=m&&m.name||('fourche '+(++n));if(m&&(m.gate||m.gates)){p.gate=m.gate;p.gates=m.gates;}}
  if(QS.entry0&&Math.hypot(QS.entry0[0]-r.start[0],QS.entry0[1]-r.start[1])>.05)r.parts[0].pts.unshift(QS.entry0); // raccord écrit avant le début de la file (devient QS.lead)
  // écart avec la file écrite à la main (outil de vérification) : nombre de tronçons, longueur de chaque tronçon
  const L=p=>p.pts?plen(p.pts):plen(p.loop)+plen(p.short);
  const diff=H.length?{n:[H.length,r.parts.length],len:r.parts.map((p,k)=>H[k]?+(L(p)-L(H[k])).toFixed(1):null)}:null;
  QS.manual=H;QS.parts=r.parts;return {used:true,dir:r.dir,forks:r.parts.filter(p=>p.loop).map(p=>p.name),endGap:r.endGap,diff};})();
// début de la file (barrière d'entrée) : premier nœud d'un chemin de file OSM (OSM.paths) que suit le premier tronçon, dans ses 15 premiers mètres (sens de la file)
const QSTART=(()=>{const p0=QS.parts[0]&&QS.parts[0].pts;if(!p0||p0.length<2)return null;let best=null;
  for(const k in OSM.paths||{}){const W=OSM.paths[k];if(!W||W.length<2)continue;const r=_np(p0,W[0][0],W[0][1]),r1=_np(p0,W[1][0],W[1][1]);
    if(r.d<.6&&r1.d<.6&&r1.at>r.at&&r.at<=15&&(!best||r.at<best.at))best=r;}
  if(!best||best.at<.05)return best?{side:1}:null;const P=p0,d=best.at,lead=[];let acc=0,i=1;lead.push(P[0]);
  for(;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(acc+l>=d-.05)break;acc+=l;lead.push(P[i]);}
  const k=i<P.length?(d-acc)/(Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1])||1):1,j=Math.min(i,P.length-1),B=[+(P[j-1][0]+(P[j][0]-P[j-1][0])*k).toFixed(2),+(P[j-1][1]+(P[j][1]-P[j-1][1])*k).toFixed(2)];
  const rest=P.slice(j).filter(q=>Math.hypot(q[0]-B[0],q[1]-B[1])>.05);
  QS.link=(QS.link||[]).concat(lead.filter((q,n)=>n||!QS.link||!QS.link.length||Math.hypot(q[0]-QS.link[QS.link.length-1][0],q[1]-QS.link[QS.link.length-1][1])>.05));
  QS.lead=lead;QS.entry0=B;QS.parts[0].pts=[B].concat(rest);return {side:1};})();
let ENTRY0=QS.entry0||QS.parts[0].pts[0];
function pathPos(P,C,d,o,side){
  d=clamp(d,0,C[C.length-1]);let i=1;while(i<C.length-1&&C[i]<d)i++;
  const a=P[i-1],b=P[i],k=(d-C[i-1])/((C[i]-C[i-1])||1),dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
  o.x=a[0]+dx*k-dz/l*side;o.z=a[1]+dz*k+dx/l*side;o.y=0;o.a=Math.atan2(dz,dx);return o;
}
// Distance d'un point à une polyligne [[x,z]…].
// point q d'une allée de file SUR le chemin P (à moins de r m d'un tronçon de P à peu près parallèle à q) : une allée qui CROISE P en plan (passe au-dessus d'un couloir
// souterrain, issue #19, OzIris 1580105935) n'en fait pas partie
const onPl=(q,P,r)=>{for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1e-9,t=clamp(((q.x-a[0])*dx+(q.z-a[1])*dz)/l,0,1);
  if(Math.hypot(a[0]+dx*t-q.x,a[1]+dz*t-q.z)<r&&Math.abs(dx*q.tx+dz*q.tz)/Math.sqrt(l)>.5)return true;}return false;};
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
// Haut de chaque escalier (propriétaire, 2026-11-16, lot 6 : « un palier pour TOUS les hauts d'escalier ; analyser le sens montant / descendant ») : o.top = 1 (dernier
// point) ou 0 (premier point), -1 si inconnu. Sens OSM d'abord (incline=up/down et sens du way, tools/make_site.py → o.up = +1 : le way monte, -1 : il descend) ;
// sinon d'après le profil : l'extrémité dans l'emprise de la gare (quai, plancher) ou à moins de 4 m d'une porte de la gare, puis celle au bout d'une passerelle
// surélevée, est le haut. Le palier rectangulaire est dessiné au haut (engine/render.js, STEPD) ; aucun palier en bas. LANDC : emprise des paliers hors de la gare
// (allées coupées dessous, engine/render.js cutStairs).
const LANDC=[];
(function stairTops(){const SPo=SITE.stationPoly||[],pin=q=>{let c=false;for(let i=0,j=SPo.length-1;i<SPo.length;j=i++)if((SPo[i][1]>q[1])!==(SPo[j][1]>q[1])&&q[0]<(SPo[j][0]-SPo[i][0])*(q[1]-SPo[i][1])/(SPo[j][1]-SPo[i][1])+SPo[i][0])c=!c;return c;};
  const sc=q=>(SPo.length>2&&pin(q))||(OSM.doors||[]).some(d=>Math.hypot(d[0]-q[0],d[1]-q[1])<4)?2:BRIDGE_DEF.some(b=>b.h>1&&[b.P[0],b.P[b.P.length-1]].some(e=>Math.hypot(e[0]-q[0],e[1]-q[1])<1.5))?1:0;
  for(const o of STAIRS){if(o.up>0)o.top=1;else if(o.up<0)o.top=0;else{const a=sc(o.p[0]),b=sc(o.p[o.p.length-1]);o.top=a>b?0:b>a?1:-1;}}
})();
function landCut(){LANDC.length=0;const SPo=SITE.stationPoly||[];for(const o of STAIRS){if(!(o.top>=0)||o.app||o.p.length<2)continue;const P=o.p,T=P[o.top?P.length-1:0],q=P[o.top?P.length-2:1];
  if(SPo.length>2&&pipXZ(SPo,T[0],T[1]))continue; // sommet sur le quai / le plancher de la gare : le quai sert de palier
  const l=Math.hypot(T[0]-q[0],T[1]-q[1])||1,ux=(T[0]-q[0])/l,uz=(T[1]-q[1])/l;LANDC.push({o,x:T[0],z:T[1],ux,uz,nx:-uz,nz:ux,h:(o.w||o.ow||2)/2});}}
const STEPS=STAIRS,STEP_K=.6;
function stepK(x,z){for(const o of STEPS){if(x<o.x0||x>o.x1||z<o.z0||z>o.z1)continue;if(dPl(x,z,o.p)<(o.w||1.5)/2+.3)return STEP_K;}return 1;}
// Réseau de la file, de l'entrée vers la gare : tronçons simples et fourches (QS.parts = déduits de SITE.queue.ways, lot 5, sinon SITE.queue.parts écrit à la main).
// À chaque fourche, le chemin suivi dépend des barrières fermées (qRoute, issue #37).
const mkSeg=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));return {P:pts,C,len:C[C.length-1],list:[]};};
// Largeur DESSINÉE de la file au point (x, z) : fixée par engine/render.js une fois les largeurs calculées (QWP : width OSM, sinon largeur adaptée) ;
// avant cela, 2,2 m. Les barrières sont recalculées à ce moment-là (reGates) pour que leur poteau soit sur la bordure réelle du chemin.
let qwAt=()=>2.2;
// Escalier « en applique » (propriétaire, Goudurix, 2026-11-16, lot 4) : un escalier OSM dont l'axe tombe dans l'emprise de la gare (agrandie à ses quais, STATION_GROW),
// qui la longe (parallèle à la voie de gare) et dont le sommet est à moins de 4 m d'une porte OSM (entrance=*) est dessiné À L'EXTÉRIEUR, collé au mur : décalé perpendiculairement à la voie, côté extérieur, jusqu'à ce que son bord
// intérieur (largeur APPW) touche le mur. Les points de la file, de la sortie et des allées posés sur lui sont décalés d'autant (visiteurs sur l'escalier). o.app={nx,nz,top}
// sert au palier rectangulaire dessiné à son sommet (engine/render.js). Décalage = ESTIMÉ (il dépend de la largeur estimée des quais).
const APPW=2;
// SITE.stairsOut:false : aucun escalier en applique (OzIris, issue #13 : escaliers de la file dessinés par le propriétaire dans la gare, jusqu'à la porte d'entrée).
(function stairsOutside(){const SPo=SITE.stationPoly;if(SITE.stairsOut===false||!SPo||SPo.length<3||!BAYS.length)return;const pin=(x,z)=>{let c=false;for(let i=0,j=SPo.length-1;i<SPo.length;j=i++)if((SPo[i][1]>z)!==(SPo[j][1]>z)&&x<(SPo[j][0]-SPo[i][0])*(z-SPo[i][1])/(SPo[j][1]-SPo[i][1])+SPo[i][0])c=!c;return c;};
  const tx=BAYS[0].tx,tz=BAYS[0].tz,cx=BAYS.reduce((n,b)=>n+b.x,0)/BAYS.length,cz=BAYS.reduce((n,b)=>n+b.z,0)/BAYS.length,moves=[];
  for(const o of STAIRS){if(o.gen)continue;const P=o.p,A=P[0],B=P[P.length-1],l=Math.hypot(B[0]-A[0],B[1]-A[1])||1,ux=(B[0]-A[0])/l,uz=(B[1]-A[1])/l;
    if(Math.abs(ux*tx+uz*tz)<.8)continue; // pas parallèle à la gare
    const smp=[];for(let i=1;i<P.length;i++)for(let k=0;k<=4;k++)smp.push([P[i-1][0]+(P[i][0]-P[i-1][0])*k/4,P[i-1][1]+(P[i][1]-P[i-1][1])*k/4]);
    if(!smp.some(q=>pin(q[0],q[1])))continue;
    {const T=o.top===0?A:B;if(!(OSM.doors||[]).some(d=>Math.hypot(d[0]-T[0],d[1]-T[1])<4))continue;} // sommet à moins de 4 m d'une porte de la gare : escalier qui monte au niveau de la gare
    let nx=-tz,nz=tx;const mx=(A[0]+B[0])/2,mz=(A[1]+B[1])/2;if((mx-cx)*nx+(mz-cz)*nz<0){nx=-nx;nz=-nz;} // vers l'extérieur de la gare
    let d=0;while(d<12&&smp.some(q=>pin(q[0]+nx*(d-APPW/2),q[1]+nz*(d-APPW/2))))d+=.05;d+=.05;
    const top=o.top===0?A:B;moves.push([P.map(q=>q.slice()),nx*d,nz*d,o]);o.p=P.map(q=>[q[0]+nx*d,q[1]+nz*d]);o.app={nx,nz,top:[top[0]+nx*d,top[1]+nz*d],ux:o.top===0?-ux:ux,uz:o.top===0?-uz:uz};
    o.x0+=Math.min(0,nx*d);o.x1+=Math.max(0,nx*d);o.z0+=Math.min(0,nz*d);o.z1+=Math.max(0,nz*d);}
  if(!moves.length)return;
  const done=new WeakSet,fix=L=>{if(!L)return;for(const q of L){if(!Array.isArray(q)||typeof q[0]!=='number'||done.has(q))continue;done.add(q);for(const [P,dx,dz] of moves)if(P.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<.3)){q[0]+=dx;q[1]+=dz;break;}}};
  const seen=new Set,fixOnce=L=>{if(L&&!seen.has(L)){seen.add(L);fix(L);}};
  for(const p of QS.parts){fixOnce(p.pts);fixOnce(p.loop);fixOnce(p.short);}fixOnce(SITE.exit&&SITE.exit.path);for(const p of SITE.paths||[])fixOnce(p);
  // Raccord régulier au pied de l'escalier (propriétaire, Goudurix, 2026-11-16, lot 5 : chemin d'entrée trop étroit et difforme) : les points du chemin qui menaient au pied
  // de l'escalier à sa position OSM (à moins de 2,5 m de son ancien axe, en contrebas) sont retirés ; le chemin rejoint l'axe décalé à angle droit, puis monte tout droit
  // dans l'escalier (largeur : celle de la file, engine/render.js).
  const reg=new Set,regular=L=>{if(!L||reg.has(L))return;reg.add(L);for(const [P0,dx,dz,o] of moves){const a=o.app,Bm=o.top===0?o.p[o.p.length-1]:o.p[0],Bo=[Bm[0]-dx,Bm[1]-dz];
    const j=L.findIndex(q=>Math.hypot(q[0]-Bm[0],q[1]-Bm[1])<.05);if(j<0)continue;
    const T=o.top===0?o.p[0]:o.p[o.p.length-1],dir=(L[j+1]&&Math.hypot(L[j+1][0]-T[0],L[j+1][1]-T[1])<.3)?-1:(L[j-1]&&Math.hypot(L[j-1][0]-T[0],L[j-1][1]-T[1])<.3)?1:0;if(!dir)continue;
    const far=q=>{const v=[q[0]-Bo[0],q[1]-Bo[1]],al=v[0]*a.ux+v[1]*a.uz,la=Math.abs(-v[0]*a.uz+v[1]*a.ux);return al>.3||la>2.5;};
    let k=j+dir;while(k>=0&&k<L.length&&!far(L[k]))k+=dir;if(k<0||k>=L.length)continue;
    const K=L[k],al=(K[0]-Bm[0])*a.ux+(K[1]-Bm[1])*a.uz,F=[Bm[0]+a.ux*Math.min(-.6,al),Bm[1]+a.uz*Math.min(-.6,al)];
    if(dir<0)L.splice(k+1,j-k-1,F);else L.splice(j+1,k-j-1,F);}};
  for(const p of QS.parts){regular(p.pts);regular(p.loop);regular(p.short);}regular(SITE.exit&&SITE.exit.path);for(const p of SITE.paths||[])regular(p);
})();
// Escaliers arrêtés au bord du quai (propriétaire, Trace du Hourra, 2026-11-16, lot 5, générique) : la partie d'un escalier OSM posée sur un quai (embarquement ou
// débarquement, PLT) d'un escalier OSM qui mène à une porte (accès au quai) est retirée — l'escalier s'arrête au bord du quai, sans empiéter sur la zone d'embarquement ; un escalier entièrement sur le quai devient du plancher.
(function stairsOffPlatform(){if(!BAYS.length)return;const b0=BAYS[0];
  const onQuai=(x,z)=>{const u=(x-b0.x)*b0.tx+(z-b0.z)*b0.tz;if(u>PLT.front||u<-(NCARS-.5)*CAR-PLT.back)return false;const b=BAYS[clamp(Math.round(-u/CAR),0,NCARS-1)],l=(x-b.x)*b.rx+(z-b.z)*b.rz;return (l>PEDGE&&l<PLT.load)||(PLT.exit&&l<-PEDGE&&l>-PLT.exit);};
  for(let i=STAIRS.length-1;i>=0;i--){const o=STAIRS[i];if(o.gen||o.app)continue;const P=o.p,smp=[];
    if(!(OSM.doors||[]).some(d=>[P[0],P[P.length-1]].some(q=>Math.hypot(d[0]-q[0],d[1]-q[1])<.6)))continue; // escalier qui mène à une porte de la gare (accès au quai)
    for(let j=1;j<P.length;j++){const a=P[j-1],c=P[j],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.1));for(let k=j>1?1:0;k<=n;k++){const q=[a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n];q.on=onQuai(q[0],q[1]);q.v=k===n||k===0;smp.push(q);}}
    if(!smp.some(q=>q.on))continue;
    let best=null,run=[];const fl=()=>{if(run.length>1&&(!best||run.length>best.length))best=run;run=[];};for(const q of smp){if(q.on)fl();else run.push(q);}fl();
    if(!best||best.length<6){STAIRS.splice(i,1);continue;}
    const R=[best[0]].concat(best.slice(1,-1).filter(q=>q.v),[best[best.length-1]]).map(q=>[q[0],q[1]]);
    o.p=R;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of R){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}Object.assign(o,{x0:x0-1.5,x1:x1+1.5,z0:z0-1.5,z1:z1+1.5});}
})();
// Entrée de la file sur une zone piétonne (propriétaire, 2026-11-16, lot 6, d'après OzIris, générique) : là où la file débouche sur une zone piétonne OSM, elle est
// prolongée DANS la zone, dans l'axe de son premier tronçon, jusqu'à QMOUTH m de file dans la zone (SITE.queue.mouth, défaut 5 m, ESTIMÉ d'après OzIris) ; ce couloir
// est délimité par des barrières des deux côtés (engine/render.js, QSIDE). Le raccord QS.link commence à la bouche du couloir et les accès (SITE.approach) y mènent.
// Plafond (propriétaire, issue #9) : la part de file dans la zone (raccord compris) ne dépasse pas SITE.queue.mouthMax (défaut 20 %) de la profondeur de la zone, mesurée
// dans la direction du prolongement depuis le bord où la file en sort ; au-delà, le raccord est coupé à ce plafond (QS.mouthCut), sans jamais toucher à la file OSM.
const QMOUTH=QS.mouth!=null?QS.mouth:5;
const QMOUTH_MAX=QS.mouthMax!=null?QS.mouthMax:.2; // part maximale de la profondeur de la zone piétonne occupée par la file (propriétaire, issue #9)
(function queueMouth(){const PED=OSM.feats.filter(f=>f.k==='highway=pedestrian'&&f.c&&f.p.length>3).map(f=>f.p);if(!PED.length||!QMOUTH)return;
  const pin=(P,q)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>q[1])!==(P[j][1]>q[1])&&q[0]<(P[j][0]-P[i][0])*(q[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const p0=QS.parts[0]&&QS.parts[0].pts||[],C=(QS.link||[]).concat([ENTRY0],p0.filter((q,i)=>i||Math.hypot(q[0]-ENTRY0[0],q[1]-ENTRY0[1])>.05)),Z=PED.find(P=>pin(P,C[0]));if(!Z||C.length<2)return;
  let inL=0,X=C[C.length-1];for(let i=1;i<C.length;i++){const l=Math.hypot(C[i][0]-C[i-1][0],C[i][1]-C[i-1][1]);if(!pin(Z,C[i])){let lo=0,hi=1;for(let k=0;k<12;k++){const m=(lo+hi)/2;if(pin(Z,[C[i-1][0]+(C[i][0]-C[i-1][0])*m,C[i-1][1]+(C[i][1]-C[i-1][1])*m]))lo=m;else hi=m;}inL+=l*lo;X=[C[i-1][0]+(C[i][0]-C[i-1][0])*lo,C[i-1][1]+(C[i][1]-C[i-1][1])*lo];break;}inL+=l;}
  let j=1;while(j<C.length-1&&Math.hypot(C[j][0]-C[0][0],C[j][1]-C[0][1])<.5)j++;const l=Math.hypot(C[j][0]-C[0][0],C[j][1]-C[0][1])||1,ux=(C[0][0]-C[j][0])/l,uz=(C[0][1]-C[j][1])/l;
  // plafond (propriétaire, issue #9) : la file ne s'avance pas dans la zone de plus de QMOUTH_MAX (20 %) de sa profondeur, mesurée depuis le bord où la file sort de la zone,
  // dans la direction du prolongement ; au-delà, le raccord (QS.link / QS.lead, jamais la file OSM après la barrière d'entrée) est COUPÉ à ce plafond.
  let D=0;while(D<400&&pin(Z,[X[0]+ux*(D+.2),X[1]+uz*(D+.2)]))D+=.2;const cap=QMOUTH_MAX*D;QS.mouthDepth=+D.toFixed(1);
  const fix=M=>{QS.mouthAt=M;for(const A of SITE.approach){const P=A.pts=A.pts.slice();while(P.length>1&&dPl(P[P.length-1][0],P[P.length-1][1],[M,C[0]])<1.6)P.pop();P.push(M.slice());}}; // accès jusqu'à la bouche du couloir
  if(inL>cap+.05){const nE=(QS.link||[]).length;let cut=inL-cap,acc=0,k=1;for(;k<=nE;k++){const sl=Math.hypot(C[k][0]-C[k-1][0],C[k][1]-C[k-1][1]);if(acc+sl>=cut)break;acc+=sl;}
    if(k>nE){QS.link=[];QS.lead=[];QS.mouthCut=1;fix(ENTRY0.slice());return;} // raccord entièrement retiré : la file commence à son entrée
    const f=(cut-acc)/(Math.hypot(C[k][0]-C[k-1][0],C[k][1]-C[k-1][1])||1),M=[+(C[k-1][0]+(C[k][0]-C[k-1][0])*f).toFixed(2),+(C[k-1][1]+(C[k][1]-C[k-1][1])*f).toFixed(2)];
    QS.link=[M].concat(C.slice(k,nE));QS.lead=QS.link.slice();QS.mouthCut=1;fix(M);return;}
  const want=Math.min(QMOUTH,cap);if(inL>=want-.3)return;
  let d=want-inL;while(d>.3&&!pin(Z,[C[0][0]+ux*(d+.8),C[0][1]+uz*(d+.8)]))d-=.2; // reste dans la zone (0,8 m de marge)
  if(d<=.3)return;const M=[+(C[0][0]+ux*d).toFixed(2),+(C[0][1]+uz*d).toFixed(2)];QS.link=[M].concat(QS.link||[]);fix(M);
})();
// Barrière d'entrée au bout du prolongement (SITE.queue.gateAtMouth, propriétaire, issue #9, Zeus : barrière devant la statue) : AJUSTEMENT du jeu, pas OSM.
// Le raccord dans la zone piétonne devient le début de la file : la barrière d'entrée (nœud OSM ou QS.gate) est déplacée à la bouche du couloir (QS.mouthAt).
if(QS.gateAtMouth&&QS.link&&QS.link.length){const P=QS.parts[0].pts,L=QS.link;QS.osmEntry0=ENTRY0.slice();QS.parts[0].pts=L.concat(P.filter((q,i)=>i||Math.hypot(q[0]-L[L.length-1][0],q[1]-L[L.length-1][1])>.05));
  ENTRY0=QS.entry0=L[0].slice();QS.link=[];QS.lead=[];QS.gateMoved=1;}
const STAGES=[],LOOPS=[],SEGS=[];
QS.parts.forEach((p,si)=>{
  if(p.pts){const s=mkSeg(p.pts);s.si=si;STAGES.push({seg:s});SEGS.push(s);}
  else{const l={name:p.name,on:true,t:1,r:null,loop:mkSeg(p.loop),short:mkSeg(p.short)};l.loop.si=l.short.si=si;LOOPS.push(l);STAGES.push({fork:l});SEGS.push(l.loop,l.short);}
});
// liste des barrières (éditeur, check) : clé, barrière, ancienne clé convertie (from)
const BARS=[],okNum=v=>typeof v==='number'&&isFinite(v);
function barSpecs(B){B=B||{};const out=[],used=new Set(Object.keys(B).filter(k=>/^b\d+$/.test(k)));let n=0;const nk=()=>{do n++;while(used.has('b'+n));used.add('b'+n);return 'b'+n;};
  for(const key of Object.keys(B).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))){const o=B[key];if(!o||typeof o!=='object'||!okNum(o.x)||!okNum(o.z))continue;
    if(/^b\d+$/.test(key)){if(okNum(o.ang)&&okNum(o.len)&&o.len>0)out.push({key,x:o.x,z:o.z,ang:o.ang,len:o.len,open:o.open===true,sw:o.sw===-1?-1:1});continue;}
    if(o.off===true||!o.a||!o.b||![o.a.ang,o.a.len,o.b.ang].every(okNum))continue; // ancienne surcharge, suppression ou ajout : barrière indépendante à la même position
    const d=((o.b.ang-o.a.ang)%360+540)%360-180;out.push({key:nk(),from:key,x:o.x,z:o.z,ang:o.a.ang,len:o.a.len,open:key==='entry'||/:loop\d/.test(key),sw:d<0?-1:1});}
  return out;}
// u (0..1) sur p→q du croisement avec r→s, sinon null
const segX=(p,q,r,s)=>{const dx=q[0]-p[0],dz=q[1]-p[1],ex=s[0]-r[0],ez=s[1]-r[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)return null;const u=((r[0]-p[0])*ez-(r[1]-p[1])*ex)/den,v=((r[0]-p[0])*dz-(r[1]-p[1])*dx)/den;return u>=0&&u<=1&&v>=0&&v<=1?u:null;};
function reBars(){const old=new Map(BARS.map(b=>[b.key,b]));BARS.length=0;for(const e of SEGS)e.bx=[];
  for(const s of barSpecs(GM.barriers)){const t=s.ang*Math.PI/180,u=t+s.sw*Math.PI/2,c=Math.cos(t),n=Math.sin(t),o=old.get(s.key);
    const b=Object.assign(s,{open0:s.open,h:[s.x,s.z],a:[s.x+c*s.len,s.z+n*s.len],b:[s.x+Math.cos(u)*s.len,s.z+Math.sin(u)*s.len],w:s.len,H:[s.x-c*.1,s.z-n*.1],A:[s.x+c*(s.len+.1),s.z+n*(s.len+.1)],H2:[s.x+c*Math.min(.3,s.len*.2),s.z+n*Math.min(.3,s.len*.2)]});
    if(o&&o.open0===s.open){b.open=o.open;b.t=o.t;}else b.t=b.open?0:1; // état de jeu gardé tant que l'état initial ne change pas (éditeur)
    BARS.push(b);for(const e of SEGS)for(let i=1;i<e.P.length;i++){const k=segX(e.P[i-1],e.P[i],b.H,b.A);if(k!=null)e.bx.push({b,d:e.C[i-1]+k*(e.C[i]-e.C[i-1])});}}
  qRoute();}
function reGates(){QHW_OK=0;reBars();} // nom gardé (engine/render.js, éditeur)
function allGates(){return BARS;}
function gateList(){return BARS.map((b,i)=>({key:b.key,i,g:b,open:b.open,from:b.from}));}
LOOPS.forEach(l=>{l.kname=l.name||('part'+STAGES.findIndex(st=>st.fork===l));});
function forkList(){return LOOPS.map((l,i)=>({fork:i,name:l.kname}));}
// Itinéraire (propriétaire, issue #37 : plus de notion de boucle ni de raccourci pour le comportement) : le réseau des allées de file (graphe des chemins OSM
// de queue.ways, nœuds communs et sens, mis en tronçons par deduceParts) est parcouru de la gare vers l'entrée ; à chaque embranchement, le visiteur prend le plus
// court trajet jusqu'à la gare qui ne franchit que des barrières ouvertes ; s'il n'y en a aucun, le plus court trajet tout court, et il s'arrête devant la première
// barrière fermée (arrêt dans le tronçon, ci-dessous). l.r = allée choisie à l'embranchement l (l.on : la plus longue, pour le décompte de la file).
const firstShut=e=>{let m=1e9;for(const x of e.bx||[])if(!x.b.open&&x.d<m)m=x.d;return m;};
function qRoute(){let dO=0,dA=0; // distance jusqu'à la gare : par des barrières ouvertes seulement (dO, Infinity sans trajet ouvert) / sans tenir compte des barrières (dA)
  for(let k=STAGES.length-1;k>=0;k--){const st=STAGES[k],B=st.seg?[st.seg]:[st.fork.short,st.fork.loop],o=B.map(e=>firstShut(e)<1e9?Infinity:e.len+dO),a=B.map(e=>e.len+dA);
    let j=0;if(Math.min(...o)<Infinity)j=o[1]<o[0]?1:0;else j=a[1]<a[0]?1:0;
    if(st.fork){st.fork.r=B[j];st.fork.on=B[j]===st.fork.loop;}dO=o[j];dA=Math.min(...a);}
  if(QOK)buildQueue();}
// clic sur la carte (engine/render.js) : une barrière, seule
function toggleBar(i){const b=BARS[i];if(!b)return;b.open=!b.open;qRoute();log('Barrière '+b.key+(b.open?' ouverte':' fermée')+' — file : '+Math.floor(QLEN/SP)+' places.');}
// premier vantail fermé franchi par le déplacement (x0, z0) → (x1, z1) d'un marcheur (arrivant, évacué) : vantail sans ses 0,3 premiers mètres (le poteau est sur la
// bordure commune de deux allées à une fourche : un marcheur de l'autre allée, écarté de l'axe, ne s'y accroche pas)
const barHit=(x0,z0,x1,z1)=>{for(const b of BARS)if(!b.open){const u=segX([x0,z0],[x1,z1],b.H2,b.A);if(u!=null&&u>1e-6)return b;}return null;};
// évacuation en cours : un évacué est encore dans la file (avant le début du raccord d'entrée et de l'accès, pts.qn = points de la file, backPath / platEvac)
const evacOn=()=>G.walkers.some(k=>k.kind==='evac'&&k.i<(k.pts.qn||k.pts.length));
// éditeur : barrière posée au clic (x, z) en travers de l'allée de file la plus proche (à moins de 6 m) : poteau sur la bordure côté clic, vantail fermé jusqu'à la bordure
// opposée (largeur dessinée), ouverte rabattue vers l'aval de la file ; sinon 2 m vers l'est, au point cliqué
function barPlace(x,z){let bd=6,B=null;for(const e of SEGS)for(let i=1;i<e.P.length;i++){const a=e.P[i-1],b=e.P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1e-9,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(l*l),0,1),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(px-x,pz-z);if(d<bd){bd=d;B={px,pz,tx:dx/l,tz:dz/l};}}
  if(!B)return {x:+x.toFixed(2),z:+z.toFixed(2),ang:0,len:2};
  let nx=-B.tz,nz=B.tx;if((x-B.px)*nx+(z-B.pz)*nz<0){nx=-nx;nz=-nz;}const hw=qwAt(B.px,B.pz)/2;
  return {x:+(B.px+nx*hw).toFixed(2),z:+(B.pz+nz*hw).toFixed(2),ang:+(Math.atan2(-nz,-nx)*180/Math.PI).toFixed(1),len:+(2*hw).toFixed(2),sw:nz*B.tz+nx*B.tx>=0?1:-1};}
let QOK=0;
SEGS.reverse(); // traités de la gare vers l'entrée, pour libérer la place devant avant d'avancer
const SEG_IN=STAGES[0].seg,SEG_OUT=STAGES[STAGES.length-1].seg;
let QLEN=0;
function buildQueue(){QLEN=STAGES.reduce((n,st)=>n+(st.seg?st.seg.len:st.fork.on?st.fork.loop.len:st.fork.short.len),0);}
QOK=1;reBars(); // barrières (GAME.barriers) et chemin suivi à chaque fourche (qRoute, buildQueue)
function nextSeg(s){const st=STAGES[s.si+1];if(!st)return null;if(st.seg)return st.seg;return st.fork.r;}
// à rebours : abandon par le chemin suivi ; évacuation par le plus court des deux chemins sans barrière fermée (sinon le raccourci : arrêt devant la barrière)
function prevSeg(s,evac){const st=STAGES[s.si-1];if(!st)return null;if(st.seg)return st.seg;const f=st.fork;if(!evac)return f.on?f.loop:f.short;
  return firstShut(f.short)<1e9&&firstShut(f.loop)>=1e9?f.loop:f.short;}
// Places de la file (tous les 0,25 m, interpolées entre deux : déplacement continu) : deux de front (±0,36 m) si l'allée le permet, corps (demi-largeur 0,27 m)
// toujours dans l'allée dessinée (0,06 m de marge), seul au milieu si elle est étroite ; ramené vers l'axe à l'approche d'un coude (au plus (distance au sommet - 0,3 m)
// / tan(angle/2)) et aux deux bouts du tronçon (jonctions, barrière d'entrée : sur l'axe, sans saut) : pas de visiteurs tassés à l'intérieur d'un virage ni de demi-tour en épingle qui revient en arrière. Recalculées après reGates (largeurs dessinées).
const QSTEP=.25;
// niveau : layer / level OSM d'une allée souterraine (COVD.ug, COVLV, engine/render.js), sinon 0 ; deux visiteurs de niveaux différents (allée qui passe au-dessus d'un couloir) ne se gênent pas
function segSpots(e){if(!QHW_OK){const o={},UGP=typeof COVD==='undefined'?[]:COV.map((P,i)=>[P,COVLV[i]]).filter((c,i)=>COVD[i].ug);for(const g of SEGS){const V=[];for(let i=1;i<g.P.length-1;i++){const a=g.P[i-1],b=g.P[i],c=g.P[i+1],t=Math.abs(Math.atan2((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])));
      if(t>.05)V.push([g.C[i],Math.tan(Math.min(t,3.1)/2)]);}
    const dir=(P,end)=>{const a=end?P[P.length-2]:P[0],b=end?P[P.length-1]:P[1];return Math.atan2(b[1]-a[1],b[0]-a[0]);},turn=(x,y)=>Math.abs(Math.atan2(Math.sin(y-x),Math.cos(y-x))),
      cand=st=>!st?[]:st.seg?[st.seg]:[st.fork.loop,st.fork.short]; // jonctions avec le tronçon suivant / précédent (fourche : les deux branches) comptées comme des coudes
    for(const [nb,end] of [[cand(STAGES[g.si+1]),1],[cand(STAGES[g.si-1]),0]])for(const h of nb){const t=end?turn(dir(g.P,1),dir(h.P,0)):turn(dir(h.P,1),dir(g.P,0));
      if(t>.05)V.push([end?g.len:0,Math.tan(Math.min(t,3.1)/2)]);}
    const n=Math.ceil(g.len/QSTEP);g.sp=[];for(let k=0;k<=n;k++){const d=Math.min(k*QSTEP,g.len);pathPos(g.P,g.C,d,o,0);let m=clamp(qwAt(o.x,o.z)/2-.33,0,.36);m=Math.min(m,d,g.len-d);for(const v of V)m=Math.min(m,Math.max(0,Math.abs(d-v[0])-.3)/v[1]);
      const nx=-Math.sin(o.a),nz=Math.cos(o.a);o.tx=nz;o.tz=-nx;g.sp.push([o.x,o.z,nx*m,nz*m,o.a,(UGP.find(c=>onPl(o,c[0],.3))||[0,0])[1]]);}
    // écart à garder derrière celui qui précède : au moins SP, plus là où le chemin se replie (épingle, virage serré) pour que celui-ci, en avançant, ne revienne
    // jamais à moins de QD (quels que soient les côtés) ; g.reach[k] = abscisse minimale du précédent pour un visiteur à la place k
    const S=g.sp,W=Math.round(3/QSTEP),dd=(A,a,B,b)=>Math.hypot(A[0]+A[2]*a-B[0]-B[2]*b,A[1]+A[3]*a-B[1]-B[3]*b);g.reach=[];
    for(let k=0;k<S.length;k++){let gk=Math.round(SP/QSTEP);for(let q=k+gk;q<=Math.min(S.length-1,k+W);q++){const A=S[k],B=S[q];if(A[5]===B[5]&&Math.min(dd(A,1,B,1),dd(A,1,B,-1),dd(A,-1,B,1),dd(A,-1,B,-1))<QD)gk=q-k+1;}
      g.reach.push(Math.min(k,S.length-1)*QSTEP+gk*QSTEP);}}QHW_OK=1;}
  return e.sp;}
// place la plus avancée (reste r) permise derrière un visiteur au reste rp sur le tronçon e
function qBehind(e,rp){segSpots(e);const dl=e.len-rp,R=e.reach;let k=Math.floor((dl-SP)/QSTEP+1e-9);if(k<0)return Math.max(rp+SP,0);
  if(k>=R.length)k=R.length-1;while(k>0&&R[k]>dl+1e-9)k--;return Math.max(rp+SP,e.len-k*QSTEP);}
const _qo={x:0,y:0,z:0,a:0};
function qSpot(v,e,r){const S=segSpots(e),d=clamp(e.len-r,0,e.len),k=Math.min(S.length-2,Math.floor(d/QSTEP)),f=S.length<2?0:clamp(d/QSTEP-k,0,1),A=S[Math.max(0,k)],B=S[Math.min(S.length-1,k+1)],sd=v.side||0;
  _qo.x=A[0]+(B[0]-A[0])*f+(A[2]+(B[2]-A[2])*f)*sd;_qo.z=A[1]+(B[1]-A[1])*f+(A[3]+(B[3]-A[3])*f)*sd;_qo.a=f<.5?A[4]:B[4];_qo.lv=f<.5?A[5]:B[5];return _qo;}
function qPlace(v){qSpot(v,v.e,v.r);v.x=_qo.x;v.z=_qo.z;v.lv=_qo.lv;v.hd=_qo.a+Math.PI/2+(v.jt||0);} // v.hd : épaules en travers de la marche (engine/render.js)
const QAFT=new Map(),QGRID=new Map(),QC=1.5,qk=(x,z)=>(Math.floor(x/QC)+4096)*8192+Math.floor(z/QC)+4096;
function qRanks(){QENT.length=0;for(const o of SEG_IN.list.slice(-3).concat(G.queue.filter(o=>o.mode==='app')))if(Math.hypot(o.x-ENTRY0[0],o.z-ENTRY0[1])<.6)QENT.push(o);let acc=0;for(let k=STAGES.length-1;k>=0;k--){const st=STAGES[k];if(st.seg)QAFT.set(st.seg,acc);else{QAFT.set(st.fork.loop,acc);QAFT.set(st.fork.short,acc);}
    acc+=st.seg?st.seg.len:(st.fork.on?st.fork.loop:st.fork.short).len;}
  QGRID.clear();G.queue.forEach((v,i)=>{v.rk=(v.mode==='q'&&v.e?v.r+(QAFT.get(v.e)||0):1e5+Math.hypot(v.x-ENTRY0[0],v.z-ENTRY0[1]))+i*1e-7;const k=qk(v.x,v.z);let c=QGRID.get(k);if(!c)QGRID.set(k,c=[]);c.push(v);});}
// v peut-il aller en (x, z) ? non (renvoie le gêneur) s'il s'y rapprocherait à moins de QD d'un visiteur qui le précède dans la file (s'en éloigner reste permis) ;
// un arrivant ne bouscule pas non plus un arrivant arrêté devant la barrière d'entrée (arrêté sans être retenu par un autre visiteur : o.bk nul, aucun cycle)
function qBlocked(v,x,z){const cx=Math.floor(x/QC),cz=Math.floor(z/QC);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=QGRID.get((cx+i+4096)*8192+cz+j+4096);if(!c)continue;
    for(const o of c){if(o===v||(o.lv|0)!==(v.lv|0)||!(o.rk<v.rk||v.mode==='app'&&o.mode==='app'&&!o.mv&&!o.bk))continue;
      const dn=Math.hypot(o.x-x,o.z-z);if(dn<QD&&dn<Math.hypot(o.x-v.x,o.z-v.z)-1e-6)return o;}}return null;}
const room=e=>!e.list.length||qBehind(e,e.list[e.list.length-1].r)<=e.len+1e-9; // place libre au début du tronçon (écart SP, plus dans un repli : qBehind)
function removeVisitor(v){const i=G.queue.indexOf(v);if(i>=0)G.queue.splice(i,1);if(v.e){const l=v.e.list,j=l.indexOf(v);if(j>=0)l.splice(j,1);}}
function clearQueue(){G.queue.length=0;for(const s of SEGS)s.list.length=0;}
const P3=(a,j)=>a.map(p=>[p[0]+rnd(-j,j),0,p[1]+rnd(-j,j)]);
function approach(){let r=Math.random()*SITE.approach.reduce((n,a)=>n+a.w,0);for(const a of SITE.approach){r-=a.w;if(r<=0)return a.pts;}return SITE.approach[0].pts;}
function leavePath(v){return [[v.x,0,v.z]].concat(v.pts.slice(0,v.i).reverse().map(p=>[p[0],0,p[2]]));} // demi-tour : repart par où il est venu (jamais en ligne droite vers l'entrée)
function backPath(v,evac){ // sortie à contre-sens par la file. Abandon : uniquement par les chemins ouverts. Évacuation : au plus court, barrières franchies.
  if(v.mode!=='q')return leavePath(v);
  const pts=[[v.x,0,v.z]];let e=v.e,ds=e.len-v.r;
  while(e){for(let i=e.P.length-1;i>=0;i--)if(e.C[i]<ds-.01)pts.push([e.P[i][0]+rnd(-.3,.3),0,e.P[i][1]+rnd(-.3,.3)]);e=prevSeg(e,evac);ds=1e9;}
  const r=pts.concat(P3((QS.lead||[]).slice().reverse().concat(approach().slice().reverse()),.7));r.qn=pts.length;return r;
}
// Évacuation de la file (propriétaire, issue #21, générique) : les visiteurs qui attendent derrière les portillons (G.plat, travées) ou qui s'y rendent (marcheurs 'wait',
// couloir d'attente SITE.board.walk) partent aussi : de la travée au couloir d'attente, SITE.board.via à rebours, puis toute la file à rebours jusqu'à l'entrée, comme
// les autres visiteurs évacués (le quai de débarquement est de l'autre côté de la voie : on ne la traverse pas). Les visiteurs assis ou qui embarquent restent.
function queueTail(){const st=STAGES[STAGES.length-1];if(!st)return [];const e=st.seg||(st.fork.on?st.fork.loop:st.fork.short);return backPath({mode:'q',e,r:0,x:e.P[e.P.length-1][0],z:e.P[e.P.length-1][1]},true);}
function platEvac(){const out=[],T=queueTail(),via=SITE.board.via.slice().reverse().map(q=>[q[0],0,q[1]]);
  for(let i=G.walkers.length-1;i>=0;i--){const k=G.walkers[i];if(k.kind!=='wait')continue;G.walkers.splice(i,1); // en chemin vers sa place : demi-tour par où il est venu (file → via → couloir → travée)
    const back=[[k.x,0,k.z]].concat(k.pts.slice(1,k.i).reverse().map(p=>[p[0],0,p[2]])),e=k.pts[0]; // parti de la réserve (zone d'attente éditée) : du polygone à la file
    if(BAREA&&pipA(BAREA,e[0],e[2])||!BAREA&&BRES.length&&resUnit(e)!=null){const w=boardOutP([e[0],0,e[2]]).slice(1);out.push({pts:back.concat(w,T.slice(1)),ci:k.ci,nv:back.length+w.length});}
    else out.push({pts:back.concat(T.slice(1)),ci:k.ci,nv:k.i});}
  (G.platR||[]).forEach((r,j)=>{if(r&&r.on&&BRES[j]){const w=boardOutP(BRES[j]);out.push({pts:w.concat(T.slice(1)),ci:r.ci,nv:w.length});}});if(G.platR)G.platR.fill(null); // réserve (issue #24)
  G.plat.forEach((r,i)=>{if(!r||!r.on)return;const s=seatUnit(i),g=GUNITS[s.u],b=BAYS[g.k],p=slotPos(i); // à sa place : recule dans la travée jusqu'au couloir d'attente
    if(BAREA){const w=boardOut(i);out.push({pts:w.concat(T.slice(1)),ci:r.ci,nv:w.length});return;} // zone d'attente éditée (GAME.boardAreas) : dans le polygone jusqu'à la file
    out.push({pts:[p,[b.x+b.rx*BWALK+b.tx*g.c,0,b.z+b.rz*BWALK+b.tz*g.c]].concat(via,T.slice(1)),ci:r.ci,nv:2+via.length});});
  const tail=T.length-(T.qn||T.length);G.plat.fill(null);for(const o of out){o.pts.qn=o.pts.length-tail;walker(o.pts,o.ci,null,rnd(2.6,3.2),0,'evac');G.walkers[G.walkers.length-1].pe=o.nv;}return out.length;}
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
  const pts=approach().concat(QS.lead||[]).map(p=>{const j=.7*clamp(Math.hypot(p[0]-ENTRY0[0],p[1]-ENTRY0[1])/3,0,1);return [p[0]+rnd(-j,j),0,p[1]+rnd(-j,j)];});pts.push([ENTRY0[0],0,ENTRY0[1]]); // écart aléatoire nul près de la barrière : les arrivants attendent en ligne sur l'accès, pas sur la file (issue #28)
  G.queue.push({ci:Math.floor(Math.random()*12),w:0,pat:rnd(220,420),mode:'app',side:Math.random()<.5?-1:1,jt:rnd(-.25,.25),sp:3.2,ph:rnd(0,6),pts,i:1,x:pts[0][0],y:0,z:pts[0][2],mv:true});
}
const _qp={x:0,y:0,z:0,side:0};
// barrière d'entrée occupée (dernier entré ou arrivant à moins de 0,6 m, QENT) : les arrivants attendent à 1 m, sans gêner celui qui s'engage dans la file
const QENT=[];
function qWalk(v,dt){if(v.i>=v.pts.length){v.mv=false;v.bk=null;return true;}const ox=v.x,oy=v.y,oz=v.z,oi=v.i,end=moveAlong(v,dt),nx=v.x,nz=v.z; // arrivant : avance sur l'accès sans rattraper celui qui le précède
  v.x=ox;v.z=oz;const de=Math.hypot(nx-ENTRY0[0],nz-ENTRY0[1]);let dO;const bk=qBlocked(v,nx,nz);v.bk=bk;if(bk||barHit(ox,oz,nx,nz)||de<1&&de<(dO=Math.hypot(ox-ENTRY0[0],oz-ENTRY0[1]))&&QENT.some(o=>o!==v&&(o.mode==='q'||Math.hypot(o.x-ENTRY0[0],o.z-ENTRY0[1])<dO))){v.y=oy;v.i=oi;v.mv=false;return false;}
  if(nx!==ox||nz!==oz){v.hd=Math.atan2(nz-oz,nx-ox)+Math.PI/2+(v.jt||0);v.rk-=Math.hypot(nx-ox,nz-oz);}v.x=nx;v.z=nz;v.mv=true;return end;}
function updateVisitors(dt){
  const w=G.wx.type,Q=G.queue;
  for(const b of BARS)b.t=clamp(b.t+(b.open?-dt:dt)/.9,0,1);
  const ev=evacOn(); // évacuation en cours (propriétaire, 20/11) : plus personne n'entre ni n'avance vers la gare
  if(G.open&&!ev){
    const hourF=.6+.8*Math.sin(Math.PI*clamp((G.time-600)/480,0,1)),wxF=w==='storm'?.25:w==='rain'?.6:1;
    // fréquentation réglable : au-delà de 100 %, les visiteurs viennent même si la file est déjà longue, jusqu'à la remplir
    const rate=.42*G.crowd*hourF*wxF*(.5+G.sat/100)*Math.max(.1,1-Q.length*SP/QLEN/Math.max(1,G.crowd*G.crowd))*dt;
    for(let n=Math.floor(rate)+(Math.random()<rate%1?1:0);n>0;n--)joinQueue();
  }
  const imp=w==='storm'?3:w==='rain'?1.5:1;qRanks();
  for(let i=Q.length-1;i>=0;i--){
    const v=Q[i];v.w+=dt*imp;
    if(v.w>v.pat*PAT_M[G.patL]){const p=backPath(v);removeVisitor(v);G.stats.quits++;G.sat=clamp(G.sat-.35,0,100);walker(p,C_GREY,null,3,0,'quit');continue;}
    if(ev&&v.mode==='app'){Q.splice(i,1);G.stats.turned++;walker(leavePath(v),v.ci,null,3,0,'turn');continue;} // évacuation : les arrivants repartent
    if(v.mode==='app'&&qWalk(v,dt)){ // arrivé devant la barrière d'entrée : seul passage vers la file
      if(!G.open){Q.splice(i,1);G.stats.turned++;walker(leavePath(v),v.ci,null,3,0,'turn');continue;}
      if(SEG_IN.bx.some(x=>!x.b.open&&x.d<.3))continue; // barrière fermée en travers du début de la file : personne n'entre
      if(!room(SEG_IN))continue; // patiente devant la barrière le temps que la file avance
      v.mode='q';v.e=SEG_IN;v.r=SEG_IN.len;SEG_IN.list.push(v);
    }
  }
  // avance dans la file : chacun reste derrière celui qui le précède et ne franchit une fourche que par la barrière ouverte
  if(!ev)for(const e of SEGS){
    const l=e.list,sh=e.bx.length?e.bx.filter(x=>!x.b.open):null,n0=l.length?nextSeg(e):null,t0=n0&&n0.list[n0.list.length-1],h0=t0?Math.max(0,SP-(n0.len-t0.r)):0; // premier du tronçon : écart SP avec le dernier du tronçon suivant
    for(let j=0;j<l.length;j++){const v=l[j];let nr=Math.max(j?qBehind(e,l[j-1].r):h0,v.r-4.5*dt*stepK(v.x,v.z));
      if(sh)for(const x of sh)if(v.r>e.len-x.d-1e-6)nr=Math.max(nr,Math.min(v.r,e.len-Math.max(0,x.d-.3))); // barrière fermée devant : arrêt à 0,3 m
      v.mv=v.r-nr>1e-4;
      if(v.mv){qSpot(v,e,nr);if(qBlocked(v,_qo.x,_qo.z)){v.mv=false;qPlace(v);continue;}v.rk-=v.r-nr;}
      v.r=nr;qPlace(v);}
    const h=l[0],nk=h&&h.r<=1e-3?nextSeg(e):null;
    if(nk&&room(nk)){l.shift();h.e=nk;h.r=nk.len;nk.list.push(h);}
  }
  for(let i=G.walkers.length-1;i>=0;i--){const k=G.walkers[i],o=k.kind==='evac'&&BARS.length?[k.x,k.y,k.z,k.i]:null,end=moveAlong(k,dt);
    const hb=o&&barHit(o[0],o[2],k.x,k.z);if(hb){[k.x,k.y,k.z,k.i]=o;k.bk=hb;continue;}if(o)k.bk=null; // évacué arrêté devant une barrière fermée (k.bk = la barrière, signalée par evacTick, engine/sim.js) : repart quand on l'ouvre
    if(end){if(k.done)k.done();G.walkers.splice(i,1);}}
}

