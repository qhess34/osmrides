// Test du modèle de gare lu dans OSM (osmrides#57 point 3, #68 ; docs/ref/quai.md) : NODE_PATH=$(npm root -g) node tools/gare-osm-test.js
// (JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt.) Les données de Goudurix sont copiées dans un dossier temporaire et transformées comme
// dans OSM au 27/11 : l'ancien bâtiment de gare devient railway=platform, un building=roof de même emprise porte les tags de toit (format f.t), et la gare taguée
// station est raccourcie de 3 m (plus courte que le train). Le dépôt de jeu n'est jamais modifié.
//  A. sans railway=platform (données telles quelles) : arrêt, quais et places d'avant ;
//  B. quai = zone railway=platform : profondeurs lues dans la zone, train entier le long du quai (même au-delà de st1), places sans superposition ;
//     toit = le bâtiment OSM (building=roof), forme et couleur lues dans ses tags ; la zone railway=platform n'est pas un bâtiment ;
//  C. zone d'attente éditée trop courte : places repliées jamais l'une sur l'autre.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const LIB = path.resolve(__dirname, '..'), SRC = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gare-'));
fs.copyFileSync(path.join(SRC, 'jeu.html'), path.join(TMP, 'jeu.html'));
fs.cpSync(path.join(SRC, 'lieux'), path.join(TMP, 'lieux'), { recursive: true });
const MO = '&moteur=' + path.relative(TMP, path.join(LIB, 'engine')) + '/';
const DIR = path.join(TMP, 'lieux', 'parc', 'asterix');
const patch = (id, js) => fs.appendFileSync(path.join(DIR, id + '.data.js'), '\n;(function(){' + js + '})();\n');
let fails = 0; const out = [];
const ok = (name, c, info) => { if (!c) fails++; out.push((c ? 'ok   ' : 'FAIL ') + name + (!c && info !== undefined ? ' ' + JSON.stringify(info) : '')); };
async function open(browser, id, errors) {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on('pageerror', e => errors.push(id + ': ' + e.message));
  await page.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('t2z.save.')) localStorage.removeItem(k); } catch (e) {} });
  await page.goto(`file://${TMP}/jeu.html?type=parc&lieu=asterix&el=${id}${MO}&mode=sandbox`);
  await page.waitForFunction(() => window.G && typeof act === 'function');
  return page;
}
const probe = () => { const f = mkF(), P = QUAI_OSM || SITE.stationPoly, pin = (x, z) => pinP(P, x, z), at = s => (frameAt(s, f), [f.p.x, f.p.z]);
  let m = 9; for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) { const a = slotPos(i), b = slotPos(j); m = Math.min(m, Math.hypot(a[0] - b[0], a[2] - b[2])); }
  const st = LY.bld.filter(b => b.st);
  return { quai: !!QUAI_OSM, S_ST: +S_ST.toFixed(2), st1: +TAG.st1.toFixed(2), plat: SITE.plat, rear: pin(...at(S_ST - TLEN)), front: pin(...at(S_ST)), minSlot: +m.toFixed(2),
    nSt: st.length, canopy: st[0] && st[0].canopy, rf: st[0] && st[0].rf && st[0].rf.shape, rc: st[0] && st[0].rc }; };

(async () => {
  const browser = await chromium.launch(), errors = [];
  let page = await open(browser, 'goudurix', errors);
  const a = await page.evaluate(probe);
  ok('A sans railway=platform : aucun quai OSM, quais de SITE.plat', !a.quai && a.plat.load === 3.9 && a.plat.exit === 3, a);
  ok('A arrêt d\'avant (au plus st1)', a.S_ST <= a.st1 + .01, a);
  await page.close();
  patch('goudurix', `const b=OSM.feats.find(f=>f.id==='w148159470');OSM.feats.push({k:'building=roof',n:null,c:1,p:b.p.map(q=>q.slice()),id:'w1585383058',v:2,
    t:{'building':'roof','layer':'3','roof:shape':'gabled','roof:material':'fabric','roof:colour':'white;red'}});b.k='railway=platform';b.t={'railway':'platform','level':'1','wall':'no'};
    const i=OSM.cps.findIndex(c=>c[4]==='st1');OSM.cps[i].length=4;OSM.cps[i-1].push('st1');`);
  page = await open(browser, 'goudurix', errors);
  const b = await page.evaluate(probe);
  ok('B quai = zone railway=platform, profondeurs lues dans la zone', b.quai && b.plat.load > 3.4 && b.plat.load < 4.6 && b.plat.exit > 2.4 && b.plat.exit < 3.6 && b.plat.back >= 0 && b.plat.front >= 0, b);
  ok('B gare taguée plus courte que le train : arrêt au-delà de st1, train entier le long du quai', b.S_ST > b.st1 && b.rear && b.front, b);
  ok('B places d\'attente sans superposition', b.minSlot >= .55, b);
  ok('B toit = le bâtiment OSM (building=roof), forme et couleur lues (première valeur de white;red)', b.nSt === 1 && b.canopy && b.rf === 'gabled' && b.rc === '#d8d6d0', b);
  const c = await page.evaluate(() => { GM.boardAreas = [{ id: 'quai', pts: (() => { const P = boardAreaCalc(), z = P.map(p => p[1]), m = (Math.min(...z) + Math.max(...z)) / 2;
    return P.map(p => [p[0], m + (p[1] - m) * .6]); })() }]; reBoard();
    let m = 9; for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) { const a = slotPos(i), b = slotPos(j); m = Math.min(m, Math.hypot(a[0] - b[0], a[2] - b[2])); } return { m: +m.toFixed(2) }; });
  ok('C zone d\'attente trop courte : places repliées jamais l\'une sur l\'autre', c.m >= .55, c);
  await page.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log(errors.length ? 'pageerror : ' + errors.join(' | ') : 'pageerror : aucune');
  console.log(fails ? fails + ' ÉCHEC(S)' : 'PASS');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fails || errors.length ? 1 : 0);
})();
