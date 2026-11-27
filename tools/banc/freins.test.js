// Micro-test (b) : état des mâchoires de frein dessinées (BZS[zone].c : 0 = écartées, 1 = serrées ; brakeState de dessin.js, commits 7fb216f et abc21dc).
// Relâchées zone libre, serrées au pupitre (MANU), serrées sur un train retenu, et ouvertes sur un train qui ralentit seul en montée (ralentissement libre : pas un freinage).
require('./lib.js').essai('freins', async ({ ouvrir, ok }) => {
  const page = await ouvrir({ montee: true }, { width: 320, height: 240 });
  const r = await page.evaluate(() => {
    // le dessin coûte 8 ms l'image : un rendu tous les 2 pas seulement
    const fr = n => { for (let i = 0; i < n; i++) { step(1 / 60); if (i % 2) render(1 / 30); } }, z = BZ.find(b => b.id === 'B1'), t = trains[0], o = trains[1], res = {};
    o.st = 'garage'; t.st = 'run'; t.wear = 0; t.v = 0;
    t.s = z.r0 - 60; t.v = 0; fr(120); res.libre = BZS.B1.c;                                      // zone vide, section suivante libre : mâchoires écartées
    act('zone', 'B1:m'); act('zone', 'B1:k'); fr(60); res.serre = BZS.B1.c; res.k = zK('B1');      // MANU puis FREIN : serrées
    act('zone', 'B1:k'); fr(60); res.relache = BZS.B1.c; res.k2 = zK('B1'); act('zone', 'B1:m');  // relâchées de nouveau
    // ralentissement libre : le train entre en montée dans la zone libre à 8 m/s, perd de la vitesse seul, les mâchoires restent écartées
    t.st = 'run'; t.s = z.r0 - TLEN - 1; t.v = 8; let cmax = 0, vin = null, vout = null;
    for (let i = 0; i < 700; i++) { step(1 / 60); if (i % 2) render(1 / 30); if (t.s > z.r0 && t.s - TLEN < z.r1) { if (vin == null) vin = t.v; vout = t.v; cmax = Math.max(cmax, BZS.B1.c); } if (t.s > z.r1 + TLEN + 2) break; }
    res.libreMax = cmax; res.vin = vin; res.vout = vout;
    // train retenu : la section suivante (zone finale) est occupée, il s'arrête dans B1, mâchoires serrées
    const zf = BZ.find(b => b.id !== 'B1' && b.r0 > z.r1 && b.drive !== undefined); o.st = 'run'; o.v = 0; o.s = zf ? (zf.r0 + zf.r1) / 2 : z.r1 + 8;
    t.st = 'run'; t.s = z.r0 - TLEN - 1; t.v = 8; fr(600); res.retenu = BZS.B1.c; res.vretenu = t.v;
    return res; });
  ok('zone vide, freins relâchés : mâchoires écartées', r.libre < .1, r);
  ok('MANU + FREIN : mâchoires serrées', r.k && r.serre > .8, r);
  ok('relâchées au pupitre : mâchoires écartées', !r.k2 && r.relache < .1, r);
  ok('ralentissement libre en montée : le train perd de la vitesse, mâchoires restées écartées', r.vin - r.vout > 1 && r.libreMax < .3, r);
  ok('train retenu par la section suivante occupée : arrêté, mâchoires serrées', r.vretenu < .05 && r.retenu > .8, r);
  await page.close();
});
