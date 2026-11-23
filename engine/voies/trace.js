'use strict';
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
// hauteur de la voie la plus haute à moins de r m d'un tracé P (passerelle qui la franchit, engine/noyau/personnes.js), -1 sans voie
extension({nom:'voies',hauteurSous(P,r){let ty=-1;for(let i=0;i<N;i+=2){const q=TR[i].p;if(dPl(q.x,q.z,P)<r)ty=Math.max(ty,q.y);}return ty;}});
