// Test de l'issue #62 (moteur 0.7.4) : node tools/bugs62-test.js [zeus hourra oziris goudurix]
// (NODE_PATH=$(npm root -g) pour Playwright ; JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt). Une attraction après l'autre.
// « Départ » = envoyer le train hors de la gare ; destination selon l'appareil (propriétaire, #62). Train VIDE à quai, appareil sur une voie de garage :
//  - gare de raccordement, aiguillage en aval (Zeus) : Départ et Avancer de la gare envoient le train dans la voie ; avec passagers : refus clair, train à quai ;
//    appareil sur P : départ sur le circuit (inchangé) ; sauvegarde / reprise avec le train entré au garage par Départ.
//  - autres garages (pont transbordeur au frein final, aiguillage en amont `back`) : Départ part sur le circuit, comme avant (le train est retenu avant l'appareil).
// Chaque cas sur une page neuve ; le message affiché est relevé (journal).
const { chromium } = require('playwright');
const path = require('path');
const LIB = path.resolve(__dirname, '..'), ROOT = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const MO = '&moteur=' + path.relative(ROOT, path.join(LIB, 'engine')) + '/';
const sites = process.argv.slice(2).filter(a => !a.startsWith('-')); if (!sites.length) sites.push('zeus', 'hourra', 'oziris', 'goudurix');
const URL = s => `file://${ROOT}/jeu.html?type=parc&lieu=asterix&el=${s}${MO}&mode=career`;
const VERB = process.argv.includes('-v'); let fails = 0; const out = [];
const ok = (name, c, info) => { if (!c) { fails++; out.push('FAIL ' + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); } else out.push('ok   ' + name + (VERB && info !== undefined ? ' ' + JSON.stringify(info) : '')); return c; };

// prépare : train 0 vide à quai, portillons fermés, sécurités verrouillées, appareil sur la voie libre (pos), puis la commande cmd ; rend l'état et le dernier message
const scenario = (page, cmd, o) => page.evaluate(`(()=>{const o=${JSON.stringify(o || {})};
  act('speed',0);G.wx.next=1e6;G.wx.type='clear';
  const run=n=>{for(let i=0;i<n;i++)step(.025);};
  const A=trains.find(t=>t.st==='station');if(!A)return {err:'aucun train à quai'};
  const gare=YZ==='St'&&!TRAV&&!LBK;if(gare){G.zm.Fin=1;G.zk.Fin=1;} // gare à aiguillage aval : les autres trains attendent au frein final serré (MANU), garage vide
  for(const t of trains)if(t!==A){t.mv=0;if(gare){t.st='run';t.s=S_HOLD;t.v=0;}else if(t.st!=='garage'){t.st='garage';t.lane=LANES.length-1;t.g=LANES[t.lane].stop;}} // sinon : au garage, voie la plus éloignée
  A.seats.fill(null);if(o.pax)for(let i=0;i<o.pax;i++)A.seats[i]={ci:0,w:0,on:true};
  G.gatesOpen=!!o.gates;G.gate=o.gates?1:0;G.resOpen=false;A.rcT=0;A.rc=A.rc.map(()=>0);A.phase=o.pax?'ready':'board';A.depReq=false;A.pt=0;G.auto=false;for(const op of OPS)op.ok=!!o.pax;
  const free=LANES.findIndex((l,j)=>!trains.some(t=>t.st==='garage'&&t.lane===j)),p=o.pos!=null?o.pos:(free<0?LANES.length:free+1);
  if(p){act('pos',p);run(400);}
  const n0=$('log').children.length;
  ${cmd};
  const msg=[];const ch=$('log').children;for(let i=0;i<ch.length-n0&&i<4;i++)msg.unshift(ch[i].textContent.replace(/^\\d\\d:\\d\\d/,''));
  run(o.steps||800);
  return {p,dev:G.dev.pos,st:A.st,s:+(A.s||0).toFixed(1),g:+(A.g||0).toFixed(1),lane:A.lane,mv:A.mv,pax:A.seats.filter(Boolean).length,msg,name:A.name,i:A.i,
    zeus:YZ==='St'&&!TRAV&&!LBK};})()`);

async function site(browser, id, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fresh = async () => { const page = await ctx.newPage(); page.on('pageerror', e => errors.push(id + ': ' + String(e.message || e)));
    await page.goto(URL(id)); await page.waitForFunction(() => window.G && window.t2zSave); await page.evaluate(() => act('closeHelp')); return page; };
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('reprise')) localStorage.clear(); }); // partie neuve à chaque page, sauf reprise demandée
  let page = await fresh();
  const kind = await page.evaluate(() => YZ === 'St' && !TRAV && !LBK ? 'gare' : 'autre');
  await page.close();
  const cases = [['Départ', "act('depart')"], ['Avancer de la gare', "act('zone','St:f')"], ['Dispatch de la voie', "act('zone','L'+p+':d')"]];
  for (const [nm, cmd] of cases) {
    page = await fresh(); const r = await scenario(page, cmd); await page.close();
    if (kind === 'gare') ok(`${id} ${nm}, train vide, aiguillage sur une voie : le train entre au garage`, r.st === 'garage' && r.lane === r.p - 1 && r.g > 4, r);
    else if (nm === 'Départ') ok(`${id} ${nm}, train vide, appareil hors de P : départ sur le circuit (inchangé)`, r.st === 'run', r);
    else out.push(`info ${id} ${nm} : ${r.st} « ${r.msg.join(' | ')} »`);
  }
  if (kind === 'gare') {
    page = await fresh(); let r = await scenario(page, "act('depart')", { pax: 4 }); await page.close();
    ok(`${id} Départ avec passagers, aiguillage sur une voie : refus clair, train à quai`, r.st === 'station' && r.pax === 4 && r.msg.some(m => /passagers/.test(m) && /garage/.test(m)), r);
    page = await fresh(); r = await scenario(page, "act('depart')", { gates: 1 }); await page.close();
    ok(`${id} Départ portillons ouverts, aiguillage sur une voie : refus, train à quai`, r.st === 'station' && r.msg.some(m => /Portillons ouverts/.test(m)), r);
    page = await fresh(); r = await scenario(page, "act('depart')", { pos: 0 }); await page.close();
    ok(`${id} Départ, aiguillage sur P : départ sur le circuit`, r.st === 'run' && r.s > 1, r);
    // sauvegarde / reprise avec le train entré au garage par Départ
    page = await fresh(); r = await scenario(page, "act('depart')", { steps: 4000 });
    const snap = () => page.evaluate(() => trains.map(t => [t.st, t.lane, +(t.g || 0).toFixed(2), t.mv || 0]).concat([[G.dev.pos, G.dev.to]]));
    const a = await snap(); await page.evaluate(() => { t2zSave.save(); sessionStorage.setItem('reprise', '1'); });
    await page.reload(); await page.waitForFunction(() => window.G && window.t2zSave); await page.evaluate(() => act('closeHelp'));
    const b = await snap();
    ok(`${id} sauvegarde / reprise : train garé par Départ retrouvé au garage`, r.st === 'garage' && JSON.stringify(a) === JSON.stringify(b), { a, b });
    // il en ressort : aiguillage sur sa voie, Dispatch de la voie (gare libre : l'autre train vidé du quai d'abord)
    const back = r.st !== 'garage' ? 'non garé' : await page.evaluate(`(()=>{act('speed',0);G.wx.next=1e6;const run=n=>{for(let i=0;i<n;i++)step(.025);};const A=trains[${r.i}];
      if(!devOn(A.lane)){act('pos',A.lane+1);run(400);}act('zone','L'+(A.lane+1)+':d');run(6000);return A.st;})()`);
    ok(`${id} après reprise, Dispatch de la voie : le train ressort en gare`, back === 'station', back);
    await page.close();
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch(), errors = [];
  for (const id of sites) { out.push('--- ' + id); await site(browser, id, errors); }
  ok('aucune erreur de page', !errors.length, errors.slice(0, 3));
  await browser.close();
  console.log(out.join('\n'));
  console.log(fails ? 'FAIL (' + fails + ')' : 'PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
