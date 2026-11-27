'use strict';
/* ══════════ QUAI : travées, portillons, places d'attente, opérateurs ══════════ */
// Quai : une travée et un portillon par wagon
/* Côté du quai d'embarquement (loadSide, osmrides#53) : +1 ou -1 selon que la droite de la voie (R) pointe vers le côté où arrive la file (SITE.board.via : dernier point du trajet des visiteurs
   avant le quai) ; le débarquement se fait de l'autre côté. Priorité GAME.site > SITE.loadSide > déduction (|écart| de moins de 0,5 m : indécis, +1). */
const LS_D=(()=>{const V=SITE.board&&SITE.board.via;if(!V||!V.length)return null;const f=frameAt(S_ST-CAR/2,mkF()),q=V[V.length-1],d=f.R.x*(q[0]-f.p.x)+f.R.z*(q[1]-f.p.z);return Math.abs(d)<.5?null:d>0?1:-1;})();
const LS=SITE.loadSide||LS_D||1;
const DEDUIT={dropAfter:D_DROP,loadSide:LS_D}; // éditeur : déduit (null = non déductible)
const BAYS=[];for(let k=0;k<NCARS;k++){const f=frameAt(S_ST-(k+.5)*CAR,mkF());BAYS.push({x:f.p.x,z:f.p.z,rx:f.R.x*LS,rz:f.R.z*LS,tx:f.T.x,tz:f.T.z});} // (rx,rz) pointe vers le quai d'embarquement
/* Quai lu dans OSM (zone railway=platform, QUAI_OSM de train.js ; docs/ref/quai.md) : il remplace les étendues de SITE.plat (repli sans zone OSM) :
   load / exit = distance de l'axe de la voie au bord de la zone, côté embarquement / débarquement (la plus petite le long du train, aux deux bouts et au milieu de chaque wagon) ;
   back / front = de l'arrière / de l'avant du train arrêté (S_ST) au bout de la zone, le long de la voie. Les autres clés (gatesPer, slot, edge…) restent celles de SITE.plat. */
if(QUAI_OSM){const Q=QUAI_OSM,ray=(x,z,dx,dz)=>{let t=1e9;for(let i=0,j=Q.length-1;i<Q.length;j=i++){const ax=Q[j][0],az=Q[j][1],ex=Q[i][0]-ax,ez=Q[i][1]-az,d=dx*ez-dz*ex;if(Math.abs(d)<1e-9)continue;
    const u=((ax-x)*ez-(az-z)*ex)/d,v=((ax-x)*dz-(az-z)*dx)/d;if(u>1e-6&&v>=0&&v<=1)t=Math.min(t,u);}return t;};
  let ld=1e9,ex=1e9;for(const b of BAYS)for(const c of [-CAR/2,0,CAR/2]){const x=b.x+b.tx*c,z=b.z+b.tz*c;ld=Math.min(ld,ray(x,z,b.rx,b.rz));ex=Math.min(ex,ray(x,z,-b.rx,-b.rz));}
  const f=mkF(),inQ=q=>{frameAt(q,f);return pinP(Q,f.p.x,f.p.z);};let a=S_ST-TLEN,e=S_ST;while(a>S_ST-TLEN-40&&inQ(a-.05))a-=.05;while(e<S_ST+40&&inQ(e+.05))e+=.05;
  const r=v=>+Math.max(0,v).toFixed(2);if(ld<1e9&&ex<1e9)SITE.plat=Object.assign({},SITE.plat,{load:r(ld),exit:r(ex),back:r(S_ST-TLEN-a),front:r(e-S_ST)});}
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
// Toit de gare : strictement le bâtiment OSM (SITE.stationPoly, décision du propriétaire 27/11, osmrides#68) ; il n'est plus agrandi aux quais. Un quai qui dépasse du bâtiment
// reste sans toit ; sol des quais, contrôle offpath et zone praticable suivent l'emprise des quais (PEDGE, plat.load / plat.exit / back / front), pas le bâtiment.
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
   calcul GDEPTH_CALC). Sans valeur, rien ne change. Bornes ESTIMÉES : un rang au moins (SLOT0 + 0,4 m), DEPTH_MAX = 6 m au plus et selon le quai (plat.load - 0,5 m - PGATE : Goudurix, quai de 3,9 m, 1,7 m). Le moteur en déduit :
   - GROWS = nombre de rangs des travées (premier rang à SLOT0, pas SLOT_P, 0,4 m derrière le dernier) et GDEPTH (séparateurs, engine/render.js drawGates) ;
   - les places des portillons ne changent pas (deux par portillon, premier rang collé) ; travée plus courte que ces places : les rangs en trop attendent juste derrière ;
   - travée plus longue : les rangs supplémentaires (jusqu'à GROWS) deviennent des places de réserve de leur portillon (BRES, `t:1`, `u` = portillon), remplies quand
     les places du portillon sont prises, avec ou sans zone d'attente éditée ; le visiteur avance à la place du portillon libérée ;
   - BWALK (couloir d'attente) juste derrière la travée (GDEPTH + 0,6 m), plus loin que SITE.board.walk si besoin mais pas au-delà du quai (plat.load - 0,3 m) ;
   - QGATE_CLR (engine/render.js, au chargement) = GDEPTH + 0,2 m ; réserve de la zone d'attente éditée : premier rang derrière le dernier rang des travées. */
const DEPTH_MIN=+(SLOT0+.4).toFixed(2),DEPTH_MAX=Math.max(DEPTH_MIN,Math.min(6,+((PLT0.load!=null?PLT0.load:7.9)-.5-PGATE).toFixed(2))); // borne haute : 6 m, et pas au-delà de ce qui laisse le couloir d'attente derrière les séparateurs, avec 0,2 m de jeu (comme QGATE_CLR), dans le quai (plat.load - 0,3 m) : quai court = travées moins profondes (osmrides#53)
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
const latA=(x,z)=>{let bk=BAYS[0],bd=1e9;for(const b of BAYS){const d=Math.hypot(x-b.x,z-b.z);if(d<bd){bd=d;bk=b;}}return (x-bk.x)*bk.rx+(z-bk.z)*bk.rz;}; // distance latérale à la voie (côté embarquement > 0)
function boardAreaCalc(){ // polygone de départ de l'éditeur : travées et couloir d'attente, de l'avant du premier portillon à l'arrière du dernier
  const l0=PGATE+.05,l1=Math.max(BWALK,PGATE+GDEPTH)+.4,F=[],B=[];
  for(let k=0;k<=NCARS;k++){const b=BAYS[Math.min(k,NCARS-1)],e=k<NCARS?CAR/2:-CAR/2;F.push([b.x+b.tx*e+b.rx*l0,b.z+b.tz*e+b.rz*l0]);B.push([b.x+b.tx*e+b.rx*l1,b.z+b.tz*e+b.rz*l1]);}
  const P=F.concat(B.reverse()),out=[]; // sommets alignés (gare droite) retirés : polygone simple à éditer
  for(let i=0;i<P.length;i++){const a=P[(i+P.length-1)%P.length],b=P[i],c=P[(i+1)%P.length],cr=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(cr)/(Math.hypot(c[0]-a[0],c[1]-a[1])||1)>.05)out.push(b);}
  return out.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]);}
const boardArea=()=>BAREA||boardAreaCalc();
function resRows(keep){ // rangs supplémentaires des travées réglées (issue #27) : places de réserve de chaque portillon, du rang des places du portillon jusqu'à GROWS
  const out=[];if(BDEPTH==null)return out;
  for(let u=0;u<NGATES;u++){const c=GCOLS(u),n0=Math.ceil((GPR>1?S_COLS:CSEATS)/c);for(let row=n0;row<GROWS;row++)for(let col=0;col<c;col++){const p=slotAt(u,row,col);
    if(keep(p)){p.u=u;p.t=1;out.push(p);}}}return out;}
function reBoard(){ // (re)lit GAME.boardAreas et GAME.board : polygone, places, entrée depuis la file, profondeur des travées (appelé au chargement et par l'éditeur)
  reDepth();
  lireZoneAttente(); // noyau (engine/noyau/attente.js) : polygone, sommets intérieurs, entrée depuis la file (BAREA, BNODES, BVIA)
  if(!BAREA){ // travées calculées : réserve = rangs supplémentaires des travées (sur le quai : en deçà du couloir d'attente)
    const V=(SITE.board.via||[]).slice(-1)[0]||[0,0],b0=BAYS[0],lo=(x,z)=>(x-b0.x)*b0.tx+(z-b0.z)*b0.tz,lv=latA(V[0],V[1]);
    BRES=resRows(p=>latA(p[0],p[2])<=BWALK-.4&&!(Math.abs(lo(p[0],p[2])-lo(V[0],V[1]))<.6&&latA(p[0],p[2])>lv-.6)); // issue #44 : place libre en face du bout de via (passage vers le couloir d'attente)
    BRES.sort((p,q)=>(latA(p[0],p[2])-latA(q[0],q[2]))||(Math.hypot(p[0]-V[0],p[2]-V[1])-Math.hypot(q[0]-V[0],q[2]-V[1])));return;}
  BSLOTS=new Array(SEATS);
  for(let u=0;u<NGATES;u++){const ids=[];for(let i=0;i<SEATS;i++)if(seatUnit(i).u===u)ids.push(i);ids.sort((p,q)=>seatUnit(p).j-seatUnit(q).j);
    const c=GCOLS(u),got=[];for(let row=0;row<60&&got.length<ids.length;row++)for(let col=0;col<c&&got.length<ids.length;col++){const p=slotAt(u,row,col);if(inA(p[0],p[2],BA_IN))got.push(p);}
    ids.forEach((i,j)=>{if(got[j])BSLOTS[i]=got[j];else{const s=seatUnit(i),q=slotAt(u,Math.floor(s.j/c),s.j%c),r=intoA(q[0],q[2]),p=[r[0],0,r[1]];BSLOTS[i]=Object.assign(p,{fb:q});}});}
  // places repliées (polygone trop court) : jamais l'une sur l'autre ni sur une place de portillon ; sinon point libre de la zone (grille de 0,2 m) le plus proche de la place calculée
  {const fr=(g,p)=>BSLOTS.every(o=>o===p||Math.hypot(o[0]-g[0],o[2]-g[2])>=SLOT_P-.05);let G2=null;
   for(const p of BSLOTS){if(!p.fb||fr(p,p))continue;if(!G2){G2=[];let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of BAREA){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}
       for(let x=x0;x<=x1;x+=.2)for(let z=z0;z<=z1;z+=.2)if(inA(x,z,BA_IN)&&EMB.ligneOk(x,z))G2.push([x,0,z]);}
     let best=null,bd=1e9;for(const g of G2){const d=Math.hypot(g[0]-p.fb[0],g[2]-p.fb[2]);if(d<bd&&fr(g,p)){bd=d;best=g;}}
     if(best){p[0]=best[0];p[2]=best[2];}}
   for(const p of BSLOTS)delete p.fb;}
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
function platOcc(p){const Q=[];G.plat.forEach((r,i)=>{if(r){const q=slotPos(i);if(Math.hypot(q[0]-p[0],q[2]-p[2])>.05)Q.push(q);}});
  (G.platR||[]).forEach((r,j)=>{const q=BRES[j];if(r&&q&&Math.hypot(q[0]-p[0],q[2]-p[2])>.05)Q.push(q);});return Q;}
function boardInA(p){if(!BAREA)return boardInP(p);const e=BVIA.e,E=[e[0],0,e[1]],r=platPath(E,p,platOcc(p));return r?BVIA.pre.concat([E],r):boardInP(p);}
const platTo=(a,p)=>{if(!BAREA)return null;const r=platPath(a,p,platOcc(p));return r?[a].concat(r):null;}; // d'une place à une autre sans frôler personne (réserve → portillon, avance d'une place)
const platReach=p=>{if(!BAREA)return true;const E=[BVIA.e[0],0,BVIA.e[1]];return !!platPath(E,p,platOcc(p))||!platPath(E,p,[]);}; // place atteignable sans frôler personne (grille sans issue même à vide, zone de forme étroite : trajet direct d'avant)
const resStep=(k,j)=>{const a=BRES[k],p=BRES[j];if(!BAREA)return [a,p];return [a].concat(routeA([a[0],a[2]],[p[0],p[2]]).slice(0,-1).map(q=>[q[0],0,q[1]]),[p]);}; // d'une place de réserve à une autre, plus avant (issue #44)
const resTo=(j,i)=>{const a=BRES[j],p=slotPos(i);if(!BAREA)return [a,p];return [a].concat(routeA([a[0],a[2]],[p[0],p[2]]).slice(0,-1).map(q=>[q[0],0,q[1]]),[p]);}; // de la réserve j à la place i
extension({nom:'montagnes-russes',embarquement:{repere:BAYS[0],ligneOk:(x,z)=>latA(x,z)>=PGATE+.2}}); // quai de la zone d'attente (noyau) : axe de la gare, derrière les portillons
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

// Escalier « en applique » (propriétaire, Goudurix, 2026-11-16, lot 4) : un escalier OSM dont l'axe tombe dans l'emprise du bâtiment de gare (OSM),
// qui la longe (parallèle à la voie de gare) et dont le sommet est à moins de 4 m d'une porte OSM (entrance=*) est dessiné À L'EXTÉRIEUR, collé au mur : décalé perpendiculairement à la voie, côté extérieur, jusqu'à ce que son bord
// intérieur (largeur APPW) touche le mur. Les points de la file, de la sortie et des allées posés sur lui sont décalés d'autant (visiteurs sur l'escalier). o.app={nx,nz,top}
// sert au palier rectangulaire dessiné à son sommet (engine/render.js). 
// SITE.stairsOut:false : aucun escalier en applique (OzIris, issue #13 : escaliers de la file dessinés par le propriétaire dans la gare, jusqu'à la porte d'entrée).
function stairsOutside(){const SPo=SITE.stationPoly;if(SITE.stairsOut===false||!SPo||SPo.length<3||!BAYS.length)return;const pin=(x,z)=>{let c=false;for(let i=0,j=SPo.length-1;i<SPo.length;j=i++)if((SPo[i][1]>z)!==(SPo[j][1]>z)&&x<(SPo[j][0]-SPo[i][0])*(z-SPo[i][1])/(SPo[j][1]-SPo[i][1])+SPo[i][0])c=!c;return c;};
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
}
// Escaliers arrêtés au bord du quai (propriétaire, Trace du Hourra, 2026-11-16, lot 5, générique) : la partie d'un escalier OSM posée sur un quai (embarquement ou
// débarquement, PLT) d'un escalier OSM qui mène à une porte (accès au quai) est retirée — l'escalier s'arrête au bord du quai, sans empiéter sur la zone d'embarquement ; un escalier entièrement sur le quai devient du plancher.
function stairsOffPlatform(){if(!BAYS.length)return;const b0=BAYS[0];
  const onQuai=(x,z)=>{const u=(x-b0.x)*b0.tx+(z-b0.z)*b0.tz;if(u>PLT.front||u<-(NCARS-.5)*CAR-PLT.back)return false;const b=BAYS[clamp(Math.round(-u/CAR),0,NCARS-1)],l=(x-b.x)*b.rx+(z-b.z)*b.rz;return (l>PEDGE&&l<PLT.load)||(PLT.exit&&l<-PEDGE&&l>-PLT.exit);};
  for(let i=STAIRS.length-1;i>=0;i--){const o=STAIRS[i];if(o.gen||o.app)continue;const P=o.p,smp=[];
    if(!(OSM.doors||[]).some(d=>[P[0],P[P.length-1]].some(q=>Math.hypot(d[0]-q[0],d[1]-q[1])<.6)))continue; // escalier qui mène à une porte de la gare (accès au quai)
    for(let j=1;j<P.length;j++){const a=P[j-1],c=P[j],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.1));for(let k=j>1?1:0;k<=n;k++){const q=[a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n];q.on=onQuai(q[0],q[1]);q.v=k===n||k===0;smp.push(q);}}
    if(!smp.some(q=>q.on))continue;
    let best=null,run=[];const fl=()=>{if(run.length>1&&(!best||run.length>best.length))best=run;run=[];};for(const q of smp){if(q.on)fl();else run.push(q);}fl();
    if(!best||best.length<6){STAIRS.splice(i,1);continue;}
    const R=[best[0]].concat(best.slice(1,-1).filter(q=>q.v),[best[best.length-1]]).map(q=>[q[0],q[1]]);
    o.p=R;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of R){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}Object.assign(o,{x0:x0-1.5,x1:x1+1.5,z0:z0-1.5,z1:z1+1.5});}
}
// Évacuation de la file (propriétaire, issue #21, générique) : les visiteurs qui attendent derrière les portillons (G.plat, travées) ou qui s'y rendent (marcheurs 'wait',
// couloir d'attente SITE.board.walk) partent aussi : de la travée au couloir d'attente, SITE.board.via à rebours, puis toute la file à rebours jusqu'à l'entrée, comme
// les autres visiteurs évacués (le quai de débarquement est de l'autre côté de la voie : on ne la traverse pas). Les visiteurs assis ou qui embarquent restent.
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
