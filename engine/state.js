'use strict';
/* ══════════ ÉTAT DU JEU ══════════ */
const PAL=['#8a3d3d','#b59a62','#5c7f68','#4a6790','#75658e','#a8848a','#d6d3cc','#a8733f','#4c7f7c','#8990ad','#5a5780','#3c4250'];
const C_GREY=PAL.length,C_TECH=PAL.length+1; PAL.push('#6f6f6f','#d9772b');
/* Mode de jeu : carrière (budget, météo, pannes) ou bac à sable (?mode=sandbox, ou choix mémorisé t2z.mode) : ni budget, ni météo, ni pannes. */
const MODE=(()=>{const m=/[?&]mode=([a-z]+)/.exec(location.search);if(m)return m[1]==='sandbox'?'sandbox':'career';try{return localStorage.getItem('t2z.mode')==='sandbox'?'sandbox':'career';}catch(e){return 'career';}})();
const G={sandbox:MODE==='sandbox',day:1,time:600,speed:1,money:3000,sat:75,open:false,auto:true,estop:false,
  queue:[],walkers:[],plat:new Array(SEATS).fill(null),platT:0,gatesOpen:false,gate:0,resOpen:false,bypass:false,dev:{pos:DEV0,to:DEV0,k:1},ra:{pos:0,to:0,k:1},zm:{},zk:{},liftOff:false,crowd:1,wx:{type:'clear',t:0,next:rnd(260,420)},flash:0,
  wear:{chain:45,track:35,brake:40},liftBroken:false,brakeFault:false,job:null,
  stats:null,over:false,dayDone:false,closedMsg:false};
const newStats=()=>({riders:0,quits:0,income:0,costs:0,disp:0,fines:0,turned:0});
G.stats=newStats();
function mkTrain(i,name,col,col2,wear,st){
  return {i,name,col,col2,wear,st,s:S_ST,v:0,g:0,lane:0,mv:0,blk:false,told:false,seats:new Array(SEATS).fill(null),phase:'board',pt:0,idle:0,
    depReq:false,toPre:false,fdrive:0,outReq:false,hold:0,fault:null,hs:false,entering:false,inBrake:false,inLift:false,failAt:-1,screamed:false,arms:0,rc:new Array(NCARS).fill(0),rcT:0}; // sécurités : rc[k] = ouverture du wagon k (0 verrouillées … 1 ouvertes, animée) ; rcT = wagons à garder ouverts (bits) après le verrouillage, jusqu'au passage d'un opérateur
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
function pay(n,fine){if(G.sandbox)return;G.money-=n;G.stats.costs+=n;if(fine)G.stats.fines+=n;}

/* ══════════ SON (synthétisé) ══════════ */
const sfx=(()=>{
  // Son coupé par défaut (bouton Son, allumé quand le son est activé). Aucun enregistrement : tout est synthétisé (Web Audio) en couches — bruit filtré multi-bandes, résonances métalliques
  // (filtres passe-bande étroits), enveloppes asymétriques, réverbération courte générée, variations aléatoires à chaque déclenchement, panoramique selon la position
  // à l'écran et atténuation selon la distance à la caméra. N (compteurs) : espion pour les tests (appels même sans contexte audio).
  let ac=null,master,noise,rumble,wind,rain,crowd,muted=true,clickT=0,verb,chainG,chainO,liftOn=false;const N={brakeOn:0,brakeOff:0,resAir:0,resClose:0,liftClick:0,liftStart:0,liftStop:0};
  function loop(type,f,q){const s=ac.createBufferSource();s.buffer=noise;s.loop=true;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
    const g=ac.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(master);s.start();return g;}
  function init(){
    if(ac){ac.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ac=new AC();master=ac.createGain();master.gain.value=muted?0:.8;master.connect(ac.destination);
    noise=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    rumble=loop('lowpass',170,.8);wind=loop('bandpass',900,.6);rain=loop('highpass',2600,.4);crowd=loop('bandpass',450,.5);
    // réverbération courte (réponse impulsionnelle générée : bruit à décroissance exponentielle, 0,9 s), envoyée à faible niveau
    verb=ac.createConvolver();{const n=Math.floor(ac.sampleRate*.9),b=ac.createBuffer(2,n,ac.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2);}verb.buffer=b;}
    const vg=ac.createGain();vg.gain.value=.22;verb.connect(vg);vg.connect(master);
    // chaîne du lift : grondement grave (bruit passe-bas + dent de scie à 46 Hz filtrée), modulé
    chainG=ac.createGain();chainG.gain.value=0;chainG.connect(master);
    {const s=ac.createBufferSource();s.buffer=noise;s.loop=true;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=140;f.Q.value=1.2;s.connect(f);f.connect(chainG);s.start();
     chainO=ac.createOscillator();chainO.type='sawtooth';chainO.frequency.value=46;const f2=ac.createBiquadFilter();f2.type='lowpass';f2.frequency.value=220;const g2=ac.createGain();g2.gain.value=.35;
     const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=3.1;lg.gain.value=.12;lfo.connect(lg);lg.connect(g2.gain);lfo.start();chainO.connect(f2);f2.connect(g2);g2.connect(chainG);chainO.start();}
  }
  // position (x, z en m) → gain et panoramique : distance au centre de la caméra (en m, plus le zoom est fort, plus on est « près »), position horizontale à l'écran
  function spat(x,z){if(x==null||typeof cam==='undefined')return {g:1,p:0};const d=Math.hypot(x-cam.x,z-cam.z),near=Math.max(6,180/Math.max(.5,cam.s));
    return {g:clamp(1/(1+Math.pow(d/near,2)),.04,1),p:clamp((x-cam.x)*cam.s/Math.max(200,(typeof VW!=='undefined'?VW:800)/2),-.9,.9)};}
  function out(node,x,z,wet){const S=spat(x,z),g=ac.createGain();g.gain.value=S.g;node.connect(g);let o=g;
    if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=S.p;g.connect(p);o=p;}o.connect(master);if(wet!==0){const w=ac.createGain();w.gain.value=wet||.5;o.connect(w);w.connect(verb);}}
  const live=()=>ac&&!muted&&G.speed!==0;
  const vr=(v,k)=>v*(1+rnd(-k,k)); // variation aléatoire de hauteur / timbre
  function nb(t,type,f,q,vol,att,dur,dst){const s=ac.createBufferSource();s.buffer=noise;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ac.createGain();
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(fl);fl.connect(g);g.connect(dst);s.start(t,Math.random()*1.5);s.stop(t+dur+.05);return fl;}
  function ring(t,f,q,vol,dur,dst){nb(t,'bandpass',f,q,vol,.001,dur,dst);} // résonance métallique : bruit très court dans un passe-bande étroit
  function knock(t,f,vol,dur,dst){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(f*1.6,t);o.frequency.exponentialRampToValueAtTime(f,t+dur*.3);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dst);o.start(t);o.stop(t+dur+.02);}
  function air(x,z,vol,dur){ // relâchement d'air comprimé : souffle aigu à attaque nette, deux bandes, queue qui s'éteint
    const t=ac.currentTime+.005,bus=ac.createGain();out(bus,x,z,.35);const f=nb(t,'highpass',vr(2600,.15),.7,vol,.006,dur,bus);f.frequency.setValueAtTime(vr(3400,.1),t);f.frequency.exponentialRampToValueAtTime(1800,t+dur);
    nb(t,'bandpass',vr(6200,.12),1.4,vol*.6,.004,dur*.7,bus);nb(t,'bandpass',vr(900,.2),2,vol*.15,.01,dur*.4,bus);}
  function clack(x,z,vol){ // action mécanique : impact bref, trois résonances métalliques, coup sourd
    const t=ac.currentTime+.005,bus=ac.createGain();out(bus,x,z,.6);nb(t,'bandpass',vr(1900,.15),.9,vol,.0015,.03,bus);
    for(const f of [vr(870,.08),vr(2330,.08),vr(3720,.08)])ring(t,f,vr(28,.2),vol*.5,vr(.18,.3),bus);knock(t,vr(115,.1),vol*.8,.07,bus);}
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
    toggle(){muted=!muted;if(ac){master.gain.value=muted?0:.8;ac.resume();}else if(!muted)init();return muted;},
    bell(){tone(880,.12,.6);tone(1320,.08,.7,'sine',.14);},
    brake(){burst('highpass',3200,.7,.18,1.1);},
    N,muted:()=>muted,
    brakeOff(x,z){N.brakeOff++;if(live())air(x,z,vr(.22,.2),vr(.45,.2));},   // frein qui se desserre : relâchement d'air
    brakeOn(x,z){N.brakeOn++;if(live())clack(x,z,vr(.3,.15));},              // frein qui se serre : claquement métallique
    resAir(x,z){N.resAir++;if(live())air(x,z,vr(.16,.2),.55);},             // sécurités : air relâché 0,5 s avant l'ouverture
    resClose(x,z){N.resClose++;if(!live())return;const t0=ac.currentTime+.01,bus=ac.createGain();out(bus,x,z,.4); // sécurités qui se ferment : crémaillère (cliquetis rapide)
      const n=8+Math.floor(Math.random()*5),dt=vr(.028,.15);for(let i=0;i<n;i++){const t=t0+i*dt*(1+i*.04),v=.13*(1-i/n*.6);nb(t,'bandpass',vr(3100,.1),4,v,.0008,.018,bus);ring(t,vr(5200,.05),30,v*.4,.04,bus);}},
    thunder(){burst('lowpass',95,.5,1.4,4,.3);burst('lowpass',380,.5,.35,1.4,.3);},
    alarm(){tone(620,.1,.25,'square');tone(620,.1,.25,'square',.35);},
    scream(n){const k=Math.ceil(n/4);for(let j=0;j<k;j++){const f=rnd(700,1100);tone(f,.022,rnd(1.6,2.6),'sawtooth',rnd(0,.6),f*1.3);}burst('bandpass',1700,1.5,.07*n/24,2.4);},
    update(dt,o){
      const p=G.speed===0?0:1,L=o.lift,on=!!(L&&p);if(on!==liftOn){liftOn=on;N[on?'liftStart':'liftStop']++;} // espion : marche / arrêt de la chaîne
      // lift : grondement de la chaîne tant qu'un train monte (arrêt net quand la chaîne s'arrête), cliquetis des anti-retours au rythme de la vitesse.
      // SITE.liftSound = {antiRollback (défaut : oui sauf bob), gain, pitch (m de chaîne entre deux clacs, défaut 0,5)}
      const LS=Object.assign({antiRollback:SITE.kind!=='bob',gain:1,pitch:.5},SITE.liftSound);let click=false;
      if(on&&LS.antiRollback&&L.v>.05){clickT-=dt*L.v/LS.pitch;if(clickT<=0){clickT=1;N.liftClick++;click=true;}}
      if(!ac)return;
      set(rumble,o.rumble*p);set(wind,o.wind*p);set(rain,o.rain*p);set(crowd,o.crowd*p);
      const S=on?spat(L.x,L.z):{g:0};chainG.gain.setTargetAtTime(on?.22*LS.gain*S.g:0,ac.currentTime,on?.18:.025);if(on)chainO.frequency.setTargetAtTime(38+L.v*4,ac.currentTime,.3);
      if(click&&!muted){const t=ac.currentTime+.005,bus=ac.createGain();out(bus,L.x,L.z,.5);
        nb(t,'bandpass',vr(2400,.1),1.2,.09*LS.gain,.001,.012,bus);ring(t,vr(1750,.06),22,.05*LS.gain,vr(.11,.2),bus);ring(t,vr(3300,.06),26,.03*LS.gain,.07,bus);knock(t,vr(160,.1),.06*LS.gain,.05,bus);}
    }};
})();

/* ══════════ BLOCS, DÉPARTS, MAINTENANCE ══════════ */
function stationBusy(self){
  return trains.some(o=>o!==self&&(o.st==='station'||(YD.at!=='brake'&&yardBusy(o))||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))));
}
// Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre
const LIFT_NEXT=BLK.length?BLK[0]:L; // fin de la zone qui suit le lift : 1er frein de bloc, sinon le frein final (fin du circuit) ; le train arrivé en haut du lift y est retenu tant que cette zone est occupée (SITE.singleCourse : ancien réglage, ignoré, devenu le comportement par défaut)
const blkEnd=i=>i+1<BLK.length?BLK[i+1]:L;
const onRaSt=o=>RA&&o.st==='run'&&o.s>S_PRE+.3&&o.s<R1+TLEN; // pont droit à rail mobile : o est (en partie) sur le rail mobile du parcours (zone de stockage RA)
const onPsb=o=>PSB&&o.st==='run'&&(o.toPre||o.s>S_HOLD+.5); // o est sur le frein avant gare ou s'y rend (zone de stockage Pre)
// frein avant gare occupé : train arrêté dessus, qui s'y rend, ou qui en sort vers la gare (arrière pas encore entré)
const preBusy=self=>trains.some(o=>o!==self&&o.st==='run'&&(o.toPre||o.s>PSB_A-.5||o.s<TLEN+.3));
const aheadBusy=t=>PSB?preBusy(t):stationBusy(t); // section après le frein final / le rail mobile : frein avant gare s'il existe, sinon la gare
function occupied(a,b,self){
  if(b>=L&&(RA||PSB)){ // dernier canton : frein final, rail mobile et frein avant gare stockent un train chacun (le suivant attend au frein final)
    const z=trains.filter(o=>o!==self&&o.st==='run'&&o.s>a&&o.s<b+TLEN);
    return z.some(o=>!onRaSt(o)&&!onPsb(o))||(YD.at==='brake'&&trains.some(o=>o!==self&&yardBusy(o)));}
  return trains.some(o=>o!==self&&o.st==='run'&&o.s>a&&o.s<b+TLEN)||(b>=L&&YD.at==='brake'&&trains.some(o=>o!==self&&yardBusy(o)));
}
function blockReason(t){
  if(G.estop)return "arrêt d'urgence";
  if(G.liftOff)return 'lift à l\'arrêt';
  if(YD.at!=='brake'&&devOff()&&DEV_HOLD<0)return DEVN.toLowerCase()+' hors de P, aucune zone de freinage entre la gare et '+DEVL+' pour retenir le train'; // règle de départ (DEV_HOLD, engine/garage.js)
  if(YD.at!=='brake'&&trains.some(yardBusy)&&DEV_HOLD<0)return 'manœuvre au garage';
  if(G.liftBroken)return 'lift en panne';
  if(G.job&&G.job.lock)return 'maintenance en cours';
  if(G.wear.track>=100)return 'voie hors service';
  if(trains.some(o=>o!==t&&o.st==='run'&&o.s>=S_ST&&o.s<S_LIFT0))return 'zone avant-lift occupée'; // un train attend au pied du lift ; un train sur le lift n'empêche pas de partir (le suivant attend au pied)
  return '';
}
const liftBusy=t=>trains.some(o=>o!==t&&o.st==='run'&&o.s>=S_LIFT0&&o.s<S_REL); // un autre train est sur le lift (ou retenu en haut) : un seul train à la fois sur le lift
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

