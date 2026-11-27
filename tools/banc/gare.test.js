// Micro-test (d) : gare lue dans OSM (commit f1ed74a ; docs/ref/quai.md « Modèle de gare lu dans OSM ») : quai = zone railway=platform, toit = le bâtiment OSM
// (jamais la zone), arrêt le long du quai même si la gare taguée est plus courte que le train, places d'attente sans superposition, zone d'attente éditée trop courte.
require('./lib.js').essai('gare', async ({ ouvrir, ok }) => {
  const sonde = () => { const f = mkF(), QO = typeof QUAI_OSM === 'undefined' ? null : QUAI_OSM, P = QO || SITE.stationPoly, pin = (x, z) => pinP(P, x, z), at = s => (frameAt(s, f), [f.p.x, f.p.z]);
    let m = 9; for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) { const a = slotPos(i), b = slotPos(j); m = Math.min(m, Math.hypot(a[0] - b[0], a[2] - b[2])); }
    const st = LY.bld.filter(b => b.st);
    return { quai: !!QO, S_ST: +S_ST.toFixed(2), st1: +TAG.st1.toFixed(2), TLEN, plat: SITE.plat, rear: pin(...at(S_ST - TLEN)), front: pin(...at(S_ST)), minSlot: +m.toFixed(2),
      nSt: st.length, canopy: st[0] && st[0].canopy, rf: st[0] && st[0].rf && st[0].rf.shape, rc: st[0] && st[0].rc, nBld: LY.bld.length }; };
  let page = await ouvrir({ toit: true });
  const a = await page.evaluate(sonde);
  ok('sans railway=platform : aucun quai OSM, quais de SITE.plat, arrêt au plus à st1', !a.quai && a.plat.load === 5 && a.plat.exit === 3 && a.S_ST <= a.st1 + .01, a);
  ok('sans zone railway=platform : le toit est le bâtiment OSM, forme et couleur lues dans ses tags', a.nSt === 1 && a.rf === 'gabled' && a.rc === '#b8a98c', a);
  await page.close();
  page = await ouvrir({ toit: true, quai: true, quaiCourt: true });
  const b = await page.evaluate(sonde);
  ok('quai = zone railway=platform : profondeurs lues dans la zone (3 m et 4 m de l\'axe)', b.quai && [b.plat.load, b.plat.exit].sort().every((v, i) => Math.abs(v - [3, 4][i]) < .6) && b.plat.back >= 0 && b.plat.front >= 0, b);
  ok('gare taguée plus courte que le train : arrêt au-delà de st1, train entier le long du quai', b.TLEN > 4 && b.S_ST > b.st1 && b.rear && b.front, b);
  ok('places d\'attente sans superposition', b.minSlot >= .55, b);
  ok('toit : le bâtiment OSM seul (la zone railway=platform n\'est pas un bâtiment)', b.nSt === 1 && b.canopy && b.rf === 'gabled' && b.nBld === a.nBld, b);
  const c = await page.evaluate(() => { GM.boardAreas = [{ id: 'quai', pts: (() => { const P = boardAreaCalc(), z = P.map(p => p[1]), m = (Math.min(...z) + Math.max(...z)) / 2; return P.map(p => [p[0], m + (p[1] - m) * .6]); })() }]; reBoard();
    let m = 9; for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) { const a = slotPos(i), b = slotPos(j); m = Math.min(m, Math.hypot(a[0] - b[0], a[2] - b[2])); } return { m: +m.toFixed(2) }; });
  ok('zone d\'attente éditée trop courte : places repliées jamais l\'une sur l\'autre', c.m >= .55, c);
  await page.close();
});
