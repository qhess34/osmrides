'use strict';
/* Éditeur T2Z : format de lieux/<type>/<lieu>/<el>.game.js, validation et diff. Partagé par le serveur (Node, require) et l'interface (navigateur, window.T2ZSchema).
   Format (docs/ARCHITECTURE.md D1) : un en-tête de commentaires, puis `const GAME = <JSON strict>;`. */
(function (root) {
  const HEAD = '// Données du jeu écrites par l\'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (lieux/<type>/<lieu>/<el>.js).\n'
    + '// Le corps est du JSON strict : à modifier de préférence avec l\'éditeur (docker compose up -d, http://127.0.0.1:8787/).\n';
  const KNOWN = ['version', 'barriers', 'controlRooms', 'boardAreas', 'queueEntry', 'look']; // plus les sections des couches (SECTIONS)
  // Sections de GAME propres à un type d'attraction (docs/ARCHITECTURE.md D14) : déclarées par engine/<couche>/schema.js, section({cle, normalize(v), validate(v, E, W, ctx)}).
  const SECTIONS = {};
  function section(def) { SECTIONS[def.cle] = def; if (!KNOWN.includes(def.cle)) KNOWN.push(def.cle); }
  // GAME.site (docs/ARCHITECTURE.md D9) : surcharges partielles de SITE, liste blanche stricte. Chaque couche déclare ses clés par sitePart({keys, validate(T, E, W, ctx), normalize(t, o)}) ;
  // le noyau (engine/noyau/schema.js : objectif, caméras, textes, éclair, postes de maintenance) et les types (engine/montagnes-russes/schema.js). Toute clé hors liste est refusée.
  // Valeur absente = valeur d'origine de SITE ; GAME.site n'est écrit que par une modification dans l'éditeur.
  const SITE_PARTS = [];
  function sitePart(def) { SITE_PARTS.push(def); }
  section({ cle: 'site',
    validate(T, E, W, ctx) {
      if (!T || typeof T !== 'object' || Array.isArray(T)) { E.push('site : objet attendu'); return; }
      const ok = [].concat(...SITE_PARTS.map(p => p.keys));
      for (const k of Object.keys(T)) if (!ok.includes(k)) E.push('site.' + k + ' : clé refusée (autorisées : ' + ok.join(', ') + ')');
      for (const p of SITE_PARTS) p.validate(T, E, W, ctx || {});
    },
    normalize(t) { const o = {}; for (const p of SITE_PARTS) p.normalize(t, o); return o; } });
  // LIEU (osmrides#53) : lieux/<type>/<lieu>/lieu.js, `const LIEU = {hours:{open:'hh:mm', close:'hh:mm'}}` ; commun à toutes les attractions du lieu, facultatif (absent = horaires du moteur, 10:00 à 19:00).
  const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/, hm = v => { const m = HM.exec(v); return m ? +m[1] * 60 + +m[2] : NaN; };
  const LIEU_MIN = 120; // ouverture d'au moins 2 h (ESTIMÉ, même borne que le moteur : engine/noyau/base.js)
  function validateLieu(L) {
    const E = [], W = [];
    if (!L || typeof L !== 'object' || Array.isArray(L)) return { errors: ['LIEU doit être un objet'], warnings: W };
    for (const k of Object.keys(L)) if (k !== 'hours') E.push('lieu.' + k + ' : clé refusée (autorisée : hours)');
    if ('hours' in L) {
      const H = L.hours;
      if (!H || typeof H !== 'object' || Array.isArray(H)) E.push('lieu.hours : objet {open, close} attendu');
      else {
        for (const k of Object.keys(H)) if (k !== 'open' && k !== 'close') E.push('lieu.hours.' + k + ' : clé refusée');
        for (const k of ['open', 'close']) if (typeof H[k] !== 'string' || !HM.test(H[k])) E.push('lieu.hours.' + k + ' : heure hh:mm attendue');
        if (!E.length && hm(H.close) - hm(H.open) < LIEU_MIN) E.push('lieu.hours : ouverture de ' + (LIEU_MIN / 60) + ' h au moins (ESTIMÉ), fermeture avant minuit');
        if (!E.length) W.push('lieu.hours : vaut pour TOUTES les attractions du lieu (fichier lieu.js commun)');
      }
    }
    return { errors: E, warnings: W };
  }
  const pad2 = n => String(n).padStart(2, '0'), hhmm = v => { const t = hm(v); return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60); };
  const LIEU_HEAD = '// Réglages du lieu, écrits par l\'éditeur OSMrides (section « Lieu ») : valent pour TOUTES les attractions du lieu. Facultatif ; absent = valeurs par défaut du moteur.\n';
  const textLieu = L => { const o = {}; if (L && L.hours) o.hours = { open: hhmm(L.hours.open), close: hhmm(L.hours.close) }; return LIEU_HEAD + 'const LIEU = ' + JSON.stringify(o, null, 2) + ';\n'; };
  function parseLieu(src) { const m = /const\s+LIEU\s*=\s*/.exec(src); if (!m) throw new Error('`const LIEU =` introuvable'); return JSON.parse(src.slice(m.index + m[0].length).replace(/;\s*$/, '')); }
  // GAME.look (issue #45, D11) : apparence de la file et des quais ; textures et matériaux générés par le moteur (engine/render.js mkLook).
  const LOOK = { tex: ['concrete', 'asphalt', 'sand', 'pavers', 'deck'], rail: ['metal', 'wood', 'stone'] };
  const LIM = { xz: 5000, ang: 720, len: [0.2, 20], size: [0.5, 40], rooms: 1, barriers: 500, areas: 1, pts: [3, 64], qeLen: [0, 30], qeAng: 360, local: 60 }; // qeLen / qeAng : entrée de file (issue #39), longueur en m (même borne que le moteur, QE_MAX) et orientation en degrés // depth (travées) : engine/montagnes-russes/schema.js

  const HEX = /^#[0-9a-fA-F]{6}$/, RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d{1,3})\)$/;

  // Valeurs arrondies (cm, dixième de degré) pour un fichier lisible et un diff stable.
  const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
  function normalize(g) {
    const o = {};
    for (const k of Object.keys(g || {})) {
      if (k === 'barriers') {
        o.barriers = {};
        for (const key of Object.keys(g.barriers).sort()) {
          const b = g.barriers[key];
          if (/^b[0-9]+$/.test(key)) { const q = { x: r2(b.x), z: r2(b.z), ang: r1(b.ang), len: r2(b.len) }; if (b.open === true) q.open = true; if (b.sw === -1) q.sw = -1; o.barriers[key] = q; } // issue #37
          else o.barriers[key] = b.off === true ? { off: true } : { x: r2(b.x), z: r2(b.z), a: { ang: r1(b.a.ang), len: r2(b.a.len) }, b: { ang: r1(b.b.ang), len: r2(b.b.len) } }; // ancien format (lu, converti par le moteur)
        }
      } else if (k === 'controlRooms') {
        o.controlRooms = g.controlRooms.map(r => { const q = { id: r.id, x: r2(r.x), z: r2(r.z), angle: r1(r.angle), w: r2(r.w), d: r2(r.d), main: r.main !== false }; for (const f of ['beacon', 'label']) if (Array.isArray(r[f])) q[f] = [r2(r[f][0]), r2(r[f][1])]; return q; });
      } else if (k === 'boardAreas') {
        o.boardAreas = g.boardAreas.map(a => ({ id: a.id, pts: a.pts.map(p => [r2(p[0]), r2(p[1])]) }));
      } else if (k === 'queueEntry') {
        o.queueEntry = { len: r2(g.queueEntry.len), ang: r1(g.queueEntry.ang) };
      } else if (k === 'look') {
        o.look = {}; const L = g.look;
        for (const f of ['queue', 'plat']) if (L[f]) { const q = {}; if (L[f].col) q.col = String(L[f].col).toLowerCase(); if (L[f].tex) q.tex = L[f].tex; if (Object.keys(q).length) o.look[f] = q; }
        if (L.ways) { const W = {}; for (const id of Object.keys(L.ways).sort()) { const q = {}; if (L.ways[id].col) q.col = String(L.ways[id].col).toLowerCase(); if (L.ways[id].tex) q.tex = L.ways[id].tex; if (Object.keys(q).length) W[id] = q; } if (Object.keys(W).length) o.look.ways = W; } // sol par chemin de file OSM (issue #45)
        if (L.rail) o.look.rail = L.rail; if (L.gate) o.look.gate = String(L.gate).toLowerCase(); if (L.roof) o.look.roof = String(L.roof).toLowerCase();
      } else if (SECTIONS[k]) o[k] = SECTIONS[k].normalize(g[k]);
      else o[k] = g[k]; // clé inconnue (lot futur) : conservée telle quelle
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
        let legacy = 0;
        for (const key of keys) {
          const b = B[key], p = 'barriers["' + key + '"]';
          if (!b || typeof b !== 'object' || Array.isArray(b)) { E.push(p + ' : objet attendu'); continue; }
          // issue #37 : barrière indépendante posée à la main, clé 'b<n>' : {x, z, ang, len, open?, sw?} (pivot, angle en degrés de la position fermée, longueur,
          // ouverte au début de la partie, sens d'ouverture 1 / -1)
          if (/^b[1-9][0-9]{0,3}$/.test(key)) {
            for (const k of Object.keys(b)) if (!['x', 'z', 'ang', 'len', 'open', 'sw'].includes(k)) E.push(p + ' : clé inconnue ' + k);
            if (!num(b.x, -LIM.xz, LIM.xz) || !num(b.z, -LIM.xz, LIM.xz)) E.push(p + ' : x, z (m) hors bornes');
            if (!num(b.ang, -LIM.ang, LIM.ang)) E.push(p + '.ang : degrés, de -720 à 720');
            if (!num(b.len, LIM.len[0], LIM.len[1])) E.push(p + '.len : de ' + LIM.len[0] + ' à ' + LIM.len[1] + ' m');
            if ('open' in b && typeof b.open !== 'boolean') E.push(p + '.open : true ou false');
            if ('sw' in b && b.sw !== 1 && b.sw !== -1) E.push(p + '.sw : 1 ou -1');
            continue;
          }
          // ancien format (lot 1 à issue #34) : 'entry', 'fork:<tronçon>:<rôle>', 'add:<tronçon>:<n>' = {x, z, a:{ang, len}, b:{ang, len}} ou {off:true} ; accepté,
          // converti par le moteur en barrières indépendantes à la lecture, remplacé par l'éditeur à la première modification d'une barrière
          const isAdd = /^add:[^\n"\\:]{1,80}:[1-9][0-9]{0,2}$/.test(key);
          if (!isAdd && !/^(entry|fork:[^\n"\\]{1,80}:[a-z]+[0-9]+(#[0-9]+)?)$/.test(key)) { E.push(p + ' : clé invalide (b<n> attendu)'); continue; }
          legacy++;
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
        if (legacy) W.push('barriers : ' + legacy + ' barrière(s) à l\'ancien format (surcharges, ajouts), converties par le jeu en barrières indépendantes ; réécrites au format b<n> à la première modification d\'une barrière');
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
          for (const k of Object.keys(r)) if (!['id', 'x', 'z', 'angle', 'w', 'd', 'main', 'beacon', 'label'].includes(k)) E.push(p + ' : clé inconnue ' + k);
          if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(r.id)) E.push(p + '.id : lettres, chiffres, - ou _');
          else if (ids.has(r.id)) E.push(p + '.id : en double'); else ids.add(r.id);
          if (!num(r.x, -LIM.xz, LIM.xz) || !num(r.z, -LIM.xz, LIM.xz)) E.push(p + ' : x, z (m) hors bornes');
          if (!num(r.angle, -LIM.ang, LIM.ang)) E.push(p + '.angle : degrés, de -720 à 720');
          if (!num(r.w, LIM.size[0], LIM.size[1]) || !num(r.d, LIM.size[0], LIM.size[1])) E.push(p + ' : w, d de ' + LIM.size[0] + ' à ' + LIM.size[1] + ' m');
          if ('main' in r && typeof r.main !== 'boolean') E.push(p + '.main : booléen');
          for (const f of ['beacon', 'label']) if (f in r && !(Array.isArray(r[f]) && r[f].length === 2 && r[f].every(v => num(v, -LIM.local, LIM.local)))) E.push(p + '.' + f + ' : [x, z] en m dans le repère de la salle (de -' + LIM.local + ' à ' + LIM.local + ')'); // gyrophare (borné à la salle +/- 0,5 m par le moteur) et étiquette du pupitre
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
    if ('queueEntry' in g) { // entrée de file (issue #39) : prolongement droit depuis le début du chemin de file OSM, longueur (m) et orientation (degrés, 0 = est, 90 = sud)
      const Q = g.queueEntry;
      if (!Q || typeof Q !== 'object' || Array.isArray(Q)) E.push('queueEntry : objet {len, ang} attendu');
      else {
        for (const k of Object.keys(Q)) if (k !== 'len' && k !== 'ang') E.push('queueEntry : clé inconnue ' + k);
        if (!num(Q.len, LIM.qeLen[0], LIM.qeLen[1])) E.push('queueEntry.len : longueur de ' + LIM.qeLen[0] + ' à ' + LIM.qeLen[1] + ' m');
        if (!num(Q.ang, -LIM.qeAng, LIM.qeAng)) E.push('queueEntry.ang : orientation de -' + LIM.qeAng + ' à ' + LIM.qeAng + ' degrés');
      }
    }
    for (const k of Object.keys(SECTIONS)) if (k in g) SECTIONS[k].validate(g[k], E, W, ctx || {}); // sections des couches
    if ('look' in g) { // apparence (issue #45) : {queue:{col, tex}, plat:{col, tex}, rail, gate, roof}, chaque clé facultative
      const L = g.look;
      if (!L || typeof L !== 'object' || Array.isArray(L)) E.push('look : objet attendu');
      else for (const k of Object.keys(L)) {
        const v = L[k];
        if (k === 'queue' || k === 'plat') {
          if (!v || typeof v !== 'object' || Array.isArray(v)) { E.push('look.' + k + ' : objet {col, tex} attendu'); continue; }
          for (const f of Object.keys(v)) {
            if (f === 'col') { if (typeof v.col !== 'string' || !HEX.test(v.col)) E.push('look.' + k + '.col : couleur #rrggbb attendue'); }
            else if (f === 'tex') { if (!LOOK.tex.includes(v.tex)) E.push('look.' + k + '.tex : ' + LOOK.tex.join(' | ') + ' attendu'); }
            else E.push('look.' + k + ' : clé inconnue ' + f);
          }
        } else if (k === 'rail') { if (!LOOK.rail.includes(v)) E.push('look.rail : ' + LOOK.rail.join(' | ') + ' attendu'); }
        else if (k === 'ways') { // sol par chemin de file : {"w123": {tex, col}}
          if (!v || typeof v !== 'object' || Array.isArray(v)) { E.push('look.ways : objet {"w123": {tex, col}} attendu'); continue; }
          for (const id of Object.keys(v)) { const q = v[id];
            if (!/^w[0-9]{1,12}$/.test(id)) { E.push('look.ways : identifiant de chemin OSM wNNN attendu, reçu ' + id); continue; }
            if (!q || typeof q !== 'object' || Array.isArray(q)) { E.push('look.ways.' + id + ' : objet {col, tex} attendu'); continue; }
            for (const f of Object.keys(q)) {
              if (f === 'col') { if (typeof q.col !== 'string' || !HEX.test(q.col)) E.push('look.ways.' + id + '.col : couleur #rrggbb attendue'); }
              else if (f === 'tex') { if (!LOOK.tex.includes(q.tex)) E.push('look.ways.' + id + '.tex : ' + LOOK.tex.join(' | ') + ' attendu'); }
              else E.push('look.ways.' + id + ' : clé inconnue ' + f); } } }
        else if (k === 'gate') { if (typeof v !== 'string' || !HEX.test(v)) E.push('look.gate : couleur #rrggbb attendue'); }
        else if (k === 'roof') { if (typeof v !== 'string' || !HEX.test(v)) E.push('look.roof : couleur #rrggbb attendue'); } // toit du bâtiment de la gare (issue #46)
        else E.push('look : clé inconnue ' + k);
      }
    }
    return { errors: E, warnings: W };
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


  // ── Écarts GAME ↔ OSM.attrs (issue #46, D12) : ce que l'éditeur pourrait renvoyer vers OSM. Pur (serveur et interface). Un réglage absent de GAME = valeur OSM : aucun écart.
  // attrs = OSM.attrs (tools/make_site.py : [{role, id, v, l, t, h}]) ; ctx.plats = polygones [[x, z], …] du quai calculé (proposition de création, décochée par défaut dans l'interface).
  // Correspondances : textures du jeu <-> surface OSM (concrete, asphalt, sand <-> compacted | fine_gravel, pavers <-> paving_stones | sett, deck <-> wood), matériau des garde-corps <-> material.
  const SURF_OUT = { concrete: 'concrete', asphalt: 'asphalt', sand: 'compacted', pavers: 'paving_stones', deck: 'wood' };
  const SURF_IN = { concrete: 'concrete', asphalt: 'asphalt', compacted: 'sand', fine_gravel: 'sand', paving_stones: 'pavers', sett: 'pavers', wood: 'deck' };
  const MAT_IN = { metal: 'metal', steel: 'metal', iron: 'metal', wood: 'wood', stone: 'stone', brick: 'stone', concrete: 'stone' };
  const OSM_TAGS = { queue: ['surface', 'colour'], plat: ['surface', 'colour'], rail: ['material'], roof: ['roof:colour'] }; // clés que l'envoi peut écrire, par rôle
  const hexOf = (a, k) => ((a.h && a.h[k]) || (a.t && HEX.test(a.t[k] || '') ? a.t[k] : '') || '').toLowerCase();
  function osmDiff(game, attrs, ctx) {
    const out = [], L = (game && game.look) || {}, A = Array.isArray(attrs) ? attrs : [];
    const push = (a, key, from, to) => out.push({ type: 'modify', role: a.role, id: a.id, v: a.v, key, from: from == null ? '' : from, to });
    const tex = (role, o) => { if (!o) return;
      for (const a of A) if (a.role === role) {
        if (o.tex && SURF_IN[(a.t || {}).surface] !== o.tex) push(a, 'surface', (a.t || {}).surface, SURF_OUT[o.tex]);
        if (o.col && hexOf(a, 'colour') !== o.col.toLowerCase()) push(a, 'colour', (a.t || {}).colour, o.col.toLowerCase());
      } };
    const W = L.ways || {}; // sol par chemin (issue #45) : valeur du chemin, sinon celle des allées ; renvoyée sur CE way
    for (const a of A) if (a.role === 'queue') { const w = W[a.id] || {}, g = L.queue || {}, tx = w.tex || g.tex, cl = w.col || g.col;
      if (tx && SURF_IN[(a.t || {}).surface] !== tx) push(a, 'surface', (a.t || {}).surface, SURF_OUT[tx]);
      if (cl && hexOf(a, 'colour') !== cl.toLowerCase()) push(a, 'colour', (a.t || {}).colour, cl.toLowerCase()); }
    tex('plat', L.plat);
    if (L.rail) for (const a of A) if (a.role === 'rail' && MAT_IN[(a.t || {}).material] !== L.rail) push(a, 'material', (a.t || {}).material, L.rail);
    if (L.roof) for (const a of A) if (a.role === 'roof' && hexOf(a, 'roof:colour') !== L.roof.toLowerCase()) push(a, 'roof:colour', (a.t || {})['roof:colour'], L.roof.toLowerCase());
    // couleurs de la voie (GAME.site.track / trough) : réglage du jeu seulement, jamais renvoyé vers OSM (osmrides#53 lot 2, propriétaire 24/11)
    // polygone de sol du quai : proposé seulement si un réglage de quai existe et qu'aucun polygone n'existe dans OSM (une case par quai, décochée par défaut)
    const P = L.plat || {};
    if ((P.tex || P.col) && !A.some(a => a.role === 'plat')) (ctx && ctx.plats || []).forEach((pts, i) => {
      const tags = { 'area:highway': 'footway', covered: 'yes', level: '0' }; if (P.tex) tags.surface = SURF_OUT[P.tex]; if (P.col) tags.colour = P.col.toLowerCase();
      out.push({ type: 'create', role: 'plat', id: 'new' + (i + 1), v: 0, key: 'polygone du quai ' + (i + 1), from: '', to: Object.keys(tags).map(k => k + '=' + tags[k]).join(', '), tags, pts });
    });
    return out;
  }
  const api = { sitePart, validateLieu, textLieu, parseLieu, LIEU_MIN, osmDiff, OSM_TAGS, SURF_OUT, SURF_IN, MAT_IN, HEAD, KNOWN, LOOK, LIM, HEX, RGBA, num, r1, r2, section, SECTIONS, normalize, validate, text, parse, diff, selfCross };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    // Node (serveur, tests) : sections de chaque couche du moteur de cette version (engine/<couche>/schema.js) ; navigateur : chargées par editor/editor.js
    const fs = require('fs'), path = require('path'), ENG = path.join(__dirname, '..', 'engine');
    for (const d of fs.readdirSync(ENG).sort()) { const f = path.join(ENG, d, 'schema.js'); if (fs.existsSync(f)) require(f)(api); }
  } else root.T2ZSchema = api;
})(this);
