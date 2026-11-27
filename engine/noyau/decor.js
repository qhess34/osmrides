'use strict';
/* ══════════ DÉCOR (OSM), PERSONNES, FILE, SALLE DE CONTRÔLE, IMAGE ══════════ */
// Décor réel : bâtiments, allées, plans d'eau, bois
const mkPath=(pts,close)=>{const p=new Path2D;pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath();return p;};
// Allée dessinée (3,2 m) coupée là où elle se confond avec un escalier (STAIRS, engine/queue.js) : l'escalier est dessiné seul, à sa largeur, sans être recouvert par le chemin.
// Palier au haut d'un escalier (LANDC, engine/queue.js, lot 6) : l'allée est coupée sous lui ; un bout d'allée de moins de 2 m qui y aboutit (porte → palier) n'est pas dessiné.
landCut();const inLand=(q,m)=>LANDC.some(L=>Math.abs((q[0]-L.x)*L.ux+(q[1]-L.z)*L.uz)<L.h+m&&Math.abs((q[0]-L.x)*L.nx+(q[1]-L.z)*L.nz)<L.h+m);
const cutStairs=P=>{if(!STAIRS.length)return [P];const out=[];let run=[];
  const len=r=>{let n=0;for(let i=1;i<r.length;i++)n+=Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]);return n;},keep=r=>r.length>1&&!(len(r)<2&&(inLand(r[0],.2)||inLand(r[r.length-1],.2)));
  const near=q=>STAIRS.some(o=>q[0]>o.x0&&q[0]<o.x1&&q[1]>o.z0&&q[1]<o.z1&&dPl(q[0],q[1],o.p)<.15)||inLand(q,0),push=q=>{if(near(q)){if(keep(run))out.push(run);run=[];}else run.push(q);};
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],hit=STAIRS.some(o=>Math.max(a[0],b[0])>o.x0&&Math.min(a[0],b[0])<o.x1&&Math.max(a[1],b[1])>o.z0&&Math.min(a[1],b[1])<o.z1);
    if(!hit){push(a);continue;}const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1));for(let k=0;k<n;k++)push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  push(P[P.length-1]);if(keep(run))out.push(run);return out;};
const cen=pts=>{let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return [x/pts.length,z/pts.length];};
// Voies des attractions voisines (OSM.others) : un tronçon qui suit une voie de garage du site (au moins la moitié de ses points à moins de 1,5 m, ESTIMÉ) EST cette voie
// (Zeus : voie de maintenance OSM 938337765 / 938337766) : il n'est pas redessiné en gris par-dessus le garage et ses trains (issue #43, propriétaire 20/11).
const onYard=P=>vrai('surVoieDeGarage',P.p||P); // couche du type
const LY={water:[],canal:[],lawn:[],forest:[],dirt:[],asph:[],foot:[],footA:[],road:[],hedge:[],bld:[],pier:[],exc:[]},trees=[],FOOT=[],PLACES=[],otherP=(OSM.others||[]).filter(p=>!onYard(p)).map(p=>mkPath(p));
let tunnelP=null,tunnelC=[5,98];const WATERPTS=[],COV=[],COVLV=[],COVP=new Path2D; // COV/COVP : chemins couverts OSM (passages sous la gare…), redessinés quand le toit s'efface
(function scenery(){
  const ROOFS=['#a9553f','#b0694a','#9d6350','#8a8f96','#b9ab93','#7f8a8f','#a35f47'],seen=new Set();
  const SPOLY=SITE.stationPoly||[],inSt=(x,z)=>{let c=false;for(let i=0,j=SPOLY.length-1;i<SPOLY.length;j=i++)if((SPOLY[i][1]>z)!==(SPOLY[j][1]>z)&&x<(SPOLY[j][0]-SPOLY[i][0])*(z-SPOLY[i][1])/(SPOLY[j][1]-SPOLY[i][1])+SPOLY[i][0])c=!c;return c;};
  const stroll0=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));if(C[C.length-1]>45)FOOT.push({P:pts,C,len:C[C.length-1]});};
  // Chemins de la file RÉSERVÉS (propriétaire, OzIris, 2026-11-16, lot 5) : boucles, raccourcis, couloirs, escaliers et passerelles de la file ne servent qu'aux visiteurs de
  // la file, à ceux qui en sortent et au personnel ; les promeneurs n'y vont jamais : toute allée OSM qui se confond avec la file (à moins de 1,6 m de son axe) est coupée là.
  const QAX=SEGS.map(g=>g.P).concat([(QS.link||[]).concat([ENTRY0])]).filter(P=>P.length>1).map(P=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of P){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}return {P,x0:x0-2,x1:x1+2,z0:z0-2,z1:z1+2};});
  const onQ=(x,z)=>QAX.some(o=>x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&dPl(x,z,o.P)<1.6);
  const stroll=pts=>{let run=[];const flush=()=>{if(run.length>1)stroll0(run);run=[];};for(let a=0;a+1<pts.length;a++){const A=pts[a],B=pts[a+1],n=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/.5));for(let k=0;k<=n;k++){if(a&&!k)continue;const q=[A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n];if(inSt(q[0],q[1])||onQ(q[0],q[1]))flush();else run.push(q);}}flush();}; // les promeneurs ne traversent jamais la gare (voie, quais) ni la file
  // chemins couverts OSM (f.cv : tunnel, covered, indoor, layer<0, tools/make_site.py) : le bâtiment qui les recouvre s'efface au zoom, comme la gare
  COV.push(...OSM.feats.filter(f=>f.cv).map(f=>f.p));COVLV.push(...OSM.feats.filter(f=>f.cv).map(f=>f.lv||0)); // COVLV : niveau OSM (f.lv < 0 : souterrain)
 for(const P of COV)COVP.addPath(mkPath(P));const pin=(P,x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const addBld=(pts,o)=>{const m=cen(pts),lit=new Path2D,dark=new Path2D;let ar=0;
    for(let j=0;j<pts.length-1;j++)ar+=pts[j][0]*pts[j+1][1]-pts[j+1][0]*pts[j][1];
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],sg=ar>0?1:-1,nx=(b[1]-a[1])*sg,nz=-(b[0]-a[0])*sg,pp=nx*-.8+nz*-.6>0?lit:dark;pp.moveTo(a[0],a[1]);pp.lineTo(b[0],b[1]);}
    const near=q=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2];
    const b=Object.assign({p:mkPath(pts,true),m,lit,dark,st:near(SITE.stationAt),h:7,canopy:false,fade:(SITE.fade||[]).some(near),cvb:COV.some(P=>P.some(q=>pin(pts,q[0],q[1]))),yd:!near(SITE.stationAt)&&vrai('couvreVoie',pts)},o); // yd : remise au-dessus d'une voie de garage (toit effaçable comme la gare, bldA) // cvb : couvre un chemin couvert, effacé seulement par « Masquer la gare »
    if(!b.cvb&&(b.canopy||SHP.some(q=>pin(pts,q[0],q[1]))))b.fade=b.ab=true; // abri (issue #15) : auvent OSM building=roof, ou bâtiment au-dessus de la file ou du quai : s'efface comme les toits SITE.fade
    LY.bld.push(b);};
  // points de la file (tronçons, liaison) et des quais, tous les 1 m : un bâtiment qui en recouvre un est un abri
  const SHP=[];{const add=P=>{for(let i=1;i<P.length;i++){const a=P[i-1],c=P[i],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])));for(let k=0;k<=n;k++)SHP.push([a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n]);}};
    for(const g of SEGS)add(g.P);add((QS.link||[]).concat([ENTRY0]));
    for(const q of [].concat(...appel('pointsAbri')))SHP.push(q);} // quais (couche du type)
  OSM.feats.forEach((f,i)=>{
    const k=f.k,c=f.c&&f.p.length>3,p=mkPath(f.p,c);if(c&&f.h)for(const h of f.h)p.addPath(mkPath(h,true)); // anneaux intérieurs (lac dans une place…) : orientation opposée, trou
    if(f.n&&!seen.has(f.n)&&!(SITE.hideNames||[]).includes(f.n)&&!k.startsWith('highway')){seen.add(f.n);const m=cen(f.p);PLACES.push([f.n.replace(/ \(\d+\)/,''),m[0],m[1]]);}
    if(k==='natural=water'||k==='landuse=reservoir'){if(c){LY.water.push(p);WATERPTS.push(f.p);}}
    else if(k.startsWith('waterway'))(c?LY.water:LY.canal).push(p);
    else if(k==='landuse=grass'||k==='landuse=meadow'){if(c)LY.lawn.push(p);}
    else if(k==='landuse=forest'||k==='natural=wood'||k==='natural=scrub'){if(c)LY.forest.push({p,pts:f.p});}
    else if(k==='landuse=construction'||k==='natural=bare_rock'){if(c)LY.dirt.push(p);}
    else if(k==='amenity=parking'){if(c)LY.asph.push(p);}
    else if(k==='man_made=pier')LY.pier.push(p);
    else if(k==='man_made=excavation'){if(c)LY.exc.push({p,lv:lvOf(f),m:tagOf(f,'material')});} // tranchée (issue #68) : drawExc
    else if(k==='highway=footway'||k==='highway=pedestrian'||k==='highway=steps'){
      if(k==='highway=pedestrian'&&c)LY.footA.push(p);else if(!f.in&&k!=='highway=steps'&&!f.br)LY.foot.push(...(c?[p]:cutStairs(f.p).map(q=>mkPath(q)))); // escaliers (drawSteps) et passerelles (drawBridge) dessinés à part // f.in : chemin fondu dans une zone piétonne (non dessiné, les promeneurs le suivent encore)
      if(k==='highway=footway'&&!c&&!(SITE.noStroll||[]).some(q=>Math.hypot(f.p[0][0]-q[0],f.p[0][1]-q[1])<1.5))stroll(f.p);}
    else if(k==='highway=service'||k==='highway=unclassified'||k==='highway=track')LY.road.push(p);
    else if(k==='barrier=hedge'||k==='natural=tree_row')LY.hedge.push(p);
    else if(k==='man_made=tunnel'){if(!tunnelP){tunnelP=1;tunnelC=cen(f.p);}} // polygone man_made=tunnel : seulement l'étiquette (le premier) ; couverture le long de la voie (TPOLY, drawTunnel, issue #42)
    else if(k.startsWith('building'))addBld(f.p,{ // rf, rc : forme et couleur du toit lues dans OSM (f.t, issue #68) ; mh : min_height (sans effet en vue aérienne)
      col:ROOFS[i%ROOFS.length],h:BLD_H(k,f),canopy:k==='building=roof',un:vrai('sousVoie',f.p),rf:roofGeom(f.p,f),rc:colOf(tagOf(f,'roof:colour')),mh:numOf(f,'min_height')});
  });
  for(const p of SITE.paths||[]){LY.foot.push(...cutStairs(p).map(q=>mkPath(q)));stroll(p);}          // allées ajoutées par la configuration
  for(const b of SITE.buildings||[])addBld(b.p,Object.assign({col:'#8a8f96',un:vrai('sousVoie',b.p)},b)); // bâtiments ajoutés par la configuration
  // arbres : dans les bois cartographiés + arbres isolés relevés
  ctx.setTransform(1,0,0,1,0,0);
  const col=()=>({c:`rgb(${rnd(34,56)|0},${rnd(80,110)|0},${rnd(36,56)|0})`,c2:`rgba(${rnd(88,124)|0},${rnd(142,170)|0},${rnd(64,92)|0},.8)`,l:[0,1,2,3,4].map(i=>i?[rnd(-.5,.5),rnd(-.5,.5),rnd(.48,.72)]:[0,0,.8])});
  const nearTrack=(x,z,r)=>vrai('presDeLaVoie',x,z,r); // voie et garage (couche du type)
  // pas d'arbre de bois sur les chemins, la file, les escaliers ni dans un rocher (grille de 1 m le long des chemins)
  const PC=new Set,mark=P=>{for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5);for(let k=0;k<=n;k++)PC.add(Math.round(a[0]+(b[0]-a[0])*k/n)+','+Math.round(a[1]+(b[1]-a[1])*k/n));}};
  for(const f of OSM.feats)if(f.k.startsWith('highway=')&&!f.c)mark(f.p);for(const k in OSM.paths)mark(OSM.paths[k]);for(const g of SEGS)mark(g.P);for(const o of STAIRS)mark(o.p);
  const onPath=(x,z,r)=>{const R=Math.ceil(r);for(let i=-R;i<=R;i++)for(let j=-R;j<=R;j++)if(i*i+j*j<=r*r&&PC.has(Math.round(x+i)+','+Math.round(z+j)))return true;return false;};
  for(const f of LY.forest){
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of f.pts){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}
    x0=Math.max(x0,VIEW.bounds[0]-30);x1=Math.min(x1,VIEW.bounds[1]+30);z0=Math.max(z0,VIEW.bounds[2]-30);z1=Math.min(z1,VIEW.bounds[3]+30);
    const n=Math.min(900,(x1-x0)*(z1-z0)/30);
    for(let i=0;i<n;i++){const x=rnd(x0,x1),z=rnd(z0,z1),r=rnd(2.4,4.8);
      if(!ctx.isPointInPath(f.p,x,z)||nearTrack(x,z,r+4.5)||LY.bld.some(b=>ctx.isPointInPath(b.p,x,z))||onPath(x,z,r*.7+.8)||ROCKP.some(P=>pipXZ(P,x,z))||WATERPTS.some(P=>pipXZ(P,x,z)))continue;
      trees.push(Object.assign({x,z,r},col()));}
  }
  for(const q of OSM.trees)if(!nearTrack(q[0],q[1],6))trees.push(Object.assign({x:q[0],z:q[1],r:rnd(3,4.5)},col()));
  trees.sort((a,b)=>a.r-b.r);
})();
const stationP=mkPath(SITE.stationPoly,true),queueAllP=new Path2D;
// extérieur des zones piétonnes (grand rectangle + zones, règle evenodd : les trous des zones comptent comme extérieur) : masque des bordures d'allées
const PEDOUT=LY.footA.length?(()=>{const p=new Path2D;p.rect(VIEW.bounds[0]-500,VIEW.bounds[2]-500,VIEW.bounds[1]-VIEW.bounds[0]+1000,VIEW.bounds[3]-VIEW.bounds[2]+1000);for(const a of LY.footA)p.addPath(a);return p;})():null;
for(const sg of SEGS)sg.P.forEach((p,i)=>i?queueAllP.lineTo(p[0],p[1]):queueAllP.moveTo(p[0],p[1]));
(QS.link||[]).concat([ENTRY0]).forEach((p,i)=>i?queueAllP.lineTo(p[0],p[1]):queueAllP.moveTo(p[0],p[1])); // raccord entre l'allée du parc et l'entrée de la file
// Largeur dessinée de la file, adaptée à la densité : là où des allées sont proches et parallèles (lacets serrés), la demi-largeur est ramenée à la moitié de
// l'entraxe avec la voisine, moins 12 cm pour la barrière (largeur = entraxe − 0,25 m, au plus QW_MAX, au moins QW_MIN) : les allées ne se chevauchent pas. Voisines = points d'une autre allée vus en travers (pas devant ni derrière).
// Largeur des escaliers (propriétaire, 2026-11-16, lots 4 et 5, toutes les attractions) : la MÊME largeur que le chemin dessiné qu'ils prolongent — la file qui l'emprunte
// (QWP : width OSM, sinon largeur adaptée), sinon la width OSM de l'escalier, sinon 2 m (EXIT_STW, escaliers de sortie), au plus la passerelle raccordée (BRIDGE_DEF).
// Deux escaliers voisins à peu près parallèles ne se chevauchent pas (largeur ≤ entraxe − 0,25 m, au moins 0,8 m) ; la file est alors ramenée à la largeur de l'escalier.
// S : points de la file (QWP).
const FOOT_W=3.2; // largeur dessinée d'une allée (LY.foot)
// Escalier hors de la file (sortie, allée) sans width OSM : 2 m (propriétaire, 2026-11-16, lot 5), au plus la passerelle raccordée.
const EXIT_STW=2;
// Largeur OSM de la file (propriétaire, 2026-11-16, lot 5) : là où la file suit un chemin OSM qui a une width (OSM.widths, tools/make_site.py), elle est dessinée
// à cette largeur, sans adaptation ; un chemin de la même file sans width prend la plus petite width OSM de la file (ESTIMÉ : même ouvrage) ; l'adaptation à la
// densité ne reste que pour une file sans aucune width OSM (allées qui se chevaucheraient).
const OSMW=(OSM.widths||[]).map(([w,P])=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of P){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}return {w,P,x0:x0-.5,x1:x1+.5,z0:z0-.5,z1:z1+.5};});
const osmWAt=(x,z)=>{let w=0;for(const o of OSMW)if(x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&dPl(x,z,o.P)<.35)w=w?Math.min(w,o.w):o.w;return w;};
function stairWidths(S){
  for(const o of STAIRS){const on=S.filter(q=>q.x>o.x0&&q.x<o.x1&&q.z>o.z0&&q.z<o.z1&&dPl(q.x,q.z,o.p)<.3),qw=on.length?Math.min(...on.map(q=>q.w)):0;
    const E=[o.p[0],o.p[o.p.length-1]],bw=BRIDGE_DEF.filter(b=>E.some(e=>[b.P[0],b.P[b.P.length-1]].some(q=>Math.hypot(q[0]-e[0],q[1]-e[1])<1.5))).map(b=>b.w);
    if(o.ow===undefined)o.ow=o.w||0;o.w=qw||o.ow||Math.min(EXIT_STW,...bw);if(o.app)o.w=Math.min(o.w,APPW);o.qs=on;}
  for(const o of STAIRS)for(let i=1;i<o.p.length;i++){const a=o.p[i-1],b=o.p[i],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,tx=(b[0]-a[0])/l,tz=(b[1]-a[1])/l;
    for(let d=0;d<=l;d+=.3){const x=a[0]+tx*d,z=a[1]+tz*d;
      for(const r of STAIRS){if(r===o||x<r.x0-2||x>r.x1+2||z<r.z0-2||z>r.z1+2)continue;let bd=1e9,bx=0,bz=0;
        for(let j=1;j<r.p.length;j++){const c=r.p[j-1],e=r.p[j],ex=e[0]-c[0],ez=e[1]-c[1],ll=ex*ex+ez*ez||1e-9,t=clamp(((x-c[0])*ex+(z-c[1])*ez)/ll,0,1),px=c[0]+ex*t,pz=c[1]+ez*t,dd=Math.hypot(px-x,pz-z);if(dd<bd){bd=dd;bx=px;bz=pz;}}
        if(bd<.2||bd>(o.w+r.w)/2+.1||Math.abs((bx-x)*tx+(bz-z)*tz)/bd>.5)continue; // voisin en travers (pas dans le prolongement)
        const m=Math.max(.8,bd-.25);o.w=Math.min(o.w,m);r.w=Math.min(r.w,m);}}}
  for(const o of STAIRS)for(const q of o.qs)q.w=Math.min(q.w,o.w);}
// Dégagement de la zone d'embarquement (couche du type : degagement(S), largeurs de la file rétrécies le long du quai)
const FORKP=LOOPS.flatMap(l=>[l.loop.P[0],l.loop.P[l.loop.P.length-1],l.short.P[0],l.short.P[l.short.P.length-1]]);
// Chemins de file d'OSM (OSM.attrs role queue, tracé p) : un sol par chemin (GAME.look.ways, issue #45) ; tronçon dessiné rattaché au chemin le plus proche (QWAYS, qWayAt), '' sinon (prolongement d'entrée).
const QWAYS=(typeof OSM!=='undefined'&&Array.isArray(OSM.attrs)?OSM.attrs:[]).filter(a=>a&&a.role==='queue'&&Array.isArray(a.p)&&a.p.length>1),
  qWayAt=(x,z)=>{let b='',bd=1.5;for(const a of QWAYS){const d=dPl(x,z,a.p);if(d<bd){bd=d;b=a.id;}}return b;};
let QWS=[];const QSIDE=new Path2D,QSIDEP=[],QSIDE0=new Path2D,QSIDEP0=[],QSIDE2=new Path2D,QSIDEP2=[],QRAIL=new Path2D,QRAILP=[],QMIDS=[],QW_MAX=2.2,QW_MIN=.9,QWP=(()=>{const L0=SEGS.map(g=>g.P).concat([(QS.link||[]).concat([ENTRY0])]).filter(P=>P.length>1),S=[];
  L0.forEach((P,pi)=>{for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/.5));for(let k=i>1?1:0;k<=n;k++)S.push({x:a[0]+(b[0]-a[0])*k/n,z:a[1]+(b[1]-a[1])*k/n,tx:(b[0]-a[0])/(l||1),tz:(b[1]-a[1])/(l||1),pi,w:QW_MAX});}});
  const G=new Map,key=(x,z)=>Math.floor(x/3)+','+Math.floor(z/3);for(const q of S){const k=key(q.x,q.z);if(!G.has(k))G.set(k,[]);G.get(k).push(q);}
  S.forEach((q,k)=>q.k=k);
  for(const q of S){let d=1e9,bo=null;const cx=Math.floor(q.x/3),cz=Math.floor(q.z/3);
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(const o of G.get((cx+i)+','+(cz+j))||[]){const dx=o.x-q.x,dz=o.z-q.z,l=Math.hypot(dx,dz);if(l<.3||l>6)continue;
      if(o.pi!==q.pi&&FORKP.some(F=>Math.hypot(q.x-F[0],q.z-F[1])<3.5&&Math.hypot(o.x-F[0],o.z-F[1])<3.5))continue; // branches d'une même fourche près de leur point commun : pas de rétrécissement (raccord propre, Zeus lot 5)
      if(Math.abs(dx*q.tx+dz*q.tz)/l<.5&&Math.abs(o.tx*q.tx+o.tz*q.tz)>.5&&l<d){d=l;bo=o;}} // en travers de l'allée, et allée voisine à peu près parallèle
    q.w=clamp(d-.25,QW_MIN,QW_MAX);if(bo&&d<3&&bo.k>q.k){q.mid=[(q.x+bo.x)/2,(q.z+bo.z)/2];q.bo=bo;}} // allées collées : barrière de séparation à mi-distance (QRAIL)
  for(let r=0;r<2;r++)for(let i=1;i<S.length-1;i++)if(S[i-1].pi===S[i].pi&&S[i+1].pi===S[i].pi)S[i].w=Math.min(S[i].w,(S[i-1].w+S[i].w+S[i+1].w)/3+.05); // lissage
  if(OSMW.length){for(const q of S)q.ow=osmWAt(q.x,q.z);const ws=S.filter(q=>q.ow).map(q=>q.ow);if(ws.length){const m=Math.min(...ws);for(const q of S)q.w=q.ow||m;}} // largeur OSM de la file
  // File le long des quais et dans les zones piétonnes (propriétaire, OzIris, 2026-11-16, lot 5, générique) : largeur OSM, sinon 1 m (ESTIMÉ, couloir réel inconnu), et barrières
  // de délimitation (main courante sur poteaux) des DEUX côtés (QSIDE), là où aucune bordure de chemin ne la sépare du sol environnant.
  {const SG=SITE.stationPoly||[],PEDP=OSM.feats.filter(f=>f.k==='highway=pedestrian'&&f.c&&f.p.length>3).map(f=>f.p);
    for(const q of S){const st=SG.length>2&&pipXZ(SG,q.x,q.z);if(st||PEDP.some(P=>pipXZ(P,q.x,q.z))){q.w=Math.min(q.w,q.ow||1);q.side=st?2:1;}}}
  // Prolongement de l'entrée (raccord QS.link, GAME.queueEntry, mouth / gateAtMouth ; propriétaire, issue #39) : même largeur que le chemin de file qu'il prolonge
  // (width OSM, sinon largeur dessinée de l'allée au premier point hors zone piétonne / gare, appliquée aussi à son début dans la zone) ; garde-corps (QSIDE) gardés.
  {const E0=QS.osmEntry0||ENTRY0,LK=(QS.link||[]).concat([ENTRY0]),P0=QS.parts[0]&&QS.parts[0].pts||[],k=QS.osmEntry0?P0.findIndex(q=>Math.hypot(q[0]-E0[0],q[1]-E0[1])<.05):-1,EX=k>0?P0.slice(0,k+1):LK;
    if(EX.length>1){for(const q of S)q.ext=dPl(q.x,q.z,EX)<.05&&Math.hypot(q.x-E0[0],q.z-E0[1])>.05;let i=-1,bd=1e9;S.forEach((q,k)=>{const d=Math.hypot(q.x-E0[0],q.z-E0[1]);if(!q.ext&&d<bd){bd=d;i=k;}});
      if(i>=0){let j=i;while(j<S.length&&S[j].pi===S[i].pi&&S[j].side&&!S[j].ow)j++;const w=j<S.length&&S[j].pi===S[i].pi?S[j].w:S[i].w; // 1re largeur de l'allée hors zone piétonne / gare (sinon celle de l'entrée)
        for(let k=i;k<j;k++)S[k].w=w;for(const q of S)if(q.ext)q.w=w;}}}
  stairWidths(S);
  appel('degagement',S);
  QWS=S;
  qwAt=(x,z)=>{let bd=1e9,w=2.2;for(const q of S){const d=Math.abs(q.x-x)+Math.abs(q.z-z);if(d<bd){bd=d;w=q.w;}}return w;};reGates(); // barrières sur les bordures dessinées (engine/queue.js)
  // ... sauf sur un passage (propriétaire, OzIris B2, 2026-11-17) : milieu recouvert par une autre allée (raccourci, jonction) ou par un tronçon transversal de la même allée.
  // Plus d'exclusion à 3,5 m des pointes de fourche : deux jambes d'une même boucle collées jusqu'à leur fourche gardent leur clôture jusqu'au passage.
  for(const q of S){if(!q.mid)continue;const m=q.mid,cx=Math.floor(m[0]/3),cz=Math.floor(m[1]/3);let on=false;
    for(let i=-1;i<=1&&!on;i++)for(let j=-1;j<=1&&!on;j++)for(const o of G.get((cx+i)+','+(cz+j))||[]){if(o===q||o===q.bo)continue;
      if((o.pi!==q.pi&&o.pi!==q.bo.pi||Math.abs(o.tx*q.tx+o.tz*q.tz)<.7)&&Math.hypot(o.x-m[0],o.z-m[1])<o.w/2+.05){on=true;break;}}
    if(on)q.mid=null;}
  // ... ni sous le vantail d'une barrière de file (positions A et B, poteau ; lot 5 : rien qui ressemble à une barrière fixe sur une barrière qui pivote)
  {const GS=allGates().filter(g=>g&&g.h&&g.a&&g.b),dSeg=(m,h,e)=>{const dx=e[0]-h[0],dz=e[1]-h[1],l=dx*dx+dz*dz||1e-9,t=clamp(((m[0]-h[0])*dx+(m[1]-h[1])*dz)/l,0,1);return Math.hypot(h[0]+dx*t-m[0],h[1]+dz*t-m[1]);};
    for(const q of S)if(q.mid&&GS.some(g=>Math.hypot(q.mid[0]-g.h[0],q.mid[1]-g.h[1])<.6||dSeg(q.mid,g.h,g.a)<.35||dSeg(q.mid,g.h,g.b)<.35))q.mid=null;}
  for(const q of S)q.cv=COV.some(P=>onPl(q,P,.3)); // tronçon couvert (le long du chemin couvert, pas en travers : onPl) : dessiné seulement avec le couloir (gare masquée) ; garde-corps : buildRails (après les escaliers)
  const by=new Map;for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i];if(a.pi!==b.pi||a.cv&&b.cv)continue;const w=Math.round(Math.min(a.w,b.w)*10)/10,id=qWayAt((a.x+b.x)/2,(a.z+b.z)/2),k=w+'|'+id;if(!by.has(k))by.set(k,[w,new Path2D,id]);const P=by.get(k)[1];P.moveTo(a.x,a.z);P.lineTo(b.x,b.z);}
  return [...by.values()].sort((a,b)=>b[0]-a[0]);})(); // [largeur, tracé, id du chemin OSM]
const JOBSITE=SITE.jobsites;
const HAIR=['#2a1d14','#4a3322','#6b4a2a','#c9a35a','#8a8a8a','#111','#a0522d'];
const emos=[];function emote(){}
let bolt=null;
function strike(){const K=SITE.strike||{},A=K.area||[VIEW.x-VIEW.w/2,VIEW.x+VIEW.w/2,VIEW.z-VIEW.h/2,VIEW.z+VIEW.h/2],hit=K.spot&&Math.random()<.35,x=hit?K.spot[0]:rnd(A[0],A[1]),z=hit?K.spot[1]:rnd(A[2],A[3]),br=[];
  for(let b=0;b<5;b++){let px=x,pz=z,a=rnd(0,6.28);const pts=[[px,pz]];for(let i=0;i<6;i++){a+=rnd(-.7,.7);px+=Math.cos(a)*rnd(3,8);pz+=Math.sin(a)*rnd(3,8);pts.push([px,pz]);}br.push(pts);}
  bolt={x,z,br};}
const strollers=[];
(function(){const tot=FOOT.reduce((a,f)=>a+f.len,0);for(const f of FOOT){const n=Math.round(90*f.len/tot);for(let i=0;i<n;i++)strollers.push({f,d:rnd(0,f.len),v:(Math.random()<.5?-1:1)*rnd(.9,1.6),side:rnd(-1.1,1.1),ci:Math.floor(Math.random()*12),ph:rnd(0,6),x:0,z:0});}})();
let clock=0,wet=0,roofA=1,hideA=1;
// Files couvertes (propriétaire, 2026-11-16, lot 5, générique) : couloirs sous la gare, sous un bâtiment, sous un rocher ou en tunnel, et leurs visiteurs, MASQUÉS par défaut ;
// visibles seulement avec « Masquer la gare » (G.hideSt, hideA → 0), plus au simple zoom ni avec les toits retirés.
// Abris (issue #15, b.ab : auvents OSM building=roof, bâtiments au-dessus de la file ou du quai) : effacés au zoom et par « Toits », comme SITE.fade ; un auvent reste un peu translucide (0,8).
// Remise du garage (issue #43, propriétaire 20/11 : train de Zeus « disparu » sous un toit gris, bâtiment OSM w148159085 au-dessus de la voie de garage) : tout bâtiment
// (hors gare) qui recouvre une voie de garage (LANES, b.yd) a un toit opaque effacé comme celui des gares (propriétaire 21/11) : au zoom rapproché, par « Toits » et « Masquer la gare » (roofA).
const bldA=b=>{const a=b.fade?(b.cvb?Math.min(roofA,hideA):roofA):b.cvb?hideA:1;return b.yd?Math.min(a,roofA):b.canopy?.8*a:a;};
const lw=(w,minPx)=>{ctx.lineWidth=Math.max(w,(minPx||0)/cam.s);};
/* ══ Ouvrages piétons et rochers (génériques, pilotés par OSM) ══
   Passerelles (f.br : highway + bridge=*, tools/make_site.py) : tablier, garde-corps, ombre ; au-dessus de la voie si elle la franchit (hauteur = voie + 2,9 m, ESTIMÉE ;
   voie haute de plus de 7 m : la passerelle passe dessous), les visiteurs qui l'empruntent sont redessinés dessus. SITE.bridges[k]={h} force la hauteur (k = rang OSM).
   Rochers (natural=rock|stone fermés) : massif en relief, ombre portée, hauteur ESTIMÉE (voie la plus haute dessous + 2,2 m, sinon 3 m ; SITE.rocks[k]={h}) ;
   voie (OSM.tunnels, under 'rock') et chemins couverts (f.cv) qui le traversent passent dessous : le rocher s'efface au zoom et toits retirés, portails aux extrémités.
   Escaliers (OSM.stairs, ou à défaut highway=steps du décor : STAIRS, engine/queue.js) : marches transversales, garde-corps, marches éclairées vers le haut (incline). */
const offL=(P,d)=>P.map((q,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [q[0]-dz/l*d,q[1]+dx/l*d];});
const dPoly=dPl; // engine/queue.js
// passerelle empruntée par la file : tablier à la largeur dessinée de la file (propriétaire, lot 4 : ouvrages = largeur du chemin qu'ils prolongent), garde-corps compris
const BRIDGES=BRIDGE_DEF.map(b=>{const on=QWS.filter(q=>dPl(q.x,q.z,b.P)<.3);if(on.length)b.w=Math.max(1,Math.min(...on.map(q=>q.w)));const {P,w,h,ty}=b;
  return {P,w,h,deck:mkPath(P),rl:mkPath(offL(P,w/2)),rr:mkPath(offL(P,-w/2)),over:ty>=0&&h>ty};}); // hauteur : BRIDGE_DEF (engine/queue.js)
const COVF=OSM.feats.filter(f=>f.cv).map(f=>f.p);
// Couloirs couverts (propriétaire, 2026-11-16, lot 4 : jonctions continues) : sol de la même teinte que le chemin extérieur (la file : pierre, à sa largeur dessinée),
// murs seulement sur les côtés (bouts coupés droit, pas de trait en travers de la jonction), assombrissement progressif sur 1,2 m depuis chaque bout.
const trimPl=(P,d)=>{const C=[0];for(let i=1;i<P.length;i++)C.push(C[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));const L=C[C.length-1];if(L<=2*d+.1)return null;
  const at=x=>{let i=1;while(i<P.length-1&&C[i]<x)i++;const k=(x-C[i-1])/((C[i]-C[i-1])||1);return [P[i-1][0]+(P[i][0]-P[i-1][0])*k,P[i-1][1]+(P[i][1]-P[i-1][1])*k,i];};
  const a=at(d),b=at(L-d);return mkPath([[a[0],a[1]]].concat(P.slice(a[2],b[2]),[[b[0],b[1]]]));};
// Niveaux souterrains dans la gare (propriétaire, OzIris, 2026-11-18, issue #19, générique) : un chemin couvert de niveau -1, -2… (f.lv, layer / level OSM < 0)
// qui passe dans l'emprise de la gare (c.ug) n'a AUCUN repère tant que la gare est affichée (ni pointillé, ni visiteurs) ; seul « Masquer la gare » le montre.
const COVSG=SITE.stationPoly||[];
const COVD=COV.map((P,i)=>{const on=QWS.filter(q=>onPl(q,P,.3));return {p:mkPath(P),ug:COVLV[i]<0&&COVSG.length>2&&P.some(q=>pipXZ(COVSG,q[0],q[1])),w:on.length?Math.min(...on.map(q=>q.w)):1.9,q:on.length>0,tr:[.4,.8,1.2].map(d=>trimPl(P,d)).filter(Boolean)};});
const COVB=COVD.map((c,i)=>{const P=COV[i];let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of P){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}const r=c.w/2+.45;return {P,r,x0:x0-r,x1:x1+r,z0:z0-r,z1:z1+r};});
// Chemin couvert sous un simple toit effaçable (propriétaire, issue #21, escalier de Zeus) : hors souterrain, hors emprise de la gare (bouts à 1 m près), hors rocher,
// couvert seulement par des bâtiments effaçables (SITE.fade ou abris b.ab, pas le bâtiment de la gare) : c.rf, il se montre (couloir, escalier, visiteurs) dès que
// son toit s'efface (zoom rapproché, « Toits », « Masquer la gare »), comme le toit lui-même ; les autres couloirs couverts : seulement « Masquer la gare ».
COVD.forEach((c,i)=>{const P=COV[i];if(COVLV[i]<0)return;const S=[];for(let j=1;j<P.length;j++){const a=P[j-1],b=P[j],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/.5));for(let k=0;k<=n;k++)S.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  let L=0;const C=S.map((q,j)=>L+=j?Math.hypot(q[0]-S[j-1][0],q[1]-S[j-1][1]):0),M=S.filter((q,j)=>C[j]>1&&C[j]<L-1);if(!M.length)M.push(...S);
  if(M.some(q=>COVSG.length>2&&pipXZ(COVSG,q[0],q[1])||ROCKP.some(R=>pipXZ(R,q[0],q[1]))))return;
  const B=LY.bld.filter(b=>M.some(q=>ctx.isPointInPath(b.p,q[0],q[1])));c.rf=B.length>0&&B.every(b=>b.fade&&!b.st);
  if(c.rf){const m=M[Math.floor(M.length/2)];c.stp=STAIRS.some(o=>dPl(m[0],m[1],o.p)<.3);}}); // c.stp : le couloir est un escalier, dessiné par drawSteps (pas de sol de couloir par-dessus)
const covH=c=>c.rf?Math.min(hideA,roofA):hideA; // 1 = couloir caché, 0 = montré
const inCov=(x,z)=>COVB.some((o,i)=>x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&dPl(x,z,o.P)<o.r&&covH(COVD[i])>=.5); // personne dans un couloir couvert encore caché
// visiteur de la file (issue #29, OzIris 1580105935) : dans un couloir couvert seulement si le tronçon de son allée où il se tient EST un morceau de ce couloir (ses deux
// bouts à moins de 0,3 m du couloir : mêmes nœuds OSM) ; une allée de niveau 0 qui passe au-dessus d'un couloir souterrain, même presque parallèle, garde ses visiteurs dessinés
const segCov=e=>e._cv||(e._cv=e.P.map((b,i)=>{if(!i)return [];const a=e.P[i-1];return COV.map((P,k)=>dPl(a[0],a[1],P)<.3&&dPl(b[0],b[1],P)<.3&&dPl((a[0]+b[0])/2,(a[1]+b[1])/2,P)<.3?k:-1).filter(k=>k>=0);}));
const inCovQ=v=>{const e=v.e;if(!e||!e.C||e.P.length<2)return inCov(v.x,v.z);const d=e.len-v.r;let i=1;while(i<e.C.length-1&&e.C[i]<d)i++;
  return segCov(e)[i].some(k=>covH(COVD[k])>=.5);};
const COVL=[];for(const P of COV){let acc=1.2;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(;acc<=l;acc+=3.5)COVL.push([a[0]+(b[0]-a[0])*acc/l,a[1]+(b[1]-a[1])*acc/l]);acc-=l;}} // plafonniers des couloirs couverts
// Hauteur ESTIMÉE du rocher : voie en tunnel dessous (OSM.tunnels / SITE.tunnels, prolongés jusqu'aux bords du rocher) la plus haute + 2,2 m ; si une voie SANS tunnel
// le traverse, elle passe PAR-DESSUS : rocher = voie du dessus la plus basse − 0,9 m (au moins voie du dessous + 1,6 m) ; sans voie : 3 m ; SITE.rocks[k]={h} force.
const ROCKS=ROCKP.map((P,k)=>{const m=cen(P);let {ty,tu,to}=fournit('hauteurRocher',{ty:-1,tu:-1,to:1e9},P); // voie dans le rocher : plus haute, plus haute en tunnel, plus basse hors tunnel (couche du type)
  const cf=(SITE.rocks||[])[k]||{},h=cf.h!=null?cf.h:to<1e9?Math.max(to-.9,tu>=0?tu+1.6:0,1):ty>=0?ty+2.2:3,pa=mkPath(P,true),inset=mkPath(P.map(q=>[m[0]+(q[0]-m[0])*.55,m[1]+(q[1]-m[1])*.55]),true);
  const cov=ty>=0||COVF.some(C=>C.some(q=>pipXZ(P,q[0],q[1])||dPoly(q[0],q[1],P)<1.2)),ports=[];
  for(const C of COVF)for(const [e,f] of [[C[0],C[1]],[C[C.length-1],C[C.length-2]]])if(pipXZ(P,e[0],e[1])||dPoly(e[0],e[1],P.concat([P[0]]))<1.2){const dx=e[0]-f[0],dz=e[1]-f[1],l=Math.hypot(dx,dz)||1;ports.push({x:e[0],z:e[1],ox:dx/l,oz:dz/l});}
  const ridges=new Path2D;P.forEach((q,i)=>{if(i%2)return;ridges.moveTo(q[0],q[1]);ridges.lineTo(m[0]+(q[0]-m[0])*.55,m[1]+(q[1]-m[1])*.55);});
  return {P,m,h,pa,inset,ridges,cov,ports};});
function drawRock(r){
  const a=r.cov?.05+.95*hideA:1; // « Masquer la gare » : rocher presque invisible, seul son contour restectx.save();ctx.globalAlpha=a;
  ctx.fillStyle=TEX.rock;ctx.fill(r.pa);ctx.save();ctx.clip(r.pa);
  {const R=Math.max(...r.P.map(q=>Math.hypot(q[0]-r.m[0],q[1]-r.m[1]))),g=ctx.createRadialGradient(r.m[0]-R*.25,r.m[1]-R*.2,R*.05,r.m[0],r.m[1],R*1.05); // modelé : sommet éclairé, pied sombre
    g.addColorStop(0,'rgba(240,232,214,.22)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(18,14,10,.38)');ctx.fillStyle=g;ctx.fill(r.pa);}
  ctx.strokeStyle='rgba(255,246,226,.16)';ctx.lineWidth=1.6;ctx.translate(-.5,-.4);ctx.stroke(r.pa);ctx.translate(.5,.4); // arêtes éclairées (soleil au nord-ouest)
  ctx.strokeStyle='rgba(20,16,12,.3)';ctx.lineWidth=2.2;ctx.translate(.7,.55);ctx.stroke(r.pa);ctx.translate(-.7,-.55); // flancs à l'ombre
  ctx.fillStyle='rgba(235,226,206,.1)';ctx.fill(r.inset);ctx.strokeStyle='rgba(30,26,20,.22)';lw(.12,.5);ctx.stroke(r.ridges);ctx.restore();
  ctx.strokeStyle='rgba(44,38,30,.75)';lw(.14,.8);ctx.stroke(r.pa);ctx.restore();
  for(const p of r.ports){const x0=p.x,z0=p.z,nx=-p.oz,nz=p.ox,hw=.8,g=ctx.createLinearGradient(x0-p.ox*1.2,z0-p.oz*1.2,x0+p.ox*.6,z0+p.oz*.6); // portail du chemin couvert
    g.addColorStop(0,'rgba(8,9,12,0)');g.addColorStop(.6,'rgba(8,9,12,.85)');g.addColorStop(1,'rgba(8,9,12,.2)');ctx.fillStyle=g;ctx.beginPath();
    ctx.moveTo(x0+nx*hw-p.ox*1.2,z0+nz*hw-p.oz*1.2);ctx.lineTo(x0+nx*hw+p.ox*.6,z0+nz*hw+p.oz*.6);ctx.lineTo(x0-nx*hw+p.ox*.6,z0-nz*hw+p.oz*.6);ctx.lineTo(x0-nx*hw-p.ox*1.2,z0-nz*hw-p.oz*1.2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(40,35,28,.85)';lw(.22,.8);ctx.beginPath();ctx.moveTo(x0+nx*(hw+.2),z0+nz*(hw+.2));ctx.lineTo(x0-nx*(hw+.2),z0-nz*(hw+.2));ctx.stroke();} // linteau sombre dans la roche
}
function drawBridge(b){
  ctx.strokeStyle='#57534b';ctx.lineWidth=b.w+.35;ctx.stroke(b.deck);ctx.strokeStyle=TEX.stone;ctx.lineWidth=b.w;ctx.stroke(b.deck); // tablier béton
  ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=b.w*.5;ctx.stroke(b.deck);
  ctx.strokeStyle='#3d4148';lw(.12,.7);ctx.stroke(b.rl);ctx.stroke(b.rr); // garde-corps
  ctx.strokeStyle='rgba(220,224,228,.45)';lw(.05,.4);ctx.stroke(b.rl);ctx.stroke(b.rr);
  if(b.over){for(const v of G.queue)if(dPoly(v.x,v.z,b.P)<b.w/2+.2)person(v.x,v.z,v.ci,v.ph,v.mv,0,v.hd); // visiteurs sur la passerelle, au-dessus de la voie
    for(const k of G.walkers)if(dPoly(k.x,k.z,b.P)<b.w/2+.2)person(k.x,k.z,k.ci,k.ph,true);}
}
const STSP=SITE.stationPoly||[]; // escaliers dans l'emprise de la gare (file qui monte au quai) : dessinés par-dessus le plancher (drawSteps(true))
// Palier rectangulaire (propriétaire, Goudurix, 2026-11-16, lot 4) : au sommet d'un escalier en applique (o.app, engine/queue.js), carré de la largeur de l'escalier,
// centré sur le sommet, du plancher de la gare et aligné sur elle (prolongement de la gare), qui rejoint le mur ; l'escalier dessiné s'arrête à son bord.
const LANDS=[];
const LANDG=[]; // paliers des autres escaliers (lot 6) : {p, q (file), inSt}
const stairDrawP=o=>{if(!o.app){const L=LANDC.find(c=>c.o===o);if(!L||o.p.length<2)return o.p;const w=o.w||1.5,h=w/2,P=o.p.slice(),ti=o.top?P.length-1:0,q=P[o.top?P.length-2:1],T=P[ti];
    const c=(u,v)=>[T[0]+L.ux*u+L.nx*v,T[1]+L.uz*u+L.nz*v];LANDG.push({p:[c(-h,h),c(h,h),c(h,-h),c(-h,-h)],q:!!(o.qs&&o.qs.length),o}); // carré de la largeur de l'escalier, centré sur son haut, aligné sur lui
    const l=Math.hypot(T[0]-q[0],T[1]-q[1])||1,k=Math.max(0,l-h)/l;P[ti]=[q[0]+(T[0]-q[0])*k,q[1]+(T[1]-q[1])*k];return P;} // escalier raccourci de w/2 au haut
  const w=o.w||APPW,sh=(APPW-w)/2,a=o.app,P=o.p.map(q=>[q[0]-a.nx*sh,q[1]-a.nz*sh]),T=[a.top[0]-a.nx*sh,a.top[1]-a.nz*sh];
  const h=w/2,c=(u,v)=>[T[0]+a.ux*u+a.nx*v,T[1]+a.uz*u+a.nz*v];LANDS.push([c(-h,h),c(h,h),c(h,-h-sh-.8),c(-h,-h-sh-.8)]); // jusqu'au bord du quai (mur de la gare agrandie, oblique, + 0,3 m)
  const R=P.slice(),top=o.top===0?0:R.length-1,nb=o.top===0?1:R.length-2,q=R[nb],l=Math.hypot(R[top][0]-q[0],R[top][1]-q[1])||1,k=Math.max(0,l-h)/l; // escalier raccourci de w/2 au sommet
  R[top]=[q[0]+(R[top][0]-q[0])*k,q[1]+(R[top][1]-q[1])*k];return R;};
const STEPD=STAIRS.map(o=>{const P=stairDrawP(o),w=o.w||1.5,tr=[],mid=P[Math.floor(P.length/2)],m2=P[Math.max(0,Math.floor(P.length/2)-1)],inSt=STSP.length>2&&(pipXZ(STSP,P[0][0],P[0][1])||pipXZ(STSP,P[P.length-1][0],P[P.length-1][1])||pipXZ(STSP,(mid[0]+m2[0])/2,(mid[1]+m2[1])/2));let acc=0,tot=0;for(let i=1;i<P.length;i++)tot+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
  for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
    for(let d=(.3-acc%.3)%.3;d<=l;d+=.3){const x=a[0]+dx/l*d,z=a[1]+dz/l*d,u=(acc+d)/(tot||1);tr.push([x+nx*w/2,z+nz*w/2,x-nx*w/2,z-nz*w/2,o.top===1?u:o.top===0?1-u:.5]);}acc+=l;}
  return {base:mkPath(P),rl:mkPath(offL(P,w/2)),rr:mkPath(offL(P,-w/2)),tr,w,inSt,q:!!(o.qs&&o.qs.length),cv:!!o.cv,o};});
// Fin d'escalier (propriétaire, OzIris, 2026-11-18, issue #19, générique) : un escalier couvert / souterrain (OSM.stairs cv, lv) dont le HAUT (o.top : incline, sinon
// déduit) ne touche aucun autre chemin couvert débouche au niveau du sol (transition -1 → 0). Gare affichée, l'escalier entier est caché (drawSteps) mais ses
// dernières marches restent visibles : trémie de MOUTH_L m (ESTIMÉ, ≈ 6 marches) au haut, marches de plus en plus sombres vers le bas, murs latéraux, garde-corps
// sur les côtés et en travers du bas de la trémie ; les visiteurs qui y montent sont dessinés. « Masquer la gare » : escalier entier, comme avant.
const MOUTH_L=1.8;
const MOUTHS=STAIRS.filter(o=>o.cv&&o.top>=0&&o.p.length>1).map(o=>{const P=o.top?o.p.slice():o.p.slice().reverse(),T=P[P.length-1]; // P : du bas vers le haut
  if(COV.some(C=>!(C.length===o.p.length&&C.every((q,i)=>q[0]===o.p[i][0]&&q[1]===o.p[i][1]))&&dPl(T[0],T[1],C)<.3))return null; // haut sur un autre couloir : pas de débouché
  let tot=0;for(let i=1;i<P.length;i++)tot+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);const L=Math.min(MOUTH_L,tot*.7),R=[T];let acc=0;
  for(let i=P.length-1;i>0&&acc<L;i--){const a=P[i],b=P[i-1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1e-9,k=Math.min(1,(L-acc)/l);R.push([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]);acc+=l*k;}
  const Q=R.reverse(),w=o.w||1.2,h=w/2,tr=[];let d0=0;const n=Q.length;
  for(let i=1;i<n;i++){const a=Q[i-1],b=Q[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;for(let d=(.3-d0%.3)%.3;d<=l;d+=.3){const x=a[0]+dx/l*d,z=a[1]+dz/l*d;tr.push([x+nx*h,z+nz*h,x-nx*h,z-nz*h,(d0+d)/(acc||1)]);}d0+=l;}
  const a=Q[0],b=Q[1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/l,nz=(b[0]-a[0])/l,g=[a[0],a[1],T[0],T[1]];
  const inSt=STSP.length>2&&pipXZ(STSP,T[0],T[1]);
  return {o,inSt,w,g,P:Q,base:mkPath(Q),rl:mkPath(offL(Q,h)),rr:mkPath(offL(Q,-h)),foot:[a[0]+nx*h,a[1]+nz*h,a[0]-nx*h,a[1]-nz*h],tr,R:Math.max(h,.6),
    x0:Math.min(a[0],T[0])-h,x1:Math.max(a[0],T[0])+h,z0:Math.min(a[1],T[1])-h,z1:Math.max(a[1],T[1])+h};}).filter(Boolean);
for(const m of MOUTHS)m.o.mouth=m;
const inMouth=(x,z)=>MOUTHS.some(m=>x>m.x0&&x<m.x1&&z>m.z0&&z<m.z1&&dPl(x,z,m.P)<m.w/2);
// Garde-corps des files (QRAIL entre allées collées, QSIDE / QSIDE2 de délimitation dans les zones piétonnes et la gare). Propriétaire, OzIris, 2026-11-18, issue #19,
// générique : aucun garde-corps à l'intérieur d'une AUTRE allée de file (coin intérieur d'un lacet, jambe voisine, jonction), d'un palier (LANDC, LANDS, LANDG),
// d'une fin d'escalier (MOUTHS), d'un escalier ou d'une travée d'attente (BAYS : de PGATE à PGATE + GDEPTH). Deux allées parallèles trop proches pour garder
// chacune son garde-corps (bords à moins de QR_GAP = 1 m, ESTIMÉ : couloir trop étroit pour servir) partagent UN garde-corps à mi-distance des axes, même sur un tronçon court : pas de bord sans garde-corps.
// Allées souterraines (COVD.ug, propriétaire, lot 22 : « en souterrain il faut les mêmes règles de garde-corps ») : mêmes règles que les autres allées (délimitation des deux
// côtés dans la gare ou une zone piétonne, clôture partagée QRAIL entre allées collées, prolongement qrailEnd, rien sur une autre allée, un palier, un escalier, une fin d'escalier),
// calculées entre allées du MÊME niveau (une allée souterraine ignore les allées de surface au-dessus d'elle, et inversement) ; tracées à part (QUG, QUGP) et dessinées
// seulement avec le couloir souterrain, c'est-à-dire gare masquée (drawWorld, 1 - hideA). Autres allées couvertes (q.cv, non souterraines) : pas de délimitation QSIDE, comme avant.
const QR_GAP=1,QRUNS=[],QUG=new Path2D,QUGP=[];
// Bout d'une clôture de séparation QRAIL là où les deux allées collées se séparent (propriétaire, OzIris, 2026-11-18 : « il manque le garde-corps ici ») : si son bout
// donne sur le sol commun des deux allées (les deux allées continuent en se touchant, coin d'un virage), la clôture est prolongée sur la ligne à égale distance des deux
// allées jusqu'à ce qu'elles ne se recouvrent plus (bordures, au plus 3 m ; sinon rien), au lieu de s'arrêter dans le vide. Pas près d'une fourche (passage), d'un palier, d'un escalier, d'une travée, d'une barrière.
// Bout côté lacet (les deux jambes se rejoignent par le virage du lacet) : rien. q = point de file du bout, m0 = bout, m1 = point précédent ; dir = -1 début, 1 fin de la clôture.
function qrailEnd(S,q,m0,m1,dir,blocked){const b=q.bo,rng=(o,k0,sg)=>S.filter(s=>s.pi===o.pi&&(s.k-k0)*sg>=0&&Math.abs(s.k-k0)<=30),
    A=rng(q,q.k,dir),B=rng(b,b.k,-dir),SL=S.filter(s=>!!s.ug===!!q.ug),near=(x,z,L)=>{let d=1e9,p=null,m=1e9;for(let i=1;i<L.length;i++){const a=L[i-1],c=L[i];if(Math.abs(a.k-c.k)!==1)continue;
      const dx=c.x-a.x,dz=c.z-a.z,l=dx*dx+dz*dz||1e-9,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/l,0,1),px=a.x+dx*t,pz=a.z+dz*t,e=Math.hypot(px-x,pz-z);m=Math.min(m,e-Math.min(a.w,c.w)/2);if(e<d){d=e;p=[px,pz];}}return {d,p,m};};
  if(A.length<3||B.length<3||FORKP.some(F=>Math.hypot(m0[0]-F[0],m0[1]-F[1])<3.5))return [];
  const GS=allGates().filter(g=>g&&g.h),mg=(x,z)=>{const a=near(x,z,A),c=near(x,z,B);return {a,c,m:Math.min(a.m,c.m)};}; // m < 0 : sur le sol dessiné d'une des deux allées
  let x=m0[0],z=m0[1],tx=m0[0]-m1[0],tz=m0[1]-m1[1],l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;const E=[];let inside=false;
  for(let i=0;i<15;i++){let nx=x+tx*.2,nz=z+tz*.2;const g=mg(nx,nz);if(g.a.p&&g.c.p){const k=(g.c.d-g.a.d)/2;nx+=(nx-g.a.p[0])/(g.a.d||1)*k*.5-(nx-g.c.p[0])/(g.c.d||1)*k*.5;nz+=(nz-g.a.p[1])/(g.a.d||1)*k*.5-(nz-g.c.p[1])/(g.c.d||1)*k*.5;}
    const G2=mg(nx,nz);if(blocked(nx,nz,q.ug)||GS.some(o=>Math.hypot(nx-o.h[0],nz-o.h[1])<1))return [];
    if(SL.some(s=>!A.includes(s)&&!B.includes(s)&&Math.hypot(s.x-nx,s.z-nz)<s.w/2-.05))return []; // troisième allée (du même niveau) : rien
    E.push([nx,nz]);if(G2.m<0)inside=true;else if(inside)return E; // bordures des deux allées atteintes
    l=Math.hypot(nx-x,nz-z)||1;tx=(nx-x)/l;tz=(nz-z)/l;x=nx;z=nz;}
  return [];}
function buildRails(){const S=QWS;if(!S.length)return;
  const UG=COV.filter((P,i)=>COVD[i].ug),SEG=[];for(const q of S)q.ug=UG.some(P=>onPl(q,P,.3)); // allées souterraines : niveau à part (lot 22)
  for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i];if(a.pi!==b.pi||a.ug!==b.ug)continue;const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1e-9;
    SEG.push({a,b,dx,dz,l,ug:a.ug,tx:dx/l,tz:dz/l,h:Math.min(a.w,b.w)/2,x0:Math.min(a.x,b.x)-1.2,x1:Math.max(a.x,b.x)+1.2,z0:Math.min(a.z,b.z)-1.2,z1:Math.max(a.z,b.z)+1.2});}
  const inAlley=(x,z,skip,s2)=>{const ug=!!(skip||{}).ug;for(const g of SEG){if(g.ug!==ug||x<g.x0||x>g.x1||z<g.z0||z>g.z1||skip&&(g.a===skip||g.b===skip)||s2&&(g.a===s2.a||g.b===s2.b||g.a===s2.b||g.b===s2.a))continue;const t=clamp(((x-g.a.x)*g.dx+(z-g.a.z)*g.dz)/(g.l*g.l),0,1);
    if(Math.hypot(g.a.x+g.dx*t-x,g.a.z+g.dz*t-z)<g.h-.02)return g;}return null;};
  // jambe parallèle du côté e dont le bord est à moins de QR_GAP du bord de q (QR_GAP = 1 m, ESTIMÉ : couloir trop étroit pour servir) : {ad = écart des axes, k}
  const partner=(q,nx,nz)=>{let best=null;for(const g of SEG){if(g.ug!==q.ug||q.x<g.x0-2||q.x>g.x1+2||q.z<g.z0-2||q.z>g.z1+2||g.a.pi===q.pi&&Math.abs(g.a.k-q.k)<4||Math.abs(g.tx*q.tx+g.tz*q.tz)<.7)continue;
      const t=((q.x-g.a.x)*g.dx+(q.z-g.a.z)*g.dz)/(g.l*g.l);if(t<-.05||t>1.05)continue;const fx=g.a.x+g.dx*t-q.x,fz=g.a.z+g.dz*t-q.z,ad=fx*nx+fz*nz;
      if(ad<.6||Math.abs(fx*q.tx+fz*q.tz)>.35*ad||ad>q.w/2+g.h+QR_GAP)continue;if(!best||ad<best.ad)best={ad,k:g.a.k,g};}return best;};
  const polys=LANDS.concat(LANDG.map(L=>L.p)),SDR=STAIRS.filter(o=>o.p.length>1);
  const blocked=(x,z,ug)=>inLand([x,z],0)||polys.some(P=>pipXZ(P,x,z))||inMouth(x,z)||SDR.some(o=>dPl(x,z,o.p)<(o.w||1)/2)||!ug&&( // travées (couche du type) et zone d'attente : niveau du quai seulement
    vrai('horsGardeCorps',x,z)||BAREA&&pipA(BAREA,x,z)); // ni dans la zone d'attente éditée (GAME.boardAreas)
  const emit=(R,Pa,Pp,every)=>R.forEach((m,j)=>{if(j)Pa.lineTo(m[0],m[1]);else Pa.moveTo(m[0],m[1]);if(j%every===0||j===R.length-1)Pp.push(m);});
  // clôture entre deux allées collées (propriétaire, 2026-11-16) : main courante sur poteaux, tracée à mi-distance des axes ; hors allées souterraines (COVD.ug), paliers, escaliers, travées
  {const runs=[];let r=null;for(let i=0;i<S.length;i++){const q=S[i];if(!q.mid||q.ug!==q.bo.ug||blocked(q.mid[0],q.mid[1],q.ug)){r=null;continue;}const pr=S[i-1];
      if(r&&pr&&pr.mid&&pr.pi===q.pi&&pr.ug===q.ug&&Math.hypot(pr.mid[0]-q.mid[0],pr.mid[1]-q.mid[1])<1.2){r.push(q.mid);r.q.push(q);}else{runs.push(r=[q.mid]);r.q=[q];}}
    for(const R of runs){if(R.length<4)continue;
      const ext=[[R.q[0],R[0],R[1],-1]];if(R.q[0].pi!==R.q[0].bo.pi)ext.push([R.q[R.q.length-1],R[R.length-1],R[R.length-2],1]);
      for(const [q,m0,m1,dir] of ext){const E=qrailEnd(S,q,m0,m1,dir,blocked);if(E.length){if(dir<0)R.unshift(...E.reverse());else R.push(...E);}}
      if(R.q[0].ug){emit(R,QUG,QUGP,4);R.ug=1;R.forEach(m=>{m.ug=1;});}else emit(R,QRAIL,QRAILP,4);QMIDS.push(...R);QRUNS.push(R);}} // tronçons de moins de 1,5 m ignorés (pas de bout de main courante isolé)
  // une seule clôture entre deux allées collées : la main courante de délimitation (QSIDE, zones piétonnes et gare) du côté de la clôture de séparation n'est pas dessinée
  for(const q of S)for(const e of [1,-1])if(QMIDS.some(m=>{if(!!m.ug!==!!q.ug)return false;const dx=m[0]-q.x,dz=m[1]-q.z;return Math.abs(dx)<1.6&&Math.abs(dz)<1.6&&Math.abs(dx*q.tx+dz*q.tz)<.4&&(-q.tz*dx+q.tx*dz)*e>0&&Math.hypot(dx,dz)<1.6;}))(q.nf||(q.nf={}))[e]=1;
  // délimitation des deux côtés (1 : zones piétonnes ; 2 : sur le plancher de la gare, dessinée après lui)
  for(const [k,Pa,Pp] of [[1,QSIDE,QSIDEP],[2,QSIDE2,QSIDEP2],[3,QUG,QUGP],[4,QSIDE0,QSIDEP0]])for(const e of [1,-1]){let R=null,mode=0;const out=()=>{if(R&&R.length>1)emit(R,Pa,Pp,3);R=null;};
    for(let i=0;i<S.length;i++){const q=S[i],nx=-q.tz*e,nz=q.tx*e; // k = 3 : allées souterraines (zone piétonne ou gare), tracées dans QUG ; k = 4 : reste de la file (hors zone piétonne et gare), même garde-corps, dessiné en métal seulement (QSIDE0, issue #45)
      if((k===3?!q.ug||!q.side:k===4?q.ug||q.side||q.cv:q.ug||q.side!==k||q.cv)||q.nf&&q.nf[e]||R&&(S[i-1].pi!==q.pi||S[i-1].ug!==q.ug)){out();continue;}
      let d=q.w/2+.05,x=q.x+nx*d,z=q.z+nz*d,md=1,p=partner(q,nx,nz);
      if(p&&inAlley(q.x+nx*p.ad/2,q.z+nz*p.ad/2,q,p.g))p=null; // milieu dans une troisième allée (coin d'un lacet très court) : pas de garde-corps partagé
      if(p){if(q.k<p.k){d=p.ad/2;x=q.x+nx*d;z=q.z+nz*d;md=2;}else md=0;} // jambe parallèle voisine : garde-corps partagé, dessiné par l'allée la première dans la file
      else if(inAlley(x,z,q))md=0; // dans une autre allée (coin intérieur, jonction) : rien
      if(!md||blocked(x,z,q.ug)){out();continue;}
      if(R&&md!==mode)out();mode=md;(R||(R=[])).push([x,z]);}
    out();}}
buildRails();
function drawMouths(st){if(!MOUTHS.length||hideA<=.5)return;ctx.save();ctx.globalAlpha=Math.min(1,(hideA-.5)*2);ctx.lineCap='butt';
  for(const m of MOUTHS){if(!!m.inSt!==!!st)continue;const gr=ctx.createLinearGradient(m.g[0],m.g[1],m.g[2],m.g[3]);gr.addColorStop(0,'#141311');gr.addColorStop(.35,'#3a362f');gr.addColorStop(1,'#8a8275'); // trémie : sombre en bas
    ctx.strokeStyle='#2e2a24';ctx.lineWidth=m.w+.3;ctx.stroke(m.base); // murs de la trémie
    ctx.strokeStyle=gr;ctx.lineWidth=m.w-.1;ctx.stroke(m.base);
    if(cam.s>3){lw(.07,.4);for(const t of m.tr){const c=Math.round(40+150*t[4]);ctx.strokeStyle=`rgb(${c},${c-4},${c-12})`;ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();}} // nez de marche, clairs en haut
    ctx.strokeStyle='#3f434a';lw(.08,.6);ctx.stroke(m.rl);ctx.stroke(m.rr);ctx.beginPath();ctx.moveTo(m.foot[0],m.foot[1]);ctx.lineTo(m.foot[2],m.foot[3]);ctx.stroke(); // garde-corps : côtés et bas
    ctx.strokeStyle='rgba(220,224,228,.4)';lw(.03,.3);ctx.stroke(m.rl);ctx.stroke(m.rr);}
  ctx.restore();}
function drawLands(s){if(!LANDS.length)return;ctx.fillStyle=LK.pf;for(const L of LANDS){ctx.beginPath();L.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();
    if(s>4&&LK.prow){ctx.save();ctx.globalAlpha=.16;ctx.fillStyle=TEX.rows;ctx.fill();ctx.restore();}ctx.strokeStyle='#3f434a';lw(.1,.6);ctx.beginPath();ctx.moveTo(L[1][0],L[1][1]);ctx.lineTo(L[2][0],L[2][1]);ctx.moveTo(L[0][0],L[0][1]);ctx.lineTo(L[1][0],L[1][1]);ctx.stroke();ctx.fillStyle='#b59c78';}} // garde-corps : côté extérieur et bout
const stH=o=>{if(o.cvi===undefined){const m=o.p[Math.floor(o.p.length/2)],m2=o.p[Math.max(0,Math.floor(o.p.length/2)-1)],x=(m[0]+m2[0])/2,z=(m[1]+m2[1])/2;o.cvi=COV.findIndex(P=>dPl(x,z,P)<.3);}return o.cvi<0?hideA:covH(COVD[o.cvi]);}; // escalier couvert : facteur du couloir qui le porte
function drawSteps(st){ // même teinte et même bordure que le chemin prolongé (file : pierre ; allée : sable), bouts coupés droit (jonction continue)
  ctx.lineCap='butt';
  if(!st)for(const L of LANDG){if(L.o.cv&&!L.o.mouth&&stH(L.o)>.5)continue;const P=L.p;ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath(); // paliers (hors gare)
    ctx.fillStyle=L.q?LK.q:TEX.sand;ctx.fill();ctx.strokeStyle='rgba(60,50,35,.45)';lw(.07,.5);ctx.stroke();}
  for(const o of STEPD){if(!!o.inSt!==!!st||o.cv&&stH(o.o)>.5)continue; // escalier couvert : seulement gare masquée (sous un simple toit effaçable : dès que le toit s'efface, issue #21)
ctx.strokeStyle=o.q?LK.rail.edge:'#a89a78';ctx.lineWidth=o.w+.3;ctx.stroke(o.base);
    ctx.strokeStyle='#3f434a';ctx.lineWidth=o.w+.04;ctx.stroke(o.base); // garde-corps des deux côtés (bande tracée avec le chemin : pas de croisement dans les virages serrés)
    ctx.strokeStyle=o.q?LK.q:TEX.sand;ctx.lineWidth=o.w-.14;ctx.stroke(o.base);
    ctx.strokeStyle='rgba(0,0,0,.06)';ctx.stroke(o.base);
    if(cam.s>3){lw(.07,.4);for(const t of o.tr){const c=Math.round(110+70*t[4]);ctx.strokeStyle=`rgb(${c},${c-4},${c-12})`;ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();}} // nez de marche, plus clairs vers le haut
}
}
function person(x,z,ci,ph,mv,helmet,hd){ // hd : orientation des épaules (visiteurs de la file face à leur marche, engine/queue.js qPlace), sinon ph
  if(cam.s<4.2){ctx.fillStyle=PAL[ci];const k=Math.max(.45,1.2/cam.s);ctx.fillRect(x-k/2,z-k/2,k,k);return;}
  const a=(hd!=null?hd:ph)+(mv?Math.sin(clock*7+ph)*.3:0);
  ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(x+.3,z+.24,.27,.19,a,0,7);ctx.fill();
  ctx.fillStyle=PAL[ci];ctx.beginPath();ctx.ellipse(x,z,.27,.17,a,0,7);ctx.fill();
  ctx.fillStyle=helmet||HAIR[(ph*7|0)%HAIR.length];ctx.beginPath();ctx.arc(x,z,.115,0,7);ctx.fill();
}
const API={lw,person,TEX}; // outils passés aux fonctions de dessin propres à chaque attraction (SITE.draw)
// Sol des quais (propriétaire, 2026-11-16, lot 5, toutes les attractions) : béton clair mat, pour bien voir visiteurs, opérateurs et portillons ; SITE.platCol pour changer.
const PLAT_COL=SITE.platCol||'#d6d1c6';
// Apparence de la file et des quais réglée dans l'éditeur (issue #45, docs/ARCHITECTURE.md D11) : GAME.look = {queue:{col, tex}, plat:{col, tex}, rail, gate}, chaque clé
// facultative ; priorité GAME > SITE (SITE.platCol) > défaut du moteur ; sans GAME.look, rendu strictement identique (TEX.stone, PLAT_COL, garde-corps métal, portillons
// vert / rouge). Relu à chaque image (drawWorld, look()) : l'éditeur l'applique à chaud. Textures générées ici (aucun fichier image), couleurs sourdes ESTIMÉES (pas relevées) :
// concrete béton, asphalt asphalte, sand sable stabilisé, pavers pavés (25 x 12,5 cm, appareil en quinconce), deck platelage bois (lames de 15 cm). Sol de la file : motif
// dans les axes du plan ; sol des quais : motif tourné dans l'axe de la gare (lames de platelage et joints de béton en travers de la voie). Quai avec une couleur et sans
// texture : béton lissé comme aujourd'hui (rayures TEX.rows), dans cette couleur. rail : matériau des garde-corps et clôtures de file (metal = actuel ; wood main courante et
// poteaux en bois ; stone muret de pierre avec chaperon clair, piliers), vantaux des barrières pivotantes GAME.barriers assortis (pierre : vantail en fer sombre entre piliers
// de pierre). gate : couleur des vantaux des portillons du quai (et de leur clôture fixe sur la ligne des portillons) ; leur état reste lisible (angle d'ouverture, voyant
// vert / rouge sur le poteau-pivot).
const FLOOR_DEF={concrete:'#bdb8ad',asphalt:'#6f7175',sand:'#c6b48f',pavers:'#8f8577',deck:'#8a6c4c'},FLOOR_PX=32,FLOOR_N=256; // 32 px par m, motif de 8 m
const RAILM={metal:{c:'#4a4f56',k:1,hi:'rgba(205,210,214,.5)',hk:1,post:'#2f3338',pk:1,edge:'#4a3a28',ew:.3,lf:'#4f555c',lfh:'#aeb5bd',lfp:'#23262b',lpk:1},
  wood:{c:'#6a5136',k:1.15,hi:'rgba(196,166,124,.45)',hk:1.2,post:'#3f2f1f',pk:1.2,edge:'#54402a',ew:.34,lf:'#6a5136',lfh:'rgba(196,166,124,.6)',lfp:'#3f2f1f',lpk:1.1},
  stone:{c:'#8d877b',k:1.9,hi:'rgba(214,208,196,.7)',hk:2.2,post:'#777166',pk:1.6,edge:'#7a7468',ew:.45,lf:'#3a3d40',lfh:'#6d7277',lfp:'#8d877b',lpk:1.6}}; // largeurs ESTIMÉES (muret ≈ 30 cm)
const FLOORC={};
function floorTex(kind,col,rot,joints){const key=kind+col+rot+(joints?1:0);if(FLOORC[key])return FLOORC[key];
  let sd=7;const r=()=>(sd=(sd*16807)%2147483647)/2147483647,n=FLOOR_N,P=FLOOR_PX,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');
  const [R,Gc,B]=[1,3,5].map(i=>parseInt(col.slice(i,i+2),16)),sh=k=>`rgb(${clamp(R+k,0,255)|0},${clamp(Gc+k,0,255)|0},${clamp(B+k*.9,0,255)|0})`;
  x.fillStyle=kind==='pavers'?sh(-38):kind==='deck'?sh(-55):col;x.fillRect(0,0,n,n); // joints plus sombres (pavés, lames)
  const blobs=(cnt,r0,r1,k,a)=>{for(let i=0;i<cnt;i++){const px=r()*n,pz=r()*n,rr=r0+r()*(r1-r0);x.fillStyle=k>0?`rgba(255,250,235,${a})`:`rgba(30,26,20,${a})`;for(const ox of [-n,0,n])for(const oz of [-n,0,n]){x.beginPath();x.ellipse(px+ox,pz+oz,rr,rr*(.5+r()*.5),r()*3,0,7);x.fill();}}};
  if(kind==='pavers'){const w=P/4,h=P/8;for(let j=0;j<n/h;j++)for(let i=-1;i<n/w;i++){const o=(j%2)*w/2;x.fillStyle=sh((r()-.5)*22);x.fillRect(i*w+o+.5,j*h+.5,w-1,h-1);}}
  else if(kind==='deck'){const h=P*.15;let j=0;for(let y=0;y<n;y+=n/Math.round(n/h),j++){const hh=n/Math.round(n/h),L=P*(2+r()*2),o=r()*L;for(let xx=-o;xx<n;xx+=L){x.fillStyle=sh((r()-.5)*26);x.fillRect(xx+.5,y+.5,L-1,hh-1.2);
      x.strokeStyle='rgba(40,28,16,.18)';x.lineWidth=.6;for(let g=0;g<3;g++){const gy=y+1+r()*(hh-2.5);x.beginPath();x.moveTo(xx+1,gy);x.lineTo(xx+L-1,gy+(r()-.5));x.stroke();}}}}
  else if(kind==='sand'){blobs(60,3,14,-1,.08);blobs(50,3,12,1,.1);for(let i=0;i<500;i++){x.fillStyle=r()<.5?'rgba(80,66,44,.35)':'rgba(240,232,210,.4)';x.fillRect(r()*n,r()*n,1,1);}}
  else if(kind==='asphalt'){blobs(30,6,20,-1,.06);for(let i=0;i<2600;i++){x.fillStyle=r()<.6?'rgba(30,30,32,.35)':'rgba(190,190,186,.3)';x.fillRect(r()*n,r()*n,1,1);}}
  else{blobs(40,4,16,-1,.06);blobs(30,4,14,1,.07);for(let i=0;i<700;i++){x.fillStyle=r()<.5?'rgba(60,56,48,.18)':'rgba(250,248,240,.22)';x.fillRect(r()*n,r()*n,1,1);}
    if(joints){x.strokeStyle='rgba(60,56,48,.35)';x.lineWidth=1;x.beginPath();for(let v=0;v<n;v+=P*2){x.moveTo(v+.5,0);x.lineTo(v+.5,n);}x.moveTo(0,.5);x.lineTo(n,.5);x.stroke();}} // joints de dalles tous les 2 m (quai)
  const d=x.getImageData(0,0,n,n),a=d.data;for(let i=0;i<a.length;i+=4){const k=(r()-.5)*8;a[i]+=k;a[i+1]+=k;a[i+2]+=k*.8;}x.putImageData(d,0,0);
  const p=ctx.createPattern(c,'repeat');p.setTransform(new DOMMatrix().rotate(rot).scale(1/P));return FLOORC[key]=p;}
const hexC=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c)?c.toLowerCase():null;
const PLAT_ROT=fournit('angleQuai',0); // lames et joints du quai en travers de la voie
// Valeurs OSM par défaut de GAME.look (issue #46, D12) : OSM.attrs (tools/make_site.py) -> OSML ; priorité GAME > OSM > SITE > défaut ; sans attrs, OSML est vide et rien ne change.
// Valeur dominante par longueur (queue : plusieurs chemins). surface : concrete, asphalt, compacted|fine_gravel -> sand, paving_stones|sett -> pavers, wood -> deck ; material des garde-corps : metal|steel|iron,
// wood, stone|brick|concrete (barrier=wall sans material : pierre) ; roof:colour du bâtiment de la gare ; colour des chemins de file (queue) et du polygone de sol du quai (plat). Béton OSM d'une allée : l'origine du moteur
// (TEX.stone) reste dessinée, la texture générée n'est prise que si GAME la demande (look()).
const OSM_TEX={concrete:'concrete',asphalt:'asphalt',compacted:'sand',fine_gravel:'sand',paving_stones:'pavers',sett:'pavers',wood:'deck'},OSM_RAIL={metal:'metal',steel:'metal',iron:'metal',wood:'wood',stone:'stone',brick:'stone',concrete:'stone'};
const OSML=(()=>{const A=typeof OSM!=='undefined'&&Array.isArray(OSM.attrs)?OSM.attrs:[],o={};
  const dom=(role,f)=>{const m={};for(const a of A)if(a&&a.role===role&&a.t){const v=f(a);if(v)m[v]=(m[v]||0)+(a.l||1);}let b=null,n=0;for(const k in m)if(m[k]>n){b=k;n=m[k];}return b;};
  for(const r of ['queue','plat']){let v=dom(r,a=>OSM_TEX[a.t.surface]);if(v)(o[r]=o[r]||{}).tex=v;v=dom(r,a=>a.h&&a.h.colour);if(v)(o[r]=o[r]||{}).col=v;}
  let v=dom('rail',a=>OSM_RAIL[a.t.material]||(a.t.barrier==='wall'&&!a.t.material?'stone':null));if(v)o.rail=v;
  v=dom('roof',a=>a.h&&a.h['roof:colour']);if(v)o.roof=v;
  for(const a of A)if(a&&a.role==='queue'&&a.t){const w={};if(OSM_TEX[a.t.surface])w.tex=OSM_TEX[a.t.surface];if(a.h&&a.h.colour)w.col=a.h.colour;if(w.tex||w.col)(o.ways=o.ways||{})[a.id]=w;} // surface / colour de CHAQUE chemin de file (issue #45)
  return o;})();
function mkLook(L){const q=L.queue&&typeof L.queue==='object'?L.queue:{},p=L.plat&&typeof L.plat==='object'?L.plat:{};
  const qt=FLOOR_DEF[q.tex]?q.tex:null,qc=hexC(q.col),pt=FLOOR_DEF[p.tex]?p.tex:null,pc=hexC(p.col);
  const qw={};for(const id in L.ways||{}){const w=L.ways[id]||{},t=FLOOR_DEF[w.tex]?w.tex:null,c=hexC(w.col);qw[id]=t||c?floorTex(t||'concrete',c||FLOOR_DEF[t||'concrete'],0,false):TEX.stone;} // sol par chemin OSM : texture / couleur déjà fusionnées avec les réglages globaux (look) ; ni l'une ni l'autre : béton d'origine
  return {qw,q:qt||qc?floorTex(qt||'concrete',qc||FLOOR_DEF[qt||'concrete'],0,false):TEX.stone,
    pf:pt?floorTex(pt,pc||FLOOR_DEF[pt],PLAT_ROT,true):pc||PLAT_COL,prow:!pt,rail:RAILM[L.rail]||RAILM.metal,gate:hexC(L.gate),roof:hexC(L.roof)};}
let LKs=null,LK=null;
function look(){const G_=GM.look&&typeof GM.look==='object'&&!Array.isArray(GM.look)?GM.look:{},L=Object.assign({},OSML,G_,{queue:Object.assign({},OSML.queue,G_.queue),plat:Object.assign({},OSML.plat,G_.plat)});
  if(L.queue.tex==='concrete'&&!L.queue.col&&!(G_.queue&&G_.queue.tex))delete L.queue.tex; // béton lu dans OSM = origine du moteur (TEX.stone)
  // Sol par chemin de file (GAME.look.ways[id] = {tex, col}) : priorité GAME du chemin > GAME des allées > OSM du chemin (surface / colour) > OSM dominant > origine du moteur
  const gw=G_.ways&&typeof G_.ways==='object'&&!Array.isArray(G_.ways)?G_.ways:{},gq=G_.queue||{},ow=OSML.ways||{};L.ways={};
  for(const id of new Set(Object.keys(ow).concat(Object.keys(gw)))){const o=ow[id]||{},g=gw[id]||{};
    const tex=g.tex||gq.tex||o.tex,col=g.col||gq.col||o.col,fromGame=!!(g.tex||gq.tex);
    if(!tex&&!col)continue;L.ways[id]=tex==='concrete'&&!col&&!fromGame?{}:{tex,col};} // béton lu dans OSM : origine du moteur
  const k=JSON.stringify(L);if(k!==LKs){LKs=k;LK=mkLook(L);}return LK;}
look();
// Garde-corps de file (propriétaire, 23/11, issue #45) : même dessin que le vantail de la barrière d'entrée de file (leaf) : barre large à main courante claire, ombre portée
// décalée, poteaux carrés (tous les ≈ 1,2 m, PP) ; matériau de GAME.look.rail (largeurs ESTIMÉES, pas relevées). mn : largeur minimale (px), sh : ombre portée.
function railDraw(P,PP,mn,sh){const m=LK.rail;
  if(sh){ctx.strokeStyle='rgba(0,0,0,.28)';lw(.16*m.k,mn);ctx.save();ctx.translate(.18,.14);ctx.stroke(P);ctx.restore();}
  ctx.strokeStyle=m.c;lw(.16*m.k,mn);ctx.stroke(P);ctx.strokeStyle=m.hi;lw(.06*m.hk,.5);ctx.stroke(P);
  if(cam.s>6){ctx.fillStyle=m.post;const r=.1*m.pk;for(const q of PP)ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);}}
// Salle de contrôle (poste de conduite, pupitre) : GAME.controlRooms=[{id, x, z, angle (degrés), w, d (m), main}] (éditeur, docs/ARCHITECTURE.md D3) ; une seule salle par
// attraction pour l'instant (propriétaire, lot 1) : la salle main (sinon la première) porte le pupitre ; liste vide = aucune salle (ni opérateur au pupitre, ni gyrophare,
// ni étiquette). Sans GAME.controlRooms : repli sur SITE.booth=[x, z, angle (rad), échelle] (pupitre de 3,75 x 1,7 m à l'échelle 1, ESTIMÉ). Gyrophare et étiquette :
// SITE.beacon / SITE.boothLabel ramenés au repère de la salle (ils la suivent quand elle bouge), sinon posés sur la salle. Réglables dans GAME.controlRooms[i] : beacon et label = [x, z] en m dans le repère de la salle (centre, x le long de w, z le long de d, vitre vers +z), priorité GAME > SITE > défaut.
const BOOTH_W=3.75,BOOTH_D=1.7;
const B0=SITE.booth?(()=>{const B=SITE.booth,sc=B[3]||1,c=Math.cos(B[2]),sn=Math.sin(B[2]),loc=q=>q?[(q[0]-B[0])*c+(q[1]-B[1])*sn,-(q[0]-B[0])*sn+(q[1]-B[1])*c]:null;
  return {room:{id:'poste',x:B[0],z:B[1],angle:B[2]*180/Math.PI,w:BOOTH_W*sc,d:BOOTH_D*sc,main:true},bl:loc(SITE.beacon),ll:loc(SITE.boothLabel)};})():null;
// Salle lue dans OSM (issue #33, propriétaire 20/11) : bâtiment nommé « Salle de contrôle » / « control room » (tools/make_site.py, OSM.ctl : rectangle d'aire
// minimale, vitre tournée vers la voie) = position par défaut, avant SITE.booth ; GAME.controlRooms (éditeur) reste prioritaire. defRoom() : salle par défaut (éditeur).
const OSM_ROOM=Array.isArray(OSM.ctl)&&OSM.ctl.length?{id:'poste',x:OSM.ctl[0].x,z:OSM.ctl[0].z,angle:OSM.ctl[0].angle,w:OSM.ctl[0].w,d:OSM.ctl[0].d,main:true}:null;
function defRoom(){return OSM_ROOM||(B0?B0.room:null);}
function ctlRooms(){const D=defRoom(),R=Array.isArray(GM.controlRooms)?GM.controlRooms:D?[D]:[];return R.filter(r=>r&&[r.x,r.z,r.angle,r.w,r.d].every(v=>typeof v==='number'&&isFinite(v)));}
function mainRoom(){const R=ctlRooms();return R.find(r=>r.main)||R[0]||null;}
const roomPt=(r,l)=>{const t=r.angle*Math.PI/180;return [r.x+l[0]*Math.cos(t)-l[1]*Math.sin(t),r.z+l[0]*Math.sin(t)+l[1]*Math.cos(t)];};
function beaconAt(){const r=mainRoom();if(!r)return null;const l=Array.isArray(r.beacon)?r.beacon:B0&&B0.bl?B0.bl:[r.w/2-.35,-r.d/2+.3];return roomPt(r,[clamp(l[0],-r.w/2-.5,r.w/2+.5),clamp(l[1],-r.d/2-.5,r.d/2+.5)]);}
function boothLabelAt(){const r=mainRoom();if(!r)return null;if(Array.isArray(r.label))return roomPt(r,r.label);if(B0&&B0.ll)return roomPt(r,B0.ll);return [r.x,r.z-Math.max(r.w,r.d)/2-2.2];}
function roomPos(){const r=mainRoom();if(!r)return null;const t=r.angle*Math.PI/180,c=Math.cos(t),sn=Math.sin(t),loc=q=>q?[+((q[0]-r.x)*c+(q[1]-r.z)*sn).toFixed(2),+(-(q[0]-r.x)*sn+(q[1]-r.z)*c).toFixed(2)]:null;
  return {beacon:loc(beaconAt()),label:loc(boothLabelAt()),game:{beacon:Array.isArray(r.beacon),label:Array.isArray(r.label)}};} // éditeur : positions effectives dans le repère de la salle
function drawBooth(s){for(const r of ctlRooms()){const sx=r.w/BOOTH_W,sz=r.d/BOOTH_D,t=r.angle*Math.PI/180;ctx.save();ctx.translate(r.x,r.z);ctx.rotate(t);ctx.scale(sx,sz); // vitre (côté +z local) tournée vers la voie
  ctx.fillStyle='#3a434f';ctx.fillRect(-1.875,-.85,3.75,1.7);ctx.fillStyle='#8fd0e8';ctx.fillRect(-1.72,.62,3.45,.2);
  if(r===mainRoom()){ctx.fillStyle='#20262e';ctx.fillRect(-1.37,.15,2.7,.42);
    if(s>6)[['#4cc38a',-.97],['#f2c14e',-.37],['#4f8cff',.23],['#e5484d',.88]].forEach(([c,x])=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,.36,.1,0,7);ctx.fill();});}
  ctx.restore();
  if(s>6&&r===mainRoom())person(r.x+Math.sin(t)*.32*sz,r.z-Math.cos(t)*.32*sz,3,1.2,false,'#1d2b4f');}
}
function leaf(g,t){if(g.off)return; // vantail métallique : pivot h en bordure, extrémité en a (t=1) ou en b (t=0) ; g.off : barrière supprimée par l'éditeur (GAME.barriers)
  const ta=Math.atan2(g.a[1]-g.h[1],g.a[0]-g.h[0]),tb=Math.atan2(g.b[1]-g.h[1],g.b[0]-g.h[0]);let d=ta-tb;d=Math.atan2(Math.sin(d),Math.cos(d));
  const th=tb+d*t,len=lerp(Math.hypot(g.b[0]-g.h[0],g.b[1]-g.h[1]),Math.hypot(g.a[0]-g.h[0],g.a[1]-g.h[1]),t),ex=g.h[0]+Math.cos(th)*len,ez=g.h[1]+Math.sin(th)*len;
  ctx.strokeStyle='rgba(0,0,0,.28)';lw(.2,1);ctx.beginPath();ctx.moveTo(g.h[0]+.22,g.h[1]+.17);ctx.lineTo(ex+.22,ez+.17);ctx.stroke();
  const m=LK.rail; // matériau assorti aux garde-corps (GAME.look.rail, issue #45)
  ctx.strokeStyle=m.lf;lw(.2,1.4);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.strokeStyle=m.lfh;lw(.07,.5);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.fillStyle=m.lfp;for(const [q,r0] of [[g.h,.2],[g.a,.13],[g.b,.13]]){const r=r0*m.lpk;ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);}
}
function drawQSide(P,PP){if(!PP.length)return;railDraw(P,PP,1,1);}
// Pans d'un toit OSM (roofGeom) : chaque pan éclairé selon sa normale et sa pente (lumière du nord-ouest, comme les arêtes des toits plats), faîtage et arêtiers clairs
const ROOF_L=[-.8,-.6];
function drawPans(g,a){for(const p of g.pans){const k=(p.n[0]*ROOF_L[0]+p.n[1]*ROOF_L[1])*Math.sin(p.sl)*2.2;
    ctx.fillStyle=k>0?`rgba(255,255,255,${Math.min(.24,k*.3)})`:`rgba(0,0,0,${Math.min(.3,-k*.36)})`;ctx.globalAlpha=a;ctx.beginPath();p.P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();}
  ctx.strokeStyle='rgba(255,250,235,.3)';lw(.14,.6);ctx.beginPath();ctx.moveTo(g.ridge[0][0],g.ridge[0][1]);ctx.lineTo(g.ridge[1][0],g.ridge[1][1]);
  if(g.shape==='hipped')for(const s of [-1,1])for(const t of [-1,1]){const r=g.ridge[s<0?0:1],x=g.c[0]+g.d[0]*s*g.hl-g.d[1]*t*g.hw,z=g.c[1]+g.d[1]*s*g.hl+g.d[0]*t*g.hw;ctx.moveTo(r[0],r[1]);ctx.lineTo(x,z);}
  ctx.stroke();}
// Tranchée OSM (man_made=excavation fermé, issue #68) : une ouverture dans les surfaces au sol (eau, pelouses, sable) qu'elle perce ; voie, chemins, passerelles
// et couvertures, de niveau supérieur, restent dessus. Fond en béton (material=concrete|cement) sinon en terre, ombre portée des murs vers l'intérieur, chaperon clair.
function drawExc(){for(const e of LY.exc){const be=/^(concrete|cement|reinforced_concrete)$/.test(e.m||'');
  ctx.fillStyle=be?TEX.stone:TEX.dirt;ctx.fill(e.p);ctx.save();ctx.clip(e.p);ctx.fillStyle='rgba(30,30,28,.28)';ctx.fill(e.p);
  ctx.strokeStyle='rgba(16,16,14,.32)';lw(2.4,3);ctx.stroke(e.p);ctx.translate(.5,.4);ctx.strokeStyle='rgba(16,16,14,.22)';lw(2.4,3);ctx.stroke(e.p);ctx.restore();
  ctx.strokeStyle=be?'#c9c5ba':'#9c8d70';lw(.35,1);ctx.stroke(e.p);}}
function drawBld(b,s){ // toit d'un bâtiment (OSM ou SITE.buildings)
  ctx.globalAlpha=bldA(b);ctx.fillStyle=(b.st?LK.roof||b.rc||SITE.stationRoofCol:b.rc)||b.col; // toit : OSM roof:colour (b.rc) ; gare : GAME.look.roof > OSM roof:colour > SITE.stationRoofCol (issue #46)
  ctx.fill(b.p);
  ctx.save();ctx.clip(b.p);
  if(s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha*=.35;ctx.fill(b.p);ctx.globalAlpha=bldA(b);}
  if(b.rf&&b.rf.pans.length)drawPans(b.rf,bldA(b)); // toit à pans lu dans OSM (roof:shape) : prime sur le dessin SITE.draw.stationRoof
  else if(b.st&&!b.rf&&SITE.draw&&SITE.draw.stationRoof)SITE.draw.stationRoof(ctx,b,API); // ancien dessin de jeu, seulement si OSM ne donne aucune forme
  else{ctx.lineWidth=3.4;ctx.strokeStyle='rgba(255,255,255,.2)';ctx.stroke(b.lit);ctx.strokeStyle='rgba(0,0,0,.24)';ctx.stroke(b.dark);}
  ctx.restore();ctx.strokeStyle='rgba(40,25,20,.6)';lw(.25,.8);ctx.stroke(b.p);
}
function drawWorld(dt){look(); // GAME.look relu à chaque image (éditeur : application à chaud, issue #45)
  hideA=lerp(hideA,G.hideSt?0:1,Math.min(1,dt*5));if(hideA<.004)hideA=0;
  const s=cam.s,x0=cam.x-VW/2/s,x1=cam.x+VW/2/s,z0=cam.z-VH/2/s,z1=cam.z+VH/2/s,vis=(a,b,c,d)=>a<x1&&b>x0&&c<z1&&d>z0,dry=1-wet*.8,D={s,dt,dry,vis}; // D : passé aux dessins du type (appel('dessin', étape, D))
  ctx.setTransform(DPR*s,0,0,DPR*s,DPR*(VW/2-cam.x*s),DPR*(VH/2-cam.z*s));
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle=TEX.grass;ctx.fillRect(x0,z0,x1-x0,z1-z0);
  ctx.fillStyle=TEX.sand;for(const p of LY.footA)ctx.fill(p); // zones piétonnes (sous les pelouses, eaux et bois cartographiés)
  ctx.fillStyle=TEX.lawn;for(const p of LY.lawn)ctx.fill(p);
  ctx.fillStyle=TEX.wood;for(const f of LY.forest)ctx.fill(f.p);
  ctx.fillStyle=TEX.dirt;for(const p of LY.dirt)ctx.fill(p);
  ctx.fillStyle=TEX.asph;for(const p of LY.asph)ctx.fill(p);
  ctx.strokeStyle='#b8ad8c';lw(1.6,1);ctx.fillStyle=TEX.water;for(const p of LY.water){ctx.stroke(p);ctx.fill(p);}
  ctx.strokeStyle=TEX.water;ctx.lineWidth=5;for(const p of LY.canal)ctx.stroke(p);
  ctx.fillStyle='#9a7b55';for(const p of LY.pier)ctx.fill(p);
  drawExc(); // tranchées OSM : ouvertes dans le sol (eau, pelouses), sous la voie et les chemins
  appel('dessin','sol',D); // sol propre au type (terre battue sous une charpente en bois…)
  ctx.strokeStyle='#6f7176';ctx.lineWidth=5.2;for(const p of LY.road)ctx.stroke(p);ctx.strokeStyle=TEX.asph;ctx.lineWidth=4.4;for(const p of LY.road)ctx.stroke(p);
  // bordures des allées et de la file : seulement hors des zones piétonnes (propriétaire, lot 4 : pas de trait noir à la jonction allée / zone piétonne)
  const pedClip=()=>{if(PEDOUT){ctx.save();ctx.clip(PEDOUT,'evenodd');return true;}return false;};
  {const k=pedClip();ctx.strokeStyle='#a89a78';ctx.lineWidth=3.8;for(const p of LY.foot)ctx.stroke(p);if(k)ctx.restore();}ctx.strokeStyle=TEX.sand;ctx.lineWidth=FOOT_W;for(const p of LY.foot)ctx.stroke(p);
  ctx.strokeStyle='#2f5a2c';ctx.lineWidth=1.3;for(const p of LY.hedge)ctx.stroke(p);
  // file d'attente (allée réelle, barrières des deux côtés)
  ctx.lineCap='round';{const k=pedClip();ctx.strokeStyle=LK.rail.edge;for(const [w,P] of QWP){ctx.lineWidth=w+LK.rail.ew;ctx.stroke(P);}if(k)ctx.restore();}for(const [w,P,id] of QWP){ctx.strokeStyle=LK.qw[id]||LK.q;ctx.lineWidth=w;ctx.stroke(P);} // largeur adaptée (QWP), sol du chemin OSM (GAME.look.ways) sinon sol des allées
  if(QRAILP.length)railDraw(QRAIL,QRAILP,1.2,1); // barrières entre allées collées : ombre, main courante, poteaux (matériau GAME.look.rail, issue #45)
  drawQSide(QSIDE,QSIDEP); // barrières de délimitation de la file (zones piétonnes)
  if(LK.rail===RAILM.metal)drawQSide(QSIDE0,QSIDEP0); // métal : même garde-corps sur tout le reste de la file (propriétaire 23/11, issue #45) ; bois et pierre : bordure seule
  // barrières de la file : vantail métallique pivotant sur un poteau en bordure de chemin
  ctx.lineCap='butt';
  drawSteps(false);drawMouths(false);
  // ombres portées
  if(dry>.25){
    ctx.fillStyle=`rgba(12,28,14,${.3*dry})`;
    for(const t of trees)if(vis(t.x-t.r,t.x+t.r*3,t.z-t.r,t.z+t.r*3)){ctx.beginPath();ctx.ellipse(t.x+t.r*1.25,t.z+t.r*.95,t.r*1.05,t.r*.9,.6,0,7);ctx.fill();}
    for(const b of LY.bld){ctx.save();ctx.translate(b.h*SHX,b.h*SHZ);ctx.globalAlpha=bldA(b);ctx.fill(b.p);ctx.restore();}
    for(const r of ROCKS){ctx.save();ctx.translate(r.h*SHX*.6,r.h*SHZ*.6);ctx.globalAlpha=r.cov?.2+.8*hideA:1;ctx.fill(r.pa);ctx.restore();} // ombre du rocher (relief arrondi : ombre plus courte)
    for(const b of BRIDGES){ctx.save();ctx.translate(b.h*SHX,b.h*SHZ);ctx.strokeStyle=`rgba(12,28,14,${.3*dry})`;ctx.lineWidth=b.w;ctx.stroke(b.deck);ctx.restore();}
    ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;
    appel('dessin','ombres',D); // ombres de la voie, des trains, des passerelles (couche du type)
    if(SITE.draw&&SITE.draw.shadows)SITE.draw.shadows(ctx,dry,API);
  }
  // sol de la gare, voie de garage
  appel('dessin','gare',D);drawLands(s);drawSteps(true);drawMouths(true);drawQSide(QSIDE2,QSIDEP2);drawBooth(s);appel('dessin','portillons',D); // garage, sol de la gare, portillons : couche du type
  if(COVD.some(c=>covH(c)<.97)){ctx.save(); // couloir couvert (sous la gare, souterrain, sous un rocher) : vu SEULEMENT quand la gare est masquée (sous un simple toit effaçable : dès que le toit s'efface, c.rf)
    ctx.lineCap='butt';for(const c of COVD){if(c.stp)continue;ctx.globalAlpha=1-covH(c);ctx.strokeStyle=c.q?LK.rail.edge:'#2b2824';ctx.lineWidth=c.w+.3;ctx.stroke(c.p);} // murs : côtés seulement (bouts droits)
    for(const c of COVD){if(c.stp)continue;ctx.globalAlpha=1-covH(c);ctx.strokeStyle=c.q?LK.q:TEX.sand;ctx.lineWidth=c.w;ctx.stroke(c.p); // sol : même teinte que le chemin extérieur
      ctx.strokeStyle='rgba(20,18,14,.07)';for(const t of c.tr)ctx.stroke(t);} // ombre du couvert, progressive depuis chaque bout
    ctx.globalAlpha=1-hideA;
    if(QUGP.length)railDraw(QUG,QUGP,1,0); // garde-corps des allées souterraines (lot 22) : gare masquée seulement
    ctx.lineCap='round';
    for(const q of COVL){const g=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],1.3);g.addColorStop(0,'rgba(255,232,170,.42)');g.addColorStop(1,'rgba(255,232,170,0)');ctx.fillStyle=g;ctx.fillRect(q[0]-1.3,q[1]-1.3,2.6,2.6);} // éclairage discret (plafonniers)
    ctx.restore();}
  // personnages
  {for(const v of G.queue)if(!inCovQ(v)||inMouth(v.x,v.z))person(v.x,v.z,v.ci,v.ph,v.mv,0,v.hd); // fin d'escalier (MOUTHS) : visiteurs visibles // visiteurs d'un couloir couvert : seulement gare masquée
  for(const k of G.walkers)if(!vrai('surQuai',k)&&!inCov(k.x,k.z))person(k.x,k.z,k.ci,k.ph,true);}
  for(const p of strollers){p.d+=p.v*dt*G.speed;if(p.d>p.f.len||p.d<0){p.v=-p.v;p.d=clamp(p.d,0,p.f.len);}pathPos(p.f.P,p.f.C,p.d,p,p.side);if(p.x>x0-1&&p.x<x1+1&&p.z>z0-1&&p.z<z1+1)person(p.x,p.z,p.ci,p.ph,G.speed>0);}
  if(G.job){const p=JOBSITE[G.job.type];person(p[0],p[1],C_TECH,.5,true,'#fff3b0');person(p[0]+1.1,p[1]+.5,C_TECH,2,true,'#fff3b0');}
  // bâtiments survolés par la voie (ROOFB, issue #14) : sous la voie, ses poteaux posés sur le toit, les passerelles et les trains ; ombres de la voie, des trains et des passerelles sur le toit
  for(const b of LY.bld)if(b.un){drawBld(b,s);ctx.globalAlpha=1;
    if(dry>.25){ctx.save();ctx.clip(b.p);ctx.translate(-b.h*SHX,-b.h*SHZ);ctx.fillStyle=ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;
      appel('dessin','ombresSurToit',D);
      ctx.restore();}}
  // voie + trains, triés par hauteur
  const items=[];
  appel('objets',items,dt,vis); // voie, trains, tunnels, passerelles… (couche du type : {h, …}, dessinés par dessinObjet)
  for(const r of ROCKS)items.push({h:r.h,rock:r});for(const b of BRIDGES)items.push({h:b.h,br:b});
  items.sort((a,b)=>a.h-b.h);
  for(const o of items){
    if(o.rock){drawRock(o.rock);continue;}
    if(o.br){drawBridge(o.br);continue;}
    for(const e of EXTENSIONS)if(e.dessinObjet&&e.dessinObjet(o,s))break;
  }
  const pplLate=roofA<.5;if(!pplLate)appel('dessin','quai',D); // personnes du quai : au-dessus de la voie et des trains, sous le toit affiché
  // voies des attractions voisines
  if(otherP.length){ctx.strokeStyle='#3d4148';ctx.lineWidth=1.5;for(const p of otherP)ctx.stroke(p);ctx.strokeStyle='#9299a3';ctx.lineWidth=.8;for(const p of otherP)ctx.stroke(p);}
  // arbres
  {const vt=trees.filter(t=>vis(t.x-t.r*1.3,t.x+t.r*1.3,t.z-t.r*1.3,t.z+t.r*1.3)),lobes=(k,off)=>{ctx.beginPath();for(const t of vt)for(const l of t.l){const r=l[2]*t.r*k,x=t.x+l[0]*t.r+off*l[2]*t.r,z=t.z+l[1]*t.r+off*l[2]*t.r;ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,7);}ctx.fill();};
    ctx.fillStyle=TEX.canopy;lobes(1,0);ctx.fillStyle='rgba(8,22,10,.3)';lobes(.62,.3);ctx.fillStyle='rgba(120,140,84,.3)';lobes(.6,-.32);
    if(s>5){ctx.fillStyle='rgba(160,176,110,.2)';lobes(.26,-.45);}}
  // barrières de la file (dessinées au-dessus des arbres : elles se cliquent sur la carte)
  for(const g of BARS)leaf(g,g.t);ctx.lineCap='butt'; // barrières indépendantes (issue #37) : t = 1 fermée (A), 0 ouverte (B)
  // toitures (la gare et le garage s'effacent en zoomant)
  roofA=lerp(roofA,G.roofOff||G.hideSt?0:s>9.5?.08:1,Math.min(1,dt*5));if(roofA<.004)roofA=0;
  for(const b of LY.bld)if(!b.un)drawBld(b,s); // bâtiments survolés par la voie (b.un, ROOFB) : déjà dessinés sous la voie
  ctx.globalAlpha=1;
  // Files couvertes, gare affichée (propriétaire, lot 6) : repère très discret de leur tracé, pointillé fin et clair à faible contraste, par-dessus toits et rochers
  if(COVD.some(c=>c.q&&!c.ug&&covH(c)>.03)){const d=Math.max(.45,4/cam.s);ctx.save();ctx.lineCap='butt';lw(.14,1.2);ctx.setLineDash([d,d]); // tirets clairs puis sombres en alternance : lisible, à peine, sur toit sombre comme sur quai clair
    for(const [c,a,o] of [['#efe8d6',.45,0],['#4a463e',.35,d]]){ctx.strokeStyle=c;ctx.lineDashOffset=o;for(const q of COVD)if(q.q&&!q.ug){ctx.globalAlpha=a*covH(q);ctx.stroke(q.p);}}
    ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.restore();}
  if(roofA<.6&&SITE.draw&&SITE.draw.underRoof)SITE.draw.underRoof(ctx,roofA,API); // charpente visible sous le toit effacé
  if(pplLate)appel('dessin','quai',D); // toit effacé : personnes du quai au-dessus du toit, de la charpente et des colonnes
  const al=vrai('alarme'); // gyrophare de la salle de contrôle : défaut signalé par le typectx.fillStyle=al?(Math.sin(clock*9)>0?'#ff2a2a':'#7a0000'):'#3f9a66';const bc=beaconAt();if(bc){ctx.beginPath();ctx.arc(bc[0],bc[1],.2,0,7);ctx.fill();}
  if(SITE.draw&&SITE.draw.landmarks){SITE.draw.landmarks(ctx,s,API);for(const g of BARS)leaf(g,g.t);ctx.lineCap='butt';}
  for(const g of BARS)if(g.evHi&&!g.off){const k=.55+.45*Math.sin(clock*6),cx=(g.h[0]+g.a[0])/2,cz=(g.h[1]+g.a[1])/2; // barrière fermée qui bloque une évacuation (issue #41, evacTick) : halo rouge pulsé jusqu'à son ouverture
    ctx.beginPath();ctx.arc(cx,cz,g.w/2+.9,0,7);ctx.fillStyle=`rgba(220,60,40,${.16*k})`;ctx.fill();ctx.strokeStyle=`rgba(235,70,45,${.55+.4*k})`;lw(.22,2);ctx.stroke();} // barrières redessinées au-dessus d'un monument qui enjambe l'entrée (statue de Zeus, issue #10) : elle se clique sur la carte
  if(bolt&&G.flash>.3){const g=ctx.createRadialGradient(bolt.x,bolt.z,0,bolt.x,bolt.z,30);g.addColorStop(0,`rgba(255,255,220,${G.flash})`);g.addColorStop(1,'rgba(255,255,220,0)');ctx.fillStyle=g;ctx.fillRect(bolt.x-30,bolt.z-30,60,60);
    ctx.strokeStyle=`rgba(255,250,200,${G.flash})`;lw(.5,1.5);ctx.beginPath();for(const b of bolt.br)b.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}
}
const LABELS=typeof SITE.labels==='function'?SITE.labels({tunnel:tunnelC}):SITE.labels;
function drawOverlay(dt){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const s=cam.s,X=x=>(x-cam.x)*s+VW/2,Z=z=>(z-cam.z)*s+VH/2,w=G.wx.type;
  if(wet>.02){ctx.fillStyle=`rgba(18,26,44,${.42*wet})`;ctx.fillRect(0,0,VW,VH);}
  const vg=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.45,VW/2,VH/2,Math.hypot(VW,VH)*.62);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(8,14,10,.34)');ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  ctx.fillStyle='rgba(255,236,190,.045)';ctx.fillRect(0,0,VW,VH);
  ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(10,16,28,.75)';
  ctx.font='italic 11px system-ui,sans-serif';ctx.fillStyle='#dfe8d2';
  if(s<9)for(const [t,x,z] of PLACES){ctx.strokeText(t,X(x),Z(z));ctx.fillText(t,X(x),Z(z));}
  ctx.font='600 12px system-ui,sans-serif';ctx.fillStyle='#fff';
  const bq=boothLabelAt();if(bq&&s>9&&s<26){ctx.strokeText('Poste de conduite',X(bq[0]),Z(bq[1]));ctx.fillText('Poste de conduite',X(bq[0]),Z(bq[1]));}
  if(s<16)for(const [t,x,z] of LABELS){ctx.strokeText(t,X(x),Z(z));ctx.fillText(t,X(x),Z(z));}
  ctx.font=Math.round(clamp(s*1.3,14,24))+'px serif';
  for(let i=emos.length-1;i>=0;i--){const e=emos[i];e.life-=dt*Math.max(1,G.speed);if(e.life<=0){emos.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,e.life);ctx.fillText(e.ch,X(e.x),Z(e.z)-10-(2.2-e.life)*10);}
  ctx.globalAlpha=1;
  if(w==='rain'||w==='storm'){ctx.strokeStyle='rgba(215,228,255,.45)';ctx.lineWidth=1;ctx.beginPath();const n=w==='storm'?320:170,ph=clock*900;
    for(let i=0;i<n;i++){const x=(i*127.3+ph*.3)%VW,y=(i*71.9+ph)%VH;ctx.moveTo(x,y);ctx.lineTo(x-3,y+11);}ctx.stroke();}
  if(G.flash>0){ctx.fillStyle=`rgba(255,255,235,${.4*G.flash})`;ctx.fillRect(0,0,VW,VH);}
  appel('dessinEcran'); // panneaux du type par-dessus la carte (synoptique…)
  ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillText('Fond de carte © contributeurs OpenStreetMap',VW-8,VH-8);
}
function render(dt){
  clock+=dt;const w=G.wx.type;wet=lerp(wet,w==='storm'?1:w==='warn'?.55:w==='rain'?.45:0,Math.min(1,dt*.8));
  if(cam.follow>=0){const p=fournit('suivi',null,cam.follow),k=Math.min(1,dt*5);if(p){cam.x=lerp(cam.x,p.x,k);cam.z=lerp(cam.z,p.z,k);}cam.s=lerp(cam.s,cam.g.s,Math.min(1,dt*3));} // caméra qui suit un véhicule (couche du type)
  else if(cam.g){const k=Math.min(1,dt*4);cam.x=lerp(cam.x,cam.g.x,k);cam.z=lerp(cam.z,cam.g.z,k);cam.s=lerp(cam.s,cam.g.s,k);}
  drawWorld(dt);drawOverlay(dt);
  sfx.update(dt,Object.assign({rumble:0,wind:0,lift:null},...appel('sons'),{rain:w==='storm'?.16:w==='rain'?.09:0,crowd:Math.min(.07,.012+G.queue.length/3000)})); // grondement, vent, chaîne : couche du type
}
