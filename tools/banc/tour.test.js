// Micro-test : un tour complet sur les variantes du mini-site (gare, lift, zone de freinage de bloc, zone finale, retour en gare) sans erreur de page :
// coaster assis, inversé avec passerelle, avec pont transbordeur (rail mobile), avec toit, quai, tranchée et structures. Quelques images seulement (une tous les 40 pas).
require('./lib.js').essai('tour', async ({ ouvrir, ok }) => {
  const variantes = { assis: { freins: true }, 'inversé + passerelle': { inverse: true, passerelle: true, freins: true }, 'pont (rail mobile)': { pont: true },
    'gare, tranchée, structures': { toit: true, quai: true, tranchee: true, structure: true } };
  for (const [nom, opt] of Object.entries(variantes)) {
    const page = await ouvrir(opt, { width: 320, height: 240 });
    const r = await page.evaluate(() => { const t = trains[0], o = trains[1]; o.st = 'garage'; t.st = 'run'; t.s = S_ST; t.v = 0; t.wear = 0; G.wear.chain = G.wear.brake = G.wear.track = 0;
      const zones = new Set(); let tour = 0, s0 = t.s, prev = t.s;
      for (let i = 0; i < 6000 && tour < 1; i++) { step(.05); if (i % 40 === 0) render(.05); if (t.st === 'run') zones.add(zoneOf(t.s)); if (t.s < prev - L / 2) tour++; prev = t.s; }
      render(1 / 30); return { tour, zones: [...zones], st: t.st, L: +L.toFixed(1), TRAV }; });
    ok('un tour complet : ' + nom, r.tour >= 1 && r.zones.includes('lift'), r);
    await page.close();
  }
});
