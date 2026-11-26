// Test de l'issue #59 (moteur 0.7.3) : node tools/bugs59-test.js [zeus hourra oziris goudurix]
// (NODE_PATH=$(npm root -g) pour Playwright ; JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt). Une attraction après l'autre.
// Évacuation avec une barrière de l'éditeur (GAME.barriers) FERMÉE, file remplie de part et d'autre : aucun évacué ne franchit un vantail fermé pendant toute
// l'évacuation (position avant/après le vantail sur le chemin), l'alerte « évacuation bloquée » reste tant que la barrière est fermée, rien n'est sauté ;
// ouverte, les évacués repartent et l'évacuation se termine. Une barrière à la fois (les autres ouvertes), puis toutes fermées.
const { chromium } = require('playwright');
const path = require('path');
const LIB = path.resolve(__dirname, '..'), ROOT = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const MO = '&moteur=' + path.relative(ROOT, path.join(LIB, 'engine')) + '/';
const sites = process.argv.slice(2).filter(a => !a.startsWith('-')); if (!sites.length) sites.push('zeus', 'hourra', 'oziris', 'goudurix');
const URL = s => `file://${ROOT}/jeu.html?type=parc&lieu=asterix&el=${s}${MO}&mode=career`;
const REP = +process.env.REP || 3; let fails = 0; const out = [];
const ok = (name, c, info) => { if (!c) { fails++; out.push('FAIL ' + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); } else out.push('ok   ' + name); return c; };

async function evacuation(browser, id, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(URL(id)); await page.waitForFunction(() => window.G && window.t2zSave); await page.evaluate(() => act('closeHelp'));
  const nb = await page.evaluate(() => BARS.length);
  ok(id + ' évacuation : au moins une barrière de l\'éditeur', nb > 0, nb);
  const cases = []; for (let i = 0; i < nb; i++) for (let n = 0; n < REP; n++) cases.push(i); if (nb > 1) cases.push(-1); // -1 : toutes fermées
  for (const c of cases) {
    const r = await page.evaluate(`(()=>{
      const only=${c};act('speed',0);G.wx.next=1e6;G.wx.type='clear';if(!G.open)act('open');G.crowd=2;
      const run=(n,f)=>{for(let i=0;i<n;i++){step(.025);if(f)f();}};
      for(const g of BARS)g.open=true;qRoute();run(24000); // file pleine
      for(let i=0;i<BARS.length;i++)BARS[i].open=only>=0?i!==only:false;qRoute();
      const nq=G.queue.length;act('evac');const ev0=G.walkers.filter(k=>k.kind==='evac').length;
      const wp=new Map(),cross=[],A0=new Map(),lost=[];for(const k of G.walkers)if(k.kind==='evac'){const b=barAhead(k);if(b)A0.set(k,b),k.dbg0=[+k.x.toFixed(1),+k.z.toFixed(1),k.i,k.pts.length,k.bj];}const jx=[];let jump=0,alert=0,steps=0;
      const watch=()=>{for(const k of G.walkers){if(k.kind!=='evac')continue;const o=wp.get(k);
        if(o){const j=Math.hypot(k.x-o[0],k.z-o[1]);if(j>jump)jump=j;for(const b of BARS)if(!b.open&&dPl(o[0],o[1],[b.H,b.A])>=.25&&segX(o,[k.x,k.z],b.H,b.A)!=null)cross.push(b.key+' '+o[0].toFixed(1)+','+o[1].toFixed(1)+'>'+k.x.toFixed(1)+','+k.z.toFixed(1)+' i'+k.i+'/'+k.pts.length);if(j>8&&jx.length<3)jx.push(o.map(v=>+v.toFixed(1)).join(',')+'>'+k.x.toFixed(1)+','+k.z.toFixed(1)+' bk'+(k.bk&&k.bk.key));}
        wp.set(k,[k.x,k.z]);}};
      for(let i=0;i<7200;i++){step(.025);watch();for(const [k,b] of A0)if(!b.open&&G.walkers.includes(k)&&!barAhead(k)&&lost.length<3)lost.push(b.key+' H'+b.H.map(v=>+v.toFixed(1))+' A'+b.A.map(v=>+v.toFixed(1))+' from'+k.dbg0+' now '+(barAhead(k)&&barAhead(k).key)+' bk'+(k.bk&&k.bk.key)+' pe'+k.pe+' @ '+k.x.toFixed(1)+','+k.z.toFixed(1)+' i'+k.i+'/'+k.pts.length+' t'+i);steps++;if(i%40===0&&EVW.bars.size)alert++;}
      const held=G.walkers.filter(k=>k.kind==='evac'&&k.bk).length,still=evacOn(),bl=[...EVW.bars.keys()];
      const lamp=(ui(),$('lEvac').className+'|'+$('lEvacT').textContent);
      const closed=BARS.filter(b=>!b.open).length;
      // réouverture : l'évacuation se termine
      for(const g of BARS)g.open=true;qRoute();run(24000);
      return {nq,ev0,cross:cross.slice(0,3),ncross:cross.length,jump:+jump.toFixed(2),jx,lost,alert,held,still,bl,lamp,closed,endOn:evacOn()};})()`);
    const tag = `${id} évacuation, barrière ${c < 0 ? 'toutes' : c + 1} fermée${c < 0 ? 's' : ''}`;
    ok(tag + ' : aucune barrière fermée franchie', r.ncross === 0, r);
    ok(tag + ' : aucun évacué retenu ne passe de l\'autre côté (son trajet franchit encore une barrière fermée)', r.lost.length === 0, r);
    if (r.held > 0) ok(tag + ' : alerte « évacuation bloquée » maintenue', r.still && r.bl.length > 0 && /err/.test(r.lamp), r);
    ok(tag + ' : barrières ouvertes, l\'évacuation se termine', !r.endOn, r);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch(), errors = [];
  for (const id of sites) { out.push('--- ' + id); await evacuation(browser, id, errors); }
  ok('aucune erreur de page', !errors.length, errors.slice(0, 3));
  await browser.close();
  console.log(out.join('\n'));
  console.log(fails ? 'FAIL (' + fails + ')' : 'PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
