'use strict';
/* Gare de triage générique (SITE.yard) — règles communes : docs/manoeuvres.md.
   Point de raccordement sur le circuit (gare ou frein final), appareil de voie (aiguillage à 2 positions ou pont transbordeur
   à N positions), voies de garage. Chaque voie k a son propre chemin : circuit jusqu'à SW_A, tronçon de transfert (courbe
   en S de SW_A jusqu'au début de la voie), puis la voie. Un train hors circuit (st==='garage') a une voie t.lane et une
   abscisse t.g (avant du train, 0 = point de raccordement), t.mv = +1 avance, -1 recule, 0 arrêté.
   L'appareil est un chariot coulissant le long de (SW0.vx, SW0.vz) qui porte le tronçon du circuit et le tronçon de
   transfert : position P = décalage 0, voie k = décalage OFF[k] (le tronçon de transfert de la voie k est alors en place). */
const YD=SITE.yard,ANCH=YD.at==='brake'?S_HOLD:S_ST,SW_A=ANCH+YD.a,SW_B=ANCH+YD.b,SW_D=YD.slide,GSTEP=TLEN+1.2,
  MV=Object.assign({v:2.4,t:3},YD.move),DEVN=YD.devName||(YD.device==='table'?'Pont transbordeur':'Aiguillage'),
  DEVL=YD.devLabel||(YD.device==='table'?'le pont transbordeur':'l\'aiguillage'); // nom au pupitre, nom dans une phrase
const SW0=(()=>{const f=frameAt(SW_A,mkF()),l=Math.hypot(f.R.x,f.R.z)||1;return {x:f.p.x,z:f.p.z,tx:f.T.x,tz:f.T.z,vx:-YD.side*f.R.x/l,vz:-YD.side*f.R.z/l};})(); // (vx,vz) : sens de coulissement du chariot (à l'opposé du garage)
const LANES=YD.lanes.map((ln,j)=>{
  const P0=[SW0.x,SW0.z],T0=[SW0.tx,SW0.tz],P=ln.pts,P1=P[0],k=ln.k||YD.k||3.6,path=[],raw=[];
  let md=[P[1][0]-P1[0],P[1][1]-P1[1]];const ml=Math.hypot(md[0],md[1]);md=[md[0]/ml,md[1]/ml];
  const c1=[P0[0]+T0[0]*k,P0[1]+T0[1]*k],c2=[P1[0]-md[0]*k,P1[1]-md[1]*k];
  for(let i=0;i<=36;i++){const t=i/36,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;raw.push([a*P0[0]+b*c1[0]+c*c2[0]+d*P1[0],a*P0[1]+b*c1[1]+c*c2[1]+d*P1[1]]);}
  for(let q=1;q<P.length;q++){const A=P[q-1],B=P[q],l=Math.hypot(B[0]-A[0],B[1]-A[1]);for(let d=.5;d<=l;d+=.5)raw.push([A[0]+(B[0]-A[0])*d/l,A[1]+(B[1]-A[1])*d/l]);if(q<P.length-1&&l%.5>.01)raw.push(B);}
  let acc=0,link=0;raw.forEach((q,i)=>{if(i)acc+=Math.hypot(q[0]-raw[i-1][0],q[1]-raw[i-1][1]);path.push({x:q[0],z:q[1],d:acc});if(i===36)link=acc;});
  const dev=YD.a+link,end=acc+YD.a; // abscisses g : sortie de l'appareil (début de la voie), butée
  return {name:ln.name||'Voie '+(j+1),path,link,dev,end,off:ln.off!=null?ln.off:SW_D*(j+1),cap:ln.cap||Math.max(1,Math.floor((end-dev-TLEN)/GSTEP)+1)};
});
const OFF=[0].concat(LANES.map(l=>l.off)),CMAX=Math.max(...OFF.map(Math.abs));
function gFrame(j,u,o){
  const GP=LANES[j].path;u=clamp(u,0,GP[GP.length-1].d);let i=1;while(i<GP.length-1&&GP[i].d<u)i++;
  const a=GP[i-1],b=GP[i],k=(u-a.d)/((b.d-a.d)||1),l=Math.hypot(b.x-a.x,b.z-a.z)||1;
  o.p.set(lerp(a.x,b.x,k),ST_Y,lerp(a.z,b.z,k));o.T.set((b.x-a.x)/l,0,(b.z-a.z)/l);o.U.set(0,1,0);o.R.crossVectors(o.T,o.U);return o;
}
// État de l'appareil : G.dev={pos, to, k} (position quittée, position visée, avancement 0…1)
const devMoving=()=>G.dev.pos!==G.dev.to, devOff=()=>devMoving()||G.dev.pos!==0, devOn=j=>!devMoving()&&G.dev.pos===j+1;
const devC=()=>lerp(OFF[G.dev.pos],OFF[G.dev.to],G.dev.k), devShown=()=>G.dev.to||G.dev.pos||1;
const posName=p=>p?'voie '+p+' ('+LANES[p-1].name+')':'P (circuit)';
const nearDev=o=>o.st==='garage'&&o.g-TLEN<LANES[o.lane].dev+.5;   // train sur le circuit, la liaison ou l'appareil
const yardBusy=o=>o.st==='garage'&&(nearDev(o)||(o.mv<0&&devOn(o.lane))); // train qui occupe ou va occuper le point de raccordement
const devLock=()=>trains.find(o=>nearDev(o)||(o.st==='run'&&((o.s>ANCH+.2&&o.s<SW_B+TLEN+1)||(YD.at==='brake'&&o.entering))));
// Quai : une travée et un portillon par wagon
const BAYS=[];for(let k=0;k<NCARS;k++){const f=frameAt(S_ST-(k+.5)*CAR,mkF());BAYS.push({x:f.p.x,z:f.p.z,rx:f.R.x*LS,rz:f.R.z*LS,tx:f.T.x,tz:f.T.z});} // (rx,rz) pointe vers le quai d'embarquement
const slotPos=i=>{const b=BAYS[Math.floor(i/CSEATS)],d=3.45+(i%CSEATS)*.8;return [b.x+b.rx*d,0,b.z+b.rz*d];}; // une place d'attente par siège, en file derrière le portillon
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

