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
const ST_Y=OSM.cps[0][1],CAR=SITE.car.len,NCARS=SITE.car.n,TLEN=CAR*NCARS,SEATS=NCARS*2;
const S_ST=TAG.st1-(SITE.stopBack||0),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=L-(SITE.holdBack||4),S_DROP=S_LIFT1+(SITE.dropAfter||14);
const BLK=Object.keys(TAG).filter(k=>k.startsWith('blk')).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
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

/* ══════════ ÉTAT DU JEU ══════════ */
const PAL=['#8a3d3d','#b59a62','#5c7f68','#4a6790','#75658e','#a8848a','#d6d3cc','#a8733f','#4c7f7c','#8990ad','#5a5780','#3c4250'];
const C_GREY=PAL.length,C_TECH=PAL.length+1; PAL.push('#6f6f6f','#d9772b');
const G={day:1,time:600,speed:1,money:3000,sat:75,open:false,auto:true,estop:false,
  queue:[],walkers:[],plat:new Array(NCARS*2).fill(null),platT:0,gatesOpen:false,gate:0,bypass:false,sw:0,swT:0,brakeLock:false,crowd:1,wx:{type:'clear',t:0,next:rnd(260,420)},flash:0,
  wear:{chain:45,track:35,brake:40},liftBroken:false,brakeFault:false,job:null,
  stats:null,over:false,dayDone:false,closedMsg:false};
const newStats=()=>({riders:0,quits:0,income:0,costs:0,disp:0,fines:0,turned:0});
G.stats=newStats();
function mkTrain(i,name,col,col2,wear,st){
  return {i,name,col,col2,wear,st,s:S_ST,v:0,g:0,gT:0,blk:false,told:false,seats:new Array(SEATS).fill(null),phase:'board',pt:0,idle:0,
    depReq:false,garReq:false,outReq:false,hold:0,fault:null,hs:false,entering:false,inBrake:false,inLift:false,failAt:-1,screamed:false,arms:0};
}
const trains=SITE.trains.map((c,i)=>mkTrain(i,c.name,c.col,c.col2,c.wear,i?'garage':'station'));
G.gar=trains.filter(t=>t.st==='garage').map(t=>t.i); // trains au garage, du fond vers la sortie : seul le dernier peut sortir
G.gar.forEach((i,r)=>{trains[i].g=GMAX-r*GSTEP;});
const count=t=>t.seats.reduce((n,s)=>n+(s?1:0),0), seated=t=>t.seats.reduce((n,s)=>n+(s&&s.on?1:0),0);
const fmtTime=m=>{m=Math.floor(m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
function log(msg,cls){
  msg=msg.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,'').trim();
  const d=document.createElement('div');if(cls)d.className=cls;d.innerHTML='<span>'+fmtTime(G.time)+'</span>'+msg;
  const el=$('log');el.prepend(d);while(el.children.length>60)el.lastChild.remove();
}
function pay(n,fine){G.money-=n;G.stats.costs+=n;if(fine)G.stats.fines+=n;}

/* ══════════ SON (synthétisé) ══════════ */
const sfx=(()=>{
  let ac=null,master,noise,rumble,wind,rain,crowd,muted=false,clickT=0;
  function loop(type,f,q){const s=ac.createBufferSource();s.buffer=noise;s.loop=true;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
    const g=ac.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(master);s.start();return g;}
  function init(){
    if(ac){ac.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ac=new AC();master=ac.createGain();master.gain.value=muted?0:.8;master.connect(ac.destination);
    noise=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    rumble=loop('lowpass',170,.8);wind=loop('bandpass',900,.6);rain=loop('highpass',2600,.4);crowd=loop('bandpass',450,.5);
  }
  function burst(type,f,q,vol,dur,delay){
    if(!ac||G.speed===0)return;const t=ac.currentTime+(delay||0),s=ac.createBufferSource();s.buffer=noise;s.loop=true;
    const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ac.createGain();
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.06);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(fl);fl.connect(g);g.connect(master);s.start(t,Math.random());s.stop(t+dur+.1);
  }
  function tone(f,vol,dur,type,delay,f2){
    if(!ac||G.speed===0)return;const t=ac.currentTime+(delay||0),o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';
    o.frequency.setValueAtTime(f,t);if(f2){o.frequency.linearRampToValueAtTime(f2,t+dur*.35);o.frequency.linearRampToValueAtTime(f*.8,t+dur);}
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);
  }
  const set=(g,v)=>g.gain.setTargetAtTime(v,ac.currentTime,.15);
  return {init,
    toggle(){muted=!muted;if(ac)master.gain.value=muted?0:.8;return muted;},
    bell(){tone(880,.12,.6);tone(1320,.08,.7,'sine',.14);},
    brake(){burst('highpass',3200,.7,.18,1.1);},
    thunder(){burst('lowpass',95,.5,1.4,4,.3);burst('lowpass',380,.5,.35,1.4,.3);},
    alarm(){tone(620,.1,.25,'square');tone(620,.1,.25,'square',.35);},
    scream(n){const k=Math.ceil(n/4);for(let j=0;j<k;j++){const f=rnd(700,1100);tone(f,.022,rnd(1.6,2.6),'sawtooth',rnd(0,.6),f*1.3);}burst('bandpass',1700,1.5,.07*n/24,2.4);},
    update(dt,o){
      if(!ac)return;const p=G.speed===0?0:1;
      set(rumble,o.rumble*p);set(wind,o.wind*p);set(rain,o.rain*p);set(crowd,o.crowd*p);
      if(o.chain&&p){clickT-=dt;if(clickT<=0){clickT=.12;tone(1400+rnd(-80,80),.035,.03,'square');}}
    }};
})();

/* ══════════ BLOCS, DÉPARTS, MAINTENANCE ══════════ */
function stationBusy(self){
  return trains.some(o=>o!==self&&(o.st==='station'||(GAR.at!=='brake'&&(o.st==='toGarage'||o.st==='fromGarage'))||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))));
}
// Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre
const blkEnd=i=>i+1<BLK.length?BLK[i+1]:L;
function occupied(a,b,self){
  return trains.some(o=>o!==self&&o.st==='run'&&o.s>a&&o.s<b+TLEN)||(b>=L&&GAR.at==='brake'&&trains.some(o=>o!==self&&(o.st==='toGarage'||o.st==='fromGarage')));
}
function blockReason(t){
  if(G.estop)return "arrêt d'urgence";
  if(GAR.at!=='brake'&&(G.sw>.01||G.swT||trains.some(o=>o.st==='toGarage'||o.st==='fromGarage')))return 'aiguillage sur garage';
  if(G.liftBroken)return 'lift en panne';
  if(G.job&&G.job.lock)return 'maintenance en cours';
  if(G.wear.track>=100)return 'voie hors service';
  if(trains.some(o=>o!==t&&o.st==='run'&&o.s>=S_ST&&o.s<S_REL))return 'bloc lift occupé';
  return '';
}
const parked=t=>t.st==='garage'||t.st==='station';
const held=t=>t.st==='run'&&t.v===0&&(zoneOf(t.s)==='brake'||t.blk);
const JOBS={
  liftFix:{label:'Dépannage du lift',dur:18,cost:250,ok:()=>G.liftBroken},
  chainRev:{label:'Révision de la chaîne',dur:30,cost:450,lock:true,ok:()=>!trains.some(o=>o.st==='run'&&o.s>=S_ST&&o.s<S_REL)},
  trackRev:{label:'Entretien de la voie',dur:55,cost:900,lock:true,ok:()=>trains.every(o=>parked(o)||held(o))},
  brakeFix:{label:'Déblocage des freins',dur:14,cost:200,ok:()=>G.brakeFault},
  brakeRev:{label:'Révision des freins',dur:25,cost:350,lock:true,ok:()=>trains.every(parked)},
  trainRev:{label:'Révision',dur:40,cost:600,ok:t=>t.st==='garage'},
  rearm:{label:'Réarmement des lapbars',dur:8,cost:0,ok:t=>t.fault==='lapbars'}
};
function startJob(type,t){
  const j=JOBS[type];if(G.job||!j.ok(t))return;if(t)t.outReq=false;
  pay(j.cost);G.job={type,t,rem:j.dur,dur:j.dur,lock:!!j.lock,label:j.label+(t?' — '+t.name:'')};
  log('🔧 '+G.job.label+' en cours…');
}
function finishJob(){
  const {type,t}=G.job;G.job=null;
  if(type==='liftFix'){G.liftBroken=false;G.wear.chain=Math.max(0,G.wear.chain-15);log('Lift dépanné, la chaîne repart.','good');}
  if(type==='chainRev'){G.liftBroken=false;G.wear.chain=0;log('Chaîne du lift révisée.','good');}
  if(type==='trackRev'){G.wear.track=0;log('Voie remise en état.','good');}
  if(type==='brakeFix'){G.brakeFault=false;G.wear.brake=Math.max(0,G.wear.brake-15);log('Freins débloqués.','good');}
  if(type==='brakeRev'){G.brakeFault=false;G.wear.brake=0;log('Freins révisés.','good');}
  if(type==='trainRev'){t.wear=0;t.hs=false;t.fault=null;log(t.name+' révisé, prêt à rouler.','good');}
  if(type==='rearm'){t.fault=null;t.phase='ready';for(const o of OPS)o.ok=true;log('Lapbars réarmés sur '+t.name+'.','good');}
}

/* ══════════ VISITEURS (chemins réels : accès, file, sortie) ══════════ */
const SP=.42,QS=SITE.queue,ENTRY0=QS.entry0,ENTRY_GATE=Object.assign({t:1},QS.gate); // gate.a : fermé en travers du chemin, gate.b : ouvert le long de la bordure
function pathPos(P,C,d,o,side){
  d=clamp(d,0,C[C.length-1]);let i=1;while(i<C.length-1&&C[i]<d)i++;
  const a=P[i-1],b=P[i],k=(d-C[i-1])/((C[i]-C[i-1])||1),dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
  o.x=a[0]+dx*k-dz/l*side;o.z=a[1]+dz*k+dx/l*side;o.y=0;return o;
}
// Réseau de la file, décrit de l'entrée vers la gare par SITE.queue.parts : tronçons simples et fourches.
// À chaque fourche, un vantail pivote autour d'un poteau en bordure (gate.h) pour fermer soit le raccourci (gate.a), soit la boucle (gate.b) ; on = boucle en service.
const mkSeg=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));return {P:pts,C,len:C[C.length-1],list:[]};};
const STAGES=[],LOOPS=[],SEGS=[];
QS.parts.forEach((p,si)=>{
  if(p.pts){const s=mkSeg(p.pts);s.si=si;STAGES.push({seg:s});SEGS.push(s);}
  else{const l={name:p.name,on:true,t:1,g:p.gate,loop:mkSeg(p.loop),short:mkSeg(p.short)};l.loop.si=l.short.si=si;LOOPS.push(l);STAGES.push({fork:l});SEGS.push(l.loop,l.short);}
});
SEGS.reverse(); // traités de la gare vers l'entrée, pour libérer la place devant avant d'avancer
const SEG_IN=STAGES[0].seg,SEG_OUT=STAGES[STAGES.length-1].seg;
let QLEN=0;
function buildQueue(){QLEN=STAGES.reduce((n,st)=>n+(st.seg?st.seg.len:st.fork.on?st.fork.loop.len:st.fork.short.len),0);}
buildQueue();
const settled=l=>l.t===(l.on?1:0);
function nextSeg(s){const st=STAGES[s.si+1];if(!st)return null;if(st.seg)return st.seg;return settled(st.fork)?(st.fork.on?st.fork.loop:st.fork.short):null;}
function prevSeg(s,evac){const st=STAGES[s.si-1];if(!st)return null;if(st.seg)return st.seg;return evac||!st.fork.on?st.fork.short:st.fork.loop;}
const room=e=>!e.list.length||e.len-e.list[e.list.length-1].r>=SP;
function removeVisitor(v){const i=G.queue.indexOf(v);if(i>=0)G.queue.splice(i,1);if(v.e){const l=v.e.list,j=l.indexOf(v);if(j>=0)l.splice(j,1);}}
function clearQueue(){G.queue.length=0;for(const s of SEGS)s.list.length=0;}
const P3=(a,j)=>a.map(p=>[p[0]+rnd(-j,j),0,p[1]+rnd(-j,j)]);
function approach(){let r=Math.random()*SITE.approach.reduce((n,a)=>n+a.w,0);for(const a of SITE.approach){r-=a.w;if(r<=0)return a.pts;}return SITE.approach[0].pts;}
function leavePath(x,z){return [[x,0,z]].concat(P3(approach().slice().reverse(),.7));}
function backPath(v,evac){ // sortie à contre-sens par la file. Abandon : uniquement par les chemins ouverts. Évacuation : au plus court, barrières franchies.
  if(v.mode!=='q')return leavePath(v.x,v.z);
  const pts=[[v.x,0,v.z]];let e=v.e,ds=e.len-v.r;
  while(e){for(let i=e.P.length-1;i>=0;i--)if(e.C[i]<ds-.01)pts.push([e.P[i][0]+rnd(-.3,.3),0,e.P[i][1]+rnd(-.3,.3)]);e=prevSeg(e,evac);ds=1e9;}
  return pts.concat(P3(approach().slice().reverse(),.7));
}
function exitPath(x,z){const X=SITE.exit,t=X.tails[Math.floor(Math.random()*X.tails.length)];return [[x,0,z]].concat(P3(X.path,.35),P3(t,.7));}
function walker(pts,ci,done,sp,emo){G.walkers.push({pts,i:1,x:pts[0][0],y:pts[0][1],z:pts[0][2],ci,done,sp:sp||2.6,ph:rnd(0,6)});if(emo)emote(emo,pts[0]);}
function moveAlong(k,dt){
  let st=k.sp*dt;
  while(st>0&&k.i<k.pts.length){
    const g=k.pts[k.i],dx=g[0]-k.x,dy=g[1]-k.y,dz=g[2]-k.z,d=Math.hypot(dx,dy,dz);
    if(d<=st){k.x=g[0];k.y=g[1];k.z=g[2];k.i++;st-=d;}else{k.x+=dx/d*st;k.y+=dy/d*st;k.z+=dz/d*st;st=0;}
  }
  return k.i>=k.pts.length;
}
function joinQueue(){
  if(G.queue.length*SP+1>QLEN){G.sat=clamp(G.sat-.01,0,100);G.stats.turned++;return;}
  const pts=P3(approach(),.7);pts.push([ENTRY0[0],0,ENTRY0[1]]);
  G.queue.push({ci:Math.floor(Math.random()*12),w:0,pat:rnd(220,420),mode:'app',side:Math.random()<.5?-1:1,sp:3.2,ph:rnd(0,6),pts,i:1,x:pts[0][0],y:0,z:pts[0][2],mv:true});
}
const _qp={x:0,y:0,z:0,side:0};
function updateVisitors(dt){
  const w=G.wx.type,Q=G.queue;
  for(const l of LOOPS)l.t=clamp(l.t+(l.on?dt:-dt)/.9,0,1);
  ENTRY_GATE.t=clamp(ENTRY_GATE.t+(G.open?-dt:dt)/.9,0,1);
  if(G.open){
    const hourF=.6+.8*Math.sin(Math.PI*clamp((G.time-600)/480,0,1)),wxF=w==='storm'?.25:w==='rain'?.6:1;
    // fréquentation réglable : au-delà de 100 %, les visiteurs viennent même si la file est déjà longue, jusqu'à la remplir
    const rate=.42*G.crowd*hourF*wxF*(.5+G.sat/100)*Math.max(.1,1-Q.length*SP/QLEN/Math.max(1,G.crowd*G.crowd))*dt;
    for(let n=Math.floor(rate)+(Math.random()<rate%1?1:0);n>0;n--)joinQueue();
  }
  const imp=w==='storm'?3:w==='rain'?1.5:1;
  for(let i=Q.length-1;i>=0;i--){
    const v=Q[i];v.w+=dt*imp;
    if(v.w>v.pat){const p=backPath(v);removeVisitor(v);G.stats.quits++;G.sat=clamp(G.sat-.35,0,100);walker(p,C_GREY,null,3);continue;}
    if(v.mode==='app'&&moveAlong(v,dt)){ // arrivé devant la barrière d'entrée : seul passage vers la file
      if(!G.open){Q.splice(i,1);G.stats.turned++;walker(leavePath(v.x,v.z),v.ci,null,3);continue;}
      if(ENTRY_GATE.t>.02)continue;
      if(!room(SEG_IN))continue; // patiente devant la barrière le temps que la file avance
      v.mode='q';v.e=SEG_IN;v.r=SEG_IN.len;SEG_IN.list.push(v);
    }
  }
  // avance dans la file : chacun reste derrière celui qui le précède et ne franchit une fourche que par la barrière ouverte
  for(const e of SEGS){
    const l=e.list;
    for(let j=0;j<l.length;j++){const v=l[j],nr=Math.max(j?l[j-1].r+SP:0,v.r-4.5*dt);v.mv=v.r-nr>1e-4;v.r=nr;pathPos(e.P,e.C,e.len-nr,_qp,v.side*.36);v.x=_qp.x;v.z=_qp.z;}
    const h=l[0],nk=h&&h.r<=1e-3?nextSeg(e):null;
    if(nk&&room(nk)){l.shift();h.e=nk;h.r=nk.len;nk.list.push(h);}
  }
  for(let i=G.walkers.length-1;i>=0;i--){const k=G.walkers[i];if(moveAlong(k,dt)){if(k.done)k.done();G.walkers.splice(i,1);}}
}

/* ══════════ TRAINS ══════════ */
const _f=mkF();
function carFrame(t,k,o){
  if(t.st==='run'){
    const sc=t.s-(k+.5)*CAR;frameAt(sc,o);
    if(BOB&&t.v>2){const i=Math.floor((((sc%L)+L)%L)/DS)%N,off=clamp(-KAP[i]*t.v*t.v*.045,-.62,.62);o.p.x+=o.R.x*off;o.p.z+=o.R.z*off;} // le bob monte sur la paroi extérieure dans les courbes
    return o;
  }
  const u=t.g-GAR.a-(k+.5)*CAR;return u<0?frameAt(SW_A+u,o):gFrame(u,o);
}
function seatBase(t,i,o){
  carFrame(t,i>>1,_f);o.copy(_f.p).addScaledVector(_f.U,.35);
  return SITE.car.inline?o.addScaledVector(_f.T,(i&1)?-.36:.3):o.addScaledVector(_f.R,(i&1)?.33:-.33);
}
const _v=new V3;
function arrive(t){
  t.st='station';t.s=S_ST;t.v=0;t.entering=false;t.phase='unload';t.pt=0;t.idle=0;t.depReq=false;
  if(t.wear>=100&&!t.hs){t.hs=true;t.garReq=true;log('⚠️ '+t.name+' est hors service : envoi au garage pour révision.','bad');}
}
const swFree=()=>!trains.some(o=>(o.st==='toGarage'&&o.g-GAR.a-TLEN<SW_LEN+.5)||o.st==='fromGarage'||(o.st==='run'&&o.s>ANCH+.2&&o.s<SW_B+TLEN+1));
// train à l'arrêt au point d'où part la voie de garage : en gare, ou sur le frein final
const atAnchor=t=>GAR.at==='brake'?(t.st==='run'&&t.v===0&&Math.abs(t.s-S_HOLD)<.4):(t.st==='station'&&t.phase==='board'&&!t.depReq);
const swSet=()=>G.swT===1&&G.sw>=1;
function updateStation(t,dt){
  t.pt-=dt;
  if(t.phase==='unload'){
    if(t.pt<=0){
      const i=t.seats.findIndex(s=>s&&s.on);
      if(i>=0){
        const v=t.seats[i];t.seats[i]=null;t.pt=.12;G.stats.riders++;G.stats.income+=5;G.money+=5;
        let g=v.w<80?.07:v.w<180?.04:.015;if(G.wear.track>75)g*=.4;G.sat=clamp(G.sat+g,0,100);
        seatBase(t,i,_v);{const b=BAYS[i>>1];walker(exitPath(_v.x-b.rx*1.2,_v.z-b.rz*1.2),v.ci,null,2.8);} // descente côté sortie, à l'opposé des portillons
      }else if(count(t)===0){t.phase='board';t.idle=0;if(t.garReq)log(GAR.at==='brake'?t.name+' est vide : envoyez-le sans passagers, il sera retenu sur le frein final pour la mise au garage.':t.name+' est vide et retenu en gare : positionnez l\'aiguillage sur GARAGE puis envoyez-le.','warn');}
    }
  }else if(t.phase==='board'){
    if(t.garReq&&count(t)===0&&GAR.at!=='brake')return;
    const n=count(t),waiting=G.plat.some((r,i)=>r&&!t.seats[i]),shut=!G.gatesOpen&&G.gate<.05&&seated(t)===n;
    if(G.auto&&!t.depReq){t.idle+=dt;
      if(t.garReq?(GAR.at==='brake'&&n===0&&t.idle>2):((n>0&&seated(t)===n&&(n===SEATS||(!waiting&&t.idle>(G.open?(G.queue.length?45:12):4))))||(t.idle>5&&!G.queue.length&&!waiting&&trains.some(held))))t.depReq=true;} // un train à garer part à vide
    // portillons fermés : en auto après l'ordre de départ, en manuel dès qu'il y a des passagers, les opérateurs vérifient les lapbars
    if(shut&&(G.auto?t.depReq:n>0||t.depReq)){if(n===0||G.bypass)t.phase='ready';else startCheck(t);}
  }else if(t.phase==='check'){
    if(!G.auto&&G.gatesOpen){t.phase='board';resetOps();return;}
    if(G.bypass){resetOps();t.phase='ready';return;}
    if(OPS.every(o=>o.ok)){
      if(Math.random()<Math.max(0,(t.wear-55)/45)*.3){t.fault='lapbars';t.phase='fault';resetOps();sfx.alarm();log('Défaut de lapbar détecté par un opérateur sur '+t.name+' : réarmement nécessaire.','warn');}
      else{t.phase='ready';if(!G.auto)log('Lapbars validés par les deux opérateurs : départ possible.','good');}
    }
  }else if(t.phase==='ready'){
    if(!G.auto&&G.gatesOpen){t.phase='board';t.depReq=false;resetOps();return;}
    if((G.auto||t.depReq)&&!blockReason(t)){
      const n=count(t),checked=OPS.every(o=>o.ok);
      t.st='run';t.v=.5;t.depReq=false;t.inLift=false;t.inBrake=false;t.screamed=false;t.blk=false;t.told=false;G.stats.disp++;sfx.bell();resetOps();
      if(G.wx.type==='storm'&&n>0){pay(400,true);G.sat=clamp(G.sat-3,0,100);log('Infraction : train envoyé en plein orage ! Amende de 400 €.','bad');}
      else log(t.name+' part avec '+n+' passager'+(n>1?'s':'')+(n>0&&!checked?' — lapbars non vérifiés (by-pass).':'.'));
      if(n>0&&!checked&&Math.random()<.08+Math.max(0,(t.wear-55)/45)*.3){pay(600,true);G.sat=clamp(G.sat-6,0,100);sfx.alarm();log('Incident : un lapbar était mal verrouillé au départ. Amende de 600 €.','bad');}
    }
  }
}
function updateRun(t,dt){
  const z=zoneOf(t.s);
  if(z==='station'){t.v=Math.min(6,Math.sqrt(4*Math.max(0,S_ST-t.s))+.3);t.s+=t.v*dt;if(t.s>=S_ST-.05)arrive(t);return;}
  if(z==='prelift')t.v=Math.min(5,t.v+1.5*dt);
  else if(z==='lift'){
    if(!t.inLift){t.inLift=true;G.wear.chain=Math.min(100,G.wear.chain+2.2);
      const c=G.wear.chain;t.failAt=Math.random()<(c>40?Math.pow((c-40)/60,2)*.35:0)?rnd(S_LIFT0+8,S_LIFT1-6):-1;}
    if(t.failAt>0&&t.s>=t.failAt){t.failAt=-1;G.liftBroken=true;sfx.alarm();log('🚨 Panne du lift ! '+t.name+' est bloqué dans la montée.','bad');}
    t.wait=BLK.length>0&&t.s>S_LIFT1-4&&occupied(S_REL-TLEN,BLK[0],t); // le lift retient le train tant que le premier canton est occupé
    t.v=(G.liftBroken||G.estop||t.wait)?0:Math.min(5.5,Math.max(t.v,2)+3*dt);
  }else if(z==='course'){
    const a=-9.81*(hAt(t.s)-hAt(t.s-TLEN))/TLEN-(PH.roll+t.wear*.0003)-PH.drag*t.v*t.v;
    let bi=-1;for(let i=0;i<BLK.length;i++)if(BLK[i]>t.s-.2){bi=i;break;}
    if(bi>=0&&occupied(BLK[bi],blkEnd(bi),t)){const d=BLK[bi]-t.s;t.v=Math.min(Math.max(PH.vmin,t.v+a*dt),Math.sqrt(12*Math.max(0,d)));if(d<.2){t.v=0;t.blk=true;}} // arrêt au frein de bloc
    else{t.v=Math.max(PH.vmin,t.v+a*dt);t.blk=false;}
    if(!t.screamed&&t.s>S_DROP){t.screamed=true;const n=count(t);if(n)sfx.scream(n);}
  }else{
    if(!t.inBrake){
      t.inBrake=true;t.hold=0;sfx.brake();t.wear=Math.min(100,t.wear+3.5);G.wear.track=Math.min(100,G.wear.track+1.1);G.wear.brake=Math.min(100,G.wear.brake+1.6);
      const b=G.wear.brake;
      if(!G.brakeFault&&b>50&&Math.random()<Math.pow((b-50)/50,2)*.3){G.brakeFault=true;sfx.alarm();log('🚨 Défaut des freins de fin de parcours : train retenu.','bad');}
      if(G.wear.track>=100)log('⛔ Voie hors service : la commission de sécurité interdit les départs.','bad');
    }
    const slow=t.v>6?Math.max(6,t.v-7*dt):t.v;
    if(t.entering)t.v=Math.min(6,t.v+2*dt);
    else{const vm=Math.sqrt(8*Math.max(0,S_HOLD-t.s));t.v=Math.min(slow,vm);
      if(vm<.25){t.v=0;t.hold+=dt;const toGar=GAR.at==='brake'&&t.garReq&&count(t)===0;
        if(toGar&&!t.told){t.told=true;log(t.name+' est retenu sur le frein final : positionnez l\'aiguillage sur GARAGE puis appuyez sur son bouton Garage.','warn');}
        if(t.hold>=1&&!G.brakeLock&&!stationBusy(t)&&!G.estop&&!G.brakeFault&&!toGar&&!(GAR.at==='brake'&&(G.sw>.01||G.swT))){t.entering=true;t.hold=0;}}}
  }
  t.s+=t.v*dt;if(t.s>=L)t.s-=L;
}
// Quai et portillons : les visiteurs se rangent par travée, puis embarquent quand les portillons s'ouvrent
function updatePlatform(dt){
  G.platT-=dt;const fr=SEG_OUT.list[0];
  if(G.platT<=0&&fr&&fr.r<.4&&G.time<1140){
    let best=[],bo=2;for(let k=0;k<NCARS;k++){const o=(G.plat[2*k]?1:0)+(G.plat[2*k+1]?1:0);if(o<bo){bo=o;best=[k];}else if(o===bo&&o<2)best.push(k);}
    const kb=best.length?best[Math.floor(Math.random()*best.length)]:-1,i=kb<0?-1:G.plat[2*kb]?2*kb+1:2*kb;
    if(i>=0){removeVisitor(fr);const r={ci:fr.ci,w:fr.w,on:false,ph:fr.ph};G.plat[i]=r;G.platT=.22;const p=slotPos(i);
      const b=BAYS[i>>1],W=SITE.board.walk,j=rnd(-.2,.2);walker([[fr.x,0,fr.z]].concat(SITE.board.via.map(q=>[q[0],0,q[1]]),[[b.x+b.rx*W+b.tx*j,0,b.z+b.rz*W+b.tz*j],p]),fr.ci,()=>{r.on=true;},4.2);}
  }
  const t=trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.hs&&!o.garReq&&!o.depReq);
  if(!t)G.gatesOpen=false;else if(G.auto)G.gatesOpen=true;
  G.gate=clamp(G.gate+(G.gatesOpen?dt:-dt)/.7,0,1);
  if(t&&G.gate>.9)for(let i=0;i<SEATS;i++){const r=G.plat[i];
    if(r&&r.on&&!t.seats[i]){G.plat[i]=null;const seat={ci:r.ci,w:r.w,on:false};t.seats[i]=seat;t.idle=0;seatBase(t,i,_v);walker([slotPos(i),[_v.x,0,_v.z]],r.ci,()=>{seat.on=true;},2.2);}}
}
function updateTrains(dt){
  for(const t of trains){
    if(t.st==='station')updateStation(t,dt);
    else if(t.st==='run')updateRun(t,dt);
    else if(t.st==='toGarage'){t.g=Math.min(t.gT,t.g+2.6*dt);if(t.g>=t.gT){t.st='garage';t.seats.fill(null);log(t.name+' est au garage.');}}
    else if(t.st==='fromGarage'){t.g=Math.max(0,t.g-2.2*dt);if(t.g<=0){
      if(GAR.at==='brake'){t.st='run';t.s=S_HOLD;t.v=0;t.inBrake=true;t.hold=1;t.entering=false;log(t.name+' est revenu sur le frein final. Remettez l\'aiguillage en position normale pour qu\'il entre en gare.','good');}
      else{t.st='station';t.s=S_ST;t.phase='board';t.pt=0;t.idle=0;t.depReq=false;log(t.name+' est en gare. Remettez l\'aiguillage sur LIFT pour autoriser les départs.','good');}}}
    if(t.st==='run'&&t.v===0&&((G.liftBroken&&zoneOf(t.s)==='lift')||(G.brakeFault&&zoneOf(t.s)==='brake')))G.sat=clamp(G.sat-.002*count(t)*dt,0,100);
  }
  G.sw=clamp(G.sw+(G.swT?dt:-dt)/3,0,1); // l'aiguillage ne bouge que sur commande de l'opérateur
}

/* ══════════ MÉTÉO ET JOURNÉE ══════════ */
function updateWeather(dt){
  const w=G.wx;
  if(w.type==='clear'){w.next-=dt;
    if(w.next<=0&&G.time<1040){
      if(Math.random()<.5){w.type='warn';w.t=30;log('🌩️ Orage en approche ! Suspendez les départs avant qu\'il n\'éclate.','warn');}
      else{w.type='rain';w.t=rnd(100,170);log('🌧️ Averse : moins de visiteurs, file moins patiente.');}
    }
  }else{w.t-=dt;
    if(w.t<=0){
      if(w.type==='warn'){w.type='storm';w.t=rnd(60,90);log((SITE.text&&SITE.text.storm)||'Orage sur l\'attraction ! Aucun train ne doit partir.','bad');}
      else{if(w.type==='storm')log('☀️ L\'orage est passé, l\'exploitation peut reprendre.','good');w.type='clear';w.next=rnd(280,520);}
    }
  }
  G.flash=Math.max(0,G.flash-dt*3);
  if(w.type==='storm'&&Math.random()<dt*.3){G.flash=1;sfx.thunder();if(typeof strike==='function')strike();}
}
function step(dt){
  G.time=Math.min(1140,G.time+dt*.5);
  updateWeather(dt);updateVisitors(dt);updatePlatform(dt);stepOps(dt);updateTrains(dt);
  if(G.job){G.job.rem-=dt;if(G.job.rem<=0)finishJob();}
  if(G.time>=1080&&!G.closedMsg){G.closedMsg=true;G.open=false;log('🔔 18:00 — le parc ferme, la file est fermée. Terminez les derniers tours.','warn');}
  if(G.time>=1080){
    const riders=trains.reduce((n,t)=>n+count(t),0)+G.plat.filter(r=>r).length;
    if((G.queue.length===0&&riders===0)||G.time>=1140)endDay();
  }
}
function endDay(){
  if(G.dayDone)return;G.dayDone=true;clearQueue();G.plat.fill(null);pay(350);
  const s=G.stats,net=s.income-s.costs;
  $('dTitle').textContent='Fin du jour '+G.day;
  $('dTable').innerHTML=[['Passagers transportés',s.riders],['Trains envoyés',s.disp],['Visiteurs repartis mécontents',s.quits],['Visiteurs refoulés (file pleine)',s.turned],
    ['Recettes',s.income+' €'],['Dépenses (dont salaires 350 €)',s.costs+' €'],['dont amendes',s.fines+' €'],
    ['Résultat du jour',(net>=0?'+':'')+net+' €'],['Budget',Math.round(G.money)+' €'],['Satisfaction',Math.round(G.sat)+' %']]
    .map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  G.over=G.money<-2000;
  $('dMsg').textContent=G.over?'Le budget est dans le rouge : la direction vous retire les clés de l\'attraction…'
    :s.riders>=(SITE.goal||400)?((SITE.text&&SITE.text.great)||'Excellente journée !'):s.riders>=(SITE.goal||400)/2?'Journée correcte. Un second train et moins de pannes feraient mieux.'
    :'Journée difficile. Pensez à ouvrir tôt et à sortir le second train.';
  $('dBtn').textContent=G.over?'Recommencer':'Jour suivant';
  $('mDay').classList.remove('hidden');
}
function nextDay(){
  if(G.over){location.reload();return;}
  G.day++;G.time=600;G.stats=newStats();G.dayDone=false;G.closedMsg=false;G.open=false;
  G.wx={type:'clear',t:0,next:rnd(240,480)};G.walkers.length=0;
  for(const t of trains)t.seats.fill(null);G.plat.fill(null);
  $('mDay').classList.add('hidden');
  log('☀️ Jour '+G.day+' — l\'attraction est fermée, à vous d\'ouvrir.','good');
}

/* ══════════ ACTIONS ET INTERFACE ══════════ */
function act(a,arg){
  const t=arg!==undefined&&trains[arg];
  if(a==='speed')G.speed=+arg;
  else if(a==='help')$('mHelp').classList.remove('hidden');
  else if(a==='closeHelp'){$('mHelp').classList.add('hidden');sfx.init();}
  else if(a==='mute')$('bMute').textContent=sfx.toggle()?'Son coupé':'Son';
  else if(a==='cam')setCam(arg);
  else if(a==='nextDay')nextDay();
  else if(a==='open'){if(!G.open&&G.time>=1080)return;G.open=!G.open;
    log(G.open?'Entrée ouverte : les visiteurs entrent dans la file.':'Entrée fermée : plus personne n\'entre. Les '+G.queue.filter(v=>v.mode==='q').length+' visiteurs déjà dans la file continuent d\'embarquer.',G.open?'good':'warn');}
  else if(a==='evac'){const n=G.queue.length;if(!n)return;
    for(const v of G.queue)walker(backPath(v,true),v.ci,null,rnd(3,3.8));
    clearQueue();G.sat=clamp(G.sat-Math.min(8,n*.03),0,100);log('File évacuée : '+n+' visiteurs ressortent par l\'entrée.','warn');}
  else if(a==='loop'){const l=LOOPS[arg];l.on=!l.on;buildQueue();
    log(l.name[0].toUpperCase()+l.name.slice(1)+(l.on?' fermé : les visiteurs sont dirigés vers la boucle':' ouvert : les visiteurs sont dirigés vers le raccourci')+' — capacité '+Math.floor(QLEN/SP)+' visiteurs. Ceux déjà engagés terminent leur chemin.');}
  else if(a==='roof'){G.roofOff=!G.roofOff;}
  else if(a==='auto'){G.auto=!G.auto;log('Départs en mode '+(G.auto?'automatique.':'manuel.'));}
  else if(a==='gates'){if(!G.auto){
      if(G.gatesOpen)G.gatesOpen=false;
      else{const s=trains.find(o=>o.st==='station'&&['board','check','ready'].includes(o.phase)&&!o.hs&&!o.garReq);
        if(s){s.phase='board';s.depReq=false;resetOps();G.gatesOpen=true;log('Portillons ouverts : embarquement.');}}}}
  else if(a==='bypass'){G.bypass=!G.bypass;log(G.bypass?'BY-PASS de la validation des lapbars activé : départ possible sans vérification.':'Validation des lapbars par les opérateurs rétablie.',G.bypass?'bad':'good');}
  else if(a==='depart'){
    const s=G.auto?trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.depReq):trains.find(o=>o.st==='station'&&!o.depReq&&(o.phase==='ready'||(o.phase==='board'&&!G.gatesOpen&&(G.bypass||count(o)===0))));
    if(s)s.depReq=true;else if(!G.auto)log('Départ refusé : il faut les portillons fermés et les lapbars validés par les deux opérateurs.','warn');}
  else if(a==='estop'){G.estop=!G.estop;if(G.estop)sfx.alarm();log(G.estop?'⛔ Arrêt d\'urgence enclenché : lift stoppé, départs bloqués.':'Arrêt d\'urgence réarmé.',G.estop?'bad':'good');}
  else if(a==='job')startJob(arg);
  else if(a==='switch'){
    if(!swFree())log('Aiguillage verrouillé : un train occupe la zone.','warn');
    else{G.swT=G.swT?0:1;log(G.swT?'Aiguillage commandé vers GARAGE : le tronçon en S se met en place'+(GAR.at==='brake'?', entrée en gare bloquée.':', départs bloqués.'):'Aiguillage commandé vers la voie principale.');}}
  else if(a==='hold'){G.brakeLock=!G.brakeLock;log(G.brakeLock?'Frein final bloqué : les trains sont retenus avant la gare.':'Frein final libéré.',G.brakeLock?'warn':'good');}
  else if(a==='garage'){
    if(atAnchor(t)&&count(t)===0&&swSet()){
      if(G.gar.length>=GCAP)log('Le garage est plein.','warn');
      else{t.garReq=false;t.told=false;t.st='toGarage';t.g=0;t.gT=GMAX-G.gar.length*GSTEP;G.gar.push(t.i);log(t.name+' part au garage.');}}
    else if(t.st==='station'||t.st==='run'){t.garReq=!t.garReq;t.told=false;
      log(!t.garReq?t.name+' reste en service.'
        :GAR.at==='brake'?t.name+' sera retenu à vide sur le frein final : envoyez-le sans passagers, puis aiguillage sur GARAGE et bouton Garage.'
        :t.st==='station'&&count(t)===0?t.name+' retenu hors service : positionnez l\'aiguillage sur GARAGE, puis appuyez de nouveau sur Garage.':t.name+' sera retenu vide en gare à son prochain passage.');}}
  else if(a==='sortir'){
    if(t.st==='garage'&&!(G.job&&G.job.t===t)){
      const busy=GAR.at==='brake'?trains.some(o=>o!==t&&((o.st==='run'&&o.s>=(BLK.length?BLK[BLK.length-1]:S_BRK)-1)||o.st==='toGarage'||o.st==='fromGarage')):stationBusy(t);
      if(G.gar[G.gar.length-1]!==t.i)log('Un autre train est garé devant : sortez-le d\'abord.','warn');
      else if(!swSet())log('Positionnez d\'abord l\'aiguillage sur GARAGE.','warn');
      else if(busy)log(GAR.at==='brake'?'Le frein final n\'est pas libre : attendez que la zone soit dégagée.':'La gare n\'est pas libre : attendez le départ du train ou bloquez l\'autre au frein final.','warn');
      else{G.gar.pop();t.st='fromGarage';log(t.name+(GAR.at==='brake'?' recule vers le frein final.':' recule vers la gare.'));}}}
  else if(a==='revise')startJob('trainRev',t);
  else if(a==='rearm')startJob('rearm',t);
  ui();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)act(b.dataset.act,b.dataset.arg);});
$('crowd').addEventListener('input',e=>{G.crowd=e.target.value/100;const c=+e.target.value;
  $('crowdV').textContent=c+' % — '+(c===0?'parc vide':c<=50?'faible':c<=120?'normale':c<=200?'forte':'saturée');});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();act('speed',G.speed?0:1);}});
$('trains').innerHTML=trains.map(t=>`<div class="card">
  <div class="name"><span class="dot" style="background:${t.col}"></span>${t.name}</div>
  <div class="st" id="tSt${t.i}"></div>
  <div class="bar"><i id="tW${t.i}"></i><span id="tW${t.i}T"></span></div>
  <div class="row">
    <button id="tR${t.i}" data-act="revise" data-arg="${t.i}">Réviser (600 €)</button>
    <button id="tA${t.i}" data-act="rearm" data-arg="${t.i}">Réarmer lapbars</button>
  </div></div>`).join('');
$('deskTrains').innerHTML=trains.map(t=>`<div class="ctl"><div class="plate"><span class="dot" style="background:${t.col}"></span>Train ${t.i+1}</div>
  <div class="pair"><button class="pb sq sm amber" id="tG${t.i}" data-act="garage" data-arg="${t.i}" title="Envoyer au garage">G</button><button class="pb sq sm green" id="tS${t.i}" data-act="sortir" data-arg="${t.i}" title="Marche arrière du garage vers la gare">◀</button></div>
  <div class="plate">Au garage · Retour</div></div>`).join('');
function bar(id,v){$(id).style.width=v+'%';$(id).style.background=v<50?'var(--ok)':v<80?'var(--warn)':'var(--bad)';$(id+'T').textContent='Usure '+Math.round(v)+' %';}
function trainStatus(t){
  const n=count(t);
  if(t.st==='garage')return G.job&&G.job.t===t?'Au garage — en révision':'Au garage'+(t.hs?' — hors service':'');
  if(t.st==='toGarage')return 'Roule vers le garage';
  if(t.st==='fromGarage')return 'Sort du garage en marche arrière';
  if(t.st==='station'){
    if(t.phase==='unload')return 'Débarquement';
    if(t.phase==='board')return t.hs?'Hors service':t.garReq&&!n?'Retenu en gare — à envoyer au garage':'Embarquement ('+n+'/'+SEATS+')';
    if(t.phase==='check')return 'Vérification des lapbars ('+OPS.filter(o=>o.ok).length+'/2 validé)';
    if(t.phase==='fault')return 'Défaut lapbar';
    const r=blockReason(t);return !G.auto&&!t.depReq?'Lapbars validés — en attente de l\'ordre de départ':r?'Prêt — en attente ('+r+')':'Départ…';
  }
  const z=zoneOf(t.s);
  if(z==='prelift')return 'Vers le lift';
  if(z==='lift')return t.wait?'En attente en haut du lift (canton occupé)':t.v===0?'Bloqué sur le lift ('+n+' passagers)':'Montée du lift';
  if(z==='course')return t.blk?'Arrêté au frein de bloc (canton occupé)':'Sur le parcours — '+Math.round(t.v*3.6)+' km/h';
  if(z==='brake')return t.v===0?(G.brakeFault?'Retenu aux freins (défaut)':GAR.at==='brake'&&t.garReq&&!n?'Retenu au frein final — à envoyer au garage':'En attente aux freins'):'Freinage';
  return 'Entrée en gare';
}
const lamp=(id,st)=>{$(id).className='lamp'+(st===2?' err':st===1?' occ':'');};
function ui(){
  $('hDay').textContent=G.day;$('hTime').textContent=fmtTime(G.time);
  $('hWx').textContent={clear:'Beau temps',rain:'Pluie',warn:'Orage en approche',storm:'ORAGE'}[G.wx.type];
  $('hMoney').textContent=Math.round(G.money).toLocaleString('fr-FR')+' €';
  $('hSat').textContent=Math.round(G.sat)+' %';
  const active=trains.filter(t=>t.st!=='garage').length;
  $('hQueue').textContent=G.queue.length+'/'+Math.floor(QLEN/SP);
  $('hWait').textContent=active?Math.round(G.queue.length/(SEATS/(SITE.lap||150)*active)*.5)+' min':'—';
  $('hRiders').textContent=G.stats.riders;
  for(const s of [0,1,2,4,8])$('sp'+s).classList.toggle('on',G.speed===s);
  $('bOpen').classList.toggle('lit',G.open);$('bOpen').disabled=!G.open&&G.time>=1080;
  $('bEvac').disabled=!G.queue.length;
  $('bAuto').classList.toggle('manu',!G.auto);
  {const can=trains.some(o=>o.st==='station'&&['board','check','ready'].includes(o.phase)&&!o.hs&&!o.garReq);$('bGate').classList.toggle('lit',G.gatesOpen);$('bGate').disabled=G.auto||(!G.gatesOpen&&!can);$('hPlat').textContent=G.plat.filter(r=>r).length+'/'+SEATS;}
  $('bGo').disabled=!(G.auto?trains.some(o=>o.st==='station'&&o.phase==='board'&&!o.depReq):trains.some(o=>o.st==='station'&&!o.depReq&&(o.phase==='ready'||(o.phase==='board'&&!G.gatesOpen&&(G.bypass||count(o)===0)))));$('bGo').classList.toggle('lit',!$('bGo').disabled);
  $('bByp').classList.toggle('manu',G.bypass);OPS.forEach(o=>{$('lOp'+o.i).className='lamp'+(o.ok?'':' off');});
  $('bStop').classList.toggle('lit',G.estop);
  const inZ=z=>trains.some(t=>t.st==='run'&&zoneOf(t.s)===z);
  lamp('lGare',trains.some(t=>t.fault)?2:stationBusy()?1:0);
  lamp('lLift',G.liftBroken||G.estop?2:(inZ('lift')||inZ('prelift'))?1:0);
  lamp('lCourse',G.wear.track>=100?2:inZ('course')?1:0);
  lamp('lBrake',G.brakeFault?2:inZ('brake')?1:0);
  $('opNote').textContent=G.wx.type==='storm'?'ORAGE : aucun départ autorisé.':G.wx.type==='warn'?'Orage imminent : passez en manuel ou enclenchez l\'arrêt d\'urgence.'
    :active===0?'Aucun train en service : sortez un train du garage.':G.estop?'ARRÊT D\'URGENCE enclenché.':trains.some(o=>o.st==='station'&&o.phase==='check')?'Vérification des lapbars par les opérateurs : '+OPS.filter(o=>o.ok).length+'/2 validé.':G.bypass?'BY-PASS lapbars actif : départ sans vérification.':G.brakeLock?'Frein final bloqué : trains retenus avant la gare.':G.sw>.01||G.swT?(G.sw<1&&G.swT?'Aiguillage en mouvement vers GARAGE.':G.swT?'Aiguillage sur GARAGE : '+(GAR.at==='brake'?'entrée en gare bloquée.':'départs bloqués.'):'Aiguillage en retour vers la voie principale.'):!G.open?(G.queue.length||G.plat.some(r=>r)?'Entrée fermée — '+(G.queue.filter(v=>v.mode==='q').length+G.plat.filter(r=>r).length)+' visiteurs restent à embarquer.':'Entrée fermée — file vide.'):(G.auto?'Mode auto':'Mode manuel')+' — exploitation normale.';
  for(const t of trains){
    $('tSt'+t.i).textContent=trainStatus(t)+(t.garReq&&t.st==='run'?' · garage demandé':'');
    bar('tW'+t.i,t.wear);
    $('tG'+t.i).disabled=t.st!=='station'&&t.st!=='run';$('tG'+t.i).classList.toggle('lit',t.garReq||t.st==='toGarage');
    $('tS'+t.i).disabled=t.st!=='garage'||!!(G.job&&G.job.t===t);$('tS'+t.i).classList.toggle('lit',t.st==='fromGarage');$('bSw').classList.toggle('manu',!!G.swT);$('bHold').classList.toggle('lit',G.brakeLock);
    $('tR'+t.i).disabled=!!G.job||t.st!=='garage';
    $('tA'+t.i).disabled=!!G.job||t.fault!=='lapbars';
  }
  bar('wChain',G.wear.chain);bar('wTrack',G.wear.track);bar('wBrake',G.wear.brake);
  for(const [id,k] of [['bLiftFix','liftFix'],['bChainRev','chainRev'],['bTrackRev','trackRev'],['bBrakeFix','brakeFix'],['bBrakeRev','brakeRev']])
    $(id).disabled=!!G.job||!JOBS[k].ok();
  $('tech').textContent=G.job?G.job.label:'Équipe technique disponible';
  $('techBar').style.width=G.job?(100*(1-G.job.rem/G.job.dur))+'%':'0%';
  $('techTxt').textContent=G.job?Math.ceil(G.job.rem*.5)+' min restantes':'';
  for(const b of document.querySelectorAll('#cams button[data-act=cam]'))b.classList.toggle('on',b.dataset.arg===cam.key);
  $('bRoof').classList.toggle('on',!!G.roofOff);$('bRoof').textContent=G.roofOff?'Toits retirés':'Toits en place';
}

/* ══════════ RENDU 2D — VUE AÉRIENNE SUR FOND RÉEL (OpenStreetMap) ══════════ */
const wrap=$('view'),cv=document.createElement('canvas'),ctx=cv.getContext('2d');wrap.prepend(cv);
let VW=1,VH=1,DPR=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);VW=wrap.clientWidth||1;VH=wrap.clientHeight||1;cv.width=VW*DPR;cv.height=VH*DPR;cv.style.width=VW+'px';cv.style.height=VH+'px';}
addEventListener('resize',resize);resize();
const VIEW=SITE.view,fitS=()=>Math.min(VW/VIEW.w,VH/VIEW.h);
const CAMS=Object.assign({vue:{label:'Vue d\'ensemble',x:VIEW.x,z:VIEW.z,s:0}},SITE.cams);
const cam={key:'vue',x:VIEW.x,z:VIEW.z,s:fitS(),g:null,follow:-1};
function setCam(k){cam.key=k;if(k.startsWith('suivi')){cam.follow=+k.slice(5);cam.g={s:12};}else{cam.follow=-1;const c=CAMS[k];cam.g={x:c.x,z:c.z,s:c.s||fitS()};}}
$('cams').innerHTML=Object.entries(CAMS).map(([k,c])=>`<button data-act="cam" data-arg="${k}">${c.label}</button>`).join('')
  +trains.map(t=>`<button data-act="cam" data-arg="suivi${t.i}">Suivre T${t.i+1}</button>`).join('')
  +'<button data-act="roof" id="bRoof" title="Retirer ou remettre les toits de la gare, du poste de conduite et du garage">Toits en place</button>';
(function controls(){
  const ptrs=new Map();let pinch=0,moved=0;const free=()=>{cam.g=null;cam.follow=-1;cam.key='';};
  const gateAt=e=>{const r=cv.getBoundingClientRect(),wx=cam.x+(e.clientX-r.left-VW/2)/cam.s,wz=cam.z+(e.clientY-r.top-VH/2)/cam.s;let best=-1,bd=Math.max(2.2,14/cam.s);
    LOOPS.forEach((l,i)=>{const g=l.g;for(const q of [g.h,[(g.h[0]+g.a[0])/2,(g.h[1]+g.a[1])/2],[(g.h[0]+g.b[0])/2,(g.h[1]+g.b[1])/2]]){const d=Math.hypot(q[0]-wx,q[1]-wz);if(d<bd){bd=d;best=i;}}});
    {const g=ENTRY_GATE,d=Math.min(Math.hypot(g.h[0]-wx,g.h[1]-wz),Math.hypot((g.h[0]+g.a[0])/2-wx,(g.h[1]+g.a[1])/2-wz),Math.hypot((g.h[0]+g.b[0])/2-wx,(g.h[1]+g.b[1])/2-wz));if(d<bd)best=-2;}
    return best;};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=0;});
  const up=e=>{if(ptrs.has(e.pointerId)&&e.type==='pointerup'&&moved<6&&ptrs.size===1){const i=gateAt(e);if(i>=0)act('loop',i);else if(i===-2)act('open');}ptrs.delete(e.pointerId);pinch=0;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p){cv.style.cursor=gateAt(e)!==-1?'pointer':'grab';return;}
    const dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);if(moved<6)return;free();
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)cam.s=clamp(cam.s*d/pinch,1.6,45);pinch=d;return;}
    cam.x=clamp(cam.x-dx/cam.s,VIEW.bounds[0],VIEW.bounds[1]);cam.z=clamp(cam.z-dy/cam.s,VIEW.bounds[2],VIEW.bounds[3]);});
  cv.addEventListener('wheel',e=>{e.preventDefault();free();const r=cv.getBoundingClientRect(),mx=e.clientX-r.left-VW/2,mz=e.clientY-r.top-VH/2;
    const wx=cam.x+mx/cam.s,wz=cam.z+mz/cam.s;cam.s=clamp(cam.s*Math.exp(-e.deltaY*.0014),1.6,45);cam.x=wx-mx/cam.s;cam.z=wz-mz/cam.s;},{passive:false});
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
const chunkH=new Float32Array(N+1),chunks=[],dirtP=new Path2D,chainP=new Path2D,finsP=new Path2D,wid=h=>BOB?1.5:h>ST_Y+.6?1.6+h*.2:1.85,DECKW=BOB?2.3:3.1;
function strip(sm){
  const o={h:0,sw:0,deck:new Path2D,rail:new Path2D,hand:new Path2D,ties:new Path2D,str:new Path2D,sh:new Path2D,shb:new Path2D,x0:1e9,x1:-1e9,z0:1e9,z1:-1e9},n=sm.length;
  const side=(path,off,fn)=>sm.forEach((q,i)=>{const k=fn?fn(q.y)*off:off,x=q.x+q.nx*k,z=q.z+q.nz*k;i?path.lineTo(x,z):path.moveTo(x,z);});
  let hs=0;
  sm.forEach((q,i)=>{
    const sx=q.x+q.y*SHX,sz=q.z+q.y*SHZ;hs+=q.y;
    o.x0=Math.min(o.x0,q.x-9);o.x1=Math.max(o.x1,sx+9);o.z0=Math.min(o.z0,q.z-9);o.z1=Math.max(o.z1,sz+9);
    if(i){o.deck.lineTo(q.x,q.z);o.sh.lineTo(sx,sz);}else{o.deck.moveTo(q.x,q.z);o.sh.moveTo(sx,sz);}
    if(!BOB&&q.i%2===1){o.ties.moveTo(q.x-q.nx*.9,q.z-q.nz*.9);o.ties.lineTo(q.x+q.nx*.9,q.z+q.nz*.9);}
    if(i<n-1&&q.i%(BOB?12:6)===0){const w=wid(q.y);o.str.moveTo(q.x-q.nx*w,q.z-q.nz*w);o.str.lineTo(q.x+q.nx*w,q.z+q.nz*w);
      if(!BOB&&q.y>7.5&&i+6<n){const b=sm[i+6],w2=wid(b.y),e=(q.i/6)%2?1:-1;o.str.moveTo(q.x-q.nx*w*e,q.z-q.nz*w*e);o.str.lineTo(b.x+b.nx*w2*e,b.z+b.nz*w2*e);}
      for(const sg of (BOB?[0]:[-1.25,1.25])){const bx=q.x+q.nx*sg,bz=q.z+q.nz*sg;o.shb.moveTo(bx,bz);o.shb.lineTo(bx+q.y*SHX,bz+q.y*SHZ);}}
  });
  if(BOB){side(o.rail,-1.02);side(o.rail,1.02);} // bords de la gouttière
  else{side(o.rail,-.6);side(o.rail,.6);side(o.hand,-1.5);side(o.hand,1.5);side(o.str,-1,wid);side(o.str,1,wid);}
  o.h=hs/n;const k=clamp(o.h/30,0,1);o.col=BOB?`rgb(${lerp(150,198,k)|0},${lerp(156,204,k)|0},${lerp(164,210,k)|0})`:`rgb(${lerp(172,198,k)|0},${lerp(146,170,k)|0},${lerp(104,124,k)|0})`;
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
  const gs=GPATH.map((q,i)=>{const a=GPATH[Math.max(0,i-1)],b=GPATH[Math.min(GPATH.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:q.x,y:ST_Y,z:q.z,nx:-(b.z-a.z)/l,nz:(b.x-a.x)/l,i};});
  const sP=strip(gs.slice(0,37));sP.sw=2;chunks.push(sP,strip(gs.slice(36)));
  for(let i=Math.round(S_LIFT0/DS);i<=Math.round((S_LIFT1+3)/DS);i++){const p=TR[i].p;chainP.lineTo(p.x,p.z);}
  for(let i=Math.round((S_BRK+3)/DS);i<Math.round(S_HOLD/DS);i+=3){const f=TR[i],l=Math.hypot(f.R.x,f.R.z)||1,nx=f.R.x/l,nz=f.R.z/l;finsP.moveTo(f.p.x-nx*.28,f.p.z-nz*.28);finsP.lineTo(f.p.x+nx*.28,f.p.z+nz*.28);}
})();
const swz=o=>o.sw===1?SW_D*G.sw:o.sw===2?-SW_D*(1-G.sw):0; // déplacement des deux tronçons portés par le pont, le long de (SW0.vx, SW0.vz)

// Décor réel : bâtiments, allées, plans d'eau, bois
const mkPath=(pts,close)=>{const p=new Path2D;pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath();return p;};
const cen=pts=>{let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return [x/pts.length,z/pts.length];};
const LY={water:[],canal:[],lawn:[],forest:[],dirt:[],asph:[],foot:[],footA:[],road:[],hedge:[],bld:[],pier:[]},trees=[],FOOT=[],PLACES=[],otherP=(OSM.others||[]).map(p=>mkPath(p));
let tunnelP=null,tunnelC=[5,98];
(function scenery(){
  const ROOFS=['#a9553f','#b0694a','#9d6350','#8a8f96','#b9ab93','#7f8a8f','#a35f47'],seen=new Set();
  const stroll=pts=>{const C=[0];for(let j=1;j<pts.length;j++)C.push(C[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));if(C[C.length-1]>45)FOOT.push({P:pts,C,len:C[C.length-1]});};
  const addBld=(pts,o)=>{const m=cen(pts),lit=new Path2D,dark=new Path2D;let ar=0;
    for(let j=0;j<pts.length-1;j++)ar+=pts[j][0]*pts[j+1][1]-pts[j+1][0]*pts[j][1];
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],sg=ar>0?1:-1,nx=(b[1]-a[1])*sg,nz=-(b[0]-a[0])*sg,pp=nx*-.8+nz*-.6>0?lit:dark;pp.moveTo(a[0],a[1]);pp.lineTo(b[0],b[1]);}
    const near=q=>q&&Math.hypot(m[0]-q[0],m[1]-q[1])<q[2];
    LY.bld.push(Object.assign({p:mkPath(pts,true),m,lit,dark,st:near(SITE.stationAt),h:7,canopy:false,fade:(SITE.fade||[]).some(near)},o));};
  OSM.feats.forEach((f,i)=>{
    const k=f.k,c=f.c&&f.p.length>3,p=mkPath(f.p,c);
    if(f.n&&!seen.has(f.n)&&!(SITE.hideNames||[]).includes(f.n)&&!k.startsWith('highway')){seen.add(f.n);const m=cen(f.p);PLACES.push([f.n.replace(/ \(\d+\)/,''),m[0],m[1]]);}
    if(k==='natural=water'||k==='landuse=reservoir'){if(c)LY.water.push(p);}
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
  const nearTrack=(x,z,r)=>{for(let i=0;i<N;i+=6){const p=TR[i].p;if((p.x-x)**2+(p.z-z)**2<r*r)return true;}for(let i=0;i<GPATH.length;i+=4){const p=GPATH[i];if((p.x-x)**2+(p.z-z)**2<(r+1.5)**2)return true;}return Math.hypot(x-SW0.x-SW0.tx*4.5,z-SW0.z-SW0.tz*4.5)<10+r;};
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
  if(shadow){ctx.translate(p.x+(p.y+.6)*SHX,p.z+(p.y+.6)*SHZ);ctx.rotate(a);ctx.fillStyle='rgba(10,20,10,.3)';ctx.fillRect(-hl-.04,-hw-.04,2*hl+.08,CW+.08);ctx.restore();return;}
  ctx.translate(p.x,p.z);ctx.rotate(a);
  if(BOB){ // coque de bob : pas de roues apparentes, nez et queue arrondis
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.2,.46,.46,.2]:k===NCARS-1?[.42,.2,.2,.42]:.22);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.12,-hw,2*hl-.24,.07);ctx.fillRect(-hl+.12,hw-.07,2*hl-.24,.07);
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.2,-hw+.15,2*hl-.42,CW-.3,.14);ctx.fill();
  }else{
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.08,-hw-.2,.36,CW+.4);ctx.fillRect(hl-.44,-hw-.2,.36,CW+.4);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.18,.45,.45,.18]:.18);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl,-hw,2*hl,.11);ctx.fillRect(-hl,hw-.11,2*hl,.11);
    ctx.fillStyle='#17181c';ctx.fillRect(-hl+.26,-hw+.14,2*hl-.48,CW-.28);
    ctx.fillStyle='#3a3d46';ctx.fillRect(-hl+.14,-hw+.12,.18,CW-.24);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.22);ctx.lineTo(hl-.06,0);ctx.lineTo(hl-.3,.22);ctx.fill();}
  }
  if(cam.s>2.2)for(let sd=0;sd<2;sd++){const s=t.seats[k*2+sd];if(!s||!s.on)continue;
    const x=INL?(sd?-.36:.3):-.06,y=INL?0:(sd?.3:-.3),up=((k*2+sd)%3!==1)?t.arms:0; // côte à côte, ou l'un derrière l'autre
    ctx.fillStyle=PAL[s.ci];ctx.beginPath();ctx.ellipse(x,y,.2,INL?.24:.26,0,0,7);ctx.fill();
    if(up>.3&&cam.s>7){ctx.strokeStyle='#e9c9a6';ctx.lineWidth=.09;ctx.beginPath();const d=.42*up;ctx.moveTo(x,y-.2);ctx.lineTo(x+d,y-.26);ctx.moveTo(x,y+.2);ctx.lineTo(x+d,y+.26);ctx.stroke();}
    ctx.fillStyle=HAIR[(k*5+sd*3+t.i)%HAIR.length];ctx.beginPath();ctx.arc(x,y,.14,0,7);ctx.fill();}
  ctx.restore();
}
const API={lw,person,TEX}; // outils passés aux fonctions de dessin propres à chaque attraction (SITE.draw)
function drawTable(){ // pont transbordeur, dessiné dans son repère : u le long de la voie, v dans le sens du coulissement
  const len=GAR.len||8.6,v0=-SW_D-4.4,v1=SW_D+2.2;
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  ctx.fillStyle='#8f9296';ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.55;ctx.fillRect(-1,v0,len+1.7,v1-v0);ctx.globalAlpha=1;
  ctx.strokeStyle='#2c2e33';lw(.22,.8);ctx.beginPath();for(const u of [.4,len/2+.05,len-.3]){ctx.moveTo(u,v0+.3);ctx.lineTo(u,v1-.3);}ctx.stroke();
  ctx.translate(0,SW_D*G.sw);ctx.fillStyle='rgba(60,64,72,.93)';ctx.strokeStyle=G.sw>0&&G.sw<1&&Math.sin(clock*10)>0?'#ff9f43':'#e8b93c';lw(.14,.7);
  ctx.beginPath();ctx.rect(-.5,-SW_D-4,len+.6,SW_D+5.4);ctx.fill();ctx.stroke();ctx.restore();
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
  if(!BOB){ctx.strokeStyle=TEX.dirt;ctx.globalAlpha=.85;ctx.lineWidth=8.5;ctx.stroke(dirtP);ctx.globalAlpha=1;} // terre battue sous la charpente en bois
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
    for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)){const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
    for(const t of trains)for(let k=0;k<NCARS;k++)drawCar(t,k,true);
    if(SITE.draw&&SITE.draw.shadows)SITE.draw.shadows(ctx,dry,API);
  }
  // sol de la gare, voie de garage
  drawTable();drawStationFloor(s);drawBooth(s);drawGates();
  // personnages
  for(const v of G.queue)person(v.x,v.z,v.ci,v.ph,v.mv);
  for(const k of G.walkers)person(k.x,k.z,k.ci,k.ph,true);
  for(const p of strollers){p.d+=p.v*dt*G.speed;if(p.d>p.f.len||p.d<0){p.v=-p.v;p.d=clamp(p.d,0,p.f.len);}pathPos(p.f.P,p.f.C,p.d,p,p.side);if(p.x>x0-1&&p.x<x1+1&&p.z>z0-1&&p.z<z1+1)person(p.x,p.z,p.ci,p.ph,G.speed>0);}
  if(G.job){const p=JOBSITE[G.job.type];person(p[0],p[1],C_TECH,.5,true,'#fff3b0');person(p[0]+1.1,p[1]+.5,C_TECH,2,true,'#fff3b0');}
  // voie + trains, triés par hauteur
  const items=[];
  for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1))items.push(o);
  for(const t of trains){const ex=t.st==='run'&&zoneOf(t.s)==='course'&&t.v>9;t.arms=lerp(t.arms,ex?1:0,Math.min(1,dt*4));
    for(let k=0;k<NCARS;k++){const sc=t.s-(k+.5)*CAR;items.push({h:(t.st==='run'?chunkH[Math.floor((((sc%L)+L)%L)/DS)%N]:ST_Y)+.02,t,k});}}
  items.sort((a,b)=>a.h-b.h);
  for(const o of items){
    if(o.t){drawCar(o.t,o.k);continue;}
    const k=swz(o);if(k){ctx.save();ctx.translate(SW0.vx*k,SW0.vz*k);}
    if(BOB){ // gouttière en acier : bords sombres, fond clair, reflet au centre
      ctx.strokeStyle='#4a4f57';lw(.22,.7);ctx.stroke(o.str);
      ctx.strokeStyle='#565c65';ctx.lineWidth=DECKW;ctx.stroke(o.deck);ctx.strokeStyle=o.col;ctx.lineWidth=2;ctx.stroke(o.deck);
      ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.9;ctx.stroke(o.deck);
      ctx.strokeStyle='#2f3339';lw(.1,.5);ctx.stroke(o.rail);
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
  const pw=Math.min(380,VW-16),ph=62,px=8,py=8;
  ctx.fillStyle='rgba(15,22,38,.72)';ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.beginPath();ctx.moveTo(px+6,py+ph-6);for(let i=0;i<=N;i+=4)ctx.lineTo(px+6+(pw-12)*i/N,py+ph-6-TR[i%N].p.y*1.3);ctx.lineTo(px+pw-6,py+ph-6);ctx.closePath();ctx.fillStyle='rgba(200,165,110,.55)';ctx.fill();ctx.strokeStyle='#e6cfa0';ctx.lineWidth=1.2;ctx.stroke();
  for(const t of trains)if(t.st==='run'||t.st==='station'){const i=Math.round(t.s/DS)%N;ctx.fillStyle=t.col;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px+6+(pw-12)*t.s/L,py+ph-6-TR[i].p.y*1.3-3,4.5,0,7);ctx.fill();ctx.stroke();}
  ctx.font='10px system-ui,sans-serif';ctx.textAlign='left';ctx.fillStyle='#cbd5ee';ctx.fillText('Profil du parcours — '+Math.round(L)+' m (hauteurs estimées)',px+8,py+12);
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
  const modal=!$('mHelp').classList.contains('hidden')||!$('mDay').classList.contains('hidden');
  if(!modal)for(let i=0;i<G.speed;i++)step(dt);
  render(modal?0:dt);
  uiT+=dt;if(uiT>.12){uiT=0;ui();}
  requestAnimationFrame(frame);
}
document.title=SITE.title+' — Simulateur d\'exploitation';$('ttl').textContent=SITE.title;$('helpTtl').textContent=SITE.title+' — à vous les commandes';
$('trackName').textContent=SITE.trackName||'Voie';$('helpGarage').innerHTML=SITE.helpGarage||'';
log('Bienvenue sur '+SITE.title+' ! '+trains[0].name+' est en gare'+(trains.length>1?', '+(trains.length-1)+' train'+(trains.length>2?'s':'')+' au garage':'')+'. Ouvrez l\'entrée pour commencer.','good');
ui();requestAnimationFrame(frame);
Object.assign(window,{G,trains,act,step,cam,L,render,SD:S_DROP,ui});
