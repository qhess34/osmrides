'use strict';
/* Constructeur de mini-sites synthétiques du banc d'essai (docs/ref/banc.md). Aucune donnée d'un lieu réel : un petit circuit fermé d'environ 180 m
   (gare, lift, descente, zone de freinage), des chemins de file et de sortie, et des options qui ajoutent chacune un objet OSM ou un réglage de SITE.
   Usage : const { construire, ecrire } = require('./constructeur.js'); ecrire(dossier, { inverse: true, passerelle: true }) -> <dossier>/site.js
   (page : banc.html?site=<dossier>/site.js). Repères : x est, z sud, mètres ; le train circule dans le sens des z croissants le long de la gare (x = 0).
   Options (toutes facultatives, fausses par défaut) :
     inverse      coaster inversé (SITE.kind 'inverted' : train suspendu sous la voie)
     passerelle   passerelles de service du lift (SITE.catwalks, plancher galvanisé sous la voie d'un coaster inversé)
     toit         toit de gare : bâtiment OSM building=roof de l'emprise de la gare, forme et couleur dans ses tags (f.t)
     quai         zone railway=platform le long de la voie (quai lu dans OSM, de 3 m et 4 m de part et d'autre de l'axe)
     quaiCourt    gare taguée station de 4 m, plus courte que le train de 6 m, quai commençant à 1 m de st0 (arrêt au-delà de st1)
     tranchee     tranchée man_made=excavation (level -2, béton) et voie en niveau -1 (OSM.levels)
     structure    structure man_made=structure (acier, niveaux -1 et 1) sous le rail mobile
     (garage)     toujours déclaré (le moteur exige SITE.yard) : aiguillage coulissant et une voie
     pont         pont transbordeur à la place de l'aiguillage : rail mobile sur la zone finale (SITE.yard device 'traverser', deux voies)
     freins       une zone de freinage de bloc en parcours (B1, repères bz1/blk1 sur le retour) en plus de la zone finale brk/fin
     montee       la zone de bloc B1 est en montée (bosse de 3 m : ralentissement libre du train sous les mâchoires) ; implique freins
     wagons       nombre de wagons par train (défaut 4), trains : nombre de trains (défaut 2) */
const R = 6, PAS = 2;
const arrondi = v => Math.round(v * 100) / 100;

// Circuit : A (gare, vers le sud) -> B (lift, vers l'est) -> C (descente, vers le nord) -> D (zone de freinage, vers l'ouest) -> A. Coins arrondis de rayon R.
function circuit(o) {
  const pts = []; // [x, h, z, dévers, repère…]
  const droit = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / PAS)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n, 0]); };
  const arc = (cx, cz, a0, a1) => { const n = Math.max(3, Math.round(Math.abs(a1 - a0) * R / PAS)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + R * Math.cos(a), 0, cz + R * Math.sin(a), 0]); } };
  const X0 = 0, X1 = 40, Z0 = -36, Z1 = 32; // rectangle de la voie (axes des quatre côtés)
  droit(X0, Z0 + R, X0, Z1 - R);                       // A : gare vers le sud
  arc(X0 + R, Z1 - R, Math.PI, Math.PI / 2);           // coin sud-ouest (vers l'est)
  droit(X0 + R, Z1, X1 - R, Z1);                       // B : lift vers l'est
  arc(X1 - R, Z1 - R, Math.PI / 2, 0);                 // coin sud-est (vers le nord)
  droit(X1, Z1 - R, X1, Z0 + R);                       // C : descente vers le nord
  arc(X1 - R, Z0 + R, 0, -Math.PI / 2);                // coin nord-est (vers l'ouest)
  droit(X1 - R, Z0, X0 + R, Z0);                       // D : zone de freinage vers l'ouest
  arc(X0 + R, Z0 + R, -Math.PI / 2, -Math.PI);         // coin nord-ouest (vers le sud)
  const at = (x, z) => { let b = 0, d = 1e9; pts.forEach((p, i) => { const e = Math.hypot(p[0] - x, p[2] - z); if (e < d) { d = e; b = i; } }); return b; };
  // hauteurs (ESTIMÉES) : gare et retour à 4 m, lift de 4 à 12 m sur B, descente de 12 à 4 m le long de C
  const iL0 = at(X0 + R, Z1), iL1 = at(X1 - R, Z1), iC1 = at(X1, Z0 + R);
  pts.forEach((p, i) => { p[1] = i <= iL0 ? 4 : i <= iL1 ? 4 + 8 * (i - iL0) / (iL1 - iL0) : i <= iC1 ? 12 - 8 * (i - iL1) / (iC1 - iL1) : 4; });
  const rep = (i, n) => pts[i].push(n);
  const ST = o.quaiCourt ? [-10, -6] : [-14, 0]; // gare taguée station : 14 m, ou 4 m (plus courte que le train de 6 m) avec quaiCourt
  rep(at(X0, ST[0]), 'st0'); rep(at(X0, ST[1]), 'st1'); rep(iL0, 'lift0'); rep(iL1, 'lift1');
  // zone de freinage de bloc (option freins) : bz1 -> blk1 sur D, en montée si `montee` (bosse de 3 m sous la zone) ; zone finale brk -> fin avant la gare
  if (o.freins || o.montee) { rep(at(X1 - 7, Z0), 'bz1'); rep(at(X1 - 13, Z0), 'blk1'); }
  if (o.montee) pts.forEach(p => { if (Math.abs(p[2] - Z0) < .01 && p[0] > X1 - 22 && p[0] < X1 - 4) p[1] = 4 + 3 * Math.sin(Math.PI * (X1 - 4 - p[0]) / 18) * (p[0] > X1 - 13 ? 1 : 1); });
  rep(at(X0 + 22, Z0), 'brk'); rep(at(X0 + 12, Z0), 'fin');
  pts.forEach(p => { p[0] = arrondi(p[0]); p[1] = arrondi(p[1]); p[2] = arrondi(p[2]); });
  return pts;
}

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];

function construire(opt) {
  const o = Object.assign({ wagons: 4, trains: 2 }, opt);
  const cps = circuit(o);
  const OSM = { cps, doors: [[-8, 6, 'main', null, 'n1', 3], [4, -8, 'exit', null, 'n2', 3]], barriers: [], tunnels: [], feats: [], others: [], trees: [], pois: [], deco: [], attrs: {} };
  const queue = [[-26, 22], [-24, 14], [-20, 8], [-12, 8], [-6, 6]], sortie = [[4, -8], [10, -12], [16, -14]], prom = [[-30, 26], [-26, 22]];
  OSM.paths = { queue, prom, xout: sortie };
  // bâtiment de gare : polygone de la gare (SITE.stationPoly), lu aussi comme bâtiment OSM quand `toit` est demandé
  const gare = rect(-6, -18, 6, 4);
  OSM.polys = { station: gare };
  if (o.toit) OSM.feats.push({ k: 'building=roof', n: null, c: 1, p: gare.map(q => q.slice()), id: 'w1', v: 1, t: { building: 'roof', height: '6', 'roof:shape': 'gabled', 'roof:orientation': 'along', 'roof:height': '2', 'roof:colour': '#b8a98c' } });
  if (o.quai) OSM.feats.push({ k: 'railway=platform', n: null, c: 1, p: rect(-4, o.quaiCourt ? -9 : -16, 3, 2), id: 'w2', v: 1, t: { railway: 'platform', level: '1' } });
  if (o.tranchee) { OSM.feats.push({ k: 'man_made=excavation', n: null, c: 1, p: rect(18, 24, 30, 32), id: 'w3', v: 1, t: { man_made: 'excavation', level: '-2', material: 'concrete' } }); OSM.levels = [[120, 150, -1]]; }
  if (o.structure) for (const [i, lv] of [-1, 1].entries()) OSM.feats.push({ k: 'man_made=structure', n: null, c: 1, p: rect(-3 + i * 6, 12 + i * 6, 3 + i * 6, 18 + i * 6), id: 'w' + (4 + i), v: 1, t: { man_made: 'structure', material: 'steel', level: String(lv) } });
  const site = {
    id: 'banc', title: 'Banc d\'essai', kind: o.inverse ? 'inverted' : 'steel', trackName: 'Voie', goal: 100,
    car: { len: 1.5, n: o.wagons, seats: 2 },
    trains: Array.from({ length: o.trains }, (_, i) => ({ name: 'Train ' + (i + 1), col: '#3a5a8a', col2: '#d0d4da', wear: 20 })),
    stopBack: .5, dropAfter: 20, phys: { roll: .08, drag: .001, vmin: 3 },
    stationPoly: 'POLY', stationAt: [0, -7, 8], stationRoofCol: '#a89a7c', fade: [[0, -7, 8]],
    plat: { load: 5, exit: 3, back: .5, front: 1.5 },
    booth: [4.5, -2, 0], boothLabel: [7, -4], beacon: [4.8, -4],
    queue: { entry0: queue[0], link: [[-28, 24]], ways: [queue], parts: [{ pts: queue }] },
    paths: [], approach: [{ w: 1, pts: prom }],
    board: { via: [queue[queue.length - 1]], walk: 3.5 },
    exit: { door: sortie[0], path: sortie, tails: [sortie.slice(), sortie.slice()] },
    jobsites: { liftFix: [20, 38], chainRev: [20, 38], trackRev: [44, -8], brakeFix: [20, -42], brakeRev: [20, -42], trainRev: [-12, -10], rearm: [8, -6] },
    view: { x: 14, z: -2, w: 110, h: 100, bounds: [-40, 70, -60, 56] },
    cams: { gare: { label: 'Gare', x: 0, z: -7, s: 14 }, lift: { label: 'Lift', x: 20, z: 32, s: 12 } },
    labels: 'LABELS'
  };
  if (o.passerelle) site.catwalks = { side: { Lift: 1 } }; else site.catwalks = false;
  // garage : toujours déclaré (le moteur exige SITE.yard) ; aiguillage coulissant en aval de la gare, une voie à l'est
  site.yard = { at: 'station', device: 'switch', a: .8, b: 6.4, slide: 3.4, side: -1, len: 8.6, lanes: [{ name: 'Garage', pts: [[5, 8], [5, 24]] }], move: { v: 2.4, t: 3 } };
  // pont transbordeur (rail mobile qui emporte le train) sur la zone finale, deux voies droites parallèles (d = distance à l'axe du circuit)
  if (o.pont) site.yard = { at: 'brake', device: 'traverser', single: true, railName: 'Rail du pont', side: 1, post: .6, laneGap: .8, move: { v: 1.5, vc: .5, t: 4 }, lanes: [{ name: 'Voie 1', d: 3, len: 9, cap: 1 }, { name: 'Voie 2', d: 7, len: 9, cap: 1 }] };
  return { OSM, site };
}

// Source du fichier site.js : `const OSM`, puis `const SITE` (le moteur lit ces deux constantes, comme les fichiers .data.js et .js d'un jeu)
function source(opt) {
  const { OSM, site } = construire(opt);
  const j = JSON.stringify(site).replace('"POLY"', 'OSM.polys.station').replace('"LABELS"', '()=>[]');
  return `'use strict';\nconst OSM=${JSON.stringify(OSM)};\nconst SITE=${j};\n`;
}
function ecrire(dossier, opt) {
  const fs = require('fs'), path = require('path');
  fs.mkdirSync(dossier, { recursive: true });
  const f = path.join(dossier, 'site.js'); fs.writeFileSync(f, source(opt)); return f;
}
module.exports = { construire, source, ecrire };
