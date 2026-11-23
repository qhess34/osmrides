'use strict';
/* ══════════ RENDU 2D — VUE AÉRIENNE SUR FOND RÉEL (OpenStreetMap) : carte, caméra, plein écran, textures ══════════ */
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
  +appel('boutonsCamera').join('') // boutons du type (suivre un train, synoptique…)
  +'<button data-act="roof" id="bRoof" title="Retirer ou remettre les toits de la gare, du poste de conduite, du garage et des abris">Toits en place</button>'
  +'<button data-act="hidest" id="bHideSt" title="Masquer complètement le bâtiment de gare et les couvertures (toits, rochers) pour voir la file dessous">Masquer la gare</button>';
(function controls(){
  const ptrs=new Map();let pinch=0,moved=0,multi=false;const free=()=>{cam.g=null;cam.follow=-1;cam.key='';};
  const gateAt=e=>{const r=cv.getBoundingClientRect(),wx=cam.x+(e.clientX-r.left-VW/2)/cam.s,wz=cam.z+(e.clientY-r.top-VH/2)/cam.s;let best=-1,bd=Math.max(2.2,(COARSE?26:14)/cam.s);
    BARS.forEach((g,i)=>{for(const q of [g.h,[(g.h[0]+g.a[0])/2,(g.h[1]+g.a[1])/2],[(g.h[0]+g.b[0])/2,(g.h[1]+g.b[1])/2]]){const d=Math.hypot(q[0]-wx,q[1]-wz);if(d<bd){bd=d;best=i;}}}); // barrières de file (issue #37) : chacune seule
    return best;};
  const scr=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}; // point de l'écran (px) ; surEcran / clicEcran : panneau dessiné par le type par-dessus la carte
  cv.addEventListener('click',e=>{appel('clicEcran',...scr(e));});
  cv.addEventListener('pointerdown',e=>{if(vrai('surEcran',...scr(e)))return;cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=0;pinch=0;if(ptrs.size>1)multi=true;});
  const up=e=>{const tap=ptrs.has(e.pointerId)&&e.type==='pointerup'&&!multi&&moved<(e.pointerType==='touch'?12:6)&&ptrs.size===1;if(ptrs.size<=1)multi=false;if(tap){const i=gateAt(e);if(i>=0)toggleBar(i);}ptrs.delete(e.pointerId);pinch=0;};
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
  rock:texture(256,'132,124,110',16,[['rgba(92,86,76,.35)',70,3,14],['rgba(176,168,150,.3)',60,2,10],['rgba(70,64,56,.25)',30,1,4]]),
  water:texture(256,'62,104,126',6,[['rgba(84,130,150,.3)',50,6,24],['rgba(44,82,104,.3)',40,6,22]])};
TEX.rows=(()=>{const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,2,1);const p=ctx.createPattern(c,'repeat');p.setTransform(new DOMMatrix().scale(.25));return p;})();
const SHX=.55,SHZ=.42;
// Rochers OSM (natural=rock|stone fermé) : massif dessiné en relief au-dessus de la voie et des chemins qui le traversent en tunnel (voir ROCKS plus bas)
const ROCKP=OSM.feats.filter(f=>f.c&&f.p.length>3&&/^natural=(rock|stone)$/.test(f.k)).map(f=>f.p);
const pipXZ=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;};
// hauteur d'un bâtiment (m) : OSM (height, building:levels × 3 m, f.bh de tools/make_site.py), sinon par type ESTIMÉE
const BLD_H=(k,f)=>f&&f.bh||(k==='building=roof'?4:k==='building=hotel'?12:7);
