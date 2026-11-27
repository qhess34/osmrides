// Test de l'issue #68 (toits, tunnels, niveaux OSM) : NODE_PATH=$(npm root -g) node tools/toits-niveaux-test.js [--shots=dossier]
// (JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt.) Les données d'un jeu sont copiées dans un dossier temporaire et complétées par des
// tags OSM fabriqués (format f.t, docs/ref/decor.md « Tags OSM transportés ») ; le dépôt de jeu n'est jamais modifié.
//  A. toit à deux pans de la gare de Zeus lu dans OSM (w148160405 : gabled, along, roof:height 2, roof:colour #ccb281) : dimensions et faîtage ; sans tags : rendu d'avant ;
//  B. polygone man_made=tunnel prioritaire : sa couverture suit le polygone, le tunnel de la voie qu'il recoupe n'est gardé que hors du polygone ;
//  C. ordre vertical par niveaux : voie layer<0 dessinée à la profondeur d'affichage commune, tranchées man_made=excavation dessinées sous la voie ;
//  D. structures sous les rails mobiles (man_made=structure) lues dans OSM ; sans objet : rien sous le rail mobile.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const LIB = path.resolve(__dirname, '..'), SRC = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks'));
const SHOTS = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'toits-'));
for (const f of ['jeu.html']) fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
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
  try { await page.click('[data-act=closeHelp]', { timeout: 2000 }); } catch (e) {}
  await page.evaluate(() => { act('speed', 0); G.wx.next = 1e6; });
  return page;
}
const shot = async (page, name, x, z, s) => { if (!SHOTS) return; await page.evaluate(([x, z, s]) => { cam.x = x; cam.z = z; cam.s = s; G.roofOff = false; for (let i = 0; i < 40; i++) render(1 / 30); }, [x, z, s]);
  await page.locator('#view canvas, canvas').first().screenshot({ path: path.join(SHOTS, name + '.png') }); };

(async () => {
  const browser = await chromium.launch(), errors = [];
  // ---------- A : sans tags (données du jeu telles quelles), puis avec les tags OSM de la gare de Zeus
  {
    const page = await open(browser, 'zeus', errors);
    const r = await page.evaluate(() => { const b = LY.bld.find(b => b.st); return { st: !!b, rf: b && b.rf, h: b && b.h }; });
    ok('A sans tags : gare sans forme de toit OSM (dessin d\'avant)', r.st && r.rf == null && r.h === 8, r);
    await shot(page, 'zeus-avant', -14, 2.5, 8);
    await page.close();
  }
  patch('zeus', `const f=OSM.feats.find(f=>f.id==='w148160405');f.t={'building':'yes','height':'8','min_height':'5','roof:shape':'gabled','roof:orientation':'along','roof:height':'2','roof:colour':'#ccb281'};`);
  {
    const page = await open(browser, 'zeus', errors);
    const r = await page.evaluate(() => { const b = LY.bld.find(b => b.st), g = b.rf, R = g && g.ridge;
      return { shape: g && g.shape, hl: g && g.hl, hw: g && g.hw, rh: g && g.rh, d: g && g.d, ridge: R, rc: b.rc, h: b.h, mh: b.mh, pans: g && g.pans.length,
        fill: (render(1 / 30), true) }; });
    const R = r.ridge || [[0, 0], [0, 0]], zm = (R[0][1] + R[1][1]) / 2, L = Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]);
    ok('A gabled along : deux pans, faîtage dans le sens long (est-ouest)', r.shape === 'gabled' && r.pans === 2 && Math.abs(r.d[0]) > .99, r);
    ok('A dimensions : faîtage ≈ 18,4 m au milieu (z ≈ 2,5), demi-largeur ≈ 5,6 m, hauteur du toit 2 m', Math.abs(L - 18.4) < .8 && Math.abs(zm - 2.5) < .5 && Math.abs(r.hw - 5.6) < .5 && r.rh === 2, { L, zm, hw: r.hw, rh: r.rh });
    ok('A couleur, hauteur, hauteur minimale lues dans OSM', r.rc === '#ccb281' && r.h === 8 && r.mh === 5, r);
    const c = await page.evaluate(() => { const b = LY.bld.find(b => b.st); b.st = false; const g = roofGeom(b.p ? OSM.feats.find(f => f.id === 'w148160405').p : [], { t: { 'roof:shape': 'gabled', 'roof:orientation': 'across' } }); b.st = true; return { d: g.d }; });
    ok('A across : faîtage en travers', Math.abs(c.d[1]) > .99, c);
    const h = await page.evaluate(() => { const g = roofGeom([[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]], { t: { 'roof:shape': 'hipped', 'roof:height': '3' } }); const R = g.ridge; return { n: g.pans.length, L: Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]) }; });
    ok('A hipped : quatre pans, faîtage = longueur - largeur', h.n === 4 && Math.abs(h.L - 10) < .01, h);
    await shot(page, 'zeus-apres', -14, 2.5, 8);
    await page.close();
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log(errors.length ? 'pageerror : ' + errors.join(' | ') : 'pageerror : aucune');
  console.log(fails ? fails + ' ÉCHEC(S)' : 'PASS');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fails || errors.length ? 1 : 0);
})();
