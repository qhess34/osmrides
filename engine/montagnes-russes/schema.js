'use strict';
/* Sections de GAME propres aux montagnes russes (éditeur ; docs/ARCHITECTURE.md D8, D9, D14) : site (surcharges de SITE, liste blanche) et board (profondeur des
   travées d'attente). Chargé par editor/schema.js (Node : serveur, tests) ou par editor/editor.js (navigateur) ; S = editor/schema.js. */
(function (inscrit) {
  inscrit(function (S) {
  // GAME.site (lot 3, D9) : surcharges partielles de SITE, liste blanche ; bornes ESTIMÉES (sûres pour le moteur, pas des mesures).
  const SK = { kind: ['wood', 'bob', 'inverted', 'steel'], restraint: ['lapbar', 'otsr', 'belt'] };
  const SL = { len: [0.5, 6], n: [1, 30], seats: [1, 8], abreast: [1, 8], trainLen: 40, trains: [1, 8], wear: [0, 100], lane: [1, 8], roll: [0, 0.3], drag: [0, 0.01], vmin: [1, 6], name: 40,
    w: [0.5, 3], pitch: [0.2, 3], // car.w (largeur du wagon, m), car.pitch (m d'axe à axe, places l'une derrière l'autre)
    lap: [30, 600], stopBack: [0, 15], maxRun: [1, 8], holdBack: [0, 300], dropAfter: [0, 300], // tour (s), arrêt en gare avant la fin de gare (m), trains en ligne, arrêt au frein final avant la fin du circuit (m), cri après le haut du lift (m)
    zoneV: [1, 30], zoneHold: [0, 300], // frein de bloc : vitesse limite / de lancement (m/s), temps d'arrêt (s)
    move: { v: [0.2, 10], vc: [0.1, 5], t: [0.5, 30] }, // manœuvre de l'appareil de voie : vitesse, vitesse de chariot (m/s), durée (s)
    rails: { d: [-40, 40], n: [1, 12] }, // positions des rails mobiles (osmrides#64) : distance du rail à l'axe du circuit (m), nombre de positions par rail (ESTIMÉES)
    plat: { load: [1.5, 30], exit: [0, 30], back: [0, 10], front: [0, 10] }, // profondeurs des quais (m) : embarquement, sortie, au-delà de l'arrière du dernier wagon, devant le premier
    pre: { back: [0, 200], len: [3, 120] }, txt: 40 }; // les bornes ci-dessus sont ESTIMÉES (sûres pour le moteur, pas des mesures)
  const SITE_KEYS = { kind: 'enum', car: ['len', 'n', 'seats', 'abreast', 'restraint', 'w', 'inline', 'pitch'], trains: 'list', track: ['spine', 'rail', 'support'], trough: ['lo', 'hi', 'edge', 'deck', 'rim', 'shine'], phys: ['roll', 'drag', 'vmin'],
    lap: 'num', stopBack: 'num', maxRun: 'int', holdBack: 'num', dropAfter: 'num', loadSide: 'enum2', preBrake: ['back', 'len', 'name'], zones: 'zones', yard: ['move', 'devName', 'devLabel', 'rails'], plat: ['load', 'exit', 'back', 'front'] };
  const YARD_OLD = ['post', 'laneGap', 'retract', 'laneD']; // réglages chiffrés du pont de 0.6.0 : tolérés en lecture (ignorés par le moteur), plus écrits (osmrides#64)
  const RAIL_IDS = ['circuit', 'garage']; // rails mobiles : rail du circuit, rail du chariot ou tronçon en S (engine/voies/garage.js)
  const ZKEYS = ['trim', 'launch', 'hold', 'stop']; // par frein de bloc B<k> : vitesse limite (trim.v), vitesse de lancement, temps d'arrêt, arrêt obligatoire (engine/montagnes-russes/zones.js)
  const DEPTH = [0.5, 6]; // profondeur des travées d'attente (m, issue #27), bornes ESTIMÉES (le moteur garde au moins un rang)
  // GAME.site : liste blanche stricte, clé par clé (toute clé hors liste est refusée). Une clé absente = valeur d'origine de SITE.
  const txt = v => typeof v === 'string' && v.trim() && v.length <= SL.txt && !/[\u0000-\u001f<>"\\]/.test(v);
  // GAME.site.yard.rails (osmrides#64) : {circuit|garage: {pos: [{name, d}, …]} | {lock: 'garage'|'circuit'}} ; d = distance (m) du rail à l'axe du circuit, vers le garage
  function validateRails(R, p, E) {
    if (!R || typeof R !== 'object' || Array.isArray(R)) { E.push(p + ' : objet {circuit, garage} attendu'); return; }
    for (const id of Object.keys(R)) {
      const q = p + '.' + id, r = R[id];
      if (!RAIL_IDS.includes(id)) { E.push(q + ' : rail inconnu (' + RAIL_IDS.join(' | ') + ')'); continue; }
      if (!r || typeof r !== 'object' || Array.isArray(r)) { E.push(q + ' : objet {pos} ou {lock} attendu'); continue; }
      for (const f of Object.keys(r)) if (f !== 'pos' && f !== 'lock') E.push(q + '.' + f + ' : clé refusée (pos, lock)');
      if (('pos' in r) === ('lock' in r)) { E.push(q + ' : soit pos (positions), soit lock (verrouillé avec l\'autre rail)'); continue; }
      if ('lock' in r) { if (!RAIL_IDS.includes(r.lock) || r.lock === id) E.push(q + '.lock : ' + RAIL_IDS.filter(x => x !== id).join(' | ') + ' attendu');
        else if (R[r.lock] && R[r.lock].lock) E.push(q + '.lock : les deux rails ne peuvent pas être verrouillés l\'un sur l\'autre'); continue; }
      const P = r.pos;
      if (!Array.isArray(P) || P.length < SL.rails.n[0] || P.length > SL.rails.n[1]) { E.push(q + '.pos : de ' + SL.rails.n[0] + ' à ' + SL.rails.n[1] + ' positions'); continue; }
      const seen = new Set();
      P.forEach((o, i) => { const w = q + '.pos[' + i + ']';
        if (!o || typeof o !== 'object' || Array.isArray(o)) { E.push(w + ' : objet {name, d} attendu'); return; }
        for (const f of Object.keys(o)) if (f !== 'name' && f !== 'd') E.push(w + '.' + f + ' : clé refusée (name, d)');
        if (!txt(o.name)) E.push(w + '.name : texte de 1 à ' + SL.txt + ' caractères (sans < > " \\)'); else if (seen.has(o.name)) E.push(w + '.name : nom déjà pris'); else seen.add(o.name);
        if (!S.num(o.d, SL.rails.d[0], SL.rails.d[1])) E.push(w + '.d : distance de ' + SL.rails.d[0] + ' à ' + SL.rails.d[1] + ' m'); });
    }
  }
  function validateSite(T, E, W, ctx) {
    const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
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
      else if (f === 'w' || f === 'pitch') { if (!S.num(v, SL[f][0], SL[f][1])) E.push(p + ' : de ' + SL[f][0] + ' à ' + SL[f][1] + ' m'); }
      else if (f === 'inline') { if (typeof v !== 'boolean') E.push(p + ' : oui ou non'); }
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
    for (const k of ['stopBack', 'holdBack']) if (k in T && !S.num(T[k], SL[k][0], SL[k][1])) E.push('site.' + k + ' : de ' + SL[k][0] + ' à ' + SL[k][1] + ' m'); // lap et dropAfter : tolérés en lecture (anciens GAME.site), ignorés, plus écrits
    if ('maxRun' in T && !isInt(T.maxRun, SL.maxRun[0], SL.maxRun[1])) E.push('site.maxRun : entier de ' + SL.maxRun[0] + ' à ' + SL.maxRun[1] + ' trains en ligne');
    if ('loadSide' in T && T.loadSide !== 1 && T.loadSide !== -1) E.push('site.loadSide : 1 ou -1');
    sub('preBrake', SITE_KEYS.preBrake, (f, v, p) => { // frein avant gare : seulement celui que SITE déclare (le créer n'est pas possible ici)
      if (f === 'name') { if (!txt(v)) E.push(p + ' : texte de 1 à ' + SL.txt + ' caractères (sans < > " \\)'); }
      else if (!S.num(v, SL.pre[f][0], SL.pre[f][1])) E.push(p + ' : de ' + SL.pre[f][0] + ' à ' + SL.pre[f][1] + ' m');
    });
    sub('plat', SITE_KEYS.plat, (f, v, p) => { if (!S.num(v, SL.plat[f][0], SL.plat[f][1])) E.push(p + ' : profondeur de ' + SL.plat[f][0] + ' à ' + SL.plat[f][1] + ' m'); });
    if (T.yard && typeof T.yard === 'object' && !Array.isArray(T.yard) && YARD_OLD.some(f => f in T.yard)) W.push('site.yard : ' + YARD_OLD.filter(f => f in T.yard).join(', ') + ' (réglages chiffrés de 0.6.0) ignorés : les positions des rails se règlent sur la carte (rails)');
    sub('yard', SITE_KEYS.yard.concat(YARD_OLD), (f, v, p) => { // appareil de voie : vitesses, durée, noms, positions des rails mobiles (le reste décrit la voie)
      if (YARD_OLD.includes(f)) return; // toléré, ignoré
      if (f === 'move') {
        if (!v || typeof v !== 'object' || Array.isArray(v)) { E.push(p + ' : objet {v, vc, t} attendu'); return; }
        for (const m of Object.keys(v)) if (!SL.move[m]) E.push(p + '.' + m + ' : clé refusée'); else if (!S.num(v[m], SL.move[m][0], SL.move[m][1])) E.push(p + '.' + m + ' : de ' + SL.move[m][0] + ' à ' + SL.move[m][1]);
      } else if (f === 'rails') validateRails(v, p, E);
      else if (!txt(v)) E.push(p + ' : texte de 1 à ' + SL.txt + ' caractères (sans < > " \\)');
    });
    if ('zones' in T) { // freins de bloc B1…Bn : vitesse limite, vitesse de lancement, temps d'arrêt, arrêt obligatoire
      const Z = T.zones;
      if (!Z || typeof Z !== 'object' || Array.isArray(Z)) E.push('site.zones : objet {B<k>:{…}} attendu');
      else for (const id of Object.keys(Z)) {
        const p = 'site.zones.' + id, z = Z[id], m = /^B([1-9]\d?)$/.exec(id);
        if (!m) { E.push(p + ' : seuls les freins de bloc B1, B2… sont réglables ici'); continue; }
        if (Number.isInteger(ctx.blocs) && +m[1] > ctx.blocs) E.push(p + ' : cette attraction n\'a que ' + ctx.blocs + ' frein(s) de bloc');
        if (!z || typeof z !== 'object' || Array.isArray(z)) { E.push(p + ' : objet attendu'); continue; }
        for (const f of Object.keys(z)) {
          if (!ZKEYS.includes(f)) E.push(p + '.' + f + ' : clé refusée (autorisées : ' + ZKEYS.join(', ') + ')');
          else if (f === 'trim') {
            if (!z.trim || typeof z.trim !== 'object' || Array.isArray(z.trim) || Object.keys(z.trim).some(q => q !== 'v')) E.push(p + '.trim : objet {v} attendu');
            else if (!S.num(z.trim.v, SL.zoneV[0], SL.zoneV[1])) E.push(p + '.trim.v : vitesse limite de ' + SL.zoneV[0] + ' à ' + SL.zoneV[1] + ' m/s');
          } else if (f === 'launch') { if (!S.num(z.launch, SL.zoneV[0], SL.zoneV[1])) E.push(p + '.launch : vitesse de lancement de ' + SL.zoneV[0] + ' à ' + SL.zoneV[1] + ' m/s'); }
          else if (f === 'hold') { if (!S.num(z.hold, SL.zoneHold[0], SL.zoneHold[1])) E.push(p + '.hold : temps d\'arrêt de ' + SL.zoneHold[0] + ' à ' + SL.zoneHold[1] + ' s'); }
          else if (typeof z.stop !== 'boolean') E.push(p + '.stop : oui ou non');
        }
        if ('hold' in z && z.stop !== true) W.push(p + '.hold : le temps d\'arrêt ne s\'applique qu\'avec l\'arrêt obligatoire (stop)');
        if (S.num(z.launch, 0, 1e3) && z.trim && S.num(z.trim.v, 0, 1e3) && z.launch > z.trim.v) W.push(p + ' : la vitesse de lancement est ramenée à la vitesse limite');
      }
    }
  }

  S.sitePart({ keys: Object.keys(SITE_KEYS), validate: (T, E, W, ctx) => validateSite(T, E, W, ctx),
      normalize(t, out) {
        const o = out;
        for (const key of Object.keys(SITE_KEYS)) {
          if (!(key in t)) continue;
          const v = t[key];
          if (key === 'kind') o.kind = v;
          else if (key === 'lap' || key === 'dropAfter') continue; // tolérés en lecture seulement
          else if (['stopBack', 'holdBack'].includes(key)) o[key] = S.r2(v);
          else if (key === 'maxRun' || key === 'loadSide') o[key] = v;
          else if (key === 'trains') o.trains = v.map(c => { const q = { name: c.name, col: String(c.col).toLowerCase(), col2: String(c.col2).toLowerCase(), wear: S.r2(c.wear) }; if (c.lane != null) q.lane = c.lane; return q; });
          else if (key === 'trough') { const q = {}; for (const f of SITE_KEYS.trough) if (f in v) q[f] = Array.isArray(v[f]) ? v[f].map(Math.round) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o.trough = q; }
          else if (key === 'zones') { const q = {}; for (const id of Object.keys(v).sort((a, b) => +a.slice(1) - +b.slice(1))) { const z = {}; for (const f of ZKEYS) if (f in v[id]) z[f] = f === 'trim' ? { v: S.r2(v[id].trim.v) } : typeof v[id][f] === 'number' ? S.r2(v[id][f]) : v[id][f]; q[id] = z; } o.zones = q; }
          else if (key === 'yard') { const q = {}; for (const f of SITE_KEYS.yard) if (f in v) q[f] = f === 'move' ? Object.fromEntries(['v', 'vc', 't'].filter(m => m in v.move).map(m => [m, S.r2(v.move[m])]))
              : f === 'rails' ? Object.fromEntries(RAIL_IDS.filter(id => id in v.rails).map(id => [id, 'lock' in v.rails[id] ? { lock: v.rails[id].lock } : { pos: v.rails[id].pos.map(o => ({ name: o.name, d: S.r2(o.d) })) }])) : v[f];
            if (Object.keys(q).length) o.yard = q; } // post, laneGap, retract, laneD (0.6.0) : plus écrits
          else { const q = {}; for (const f of SITE_KEYS[key]) if (f in v) q[f] = typeof v[f] === 'number' ? (key === 'phys' ? Math.round(v[f] * 1e5) / 1e5 : S.r2(v[f])) : /^#/.test(v[f]) ? v[f].toLowerCase() : v[f]; o[key] = q; }
        }
      },
  });
  S.section({ cle: 'board', // quai d'embarquement (issue #27) : profondeur des travées d'attente derrière les portillons, en m depuis la ligne des portillons
      normalize: b => ({ depth: S.r2(b.depth) }),
      validate(B, E, W, ctx) { // quai d'embarquement (issue #27) : profondeur des travées d'attente derrière les portillons, en m depuis la ligne des portillons
      if (!B || typeof B !== 'object' || Array.isArray(B)) E.push('board : objet {depth} attendu');
      else {
        for (const k of Object.keys(B)) if (k !== 'depth') E.push('board : clé inconnue ' + k);
        const mx = ctx && typeof ctx.depthMax === 'number' ? Math.min(DEPTH[1], ctx.depthMax) : DEPTH[1]; // borne haute selon le quai (moteur : DEPTH_MAX, quai.js)
        if (!S.num(B.depth, DEPTH[0], mx)) E.push('board.depth : profondeur des travées de ' + DEPTH[0] + ' à ' + mx + ' m' + (mx < DEPTH[1] ? ' (quai court : au-delà, le couloir d\'attente ne recule plus derrière les travées)' : ''));
      }
    }
  });
  // GAME.profile (osmrides#53 lot 2) : hauteurs du circuit, [[s, h(, 'lin')], …] ; s = abscisse du tracé d'origine (m), h = hauteur de la voie au-dessus de la gare (m, négative en tunnel enterré), 'lin' = segment droit
  // jusqu'au point suivant (sinon courbe lisse). Remplace les hauteurs d'origine hors gare et inversions (engine/voies/trace.js). Bornes ESTIMÉES (sûres pour le moteur, pas des mesures).
  const PROF = { n: [2, 60], h: [-15, 80], gap: 1, slope: 1 }; // points (nombre), hauteur (m), écart minimal entre deux points (m), pente d'alerte (100 % = 45°)
  S.section({ cle: 'profile',
    normalize: P => P.map(q => { const o = [S.r2(q[0]), S.r2(q[1])]; if (q[2] === 'lin') o.push('lin'); return o; }),
    validate(P, E, W, ctx) {
      if (!Array.isArray(P)) { E.push('profile : liste de points [s, hauteur] attendue'); return; }
      if (P.length < PROF.n[0] || P.length > PROF.n[1]) { E.push('profile : de ' + PROF.n[0] + ' à ' + PROF.n[1] + ' points'); return; }
      const Lm = ctx && S.num(ctx.profileL, 1, 1e5) ? ctx.profileL : 1e5; let ok = true;
      P.forEach((q, i) => { const p = 'profile[' + i + ']';
        if (!Array.isArray(q) || q.length < 2 || q.length > 3 || (q.length === 3 && q[2] !== 'lin')) { E.push(p + ' : [s, hauteur] ou [s, hauteur, "lin"] attendu'); ok = false; return; }
        if (!S.num(q[0], 0, Lm)) { E.push(p + '.s : de 0 à ' + (Lm < 1e5 ? Math.round(Lm * 10) / 10 + ' m (longueur du circuit)' : 'la longueur du circuit')); ok = false; }
        if (!S.num(q[1], PROF.h[0], PROF.h[1])) { E.push(p + '.hauteur : de ' + PROF.h[0] + ' à ' + PROF.h[1] + ' m'); ok = false; }
        if (i && ok && !(q[0] - P[i - 1][0] >= PROF.gap)) { E.push(p + '.s : au moins ' + PROF.gap + ' m après le point précédent'); ok = false; } });
      if (!ok) return;
      P.forEach((q, i) => { if (!i) return; const a = P[i - 1], g = Math.abs(q[1] - a[1]) / (q[0] - a[0]);
        if (g > PROF.slope) W.push('profile : pente de ' + Math.round(g * 100) + ' % entre s = ' + a[0] + ' et ' + q[0] + ' m (au-delà de ' + PROF.slope * 100 + ' %, ESTIMÉ : à vérifier dans le jeu)'); });
      if (ctx && ctx.faisa && ctx.faisa.bloque) W.push('profile : le train s\'arrêterait vers s = ' + ctx.faisa.sOrig + ' m (vitesse estimée ' + ctx.faisa.vMin + ' m/s, minimum du moteur ' + ctx.faisa.vmin + ' m/s) : circuit infaisable');
    } });
  Object.assign(S, { SK, SL, SITE_KEYS, ZKEYS, PROF, RAIL_IDS }); S.LIM.depth = DEPTH; // panneaux de l'éditeur (engine/montagnes-russes/editeur.js)
  });
})(typeof module !== 'undefined' && module.exports ? f => { module.exports = f; } : f => f(window.T2ZSchema));
