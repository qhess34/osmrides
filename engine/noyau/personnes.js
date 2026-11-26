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
const BRIDGE_DEF=OSM.feats.filter(f=>f.br).map((f,k)=>{const P=f.p,w=f.w?Math.max(1,f.w)+.3:2.4;let ty=Math.max(-1,...appel('hauteurSous',P,w/2+2)); // voie franchie (couche du type)
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
const APPW=2; // largeur d'un escalier « en applique » contre le mur de la gare (posé par le type, engine/montagnes-russes/quai.js)
appel('escaliers'); // escaliers propres au type (contre la gare, arrêtés au bord des quais) : avant le prolongement de l'entrée de la file
// Entrée de la file sur une zone piétonne (propriétaire, 2026-11-16, lot 6, d'après OzIris, générique) : là où la file débouche sur une zone piétonne OSM, elle est
// prolongée DANS la zone, dans l'axe de son premier tronçon, jusqu'à QMOUTH m de file dans la zone (SITE.queue.mouth, défaut 5 m, ESTIMÉ d'après OzIris) ; ce couloir
// est délimité par des barrières des deux côtés (engine/render.js, QSIDE). Le raccord QS.link commence à la bouche du couloir et les accès (SITE.approach) y mènent.
// Plafond (propriétaire, issue #9) : la part de file dans la zone (raccord compris) ne dépasse pas SITE.queue.mouthMax (défaut 20 %) de la profondeur de la zone, mesurée
// dans la direction du prolongement depuis le bord où la file en sort ; au-delà, le raccord est coupé à ce plafond (QS.mouthCut), sans jamais toucher à la file OSM.
const QE_SAVE={link:(QS.link||[]).slice(),lead:(QS.lead||[]).slice(),app:SITE.approach.map(A=>A.pts)}; // état avant le prolongement calculé (GAME.queueEntry le remplace, issue #39)
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
// Entrée de file réglée dans l'éditeur (issue #39) : GAME.queueEntry={len, ang} (m ; degrés, 0 = est, 90 = sud, comme les barrières) remplace le prolongement calculé
// ci-dessus (SITE.queue.mouth / mouthMax / link) par un segment droit depuis le début du chemin de file OSM (ENTRY0). Priorité GAME > SITE > calcul. Le bout reste sur une
// surface praticable : la longueur est ramenée au dernier point (pas de 0,2 m) situé dans une zone piétonne OSM (hors trous), à moins de la demi-largeur d'un chemin OSM
// (1,2 m par défaut, ESTIMÉ) ou à moins de 1,5 m de l'entrée calculée, et hors bâtiment (QE_CLAMP). Les accès (SITE.approach) sont prolongés jusqu'au bout ; gateAtMouth
// s'applique ensuite comme avant. Les barrières posées à la main (GAME.barriers) ne bougent pas. queueEntry() : valeurs pour l'éditeur.
const QE_MAX=30; // longueur maximale (m), même borne que editor/schema.js
const QENTRY=(()=>{const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100,C=(QS.link||[]).concat([ENTRY0]),p0=QS.parts[0]&&QS.parts[0].pts||[];
  let len=0;for(let i=1;i<C.length;i++)len+=Math.hypot(C[i][0]-C[i-1][0],C[i][1]-C[i-1][1]);
  let ang;if(len>.05)ang=Math.atan2(C[0][1]-ENTRY0[1],C[0][0]-ENTRY0[0]);else{const q=p0.find(q=>Math.hypot(q[0]-ENTRY0[0],q[1]-ENTRY0[1])>.5)||p0[1]||[ENTRY0[0]-1,ENTRY0[1]];ang=Math.atan2(ENTRY0[1]-q[1],ENTRY0[0]-q[0]);}
  const calc={len:r2(len),ang:r1(ang*180/Math.PI)},o=GM.queueEntry,base={o:ENTRY0.slice(),calc,max:QE_MAX};
  if(!o||typeof o!=='object'||!isFinite(o.len)||!isFinite(o.ang))return Object.assign(base,{game:false,len:calc.len,ang:calc.ang,want:calc.len,end:C[0].slice(),clamped:false});
  const AUTO_APP=SITE.approach.map(A=>A.pts); // accès du calcul (déjà praticables, raccord compris)
  QS.link=QE_SAVE.link.slice();QS.lead=QE_SAVE.lead.slice();SITE.approach.forEach((A,i)=>A.pts=QE_SAVE.app[i]);delete QS.mouthAt;delete QS.mouthCut; // calcul annulé
  const pin=(P,q)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>q[1])!==(P[j][1]>q[1])&&q[0]<(P[j][0]-P[i][0])*(q[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const PED=OSM.feats.filter(f=>f.k==='highway=pedestrian'&&f.c&&f.p.length>3),LN=[],BLD=OSM.feats.filter(f=>/^building=/.test(f.k)&&f.k!=='building=roof'&&f.c&&f.p.length>3).map(f=>f.p);
  for(const f of OSM.feats)if(/^highway=(footway|steps|pedestrian|path)$/.test(f.k)&&!(f.c&&f.p.length>3))LN.push([f.p,f.w?f.w/2:1.2]);
  for(const k in OSM.paths||{})if(OSM.paths[k]&&OSM.paths[k].length>1)LN.push([OSM.paths[k],1.2]);for(const P of QE_SAVE.app.concat(AUTO_APP))if(P.length>1)LN.push([P,1.2]); // accès écrits (SITE.approach) et calculés : praticables
  const walk=q=>!BLD.some(P=>pin(P,q))&&(dPl(q[0],q[1],C.length>1?C:[ENTRY0,ENTRY0])<1.5||PED.some(f=>pin(f.p,q)&&!(f.h||[]).some(H=>pin(H,q)))||LN.some(([P,hw])=>dPl(q[0],q[1],P)<hw));
  const want=clamp(+o.len,0,QE_MAX),t=+o.ang*Math.PI/180,ux=Math.cos(t),uz=Math.sin(t),at=d=>d>.05?[r2(ENTRY0[0]+ux*d),r2(ENTRY0[1]+uz*d)]:ENTRY0.slice();let d=0;
  while(d<want-1e-6){const n=Math.min(want,d+.2);if(!walk([ENTRY0[0]+ux*n,ENTRY0[1]+uz*n]))break;d=n;}
  // accès : derniers points le long de l'ancienne entrée (QE_SAVE.link) ou de la nouvelle retirés, puis raccord droit jusqu'au bout ; raccord non praticable : entrée raccourcie
  const OLD=QE_SAVE.link.concat([ENTRY0]),apps=M=>QE_SAVE.app.map(P0=>{const P=P0.slice();while(P.length>1&&(dPl(P[P.length-1][0],P[P.length-1][1],[M,ENTRY0])<1.6||(OLD.length>1&&dPl(P[P.length-1][0],P[P.length-1][1],OLD)<1.6)))P.pop();P.push(M.slice());return P;});
  const conOk=M=>apps(M).every(P=>{const a=P[P.length-2],b=P[P.length-1];if(!a)return true;const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);for(let i=1;i<n;i++)if(!walk([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]))return false;return true;});
  while(d>.05&&!conOk(at(d)))d=Math.max(0,d-.2);
  const M=at(d);QS.link=d>.05?[M]:[];QS.lead=[];QS.mouthAt=M;apps(M).forEach((P,i)=>SITE.approach[i].pts=P); // accès jusqu'au bout de l'entrée
  return Object.assign(base,{game:true,len:r2(d),ang:r1(+o.ang),want:r2(want),end:M.slice(),clamped:d<want-.05});})();
const queueEntry=()=>Object.assign({},QENTRY,{o:QENTRY.o.slice(),end:QENTRY.end.slice(),calc:Object.assign({},QENTRY.calc)});
// Barrière d'entrée au bout du prolongement (SITE.queue.gateAtMouth, propriétaire, issue #9, Zeus : barrière devant la statue) : AJUSTEMENT du jeu, pas OSM.
// Le raccord dans la zone piétonne devient le début de la file : la barrière d'entrée (nœud OSM ou QS.gate) est déplacée à la bouche du couloir (QS.mouthAt).
if(QS.gateAtMouth&&QS.link&&QS.link.length){const P=QS.parts[0].pts,L=QS.link;QS.osmEntry0=ENTRY0.slice();QS.parts[0].pts=L.concat(P.filter((q,i)=>i||Math.hypot(q[0]-L[L.length-1][0],q[1]-L[L.length-1][1])>.05));
  ENTRY0=QS.entry0=L[0].slice();QS.link=[];QS.lead=[];QS.gateMoved=1;}
const STAGES=[],LOOPS=[],SEGS=[];
QS.parts.forEach((p,si)=>{
  if(p.pts){const s=mkSeg(p.pts);s.si=si;STAGES.push({seg:s});SEGS.push(s);}
  else{const l={name:p.name,on:true,t:1,r:null,loop:mkSeg(p.loop),short:mkSeg(p.short)};l.loop.si=l.short.si=si;l.loop.fk=l.short.fk=l;LOOPS.push(l);STAGES.push({fork:l});SEGS.push(l.loop,l.short);}
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
function qRoute(){BARV++;let dO=0,dA=0; // distance jusqu'à la gare : par des barrières ouvertes seulement (dO, Infinity sans trajet ouvert) / sans tenir compte des barrières (dA)
  for(let k=STAGES.length-1;k>=0;k--){const st=STAGES[k],B=st.seg?[st.seg]:[st.fork.short,st.fork.loop],o=B.map(e=>firstShut(e)<1e9?Infinity:e.len+dO),a=B.map(e=>e.len+dA);
    let j=0;if(Math.min(...o)<Infinity)j=o[1]<o[0]?1:0;else j=a[1]<a[0]?1:0;
    if(st.fork){st.fork.r=B[j];st.fork.on=B[j]===st.fork.loop;}dO=o[j];dA=Math.min(...a);}
  if(QOK)buildQueue();}
// clic sur la carte (engine/render.js) : une barrière, seule
function toggleBar(i){const b=BARS[i];if(!b)return;b.open=!b.open;if(b.open&&b.wq){b.wq.forEach((k,j)=>{k.hold=j*SP/(k.sp||3);k.bwb=null;});b.wq=null;}qRoute();log('Barrière '+b.key+(b.open?' ouverte':' fermée')+' — file : '+Math.floor(QLEN/SP)+' places.');}
// premier vantail fermé franchi par le déplacement (x0, z0) → (x1, z1) d'un marcheur (arrivant, évacué) : vantail sans ses 0,3 premiers mètres (le poteau est sur la
// bordure commune de deux allées à une fourche : un marcheur de l'autre allée, écarté de l'axe, ne s'y accroche pas)
const barHit=(x0,z0,x1,z1)=>{for(const b of BARS)if(!b.open){const u=segX([x0,z0],[x1,z1],b.H2,b.A);if(u!=null&&u>1e-6)return b;}return null;};
// File devant une barrière fermée (propriétaire, issue #40, générique) : arrivants et évacués que la barrière arrête attendent EN FILE derrière elle, sur leur propre
// trajet (donc sur le chemin), jamais à moins de QD (0,4 m > QPW) l'un de l'autre. Seuls ceux dont le reste du trajet franchit cette barrière fermée (barAhead, en
// cache jusqu'au prochain changement de barrière, BARV) s'y alignent : arrêt avant le vantail ou avant de s'approcher à moins de QD d'un visiteur déjà arrêté
// (b.wq, ordre d'arrivée) ; arrêté trop près (deux arrivés en même temps), il recule sur son trajet jusqu'à la première place libre (barStepBack) ; deux de front
// seulement là où les trajets (écartés au hasard dans la largeur du chemin) le permettent (évacué reculé sur la file : places de segSpots). Plus de place sur l'accès :
// l'arrivant renonce. À l'ouverture, ils repartent dans l'ordre, chacun SP / vitesse après celui qui le précède (k.hold). En route : un évacué ne s'approche pas à moins
// de QD de celui qui le précède vers la même barrière (evacAhead) ; arrivants rangés par reste à parcourir sur leur trajet (ptsLeft), un arrivant arrêté retient ceux
// qui l'approchent sauf s'il les attend lui-même (bkTo : pas d'interblocage) et un arrivant arrêté à moins de QD d'un autre recule (qWalk). Les visiteurs de la file
// elle-même (mode 'q') s'arrêtent déjà en file (qBehind). Mesure : overlapQ de la ligne « bars: » de tools/check.js.
var BARV=0;
function barAhead(k){if(k.bv===BARV)return k.ba;k.bv=BARV;k.ba=null;let x=k.x,z=k.z;
  for(let i=k.i;i<k.pts.length;i++){const q=k.pts[i],b=barHit(x,z,q[0],q[2]);if(b){const u=segX([x,z],[q[0],q[2]],b.H2,b.A)||0;k.ba=b;k.bj=i;k.bX=[x+(q[0]-x)*u,z+(q[2]-z)*u];break;}x=q[0];z=q[2];}return k.ba;}
// reste à parcourir par k jusqu'au vantail de sa barrière (barAhead) : ordre de la file devant elle
function barDist(k){const P=k.pts,j=k.bj,X=k.bX;if(k.i>=j)return Math.hypot(X[0]-k.x,X[1]-k.z);if(!P.cum){P.cum=[0];for(let i=1;i<P.length;i++)P.cum.push(P.cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));}
  return Math.hypot(P[k.i][0]-k.x,P[k.i][2]-k.z)+P.cum[j-1]-P.cum[k.i]+Math.hypot(X[0]-P[j-1][0],X[1]-P[j-1][2]);}
// évacués en route vers une barrière fermée (grille EGRID, refaite à chaque pas) : aucun ne s'approche à moins de QD de celui qui le précède vers la même barrière
// (k.bdd : reste à parcourir jusqu'au vantail) ; déjà à moins de QD d'un autre (partis côte à côte, trajets qui se croisent) : il passe, pour ne jamais s'arrêter collé
const EGRID=new Map(),eNear=(x,z,f)=>{const cx=Math.floor(x/QC),cz=Math.floor(z/QC);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=EGRID.get((cx+i+4096)*8192+cz+j+4096);if(c)for(const o of c)if(f(o))return o;}return null;};
function evacAhead(k){let bl=null;if(eNear(k.ox,k.oz,o=>o!==k&&Math.hypot(o.x-k.ox,o.z-k.oz)<QD))return null;
  eNear(k.x,k.z,o=>{if(o!==k&&o.ba===k.ba&&o.bdd<k.bdd){const dn=Math.hypot(o.x-k.x,o.z-k.z);if(dn<QD&&dn<Math.hypot(o.x-k.ox,o.z-k.oz)-1e-6)bl=o;}return bl;});return bl;}
// place (x, z) libre : à QD au moins des autres arrivants arrêtés (QGRID) ou des autres évacués arrêtés (EGRID), file devant la barrière comprise ;
// all : de tous, même en marche (place où l'on recule : on n'y retombe pas sur un autre)
const barFree=(W,x,z,k,all)=>k.mode==='app'?!qStill(k,x,z,all):k.kind==='evac'?!eNear(x,z,o=>o!==k&&(all||o.bk)&&Math.hypot(o.x-x,o.z-z)<QD):W.every(m=>Math.hypot(m.x-x,m.z-z)>=QD);
function qStill(v,x,z,all){const cx=Math.floor(x/QC),cz=Math.floor(z/QC);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=QGRID.get((cx+i+4096)*8192+cz+j+4096);if(c)for(const o of c)if(o!==v&&(o.mode==='q'&&!(o.lv|0)||o.mode==='app'&&(all||!o.mv))&&Math.hypot(o.x-x,o.z-z)<QD)return true;}return false;}
const gridAdd=k=>{const G2=k.mode==='app'?QGRID:EGRID,c=qk(k.x,k.z);let L=G2.get(c);if(!L)G2.set(c,L=[]);L.push(k);}; // reculé : case de la grille à jour
// évacué (sur la file) : première place libre sur l'axe de la file en reculant vers la gare depuis sa position, deux de front si l'allée le permet (segSpots) ;
// trajet prolongé d'autant (il repartira de là)
function evacBack(k,W){let bd=1.5,e=null,d=0;for(const g of SEGS){const r=_np(g.P,k.x,k.z);if(r.d<bd){bd=r.d;e=g;d=r.at;}}const A=[];
  for(let n=0,left=300;e&&left>0;n++){d+=QSTEP;left-=QSTEP;if(d>e.len){d-=e.len;e=nextSeg(e);continue;}const S=segSpots(e),sp=S[Math.min(S.length-1,Math.round(d/QSTEP))];if(n%2===0)A.push([sp[0],0,sp[1]]);
    for(const sd of [0,1,-1]){if(sd&&!sp[2]&&!sp[3])break;const x=sp[0]+sp[2]*sd,z=sp[1]+sp[3]*sd;if(!barFree(W,x,z,k,1))continue;
      A.push([x,0,z]);const h=A.reverse().concat([[k.x,0,k.z]]),pts=h.concat(k.pts.slice(k.i));pts.qn=(k.pts.qn||k.pts.length)-k.i+h.length;
      if(k.pe!=null)k.pe=k.pe>=k.i?k.pe-k.i+h.length:0;k.pts=pts;k.bv=-1;k.x=x;k.z=z;k.y=0;k.i=1;gridAdd(k);return true;}}
  return false;}
function barStepBack(k,W){if(k.kind==='evac'&&evacBack(k,W))return true;let ex=k.x,ez=k.z,left=60;for(let i=k.i-1;i>=0&&left>0;i--){const p=k.pts[i],L=Math.hypot(ex-p[0],ez-p[2]);
    for(let t=.05;t<=L+1e-9&&left>0;t+=.05,left-=.05){const x=ex+(p[0]-ex)*t/L,z=ez+(p[2]-ez)*t/L;if(barFree(W,x,z,k,1)){k.x=x;k.z=z;k.y=p[1];k.i=i+1;gridAdd(k);return true;}}ex=p[0];ez=p[2];}
  return false;}
// k vient d'avancer depuis o = [x, y, z, i] : arrêté (remis en o, ou reculé) s'il franchirait la barrière fermée de son trajet ou s'approcherait d'un visiteur arrêté
// devant elle ; renvoie 0 (libre), 1 (arrêté en file), 2 (aucune place derrière : l'arrivant renonce)
function barWait(k,o){let b=k.bwb;if(b&&(b.open||!BARS.includes(b)))b=k.bwb=null;
  if(b){[k.x,k.y,k.z,k.i]=o;return 1;}
  b=barAhead(k);const hit=barHit(o[0],o[2],k.x,k.z);if(!b&&!hit)return 0;b=b||hit;const W=b.wq||(b.wq=[]);
  if(!hit&&W.every(m=>{const d=Math.hypot(m.x-k.x,m.z-k.z);return d>=QD||d>=Math.hypot(m.x-o[0],m.z-o[2])-1e-6;}))return 0;
  [k.x,k.y,k.z,k.i]=o;if(!barFree(W,k.x,k.z,k)&&!barStepBack(k,W))return 2;W.push(k);k.bwb=b;return 1;}
// évacuation en cours : un évacué est encore dans la file (avant le début du raccord d'entrée et de l'accès, pts.qn = points de la file, backPath / platEvac)
const evacOn=()=>G.walkers.some(k=>k.kind==='evac'&&k.i<(k.pts.qn||k.pts.length));
// éditeur : barrière posée au clic (x, z) en travers de l'allée de file la plus proche (à moins de 6 m) : poteau sur la bordure côté clic, vantail fermé jusqu'à la bordure
// opposée (largeur dessinée), ouverte rabattue vers l'aval de la file ; sinon 2 m vers l'est, au point cliqué
function barPlace(x,z){let bd=6,B=null;for(const e of SEGS)for(let i=1;i<e.P.length;i++){const a=e.P[i-1],b=e.P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1e-9,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(l*l),0,1),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(px-x,pz-z);if(d<bd){bd=d;B={px,pz,tx:dx/l,tz:dz/l};}}
  if(!B)return {x:+x.toFixed(2),z:+z.toFixed(2),ang:0,len:2};
  let nx=-B.tz,nz=B.tx;if((x-B.px)*nx+(z-B.pz)*nz<0){nx=-nx;nz=-nz;}const hw=qwAt(B.px,B.pz)/2;
  return {x:+(B.px+nx*hw).toFixed(2),z:+(B.pz+nz*hw).toFixed(2),ang:+(Math.atan2(-nz,-nx)*180/Math.PI).toFixed(1),len:+(2*hw).toFixed(2),sw:nz*B.tz+nx*B.tx>=0?1:-1};}
// Aimant des barrières (éditeur, demande du propriétaire 20/11) : point le plus proche, à moins de r m, sur une bordure d'allée de file dessinée (axe des tronçons et de
// l'entrée, demi-largeur qwAt = largeur OSM ou dessinée ; bordure = points à une demi-largeur de l'axe, arrondie à l'extérieur des coudes) ; o = point en face sur la bordure
// opposée, d = distance.
function edgeSnap(x,z,r){let B=null;const L=SEGS.map(e=>e.P).concat([(QS.link||[]).concat([ENTRY0])]);
  for(const P of L)for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.05)continue;const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(l*l),0,1),px=a[0]+dx*t,pz=a[1]+dz*t,hw=qwAt(px,pz)/2;
    let dc=Math.hypot(x-px,z-pz),nx,nz;if(dc>1e-4){nx=(x-px)/dc;nz=(z-pz)/dc;}else{nx=-dz/l;nz=dx/l;dc=0;}const d=Math.abs(dc-hw);
    if(d<r&&(!B||d<B.d))B={d:+d.toFixed(3),p:[+(px+nx*hw).toFixed(2),+(pz+nz*hw).toFixed(2)],o:[+(px-nx*hw).toFixed(2),+(pz-nz*hw).toFixed(2)],w:+(2*hw).toFixed(2)};}
  return B;}
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
function qPlace(v){qSpot(v,v.e,v.r);v.x=_qo.x;v.z=_qo.z;v.lv=_qo.lv;v.hd=_qo.a+Math.PI/2+(v.jt||0)+(v.rv?Math.PI:0);} // v.hd : épaules en travers de la marche (engine/render.js)
// reste à parcourir sur son trajet (arrivant : jusqu'à la barrière d'entrée) : rang des arrivants, cohérent là où les accès se rejoignent ou tournent (issue #40)
function ptsLeft(k){const P=k.pts;if(k.i>=P.length)return 0;if(!P.cum){P.cum=[0];for(let i=1;i<P.length;i++)P.cum.push(P.cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));}
  return Math.hypot(P[k.i][0]-k.x,P[k.i][2]-k.z)+P.cum[P.length-1]-P.cum[k.i];}
const QAFT=new Map(),QGRID=new Map(),QC=1.5,qk=(x,z)=>(Math.floor(x/QC)+4096)*8192+Math.floor(z/QC)+4096;
function qRanks(){QENT.length=0;for(const o of SEG_IN.list.slice(-3).concat(G.queue.filter(o=>o.mode==='app')))if(Math.hypot(o.x-ENTRY0[0],o.z-ENTRY0[1])<.6)QENT.push(o);let acc=0;for(let k=STAGES.length-1;k>=0;k--){const st=STAGES[k];if(st.seg)QAFT.set(st.seg,acc);else{QAFT.set(st.fork.loop,acc);QAFT.set(st.fork.short,acc);}
    acc+=st.seg?st.seg.len:(st.fork.on?st.fork.loop:st.fork.short).len;}
  QGRID.clear();G.queue.forEach((v,i)=>{v.rk=(v.mode==='q'&&v.e?v.r+(QAFT.get(v.e)||0):1e5+ptsLeft(v))+i*1e-7;const k=qk(v.x,v.z);let c=QGRID.get(k);if(!c)QGRID.set(k,c=[]);c.push(v);});}
// v peut-il aller en (x, z) ? non (renvoie le gêneur) s'il s'y rapprocherait à moins de QD d'un visiteur qui le précède dans la file (s'en éloigner reste permis) ;
// un arrivant ne bouscule pas non plus un arrivant arrêté, sauf si celui-ci l'attend (bkTo, issue #40 : aucun cycle)
// o attend-il (directement ou par une chaîne de visiteurs qui s'attendent, o.bk) que v avance ? alors v n'attend pas o (pas d'interblocage)
function bkTo(o,v){for(let n=0;o&&n<12;n++){o=o.bk;if(o===v)return true;}return false;}
function qBlocked(v,x,z){const cx=Math.floor(x/QC),cz=Math.floor(z/QC);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=QGRID.get((cx+i+4096)*8192+cz+j+4096);if(!c)continue;
    for(const o of c){if(o===v||(o.lv|0)!==(v.lv|0)||!(o.rk<v.rk||v.mode==='app'&&o.mode==='app'&&!o.mv&&!bkTo(o,v)))continue;
      const dn=Math.hypot(o.x-x,o.z-z);if(dn<QD&&dn<Math.hypot(o.x-v.x,o.z-v.z)-1e-6)return o;}}return null;}
const room=e=>!e.list.length||qBehind(e,e.list[e.list.length-1].r)<=e.len+1e-9; // place libre au début du tronçon (écart SP, plus dans un repli : qBehind)
function removeVisitor(v){v.bwb=null;const i=G.queue.indexOf(v);if(i>=0)G.queue.splice(i,1);if(v.e){const l=v.e.list,j=l.indexOf(v);if(j>=0)l.splice(j,1);}}
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
// trajet à rebours depuis le bout de la file jusqu'à l'entrée (évacuation des places d'attente, couche du type)
function queueTail(){const st=STAGES[STAGES.length-1];if(!st)return [];const e=st.seg||(st.fork.on?st.fork.loop:st.fork.short);return backPath({mode:'q',e,r:0,x:e.P[e.P.length-1][0],z:e.P[e.P.length-1][1]},true);}
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
  const LK=(QS.link||[]).concat([ENTRY0]),pts=approach().concat(QS.lead||[]).map(p=>{let j=.7*clamp(Math.hypot(p[0]-ENTRY0[0],p[1]-ENTRY0[1])/3,0,1);if(LK.length>1&&dPl(p[0],p[1],LK)<.05)j=Math.min(j,Math.max(0,qwAt(p[0],p[1])/2-.2)*.7); // dans la largeur du prolongement de l'entrée (issue #39)
  return [p[0]+rnd(-j,j),0,p[1]+rnd(-j,j)];});pts.push([ENTRY0[0],0,ENTRY0[1]]); // écart aléatoire nul près de la barrière : les arrivants attendent en ligne sur l'accès, pas sur la file (issue #28)
  if(qStill(null,pts[0][0],pts[0][2])){G.stats.turned++;return;} // accès plein jusqu'à son début (barrière fermée, issue #40) : il renonce
  G.queue.push({ci:Math.floor(Math.random()*12),w:0,pat:rnd(220,420),mode:'app',side:Math.random()<.5?-1:1,jt:rnd(-.25,.25),sp:3.2,ph:rnd(0,6),pts,i:1,x:pts[0][0],y:0,z:pts[0][2],mv:true});
}
const _qp={x:0,y:0,z:0,side:0};
// barrière d'entrée occupée (dernier entré ou arrivant à moins de 0,6 m, QENT) : les arrivants attendent à 1 m, sans gêner celui qui s'engage dans la file
const QENT=[];
function turnAway(v){const j=G.queue.indexOf(v);if(j>=0)G.queue.splice(j,1);v.bwb=null;G.stats.turned++;walker(leavePath(v),v.ci,null,3,0,'turn');} // arrivant sans place pour attendre (issue #40) : il renonce
function qWalk(v,dt){if(v.i>=v.pts.length){v.mv=false;v.bk=null;return true;}if(v.hold>0){v.hold-=dt;v.mv=false;return false;}const ox=v.x,oy=v.y,oz=v.z,oi=v.i,end=moveAlong(v,dt),nx=v.x,nz=v.z; // arrivant : avance sur l'accès sans rattraper celui qui le précède
  const bw=BARS.length?barWait(v,[ox,oy,oz,oi]):0;if(bw){v.mv=false;v.bk=null;if(bw===2)turnAway(v);return false;} // en file devant une barrière fermée (issue #40)
  v.x=ox;v.z=oz;const de=Math.hypot(nx-ENTRY0[0],nz-ENTRY0[1]);let dO;const bk=qBlocked(v,nx,nz);v.bk=bk;if(bk||de<1&&de<(dO=Math.hypot(ox-ENTRY0[0],oz-ENTRY0[1]))&&QENT.some(o=>o!==v&&(o.mode==='q'||Math.hypot(o.x-ENTRY0[0],o.z-ENTRY0[1])<dO))){v.y=oy;v.i=oi;v.mv=false;if(qStill(v,v.x,v.z)&&!barStepBack(v,[]))turnAway(v);return false;} // arrêté sur un autre arrivant arrêté (arrivés ensemble, flux qui se rejoignent) : recule sur son trajet, sinon renonce (issue #40)
  if(nx!==ox||nz!==oz){v.hd=Math.atan2(nz-oz,nx-ox)+Math.PI/2+(v.jt||0);v.rk-=Math.hypot(nx-ox,nz-oz);}v.x=nx;v.z=nz;v.mv=true;return end;}
/* Barrière fermée dans une branche de fourche (issue #58, règle « fourche bloquée : autre chemin », qRoute) : les visiteurs déjà entrés dans cette branche, EN AMONT de sa première
   barrière fermée (aucune barrière fermée entre eux et le début de la branche), repartent À REBOURS le long de la branche (QRET m/s, ESTIMÉ : marche d'attente) jusqu'à la fourche
   et reprennent l'autre branche, si celle-ci n'a aucune barrière fermée (la branche suivie par qRoute). Ceux qui l'ont déjà dépassée, ou dont l'autre branche est fermée aussi,
   restent devant la barrière. Chacun garde l'écart de la file (qBehind) avec celui qui est derrière lui, jamais de saut : v.r croît de QRET·dt au plus ; à la fourche il passe
   en queue de l'autre branche (room), sinon attend au début de la sienne. v.rv = recule (tête retournée, qPlace). Le reste suit : avance normale (updateVisitors). */
const QRET=3;
function qNear(v,e,x,z){const cx=Math.floor(x/QC),cz=Math.floor(z/QC);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=QGRID.get((cx+i+4096)*8192+cz+j+4096);
  if(c)for(const o of c)if(o!==v&&o.mode==='q'&&o.e!==e&&(o.lv|0)===(v.lv|0)&&Math.hypot(o.x-x,o.z-z)<QD)return true;}return false;}
function qRetreat(e,dt){const f=e.fk,l=e.list;
  const go=f&&l.length&&f.r!==e&&firstShut(e)<1e9&&firstShut(f.r)>=1e9;
  if(!go){for(const v of l)if(v.rv){v.rv=false;qPlace(v);}return;}
  const dm=firstShut(e),o=f.r;
  for(let j=l.length-1;j>=0;j--){const v=l[j];
    if(e.len-v.r>dm+1e-6){if(v.rv){v.rv=false;qPlace(v);}continue;} // au-delà de la première barrière fermée : il n'y retourne pas
    v.rv=true;const nx=l[j+1];let nr=Math.min(e.len,v.r+QRET*dt);
    if(nx&&qBehind(e,nr)>nx.r+1e-9)nr=v.r; // celui de derrière n'a pas encore reculé
    if(nr>v.r){qSpot(v,e,nr);if(qNear(v,e,_qo.x,_qo.z))nr=v.r;} // près du début de la branche : ni sur celui de l'autre branche ni sur celui du tronçon précédent
    v.mv=nr>v.r+1e-6;v.rk+=nr-v.r;v.r=nr;
    if(v.r>=e.len-1e-6&&room(o)){l.splice(j,1);v.e=o;v.r=o.len;v.rv=false;o.list.push(v);}
    qPlace(v);}}
function updateVisitors(dt){
  const w=G.wx.type,Q=G.queue;
  for(const b of BARS){b.t=clamp(b.t+(b.open?-dt:dt)/.9,0,1);if(b.wq)b.wq=b.wq.filter(m=>m.bwb===b);} // file devant la barrière : partis retirés
  const ev=evacOn(); // évacuation en cours (propriétaire, 20/11) : plus personne n'entre ni n'avance vers la gare
  if(G.open&&!ev){
    const hourF=.6+.8*Math.sin(Math.PI*clamp((G.time-T_OPEN)/(T_CLOSE-T_OPEN-60),0,1)),wxF=w==='storm'?.25:w==='rain'?.6:1;
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
    qRetreat(e,dt);
    const l=e.list,sh=e.bx.length?e.bx.filter(x=>!x.b.open):null,n0=l.length?nextSeg(e):null,t0=n0&&n0.list[n0.list.length-1],h0=t0?Math.max(0,SP-(n0.len-t0.r)):0; // premier du tronçon : écart SP avec le dernier du tronçon suivant
    for(let j=0;j<l.length;j++){const v=l[j];if(v.rv)continue; // recule (qRetreat)
      let nr=Math.max(j?qBehind(e,l[j-1].r):h0,v.r-4.5*dt*stepK(v.x,v.z));
      if(sh)for(const x of sh)if(v.r>e.len-x.d-1e-6)nr=Math.max(nr,Math.min(v.r,e.len-Math.max(0,x.d-.3))); // barrière fermée devant : arrêt à 0,3 m
      v.mv=v.r-nr>1e-4;
      if(v.mv){qSpot(v,e,nr);if(qBlocked(v,_qo.x,_qo.z)){v.mv=false;qPlace(v);continue;}v.rk-=v.r-nr;}
      v.r=nr;qPlace(v);}
    const h=l[0],nk=h&&h.r<=1e-3?nextSeg(e):null;
    if(nk&&room(nk)){l.shift();h.e=nk;h.r=nk.len;nk.list.push(h);}
  }
  for(const v of Q.slice())if(v.mode==='app'&&!v.mv&&v.i<v.pts.length&&qStill(v,v.x,v.z)&&!barStepBack(v,[]))turnAway(v); // arrivant arrêté que la file vient de rejoindre (début de file le long de l'accès) : recule (issue #44)
  EGRID.clear();if(BARS.length)for(const k of G.walkers)if(k.kind==='evac'&&barAhead(k)){k.bdd=barDist(k);const c=qk(k.x,k.z);let L=EGRID.get(c);if(!L)EGRID.set(c,L=[]);L.push(k);}
  for(let i=G.walkers.length-1;i>=0;i--){const k=G.walkers[i],o=k.kind==='evac'&&BARS.length?[k.x,k.y,k.z,k.i]:null;if(o&&k.hold>0){k.hold-=dt;continue;}const end=moveAlong(k,dt);
    if(o&&k.ba&&k.bv===BARV&&!k.bwb){k.ox=o[0];k.oz=o[2];if(evacAhead(k)){[k.x,k.y,k.z,k.i]=o;k.bk=k.ba||1;continue;}} // derrière un évacué qui le précède vers la barrière : attend
    if(o&&barWait(k,o)){k.bk=k.bwb||1;continue;}if(o)k.bk=0; // évacué arrêté en file devant une barrière fermée (issue #40) : repart, dans l'ordre, quand on l'ouvre
    if(end){if(k.done)k.done();G.walkers.splice(i,1);}}
}
