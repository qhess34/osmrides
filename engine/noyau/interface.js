'use strict';
/* ══════════ INTERFACE : en-tête, journal, boutons communs (le pupitre propre au type : appel('ui')) ══════════ */
function ui(){
  $('hTime').textContent=fmtTime(G.time);
  $('hWx').textContent={clear:'Beau temps',rain:'Pluie',warn:'Orage en approche',storm:'ORAGE'}[G.wx.type];
  $('hMoneyBox').style.display=G.sandbox?'none':'';$('hMode').style.display=G.sandbox?'':'none';$('hMoney').textContent=Math.round(G.money).toLocaleString('fr-FR')+' €';
  $('hSat').textContent=Math.round(G.sat)+' %';
  $('hQueue').textContent=G.queue.length+'/'+Math.floor(QLEN/SP);
  $('hRiders').textContent=G.stats.riders;
  for(const b of document.querySelectorAll('[data-act=speed]'))b.classList.toggle('on',G.speed===+b.dataset.arg);
  $('bOpen').classList.toggle('lit',G.open);$('bOpen').disabled=!G.open&&G.over;
  $('bEvac').disabled=!evacCan();
  {const ev=evacOn(),bk=[...EVW.bars.keys()];$('lEvac').className='lamp'+(!ev?' off':bk.length?' err':' occ');$('lEvacT').textContent=bk.length?'Évacuation bloquée — barrière n° '+bk.map(k=>k.replace(/^b/,'')).join(', '):'Évacuation en cours';} // issue #41 : voyant d'évacuation (ambre = en cours, rouge clignotant = bloquée par une barrière fermée)
  $('tech').textContent=G.job?G.job.label:'Équipe technique disponible';
  $('techBar').style.width=G.job?(100*(1-G.job.rem/G.job.dur))+'%':'0%';
  $('techTxt').textContent=G.job?Math.ceil(G.job.rem*.5)+' min restantes':'';
  if(document.body.classList.contains('fs')){ // barre du plein écran : heure, file, quai, dernier message du journal
    $('fsHud').textContent=fmtTime(G.time)+' · File '+G.queue.length+appel('hud').join('')+' · '+Math.round(G.money).toLocaleString('fr-FR')+' €';
    const m=$('log').firstElementChild;$('fsMsg').textContent=m&&m.lastChild?m.firstChild.textContent+' '+m.lastChild.textContent:'';$('fsMsg').className=m?m.className:'';
    $('bDesk').classList.toggle('on',document.body.classList.contains('fsdesk'));}
  for(const b of document.querySelectorAll('#cams button[data-act=cam]'))b.classList.toggle('on',b.dataset.arg===cam.key);
  $('bRoof').classList.toggle('on',!!G.roofOff);$('bRoof').textContent=G.roofOff?'Toits retirés':'Toits en place';
  $('bHideSt').classList.toggle('on',!!G.hideSt);$('bHideSt').textContent=G.hideSt?'Gare masquée':'Masquer la gare';
  appel('ui'); // pupitre et voyants du type
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
