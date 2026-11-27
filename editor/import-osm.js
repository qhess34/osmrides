'use strict';
/* Import OSM d'un élément (osmrides#54, #57 point 7 ; docs/ref/import-osm.md) : portage en JavaScript, sans dépendance, de tools/make_site.py des jeux.
   Même entrée (extrait OSM : JSON de l'API 0.6 ou XML .osm ; fiche d'import tools/specs/<el>.json du dépôt de jeu), même sortie octet pour octet
   (lieux/<type>/<lieu>/<el>.data.js, `const OSM={…}`), plus les tags transportés `f.t` et `OSM.levels` (docs/ref/decor.md, voie.md).
   Réimport sélectif par catégorie (merge) : ce qui n'est pas choisi reste tel quel dans le fichier, au caractère près.
   Partagé par le serveur de l'éditeur (Node, require), les tests (Node) et l'interface (navigateur, window.ImportOSM : plan de téléchargement).
   Aucun nom ni coordonnée de lieu ici : tout vient de la fiche d'import. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.ImportOSM = f(); })(typeof self !== 'undefined' ? self : this, function () {

  // ── Nombres comme Python (même texte que json.dumps de make_site.py) : entiers Python = BigInt dans la sortie, flottants = Number ──
  class Raw { constructor(s) { this.s = s; } valueOf() { return Number(this.s); } } // nombre lu tel quel dans un fichier existant (gardé au caractère près)
  const DV = new DataView(new ArrayBuffer(8));
  function pyRound(x, n) { // round(x, n) de Python : arrondi exact de la valeur binaire, égalité vers le pair
    if (!isFinite(x) || x === 0) return x;
    DV.setFloat64(0, Math.abs(x)); const hi = DV.getUint32(0), lo = DV.getUint32(4), ex = (hi >>> 20) & 0x7ff;
    let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e; if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
    let num = m * 10n ** BigInt(n), den = 1n; if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
    let q = num / den; const r2 = 2n * (num - q * den); if (r2 > den || (r2 === den && (q & 1n))) q += 1n;
    const s = q.toString(), t = n > 0 ? (s.length <= n ? '0.' + '0'.repeat(n - s.length) + s : s.slice(0, -n) + '.' + s.slice(-n)) : s;
    const v = Number(t); return x < 0 ? -v : v;
  }
  function pyRoundInt(x) { const f = Math.floor(x), d = x - f; return d > .5 ? f + 1 : d < .5 ? f : (f % 2 === 0 ? f : f + 1); }
  function pyRepr(x) { // repr(float) de Python
    if (Object.is(x, -0)) return '-0.0'; if (x === 0) return '0.0'; if (!isFinite(x)) return isNaN(x) ? 'NaN' : x > 0 ? 'Infinity' : '-Infinity';
    let [mt, es] = x.toExponential().split('e'); const e = +es, neg = mt[0] === '-'; if (neg) mt = mt.slice(1); const d = mt.replace('.', '');
    let o;
    if (e < -4 || e >= 16) o = d[0] + (d.length > 1 ? '.' + d.slice(1) : '') + 'e' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0');
    else if (e >= 0) o = d.length <= e + 1 ? d + '0'.repeat(e + 1 - d.length) + '.0' : d.slice(0, e + 1) + '.' + d.slice(e + 1);
    else o = '0.' + '0'.repeat(-e - 1) + d;
    return (neg ? '-' : '') + o;
  }
  function pysum(xs, ints) { // sum() de Python 3.12+ (somme compensée de Neumaier) ; ints[k] vrai : xs[k] est un entier Python
    let i = 0, k = 0; const n = xs.length;
    for (; k < n && ints && ints[k]; k++) i += xs[k];
    if (k === n) return { v: i, int: true };
    let hi = i + xs[k++], lo = 0;
    for (; k < n; k++) { const x = xs[k]; if (ints && ints[k]) { hi += x; continue; } const t = hi + x; if (Math.abs(hi) >= Math.abs(x)) lo += (hi - t) + x; else lo += (x - t) + hi; hi = t; }
    return { v: lo && isFinite(lo) ? hi + lo : hi, int: false };
  }
  const fsum = xs => pysum(xs).v;
  const pmod = (a, b) => { let m = a % b; if (m) { if ((b < 0) !== (m < 0)) m += b; } else m = b < 0 ? -0 : 0; return m; };
  function pyFloat(s) { // float(str) de Python ; null si refusé (ValueError)
    if (s == null) return null; s = String(s).trim();
    if (/^[+-]?(inf|infinity)$/i.test(s)) return s[0] === '-' ? -Infinity : Infinity; if (/^[+-]?nan$/i.test(s)) return NaN;
    if (!/^[+-]?((\d(_?\d)*)(\.(\d(_?\d)*)?)?|\.\d(_?\d)*)([eE][+-]?\d(_?\d)*)?$/.test(s)) return null;
    return Number(s.replace(/_/g, ''));
  }
  // hypot correctement arrondi (math.hypot de Python l'est presque toujours ; Math.hypot peut différer d'une unité du dernier chiffre, ce qui suffit à changer un arrondi)
  const dec = x => { DV.setFloat64(0, x); const hi = DV.getUint32(0), lo = DV.getUint32(4), ex = (hi >>> 20) & 0x7ff; let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo); if (ex === 0) return [m, -1074]; return [m | (1n << 52n), ex - 1075]; };
  const isqrt = n => { if (n < 2n) return n; let x = BigInt(Math.floor(Math.sqrt(Number(n)))); for (;;) { const y = (x + n / x) >> 1n; if (y >= x) { while (x * x > n) x -= 1n; while ((x + 1n) * (x + 1n) <= n) x += 1n; return x; } x = y; } };
  function hyp(...v) {
    v = v.map(Math.abs); if (!v.every(isFinite)) return Math.hypot(...v); v = v.filter(x => x !== 0); if (!v.length) return 0; if (v.length === 1) return v[0];
    const d = v.map(dec), e = Math.min(...d.map(q => q[1])); let S = 0n; for (const [m, ex] of d) { const M = m << BigInt(ex - e); S += M * M; }
    const k = Math.max(0, 120 - S.toString(2).length) >> 1 << 1, T = S << BigInt(k), r = isqrt(T), sticky = r * r !== T; // sqrt(S)·2^e = sqrt(T)·2^(e-k/2)
    const bl = r.toString(2).length, sh = bl - 53; let q = r >> BigInt(sh); const rem = r - (q << BigInt(sh)), half = 1n << BigInt(sh - 1);
    if (rem > half || (rem === half && (sticky || (q & 1n))) ) q += 1n;
    return Number(q) * 2 ** (sh + e - k / 2);
  }
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  function dumps(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number') return pyRepr(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'string') return JSON.stringify(v);
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return '[' + v.map(dumps).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + dumps(v[k])).join(',') + '}';
  }
  // JSON lu en gardant le texte des nombres (Raw) : un objet gardé tel quel est réécrit au caractère près
  function parseRaw(s) {
    let i = 0; const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
    function val() {
      ws(); const c = s[i];
      if (c === '{') { i++; const o = {}; ws(); if (s[i] === '}') { i++; return o; } for (;;) { ws(); const k = str(); ws(); if (s[i++] !== ':') throw new Error('JSON : « : » attendu'); o[k] = val(); ws(); if (s[i] === ',') { i++; continue; } if (s[i++] === '}') return o; throw new Error('JSON : « } » attendu'); } }
      if (c === '[') { i++; const a = []; ws(); if (s[i] === ']') { i++; return a; } for (;;) { a.push(val()); ws(); if (s[i] === ',') { i++; continue; } if (s[i++] === ']') return a; throw new Error('JSON : « ] » attendu'); } }
      if (c === '"') return str();
      if (s.startsWith('true', i)) { i += 4; return true; } if (s.startsWith('false', i)) { i += 5; return false; } if (s.startsWith('null', i)) { i += 4; return null; }
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i, i + 40)); if (!m) throw new Error('JSON illisible à ' + i); i += m[0].length; return new Raw(m[0]);
    }
    function str() { const a = i; i++; while (s[i] !== '"') { if (s[i] === '\\') i++; i++; if (i >= s.length) throw new Error('JSON : chaîne non fermée'); } i++; return JSON.parse(s.slice(a, i)); }
    const v = val(); ws(); if (i < s.length) throw new Error('JSON : texte en trop'); return v;
  }
  const num = v => v instanceof Raw ? Number(v.s) : v;
  const isIntLit = v => v instanceof Raw && /^-?\d+$/.test(v.s);
  function plain(v) { if (v instanceof Raw) return Number(v.s); if (Array.isArray(v)) return v.map(plain); if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k]); return o; } return v; }

  // ── Fichier de données : lieux/<type>/<lieu>/<el>.data.js ──
  const HEAD = '/* Données © contributeurs OpenStreetMap (ODbL) — tracé au sol et alentours. Hauteurs estimées (sauf OSM.ele, relevées). Généré par tools/make_site.py. */\n';
  const text = res => HEAD + 'const OSM=' + dumps(res) + ';\n';
  function parseData(t) { const k = t.indexOf('const OSM='); if (k < 0) throw new Error('const OSM= absent'); return parseRaw(t.slice(k + 10).trim().replace(/;$/, '')); }

  // ── Extrait OSM : JSON de l'API 0.6 (elements) ou XML .osm ; plusieurs extraits fusionnés (tuiles, objets complets), triés par id comme un extrait unique ──
  function xmlElements(x) {
    const out = [], ent = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]);
    const attrs = s => { const o = {}; s.replace(/([\w:]+)="([^"]*)"/g, (m, k, v) => { o[k] = ent(v); }); return o; };
    const re = /<(node|way|relation)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g; let m;
    while ((m = re.exec(x))) {
      const a = attrs(m[2]), e = { type: m[1], id: +a.id, version: +(a.version || 0) }, body = m[4] || '';
      if (m[1] === 'node') { e.lat = Number(a.lat); e.lon = Number(a.lon); }
      const tg = {}; let has = false; body.replace(/<tag\b([^>]*)\/>/g, (q, s) => { const t = attrs(s); tg[t.k] = t.v; has = true; }); if (has) e.tags = tg;
      if (m[1] === 'way') { e.nodes = []; body.replace(/<nd\b([^>]*)\/>/g, (q, s) => { e.nodes.push(+attrs(s).ref); }); }
      if (m[1] === 'relation') { e.members = []; body.replace(/<member\b([^>]*)\/>/g, (q, s) => { const t = attrs(s); e.members.push({ type: t.type, ref: +t.ref, role: t.role || '' }); }); }
      out.push(e);
    }
    return out;
  }
  const elementsOf = d => typeof d === 'string' ? (/^\s*</.test(d) ? xmlElements(d) : JSON.parse(d).elements || []) : Array.isArray(d) ? d : (d && d.elements) || [];
  function mergeElements(list) { // plusieurs extraits : un objet par (type, id), version la plus récente ; nœuds, chemins puis relations, par id croissant
    const by = new Map();
    for (const d of list) for (const e of elementsOf(d)) { if (!e || !['node', 'way', 'relation'].includes(e.type)) continue; const k = e.type[0] + e.id, o = by.get(k); if (!o || (e.version || 0) > (o.version || 0)) by.set(k, e); }
    const R = { node: 0, way: 1, relation: 2 };
    return [...by.values()].sort((a, b) => R[a.type] - R[b.type] || a.id - b.id);
  }
  function index(els) {
    const NODE = new Map(), NTAG = new Map(), WAY = new Map(), RELS = [];
    for (const e of els) {
      const id = String(e.id);
      if (e.type === 'node') { NODE.set(id, { la: e.lat, lo: e.lon, v: e.version || 0 }); if (e.tags && Object.keys(e.tags).length) NTAG.set(id, e.tags); }
      else if (e.type === 'way') WAY.set(id, { nd: (e.nodes || []).map(String), t: e.tags || {}, v: e.version || 0 });
      else RELS.push({ id, t: e.tags || {}, v: e.version || 0, mem: (e.members || []).map(m => ({ type: m.type, ref: String(m.ref), role: m.role || '' })) });
    }
    return { NODE, NTAG, WAY, RELS };
  }

  // ── Catégories du réimport sélectif (docs/ref/import-osm.md) ──
  const CATS = [
    ['circuit', 'Circuit et tronçons de voie (tracé, repères, tunnels, niveaux, voies voisines)'],
    ['batiments', 'Bâtiments et toits (dont gare)'],
    ['chemins', 'Chemins, files, escaliers, entrées, barrières OSM'],
    ['eau', 'Eau (plans d\'eau, cours d\'eau)'],
    ['structures', 'Structures (tunnels, tranchées, ouvrages, quais railway=*)'],
    ['decor', 'Sol, végétation, rochers, arbres et points nommés'],
    ['tags', 'Attributs OSM transportés (f.t, apparence OSM.attrs)']];
  const catOfFeat = k => /^building/.test(k) ? 'batiments' : /^highway=/.test(k) ? 'chemins' : /^(natural=water|waterway=|water=)/.test(k) ? 'eau' : /^(man_made=|railway=)/.test(k) ? 'structures' : 'decor';
  const KEYCAT = { cps: 'circuit', tunnels: 'circuit', inversions: 'circuit', elements: 'circuit', stations: 'circuit', ele: 'circuit', levels: 'circuit', others: 'circuit', deco: 'circuit',
    polys: 'batiments', ctl: 'batiments', paths: 'chemins', stairs: 'chemins', widths: 'chemins', doors: 'chemins', barriers: 'chemins', trees: 'decor', pois: 'decor', attrs: 'tags' };
  const SRCCAT = { track: 'circuit', others: 'circuit', paths: 'chemins', polys: 'batiments', trees: 'decor' };
  const TKEYS = ['height', 'min_height', 'building:levels', 'roof:shape', 'roof:orientation', 'roof:height', 'roof:angle', 'roof:colour', 'layer', 'level', 'material'];

  // ── Construction (tools/make_site.py, même ordre et mêmes règles ; commentaires d'origine résumés) ──
  function build(input, specIn, opt) {
    opt = opt || {};
    const els = Array.isArray(input) && input.length && input[0] && input[0].type ? input : mergeElements([input]);
    const specRaw = typeof specIn === 'string' ? parseRaw(specIn) : null, spec = specRaw ? plain(specRaw) : specIn;
    const { NODE, NTAG, WAY, RELS } = index(els), log = [], warnings = [], skipped = { paths: {}, polys: {} };
    const p = (...a) => log.push(a.join(' ')), warn = m => { warnings.push(m); log.push('ATTENTION : ' + m); };
    const [lat0, lon0] = spec.origin, kx = 111320 * Math.cos(lat0 * RAD);
    const W = m => { const w = WAY.get(String(m)); if (!w) throw new Missing(m); return w; };
    const nds = w => w.nd.filter(r => NODE.has(r)), tags = w => w.t, ver = w => w.v;
    const WSRC = m => ['w' + m, BigInt(W(m).v)], NSRC = i => ['n' + i, BigInt(NODE.get(i).v)];
    const xy = (i, r = 2) => { const n = NODE.get(i); return [pyRound((n.lo - lon0) * kx, r), pyRound(-(n.la - lat0) * 111320, r)]; };
    const dist = (a, b) => hyp(b[0] - a[0], b[1] - a[1]);
    const TUNV = ['yes', 'true', '1', 'building_passage', 'culvert'];
    const levelInt = specRaw ? isIntLit(specRaw.level) : Number.isInteger(spec.level);
    if (spec.base) warn('mode « base » de la fiche (décor seul) non pris en charge par l\'import de l\'éditeur : le circuit n\'est pas relu');
    const track = (spec.track_ways || []).map(String);
    // ── circuit ──
    let C = null;
    if (!spec.base) try { C = circuit(); } catch (e) { if (e instanceof Missing || e instanceof Stop) warn('circuit non importé : ' + e.message + ' ; le circuit du fichier actuel est gardé'); else throw e; }
    function circuit() {
      const ends = new Map(), push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
      const miss = track.filter(m => !WAY.has(m)); if (miss.length) throw new Stop('tronçon(s) de voie absent(s) d\'OSM (supprimé(s) ou hors de l\'extrait) : ' + miss.map(m => 'w' + m).join(', '));
      for (const m of track) { const n = nds(W(m)); push(ends, n[0], m); push(ends, n[n.length - 1], m); }
      const cur = String(spec.start_way); let seq = nds(W(cur)); if (spec.start_reversed) seq = seq.slice().reverse();
      const used = new Set([cur]), chain = seq.slice(), ewy = Array(seq.length - 1).fill(cur); let last = seq[seq.length - 1];
      for (;;) {
        const nx = (ends.get(last) || []).filter(m => !used.has(m)); if (!nx.length) break;
        const m = nx[0]; used.add(m); let n = nds(W(m)); if (n[0] !== last) n = n.slice().reverse();
        chain.push(...n.slice(1)); last = n[n.length - 1]; for (let k = 1; k < n.length; k++) ewy.push(m);
      }
      if (used.size !== track.length) throw new Stop('circuit ouvert, tronçons non reliés : ' + track.filter(m => !used.has(m)).map(m => 'w' + m).join(', '));
      if (chain[0] !== chain[chain.length - 1]) throw new Stop('circuit ouvert : le circuit ne se referme pas');
      const chain_ways = ewy.filter((m, k) => k === 0 || ewy[k - 1] !== m);
      const raw = chain.slice(0, -1).map(i => xy(i)), N0 = raw.length;
      const L0 = fsum(raw.map((q, i) => dist(q, raw[(i + 1) % N0])));
      const is_tunnel = t => { const l = pyFloat(t.layer ?? '0'); const lay = l == null ? 0 : l; return TUNV.includes(t.tunnel) || (t.covered === 'yes' && lay < 0); };
      const tun_edges = new Map(), TUN_IGN = new Set((spec.tunnels_ignore || []).map(String)), ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
      for (const m of track) if (!TUN_IGN.has(m) && is_tunnel(tags(W(m)))) {
        const nn = nds(W(m)), l_ = tags(W(m)).layer ?? '0', k = /^\d+$/.test(l_.replace(/^-+/, '').replace(/\./g, '')) && pyFloat(l_) > 0 ? 'roof' : '';
        for (let j = 0; j + 1 < nn.length; j++) tun_edges.set(ek(nn[j], nn[j + 1]), k);
      }
      const cumr = [0]; for (let i = 0; i < N0; i++) cumr.push(cumr[i] + dist(raw[i], raw[(i + 1) % N0]));
      const tunnels = [];
      for (let i = 0; i < N0; i++) { const e = ek(chain[i], chain[i + 1]); if (tun_edges.has(e)) { const L = tunnels[tunnels.length - 1]; if (L && Math.abs(L[1] - cumr[i]) < 1e-6) L[1] = cumr[i + 1]; else tunnels.push([cumr[i], cumr[i + 1]].concat(tun_edges.get(e) ? [tun_edges.get(e)] : [])); } }
      const cmpL = (a, b) => { for (let k = 0; k < Math.min(a.length, b.length); k++) { if (a[k] < b[k]) return -1; if (a[k] > b[k]) return 1; } return a.length - b.length; };
      const tunnels_ground = tunnels.concat((spec.tunnels_extra || []).map(t => t.slice())).sort(cmpL);
      // repères lus dans OSM (roller_coaster:track), forcés au besoin par la fiche (tags)
      const ROLE_OF = { station: 'station', lift_hill: 'lift', brake_run: 'brake', waiting: 'brake', moving: 'brake', block_brake: 'brake', storage: 'brake', transfer: 'brake' };
      const role = m => (spec.roles || {})[m] || ROLE_OF[tags(W(m))['roller_coaster:track']] || 'run';
      const osm_iv = [];
      for (let i = 0; i < N0; i++) { const r = role(ewy[i]), L = osm_iv[osm_iv.length - 1]; if (L && L[3] === ewy[i] && Math.abs(L[2] - cumr[i]) < 1e-6) L[2] = cumr[i + 1]; else osm_iv.push([r, cumr[i], cumr[i + 1], ewy[i]]); }
      const auto = new Map(), stv = osm_iv.filter(v => v[0] === 'station'), st_groups = [];
      for (const v of stv) {
        const r_ = tags(W(v[3]))['roller_coaster:station'] || '', G = st_groups[st_groups.length - 1];
        if (G && Math.abs(G[2] - v[1]) < 1e-6 && (!r_ || r_ === G[0] || !G[0])) { G[2] = v[2]; G[0] = G[0] || r_; G[3].push(v[3]); } else st_groups.push([r_, v[1], v[2], [v[3]]]);
      }
      if (st_groups.length > 1) p('  gares :', JSON.stringify(st_groups.map(g => [g[0] || '?', pyRound(g[1], 1), pyRound(g[2], 1)])), '(seule la gare à s = 0 est exploitée par le moteur)');
      if (stv.length && stv[0][1] < 1 && st_groups.length && st_groups[0][0] === 'unload') warn('la gare de départ est taguée unload (débarquement)');
      const autoInt = new Set();
      if (stv.length && stv[0][1] < 1) {
        let e_ = stv[0][2]; for (const v of stv.slice(1)) if (Math.abs(v[1] - e_) < 1e-6) e_ = v[2];
        auto.set('st0', 0); autoInt.add('st0'); auto.set('st1', pyRound(e_, 1));
        const tv = stv.filter(v => tags(W(v[3]))['roller_coaster:track'] === 'station' && v[2] <= e_ + 1e-6);
        if (tv.length && tv[tv.length - 1][2] < e_ - .5) auto.set('stp', pyRound(tv[tv.length - 1][2], 1));
      } else warn('aucune gare (roller_coaster:track=station) au départ du circuit');
      const lfv = osm_iv.filter(v => v[0] === 'lift');
      if (lfv.length) { auto.set('lift0', pyRound(lfv[0][1], 1)); auto.set('lift1', pyRound(lfv[lfv.length - 1][2], 1)); }
      const bkv = osm_iv.filter(v => v[0] === 'brake' && (!lfv.length || v[1] >= lfv[0][1]));
      const auto_names = bk => {
        const tg_ = bk.map(v => tags(W(v[3]))['roller_coaster:track']); if (!bk.length) return [];
        let mv = tg_.findIndex(t => t === 'moving'); if (mv < 0) mv = bk.length;
        const nm = tg_.map((t, k) => k).filter(k => tg_[k] !== 'moving'), f = mv > 0 ? mv - 1 : (nm.length ? Math.max(...nm) : bk.length - 1);
        return Array.from({ length: f }, (x, k) => 'blk' + (k + 1)).concat(['brk'], tg_.slice(f + 1).map(t => t === 'moving' ? 'tr' : 'pre'));
      };
      const names = (spec.osm_brakes && spec.osm_brakes.length) ? spec.osm_brakes : auto_names(bkv);
      if (names.length !== bkv.length) throw new Stop(`osm_brakes : ${names.length} noms pour ${bkv.length} zones de freinage OSM`);
      names.forEach((nm, k) => {
        const v = bkv[k], a = pyRound(v[1], 1), b = pyRound(v[2], 1);
        if (nm.startsWith('blk')) { auto.set(nm, b); auto.set('bz' + nm.slice(3), a); }
        else if (nm === 'brk') { auto.set('brk', a); auto.set('fin', b); }
        else if (nm === 'tr' || nm === 'pre') { auto.set(nm + '0', a); auto.set(nm + '1', b); }
        else if (nm !== 'skip') throw new Stop('osm_brakes : nom inconnu ' + nm);
      });
      const T = new Map(auto), stags = spec.tags || {};
      for (const k of Object.keys(stags)) if (stags[k] !== null) T.set(k, stags[k]);
      for (const k of Object.keys(stags)) if (stags[k] === null) T.delete(k);
      for (const v of osm_iv) if (v[0] !== 'run') p(`  OSM ${v[0].padEnd(7)} s=${v[1].toFixed(1).padStart(6)}..${v[2].toFixed(1).padStart(6)} (${(v[2] - v[1]).toFixed(1)} m) way ${v[3]}`);
      p('repères (OSM puis fiche) :', JSON.stringify(Object.fromEntries([...T].sort((a, b) => a[1] - b[1]))));
      // tracé : rééchantillonné au mètre, lissé (sauf zones keep)
      const resample = (pts, step) => {
        const P = pts.concat([pts[0]]), cum = [0]; for (let i = 0; i + 1 < P.length; i++) cum.push(cum[i] + dist(P[i], P[i + 1]));
        const n = pyRoundInt(cum[cum.length - 1] / step), o = []; let j = 0;
        for (let k = 0; k < n; k++) { const s = k * cum[cum.length - 1] / n; while (cum[j + 1] < s) j++; const f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1); o.push([P[j][0] + (P[j + 1][0] - P[j][0]) * f, P[j][1] + (P[j + 1][1] - P[j][1]) * f]); }
        return o;
      };
      const smooth = (a, w, passes, ints) => { // ints[i] : a[i] est un entier Python (hauteur de la gare hors profil)
        for (let ps = 0; ps < passes; ps++) {
          const L = a.length, d = (w + 1) ** 2;
          a = a.map((x, i) => a[0].map((z, c) => { const xs = [], it = []; for (let k = -w; k <= w; k++) { const q = pmod(i + k, L); xs.push(a[q][c] * (w + 1 - Math.abs(k))); it.push(!!(ints && ps === 0 && ints[q])); } return pysum(xs, it).v / d; }));
        }
        return a;
      };
      let pts = resample(raw, 1.0); const n = pts.length, S = i => i * L0 / n;
      const [sw, sp] = spec.smooth || [3, 2], sm = smooth(pts, sw, sp), keepZ = spec.keep || [], keep = s => keepZ.some(([a, b]) => a <= s && s <= b);
      pts = smooth(pts.map((q, i) => keep(S(i)) ? q : sm[i]), 1, 1);
      // profil en hauteur (fiche ; « ele » des nœuds de voie si présent)
      let H = spec.profile; const level = spec.level;
      const fnum = x => pyFloat(String(x == null ? 'None' : x).replace(/,/g, '.').replace(/m/g, '').trim());
      const ELE = []; for (let i = 0; i < N0; i++) { const e = fnum((NTAG.get(chain[i]) || {}).ele); if (e != null) ELE.push([cumr[i], e]); }
      let ele_pts = [];
      if (ELE.length) {
        let g0 = spec.ele_ground;
        if (g0 == null) { const st_e = ELE.filter(([a]) => a <= (auto.has('st1') ? auto.get('st1') : 0) + .5).map(q => q[1]).sort((a, b) => a - b); g0 = st_e.length ? st_e[Math.floor(st_e.length / 2)] - level : null; }
        if (g0 == null) warn(ELE.length + ' nœuds de voie ont « ele » mais aucune référence du sol (fiche ele_ground, ou ele sur un nœud de la gare) : ignorés');
        else {
          ele_pts = ELE.map(([a, e]) => [pyRound(a, 1), pyRound(e - g0, 2)]); const kp = spec.ele_keep ?? 10;
          H = H.filter(q => ele_pts.every(([a]) => Math.abs(q[0] - a) > kp)).concat(ele_pts.map(q => q.slice())).sort((a, b) => a[0] - b[0]);
          p(`  hauteurs relevées (ele, sol ${g0.toFixed(2)} m) : ${ele_pts.length} points ; le reste du profil est ESTIMÉ`);
        }
      } else p('  aucune hauteur relevée (ele) sur la voie : profil ESTIMÉ (fiche)');
      const hraw = s => { for (let k = 0; k + 1 < H.length; k++) { const a = H[k], b = H[k + 1]; if (a[0] <= s && s <= b[0]) { let f = (s - a[0]) / (b[0] - a[0]); if (a.length < 3) f = (1 - Math.cos(Math.PI * f)) / 2; return [a[1] + (b[1] - a[1]) * f, false]; } } return [level, levelInt]; };
      const hr = Array.from({ length: n }, (x, i) => hraw(S(i)));
      const hs = smooth(hr.map(q => [q[0]]), 3, 2, hr.map(q => q[1])).map(q => q[0]), hInt = Array(n).fill(false);
      const [fa, fb] = spec.flat; for (let i = 0; i < n; i++) if (S(i) < fa || S(i) > fb) { hs[i] = level; hInt[i] = levelInt; }
      // inversions (fiche) : vrilles, loopings estimés, loopings dessinés dans OSM
      let rows = Array.from({ length: n }, (x, i) => { const r = [pts[i][0], hs[i], pts[i][1], 0.0, S(i)]; r.hi = hInt[i]; return r; });
      const tan2 = i => { const a = pts[pmod(i - 1, n)], b = pts[(i + 1) % n], l = dist(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
      const nrm3 = v => { const l = Math.sqrt(fsum(v.map(c => c * c))) || 1; return v.map(c => c / l); };
      const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot3 = (a, b) => fsum(a.map((x, k) => x * b[k]));
      const bankOf = (Q, newL) => { let Rf = null; const bank = [];
        for (let k = 1; k + 1 < Q.length; k++) {
          const T3 = nrm3([Q[k + 1][0] - Q[k - 1][0], Q[k + 1][1] - Q[k - 1][1], Q[k + 1][2] - Q[k - 1][2]]), R0 = nrm3([-T3[2], 0, T3[0]]), U0 = cross3(R0, T3);
          Rf = Rf === null ? R0 : nrm3([0, 1, 2].map(c => Rf[c] - dot3(Rf, T3) * T3[c]));
          const U = cross3(Rf, T3); let b = Math.atan2(-dot3(U, R0), dot3(U, U0)) * DEG;
          if (bank.length) b += 360 * pyRoundInt((bank[bank.length - 1] - b) / 360); bank.push(b);
        }
        const rest = bank[bank.length - 1] - 360 * pyRoundInt(bank[bank.length - 1] / 360);
        newL.forEach((w, k) => { w[3] = bank[k] - rest * k / (newL.length - 1); }); return bank;
      };
      const INV = (spec.inversions || []).map((iv, k) => [iv, specRaw && specRaw.inversions ? specRaw.inversions[k] : null]).sort((a, b) => b[0].s0 - a[0].s0), inv_ground = [];
      for (const [iv, ivRaw] of INV) {
        const s0 = iv.s0, s1 = iv.s1;
        if (iv.type === 'corkscrew') {
          const nn = iv.n ?? 1, r = iv.r ?? 1.2;
          rows.forEach((w, i) => { if (s0 <= w[4] && w[4] <= s1) { const u = (w[4] - s0) / (s1 - s0), b = 2 * Math.PI * nn * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)) * ((iv.dir ?? 1) > 0 ? 1 : -1); const [tx, tz] = tan2(i); w[0] += r * Math.sin(b) * -tz; w[2] += r * Math.sin(b) * tx; w[1] += r * (1 - Math.cos(b)); w.hi = false; w[3] = b * DEG; } });
          inv_ground.push([iv, ivRaw, s0, s1]);
        } else if (iv.type === 'loop' && iv.osm) {
          const I = rows.map((w, i) => i).filter(i => s0 <= rows[i][4] && rows[i][4] <= s1), A = rows[I[0]], B = rows[I[I.length - 1]];
          let ax = B[0] - A[0], az = B[2] - A[2]; const al = hyp(ax, az); ax /= al; az /= al; const pr = w => (w[0] - A[0]) * ax + (w[2] - A[2]) * az;
          let c1 = I[0]; for (const i of I) { if (pr(rows[i]) > pr(rows[c1])) c1 = i; else if (pr(rows[c1]) - pr(rows[i]) > 3) break; }
          let c2 = c1; for (const i of I) { if (i <= c1) continue; if (pr(rows[i]) < pr(rows[c2])) c2 = i; else if (pr(rows[i]) - pr(rows[c2]) > 3) break; }
          if (c2 === c1) throw new Stop(`looping OSM s=${s0}..${s1} : aucun rebroussement dans le tracé`);
          const R = (pr(rows[c1]) - pr(rows[c2])) / 2, xc = pr(rows[c2]) + R;
          const e1 = Math.max(...I.filter(i => i < c1 && pr(rows[i]) <= xc)), e2 = Math.min(...I.filter(i => i > c2 && pr(rows[i]) >= xc));
          const leg = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push([rows[i][0], rows[i][2], rows[i][4], pr(rows[i]) - xc]); return o; };
          const at = (L_, x) => { for (let k = 0; k + 1 < L_.length; k++) { const P = L_[k], Q = L_[k + 1]; if ((P[3] - x) * (Q[3] - x) <= 0 && P[3] !== Q[3]) { const f = (x - P[3]) / (Q[3] - P[3]); return [0, 1, 2].map(c => P[c] + (Q[c] - P[c]) * f); } } let bst = L_[0]; for (const q of L_) if (Math.abs(q[3] - x) < Math.abs(bst[3] - x)) bst = q; return bst.slice(0, 3); };
          const legs = [leg(e1, c1), leg(c1, c2), leg(c2, e2)], Hh = iv.h ?? 20, hb0 = rows[e1][1], hb1 = rows[e2][1], K = iv.k ?? 96, nw = [];
          for (let k = 0; k <= K; k++) { const th = 2 * Math.PI * k / K, x = R * Math.sin(th), g = th <= Math.PI / 2 ? legs[0] : th <= 3 * Math.PI / 2 ? legs[1] : legs[2]; const [px, pz, sg] = at(g, x), hb = hb0 + (hb1 - hb0) * k / K; nw.push([px, hb + Hh / 2 * (1 - Math.cos(th)), pz, 0.0, sg]); }
          for (let k = 1; k < K; k++) nw[k][4] = Math.max(nw[k][4], nw[k - 1][4] + 1e-3);
          const Q = rows.slice(Math.max(0, e1 - 1), e1).concat(nw, rows.slice(e2 + 1, e2 + 2)); bankOf(Q, nw);
          rows.splice(e1, e2 - e1 + 1, ...nw);
          p(`looping OSM s=${rows[e1][4].toFixed(1)}..${nw[nw.length - 1][4].toFixed(1)} (au sol) : recul ${(2 * R).toFixed(1)} m, hauteur ${Hh} m`);
          inv_ground.push([iv, ivRaw, nw[0][4], nw[nw.length - 1][4]]);
        } else if (iv.type === 'loop') {
          const i0 = rows.findIndex(w => w[4] >= s0); let i1 = 0; rows.forEach((w, i) => { if (w[4] <= s1) i1 = i; });
          const A = rows[i0], B = rows[i1], Lg = hyp(B[0] - A[0], B[2] - A[2]), tx = (B[0] - A[0]) / Lg, tz = (B[2] - A[2]) / Lg, sd = iv.side ?? 1, nx = -tz * sd, nz = tx * sd;
          const dc = Lg * (iv.at ?? .5), hc = A[1] + (B[1] - A[1]) * dc / Lg, bh = (iv.h ?? 20) / 2, Wd = iv.w ?? 6, e = iv.e ?? 3, ease = u => (1 - Math.cos(Math.PI * u)) / 2;
          const curve = (a, k) => {
            const P = []; for (let j = 0; j <= k; j++) P.push([dc * j / k, -e / 2 * ease(j / k), A[1] + (hc - A[1]) * j / k]);
            for (let j = 1; j <= k; j++) { const th = 2 * Math.PI * j / k; P.push([dc + a * Math.sin(th), -e / 2 + e * th / (2 * Math.PI) + Wd * Math.sin(th / 2) ** 2, hc + bh * (1 - Math.cos(th))]); }
            for (let j = 1; j <= k; j++) P.push([dc + (Lg - dc) * j / k, e / 2 * (1 - ease(j / k)), hc + (B[1] - hc) * j / k]);
            const Cc = [0]; for (let j = 1; j < P.length; j++) Cc.push(Cc[j - 1] + hyp(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1], P[j][2] - P[j - 1][2])); return [P, Cc];
          };
          const target = iv.len ?? 4 * Lg; let lo = .5, hi = 80.0, a = 0;
          for (let k = 0; k < 40; k++) { a = (lo + hi) / 2; const Cc = curve(a, 300)[1]; if (Cc[Cc.length - 1] < target) lo = a; else hi = a; }
          const [P, Cc] = curve(a, 3000), m = Math.max(2, pyRoundInt(Cc[Cc.length - 1])), nw = []; let j = 0;
          for (let k = 0; k <= m; k++) { const c = Cc[Cc.length - 1] * k / m; while (j < Cc.length - 2 && Cc[j + 1] < c) j++; const f = (c - Cc[j]) / ((Cc[j + 1] - Cc[j]) || 1), [d, lat, h] = [0, 1, 2].map(q => P[j][q] + (P[j + 1][q] - P[j][q]) * f); nw.push([A[0] + tx * d + nx * lat, h, A[2] + tz * d + nz * lat, 0.0, A[4] + (B[4] - A[4]) * k / m]); }
          const Q = rows.slice(Math.max(0, i0 - 1), i0).concat(nw, rows.slice(i1 + 1, i1 + 2)); bankOf(Q, nw);
          rows.splice(i0, i1 - i0 + 1, ...nw);
          inv_ground.push([iv, ivRaw, A[4], B[4]]);
        }
      }
      const nr = rows.length, SG = rows.map(w => w[4]), P2 = rows.map(w => [w[0], w[2]]), HS = rows.map(w => w[1]);
      p(`longueur au sol ${L0.toFixed(1)} m, ${n} points`);
      const step = spec.cp_step ?? 3, inInv = s => inv_ground.some(g => g[2] - 6 <= s && s <= g[3] + 6);
      let CR = []; for (let i = 0; i < nr;) { CR.push(i); i += inInv(SG[i]) ? 1 : step; }
      const argS = s => { let b = 0; for (let r = 1; r < nr; r++) if (Math.abs(SG[r] - s) < Math.abs(SG[b] - s)) b = r; return b; };
      if (T.has('stp')) { const ti = !inv_ground.length ? pyRoundInt(T.get('stp') * n / L0) : argS(T.get('stp')); if (!CR.includes(ti)) CR = CR.concat([ti]).sort((a, b) => a - b); }
      const tagr = new Map();
      for (const [k, s] of T) { const ti = !inv_ground.length ? pyRoundInt(s * n / L0) : argS(s); let c = -1; for (const q of CR) if (q <= ti && q > c) c = q; if (!tagr.has(c)) tagr.set(c, []); tagr.get(c).push(k); }
      const cps = [], cpsOut = [];
      for (const i of CR) { const w = rows[i], row = [pyRound(w[0], 2), pyRound(w[1], 2), pyRound(w[2], 2), w[3] ? pyRound(w[3], 1) : 0]; cps.push(row); cpsOut.push([row[0], w.hi ? BigInt(w[1]) : row[1], row[2], w[3] ? row[3] : 0n].concat(tagr.get(i) || [])); }
      // abscisse du moteur (longueur 3D le long de la spline Catmull-Rom des points de contrôle, comme le moteur)
      const engine_s = sg => {
        const m = cps.length, SUB = 24; let fi;
        if (inv_ground.length) { let r = nr - 1; for (let q = 1; q < nr; q++) if (SG[q] >= sg) { r = q; break; } const rf = r - 1 + (sg - SG[r - 1]) / ((SG[r] - SG[r - 1]) || 1); let jj = 0; CR.forEach((c, q) => { if (c <= rf) jj = q; }); const nx_ = jj + 1 < CR.length ? CR[jj + 1] : nr; fi = jj + (rf - CR[jj]) / (nx_ - CR[jj]); }
        else fi = sg * n / L0 / step;
        const pt = (i, t) => { const P = [-1, 0, 1, 2].map(d => cps[pmod(i + d, m)]), t2 = t * t, t3 = t2 * t; return [0, 1, 2].map(k => .5 * ((2 * P[1][k]) + (-P[0][k] + P[2][k]) * t + (2 * P[0][k] - 5 * P[1][k] + 4 * P[2][k] - P[3][k]) * t2 + (-P[0][k] + 3 * P[1][k] - 3 * P[2][k] + P[3][k]) * t3)); };
        const i0 = Math.trunc(fi), jt = pmod(pyRoundInt((fi - i0) * SUB), SUB); let acc = 0.0, prev = null;
        for (let i = 0; i <= i0; i++) for (let j = 0; j < SUB; j++) { const q = pt(i, j / SUB); if (prev) acc += hyp(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q; if (i === i0 && j === jt) return acc; }
        return acc;
      };
      const tunOut = tunnels_ground.map(t => [pyRound(engine_s(t[0]), 1), pyRound(engine_s(t[1]), 1)].concat(t.slice(2)));
      p('tunnels (s moteur) :', JSON.stringify(tunOut));
      const inversions = inv_ground.slice().sort((a, b) => a[2] - b[2]).map(([iv, ivRaw, a, b]) => ({ type: iv.type, s0: pyRound(engine_s(a), 1), s1: pyRound(engine_s(b), 1), n: iv.n == null ? 1n : (ivRaw ? (isIntLit(ivRaw.n) ? BigInt(iv.n) : iv.n) : (Number.isInteger(iv.n) ? BigInt(iv.n) : iv.n)) }));
      const el_iv = [];
      for (let i = 0; i < N0; i++) { const ty = tags(W(ewy[i]))['roller_coaster:element']; if (!ty) continue; const L = el_iv[el_iv.length - 1]; if (L && L[0] === ty && Math.abs(L[2] - cumr[i]) < 1e-6) { L[2] = cumr[i + 1]; if (!L[3].includes(ewy[i])) L[3].push(ewy[i]); } else el_iv.push([ty, cumr[i], cumr[i + 1], [ewy[i]]]); }
      const elements = el_iv.map(([ty, a, b, ws]) => ({ type: ty, s0: pyRound(engine_s(a), 1), s1: pyRound(engine_s(b), 1), id: ws.map(m => 'w' + m) }));
      const stations = st_groups.length > 1 || st_groups.some(g => g[0]) ? st_groups.map(g => ({ role: g[0] || 'load', s0: pyRound(engine_s(g[1]), 1), s1: pyRound(engine_s(g[2]), 1), id: g[3].map(m => 'w' + m) })) : [];
      const ele_out = ele_pts.map(([a, h]) => [pyRound(engine_s(a), 1), h]);
      // niveaux OSM des tronçons du circuit (layer d'abord, puis level ; non nuls) -> OSM.levels=[[s0,s1,lv],…] (s du moteur ; docs/ref/voie.md « Ordre vertical »)
      const lvOfWay = t => { for (const k of ['layer', 'level']) { const v = pyFloat(String(t[k] ?? '').split(';')[0]); if (v != null && isFinite(v) && v !== 0) return v; } return null; };
      const lv_iv = [];
      for (let i = 0; i < N0; i++) { const v = lvOfWay(tags(W(ewy[i]))); if (v === null) continue; const L = lv_iv[lv_iv.length - 1]; if (L && L[2] === v && Math.abs(L[1] - cumr[i]) < 1e-6) L[1] = cumr[i + 1]; else lv_iv.push([cumr[i], cumr[i + 1], v]); }
      const levels = lv_iv.map(([a, b, v]) => [pyRound(engine_s(a), 1), pyRound(engine_s(b), 1), Number.isInteger(v) ? BigInt(v) : v]);
      return { chain_ways, raw, cps, cpsOut, tunnels: tunOut, inversions, elements, stations, ele_out, levels, warnOpen: null };
    }
    // ── décor ──
    const [X0, X1, Z0, Z1] = spec.bbox, inb = q => X0 <= q[0] && q[0] <= X1 && Z0 <= q[1] && q[1] <= Z1;
    const pathIds = v => (Array.isArray(v) ? v : [v]).map(String);
    function chain_pts(v) {
      if (!Array.isArray(v)) return nds(W(v)).map(i => xy(i, 1));
      let out = [];
      for (const w of v) {
        let n = nds(W(w));
        if (out.length && n[n.length - 1] === out[out.length - 1]) n = n.slice().reverse();
        else if (out.length && n[0] !== out[out.length - 1] && n[n.length - 1] !== out[out.length - 1]) {
          if ((out.length === nds(W(v[0])).length && n[0] === out[0]) || n[n.length - 1] === out[0]) { out = out.slice().reverse(); n = n[0] === out[out.length - 1] ? n : n.slice().reverse(); }
          else throw new Stop('chemin de la fiche : w' + w + ' ne touche pas le tronçon précédent');
        }
        out = out.concat(out.length ? n.slice(1) : n);
      }
      return out.map(i => xy(i, 1));
    }
    const paths = spec.paths || {}, SPATHS = new Set(Object.values(paths).flatMap(pathIds));
    const drop = new Set(track.concat((spec.drop_ways || []).map(String), Object.values(paths).filter(v => !Array.isArray(v)).map(String)));
    const DECO_D = 25, deco = [], DECO = new Set();
    if (C) {
      const RCW = new Map(); for (const [m, w] of WAY) if (tags(w).roller_coaster === 'track' && nds(w).length > 1) RCW.set(m, nds(w));
      const par = new Map([...RCW.keys()].map(m => [m, m])), rt = a => { while (par.get(a) !== a) { par.set(a, par.get(par.get(a))); a = par.get(a); } return a; };
      const byn = new Map(); for (const [m, n_] of RCW) for (const x_ of n_) { if (!byn.has(x_)) byn.set(x_, []); byn.get(x_).push(m); }
      for (const ms of byn.values()) for (const m of ms.slice(1)) par.set(rt(m), rt(ms[0]));
      const comps = new Map(); for (const m of RCW.keys()) { const r = rt(m); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(m); }
      const cyc = ms => ms.reduce((a, m) => a + RCW.get(m).length - 1, 0) >= new Set(ms.flatMap(m => RCW.get(m))).size;
      const trk = new Set(track), others_c = [...comps.values()].filter(ms => cyc(ms) && !ms.some(m => trk.has(m))).map(ms => ms.flatMap(m => RCW.get(m).map(x_ => xy(x_))));
      const dmin = (P, Q) => { const Q2 = Q.filter((q, k) => k % 2 === 0), QQ = Q2.length ? Q2 : Q; let b = Infinity; for (const a of P) for (const q of QQ) { const d = Math.hypot(q[0] - a[0], q[1] - a[1]); /* seulement comparée à des seuils */ if (d < b) b = d; } return b; };
      for (const ms of comps.values()) {
        if (cyc(ms) || ms.some(m => drop.has(m) || SPATHS.has(m)) || ms.some(m => (tags(WAY.get(m))['roller_coaster:track'] ?? 'track') !== 'track')) continue;
        const P = ms.flatMap(m => RCW.get(m).map(x_ => xy(x_))), d_ = dmin(P, C.raw);
        if (d_ < DECO_D && others_c.every(Q => d_ < dmin(P, Q))) for (const m of ms.slice().sort()) { deco.push({ p: RCW.get(m).map(x_ => xy(x_, 1)), id: 'w' + m, v: BigInt(ver(WAY.get(m))) }); DECO.add(m); }
      }
      if (deco.length) p('voies décoratives (hors circuit, immobiles) :', [...DECO].sort().join(', '));
    }
    for (const m of DECO) drop.add(m);
    const KEYS = ['building', 'highway', 'natural', 'landuse', 'leisure', 'water', 'waterway', 'barrier', 'amenity', 'tourism', 'man_made', 'railway'];
    const feats = [], others = [], others_src = [];
    const area = P => fsum(P.map((q, i) => q[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * q[1])) / 2;
    const inside = (pt, P) => { let c = false, j = P.length - 1; for (let i = 0; i < P.length; i++) { if ((P[i][1] > pt[1]) !== (P[j][1] > pt[1]) && pt[0] < (P[j][0] - P[i][0]) * (pt[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; j = i; } return c; };
    const isped = t => (t.highway === 'pedestrian' && (t.area === 'yes' || t.type === 'multipolygon')) || 'area:highway' in t || t.place === 'square';
    const lay = t => { const v = pyFloat(t.layer ?? '0'); return v == null ? 0 : v; };
    const lvl = t => { let v = 0; for (const k of ['layer', 'level']) for (const x of String(t[k] ?? '').replace(/,/g, ';').split(';')) { const f = pyFloat(x); if (f != null && f < v) v = f; } return v; };
    const numTag = (s, m) => pyFloat(String(s ?? '').replace(/,/g, '.').replace(/m/g, '').trim());
    const bheight = t => { for (const [k, m] of [['height', 1], ['building:levels', 3]]) { const f = numTag(t[k]); if (f == null) continue; const v = f * m; if (0 < v && v < 200) return pyRound(v, 2); } return null; };
    const wnum = t => { const v = numTag(t.width); return v != null && 0.3 < v && v < 20 ? v : null; };
    const iscov = t => TUNV.includes(t.tunnel) || t.covered === 'yes' || ['yes', 'corridor'].includes(t.indoor) || lay(t) < 0;
    function add(t, pp, closed, holes, src) {
      let kind = isped(t) ? 'highway=pedestrian' : (k => k ? k + '=' + t[k] : null)(KEYS.find(k => k in t));
      if (kind === 'natural=bare_rock') kind = 'natural=rock';
      if (!(kind && kind !== 'landuse=commercial' && pp.some(inb))) return;
      const f = { k: kind, n: t.name ?? null, c: closed ? 1n : 0n, p: pp };
      if (src) { f.id = src[0]; f.v = src[1]; }
      const hw = kind.startsWith('highway=');
      if (hw && !closed && iscov(t)) f.cv = 1n;
      if (hw && !closed && lvl(t) < 0) f.lv = lvl(t);
      if (kind.startsWith('building') && bheight(t)) f.bh = bheight(t);
      if (hw && !closed && t.bridge != null && t.bridge !== 'no' && !iscov(t)) { f.br = BigInt(Math.max(1, Math.trunc(lay(t)))); if (wnum(t)) f.w = wnum(t); }
      if (closed && holes) { const h = holes.filter(q => q.length > 3 && inside(q[0], pp)).map(q => area(q) * area(pp) < 0 ? q : q.slice().reverse()); if (h.length) f.h = h; }
      if (kind.startsWith('building') || /^man_made=(tunnel|excavation|structure)$/.test(kind) || 'layer' in t || 'level' in t) { const g = {}; for (const k of TKEYS) if (k in t) g[k] = t[k]; if (Object.keys(g).length) f.t = g; }
      feats.push(f);
    }
    for (const [wid, w] of WAY) {
      const t = tags(w), n_ = nds(w); if (!Object.keys(t).length || !n_.length) continue;
      const pp = n_.map(i => xy(i, 1));
      if (t.roller_coaster) { if (!spec.base && !track.includes(wid) && !drop.has(wid) && pp.some(inb)) { others.push(pp); others_src.push(['w' + wid, BigInt(w.v)]); } continue; }
      if (drop.has(wid) && !(SPATHS.has(wid) && t.highway && (iscov(t) || (t.bridge != null && t.bridge !== 'no')))) continue;
      add(t, pp, n_[0] === n_[n_.length - 1], null, ['w' + wid, BigInt(w.v)]);
    }
    function rings_of(ids) {
      const segs = ids.filter(m => WAY.has(m) && nds(WAY.get(m)).length > 1).map(m => nds(WAY.get(m))), out = [];
      while (segs.length) {
        let cur = segs.shift();
        while (cur[0] !== cur[cur.length - 1]) {
          let found = false;
          for (let k = 0; k < segs.length; k++) {
            const sg = segs[k], rv = sg.slice().reverse();
            if (sg[0] === cur[cur.length - 1]) { cur = cur.concat(sg.slice(1)); segs.splice(k, 1); found = true; break; }
            if (sg[sg.length - 1] === cur[cur.length - 1]) { cur = cur.concat(rv.slice(1)); segs.splice(k, 1); found = true; break; }
            if (sg[sg.length - 1] === cur[0]) { cur = sg.slice(0, -1).concat(cur); segs.splice(k, 1); found = true; break; }
            if (sg[0] === cur[0]) { cur = rv.slice(0, -1).concat(cur); segs.splice(k, 1); found = true; break; }
          }
          if (!found) break;
        }
        if (cur[0] === cur[cur.length - 1] && cur.length > 3) out.push(cur.map(i => xy(i, 1)));
      }
      return out;
    }
    for (const r of RELS) {
      const t = r.t, RS = ['r' + r.id, BigInt(r.v)];
      if (t.type === 'multipolygon' && isped(t)) {
        const mem = r.mem.filter(m => m.type === 'way'), inner = rings_of(mem.filter(m => m.role === 'inner').map(m => m.ref));
        for (const ring of rings_of(mem.filter(m => m.role !== 'inner').map(m => m.ref))) add(t, ring, true, inner, RS);
      } else if (t.type === 'multipolygon') {
        const mem = r.mem.filter(m => m.type === 'way' && WAY.has(m.ref)), holes = rings_of(mem.filter(m => m.role === 'inner').map(m => m.ref));
        const outs = mem.filter(m => m.role !== 'inner').map(m => m.ref), rings = rings_of(outs);
        for (const ring of rings) add(t, ring, true, holes, RS);
        const used = new Set(rings.flatMap(rg => rg.map(q => q[0] + ',' + q[1])));
        for (const m of outs) { const n_ = nds(WAY.get(m)); if (n_.length && n_[0] !== n_[n_.length - 1] && !n_.every(i => { const q = xy(i, 1); return used.has(q[0] + ',' + q[1]); })) add(t, n_.map(i => xy(i, 1)), false, holes, RS); }
      }
    }
    const PED = feats.filter(f => f.k === 'highway=pedestrian' && f.c);
    const in_ped = q => PED.some(f => inside(q, f.p) && !(f.h || []).some(h => inside(q, h)));
    let nin = 0;
    for (const f of feats) if (['highway=footway', 'highway=path', 'highway=steps'].includes(f.k) && !f.c && !f.cv && f.p.filter(in_ped).length >= .8 * f.p.length) { f.in = 1n; nin++; }
    p(`zones piétonnes : ${PED.length} ; chemins fondus dedans : ${nin} ; chemins couverts : ${feats.filter(f => f.cv).length}`);
    const NODE_WAYS_ALL = new Map(); for (const w of WAY.values()) if (tags(w).highway) for (const i of nds(w)) { if (!NODE_WAYS_ALL.has(i)) NODE_WAYS_ALL.set(i, []); NODE_WAYS_ALL.get(i).push(w); }
    const doors = [], barriers = [];
    for (const [i, t] of NTAG) if ('entrance' in t && inb(xy(i))) doors.push([...xy(i, 1), t.entrance, t.name ?? null, ...NSRC(i)]);
    for (const [i, t] of NTAG) {
      if (!['swing_gate', 'gate', 'lift_gate'].includes(t.barrier) || !inb(xy(i))) continue;
      let tx = 0.0, tz = 0.0, end = 0n;
      for (const w of NODE_WAYS_ALL.get(i) || []) { const n_ = nds(w), k = n_.indexOf(i), a = xy(n_[Math.max(0, k - 1)], 2), b = xy(n_[Math.min(n_.length - 1, k + 1)], 2), l = dist(a, b) || 1; if (!tx && !tz) { tx = pyRound((b[0] - a[0]) / l, 3); tz = pyRound((b[1] - a[1]) / l, 3); } if (k === 0 || k === n_.length - 1) end = 1n; }
      barriers.push([...xy(i, 1), t.ref ?? '', t['swing_gate:hinge'] ?? '', tx, tz, end, ...NSRC(i)]);
    }
    const NODE_WAYS = new Map(), nw_ = (i, w) => { if (!NODE_WAYS.has(i)) NODE_WAYS.set(i, []); NODE_WAYS.get(i).push(w); };
    for (const w of WAY.values()) if (tags(w).highway) { const n_ = nds(w); for (const i of n_.slice(0, 1).concat(n_.slice(-1))) nw_(i, w); for (const i of n_.slice(1, -1)) nw_(i, w); }
    const steps = [];
    for (const [wid, w] of WAY) {
      const t = tags(w), n_ = nds(w); if (t.highway !== 'steps' || n_.length < 2) continue;
      const pp = n_.map(i => xy(i, 1)); if (!pp.some(inb)) continue;
      const inc = t.incline ?? '', up = (['up', 'yes'].includes(inc) || (inc.endsWith('%') && !inc.startsWith('-'))) ? 1n : (inc === 'down' || inc.startsWith('-')) ? -1n : 0n;
      const ws = [n_[0], n_[n_.length - 1]].flatMap(i => (NODE_WAYS.get(i) || []).filter(o => o !== w && wnum(tags(o))).map(o => wnum(tags(o))));
      const wd = wnum(t) || (ws.length ? Math.min(...ws) : 0) || null;
      const s = { p: pp, up }; if (iscov(t)) s.cv = 1n; if (lvl(t) < 0) s.lv = lvl(t); if (wd) s.w = wd; s.id = 'w' + wid; s.v = BigInt(w.v); steps.push(s);
    }
    p(`escaliers : ${steps.length} ; passerelles : ${feats.filter(f => f.br).length}`);
    const widths = [];
    for (const [wid, w] of WAY) { const t = tags(w), n_ = nds(w); if (t.highway && wnum(t) && n_.length > 1 && n_[0] !== n_[n_.length - 1]) { const pp = n_.map(i => xy(i, 1)); if (pp.some(inb)) widths.push([wnum(t), pp, 'w' + wid, BigInt(w.v)]); } }
    const res = {}; res.cps = C ? C.cpsOut : null;
    if (widths.length) res.widths = widths; if (steps.length) res.stairs = steps; if (doors.length) res.doors = doors; if (barriers.length) res.barriers = barriers;
    if (C && C.tunnels.length) res.tunnels = C.tunnels; if (C && C.inversions.length) res.inversions = C.inversions;
    res.feats = feats; res.others = others;
    res.paths = {}; for (const k of Object.keys(paths)) { try { res.paths[k] = chain_pts(paths[k]); } catch (e) { if (!(e instanceof Missing || e instanceof Stop)) throw e; skipped.paths[k] = true; warn('chemin « ' + k + ' » de la fiche non importé : ' + e.message); } }
    res.polys = {}; for (const k of Object.keys(spec.polys || {})) { const w = WAY.get(String(spec.polys[k])); if (w) res.polys[k] = nds(w).map(i => xy(i, 1)); else { skipped.polys[k] = true; warn('polygone « ' + k + ' » de la fiche absent d\'OSM : w' + spec.polys[k]); } }
    res.trees = [...NTAG].filter(([i, t]) => t.natural === 'tree' && inb(xy(i))).map(([i]) => xy(i, 1));
    res.pois = [...NTAG].filter(([i, t]) => t.name && inb(xy(i))).map(([i, t]) => [xy(i, 1), t.name, ...NSRC(i)]);
    if (deco.length) res.deco = deco;
    const SRC = {}; SRC.track = C ? C.chain_ways.map(m => WSRC(m)) : null;
    if (others_src.length) SRC.others = others_src;
    if (Object.keys(res.paths).length) { SRC.paths = {}; for (const k of Object.keys(paths)) if (!skipped.paths[k]) SRC.paths[k] = pathIds(paths[k]).map(m => WSRC(m)); }
    if (Object.keys(res.polys).length) { SRC.polys = {}; for (const k of Object.keys(spec.polys)) if (!skipped.polys[k]) SRC.polys[k] = [WSRC(spec.polys[k])]; }
    SRC.trees = [...NTAG].filter(([i, t]) => t.natural === 'tree' && inb(xy(i))).map(([i]) => NSRC(i));
    res.src = SRC;
    // salle de contrôle nommée dans OSM (OSM.ctl, comme make_site.py)
    const CTLRX = /salle\s*de\s*contr[oô]le|control\s*room/i, ctl = [];
    const mrect = P => { let best = null; for (let k = 0; k + 1 < P.length; k++) { const ex = P[k + 1][0] - P[k][0], ez = P[k + 1][1] - P[k][1], l = hyp(ex, ez); if (l < 1e-6) continue; const ux = ex / l, uz = ez / l, a_ = P.map(q => q[0] * ux + q[1] * uz), b_ = P.map(q => -q[0] * uz + q[1] * ux); const mxa = Math.max(...a_), mna = Math.min(...a_), mxb = Math.max(...b_), mnb = Math.min(...b_), A_ = (mxa - mna) * (mxb - mnb); if (best === null || A_ < best[0]) { const ca = (mxa + mna) / 2, cb = (mxb + mnb) / 2; best = [A_, ca * ux - cb * uz, ca * uz + cb * ux, Math.atan2(uz, ux), mxa - mna, mxb - mnb]; } } return best; };
    const cpsN = C ? C.cps : (opt.oldCps || []);
    for (const [wid, w] of WAY) {
      const t = tags(w), n_ = nds(w); if (!('building' in t) || n_.length < 4 || n_[0] !== n_[n_.length - 1] || !CTLRX.test(String(t.name || '').normalize('NFC'))) continue;
      const P = n_.map(i => xy(i)); if (!P.some(inb)) continue;
      const [, cx, cz, th, a_, b_] = mrect(P);
      let tp = null; for (const c of cpsN) if (!tp || (c[0] - cx) ** 2 + (c[2] - cz) ** 2 < (tp[0] - cx) ** 2 + (tp[2] - cz) ** 2) tp = c;
      const [dx, dz] = tp ? [tp[0] - cx, tp[2] - cz] : [0.0, 1.0];
      let bc = null, bv = -Infinity; for (let k = 0; k < 4; k++) { const c = [th + k * Math.PI / 2, k % 2 === 0 ? a_ : b_, k % 2 === 0 ? b_ : a_], v = -Math.sin(c[0]) * dx + Math.cos(c[0]) * dz; if (v > bv) { bv = v; bc = c; } }
      ctl.push({ x: pyRound(cx, 2), z: pyRound(cz, 2), angle: pyRound(pmod(bc[0] * DEG + 180, 360) - 180, 1), w: pyRound(bc[1], 2), d: pyRound(bc[2], 2), name: t.name, id: 'w' + wid, v: BigInt(w.v) });
    }
    if (ctl.length) res.ctl = ctl;
    if (C) { if (C.elements.length) res.elements = C.elements; if (C.stations.length) res.stations = C.stations; if (C.ele_out.length) res.ele = C.ele_out; if (C.levels.length && !opt.sansNouveaux) res.levels = C.levels; }
    // OSM.attrs (D12) : valeurs par défaut des réglages de l'éditeur, renvoyables vers OSM
    const NCOL = { black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080', red: '#ff0000', maroon: '#800000', brown: '#a52a2a', orange: '#ffa500', yellow: '#ffff00', green: '#008000', blue: '#0000ff', darkgray: '#a9a9a9', lightgray: '#d3d3d3', silver: '#c0c0c0', beige: '#f5f5dc', tan: '#d2b48c' };
    const hexcol = v => { v = String(v || '').trim().toLowerCase(); if (/^#[0-9a-f]{6}$/.test(v)) return v; if (/^#[0-9a-f]{3}$/.test(v)) return '#' + [...v.slice(1)].map(c => c + c).join(''); return NCOL[v] || null; };
    const attr_of = (role, wid, keys, force) => {
      const w = W(wid), t = tags(w), got = {}; for (const k of keys) if (k in t) got[k] = t[k];
      if (!Object.keys(got).length && !force) return null;
      const pp = nds(w).map(i => xy(i));
      const o = { role, id: 'w' + wid, v: BigInt(w.v), l: pyRound(fsum(pp.slice(0, -1).map((q, k) => hyp(pp[k + 1][0] - q[0], pp[k + 1][1] - q[1]))), 1), t: got };
      const h = {}; for (const k of Object.keys(got)) if ((k === 'colour' || k === 'roof:colour') && hexcol(got[k])) h[k] = hexcol(got[k]); if (Object.keys(h).length) o.h = h;
      if (role === 'queue') o.p = pp.map(q => [pyRound(q[0], 1), pyRound(q[1], 1)]);
      return o;
    };
    const attrs = [], safe = f => { try { return f(); } catch (e) { if (e instanceof Missing) { warn('attribut non relu : ' + e.message); return undefined; } throw e; } };
    const QPW = (spec.queue_paths || []).flatMap(k => paths[k] == null ? [] : pathIds(paths[k]));
    for (const m of QPW) safe(() => { const t = tags(W(m)); if (t.highway && t.highway !== 'steps') attrs.push(attr_of('queue', m, ['surface', 'colour'], true)); });
    const stw = (spec.polys || {}).station ? WAY.get(String(spec.polys.station)) : null, stp = stw ? nds(stw).map(i => xy(i)) : null;
    if (stp) {
      attrs.push(attr_of('roof', String(spec.polys.station), ['roof:colour'], true));
      for (const [wid, w] of WAY) { const t = tags(w), n_ = nds(w); if (t['area:highway'] === 'footway' && t.covered === 'yes' && n_.length > 3 && n_[0] === n_[n_.length - 1]) { const P_ = n_.map(i => xy(i)); if (inside([fsum(P_.map(q => q[0])) / P_.length, fsum(P_.map(q => q[1])) / P_.length], stp)) attrs.push(attr_of('plat', wid, ['surface', 'colour']) || { role: 'plat', id: 'w' + wid, v: BigInt(w.v), t: {} }); } }
    }
    const QP = QPW.filter(m => WAY.has(m)).map(m => nds(WAY.get(m)).map(i => xy(i)));
    const dseg = (q, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2)); return hyp(q[0] - a[0] - u * dx, q[1] - a[1] - u * dz); };
    const near_queue = q => QP.some(P_ => P_.slice(0, -1).some((a, k) => dseg(q, a, P_[k + 1]) < 2.0));
    for (const [wid, w] of WAY) { const t = tags(w), n_ = nds(w); if (['fence', 'handrail', 'wall'].includes(t.barrier) && n_.length && QP.length && n_.every(i => near_queue(xy(i)))) { const a = attr_of('rail', wid, ['barrier', 'material']); if (a && ('material' in a.t || a.t.barrier === 'wall')) attrs.push(a); } }
    if (C) for (const m of C.chain_ways) attrs.push(attr_of('track', m, ['colour'], true));
    if (attrs.length) res.attrs = attrs;
    for (const k of spec.skip || []) delete res[k];
    if (opt.sansNouveaux) for (const f of feats) delete f.t;
    return { res, ok: { circuit: !!C }, skipped, warnings, log };
  }
  class Missing extends Error { constructor(m) { super('tronçon w' + m + ' absent de l\'extrait OSM (supprimé ou hors zone)'); } }
  class Stop extends Error { }

  // ── Réimport sélectif : fichier actuel (texte) + résultat de build, catégories choisies -> nouvel objet ; ce qui n'est pas choisi reste au caractère près ──
  const fkeys = list => { const seen = {}; return list.map(f => { const b = (f.id || '') + '|' + f.k; seen[b] = (seen[b] || 0) + 1; return b + '|' + seen[b]; }); };
  function merge(oldText, B, cats) {
    const sel = {}; for (const [c] of CATS) sel[c] = !!(cats ? cats.includes(c) : true);
    const N = B.res, circOK = B.ok.circuit;
    const full = CATS.every(([c]) => sel[c]) && circOK && !Object.keys(B.skipped.paths).length && !Object.keys(B.skipped.polys).length;
    if (!oldText) { if (!circOK) throw new Error('premier import impossible sans circuit'); return N; }
    if (full) return N;
    const O = parseData(oldText), out = {}, use = c => sel[c] && (c !== 'circuit' || circOK);
    const order = Object.keys(N).concat(Object.keys(O).filter(k => !(k in N)));
    for (const k of order) {
      const c = KEYCAT[k];
      if (k === 'feats') out.feats = mergeFeats(O.feats || [], N.feats || [], use);
      else if (k === 'src') { const s = {}, os = O.src || {}, ns = N.src || {}; for (const q of Object.keys(ns).concat(Object.keys(os).filter(q => !(q in ns)))) { const cc = SRCCAT[q]; let v = cc && use(cc) && ns[q] != null ? ns[q] : os[q]; if (q === 'paths' || q === 'polys') v = mergeDict(os[q], ns[q], use(cc), B.skipped[q]); if (v !== undefined && v !== null) s[q] = v; } out.src = s; }
      else if (k === 'paths' || k === 'polys') { const v = mergeDict(O[k], N[k], use(c), B.skipped[k]); if (v !== undefined) out[k] = v; }
      else if (k === 'attrs') { if (use('tags')) { const tr = circOK ? (N.attrs || []) : (N.attrs || []).concat((O.attrs || []).filter(a => a.role === 'track')); if (tr.length) out.attrs = tr; } else if (O.attrs) out.attrs = O.attrs; }
      else if (!c) { if (k in O) out[k] = O[k]; else out[k] = N[k]; }
      else if (use(c)) { if (k in N && N[k] !== null) out[k] = N[k]; }
      else if (k in O) out[k] = O[k];
    }
    // ordre des clés : celui du fichier actuel pour les clés gardées (diff minimal), nouvelles clés à leur place d'origine
    const res = {}; for (const k of Object.keys(O)) if (k in out) res[k] = out[k]; for (const k of Object.keys(out)) if (!(k in res)) res[k] = out[k];
    return res;
  }
  function mergeDict(o, n, use, skip) { if (!use) return o; if (n === undefined && !(skip && Object.keys(skip).length)) return undefined; const r = {}; for (const k of Object.keys(n || {}).concat(Object.keys(o || {}).filter(k => !(k in (n || {}))))) { if (skip && skip[k] && o && k in o) r[k] = o[k]; else if (n && k in n) r[k] = n[k]; } return r; }
  function mergeFeats(OF, NF, use) { // objets gardés tels quels (catégorie non choisie), remplacés (choisie), ajoutés ; tags f.t selon la catégorie « tags »
    const ok = fkeys(OF), nk = fkeys(NF), nby = new Map(nk.map((k, i) => [k, NF[i]])), oby = new Map(ok.map((k, i) => [k, OF[i]])), seen = new Set(), out = [];
    const mk = (base, o, n) => { const ts = use('tags') ? (n || o) : (o || n); if (ts === base || dumps(ts && ts.t) === dumps(base.t)) return base; const g = Object.assign({}, base); delete g.t; if (ts && ts.t) g.t = ts.t; return g; };
    OF.forEach((f, i) => { const n = nby.get(ok[i]); if (!use(catOfFeat(f.k))) { out.push(mk(f, f, n)); if (n) seen.add(ok[i]); } else if (n) { out.push(mk(n, f, n)); seen.add(ok[i]); } });
    NF.forEach((f, i) => { if (use(catOfFeat(f.k)) && !seen.has(nk[i])) out.push(mk(f, oby.get(nk[i]) || null, f)); });
    return out;
  }

  // ── Aperçu lisible avant / après, par catégorie ──
  function summary(oldText, newRes) {
    const O = oldText ? parseData(oldText) : {}, N = newRes, out = {}; for (const [c, l] of CATS) out[c] = { label: l, changes: [] };
    const S = v => dumps(v), nm = f => (f.id || '?') + ' ' + f.k + (f.n ? ' « ' + f.n + ' »' : '');
    const of = O.feats || [], nf = N.feats || [], ok = fkeys(of), nk = fkeys(nf), ob = new Map(ok.map((k, i) => [k, of[i]])), nb = new Map(nk.map((k, i) => [k, nf[i]]));
    for (const [k, f] of nb) { const c = catOfFeat(f.k), o = ob.get(k); if (!o) { out[c].changes.push('+ ' + nm(f)); continue; }
      const d = []; if (S(o.p) !== S(f.p) || S(o.h) !== S(f.h)) d.push('géométrie'); for (const q of ['n', 'c', 'v', 'cv', 'lv', 'bh', 'br', 'w', 'in']) if (S(o[q]) !== S(f[q])) d.push(q === 'v' ? 'version ' + S(o.v) + ' → ' + S(f.v) : q === 'n' ? 'nom' : q + ' ' + S(o[q]) + ' → ' + S(f[q]));
      if (d.length) out[c].changes.push('~ ' + nm(f) + ' : ' + d.join(', '));
      if (S(o.t) !== S(f.t)) out.tags.changes.push('~ ' + nm(f) + ' : tags ' + (o.t ? S(o.t) : '(aucun)') + ' → ' + (f.t ? S(f.t) : '(aucun)')); }
    for (const [k, f] of ob) if (!nb.has(k)) out[catOfFeat(f.k)].changes.push('- ' + nm(f));
    const byId = (key, idOf, cat, label) => { const a = new Map((O[key] || []).map(x => [idOf(x), x])), b = new Map((N[key] || []).map(x => [idOf(x), x]));
      for (const [i, x] of b) { const y = a.get(i); if (!y) out[cat].changes.push('+ ' + label + ' ' + i); else if (S(x) !== S(y)) out[cat].changes.push('~ ' + label + ' ' + i); }
      for (const i of a.keys()) if (!b.has(i)) out[cat].changes.push('- ' + label + ' ' + i); };
    byId('stairs', x => x.id, 'chemins', 'escalier'); byId('doors', x => x[x.length - 2], 'chemins', 'entrée'); byId('barriers', x => x[x.length - 2], 'chemins', 'barrière OSM');
    byId('widths', x => x[2], 'chemins', 'largeur de chemin'); byId('pois', x => x[x.length - 2], 'decor', 'point nommé'); byId('ctl', x => x.id, 'batiments', 'salle nommée'); byId('deco', x => x.id, 'circuit', 'voie décorative');
    byId('attrs', x => x.role + ' ' + x.id, 'tags', 'attribut');
    for (const k of ['paths', 'polys']) { const a = O[k] || {}, b = N[k] || {}; for (const q of new Set(Object.keys(a).concat(Object.keys(b)))) if (S(a[q]) !== S(b[q])) out[KEYCAT[k]].changes.push((!(q in a) ? '+ ' : !(q in b) ? '- ' : '~ ') + (k === 'paths' ? 'chemin ' : 'polygone ') + q); }
    if (S(O.trees) !== S(N.trees)) out.decor.changes.push('~ arbres : ' + (O.trees || []).length + ' → ' + (N.trees || []).length);
    if (S(O.others) !== S(N.others)) out.circuit.changes.push('~ voies voisines : ' + (O.others || []).length + ' → ' + (N.others || []).length);
    if (S(O.cps) !== S(N.cps)) { const rp = c => { const m = {}; (c || []).forEach((r, i) => r.slice(4).forEach(n => { m[n] = i; })); return m; }, a = rp(O.cps), b = rp(N.cps);
      const mv = [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(n => a[n] !== b[n]).map(n => n + (n in a ? '' : ' (nouveau)') + (n in b ? '' : ' (retiré)'));
      out.circuit.changes.push('~ tracé : ' + (O.cps || []).length + ' → ' + (N.cps || []).length + ' points de contrôle' + (mv.length ? ' ; repères déplacés : ' + mv.join(', ') : '')); }
    for (const k of ['tunnels', 'inversions', 'elements', 'stations', 'ele', 'levels']) if (S(O[k]) !== S(N[k])) out.circuit.changes.push('~ ' + k + ' : ' + (O[k] ? S(O[k]).slice(0, 120) : '(absent)') + ' → ' + (N[k] ? S(N[k]).slice(0, 120) : '(absent)'));
    return out;
  }
  function counts(res) { const c = {}; for (const k of ['cps', 'feats', 'others', 'stairs', 'doors', 'barriers', 'widths', 'trees', 'pois', 'tunnels', 'attrs', 'deco', 'levels']) if (Array.isArray(res[k])) c[k] = res[k].length; c.paths = Object.keys(res.paths || {}).length; c.tags = (res.feats || []).filter(f => f.t).length; return c; }

  // ── Téléchargement (navigateur) : zone de la fiche + marge, découpée en tuiles ; objets incomplets relus un par un ──
  const MARGE = 60, TUILE = 0.01; // m autour de la zone de la fiche (ESTIMÉ) ; côté maxi d'une tuile en degrés (limite de taille de l'API /map)
  function plan(spec) {
    let bb = spec.osm_bbox; // [ouest, sud, est, nord] en degrés, facultatif dans la fiche
    if (!bb) { const [lat0, lon0] = spec.origin, kx = 111320 * Math.cos(lat0 * RAD), [x0, x1, z0, z1] = spec.bbox; bb = [lon0 + (x0 - MARGE) / kx, lat0 - (z1 + MARGE) / 111320, lon0 + (x1 + MARGE) / kx, lat0 - (z0 - MARGE) / 111320]; }
    const r7 = v => Math.round(v * 1e7) / 1e7, nx = Math.max(1, Math.ceil((bb[2] - bb[0]) / TUILE)), ny = Math.max(1, Math.ceil((bb[3] - bb[1]) / TUILE)), tiles = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) tiles.push([bb[0] + (bb[2] - bb[0]) * i / nx, bb[1] + (bb[3] - bb[1]) * j / ny, bb[0] + (bb[2] - bb[0]) * (i + 1) / nx, bb[1] + (bb[3] - bb[1]) * (j + 1) / ny].map(r7));
    return { bbox: bb.map(r7), urls: tiles.map(t => '/api/0.6/map.json?bbox=' + t.join(',')) };
  }
  function needed(els, spec, max) { // compléments : tronçons de la fiche absents (way/<id>/full), multipolygones coupés par la zone (relation/<id>/full)
    const W = new Set(), urls = []; for (const e of els) if (e.type === 'way') W.add(String(e.id));
    const ids = (spec.track_ways || []).concat(Object.values(spec.paths || {}).flat(), Object.values(spec.polys || {}), spec.drop_ways || []).map(String);
    for (const m of [...new Set(ids)]) if (!W.has(m)) urls.push('/api/0.6/way/' + m + '/full.json');
    for (const e of els) if (e.type === 'relation' && e.tags && e.tags.type === 'multipolygon' && (e.members || []).some(m => m.type === 'way' && !W.has(String(m.ref)))) urls.push('/api/0.6/relation/' + e.id + '/full.json');
    return urls.slice(0, max || 40);
  }

  return { build, merge, summary, counts, text, parseData, parseRaw, dumps, plan, needed, mergeElements, xmlElements, CATS, catOfFeat, pyRound, pyRepr, pysum, Raw };
});
