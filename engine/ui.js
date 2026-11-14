'use strict';
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

