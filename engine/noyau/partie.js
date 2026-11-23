'use strict';
/* ══════════ MÉTÉO ET JOURNÉE ══════════ */
function updateWeather(dt){
  const w=G.wx;if(G.sandbox){w.type='clear';w.next=1e6;G.flash=0;return;}
  if(w.type==='clear'){w.next-=dt;
    if(w.next<=0){
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
/* Jeu continu (propriétaire, 17/11 : « supprime la notion de jours qui réinitialise tout ») : aucune fin de journée, rien n'est remis à zéro ;
   l'attraction ne ferme qu'au bouton du joueur. L'horloge tourne sur la plage d'ouverture T_OPEN…T_CLOSE et repart à T_OPEN (affluence continue au raccord,
   engine/queue.js hourF) ; G.played = minutes de jeu cumulées. Salaires : WAGE € par plage (9 h), prélevés en continu (G.wage = fraction due).
   Budget sous OVER € (carrière) : fin de partie à tout moment. */
/* Suivi de l'évacuation (issue #41, générique) : voyant « Évacuation en cours » du pupitre (#lEvac, engine/ui.js) tant que evacOn() ; à la fin, message au journal.
   Évacués arrêtés devant une barrière de file fermée (marcheur 'evac', k.bk = la barrière, engine/queue.js) : message qui nomme la barrière (numéro, tronçon,
   distance à l'entrée le long de la file), une fois, puis rappel toutes les EVAC_REM s de simulation (30 min de jeu) tant qu'elle les retient ; barrière mise en
   évidence sur la carte (b.evHi, engine/render.js) jusqu'à son ouverture. État transitoire, non sauvegardé. */
const EVW={on:false,bars:new Map()},EVAC_REM=60;
function barWhere(b){let c=0;const fk=(e,l)=>(e===l.loop?'boucle':'raccourci')+(l.name?' « '+l.name+' »':'')+', ';
  for(const st of STAGES){const B=st.seg?[st.seg]:[st.fork.r||st.fork.short,st.fork.short,st.fork.loop];
    for(const e of B){const x=e.bx.find(x=>x.b===b);if(x)return (st.fork?fk(e,st.fork):'')+'à '+Math.round(c+x.d)+' m de l\'entrée de la file';}
    c+=B[0].len;}
  return 'à '+Math.round(Math.hypot(b.x-ENTRY0[0],b.z-ENTRY0[1]))+' m de l\'entrée de la file';}
const barName=b=>'barrière n° '+String(b.key).replace(/^b/,'')+' ('+barWhere(b)+')';
function evacTick(dt){const on=evacOn();
  for(const b of BARS)if(b.evHi&&b.open)b.evHi=false; // mise en évidence jusqu'à l'ouverture
  if(!on){if(EVW.on){EVW.on=false;EVW.bars.clear();for(const b of BARS)b.evHi=false;log('Évacuation terminée, la file peut reprendre'+(G.open?'.':' : l\'entrée est fermée, rouvrez-la.'),'good');}return;}
  EVW.on=true;const n=new Map();
  for(const k of G.walkers)if(k.kind==='evac'&&k.bk&&!k.bk.open&&BARS.includes(k.bk))n.set(k.bk.key,(n.get(k.bk.key)||0)+1);
  for(const key of [...EVW.bars.keys()])if(!n.has(key))EVW.bars.delete(key);
  for(const [key,c] of n){const b=BARS.find(b=>b.key===key),r=EVW.bars.get(key);b.evHi=true;
    if(!r){EVW.bars.set(key,{t:EVAC_REM});log('Évacuation bloquée : '+c+' évacué'+(c>1?'s attendent':' attend')+' devant la '+barName(b)+', fermée. Ouvrez-la d\'un clic sur la carte (barrière mise en évidence).','bad');}
    else if((r.t-=dt)<=0){r.t=EVAC_REM;log('Rappel : la '+barName(b)+' est fermée, '+c+' évacué'+(c>1?'s':'')+' bloqué'+(c>1?'s':'')+'. Personne n\'entre dans la file tant que l\'évacuation n\'est pas finie.','warn');}}}
const T_OPEN=600,T_CLOSE=1140,WAGE=350,OVER=-2000;
function step(dt){
  const m=dt*.5;G.time+=m;if(G.time>=T_CLOSE)G.time-=T_CLOSE-T_OPEN;G.played=(G.played||0)+m;
  if(!G.sandbox){G.wage=(G.wage||0)+m*WAGE/(T_CLOSE-T_OPEN);if(G.wage>=1){const n=Math.floor(G.wage);G.wage-=n;pay(n);}}
  if(G.sandbox)appel('bacASable'); // bac à sable : ni usure ni panne (chaque couche remet les siennes à zéro)
  updateWeather(dt);updateVisitors(dt);evacTick(dt);appel('step',dt); // couches : quai, véhicules…
  if(G.job){G.job.rem-=dt;if(G.job.rem<=0)finishJob();}
  if(!G.sandbox&&!G.over&&G.money<OVER){G.over=true;G.open=false;log('Le budget est dans le rouge : fin de partie.','bad');bilan();}
}
/* Bilan cumulé (bouton « Bilan » #bBil, fenêtre #mBil) ; fin de partie : même fenêtre, bouton Recommencer */
function bilan(){
  const s=G.stats,net=s.income-s.costs,h=Math.max(1/60,(G.played||0)/60),rph=s.riders/h,H=(T_CLOSE-T_OPEN)/60,goal=(SITE.goal||400)/H;
  $('bTitle').textContent=G.over?'Fin de partie':'Bilan de l\'exploitation';
  $('bTable').innerHTML=[['Durée d\'exploitation',Math.floor(h)+' h '+String(Math.floor((G.played||0)%60)).padStart(2,'0')],['Passagers transportés',s.riders],['Passagers par heure',Math.round(rph)],...[].concat(...appel('bilan')),['Visiteurs repartis mécontents',s.quits],['Visiteurs refoulés (file pleine)',s.turned],
    ...(G.sandbox?[]:[['Recettes',s.income+' €'],['Dépenses (dont salaires '+Math.round(WAGE/H)+' € par heure)',Math.round(s.costs)+' €'],['dont amendes',s.fines+' €'],
    ['Résultat',(net>=0?'+':'')+Math.round(net)+' €'],['Budget',Math.round(G.money)+' €']]),['Satisfaction',Math.round(G.sat)+' %']]
    .map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  $('bMsg').textContent=G.over?'Le budget est dans le rouge : la direction vous retire les clés de l\'attraction…'
    :(G.played||0)<60?'Moins d\'une heure d\'exploitation : bilan encore partiel.'
    :rph>=goal?((SITE.text&&SITE.text.great)||'Excellente exploitation !'):rph>=goal/2?texte('bilanCorrect','Exploitation correcte.')
    :texte('bilanDifficile','Exploitation difficile. Ouvrez l\'entrée.');
  $('bBtn').textContent=G.over?'Recommencer':'Reprendre';
  $('mBil').classList.remove('hidden');
}
// texte propre au type (extension({textes:{…}})), sinon texte générique
function texte(k,d){for(const e of EXTENSIONS)if(e.textes&&e.textes[k]!=null)return e.textes[k];return d;}

/* ══════════ ACTIONS ET INTERFACE ══════════ */
function act(a,arg){
  if(a==='speed')G.speed=+arg;
  else if(a==='help')$('mHelp').classList.remove('hidden');
  else if(a==='closeHelp'){$('mHelp').classList.add('hidden');sfx.init();}
  else if(a==='mute'){const m=sfx.toggle();$('bMute').classList.toggle('on',!m);$('bMute').title=m?'Son coupé : cliquer pour l\'activer':'Son activé : cliquer pour le couper';}
  else if(a==='cam')setCam(arg);
  else if(a==='fs')setFs(!fsOn);
  else if(a==='fsdesk')document.body.classList.toggle('fsdesk');
  else if(a==='tab')setTab(arg);
  else if(a==='bilan')bilan();
  else if(a==='closeBil'){if(G.over){location.reload();return;}$('mBil').classList.add('hidden');}
  else if(a==='open'){if(!G.open&&G.over)return;G.open=!G.open;
    log(G.open?'Entrée ouverte : les visiteurs entrent dans la file.':'Entrée fermée : plus personne n\'entre. Les '+G.queue.filter(v=>v.mode==='q').length+' visiteurs déjà dans la file continuent d\'embarquer.',G.open?'good':'warn');}
  else if(a==='evac'){const nq=G.queue.length;if(!evacCan())return; // évacuation : file à rebours ; puis chaque couche (places d'attente, véhicule à quai…)
    for(const v of G.queue)walker(backPath(v,true),v.ci,null,rnd(3,3.8),0,'evac');
    clearQueue();let n=nq,nt=0,ou='',suite='';for(const r of appel('evacuer')){n+=r.n||0;nt+=r.nt||0;ou+=r.ou||'';suite+=r.suite||'';}
    G.sat=clamp(G.sat-Math.min(8,(n+nt)*.03),0,100);log('File évacuée : '+n+' visiteurs'+ou+' ressortent par l\'entrée'+(suite||'.'),'warn');}
  else if(a==='roof'){G.roofOff=!G.roofOff;}
  else if(a==='hidest'){G.hideSt=!G.hideSt;} // « Masquer la gare » : bâtiment de gare, toits effaçables et couvertures (tunnels, rochers) masqués, couloirs couverts visibles
  else if(a==='job')startJob(arg);
  else{for(const e of EXTENSIONS)if(e.actions&&typeof e.actions[a]==='function'){e.actions[a](arg);break;}} // actions du type (pupitre…)
  ui();
}
// quelque chose à évacuer (bouton bEvac) : file, marcheurs vers une place d'attente, ou ce que le type déclare
const evacCan=()=>!!(G.queue.length||vrai('aEvacuer')||G.walkers.some(k=>k.kind==='wait'));
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)act(b.dataset.act,b.dataset.arg);});
// patience des visiteurs (G.patL, niveau 0…5) : multiplie la patience tirée à l'arrivée (v.pat) ; le dernier niveau est infini (personne ne quitte la file)
const PAT_M=[.5,1,2,4,8,Infinity],PAT_N=['faible','normale','grande','très grande','extrême','infinie'];
// Aide : plus ouverte au lancement (propriétaire, 2026-11-17), seulement au bouton « ? » ; le son démarre au premier geste du joueur
{const once=()=>{sfx.init();removeEventListener('pointerdown',once);removeEventListener('keydown',once);};addEventListener('pointerdown',once);addEventListener('keydown',once);}
$('patL').addEventListener('input',e=>{G.patL=+e.target.value;$('patV').textContent=PAT_N[G.patL];});
$('crowd').addEventListener('input',e=>{G.crowd=e.target.value/100;const c=+e.target.value;
  $('crowdV').textContent=c+' % — '+(c===0?'parc vide':c<=50?'faible':c<=120?'normale':c<=200?'forte':'saturée');});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();act('speed',G.speed?0:1);}});
