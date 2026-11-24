'use strict';
/* Sections de l'éditeur propres aux montagnes russes (docs/ARCHITECTURE.md D8, D9, D14) : « Attraction » (GAME.site : sous-type, wagons, trains, couleurs de la voie,
   physique) et profondeur des travées d'attente (GAME.board.depth : poignée sur la carte, champ dans la section « Zone d'attente du quai »).
   Chargé par editor/editor.js (GET /api/couches) ; X = outils de l'éditeur (cadre du jeu, brouillon, panneau, rechargement, sélection). */
(function () {
  let X = null; const S = window.T2ZSchema, $ = id => document.getElementById(id), E = s => X.E(s), GM = () => X.GM(), esc = s => X.esc(s), draft = () => X.draft(), panel = () => X.panel(), reloadPreview = () => X.reloadPreview();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), R2 = v => Math.round(v * 100) / 100;
  // profondeur des travées d'attente (issue #27) : GAME.board={depth} ; boardDepth() du moteur donne la valeur, le calcul, les bornes et le repère de la poignée
  // (ligne des portillons du portillon du milieu, direction vers l'arrière du quai)
  const dep = () => E('boardDepth()'), depthEd = () => !!(GM().board && GM().board.depth != null);
  const depthH = D => [D.u.o[0] + D.u.r[0] * D.depth, D.u.o[1] + D.u.r[1] * D.depth];
  function setDepth(v) { const D = dep(); GM().board = { depth: R2(clamp(v, D.min, D.max)) }; E('reBoard()'); }
  function revertDepth() { delete GM().board; E('reBoard()'); panel(); }
  const depthTxt = D => `${D.rows} rang(s) par travée ; ${D.game ? 'réglée' : 'calcul auto'} (calcul : ${D.calc.toFixed(2).replace('.', ',')} m ; de ${D.min.toFixed(2).replace('.', ',')} à ${D.max} m).`;
  // ── paramètres de l'attraction (lot 3, D9) : GAME.site = surcharges partielles de SITE (liste blanche, engine/montagnes-russes/schema.js) ──
  const SB = () => E('SITE_BASE'), SKIND = () => E('SITE.kind');
  // nombre de trains au plus (issue #32) : places d'attente du moteur (TRAIN_MAX, engine/state.js : gare, voies de garage, frein avant gare, frein final, freins de bloc), 8 au plus (editor/schema.js)
  const tMax = () => { let m = S.SL.trains[1]; try { m = Math.min(m, E('TRAIN_MAX')); } catch (e) { } return m; };
  function tPlaces() { let t = ''; try { const g = E('LANES.reduce((n,l)=>n+l.cap,0)'), z = E('TRAIN_SPOTS.map(p=>zName(p.z))'); t = `Au plus ${tMax()} trains : un par place où un train peut attendre (1 en gare, ${g} au garage${z.length ? ', ' + z.length + ' sur les zones de freinage : ' + z.join(', ') : ''}${E('TRAIN_MAX') > S.SL.trains[1] ? ' ; ' + S.SL.trains[1] + ' au plus dans l\'éditeur' : ''}). Les trains au-delà du garage partent arrêtés sur ces zones.`; } catch (e) { } return esc(t); }
  // aides communes de l'éditeur (editor/editor.js) : GAME.site modifié, valeur égale à l'origine = surcharge retirée, objets vides retirés, aperçu rechargé
  const pth = (o, p) => X.pth(o, p), same = (a, b) => X.same(a, b), siteChange = fn => X.siteChange(fn), setSite = (p, v) => X.setSite(p, v), delSite = (s, p) => X.delSite(s, p), prune = M => X.prune(M);
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), rgbHex = a => '#' + a.map(c => ('0' + clamp(Math.round(c), 0, 255).toString(16)).slice(-2)).join('');
  const SF = { // champs : chemin, libellé, type, défaut si SITE n'en donne pas (ESTIMÉ = valeur du moteur)
    car: [{ p: ['car', 'len'], l: 'Longueur d\'un wagon (m)', t: 'num', st: .05, d: null }, { p: ['car', 'n'], l: 'Wagons par train', t: 'int', d: null }, { p: ['car', 'seats'], l: 'Places par wagon', t: 'int', d: 2 }, { p: ['car', 'abreast'], l: 'Places côte à côte', t: 'int', d: 2 },
      { p: ['car', 'restraint'], l: 'Sécurités', t: 'enum', o: [['lapbar', 'lapbars'], ['otsr', 'harnais'], ['belt', 'ceintures']] },
      { p: ['car', 'w'], l: 'Largeur d\'un wagon (m)', t: 'num', st: .01, d: 1.24, lim: S.SL.w }, { p: ['car', 'inline'], l: 'Places l\'une derrière l\'autre', t: 'bool', d: false }, { p: ['car', 'pitch'], l: 'Écart entre deux places en ligne (m)', t: 'num', st: .05, d: null, lim: S.SL.pitch, orig: 'calculé (45 % de la longueur du wagon)' }],
    phys: [{ p: ['phys', 'roll'], l: 'Roulement (frottement)', t: 'num', st: .005, d: .098 }, { p: ['phys', 'drag'], l: 'Traînée (air)', t: 'num', st: .0001, d: .0006 }, { p: ['phys', 'vmin'], l: 'Vitesse minimale (m/s)', t: 'num', st: .5, d: 3 }],
  };
  const lim = p => { const L = S.SL[p[1]]; return L ? { min: L[0], max: L[1] } : {}; };
  function effRestraint() { return E('RES_KIND'); }
  function fieldHTML(f, kind) {
    const p = f.p, key = p.join('.'), ov = pth(GM().site || {}, p), base = pth(SB(), p), mod = ov !== undefined;
    let eff = mod ? ov : base !== undefined ? base : f.d; if (f.p[1] === 'restraint') eff = ov !== undefined ? ov : base !== undefined ? base : effRestraint();
    const o = base !== undefined ? base : f.orig != null ? f.orig : (f.d != null ? f.d + ' (défaut du moteur)' : f.p[1] === 'restraint' ? 'défaut du type' : '');
    let ctl;
    if (f.t === 'enum' || f.t === 'enumn') ctl = `<select data-p="${key}" data-t="${f.t}">${f.o.map(([v, n]) => `<option value="${v}"${String(v) === String(eff) ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    else if (f.t === 'bool') ctl = `<input data-p="${key}" data-t="bool" type="checkbox"${eff ? ' checked' : ''}>`;
    else if (f.t === 'text') ctl = `<input data-p="${key}" data-t="txt" type="text" maxlength="${S.SL.txt}" value="${esc(eff == null ? '' : eff)}" style="width:100%">`;
    else { const L = f.lim ? { min: f.lim[0], max: f.lim[1] } : lim(p); ctl = `<input data-p="${key}" data-t="${f.t}" type="number" step="${f.st || 1}"${f.zero ? ' data-zero="1"' : ''}${L.min != null ? ` min="${L.min}" max="${L.max}"` : ''} value="${eff}">`; }
    return `<div class="fld${mod ? ' mod' : ''}"><span>${f.l}</span>${ctl}<span class="orig" title="Valeur d'origine de SITE">origine : ${esc(typeof o === 'object' ? JSON.stringify(o) : o)}</span><button data-rev="${key}" ${mod ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button></div>`;
  }
  function colorHTML(p, l, cur, base, mod, rgb) {
    const key = p.join('.'), hex = rgb ? rgbHex(cur) : cur;
    return `<div class="fld${mod ? ' mod' : ''}"><span>${l}</span><input data-p="${key}" data-t="${rgb ? 'rgb' : 'col'}" type="color" value="${hex}"><span class="orig">origine : ${base === undefined ? 'défaut du type' : esc(rgb ? rgbHex(base) : base)}</span><button data-rev="${key}" ${mod ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button></div>`;
  }
  function siteHTML() {
    const ov = GM().site || {}, base = SB(), kind = SKIND(), h = [];
    const km = ov.kind !== undefined;
    h.push(`<div class="fld${km ? ' mod' : ''}"><span>Sous-type</span><select data-p="kind">${S.SK.kind.map(k => `<option value="${k}"${k === kind ? ' selected' : ''}>${{ wood: 'bois', bob: 'bobsleigh', inverted: 'inversé', steel: 'acier' }[k]}</option>`).join('')}</select><span class="orig">origine : ${esc(base.kind)}</span><button data-rev="kind" ${km ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button></div>`);
    if (km) h.push('<p class="note warn">Changer le sous-type change le rendu, les sécurités par défaut et les supports ; voie, gare et garage ne sont pas refaits (ESTIMÉ : à vérifier dans le jeu).</p>');
    h.push('<h3>Wagons</h3>', ...SF.car.map(f => fieldHTML(f, kind)));
    const c = E('({len:CAR,n:NCARS})'), tl = c.len * c.n; h.push(`<p class="note${tl > S.SL.trainLen ? ' err' : ''}">Train : ${tl.toFixed(1).replace('.', ',')} m (${S.SL.trainLen} m au plus, ESTIMÉ). Les longueurs de wagon de SITE sont souvent ESTIMÉES (voir le commentaire de <code>sites/'+site+'.js</code>).</p>`);
    // trains
    const T = E('SITE.trains'), tm = ov.trains !== undefined, tmax = tMax(), full = T.length >= tmax;
    h.push(`<h3>Trains (${T.length})</h3><div class="fld${tm ? ' mod' : ''}" style="display:block">` + T.map((t, i) => `<div class="trow" data-i="${i}"><input data-tf="name" value="${esc(t.name)}" title="Nom" style="width:96px"><input data-tf="col" type="color" value="${t.col}" title="Couleur"><input data-tf="col2" type="color" value="${t.col2}" title="Seconde couleur"><input data-tf="wear" type="number" min="0" max="100" step="1" value="${t.wear}" title="Usure (0 à 100)" style="width:48px"><input data-tf="lane" type="number" min="1" max="${Math.max(1, E('LANES.length'))}" step="1" value="${t.lane || ''}" placeholder="voie" title="Voie de garage au départ (vide : automatique ; le premier train est à quai)" style="width:48px"><button data-tdel="${i}" ${T.length > 1 ? '' : 'disabled'} title="Retirer ce train">x</button></div>`).join('')
      + `<div class="row"><button id="bTAdd" ${full ? 'disabled' : ''}>Ajouter un train</button><button data-rev="trains" ${tm ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button></div><span class="orig">origine : ${base.trains.length} train(s) ; couleur 1, couleur 2, usure, voie de garage. Le premier train est à quai ; chaque train garé a besoin d'une place au garage.</span><p class="note${full ? ' warn' : ''}">${tPlaces()}</p></div>`);
    // couleurs de voie
    if (kind === 'inverted' || kind === 'steel') { const K = E('TKC'), bt = base.track || {}; h.push('<h3>Couleurs de la voie</h3>', ...[['spine', 'Poutre'], ['rail', 'Rails'], ['support', 'Supports']].map(([f, l]) => colorHTML(['track', f], l, K[f], bt[f], pth(ov, ['track', f]) !== undefined))); }
    if (kind === 'bob') { const K = E('TRO'), bt = base.trough || {}; h.push('<h3>Gouttière du bobsleigh</h3>', ...[['lo', 'Fond (bas)', 1], ['hi', 'Fond (haut)', 1], ['edge', 'Bord', 0], ['deck', 'Tablier', 0], ['rim', 'Rebord', 0]].map(([f, l, r]) => colorHTML(['trough', f], l, K[f], bt[f], pth(ov, ['trough', f]) !== undefined, r)));
      const sm = pth(ov, ['trough', 'shine']) !== undefined; h.push(`<div class="fld${sm ? ' mod' : ''}"><span>Reflet</span><input data-p="trough.shine" data-t="txt" value="${esc(K.shine)}"><span class="orig">origine : ${esc(bt.shine || 'défaut du type')}</span><button data-rev="trough.shine" ${sm ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button></div>`); }
    h.push('<h3>Physique de base</h3>', ...SF.phys.map(f => fieldHTML(f, kind)), '<p class="note">Bornes sûres : roulement 0 à 0,3 ; traînée 0 à 0,01 ; vitesse minimale 1 à 6 m/s (ESTIMÉES). Les valeurs de SITE sont des réglages de jeu, pas des mesures.</p>');
    h.push(...extraHTML(kind));
    return h.join('');
  }
  // ── autres réglages de SITE (osmrides#53) : exploitation, gare et quais, freins de bloc, frein avant gare, appareil de voie, valeurs déduites ──
  const fx = v => v == null ? '—' : String(Math.round(v * 100) / 100).replace('.', ',');
  function extraHTML(kind) {
    const h = [], SL = S.SL, ded = (() => { try { return E('DEDUIT'); } catch (e) { return {}; } })(), ev = k => { try { return E('SITE.' + k); } catch (e) { return undefined; } };
    h.push('<h3>Exploitation</h3>', ...[
      { p: ['lap'], l: 'Durée d\'un tour estimée (s)', t: 'num', st: 5, d: 150, lim: SL.lap }, { p: ['maxRun'], l: 'Trains en ligne au plus', t: 'int', d: null, lim: SL.maxRun, orig: 'tous les trains' }].map(f => fieldHTML(f, kind)),
      '<p class="note">Durée d\'un tour : sert à estimer l\'attente affichée au pupitre. Trains en ligne : les autres restent au garage (garage seulement).</p>');
    h.push('<h3>Gare et quais</h3>', ...[
      { p: ['stopBack'], l: 'Arrêt avant la fin de la gare (m)', t: 'num', st: .5, d: 0, lim: SL.stopBack },
      { p: ['plat', 'load'], l: 'Profondeur du quai d\'embarquement (m)', t: 'num', st: .1, d: 7.9, lim: SL.plat.load }, { p: ['plat', 'exit'], l: 'Profondeur du quai de sortie (m)', t: 'num', st: .1, d: 0, lim: SL.plat.exit },
      { p: ['plat', 'back'], l: 'Quai derrière le dernier wagon (m)', t: 'num', st: .1, d: .1, lim: SL.plat.back }, { p: ['plat', 'front'], l: 'Quai devant le premier wagon (m)', t: 'num', st: .1, d: 1.6, lim: SL.plat.front }].map(f => fieldHTML(f, kind)),
      '<p class="note">Un quai plus court réduit aussi la profondeur maximale des travées d\'attente (section « Zone d\'attente du quai »). Valeurs du moteur : ESTIMÉES.</p>');
    // freins de bloc : vitesse limite, vitesse de lancement, temps d'arrêt, arrêt obligatoire
    let nb = 0; try { nb = E('BLK.length'); } catch (e) { }
    if (nb) {
      h.push('<h3>Freins de bloc</h3>');
      for (let k = 1; k <= nb; k++) {
        const id = 'B' + k, Z = E(`ZONES.find(o=>o.id==='${id}')`) || {}, zt = Z.trim && Z.trim.v || 0;
        h.push(`<div class="note" style="margin-top:6px"><b>${esc(Z.name || id)}</b></div>`, ...[
          { p: ['zones', id, 'trim', 'v'], l: 'Vitesse limite (m/s)', t: 'num', st: .5, d: zt || null, lim: SL.zoneV, zero: 1, orig: zt ? zt + ' (SITE)' : 'aucune limite' },
          { p: ['zones', id, 'launch'], l: 'Vitesse de lancement (m/s)', t: 'num', st: .5, d: Z.launch || null, lim: SL.zoneV, zero: 1, orig: Z.launch ? Z.launch + ' (SITE)' : 'vitesse d\'entrée du train' },
          { p: ['zones', id, 'stop'], l: 'Arrêt obligatoire', t: 'bool', d: false }, { p: ['zones', id, 'hold'], l: 'Temps d\'arrêt (s)', t: 'num', st: 1, d: 0, lim: SL.zoneHold }].map(f => fieldHTML(f, kind)));
      }
      h.push('<p class="note">Vitesse limite : le train est ramené à cette vitesse au frein puis continue (zone en AUTO, canton suivant libre). Lancement : vitesse à laquelle le frein relance un train arrêté (sinon : sa vitesse d\'entrée ; plafonnée par la vitesse limite). Arrêt obligatoire : en AUTO le train s\'arrête au frein même si le canton suivant est libre ; le temps d\'arrêt (avec l\'arrêt obligatoire seulement) est la durée minimale avant la relance. 0 = pas de réglage. Bornes 1 à 30 m/s, 0 à 300 s (ESTIMÉES).</p>');
    }
    if (ev('preBrake')) h.push('<h3>Frein avant gare</h3>', ...[{ p: ['preBrake', 'back'], l: 'Distance à la gare (m)', t: 'num', st: .5, d: null, lim: SL.pre.back, orig: 'lue dans OSM ou 1 m' }, { p: ['preBrake', 'len'], l: 'Longueur de la zone (m)', t: 'num', st: .5, d: null, lim: SL.pre.len, orig: 'lue dans OSM ou un train + 0,5 m' }, { p: ['preBrake', 'name'], l: 'Nom au pupitre', t: 'text', d: 'Frein avant gare' }].map(f => fieldHTML(f, kind)));
    if (ev('yard')) h.push('<h3>Appareil de voie et garage</h3>', ...[
      { p: ['yard', 'move', 'v'], l: 'Vitesse de l\'appareil (m/s)', t: 'num', st: .1, d: 2.4, lim: SL.move.v }, { p: ['yard', 'move', 'vc'], l: 'Vitesse du train sur l\'appareil (m/s)', t: 'num', st: .1, d: .6, lim: SL.move.vc }, { p: ['yard', 'move', 't'], l: 'Durée de la manœuvre (s)', t: 'num', st: .5, d: 3, lim: SL.move.t },
      { p: ['yard', 'devName'], l: 'Nom de l\'appareil (pupitre)', t: 'text', d: ev('yard').device === 'switch' ? 'Aiguillage' : 'Pont transbordeur' }, { p: ['yard', 'devLabel'], l: 'Nom dans une phrase', t: 'text', d: ev('yard').device === 'switch' ? 'l\'aiguillage' : 'le pont transbordeur' }].map(f => fieldHTML(f, kind)));
    // valeurs déduites : holdBack, dropAfter, loadSide (SITE ne les donne plus ; l'éditeur ne sert qu'à corriger un cas particulier)
    const dl = `${ded.loadSide === 1 ? 'côté +R de la voie' : ded.loadSide === -1 ? 'côté -R de la voie' : 'indécis'}`;
    h.push('<h3>Valeurs déduites (corriger un cas particulier)</h3>', ...[
      { p: ['holdBack'], l: 'Arrêt au frein final : distance à la fin du circuit (m)', t: 'num', st: .5, d: (E('L - S_HOLD') != null ? Math.round(E('L - S_HOLD') * 10) / 10 : null), lim: SL.holdBack, orig: `déduit : fin du frein final lue dans OSM (${fx(ded.holdBack)} m)` },
      { p: ['dropAfter'], l: 'Descente après le haut du lift (m)', t: 'num', st: .5, d: Math.round(E('S_DROP - S_LIFT1') * 10) / 10, lim: SL.dropAfter, orig: `déduit : profil des hauteurs (${fx(ded.dropAfter)} m)` },
      { p: ['loadSide'], l: 'Côté du quai d\'embarquement', t: 'enumn', o: [['1', 'côté +R de la voie'], ['-1', 'côté -R de la voie']], d: E('LS'), orig: `déduit : côté où arrive la file (${dl})` }].map(f => fieldHTML(f, kind)),
      '<p class="note">Déduits par le moteur, avec priorité GAME > SITE > déduction. Mettre une valeur ici seulement pour un cas particulier. Cri des passagers : 1 m sous le sommet après le lift (ESTIMÉ).</p>');
    return h;
  }
  function bindSite() {
    const B = $('siteBox');
    for (const el of B.querySelectorAll('[data-p]')) el.addEventListener('change', () => {
      const p = el.dataset.p.split('.'), t = el.dataset.t; let v = el.value;
      if (t === 'bool') v = el.checked; else if (t === 'enumn') v = +v;
      else if (t === 'num' || t === 'int') { if (v === '' || !isFinite(+v)) return; v = +v; if (el.dataset.zero && v <= 0) v = ''; } else if (t === 'rgb') v = hexRgb(v);
      setSite(p, v);
    });
    for (const el of B.querySelectorAll('[data-rev]')) el.onclick = () => { const p = el.dataset.rev.split('.'); siteChange(s => delSite(s, p)); };
    const trains = () => JSON.parse(JSON.stringify(E('SITE.trains')));
    const putTrains = A => { // couleurs, noms, usure : appliqués à chaud au jeu en cadre ; nombre de trains ou voie de garage : jeu en cadre rechargé (vue gardée)
      const cur = trains(), hot = A.length === cur.length && A.every((t, i) => (t.lane || null) === (cur[i].lane || null));
      if (!hot) return siteChange(s => { if (same(A, SB().trains)) delete s.trains; else s.trains = A; });
      X.setUndo(JSON.stringify(draft())); const M = GM(); if (!M.site) M.site = {}; if (same(A, SB().trains)) delete M.site.trains; else M.site.trains = A; prune(M);
      E('SITE.trains=' + JSON.stringify(A) + ';SITE.trains.forEach((c,i)=>{const t=trains[i];if(t){t.name=c.name;t.col=c.col;t.col2=c.col2;t.wear=c.wear;}});0');
      panel(); };
    for (const el of B.querySelectorAll('.trow [data-tf]')) el.addEventListener('change', () => { const A = trains(), i = +el.closest('.trow').dataset.i, f = el.dataset.tf; let v = el.value;
      if (f === 'wear') v = clamp(+v || 0, 0, 100); else if (f === 'lane') { if (v === '') { delete A[i].lane; return putTrains(A); } v = Math.round(+v); }
      A[i][f] = v; putTrains(A); });
    for (const el of B.querySelectorAll('[data-tdel]')) el.onclick = () => { const A = trains(); A.splice(+el.dataset.tdel, 1); putTrains(A); };
    const ba = $('bTAdd'); if (ba) ba.onclick = () => { if (trains().length >= tMax()) { panel(); return; } const A = trains(), l = A[A.length - 1], c = Object.assign({}, l, { name: 'Train ' + (A.length + 1), wear: 30 }); delete c.lane; A.push(c); putTrains(A); };
  }
  T2ZEditeur.section({ id: 'secSite', titre: 'Attraction', avant: 'secLook', box: 'siteBox',
    panel(x) {
      X = x;
      // Clé d'origine absente de SITE (kind, car, trains, track, trough, phys) : message clair plutôt qu'une section vide (osmrides#53)
      try { $('siteBox').innerHTML = siteHTML(); bindSite(); }
      catch (e) { $('siteBox').innerHTML = '<p class="err">Section « Attraction » illisible : SITE doit garder ses valeurs d\'origine (kind, car, trains, track ou trough, phys) ; GAME.site ne contient que les modifications. Détail : ' + String(e.message).replace(/</g, '&lt;') + '</p>'; console.error(e); }
    },
    contexte(x) { X = x; const c = { trainMax: tMax() }; try { c.depthMax = E('boardDepth().max'); c.blocs = E('BLK.length'); } catch (e) { } return c; } }); // validation : nombre de trains au plus, borne des travées (selon le quai), freins de bloc
  T2ZEditeur.section({ id: 'depth', // travées d'attente : poignée (losange orange) et champ ajouté à la section « Zone d'attente du quai »
    hit(p, tol, x) { X = x; const D = dep(), q = depthH(D); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < tol) return { t: 'depth', m: 'depth' }; },
    drag(p, x) { X = x; const D = dep(); setDepth((p[0] - D.u.o[0]) * D.u.r[0] + (p[1] - D.u.o[1]) * D.u.r[1]); }, // profondeur = distance à la ligne des portillons
    draw(P, oc, x) { X = x; const sel = X.getSel();
    { const D = dep(), o = P(D.u.o[0], D.u.o[1]), q = P(...depthH(D)), on = sel && sel.t === 'depth'; // profondeur des travées : trait depuis la ligne des portillons, poignée carrée
      oc.strokeStyle = '#ff8a3d'; oc.lineWidth = on ? 2.5 : 1.6; oc.setLineDash(D.game ? [] : [4, 3]); oc.beginPath(); oc.moveTo(o[0], o[1]); oc.lineTo(q[0], q[1]); oc.stroke(); oc.setLineDash([]);
      oc.fillStyle = on ? '#ff8a3d' : '#fff'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.beginPath(); oc.moveTo(q[0], q[1] - 6); oc.lineTo(q[0] + 6, q[1]); oc.lineTo(q[0], q[1] + 6); oc.lineTo(q[0] - 6, q[1]); oc.closePath(); oc.fill(); oc.stroke();
      const t = 'travées ' + D.depth.toFixed(2).replace('.', ',') + ' m'; oc.font = '600 11px system-ui'; oc.lineWidth = 3; oc.strokeText(t, q[0] + 9, q[1] - 7); oc.fillStyle = '#ff8a3d'; oc.fillText(t, q[0] + 9, q[1] - 7); }
    },
    selHTML(x) { X = x; const D = dep(); return `<div><b>Profondeur des travées d'attente</b> ${D.game ? '<span class="tag t-ovr">réglée</span>' : '<span class="tag t-est">calcul auto</span>'}</div><div class="note">${D.depth.toFixed(2).replace('.', ',')} m depuis la ligne des portillons : ${D.rows} rang(s) par travée (calcul : ${D.calc.toFixed(2).replace('.', ',')} m). Glisser la poignée (losange orange) ou saisir la valeur dans la section « Zone d'attente du quai ».</div>`; },
    panelLite(x) { X = x; const di = $('depth'); if (di && document.activeElement !== di) { const D = dep(); di.value = D.depth.toFixed(2); $('depthInfo').textContent = depthTxt(D); } },
    panel(x) { X = x;
    { const D = dep(); $('areaBox').insertAdjacentHTML('beforeend', `<h3 style="margin:10px 0 4px;font-size:12px">Profondeur des travées d'attente</h3><p class="note">Distance de la ligne des portillons au bout des séparateurs : nombre de rangs des travées ; les rangs au-delà des places des portillons servent de réserve. Poignée : losange orange sur la carte.</p>
      <div class="grid"><span>Profondeur (m)</span><span><input id="depth" type="number" step="0.1" min="${D.min}" max="${D.max}" value="${D.depth.toFixed(2)}"></span></div><p class="note" id="depthInfo">${depthTxt(D)}</p><div class="row"><button id="bDepthAuto" ${D.game ? '' : 'disabled'}>Revenir au calcul auto</button></div>`);
      $('depth').onchange = () => { const v = +$('depth').value; if (isFinite(v) && v > 0) { setDepth(v); X.setSel({ t: 'depth' }); panel(); } };
      $('bDepthAuto').onclick = revertDepth; }
    },
    ed(x) { X = x; return { depth: () => dep() }; } }); // accès de test (tools/editor-test.js ED.depth)
})();
