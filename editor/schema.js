'use strict';
/* Éditeur T2Z : format de sites/<site>.game.js, validation et diff. Partagé par le serveur (Node, require) et l'interface (navigateur, window.T2ZSchema).
   Format (docs/ARCHITECTURE.md D1) : un en-tête de commentaires, puis `const GAME = <JSON strict>;`. */
(function (root) {
  const HEAD = '// Données du jeu écrites par l\'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).\n'
    + '// Le corps est du JSON strict : à modifier de préférence avec l\'éditeur (docker compose up -d, http://127.0.0.1:8787/).\n';
  const KNOWN = ['version', 'barriers', 'controlRooms', 'boardAreas', 'board', 'site'];
  const LIM = { xz: 5000, ang: 720, len: [0.2, 20], size: [0.5, 40], rooms: 1, barriers: 500, areas: 1, pts: [3, 64], depth: [0.5, 6] }; // depth : profondeur des travées d'attente (m, issue #27), bornes ESTIMÉES (le moteur garde au moins un rang)

  // GAME.site (lot 3, D9) : surcharges partielles de SITE, liste blanche ; bornes ESTIMÉES (sûres pour le moteur, pas des mesures).
  const SK = { kind: ['wood', 'bob', 'inverted', 'steel'], restraint: ['lapbar', 'otsr', 'belt'] };
  const SL = { len: [0.5, 6], n: [1, 30], seats: [1, 8], abreast: [1, 8], trainLen: 40, trains: [1, 8], wear: [0, 100], lane: [1, 8], roll: [0, 0.3], drag: [0, 0.01], vmin: [1, 6], name: 40 };
  const HEX = /^#[0-9a-fA-F]{6}$/, RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d{1,3})\)$/;
  const SITE_KEYS = { kind: 'enum', car: ['len', 'n', 'seats', 'abreast', 'restraint'], trains: 'list', track: ['spine', 'rail', 'support'], trough: ['lo', 'hi', 'edge', 'deck', 'rim', 'shine'], phys: ['roll', 'drag', 'vmin'] };

  // Valeurs arrondies (cm, dixième de degré) pour un fichier lisible et un diff stable.
  const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
  function normalize(g) {
    const o = {};
    for (const k of Object.keys(g || {})) {
      if (k === 'barriers') {
        o.barriers = {};
        for (const key of Object.keys(g.barriers).sort()) {
          const b = g.barriers[key];
          o.barriers[key] = b.off === true ? { off: true } : { x: r2(b.x), z: r2(b.z), a: { ang: r1(b.a.ang), len: r2(b.a.len) }, b: { ang: r1(b.b.ang), len: r2(b.b.len) } };
        }
      } else if (k === 'controlRooms') {
        o.controlRooms = g.controlRooms.map(r => ({ id: r.id, x: r2(r.x), z: r2(r.z), angle: r1(r.angle), w: r2(r.w), d: r2(r.d), main: r.main !== false }));
      } else if (k === 'boardAreas') {
        o.boardAreas = g.boardAreas.map(a => ({ id: a.id, pts: a.pts.map(p => [r2(p[0]), r2(p[1])]) }));
      } else if (k === 'board') {
        o.board = { depth: r2(g.board.depth) };
      } else if (k === 'site') {
        o.site = {}; const t = g.site;
        for (const key of Object.keys(SITE_KEYS)) {
          if (!(key in t)) continue;
          const v = t[key];
          if (key === 'kind') o.site.kind = v;
          else if (key === 'trains') o.site.trains = v.map(c => { const q = { name: c.name, col: String(c.col).toLowerCase(), col2: String(c.col2).toLowerCase(), wear: r2(c.wear) }; if (c.lane != null) q.lane = c.lane; return q; });
          else if (key === 'trough') { const q = {}; for (const f of SITE_KEYS.trough) if (f in v) q[f] = Array.isArray(v[f]) ? v[f].map(Math.round) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o.site.trough = q; }
          else { const q = {}; for (const f of SITE_KEYS[key]) if (f in v) q[f] = typeof v[f] === 'number' ? (key === 'phys' ? Math.round(v[f] * 1e5) / 1e5 : r2(v[f])) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o.site[key] = q; }
        }
      } else o[k] = g[k]; // clé inconnue (lot futur) : conservée telle quelle
    }
    return o;
  }

  const num = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;
  // Renvoie {errors:[…], warnings:[…]} ; aucune écriture si errors n'est pas vide.
  // ctx.trainMax (facultatif) : nombre de places où un train peut attendre sur l'attraction (TRAIN_MAX du moteur, issue #32) ; borne site.trains en plus de SL.trains.
  function validate(g, ctx) {
    const E = [], W = [];
    if (!g || typeof g !== 'object' || Array.isArray(g)) return { errors: ['GAME doit être un objet'], warnings: W };
    for (const k of Object.keys(g)) if (!KNOWN.includes(k)) W.push('clé inconnue de cet éditeur, conservée sans modification : ' + k);
    if ('version' in g && g.version !== 1) E.push('version : 1 attendu');
    if ('barriers' in g) {
      const B = g.barriers;
      if (!B || typeof B !== 'object' || Array.isArray(B)) E.push('barriers : objet attendu');
      else {
        const keys = Object.keys(B);
        if (keys.length > LIM.barriers) E.push('barriers : trop de surcharges');
        for (const key of keys) {
          const b = B[key], p = 'barriers["' + key + '"]';
          // clés : 'entry', 'fork:<tronçon>:<rôle>' (barrière calculée), 'add:<tronçon>:<n>' (barrière ajoutée à la main, liée à la fourche de ce tronçon)
          const isAdd = /^add:[^\n"\\:]{1,80}:[1-9][0-9]{0,2}$/.test(key);
          if (!isAdd && !/^(entry|fork:[^\n"\\]{1,80}:[a-z]+[0-9]+(#[0-9]+)?)$/.test(key)) { E.push(p + ' : clé invalide'); continue; }
          if (!b || typeof b !== 'object' || Array.isArray(b)) { E.push(p + ' : objet attendu'); continue; }
          // suppression d'une barrière calculée : {off:true} seul (le calcul n'est jamais effacé) ; une barrière ajoutée se retire de GAME, sans off
          if ('off' in b) { if (isAdd) E.push(p + ' : une barrière ajoutée se supprime en retirant sa clé (pas de off)'); else if (b.off !== true || Object.keys(b).length !== 1) E.push(p + ' : suppression = {"off": true} seul'); continue; }
          for (const k of Object.keys(b)) if (!['x', 'z', 'a', 'b'].includes(k)) E.push(p + ' : clé inconnue ' + k);
          if (!num(b.x, -LIM.xz, LIM.xz) || !num(b.z, -LIM.xz, LIM.xz)) E.push(p + ' : x, z (m) hors bornes');
          for (const s of ['a', 'b']) {
            const q = b[s];
            if (!q || typeof q !== 'object') { E.push(p + '.' + s + ' : objet {ang, len} attendu'); continue; }
            for (const k of Object.keys(q)) if (!['ang', 'len'].includes(k)) E.push(p + '.' + s + ' : clé inconnue ' + k);
            if (!num(q.ang, -LIM.ang, LIM.ang)) E.push(p + '.' + s + '.ang : degrés, de -720 à 720');
            if (!num(q.len, LIM.len[0], LIM.len[1])) E.push(p + '.' + s + '.len : de ' + LIM.len[0] + ' à ' + LIM.len[1] + ' m');
          }
        }
      }
    }
    if ('controlRooms' in g) {
      const R = g.controlRooms;
      if (!Array.isArray(R)) E.push('controlRooms : liste attendue');
      else {
        if (R.length > LIM.rooms) E.push('controlRooms : une seule salle de contrôle par attraction (décision du propriétaire, lot 1)');
        const ids = new Set();
        R.forEach((r, i) => {
          const p = 'controlRooms[' + i + ']';
          if (!r || typeof r !== 'object') { E.push(p + ' : objet attendu'); return; }
          for (const k of Object.keys(r)) if (!['id', 'x', 'z', 'angle', 'w', 'd', 'main'].includes(k)) E.push(p + ' : clé inconnue ' + k);
          if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(r.id)) E.push(p + '.id : lettres, chiffres, - ou _');
          else if (ids.has(r.id)) E.push(p + '.id : en double'); else ids.add(r.id);
          if (!num(r.x, -LIM.xz, LIM.xz) || !num(r.z, -LIM.xz, LIM.xz)) E.push(p + ' : x, z (m) hors bornes');
          if (!num(r.angle, -LIM.ang, LIM.ang)) E.push(p + '.angle : degrés, de -720 à 720');
          if (!num(r.w, LIM.size[0], LIM.size[1]) || !num(r.d, LIM.size[0], LIM.size[1])) E.push(p + ' : w, d de ' + LIM.size[0] + ' à ' + LIM.size[1] + ' m');
          if ('main' in r && typeof r.main !== 'boolean') E.push(p + '.main : booléen');
        });
      }
    }
    if ('boardAreas' in g) { // zone d'attente du quai d'embarquement (issue #22) : un polygone simple par quai ; le jeu n'a qu'un quai d'embarquement
      const A = g.boardAreas;
      if (!Array.isArray(A)) E.push('boardAreas : liste attendue');
      else {
        if (A.length > LIM.areas) E.push('boardAreas : un seul polygone (un seul quai d\'embarquement par attraction)');
        A.forEach((a, i) => {
          const p = 'boardAreas[' + i + ']';
          if (!a || typeof a !== 'object' || Array.isArray(a)) { E.push(p + ' : objet attendu'); return; }
          for (const k of Object.keys(a)) if (!['id', 'pts'].includes(k)) E.push(p + ' : clé inconnue ' + k);
          if (typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(a.id)) E.push(p + '.id : lettres, chiffres, - ou _');
          const P = a.pts;
          if (!Array.isArray(P) || P.length < LIM.pts[0] || P.length > LIM.pts[1]) { E.push(p + '.pts : de ' + LIM.pts[0] + ' à ' + LIM.pts[1] + ' sommets [x, z]'); return; }
          if (!P.every(q => Array.isArray(q) && q.length === 2 && num(q[0], -LIM.xz, LIM.xz) && num(q[1], -LIM.xz, LIM.xz))) { E.push(p + '.pts : sommets [x, z] (m) attendus, dans les bornes'); return; }
          let ar = 0; for (let i2 = 0, j = P.length - 1; i2 < P.length; j = i2++) ar += P[j][0] * P[i2][1] - P[i2][0] * P[j][1];
          if (Math.abs(ar) / 2 < 0.5) E.push(p + ' : surface trop petite (0,5 m² au moins)');
          if (selfCross(P)) E.push(p + ' : bords qui se croisent (polygone simple attendu)');
        });
      }
    }
    if ('board' in g) { // quai d'embarquement (issue #27) : profondeur des travées d'attente derrière les portillons, en m depuis la ligne des portillons
      const B = g.board;
      if (!B || typeof B !== 'object' || Array.isArray(B)) E.push('board : objet {depth} attendu');
      else {
        for (const k of Object.keys(B)) if (k !== 'depth') E.push('board : clé inconnue ' + k);
        if (!num(B.depth, LIM.depth[0], LIM.depth[1])) E.push('board.depth : profondeur des travées de ' + LIM.depth[0] + ' à ' + LIM.depth[1] + ' m');
      }
    }
    if ('site' in g) validateSite(g.site, E, W, ctx || {});
    return { errors: E, warnings: W };
  }
  // GAME.site : liste blanche stricte, clé par clé (toute clé hors liste est refusée). Une clé absente = valeur d'origine de SITE.
  function validateSite(T, E, W, ctx) {
    if (!T || typeof T !== 'object' || Array.isArray(T)) { E.push('site : objet attendu'); return; }
    const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
    for (const k of Object.keys(T)) if (!(k in SITE_KEYS)) E.push('site.' + k + ' : clé refusée (autorisées : ' + Object.keys(SITE_KEYS).join(', ') + ')');
    const sub = (key, keys, chk) => { // sous-objet à clés listées
      const v = T[key]; if (!(key in T)) return;
      if (!v || typeof v !== 'object' || Array.isArray(v)) { E.push('site.' + key + ' : objet attendu'); return; }
      for (const f of Object.keys(v)) if (!keys.includes(f)) E.push('site.' + key + '.' + f + ' : clé refusée'); else chk(f, v[f], 'site.' + key + '.' + f);
    };
    if ('kind' in T && !SK.kind.includes(T.kind)) E.push('site.kind : ' + SK.kind.join(' | ') + ' attendu');
    else if ('kind' in T) W.push('site.kind : changer le sous-type change le rendu, les sécurités par défaut et les supports ; la voie, la gare et le garage ne sont pas refaits (ESTIMÉ : à vérifier dans le jeu)');
    sub('car', SITE_KEYS.car, (f, v, p) => {
      if (f === 'len') { if (!num(v, SL.len[0], SL.len[1])) E.push(p + ' : longueur de ' + SL.len[0] + ' à ' + SL.len[1] + ' m'); }
      else if (f === 'restraint') { if (!SK.restraint.includes(v)) E.push(p + ' : ' + SK.restraint.join(' | ') + ' attendu'); }
      else if (!isInt(v, SL[f][0], SL[f][1])) E.push(p + ' : entier de ' + SL[f][0] + ' à ' + SL[f][1]);
    });
    if (T.car && typeof T.car === 'object' && num(T.car.len, 0, 1e3) && isInt(T.car.n, 1, 1e3) && T.car.len * T.car.n > SL.trainLen) E.push('site.car : train trop long (len x n = ' + Math.round(T.car.len * T.car.n * 10) / 10 + ' m, ' + SL.trainLen + ' m au plus)');
    if ('trains' in T) {
      const A = T.trains;
      const tm = Number.isInteger(ctx.trainMax) && ctx.trainMax >= SL.trains[0] ? Math.min(SL.trains[1], ctx.trainMax) : SL.trains[1];
      if (!Array.isArray(A) || A.length < SL.trains[0] || A.length > tm) E.push('site.trains : de ' + SL.trains[0] + ' à ' + tm + ' trains' + (tm < SL.trains[1] ? ' (un par place où un train peut attendre : gare, voies de garage, zones de freinage)' : ''));
      else A.forEach((c, i) => {
        const p = 'site.trains[' + i + ']';
        if (!c || typeof c !== 'object' || Array.isArray(c)) { E.push(p + ' : objet attendu'); return; }
        for (const f of Object.keys(c)) if (!['name', 'col', 'col2', 'wear', 'lane'].includes(f)) E.push(p + '.' + f + ' : clé refusée');
        if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > SL.name || /[\u0000-\u001f<>"\\]/.test(c.name)) E.push(p + '.name : texte de 1 à ' + SL.name + ' caractères (sans < > " \\)');
        for (const f of ['col', 'col2']) if (typeof c[f] !== 'string' || !HEX.test(c[f])) E.push(p + '.' + f + ' : couleur #rrggbb');
        if (!num(c.wear, SL.wear[0], SL.wear[1])) E.push(p + '.wear : usure de ' + SL.wear[0] + ' à ' + SL.wear[1]);
        if ('lane' in c && !isInt(c.lane, SL.lane[0], SL.lane[1])) E.push(p + '.lane : voie de garage de ' + SL.lane[0] + ' à ' + SL.lane[1]);
      });
    }
    sub('track', SITE_KEYS.track, (f, v, p) => { if (typeof v !== 'string' || !HEX.test(v)) E.push(p + ' : couleur #rrggbb'); });
    sub('trough', SITE_KEYS.trough, (f, v, p) => {
      if (f === 'lo' || f === 'hi') { if (!Array.isArray(v) || v.length !== 3 || !v.every(c => isInt(c, 0, 255))) E.push(p + ' : [r, g, b] entiers de 0 à 255'); }
      else if (f === 'shine') { if (typeof v !== 'string' || !RGBA.test(v)) E.push(p + ' : rgba(r,g,b,a) attendu'); }
      else if (typeof v !== 'string' || !HEX.test(v)) E.push(p + ' : couleur #rrggbb');
    });
    sub('phys', SITE_KEYS.phys, (f, v, p) => { if (!num(v, SL[f][0], SL[f][1])) E.push(p + ' : de ' + SL[f][0] + ' à ' + SL[f][1]); });
  }
  // deux bords non voisins qui se coupent
  function selfCross(P) {
    const n = P.length, cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = P[i], b = P[(i + 1) % n], c = P[j], d = P[(j + 1) % n];
      if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return true;
    }
    return false;
  }

  const text = g => HEAD + 'const GAME = ' + JSON.stringify(normalize(g), null, 2) + ';\n';
  // Lecture d'un game.js : retrait de l'en-tête, JSON.parse du corps (D1).
  function parse(src) {
    const m = /const\s+GAME\s*=\s*/.exec(src);
    if (!m) throw new Error('`const GAME =` introuvable');
    return JSON.parse(src.slice(m.index + m[0].length).replace(/;\s*$/, ''));
  }

  // Diff ligne à ligne (plus longue sous-suite commune) : [{t:' '|'-'|'+', s}]
  function diff(a, b) {
    const A = a ? a.split('\n') : [], B = b.split('\n'), n = A.length, m = B.length, L = [];
    for (let i = 0; i <= n; i++) L.push(new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { out.push({ t: ' ', s: A[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', s: A[i++] }); else out.push({ t: '+', s: B[j++] }); }
    while (i < n) out.push({ t: '-', s: A[i++] }); while (j < m) out.push({ t: '+', s: B[j++] });
    return out;
  }

  const api = { HEAD, KNOWN, LIM, SK, SL, SITE_KEYS, normalize, validate, text, parse, diff, selfCross };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.T2ZSchema = api;
})(this);
