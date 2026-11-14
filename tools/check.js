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
  const ok = r.done && errors.length === 0 && r.riders > 0;
  console.log(`site ${site}${build ? ' (build)' : ''}: day done=${r.done} after ${r.it} steps`);
  console.log(`riders=${r.riders} dispatches=${r.disp} money=${r.money}`);
  console.log(`page errors=${errors.length}` + (errors.length ? ' -> ' + errors.slice(0, 3).join(' | ') : ''));
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL: ' + e.message); process.exit(1); });
