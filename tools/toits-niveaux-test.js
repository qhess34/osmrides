// Test de l'issue #68 (toits, tunnels, niveaux OSM) : NODE_PATH=$(npm root -g) node tools/toits-niveaux-test.js [--shots=dossier]
// (JEU=… dépôt de jeu, défaut ../osmrides_parks ; moteur = celui de ce dépôt.) Les données d'un jeu sont copiées dans un dossier temporaire et complétées par des
// tags OSM fabriqués (format f.t, docs/ref/decor.md « Tags OSM transportés ») ; le dépôt de jeu n'est jamais modifié.
//  A. toit à deux pans de la gare de Zeus lu dans OSM (w148160405 : gabled, along, roof:height 2, roof:colour #ccb281) : dimensions et faîtage ; sans tags : rendu d'avant ;
//  B. polygone man_made=tunnel prioritaire : sa couverture suit le polygone, le tunnel de la voie qu'il recoupe n'est gardé que hors du polygone ;
//  C. ordre vertical par niveaux : voie layer<0 dessinée à la profondeur d'affichage commune, tranchées man_made=excavation dessinées sous la voie ;
//  D. structures sous les rails mobiles (man_made=structure) lues dans OSM ; sans objet : rien sous le rail mobile (ni dalle des voies de garage, ni heurtoirs, ni carter du rotatif : plus calculés).
//  E. coaster inversé (OzIris) : le plancher galvanisé sous la voie est dessiné AVANT le train suspendu au-dessus de lui (ordre déduit des hauteurs, jamais d'un cas particulier) ;
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
  // ---------- B : polygones man_made=tunnel de Zeus (w1353118256 et un second), données du jeu telles quelles
  {
    const page = await open(browser, 'zeus', errors);
    const r = await page.evaluate(() => ({ osm: OSM.tunnels, L: TLIST.map(t => ({ r: t.r.slice(0, 2).map(v => +v.toFixed(1)), poly: !!t.poly, nm: t.nm })), tun: TUN.map(t => ({ poly: t.poly, mouths: t.mouth.length, under: t.under })) }));
    const P = r.L.filter(t => t.poly), V = r.L.filter(t => !t.poly);
    ok('B polygones : un tunnel par polygone, couverture = polygone', P.length >= 1 && r.tun.filter(t => t.poly).length === P.length, r);
    ok('B voie : aucun tunnel de voie dans l\'emprise d\'un polygone', V.every(v => P.every(p => v.r[1] <= p.r[0] + .01 || v.r[0] >= p.r[1] - .01)), r);
    ok('B portails : aucun portail côté polygone', r.L.every((t, i) => r.tun[i].mouths === 2 - (t.nm[0] ? 1 : 0) - (t.nm[1] ? 1 : 0)), r);
    await page.close();
    const p2 = await open(browser, 'oziris', errors);
    const o = await p2.evaluate(() => ({ n: TLIST.length, o: (OSM.tunnels || []).length, poly: TLIST.some(t => t.poly) }));
    ok('B sans polygone (OzIris) : tunnels de voie inchangés', o.n === o.o && !o.poly, o);
    await p2.close();
  }
  // ---------- E : plancher galvanisé d'un coaster inversé (CATW, voie - 3 m) sous le train suspendu : le train se voit au-dessus du plancher
  {
    const page = await open(browser, 'oziris', errors);
    const r = await page.evaluate(() => { const W = CATW.walks.find(w => !w.lift && w.segs.some(g => g.fl)); if (!W) return { none: true };
      const i = Math.round((W.i0 + W.i1) / 2), t = trains[0]; t.st = 'run'; t.s = i * DS + CAR * 2.5; t.v = 0;
      const log = [], f1 = drawCatwalk, f2 = drawCar; drawCatwalk = g => { if (W.segs.includes(g)) log.push('w'); return f1(g); }; drawCar = (a, b, c) => { const sc = (((t.s - (b + .5) * CAR) % L) + L) % L; if (a === t && !c && sc > (W.i0 + 2) * DS && sc < (W.i1 - 2) * DS) log.push('c'); return f2(a, b, c); }; // seuls les wagons au-dessus du plancher
      render(1 / 30); drawCatwalk = f1; drawCar = f2; const lastW = log.lastIndexOf('w'), firstC = log.indexOf('c');
      return { n: W.segs.length, lastW, firstC, nc: log.filter(x => x === 'c').length }; });
    ok('E plancher de passerelle dessiné avant le train suspendu (le train est au-dessus)', !r.none && r.n > 0 && r.nc > 0 && r.lastW >= 0 && r.lastW < r.firstC, r);
    await page.close();
  }
  // ---------- C : OzIris, relevé OSM du 27/11 (tranchées w1585403561/2 level=-2 béton ; voie w1585403563, w421460641, w1585403564 layer=-1), coordonnées converties
  {
    // les relevés récents du jeu portent déjà ces deux tranchées (sans niveau ni matériau) ; un jeu plus ancien les ajoute ici
    const EXC = [[[12.7, 7.0], [8.8, 14.9], [14.8, 17.9], [18.7, 10.0], [12.7, 7.0]], [[17.9, -4.5], [21.7, -13.4], [28.0, -10.6], [24.3, -1.7], [17.9, -4.5]]];
    let page = await open(browser, 'oziris', errors);
    const r0 = await page.evaluate(() => { const sAt = (x, z) => { let b = 0, d = 1e9; for (let i = 0; i < N; i++) { const q = TR[i].p, e = Math.hypot(q.x - x, q.z - z); if (e < d) { d = e; b = i; } } return b * DS; };
      return { a: sAt(12.2, 16.3), b: sAt(24.9, -12.0), h: chunks.map(o => o.h), exc: LY.exc.map(e => [e.lv, e.m]), nExc: OSM.feats.filter(f => f.k === 'man_made=excavation').length, sw: [SW0.x, SW0.z], str: LY.str.length }; });
    ok('C sans niveaux : tranchées du jeu sans niveau ni matériau (les relevés OSM n\'ont pas encore les tags), aucune ajoutée', r0.exc.length === r0.nExc && r0.exc.every(e => e[0] == null && e[1] == null), r0);
    ok('D sans objet OSM : aucune structure sous le rail mobile', r0.str === 0, r0.str);
    ok('D pont droit : dalle des voies de garage et heurtoirs non calculés', await page.evaluate(() => typeof drawTraverser === 'undefined' && typeof drawTable === 'undefined'));
    await shot(page, 'oziris-avant', 2, 3, 7);
    await page.close();
    const r0nExc = Math.max(r0.nExc, 2), a = Math.min(r0.a, r0.b), b = Math.max(r0.a, r0.b);
    patch('oziris', `OSM.levels=[[${a},${b},-1]];` + EXC.map((pl, i) => { const id = 'w158540356' + (i + 1); return `{let w=OSM.feats.find(f=>f.id==='${id}');if(!w)OSM.feats.push(w={k:'man_made=excavation',n:null,c:1,p:${JSON.stringify(pl)},id:'${id}',v:1});w.t={'man_made':'excavation','level':'-2','material':'concrete'};}`; }).join('')
      + `{const w=OSM.feats.find(f=>f.id==='w420028794');if(w)w.t={'natural':'water','level':'0'};}`
      + [[-1, 0], [1, 6]].map(([lv, d], i) => { const x = r0.sw[0] + d, z = r0.sw[1] + d; return `OSM.feats.push({k:'man_made=structure',n:null,c:1,p:${JSON.stringify([[x - 3, z - 3], [x + 3, z - 3], [x + 3, z + 3], [x - 3, z + 3], [x - 3, z - 3]])},id:'w9${i}',v:1,t:{'man_made':'structure','material':'steel','level':'${lv}'}});`; }).join(''));
    page = await open(browser, 'oziris', errors);
    const r = await page.evaluate(([a, b]) => { const inR = o => { const i = chunks.indexOf(o); return true; };
      const sub = []; for (let i = 0; i < N; i++) if (i * DS > a + 1 && i * DS < b - 1) sub.push(chunkH[i]);
      const out = []; for (let i = 0; i < N; i++) if (i * DS < a - 10 || i * DS > b + 10) out.push(chunkH[i]);
      const t = TUN.find(t => t.a < b && t.b > a); return { PROF_AFF, sub: [...new Set(sub)], outLow: out.filter(h => h === PROF_AFF).length, exc: LY.exc.map(e => [e.lv, e.m]), tun: t && { under: t.under, h: t.h } }; }, [a, b]);
    ok('C voie layer=-1 : profondeur d\'affichage commune (PROF_AFF, ESTIMÉE)', r.sub.length === 1 && r.sub[0] === r.PROF_AFF && r.outLow === 0, r);
    ok('C tranchées man_made=excavation lues (niveau -2, béton)', r.exc.length === r0nExc && r.exc.filter(e => e[0] === -2 && e[1] === 'concrete').length === 2 && r.exc.filter(e => e[0] == null).length === r0nExc - 2, r.exc);
    ok('C tunnel sous l\'eau : couverture au-dessus de la voie, sous le sol (eau, niveau 0)', r.tun && r.tun.under === 'water' && r.tun.h > r.PROF_AFF && r.tun.h < 0, r.tun);
    await shot(page, 'oziris-apres', 2, 3, 7);
    const d = await page.evaluate(() => { let n = 0, up = 0; const f = drawStruct; drawStruct = o => { n++; if (o.lv > 0) up++; return f(o); }; render(1 / 30); drawStruct = f;
      return { str: LY.str.map(o => [o.lv, o.m]), n, up }; });
    ok('D structures man_made=structure lues (acier, niveaux -1 et 1) et dessinées (sous et au-dessus du rail)', d.str.length === 2 && d.n === 2 && d.up === 1 && d.str.every(o => o[1] === 'steel'), d);
    await page.close();
  }
  // ---------- D bis : appareil rotatif (Goudurix) : ni carter ni dalle ni heurtoirs calculés ; carter seulement s'il est dans OSM (man_made=structure)
  {
    let page = await open(browser, 'goudurix', errors);
    const r0 = await page.evaluate(() => { let n = 0; const f = drawStruct; drawStruct = o => { n++; return f(o); }; render(1 / 30); drawStruct = f;
      return { rot: !!ROT, str: LY.str.length, n, calc: [typeof drawTraverser, typeof drawTable], sw: [SW0.x, SW0.z] }; });
    ok('D rotatif sans objet OSM : aucune structure, aucun dessin calculé (dalle, heurtoirs, carter)', r0.rot && r0.str === 0 && r0.n === 0 && r0.calc.every(t => t === 'undefined'), r0);
    await shot(page, 'goudurix-sans', r0.sw[0], r0.sw[1], 7);
    await page.close();
    patch('goudurix', `OSM.feats.push({k:'man_made=structure',n:null,c:1,p:${JSON.stringify([[r0.sw[0] - 2, r0.sw[1] - 2], [r0.sw[0] + 2, r0.sw[1] - 2], [r0.sw[0] + 2, r0.sw[1] + 2], [r0.sw[0] - 2, r0.sw[1] + 2], [r0.sw[0] - 2, r0.sw[1] - 2]])},id:'w95',v:1,t:{'man_made':'structure','material':'steel','level':'-1'}});`);
    page = await open(browser, 'goudurix', errors);
    const d = await page.evaluate(() => { SITE.yard.slab = 1; let n = 0; const f = drawStruct; drawStruct = o => { n++; return f(o); }; render(1 / 30); drawStruct = f; return { str: LY.str.length, n }; });
    ok('D rotatif : carter lu depuis man_made=structure et dessiné ; yard.slab ignoré sans erreur', d.str === 1 && d.n === 1, d);
    await shot(page, 'goudurix-avec', r0.sw[0], r0.sw[1], 7);
    await page.close();
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log(errors.length ? 'pageerror : ' + errors.join(' | ') : 'pageerror : aucune');
  console.log(fails ? fails + ' ÉCHEC(S)' : 'PASS');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fails || errors.length ? 1 : 0);
})();
