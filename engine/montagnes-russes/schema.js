'use strict';
/* Sections de GAME propres aux montagnes russes (éditeur ; docs/ARCHITECTURE.md D8, D9, D14) : site (surcharges de SITE, liste blanche) et board (profondeur des
   travées d'attente). Chargé par editor/schema.js (Node : serveur, tests) ou par editor/editor.js (navigateur) ; S = editor/schema.js. */
(function (inscrit) {
  inscrit(function (S) {
  // GAME.site (lot 3, D9) : surcharges partielles de SITE, liste blanche ; bornes ESTIMÉES (sûres pour le moteur, pas des mesures).
  const SK = { kind: ['wood', 'bob', 'inverted', 'steel'], restraint: ['lapbar', 'otsr', 'belt'] };
  const SL = { len: [0.5, 6], n: [1, 30], seats: [1, 8], abreast: [1, 8], trainLen: 40, trains: [1, 8], wear: [0, 100], lane: [1, 8], roll: [0, 0.3], drag: [0, 0.01], vmin: [1, 6], name: 40 };
  const SITE_KEYS = { kind: 'enum', car: ['len', 'n', 'seats', 'abreast', 'restraint'], trains: 'list', track: ['spine', 'rail', 'support'], trough: ['lo', 'hi', 'edge', 'deck', 'rim', 'shine'], phys: ['roll', 'drag', 'vmin'] };
  const DEPTH = [0.5, 6]; // profondeur des travées d'attente (m, issue #27), bornes ESTIMÉES (le moteur garde au moins un rang)
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
      if (f === 'len') { if (!S.num(v, SL.len[0], SL.len[1])) E.push(p + ' : longueur de ' + SL.len[0] + ' à ' + SL.len[1] + ' m'); }
      else if (f === 'restraint') { if (!SK.restraint.includes(v)) E.push(p + ' : ' + SK.restraint.join(' | ') + ' attendu'); }
      else if (!isInt(v, SL[f][0], SL[f][1])) E.push(p + ' : entier de ' + SL[f][0] + ' à ' + SL[f][1]);
    });
    if (T.car && typeof T.car === 'object' && S.num(T.car.len, 0, 1e3) && isInt(T.car.n, 1, 1e3) && T.car.len * T.car.n > SL.trainLen) E.push('site.car : train trop long (len x n = ' + Math.round(T.car.len * T.car.n * 10) / 10 + ' m, ' + SL.trainLen + ' m au plus)');
    if ('trains' in T) {
      const A = T.trains;
      const tm = Number.isInteger(ctx.trainMax) && ctx.trainMax >= SL.trains[0] ? Math.min(SL.trains[1], ctx.trainMax) : SL.trains[1];
      if (!Array.isArray(A) || A.length < SL.trains[0] || A.length > tm) E.push('site.trains : de ' + SL.trains[0] + ' à ' + tm + ' trains' + (tm < SL.trains[1] ? ' (un par place où un train peut attendre : gare, voies de garage, zones de freinage)' : ''));
      else A.forEach((c, i) => {
        const p = 'site.trains[' + i + ']';
        if (!c || typeof c !== 'object' || Array.isArray(c)) { E.push(p + ' : objet attendu'); return; }
        for (const f of Object.keys(c)) if (!['name', 'col', 'col2', 'wear', 'lane'].includes(f)) E.push(p + '.' + f + ' : clé refusée');
        if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > SL.name || /[\u0000-\u001f<>"\\]/.test(c.name)) E.push(p + '.name : texte de 1 à ' + SL.name + ' caractères (sans < > " \\)');
        for (const f of ['col', 'col2']) if (typeof c[f] !== 'string' || !S.HEX.test(c[f])) E.push(p + '.' + f + ' : couleur #rrggbb');
        if (!S.num(c.wear, SL.wear[0], SL.wear[1])) E.push(p + '.wear : usure de ' + SL.wear[0] + ' à ' + SL.wear[1]);
        if ('lane' in c && !isInt(c.lane, SL.lane[0], SL.lane[1])) E.push(p + '.lane : voie de garage de ' + SL.lane[0] + ' à ' + SL.lane[1]);
      });
    }
    sub('track', SITE_KEYS.track, (f, v, p) => { if (typeof v !== 'string' || !S.HEX.test(v)) E.push(p + ' : couleur #rrggbb'); });
    sub('trough', SITE_KEYS.trough, (f, v, p) => {
      if (f === 'lo' || f === 'hi') { if (!Array.isArray(v) || v.length !== 3 || !v.every(c => isInt(c, 0, 255))) E.push(p + ' : [r, g, b] entiers de 0 à 255'); }
      else if (f === 'shine') { if (typeof v !== 'string' || !S.RGBA.test(v)) E.push(p + ' : rgba(r,g,b,a) attendu'); }
      else if (typeof v !== 'string' || !S.HEX.test(v)) E.push(p + ' : couleur #rrggbb');
    });
    sub('phys', SITE_KEYS.phys, (f, v, p) => { if (!S.num(v, SL[f][0], SL[f][1])) E.push(p + ' : de ' + SL[f][0] + ' à ' + SL[f][1]); });
  }

  S.section({ cle: 'site', validate: (T, E, W, ctx) => validateSite(T, E, W, ctx),
      normalize(t) { const o = { site: {} };
        for (const key of Object.keys(SITE_KEYS)) {
          if (!(key in t)) continue;
          const v = t[key];
          if (key === 'kind') o.site.kind = v;
          else if (key === 'trains') o.site.trains = v.map(c => { const q = { name: c.name, col: String(c.col).toLowerCase(), col2: String(c.col2).toLowerCase(), wear: S.r2(c.wear) }; if (c.lane != null) q.lane = c.lane; return q; });
          else if (key === 'trough') { const q = {}; for (const f of SITE_KEYS.trough) if (f in v) q[f] = Array.isArray(v[f]) ? v[f].map(Math.round) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o.site.trough = q; }
          else { const q = {}; for (const f of SITE_KEYS[key]) if (f in v) q[f] = typeof v[f] === 'number' ? (key === 'phys' ? Math.round(v[f] * 1e5) / 1e5 : S.r2(v[f])) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o.site[key] = q; }
        }
        return o.site; },
  });
  S.section({ cle: 'board', // quai d'embarquement (issue #27) : profondeur des travées d'attente derrière les portillons, en m depuis la ligne des portillons
      normalize: b => ({ depth: S.r2(b.depth) }),
      validate(B, E) { // quai d'embarquement (issue #27) : profondeur des travées d'attente derrière les portillons, en m depuis la ligne des portillons
      if (!B || typeof B !== 'object' || Array.isArray(B)) E.push('board : objet {depth} attendu');
      else {
        for (const k of Object.keys(B)) if (k !== 'depth') E.push('board : clé inconnue ' + k);
        if (!S.num(B.depth, DEPTH[0], DEPTH[1])) E.push('board.depth : profondeur des travées de ' + DEPTH[0] + ' à ' + DEPTH[1] + ' m');
      }
    }
  });
  Object.assign(S, { SK, SL, SITE_KEYS }); S.LIM.depth = DEPTH; // panneaux de l'éditeur (engine/montagnes-russes/editeur.js)
  });
})(typeof module !== 'undefined' && module.exports ? f => { module.exports = f; } : f => f(window.T2ZSchema));
