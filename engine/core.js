'use strict';
/* Moteur du simulateur d'exploitation (jeu de fan, non officiel). L'attraction est décrite par OSM (données générées) et SITE (configuration), chargés avant ce fichier. Unités : mètres, secondes. */
const $=id=>document.getElementById(id);
// Données du jeu écrites par l'éditeur (lieux/<type>/<lieu>/<el>.game.js, `const GAME={…}`, facultatif, docs/ARCHITECTURE.md D1) : priorité GAME > SITE > calcul du moteur.
// Aperçu de l'éditeur (cadre `?editeur=`) : le brouillon complet voyage dans window.name (`t2z-draft:<JSON>`), pour que les modifications non enregistrées survivent au rechargement du jeu.
const GM=(()=>{let g=typeof GAME!=='undefined'&&GAME&&typeof GAME==='object'?GAME:{};try{if(/[?&]editeur=/.test(location.search)&&/^t2z-draft:/.test(window.name)){const d=JSON.parse(window.name.slice(10));if(d&&typeof d==='object')g=d;}}catch(e){}return g;})();
// GAME.site (docs/ARCHITECTURE.md D9) : surcharges partielles de SITE, liste blanche, fusionnées ICI avant tout calcul (objets fusionnés en profondeur, tableaux remplacés). Clé hors liste : ignorée (l'éditeur la refuse, editor/schema.js).
const SITE_OVR=['kind','car','trains','track','trough','phys'];
// Couleur de la voie lue dans OSM (colour des tronçons du circuit, OSM.attrs role 'track', valeur dominante par longueur, issue #46) : couleur de l'épine (SITE.track.spine) d'un coaster inversé ou acier ; priorité GAME > OSM > SITE.
(()=>{if(typeof OSM==='undefined'||!Array.isArray(OSM.attrs)||typeof SITE==='undefined'||!SITE.track)return;const m={};for(const a of OSM.attrs)if(a&&a.role==='track'&&a.h&&a.h.colour)m[a.h.colour]=(m[a.h.colour]||0)+(a.l||1);const b=Object.keys(m).sort((x,y)=>m[y]-m[x])[0];if(b)SITE.track.spine=b;})();
const SITE_BASE={};SITE_OVR.forEach(k=>{if(typeof SITE!=='undefined'&&SITE[k]!==undefined)SITE_BASE[k]=JSON.parse(JSON.stringify(SITE[k]));}); // valeurs d'origine de SITE (affichées par l'éditeur)
if(GM.site&&typeof GM.site==='object'&&typeof SITE!=='undefined'){const mg=(a,b)=>{for(const k of Object.keys(b)){const v=b[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))mg(a[k],v);else a[k]=JSON.parse(JSON.stringify(v));}};
  SITE_OVR.forEach(k=>{if(k in GM.site){const v=GM.site[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&SITE[k]&&typeof SITE[k]==='object'&&!Array.isArray(SITE[k]))mg(SITE[k],v);else SITE[k]=JSON.parse(JSON.stringify(v));}});}
class V3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  clone(){return new V3(this.x,this.y,this.z);}
  addScaledVector(v,k){this.x+=v.x*k;this.y+=v.y*k;this.z+=v.z*k;return this;}
  multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}
  normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;return this.multiplyScalar(1/l);}
  lerpVectors(a,b,k){this.x=a.x+(b.x-a.x)*k;this.y=a.y+(b.y-a.y)*k;this.z=a.z+(b.z-a.z)*k;return this;}
  crossVectors(a,b){const x=a.y*b.z-a.z*b.y,y=a.z*b.x-a.x*b.z,z=a.x*b.y-a.y*b.x;return this.set(x,y,z);}
}
const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,k)=>a+(b-a)*k;

/* ══════════ TRACÉ : points de contrôle [x, hauteur, z, dévers°, repère] ══════════ */
const CPS=OSM.cps;
const TR=[],TAG={}; let L=0,N=0,DS=.5;
(function buildTrack(){
  const n=CPS.length,SUB=24,dense=[]; let len=0,prev=null;
  // dévers (°) déroulé : continu le long du circuit (vrilles : 0 → 720°, loopings : dévers ≈ 180° au sommet, voir tools/make_site.py « inversions ») ; D = tours complets accumulés sur un tour de circuit
  const wr=a=>a-360*Math.round(a/360),BK=[CPS[0][3]||0];for(let i=1;i<n;i++)BK.push(BK[i-1]+wr((CPS[i][3]||0)-(CPS[i-1][3]||0)));
  const D=BK[n-1]+wr((CPS[0][3]||0)-(CPS[n-1][3]||0))-BK[0],cp=j=>{const m=((j%n)+n)%n,c=CPS[m];return [c[0],c[1],c[2],BK[m]+D*Math.floor(j/n)];};
  for(let i=0;i<n;i++){
    const p0=cp(i-1),p1=cp(i),p2=cp(i+1),p3=cp(i+2);
    for(let j=0;j<SUB;j++){
      const t=j/SUB,t2=t*t,t3=t2*t,q=[0,0,0,0];
      for(let k=0;k<4;k++) q[k]=.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
      if(prev) len+=Math.hypot(q[0]-prev[0],q[1]-prev[1],q[2]-prev[2]);
      if(j===0) for(const tg of CPS[i].slice(4)) TAG[tg]=len;
      dense.push({v:q,s:len}); prev=q;
    }
  }
  len+=Math.hypot(dense[0].v[0]-prev[0],dense[0].v[1]-prev[1],dense[0].v[2]-prev[2]);
  dense.push({v:dense[0].v,s:len});
  L=len;N=Math.round(L/.5);DS=L/N;
  const pts=[]; let j=0;
  for(let i=0;i<N;i++){const s=i*DS;while(dense[j+1].s<s)j++;const a=dense[j],b=dense[j+1],k=(s-a.s)/((b.s-a.s)||1);
    pts.push([0,1,2,3].map(c=>lerp(a.v[c],b.v[c],k)));}
  // Gare droite (issue #43, propriétaire 20/11 : dernier wagon de Zeus de travers en gare) : la spline passe par le nœud OSM du début de gare et y garde la courbure
  // de l'arrivée, si bien que le wagon de queue se mettait en biais. Une gare presque droite (écart à la corde st0 → st1 de moins de ST_STRAIGHT = 0,6 m, ESTIMÉ) est
  // redressée en plan sur cette corde (hauteurs gardées) : voie, quai, portillons et wagons alignés. Une gare franchement courbe reste telle qu'OSM la donne.
  {const ST_STRAIGHT=.6,i0=Math.ceil((TAG.st0||0)/DS),i1=TAG.st1!=null?Math.floor(TAG.st1/DS):-1;
    if(i1-i0>8&&i1<N){const A=pts[i0],B=pts[i1],dx=B[0]-A[0],dz=B[2]-A[2],l2=dx*dx+dz*dz;let dev=0;
      for(let i=i0;i<=i1;i++){const p=pts[i],t=((p[0]-A[0])*dx+(p[2]-A[2])*dz)/l2;dev=Math.max(dev,Math.hypot(p[0]-A[0]-t*dx,p[2]-A[2]-t*dz));}
      if(dev<ST_STRAIGHT)for(let i=i0+1;i<i1;i++){const t=(i-i0)/(i1-i0);pts[i][0]=A[0]+t*dx;pts[i][2]=A[2]+t*dz;}}}
  const Y=new V3(0,1,0);
  for(let i=0;i<N;i++){
    const a=pts[(i-1+N)%N],c=pts[(i+1)%N],p=pts[i];
    const T=new V3(c[0]-a[0],c[1]-a[1],c[2]-a[2]).normalize();
    const R0=new V3().crossVectors(T,Y).normalize(),U0=new V3().crossVectors(R0,T),b=p[3]*Math.PI/180;
    const U=U0.clone().multiplyScalar(Math.cos(b)).addScaledVector(R0,-Math.sin(b)),R=new V3().crossVectors(T,U);
    TR.push({p:new V3(p[0],p[1],p[2]),T,U,R});
  }
})();
const mkF=()=>({p:new V3,T:new V3,U:new V3,R:new V3});
function frameAt(s,o){
  s=((s%L)+L)%L;const f=s/DS,i=Math.floor(f)%N,k=f-Math.floor(f),a=TR[i],b=TR[(i+1)%N];
  o.p.lerpVectors(a.p,b.p,k);o.T.lerpVectors(a.T,b.T,k).normalize();o.U.lerpVectors(a.U,b.U,k).normalize();o.R.crossVectors(o.T,o.U);return o;
}
function hAt(s){s=((s%L)+L)%L;const f=s/DS,i=Math.floor(f)%N,k=f-Math.floor(f);return lerp(TR[i].p.y,TR[(i+1)%N].p.y,k);}
const BOB=SITE.kind==='bob',INV=SITE.kind==='inverted',STL=SITE.kind==='steel',LS=SITE.loadSide||1,PH=Object.assign({roll:.098,drag:.0006,vmin:3},SITE.phys);
const ST_Y=OSM.cps[0][1],CAR=SITE.car.len,NCARS=SITE.car.n,TLEN=CAR*NCARS,CSEATS=SITE.car.seats||2,SEATS=NCARS*CSEATS;
// Place r (0…CSEATS-1) d'un wagon : [décalage le long du wagon, décalage latéral]. Côte à côte par rangées de 2, ou l'un derrière l'autre (car.inline).
// car.abreast : nombre de places côte à côte par rangée (défaut 2 ; ex. 4 pour un wagon de coaster inversé, une seule rangée).
const S_COLS=SITE.car.inline?1:Math.min(SITE.car.abreast||2,CSEATS),S_ROWS=Math.ceil(CSEATS/S_COLS);
// car.inline : places réparties sur la longueur utile du wagon (≈ 45 % chacune pour deux places), un peu en arrière pour laisser la lapbar devant le passager avant.
// car.pitch : écart (m) d'axe à axe entre deux places l'une derrière l'autre (car.inline), centrées sur le wagon ; sans pitch : ≈ 45 % de la longueur.
const seatOff=r=>{const c=r%S_COLS,w=Math.floor(r/S_COLS),d=Math.min(.66*(S_ROWS-1),CAR-.5);return [S_ROWS<2?0:SITE.car.inline?(SITE.car.pitch?SITE.car.pitch*((S_ROWS-1)/2-w):CAR*.45*(.5-w/(S_ROWS-1))*(S_ROWS>2?2*(S_ROWS-1)/S_ROWS:1)-.05):d/2*(1-2*w/(S_ROWS-1))-.03,S_COLS>2?(c-(S_COLS-1)/2)*.6:S_COLS>1?(c?.33:-.33):0];};
// Sécurités des passagers : SITE.car.restraint = 'lapbar' | 'otsr' (harnais par-dessus les épaules) | 'belt' ; SITE.car.restraintPer = 'seat' | 'car' (une barre par place, ou une barre commune au wagon).
// Défauts par SITE.kind : wood → lapbar par place (Zeus, propriétaire), bob → lapbar par wagon (Trace du Hourra, propriétaire), inverted → otsr par place (OzIris), steel → otsr par place (Goudurix, estimé, à confirmer).
const RES_KIND=SITE.car.restraint||({wood:'lapbar',bob:'lapbar',inverted:'otsr',steel:'otsr'})[SITE.kind]||'lapbar',RES_PER=SITE.car.restraintPer||(SITE.kind==='bob'?'car':'seat'),RES_T=1.5,RES_AIR=.5,RES_NAME={lapbar:'lapbars',otsr:'harnais',belt:'ceintures'}[RES_KIND]||'lapbars'; // RES_T : durée d'ouverture / de fermeture (s, estimée)
// Arrêt en gare : SITE.stopBack m avant la fin de gare ; si l'arrière du train dépasserait alors du bâtiment de gare (SITE.stationPoly), le train avance d'autant
// (au plus jusqu'à la fin de gare TAG.st1) : un train long dans une gare courte reste sous le toit, portillons compris.
// Arrêt en gare : st1 - SITE.stopBack ; repère OSM « stp » (tools/make_site.py : fin du dernier tronçon tagué station quand la gare est prolongée par des
// tronçons d'un autre type, « moving » d'OzIris, issue #13) : la tête s'arrête là (SITE.stopBack ignoré) ; puis avancé si l'arrière dépasse du bâtiment.
function stationStop(){const s0=TAG.stp!=null?TAG.stp:TAG.st1-(SITE.stopBack||0),P=SITE.stationPoly;if(!P||P.length<3)return s0;
  const pin=(x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const f=mkF();let a=null;for(let q=-8;q<=TAG.st1;q+=.1){frameAt(q,f);if(pin(f.p.x,f.p.z)){a=q;break;}}if(a===null)return s0;
  return a+TLEN-s0>.1?Math.min(TAG.st1,a+.3+TLEN):s0;} // dépassement de plus de 10 cm : on avance (marge 0,3 m)
const S_ST=stationStop(),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=SITE.holdBack!=null?L-SITE.holdBack:SITE.yard&&SITE.yard.device==='traverser'&&TAG.tr1!=null?TAG.tr1-(SITE.yard.post!=null?SITE.yard.post:.6):TAG.fin!=null?TAG.fin:L-4,S_DROP=S_LIFT1+(SITE.dropAfter||14);
// Repères lus dans OSM par tools/make_site.py (roller_coaster:track) : blkN = arrêt du frein de bloc N, bzN = début de sa zone ; brk/fin = début / fin du frein final ;
// tr0/tr1 = rail de transfert (pont transbordeur) ; pre0/pre1 = frein avant gare. S_HOLD (arrêt au frein final) : SITE.holdBack s'il est donné, sinon fin du rail de transfert
// (pont droit), sinon fin du frein final OSM (fin), sinon 4 m avant la gare.
const BLK=Object.keys(TAG).filter(k=>/^blk\d+$/.test(k)).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
const BZ0=BLK.map(b=>{const k=Object.keys(TAG).find(q=>/^blk\d+$/.test(q)&&TAG[q]===b),a=TAG['bz'+k.slice(3)];return a!=null&&a<b?a:b-9;}); // début de chaque zone de frein de bloc (OSM, sinon 9 m avant l'arrêt)
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
