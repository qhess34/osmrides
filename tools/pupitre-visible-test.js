// Test de l'issue #67 (moteur 0.10.x) : node tools/pupitre-visible-test.js [zeus hourra oziris goudurix]
// (NODE_PATH=$(npm root -g) pour Playwright ; JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt.) Ce que le pupitre commande se voit sur la carte :
//  - lift : bouton marche grisé en AUTO, actif en MANU ; la phase visuelle des taquets (CHAINE.pv) avance quand la chaîne tourne, pas quand elle est arrêtée ;
//  - freins d'une zone en MANU : FREIN change l'état dessiné des mâchoires (BZS[z].c) ; relâcher le rouvre (zone libre) ;
//  - roues de propulsion (zone à moteurs) : elles tournent (BZS[z].a) quand un train est entraîné dans la zone, pas quand il est arrêté freins serrés.
const { chromium } = require('playwright');
const path = require('path');
const LIB = path.resolve(__dirname, '..'), ROOT = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const MO = '&moteur=' + path.relative(ROOT, path.join(LIB, 'engine')) + '/';
const sites = process.argv.slice(2).filter(a => !a.startsWith('-')); if (!sites.length) sites.push('zeus', 'hourra', 'oziris', 'goudurix');
let fails = 0; const out = [];
const ok = (name, c, info) => { if (!c) fails++; out.push((c ? 'ok   ' : 'FAIL ') + name + (!c && info !== undefined ? ' ' + JSON.stringify(info) : '')); };
(async () => {
  const browser = await chromium.launch(), errors = [];
  for (const id of sites) {
    out.push('--- ' + id);
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on('pageerror', e => errors.push(id + ': ' + e.message));
    await page.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('t2z.save.')) localStorage.removeItem(k); } catch (e) {} });
    await page.goto(`file://${ROOT}/jeu.html?type=parc&lieu=asterix&el=${id}${MO}&mode=career`);
    await page.waitForFunction(() => window.G && typeof act === 'function');
    try { await page.click('[data-act=closeHelp]', { timeout: 3000 }); } catch (e) {}
    // lift : bouton marche grisé en AUTO, pressable en MANU
    const l = await page.evaluate(() => {
      act('speed', 0); G.wx.next = 1e6; ui();
      const b = $('zLift_t'), r = { autoDis: b.disabled, mode: $('zLift_m').textContent };
      act('zone', 'Lift:m'); ui(); r.manuDis = b.disabled; r.manu = $('zLift_m').textContent;
      const o0 = G.liftOff; act('zone', 'Lift:t'); ui(); r.off = G.liftOff !== o0; r.lbl = b.textContent;
      act('zone', 'Lift:t'); ui(); r.on = G.liftOff === o0;
      act('zone', 'Lift:m'); ui(); r.backDis = b.disabled; return r;
    });
    ok('lift : marche grisé en AUTO', l.autoDis && l.mode === 'AUTO', l);
    ok('lift : marche actif en MANU, arrêt puis marche', !l.manuDis && l.manu === 'MANU' && l.off && l.on && l.backDis, l);
    const c = await page.evaluate(() => { // chaîne : phase visuelle des taquets
      const t = trains[0]; t.st = 'run'; t.s = S_LIFT0 + Math.min(12, (S_LIFT1 - S_LIFT0) / 2); t.v = 5; G.liftM = false;
      const fr = n => { for (let i = 0; i < n; i++) { step(1 / 30); render(1 / 30); } };
      fr(150); const p0 = CHAINE.pv; fr(30); const mov = CHAINE.pv - p0, v = CHAINE.v;
      act('zone', 'Lift:m'); if (!G.liftOff) act('zone', 'Lift:t'); fr(150); const p1 = CHAINE.pv; fr(30); const res = { mov, v, still: CHAINE.pv - p1, off: G.liftOff }; act('zone', 'Lift:m'); return res;
    });
    ok('lift : taquets défilent chaîne en marche, immobiles à l\'arrêt', c.mov > .5 && c.still < .01 && c.off, c);
    // zones de freinage : mâchoires et roues
    const z = await page.evaluate(() => {
      const res = [];
      for (const Z of ZONES) {
        if (!/^B\d/.test(Z.id) || !Z.auto) continue;
        const id = Z.id, zz = BZ.find(b => b.id === id), t = trains[0], fr = n => { for (let i = 0; i < n; i++) { step(1 / 60); render(1 / 60); } };
        t.st = 'run'; t.v = 0; t.s = zz.r0 - TLEN - 40; for (const o of trains) if (o !== t && o.st !== 'garage') { o.st = 'run'; o.v = 0; o.s = zz.r1 + 60; }
        act('zone', id + ':m'); const r = { id, drive: zz.drive };
        t.s = zz.r0 - TLEN - 40; t.v = 0;
        // train entraîné : dans la zone, freins relâchés, en marche
        G.zk[id] = false; t.s = (zz.r0 + zz.r1) / 2; t.v = 6; BZS[id].a = 0; fr(30); r.aMove = BZS[id].a;
        act('zone', id + ':k'); fr(240); r.zk = zK(id); r.closed = BZS[id].c; // FREIN : mâchoires serrées, train arrêté
        const a1 = BZS[id].a; fr(30); r.v = t.v; r.aStop = BZS[id].a - a1;
        act('zone', id + ':k'); t.s = (zz.r0 + zz.r1) / 2; t.v = 6; fr(40); r.open = BZS[id].c; r.zk2 = zK(id);
        act('zone', id + ':m'); res.push(r);
      }
      return res;
    });
    for (const r of z) {
      ok(`${r.id} : FREIN en MANU serre les mâchoires dessinées`, r.zk && r.closed > .8, r);
      ok(`${r.id} : relâché, les mâchoires s'ouvrent`, !r.zk2 && r.open < .5, r);
      if (r.drive) { ok(`${r.id} : roues tournent quand le train est entraîné`, r.aMove > 3, r); ok(`${r.id} : roues arrêtées freins serrés`, r.aStop < .05, r); }
    }
    ok(id + ' : au moins une zone de freinage testée', z.length > 0);
    await page.close();
  }
  ok('aucune erreur de page', !errors.length, errors.slice(0, 3));
  await browser.close();
  console.log(out.join('\n')); console.log(fails ? 'FAIL (' + fails + ')' : 'PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
