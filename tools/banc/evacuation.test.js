// Micro-test : évacuation devant une barrière de file fermée (osmrides#73). Deux évacués partis collés (5 cm, deux de front qui se rejoignent), celui qui suit plus
// rapide : il attend que celui qui le précède s'écarte (QD), ne le traverse ni ne le double, et les deux s'arrêtent devant la barrière à QPW au moins l'un de l'autre.
require('./lib.js').essai('evacuation', async ({ ouvrir, ok }) => {
  const page = await ouvrir({});
  const r = await page.evaluate(() => {
    clearQueue(); G.walkers.length = 0; G.open = false;
    const e = SEG_IN, d = Math.min(e.len * .5, 12); let i = 1; while (i < e.P.length - 1 && e.C[i] < d) i++;
    const a = e.P[i - 1], b = e.P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = (d - e.C[i - 1]) / l, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    GM.barriers = { b1: { x: a[0] + tx * l * k - tz * 1.3, z: a[1] + tz * l * k + tx * 1.3, ang: Math.atan2(-tx, tz) * 180 / Math.PI, len: 2.6, open: false } }; reGates();
    const P = queueTail(), dx = P[1][0] - P[0][0], dz = P[1][2] - P[0][2], n = Math.hypot(dx, dz) || 1, Q = P.slice(); Q[0] = [P[0][0] + dx / n * .05, 0, P[0][2] + dz / n * .05]; Q.qn = P.qn;
    walker(P, 0, null, 3.8, 0, 'evac'); walker(Q, 1, null, 3, 0, 'evac'); const [F, L] = G.walkers.slice(-2); // F suit (plus rapide), L précède (5 cm devant)
    let minRun = 9, over = 0, stopped = false;
    for (let t = 0; t < 400; t++) { step(.05); const dd = Math.hypot(F.x - L.x, F.z - L.z); if (!F.bk && !L.bk && !stopped) { if (t > 20) minRun = Math.min(minRun, dd); if (F.bdd < L.bdd - 1e-6) over++; } else stopped = true; }
    const end = Math.hypot(F.x - L.x, F.z - L.z); GM.barriers = {}; reGates();
    return { minRun: +minRun.toFixed(2), over, end: +end.toFixed(2), Fbk: !!F.bk, Lbk: !!L.bk, QD, QPW };
  });
  ok('en marche, celui qui suit ne traverse ni ne double celui qui le précède', r.over === 0, r);
  ok('en marche, écart d\'au moins QD une fois repartis (jamais l\'un sur l\'autre)', r.minRun >= r.QD - .02, r);
  ok('arrêtés devant la barrière fermée, à QPW au moins l\'un de l\'autre', r.Fbk && r.Lbk && r.end >= r.QPW, r);
  await page.close();
});
