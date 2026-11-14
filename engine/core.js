'use strict';
/* Moteur du simulateur d'exploitation (jeu de fan, non officiel). L'attraction est décrite par OSM (données générées) et SITE (configuration), chargés avant ce fichier. Unités : mètres, secondes. */
const $=id=>document.getElementById(id);
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
  for(let i=0;i<n;i++){
    const p0=CPS[(i-1+n)%n],p1=CPS[i],p2=CPS[(i+1)%n],p3=CPS[(i+2)%n];
    for(let j=0;j<SUB;j++){
      const t=j/SUB,t2=t*t,t3=t2*t,q=[0,0,0,0];
      for(let k=0;k<4;k++) q[k]=.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
      if(prev) len+=Math.hypot(q[0]-prev[0],q[1]-prev[1],q[2]-prev[2]);
      if(j===0&&p1[4]) TAG[p1[4]]=len;
      dense.push({v:q,s:len}); prev=q;
    }
  }
  len+=Math.hypot(dense[0].v[0]-prev[0],dense[0].v[1]-prev[1],dense[0].v[2]-prev[2]);
  dense.push({v:dense[0].v,s:len});
  L=len;N=Math.round(L/.5);DS=L/N;
  const pts=[]; let j=0;
  for(let i=0;i<N;i++){const s=i*DS;while(dense[j+1].s<s)j++;const a=dense[j],b=dense[j+1],k=(s-a.s)/((b.s-a.s)||1);
    pts.push([0,1,2,3].map(c=>lerp(a.v[c],b.v[c],k)));}
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
const BOB=SITE.kind==='bob',LS=SITE.loadSide||1,PH=Object.assign({roll:.098,drag:.0006,vmin:3},SITE.phys);
const ST_Y=OSM.cps[0][1],CAR=SITE.car.len,NCARS=SITE.car.n,TLEN=CAR*NCARS,CSEATS=SITE.car.seats||2,SEATS=NCARS*CSEATS;
// Place r (0…CSEATS-1) d'un wagon : [décalage le long du wagon, décalage latéral]. Côte à côte par rangées de 2, ou l'un derrière l'autre (car.inline).
const S_COLS=SITE.car.inline?1:Math.min(2,CSEATS),S_ROWS=Math.ceil(CSEATS/S_COLS);
const seatOff=r=>{const c=r%S_COLS,w=Math.floor(r/S_COLS),d=Math.min(.66*(S_ROWS-1),CAR-.5);return [S_ROWS>1?d/2*(1-2*w/(S_ROWS-1))-.03:0,S_COLS>1?(c?.33:-.33):0];};
const S_ST=TAG.st1-(SITE.stopBack||0),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=L-(SITE.holdBack||4),S_DROP=S_LIFT1+(SITE.dropAfter||14);
const BLK=Object.keys(TAG).filter(k=>k.startsWith('blk')).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
