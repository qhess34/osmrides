'use strict';
/* ══════════ RENDU 2D — VUE AÉRIENNE SUR FOND RÉEL (OpenStreetMap) ══════════ */
const wrap=$('view'),cv=document.createElement('canvas'),ctx=cv.getContext('2d');wrap.prepend(cv);
let VW=1,VH=1,DPR=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);VW=wrap.clientWidth||1;VH=wrap.clientHeight||1;cv.width=VW*DPR;cv.height=VH*DPR;cv.style.width=VW+'px';cv.style.height=VH+'px';}
addEventListener('resize',resize);resize();
const VIEW=SITE.view,fitS=()=>Math.min(VW/VIEW.w,VH/VIEW.h);
const CAMS=Object.assign({vue:{label:'Vue d\'ensemble',x:VIEW.x,z:VIEW.z,s:0}},SITE.cams);
const cam={key:'vue',x:VIEW.x,z:VIEW.z,s:fitS(),g:null,follow:-1};
function setCam(k){cam.key=k;if(k.startsWith('suivi')){cam.follow=+k.slice(5);cam.g={s:12};}else{cam.follow=-1;const c=CAMS[k];cam.g={x:c.x,z:c.z,s:c.s||fitS()};}}
$('cams').innerHTML=Object.entries(CAMS).map(([k,c])=>`<button data-act="cam" data-arg="${k}">${c.label}</button>`).join('')
  +trains.map(t=>`<button data-act="cam" data-arg="suivi${t.i}">Suivre T${t.i+1}</button>`).join('')
  +'<button data-act="roof" id="bRoof" title="Retirer ou remettre les toits de la gare, du poste de conduite et du garage">Toits en place</button>';
(function controls(){
  const ptrs=new Map();let pinch=0,moved=0;const free=()=>{cam.g=null;cam.follow=-1;cam.key='';};
  const gateAt=e=>{const r=cv.getBoundingClientRect(),wx=cam.x+(e.clientX-r.left-VW/2)/cam.s,wz=cam.z+(e.clientY-r.top-VH/2)/cam.s;let best=-1,bd=Math.max(2.2,14/cam.s);
    LOOPS.forEach((l,i)=>{const g=l.g;for(const q of [g.h,[(g.h[0]+g.a[0])/2,(g.h[1]+g.a[1])/2],[(g.h[0]+g.b[0])/2,(g.h[1]+g.b[1])/2]]){const d=Math.hypot(q[0]-wx,q[1]-wz);if(d<bd){bd=d;best=i;}}});
    {const g=ENTRY_GATE,d=Math.min(Math.hypot(g.h[0]-wx,g.h[1]-wz),Math.hypot((g.h[0]+g.a[0])/2-wx,(g.h[1]+g.a[1])/2-wz),Math.hypot((g.h[0]+g.b[0])/2-wx,(g.h[1]+g.b[1])/2-wz));if(d<bd)best=-2;}
    return best;};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=0;});
  const up=e=>{if(ptrs.has(e.pointerId)&&e.type==='pointerup'&&moved<6&&ptrs.size===1){const i=gateAt(e);if(i>=0)act('loop',i);else if(i===-2)act('open');}ptrs.delete(e.pointerId);pinch=0;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p){cv.style.cursor=gateAt(e)!==-1?'pointer':'grab';return;}
    const dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);if(moved<6)return;free();
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)cam.s=clamp(cam.s*d/pinch,1.6,45);pinch=d;return;}
    cam.x=clamp(cam.x-dx/cam.s,VIEW.bounds[0],VIEW.bounds[1]);cam.z=clamp(cam.z-dy/cam.s,VIEW.bounds[2],VIEW.bounds[3]);});
  cv.addEventListener('wheel',e=>{e.preventDefault();free();const r=cv.getBoundingClientRect(),mx=e.clientX-r.left-VW/2,mz=e.clientY-r.top-VH/2;
    const wx=cam.x+mx/cam.s,wz=cam.z+mz/cam.s;cam.s=clamp(cam.s*Math.exp(-e.deltaY*.0014),1.6,45);cam.x=wx-mx/cam.s;cam.z=wz-mz/cam.s;},{passive:false});
})();

// Textures procédurales
function texture(n,base,spread,blobs){
  const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');
  x.fillStyle=`rgb(${base})`;x.fillRect(0,0,n,n);
  for(const [col,cnt,r0,r1] of blobs)for(let i=0;i<cnt;i++){const px=rnd(0,n),pz=rnd(0,n),r=rnd(r0,r1);x.fillStyle=col;
    for(const ox of [-n,0,n])for(const oz of [-n,0,n]){x.beginPath();x.ellipse(px+ox,pz+oz,r,r*rnd(.5,1),rnd(0,3),0,7);x.fill();}}
  const d=x.getImageData(0,0,n,n),a=d.data;for(let i=0;i<a.length;i+=4){const k=rnd(-spread,spread);a[i]+=k;a[i+1]+=k;a[i+2]+=k*.6;}
  x.putImageData(d,0,0);const p=ctx.createPattern(c,'repeat');p.setTransform(new DOMMatrix().scale(.25));return p;
}
const TEX={
  grass:texture(512,'88,112,68',12,[['rgba(62,90,50,.24)',90,10,46],['rgba(118,134,84,.2)',70,8,34],['rgba(140,128,88,.14)',30,6,22]]),
  lawn:texture(256,'104,128,78',9,[['rgba(124,146,90,.25)',40,6,22]]),
  canopy:texture(256,'44,70,42',16,[['rgba(22,44,26,.45)',90,3,12],['rgba(78,104,58,.4)',70,3,10]]),
  wood:texture(256,'48,68,44',14,[['rgba(28,48,30,.35)',70,5,20],['rgba(66,88,54,.3)',50,4,16]]),
  sand:texture(256,'204,190,160',8,[['rgba(170,154,124,.2)',50,4,18],['rgba(228,218,194,.25)',50,4,16]]),
  dirt:texture(256,'150,126,92',12,[['rgba(110,92,66,.25)',60,4,20],['rgba(176,154,118,.25)',40,4,16]]),
  asph:texture(256,'128,130,134',7,[['rgba(100,102,108,.25)',50,4,16]]),
  stone:texture(256,'196,192,182',7,[['rgba(160,156,146,.25)',50,3,12]]),
  water:texture(256,'62,104,126',6,[['rgba(84,130,150,.3)',50,6,24],['rgba(44,82,104,.3)',40,6,22]])};
TEX.rows=(()=>{const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,2,1);const p=ctx.createPattern(c,'repeat');p.setTransform(new DOMMatrix().scale(.25));return p;})();
const SHX=.55,SHZ=.42;

// Voie découpée en tronçons triés par hauteur (croisements dessus/dessous)
const chunkH=new Float32Array(N+1),chunks=[],dirtP=new Path2D,chainP=new Path2D,finsP=new Path2D,wid=h=>BOB?1.5:h>ST_Y+.6?1.6+h*.2:1.85,DECKW=BOB?2.3:3.1;
function strip(sm){
  const o={h:0,sw:0,deck:new Path2D,rail:new Path2D,hand:new Path2D,ties:new Path2D,str:new Path2D,sh:new Path2D,shb:new Path2D,x0:1e9,x1:-1e9,z0:1e9,z1:-1e9},n=sm.length;
  const side=(path,off,fn)=>sm.forEach((q,i)=>{const k=fn?fn(q.y)*off:off,x=q.x+q.nx*k,z=q.z+q.nz*k;i?path.lineTo(x,z):path.moveTo(x,z);});
  let hs=0;
  sm.forEach((q,i)=>{
    const sx=q.x+q.y*SHX,sz=q.z+q.y*SHZ;hs+=q.y;
    o.x0=Math.min(o.x0,q.x-9);o.x1=Math.max(o.x1,sx+9);o.z0=Math.min(o.z0,q.z-9);o.z1=Math.max(o.z1,sz+9);
    if(i){o.deck.lineTo(q.x,q.z);o.sh.lineTo(sx,sz);}else{o.deck.moveTo(q.x,q.z);o.sh.moveTo(sx,sz);}
    if(!BOB&&q.i%2===1){o.ties.moveTo(q.x-q.nx*.9,q.z-q.nz*.9);o.ties.lineTo(q.x+q.nx*.9,q.z+q.nz*.9);}
    if(i<n-1&&q.i%(BOB?12:6)===0){const w=wid(q.y);o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      if(!BOB&&q.y>7.5&&i+6<n){const b=sm[i+6],w2=wid(b.y),e=(q.i/6)%2?1:-1;o.str.moveTo(q.x-q.nx*w*e,q.z-q.nz*w*e);o.str.lineTo(b.x+b.nx*w2*e,b.z+b.nz*w2*e);}
      for(const sg of (BOB?[0]:[-1.25,1.25])){const bx=q.x+q.nx*sg,bz=q.z+q.nz*sg;o.shb.moveTo(bx,bz);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
  });
  if(BOB){side(o.rail,-1.02);side(o.rail,1.02);} // bords de la gouttière
  else{side(o.rail,-.6);side(o.rail,.6);side(o.hand,-1.5);side(o.hand,1.5);side(o.str,-1,wid);side(o.str,1,wid);}
  o.h=hs/n;const k=clamp(o.h/30,0,1);o.col=BOB?`rgb(${lerp(150,198,k)|0},${lerp(156,204,k)|0},${lerp(164,210,k)|0})`:`rgb(${lerp(172,198,k)|0},${lerp(146,170,k)|0},${lerp(104,124,k)|0})`;
  return o;
}
(function buildChunks(){
  for(let i=0;i<=N;i++){const p=TR[i%N].p;i?dirtP.lineTo(p.x,p.z):dirtP.moveTo(p.x,p.z);}
  const iA=Math.round(SW_A/DS),iB=Math.round(SW_B/DS),cuts=new Set([iA,iB,N]);for(let i=0;i<N;i+=8)cuts.add(i);
  const cl=[...cuts].sort((a,b)=>a-b);
  for(let c=0;c<cl.length-1;c++){const sm=[];
    for(let i=cl[c];i<=cl[c+1];i++){const f=TR[i%N],l=Math.hypot(f.R.x,f.R.z)||1;sm.push({x:f.p.x,y:f.p.y,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,i});}
    const o=strip(sm);o.sw=cl[c]>=iA&&cl[c+1]<=iB?1:0;chunks.push(o);
    if(!o.sw&&cl[c+1]!==iA){const a=TR[cl[c+1]%N].p,f=TR[(cl[c+1]+1)%N].p;o.deck.lineTo((a.x+f.x)/2,(a.z+f.z)/2);}
    for(let i=cl[c];i<cl[c+1];i++)chunkH[i]=o.h;}
  // tronçon en S (mobile) et voie de garage
  const grow=o=>{const e=CMAX+GAP+3;o.x0-=e;o.x1+=e;o.z0-=e;o.z1+=e;return o;}; // tronçons portés : visibles sur toute la course
  if(TRAV){ // pont droit : rail B porté par le chariot (décalé de devC()-GAP), voies droites fixes ; le rail A est le tronçon du circuit (sw)
    chunks.forEach(o=>{if(o.sw)grow(o);});
    const line=(u0,u1,v)=>{const q=[];for(let u=u0;u<=u1+.01;u+=.5)q.push({x:SW0.x+SW0.tx*u-SW0.vx*v,y:ST_Y,z:SW0.z+SW0.tz*u-SW0.vz*v,nx:-SW0.tz,nz:SW0.tx,i:q.length});return q;};
    const rb=strip(line(0,R1-R0,0));rb.rb=1;chunks.push(grow(rb));
    LANES.forEach(ln=>chunks.push(strip(line(U_LANE,ln.end,ln.d))));
  }else LANES.forEach((ln,j)=>{const GP=ln.path,gs=GP.map((q,i)=>{const a=GP[Math.max(0,i-1)],b=GP[Math.min(GP.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:q.x,y:ST_Y,z:q.z,nx:-(b.z-a.z)/l,nz:(b.x-a.x)/l,i};});
    const sP=strip(gs.slice(0,37));sP.lk=j+1;chunks.push(sP,strip(gs.slice(36)));});
  for(let i=Math.round(S_LIFT0/DS);i<=Math.round((S_LIFT1+3)/DS);i++){const p=TR[i].p;chainP.lineTo(p.x,p.z);}
  const finsR=[[S_BRK+3,TRAV?R0:S_HOLD]].concat(BLK.map(b=>[b-9,b])); // frein final et freins de bloc (≈ 9 m de patins avant chaque point d'arrêt, estimé)
  for(const [r0,r1] of finsR)for(let i=Math.round(r0/DS);i<Math.round(r1/DS);i+=3){const f=TR[i],l=Math.hypot(f.R.x,f.R.z)||1,nx=f.R.x/l,nz=f.R.z/l;finsP.moveTo(f.p.x-nx*.28,f.p.z-nz*.28);finsP.lineTo(f.p.x+nx*.28,f.p.z+nz*.28);}
})();
const swz=o=>o.sw===1?devC():o.rb?devC()-GAP:o.lk?devC()-OFF[o.lk]:0; // déplacement des tronçons portés par le chariot (circuit, transfert vers la voie lk), le long de (SW0.vx, SW0.vz)
const devHide=o=>o.lk&&YD.device==='table'&&o.lk!==devShown(); // pont transbordeur : un seul tronçon de transfert, celui de la voie visée

// Décor réel : bâtiments, allées, plans d'eau, bois
const mkPath=(pts,close)=>{const p=new Path2D;pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath();return p;};
const cen=pts=>{let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return [x/pts.length,z/pts.length];};
const LY={water:[],canal:[],lawn:[],forest:[],dirt:[],asph:[],foot:[],footA:[],road:[],hedge:[],bld:[],pier:[]},trees=[],FOOT=[],PLACES=[],otherP=(OSM.others||[]).map(p=>mkPath(p));
let tunnelP=null,tunnelC=[5,98];
(function scenery(){
  const ROOFS=['#a9553f','#b0694a','#9d6350','#8a8f96','#b9ab93','#7f8a8f','#a35f47'],seen=new Set();
  const stroll=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));if(C[C.length-1]>45)FOOT.push({P:pts,C,len:C[C.length-1]});};
  const addBld=(pts,o)=>{const m=cen(pts),lit=new Path2D,dark=new Path2D;let ar=0;
    for(let j=0;j<pts.length-1;j++)ar+=pts[j][0]*pts[j+1][1]-pts[j+1][0]*pts[j][1];
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],sg=ar>0?1:-1,nx=(b[1]-a[1])*sg,nz=-(b[0]-a[0])*sg,pp=nx*-.8+nz*-.6>0?lit:dark;pp.moveTo(a[0],a[1]);pp.lineTo(b[0],b[1]);}
    const near=q=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2];
    LY.bld.push(Object.assign({p:mkPath(pts,true),m,lit,dark,st:near(SITE.stationAt),h:7,canopy:false,fade:(SITE.fade||[]).some(near)},o));};
  OSM.feats.forEach((f,i)=>{
    const k=f.k,c=f.c&&f.p.length>3,p=mkPath(f.p,c);
    if(f.n&&!seen.has(f.n)&&!(SITE.hideNames||[]).includes(f.n)&&!k.startsWith('highway')){seen.add(f.n);const m=cen(f.p);PLACES.push([f.n.replace(/ \(\d+\)/,''),m[0],m[1]]);}
    if(k==='natural=water'||k==='landuse=reservoir'){if(c)LY.water.push(p);}
    else if(k.startsWith('waterway'))(c?LY.water:LY.canal).push(p);
    else if(k==='landuse=grass'||k==='landuse=meadow'){if(c)LY.lawn.push(p);}
    else if(k==='landuse=forest'||k==='natural=wood'||k==='natural=scrub'){if(c)LY.forest.push({p,pts:f.p});}
    else if(k==='landuse=construction'||k==='natural=bare_rock'){if(c)LY.dirt.push(p);}
    else if(k==='amenity=parking'){if(c)LY.asph.push(p);}
    else if(k==='man_made=pier')LY.pier.push(p);
    else if(k==='highway=footway'||k==='highway=pedestrian'||k==='highway=steps'){
      if(k==='highway=pedestrian'&&c)LY.footA.push(p);else LY.foot.push(p);
      if(k==='highway=footway'&&!c&&!(SITE.noStroll||[]).some(q=>Math.hypot(f.p[0][0]-q[0],f.p[0][1]-q[1])<1.5))stroll(f.p);}
    else if(k==='highway=service'||k==='highway=unclassified'||k==='highway=track')LY.road.push(p);
    else if(k==='barrier=hedge'||k==='natural=tree_row')LY.hedge.push(p);
    else if(k==='man_made=tunnel'){tunnelP=p;tunnelC=cen(f.p);}
    else if(k.startsWith('building'))addBld(f.p,{col:ROOFS[i%ROOFS.length],h:k==='building=roof'?4:k==='building=hotel'?12:7,canopy:k==='building=roof'});
  });
  for(const p of SITE.paths||[]){LY.foot.push(mkPath(p));stroll(p);}          // allées ajoutées par la configuration
  for(const b of SITE.buildings||[])addBld(b.p,Object.assign({col:'#8a8f96'},b)); // bâtiments ajoutés par la configuration
  // arbres : dans les bois cartographiés + arbres isolés relevés
  ctx.setTransform(1,0,0,1,0,0);
  const col=()=>({c:`rgb(${rnd(34,56)|0},${rnd(80,110)|0},${rnd(36,56)|0})`,c2:`rgba(${rnd(88,124)|0},${rnd(142,170)|0},${rnd(64,92)|0},.8)`,l:[0,1,2,3,4].map(i=>i?[rnd(-.5,.5),rnd(-.5,.5),rnd(.48,.72)]:[0,0,.8])});
  const nearTrack=(x,z,r)=>{for(let i=0;i<N;i+=6){const p=TR[i].p;if((p.x-x)**2+(p.z-z)**2<r*r)return true;}for(const ln of LANES)for(let i=0;i<ln.path.length;i+=4){const p=ln.path[i];if((p.x-x)**2+(p.z-z)**2<(r+1.5)**2)return true;}return Math.hypot(x-SW0.x-SW0.tx*4.5,z-SW0.z-SW0.tz*4.5)<10+r;};
  for(const f of LY.forest){
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of f.pts){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}
    x0=Math.max(x0,VIEW.bounds[0]-30);x1=Math.min(x1,VIEW.bounds[1]+30);z0=Math.max(z0,VIEW.bounds[2]-30);z1=Math.min(z1,VIEW.bounds[3]+30);
    const n=Math.min(900,(x1-x0)*(z1-z0)/30);
    for(let i=0;i<n;i++){const x=rnd(x0,x1),z=rnd(z0,z1),r=rnd(2.4,4.8);
      if(!ctx.isPointInPath(f.p,x,z)||nearTrack(x,z,r+4.5)||LY.bld.some(b=>ctx.isPointInPath(b.p,x,z)))continue;
      trees.push(Object.assign({x,z,r},col()));}
  }
  for(const q of OSM.trees)if(!nearTrack(q[0],q[1],6))trees.push(Object.assign({x:q[0],z:q[1],r:rnd(3,4.5)},col()));
  trees.sort((a,b)=>a.r-b.r);
})();
const stationP=mkPath(SITE.stationPoly,true),queueAllP=new Path2D;
for(const sg of SEGS)sg.P.forEach((p,i)=>i?queueAllP.lineTo(p[0],p[1]):queueAllP.moveTo(p[0],p[1]));
(QS.link||[]).concat([ENTRY0]).forEach((p,i)=>i?queueAllP.lineTo(p[0],p[1]):queueAllP.moveTo(p[0],p[1])); // raccord entre l'allée du parc et l'entrée de la file
const JOBSITE=SITE.jobsites;
const HAIR=['#2a1d14','#4a3322','#6b4a2a','#c9a35a','#8a8a8a','#111','#a0522d'];
const emos=[];function emote(){}
let bolt=null;
function strike(){const K=SITE.strike||{},A=K.area||[VIEW.x-VIEW.w/2,VIEW.x+VIEW.w/2,VIEW.z-VIEW.h/2,VIEW.z+VIEW.h/2],hit=K.spot&&Math.random()<.35,x=hit?K.spot[0]:rnd(A[0],A[1]),z=hit?K.spot[1]:rnd(A[2],A[3]),br=[];
  for(let b=0;b<5;b++){let px=x,pz=z,a=rnd(0,6.28);const pts=[[px,pz]];for(let i=0;i<6;i++){a+=rnd(-.7,.7);px+=Math.cos(a)*rnd(3,8);pz+=Math.sin(a)*rnd(3,8);pts.push([px,pz]);}br.push(pts);}
  bolt={x,z,br};}
const strollers=[];
(function(){const tot=FOOT.reduce((a,f)=>a+f.len,0);for(const f of FOOT){const n=Math.round(90*f.len/tot);for(let i=0;i<n;i++)strollers.push({f,d:rnd(0,f.len),v:(Math.random()<.5?-1:1)*rnd(.9,1.6),side:rnd(-1.1,1.1),ci:Math.floor(Math.random()*12),ph:rnd(0,6),x:0,z:0});}})();
let clock=0,wet=0,roofA=1;
const lw=(w,minPx)=>{ctx.lineWidth=Math.max(w,(minPx||0)/cam.s);};
function person(x,z,ci,ph,mv,helmet){
  if(cam.s<4.2){ctx.fillStyle=PAL[ci];const k=Math.max(.45,1.2/cam.s);ctx.fillRect(x-k/2,z-k/2,k,k);return;}
  const a=ph+(mv?Math.sin(clock*7+ph)*.3:0);
  ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(x+.3,z+.24,.27,.19,a,0,7);ctx.fill();
  ctx.fillStyle=PAL[ci];ctx.beginPath();ctx.ellipse(x,z,.27,.17,a,0,7);ctx.fill();
  ctx.fillStyle=helmet||HAIR[(ph*7|0)%HAIR.length];ctx.beginPath();ctx.arc(x,z,.115,0,7);ctx.fill();
}
const _cf=mkF();
const CW=SITE.car.w||1.24,INL=!!SITE.car.inline;
function drawCar(t,k,shadow){
  carFrame(t,k,_cf);const p=_cf.p,a=Math.atan2(_cf.T.z,_cf.T.x),hl=CAR/2-.07,hw=CW/2;
  ctx.save();
  if(shadow){ctx.translate(p.x+(p.y+.6)*SHX,p.z+(p.y+.6)*SHZ);ctx.rotate(a);ctx.fillStyle='rgba(10,20,10,.3)';ctx.fillRect(-hl-.04,-hw-.04,2*hl+.08,CW+.08);ctx.restore();return;}
  ctx.translate(p.x,p.z);ctx.rotate(a);
  if(BOB){ // coque de bob : pas de roues apparentes, nez et queue arrondis
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.2,.46,.46,.2]:k===NCARS-1?[.42,.2,.2,.42]:.22);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.12,-hw,2*hl-.24,.07);ctx.fillRect(-hl+.12,hw-.07,2*hl-.24,.07);
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.2,-hw+.15,2*hl-.42,CW-.3,.14);ctx.fill();
  }else{
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.08,-hw-.2,.36,CW+.4);ctx.fillRect(hl-.44,-hw-.2,.36,CW+.4);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.18,.45,.45,.18]:.18);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl,-hw,2*hl,.11);ctx.fillRect(-hl,hw-.11,2*hl,.11);
    ctx.fillStyle='#17181c';ctx.fillRect(-hl+.26,-hw+.14,2*hl-.48,CW-.28);
    ctx.fillStyle='#3a3d46';ctx.fillRect(-hl+.14,-hw+.12,.18,CW-.24);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.22);ctx.lineTo(hl-.06,0);ctx.lineTo(hl-.3,.22);ctx.fill();}
  }
  if(cam.s>2.2)for(let sd=0;sd<CSEATS;sd++){const s=t.seats[k*CSEATS+sd];if(!s||!s.on)continue;
    const q=seatOff(sd),x=q[0]+(INL?0:-.06),y=q[1]*.91,up=((k*CSEATS+sd)%3!==1)?t.arms:0; // côte à côte, ou l'un derrière l'autre
    ctx.fillStyle=PAL[s.ci];ctx.beginPath();ctx.ellipse(x,y,.2,INL?.24:.26,0,0,7);ctx.fill();
    if(up>.3&&cam.s>7){ctx.strokeStyle='#e9c9a6';ctx.lineWidth=.09;ctx.beginPath();const d=.42*up;ctx.moveTo(x,y-.2);ctx.lineTo(x+d,y-.26);ctx.moveTo(x,y+.2);ctx.lineTo(x+d,y+.26);ctx.stroke();}
    ctx.fillStyle=HAIR[(k*5+sd*3+t.i)%HAIR.length];ctx.beginPath();ctx.arc(x,y,.14,0,7);ctx.fill();}
  ctx.restore();
}
const API={lw,person,TEX}; // outils passés aux fonctions de dessin propres à chaque attraction (SITE.draw)
function drawTraverser(){ // pont droit : fosse, chemins de roulement transversaux, voies du garage sur dalle, chariot (tablier acier, deux rails) décalé de devC()
  const Lr=R1-R0,dM=Math.max(...LANES.map(l=>l.d)),dm=Math.min(...LANES.map(l=>l.d)),vA=GAP+1.5,vB=-dM-1.6,c=devC();
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  ctx.fillStyle='#a9aaa6';ctx.fillRect(U_LANE-.4,vB,LANES[0].end-U_LANE+1.4,-dm+1.6-vB);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.35;ctx.fillRect(U_LANE-.4,vB,LANES[0].end-U_LANE+1.4,-dm+1.6-vB);ctx.globalAlpha=1; // dalle du garage
  ctx.fillStyle='#5d6062';ctx.fillRect(-.7,vB,Lr+1.4,vA-vB);ctx.fillStyle='rgba(30,32,36,.35)';ctx.fillRect(-.7,vB,Lr+1.4,.35);ctx.fillRect(-.7,vA-.35,Lr+1.4,.35); // fosse
  ctx.strokeStyle='#3a3c40';lw(.16,.7);ctx.beginPath();for(const u of [.6,Lr/2,Lr-.6]){ctx.moveTo(u,vB+.2);ctx.lineTo(u,vA-.2);}ctx.stroke(); // chemins de roulement
  ctx.strokeStyle='#2c2e33';lw(.3,.8);ctx.beginPath();for(const l of LANES){ctx.moveTo(l.end+.15,-l.d-.7);ctx.lineTo(l.end+.15,-l.d+.7);}ctx.stroke(); // heurtoirs
  ctx.fillStyle='rgba(20,22,26,.35)';ctx.fillRect(-.3+.35,c-GAP-1.25+.35,Lr+.6,GAP+2.5); // ombre portée du tablier
  ctx.fillStyle='#5c6168';ctx.strokeStyle=devMoving()&&Math.sin(clock*10)>0?'#d08a3a':'#b89a4a';lw(.12,.6);
  ctx.beginPath();ctx.rect(-.3,c-GAP-1.25,Lr+.6,GAP+2.5);ctx.fill();ctx.stroke(); // tablier
  ctx.strokeStyle='rgba(30,32,36,.55)';lw(.08,.4);ctx.beginPath();for(let u=1;u<Lr;u+=1.5){ctx.moveTo(u,c-GAP-1.2);ctx.lineTo(u,c+1.2);}ctx.stroke(); // traverses du tablier
  ctx.restore();
}
function drawTable(){ // pont transbordeur, dessiné dans son repère : u le long de la voie, v dans le sens du coulissement
  const len=YD.len||8.6,v0=-CMAX-4.4,v1=CMAX+2.2;
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  ctx.fillStyle='#8f9296';ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.55;ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.globalAlpha=1;
  ctx.strokeStyle='#2c2e33';lw(.22,.8);ctx.beginPath();for(const u of [.4,len/2+.05,len-.3]){ctx.moveTo(u,v0+.3);ctx.lineTo(u,v1-.3);}ctx.stroke();
  ctx.translate(0,devC());ctx.fillStyle='rgba(60,64,72,.93)';ctx.strokeStyle=devMoving()&&Math.sin(clock*10)>0?'#ff9f43':'#e8b93c';lw(.14,.7);
  ctx.beginPath();ctx.rect(-.5,-CMAX-4,len+.6,CMAX+5.4);ctx.fill();ctx.stroke();ctx.restore();
}
function drawStationFloor(s){
  const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat);
  const quad=(l0,l1)=>{ctx.beginPath();ctx.moveTo(a.x-a.tx*P.back+a.rx*l0,a.z-a.tz*P.back+a.rz*l0);ctx.lineTo(b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0);
    ctx.lineTo(b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1);ctx.lineTo(a.x-a.tx*P.back+a.rx*l1,a.z-a.tz*P.back+a.rz*l1);ctx.closePath();ctx.fill();};
  const floor=()=>{ctx.fill(stationP);quad(1.3,P.load);if(P.exit)quad(-1.3,-P.exit);}; // plancher : bâtiment de la gare + quais
  ctx.fillStyle='#b59c78';floor();
  if(s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha=.45;floor();ctx.globalAlpha=1;}
  const ln=(lat,e)=>{ctx.moveTo(a.x-a.tx*e+a.rx*lat,a.z-a.tz*e+a.rz*lat);ctx.lineTo(b.x+b.tx*e+b.rx*lat,b.z+b.tz*e+b.rz*lat);};
  ctx.strokeStyle='#34322f';ctx.lineWidth=BOB?2:2.5;ctx.beginPath();ln(0,1.6);ctx.stroke();
  ctx.strokeStyle='#e8b93c';lw(.2,.8);ctx.beginPath();ln(1.34,1);ln(-1.34,1);ctx.stroke();
  if(SITE.draw&&SITE.draw.floor)SITE.draw.floor(ctx,s,API);
}
function drawBooth(s){ // poste de conduite : SITE.booth=[x, z, angle], la vitre (côté +y local) tournée vers la voie
  const B=SITE.booth;ctx.save();ctx.translate(B[0],B[1]);ctx.rotate(B[2]);
  ctx.fillStyle='#3a434f';ctx.fillRect(-1.875,-.85,3.75,1.7);ctx.fillStyle='#8fd0e8';ctx.fillRect(-1.72,.62,3.45,.2);
  ctx.fillStyle='#20262e';ctx.fillRect(-1.37,.15,2.7,.42);
  if(s>6)[['#4cc38a',-.97],['#f2c14e',-.37],['#4f8cff',.23],['#e5484d',.88]].forEach(([c,x])=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,.36,.1,0,7);ctx.fill();});
  ctx.restore();
  if(s>6)person(B[0]+Math.sin(B[2])*.32,B[1]-Math.cos(B[2])*.32,3,1.2,false,'#1d2b4f');
}
function leaf(g,t){ // vantail métallique : pivot h en bordure, extrémité en a (t=1) ou en b (t=0)
  const ta=Math.atan2(g.a[1]-g.h[1],g.a[0]-g.h[0]),tb=Math.atan2(g.b[1]-g.h[1],g.b[0]-g.h[0]);let d=ta-tb;d=Math.atan2(Math.sin(d),Math.cos(d));
  const th=tb+d*t,len=lerp(Math.hypot(g.b[0]-g.h[0],g.b[1]-g.h[1]),Math.hypot(g.a[0]-g.h[0],g.a[1]-g.h[1]),t),ex=g.h[0]+Math.cos(th)*len,ez=g.h[1]+Math.sin(th)*len;
  ctx.strokeStyle='rgba(0,0,0,.28)';lw(.2,1);ctx.beginPath();ctx.moveTo(g.h[0]+.22,g.h[1]+.17);ctx.lineTo(ex+.22,ez+.17);ctx.stroke();
  ctx.strokeStyle='#4f555c';lw(.2,1.4);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.strokeStyle='#aeb5bd';lw(.07,.5);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.fillStyle='#23262b';for(const [q,r] of [[g.h,.2],[g.a,.13],[g.b,.13]])ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);
}
function drawGates(){
  ctx.strokeStyle='#4d525a';lw(.09,.6);ctx.beginPath();
  for(let k=0;k<=NCARS;k++){const b=BAYS[Math.min(k,NCARS-1)],e=k<NCARS?.5:-.5,cx=b.x+b.tx*CAR*e,cz=b.z+b.tz*CAR*e;ctx.moveTo(cx+b.rx*2.70,cz+b.rz*2.70);ctx.lineTo(cx+b.rx*4.9,cz+b.rz*4.9);}
  ctx.stroke();
  // un vantail par portillon, articulé sur le séparateur avant ; il pivote vers le train
  const a=G.gate*1.45,ca=Math.cos(a),sa=Math.sin(a),len=CAR-.3,hx=CAR/2-.12;
  ctx.strokeStyle=G.gate>.5?'#4f9a72':'#a8443a';lw(.13,.9);ctx.lineCap='round';ctx.beginPath();
  for(const b of BAYS){const px=b.x+b.tx*hx+b.rx*2.75,pz=b.z+b.tz*hx+b.rz*2.75;ctx.moveTo(px,pz);ctx.lineTo(px+(-b.tx*ca-b.rx*sa)*len,pz+(-b.tz*ca-b.rz*sa)*len);}
  ctx.stroke();ctx.lineCap='butt';
  ctx.fillStyle='#2b2e33';for(const b of BAYS){const px=b.x+b.tx*hx+b.rx*2.75,pz=b.z+b.tz*hx+b.rz*2.75;ctx.fillRect(px-.1,pz-.1,.2,.2);}
  G.plat.forEach((r,i)=>{if(r&&r.on){const p=slotPos(i);person(p[0],p[2],r.ci,r.ph,false);}});
  // postes de validation des lapbars et opérateurs de quai
  for(const o of OPS){const h=opHome(o.i),b=o.i?BAYS[NCARS-1]:BAYS[0],e=o.i?-1:1,qx=h[0]+b.tx*e*.7,qz=h[1]+b.tz*e*.7;
    ctx.fillStyle='#30353c';ctx.fillRect(qx-.28,qz-.28,.56,.56);
    ctx.fillStyle=o.ok?'#4fc27a':o.st==='idle'?'#59606a':'#d0a03a';ctx.beginPath();ctx.arc(qx,qz,.15,0,7);ctx.fill();
    person(o.x,o.z,3,o.i+.6,o.mv,'#1d2b4f');}
}
function drawWorld(dt){
  const s=cam.s,x0=cam.x-VW/2/s,x1=cam.x+VW/2/s,z0=cam.z-VH/2/s,z1=cam.z+VH/2/s,vis=(a,b,c,d)=>a<x1&&b>x0&&c<z1&&d>z0,dry=1-wet*.8;
  ctx.setTransform(DPR*s,0,0,DPR*s,DPR*(VW/2-cam.x*s),DPR*(VH/2-cam.z*s));
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle=TEX.grass;ctx.fillRect(x0,z0,x1-x0,z1-z0);
  ctx.fillStyle=TEX.lawn;for(const p of LY.lawn)ctx.fill(p);
  ctx.fillStyle=TEX.wood;for(const f of LY.forest)ctx.fill(f.p);
  ctx.fillStyle=TEX.dirt;for(const p of LY.dirt)ctx.fill(p);
  ctx.fillStyle=TEX.asph;for(const p of LY.asph)ctx.fill(p);
  ctx.strokeStyle='#b8ad8c';lw(1.6,1);ctx.fillStyle=TEX.water;for(const p of LY.water){ctx.stroke(p);ctx.fill(p);}
  ctx.strokeStyle=TEX.water;ctx.lineWidth=5;for(const p of LY.canal)ctx.stroke(p);
  ctx.fillStyle='#9a7b55';for(const p of LY.pier)ctx.fill(p);
  if(!BOB){ctx.strokeStyle=TEX.dirt;ctx.globalAlpha=.85;ctx.lineWidth=8.5;ctx.stroke(dirtP);ctx.globalAlpha=1;} // terre battue sous la charpente en bois
  ctx.strokeStyle='#6f7176';ctx.lineWidth=5.2;for(const p of LY.road)ctx.stroke(p);ctx.strokeStyle=TEX.asph;ctx.lineWidth=4.4;for(const p of LY.road)ctx.stroke(p);
  ctx.fillStyle=TEX.sand;for(const p of LY.footA)ctx.fill(p);
  ctx.strokeStyle='#a89a78';ctx.lineWidth=3.8;for(const p of LY.foot)ctx.stroke(p);ctx.strokeStyle=TEX.sand;ctx.lineWidth=3.2;for(const p of LY.foot)ctx.stroke(p);
  ctx.strokeStyle='#2f5a2c';ctx.lineWidth=1.3;for(const p of LY.hedge)ctx.stroke(p);
  // file d'attente (allée réelle, barrières des deux côtés)
  ctx.strokeStyle='#4a3a28';ctx.lineWidth=2.5;ctx.stroke(queueAllP);ctx.strokeStyle=TEX.stone;ctx.lineWidth=2.2;ctx.stroke(queueAllP);
  // barrières de la file : vantail métallique pivotant sur un poteau en bordure de chemin
  for(const l of LOOPS)leaf(l.g,l.t);
  leaf(ENTRY_GATE,ENTRY_GATE.t);
  ctx.lineCap='butt';
  // ombres portées
  if(dry>.25){
    ctx.fillStyle=`rgba(12,28,14,${.3*dry})`;
    for(const t of trees)if(vis(t.x-t.r,t.x+t.r*3,t.z-t.r,t.z+t.r*3)){ctx.beginPath();ctx.ellipse(t.x+t.r*1.25,t.z+t.r*.95,t.r*1.05,t.r*.9,.6,0,7);ctx.fill();}
    for(const b of LY.bld){ctx.save();ctx.translate(b.h*SHX,b.h*SHZ);if(b.fade)ctx.globalAlpha=roofA;ctx.fill(b.p);ctx.restore();}
    if(tunnelP){ctx.save();ctx.translate(2.2,1.7);ctx.fill(tunnelP);ctx.restore();}
    ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;
    for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o)){const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
    for(const t of trains)for(let k=0;k<NCARS;k++)drawCar(t,k,true);
    if(SITE.draw&&SITE.draw.shadows)SITE.draw.shadows(ctx,dry,API);
  }
  // sol de la gare, voie de garage
  (TRAV?drawTraverser:drawTable)();drawStationFloor(s);drawBooth(s);drawGates();
  // personnages
  for(const v of G.queue)person(v.x,v.z,v.ci,v.ph,v.mv);
  for(const k of G.walkers)person(k.x,k.z,k.ci,k.ph,true);
  for(const p of strollers){p.d+=p.v*dt*G.speed;if(p.d>p.f.len||p.d<0){p.v=-p.v;p.d=clamp(p.d,0,p.f.len);}pathPos(p.f.P,p.f.C,p.d,p,p.side);if(p.x>x0-1&&p.x<x1+1&&p.z>z0-1&&p.z<z1+1)person(p.x,p.z,p.ci,p.ph,G.speed>0);}
  if(G.job){const p=JOBSITE[G.job.type];person(p[0],p[1],C_TECH,.5,true,'#fff3b0');person(p[0]+1.1,p[1]+.5,C_TECH,2,true,'#fff3b0');}
  // voie + trains, triés par hauteur
  const items=[];
  for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o))items.push(o);
  for(const t of trains){const ex=t.st==='run'&&zoneOf(t.s)==='course'&&t.v>9;t.arms=lerp(t.arms,ex?1:0,Math.min(1,dt*4));
    for(let k=0;k<NCARS;k++){const sc=t.s-(k+.5)*CAR;items.push({h:(t.st==='run'?chunkH[Math.floor((((sc%L)+L)%L)/DS)%N]:ST_Y)+.02,t,k});}}
  items.sort((a,b)=>a.h-b.h);
  for(const o of items){
    if(o.t){drawCar(o.t,o.k);continue;}
    const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}
    if(BOB){ // gouttière en acier : bords sombres, fond clair, reflet au centre
      ctx.strokeStyle='#4a4f57';lw(.22,.7);ctx.stroke(o.str);
      ctx.strokeStyle='#565c65';ctx.lineWidth=DECKW;ctx.stroke(o.deck);ctx.strokeStyle=o.col;ctx.lineWidth=2;ctx.stroke(o.deck);
      ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.9;ctx.stroke(o.deck);
      ctx.strokeStyle='#2f3339';lw(.1,.5);ctx.stroke(o.rail);
    }else{
      ctx.strokeStyle='#6e6a63';lw(.16,.7);ctx.stroke(o.str);
      ctx.strokeStyle=o.col;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      if(s>2){ctx.strokeStyle='#5a4028';lw(.24,.5);ctx.stroke(o.ties);}
      ctx.strokeStyle='#e6cfa0';lw(.12,.5);ctx.stroke(o.hand);
      ctx.strokeStyle='#2b2b30';lw(.17,.9);ctx.stroke(o.rail);
    }
    if(k)ctx.restore();
  }
  ctx.strokeStyle='#15161a';lw(.2,.8);ctx.setLineDash([.5,.3]);ctx.stroke(chainP);ctx.setLineDash([]);
  ctx.strokeStyle=G.brakeFault&&Math.sin(clock*9)>0?'#ff5a4d':'#c2372f';lw(.3,.9);ctx.stroke(finsP);
  if(TRAV){ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);ctx.beginPath();const c=devC(); // patins des rails A et B du chariot (frein final, freins et pneus du rail de garage)
    for(const v of [c,c-GAP])for(let u=.5;u<R1-R0;u+=1.5){ctx.moveTo(u,v-.28);ctx.lineTo(u,v+.28);}ctx.stroke();ctx.restore();}
  // voies des attractions voisines
  if(otherP.length){ctx.strokeStyle='#3d4148';ctx.lineWidth=1.5;for(const p of otherP)ctx.stroke(p);ctx.strokeStyle='#9299a3';ctx.lineWidth=.8;for(const p of otherP)ctx.stroke(p);}
  // arbres
  {const vt=trees.filter(t=>vis(t.x-t.r*1.3,t.x+t.r*1.3,t.z-t.r*1.3,t.z+t.r*1.3)),lobes=(k,off)=>{ctx.beginPath();for(const t of vt)for(const l of t.l){const r=l[2]*t.r*k,x=t.x+l[0]*t.r+off*l[2]*t.r,z=t.z+l[1]*t.r+off*l[2]*t.r;ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,7);}ctx.fill();};
    ctx.fillStyle=TEX.canopy;lobes(1,0);ctx.fillStyle='rgba(8,22,10,.3)';lobes(.62,.3);ctx.fillStyle='rgba(120,140,84,.3)';lobes(.6,-.32);
    if(s>5){ctx.fillStyle='rgba(160,176,110,.2)';lobes(.26,-.45);}}
  // toitures (la gare et le garage s'effacent en zoomant)
  roofA=lerp(roofA,G.roofOff?0:s>9.5?.08:1,Math.min(1,dt*5));if(roofA<.004)roofA=0;
  for(const b of LY.bld){
    ctx.globalAlpha=b.fade?roofA:b.canopy?.8:1;ctx.fillStyle=b.st&&SITE.stationRoofCol?SITE.stationRoofCol:b.col;ctx.fill(b.p);
    ctx.save();ctx.clip(b.p);
    if(s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha*=.35;ctx.fill(b.p);ctx.globalAlpha=b.fade?roofA:b.canopy?.8:1;}
    if(b.st&&SITE.draw&&SITE.draw.stationRoof)SITE.draw.stationRoof(ctx,b,API);
    else{ctx.lineWidth=3.4;ctx.strokeStyle='rgba(255,255,255,.2)';ctx.stroke(b.lit);ctx.strokeStyle='rgba(0,0,0,.24)';ctx.stroke(b.dark);}
    ctx.restore();ctx.strokeStyle='rgba(40,25,20,.6)';lw(.25,.8);ctx.stroke(b.p);
  }
  ctx.globalAlpha=1;
  if(roofA<.6&&SITE.draw&&SITE.draw.underRoof)SITE.draw.underRoof(ctx,roofA,API); // charpente visible sous le toit effacé
  if(tunnelP){ctx.fillStyle='#5a4630';ctx.fill(tunnelP);ctx.strokeStyle='#3a2c1c';lw(.3,.8);ctx.stroke(tunnelP);}
  const al=G.liftBroken||G.estop||G.brakeFault||trains.some(t=>t.fault);ctx.fillStyle=al?(Math.sin(clock*9)>0?'#ff2a2a':'#7a0000'):'#3f9a66';ctx.beginPath();ctx.arc(SITE.beacon[0],SITE.beacon[1],.2,0,7);ctx.fill();
  if(SITE.draw&&SITE.draw.landmarks)SITE.draw.landmarks(ctx,s,API);
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
  if(s>9&&s<26){const q=SITE.boothLabel;ctx.strokeText('Poste de conduite',X(q[0]),Z(q[1]));ctx.fillText('Poste de conduite',X(q[0]),Z(q[1]));}
  if(s<16)for(const [t,x,z] of LABELS){ctx.strokeText(t,X(x),Z(z));ctx.fillText(t,X(x),Z(z));}
  ctx.font=Math.round(clamp(s*1.3,14,24))+'px serif';
  for(let i=emos.length-1;i>=0;i--){const e=emos[i];e.life-=dt*Math.max(1,G.speed);if(e.life<=0){emos.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,e.life);ctx.fillText(e.ch,X(e.x),Z(e.z)-10-(2.2-e.life)*10);}
  ctx.globalAlpha=1;
  if(w==='rain'||w==='storm'){ctx.strokeStyle='rgba(215,228,255,.45)';ctx.lineWidth=1;ctx.beginPath();const n=w==='storm'?320:170,ph=clock*900;
    for(let i=0;i<n;i++){const x=(i*127.3+ph*.3)%VW,y=(i*71.9+ph)%VH;ctx.moveTo(x,y);ctx.lineTo(x-3,y+11);}ctx.stroke();}
  if(G.flash>0){ctx.fillStyle=`rgba(255,255,235,${.4*G.flash})`;ctx.fillRect(0,0,VW,VH);}
  const pw=Math.min(380,VW-16),ph=62,px=8,py=8;
  ctx.fillStyle='rgba(15,22,38,.72)';ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.beginPath();ctx.moveTo(px+6,py+ph-6);for(let i=0;i<=N;i+=4)ctx.lineTo(px+6+(pw-12)*i/N,py+ph-6-TR[i%N].p.y*1.3);ctx.lineTo(px+pw-6,py+ph-6);ctx.closePath();ctx.fillStyle='rgba(200,165,110,.55)';ctx.fill();ctx.strokeStyle='#e6cfa0';ctx.lineWidth=1.2;ctx.stroke();
  for(const t of trains)if(t.st==='run'||t.st==='station'){const i=Math.round(t.s/DS)%N;ctx.fillStyle=t.col;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px+6+(pw-12)*t.s/L,py+ph-6-TR[i].p.y*1.3-3,4.5,0,7);ctx.fill();ctx.stroke();}
  ctx.font='10px system-ui,sans-serif';ctx.textAlign='left';ctx.fillStyle='#cbd5ee';ctx.fillText('Profil du parcours — '+Math.round(L)+' m (hauteurs estimées)',px+8,py+12);
  ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillText('Fond de carte © contributeurs OpenStreetMap',VW-8,VH-8);
}
function render(dt){
  clock+=dt;const w=G.wx.type;wet=lerp(wet,w==='storm'?1:w==='warn'?.55:w==='rain'?.45:0,Math.min(1,dt*.8));
  if(cam.follow>=0){carFrame(trains[cam.follow],0,_cf);const k=Math.min(1,dt*5);cam.x=lerp(cam.x,_cf.p.x,k);cam.z=lerp(cam.z,_cf.p.z,k);cam.s=lerp(cam.s,cam.g.s,Math.min(1,dt*3));}
  else if(cam.g){const k=Math.min(1,dt*4);cam.x=lerp(cam.x,cam.g.x,k);cam.z=lerp(cam.z,cam.g.z,k);cam.s=lerp(cam.s,cam.g.s,k);}
  drawWorld(dt);drawOverlay(dt);
  let vmax=0,chain=false;
  for(const t of trains)if(t.st==='run'){const z=zoneOf(t.s);if(z==='lift'&&t.v>0)chain=true;if(z==='course'||z==='brake')vmax=Math.max(vmax,t.v);}
  const f=cam.follow>=0?trains[cam.follow]:null;
  sfx.update(dt,{rumble:Math.min(.5,vmax/24*(f?.45:.28)),wind:f&&f.st==='run'?Math.min(.18,f.v*f.v/3200):0,rain:w==='storm'?.16:w==='rain'?.09:0,crowd:Math.min(.07,.012+G.queue.length/3000),chain});
}
let last=performance.now(),uiT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const modal=!$('mHelp').classList.contains('hidden')||!$('mDay').classList.contains('hidden');
  if(!modal)for(let i=0;i<G.speed;i++)step(dt);
  render(modal?0:dt);
  uiT+=dt;if(uiT>.12){uiT=0;ui();}
  requestAnimationFrame(frame);
}
document.title=SITE.title+' — Simulateur d\'exploitation';$('ttl').textContent=SITE.title;$('helpTtl').textContent=SITE.title+' — à vous les commandes';
$('trackName').textContent=SITE.trackName||'Voie';$('helpGarage').innerHTML=SITE.helpGarage||'';
log('Bienvenue sur '+SITE.title+' ! '+trains[0].name+' est en gare'+((n=>n?', '+n+' train'+(n>1?'s':'')+' au garage':'')(trains.filter(t=>t.st==='garage').length))+'. Ouvrez l\'entrée pour commencer.','good');
ui();requestAnimationFrame(frame);
Object.assign(window,{G,trains,act,step,cam,L,render,SD:S_DROP,ui});
