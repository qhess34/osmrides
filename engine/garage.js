'use strict';
// Voie de garage reliée par un tronçon en S coulissant (pont transbordeur) : après la gare, ou sur le frein final (GAR.at==='brake')
const GAR=SITE.garage,ANCH=GAR.at==='brake'?S_HOLD:S_ST,SW_A=ANCH+GAR.a,SW_B=ANCH+GAR.b,SW_D=GAR.slide,GPATH=[],GSTEP=TLEN+1.2;let SW_LEN=0,GMAX=0;
const SW0=(()=>{const f=frameAt(SW_A,mkF()),l=Math.hypot(f.R.x,f.R.z)||1;return {x:f.p.x,z:f.p.z,tx:f.T.x,tz:f.T.z,vx:-GAR.side*f.R.x/l,vz:-GAR.side*f.R.z/l};})(); // (vx,vz) : sens de coulissement du pont
(function(){
  const P0=[SW0.x,SW0.z],T0=[SW0.tx,SW0.tz],P1=GAR.p1,E=GAR.end,k=GAR.k||3.6;
  let md=[E[0]-P1[0],E[1]-P1[1]];const ml=Math.hypot(md[0],md[1]);md=[md[0]/ml,md[1]/ml];
  const c1=[P0[0]+T0[0]*k,P0[1]+T0[1]*k],c2=[P1[0]-md[0]*k,P1[1]-md[1]*k],raw=[];
  for(let i=0;i<=36;i++){const t=i/36,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;raw.push([a*P0[0]+b*c1[0]+c*c2[0]+d*P1[0],a*P0[1]+b*c1[1]+c*c2[1]+d*P1[1]]);}
  for(let d=.5;d<=ml;d+=.5)raw.push([P1[0]+md[0]*d,P1[1]+md[1]*d]);
  let acc=0;raw.forEach((q,i)=>{if(i)acc+=Math.hypot(q[0]-raw[i-1][0],q[1]-raw[i-1][1]);GPATH.push({x:q[0],z:q[1],d:acc});if(i===36)SW_LEN=acc;});
  GMAX=acc+GAR.a;
})();
const GCAP=Math.floor((GMAX-GAR.a-SW_LEN-TLEN)/GSTEP)+1; // nombre de trains que la voie de garage peut recevoir
function gFrame(u,o){
  u=clamp(u,0,GPATH[GPATH.length-1].d);let i=1;while(i<GPATH.length-1&&GPATH[i].d<u)i++;
  const a=GPATH[i-1],b=GPATH[i],k=(u-a.d)/((b.d-a.d)||1),l=Math.hypot(b.x-a.x,b.z-a.z)||1;
  o.p.set(lerp(a.x,b.x,k),ST_Y,lerp(a.z,b.z,k));o.T.set((b.x-a.x)/l,0,(b.z-a.z)/l);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
// Quai : une travée et un portillon par wagon
const BAYS=[];for(let k=0;k<NCARS;k++){const f=frameAt(S_ST-(k+.5)*CAR,mkF());BAYS.push({x:f.p.x,z:f.p.z,rx:f.R.x*LS,rz:f.R.z*LS,tx:f.T.x,tz:f.T.z});} // (rx,rz) pointe vers le quai d'embarquement
const slotPos=i=>{const b=BAYS[i>>1],d=(i&1)?4.25:3.45;return [b.x+b.rx*d,0,b.z+b.rz*d];}; // deux places d'attente par portillon
// Deux opérateurs de quai vérifient les lapbars (moitié avant, moitié arrière) puis valident chacun sur un bouton
const opHome=i=>{const b=i?BAYS[NCARS-1]:BAYS[0],e=i?-1:1;return [b.x+b.tx*e*1.7+b.rx*1.95,b.z+b.tz*e*1.7+b.rz*1.95];};
const OPS=[0,1].map(i=>{const h=opHome(i);return {i,x:h[0],z:h[1],ok:false,st:'idle',k:0,w:0,mv:false};});
function startCheck(t){t.phase='check';for(const o of OPS){o.ok=false;o.st='go';o.k=o.i?NCARS-1:0;o.w=0;}}
function resetOps(){for(const o of OPS){o.ok=false;if(o.st!=='idle')o.st='back';}}
function stepOps(dt){
  for(const o of OPS){
    o.mv=false;if(o.st==='idle')continue;
    if(o.st==='press'){o.w-=dt;if(o.w<=0){o.ok=true;o.st='idle';}continue;}
    const b=BAYS[clamp(o.k,0,NCARS-1)],tg=o.st==='go'?[b.x+b.rx*1.95,b.z+b.rz*1.95]:opHome(o.i),dx=tg[0]-o.x,dz=tg[1]-o.z,d=Math.hypot(dx,dz),sp=3*dt;
    if(d>sp){o.x+=dx/d*sp;o.z+=dz/d*sp;o.mv=true;continue;}
    o.x=tg[0];o.z=tg[1];
    if(o.st==='go'){o.w+=dt;if(o.w>=.3){o.w=0;o.k+=o.i?-1:1;if(o.i?o.k<NCARS/2:o.k>=NCARS/2)o.st='ret';}}
    else if(o.st==='ret'){o.st='press';o.w=.45;}
    else o.st='idle';
  }
}
const zoneOf=s=>s<S_ST?'station':s<S_LIFT0?'prelift':s<S_REL?'lift':s<S_BRK?'course':'brake';

