'use strict';
/* ══════════ ZONE D'ATTENTE AVANT L'EMBARQUEMENT (générique : quai d'un train, plus tard quai de tram ou de bus) ══════════
   Polygone édité (GAME.boardAreas, docs/ARCHITECTURE.md D7), trajets à l'intérieur, fin de la file à raccorder. Le type d'attraction déclare son quai
   (extension({embarquement:{repere, ligneOk}})) : repere = {x, z, tx, tz, rx, rz} (origine, axe le long du quai, axe qui s'en éloigne : repère lon / lat),
   ligneOk(x, z) = point du côté des visiteurs (derrière la ligne d'embarquement). Les places (et leur réserve) sont posées par le type : BSLOTS, BRES. */
const EMB={repere:{x:0,z:0,tx:1,tz:0,rx:0,rz:1},ligneOk:()=>true};
function embarquement(){for(const e of EXTENSIONS)if(e.embarquement)Object.assign(EMB,e.embarquement);} // relu à chaque lecture de la zone (lireZoneAttente)
const BA_IN=.2,BR_MAX=400;let BAREA=null,BSLOTS=null,BVIA=null,BNODES=[],BRES=[];
const pipA=(P,x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
const nearEdgeA=(P,x,z)=>{let m=1e9,q=null,n=null;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[j],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1e-9,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/l,0,1),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(px-x,pz-z);
  if(d<m){m=d;q=[px,pz];const ll=Math.sqrt(l);n=[-dz/ll,dx/ll];}}return {d:m,q,n};};
const inA=(x,z,m)=>pipA(BAREA,x,z)&&nearEdgeA(BAREA,x,z).d>=m;
function intoA(x,z){ // point du polygone (à BA_IN du bord, derrière les portillons) le plus proche de (x, z)
  if(inA(x,z,BA_IN)&&EMB.ligneOk(x,z))return [x,z];const e=nearEdgeA(BAREA,x,z);
  for(const k of [1,2,4,8])for(const s of [1,-1]){const p=[e.q[0]+e.n[0]*s*BA_IN*k,e.q[1]+e.n[1]*s*BA_IN*k];if(inA(p[0],p[1],BA_IN*.9)&&EMB.ligneOk(p[0],p[1]))return p;}
  let best=null,bd=1e9;for(const p of BNODES){const d=Math.hypot(p[0]-x,p[1]-z);if(d<bd){bd=d;best=p;}}return best||e.q;}
function segInA(a,b){ // segment a-b entièrement dans le polygone (aucun bord coupé, milieu dedans)
  const P=BAREA,cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  for(let i=0,j=P.length-1;i<P.length;j=i++){const c=P[j],d=P[i],d1=cr(a,b,c),d2=cr(a,b,d),d3=cr(c,d,a),d4=cr(c,d,b);if(d1*d2<0&&d3*d4<0)return false;}
  for(const t of [.25,.5,.75])if(!pipA(P,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false;return true;}
function routeA(a,b){ // plus court chemin de a à b dans le polygone (sommets intérieurs BNODES) : liste des points après a, b compris
  if(segInA(a,b))return [b];const N=[a].concat(BNODES,[b]),n=N.length,D=new Array(n).fill(1e9),pr=new Array(n).fill(-1),done=new Array(n).fill(false);D[0]=0;
  for(;;){let u=-1;for(let i=0;i<n;i++)if(!done[i]&&D[i]<1e9&&(u<0||D[i]<D[u]))u=i;if(u<0||u===n-1)break;done[u]=true;
    for(let v=0;v<n;v++){if(done[v]||v===u)continue;const w=D[u]+Math.hypot(N[v][0]-N[u][0],N[v][1]-N[u][1]);if(w<D[v]&&segInA(N[u],N[v])){D[v]=w;pr[v]=u;}}}
  if(pr[n-1]<0)return [b];const out=[];for(let v=n-1;v>0;v=pr[v])out.unshift(N[v]);return out;}
// (re)lit GAME.boardAreas : polygone, sommets intérieurs (plus court chemin), entrée depuis la file (SITE.board.via) ; places et réserve remises à zéro (posées ensuite par le type)
function lireZoneAttente(){embarquement();
  const A=Array.isArray(GM.boardAreas)&&GM.boardAreas[0];BAREA=A&&Array.isArray(A.pts)&&A.pts.length>=3?A.pts.map(p=>[+p[0],+p[1]]):null;BSLOTS=null;BVIA=null;BNODES=[];BRES=[];
  if(!BAREA)return;
  const P=BAREA,n=P.length;let ar=0;for(let i=0,j=n-1;i<n;j=i++)ar+=P[j][0]*P[i][1]-P[i][0]*P[j][1];const sg=ar>0?1:-1; // orientation : normale intérieure des bords
  for(let i=0;i<n;i++){const a=P[(i+n-1)%n],b=P[i],c=P[(i+1)%n],n1=[-(b[1]-a[1]),b[0]-a[0]],n2=[-(c[1]-b[1]),c[0]-b[0]],l1=Math.hypot(...n1)||1,l2=Math.hypot(...n2)||1;
    let m=[(n1[0]/l1+n2[0]/l2)*sg,(n1[1]/l1+n2[1]/l2)*sg];const ml=Math.hypot(m[0],m[1]);if(ml<.1)continue;m=[m[0]/ml,m[1]/ml];
    for(const k of [1.5,3]){const q=[b[0]+m[0]*BA_IN*k,b[1]+m[1]*BA_IN*k];if(inA(q[0],q[1],BA_IN*.9)&&EMB.ligneOk(q[0],q[1])){BNODES.push(q);break;}}}
  const V=(SITE.board.via||[]).map(q=>[q[0],q[1]]),k=V.findIndex(q=>pipA(P,q[0],q[1]));
  BVIA=k>=0?{pre:V.slice(0,k).map(q=>[q[0],0,q[1]]),e:intoA(V[k][0],V[k][1])}:{pre:V.map(q=>[q[0],0,q[1]]),e:V.length?intoA(V[V.length-1][0],V[V.length-1][1]):null};}
// Ordre sur le quai (propriétaire, issue #44 : un arrivant ne passe ni au travers ni par-dessus ceux qui attendent) : repère du quai (BAYS[0] : lon le long de la voie,
// lat en s'éloignant de la voie) ; une COLONNE = les places de même lon (à 0,3 m près). Dans la zone éditée, l'arrivant longe l'ALLÉE derrière toutes les places
// occupées ou promises (0,6 m au-delà de la plus éloignée de la voie, ESTIMÉ), puis avance tout droit dans la colonne de sa place, dont les places de derrière sont
// libres (resFree, engine/sim.js) ; allée hors de la zone : trajet direct d'avant (boardInP).
const PB=()=>EMB.repere,lonP=p=>{const b=PB();return (p[0]-b.x)*b.tx+(p[2]-b.z)*b.tz;},latP=p=>{const b=PB();return (p[0]-b.x)*b.rx+(p[2]-b.z)*b.rz;},
  atP=(lo,la)=>{const b=PB();return [b.x+b.tx*lo+b.rx*la,0,b.z+b.tz*lo+b.rz*la];},sameCol=(p,q)=>Math.abs(lonP(p)-lonP(q))<.3;
const PGRID=.3,PCLR=.4; // pas de la grille de recherche du trajet (ESTIMÉ) ; écart gardé aux places occupées (QD)
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
// place p sur le reste du trajet d'un visiteur qui gagne déjà sa place (à moins de PCLR + 0,05 m), où il passera après t s (arrivée du nouvel occupant, moins
// 0,3 s) : on ne la donne pas encore (il passerait au travers de celui qui s'y tient) ; plen3 = longueur d'un trajet
const plen3=P=>{let d=0;for(let i=1;i<P.length;i++)d+=Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]);return d;};
function platCross(p,t){t=t||0;for(const k of G.walkers){if(k.kind!=='wait'||k.i>=k.pts.length)continue;const T=k.pts[k.pts.length-1];if(Math.hypot(T[0]-p[0],T[2]-p[2])<.05)continue;let a=[k.x,0,k.z],d=0;
    for(let i=k.i;i<k.pts.length;i++){const b=k.pts[i],dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz),u=L?clamp(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(L*L),0,1):0;
      if(Math.hypot(a[0]+dx*u-p[0],a[2]+dz*u-p[2])<PCLR+.05&&(d+L*u)/(k.sp||3)>t-.3)return true;d+=L;a=b;}}
  return false;}
/* Fin de la file à raccorder à la zone d'attente (issue #24, éditeur) : dernière portion du trajet des visiteurs vers le quai (8 m de la fin du dernier tronçon de file,
   puis SITE.board.via), point d'extrémité `end` (dernier point de board.via, sinon fin de la file : c'est là que les visiteurs quittent le chemin pour la zone), et bords
   de l'allée au bout de la file (`edges`, largeur dessinée qwAt, engine/render.js). Coordonnées arrondies au cm : un sommet aimanté y est posé exactement. */
function boardViaEnd(){const Q=SEG_OUT.P,R=v=>+v.toFixed(2),qe=Q[Q.length-1],tail=[[qe[0],qe[1]]];let d=0;
  for(let i=Q.length-2;i>=0&&d<8;i--){d+=Math.hypot(Q[i+1][0]-Q[i][0],Q[i+1][1]-Q[i][1]);tail.unshift([Q[i][0],Q[i][1]]);}
  const V=(SITE.board.via||[]).map(q=>[q[0],q[1]]),pts=tail.concat(V),end=pts[pts.length-1],a=Q[Q.length-2]||qe,l=Math.hypot(qe[0]-a[0],qe[1]-a[1])||1,n=[-(qe[1]-a[1])/l,(qe[0]-a[0])/l];
  let w=1;try{w=qwAt(qe[0],qe[1]);}catch(e){}const hw=w/2;
  return {pts:pts.map(q=>[R(q[0]),R(q[1])]).filter((q,i,A)=>!i||q[0]!==A[i-1][0]||q[1]!==A[i-1][1]),end:[R(end[0]),R(end[1])],queueEnd:[R(qe[0]),R(qe[1])],w:R(w),edges:[[R(qe[0]+n[0]*hw),R(qe[1]+n[1]*hw)],[R(qe[0]-n[0]*hw),R(qe[1]-n[1]*hw)]]};}
