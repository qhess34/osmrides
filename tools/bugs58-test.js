// Tests des bugs 1 et 2 de l'issue #58 (moteur 0.7.1) : node tools/bugs58-test.js [zeus hourra oziris goudurix]
// (NODE_PATH=$(npm root -g) pour Playwright ; JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt). Une attraction après l'autre.
//  1. reprise de partie : train à quai (prêt au départ), sauvegarde dont s est arrondi vers le bas (pire cas de la capture à 1e-4), rechargement ; le train repris est
//     exactement à S_ST, part, reste sur le circuit (il ne « arrive » pas aussitôt en débarquement avec ses passagers), puis l'embarquement suivant se fait normalement.
//  2. barrière de file fermée dans une branche de fourche, visiteurs déjà entrés en amont d'elle : ils repartent à rebours et reprennent l'autre branche (qRoute) ;
//     jamais de saut, jamais l'un sur l'autre (QPW), jamais au travers d'une barrière fermée, aucun immobile devant la barrière à la fin.
//  Bug 3 (orage / arrêt d'urgence) : pas de test, décision du propriétaire requise (voir le rapport de 0.7.1).
const { chromium } = require('playwright');
const path = require('path');
const LIB = path.resolve(__dirname, '..'), ROOT = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const MO = '&moteur=' + path.relative(ROOT, path.join(LIB, 'engine')) + '/';
const sites = process.argv.slice(2).filter(a => !a.startsWith('-')); if (!sites.length) sites.push('zeus', 'hourra', 'oziris', 'goudurix');
const URL = s => `file://${ROOT}/jeu.html?type=parc&lieu=asterix&el=${s}${MO}&mode=career`;
let fails = 0; const out = [];
const ok = (name, c, info) => { if (!c) { fails++; out.push('FAIL ' + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); } else out.push('ok   ' + name); return c; };

// Fait tourner le jeu comme le joueur (sécurités et portillons au bouton) ; stop() : condition d'arrêt évaluée à chaque pas. Texte évalué dans la page.
const DRIVE = `(n,stop)=>{act('speed',0);G.wx.next=1e6;if(!G.open)act('open');let i=0;
  while(i++<n){const st=trains.find(t=>t.st==='station');
    if(st&&!G.resOpen&&!st.rcT&&((st.phase==='unload'&&count(st))||(st.phase==='board'&&!st.hs&&!st.depReq&&G.plat.some(r=>r))))act('res');
    if(G.gatesOpen&&trains.some(t=>t.st==='station'&&t.depReq))act('gates');
    else if(!G.gatesOpen&&trains.some(t=>t.st==='station'&&t.phase==='board'&&!t.hs&&!t.depReq)&&G.plat.some(r=>r))act('gates');
    else if(st&&st.phase==='board'&&(G.resOpen||st.rcT)&&!G.gatesOpen&&G.gate<.05&&(st.depReq||st.hs))act('res');
    if(G.liftBroken)act('job','liftFix');if(G.brakeFault)act('job','brakeFix');
    trains.forEach(t=>{if(t.fault==='lapbars')act('rearm',t.i);});
    step(.025);if(stop&&stop())break;}
  return i;}`;
const load = async (ctx, url, errors) => {
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(url); await page.waitForFunction(() => window.G && window.t2zSave); return page;
};

async function reprise(browser, id, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await load(ctx, URL(id), errors);
  await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('t2z.save.')) localStorage.removeItem(k); } catch (e) { } });
  await page.reload(); await page.waitForFunction(() => window.G && window.t2zSave); await page.evaluate(() => act('closeHelp'));
  // jusqu'au train chargé, vérifié par les opérateurs (prêt au départ, à quai), puis sauvegarde dont s est arrondi vers le bas
  const r = await page.evaluate(`(()=>{const D=${DRIVE};D(60000,()=>{const t=trains.find(t=>t.st==='station');return t&&t.phase==='ready'&&count(t)>0;});
    const t=trains.find(t=>t.st==='station'&&t.phase==='ready'&&count(t)>0);if(!t)return null;
    t2zSave.save();const d=JSON.parse(localStorage.getItem(t2zSave.KEY));d.trains[t.i].s=S_ST-4e-5;
    return {i:t.i,n:count(t),key:t2zSave.KEY,json:JSON.stringify(d)};})()`);
  if (!ok(id + ' reprise : train prêt au départ atteint', !!r, r)) { await ctx.close(); return; }
  await page.close(); // la fermeture enregistre l'état réel ; la sauvegarde modifiée est posée ensuite, avant le chargement du jeu
  page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.addInitScript(([k, j]) => { try { localStorage.setItem(k, j); } catch (e) { } }, [r.key, r.json]);
  await page.goto(URL(id)); await page.waitForFunction(() => window.G && window.t2zSave);
  const a = await page.evaluate(`(()=>{const t=trains[${r.i}];return {st:t.st,phase:t.phase,s:t.s,SST:S_ST,n:count(t)};})()`);
  ok(id + ' reprise : train à quai exactement à S_ST', a.st === 'station' && a.s === a.SST && a.n === r.n, a);
  // départ : le train quitte la gare et reste sur le circuit (avant : retour immédiat en débarquement, passagers à bord)
  const b = await page.evaluate(`(()=>{const D=${DRIVE};const t=trains[${r.i}],d0=G.stats.disp;D(4000,()=>t.st!=='station');const left=t.st==='run';D(80);
    return {left,st:t.st,phase:t.phase,n:count(t),disp:G.stats.disp-d0,s:t.s};})()`);
  ok(id + ' reprise : le train repris part et reste sur le circuit', b.left && b.st === 'run' && b.phase !== 'unload' && b.disp === 1, b);
  // le train suivant (ou le même, après son tour) embarque normalement : places prises, portillons, départ
  const c = await page.evaluate(`(()=>{const D=${DRIVE};const r0=G.stats.riders;let boarded=0,seen=false;
    D(90000,()=>{const t=trains.find(t=>t.st==='station');if(t&&t.phase==='board'&&G.gate>.9&&count(t)>0)seen=true;return G.stats.riders-r0>=SEATS&&seen;});
    return {riders:G.stats.riders-r0,seen,SEATS};})()`);
  ok(id + ' reprise : l\'embarquement suivant se fait (passagers transportés)', c.seen && c.riders >= c.SEATS, c);
  await ctx.close();
}

// Barrières de file : pour chaque barrière placée sur une branche de fourche, visiteurs en amont, barrière fermée
async function barrieres(browser, id, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await load(ctx, URL(id), errors); await page.evaluate(() => act('closeHelp'));
  const cases = await page.evaluate(() => { const o = []; LOOPS.forEach((l, fi) => [['short', l.short], ['loop', l.loop]].forEach(([nm, e]) => e.bx.forEach(x => o.push({ fi, nm, key: x.b.key, d: +x.d.toFixed(2) })))); return o; });
  ok(id + ' barrières : au moins une barrière sur une branche de fourche', cases.length > 0, cases.length);
  for (const c of cases) {
    const r = await page.evaluate(`(()=>{
      const l=LOOPS[${c.fi}],e=l['${c.nm}'],sib=e===l.loop?l.short:l.loop,b=BARS.find(b=>b.key==='${c.key}'),bi=BARS.indexOf(b),d=${c.d};
      G.open=false;clearQueue();G.walkers.length=0;for(const g of BARS)g.open=true;qRoute();
      // visiteurs déjà dans la branche, en amont de la barrière (au plus 5, écart SP, le premier au début de la branche)
      const n=Math.max(1,Math.min(5,Math.floor(Math.max(0,d-.3)/SP)+1)),mine=[];
      for(let i=n-1;i>=0;i--){const v={ci:i,w:0,pat:1e9,side:0,jt:0,sp:3.2,ph:0,mv:false,y:0,mode:'q',e,r:e.len-i*SP,x:0,z:0,i:1,pts:[]};qPlace(v);v.rk=0;G.queue.push(v);e.list.push(v);mine.push(v);}
      toggleBar(bi); // barrière fermée : la branche est bloquée, l'autre est ouverte (qRoute : autre chemin)
      const bad=[],prev=new Map(mine.map(v=>[v,[v.x,v.z]]));let jump=0,minD=1e9,cross=0,still=0,maxStill=0,STILL=new Map(mine.map(v=>[v,0]));
      const route=l.r===sib;
      for(let k=0;k<2400;k++){step(.025);
        for(const v of mine){const p=prev.get(v);const j=Math.hypot(v.x-p[0],v.z-p[1]);if(j>jump)jump=j;
          if(barHit(p[0],p[1],v.x,v.z))cross++;prev.set(v,[v.x,v.z]);
          const up=v.e===e&&e.len-v.r<=d+1e-6;if(up&&!v.mv)STILL.set(v,STILL.get(v)+.025);else STILL.set(v,0);maxStill=Math.max(maxStill,STILL.get(v));}
        const Q=mine.filter(v=>v.e===e||v.e===sib);for(let a=0;a<Q.length;a++)for(let q=a+1;q<Q.length;q++){const dd=Math.hypot(Q[a].x-Q[q].x,Q[a].z-Q[q].z);if(dd<minD)minD=dd;}}
      const left=mine.filter(v=>v.e===e&&e.len-v.r<=d+1e-6).length;
      return {n,route,left,jump:+jump.toFixed(3),cross,minD:+minD.toFixed(2),maxStill:+maxStill.toFixed(1),QPW,inSib:mine.filter(v=>v.e===sib).length,beyond:mine.filter(v=>v.e!==e&&v.e!==sib).length};})()`);
    const tag = `${id} fourche ${c.fi} ${c.nm} ${c.key} (d=${c.d} m)`;
    ok(tag + ' : la barrière fermée fait suivre l\'autre branche', r.route, r);
    ok(tag + ' : plus aucun visiteur en amont de la barrière fermée', r.left === 0, r);
    ok(tag + ' : aucun immobile devant la barrière au-delà de 15 s', r.maxStill <= 15, r);
    ok(tag + ' : aucun saut (marche continue)', r.jump < .3, r);
    ok(tag + ' : aucune barrière fermée franchie', r.cross === 0, r);
    ok(tag + ' : jamais l\'un sur l\'autre (QPW)', r.minD >= r.QPW - .02, r);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch(), errors = [];
  for (const id of sites) {
    out.push('--- ' + id);
    await reprise(browser, id, errors);
    await barrieres(browser, id, errors);
  }
  ok('aucune erreur de page', !errors.length, errors.slice(0, 3));
  await browser.close();
  console.log(out.join('\n'));
  console.log(fails ? 'FAIL (' + fails + ')' : 'PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
