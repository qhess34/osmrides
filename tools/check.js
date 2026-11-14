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
    if (hasYard) {
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
