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
// Tags OSM transportés par un objet importé (f.t = {clé: valeur brute}, format : docs/ref/decor.md « Tags OSM transportés ») ; absent : null
const tagOf=(f,k)=>f&&f.t&&f.t[k]!=null&&f.t[k]!==''?String(f.t[k]):null;
const numOf=(f,k)=>{const v=parseFloat(tagOf(f,k));return isFinite(v)?v:null;}; // « 8 », « 8 m », « 8.5 » -> nombre
// niveau OSM relatif d'un objet (ordre vertical, issue #68) : layer, sinon level (« -1;0 » : le plus bas), sinon f.lv (ancien format), sinon null (inconnu)
const lvOf=f=>{for(const k of ['layer','level']){const v=tagOf(f,k);if(v!=null){const n=Math.min(...v.split(';').map(parseFloat).filter(isFinite));if(isFinite(n))return n;}}return f&&typeof f.lv==='number'?f.lv:null;};
// hauteur d'un bâtiment (m) : OSM (height, building:levels × 3 m ; f.t, sinon f.bh de tools/make_site.py), sinon par type ESTIMÉE
const BLD_H=(k,f)=>numOf(f,'height')||(numOf(f,'building:levels')||0)*3||f&&f.bh||(k==='building=roof'?4:k==='building=hotel'?12:7);
// couleur OSM (roof:colour, colour) : #rgb / #rrggbb tels quels, sinon nom courant ramené à une teinte sourde ; valeur multiple (« white;red ») : la première ; inconnue : null
const OSM_COL={grey:'#8a8f96',gray:'#8a8f96',darkgrey:'#5f6368',darkgray:'#5f6368',lightgrey:'#b4b6b4',lightgray:'#b4b6b4',silver:'#a9adb0',white:'#d8d6d0',black:'#3c3c3a',
  red:'#9a4a3c',brown:'#7a5a44',maroon:'#6e3d33',orange:'#b0694a',beige:'#c8b996',tan:'#b9a27a',yellow:'#c2a85a',green:'#5f7458',blue:'#56687a'};
const colOf=v=>{if(!v)return null;v=String(v).split(';')[0].trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(v))return v;if(/^#[0-9a-f]{3}$/.test(v))return '#'+[1,2,3].map(i=>v[i]+v[i]).join('');return OSM_COL[v.replace(/[\s_-]/g,'')]||null;};
// Toit d'un bâtiment lu dans OSM (issue #68) : roof:shape (flat, gabled, hipped ; autre forme : plat), roof:orientation (along : faîtage dans le sens de la plus grande
// longueur, défaut OSM ; across : en travers), roof:height (sinon roof:angle ; sinon pente de 30° ESTIMÉE, ombrage seul). Géométrie en plan sur le rectangle d'emprise
// minimal du polygone : centre c, sens du faîtage d, demi-longueur hl, demi-largeur hw, faîtage ridge, pans {P, n (normale horizontale), sl (pente, rad)}. Sans roof:shape : null.
function roofGeom(pts,f){const sh=tagOf(f,'roof:shape');if(!sh)return null;const P=pts.length>1&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1]?pts.slice(0,-1):pts;
  let best=null;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.01)continue;const u=[(b[0]-a[0])/l,(b[1]-a[1])/l],v=[-u[1],u[0]];
    let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;for(const q of P){const pu=q[0]*u[0]+q[1]*u[1],pv=q[0]*v[0]+q[1]*v[1];u0=Math.min(u0,pu);u1=Math.max(u1,pu);v0=Math.min(v0,pv);v1=Math.max(v1,pv);}
    const ar=(u1-u0)*(v1-v0);if(!best||ar<best.ar-1e-6)best={ar,u,v,cu:(u0+u1)/2,cv:(v0+v1)/2,lu:(u1-u0)/2,lv:(v1-v0)/2};}
  if(!best)return null;const B=best,c=[B.u[0]*B.cu+B.v[0]*B.cv,B.u[1]*B.cu+B.v[1]*B.cv],longU=B.lu>=B.lv,along=tagOf(f,'roof:orientation')!=='across';
  const d=longU===along?B.u:B.v,e=[-d[1],d[0]],hl=longU===along?B.lu:B.lv,hw=longU===along?B.lv:B.lu;
  const g={shape:sh==='gabled'||sh==='hipped'?sh:'flat',c,d,hl,hw,rh:0,ridge:null,pans:[]};if(g.shape==='flat')return g;
  const ang=numOf(f,'roof:angle');g.rh=numOf(f,'roof:height')||(ang?hw*Math.tan(ang*Math.PI/180):hw*Math.tan(Math.PI/6));const sl=Math.atan2(g.rh,hw);
  const at=(a,b)=>[c[0]+d[0]*a+e[0]*b,c[1]+d[1]*a+e[1]*b],rl=g.shape==='hipped'?Math.max(0,hl-hw):hl,M=1.5; // M : marge (le dessin est découpé par le polygone)
  g.ridge=[at(-rl,0),at(rl,0)];
  if(g.shape==='gabled'){for(const s of [-1,1])g.pans.push({P:[at(-hl-M,0),at(hl+M,0),at(hl+M,s*(hw+M)),at(-hl-M,s*(hw+M))],n:[e[0]*s,e[1]*s],sl});}
  else{for(const s of [-1,1]){g.pans.push({P:[at(-rl,0),at(rl,0),at(hl+M,s*(hw+M)),at(-hl-M,s*(hw+M))],n:[e[0]*s,e[1]*s],sl});
    g.pans.push({P:[at(s*rl,0),at(s*(hl+M),hw+M),at(s*(hl+M),-hw-M)],n:[d[0]*s,d[1]*s],sl:Math.atan2(g.rh,Math.max(.1,hl-rl))});}}
  return g;}
