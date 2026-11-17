'use strict';
/* Éditeur T2Z : format de sites/<site>.game.js, validation et diff. Partagé par le serveur (Node, require) et l'interface (navigateur, window.T2ZSchema).
   Format (docs/ARCHITECTURE.md D1) : un en-tête de commentaires, puis `const GAME = <JSON strict>;`. */
(function (root) {
  const HEAD = '// Données du jeu écrites par l\'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).\n'
    + '// Le corps est du JSON strict : à modifier de préférence avec l\'éditeur (docker compose up -d, http://127.0.0.1:8787/).\n';
  const KNOWN = ['version', 'barriers', 'controlRooms'];
  const LIM = { xz: 5000, ang: 720, len: [0.2, 20], size: [0.5, 40], rooms: 1, barriers: 500 };

  // Valeurs arrondies (cm, dixième de degré) pour un fichier lisible et un diff stable.
  const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
  function normalize(g) {
    const o = {};
    for (const k of Object.keys(g || {})) {
      if (k === 'barriers') {
        o.barriers = {};
        for (const key of Object.keys(g.barriers).sort()) {
          const b = g.barriers[key];
          o.barriers[key] = { x: r2(b.x), z: r2(b.z), a: { ang: r1(b.a.ang), len: r2(b.a.len) }, b: { ang: r1(b.b.ang), len: r2(b.b.len) } };
        }
      } else if (k === 'controlRooms') {
        o.controlRooms = g.controlRooms.map(r => ({ id: r.id, x: r2(r.x), z: r2(r.z), angle: r1(r.angle), w: r2(r.w), d: r2(r.d), main: r.main !== false }));
      } else o[k] = g[k]; // clé inconnue (lot futur) : conservée telle quelle
    }
    return o;
  }

  const num = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;
  // Renvoie {errors:[…], warnings:[…]} ; aucune écriture si errors n'est pas vide.
  function validate(g) {
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
          if (!/^(entry|fork:[^\n"\\]{1,80}:[a-z]+[0-9]+(#[0-9]+)?)$/.test(key)) { E.push(p + ' : clé invalide'); continue; }
          if (!b || typeof b !== 'object') { E.push(p + ' : objet attendu'); continue; }
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
    return { errors: E, warnings: W };
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

  const api = { HEAD, KNOWN, LIM, normalize, validate, text, parse, diff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.T2ZSchema = api;
})(this);
