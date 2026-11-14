'use strict';
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
