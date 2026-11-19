'use strict';
/* ══════════ SAUVEGARDE AUTOMATIQUE (générique, rien de propre à une attraction) ══════════
   Clé localStorage : t2z.save.<site>.<mode> (mode : career | sandbox). Écrite à la fermeture / au changement de page (pagehide,
   visibilitychange, beforeunload, clic sur un lien), à chaque lien, et toutes les 30 s. Restaurée au chargement avant la 1re image.
   Le temps de jeu ne court pas page fermée. Tout accès au stockage est protégé : sans stockage, le jeu se joue normalement.
   Un champ ajouté à G ou à un train est sauvegardé tout seul (copie générique des valeurs simples). */
(function(){
  const VER=1,KEY='t2z.save.'+SITE.id+'.'+MODE;
  const sig=[L.toFixed(1),trains.length,LANES.length,ZONES.map(z=>z.id).join(','),SEATS,SEGS.length,LOOPS.length,BLK.length,NCARS,Math.round(SEGS.reduce((n,s)=>n+s.len,0)),S_HOLD.toFixed(1)].join('|'); // géométrie (circuit, garage, zones, file, arrêt au frein final) : une sauvegarde d'une autre géométrie est ignorée
  const rd=()=>{try{return localStorage.getItem(KEY);}catch(e){return null;}};
  const del=()=>{try{localStorage.removeItem(KEY);return true;}catch(e){return false;}};
  const R=(v,d)=>{const k=Math.pow(10,d);return Math.round(v*k)/k;};
  const flat=(pts,from)=>{const o=[];for(let i=from||0;i<pts.length;i++)o.push(R(pts[i][0],2),R(pts[i][2],2));return o;};
  const simple=v=>v===null||typeof v==='number'||typeof v==='string'||typeof v==='boolean';
  let noSave=false;

  function capture(){
    const g={};for(const k in G){if(['queue','walkers','plat','job'].includes(k))continue;const v=G[k];if(typeof v!=='function')g[k]=JSON.parse(JSON.stringify(v));}
    const q=G.queue.map(v=>v.mode==='q'?[v.ci,R(v.w,1),R(v.pat,1),v.side,R(v.sp,2),R(v.ph,1),v.mv?1:0,R(v.r,3)]
      :[v.ci,R(v.w,1),R(v.pat,1),v.side,R(v.sp,2),R(v.ph,1),1,0,v.i,R(v.x,2),R(v.z,2),flat(v.pts)]);
    const walkers=G.walkers.map(k=>{
      const o={k:k.kind,x:R(k.x,2),z:R(k.z,2),ci:k.ci,sp:R(k.sp,2),ph:R(k.ph,1),p:flat(k.pts,k.i)};
      if(k.done){
        if(k.kind==='wait'){const e=k.pts[k.pts.length-1];const i=G.plat.findIndex((r,j)=>{if(!r||r.on)return false;const p=slotPos(j);return Math.hypot(p[0]-e[0],p[2]-e[2])<.02;});if(i>=0)o.slot=i;else{const j=(G.platR||[]).findIndex((r,j)=>r&&!r.on&&BRES[j]&&Math.hypot(BRES[j][0]-e[0],BRES[j][2]-e[2])<.02);if(j>=0)o.res=j;}}
        else if(k.kind==='board'){const e=k.pts[0];for(const t of trains){const i=t.seats.findIndex((s,j)=>{if(!s||s.on)return false;const p=slotPos(j);return Math.hypot(p[0]-e[0],p[2]-e[2])<.02;});if(i>=0){o.slot=i;o.tr=t.i;break;}}}
      }
      return o;});
    return {v:VER,site:SITE.id,mode:MODE,sig,ts:Date.now(),time:R(G.time,2),g,
      plat:G.plat.map(r=>r?[r.ci,R(r.w,1),r.on?1:0,R(r.ph,1)]:0),
      job:G.job?Object.assign({},G.job,{t:G.job.t?G.job.t.i:-1}):null,
      trains:trains.map(t=>{const o={};for(const k in t){if(['i','name','col','col2','seats'].includes(k))continue;if(simple(t[k]))o[k]=typeof t[k]==='number'?R(t[k],4):t[k];}
        o.seats=t.seats.map(s=>s?[s.ci,R(s.w,1),s.on?1:0]:0);o.rc=t.rc.map(v=>R(v,3));return o;}),
      q,sl:SEGS.map(e=>e.list.map(v=>G.queue.indexOf(v))),walkers,
      loops:LOOPS.map(l=>[l.on?1:0,R(l.t,3)]),gate:R(ENTRY_GATE.t,3),
      cam:{key:cam.key,x:R(cam.x,2),z:R(cam.z,2),s:R(cam.s,3),follow:cam.follow,g:cam.g},syn:synOn};
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
    G.plat=d.plat.map(a=>a?{ci:a[0],w:a[1],on:!!a[2],ph:a[3]}:null);
    d.trains.forEach((o,i)=>{const t=trains[i];Object.assign(t,o);if(!Array.isArray(t.rc)||t.rc.length!==NCARS)t.rc=new Array(NCARS).fill(0);t.seats=o.seats.map(a=>a?{ci:a[0],w:a[1],on:!!a[2]}:null);});
    G.job=d.job?Object.assign({},d.job,{t:d.job.t>=0?trains[d.job.t]:undefined}):null;
    G.queue=d.q.map(a=>{const v={ci:a[0],w:a[1],pat:a[2],side:a[3],sp:a[4],ph:a[5],mv:!!a[6],y:0};
      if(a.length<=8){v.mode='q';v.r=a[7];v.x=0;v.z=0;v.pts=[];v.i=1;}
      else{v.mode='app';v.i=a[8];v.x=a[9];v.z=a[10];v.pts=[];for(let j=0;j<a[11].length;j+=2)v.pts.push([a[11][j],0,a[11][j+1]]);}
      return v;});
    SEGS.forEach((e,k)=>{e.list.length=0;for(const i of d.sl[k]){const v=G.queue[i];v.e=e;e.list.push(v);}});
    for(const v of G.queue)if(v.mode==='q'){pathPos(v.e.P,v.e.C,v.e.len-v.r,_qp,v.side*.36);v.x=_qp.x;v.z=_qp.z;}
    G.walkers=d.walkers.map(o=>{const pts=[[o.x,0,o.z]];for(let j=0;j<o.p.length;j+=2)pts.push([o.p[j],0,o.p[j+1]]);
      const k={kind:o.k,pts,i:1,x:o.x,y:0,z:o.z,ci:o.ci,done:null,sp:o.sp,ph:o.ph};
      if(o.res!=null){const j=o.res;k.done=()=>{const r=(G.platR||[])[j];if(r)r.on=true;};}
      if(o.slot!=null){const s=o.slot;k.done=o.k==='wait'?()=>{const r=G.plat[s];if(r)r.on=true;}:()=>{const q=trains[o.tr].seats[s];if(q)q.on=true;};}
      return k;});
    // visiteurs qui attendaient la fin d'un trajet perdu : jamais bloqués
    const tgt=new Set(d.walkers.filter(o=>o.k==='wait'&&o.slot!=null).map(o=>o.slot));G.plat.forEach((r,i)=>{if(r&&!r.on&&!tgt.has(i))r.on=true;});
    if(!Array.isArray(G.platR))G.platR=[];G.platR=G.platR.slice(0,BAREA?BRES.length:0);const rt=new Set(d.walkers.filter(o=>o.k==='wait'&&o.res!=null).map(o=>o.res));G.platR.forEach((r,j)=>{if(r&&!r.on&&!rt.has(j))r.on=true;}); // réserve de la zone d'attente (issue #24)
    const bt=new Set(d.walkers.filter(o=>o.k==='board'&&o.slot!=null).map(o=>o.tr+':'+o.slot));trains.forEach(t=>t.seats.forEach((s,i)=>{if(s&&!s.on&&!bt.has(t.i+':'+i))s.on=true;}));
    LOOPS.forEach((l,i)=>{l.on=!!d.loops[i][0];l.t=d.loops[i][1];});ENTRY_GATE.t=d.gate;buildQueue();
    resetOps();for(const t of trains)if(t.st==='station'&&t.phase==='check')startCheck(t);
    Object.assign(cam,d.cam);if(cam.follow>=0&&!cam.g)cam.g={s:12};
    if(typeof d.syn==='boolean'&&d.syn!==synOn)toggleSyn();
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
    noSave=true;try{localStorage.removeItem('t2z.save.'+SITE.id+'.'+m);localStorage.setItem('t2z.mode',m);}catch(e){}
    location.href='jeu.html?site='+encodeURIComponent(SITE.id)+'&mode='+m;});
  window.t2zSave={save,capture,KEY};
})();
