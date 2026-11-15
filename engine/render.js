'use strict';
/* ══════════ RENDU 2D — VUE AÉRIENNE SUR FOND RÉEL (OpenStreetMap) ══════════ */
const wrap=$('view'),cv=document.createElement('canvas'),ctx=cv.getContext('2d');wrap.prepend(cv);
let VW=1,VH=1,DPR=1;
let refit=()=>{}; // recadre la vue quand la taille change (défini après la caméra)
function resize(){const d=Math.min(2,window.devicePixelRatio||1),w=wrap.clientWidth||1,h=wrap.clientHeight||1;
  if(d===DPR&&w===VW&&h===VH&&cv.width)return;DPR=d;VW=w;VH=h;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);cv.style.width=VW+'px';cv.style.height=VH+'px';refit();}
const onSize=()=>{resize();requestAnimationFrame(resize);}; // 2e passage : la taille de la fenêtre se stabilise après un changement d'orientation
for(const ev of ['resize','orientationchange','fullscreenchange','webkitfullscreenchange'])addEventListener(ev,onSize);
document.addEventListener('fullscreenchange',()=>{if(fsOn&&!document.fullscreenElement)setFs(false);onSize();});
document.addEventListener('webkitfullscreenchange',()=>{if(fsOn&&!document.webkitFullscreenElement)setFs(false);onSize();});
if(window.ResizeObserver)new ResizeObserver(resize).observe(wrap);
resize();
const VIEW=SITE.view,fitS=()=>Math.min(VW/VIEW.w,VH/VIEW.h);
const CAMS=Object.assign({vue:{label:'Vue d\'ensemble',x:VIEW.x,z:VIEW.z,s:0}},SITE.cams);
const cam={key:'vue',x:VIEW.x,z:VIEW.z,s:fitS(),g:null,follow:-1};
refit=()=>{if(cam.follow>=0)return;if(cam.key==='vue'&&!cam.g){cam.x=VIEW.x;cam.z=VIEW.z;cam.s=fitS();}else if(CAMS[cam.key]&&cam.g)setCam(cam.key);};
const COARSE=matchMedia('(pointer:coarse)').matches,minS=()=>Math.min(1.6,fitS()*.85); // doigt : zones de toucher plus larges
let fsOn=false;
function setFs(on){ // plein écran de la carte : API Fullscreen sur #view, repli CSS (la carte remplit la fenêtre) si indisponible
  on=!!on;if(on===fsOn)return;fsOn=on;const b=document.body,side=$('side');
  b.classList.toggle('fs',on);wrap.classList.toggle('fs',on);b.classList.remove('fsdesk');
  if(on){wrap.appendChild(side);const rq=wrap.requestFullscreen||wrap.webkitRequestFullscreen;
    if(rq){try{const r=rq.call(wrap);if(r&&r.catch)r.catch(()=>{});}catch(e){}}}
  else{document.querySelector('main').appendChild(side);
    const ex=document.fullscreenElement?document.exitFullscreen:document.webkitFullscreenElement?document.webkitExitFullscreen:null;
    if(ex){try{const r=ex.call(document);if(r&&r.catch)r.catch(()=>{});}catch(e){}}}
  $('bFs').textContent=on?'Quitter le plein écran':'Plein écran';$('bFs').classList.toggle('on',on);
  layoutVars();onSize();ui();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fsOn)setFs(false);});
if(COARSE)$('hint').textContent='Glisser : déplacer · Pincer : zoom';
function setCam(k){cam.key=k;if(k.startsWith('suivi')){cam.follow=+k.slice(5);cam.g={s:12};}else{cam.follow=-1;const c=CAMS[k];cam.g={x:c.x,z:c.z,s:c.s||fitS()};}}
$('cams').innerHTML='<button data-act="fs" id="bFs" title="Afficher la carte en plein écran">Plein écran</button>'+Object.entries(CAMS).map(([k,c])=>`<button data-act="cam" data-arg="${k}">${c.label}</button>`).join('')
  +trains.map(t=>`<button data-act="cam" data-arg="suivi${t.i}">Suivre T${t.i+1}</button>`).join('')
  +'<button data-act="syn" id="bSyn" title="Afficher ou masquer le synoptique du circuit">Synoptique</button>'
  +'<button data-act="roof" id="bRoof" title="Retirer ou remettre les toits de la gare, du poste de conduite et du garage">Toits en place</button>';
(function controls(){
  const ptrs=new Map();let pinch=0,moved=0,multi=false;const free=()=>{cam.g=null;cam.follow=-1;cam.key='';};
  const gateAt=e=>{const r=cv.getBoundingClientRect(),wx=cam.x+(e.clientX-r.left-VW/2)/cam.s,wz=cam.z+(e.clientY-r.top-VH/2)/cam.s;let best=-1,bd=Math.max(2.2,(COARSE?26:14)/cam.s);
    LOOPS.forEach((l,i)=>{const g=l.g;for(const q of [g.h,[(g.h[0]+g.a[0])/2,(g.h[1]+g.a[1])/2],[(g.h[0]+g.b[0])/2,(g.h[1]+g.b[1])/2]]){const d=Math.hypot(q[0]-wx,q[1]-wz);if(d<bd){bd=d;best=i;}}});
    {const g=ENTRY_GATE,d=Math.min(Math.hypot(g.h[0]-wx,g.h[1]-wz),Math.hypot((g.h[0]+g.a[0])/2-wx,(g.h[1]+g.a[1])/2-wz),Math.hypot((g.h[0]+g.b[0])/2-wx,(g.h[1]+g.b[1])/2-wz));if(d<bd)best=-2;}
    return best;};
  const inSyn=e=>{const b=SYN.box;if(!synOn||!b)return false;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;return x>=b[0]&&x<=b[0]+b[2]&&y>=b[1]&&y<=b[1]+b[3];};
  cv.addEventListener('click',e=>{if(!inSyn(e))return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=SYN.hits.find(h=>Math.hypot(h.x-x,h.y-y)<=h.r);if(h)setCam('suivi'+h.i);});
  cv.addEventListener('pointerdown',e=>{if(inSyn(e))return;cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=0;pinch=0;if(ptrs.size>1)multi=true;});
  const up=e=>{const tap=ptrs.has(e.pointerId)&&e.type==='pointerup'&&!multi&&moved<(e.pointerType==='touch'?12:6)&&ptrs.size===1;if(ptrs.size<=1)multi=false;if(tap){const i=gateAt(e);if(i>=0)act('loop',i);else if(i===-2)act('open');}ptrs.delete(e.pointerId);pinch=0;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p){cv.style.cursor=gateAt(e)!==-1?'pointer':'grab';return;}
    const dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);if(moved<(e.pointerType==='touch'?12:6))return;free();
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=cv.getBoundingClientRect(),mx=(a[0]+b[0])/2-r.left-VW/2,mz=(a[1]+b[1])/2-r.top-VH/2;
      if(pinch){const wx=cam.x+mx/cam.s,wz=cam.z+mz/cam.s;cam.s=clamp(cam.s*d/pinch,minS(),45);cam.x=clamp(wx-mx/cam.s,VIEW.bounds[0],VIEW.bounds[1]);cam.z=clamp(wz-mz/cam.s,VIEW.bounds[2],VIEW.bounds[3]);}pinch=d;return;}
    cam.x=clamp(cam.x-dx/cam.s,VIEW.bounds[0],VIEW.bounds[1]);cam.z=clamp(cam.z-dy/cam.s,VIEW.bounds[2],VIEW.bounds[3]);});
  cv.addEventListener('wheel',e=>{e.preventDefault();free();const r=cv.getBoundingClientRect(),mx=e.clientX-r.left-VW/2,mz=e.clientY-r.top-VH/2;
    const wx=cam.x+mx/cam.s,wz=cam.z+mz/cam.s;cam.s=clamp(cam.s*Math.exp(-e.deltaY*.0014),minS(),45);cam.x=wx-mx/cam.s;cam.z=wz-mz/cam.s;},{passive:false});
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
const TRO=Object.assign({lo:[150,156,164],hi:[198,204,210],edge:'#4a4f57',deck:'#565c65',rim:'#2f3339',shine:'rgba(255,255,255,.2)'},SITE.trough); // couleurs de la gouttière (bob), réglables par SITE.trough
// Coaster inversé (SITE.kind 'inverted') : poutre caisson en acier, deux rails de roulement, portiques de supports au-dessus de la voie, trains suspendus dessous.
// Couleurs par SITE.track = {spine, rail, support} (défaut : teintes acier sourdes).
const TKC=Object.assign({spine:'#4a5d72',rail:'#2e3640',support:'#8c8577'},SITE.track),SUPW=2.3;
const chunkH=new Float32Array(N+1),chunks=[],dirtP=new Path2D,chainP=new Path2D,finsP=new Path2D,wid=h=>BOB?1.5:INV?SUPW:h>ST_Y+.6?1.6+h*.2:1.85,DECKW=BOB?2.3:INV?1.05:3.1;
function strip(sm){
  const o={h:0,sw:0,deck:new Path2D,rail:new Path2D,hand:new Path2D,ties:new Path2D,str:new Path2D,sh:new Path2D,shb:new Path2D,x0:1e9,x1:-1e9,z0:1e9,z1:-1e9},n=sm.length;
  const side=(path,off,fn)=>sm.forEach((q,i)=>{const k=fn?fn(q.y)*off:off,x=q.x+q.nx*k,z=q.z+q.nz*k;i?path.lineTo(x,z):path.moveTo(x,z);});
  let hs=0;
  sm.forEach((q,i)=>{
    const sx=q.x+q.y*SHX,sz=q.z+q.y*SHZ;hs+=q.y;
    o.x0=Math.min(o.x0,q.x-9);o.x1=Math.max(o.x1,sx+9);o.z0=Math.min(o.z0,q.z-9);o.z1=Math.max(o.z1,sz+9);
    if(i){o.deck.lineTo(q.x,q.z);o.sh.lineTo(sx,sz);}else{o.deck.moveTo(q.x,q.z);o.sh.moveTo(sx,sz);}
    if(!BOB&&!INV&&q.i%2===1){o.ties.moveTo(q.x-q.nx*.9,q.z-q.nz*.9);o.ties.lineTo(q.x+q.nx*.9,q.z+q.nz*.9);}
    if(INV){if(i<n-1&&q.i%13===0&&q.y>ST_Y+1.5){const e=(q.i/13)%2?1:-1,w=SUPW*e,tx=q.nz,tz=-q.nx,bx=q.x+q.nx*w,bz=q.z+q.nz*w; // support en potence : poteau d'un côté (alterné), bras au-dessus de la voie
      o.str.moveTo(bx,bz);o.str.lineTo(q.x-q.nx*.6*e,q.z-q.nz*.6*e);o.hand.moveTo(bx-tx*.35,bz-tz*.35);o.hand.lineTo(bx+tx*.35,bz+tz*.35);o.shb.moveTo(bx,bz);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
    else if(i<n-1&&q.i%(BOB?12:6)===0){const w=wid(q.y);o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      if(!BOB&&q.y>7.5&&i+6<n){const b=sm[i+6],w2=wid(b.y),e=(q.i/6)%2?1:-1;o.str.moveTo(q.x-q.nx*w*e,q.z-q.nz*w*e);o.str.lineTo(b.x+b.nx*w2*e,b.z+b.nz*w2*e);}
      for(const sg of (BOB?[0]:[-1.25,1.25])){const bx=q.x+q.nx*sg,bz=q.z+q.nz*sg;o.shb.moveTo(bx,bz);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
  });
  if(BOB){side(o.rail,-1.02);side(o.rail,1.02);} // bords de la gouttière
  else if(INV){side(o.rail,-.5);side(o.rail,.5);} // rails de roulement de part et d'autre de la poutre caisson
  else{side(o.rail,-.6);side(o.rail,.6);side(o.hand,-1.5);side(o.hand,1.5);side(o.str,-1,wid);side(o.str,1,wid);}
  o.h=hs/n;const k=clamp(o.h/30,0,1);o.col=BOB?`rgb(${lerp(TRO.lo[0],TRO.hi[0],k)|0},${lerp(TRO.lo[1],TRO.hi[1],k)|0},${lerp(TRO.lo[2],TRO.hi[2],k)|0})`:`rgb(${lerp(172,198,k)|0},${lerp(146,170,k)|0},${lerp(104,124,k)|0})`;
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
    if(!SG){const rb=strip(line(0,R1-R0,0));rb.rb=1;chunks.push(grow(rb));} // rail unique (SG) : le tronçon du circuit est le seul rail porté
    LANES.forEach(ln=>chunks.push(strip(LREV?line(laneU(ln.end),laneU(U_LANE),ln.d):line(U_LANE,ln.end,ln.d)))); // yard.rev : voies en amont du chariot
  }else LANES.forEach((ln,j)=>{const GP=ln.path,gs=GP.map((q,i)=>{const a=GP[Math.max(0,i-1)],b=GP[Math.min(GP.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:q.x,y:ST_Y,z:q.z,nx:-(b.z-a.z)/l,nz:(b.x-a.x)/l,i};});
    const sP=strip(gs.slice(0,37));sP.lk=j+1;chunks.push(sP,strip(gs.slice(36)));});
  for(let i=Math.round(S_LIFT0/DS);i<=Math.round((S_LIFT1+3)/DS);i++){const p=TR[i].p;chainP.lineTo(p.x,p.z);}
  const finsR=[[S_BRK+3,TRAV?R0:S_HOLD]].concat(BLK.map(b=>[b-9,b]),PSB?[[PSB_A+1,S_PSB]]:[]); // frein final et freins de bloc (≈ 9 m de patins avant chaque point d'arrêt, estimé)
  for(const [r0,r1] of finsR)for(let i=Math.round(r0/DS);i<Math.round(r1/DS);i+=3){const f=TR[i],l=Math.hypot(f.R.x,f.R.z)||1,nx=f.R.x/l,nz=f.R.z/l;finsP.moveTo(f.p.x-nx*.28,f.p.z-nz*.28);finsP.lineTo(f.p.x+nx*.28,f.p.z+nz*.28);}
})();
const swz=o=>o.sw===1?raC():o.rb?devC()-GAP:o.lk?devC()-OFF[o.lk]:0; // déplacement des tronçons portés par le chariot (circuit, transfert vers la voie lk), le long de (SW0.vx, SW0.vz)
const devHide=o=>o.lk&&YD.device==='table'&&o.lk!==devShown(); // pont transbordeur : un seul tronçon de transfert, celui de la voie visée

// Décor réel : bâtiments, allées, plans d'eau, bois
const mkPath=(pts,close)=>{const p=new Path2D;pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath();return p;};
const cen=pts=>{let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return [x/pts.length,z/pts.length];};
const LY={water:[],canal:[],lawn:[],forest:[],dirt:[],asph:[],foot:[],footA:[],road:[],hedge:[],bld:[],pier:[]},trees=[],FOOT=[],PLACES=[],otherP=(OSM.others||[]).map(p=>mkPath(p));
let tunnelP=null,tunnelC=[5,98];const WATERPTS=[];
(function scenery(){
  const ROOFS=['#a9553f','#b0694a','#9d6350','#8a8f96','#b9ab93','#7f8a8f','#a35f47'],seen=new Set();
  const SPOLY=SITE.stationPoly||[],inSt=(x,z)=>{let c=false;for(let i=0,j=SPOLY.length-1;i<SPOLY.length;j=i++)if((SPOLY[i][1]>z)!==(SPOLY[j][1]>z)&&x<(SPOLY[j][0]-SPOLY[i][0])*(z-SPOLY[i][1])/(SPOLY[j][1]-SPOLY[i][1])+SPOLY[i][0])c=!c;return c;};
  const stroll0=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));if(C[C.length-1]>45)FOOT.push({P:pts,C,len:C[C.length-1]});};
  const stroll=pts=>{let run=[];const flush=()=>{if(run.length>1)stroll0(run);run=[];};for(let a=0;a+1<pts.length;a++){const A=pts[a],B=pts[a+1],n=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/.5));for(let k=0;k<=n;k++){if(a&&!k)continue;const q=[A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n];if(inSt(q[0],q[1]))flush();else run.push(q);}}flush();}; // les promeneurs ne traversent jamais la gare (voie, quais)
  const addBld=(pts,o)=>{const m=cen(pts),lit=new Path2D,dark=new Path2D;let ar=0;
    for(let j=0;j<pts.length-1;j++)ar+=pts[j][0]*pts[j+1][1]-pts[j+1][0]*pts[j][1];
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],sg=ar>0?1:-1,nx=(b[1]-a[1])*sg,nz=-(b[0]-a[0])*sg,pp=nx*-.8+nz*-.6>0?lit:dark;pp.moveTo(a[0],a[1]);pp.lineTo(b[0],b[1]);}
    const near=q=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2];
    LY.bld.push(Object.assign({p:mkPath(pts,true),m,lit,dark,st:near(SITE.stationAt),h:7,canopy:false,fade:(SITE.fade||[]).some(near)},o));};
  OSM.feats.forEach((f,i)=>{
    const k=f.k,c=f.c&&f.p.length>3,p=mkPath(f.p,c);
    if(f.n&&!seen.has(f.n)&&!(SITE.hideNames||[]).includes(f.n)&&!k.startsWith('highway')){seen.add(f.n);const m=cen(f.p);PLACES.push([f.n.replace(/ \(\d+\)/,''),m[0],m[1]]);}
    if(k==='natural=water'||k==='landuse=reservoir'){if(c){LY.water.push(p);WATERPTS.push(f.p);}}
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
// Tunnels du circuit : OSM.tunnels=[[s0,s1],…] (tronçons tagués tunnel=yes, ou covered=yes et layer<0). Voie et trains y sont cachés par une couverture :
// de l'eau si le tunnel passe sous un plan d'eau OSM (détection automatique), sinon un remblai enherbé. SITE.tunnels[k]={under:'water'|'ground',w:demi-largeur} force le choix.
// Deux portails (tête en béton, ouverture sombre, rampe à murs) aux extrémités. Profondeur ESTIMÉE (profil de la spec). « Toits retirés » : la couverture devient translucide.
const TUN=(function(){
  const pip=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;};
  const fr=i=>{const f=TR[((i%N)+N)%N],g=TR[(((i+1)%N)+N)%N],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(g.p.x-f.p.x,g.p.z-f.p.z)||1;return {x:f.p.x,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:(g.p.x-f.p.x)/tl,tz:(g.p.z-f.p.z)/tl};};
  return (OSM.tunnels||[]).map((r,ti)=>{
    const cf=(SITE.tunnels&&SITE.tunnels[ti])||{},i0=Math.round(r[0]/DS),i1=Math.round(r[1]/DS),w=cf.w||2.1,m=fr(Math.round((i0+i1)/2));
    const e0=fr(i0),e1=fr(i1),under=cf.under||([m,e0,e1].some(c=>WATERPTS.some(q=>pip(q,c.x,c.z)))?'water':'ground'); // sous l'eau si le milieu ou une extrémité est dans un plan d'eau OSM
    const band=(a,b,hw)=>{const P=new Path2D,L1=[],R1=[];for(let i=a;i<=b;i++){const f=fr(i);L1.push([f.x+f.nx*hw,f.z+f.nz*hw]);R1.push([f.x-f.nx*hw,f.z-f.nz*hw]);}
      L1.forEach((q,i)=>i?P.lineTo(q[0],q[1]):P.moveTo(q[0],q[1]));R1.reverse().forEach(q=>P.lineTo(q[0],q[1]));P.closePath();return P;};
    const walls=new Path2D,heads=new Path2D,mouth=[],RAMP=Math.round(6/DS);
    for(const sg of [-1,1]){ // sg=-1 : portail d'entrée (début), +1 : portail de sortie
      const ie=sg<0?i0:i1,f=fr(ie),ox=f.tx*sg,oz=f.tz*sg; // ox,oz : vers l'extérieur du tunnel
      for(const e of [-1,1]){walls.moveTo(f.x+f.nx*w*e,f.z+f.nz*w*e);for(let k=0;k<=RAMP;k++){const g=fr(ie+sg*k);walls.lineTo(g.x+g.nx*(w+k*DS*.05)*e,g.z+g.nz*(w+k*DS*.05)*e);}}
      const hw=w+.45,c=[f.x-ox*.4,f.z-oz*.4]; // tête : dalle de béton de 0,8 m, moitié dedans
      heads.moveTo(c[0]+f.nx*hw+f.tx*.4,c[1]+f.nz*hw+f.tz*.4);heads.lineTo(c[0]-f.nx*hw+f.tx*.4,c[1]-f.nz*hw+f.tz*.4);heads.lineTo(c[0]-f.nx*hw-f.tx*.4,c[1]-f.nz*hw-f.tz*.4);heads.lineTo(c[0]+f.nx*hw-f.tx*.4,c[1]+f.nz*hw-f.tz*.4);heads.closePath();
      mouth.push({x:f.x,z:f.z,ox,oz,nx:f.nx,nz:f.nz});}
    const hs=[];for(let i=i0-2;i<=i1+2;i++)hs.push(chunkH[((i%N)+N)%N]);
    return {a:r[0],b:r[1],under,w,cover:band(i0,i1,w+.3),core:band(i0,i1,w-.2),walls,heads,mouth,h:Math.max(...hs)+.01};
  });
})();
const inTun=s=>{for(const t of TUN)if(s>=t.a-CAR/2&&s<=t.b+CAR/2)return true;return false;};
function drawTunnel(t){
  const ra=G.roofOff?roofA:1,wa=t.under==='water';
  ctx.save();
  if(wa){ctx.globalAlpha=.42+.5*ra;ctx.fillStyle=TEX.water;ctx.fill(t.cover);ctx.globalAlpha=ra*.5;ctx.strokeStyle='rgba(190,215,225,.55)';lw(.12,.5);ctx.stroke(t.cover);} // dalle de couverture sous l'eau
  else{ctx.globalAlpha=.3+.7*ra;ctx.fillStyle=TEX.dirt;ctx.fill(t.cover);ctx.fillStyle=TEX.lawn;ctx.fill(t.core);ctx.fillStyle='rgba(20,40,16,.18)';ctx.fill(t.core);}
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(30,30,28,.35)';lw(.5,1);ctx.translate(.18,.14);ctx.stroke(t.walls);ctx.translate(-.18,-.14); // murs de la rampe et têtes de portail
  ctx.strokeStyle=TEX.stone;lw(.34,.8);ctx.stroke(t.walls);ctx.fillStyle=TEX.stone;ctx.fill(t.heads);ctx.strokeStyle='#8a867a';lw(.1,.6);ctx.stroke(t.heads);
  for(const m of t.mouth){const x0=m.x,z0=m.z,x1=m.x+m.ox*2.4,z1=m.z+m.oz*2.4,g=ctx.createLinearGradient(x0,z0,x1,z1); // ombre de l'ouverture sur la rampe
    g.addColorStop(0,'rgba(8,9,12,.9)');g.addColorStop(1,'rgba(8,9,12,0)');ctx.fillStyle=g;const hw=t.w-.15;
    ctx.beginPath();ctx.moveTo(x0+m.nx*hw,z0+m.nz*hw);ctx.lineTo(x1+m.nx*hw,z1+m.nz*hw);ctx.lineTo(x1-m.nx*hw,z1-m.nz*hw);ctx.lineTo(x0-m.nx*hw,z0-m.nz*hw);ctx.closePath();ctx.fill();}
  ctx.restore();
}
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
  if(shadow){const hy=INV?Math.max(0,p.y-2.6):p.y+.6;ctx.translate(p.x+hy*SHX,p.z+hy*SHZ);ctx.rotate(a);ctx.fillStyle='rgba(10,20,10,.3)';ctx.fillRect(-hl-.04,-hw-.04,2*hl+.08,CW+.08);ctx.restore();return;}
  ctx.translate(p.x,p.z);ctx.rotate(a);
  if(BOB){ // coque de bob : pas de roues apparentes, nez et queue arrondis
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.2,.46,.46,.2]:k===NCARS-1?[.42,.2,.2,.42]:.22);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.12,-hw,2*hl-.24,.07);ctx.fillRect(-hl+.12,hw-.07,2*hl-.24,.07);
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.2,-hw+.15,2*hl-.42,CW-.3,.14);ctx.fill();
  }else if(INV){ // wagon suspendu, sans plancher : châssis sous la poutre, rangée de sièges côte à côte, dossiers et harnais sombres
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.12,.5,.5,.12]:.14);ctx.fill();
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.18,-hw+.12,2*hl-.44,CW-.24,.1);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.08,-hw,.16,CW);ctx.fillRect(-.35,-.32,.7,.64);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.25,-.3);ctx.lineTo(hl+.05,0);ctx.lineTo(hl-.25,.3);ctx.fill();}
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
  const Lr=R1-R0,dM=Math.max(...LANES.map(l=>l.d)),dm=Math.min(...LANES.map(l=>l.d)),vA=(RA?RET:GAP)+1.5,vB=-dM-1.6,c=devC();
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  const gu0=LREV?laneU(LANES[0].end)-1:U_LANE-.4,gw=LANES[0].end-U_LANE+1.4;
  ctx.fillStyle='#a9aaa6';ctx.fillRect(gu0,vB,gw,-dm+1.6-vB);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.35;ctx.fillRect(gu0,vB,gw,-dm+1.6-vB);ctx.globalAlpha=1; // dalle du garage
  ctx.fillStyle='#5d6062';ctx.fillRect(-.7,vB,Lr+1.4,vA-vB);ctx.fillStyle='rgba(30,32,36,.35)';ctx.fillRect(-.7,vB,Lr+1.4,.35);ctx.fillRect(-.7,vA-.35,Lr+1.4,.35); // fosse
  ctx.strokeStyle='#3a3c40';lw(.16,.7);ctx.beginPath();for(const u of [.6,Lr/2,Lr-.6]){ctx.moveTo(u,vB+.2);ctx.lineTo(u,vA-.2);}ctx.stroke(); // chemins de roulement
  ctx.strokeStyle='#2c2e33';lw(.3,.8);ctx.beginPath();for(const l of LANES){const e=LREV?laneU(l.end)-.15:l.end+.15;ctx.moveTo(e,-l.d-.7);ctx.lineTo(e,-l.d+.7);}ctx.stroke(); // heurtoirs
  const deck=(v0,w,mv)=>{ctx.fillStyle='rgba(20,22,26,.35)';ctx.fillRect(-.3+.35,v0+.35,Lr+.6,w); // ombre portée, tablier, traverses
    ctx.fillStyle='#5c6168';ctx.strokeStyle=mv&&Math.sin(clock*10)>0?'#d08a3a':'#b89a4a';lw(.12,.6);ctx.beginPath();ctx.rect(-.3,v0,Lr+.6,w);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(30,32,36,.55)';lw(.08,.4);ctx.beginPath();for(let u=1;u<Lr;u+=1.5){ctx.moveTo(u,v0+.05);ctx.lineTo(u,v0+w-.05);}ctx.stroke();};
  if(RA){deck(c-GAP-1.25,2.5,devMoving());deck(raC()-1.25,2.5,raMoving());} // rail A escamotable sur son propre tablier, chariot du rail B
  else deck(c-GAP-1.25,GAP+2.5,devMoving());
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
  if(!BOB&&!INV){ctx.strokeStyle=TEX.dirt;ctx.globalAlpha=.85;ctx.lineWidth=8.5;ctx.stroke(dirtP);ctx.globalAlpha=1;} // terre battue sous la charpente en bois
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
    for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o)){const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:INV?.45:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
    for(const t of trains)for(let k=0;k<NCARS;k++)if(!inTun(((t.s-(k+.5)*CAR)%L+L)%L))drawCar(t,k,true);
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
    for(let k=0;k<NCARS;k++){const sc=t.s-(k+.5)*CAR;items.push({h:inTun((((sc%L)+L)%L))?-99:(t.st==='run'?chunkH[Math.floor((((sc%L)+L)%L)/DS)%N]:ST_Y)+(INV?-1.5:.02),t,k});}} // inversé : train suspendu sous sa voie
  for(const u of TUN)items.push({h:u.h,tun:u});
  items.sort((a,b)=>a.h-b.h);
  for(const o of items){
    if(o.tun){drawTunnel(o.tun);continue;}
    if(o.t){drawCar(o.t,o.k);continue;}
    const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}
    if(BOB){ // gouttière en acier : bords sombres, fond clair, reflet au centre
      ctx.strokeStyle=TRO.edge;lw(.22,.7);ctx.stroke(o.str);
      ctx.strokeStyle=TRO.deck;ctx.lineWidth=DECKW;ctx.stroke(o.deck);ctx.strokeStyle=o.col;ctx.lineWidth=2;ctx.stroke(o.deck);
      ctx.strokeStyle=TRO.shine;ctx.lineWidth=.9;ctx.stroke(o.deck);
      ctx.strokeStyle=TRO.rim;lw(.1,.5);ctx.stroke(o.rail);
    }else if(INV){ // poutre caisson, rails, puis portiques et poteaux par-dessus
      ctx.strokeStyle='rgba(20,24,30,.55)';ctx.lineWidth=DECKW+.25;ctx.stroke(o.deck);ctx.strokeStyle=TKC.spine;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.3;ctx.stroke(o.deck);
      ctx.strokeStyle=TKC.rail;lw(.14,.6);ctx.stroke(o.rail);
      ctx.strokeStyle=TKC.support;lw(.5,.8);ctx.stroke(o.str);lw(.7,1);ctx.stroke(o.hand);
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
    for(const v of SG?[c]:[raC(),c-GAP])for(let u=.5;u<R1-R0;u+=1.5){ctx.moveTo(u,v-.28);ctx.lineTo(u,v+.28);}ctx.stroke();ctx.restore();}
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
/* Synoptique technique : plan du circuit (nord en haut) avec zones, freins de bloc, garage et trains en direct */
let synOn=(()=>{try{const v=localStorage.getItem('t2z.syn');if(v!==null)return v==='1';}catch(e){}return VW>=600;})();
function toggleSyn(){synOn=!synOn;try{localStorage.setItem('t2z.syn',synOn?'1':'0');}catch(e){}$('bSyn').classList.toggle('on',synOn);}
$('bSyn').classList.toggle('on',synOn);
const SYN={pts:null,lay:null,key:'',hits:[],box:null};
function synBuild(){
  const pts=[];for(let s=0;s<L;s+=1){const f=frameAt(s,_cf);pts.push([f.p.x,f.p.z]);}
  const lanes=LANES.map(l=>l.path.filter((_,i)=>i%4===0||i===l.path.length-1).map(q=>[q.x,q.z]));
  const box=()=>({x0:1e9,x1:-1e9,z0:1e9,z1:-1e9}),ext=(b,a)=>{for(const q of a){b.x0=Math.min(b.x0,q[0]);b.x1=Math.max(b.x1,q[0]);b.z0=Math.min(b.z0,q[1]);b.z1=Math.max(b.z1,q[1]);}};
  const bb=box(),gb=box();ext(bb,pts);lanes.forEach(l=>{ext(bb,l);ext(gb,l);});
  ext(gb,pts.slice(Math.max(0,Math.floor(SW_A-5)),Math.min(pts.length,Math.ceil(SW_B+5))));
  if(TRAV){const e=[];for(const v of [-GAP-1.2,RET+1.2])for(const u of [-1,R1-R0+1])e.push([SW0.x+SW0.tx*u+SW0.vx*v,SW0.z+SW0.tz*u+SW0.vz*v]);ext(gb,e);ext(bb,e);}
  for(const k of ['x0','z0'])gb[k]-=3;for(const k of ['x1','z1'])gb[k]+=3;
  let cx=0,cz=0;for(const q of pts){cx+=q[0];cz+=q[1];}
  Object.assign(SYN,{pts,lanes,bb,gb,c:[cx/pts.length,cz/pts.length]});
}
function drawSyn(){
  SYN.hits=[];SYN.box=null;if(!synOn)return;
  if(!SYN.pts)synBuild();
  const sm=VW<600||VH<420,pad=sm?10:14,TT=sm?12:15,mw=sm?Math.min(200,VW-16):Math.min(430,VW*.45),mh=sm?Math.min(100,VH*.12):Math.min(270,VH*.36),GH=sm?58:150;
  const bb=SYN.bb,gb=SYN.gb,bw=Math.max(1,bb.x1-bb.x0),bh=Math.max(1,bb.z1-bb.z0),sc=Math.min((mw-2*pad)/bw,(mh-2*pad-TT)/bh);
  const pw=Math.max(bw*sc+2*pad,sm?mw:Math.min(300,mw)),ph=bh*sc+2*pad+TT+GH+TT,px=8,py=8,ox=px+(pw-bw*sc)/2,oy=py+pad+TT;
  const X=x=>ox+(x-bb.x0)*sc,Z=z=>oy+(z-bb.z0)*sc;SYN.box=[px,py,pw,ph];
  const gw=Math.max(1,gb.x1-gb.x0),gh=Math.max(1,gb.z1-gb.z0),gsc=Math.min((pw-2*pad)/gw,GH/gh),gx0=px+(pw-gw*gsc)/2,gy0=py+ph-pad*.4-GH+(GH-gh*gsc)/2;
  const GX=x=>gx0+(x-gb.x0)*gsc,GZ=z=>gy0+(z-gb.z0)*gsc,iy=py+ph-pad*.4-GH-TT;
  const fs=sm?9:10.5,R=sm?6.5:8;
  ctx.save();ctx.fillStyle='#0f1626';ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.strokeStyle='rgba(120,140,175,.35)';ctx.lineWidth=1;ctx.stroke();
  ctx.font='600 '+fs+'px system-ui,sans-serif';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#cbd5ee';ctx.fillText('Synoptique — circuit '+Math.round(L)+' m',px+8,py+TT-1);
  ctx.fillText('Garage'+(TRAV?' — '+DEVN.toLowerCase():''),px+8,iy+TT-3);
  ctx.strokeStyle='rgba(120,140,175,.25)';ctx.beginPath();ctx.moveTo(px+6,iy);ctx.lineTo(px+pw-6,iy);ctx.stroke();
  const P=SYN.pts;ctx.lineCap='round';ctx.lineJoin='round';
  const seg=(a,b,X,Z)=>{a=clamp(Math.floor(a),0,P.length-1);b=clamp(Math.ceil(b),0,P.length-1);ctx.beginPath();for(let i=a;i<=b;i++)i===a?ctx.moveTo(X(P[i][0]),Z(P[i][1])):ctx.lineTo(X(P[i][0]),Z(P[i][1]));ctx.stroke();};
  const at=s=>{const q=P[clamp(Math.round(s),0,P.length-1)];return [X(q[0]),Z(q[1])];},mid=t=>t.s-TLEN/2;
  const cantons=[[S_REL,BLK.length?BLK[0]:L]].concat(BLK.map((b,i)=>[b,blkEnd(i)])); // canton i+1 : après le frein de bloc i
  const lab=(t,x,y,c)=>{const dx=x-X(SYN.c[0]),dz=y-Z(SYN.c[1]),d=Math.hypot(dx,dz)||1,q=sm?9:12,w=ctx.measureText(t).width;let lx=x+(Math.abs(dx)>6?dx/d*q:0);const al=dx>6?'left':dx<-6?'right':'center';
    lx=al==='left'?Math.min(lx,px+pw-5-w):al==='right'?Math.max(lx,px+5+w):clamp(lx,px+5+w/2,px+pw-5-w/2);ctx.textAlign=al;ctx.fillStyle=c;ctx.fillText(t,lx,y+dz/d*q+3);};
  // garage : tracé commun au plan (fin) et à l'encart (agrandi)
  const garage=(X,Z,lw)=>{
    ctx.lineWidth=lw;ctx.strokeStyle='#6f7f9c';
    SYN.lanes.forEach(l=>{ctx.beginPath();l.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.stroke();});
    if(TRAV){
      const pt=(u,v)=>[X(SW0.x+SW0.tx*u+SW0.vx*v),Z(SW0.z+SW0.tz*u+SW0.vz*v)],ln=(v,u0,u1)=>{const a=pt(u0,v),b=pt(u1,v);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();};
      const vA=raC(),vB=devC()-GAP,ul=R1-R0;
      ctx.lineWidth=lw*1.8;if(!SG){ctx.strokeStyle=RA?'#a7b6d0':'#d8dfec';ln(vA,0,ul);}ctx.strokeStyle='#d9bd82';ln(vB,0,ul); // rail unique : un seul rail, celui du chariot
      ctx.lineWidth=1;ctx.strokeStyle='rgba(217,189,130,.65)';const a0=vB-.8,a1=(RA?vB:vA)+.8;
      ctx.beginPath();[[a0,-.8],[a1,-.8],[a1,ul+.8],[a0,ul+.8]].forEach(([v,u],i)=>{const q=pt(u,v);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.stroke();
    }else{ctx.fillStyle='#d9bd82';ctx.beginPath();ctx.arc(X(SW0.x),Z(SW0.z),lw+1,0,7);ctx.fill();}
  };
  // cantons occupés (teinte)
  ctx.lineWidth=sm?7:9;ctx.strokeStyle='rgba(205,165,85,.32)';
  for(const [a,b] of cantons)if(trains.some(t=>t.st==='run'&&mid(t)>=a&&mid(t)<b))seg(a,b,X,Z);
  garage(X,Z,1.2);
  ctx.lineWidth=1.5;ctx.strokeStyle='#9aa9c4';seg(0,P.length-1,X,Z);ctx.lineTo(X(P[0][0]),Z(P[0][1]));ctx.stroke();
  const gap=(X,Z,w)=>{if(SG&&!circIn()){ctx.lineWidth=w;ctx.strokeStyle='#0f1626';seg(R0+1,R1-1,X,Z);}}; // rail unique hors de P : circuit interrompu
  gap(X,Z,3);
  for(const u of TUN){ctx.lineWidth=3;ctx.strokeStyle='#0f1626';seg(u.a,u.b,X,Z);ctx.lineWidth=2;ctx.strokeStyle='#9aa9c4';ctx.setLineDash([3,3]);seg(u.a,u.b,X,Z);ctx.setLineDash([]);} // tunnel : tracé en pointillé
  ctx.lineWidth=3;ctx.strokeStyle='#6f9fcf';seg(TAG.st0,TAG.st1,X,Z);
  ctx.strokeStyle='#c9a45f';seg(S_LIFT0,S_LIFT1,X,Z);
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  let p=at((TAG.st0+TAG.st1)/2);lab('Gare',p[0],p[1],'#8db4dc');
  p=at((S_LIFT0+S_LIFT1)/2);lab('Lift',p[0],p[1],'#d9bd82');
  BLK.forEach((b,i)=>{const held=trains.some(t=>t.st==='run'&&t.blk&&t.v===0&&Math.abs(t.s-b)<.5),closed=zK('B'+(i+1))||held;
    ctx.lineWidth=4.5;ctx.strokeStyle=closed?'#c0584a':'#6fa585';seg(b,b+Math.max(8,TLEN*.5),X,Z);p=at(b);lab('B'+(i+1),p[0],p[1],closed?'#e08a7c':'#8fc4a4');});
  if(RA||PSB||SG){ // zones de stockage : frein final, rail mobile du parcours, frein avant gare (rouge = serrée, ambre = train retenu, vert = libre)
    const hold=id=>trains.some(t=>t.st==='run'&&t.v===0&&tZone(t)===id);
    const zs=[['Fin',S_BRK,RA||SG?R0:PSB_A,'Frein final']].concat(RA?[['RA',R0,PSB?R1:L-1,'Rail parcours']]:SG&&circIn()?[['RB',R0,PSB?R1:L-1,'Rail du pont']]:[],PSB?[['Pre',PSB_A,L-.5,'Avant gare']]:[]);
    for(const [id,a,b,nm] of zs){const k=zK(id),h=hold(id);
      ctx.lineWidth=4.5;ctx.strokeStyle=k?'#c0584a':h?'#d9a441':'#6fa585';seg(a,b,X,Z);p=at((a+b)/2);lab(nm,p[0],p[1],k?'#e08a7c':h?'#ecc275':'#8fc4a4');}
  }else{
    ctx.lineWidth=4.5;ctx.strokeStyle=zK('Fin')?'#c0584a':'#6fa585';seg(S_BRK,L-1,X,Z);p=at((S_BRK+L)/2);lab('Frein final',p[0],p[1],zK('Fin')?'#e08a7c':'#8fc4a4');
  }
  // repère du garage sur le plan
  ctx.strokeStyle='rgba(217,189,130,.7)';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.strokeRect(X(gb.x0),Z(gb.z0),(gb.x1-gb.x0)*sc,(gb.z1-gb.z0)*sc);ctx.setLineDash([]);
  // encart garage (agrandi, cadré sur la zone)
  ctx.save();ctx.beginPath();ctx.rect(px+4,iy+3,pw-8,GH+TT-2);ctx.clip();
  ctx.lineWidth=2;ctx.strokeStyle='#9aa9c4';seg(Math.max(0,SW_A-5),Math.min(P.length-1,SW_B+5),GX,GZ);gap(GX,GZ,4);
  garage(GX,GZ,2);
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  SYN.lanes.forEach((l,j)=>{const q=l[l.length-1],q0=l[Math.max(0,l.length-4)],dx=q[0]-q0[0],dz=q[1]-q0[1],d=Math.hypot(dx,dz)||1;ctx.fillStyle='#8a98b4';ctx.textAlign=Math.abs(dx/d)>.6?(dx>0?'left':'right'):'center';ctx.fillText(j+1,GX(q[0])+dx/d*5,GZ(q[1])+dz/d*8+3);});
  if(TRAV){const u=(R1-R0)/2,pt=v=>[GX(SW0.x+SW0.tx*u+SW0.vx*v),GZ(SW0.z+SW0.tz*u+SW0.vz*v)],vA=raC(),vB=devC()-GAP,qa=pt(vA),qb=pt(vB),L2=[[qb,SG?zName('RB')+(devMoving()?' en mouvement':G.dev.pos?' face à la voie '+G.dev.pos:' en ligne'):'Chariot','#d9bd82'],RA?[qa,'Rail parcours'+(raOut()?' retiré':raMoving()?' en mouvement':' en ligne'),'#a7b6d0']:null].filter(Boolean);
    const ax=Math.min(qa[0],qb[0]);for(const [q,t,c] of L2){const left=q[0]<=(RA?(qa[0]+qb[0])/2:1e9);ctx.fillStyle=c;ctx.textAlign=left?'right':'left';ctx.fillText(t,q[0]+(left?-9:9),q[1]+3);}}
  else{ctx.fillStyle='#d9bd82';ctx.textAlign='center';ctx.fillText(DEVN,GX(SW0.x),GZ(SW0.z)-7);}
  ctx.restore();
  // trains : numéro à leur position réelle (plan, et encart s'ils sont dans la zone du garage)
  ctx.font='700 '+(sm?9:10.5)+'px system-ui,sans-serif';ctx.textAlign='center';
  const mark=(t,x,y,r)=>{ctx.fillStyle=t.col;ctx.strokeStyle=cam.follow===t.i?'#fff':'rgba(10,16,28,.9)';ctx.lineWidth=cam.follow===t.i?2:1.5;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.stroke();
    const c=t.col.replace('#',''),lum=c.length>=6?(parseInt(c.slice(0,2),16)*.3+parseInt(c.slice(2,4),16)*.59+parseInt(c.slice(4,6),16)*.11):0;
    ctx.fillStyle=lum>140?'#101624':'#fff';ctx.fillText(t.i+1,x,y+3.4);SYN.hits.push({x,y,r:r+3,i:t.i});};
  for(const t of trains){const f=carFrame(t,NCARS>>1,_cf),inG=f.p.x>gb.x0&&f.p.x<gb.x1&&f.p.z>gb.z0&&f.p.z<gb.z1;
    if(t.st!=='garage')mark(t,X(f.p.x),Z(f.p.z),R);if(inG||t.st==='garage')mark(t,GX(f.p.x),GZ(f.p.z),R-1.5);}
  ctx.restore();
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
  drawSyn();
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
  const modal=!$('mHelp').classList.contains('hidden')||!$('mDay').classList.contains('hidden')||!$('mNew').classList.contains('hidden');
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
