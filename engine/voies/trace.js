'use strict';
/* ══════════ TRACÉ : points de contrôle [x, hauteur, z, dévers°, repère] ══════════ */
const CPS=OSM.cps;
const TR=[],TAG={}; let L=0,N=0,DS=.5;
// Hauteurs du circuit réglées dans l'éditeur (GAME.profile, osmrides#53 lot 2) : [[s, h(, 'lin')], …], h = hauteur de la voie (m, au-dessus du niveau de la gare = sol), s = abscisse
// DU TRACÉ D'ORIGINE (sans GAME.profile) ; interpolation lisse (cubique monotone, sans dépassement, tangente nulle aux sommets) ou linéaire jusqu'au point suivant ('lin'). Le profil REMPLACE les
// hauteurs d'origine de OSM.cps, sauf la gare (st0 à st1) et les inversions (OSM.inversions : loopings et vrilles dessinés dans les points de contrôle), qui gardent les leurs ; repères, OSM.tunnels
// et OSM.inversions sont recalés sur la nouvelle abscisse (la voie s'allonge ou se raccourcit avec la pente). Absent ou invalide = hauteurs d'origine, tracé identique. PROF : lu par l'éditeur.
const PROF={on:false,L0:0,s0:[],h0:[],tag0:{},fix:[],pts:[],tun0:[],inv0:[],h:null}; // h(s) = hauteur effective à l'abscisse d'origine s ; tun0, inv0 : tunnels et inversions à l'abscisse d'origine
function profilLisse(P,Lc){ // P triés par s, courbe périodique de longueur Lc : renvoie h(s)
  const k=P.length,X=[],Y=[],LN=[];for(const o of [-1,0,1])for(const q of P){X.push(q[0]+o*Lc);Y.push(q[1]);LN.push(q[2]==='lin');}
  const n=X.length,d=[],M=[];for(let i=0;i<n-1;i++)d.push((Y[i+1]-Y[i])/((X[i+1]-X[i])||1e-9));
  for(let i=0;i<n;i++){if(i===0||i===n-1){M.push(d[Math.min(i,n-2)]);continue;}
    const h0=X[i]-X[i-1],h1=X[i+1]-X[i];if(d[i-1]*d[i]<=0)M.push(0);else{const w1=2*h1+h0,w2=h1+2*h0;M.push((w1+w2)/(w1/d[i-1]+w2/d[i]));}}
  return s=>{s=((s%Lc)+Lc)%Lc+Lc;let a=0,b=n-1;while(b-a>1){const m=(a+b)>>1;if(X[m]<=s)a=m;else b=m;}
    const h=X[b]-X[a],t=(s-X[a])/(h||1);if(LN[a])return Y[a]+(Y[b]-Y[a])*t;
    const t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*Y[a]+(t3-2*t2+t)*h*M[a]+(-2*t3+3*t2)*Y[b]+(t3-t2)*h*M[b];};
}
(function buildTrack(){
  const n=CPS.length,SUB=24; let len=0,prev=null,dense,tg,sAt;
  // dévers (°) déroulé : continu le long du circuit (vrilles : 0 → 720°, loopings : dévers ≈ 180° au sommet, voir tools/make_site.py « inversions ») ; D = tours complets accumulés sur un tour de circuit
  const wr=a=>a-360*Math.round(a/360),BK=[CPS[0][3]||0];for(let i=1;i<n;i++)BK.push(BK[i-1]+wr((CPS[i][3]||0)-(CPS[i-1][3]||0)));
  const D=BK[n-1]+wr((CPS[0][3]||0)-(CPS[n-1][3]||0))-BK[0],cp=j=>{const m=((j%n)+n)%n,c=CPS[m];return [c[0],c[1],c[2],BK[m]+D*Math.floor(j/n)];};
  function spline(){ // spline de Catmull-Rom par les points de contrôle (hauteurs courantes de CPS) : points denses, abscisse de chaque point de contrôle, repères
    dense=[];tg={};sAt=[];len=0;prev=null;
    for(let i=0;i<n;i++){
      const p0=cp(i-1),p1=cp(i),p2=cp(i+1),p3=cp(i+2);
      for(let j=0;j<SUB;j++){
        const t=j/SUB,t2=t*t,t3=t2*t,q=[0,0,0,0];
        for(let k=0;k<4;k++) q[k]=.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
        if(prev) len+=Math.hypot(q[0]-prev[0],q[1]-prev[1],q[2]-prev[2]);
        if(j===0){sAt.push(len);for(const t of CPS[i].slice(4)) tg[t]=len;}
        dense.push({v:q,s:len}); prev=q;
      }
    }
    len+=Math.hypot(dense[0].v[0]-prev[0],dense[0].v[1]-prev[1],dense[0].v[2]-prev[2]);
    dense.push({v:dense[0].v,s:len});
  }
  spline();
  PROF.L0=len;PROF.s0=sAt.slice();PROF.h0=CPS.map(c=>c[1]);Object.assign(PROF.tag0,tg);
  PROF.tun0=(OSM.tunnels||[]).map(t=>t.slice());PROF.inv0=(OSM.inversions||[]).map(v=>({type:v.type,s0:v.s0,s1:v.s1}));
  const h0at0=s=>{s=((s%PROF.L0)+PROF.L0)%PROF.L0;let a=0,b=n-1;if(s>=sAt[n-1])return PROF.h0[n-1];while(b-a>1){const m=(a+b)>>1;if(sAt[m]<=s)a=m;else b=m;}return lerp(PROF.h0[a],PROF.h0[b],(s-sAt[a])/((sAt[b]-sAt[a])||1));};PROF.h=h0at0;
  const fix=[];if(tg.st0!=null&&tg.st1!=null)fix.push([tg.st0,tg.st1]);
  for(const v of (OSM.inversions||[]))if(v&&isFinite(v.s0)&&isFinite(v.s1))fix.push([v.s0,v.s1]);
  PROF.fix=fix;const inFix=s=>fix.some(f=>s>=f[0]&&s<=f[1]);
  const GP=GM.profile;
  if(Array.isArray(GP)&&GP.length>=2&&GP.every(q=>Array.isArray(q)&&isFinite(q[0])&&isFinite(q[1]))){
    const h0at=h0at0;
    const P=GP.map(q=>q.slice(0,3)).filter(q=>!inFix(q[0]));for(const f of fix){P.push([f[0],h0at(f[0])]);P.push([f[1],h0at(f[1])]);}
    P.sort((a,b)=>a[0]-b[0]);PROF.pts=P;
    const f=profilLisse(P,len),old=sAt.slice();PROF.h=s=>inFix(s)?h0at(s):f(s);
    for(let i=0;i<n;i++)if(!inFix(old[i]))CPS[i][1]=f(old[i]);
    spline();PROF.on=true;
    const mp=s=>{if(!isFinite(s))return s;s=Math.max(0,Math.min(old[n-1]+1e-6,s));let a=0,b=n-1;if(s>=old[n-1])return lerp(sAt[n-1],len,(s-old[n-1])/((PROF.L0-old[n-1])||1));while(b-a>1){const m=(a+b)>>1;if(old[m]<=s)a=m;else b=m;}return lerp(sAt[a],sAt[b],(s-old[a])/((old[b]-old[a])||1));};
    for(const t of (OSM.tunnels||[])){t[0]=+mp(t[0]).toFixed(2);t[1]=+mp(t[1]).toFixed(2);}
    for(const t of (SITE.tunnels||[]))if(t&&Array.isArray(t.s)){t.s=[mp(t.s[0]),mp(t.s[1])];}
    for(const v of (OSM.inversions||[])){v.s0=mp(v.s0);v.s1=mp(v.s1);}
    for(const v of (OSM.elements||[])){v.s0=mp(v.s0);v.s1=mp(v.s1);}
  }
  Object.assign(TAG,tg);
  L=len;N=Math.round(L/.5);DS=L/N;
  const pts=[]; let j=0;
  for(let i=0;i<N;i++){const s=i*DS;while(dense[j+1].s<s)j++;const a=dense[j],b=dense[j+1],k=(s-a.s)/((b.s-a.s)||1);
    pts.push([0,1,2,3].map(c=>lerp(a.v[c],b.v[c],k)));}
  // Gare droite (issue #43, propriétaire 20/11 : dernier wagon de travers en gare) : la spline passe par le nœud OSM du début de gare et y garde la courbure
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
// hauteur de la voie la plus haute à moins de r m d'un tracé P (passerelle qui la franchit, engine/noyau/personnes.js), -1 sans voie
extension({nom:'voies',hauteurSous(P,r){let ty=-1;for(let i=0;i<N;i+=2){const q=TR[i].p;if(dPl(q.x,q.z,P)<r)ty=Math.max(ty,q.y);}return ty;}});
