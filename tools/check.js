#!/usr/bin/env node
/* Test rapide : node tools/check.js <site> [--build] — joue une journée complète et résume en quelques lignes. */
const { chromium } = require('playwright');
const path = require('path'), { execFileSync } = require('child_process'), fs = require('fs');
const site = process.argv[2] || 'zeus', build = process.argv.includes('--build');
const root = path.resolve(__dirname, '..');
(async () => {
  fs.mkdirSync('/tmp/t1', { recursive: true });
  let url;
  if (build) {
    const out = `/tmp/t1/${site}.html`;
    execFileSync('python3', [path.join(root, 'tools/build.py'), site, out], { stdio: 'ignore' });
    url = 'file://' + out;
  } else url = `file://${root}/jeu.html?site=${site}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('[data-act=closeHelp]', { timeout: 10000 });
  await page.click('[data-act=closeHelp]');
  // Manœuvre scriptée avec les vrais boutons du pupitre (garage SITE.yard, docs/manoeuvres.md) : sortir le train garé, garer l'autre à vide, deux refus
  let man = 'skipped';
  {
    const until = (cond, max = 20000) => page.evaluate(([c, m]) => { const f = new Function('return ' + c); act('speed', 0); G.wx.next = 1e6;
      for (let i = 0; i < m; i++) { if (f()) break; step(.025); } ui(); return f(); }, [cond, max]);
    const click = async id => { await page.click(id, { timeout: 3000 }); };
    const logHas = re => page.evaluate(r => new RegExp(r).test($('log').textContent), re);
    const steps = [];
    const ok = (name, v) => { steps.push(name + (v ? '' : ':FAIL')); return v; };
    const hasYard = await page.evaluate(() => typeof LANES !== 'undefined' && trains.length > 1 && trains[1].st === 'garage');
    const brake = hasYard && await page.evaluate(() => YD.at === 'brake');
    const trav = hasYard && await page.evaluate(() => TRAV);
    if (trav) { // pont transbordeur droit (device 'traverser') : le chariot emporte le train posé sur le rail B
      const o = await page.evaluate(() => { const g = trains.filter(t => t.st === 'garage'), t = g[Math.min(2, g.length - 1)]; return { i: t.i, k: t.lane + 1 }; });
      await click('#bAuto'); if (await page.evaluate(() => G.gatesOpen)) await click('#bGate'); await until('!G.gatesOpen&&G.gate<.05', 400);
      await click('#bGo'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>S_ST+TLEN+3", 4000));
      await click('#bBk1'); ok('blk1Held', await until('trains[0].blk&&trains[0].v===0&&Math.abs(trains[0].s-BLK[0])<.5', 8000) && await logHas('arrêté au frein de bloc 1'));
      // --shots=DIR : captures du garage (toits retirés) aux étapes clés
      const sd = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
      const shot = async name => { if (!sd) return; fs.mkdirSync(sd, { recursive: true });
        await page.evaluate(() => { G.roofOff = true; cam.g = { x: SW0.x + SW0.tx * 10 - SW0.vx * 10, z: SW0.z + SW0.tz * 10 - SW0.vz * 10, s: 10 }; cam.follow = -1; for (let i = 0; i < 40; i++) render(.05); });
        await page.screenshot({ path: path.join(sd, name + '.png') }); };
      const d0 = await page.evaluate(() => DEV0);
      if (await page.evaluate(() => RA)) { // rail A escamotable (2 positions) + chariot du rail B (G, voies)
        await shot('1-repos');
        // sortir le train de la voie k : chariot face à la voie, AR sur le rail B, rail A retiré, chariot sur G (il porte le train), entrée en gare
        await click('#y' + o.k); ok('dev' + o.k, await until(`devOn(${o.k - 1})`, 4000));
        await click('#tB' + o.i); ok('onCar' + o.i, await until(`trains[${o.i}].lane<0&&!trains[${o.i}].mv`, 8000));
        await click('#yG'); ok('refuseRailA', await logHas('ne vient en ligne que si') && await page.evaluate(() => !devMoving()));
        await click('#yA1'); ok('raOut', await until('raOut()', 4000));
        await click('#yG'); ok('carried' + o.i, await until(`devMoving()&&onCar(trains[${o.i}])`, 40));
        ok('devG', await until(`trains[${o.i}].st==='run'&&G.dev.pos===PG`, 4000));
        ok('station' + o.i, await until(`trains[${o.i}].st==='station'`, 4000));
        await click('#yA0'); ok('refuseRailB', await logHas('ne revient sur le circuit que si') && await page.evaluate(() => raOut()));
        await click('#y' + d0); ok('devRest', await until(`devOn(${d0 - 1})`, 4000));
        await click('#yA0'); ok('raIn', await until('raIn()', 4000));
        ok('stillHeld', await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - BLK[0]) < .5));
        await click('#bBk1'); ok('blk1Released', await until('trains[0].s>BLK[0]+5', 2000));
        // garer le train 0 : G (retenu à vide avant le pont), rail A retiré, chariot sur G (arrêt sur le rail B), chariot sur la voie f (emporté), AV, chariot au repos, rail A sur le circuit
        await click('#tG0'); ok('preHeld0', await until('trains[0].v===0&&Math.abs(trains[0].s-S_PRE)<.5', 20000) && await logHas('attend avant'));
        await page.evaluate(() => act('fwd', 0)); ok('refuseFwd', await logHas('le chariot emporte le train'));
        await click('#yA1'); ok('raOut2', await until('raOut()', 4000)); await shot('2-railA-retire');
        await click('#yG'); ok('onB0', await until('atAnchor(trains[0])&&G.dev.pos===PG', 4000)); await shot('3-chariot-en-ligne');
        const f = await page.evaluate(() => LANES.findIndex((l, j) => !trains.some(t => t.st === 'garage' && t.lane === j)) + 1);
        await click('#y' + f); ok('carry0', await until("devMoving()&&trains[0].st==='garage'&&trains[0].lane<0", 40));
        await click('#yA0'); ok('refuseMovingA', await logHas('ne revient sur le circuit que si'));
        ok('dev' + f, await until(`devOn(${f - 1})`, 4000)); await shot('4-chariot-voie');
        await click('#tF0'); ok('in0', await until(`trains[0].lane===${f - 1}&&trains[0].g>G_B+2`, 400));
        await click('#y' + (f === 1 ? 2 : 1)); ok('refuseLocked', await logHas('verrouillé'));
        ok('parked0', await until(`trains[0].st==='garage'&&trains[0].lane===${f - 1}&&!trains[0].mv&&!nearDev(trains[0])`, 8000));
        if (f !== d0) { await click('#y' + d0); ok('devRest2', await until(`devOn(${d0 - 1})`, 4000)); }
        await click('#yA0'); ok('raIn2', await until('raIn()', 4000)); await shot('5-railA-revenu');
      } else {
      // sortir le train de la voie k : chariot face à la voie, AR sur le rail B, chariot sur G (il porte le train), entrée en gare, chariot sur P
      await click('#y' + o.k); ok('dev' + o.k, await until(`devOn(${o.k - 1})`, 4000));
      await click('#tB' + o.i); ok('onCar' + o.i, await until(`trains[${o.i}].lane<0&&!trains[${o.i}].mv`, 8000));
      await click('#yG'); ok('carried' + o.i, await until(`devMoving()&&onCar(trains[${o.i}])`, 40));
      ok('devG', await until(`trains[${o.i}].st==='run'&&G.dev.pos===PG`, 4000));
      ok('station' + o.i, await until(`trains[${o.i}].st==='station'`, 4000));
      await click('#yP'); ok('devP', await until('!devOff()', 2000));
      ok('stillHeld', await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - BLK[0]) < .5));
      await click('#bBk1'); ok('blk1Released', await until('trains[0].s>BLK[0]+5', 2000));
      // garer le train 0 : G (retenu à vide avant le pont), pont sur G (arrêt sur le rail B), pont sur la voie f (emporté), AV, pont sur P
      await click('#tG0'); ok('preHeld0', await until('trains[0].v===0&&Math.abs(trains[0].s-S_PRE)<.5', 20000) && await logHas('attend avant'));
      await page.evaluate(() => act('fwd', 0)); ok('refuseFwd', await logHas('le chariot emporte le train'));
      await click('#yG'); ok('onB0', await until('atAnchor(trains[0])&&G.dev.pos===PG', 4000));
      const f = await page.evaluate(k => LANES.findIndex((l, j) => j !== k - 1 && !trains.some(t => t.st === 'garage' && t.lane === j)) + 1, o.k);
      await click('#y' + f); ok('carry0', await until("devMoving()&&trains[0].st==='garage'&&trains[0].lane<0", 40));
      await click('#yP'); ok('refuseMoving', await logHas('en mouvement'));
      ok('dev' + f, await until(`devOn(${f - 1})`, 4000));
      await click('#tF0'); ok('in0', await until(`trains[0].lane===${f - 1}&&trains[0].g>G_B+2`, 400));
      await click('#yP'); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until(`trains[0].st==='garage'&&trains[0].lane===${f - 1}&&!trains[0].mv&&!nearDev(trains[0])`, 8000));
      await click('#yP'); ok('devP2', await until('!devOff()', 4000));
      }
      await click('#bAuto');
      if (process.argv.includes('--shot')) await page.evaluate(() => { cam.g = { x: SW0.x, z: SW0.z, s: 11 }; cam.follow = -1; for (let i = 0; i < 6; i++) render(.05); });
    } else if (brake) { // garage sur le frein final (pont transbordeur à N voies) : sortir le train de la voie k, garer le train 0 sur une voie libre
      const o = await page.evaluate(() => { const g = trains.filter(t => t.st === 'garage'), t = g[Math.min(2, g.length - 1)]; return { i: t.i, k: t.lane + 1 }; });
      await click('#bAuto'); if (await page.evaluate(() => G.gatesOpen)) await click('#bGate'); await until('!G.gatesOpen&&G.gate<.05', 400);
      await click('#bGo'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>S_ST+TLEN+3", 4000));
      // frein de bloc 1 fermé au pupitre : le train 0 y est arrêté (canton suivant libre) pendant la sortie du garage, puis libéré
      await click('#bBk1'); ok('blk1Held', await until('trains[0].blk&&trains[0].v===0&&Math.abs(trains[0].s-BLK[0])<.5', 8000) && await logHas('arrêté au frein de bloc 1'));
      await click('#tG0');
      await click('#y' + o.k); ok('dev' + o.k, await until(`devOn(${o.k - 1})`, 800));
      await click('#tB' + o.i); ok('out' + o.k, await until(`trains[${o.i}].st==='run'&&atAnchor(trains[${o.i}])`, 8000));
      await click('#yP'); ok('devP', await until('!devOff()', 800));
      ok('station' + o.i, await until(`trains[${o.i}].st==='station'`, 4000));
      ok('stillHeld', await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - BLK[0]) < .5));
      await click('#bBk1'); ok('blk1Released', await until('trains[0].s>BLK[0]+5', 2000));
      ok('held0', await until('atAnchor(trains[0])', 20000));
      await click('#tF0'); ok('refuseWrongPos', await logHas('sur P : positionnez'));
      const f = await page.evaluate(k => LANES.findIndex((l, j) => j !== k - 1 && !trains.some(t => t.st === 'garage' && t.lane === j)) + 1, o.k);
      await click('#y' + f); ok('dev' + f, await until(`devOn(${f - 1})`, 800));
      await click('#tF0'); ok('in0', await until("trains[0].st==='garage'&&trains[0].g>4", 400));
      await click('#yP'); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until(`trains[0].st==='garage'&&trains[0].lane===${f - 1}&&!trains[0].mv&&!nearDev(trains[0])`, 8000));
      await click('#yP'); ok('devP2', await until('!devOff()', 800));
      await click('#bAuto');
      if (process.argv.includes('--shot')) await page.evaluate(() => { cam.g = { x: SW0.x, z: SW0.z, s: 11 }; cam.follow = -1; for (let i = 0; i < 6; i++) render(.05); });
    } else if (hasYard) {
      await click('#bAuto'); if (await page.evaluate(() => G.gatesOpen)) await click('#bGate'); await until('!G.gatesOpen&&G.gate<.05', 400);
      await click('#bGo'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>SW_B+TLEN+3", 4000));
      await click('#y1'); ok('dev1', await until('devOn(0)', 400));
      await click('#tB1'); ok('out1', await until("trains[1].st==='station'", 8000));
      await click('#yP'); ok('devP', await until('!devOff()', 400));
      await click('#bGo'); ok('depart1', await until("trains[1].st==='run'&&trains[1].s>SW_B+TLEN+3", 4000));
      ok('arrive0', await until("trains[0].st==='station'&&trains[0].phase==='board'", 20000));
      await click('#tG0');
      await click('#tF0'); ok('refuseWrongPos', await logHas('sur P : positionnez'));
      await click('#y1'); ok('dev1b', await until('devOn(0)', 400));
      await click('#tF0'); ok('in0', await until("trains[0].st==='garage'&&trains[0].g>4", 400));
      await click('#yP'); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until("trains[0].st==='garage'&&!trains[0].mv&&!nearDev(trains[0])", 8000));
      await click('#yP'); ok('devP2', await until('!devOff()', 400));
      await click('#bAuto');
      if (process.argv.includes('--shot')) await page.evaluate(() => { cam.g = { x: 30, z: -5, s: 11 }; cam.follow = -1; for (let i = 0; i < 6; i++) render(.05); });
    }
    man = steps.length ? steps.join(' ') : 'no yard train';
  }
  const r = await page.evaluate(() => {
    act('speed', 0); G.wx.next = 1e6;
    if (!G.open) act('open');
    let it = 0;
    for (; it < 400000 && !G.dayDone; it++) {
      step(.025);
      if (it % 40) continue;
      if (G.liftBroken) act('job', 'liftFix');
      if (G.brakeFault) act('job', 'brakeFix');
      trains.forEach((t, i) => { if (t.fault === 'lapbars') act('rearm', i); });
    }
    const s = G.stats || {};
    return { done: G.dayDone, it, time: G.time, riders: s.riders, disp: s.disp, money: Math.round(G.money) };
  });
  await page.evaluate(() => { document.getElementById('mDay').classList.add('hidden'); cam.g = null; for (let i = 0; i < 4; i++) render(.05); });
  await page.screenshot({ path: `/tmp/t1/${site}.png` });
  await browser.close();
  const ok = r.done && errors.length === 0 && r.riders > 0 && !/FAIL/.test(man);
  console.log(`site ${site}${build ? ' (build)' : ''}: day done=${r.done} after ${r.it} steps`);
  console.log(`riders=${r.riders} dispatches=${r.disp} money=${r.money}`);
  console.log(`manoeuvre: ${man}`);
  console.log(`page errors=${errors.length}` + (errors.length ? ' -> ' + errors.slice(0, 3).join(' | ') : ''));
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
