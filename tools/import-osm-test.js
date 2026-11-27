'use strict';
// Test de l'import OSM (editor/import-osm.js, docs/ref/import-osm.md) : node tools/import-osm-test.js — sans réseau.
// 1. nombres comme Python (round, repr, sum, hypot) ; 2. extrait synthétique : circuit, repères, tags transportés f.t, OSM.levels, XML = JSON,
//    réimport sélectif (catégorie non cochée gardée au caractère près), circuit ouvert (avertissement, circuit actuel gardé), compléments à télécharger, tuiles ;
// 3. équivalence avec tools/make_site.py (si OSM_EXTRAIT=<extrait.osm> est donné, et python3) : chaque fiche de $JEU/tools/specs, même 2e ligne octet pour octet.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const I = require('../editor/import-osm.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ── 1. nombres ──
const R = [[2.675, 2, '2.67'], [-0.04, 1, '-0.0'], [0.125, 2, '0.12'], [1.005, 2, '1.0'], [-7.25, 1, '-7.2'], [123.45, 1, '123.5'], [0.5, 0, '0.0'], [1.5, 0, '2.0'], [2.5, 0, '2.0']];
ok(R.every(([x, n, s]) => I.pyRepr(I.pyRound(x, n)) === s), 'round(x, n) et repr comme Python');
ok([[1e16, '1e+16'], [1.5e-05, '1.5e-05'], [0.0001, '0.0001'], [123456789012345.6, '123456789012345.6'], [-0, '-0.0'], [4, '4.0'], [0.1 + 0.2, '0.30000000000000004']].every(([x, s]) => I.pyRepr(x) === s), 'repr des flottants comme Python');
ok(I.pyRepr(I.pysum(Array(10).fill(0.1)).v) === '1.0' && I.pyRepr(I.pysum([1, 0.1, 2, 0.2, 3], [1, 0, 1, 0, 1]).v) === '6.300000000000001', 'sum() de Python 3.12+ (compensée, entiers mêlés)');
ok(I.dumps({ a: 1n, b: 1, c: [0n, -0, 'é"'], d: null }) === '{"a":1,"b":1.0,"c":[0,-0.0,"é\\""],"d":null}', 'texte JSON de json.dumps (séparateurs, entiers, flottants, accents)');

// ── 2. extrait synthétique (aucun lieu réel) ──
const LAT = 45, LON = 5, KX = 111320 * Math.cos(LAT * Math.PI / 180), ll = (x, z) => ({ lat: +(LAT - z / 111320).toFixed(7), lon: +(LON + x / KX).toFixed(7) });
function extrait(o) {
  o = o || {}; const E = [], node = (id, x, z, tags) => E.push(Object.assign({ type: 'node', id, version: 1 }, ll(x, z), tags ? { tags } : {}));
  const way = (id, nodes, tags, v) => E.push({ type: 'way', id, version: v || 1, nodes, tags });
  // circuit : rectangle 120 x 40 m, 4 tronçons (gare, lift, parcours, frein), nœuds tous les 10 m
  const ring = []; let k = 1000; for (let x = 0; x < 120; x += 10) ring.push([x, 0]); for (let z = 0; z < 40; z += 10) ring.push([120, z]); for (let x = 120; x > 0; x -= 10) ring.push([x, 40]); for (let z = 40; z > 0; z -= 10) ring.push([0, z]);
  const ids = ring.map(q => { node(++k, q[0], q[1] + (o.bouge && k === 1006 ? 3 : 0)); return k; }); ids.push(ids[0]);
  const cut = [0, 3, 12, 28, ids.length - 1], role = ['station', 'lift_hill', null, 'brake_run'];
  for (let i = 0; i < 4; i++) if (!(o.ouvert && i === 2)) way(10 + i, ids.slice(cut[i], cut[i + 1] + 1), Object.assign({ roller_coaster: 'track' }, role[i] ? { 'roller_coaster:track': role[i] } : {}, i === 2 ? { layer: '1' } : {}));
  node(2001, -5, -8); node(2002, 30, -8); node(2003, 30, 8); node(2004, -5, 8);
  way(20, [2001, 2002, 2003, 2004, 2001], Object.assign({ building: 'yes', 'roof:shape': 'gabled' }, o.haut ? { height: '9' } : {}), o.haut ? 2 : 1); // gare
  node(2101, -30, -20); node(2102, -10, -20, { entrance: 'main' }); way(21, [2101, 2102], { highway: 'footway', surface: 'asphalt' }); // file
  node(2201, 40, 15); node(2202, 80, 15); node(2203, 80, 25); node(2204, 40, 25); way(22, [2201, 2202, 2203, 2204, 2201], { natural: 'water', layer: '-1' }); // eau
  node(2301, 50, -10); node(2302, 60, -10); node(2303, 60, -5); node(2304, 50, -5); way(23, [2301, 2302, 2303, 2304, 2301], { man_made: 'structure', material: 'steel' });
  node(2401, 90, -15, { natural: 'tree' });
  E.push({ type: 'relation', id: 30, version: 1, members: [{ type: 'way', ref: 22, role: 'outer' }, { type: 'way', ref: 999, role: 'outer' }], tags: { type: 'multipolygon', landuse: 'grass' } });
  return { elements: E };
}
const FICHE = JSON.stringify({ origin: [LAT, LON], bbox: [-60, 160, -40, 60], track_ways: [10, 11, 12, 13], start_way: 10, profile: [[0, 4], [30, 4, 'lin'], [60, 20], [200, 4]], level: 4, flat: [25, 300], paths: { queue: 21 }, queue_paths: ['queue'], polys: { station: 20 } });
const B = I.build(extrait(), FICHE), t1 = I.text(B.res), O = B.res;
ok(B.ok.circuit && O.cps.length > 30 && O.cps[0].includes('st0') && O.cps.some(r => r.includes('lift1')) && O.cps.some(r => r.includes('brk')), 'circuit assemblé, repères gare / lift / frein lus dans OSM (' + O.cps.length + ' points)');
ok(O.cps[0][1] === 4n && /"cps":\[\[-?[\d.]+,4,/.test(t1), 'hauteur de la gare écrite en entier comme make_site.py');
const bat = O.feats.find(f => f.id === 'w20'), st = O.feats.find(f => f.k === 'man_made=structure');
ok(bat && bat.t && bat.t['roof:shape'] === 'gabled' && st.t && st.t.material === 'steel' && O.feats.find(f => f.k === 'natural=water').t.layer === '-1', 'tags transportés f.t (toit, structure, niveau)');
ok(Array.isArray(O.levels) && O.levels.length === 1 && O.levels[0][2] === 1n && O.levels[0][0] > 0, 'OSM.levels : tronçon du circuit à layer=1 (s du moteur)');
ok(O.paths.queue.length === 2 && O.doors.length === 1 && O.trees.length === 1 && O.attrs.some(a => a.role === 'queue') && O.attrs.some(a => a.role === 'roof'), 'chemins, entrées, arbres, attributs');
const xml = '<osm>' + extrait().elements.map(e => e.type === 'node' ? `<node id="${e.id}" version="1" lat="${e.lat}" lon="${e.lon}">${Object.entries(e.tags || {}).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</node>`
  : e.type === 'way' ? `<way id="${e.id}" version="${e.version}">${e.nodes.map(n => `<nd ref="${n}"/>`).join('')}${Object.entries(e.tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</way>`
  : `<relation id="${e.id}" version="1">${e.members.map(m => `<member type="${m.type}" ref="${m.ref}" role="${m.role}"/>`).join('')}${Object.entries(e.tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</relation>`).join('') + '</osm>';
ok(I.text(I.build(xml, FICHE).res) === t1, 'extrait XML (.osm) et JSON de l\'API : même fichier');
ok(I.dumps(I.parseData(t1)) === t1.slice(t1.indexOf('const OSM=') + 10, -2), 'relecture d\'un fichier au caractère près (nombres gardés tels quels)');
// réimport sélectif : la gare est rehaussée et un nœud du circuit bouge dans OSM ; seuls les bâtiments sont cochés
const B2 = I.build(extrait({ bouge: true, haut: true }), FICHE), oldO = I.parseData(t1);
const m1 = I.merge(t1, B2, ['batiments']), T1 = I.text(m1), M1 = I.parseData(T1), D = v => I.dumps(v);
ok(D(M1.cps) === D(oldO.cps) && D(M1.levels) === D(oldO.levels) && D(M1.paths) === D(oldO.paths), 'bâtiments seuls : circuit, niveaux et chemins gardés au caractère près');
const b2 = M1.feats.find(f => f.id === 'w20');
ok(D(b2.v) === '2' && D(b2.bh) === '9.0' && !(b2.t && b2.t.height), 'bâtiments seuls : gare mise à jour (version, hauteur), tags f.t non cochés gardés');
ok(D(M1.feats.filter(f => f.id !== 'w20')) === D(oldO.feats.filter(f => f.id !== 'w20')), 'bâtiments seuls : autres objets du décor inchangés');
const m2 = I.merge(t1, B2, ['batiments', 'tags']), b3 = m2.feats.find(f => f.id === 'w20');
ok(b3.t && b3.t.height === '9', 'bâtiments + attributs : tags f.t mis à jour');
ok(I.text(I.merge(t1, B2, null)) === I.text(B2.res), 'tout coché : exactement le résultat de l\'import');
const sm = I.summary(t1, m1);
ok(sm.batiments.changes.some(c => /w20 .*version 1 → 2/.test(c)) && !sm.circuit.changes.length, 'aperçu : écart de la gare listé, aucun écart de circuit');
const sm2 = I.summary(t1, B2.res);
ok(sm2.circuit.changes.some(c => /tracé/.test(c)), 'aperçu tout coché : tracé modifié signalé');
// circuit ouvert (tronçon supprimé dans OSM)
const B3 = I.build(extrait({ ouvert: true, haut: true }), FICHE);
ok(!B3.ok.circuit && B3.warnings.some(w => /absent/.test(w)), 'tronçon de voie supprimé : avertissement, pas d\'arrêt');
const m3 = I.merge(t1, B3, null);
ok(D(m3.cps) === D(oldO.cps) && D(m3.src.track) === D(oldO.src.track) && m3.feats.find(f => f.id === 'w20').v === 2n, 'circuit ouvert : circuit actuel gardé, le reste importé');
let thrown = false; try { I.merge(null, B3, null); } catch (e) { thrown = true; } ok(thrown, 'premier import sans circuit refusé');
// téléchargement
const nd = I.needed(extrait().elements, JSON.parse(FICHE));
ok(nd.length === 1 && nd[0] === '/api/0.6/relation/30/full.json', 'compléments : multipolygone coupé par la zone relu en entier');
ok(I.needed(extrait({ ouvert: true }).elements, JSON.parse(FICHE)).includes('/api/0.6/way/12/full.json'), 'compléments : tronçon de la fiche absent relu en entier');
const P = I.plan(Object.assign(JSON.parse(FICHE), { bbox: [-2000, 2000, -1000, 1000] }));
ok(P.urls.length === 4 * 3 && P.urls.every(u => /^\/api\/0\.6\/map\.json\?bbox=[\d.,-]+$/.test(u)), 'zone découpée en tuiles (' + P.urls.length + ')');
ok(I.mergeElements([{ elements: [{ type: 'way', id: 5, version: 1 }] }, { elements: [{ type: 'way', id: 2, version: 1 }, { type: 'way', id: 5, version: 3 }] }]).map(e => e.id + ':' + e.version).join() === '2:1,5:3', 'extraits fusionnés : un objet par id, version la plus récente, par id croissant');

// ── 3. équivalence avec tools/make_site.py sur un vrai extrait (facultatif) ──
const EX = process.env.OSM_EXTRAIT, JEU = path.resolve(process.env.JEU || path.join(__dirname, '..', '..', 'osmrides_parks'));
const MS = path.join(JEU, 'tools', 'make_site.py');
if (!EX) console.log('--   équivalence avec make_site.py non vérifiée (donner OSM_EXTRAIT=<extrait .osm du lieu>)');
else {
  const els = I.mergeElements([fs.readFileSync(EX, 'utf8')]), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-osm-'));
  for (const f of fs.readdirSync(path.join(JEU, 'tools', 'specs')).filter(f => f.endsWith('.json'))) {
    const fiche = path.join(JEU, 'tools', 'specs', f), el = f.slice(0, -5), Bj = I.build(els, fs.readFileSync(fiche, 'utf8'), { sansNouveaux: true });
    if (!Bj.ok.circuit) { console.log('--  ', el, ': circuit non relu (', Bj.warnings[0], ') : comparaison impossible'); continue; }
    let py = null; try { execFileSync('python3', ['-I', MS, EX, fiche, path.join(tmp, el + '.py.js')], { stdio: 'ignore' }); py = fs.readFileSync(path.join(tmp, el + '.py.js'), 'utf8'); } catch (e) { console.log('--  ', el, ': make_site.py en échec ou python3 absent'); continue; }
    ok(py.split('\n')[1] === I.text(Bj.res).split('\n')[1], el + ' : même fichier que make_site.py, octet pour octet');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? 'ÉCHEC : ' + fails : 'PASS'); process.exit(fails ? 1 : 0);
