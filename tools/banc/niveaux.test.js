// Micro-test : niveaux et structures OSM (issue #68, tools/toits-niveaux-test.js C et D sur un site fabriqué) : tranchées man_made=excavation lues (niveau -2, béton),
// voie de niveau -1 à la profondeur d'affichage commune (PROF_AFF), structures man_made=structure (acier, niveaux -1 et 1) lues et dessinées ; sans objet OSM : rien de calculé.
require('./lib.js').essai('niveaux', async ({ ouvrir, ok }) => {
  let page = await ouvrir({});
  const a = await page.evaluate(() => { let n = 0; const f = drawStruct; drawStruct = o => { n++; return f(o); }; render(1 / 30); drawStruct = f;
    return { exc: LY.exc.length, str: LY.str.length, n, calc: [typeof drawTraverser, typeof drawTable] }; });
  ok('sans objet OSM : ni tranchée ni structure, aucun dessin de dalle ou d\'heurtoirs calculé', a.exc === 0 && a.str === 0 && a.n === 0 && a.calc.every(t => t === 'undefined'), a);
  await page.close();
  page = await ouvrir({ tranchee: true, structure: true });
  const b = await page.evaluate(() => { const lv = OSM.levels[0], sub = [], out = []; for (let i = 0; i < N; i++) { const s = i * DS; if (s > lv[0] + 1 && s < lv[1] - 1) sub.push(chunkH[i]); else if (s < lv[0] - 10 || s > lv[1] + 10) out.push(chunkH[i]); }
    let n = 0, up = 0; const f = drawStruct; drawStruct = o => { n++; if (o.lv > 0) up++; return f(o); }; render(1 / 30); drawStruct = f;
    return { PROF_AFF, sub: [...new Set(sub)], outLow: out.filter(h => h === PROF_AFF).length, exc: LY.exc.map(e => [e.lv, e.m]), str: LY.str.map(o => [o.lv, o.m]), n, up }; });
  ok('voie de niveau -1 : profondeur d\'affichage commune sur son tronçon seulement', b.sub.length === 1 && b.sub[0] === b.PROF_AFF && b.outLow === 0, b);
  ok('tranchée man_made=excavation lue (niveau -2, béton)', b.exc.length === 1 && b.exc[0][0] === -2 && b.exc[0][1] === 'concrete', b.exc);
  ok('structures man_made=structure lues (acier, niveaux -1 et 1) et dessinées', b.str.length === 2 && b.n === 2 && b.up === 1 && b.str.every(o => o[1] === 'steel'), b);
  await page.close();
});
