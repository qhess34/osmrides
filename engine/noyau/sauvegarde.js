'use strict';
/* ══════════ SAUVEGARDE AUTOMATIQUE (générique, rien de propre à une attraction) ══════════
   Clé localStorage : t2z.save.<type>.<lieu>.<el>.<mode> (mode : career | sandbox). Écrite à la fermeture / au changement de page (pagehide,
   visibilitychange, beforeunload, clic sur un lien), à chaque lien, et toutes les 30 s. Restaurée au chargement avant la 1re image.
   Le temps de jeu ne court pas page fermée. Tout accès au stockage est protégé : sans stockage, le jeu se joue normalement.
   Un champ ajouté à G est sauvegardé tout seul (copie générique) ; chaque couche ajoute le sien (extension({sauvegarde:{horsEtat, signature, capture, marcheur,
   finMarcheur, restaure, cible}})). Format et clé inchangés depuis 0.0.1. */
(function(){
  // Les clés localStorage t2z.* et window.t2zSave gardent volontairement l'ancien nom du jeu (T2Z) : sauvegardes des joueurs.
  const VER=1,KEY=cleSauvegarde(SITE.type,SITE.lieu,SITE.id,MODE);
  const SV=EXTENSIONS.filter(e=>e.sauvegarde).map(e=>e.sauvegarde),HORS=['queue','walkers','job'].concat(...SV.map(o=>o.horsEtat||[])); // sauvegarde des couches ; champs de G copiés à part
  // géométrie (file, et ce que la couche y ajoute : circuit, garage, zones…) : une sauvegarde d'une autre géométrie est ignorée ; ordre des champs fixé par la couche (sauvegardes 0.0.1)
  const sigN={segs:SEGS.length,loops:LOOPS.length,long:Math.round(SEGS.reduce((n,s)=>n+s.len,0))},sig=fournitSv('signature',[sigN.segs,sigN.loops,sigN.long],sigN).join('|');
  function fournitSv(k,def,...a){for(const o of SV)if(typeof o[k]==='function')return o[k](...a);return def;}
  const rd=()=>{try{return localStorage.getItem(KEY);}catch(e){return null;}};
  const del=()=>{try{localStorage.removeItem(KEY);return true;}catch(e){return false;}};
  const R=(v,d)=>{const k=Math.pow(10,d);return Math.round(v*k)/k;};
  const flat=(pts,from)=>{const o=[];for(let i=from||0;i<pts.length;i++)o.push(R(pts[i][0],2),R(pts[i][2],2));return o;};
  const simple=v=>v===null||typeof v==='number'||typeof v==='string'||typeof v==='boolean';
  let noSave=false;

  function capture(){
    const g={};for(const k in G){if(HORS.includes(k))continue;const v=G[k];if(typeof v!=='function')g[k]=JSON.parse(JSON.stringify(v));}
    const q=G.queue.map(v=>v.mode==='q'?[v.ci,R(v.w,1),R(v.pat,1),v.side,R(v.sp,2),R(v.ph,1),v.mv?1:0,R(v.r,3)]
      :[v.ci,R(v.w,1),R(v.pat,1),v.side,R(v.sp,2),R(v.ph,1),1,0,v.i,R(v.x,2),R(v.z,2),flat(v.pts)]);
    const walkers=G.walkers.map(k=>{
      const o={k:k.kind,x:R(k.x,2),z:R(k.z,2),ci:k.ci,sp:R(k.sp,2),ph:R(k.ph,1),p:flat(k.pts,k.i)};
      if(k.done)for(const v of SV)if(v.marcheur)v.marcheur(k,o); // marcheur qui gagne une place (couche du type)
      return o;});
    const d={v:VER,site:SITE.id,mode:MODE,sig,ts:Date.now(),time:R(G.time,2),g,
      job:G.job?Object.assign({},G.job,{t:G.job.t?G.job.t.i:-1}):null,
      q,sl:SEGS.map(e=>e.list.map(v=>G.queue.indexOf(v))),walkers,
      loops:LOOPS.map(l=>[l.on?1:0,R(l.t,3)]),bars:BARS.map(b=>[b.key,b.open?1:0]),
      cam:{key:cam.key,x:R(cam.x,2),z:R(cam.z,2),s:R(cam.s,3),follow:cam.follow,g:cam.g}};
    for(const v of SV)if(v.capture)v.capture(d,R); // places d'attente, véhicules, panneaux du type
    return d;
  }
  function save(){
    if(noSave)return;
    try{
      if(G.over){del();return;}
      if(!G.played&&G.time===600&&!G.open&&G.stats.riders===0&&!G.queue.length&&!rd())return; // partie intacte : rien à garder
      localStorage.setItem(KEY,JSON.stringify(capture()));
    }catch(e){}
  }
  function restore(d){
    Object.assign(G,d.g);delete G.day;delete G.dayDone;delete G.closedMsg; // anciennes sauvegardes (journées) : champs ignorés, horloge ramenée dans la plage d'ouverture
    if(!(G.time>=T_OPEN&&G.time<T_CLOSE))G.time=T_OPEN;if(!(G.played>=0))G.played=0;if(!(G.wage>=0))G.wage=0;
    for(const v of SV)if(v.restaure)v.restaure(d); // places d'attente, véhicules… (couche du type)
    G.job=d.job?Object.assign({},d.job,{t:d.job.t>=0?fournitSv('cible',undefined,d.job.t):undefined}):null;
    G.queue=d.q.map(a=>{const v={ci:a[0],w:a[1],pat:a[2],side:a[3],sp:a[4],ph:a[5],mv:!!a[6],y:0};
      if(a.length<=8){v.mode='q';v.r=a[7];v.x=0;v.z=0;v.pts=[];v.i=1;}
      else{v.mode='app';v.i=a[8];v.x=a[9];v.z=a[10];v.pts=[];for(let j=0;j<a[11].length;j+=2)v.pts.push([a[11][j],0,a[11][j+1]]);}
      return v;});
    SEGS.forEach((e,k)=>{e.list.length=0;for(const i of d.sl[k]){const v=G.queue[i];v.e=e;e.list.push(v);}});
    for(const v of G.queue)if(v.mode==='q'){qPlace(v);}
    G.walkers=d.walkers.map(o=>{const pts=[[o.x,0,o.z]];for(let j=0;j<o.p.length;j+=2)pts.push([o.p[j],0,o.p[j+1]]);
      const k={kind:o.k,pts,i:1,x:o.x,y:0,z:o.z,ci:o.ci,done:null,sp:o.sp,ph:o.ph};
      for(const v of SV)if(v.finMarcheur){const f=v.finMarcheur(o);if(f)k.done=f;}
      return k;});
    for(const [k,o] of d.bars||[]){const b=BARS.find(b=>b.key===k);if(b){b.open=!!o;b.t=o?0:1;}}qRoute(); // barrières indépendantes (issue #37) ; chemin des fourches recalculé
    Object.assign(cam,d.cam);if(cam.follow>=0&&!cam.g)cam.g={s:12};
    $('crowd').value=Math.round(G.crowd*100);$('crowd').dispatchEvent(new Event('input'));if(!(G.patL>=0&&G.patL<=5))G.patL=1;$('patL').value=G.patL;$('patL').dispatchEvent(new Event('input'));
    $('mHelp').classList.add('hidden');
    $('mBil').classList.add('hidden'); // ancienne fenêtre de fin de jour (day_modal) ignorée
    if(!noSave){const once=()=>{sfx.init();removeEventListener('pointerdown',once);removeEventListener('keydown',once);};addEventListener('pointerdown',once);addEventListener('keydown',once);}
  }
  function load(){
    const raw=rd();if(!raw)return;
    let d;try{d=JSON.parse(raw);}catch(e){d=null;}
    if(!d||d.v!==VER||d.site!==SITE.id||d.mode!==MODE||d.sig!==sig){
      console.log('Sauvegarde ignorée (version ou géométrie de l\'attraction différente) : '+KEY);del();return;}
    try{restore(d);ui();render(0);log('Partie reprise : '+fmtTime(G.time)+'.','good');}
    catch(e){console.log('Sauvegarde illisible, effacée : '+e);del();location.reload();}
  }
  try{localStorage.setItem('t2z.mode',MODE);}catch(e){}
  load();
  addEventListener('pagehide',save);addEventListener('beforeunload',save);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
  document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(a&&!/^#/.test(a.getAttribute('href')))save();},true);
  setInterval(save,30000);

  /* Nouvelle partie : choix du mode (la fenêtre vaut confirmation), efface la sauvegarde du mode choisi puis redémarre */
  const show=on=>$('mNew').classList.toggle('hidden',!on);
  $('bNew').addEventListener('click',()=>{$('mHelp').classList.add('hidden');show(true);});
  $('bNewCancel').addEventListener('click',()=>{show(false);$('mHelp').classList.remove('hidden');});
  for(const [id,m] of [['bNewCareer','career'],['bNewSandbox','sandbox']])$(id).addEventListener('click',()=>{
    noSave=true;try{localStorage.removeItem(cleSauvegarde(SITE.type,SITE.lieu,SITE.id,m));localStorage.setItem('t2z.mode',m);}catch(e){}
    location.href='jeu.html?type='+SITE.type+'&lieu='+SITE.lieu+'&el='+encodeURIComponent(SITE.id)+'&mode='+m;});
  window.t2zSave={save,capture,KEY};
})();
