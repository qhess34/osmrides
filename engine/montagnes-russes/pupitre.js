'use strict';
/* ══════════ PUPITRE PAR ZONES, CARTES DES TRAINS, VOYANTS ══════════ */
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
$('trains').innerHTML=trains.map(t=>`<div class="card">
  <div class="name"><span class="dot" style="background:${t.col}"></span>${t.name}</div>
  <div class="st" id="tSt${t.i}"></div>
  <div class="bar"><i id="tW${t.i}"></i><span id="tW${t.i}T"></span></div>
  <div class="row">
    <button id="tR${t.i}" data-act="revise" data-arg="${t.i}">Réviser (600 €)</button>
    <button id="tA${t.i}" data-act="rearm" data-arg="${t.i}">Réarmer lapbars</button>
  </div></div>`).join('');
/* Pupitre par zones : sections Gare, Lift, Zones de freinage, Garage (ids : AGENTS.md) */
{const zb=(z,c,cls,txt,ti)=>`<button class="pb sq sm ${cls}" id="z${z}_${c}" data-act="zone" data-arg="${z}:${c}" title="${ti}">${txt}</button>`,E='<span></span>';
  const head=`<div class="zrow"><span></span><span class="plate">Mode</span><span class="plate">Freins</span><span class="plate">Avant</span><span class="plate">Arrière</span><span class="plate">Arrêt</span></div>`;
  const row=Z=>{const z=Z.id,nm=`<div class="plate zn"><span class="zl" id="lz${z}"></span>${Z.name}</div>`;
    if(z==='Lift')return `<div class="zrow">${nm}${E}${zb(z,'on','green','MAR','Lift : marche')}${zb(z,'off','amber','ARR','Lift : arrêt (la chaîne s\'arrête, le train sur le lift y reste)')}${E}${E}</div>`;
    return `<div class="zrow">${nm}`+(Z.auto?zb(z,'m','blue','AUTO','Mode de la zone : AUTO (cantonnement automatique) ou MANU (freins et moteurs au pupitre)'):E)
      +(Z.brake?zb(z,'k','amber','F','Freins de la zone : serrer / relâcher (relâchement refusé si la section suivante est occupée)'):z==='St'?'<span class="plate" id="zSt_fr" title="Freins de gare : serrés automatiquement tant qu\'un train est à quai, relâchés par la seule séquence Départ (portillons fermés, lapbars validés)">AUTO</span>':E)
      +(Z.drive?zb(z,'f','green','AV','Moteurs de la zone : avancer le train qui s\'y trouve')+(Z.drive==='fwd'?E:zb(z,'b','green','AR','Moteurs de la zone : reculer le train qui s\'y trouve'))+zb(z,'x','amber','STOP','Moteurs de la zone : arrêt'):E+E+E)+'</div>';};
  const lrow=Z=>`<div class="zrow"><div class="plate zn"><span class="zl" id="lz${Z.id}"></span>${Z.name}</div>${E}`+zb(Z.id,'k','amber','F','Freins forcés de la voie : serrer (arrêt immédiat du train qui entre ou sort, Dispatch refusé) / relâcher (reprise au Dispatch)')+zb(Z.id,'d','green disp','DISPATCH','Dispatch : '+DEVN.toLowerCase()+' en place sur cette voie, fait entrer le train prêt (zone porteuse) ou sortir le train de tête vers '+DEVL+' ; le sens est choisi selon la position de l\'appareil')+'</div>';
  const sec=(t,k,x,h=1)=>`<div class="dsec"><span>${t}</span>${x||''}</div>`+(h?head:'')+ZONES.filter(Z=>Z.sec===k).map(row).join('');
  $('deskZones').innerHTML=sec('Gare','st')+sec('Lift','lift','',0)
    +sec('Zones de freinage','brk','<button class="pb sq sm blue" id="zAuto" data-act="zauto" title="Toutes les zones de freinage en AUTO">TOUT AUTO</button>')
    +`<div class="dsec"><span>Garage</span></div><div class="deskrow"><div class="ctl" style="flex:2"><div class="pair" id="yPos"></div><div class="plate"><span id="yName"></span><br><span id="yState"></span></div></div></div>`
    +(LANES.length?'<div class="zrow"><span></span><span></span><span class="plate">Freins</span><span class="plate" style="grid-column:4/-1">Voie</span></div>':'')+ZONES.filter(Z=>Z.sec==='gar').map(lrow).join('');}
$('yPos').innerHTML=POS_ORDER.map(p=>`<button class="pb sq sm blue" id="y${posId(p)}" data-act="pos" data-arg="${p}" title="${DEVN} : ${p===PG?'position G, rail de garage sur le circuit':p?'position voie '+p+' ('+LANES[p-1].name+')':'position P, circuit'}">${posId(p)}</button>`).join('');
$('yName').textContent=DEVN;
if(RA)$('yPos').parentElement.insertAdjacentHTML('beforebegin','<div class="ctl"><div class="pair">'+[0,1].map(p=>`<button class="pb sq sm blue" id="yA${p}" data-act="ra" data-arg="${p}" title="${RAN} (rail du circuit) : ${p?'retiré vers l\'extérieur':'sur le circuit'}">${p?'E':'C'}</button>`).join('')+'</div><div class="plate">'+RAS+'<br><span id="yAState"></span></div></div>');
$('trackName').textContent=SITE.trackName||'Voie';$('helpGarage').innerHTML=(SITE.helpGarage||'')+(SITE.helpGarage&&LANES.length?' Le bouton F de chaque voie force ses freins : serrés, ils arrêtent aussitôt le train qui entre ou sort et Dispatch est refusé ; relâchés, la reprise se fait au Dispatch.':''); // phrase commune (issue #11)

const inSynXY=(x,y)=>{const b=SYN.box;if(!synOn||!b)return false;return x>=b[0]&&x<=b[0]+b[2]&&y>=b[1]&&y<=b[1]+b[3];}; // point de l'écran sur le synoptique
extension({nom:'montagnes-russes',
  ui(){ // pupitre, voyants, trains (engine/noyau/interface.js ui)
  const active=trains.filter(t=>t.st!=='garage').length;
  $('hWait').textContent=active?Math.round((G.queue.length+(G.platR||[]).filter(r=>r).length)/(SEATS/(SITE.lap||150)*active)*.5)+' min':'—';
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
    :active===0?'Aucun train en service : sortez un train du garage.':G.estop?'ARRÊT D\'URGENCE enclenché.':trains.some(o=>o.st==='station'&&o.phase==='check')?'Vérification des lapbars par les opérateurs : '+OPS.filter(o=>o.ok).length+'/2 validé.':G.resOpen&&trains.some(o=>o.st==='station')?'Sécurités ouvertes : fermez les portillons puis verrouillez-les pour le départ.':G.bypass?'BY-PASS lapbars actif : départ sans vérification.':zK('Fin')?'Frein final serré (MANU) : trains retenus avant la gare.':G.liftOff?'Lift à l\'arrêt (commande du pupitre).':G.auto&&G.gatesOpen&&trains.some(o=>o.st==='station'&&o.depReq)?'Train prêt : fermez les portillons.':devOff()&&!(TRAV&&inLine())?(devMoving()?DEVN+' en mouvement vers '+posName(G.dev.to)+'.':DEVN+' sur '+posName(G.dev.pos)+' : '+(TRAV?'rail du circuit hors ligne, trains retenus avant le pont.':YZ==='St'?'départs bloqués.':YZ==='Fin'?'entrée en gare bloquée.':'trains retenus '+(HOLD_Z[0]==='B'?'au ':'sur ')+zArt(HOLD_Z).replace(/^le /,'')+'.')):!G.open?(G.queue.length||G.plat.some(r=>r)?'Entrée fermée — '+(G.queue.filter(v=>v.mode==='q').length+G.plat.filter(r=>r).length)+' visiteurs restent à embarquer.':'Entrée fermée — file vide.'):(G.auto?'Mode auto':'Mode manuel')+' — exploitation normale.';
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
    if(Z.drive){$('z'+z+'_f').classList.toggle('lit',ts.some(t=>t.st==='garage'?t.mv>0:t.entering||t.toPre||t.fdrive||t.bgo||(t.st==='station'&&t.depReq))||(z===CARR&&trains.some(t=>t.st==='garage'&&t.mv>0)));const bb=$('z'+z+'_b');if(bb)bb.classList.toggle('lit',ts.some(t=>t.mv<0)); // drive:'fwd' (freins de bloc) : pas de bouton AR
      for(const c of 'fbx'){const e=$('z'+z+'_'+c);if(e)e.disabled=!man;}}}
  $('zAuto').disabled=!ZONES.some(Z=>Z.auto&&G.zm[Z.id]);
  POS_ORDER.forEach(p=>{const b=$('y'+posId(p));b.classList.toggle('lit',!devMoving()&&G.dev.pos===p);b.classList.toggle('mv',devMoving()&&G.dev.to===p);});
  if(RA){[0,1].forEach(p=>{const b=$('yA'+p);b.classList.toggle('lit',!raMoving()&&G.ra.pos===p);b.classList.toggle('mv',raMoving()&&G.ra.to===p);});
    $('yAState').textContent=raMoving()?'En mouvement':(G.ra.pos?'Retiré':'Sur le circuit')+(raLock()?' — verrouillé':'');}
  {const o=devLock();$('yState').textContent=devMoving()?'En mouvement vers '+posId(G.dev.to):'En place sur '+posId(G.dev.pos)+(o?' — verrouillé':'');}
  bar('wChain',G.wear.chain);bar('wTrack',G.wear.track);bar('wBrake',G.wear.brake);
  for(const [id,k] of [['bLiftFix','liftFix'],['bChainRev','chainRev'],['bTrackRev','trackRev'],['bBrakeFix','brakeFix'],['bBrakeRev','brakeRev']])
    $(id).disabled=!!G.job||!JOBS[k].ok();
  },
  hud:()=>' · Quai '+G.plat.filter(r=>r).length+'/'+SEATS, // barre du plein écran
  boutonsCamera:()=>trains.map(t=>`<button data-act="cam" data-arg="suivi${t.i}">Suivre T${t.i+1}</button>`).join('')
    +'<button data-act="syn" id="bSyn" title="Afficher ou masquer le synoptique du circuit">Synoptique</button>',
  suivi(i){carFrame(trains[i],0,_cf);return _cf.p;}, // caméra « Suivre T<i> »
  surEcran:(x,y)=>inSynXY(x,y),
  clicEcran(x,y){if(!inSynXY(x,y))return;const h=SYN.hits.find(h=>Math.hypot(h.x-x,h.y-y)<=h.r);if(h)setCam('suivi'+h.i);}, // clic sur un train du synoptique : caméra qui le suit
  dessinEcran(){drawSyn();},
  sons(){const w=G.wx.type; // grondement des trains, vent du train suivi, chaîne du lift (sfx.update)
  let vmax=0,chain=false;
  for(const t of trains)if(t.st==='run'){const z=zoneOf(t.s);if(z==='lift'&&t.v>.05&&t.s<S_LIFT1&&!chain){frameAt(t.s-TLEN/2,_cf);chain={v:t.v,x:_cf.p.x,z:_cf.p.z};}if(z==='course'||z==='brake')vmax=Math.max(vmax,t.v);}
  const f=cam.follow>=0?trains[cam.follow]:null;
    return {rumble:Math.min(.5,vmax/24*(f?.45:.28)),wind:f&&f.st==='run'?Math.min(.18,f.v*f.v/3200):0,lift:chain||null};}});
