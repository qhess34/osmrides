// Micro-test (osmrides#72) : aiguillage coulissant à deux groupes de rails (docs/manoeuvres.md « Positions des rails mobiles »).
// Sans yard.rails : un seul groupe (chariot commun), groupe défaisable dans l'éditeur. Deux groupes : le tronçon en S bouge seul, le circuit reste passant tant que
// le tronçon droit est en ligne ; le S ne vient sur la voie que si le tronçon droit est retiré ; aucun rail en ligne : le train est retenu en gare.
require('./lib.js').essai('aiguillage-rails', async ({ ouvrir, ok }) => {
  const run = n => { for (let i = 0; i < n; i++) step(.05); };
  let page = await ouvrir({});
  const a = await page.evaluate(() => { const R = railsEd(); return { SWI, RM, lockable: R.lockable, locked: R.locked, cars: R.rails.map(r => r.car), ord: POS_ORDER, off: OFF }; });
  ok('groupe unique (sans yard.rails) : chariot commun, inchangé, et « Défaire le groupe » permis', !a.SWI && !a.RM && a.lockable && a.locked && a.cars.every(c => c) && JSON.stringify(a.ord) === '[0,1]', a);
  await page.close();
  page = await ouvrir({ railsS: true });
  const b = await page.evaluate(() => { const R = railsEd(); return { SWI, RM, locked: R.locked, cars: R.rails.map(r => [r.id, r.car]), ord: POS_ORDER, ra: G.ra.pos, dev: G.dev.pos, RET }; });
  ok('groupe défait : tronçon droit seul (en ligne), tronçon en S seul hors ligne', b.SWI && b.RM && !b.locked && JSON.stringify(b.cars) === '[["circuit",false],["garage",true]]' && b.ra === 0 && b.dev === 0 && Math.abs(b.RET - 3.4) < .01 && b.ord.length === 3, b);
  const c = await page.evaluate(run => { const X = POS_ORDER.find(p => p >= PX0); act('pos', X); for (let i = 0; i < 200; i++) step(.05);
    return { dev: G.dev.pos, X, ra: G.ra.pos, raC: raC(), devC: devC(), off: devOff(), hold: devHoldOn(), br: blockReason(trains.find(t => t.st === 'station') || trains[0]) || '' }; });
  ok('S seul déplacé (position Attente) : tronçon droit en ligne, circuit passant, aucune retenue', c.dev === c.X && c.ra === 0 && c.raC === 0 && Math.abs(c.devC - 1.7) < .01 && !c.off && !c.hold && !/hors de P/.test(c.br), c);
  const d = await page.evaluate(() => { act('pos', 1); for (let i = 0; i < 200; i++) step(.05); return { to: G.dev.to, dev: G.dev.pos }; });
  ok('S refusé sur la voie tant que le tronçon droit est en ligne', d.to === c.X && d.dev === c.X, d);
  const e = await page.evaluate(() => { act('ra', 1); for (let i = 0; i < 200; i++) step(.05); const t = trains.find(o => o.st === 'station') || trains[0];
    return { ra: G.ra.pos, off: devOff(), hold: devHoldOn(), on: devOn(0), br: blockReason(t) || '', HZ: HOLD_Z }; });
  ok('aucun rail en ligne : train retenu en gare (règle de retenue), aucune voie desservie', e.ra === 1 && e.off && e.hold && !e.on && e.HZ === 'St' && /hors de P/.test(e.br), e);
  const f = await page.evaluate(() => { act('pos', 1); for (let i = 0; i < 200; i++) step(.05); const on = devOn(0); act('ra', 0); for (let i = 0; i < 200; i++) step(.05);
    return { dev: G.dev.pos, on, ra: G.ra.pos, rato: G.ra.to }; });
  ok('tronçon droit retiré : S en place sur la voie ; le tronçon droit ne revient pas tant que le S est en ligne', f.dev === 1 && f.on && f.ra === 1 && f.rato === 1, f);
  await page.close();
});
