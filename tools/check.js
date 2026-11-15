#!/usr/bin/env node
/* Test rapide : node tools/check.js <site> [--build] — joue une journée complète et résume en quelques lignes. */
const { chromium } = require('playwright');
const { INSTALL } = require('./offpath.js');
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
    const click = async id => { try { await page.click(id, { timeout: 3000 }); } catch (e) { throw new Error('click ' + id + ' after: ' + steps.join(' ')); } };
    const logHas = re => page.evaluate(r => new RegExp(r).test($('log').textContent), re);
    const steps = [];
    const ok = (name, v) => { steps.push(name + (v ? '' : ':FAIL')); return v; };
    const hasYard = await page.evaluate(() => typeof LANES !== 'undefined' && trains.length > 1 && trains[1].st === 'garage');
    const brake = hasYard && await page.evaluate(() => YD.at === 'brake');
    const trav = hasYard && await page.evaluate(() => TRAV);
    const gates = async () => { // portillons : ouverture et fermeture uniquement au bouton
      await click('#bGate'); ok('gateOpen', await page.evaluate(() => G.gatesOpen));
      await click('#bGate'); ok('gateShut', await until('!G.gatesOpen&&G.gate<.05', 400));
    };
    const shotDir = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
    const shot = async name => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true });
      await page.evaluate(() => { G.roofOff = true; cam.g = { x: SW0.x + SW0.tx * 10 - SW0.vx * 10, z: SW0.z + SW0.tz * 10 - SW0.vz * 10, s: 10 }; cam.follow = -1; for (let i = 0; i < 40; i++) render(.05); });
      await page.screenshot({ path: path.join(shotDir, name + '.png') }); };
    if (trav && await page.evaluate(() => RA)) { // Trace du Hourra : rail A escamotable + chariot du rail B ; commandes par zones
      const o = await page.evaluate(() => { const g = trains.filter(t => t.st === 'garage'), t = g[Math.min(2, g.length - 1)]; return { i: t.i, k: t.lane + 1 }; });
      const d0 = await page.evaluate(() => DEV0);
      await click('#bAuto'); await gates();
      await click('#zSt_f'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>S_ST+TLEN+3", 4000));
      await page.evaluate(() => act('zone', 'B1:k')); ok('refuseAuto', await logHas('en AUTO : passez'));
      await click('#zB1_m'); await click('#zB1_k'); ok('blk1Held', await until('trains[0].blk&&trains[0].v===0&&Math.abs(trains[0].s-BLK[0])<.5', 8000) && await logHas('arrêté au frein de bloc 1'));
      await shot('1-repos');
      // sortir le train de la voie k : chariot face à la voie, AR de la voie (sur le rail B), rail A retiré, chariot sur G, Avancer (rail B) vers la gare
      await click('#y' + o.k); ok('dev' + o.k, await until(`devOn(${o.k - 1})`, 4000));
      await click(`#zL${o.k}_b`); ok('onCar' + o.i, await until(`trains[${o.i}].lane<0&&!trains[${o.i}].mv`, 8000));
      await click('#yG'); ok('refuseRailA', await logHas('ne vient en ligne que si') && await page.evaluate(() => !devMoving()));
      await click('#yA1'); ok('raOut', await until('raOut()', 4000));
      await click('#yG'); ok('carried' + o.i, await until(`devMoving()&&onCar(trains[${o.i}])`, 40));
      ok('onRailB' + o.i, await until(`trains[${o.i}].st==='run'&&G.dev.pos===PG&&tZone(trains[${o.i}])==='RB'`, 4000));
      await click('#zRB_f'); ok('station' + o.i, await until(`trains[${o.i}].st==='station'`, 4000));
      await click('#yA0'); ok('refuseRailB', await logHas('ne revient sur le circuit que si') && await page.evaluate(() => raOut()));
      await click('#y' + d0); ok('devRest', await until(`devOn(${d0 - 1})`, 4000));
      await click('#yA0'); ok('raIn', await until('raIn()', 4000));
      ok('stillHeld', await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - BLK[0]) < .5));
      await click('#zB1_k'); ok('blk1Released', await until('trains[0].s>BLK[0]+5', 2000));
      // garer le train 0 (vide) : frein final en MANU serré (arrêt avant le pont), rail A retiré, chariot sur G, relâcher, Avancer (frein final) sur le rail B,
      // chariot sur une voie libre (il l'emporte), Avancer (rail B) dans la voie, chariot au repos, rail A sur le circuit
      await click('#zFin_m'); await click('#zFin_k');
      ok('preHeld0', await until('trains[0].v===0&&Math.abs(trains[0].s-S_PRE)<.5', 20000) && await logHas('frein final serré'));
      await click('#zFin_f'); ok('refuseFinBrake', await logHas('freins serrés, relâchez'));
      await click('#yA1'); ok('raOut2', await until('raOut()', 4000)); await shot('2-railA-retire');
      await click('#yG'); ok('devG2', await until('!devMoving()&&G.dev.pos===PG', 4000));
      await click('#zFin_k'); ok('stillPre0', await until('false', 200) || await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - S_PRE) < .5));
      await click('#zFin_f'); ok('onB0', await until('atAnchor(trains[0])&&G.dev.pos===PG', 4000)); await shot('3-chariot-en-ligne');
      const f = await page.evaluate(() => LANES.findIndex((l, j) => !trains.some(t => t.st === 'garage' && t.lane === j)) + 1);
      await click('#y' + f); ok('carry0', await until("devMoving()&&trains[0].st==='garage'&&trains[0].lane<0", 40));
      await click('#yA0'); ok('refuseMovingA', await logHas('ne revient sur le circuit que si'));
      ok('dev' + f, await until(`devOn(${f - 1})`, 4000)); await shot('4-chariot-voie');
      await click(`#zL${f}_k`); await click('#zRB_f'); ok('refuseLaneBrake', await logHas(`Freins de Voie ${f} serrés`)); await click(`#zL${f}_k`);
      await click('#zRB_f'); ok('in0', await until(`trains[0].lane===${f - 1}&&trains[0].g>G_B+2`, 400));
      await click('#y' + (f === 1 ? 2 : 1)); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until(`trains[0].st==='garage'&&trains[0].lane===${f - 1}&&!trains[0].mv&&!nearDev(trains[0])`, 8000));
      if (f !== d0) { await click('#y' + d0); ok('devRest2', await until(`devOn(${d0 - 1})`, 4000)); }
      await click('#yA0'); ok('raIn2', await until('raIn()', 4000)); await shot('5-railA-revenu');
      await click('#zAuto'); ok('allAuto', await page.evaluate(() => !G.zm.Fin && !G.zm.B1));
      // stockage : en AUTO, rail mobile du parcours (RA) et frein final (Fin) retiennent un train chacun pendant que la gare est occupée
      const two = await page.evaluate(() => { const g = trains.filter(t => t.st === 'garage' && !t.mv).slice(0, 2); if (g.length < 2 || !trains.some(t => t.st === 'station')) return null;
        g.forEach((t, k) => { t.st = 'run'; t.s = S_PRE - 14 - k * (TLEN + 3); t.v = 4; t.lane = 0; t.g = 0; t.mv = 0; t.depReq = false; t.inLift = false; t.inBrake = false; t.blk = false; t.entering = false; t.hold = 0; t.fdrive = 0; t.told = false; t.preTold = false; t.lkTold = false; });
        return [g[0].i, g[1].i]; });
      if (two) {
        ok('storeRA', await until(`trains[${two[0]}].v===0&&tZone(trains[${two[0]}])==='RA'&&Math.abs(trains[${two[0]}].s-S_HOLD)<.5`, 2400));
        ok('storeFin', await until(`trains[${two[1]}].v===0&&tZone(trains[${two[1]}])==='Fin'&&Math.abs(trains[${two[1]}].s-S_PRE)<.6`, 2400));
        ok('heldStation', await page.evaluate(() => trains.some(t => t.st === 'station')) && await page.evaluate(i => trains[i].st === 'run', two[0]));
        await shot('6-stockage');
        await until("trains.some(t=>t.st==='station'&&t.phase==='board')", 8000);
        await gates(); await click('#zSt_f'); // la gare se libère : le train du rail mobile entre, puis celui du frein final
        ok('enterA', await until(`trains[${two[0]}].st==='station'`, 2400));
        await until(`trains[${two[0]}].phase==='board'`, 8000);
        await until(`!blockReason(trains[${two[0]}])`, 4000);
        await gates(); await click('#zSt_f');
        ok('enterB', await until(`trains[${two[1]}].st==='station'`, 2400));
      }
      await click('#bAuto');
    } else if (trav && await page.evaluate(() => LREV && !RA)) { // OzIris : pont transbordeur à deux rails (P, G, voies), voies EN AMONT du pont (yard.rev : entrée en marche arrière)
      await click('#bAuto'); await gates();
      await click('#zSt_f'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>S_ST+TLEN+3", 4000));
      await click('#zLift_off'); ok('liftHeld', await until('trains[0].v===0&&trains[0].s>S_LIFT0-1&&trains[0].s<S_LIFT1', 4000)); // un seul frein de bloc : le train est retenu sur le lift
      // sortir le train 2 (voie 1) : pont face à la voie 1, Voie 1 AV (vers le pont, marche avant), pont sur G (il l'emporte), Rail de garage AV vers la gare, pont sur P
      await click('#y1'); ok('dev1', await until('devOn(0)', 4000));
      await click('#zL1_f'); ok('onCar1', await until('trains[1].lane<0&&!trains[1].mv', 8000));
      await click('#zRB_f'); ok('refuseRBfwd', await logHas('entre dans une voie en marche arrière'));
      await click('#yG'); ok('carried1', await until('devMoving()&&onCar(trains[1])', 40));
      ok('onRailB1', await until("trains[1].st==='run'&&G.dev.pos===PG&&tZone(trains[1])==='RB'", 4000));
      await shot('1-sortie-rail-garage');
      await click('#zRB_f'); ok('station1', await until("trains[1].st==='station'", 4000));
      await click('#yP'); ok('devP', await until('!devOff()', 4000));
      await click('#zLift_on'); ok('liftOn', await until('trains[0].s>S_LIFT1+5', 4000));
      // garer le train 1 (vide) : frein final MANU serré (arrêt avant le pont), pont sur G, relâcher, Frein final AV (sur le rail de garage),
      // pont sur une voie libre (il emporte le train), Rail de garage AR (il recule dans la voie), pont sur P
      await click('#zFin_m'); await click('#zFin_k');
      ok('preHeld0', await until('trains[0].v===0&&Math.abs(trains[0].s-S_PRE)<.5', 20000));
      await click('#yG'); ok('devG2', await until('!devMoving()&&G.dev.pos===PG', 4000));
      await click('#zFin_k'); ok('stillPre0', await until('false', 200) || await page.evaluate(() => trains[0].v === 0 && Math.abs(trains[0].s - S_PRE) < .5));
      await click('#zFin_f'); ok('onB0', await until('atAnchor(trains[0])&&G.dev.pos===PG', 4000)); await shot('2-rail-garage-en-ligne');
      const f = await page.evaluate(() => LANES.findIndex((l, j) => !trains.some(t => t.st === 'garage' && t.lane === j)) + 1);
      await click('#y' + f); ok('carry0', await until("devMoving()&&trains[0].st==='garage'&&trains[0].lane<0", 40));
      ok('dev' + f, await until(`devOn(${f - 1})`, 4000)); await shot('3-pont-face-voie');
      await click(`#zL${f}_k`); await click('#zRB_b'); ok('refuseLaneBrake', await logHas(`Freins de Voie ${f} serrés`)); await click(`#zL${f}_k`);
      await click('#zRB_b'); ok('in0', await until(`trains[0].lane===${f - 1}&&trains[0].g>G_B+2`, 400)); await shot('4-recul-dans-la-voie');
      await click('#yP'); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until(`trains[0].st==='garage'&&trains[0].lane===${f - 1}&&!trains[0].mv&&!nearDev(trains[0])`, 8000));
      await click('#yP'); ok('devP2', await until('!devOff()', 4000)); await shot('5-gare');
      await click('#zAuto'); ok('allAuto', await page.evaluate(() => !G.zm.Fin && !G.zm.B1));
      await click('#bAuto');
    } else if (hasYard && !trav && !brake) { // Tonnerre 2 Zeus : aiguillage dans le prolongement de la gare ; commandes par zones
      await click('#bAuto'); await gates();
      await click('#zSt_f'); ok('depart0', await until("trains[0].st==='run'&&trains[0].s>SW_B+TLEN+3", 4000));
      await click('#y1'); ok('dev1', await until('devOn(0)', 400));
      await click('#zL1_b'); ok('out1', await until("trains[1].st==='station'", 8000));
      await click('#yP'); ok('devP', await until('!devOff()', 400));
      // frein final en MANU, serré : il retient le train 0 ; relâchement refusé tant que la gare est occupée (anti-collision)
      await click('#zFin_m'); await click('#zFin_k');
      ok('finHeld0', await until("trains[0].st==='run'&&trains[0].v===0&&Math.abs(trains[0].s-S_HOLD)<.4", 20000));
      await click('#zFin_k'); ok('refuseAntiCollision', await logHas('relâchement refusé, section suivante occupée'));
      await click('#zSt_f'); ok('depart1', await until("trains[1].st==='run'&&trains[1].s>SW_B+TLEN+3", 4000));
      await click('#zFin_k'); ok('arrive0', await until("trains[0].st==='station'&&trains[0].phase==='board'", 20000));
      await click('#y1'); ok('dev1b', await until('devOn(0)', 400));
      await click('#bGate'); await click('#zSt_f'); ok('refuseGates', await logHas('Portillons ouverts : fermez-les'));
      await click('#bGate'); await until('!G.gatesOpen&&G.gate<.05', 400);
      await click('#zL1_k'); await click('#zSt_f'); ok('refuseLaneBrake', await logHas('Freins de Garage serrés')); await click('#zL1_k');
      await click('#zSt_f'); ok('in0', await until("trains[0].st==='garage'&&trains[0].g>4", 400));
      await click('#yP'); ok('refuseLocked', await logHas('verrouillé'));
      ok('parked0', await until("trains[0].st==='garage'&&!trains[0].mv&&!nearDev(trains[0])", 8000));
      await click('#yP'); ok('devP2', await until('!devOff()', 400));
      // frein final en MANU : serré, il retient le train 1 ; relâché, le train entre en gare
      await click('#zFin_k');
      ok('finHeld1', await until("trains[1].st==='run'&&trains[1].v===0&&Math.abs(trains[1].s-S_HOLD)<.4", 20000) && await logHas('serré au pupitre'));
      await click('#zFin_k'); ok('finRel1', await until("trains[1].st==='station'", 2000));
      await click('#zAuto'); ok('allAuto', await page.evaluate(() => !G.zm.Fin));
      await click('#bAuto');
    } else if (hasYard) steps.push('scenario-missing:FAIL');
    man = steps.length ? steps.join(' ') : 'no yard train';
  }
  await page.evaluate(INSTALL); // contrôle offpath : visiteurs hors des chemins (tools/offpath.js)
  const r = await page.evaluate(() => {
    act('speed', 0); G.wx.next = 1e6; __opStroll();
    if (!G.open) act('open');
    let it = 0, opened = null, gp = 0;
    const press = () => { ui(); $('bGate').click(); gp++; }; // le joueur ouvre et ferme les portillons au bouton du pupitre
    for (; it < 400000 && !G.dayDone; it++) {
      step(.025);
      if (it % 5 === 0) __opSample();
      if (it === 9000 || it === 22000) act('evac'); // évacuation de la file en pleine journée
      if (it === 14000) for (const v of G.queue) if (Math.random() < .5) v.pat = 0; // abandons dans toute la file
      if (it % 40) continue;
      const s = trains.find(t => t.st === 'station' && t.phase === 'board' && !t.hs);
      if (s) { if (!G.gatesOpen && opened !== s && !s.depReq) { press(); opened = s; } else if (G.gatesOpen && (s.depReq || count(s) === SEATS)) press(); }
      else { if (G.gatesOpen) press(); if (!trains.some(t => t.st === 'station')) opened = null; }
      if (G.liftBroken) act('job', 'liftFix');
      if (G.brakeFault) act('job', 'brakeFix');
      trains.forEach((t, i) => { if (t.fault === 'lapbars') act('rearm', i); });
    }
    const s = G.stats || {};
    return { done: G.dayDone, it, gp, time: G.time, riders: s.riders, disp: s.disp, money: Math.round(G.money), off: __op.bad, offN: __op.n, offBy: __op.byKind, offEx: __op.ex.slice(0, 6) };
  });
  await page.evaluate(() => { document.getElementById('mDay').classList.add('hidden'); cam.g = null; for (let i = 0; i < 4; i++) render(.05); });
  await page.screenshot({ path: `/tmp/t1/${site}.png` });
  await browser.close();
  const ok = r.done && errors.length === 0 && r.riders > 0 && !/FAIL/.test(man) && r.off <= 2;
  console.log(`site ${site}${build ? ' (build)' : ''}: day done=${r.done} after ${r.it} steps, gate presses=${r.gp}`);
  console.log(`riders=${r.riders} dispatches=${r.disp} money=${r.money}`);
  console.log(`offpath=${r.off} (sur ${r.offN} positions)` + (r.off ? ' -> ' + JSON.stringify(r.offBy) + ' ex ' + JSON.stringify(r.offEx) : ''));
  console.log(`manoeuvre: ${man}`);
  console.log(`page errors=${errors.length}` + (errors.length ? ' -> ' + errors.slice(0, 3).join(' | ') : ''));
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
