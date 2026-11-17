'use strict';
function bar(id,v){$(id).style.width=v+'%';$(id).style.background=v<50?'var(--ok)':v<80?'var(--warn)':'var(--bad)';$(id+'T').textContent='Usure '+Math.round(v)+' %';}
function trainStatus(t){
  const n=count(t);
  if(t.st==='garage'){const ln=LANES[t.lane],w=t.lane<0||onCar(t)?'Sur le chariot de '+DEVL:t.g-TLEN>=ln.dev-.01?(LANES.length>1?'Voie '+(t.lane+1)+' — '+ln.name:ln.name):t.g>(LBK?YD.a-TLEN:YD.a)?'Sur '+DEVL:'Tronçon de liaison';
    return w+(t.mv>0?' — avance':t.mv<0?' — recule':G.job&&G.job.t===t?' — en révision':'')+(t.hs?' — hors service':'');}
  if(t.st==='station'){
    if(t.phase==='unload')return count(t)&&t.rc.some(v=>v<.95)?'En gare — sécurités verrouillées (à ouvrir)':'Débarquement';
    if(t.phase==='board'&&!t.hs&&!G.resOpen&&!t.rcT&&t.rc.every(v=>v<.05)&&!count(t))return 'À quai — sécurités verrouillées';
    if(t.phase==='board')return t.hs?'Hors service':'Embarquement ('+n+'/'+SEATS+')';
    if(t.phase==='check')return 'Fermeture et vérification des '+RES_NAME+' ('+OPS.filter(o=>o.ok).length+'/2 validé)';
    if(t.phase==='fault')return 'Défaut lapbar';
    const r=blockReason(t);return !G.auto&&!t.depReq?'Lapbars validés — en attente de l\'ordre de départ':r?'Prêt — en attente ('+r+')':'Départ…';
  }
  const z=zoneOf(t.s);
  if(z==='prelift')return 'Vers le lift';
  if(z==='lift')return t.wait?'En attente en haut du lift (canton occupé)':t.v===0?'Bloqué sur le lift ('+n+' passagers)':'Montée du lift';
  if(z==='course')return t.blk?'Arrêté au frein de bloc (canton occupé)':'Sur le parcours — '+Math.round(t.v*3.6)+' km/h';
  if(z==='brake')return t.v===0?(G.brakeFault?'Retenu aux freins (défaut)':'En attente aux freins'):'Freinage';
  return 'Entrée en gare';
}
const lamp=(id,st)=>{$(id).className='lamp'+(st===2?' err':st===1?' occ':'');};
function ui(){
  $('hDay').textContent=G.day;$('hTime').textContent=fmtTime(G.time);
  $('hWx').textContent={clear:'Beau temps',rain:'Pluie',warn:'Orage en approche',storm:'ORAGE'}[G.wx.type];
  $('hMoneyBox').style.display=G.sandbox?'none':'';$('hMode').style.display=G.sandbox?'':'none';$('hMoney').textContent=Math.round(G.money).toLocaleString('fr-FR')+' €';
  $('hSat').textContent=Math.round(G.sat)+' %';
  const active=trains.filter(t=>t.st!=='garage').length;
  $('hQueue').textContent=G.queue.length+'/'+Math.floor(QLEN/SP);
  $('hWait').textContent=active?Math.round(G.queue.length/(SEATS/(SITE.lap||150)*active)*.5)+' min':'—';
  $('hRiders').textContent=G.stats.riders;
  for(const b of document.querySelectorAll('[data-act=speed]'))b.classList.toggle('on',G.speed===+b.dataset.arg);
  $('bOpen').classList.toggle('lit',G.open);$('bOpen').disabled=!G.open&&G.time>=1080;
  $('bEvac').disabled=!G.queue.length;
  $('bAuto').classList.toggle('manu',!G.auto);
  {const can=trains.some(o=>o.st==='station'&&['board','check','ready'].includes(o.phase)&&!o.hs);$('bGate').classList.toggle('lit',G.gatesOpen);$('bGate').disabled=!G.gatesOpen&&!can;$('hPlat').textContent=G.plat.filter(r=>r).length+'/'+SEATS;}
  {const s=trains.find(o=>o.st==='station'),op=G.resOpen||!!(s&&s.rcT),mv=!!s&&s.rc.some((v,k)=>v>.02&&v<.98); // sécurités : bouton allumé = ouvertes ; voyant vert = verrouillées et fermées, ambre = ouvertes, clignotant = en mouvement
    $('bRes').classList.toggle('lit',op);$('bRes').disabled=!s;$('lRes').className='zl '+(op||(s&&s.rc.some(v=>v>.02))?'occ':'ok')+(mv?' blink':'');}
  $('bGo').disabled=!(G.auto?trains.some(o=>o.st==='station'&&o.phase==='board'&&!o.depReq):trains.some(o=>o.st==='station'&&!o.depReq&&(o.phase==='ready'||(o.phase==='board'&&!G.gatesOpen&&(G.bypass||count(o)===0)))));$('bGo').classList.toggle('lit',!$('bGo').disabled);
  $('bByp').classList.toggle('manu',G.bypass);OPS.forEach(o=>{$('lOp'+o.i).className='lamp'+(o.ok?'':' off');});
  $('bStop').classList.toggle('lit',G.estop);
  const inZ=z=>trains.some(t=>t.st==='run'&&zoneOf(t.s)===z);
  lamp('lGare',trains.some(t=>t.fault)?2:stationBusy()?1:0);
  lamp('lLift',G.liftBroken||G.estop?2:(inZ('lift')||inZ('prelift'))?1:0);
  lamp('lCourse',G.wear.track>=100?2:inZ('course')?1:0);
  lamp('lBrake',G.brakeFault?2:inZ('brake')?1:0);
  $('opNote').textContent=G.wx.type==='storm'?'ORAGE : aucun départ autorisé.':G.wx.type==='warn'?'Orage imminent : passez en manuel ou enclenchez l\'arrêt d\'urgence.'
    :active===0?'Aucun train en service : sortez un train du garage.':G.estop?'ARRÊT D\'URGENCE enclenché.':trains.some(o=>o.st==='station'&&o.phase==='check')?'Vérification des lapbars par les opérateurs : '+OPS.filter(o=>o.ok).length+'/2 validé.':G.resOpen&&trains.some(o=>o.st==='station')?'Sécurités ouvertes : fermez les portillons puis verrouillez-les pour le départ.':G.bypass?'BY-PASS lapbars actif : départ sans vérification.':zK('Fin')?'Frein final serré (MANU) : trains retenus avant la gare.':G.liftOff?'Lift à l\'arrêt (commande du pupitre).':G.auto&&G.gatesOpen&&trains.some(o=>o.st==='station'&&o.depReq)?'Train prêt : fermez les portillons.':devOff()&&!(TRAV&&inLine())?(devMoving()?DEVN+' en mouvement vers '+posName(G.dev.to)+'.':DEVN+' sur '+posName(G.dev.pos)+' : '+(TRAV?'rail du circuit hors ligne, trains retenus avant le pont.':YD.at==='brake'?'entrée en gare bloquée.':'départs bloqués.')):!G.open?(G.queue.length||G.plat.some(r=>r)?'Entrée fermée — '+(G.queue.filter(v=>v.mode==='q').length+G.plat.filter(r=>r).length)+' visiteurs restent à embarquer.':'Entrée fermée — file vide.'):(G.auto?'Mode auto':'Mode manuel')+' — exploitation normale.';
  for(const t of trains){
    $('tSt'+t.i).textContent=trainStatus(t)+(tZone(t)?' · zone '+zName(tZone(t)):'');
    bar('tW'+t.i,t.wear);
    $('tR'+t.i).disabled=!!G.job||t.st!=='garage';
    $('tA'+t.i).disabled=!!G.job||t.fault!=='lapbars';
  }
  for(const Z of ZONES){const z=Z.id,ts=zT(z),mv=ts.some(t=>t.st==='garage'?t.mv:t.v>0),err=(z==='Lift'&&(G.liftBroken||G.estop))||((z==='Fin'||z==='Pre')&&G.brakeFault);
    $('lz'+z).className='zl'+(err?' err':mv?' mv':ts.length?' occ':''); // voyant de zone : vert = train en mouvement, orange = occupée, rouge = défaut
    if(Z.sec==='gar'){const b=$('z'+z+'_d'),k=zK(z);b.classList.toggle('lit',!k&&ts.some(t=>t.mv));b.disabled=!!G.estop;$('z'+z+'_k').classList.toggle('lit',k);if(k)$('lz'+z).className='zl'+(ts.length||trains.some(t=>t.st==='garage'&&t.lane===+z.slice(1)-1)?' occ':'');continue;} // voie : Dispatch allumé pendant un mouvement ; F allumé = freins forcés serrés (voyant orange si un train est retenu)
    if(z==='Lift'){$('zLift_on').classList.toggle('lit',!G.liftOff);$('zLift_off').classList.toggle('lit',G.liftOff);continue;}
    const man=!Z.auto||!!G.zm[z];
    if(Z.auto){const b=$('z'+z+'_m');b.classList.toggle('lit',man);b.textContent=man?'MANU':'AUTO';}
    if(z==='St'){const h=stHeld();$('zSt_fr').textContent=h?'SERRÉS':'LIBRES';$('zSt_fr').classList.toggle('lit',h);}
    if(Z.brake){const b=$('z'+z+'_k');b.classList.toggle('lit',zK(z)||(!man&&ts.some(t=>t.st==='run'&&t.v===0)));b.disabled=!man;} // allumé = freins serrés (en AUTO : train retenu par le cantonnement)
    if(Z.drive){$('z'+z+'_f').classList.toggle('lit',ts.some(t=>t.st==='garage'?t.mv>0:t.entering||t.toPre||t.fdrive||(t.st==='station'&&t.depReq))||(z===CARR&&trains.some(t=>t.st==='garage'&&t.mv>0)));$('z'+z+'_b').classList.toggle('lit',ts.some(t=>t.mv<0));
      for(const c of 'fbx')$('z'+z+'_'+c).disabled=!man;}}
  $('zAuto').disabled=!ZONES.some(Z=>Z.auto&&G.zm[Z.id]);
  POS_ORDER.forEach(p=>{const b=$('y'+posId(p));b.classList.toggle('lit',!devMoving()&&G.dev.pos===p);b.classList.toggle('mv',devMoving()&&G.dev.to===p);});
  if(RA){[0,1].forEach(p=>{const b=$('yA'+p);b.classList.toggle('lit',!raMoving()&&G.ra.pos===p);b.classList.toggle('mv',raMoving()&&G.ra.to===p);});
    $('yAState').textContent=raMoving()?'En mouvement':(G.ra.pos?'Retiré':'Sur le circuit')+(raLock()?' — verrouillé':'');}
  {const o=devLock();$('yState').textContent=devMoving()?'En mouvement vers '+posId(G.dev.to):'En place sur '+posId(G.dev.pos)+(o?' — verrouillé':'');}
  bar('wChain',G.wear.chain);bar('wTrack',G.wear.track);bar('wBrake',G.wear.brake);
  for(const [id,k] of [['bLiftFix','liftFix'],['bChainRev','chainRev'],['bTrackRev','trackRev'],['bBrakeFix','brakeFix'],['bBrakeRev','brakeRev']])
    $(id).disabled=!!G.job||!JOBS[k].ok();
  $('tech').textContent=G.job?G.job.label:'Équipe technique disponible';
  $('techBar').style.width=G.job?(100*(1-G.job.rem/G.job.dur))+'%':'0%';
  $('techTxt').textContent=G.job?Math.ceil(G.job.rem*.5)+' min restantes':'';
  if(document.body.classList.contains('fs')){ // barre du plein écran : heure, file, quai, dernier message du journal
    $('fsHud').textContent=fmtTime(G.time)+' · Jour '+G.day+' · File '+G.queue.length+' · Quai '+G.plat.filter(r=>r).length+'/'+SEATS+' · '+Math.round(G.money).toLocaleString('fr-FR')+' €';
    const m=$('log').firstElementChild;$('fsMsg').textContent=m&&m.lastChild?m.firstChild.textContent+' '+m.lastChild.textContent:'';$('fsMsg').className=m?m.className:'';
    $('bDesk').classList.toggle('on',document.body.classList.contains('fsdesk'));}
  for(const b of document.querySelectorAll('#cams button[data-act=cam]'))b.classList.toggle('on',b.dataset.arg===cam.key);
  $('bRoof').classList.toggle('on',!!G.roofOff);$('bRoof').textContent=G.roofOff?'Toits retirés':'Toits en place';
  $('bHideSt').classList.toggle('on',!!G.hideSt);$('bHideSt').textContent=G.hideSt?'Gare masquée':'Masquer la gare';
}

/* ══════════ MOBILE ET PLEIN ÉCRAN : onglets Carte / Pupitre / Journal, mode « dm » (téléphone, tablette étroite) ══════════ */
const MQ=matchMedia('(max-width:900px), (max-height:520px) and (orientation:landscape)');
function setTab(t){
  const b=document.body;if(t===b.dataset.tab&&t!=='carte')t='carte';
  b.dataset.tab=t;for(const x of document.querySelectorAll('#tabs button'))x.classList.toggle('on',x.dataset.arg===t);
}
function layoutVars(){ // hauteurs réelles de l'en-tête et de la barre du plein écran (le tiroir se place dessous en paysage)
  const b=document.body,h=document.querySelector('header'),f=$('fsBar');
  b.style.setProperty('--st',h.offsetHeight+'px');if(f.offsetHeight)b.style.setProperty('--fsh',f.offsetHeight+'px');
}
function setDm(){document.body.classList.toggle('dm',MQ.matches);layoutVars();}
document.body.dataset.tab='carte';setDm();
if(MQ.addEventListener)MQ.addEventListener('change',setDm);else MQ.addListener(setDm);
if(window.ResizeObserver){const ro=new ResizeObserver(layoutVars);ro.observe(document.querySelector('header'));ro.observe($('fsBar'));}
addEventListener('resize',layoutVars);
