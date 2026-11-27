// Micro-test (a) : ordre de dessin du plancher d'une passerelle et du train (commit c554d7b ; docs/ref/voie.md « ordre de dessin d'une passerelle »).
// Coaster inversé : le plancher galvanisé (voie - 3 m) est dessiné AVANT le train suspendu (voie - 1,5 m) ; coaster assis : passerelle latérale, wagon dessiné APRÈS elle.
require('./lib.js').essai('passerelle', async ({ ouvrir, ok }) => {
  const sonde = () => { const W = CATW.walks.find(w => !w.lift && w.segs.some(g => g.fl === !!SITE.kind.match(/inverted/))) || CATW.walks.find(w => w.segs.length);
    if (!W) return { none: true };
    const i = Math.round((W.i0 + W.i1) / 2), t = trains[0]; t.st = 'run'; t.s = i * DS + CAR * 2.5; t.v = 0;
    const log = [], f1 = drawCatwalk, f2 = drawCar;
    drawCatwalk = g => { if (W.segs.includes(g)) log.push('w'); return f1(g); };
    drawCar = (a, b, c) => { const sc = (((t.s - (b + .5) * CAR) % L) + L) % L; if (a === t && !c && sc > (W.i0 + 2) * DS && sc < (W.i1 - 2) * DS) log.push('c'); return f2(a, b, c); };
    render(1 / 30); drawCatwalk = f1; drawCar = f2;
    return { n: W.segs.length, fl: W.segs.some(g => g.fl), lastW: log.lastIndexOf('w'), firstC: log.indexOf('c'), firstW: log.indexOf('w'), lastC: log.lastIndexOf('c'), nc: log.filter(x => x === 'c').length }; };
  let page = await ouvrir({ inverse: true, passerelle: true });
  const a = await page.evaluate(sonde);
  ok('inversé : plancher de passerelle dessiné avant le train suspendu', !a.none && a.fl && a.nc > 0 && a.lastW >= 0 && a.lastW < a.firstC, a);
  await page.close();
  page = await ouvrir({ passerelle: true });
  const b = await page.evaluate(sonde);
  ok('assis : passerelle latérale dessinée avant le wagon (le wagon la recouvre)', !b.none && !b.fl && b.nc > 0 && b.lastW >= 0 && b.lastW < b.firstC, b);
  await page.close();
});
