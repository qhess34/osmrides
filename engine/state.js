'use strict';
/* ══════════ ÉTAT DU JEU ══════════ */
const PAL=['#8a3d3d','#b59a62','#5c7f68','#4a6790','#75658e','#a8848a','#d6d3cc','#a8733f','#4c7f7c','#8990ad','#5a5780','#3c4250'];
const C_GREY=PAL.length,C_TECH=PAL.length+1; PAL.push('#6f6f6f','#d9772b');
const G={day:1,time:600,speed:1,money:3000,sat:75,open:false,auto:true,estop:false,
  queue:[],walkers:[],plat:new Array(SEATS).fill(null),platT:0,gatesOpen:false,gate:0,bypass:false,dev:{pos:DEV0,to:DEV0,k:1},ra:{pos:0,to:0,k:1},zm:{},zk:{},liftOff:false,crowd:1,wx:{type:'clear',t:0,next:rnd(260,420)},flash:0,
  wear:{chain:45,track:35,brake:40},liftBroken:false,brakeFault:false,job:null,
  stats:null,over:false,dayDone:false,closedMsg:false};
const newStats=()=>({riders:0,quits:0,income:0,costs:0,disp:0,fines:0,turned:0});
G.stats=newStats();
function mkTrain(i,name,col,col2,wear,st){
  return {i,name,col,col2,wear,st,s:S_ST,v:0,g:0,lane:0,mv:0,blk:false,told:false,seats:new Array(SEATS).fill(null),phase:'board',pt:0,idle:0,
    depReq:false,fdrive:0,outReq:false,hold:0,fault:null,hs:false,entering:false,inBrake:false,inLift:false,failAt:-1,screamed:false,arms:0};
}
const trains=SITE.trains.map((c,i)=>mkTrain(i,c.name,c.col,c.col2,c.wear,i?'garage':'station'));
// Trains au garage au départ : voie SITE.trains[i].lane (1…n) ou première voie qui a de la place ; rangés depuis la butée
{const n=LANES.map(()=>0);trains.forEach((t,i)=>{if(t.st!=='garage')return;const c=SITE.trains[i].lane,j=c?c-1:LANES.findIndex((l,k)=>n[k]<l.cap);
  if(j<0||n[j]>=LANES[j].cap)throw new Error('SITE.yard : pas de place au garage pour '+t.name);t.lane=j;t.g=LANES[j].end-n[j]*GSTEP;n[j]++;});}
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
  return trains.some(o=>o!==self&&(o.st==='station'||(YD.at!=='brake'&&yardBusy(o))||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))));
}
// Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre
const blkEnd=i=>i+1<BLK.length?BLK[i+1]:L;
function occupied(a,b,self){
  return trains.some(o=>o!==self&&o.st==='run'&&o.s>a&&o.s<b+TLEN)||(b>=L&&YD.at==='brake'&&trains.some(o=>o!==self&&yardBusy(o)));
}
function blockReason(t){
  if(G.estop)return "arrêt d'urgence";
  if(zK('St'))return 'freins de gare serrés';
  if(G.liftOff)return 'lift à l\'arrêt';
  if(YD.at!=='brake'&&devOff())return DEVN.toLowerCase()+' hors de P';
  if(YD.at!=='brake'&&trains.some(yardBusy))return 'manœuvre au garage';
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
  trainRev:{label:'Révision',dur:40,cost:600,ok:t=>t.st==='garage'&&!t.mv},
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

