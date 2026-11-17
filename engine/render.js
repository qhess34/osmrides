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
  +'<button data-act="roof" id="bRoof" title="Retirer ou remettre les toits de la gare, du poste de conduite, du garage et des abris">Toits en place</button>'
  +'<button data-act="hidest" id="bHideSt" title="Masquer complètement le bâtiment de gare et les couvertures (toits, rochers) pour voir la file dessous">Masquer la gare</button>';
(function controls(){
  const ptrs=new Map();let pinch=0,moved=0,multi=false;const free=()=>{cam.g=null;cam.follow=-1;cam.key='';};
  const gateAt=e=>{const r=cv.getBoundingClientRect(),wx=cam.x+(e.clientX-r.left-VW/2)/cam.s,wz=cam.z+(e.clientY-r.top-VH/2)/cam.s;let best=-1,bd=Math.max(2.2,(COARSE?26:14)/cam.s);
    LOOPS.forEach((l,i)=>{for(const g of l.gs)if(!g.off)for(const q of [g.h,[(g.h[0]+g.a[0])/2,(g.h[1]+g.a[1])/2],[(g.h[0]+g.b[0])/2,(g.h[1]+g.b[1])/2]]){const d=Math.hypot(q[0]-wx,q[1]-wz);if(d<bd){bd=d;best=i;}}});
    if(!ENTRY_GATE.off){const g=ENTRY_GATE,d=Math.min(Math.hypot(g.h[0]-wx,g.h[1]-wz),Math.hypot((g.h[0]+g.a[0])/2-wx,(g.h[1]+g.a[1])/2-wz),Math.hypot((g.h[0]+g.b[0])/2-wx,(g.h[1]+g.b[1])/2-wz));if(d<bd)best=-2;}
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
  rock:texture(256,'132,124,110',16,[['rgba(92,86,76,.35)',70,3,14],['rgba(176,168,150,.3)',60,2,10],['rgba(70,64,56,.25)',30,1,4]]),
  water:texture(256,'62,104,126',6,[['rgba(84,130,150,.3)',50,6,24],['rgba(44,82,104,.3)',40,6,22]])};
TEX.rows=(()=>{const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,2,1);const p=ctx.createPattern(c,'repeat');p.setTransform(new DOMMatrix().scale(.25));return p;})();
const SHX=.55,SHZ=.42;

// Voie découpée en tronçons triés par hauteur (croisements dessus/dessous)
const TRO=Object.assign({lo:[150,156,164],hi:[198,204,210],edge:'#4a4f57',deck:'#565c65',rim:'#2f3339',shine:'rgba(255,255,255,.2)'},SITE.trough); // couleurs de la gouttière (bob), réglables par SITE.trough
// Coaster inversé (SITE.kind 'inverted') : poutre caisson en acier, deux rails de roulement, portiques de supports au-dessus de la voie, trains suspendus dessous.
// Couleurs par SITE.track = {spine, rail, support} (défaut : teintes acier sourdes).
// Coaster acier assis à rails tubulaires (SITE.kind 'steel') : deux rails tubulaires de roulement reliés par des entretoises, supports tubulaires en
// A au-dessus de 1,5 m (jambes écartées avec la hauteur), train posé sur la voie. Couleurs par SITE.track = {spine, rail, support}.
const TKC=Object.assign(STL?{spine:'#a88a2e',rail:'#c9a83c',support:'#8c3a2b'}:{spine:'#4a5d72',rail:'#2e3640',support:'#8c8577'},SITE.track),SUPW=2.3,WOODY=!BOB&&!INV&&!STL;
// Rochers OSM (natural=rock|stone fermé) : massif dessiné en relief au-dessus de la voie et des chemins qui le traversent en tunnel (voir ROCKS plus bas)
const ROCKP=OSM.feats.filter(f=>f.c&&f.p.length>3&&/^natural=(rock|stone)$/.test(f.k)).map(f=>f.p);
const pipXZ=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;};
// tronçons du circuit en tunnel (OSM.tunnels, tunnels ESTIMÉS de SITE.tunnels). Tunnel sous un rocher (propriétaire, Trace du Hourra, 2026-11-16, lot 4 : les deux niveaux
// de voie passent DANS le rocher) : prolongé jusqu'aux bords du rocher (le tronçon OSM tagué tunnel peut être plus court que la traversée), portails au bord de la roche.
// Une voie sans aucun tunnel dans un rocher passe PAR-DESSUS (supports posés sur le rocher) : cas gardé pour un rocher OSM traversé sans tag tunnel.
const rockExt=t=>{const at=s=>{const q=TR[((Math.round(s/DS)%N)+N)%N].p;return ROCKP.find(P=>pipXZ(P,q.x,q.z));},R=at((t[0]+t[1])/2)||at(t[0])||at(t[1]);if(!R)return [t[0],t[1]];
  const inR=s=>{const q=TR[((Math.round(s/DS)%N)+N)%N].p;return pipXZ(R,q.x,q.z);};let a=t[0],b=t[1];while(a>t[0]-40&&inR(a-DS))a-=DS;while(b<t[1]+40&&inR(b+DS))b+=DS;return [a,b];};
const TUNS=(OSM.tunnels||[]).map(t=>rockExt(t)).concat((SITE.tunnels||[]).filter(c=>c.s).map(c=>rockExt(c.s))),inTunS=s=>TUNS.some(t=>s>=t[0]-1&&s<=t[1]+1);
const chunkH=new Float32Array(N+1),chunks=[],dirtP=new Path2D,wid=h=>BOB?1.5:INV?SUPW:h>ST_Y+.6?1.6+h*.2:1.85,DECKW=BOB?2.3:INV?1.05:STL?1.5:3.1;
// Bâtiment survolé par la voie (propriétaire, issue #14 : Au Dolmen Gourmand sous le lift de la Trace du Hourra) : quand la voie passe au-dessus de son emprise
// plus haut que lui partout (hauteur OSM `height`, sinon `building:levels` × 3 m, f.bh de tools/make_site.py ; sinon 7 m ESTIMÉ, 4 m un auvent, 12 m un hôtel),
// il est dessiné SOUS la voie, ses supports, les passerelles de service et les trains (drawWorld), l'ombre de la voie et des trains tombe sur son toit et les
// poteaux qui tombent dans son emprise sont posés sur le toit (raccourcis : supports moins écartés, ombre depuis le toit). Sinon l'ordre est inchangé.
// La gare, les toits effaçables (SITE.fade) et les bâtiments qui couvrent un chemin couvert gardent leur comportement.
const BLD_H=(k,f)=>f&&f.bh||(k==='building=roof'?4:k==='building=hotel'?12:7),ROOFB=(()=>{
  const near=(m,q)=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2],cv=(OSM.feats||[]).filter(f=>f.cv).map(f=>f.p),clr=INV?3.2:.4,hw=DECKW/2;
  const cand=(OSM.feats||[]).filter(f=>f.k.startsWith('building')&&f.c&&f.p.length>3).map(f=>({p:f.p,h:BLD_H(f.k,f)})).concat((SITE.buildings||[]).map(b=>({p:b.p,h:b.h||7})));
  return cand.filter(b=>{const m=[0,0];for(const q of b.p){m[0]+=q[0]/b.p.length;m[1]+=q[1]/b.p.length;}if(near(m,SITE.stationAt)||(SITE.fade||[]).some(q=>near(m,q))||cv.some(P=>P.some(q=>pipXZ(b.p,q[0],q[1]))))return false;
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of b.p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}b.bb=[x0,x1,z0,z1];
    let hit=0;for(let i=0;i<N;i++){const f=TR[i],q=f.p;if(q.x<x0-hw||q.x>x1+hw||q.z<z0-hw||q.z>z1+hw)continue;
      for(const e of [-hw,0,hw])if(pipXZ(b.p,q.x+f.R.x*e,q.z+f.R.z*e)){if(q.y<b.h+clr)return false;hit=1;}}
    return hit;});})(),roofH=(x,z)=>{for(const b of ROOFB)if(x>b.bb[0]&&x<b.bb[1]&&z>b.bb[2]&&z<b.bb[3]&&pipXZ(b.p,x,z))return b.h;return 0;};
// Gouttière étroite d'un bob (propriétaire, issue #6, générique kind:'bob') : là où la voie n'est pas inclinée — gare (st0 → st1 et toute la longueur des quais), lift (lift0 → lift1),
// zones de freinage (freins de bloc : patins BZ0 → point d'arrêt et train arrêté derrière ; frein final S_BRK → S_HOLD ; frein avant gare ; rail du pont droit R0 → R1)
// et voies de garage — la gouttière est rétrécie au gabarit du wagon (demi-largeur SITE.car.w/2 + BOB_RIM, engine/garage.js, ESTIMÉ) : le train touche le quai.
// Raccord progressif (courbe en S) sur TRN m à chaque extrémité. TRF(s) = facteur de largeur (1 = gouttière inclinée du parcours, demi-largeur 1,15 m). TRN = 3 m, ESTIMÉ.
const TRN=3,TRGAP=2*TRN+4,TRFN=BOB?Math.min(1,((SITE.car.w||.95)/2+BOB_RIM)/(DECKW/2)):1,TRF=(()=>{if(!BOB)return ()=>1;const Q=Object.assign({back:1.5,front:1.6},SITE.plat),fn=TRFN,
  R=[[Math.min(TAG.st0||0,S_ST-TLEN-Q.back),Math.max(TAG.st1!=null?TAG.st1:S_ST,S_ST+Q.front)]];
  R.push([S_LIFT0,S_LIFT1]);BLK.forEach((b,i)=>R.push([Math.min(BZ0[i],b-TLEN),b+.5]));
  if(TAG.brk!=null)R.push([S_BRK,Math.max(S_HOLD,TRAV?R1:S_HOLD)+.5]);if(TRAV)R.push([R0-.5,R1+.5]);if(PSB)R.push([Math.min(PSB_A,S_PSB-TLEN),S_PSB+.5]);
  // Zones étroites rapprochées (propriétaire, 2026-11-17) : si l'écart entre deux zones étroites est inférieur à TRGAP, la gouttière reste étroite entre elles
  // (pas de court renflement à pleine largeur entre deux raccords en S). TRGAP = 2 raccords + 4 m = 10 m, ESTIMÉ.
  const I=R.map(r=>{const a=((r[0]%L)+L)%L;return [a,a+(r[1]-r[0])];}).sort((p,q)=>p[0]-q[0]),J=[];
  for(const r of I){const c=J[J.length-1];if(c&&r[0]-c[1]<TRGAP)c[1]=Math.max(c[1],r[1]);else J.push(r.slice());}
  if(J.length>1){const a=J[J.length-1],b=J[0];if(b[0]+L-a[1]<TRGAP){b[0]=a[0]-L;b[1]=Math.max(b[1],a[1]-L);J.pop();}} // écart à cheval sur l'origine du circuit
  const M=J.map(r=>[(r[0]+r[1])/2,(r[1]-r[0])/2]);
  return s=>{let d=1e9;for(const m of M){const e=Math.abs(((s-m[0])%L+L*1.5)%L-L/2)-m[1];if(e<d)d=e;}if(d<=0)return fn;if(d>=TRN)return 1;const k=d/TRN;return fn+(1-fn)*k*k*(3-2*k);};})();
function strip(sm){
  const o={h:0,sw:0,deck:new Path2D,spine:new Path2D,rail:new Path2D,hand:new Path2D,ties:new Path2D,str:new Path2D,sh:new Path2D,shb:new Path2D,rp:null,ch:null,bu:[],x0:1e9,x1:-1e9,z0:1e9,z1:-1e9},n=sm.length;
  const yg=q=>q.y-roofH(q.x,q.z),SB=q=>roofH(q.x,q.z); // yg : hauteur au-dessus du sol ou du toit d'un bâtiment survolé (ROOFB) ; SB : hauteur du pied du poteau (son ombre part de là)
  const side=(path,off,fn)=>sm.forEach((q,i)=>{const k=fn?fn(yg(q))*off:off,x=q.x+q.nx*k,z=q.z+q.nz*k;i?path.lineTo(x,z):path.moveTo(x,z);});
  let hs=0,uy=0;
  sm.forEach((q,i)=>{
    const sx=q.x+q.y*SHX,sz=q.z+q.y*SHZ;hs+=q.y;uy+=q.uy==null?1:q.uy;
    {const sp=STL?.42:0,x=q.x-(q.ux||0)*sp,z=q.z-(q.uz||0)*sp;i?o.spine.lineTo(x,z):o.spine.moveTo(x,z);} // poutre (tube central sous les rails) : vue du dessus, elle se déporte quand la voie pivote (vrilles, loopings)
    o.x0=Math.min(o.x0,q.x-9);o.x1=Math.max(o.x1,sx+9);o.z0=Math.min(o.z0,q.z-9);o.z1=Math.max(o.z1,sz+9);
    if(i){o.deck.lineTo(q.x,q.z);o.sh.lineTo(sx,sz);}else{o.deck.moveTo(q.x,q.z);o.sh.moveTo(sx,sz);}
    if(ROCKP.length&&q.i%4===0&&i<n-1&&sm.trk&&!inTunS(q.i*DS)&&ROCKP.some(P=>pipXZ(P,q.x,q.z))){ // voie qui passe AU-DESSUS d'un rocher : traverse et deux poteaux posés sur le rocher, dessinés avec le tronçon
      const w=(INV?SUPW:BOB?1.25:wid(q.y)*.7)+.15;o.rp=o.rp||new Path2D;o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      for(const e of [-1,1])o.rp.rect(q.x+q.nx*w*e-.22,q.z+q.nz*w*e-.22,.44,.44);}
    if(WOODY&&q.i%2===1){o.ties.moveTo(q.x-q.nx*.9,q.z-q.nz*.9);o.ties.lineTo(q.x+q.nx*.9,q.z+q.nz*.9);}
    if(STL){if(q.i%3===0){o.ties.moveTo(q.x-q.nx*.62,q.z-q.nz*.62);o.ties.lineTo(q.x+q.nx*.62,q.z+q.nz*.62);} // entretoises entre les deux rails tubulaires
      if(i<n-1&&q.i%10===0&&q.y>ST_Y+1.5){const sp=.55+Math.min(yg(q),40)*.07,gb=SB(q); // support en A : deux jambes qui s'écartent vers le sol, traverse à mi-hauteur
        for(const e of [-1,1]){const bx=q.x+q.nx*sp*e,bz=q.z+q.nz*sp*e;o.str.moveTo(q.x+q.nx*.45*e,q.z+q.nz*.45*e);o.str.lineTo(bx,bz);o.shb.moveTo(bx+gb*SHX,bz+gb*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}
        o.hand.moveTo(q.x-q.nx*sp*.7,q.z-q.nz*sp*.7);o.hand.lineTo(q.x+q.nx*sp*.7,q.z+q.nz*sp*.7);}}
    if(STL){}else if(INV){if(i<n-1&&q.i%13===0&&q.y>ST_Y+1.5){const e=(q.i/13)%2?1:-1,w=SUPW*e,tx=q.nz,tz=-q.nx,bx=q.x+q.nx*w,bz=q.z+q.nz*w; // support en potence : poteau d'un côté (alterné), bras au-dessus de la voie
      o.str.moveTo(bx,bz);o.str.lineTo(q.x-q.nx*.6*e,q.z-q.nz*.6*e);o.hand.moveTo(bx-tx*.35,bz-tz*.35);o.hand.lineTo(bx+tx*.35,bz+tz*.35);o.shb.moveTo(bx+SB(q)*SHX,bz+SB(q)*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
    else if(i<n-1&&q.i%(BOB?12:6)===0){const w=wid(yg(q))*(BOB?sm.trk?TRF(q.i*DS):TRFN:1);o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      if(!BOB&&q.y>7.5&&i+6<n){const b=sm[i+6],w2=wid(yg(b)),e=(q.i/6)%2?1:-1;o.str.moveTo(q.x-q.nx*w*e,q.z-q.nz*w*e);o.str.lineTo(b.x+b.nx*w2*e,b.z+b.nz*w2*e);}
      for(const sg of (BOB?[0]:[-1.25,1.25])){const bx=q.x+q.nx*sg,bz=q.z+q.nz*sg,gb=SB(q);o.shb.moveTo(bx+gb*SHX,bz+gb*SHZ);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
  });
  if(BOB){const f=sm.map(q=>sm.trk?TRF(q.i*DS):TRFN); // voies de garage (hors circuit) : étroites
    if(f.some(v=>v<.999)){ // tronçon de gare, de freinage, de garage (ou de raccord) : gouttière en polygones de largeur variable (TRF), dessinée par remplissage
      const poly=W=>{const p=new Path2D;sm.forEach((q,i)=>{const k=W*f[i];i?p.lineTo(q.x-q.nx*k,q.z-q.nz*k):p.moveTo(q.x-q.nx*k,q.z-q.nz*k);});
        for(let i=n-1;i>=0;i--){const q=sm[i],k=W*f[i];p.lineTo(q.x+q.nx*k,q.z+q.nz*k);}p.closePath();return p;};
      o.lay=[poly(DECKW/2),poly(1),poly(.45)];for(const e of [-1,1])sm.forEach((q,i)=>{const k=1.02*e*f[i],x=q.x+q.nx*k,z=q.z+q.nz*k;i?o.rail.lineTo(x,z):o.rail.moveTo(x,z);});}
    else{side(o.rail,-1.02);side(o.rail,1.02);}} // bords de la gouttière
  else if(INV){side(o.rail,-.5);side(o.rail,.5);} // rails de roulement de part et d'autre de la poutre caisson
  else if(STL){side(o.rail,-.62);side(o.rail,.62);} // deux rails tubulaires
  else{side(o.rail,-.6);side(o.rail,.6);side(o.hand,-1.5);side(o.hand,1.5);side(o.str,-1,wid);side(o.str,1,wid);}
  o.h=hs/n;o.inv=uy/n<0;const k=clamp(o.h/30,0,1); // o.inv : tronçon tête en bas (la poutre passe au-dessus des rails)o.col=BOB?`rgb(${lerp(TRO.lo[0],TRO.hi[0],k)|0},${lerp(TRO.lo[1],TRO.hi[1],k)|0},${lerp(TRO.lo[2],TRO.hi[2],k)|0})`:`rgb(${lerp(172,198,k)|0},${lerp(146,170,k)|0},${lerp(104,124,k)|0})`;
  return o;
}
const BZ=[],LCH=[]; // zones de freinage dessinées : {id, r0, r1, drive} ; LCH[j] : tronçon dessiné de la voie de garage j
(function buildChunks(){
  for(let i=0;i<=N;i++){const p=TR[i%N].p;i?dirtP.lineTo(p.x,p.z):dirtP.moveTo(p.x,p.z);}
  const iA=Math.round(SW_A/DS),iB=Math.round(SW_B/DS),cuts=new Set([iA,iB,N]);for(let i=0;i<N;i+=8)cuts.add(i);
  const cl=[...cuts].sort((a,b)=>a-b);
  for(let c=0;c<cl.length-1;c++){const sm=[];
    for(let i=cl[c];i<=cl[c+1];i++){const f=TR[i%N];sm.push({x:f.p.x,y:f.p.y,z:f.p.z,nx:f.R.x,nz:f.R.z,ux:f.U.x,uz:f.U.z,uy:f.U.y,i});} // R projeté (non normalisé) : vue du dessus, la voie qui pivote (dévers, vrilles, loopings) se resserre, largeur ∝ |cos θ|
    sm.trk=1;const o=strip(sm);o.sw=cl[c]>=iA&&cl[c+1]<=iB?1:0;chunks.push(o);
    if(!o.sw&&cl[c+1]!==iA){const a=TR[cl[c+1]%N].p,f=TR[(cl[c+1]+1)%N].p;o.deck.lineTo((a.x+f.x)/2,(a.z+f.z)/2);}
    for(let i=cl[c];i<cl[c+1];i++)chunkH[i]=o.h;}
  // tronçon en S (mobile) et voie de garage
  const grow=o=>{const e=CMAX+GAP+3;o.x0-=e;o.x1+=e;o.z0-=e;o.z1+=e;return o;}; // tronçons portés : visibles sur toute la course
  if(TRAV){ // pont droit : rail B porté par le chariot (décalé de devC()-GAP), voies droites fixes ; le rail A est le tronçon du circuit (sw)
    chunks.forEach(o=>{if(o.sw)grow(o);});
    const line=(u0,u1,v)=>{const q=[],n=Math.max(1,Math.ceil((u1-u0)/.5-.02));for(let k=0;k<=n;k++){const u=u0+(u1-u0)*k/n;q.push({x:SW0.x+SW0.tx*u-SW0.vx*v,y:ST_Y,z:SW0.z+SW0.tz*u-SW0.vz*v,nx:-SW0.tz,nz:SW0.tx,i:q.length});}return q;};
    if(!SG){const rb=strip(line(0,R1-R0,0));rb.rb=1;chunks.push(grow(rb));} // rail unique (SG) : le tronçon du circuit est le seul rail porté
    // Voies fixes dessinées jusqu'au bout du rail porté (issue #16, propriétaire : « pas continus ») : comme le circuit, la voie fixe s'arrête à 4 cm du rail du chariot
    // (u = R1-R0 ou 0) et le tablier passe dessous ; le jeu de la simulation (yard.laneGap, U_LANE) est inchangé, seul le dessin comble l'écart.
    LANES.forEach((ln,j)=>{const o=strip(LREV?line(laneU(ln.end),-.04,ln.d):line(R1-R0+.04,ln.end,ln.d));LCH[j]=o;chunks.push(o);}); // yard.rev : voies en amont du chariot
  }else LANES.forEach((ln,j)=>{const GP=ln.path,gs=GP.map((q,i)=>{const a=GP[Math.max(0,i-1)],b=GP[Math.min(GP.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:q.x,y:ST_Y,z:q.z,nx:-(b.z-a.z)/l,nz:(b.x-a.x)/l,i};});
    const nl=LBK?Math.round(ln.link/.5):36,sP=strip(gs.slice(0,nl+1));sP.lk=j+1;LCH[j]=strip(gs.slice(nl));LCH[j].nl=nl;chunks.push(sP,LCH[j]);});
  // Chaîne du lift et équipements de freinage : rattachés à leur tronçon (dessinés avec lui), donc toujours SOUS les trains qui y passent et sous les voies plus hautes
  const cOf=new Int32Array(N+1);for(let c=0;c<cl.length-1;c++)for(let i=cl[c];i<cl[c+1];i++)cOf[i]=c;
  const lc0=Math.round(S_LIFT0/DS),lc1=Math.round((S_LIFT1+3)/DS);
  for(let c=0;c<cl.length-1;c++){const a=Math.max(cl[c],lc0),b=Math.min(cl[c+1],lc1);if(a>=b)continue;const P=new Path2D;for(let i=a;i<=b;i++){const p=TR[i%N].p;i>a?P.lineTo(p.x,p.z):P.moveTo(p.x,p.z);}chunks[c].ch=P;}
  const zc=id=>ZONES.find(z=>z.id===id)||{};
  // zones de freinage dessinées (gare, freins de bloc ≈ 9 m de patins avant le point d'arrêt (estimé), frein final, rail du circuit du pont droit, frein avant gare) ; moteurs : SITE.zones … drive
  BZ.push({id:'St',r0:S_ST-TLEN+.4,r1:S_ST-.2});BLK.forEach((b,i)=>BZ.push({id:'B'+(i+1),r0:BZ0[i],r1:b}));
  BZ.push({id:'Fin',r0:S_BRK+3,r1:TRAV?S_PRE+.4:S_HOLD});if(TRAV)BZ.push({id:ZR,r0:R0+.3,r1:R1-.3});if(PSB)BZ.push({id:'Pre',r0:PSB_A+1,r1:S_PSB});
  if(TRAV&&!SG)BZ.push({id:'RB',r0:0,r1:0,car:1});
  for(const z of BZ)z.drive=!!zc(z.id).drive;
  LANES.forEach((_,j)=>BZ.push({id:'L'+(j+1),lane:j,drive:true})); // voies de garage : freins et pneus (Dispatch) sur toute la voie, comme le circuit (issue #16 ; disposition ESTIMÉE)
  const onDev=s=>!TRAV&&s>SW_A-1&&s<SW_B+1; // rien sur l'aiguillage lui-même (tronçon mobile)
  for(const z of BZ){let k=0;const add=(o,u)=>{u.id=z.id;u.ty=z.drive&&k%2===1;o.bu.push(u);k++;};
    if(z.lane!=null){const ln=LANES[z.lane],P=ln.path,o=LCH[z.lane];if(!o)continue; // voie : de son entrée (TRAV : U_LANE ; aiguillage : après le tronçon mobile) au heurtoir
      for(let i=TRAV?0:o.nl+1;i<P.length-1;i+=3){const q=P[i];if(TRAV&&(q.d<U_LANE+.3||q.d>ln.end-.6))continue;const a=P[Math.max(0,i-1)],b=P[i+1],l=Math.hypot(b.x-a.x,b.z-a.z)||1,tx=(b.x-a.x)/l,tz=(b.z-a.z)/l;
        add(o,{x:q.x,z:q.z,nx:-tz,nz:tx,tx,tz});}continue;}
    if(z.car){const rb=chunks.find(o=>o.rb);for(let u=.6;u<R1-R0-.3;u+=1.5)add(rb,{x:SW0.x+SW0.tx*u,z:SW0.z+SW0.tz*u,nx:-SW0.tz,nz:SW0.tx,tx:SW0.tx,tz:SW0.tz});continue;} // rail du chariot (pont droit à deux rails)
    for(let i=Math.round(z.r0/DS);i<Math.round(z.r1/DS);i+=3){const ii=((i%N)+N)%N;if(onDev(ii*DS))continue;const f=TR[ii],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(f.T.x,f.T.z)||1;
      add(chunks[cOf[ii]],{x:f.p.x,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:f.T.x/tl,tz:f.T.z/tl});}}
})();
const swz=o=>o.sw===1?raC():o.rb?devC()-GAP:o.lk?devC()-OFF[o.lk]:0; // déplacement des tronçons portés par le chariot (circuit, transfert vers la voie lk), le long de (SW0.vx, SW0.vz)
const rotC=()=>Math.cos(Math.PI*clamp(devC()/(SW_D||1),0,1)); // appareil rotatif : cos θ, θ = 0 sur le circuit, π sur la voie
const devHide=o=>o.lk&&YD.device==='table'&&o.lk!==devShown()||ROT&&(o.sw===1?rotC()<0:o.lk?rotC()>0:false)||ROT&&o.lk&&o.lk!==devShown();
// décalage ou rotation des tronçons portés par l'appareil ; rend true si un ctx.save() a été fait
function swPush(o){
  if(ROT){const c=(o.sw===1?rotC():o.lk?-rotC():1);if(c===1)return false;const a=1+(c-1)*SW0.vx*SW0.vx,b=(c-1)*SW0.vx*SW0.vz,d=1+(c-1)*SW0.vz*SW0.vz;
    ctx.save();ctx.translate(SW0.x,SW0.z);ctx.transform(a,b,b,d,0,0);ctx.translate(-SW0.x,-SW0.z);return true;} // un rail qui tourne autour de son axe vu du dessus : largeur ∝ cos θ
  const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);return true;}return false;} // pont transbordeur : un seul tronçon de transfert, celui de la voie visée

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
const LY={water:[],canal:[],lawn:[],forest:[],dirt:[],asph:[],foot:[],footA:[],road:[],hedge:[],bld:[],pier:[]},trees=[],FOOT=[],PLACES=[],otherP=(OSM.others||[]).map(p=>mkPath(p));
let tunnelP=null,tunnelC=[5,98];const WATERPTS=[],COV=[],COVP=new Path2D; // COV/COVP : chemins couverts OSM (passages sous la gare…), redessinés quand le toit s'efface
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
  COV.push(...OSM.feats.filter(f=>f.cv).map(f=>f.p));for(const P of COV)COVP.addPath(mkPath(P));const pin=(P,x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const addBld=(pts,o)=>{const m=cen(pts),lit=new Path2D,dark=new Path2D;let ar=0;
    for(let j=0;j<pts.length-1;j++)ar+=pts[j][0]*pts[j+1][1]-pts[j+1][0]*pts[j][1];
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],sg=ar>0?1:-1,nx=(b[1]-a[1])*sg,nz=-(b[0]-a[0])*sg,pp=nx*-.8+nz*-.6>0?lit:dark;pp.moveTo(a[0],a[1]);pp.lineTo(b[0],b[1]);}
    const near=q=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2];
    const b=Object.assign({p:mkPath(pts,true),m,lit,dark,st:near(SITE.stationAt),h:7,canopy:false,fade:(SITE.fade||[]).some(near),cvb:COV.some(P=>P.some(q=>pin(pts,q[0],q[1])))},o); // cvb : couvre un chemin couvert, effacé seulement par « Masquer la gare »
    if(!b.cvb&&(b.canopy||SHP.some(q=>pin(pts,q[0],q[1]))))b.fade=b.ab=true; // abri (issue #15) : auvent OSM building=roof, ou bâtiment au-dessus de la file ou du quai : s'efface comme les toits SITE.fade
    LY.bld.push(b);};
  // points de la file (tronçons, liaison) et des quais, tous les 1 m : un bâtiment qui en recouvre un est un abri
  const SHP=[];{const add=P=>{for(let i=1;i<P.length;i++){const a=P[i-1],c=P[i],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])));for(let k=0;k<=n;k++)SHP.push([a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n]);}};
    for(const g of SEGS)add(g.P);add((QS.link||[]).concat([ENTRY0]));const PQ=Object.assign({load:7.9,exit:0},SITE.plat);
    for(const B of BAYS)for(const l of [PQ.load/2,PQ.load-.3,-PQ.exit/2])if(l)SHP.push([B.x+B.rx*l,B.z+B.rz*l]);}
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
    else if(k==='highway=footway'||k==='highway=pedestrian'||k==='highway=steps'){
      if(k==='highway=pedestrian'&&c)LY.footA.push(p);else if(!f.in&&k!=='highway=steps'&&!f.br)LY.foot.push(...(c?[p]:cutStairs(f.p).map(q=>mkPath(q)))); // escaliers (drawSteps) et passerelles (drawBridge) dessinés à part // f.in : chemin fondu dans une zone piétonne (non dessiné, les promeneurs le suivent encore)
      if(k==='highway=footway'&&!c&&!(SITE.noStroll||[]).some(q=>Math.hypot(f.p[0][0]-q[0],f.p[0][1]-q[1])<1.5))stroll(f.p);}
    else if(k==='highway=service'||k==='highway=unclassified'||k==='highway=track')LY.road.push(p);
    else if(k==='barrier=hedge'||k==='natural=tree_row')LY.hedge.push(p);
    else if(k==='man_made=tunnel'){if(!tunnelP){tunnelP=new Path2D;tunnelC=cen(f.p);}tunnelP.addPath(p);} // plusieurs polygones man_made=tunnel possibles ; étiquette sur le premier
    else if(k.startsWith('building'))addBld(STATION_GROW&&SITE.stationAt&&(c=>Math.hypot(c[0]-SITE.stationAt[0],c[1]-SITE.stationAt[1])<SITE.stationAt[2])(cen(f.p))?STATION_GROW:f.p,{ // gare agrandie à ses quais (STATION_GROW, engine/garage.js)
      col:ROOFS[i%ROOFS.length],h:BLD_H(k,f),canopy:k==='building=roof',un:ROOFB.some(r=>r.p===f.p)});
  });
  for(const p of SITE.paths||[]){LY.foot.push(...cutStairs(p).map(q=>mkPath(q)));stroll(p);}          // allées ajoutées par la configuration
  for(const b of SITE.buildings||[])addBld(b.p,Object.assign({col:'#8a8f96',un:ROOFB.some(r=>r.p===b.p)},b)); // bâtiments ajoutés par la configuration
  // arbres : dans les bois cartographiés + arbres isolés relevés
  ctx.setTransform(1,0,0,1,0,0);
  const col=()=>({c:`rgb(${rnd(34,56)|0},${rnd(80,110)|0},${rnd(36,56)|0})`,c2:`rgba(${rnd(88,124)|0},${rnd(142,170)|0},${rnd(64,92)|0},.8)`,l:[0,1,2,3,4].map(i=>i?[rnd(-.5,.5),rnd(-.5,.5),rnd(.48,.72)]:[0,0,.8])});
  const nearTrack=(x,z,r)=>{for(let i=0;i<N;i+=6){const p=TR[i].p;if((p.x-x)**2+(p.z-z)**2<r*r)return true;}for(const ln of LANES)for(let i=0;i<ln.path.length;i+=4){const p=ln.path[i];if((p.x-x)**2+(p.z-z)**2<(r+1.5)**2)return true;}return Math.hypot(x-SW0.x-SW0.tx*4.5,z-SW0.z-SW0.tz*4.5)<10+r;};
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
const FORKP=LOOPS.flatMap(l=>[l.loop.P[0],l.loop.P[l.loop.P.length-1],l.short.P[0],l.short.P[l.short.P.length-1]]);
let QWS=[];const QSIDE=new Path2D,QSIDEP=[],QSIDE2=new Path2D,QSIDEP2=[],QRAIL=new Path2D,QRAILP=[],QW_MAX=2.2,QW_MIN=.9,QWP=(()=>{const L0=SEGS.map(g=>g.P).concat([(QS.link||[]).concat([ENTRY0])]).filter(P=>P.length>1),S=[];
  L0.forEach((P,pi)=>{for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/.5));for(let k=i>1?1:0;k<=n;k++)S.push({x:a[0]+(b[0]-a[0])*k/n,z:a[1]+(b[1]-a[1])*k/n,tx:(b[0]-a[0])/(l||1),tz:(b[1]-a[1])/(l||1),pi,w:QW_MAX});}});
  const G=new Map,key=(x,z)=>Math.floor(x/3)+','+Math.floor(z/3);for(const q of S){const k=key(q.x,q.z);if(!G.has(k))G.set(k,[]);G.get(k).push(q);}
  S.forEach((q,k)=>q.k=k);
  for(const q of S){let d=1e9,bo=null;const cx=Math.floor(q.x/3),cz=Math.floor(q.z/3);
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(const o of G.get((cx+i)+','+(cz+j))||[]){const dx=o.x-q.x,dz=o.z-q.z,l=Math.hypot(dx,dz);if(l<.3||l>6)continue;
      if(o.pi!==q.pi&&FORKP.some(F=>Math.hypot(q.x-F[0],q.z-F[1])<3.5&&Math.hypot(o.x-F[0],o.z-F[1])<3.5))continue; // branches d'une même fourche près de leur point commun : pas de rétrécissement (raccord propre, Zeus lot 5)
      if(Math.abs(dx*q.tx+dz*q.tz)/l<.5&&Math.abs(o.tx*q.tx+o.tz*q.tz)>.5&&l<d){d=l;bo=o;}} // en travers de l'allée, et allée voisine à peu près parallèle
    q.w=clamp(d-.25,QW_MIN,QW_MAX);if(bo&&d<3&&bo.k>q.k&&!FORKP.some(F=>Math.hypot(q.x-F[0],q.z-F[1])<3.5))q.mid=[(q.x+bo.x)/2,(q.z+bo.z)/2];} // allées collées : barrière de séparation à mi-distance (QRAIL)
  // barrière continue entre deux allées de file parallèles et proches (propriétaire, 2026-11-16) : main courante sur poteaux, tracée à mi-distance des axes
  {const runs=[];let r=null;for(let i=0;i<S.length;i++){const q=S[i];if(!q.mid){r=null;continue;}const pr=S[i-1];if(r&&pr&&pr.mid&&pr.pi===q.pi&&Math.hypot(pr.mid[0]-q.mid[0],pr.mid[1]-q.mid[1])<1.2)r.push(q.mid);else runs.push(r=[q.mid]);}
    for(const R of runs){if(R.length<4)continue;R.forEach((m,j)=>{if(j)QRAIL.lineTo(m[0],m[1]);else QRAIL.moveTo(m[0],m[1]);if(j%4===0)QRAILP.push(m);});}} // tronçons de moins de 1,5 m ignorés (pas de bout de main courante isolé)
  for(let r=0;r<2;r++)for(let i=1;i<S.length-1;i++)if(S[i-1].pi===S[i].pi&&S[i+1].pi===S[i].pi)S[i].w=Math.min(S[i].w,(S[i-1].w+S[i].w+S[i+1].w)/3+.05); // lissage
  if(OSMW.length){for(const q of S)q.ow=osmWAt(q.x,q.z);const ws=S.filter(q=>q.ow).map(q=>q.ow);if(ws.length){const m=Math.min(...ws);for(const q of S)q.w=q.ow||m;}} // largeur OSM de la file
  // File le long des quais et dans les zones piétonnes (propriétaire, OzIris, 2026-11-16, lot 5, générique) : largeur OSM, sinon 1 m (ESTIMÉ, couloir réel inconnu), et barrières
  // de délimitation (main courante sur poteaux) des DEUX côtés (QSIDE), là où aucune bordure de chemin ne la sépare du sol environnant.
  {const SG=STATION_GROW||SITE.stationPoly||[],PEDP=OSM.feats.filter(f=>f.k==='highway=pedestrian'&&f.c&&f.p.length>3).map(f=>f.p);
    for(const q of S){const st=SG.length>2&&pipXZ(SG,q.x,q.z);if(st||PEDP.some(P=>pipXZ(P,q.x,q.z))){q.w=Math.min(q.w,q.ow||1);q.side=st?2:1;}}}
  stairWidths(S);QWS=S;
  qwAt=(x,z)=>{let bd=1e9,w=2.2;for(const q of S){const d=Math.abs(q.x-x)+Math.abs(q.z-z);if(d<bd){bd=d;w=q.w;}}return w;};reGates(); // barrières sur les bordures dessinées (engine/queue.js)
  for(const q of S)q.cv=COV.some(P=>dPl(q.x,q.z,P)<.3); // tronçon couvert : dessiné seulement avec le couloir (gare masquée)
  for(const [k,Pa,Pp] of [[1,QSIDE,QSIDEP],[2,QSIDE2,QSIDEP2]])for(const e of [1,-1]){let on=false;for(let i=0;i<S.length;i++){const q=S[i],ok=q.side===k&&!q.cv&&(!on||S[i-1].pi===q.pi),d=e*(q.w/2+.05),x=q.x-q.tz*d,z=q.z+q.tx*d;
    if(!ok){on=false;continue;}if(on){Pa.lineTo(x,z);if(i%3===0)Pp.push([x,z]);}else{Pa.moveTo(x,z);Pp.push([x,z]);on=true;}}} // 2 : sur le plancher de la gare (dessinées après lui)
  const by=new Map;for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i];if(a.pi!==b.pi||a.cv&&b.cv)continue;const w=Math.round(Math.min(a.w,b.w)*10)/10;if(!by.has(w))by.set(w,new Path2D);const P=by.get(w);P.moveTo(a.x,a.z);P.lineTo(b.x,b.z);}
  return [...by.entries()].sort((a,b)=>b[0]-a[0]);})();
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
const bldA=b=>{const a=b.fade?(b.cvb?Math.min(roofA,hideA):roofA):b.cvb?hideA:1;return b.canopy?.8*a:a;};
// Tunnels du circuit : OSM.tunnels=[[s0,s1(,'roof')],…] (tronçons tagués tunnel=yes, ou covered=yes et layer<0 ; 'roof' = galerie au-dessus du sol, layer>0), puis tunnels ESTIMÉS
// de SITE.tunnels:[{s:[s0,s1],…}] (s du moteur). Couverture : eau si le tunnel passe sous un plan d'eau OSM (détection automatique), toit de béton ('roof'), sinon remblai enherbé.
// SITE.tunnels[k]={under:'water'|'ground'|'roof',w:demi-largeur} (k = rang du tunnel OSM) force le choix.
// Deux portails (tête en béton, ouverture sombre, rampe à murs) aux extrémités. Profondeur ESTIMÉE (profil de la spec). « Toits retirés » : la couverture devient translucide.
const TUN=(function(){
  const pip=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;};
  const fr=i=>{const f=TR[((i%N)+N)%N],g=TR[(((i+1)%N)+N)%N],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(g.p.x-f.p.x,g.p.z-f.p.z)||1;return {x:f.p.x,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:(g.p.x-f.p.x)/tl,tz:(g.p.z-f.p.z)/tl};};
  const CF=SITE.tunnels||[],cfO=CF.filter(c=>!c.s); // SITE.tunnels : réglages des tunnels OSM dans l'ordre, puis tunnels ESTIMÉS absents d'OSM ({s:[s0,s1], under, w})
  return (OSM.tunnels||[]).map((r,ti)=>[rockExt(r).concat(r.slice(2)),cfO[ti]||{}]).concat(CF.filter(c=>c.s).map(c=>[rockExt(c.s),c])).map(([r,cf])=>{ // rockExt : tunnel prolongé jusqu'aux bords du rocher
    const i0=Math.round(r[0]/DS),i1=Math.round(r[1]/DS),w=cf.w||2.1,m=fr(Math.round((i0+i1)/2));
    const e0=fr(i0),e1=fr(i1),under=cf.under||(ROCKP.some(P=>pipXZ(P,m.x,m.z))?'rock':0)||r[2]||([m,e0,e1].some(c=>WATERPTS.some(q=>pip(q,c.x,c.z)))?'water':'ground'); // r[2]='roof' : galerie couverte au-dessus du sol (OSM layer>0) // sous l'eau si le milieu ou une extrémité est dans un plan d'eau OSM
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
    const ridge=new Path2D;for(let i=i0;i<=i1;i++){const f=fr(i);i>i0?ridge.lineTo(f.x,f.z):ridge.moveTo(f.x,f.z);}
    return {a:r[0],b:r[1],under,w,cover:band(i0,i1,w+.3),core:band(i0,i1,w-.2),walls,heads,mouth,ridge,h:Math.max(...hs)+.01};
  });
})();
const inTun=s=>{for(const t of TUN)if(s>=t.a-CAR/2&&s<=t.b+CAR/2)return true;return false;};
function drawTunnel(t){
  const ra=G.roofOff||G.hideSt?roofA:1,wa=t.under==='water';
  ctx.save();
  if(wa){ctx.globalAlpha=.42+.5*ra;ctx.fillStyle=TEX.water;ctx.fill(t.cover);ctx.globalAlpha=ra*.5;ctx.strokeStyle='rgba(190,215,225,.55)';lw(.12,.5);ctx.stroke(t.cover);} // dalle de couverture sous l'eau
  else if(t.under==='roof'){ctx.globalAlpha=.25+.75*ra;ctx.fillStyle='#77746c';ctx.fill(t.cover);ctx.fillStyle=TEX.rows;ctx.globalAlpha*=.3;ctx.fill(t.cover);ctx.globalAlpha=.25+.75*ra; // galerie couverte : toit de béton sombre, faîtage
    ctx.strokeStyle='rgba(20,20,18,.5)';lw(.12,.6);ctx.stroke(t.cover);ctx.strokeStyle='rgba(255,255,255,.18)';lw(.15,.5);ctx.stroke(t.ridge);}
  else if(t.under==='rock'){} // sous un rocher OSM : couverture = le rocher lui-même (drawRock), seuls les portails sont dessinés ici
  else{ctx.globalAlpha=.3+.7*ra;ctx.fillStyle=TEX.dirt;ctx.fill(t.cover);ctx.fillStyle=TEX.lawn;ctx.fill(t.core);ctx.fillStyle='rgba(20,40,16,.18)';ctx.fill(t.core);}
  ctx.globalAlpha=1;
  if(t.under!=='rock'){ctx.strokeStyle='rgba(30,30,28,.35)';lw(.5,1);ctx.translate(.18,.14);ctx.stroke(t.walls);ctx.translate(-.18,-.14); // murs de la rampe (pas sous un rocher : voie en hauteur) et têtes de portail
  ctx.strokeStyle=TEX.stone;lw(.34,.8);ctx.stroke(t.walls);ctx.fillStyle=TEX.stone;ctx.fill(t.heads);ctx.strokeStyle='#8a867a';lw(.1,.6);ctx.stroke(t.heads);}
  else{ctx.fillStyle='rgba(52,46,38,.92)';ctx.fill(t.heads);} // sous un rocher (propriétaire, 2026-11-16, lot 4) : portail sobre et sombre, taillé dans la roche (pas de dalle claire)
  for(const m of t.mouth){const x0=m.x,z0=m.z,x1=m.x+m.ox*2.4,z1=m.z+m.oz*2.4,g=ctx.createLinearGradient(x0,z0,x1,z1); // ombre de l'ouverture sur la rampe
    g.addColorStop(0,'rgba(8,9,12,.9)');g.addColorStop(1,'rgba(8,9,12,0)');ctx.fillStyle=g;const hw=t.w-.15;
    ctx.beginPath();ctx.moveTo(x0+m.nx*hw,z0+m.nz*hw);ctx.lineTo(x1+m.nx*hw,z1+m.nz*hw);ctx.lineTo(x1-m.nx*hw,z1-m.nz*hw);ctx.lineTo(x0-m.nx*hw,z0-m.nz*hw);ctx.closePath();ctx.fill();}
  ctx.restore();
}
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
const COVD=COV.map(P=>{const on=QWS.filter(q=>dPl(q.x,q.z,P)<.3);return {p:mkPath(P),w:on.length?Math.min(...on.map(q=>q.w)):1.9,q:on.length>0,tr:[.4,.8,1.2].map(d=>trimPl(P,d)).filter(Boolean)};});
const COVB=COVD.map((c,i)=>{const P=COV[i];let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of P){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}const r=c.w/2+.45;return {P,r,x0:x0-r,x1:x1+r,z0:z0-r,z1:z1+r};});
const inCov=(x,z)=>COVB.some(o=>x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&dPl(x,z,o.P)<o.r); // personne dans un couloir couvert
const COVL=[];for(const P of COV){let acc=1.2;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(;acc<=l;acc+=3.5)COVL.push([a[0]+(b[0]-a[0])*acc/l,a[1]+(b[1]-a[1])*acc/l]);acc-=l;}} // plafonniers des couloirs couverts
// Hauteur ESTIMÉE du rocher : voie en tunnel dessous (OSM.tunnels / SITE.tunnels, prolongés jusqu'aux bords du rocher) la plus haute + 2,2 m ; si une voie SANS tunnel
// le traverse, elle passe PAR-DESSUS : rocher = voie du dessus la plus basse − 0,9 m (au moins voie du dessous + 1,6 m) ; sans voie : 3 m ; SITE.rocks[k]={h} force.
const ROCKS=ROCKP.map((P,k)=>{const m=cen(P);let ty=-1,tu=-1,to=1e9;for(let i=0;i<N;i+=2){const q=TR[i].p;if(pipXZ(P,q.x,q.z)){ty=Math.max(ty,q.y);if(inTunS(i*DS))tu=Math.max(tu,q.y);else to=Math.min(to,q.y);}}
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
  if(b.over){for(const v of G.queue)if(dPoly(v.x,v.z,b.P)<b.w/2+.2)person(v.x,v.z,v.ci,v.ph,v.mv); // visiteurs sur la passerelle, au-dessus de la voie
    for(const k of G.walkers)if(dPoly(k.x,k.z,b.P)<b.w/2+.2)person(k.x,k.z,k.ci,k.ph,true);}
}
const STSP=STATION_GROW||SITE.stationPoly||[]; // escaliers dans l'emprise de la gare (file qui monte au quai) : dessinés par-dessus le plancher (drawSteps(true))
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
  return {base:mkPath(P),rl:mkPath(offL(P,w/2)),rr:mkPath(offL(P,-w/2)),tr,w,inSt,q:!!(o.qs&&o.qs.length),cv:!!o.cv};});
function drawLands(s){if(!LANDS.length)return;ctx.fillStyle=PLAT_COL;for(const L of LANDS){ctx.beginPath();L.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();
    if(s>4){ctx.save();ctx.globalAlpha=.16;ctx.fillStyle=TEX.rows;ctx.fill();ctx.restore();}ctx.strokeStyle='#3f434a';lw(.1,.6);ctx.beginPath();ctx.moveTo(L[1][0],L[1][1]);ctx.lineTo(L[2][0],L[2][1]);ctx.moveTo(L[0][0],L[0][1]);ctx.lineTo(L[1][0],L[1][1]);ctx.stroke();ctx.fillStyle='#b59c78';}} // garde-corps : côté extérieur et bout
function drawSteps(st){ // même teinte et même bordure que le chemin prolongé (file : pierre ; allée : sable), bouts coupés droit (jonction continue)
  ctx.lineCap='butt';
  if(!st)for(const L of LANDG){if(L.o.cv&&hideA>.5)continue;const P=L.p;ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath(); // paliers (hors gare)
    ctx.fillStyle=L.q?TEX.stone:TEX.sand;ctx.fill();ctx.strokeStyle='rgba(60,50,35,.45)';lw(.07,.5);ctx.stroke();}
  for(const o of STEPD){if(!!o.inSt!==!!st||o.cv&&hideA>.5)continue; // escalier couvert : seulement gare masquée
ctx.strokeStyle=o.q?'#4a3a28':'#a89a78';ctx.lineWidth=o.w+.3;ctx.stroke(o.base);
    ctx.strokeStyle='#3f434a';ctx.lineWidth=o.w+.04;ctx.stroke(o.base); // garde-corps des deux côtés (bande tracée avec le chemin : pas de croisement dans les virages serrés)
    ctx.strokeStyle=o.q?TEX.stone:TEX.sand;ctx.lineWidth=o.w-.14;ctx.stroke(o.base);
    ctx.strokeStyle='rgba(0,0,0,.06)';ctx.stroke(o.base);
    if(cam.s>3){lw(.07,.4);for(const t of o.tr){const c=Math.round(110+70*t[4]);ctx.strokeStyle=`rgb(${c},${c-4},${c-12})`;ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();}} // nez de marche, plus clairs vers le haut
}
}
function person(x,z,ci,ph,mv,helmet){
  if(cam.s<4.2){ctx.fillStyle=PAL[ci];const k=Math.max(.45,1.2/cam.s);ctx.fillRect(x-k/2,z-k/2,k,k);return;}
  const a=ph+(mv?Math.sin(clock*7+ph)*.3:0);
  ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(x+.3,z+.24,.27,.19,a,0,7);ctx.fill();
  ctx.fillStyle=PAL[ci];ctx.beginPath();ctx.ellipse(x,z,.27,.17,a,0,7);ctx.fill();
  ctx.fillStyle=helmet||HAIR[(ph*7|0)%HAIR.length];ctx.beginPath();ctx.arc(x,z,.115,0,7);ctx.fill();
}
const _cf=mkF();
const CW=SITE.car.w||1.24,INL=!!SITE.car.inline;
/* ══ Passerelles de service et escaliers d'évacuation (propriétaire, issue #7, générique) ══
   Le long du lift (S_LIFT0 → S_LIFT1) et de chaque zone de freinage SURÉLEVÉE (freins de bloc, frein final, frein avant gare) : caillebotis + garde-corps extérieur,
   à la hauteur de la voie, dessinés juste sous leur tronçon (même ordre de profondeur). Rien là où la voie est au sol (moins de EL m au-dessus de la gare) ni en tunnel.
   Lift : la passerelle est elle-même l'escalier (marches tous les 20 cm de montée), prolongée en descendant depuis lift0 jusqu'au sol (pied, 20 m au plus ; sinon tour
   d'escalier au pied), paliers de repos tous les 6 m de montée (intermédiaires), palier au sommet. Frein surélevé : tour d'escalier (volées alternées de 2 m de montée,
   vue du dessus : les deux dernières) à une extrémité ; frein collé au sommet du lift : même passerelle que le lift, pas de tour.
   Côté : SITE.catwalks.side[<zone>] (1 = droite du sens de marche, −1 = gauche), sinon le plus dégagé (ni quai / gare, ni autre voie, ni file).
   Zone de freinage AU SOL (hors gare : frein final, frein avant gare…) : passerelle au niveau de la voie, sans tour, sur le plus long tronçon libre (ni quai, ni gare,
   ni file, ni autre voie), 3 m au moins (issue #7, complément) ; SITE.catwalks.ground:false pour s'en passer.
   SITE.catwalks=false : aucune passerelle (Zeus). Largeur W = 0,8 m, écart à la voie, paliers, tours : ESTIMÉS (aucun relevé). Ouvrages OSM (passerelle, escalier)
   déjà le long d'une zone : utilisés à la place (la zone n'est pas doublée). Itinéraire : décor seulement (pas encore suivi par les techniciens ni par une évacuation de train). */
const CATW=(function(){
  const C=SITE.catwalks;if(C===false)return {walks:[],towers:[]};
  const cf=C||{},W=cf.w||.8,EL=cf.minH!=null?cf.minH:.8,FS=cf.side||{},walks=[],towers=[];
  const fr=i=>{i=((i%N)+N)%N;const f=TR[i],g=TR[(i+1)%N],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(g.p.x-f.p.x,g.p.z-f.p.z)||1;return {i,s:i*DS,x:f.p.x,y:f.p.y,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:(g.p.x-f.p.x)/tl,tz:(g.p.z-f.p.z)/tl};};
  const half=s=>(BOB?DECKW/2*TRF(s):INV?Math.max(DECKW/2,CW/2):STL?.75:DECKW/2)+.15; // bord de la voie (ou du train suspendu) + 15 cm
  const el=f=>f.y-ST_Y,ii=s=>Math.round(s/DS);
  const OSMW=OSM.feats.filter(f=>(f.br||f.k==='highway=steps')&&!f.c).map(f=>f.p).concat(STAIRS.filter(o=>!(o.qs&&o.qs.length)).map(o=>o.p));
  // pénalité d'un point posé à (x,z), hauteur y, s = abscisse de la zone (autres voies, file, gare)
  const pen=(x,z,y,s,r)=>{let p=0;for(let j=0;j<N;j+=2){const q=TR[j].p,ds=Math.abs(((j*DS-s)%L+L*1.5)%L-L/2);if(ds<14)continue;const d=Math.hypot(q.x-x,q.z-z);if(d<half(j*DS)+r)p+=Math.abs(q.y-y)<7?3:.4;}
    for(const q of QWS)if(Math.abs(q.x-x)+Math.abs(q.z-z)<q.w/2+r+1&&Math.hypot(q.x-x,q.z-z)<q.w/2+r)p+=3;
    if(STSP.length>2&&pipXZ(STSP,x,z))p+=5;if(inSweep(x,z,r))p+=5;return p;};
  /* Appareil de voie (issue lot 14, 2026-11-17) : aucune passerelle sur le tronçon porté par l'appareil mobile (rail A / rail B d'un pont droit, tronçon mobile
     d'un aiguillage ou d'une table, SW_A → SW_B) — une passerelle fixe ne suivrait pas le rail qui glisse, et le personnel n'est pas posé sur un chariot ;
     aucune passerelle au sol dans l'espace balayé (fosse et dalle du pont droit, couloir de coulissement de l'aiguillage). La zone garde le plus long tronçon fixe. */
  const DA=SW_A-.6,DB=SW_B+.6,onDev=s=>(((s-DA)%L)+L)%L<=DB-DA;
  const SWP=TRAV?(()=>{const dM=Math.max(...LANES.map(l=>l.d)),dm=Math.min(...LANES.map(l=>l.d)),vA=(RA?RET:GAP)+1.5,vB=-dM-1.6,Lr=R1-R0,
      gu0=LREV?laneU(LANES[0].end)-1:U_LANE-.4,gw=LANES[0].end-U_LANE+1.4;return [[-.7,Lr+.7,vB,vA],[gu0,gu0+gw,vB,-dm+1.6]];})()
    :(()=>{const P=[];for(let s=SW_A;s<=SW_B+1e-6;s+=.5){const f=TR[((Math.round(s/DS)%N)+N)%N].p;P.push([f.x,f.z]);}return P;})();
  const inSweep=(x,z,r)=>{if(TRAV){const dx=x-SW0.x,dz=z-SW0.z,u=dx*SW0.tx+dz*SW0.tz,v=dx*SW0.vx+dz*SW0.vz;return SWP.some(b=>u>b[0]-r&&u<b[1]+r&&v>b[2]-r&&v<b[3]+r);}
    const lim=SW_D+1.5+r;return SWP.some(q=>Math.hypot(q[0]-x,q[1]-z)<lim);};
  const at=(f,sd,d)=>[f.x+f.nx*sd*d,f.z+f.nz*sd*d];
  const zones=[{id:'Lift',a:S_LIFT0,b:S_LIFT1,lift:1}].concat(BLK.map((b,i)=>({id:'B'+(i+1),a:Math.min(BZ0[i],b-TLEN),b:b+.5})),
    TAG.brk!=null?[{id:'Fin',a:S_BRK,b:S_HOLD+.5}]:[],PSB?[{id:'Pre',a:Math.min(PSB_A,S_PSB-TLEN),b:S_PSB+.5}]:[]);
  const lift=zones[0];
  for(const zn of zones){if(cf.skip&&cf.skip.includes(zn.id))continue;
    let i0=ii(zn.a),i1=ii(zn.b);
    if(zn.lift){let k=0;while(k<40&&el(fr(i0))>.2&&!inTunS((i0-1)*DS)){i0--;k++;}zn.foot=el(fr(i0))>.2;} // pied du lift : la passerelle-escalier descend jusqu'au sol
    else if(zn.a<=lift.b+4&&zn.a>=lift.b-2&&lift.w){lift.w.i1=Math.max(lift.w.i1,i1);continue;} // frein collé au sommet du lift : même passerelle
    if(!zn.lift){let run=null,cur=null;for(let i=i0;i<=i1;i++){if(onDev(fr(i).s)){cur=null;continue;}if(cur)cur.i1=i;else cur={i0:i,i1:i};if(!run||cur.i1-cur.i0>run.i1-run.i0)run=cur;} // tronçon porté par l'appareil exclu
      if(!run)continue;i0=run.i0;i1=run.i1;}
    const F=[];for(let i=i0;i<=i1;i++){const f=fr(i);f.ri=i;if(!inTunS(f.s))F.push(f);}
    if(!F.length)continue;const low=!zn.lift&&Math.max(...F.map(el))<EL; // zone de freinage au niveau du sol (hors gare) : passerelle au sol, sans tour (issue #7, complément)
    if(low&&cf.ground===false||zn.lift&&Math.max(...F.map(el))<EL)continue;
    if(OSMW.some(P=>F.filter((f,k)=>k%4===0).filter(f=>dPl(f.x,f.z,P)<half(f.s)+W+1).length>=F.length/8))continue; // ouvrage OSM le long de la zone : utilisé tel quel
    let sd=FS[zn.id];
    if(sd!==1&&sd!==-1){let best=1e9;for(const e of [1,-1]){let p=0;for(let k=0;k<F.length;k+=2){const f=F[k],c=at(f,e,half(f.s)+W/2);p+=pen(c[0],c[1],f.y,f.s,W/2+.2);}if(p<best-1e-6){best=p;sd=e;}}}
    if(low){ // au sol : seulement le plus long tronçon libre (ni quai ni gare, ni file, ni autre voie), 3 m au moins
      let run=null,cur=null;for(const f of F){const c=at(f,sd,half(f.s)+W/2),ok=!pen(c[0],c[1],f.y,f.s,W/2+.2)&&!pen(...at(f,sd,half(f.s)+W+.1),f.y,f.s,.1);
        if(ok){if(cur&&f.ri===cur.i1+1)cur.i1=f.ri;else cur={i0:f.ri,i1:f.ri};if(!run||cur.i1-cur.i0>run.i1-run.i0)run=cur;}else cur=null;}
      if(!run||(run.i1-run.i0)*DS<3)continue;i0=run.i0;i1=run.i1;}
    const w={id:zn.id,sd,i0,i1,lift:!!zn.lift,low};walks.push(w);if(zn.lift)lift.w=w;
    if(!zn.lift||zn.foot){ // tour d'escalier : extrémité la plus dégagée (frein), ou pied du lift resté en hauteur
      const ends=zn.lift?[[i0,1]]:[[i0,1],[i1,-1]];let tb=null;
      for(const [ie,dir] of ends){const f=fr(ie),h=el(f);if(h<EL)continue;const nf=Math.max(1,Math.ceil(h/2)),run=nf>1?3.2:Math.max(1.2,h*1.6),TL=run+(nf>1?1.8:.9),TWd=nf>1?2*W+.1:W;
        const d0=half(f.s)+W+.1,o={x:f.x,z:f.z,y:f.y,h,ux:f.tx*dir,uz:f.tz*dir,nx:f.nx*sd,nz:f.nz*sd,d0,TL,TW:TWd,nf,run};
        let p=0;for(let u=0;u<=TL;u+=1)for(const v of [d0,d0+TWd])p+=pen(o.x+o.ux*u+o.nx*v,o.z+o.uz*u+o.nz*v,f.y,f.s,.3);if(!tb||p<tb.p)tb=Object.assign(o,{p});}
      if(tb)towers.push(tb);}}
  // géométrie dessinée : morceaux de 8 points (alignés sur les tronçons de voie, même hauteur de tri)
  for(const w of walks){w.segs=[];let rise=null;
    for(let a=w.i0;a<w.i1;a=(Math.floor(a/8)+1)*8){const b=Math.min(w.i1,(Math.floor(a/8)+1)*8),P=[],Q=[],R=[],tr=[],ld=[];
      for(let i=a;i<=b;i++){const f=fr(i);if(inTunS(f.s))continue;const d=half(f.s)+W/2;P.push(at(f,w.sd,d));Q.push(at(f,w.sd,d+W/2));R.push(at(f,w.sd,d-W/2));
        if(i<b){const g=fr(i+1),dy=g.y-f.y,dh=Math.hypot(g.x-f.x,g.z-f.z)||DS;
          if(w.lift&&dy/dh>.08){const r0=el(f),r1=el(g);for(let m=Math.ceil(r0/.2)*.2;m<r1;m+=.2){const k=(m-r0)/(dy||1),x=f.x+(g.x-f.x)*k,z=f.z+(g.z-f.z)*k,c=[x+f.nx*w.sd*d,z+f.nz*w.sd*d];
            if(Math.floor(m/6)>Math.floor((m-.2)/6)&&m>1)ld.push(c);tr.push([c[0]-f.nx*W/2,c[1]-f.nz*W/2,c[0]+f.nx*W/2,c[1]+f.nz*W/2,m]);}}}}
      if(P.length<2)continue;let ys=0;for(let i=a;i<=b;i++)ys+=fr(i).y;
      w.segs.push({h:chunkH[((Math.floor((a+b)/2)%N)+N)%N]-.01,y:ys/(b-a+1),c:mkPath(P),o:mkPath(Q),n:mkPath(R),Q,tr,ld,nx:fr(a).nx*w.sd,nz:fr(a).nz*w.sd});}
    const s=w.segs[w.segs.length-1];if(w.lift&&s){const f=fr(w.i1),c=at(f,w.sd,half(f.s)+W/2);s.top=[c[0],c[1],f.tx,f.tz,f.nx*w.sd,f.nz*w.sd];}} // palier au sommet
  for(const t of towers){const c=(u,v)=>[t.x+t.ux*u+t.nx*v,t.z+t.uz*u+t.nz*v],v0=t.d0-W/2-.1,v1=t.d0+t.TW;
    t.poly=[c(-.2,v0),c(t.TL,v0),c(t.TL,v1),c(-.2,v1)];t.fl=[];const L0=t.nf>1?.9:0; // palier haut (jonction avec la passerelle), volées, palier bas
    const nfl=Math.min(t.nf,2);for(let k=0;k<nfl;k++){const va=t.d0+k*(W+.1),vb=va+W,tr=[];for(let u=L0;u<=L0+t.run+1e-6;u+=.28)tr.push([...c(u,va),...c(u,vb),(k===0?1-(u-L0)/t.run:(u-L0)/t.run)]);
      t.fl.push({p:[c(L0,va),c(L0+t.run,va),c(L0+t.run,vb),c(L0,vb)],tr});}
    t.lands=t.nf>1?[[c(-.2,v0),c(L0,v0),c(L0,v1),c(-.2,v1)],[c(L0+t.run,t.d0),c(t.TL,t.d0),c(t.TL,v1),c(L0+t.run,v1)]]:[[c(-.2,v0),c(0,v0),c(0,t.d0+W),c(-.2,t.d0+W)]];}
  return {walks,towers,W};})();
const CW_GR='#5d605d',CW_RL='#a9aba5',CW_EDGE='#34373b'; // acier galvanisé terni (couleurs sourdes)
const polyP=P=>{ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();};
function drawCatwalk(g){const W=CATW.W;ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
  ctx.strokeStyle='rgba(20,22,24,.55)';ctx.lineWidth=W+.12;ctx.stroke(g.c);ctx.strokeStyle=CW_GR;ctx.lineWidth=W;ctx.stroke(g.c); // caillebotis
  if(cam.s>5&&!g.tr.length){ctx.setLineDash([.05,.12]);ctx.strokeStyle='rgba(25,26,28,.35)';ctx.lineWidth=W*.86;ctx.stroke(g.c);ctx.setLineDash([]);} // barreaux du caillebotis
  if(cam.s>3)for(const t of g.tr){const k=Math.min(1,(t[4]%6)/6),c=Math.round(78+40*k);ctx.strokeStyle=`rgb(${c},${c+2},${c})`;lw(.05,.4);ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();} // marches (plus claires en montant)
  for(const q of g.ld){ctx.fillStyle='#4f524f';ctx.beginPath();ctx.arc(q[0],q[1],W*.55,0,7);ctx.fill();} // paliers de repos
  if(g.top){const [x,z,tx,tz,nx,nz]=g.top,h=W/2;ctx.fillStyle=CW_GR;polyP([[x-nx*h,z-nz*h],[x+tx*1.4-nx*h,z+tz*1.4-nz*h],[x+tx*1.4+nx*h,z+tz*1.4+nz*h],[x+nx*h,z+nz*h]]);ctx.fill();ctx.strokeStyle=CW_EDGE;lw(.05,.4);ctx.stroke();}
  ctx.strokeStyle=CW_EDGE;lw(.05,.4);ctx.stroke(g.n); // plinthe côté voie
  ctx.strokeStyle='rgba(0,0,0,.35)';lw(.09,.6);ctx.stroke(g.o);ctx.strokeStyle=CW_RL;lw(.05,.5);ctx.stroke(g.o); // garde-corps extérieur
  if(cam.s>7){ctx.fillStyle=CW_EDGE;for(let i=0;i<g.Q.length;i+=3)ctx.fillRect(g.Q[i][0]-.05,g.Q[i][1]-.05,.1,.1);} // potelets
  ctx.restore();}
function drawTower(t){ctx.save();ctx.lineJoin='round';
  polyP(t.poly);ctx.fillStyle='rgba(30,32,34,.5)';ctx.fill(); // vide de la cage (on voit les volées du dessous)
  for(const L of t.lands){polyP(L);ctx.fillStyle=CW_GR;ctx.fill();}
  for(const f of t.fl){polyP(f.p);ctx.fillStyle='#676a66';ctx.fill();if(cam.s>3){lw(.05,.4);for(const r of f.tr){const c=Math.round(80+60*r[4]);ctx.strokeStyle=`rgb(${c},${c+2},${c})`;ctx.beginPath();ctx.moveTo(r[0],r[1]);ctx.lineTo(r[2],r[3]);ctx.stroke();}}}
  polyP(t.poly);ctx.strokeStyle='rgba(0,0,0,.35)';lw(.09,.6);ctx.stroke();ctx.strokeStyle=CW_RL;lw(.05,.5);ctx.stroke(); // garde-corps de la cage
  ctx.restore();}
function catwalkShadows(){ctx.save();ctx.lineCap='butt';ctx.lineWidth=CATW.W;
  for(const w of CATW.walks)for(const g of w.segs){ctx.save();ctx.translate(g.y*SHX,g.y*SHZ);ctx.stroke(g.c);ctx.restore();}
  for(const t of CATW.towers){ctx.save();ctx.translate(t.y*SHX*.5,t.y*SHZ*.5);polyP(t.poly);ctx.fill();ctx.restore();}ctx.restore();}
function drawCar(t,k,shadow){
  carFrame(t,k,_cf);const p=_cf.p,a=Math.atan2(_cf.T.z,_cf.T.x),hl=CAR/2-.07,hw=CW/2;
  // vue du dessus : wagon raccourci sur une pente forte (|T| horizontal), aminci quand la voie pivote (|R| horizontal + hauteur de caisse vue de côté) ; tête en bas : on voit le dessous
  const run=t.st==='run',sx=run?Math.max(.3,Math.hypot(_cf.T.x,_cf.T.z)):1,sy=run?clamp((CW*Math.hypot(_cf.R.x,_cf.R.z)+.9*Math.hypot(_cf.U.x,_cf.U.z))/CW,.3,1):1,up=run&&_cf.U.y<0;
  ctx.save();
  if(shadow){const hy=INV?Math.max(0,p.y-2.6):p.y+.6;ctx.translate(p.x+hy*SHX,p.z+hy*SHZ);ctx.rotate(a);ctx.scale(sx,sy);ctx.fillStyle='rgba(10,20,10,.3)';ctx.fillRect(-hl-.04,-hw-.04,2*hl+.08,CW+.08);ctx.restore();return;}
  ctx.translate(p.x,p.z);ctx.rotate(a);ctx.scale(sx,sy);
  if(up){ // wagon tête en bas (looping, vrille) : dessous de caisse, longeron, essieux et roues sur les rails ; passagers invisibles
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,.16);ctx.fill(); // caisse vue de dessous : bords de la coque
    ctx.fillStyle='#34363c';ctx.beginPath();ctx.roundRect(-hl+.18,-hw+.3,2*hl-.36,CW-.6,.1);ctx.fill(); // plancher
    ctx.fillStyle='#45484f';ctx.fillRect(-hl+.1,-.08,2*hl-.2,.16); // longeron central
    for(const ex of [-hl+.3,hl-.3]){ctx.fillStyle='#55585e';ctx.fillRect(ex-.04,-hw+.1,.08,CW-.2);ctx.fillStyle='#121316';for(const e of [-1,1])ctx.fillRect(ex-.15,e*.62-.07,.3,.14);} // essieux, roues
    // la voie passe AU-DESSUS du wagon tête en bas : rails (et poutre centrale) redessinés par-dessus, le wagon reste lisible de part et d'autre
    ctx.strokeStyle=TKC.rail;ctx.lineWidth=.2;ctx.beginPath();for(const e of [-1,1]){ctx.moveTo(-CAR/2,e*.62);ctx.lineTo(CAR/2,e*.62);}ctx.stroke();
    if(STL){ctx.strokeStyle=TKC.spine;ctx.lineWidth=.22;ctx.beginPath();ctx.moveTo(-CAR/2,0);ctx.lineTo(CAR/2,0);ctx.stroke();}
    ctx.restore();return;}
  if(BOB){ // coque de bob : pas de roues apparentes, nez et queue arrondis
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.2,.46,.46,.2]:k===NCARS-1?[.42,.2,.2,.42]:.22);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.12,-hw,2*hl-.24,.07);ctx.fillRect(-hl+.12,hw-.07,2*hl-.24,.07);
    ctx.fillStyle='#17181c';ctx.beginPath();INL?ctx.roundRect(-hl+.1,-hw+.15,2*hl-.2,CW-.3,.14):ctx.roundRect(-hl+.2,-hw+.15,2*hl-.42,CW-.3,.14);ctx.fill(); // habitacle (places en ligne : sur presque toute la longueur)
  }else if(INV){ // wagon suspendu, sans plancher : châssis sous la poutre, rangée de sièges côte à côte, dossiers et harnais sombres
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.12,.5,.5,.12]:.14);ctx.fill();
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.18,-hw+.12,2*hl-.44,CW-.24,.1);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.08,-hw,.16,CW);ctx.fillRect(-.35,-.32,.7,.64);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.25,-.3);ctx.lineTo(hl+.05,0);ctx.lineTo(hl-.25,.3);ctx.fill();}
  }else if(STL){ // wagon posé sur les rails : caisse arrondie, siège et barre de maintien (lapbar) sombres, roues en bout
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.12,-hw-.12,.3,CW+.24);ctx.fillRect(hl-.42,-hw-.12,.3,CW+.24);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.14,.55,.55,.14]:.16);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.04,-hw,.1,CW);ctx.fillRect(-hl+.1,-.04,2*hl-.2,.08);
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.22,-hw+.14,2*hl-.5,CW-.28,.1);ctx.fill();
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.25);ctx.lineTo(hl-.04,0);ctx.lineTo(hl-.3,.25);ctx.fill();}
  }else{
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.08,-hw-.2,.36,CW+.4);ctx.fillRect(hl-.44,-hw-.2,.36,CW+.4);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.18,.45,.45,.18]:.18);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl,-hw,2*hl,.11);ctx.fillRect(-hl,hw-.11,2*hl,.11);
    ctx.fillStyle='#17181c';ctx.fillRect(-hl+.26,-hw+.14,2*hl-.48,CW-.28);
    ctx.fillStyle='#3a3d46';ctx.fillRect(-hl+.14,-hw+.12,.18,CW-.24);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.22);ctx.lineTo(hl-.06,0);ctx.lineTo(hl-.3,.22);ctx.fill();}
  }
  if(cam.s>2.2){const ra=clamp((cam.s-2.2)/4,0,1); // sécurités : discrètes de loin, lisibles au zoom proche
    for(let sd=0;sd<CSEATS;sd++){const s=t.seats[k*CSEATS+sd],q=seatOff(sd),x=q[0]+(INL?0:-.06),y=q[1]*.91;
      if(s&&s.on){const up=((k*CSEATS+sd)%3!==1)?t.arms:0; // côte à côte, ou l'un derrière l'autre
        ctx.fillStyle=PAL[s.ci];ctx.beginPath();ctx.ellipse(x,y,INL?.18:.2,INL?.24:.26,0,0,7);ctx.fill(); // épaules : .18 m le long du wagon pour des places en ligne (corps qui ne se touchent pas)
        if(up>.3&&cam.s>7){ctx.strokeStyle='#e9c9a6';ctx.lineWidth=.09;ctx.beginPath();const d=(INL?.3:.42)*up;ctx.moveTo(x,y-.2);ctx.lineTo(x+d,y-.26);ctx.moveTo(x,y+.2);ctx.lineTo(x+d,y+.26);ctx.stroke();}}
      const rr=t.rc[k],top=RES_KIND==='otsr'&&rr>.5;if(RES_PER==='seat'&&!top)drawRes(x,y,rr,ra); // la tête passe entre les épaulières du harnais fermé ; harnais relevé : au-dessus de la tête
      if(s&&s.on){ctx.fillStyle=HAIR[(k*5+sd*3+t.i)%HAIR.length];ctx.beginPath();ctx.arc(x,y,.14,0,7);ctx.fill();}
      if(RES_PER==='seat'&&top)drawRes(x,y,rr,ra);}
    if(RES_PER==='car')drawResCar(hl,t.rc[k],ra);}
  ctx.restore();
}
/* Sécurités vues du dessus (RES_KIND, RES_PER : engine/core.js). r = ouverture (0 verrouillée … 1 ouverte).
   La barre pivote autour d'un axe transversal : vue du dessus, sa projection se rapproche de l'axe (x' = axe + (x − axe)·cos θ) et s'éclaircit en montant.
   Couleurs mates : armature noire, mousse grise. */
const resTh=r=>r*Math.PI/2*1.08,resCol=(r,b)=>{const c=Math.round(b+28*Math.sin(resTh(r)));return 'rgb('+c+','+c+','+(c+3)+')';};
function drawRes(x,y,r,a){
  const th=resTh(r),c=Math.cos(th),P=(px,x0)=>px+(x0-px)*c;ctx.save();ctx.globalAlpha=a;ctx.lineCap='round';ctx.lineJoin='round';
  if(RES_KIND==='otsr'){ // harnais : deux épaulières reliées par un plastron, axe derrière l'appui-tête
    const px=x-.24,w=.2+.04*Math.sin(th);
    ctx.strokeStyle=resCol(r,40);ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(P(px,x-.14),y-w);ctx.lineTo(P(px,x+.17),y-w);ctx.quadraticCurveTo(P(px,x+.3),y-w,P(px,x+.3),y);ctx.quadraticCurveTo(P(px,x+.3),y+w,P(px,x+.17),y+w);ctx.lineTo(P(px,x-.14),y+w);ctx.stroke();
    ctx.strokeStyle=resCol(r,80);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(P(px,x-.1),y-w);ctx.lineTo(P(px,x+.14),y-w);ctx.moveTo(P(px,x-.1),y+w);ctx.lineTo(P(px,x+.14),y+w);ctx.stroke(); // mousse des épaulières
    ctx.fillStyle=resCol(r,26);ctx.fillRect(P(px,x-.2),y-.09,Math.max(.04,(x-.12-(x-.2))*c+.04),.18);} // charnière
  else if(RES_KIND==='belt'){ // ceinture : sangle posée sur le côté (ouverte) ou en travers des cuisses (bouclée)
    ctx.strokeStyle=resCol(r*0,40);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(x+.16,y-.22);ctx.lineTo(x+.16+(.02-.16)*0+.06*(1-r),y+.22*(1-r)-.22*r);ctx.stroke();
    if(r<.5){ctx.fillStyle='#55585e';ctx.fillRect(x+.18,y-.04,.07,.08);}}
  else{ // lapbar individuelle : barre transversale devant les cuisses, axe à l'avant de la place
    const px=x+.46,bx=P(px,x+.22),w=.21;
    ctx.strokeStyle=resCol(r,30);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(bx,y);ctx.stroke(); // bras
    ctx.fillStyle=resCol(r,74);ctx.beginPath();ctx.roundRect(bx-.05,y-w,.1,2*w,.05);ctx.fill(); // mousse
    ctx.strokeStyle=resCol(r,24);ctx.lineWidth=.025;ctx.stroke();}
  ctx.restore();
}
function drawResCar(hl,r,a){ // lapbar commune au wagon : UNE barre en travers DEVANT le passager avant (fermée : posée sur ses genoux ; ouverte : relevée vers l'avant), bras articulés à l'avant du wagon
  const th=resTh(r),c=Math.cos(th),px=hl-.06,P=x0=>px+(x0-px)*c,w=.25;let xf=-1e9;for(let sd=0;sd<CSEATS;sd++)xf=Math.max(xf,seatOff(sd)[0]+(INL?0:-.06));
  const b=P(Math.min(px-.07,xf+.22));ctx.save();ctx.globalAlpha=a;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=resCol(r,40);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(px,-w);ctx.lineTo(b,-w);ctx.moveTo(px,w);ctx.lineTo(b,w);ctx.stroke(); // bras
  ctx.fillStyle=resCol(r,74);ctx.beginPath();ctx.roundRect(b-.05,-w,.1,2*w,.05);ctx.fill();ctx.strokeStyle=resCol(r,24);ctx.lineWidth=.025;ctx.stroke(); // barre en mousse
  ctx.fillStyle=resCol(r,24);ctx.fillRect(px-.04,-w-.04,.08,2*w+.08); // axe
  ctx.restore();
}
/* Équipements des zones de freinage, dessinés avec leur tronçon (sous les trains) :
   - mâchoires mécaniques : deux patins de part et d'autre de l'ailette du train (axe de la voie), dans leur carter ; serrées (patins contre l'axe) ou écartées selon l'état des freins ;
   - roues de propulsion (pneus) là où la zone a des moteurs (SITE.zones … drive ; défaut : toutes les zones sauf les freins de bloc), une unité sur deux : paire de pneus à axe vertical
     qui pincent l'ailette (bois, acier, inversé), pneu à axe horizontal au fond de la gouttière (bob) ; ils tournent quand un train roule dessus.
   Coaster inversé : étriers et pneus de part et d'autre de la poutre caisson. Matières mates ; de loin, un simple trait sombre. Dimensions ESTIMÉES. */
const BZS={},PV=new WeakMap(),tSp=t=>t.st==='garage'?(t.mv?MV.v:0):t.st==='station'?0:t.v;
const zTrains=z=>trains.filter(t=>z.car?tZone(t)==='RB':(t.st==='run'&&t.s>z.r0-.3&&t.s-TLEN<z.r1+.3)||(z.id==='St'&&t.st==='station')||(t.st==='garage'&&tZone(t)===z.id));
const _bf=mkF();
function brakeState(dt){ // freins serrés : au pupitre, défaut, train retenu ou ralenti dans la zone ; zone vide : serrée si la section suivante est occupée (la gare, toujours)
  for(const z of BZ){const b=BZS[z.id]||(BZS[z.id]={c:1,a:0}),ts=zTrains(z);
    let cl=zK(z.id)||(z.id==='Fin'&&G.brakeFault)||ts.some(t=>tSp(t)<.05||(t.st==='run'&&PV.has(t)&&t.v<PV.get(t)-.01));
    if(!ts.length&&!cl)cl=z.id==='St'||z.lane!=null||!!nextBusy(z.id,null); // voie vide : freins serrés
    if(dt>0&&b.cl!==undefined&&b.cl!==!!cl&&z.id!=='St'&&z.lane==null){const q=z.r0!=null?frameAt((z.r0+z.r1)/2,_bf).p:null;cl?sfx.brakeOn(q&&q.x,q&&q.z):sfx.brakeOff(q&&q.x,q&&q.z);} // son : serrage (claquement) / desserrage (air)
    b.cl=!!cl;
    if(dt>0){b.c=lerp(b.c,cl?1:0,Math.min(1,dt*6));if(z.drive)b.a+=Math.min(8,Math.max(0,...ts.map(tSp)))/.2*dt;}}
  if(dt>0)for(const t of trains)PV.set(t,t.v);
}
function drawBU(o){
  const s=cam.s;if(!o.bu.length||s<1.1)return;
  const far=s<3.2,flt=G.brakeFault&&Math.sin(clock*9)>0;
  for(const u of o.bu){const b=BZS[u.id]||{c:1,a:0},X=(a,v)=>u.x+u.tx*a+u.nx*v,Z=(a,v)=>u.z+u.tz*a+u.nz*v;
    const quad=(a0,a1,v0,v1)=>{ctx.beginPath();ctx.moveTo(X(a0,v0),Z(a0,v0));ctx.lineTo(X(a1,v0),Z(a1,v0));ctx.lineTo(X(a1,v1),Z(a1,v1));ctx.lineTo(X(a0,v1),Z(a0,v1));ctx.closePath();ctx.fill();};
    const disc=(a,v,r)=>{ctx.beginPath();ctx.arc(X(a,v),Z(a,v),r,0,7);ctx.fill();};
    const c0=INV?.62:0,sides=INV?[-1,1]:[0]; // inversé : de part et d'autre de la poutre
    if(far){ctx.fillStyle='rgba(44,46,50,.8)';for(const e of sides)quad(-.22,.22,e*c0-.16,e*c0+.16);continue;}
    if(u.ty){ // roues de propulsion
      if(BOB){ctx.fillStyle='#151618';quad(-.26,.26,-.11,.11);ctx.fillStyle='#3a3c40';const ph=(b.a*.2)%.13;for(let a=-.26+ph;a<.26;a+=.13)quad(a,a+.035,-.11,.11);continue;} // pneu à axe horizontal, rainures qui défilent
      for(const e of sides){const cx=e*c0;ctx.fillStyle='#3b3f45';quad(-.12,.12,cx-.62,cx-.46);quad(-.12,.12,cx+.46,cx+.62); // moto-réducteurs
        for(const w of [-1,1]){const v=cx+w*.24,an=b.a*w;ctx.fillStyle='#151618';disc(0,v,.2);ctx.fillStyle='#5f6368';disc(0,v,.085);
          ctx.fillStyle='#2a2c30';for(let j=0;j<3;j++){const q=an+j*2.094;disc(Math.cos(q)*.055,v+Math.sin(q)*.055,.018);}}}
      continue;}
    const g=lerp(.19,.035,clamp(b.c,0,1)); // demi-écartement des patins : écartés (freins relâchés) ou serrés contre l'ailette
    for(const e of sides){const cx=e*c0;
      ctx.fillStyle='rgba(52,54,58,.85)';quad(-.3,.3,cx-.33,cx+.33); // traverse de fixation
      ctx.fillStyle='#6b6258';quad(-.24,.24,cx+g,cx+g+.05);quad(-.24,.24,cx-g-.05,cx-g); // garnitures
      ctx.fillStyle=u.id==='Fin'&&flt?'#7a2e28':'#2c2e33';quad(-.2,.2,cx+g+.05,cx+g+.16);quad(-.2,.2,cx-g-.16,cx-g-.05);} // carters des mâchoires
  }
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
  if(ROT){if(!YD.slab)return; // appareil rotatif : dessiné seul (tronçon tournant, faces, supports) ; dalle au sol seulement si SITE.yard.slab (propriétaire, Goudurix : pas de plateforme)
    const L_=LBK?YD.b-YD.a:len; // carter du tambour autour du tronçon (le rail tourne sur son axe), contour orange pendant la rotation ; élargi du côté du garage pour contenir la face en S
    let v0=-1.05;if(LBK&&LANES.length){const nl=Math.round(LANES[0].link/.5);for(const q of LANES[0].path.slice(0,nl+1))v0=Math.min(v0,((q.x-SW0.x)*SW0.vx+(q.z-SW0.z)*SW0.vz)-1.05);}
    ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);ctx.fillStyle='rgba(58,62,70,.9)';ctx.strokeStyle=devMoving()&&Math.sin(clock*10)>0?'#ff9f43':'#8c8f94';lw(.12,.7);
    ctx.beginPath();ctx.roundRect(-.5,v0,L_+1,1.05-v0,.35);ctx.fill();ctx.stroke();
    ctx.fillStyle='#2a2c31';ctx.fillRect(-.5,v0,.5,1.05-v0);ctx.fillRect(L_,v0,.5,1.05-v0);ctx.restore();return;}
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  ctx.fillStyle='#8f9296';ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.55;ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.globalAlpha=1;
  ctx.strokeStyle='#2c2e33';lw(.22,.8);ctx.beginPath();for(const u of [.4,len/2+.05,len-.3]){ctx.moveTo(u,v0+.3);ctx.lineTo(u,v1-.3);}ctx.stroke();
  ctx.translate(0,devC());ctx.fillStyle='rgba(60,64,72,.93)';ctx.strokeStyle=devMoving()&&Math.sin(clock*10)>0?'#ff9f43':'#e8b93c';lw(.14,.7);
  ctx.beginPath();ctx.rect(-.5,-CMAX-4,len+.6,CMAX+5.4);ctx.fill();ctx.stroke();ctx.restore();
}
// Sol des quais (propriétaire, 2026-11-16, lot 5, toutes les attractions) : béton clair mat, pour bien voir visiteurs, opérateurs et portillons ; SITE.platCol pour changer.
const PLAT_COL=SITE.platCol||'#d6d1c6';
function drawStationFloor(s){
  const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2; // plat.back : au-delà de l'ARRIÈRE du dernier wagon (pas de son milieu), comme tools/offpath.js
  const quad=(l0,l1)=>{ctx.beginPath();ctx.moveTo(a.x-a.tx*bk+a.rx*l0,a.z-a.tz*bk+a.rz*l0);ctx.lineTo(b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0);
    ctx.lineTo(b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1);ctx.lineTo(a.x-a.tx*bk+a.rx*l1,a.z-a.tz*bk+a.rz*l1);ctx.closePath();ctx.fill();};
  const floor=()=>{if(!G.hideSt)ctx.fill(stationP);quad(PEDGE,P.load);if(P.exit)quad(-PEDGE,-P.exit);}; // plancher : bâtiment de la gare + quais (« Masquer la gare » : quais seuls, on voit dessous)
  ctx.fillStyle=PLAT_COL;floor();
  if(s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha=.16;floor();ctx.globalAlpha=1;}
  const ln=(lat,e)=>{ctx.moveTo(a.x-a.tx*e+a.rx*lat,a.z-a.tz*e+a.rz*lat);ctx.lineTo(b.x+b.tx*e+b.rx*lat,b.z+b.tz*e+b.rz*lat);};
  ctx.strokeStyle='#34322f';ctx.lineWidth=2*PEDGE;ctx.beginPath();ln(0,1.6);ctx.stroke();
  ctx.strokeStyle='#e8b93c';lw(.2,.8);ctx.beginPath();ln(PEDGE+.06,1);ln(-PEDGE-.06,1);ctx.stroke();
  if(SITE.draw&&SITE.draw.floor)SITE.draw.floor(ctx,s,API);
}
// Bord de quai par-dessus le tablier d'une voie plus large que le gabarit des wagons (voie en bois) : bande de quai de PEDGE au bord du tablier, redessinée après la voie
// et avant les wagons (élément de tri à la hauteur de la gare), avec la ligne de sécurité : le quai touche le gabarit des wagons (propriétaire, lot 6).
const LIP=!INV&&!BOB&&DECKW/2>PEDGE+.02?DECKW/2+.06:0; // bob : la gouttière de gare est déjà rétrécie au gabarit (TRF)
function drawLip(){const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2;
  const quad=(l0,l1)=>{ctx.beginPath();ctx.moveTo(a.x-a.tx*bk+a.rx*l0,a.z-a.tz*bk+a.rz*l0);ctx.lineTo(b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0);
    ctx.lineTo(b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1);ctx.lineTo(a.x-a.tx*bk+a.rx*l1,a.z-a.tz*bk+a.rz*l1);ctx.closePath();ctx.fill();};
  const sides=P.exit?[1,-1]:[1];ctx.fillStyle=PLAT_COL;for(const e of sides)quad(e*PEDGE,e*LIP);
  if(cam.s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha=.16;for(const e of sides)quad(e*PEDGE,e*LIP);ctx.globalAlpha=1;}
  ctx.strokeStyle='#e8b93c';lw(.2,.8);ctx.beginPath();for(const e of sides){const l=e*(PEDGE+.06);ctx.moveTo(a.x-a.tx*1+a.rx*l,a.z-a.tz*1+a.rz*l);ctx.lineTo(b.x+b.tx*1+b.rx*l,b.z+b.tz*1+b.rz*l);}ctx.stroke();}
// Salle de contrôle (poste de conduite, pupitre) : GAME.controlRooms=[{id, x, z, angle (degrés), w, d (m), main}] (éditeur, docs/ARCHITECTURE.md D3) ; une seule salle par
// attraction pour l'instant (propriétaire, lot 1) : la salle main (sinon la première) porte le pupitre ; liste vide = aucune salle (ni opérateur au pupitre, ni gyrophare,
// ni étiquette). Sans GAME.controlRooms : repli sur SITE.booth=[x, z, angle (rad), échelle] (pupitre de 3,75 x 1,7 m à l'échelle 1, ESTIMÉ). Gyrophare et étiquette :
// SITE.beacon / SITE.boothLabel ramenés au repère de la salle (ils la suivent quand elle bouge), sinon posés sur la salle.
const BOOTH_W=3.75,BOOTH_D=1.7;
const B0=SITE.booth?(()=>{const B=SITE.booth,sc=B[3]||1,c=Math.cos(B[2]),sn=Math.sin(B[2]),loc=q=>q?[(q[0]-B[0])*c+(q[1]-B[1])*sn,-(q[0]-B[0])*sn+(q[1]-B[1])*c]:null;
  return {room:{id:'poste',x:B[0],z:B[1],angle:B[2]*180/Math.PI,w:BOOTH_W*sc,d:BOOTH_D*sc,main:true},bl:loc(SITE.beacon),ll:loc(SITE.boothLabel)};})():null;
function ctlRooms(){const R=Array.isArray(GM.controlRooms)?GM.controlRooms:B0?[B0.room]:[];return R.filter(r=>r&&[r.x,r.z,r.angle,r.w,r.d].every(v=>typeof v==='number'&&isFinite(v)));}
function mainRoom(){const R=ctlRooms();return R.find(r=>r.main)||R[0]||null;}
const roomPt=(r,l)=>{const t=r.angle*Math.PI/180;return [r.x+l[0]*Math.cos(t)-l[1]*Math.sin(t),r.z+l[0]*Math.sin(t)+l[1]*Math.cos(t)];};
function beaconAt(){const r=mainRoom();if(!r)return null;const l=B0&&B0.bl?B0.bl:[r.w/2-.35,-r.d/2+.3];return roomPt(r,[clamp(l[0],-r.w/2-.5,r.w/2+.5),clamp(l[1],-r.d/2-.5,r.d/2+.5)]);}
function boothLabelAt(){const r=mainRoom();if(!r)return null;if(B0&&B0.ll)return roomPt(r,B0.ll);return [r.x,r.z-Math.max(r.w,r.d)/2-2.2];}
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
  ctx.strokeStyle='#4f555c';lw(.2,1.4);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.strokeStyle='#aeb5bd';lw(.07,.5);ctx.beginPath();ctx.moveTo(g.h[0],g.h[1]);ctx.lineTo(ex,ez);ctx.stroke();
  ctx.fillStyle='#23262b';for(const [q,r] of [[g.h,.2],[g.a,.13],[g.b,.13]])ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);
}
function drawGates(){ // un portillon par wagon, ou par rangée (SITE.plat.gatesPer:'row', GUNITS) ; ligne des portillons à PGATE du rail, près du bord du quai
  ctx.strokeStyle='#4d525a';lw(.09,.6);ctx.beginPath();
  for(let u=0;u<=NGATES;u++){const g=GUNITS[Math.min(u,NGATES-1)],b=BAYS[g.k],e=u<NGATES?g.c+g.h:g.c-g.h,cx=b.x+b.tx*e,cz=b.z+b.tz*e;ctx.moveTo(cx+b.rx*(PGATE-.05),cz+b.rz*(PGATE-.05));ctx.lineTo(cx+b.rx*(PGATE+2.15),cz+b.rz*(PGATE+2.15));}
  ctx.stroke();
  // un vantail par portillon, articulé sur le séparateur avant ; il pivote vers le train
  // Propriétaire (Zeus, 2026-11-17) : les portillons s'ouvrent vers le train sans jamais dépasser le bord du quai. Vantail = largeur du portillon,
  // au plus le couloir (PGATE-PEDGE-5 cm) ; le reste de la travée est une clôture fixe (largeur de passage ESTIMÉE, non relevée).
  const a=G.gate*1.45,ca=Math.cos(a),sa=Math.sin(a),GL=g=>Math.min(2*g.h-.3,PGATE-PEDGE-.05);
  ctx.strokeStyle='#4d525a';lw(.09,.6);ctx.beginPath();
  for(const g of GUNITS){const b=BAYS[g.k],e0=g.c+g.h-.12-GL(g),e1=g.c-g.h+.15;if(e0-e1<.05)continue;ctx.moveTo(b.x+b.tx*e0+b.rx*PGATE,b.z+b.tz*e0+b.rz*PGATE);ctx.lineTo(b.x+b.tx*e1+b.rx*PGATE,b.z+b.tz*e1+b.rz*PGATE);}
  ctx.stroke();
  ctx.fillStyle='#2b2e33';for(const g of GUNITS){const b=BAYS[g.k],hx=g.c+g.h-.12,px=b.x+b.tx*hx+b.rx*PGATE,pz=b.z+b.tz*hx+b.rz*PGATE;ctx.fillRect(px-.1,pz-.1,.2,.2);}
  // postes de validation des lapbars (les opérateurs et les visiteurs du quai : drawStationPeople)
  for(const o of OPS){const h=opHome(o.i),b=o.i?BAYS[NCARS-1]:BAYS[0],e=o.i?-1:1,qx=h[0]+b.tx*e*.7,qz=h[1]+b.tz*e*.7;
    ctx.fillStyle='#30353c';ctx.fillRect(qx-.28,qz-.28,.56,.56);
    ctx.fillStyle=o.ok?'#4fc27a':o.st==='idle'?'#59606a':'#d0a03a';ctx.beginPath();ctx.arc(qx,qz,.15,0,7);ctx.fill();}
}
// Personnes du quai (propriétaire, Tonnerre 2 Zeus, 2026-11-16, lot 5 : opérateurs passés sous la voie, visiteurs invisibles entre portillons et train) : opérateurs,
// visiteurs aux places d'attente, et marcheurs du quai (vers une place, vers un siège, du siège à la porte, tant qu'ils sont dans l'emprise de la gare) sont dessinés
// APRÈS la voie, les trains, les portillons, les garde-corps et le sol du quai ; sous le toit de la gare quand il est affiché, au-dessus quand il est effacé
// (drawWorld). Les visiteurs assis sont dessinés avec leur wagon (drawCar), donc sous le train.
const PLATK={wait:1,board:1,alight:1},onPlat=k=>PLATK[k.kind]&&(k.kind!=='alight'||STSP.length<3||pipXZ(STSP,k.x,k.z));
// Vantaux des portillons : dessinés avec les personnes du quai, APRÈS la voie et les trains (sinon le tablier de la voie, plus large que le wagon, les cachait
// quand ils s'ouvrent vers le train : propriétaire, Zeus, 2026-11-17)
function drawGateLeaves(){const a=G.gate*1.45,ca=Math.cos(a),sa=Math.sin(a),GL=g=>Math.min(2*g.h-.3,PGATE-PEDGE-.05);
  ctx.strokeStyle=G.gate>.5?'#4f9a72':'#a8443a';lw(.13,.9);ctx.lineCap='round';ctx.beginPath();
  for(const g of GUNITS){const b=BAYS[g.k],hx=g.c+g.h-.12,len=GL(g),px=b.x+b.tx*hx+b.rx*PGATE,pz=b.z+b.tz*hx+b.rz*PGATE;ctx.moveTo(px,pz);ctx.lineTo(px+(-b.tx*ca-b.rx*sa)*len,pz+(-b.tz*ca-b.rz*sa)*len);}
  ctx.stroke();ctx.lineCap='butt';
}
function drawStationPeople(){drawGateLeaves();
  G.plat.forEach((r,i)=>{if(r&&r.on){const p=slotPos(i);person(p[0],p[2],r.ci,r.ph,false);}});
  for(const k of G.walkers)if(onPlat(k))person(k.x,k.z,k.ci,k.ph,true);
  for(const o of OPS)person(o.x,o.z,3,o.i+.6,o.mv,'#1d2b4f');
}
function drawQSide(P,PP){if(!PP.length)return;ctx.strokeStyle='rgba(0,0,0,.25)';lw(.08,.6);ctx.save();ctx.translate(.1,.08);ctx.stroke(P);ctx.restore();
  ctx.strokeStyle='#4a4f56';lw(.08,1);ctx.stroke(P);ctx.strokeStyle='rgba(205,210,214,.5)';lw(.03,.3);ctx.stroke(P);
  if(cam.s>6){ctx.fillStyle='#2f3338';for(const q of PP)ctx.fillRect(q[0]-.06,q[1]-.06,.12,.12);}}
function drawBld(b,s){ // toit d'un bâtiment (OSM ou SITE.buildings)
  ctx.globalAlpha=bldA(b);ctx.fillStyle=b.st&&SITE.stationRoofCol?SITE.stationRoofCol:b.col;ctx.fill(b.p);
  ctx.save();ctx.clip(b.p);
  if(s>4){ctx.fillStyle=TEX.rows;ctx.globalAlpha*=.35;ctx.fill(b.p);ctx.globalAlpha=bldA(b);}
  if(b.st&&SITE.draw&&SITE.draw.stationRoof)SITE.draw.stationRoof(ctx,b,API);
  else{ctx.lineWidth=3.4;ctx.strokeStyle='rgba(255,255,255,.2)';ctx.stroke(b.lit);ctx.strokeStyle='rgba(0,0,0,.24)';ctx.stroke(b.dark);}
  ctx.restore();ctx.strokeStyle='rgba(40,25,20,.6)';lw(.25,.8);ctx.stroke(b.p);
}
function drawWorld(dt){
  hideA=lerp(hideA,G.hideSt?0:1,Math.min(1,dt*5));if(hideA<.004)hideA=0;
  const s=cam.s,x0=cam.x-VW/2/s,x1=cam.x+VW/2/s,z0=cam.z-VH/2/s,z1=cam.z+VH/2/s,vis=(a,b,c,d)=>a<x1&&b>x0&&c<z1&&d>z0,dry=1-wet*.8;
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
  if(WOODY){ctx.strokeStyle=TEX.dirt;ctx.globalAlpha=.85;ctx.lineWidth=8.5;ctx.stroke(dirtP);ctx.globalAlpha=1;} // terre battue sous la charpente en bois
  ctx.strokeStyle='#6f7176';ctx.lineWidth=5.2;for(const p of LY.road)ctx.stroke(p);ctx.strokeStyle=TEX.asph;ctx.lineWidth=4.4;for(const p of LY.road)ctx.stroke(p);
  // bordures des allées et de la file : seulement hors des zones piétonnes (propriétaire, lot 4 : pas de trait noir à la jonction allée / zone piétonne)
  const pedClip=()=>{if(PEDOUT){ctx.save();ctx.clip(PEDOUT,'evenodd');return true;}return false;};
  {const k=pedClip();ctx.strokeStyle='#a89a78';ctx.lineWidth=3.8;for(const p of LY.foot)ctx.stroke(p);if(k)ctx.restore();}ctx.strokeStyle=TEX.sand;ctx.lineWidth=FOOT_W;for(const p of LY.foot)ctx.stroke(p);
  ctx.strokeStyle='#2f5a2c';ctx.lineWidth=1.3;for(const p of LY.hedge)ctx.stroke(p);
  // file d'attente (allée réelle, barrières des deux côtés)
  ctx.lineCap='round';{const k=pedClip();ctx.strokeStyle='#4a3a28';for(const [w,P] of QWP){ctx.lineWidth=w+.3;ctx.stroke(P);}if(k)ctx.restore();}ctx.strokeStyle=TEX.stone;for(const [w,P] of QWP){ctx.lineWidth=w;ctx.stroke(P);} // largeur adaptée (QWP)
  if(QRAILP.length){ctx.strokeStyle='rgba(0,0,0,.25)';lw(.1,.6);ctx.save();ctx.translate(.12,.09);ctx.stroke(QRAIL);ctx.restore(); // barrières entre allées collées : ombre,
    ctx.strokeStyle='#4a4f56';lw(.1,1.2);ctx.stroke(QRAIL);ctx.strokeStyle='rgba(205,210,214,.5)';lw(.03,.3);ctx.stroke(QRAIL); // main courante
    if(cam.s>6){ctx.fillStyle='#2f3338';for(const q of QRAILP)ctx.fillRect(q[0]-.07,q[1]-.07,.14,.14);}} // poteaux
  drawQSide(QSIDE,QSIDEP); // barrières de délimitation de la file (zones piétonnes)
  // barrières de la file : vantail métallique pivotant sur un poteau en bordure de chemin
  ctx.lineCap='butt';
  drawSteps(false);
  // ombres portées
  if(dry>.25){
    ctx.fillStyle=`rgba(12,28,14,${.3*dry})`;
    for(const t of trees)if(vis(t.x-t.r,t.x+t.r*3,t.z-t.r,t.z+t.r*3)){ctx.beginPath();ctx.ellipse(t.x+t.r*1.25,t.z+t.r*.95,t.r*1.05,t.r*.9,.6,0,7);ctx.fill();}
    for(const b of LY.bld){ctx.save();ctx.translate(b.h*SHX,b.h*SHZ);ctx.globalAlpha=bldA(b);ctx.fill(b.p);ctx.restore();}
    if(tunnelP){ctx.save();ctx.translate(2.2,1.7);ctx.fill(tunnelP);ctx.restore();}
    for(const r of ROCKS){ctx.save();ctx.translate(r.h*SHX*.6,r.h*SHZ*.6);ctx.globalAlpha=r.cov?.2+.8*hideA:1;ctx.fill(r.pa);ctx.restore();} // ombre du rocher (relief arrondi : ombre plus courte)
    for(const b of BRIDGES){ctx.save();ctx.translate(b.h*SHX,b.h*SHZ);ctx.strokeStyle=`rgba(12,28,14,${.3*dry})`;ctx.lineWidth=b.w;ctx.stroke(b.deck);ctx.restore();}
    ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;
    for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o)){const k=swPush(o);ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:INV?.45:STL?.3:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
    for(const t of trains)for(let k=0;k<NCARS;k++)if(!inTun(((t.s-(k+.5)*CAR)%L+L)%L))drawCar(t,k,true);
    if(CATW.walks.length||CATW.towers.length){ctx.save();ctx.fillStyle=ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;catwalkShadows();ctx.restore();} // passerelles de service (aucune sur Zeus : rien ne change)
    if(SITE.draw&&SITE.draw.shadows)SITE.draw.shadows(ctx,dry,API);
  }
  // sol de la gare, voie de garage
  (TRAV?drawTraverser:drawTable)();drawStationFloor(s);drawLands(s);drawSteps(true);drawQSide(QSIDE2,QSIDEP2);drawBooth(s);drawGates();
  if(COV.length&&hideA<.97){ctx.save();ctx.globalAlpha=1-hideA; // couloir couvert (sous la gare, souterrain, sous un rocher) : vu SEULEMENT quand la gare est masquée
    ctx.lineCap='butt';for(const c of COVD){ctx.strokeStyle=c.q?'#4a3a28':'#2b2824';ctx.lineWidth=c.w+.3;ctx.stroke(c.p);} // murs : côtés seulement (bouts droits)
    for(const c of COVD){ctx.strokeStyle=c.q?TEX.stone:TEX.sand;ctx.lineWidth=c.w;ctx.stroke(c.p); // sol : même teinte que le chemin extérieur
      ctx.strokeStyle='rgba(20,18,14,.07)';for(const t of c.tr)ctx.stroke(t);} // ombre du couvert, progressive depuis chaque bout
    ctx.lineCap='round';
    for(const q of COVL){const g=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],1.3);g.addColorStop(0,'rgba(255,232,170,.42)');g.addColorStop(1,'rgba(255,232,170,0)');ctx.fillStyle=g;ctx.fillRect(q[0]-1.3,q[1]-1.3,2.6,2.6);} // éclairage discret (plafonniers)
    ctx.restore();}
  // personnages
  {const sh=hideA<.5;for(const v of G.queue)if(sh||!inCov(v.x,v.z))person(v.x,v.z,v.ci,v.ph,v.mv); // visiteurs d'un couloir couvert : seulement gare masquée
  for(const k of G.walkers)if(!onPlat(k)&&(sh||!inCov(k.x,k.z)))person(k.x,k.z,k.ci,k.ph,true);}
  for(const p of strollers){p.d+=p.v*dt*G.speed;if(p.d>p.f.len||p.d<0){p.v=-p.v;p.d=clamp(p.d,0,p.f.len);}pathPos(p.f.P,p.f.C,p.d,p,p.side);if(p.x>x0-1&&p.x<x1+1&&p.z>z0-1&&p.z<z1+1)person(p.x,p.z,p.ci,p.ph,G.speed>0);}
  if(G.job){const p=JOBSITE[G.job.type];person(p[0],p[1],C_TECH,.5,true,'#fff3b0');person(p[0]+1.1,p[1]+.5,C_TECH,2,true,'#fff3b0');}
  // bâtiments survolés par la voie (ROOFB, issue #14) : sous la voie, ses poteaux posés sur le toit, les passerelles et les trains ; ombres de la voie, des trains et des passerelles sur le toit
  for(const b of LY.bld)if(b.un){drawBld(b,s);ctx.globalAlpha=1;
    if(dry>.25){ctx.save();ctx.clip(b.p);ctx.translate(-b.h*SHX,-b.h*SHZ);ctx.fillStyle=ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;
      for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o)){const k=swPush(o);ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:INV?.45:STL?.3:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
      for(const t of trains)for(let k=0;k<NCARS;k++)if(!inTun(((t.s-(k+.5)*CAR)%L+L)%L))drawCar(t,k,true);
      if(CATW.walks.length||CATW.towers.length)catwalkShadows();
      ctx.restore();}}
  // voie + trains, triés par hauteur
  const items=[];
  for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o))items.push(o);
  brakeState(dt);
  const hI=s=>chunkH[Math.floor((((s%L)+L)%L)/DS)%N];
  for(const t of trains){const ex=t.st==='run'&&zoneOf(t.s)==='course'&&t.v>9;t.arms=lerp(t.arms,ex?1:0,Math.min(1,dt*4));
    const cs=t.st==='run'?t.s:t.st==='station'?S_ST:null;
    for(let k=0;k<NCARS;k++){let h=INV?ST_Y-1.5:ST_Y+.05; // garage : au niveau des voies ; coaster inversé (issue #16, OzIris) : wagon suspendu SOUS la poutre des voies et du rail du pont, comme sur le circuit
      if(cs!==null){const sc=cs-(k+.5)*CAR,hs=[hI(sc-CAR/2),hI(sc),hI(sc+CAR/2)],up=t.st==='run'&&frameAt(sc,_cf).U.y<0;
        // le wagon est dessiné APRÈS tous les tronçons qu'il recouvre (le plus haut des trois + 5 cm) : jamais recouvert par sa propre voie, ses freins, sa chaîne ;
        // suspendu (coaster inversé) : AVANT sa voie ; tête en bas (looping, vrille) : après, avec ses rails redessinés par-dessus (drawCar)
        h=inTun(((sc%L)+L)%L)?-99:INV&&!up?Math.min(...hs)-1.5:Math.max(...hs)+.05;}
      items.push({h,t,k});}}
  for(const u of TUN)items.push({h:u.h,tun:u});
  for(const r of ROCKS)items.push({h:r.h,rock:r});for(const b of BRIDGES)items.push({h:b.h,br:b});for(const w of CATW.walks)for(const g of w.segs)items.push({h:g.h,cw:g});for(const t of CATW.towers)items.push({h:t.y-.02,tw:t});if(LIP)items.push({h:ST_Y+.02,lip:1});
  items.sort((a,b)=>a.h-b.h);
  for(const o of items){
    if(o.tun){drawTunnel(o.tun);continue;}
    if(o.rock){drawRock(o.rock);continue;}
    if(o.br){drawBridge(o.br);continue;}
    if(o.cw){drawCatwalk(o.cw);continue;}
    if(o.tw){drawTower(o.tw);continue;}
    if(o.lip){drawLip();continue;}
    if(o.t){drawCar(o.t,o.k);continue;}
    const k=swPush(o);
    if(o.rp){ctx.fillStyle='rgba(0,0,0,.3)';ctx.save();ctx.translate(.25,.2);ctx.fill(o.rp);ctx.restore();ctx.fillStyle=BOB?TRO.edge:TKC.support||'#5b544a';ctx.fill(o.rp);} // poteaux sur le rocher
    if(BOB){ // gouttière en acier : bords sombres, fond clair, reflet au centre
      ctx.strokeStyle=TRO.edge;lw(.22,.7);ctx.stroke(o.str);
      if(o.lay){ctx.fillStyle=TRO.deck;ctx.fill(o.lay[0]);ctx.fillStyle=o.col;ctx.fill(o.lay[1]);ctx.fillStyle=TRO.shine;ctx.fill(o.lay[2]);} // gouttière de gare, rétrécie (TRF)
      else{ctx.strokeStyle=TRO.deck;ctx.lineWidth=DECKW;ctx.stroke(o.deck);ctx.strokeStyle=o.col;ctx.lineWidth=2;ctx.stroke(o.deck);
      ctx.strokeStyle=TRO.shine;ctx.lineWidth=.9;ctx.stroke(o.deck);}
      ctx.strokeStyle=TRO.rim;lw(.1,.5);ctx.stroke(o.rail);
    }else if(INV){ // poutre caisson, rails, puis portiques et poteaux par-dessus
      ctx.strokeStyle='rgba(20,24,30,.55)';ctx.lineWidth=DECKW+.25;ctx.stroke(o.deck);ctx.strokeStyle=TKC.spine;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.3;ctx.stroke(o.deck);
      ctx.strokeStyle=TKC.rail;lw(.14,.6);ctx.stroke(o.rail);
      ctx.strokeStyle=TKC.support;lw(.5,.8);ctx.stroke(o.str);lw(.7,1);ctx.stroke(o.hand);
    }else if(STL){ // supports en A, puis entretoises, rails tubulaires et poutre centrale (au-dessus des rails quand la voie est tête en bas)
      ctx.strokeStyle=TKC.support;lw(.34,.7);ctx.stroke(o.str);lw(.18,.6);ctx.stroke(o.hand);
      if(!o.inv){ctx.strokeStyle='rgba(20,24,30,.28)';ctx.lineWidth=DECKW+.35;ctx.stroke(o.deck);} // ombre sous la voie (tête en bas : voie ajourée, on voit le train dessous)
      ctx.strokeStyle=TKC.spine;lw(.1,.5);ctx.stroke(o.ties);if(!o.inv){lw(.16,.6);ctx.stroke(o.spine);}
      ctx.strokeStyle=TKC.rail;lw(.2,.7);ctx.stroke(o.rail);
      if(o.inv){ctx.strokeStyle=TKC.spine;lw(.22,.6);ctx.stroke(o.spine);}
    }else{
      ctx.strokeStyle='#6e6a63';lw(.16,.7);ctx.stroke(o.str);
      ctx.strokeStyle=o.col;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      if(s>2){ctx.strokeStyle='#5a4028';lw(.24,.5);ctx.stroke(o.ties);}
      ctx.strokeStyle='#e6cfa0';lw(.12,.5);ctx.stroke(o.hand);
      ctx.strokeStyle='#2b2b30';lw(.17,.9);ctx.stroke(o.rail);
    }
    drawBU(o);
    if(o.ch){ctx.strokeStyle='#15161a';lw(.2,.8);ctx.setLineDash([.5,.3]);ctx.stroke(o.ch);ctx.setLineDash([]);} // chaîne du lift
    if(k)ctx.restore();
  }
  const pplLate=roofA<.5;if(!pplLate)drawStationPeople(); // personnes du quai : au-dessus de la voie et des trains, sous le toit affiché
  // voies des attractions voisines
  if(otherP.length){ctx.strokeStyle='#3d4148';ctx.lineWidth=1.5;for(const p of otherP)ctx.stroke(p);ctx.strokeStyle='#9299a3';ctx.lineWidth=.8;for(const p of otherP)ctx.stroke(p);}
  // arbres
  {const vt=trees.filter(t=>vis(t.x-t.r*1.3,t.x+t.r*1.3,t.z-t.r*1.3,t.z+t.r*1.3)),lobes=(k,off)=>{ctx.beginPath();for(const t of vt)for(const l of t.l){const r=l[2]*t.r*k,x=t.x+l[0]*t.r+off*l[2]*t.r,z=t.z+l[1]*t.r+off*l[2]*t.r;ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,7);}ctx.fill();};
    ctx.fillStyle=TEX.canopy;lobes(1,0);ctx.fillStyle='rgba(8,22,10,.3)';lobes(.62,.3);ctx.fillStyle='rgba(120,140,84,.3)';lobes(.6,-.32);
    if(s>5){ctx.fillStyle='rgba(160,176,110,.2)';lobes(.26,-.45);}}
  // barrières de la file (dessinées au-dessus des arbres : elles se cliquent sur la carte)
  for(const l of LOOPS)for(const g of l.gs)leaf(g,g.loop?1-l.t:l.t); // deux barrières liées : celle de la boucle est fermée quand la boucle est hors service
  leaf(ENTRY_GATE,ENTRY_GATE.t);ctx.lineCap='butt';
  // toitures (la gare et le garage s'effacent en zoomant)
  roofA=lerp(roofA,G.roofOff||G.hideSt?0:s>9.5?.08:1,Math.min(1,dt*5));if(roofA<.004)roofA=0;
  for(const b of LY.bld)if(!b.un)drawBld(b,s); // bâtiments survolés par la voie (b.un, ROOFB) : déjà dessinés sous la voie
  ctx.globalAlpha=1;
  // Files couvertes, gare affichée (propriétaire, lot 6) : repère très discret de leur tracé, pointillé fin et clair à faible contraste, par-dessus toits et rochers
  if(hideA>.03&&COVD.some(c=>c.q)){const d=Math.max(.45,4/cam.s);ctx.save();ctx.lineCap='butt';lw(.14,1.2);ctx.setLineDash([d,d]); // tirets clairs puis sombres en alternance : lisible, à peine, sur toit sombre comme sur quai clair
    for(const [c,a,o] of [['#efe8d6',.45,0],['#4a463e',.35,d]]){ctx.globalAlpha=a*hideA;ctx.strokeStyle=c;ctx.lineDashOffset=o;for(const q of COVD)if(q.q)ctx.stroke(q.p);}
    ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.restore();}
  if(roofA<.6&&SITE.draw&&SITE.draw.underRoof)SITE.draw.underRoof(ctx,roofA,API); // charpente visible sous le toit effacé
  if(pplLate)drawStationPeople(); // toit effacé : personnes du quai au-dessus du toit, de la charpente et des colonnes
  if(tunnelP){ctx.fillStyle='#5a4630';ctx.fill(tunnelP);ctx.strokeStyle='#3a2c1c';lw(.3,.8);ctx.stroke(tunnelP);}
  const al=G.liftBroken||G.estop||G.brakeFault||trains.some(t=>t.fault);ctx.fillStyle=al?(Math.sin(clock*9)>0?'#ff2a2a':'#7a0000'):'#3f9a66';const bc=beaconAt();if(bc){ctx.beginPath();ctx.arc(bc[0],bc[1],.2,0,7);ctx.fill();}
  if(SITE.draw&&SITE.draw.landmarks){SITE.draw.landmarks(ctx,s,API);leaf(ENTRY_GATE,ENTRY_GATE.t);ctx.lineCap='butt';} // barrière d'entrée redessinée au-dessus d'un monument qui enjambe l'entrée (statue de Zeus, issue #10) : elle se clique sur la carte
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
    ctx.lineWidth=4.5;ctx.strokeStyle=closed?'#c0584a':'#6fa585';seg(b,b+Math.max(8,TLEN*.5),X,Z);p=at(b);lab('B'+(i+1)+(BTRIM[i]?' ralentit':''),p[0],p[1],closed?'#e08a7c':'#8fc4a4');});
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
  const bq=boothLabelAt();if(bq&&s>9&&s<26){ctx.strokeText('Poste de conduite',X(bq[0]),Z(bq[1]));ctx.fillText('Poste de conduite',X(bq[0]),Z(bq[1]));}
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
  for(const t of trains)if(t.st==='run'){const z=zoneOf(t.s);if(z==='lift'&&t.v>.05&&t.s<S_LIFT1&&!chain){frameAt(t.s-TLEN/2,_cf);chain={v:t.v,x:_cf.p.x,z:_cf.p.z};}if(z==='course'||z==='brake')vmax=Math.max(vmax,t.v);}
  const f=cam.follow>=0?trains[cam.follow]:null;
  sfx.update(dt,{rumble:Math.min(.5,vmax/24*(f?.45:.28)),wind:f&&f.st==='run'?Math.min(.18,f.v*f.v/3200):0,rain:w==='storm'?.16:w==='rain'?.09:0,crowd:Math.min(.07,.012+G.queue.length/3000),lift:chain||null});
}
let last=performance.now(),uiT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const modal=!$('mHelp').classList.contains('hidden')||!$('mBil').classList.contains('hidden')||!$('mNew').classList.contains('hidden');
  if(!modal)for(let i=0;i<G.speed;i++)step(dt);
  render(modal?0:dt);
  uiT+=dt;if(uiT>.12){uiT=0;ui();}
  requestAnimationFrame(frame);
}
document.title=SITE.title+' — Simulateur d\'exploitation';$('ttl').textContent=SITE.title;$('helpTtl').textContent=SITE.title+' — à vous les commandes';
$('trackName').textContent=SITE.trackName||'Voie';$('helpGarage').innerHTML=(SITE.helpGarage||'')+(SITE.helpGarage&&LANES.length?' Le bouton F de chaque voie force ses freins : serrés, ils arrêtent aussitôt le train qui entre ou sort et Dispatch est refusé ; relâchés, la reprise se fait au Dispatch.':''); // phrase commune (issue #11)
log('Bienvenue sur '+SITE.title+' ! '+trains[0].name+' est en gare'+((n=>n?', '+n+' train'+(n>1?'s':'')+' au garage':'')(trains.filter(t=>t.st==='garage').length))+'. Ouvrez l\'entrée pour commencer.','good');
ui();requestAnimationFrame(frame);
Object.assign(window,{G,trains,act,step,cam,L,render,SD:S_DROP,ui});
