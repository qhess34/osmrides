'use strict';
/* Éditeur OSMrides — couche d'édition au-dessus du VRAI jeu (docs/ARCHITECTURE.md D4) : l'attraction est ouverte dans jeu.html (bac à sable, simulation figée) dans un
   cadre de même origine ; le moteur lit l'objet GAME (GM) que l'éditeur modifie en place, le rendu est donc celui du jeu. Barrières : GAME.barriers (surcharges par clé
   stable, D2) ; salle de contrôle : GAME.controlRooms (0 ou 1 salle, D3) ; zone d'attente du quai d'embarquement : GAME.boardAreas (un polygone, D7) ; profondeur des travées d'attente : GAME.board={depth} (D8). Écriture : seulement par le serveur (editor/server.js), après diff et validation. */
(function () {
  const S = window.T2ZSchema, $ = id => document.getElementById(id), fr = $('fr'), ov = $('ov'), oc = ov.getContext('2d');
  let W = null, E = null, site = '', orig = { exists: false, text: '' }, sel = null, drag = null, ready = false, adding = null, snapped = null; // adding : nom du tronçon de la fourche où poser une barrière (clic du pivot)
  const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180, R2 = v => Math.round(v * 100) / 100, R1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const api = (u, o) => fetch(u, Object.assign({ cache: 'no-store' }, o)).then(r => r.json());
  const GM = () => E('GM');
  // Sections enfichables (docs/ARCHITECTURE.md D14) : engine/<couche>/editeur.js appelle T2ZEditeur.section({id, titre, avant, box, panel(X), panelLite(X), hit(p, tol, X),
  // drag(p, X), draw(P, oc, X), selHTML(X), contexte(X), ed(X)}) ; une poignée renvoyée par hit est {t: id de la section, m}. X : outils de l'éditeur (plus bas).
  const SECS = [], secOf = t => SECS.find(d => d.id === t); window.T2ZEditeur = { section: d => SECS.push(d) };
  const vctx = () => Object.assign({}, ...SECS.map(d => d.contexte ? d.contexte(X) : {})); // contexte de validation (nombre de trains au plus…)
  // jeu.html du dépôt de jeu, avec le moteur de cette version de l'éditeur (moteur=local : engine/ servi par editor/server.js depuis la librairie)
  const jeuUrl = id => { const [t, l, e] = id.split('/'); return '/jeu.html?type=' + t + '&lieu=' + l + '&el=' + e + '&moteur=local&mode=sandbox&editeur=' + Date.now(); };

  // ── ouverture d'une attraction ──
  async function loadSites() {
    const L = await api('/api/sites'), s0 = new URLSearchParams(location.search).get('site');
    $('site').innerHTML = L.map(s => `<option value="${s.id}">${s.id}${s.game ? ' (game.js)' : ''}</option>`).join('');
    const s1 = L.find(s => s.id === s0) || L.find(s => s.id.split('/')[2] === s0); // ?site=parc/asterix/zeus (ou zeus seul)
    open(s1 ? s1.id : L[0].id);
  }
  async function open(id) {
    ready = false; sel = null; wsel = null; adding = null; site = id; $('site').value = id; setName(''); siteUndo = null; keep = null; sideTop = 0;
    history.replaceState(null, '', '?site=' + id);
    orig = await api('/api/game/' + id);
    $('file').textContent = 'lieux/' + id + '.game.js : ' + (orig.exists ? (orig.error ? 'ILLISIBLE (' + orig.error + ')' : 'présent') : 'absent (créé à la première sauvegarde)');
    fr.src = jeuUrl(id);
  }
  fr.addEventListener('load', () => {
    W = fr.contentWindow; E = s => W.eval(s);
    const t0 = Date.now(), wait = () => {
      let ok = false; try { ok = E("typeof gateList==='function'&&typeof ctlRooms==='function'&&typeof reBoard==='function'&&typeof cam==='object'"); } catch (e) { }
      if (!ok) { if (Date.now() - t0 < 20000) return setTimeout(wait, 60); $('valBox').innerHTML = '<span class="err">Le jeu ne s\'est pas chargé' + (siteUndo ? ' avec ces paramètres de l\'attraction (par exemple pas de place au garage pour tous les trains).</span> <button id="bUndoSite">Annuler la dernière modification</button>' : '.</span>'); if (siteUndo && $('bUndoSite')) $('bUndoSite').onclick = () => { setName('t2z-draft:' + siteUndo); siteUndo = null; fr.src = jeuUrl(site); }; return; }
      const st = W.document.createElement('style'); // seulement la carte : pupitre, en-tête, journal masqués
      st.textContent = 'header,#side,#log,#tabs,#fsBar,#hint,#cams{display:none!important}#view{min-height:0!important}';
      W.document.head.appendChild(st); W.dispatchEvent(new W.Event('resize'));
      E("act('speed',0);synOn=false"); // simulation figée : seul le dessin tourne ; synoptique masqué (choix du joueur non modifié)
      if (keep) { const k = keep; keep = null; E('cam.g=null;cam.follow=-1;cam.key="";0'); const c = E('cam'); c.x = k.x; c.z = k.z; c.s = k.s; } // rechargement du jeu en cadre (GAME.site) : la vue de l'éditeur est gardée (issue #32)
      hook(); ready = true; if (reSel) { sel = reSel; reSel = null; } panel(); $('side').scrollTop = sideTop; window.ED.ready = true;
    };
    wait();
  });

  // ── géométrie écran ⇄ monde (caméra du jeu) ──
  const view = () => { const r = E("$('view').getBoundingClientRect()"); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const toScr = (x, z) => { const c = E('cam'), v = view(); return [v.x + (x - c.x) * c.s + v.w / 2, v.y + (z - c.z) * c.s + v.h / 2]; };
  const toW = (cx, cy) => { const c = E('cam'), v = view(); return [c.x + (cx - v.x - v.w / 2) / c.s, c.z + (cy - v.y - v.h / 2) / c.s]; };
  const gates = () => E('gateList()'), rooms = () => E('ctlRooms()');
  const migrated = () => Array.isArray(GM().controlRooms);
  const roomPt = (r, l) => { const t = rad(r.angle); return [r.x + l[0] * Math.cos(t) - l[1] * Math.sin(t), r.z + l[0] * Math.sin(t) + l[1] * Math.cos(t)]; };
  const toLocal = (r, p) => { const t = rad(r.angle), dx = p[0] - r.x, dz = p[1] - r.z; return [dx * Math.cos(t) + dz * Math.sin(t), -dx * Math.sin(t) + dz * Math.cos(t)]; };
  const dSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1e-9, t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l, 0, 1); return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]); };
  const CORNERS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const rotH = r => roomPt(r, [0, r.d / 2 + 1.4]);
  // zone d'attente (D7) : polygone édité (GAME.boardAreas[0]) ou polygone calculé (boardAreaCalc, en tirets) ; la première modification le reprend dans GAME
  const areaPts = () => E('boardArea()'), areaEd = () => Array.isArray(GM().boardAreas) && GM().boardAreas.length > 0;
  const pipE = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const mids = P => P.map((q, i) => { const r = P[(i + 1) % P.length]; return [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2]; });
  // fin de la file à raccorder (issue #24) : boardViaEnd() du moteur ; aimant : un sommet glissé ou créé se colle au point de fin de file (ou à un bord de l'allée au bout
  // de la file) à moins de SNAP_PX pixels écran, sauf Alt maintenue. SNAP_PX = 11 px (demande du propriétaire : 10-12 px).
  // entrée de la file (issue #39) : GAME.queueEntry={len, ang} ; queueEntry() du moteur donne le début du chemin de file OSM (o), le bout (end), le calcul et la longueur
  // réellement retenue (ramenée sur une surface praticable). Le moteur ne la lit qu'au chargement : un réglage recharge le jeu en cadre (comme GAME.site).
  const qe = () => E('queueEntry()'), qeEd = () => !!(GM().queueEntry && typeof GM().queueEntry === 'object');
  const qeEnd = (Q, v) => { const t = rad(v.ang); return [Q.o[0] + Math.cos(t) * v.len, Q.o[1] + Math.sin(t) * v.len]; };
  function setQe(len, ang, now) { const Q = qe(); GM().queueEntry = { len: R2(clamp(len, 0, Q.max)), ang: R1(((ang % 360) + 540) % 360 - 180) }; if (now) { reSel = { t: 'qe' }; reloadPreview(); } }
  function revertQe() { if (!qeEd()) return; delete GM().queueEntry; reSel = { t: 'qe' }; reloadPreview(); }
  const SNAP_PX = 11, viaEnd = () => { try { return E('boardViaEnd()'); } catch (e) { return null; } };
  function snap(q, alt) { if (alt) return null; const V = viaEnd(); if (!V) return null; const s = E('cam').s; let best = null, bd = SNAP_PX;
    for (const [t, k] of [[V.end, 'end'], [V.edges[0], 'edge'], [V.edges[1], 'edge']]) { const d = Math.hypot(q[0] - t[0], q[1] - t[1]) * s; if (d < bd) { bd = d; best = { p: [t[0], t[1]], k }; } if (best && best.k === 'end') break; } // le point de fin de file l'emporte sur les bords
    return best; }

  // aimant des barrières (demande du propriétaire, 20/11) : bords des allées de file dessinées (edgeSnap du moteur : largeur OSM ou dessinée), SNAP_PX px écran, Alt = libre.
  // Pivot : collé au bord le plus proche. Bout du vantail (piv donné) : l'angle choisi est GARDÉ (jamais de perpendiculaire imposée) ; seule la longueur s'ajuste pour que
  // le bout tombe sur le bord (opposé ou autre) que croise la direction pivot → curseur, à moins de SNAP_PX px du curseur.
  function barSnap(q, alt, piv) { if (alt) return null; const r = SNAP_PX / E('cam').s;
    if (!piv) { const s1 = E(`edgeSnap(${q[0]},${q[1]},${r})`); return s1 ? { p: s1.p, k: 'bar' } : null; }
    const L0 = Math.hypot(q[0] - piv[0], q[1] - piv[1]); if (L0 < .2) return null; const u = [(q[0] - piv[0]) / L0, (q[1] - piv[1]) / L0];
    const L = E(`(()=>{const f=L=>{const s=edgeSnap(${piv[0]}+${u[0]}*L,${piv[1]}+${u[1]}*L,.5);return s?s.d:9;},a=Math.max(.2,${L0 - r}),b=${L0 + r},n=60;let bL=null,bd=.3;
      for(let i=0;i<=n;i++){const L=a+(b-a)*i/n,d=f(L);if(d<bd){bd=d;bL=L;}}if(bL==null)return null;let lo=Math.max(.2,bL-(b-a)/n),hi=bL+(b-a)/n;
      for(let k=0;k<40;k++){const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;if(f(m1)<f(m2))hi=m2;else lo=m1;}const L=(lo+hi)/2;return f(L)<.02?L:null;})()`); // croisement du rayon avec un bord (distance au bord nulle)
    return L == null ? null : { p: [piv[0] + u[0] * L, piv[1] + u[1] * L], k: 'bar' }; }
  // ── données éditées ──
  function draft() { const g = JSON.parse(W.JSON.stringify(GM())); if (g.barriers && !Object.keys(g.barriers).length) delete g.barriers; if (Array.isArray(g.boardAreas) && !g.boardAreas.length) delete g.boardAreas; if (g.board && g.board.depth == null) delete g.board; if (g.queueEntry && !(isFinite(g.queueEntry.len) && isFinite(g.queueEntry.ang))) delete g.queueEntry; if (g.site && !Object.keys(g.site).length) delete g.site; if (g.look && !Object.keys(g.look).length) delete g.look; return g; }
  // barrières (issue #37) : GAME.barriers = {'b<n>': {x, z, ang, len, open?, sw?}} ; anciennes clés (surcharges, ajouts) lues et converties par le moteur (barSpecs),
  // réécrites au nouveau format à la première modification d'une barrière (own)
  function own() { const M = GM(), B = M.barriers || {}; if (Object.keys(B).every(k => /^b[0-9]+$/.test(k)) && M.barriers) return M.barriers;
    const L = E('barSpecs(GM.barriers)'); M.barriers = {}; for (const s of L) { const q = { x: R2(s.x), z: R2(s.z), ang: R1(s.ang), len: R2(s.len) }; if (s.open) q.open = true; if (s.sw === -1) q.sw = -1; M.barriers[s.key] = q; }
    return M.barriers; }
  function ovrOf(g) { return own()[g.key]; }
  function migrate() { // salle déduite de SITE.booth (D3) : SITE reste inchangé, la salle passe dans GAME à la sauvegarde
    const M = GM(); if (Array.isArray(M.controlRooms)) return;
    const b = E('defRoom()'); M.controlRooms = b ? [{ id: 'poste', x: R2(b.x), z: R2(b.z), angle: R1(b.angle), w: R2(b.w), d: R2(b.d), main: true }] : [];  // salle OSM (OSM.ctl), sinon SITE.booth
  }
  const applied = () => { E('reGates()'); panel(); };
  // Supprimer : clé retirée de GAME (plus de barrière calculée à garder)
  function deleteGate(key) { const B = own(); delete B[key]; if (!Object.keys(B).length) delete GM().barriers; sel = null; applied(); }
  // Ajouter : clic sur la carte = en travers de l'allée de file la plus proche (barPlace du moteur), fermée au départ ; clé 'b<n>' (n libre le plus petit)
  function addGate(p) { const B = own(); let n = 1; while (B['b' + n]) n++; const key = 'b' + n, s = E(`barPlace(${p[0]},${p[1]})`);
    B[key] = { x: R2(s.x), z: R2(s.z), ang: R1(s.ang), len: R2(clamp(s.len, .2, 20)) }; if (s.sw === -1) B[key].sw = -1; adding = null; sel = { t: 'gate', key }; applied(); return key; }
  function areaOvr() { const M = GM(); if (!areaEd()) M.boardAreas = [{ id: 'quai', pts: areaPts().map(q => [R2(q[0]), R2(q[1])]) }]; return M.boardAreas[0]; }
  const areaApplied = () => { E('reBoard()'); panel(); };
  function revertArea() { delete GM().boardAreas; sel = sel && sel.t === 'area' ? { t: 'area' } : sel; areaApplied(); }
  function delVertex(i) { const A = areaOvr(); if (A.pts.length <= 3) return; A.pts.splice(i, 1); sel = { t: 'area' }; areaApplied(); }
  function createRoom() { migrate(); const M = GM(); if (M.controlRooms.length) return; const c = E('cam'); M.controlRooms.push({ id: 'poste', x: R2(c.x), z: R2(c.z), angle: 0, w: 3.75, d: 1.7, main: true }); sel = { t: 'room' }; panel(); }
  function deleteRoom() { migrate(); GM().controlRooms.length = 0; sel = null; panel(); }

  // ── sélection et poignées ──
  function hit(p) {
    const s = E('cam').s, tol = Math.max(.35, 9 / s);
    if (sel && sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); if (g && Math.hypot(p[0] - g.g.a[0], p[1] - g.g.a[1]) < tol) return { t: 'gate', key: g.key, m: 'a' }; }
    if (sel && sel.t === 'room') { const r = rooms()[0]; if (r) { if (Math.hypot(p[0] - rotH(r)[0], p[1] - rotH(r)[1]) < tol) return { t: 'room', m: 'rot' }; for (let i = 0; i < 4; i++) { const q = roomPt(r, [CORNERS[i][0] * r.w / 2, CORNERS[i][1] * r.d / 2]); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < tol) return { t: 'room', m: 'c' + i }; } } }
    if (sel && sel.t === 'area') { const P = areaPts(); for (let i = 0; i < P.length; i++) if (Math.hypot(p[0] - P[i][0], p[1] - P[i][1]) < tol) return { t: 'area', m: 'v' + i };
      const M = mids(P); for (let i = 0; i < M.length; i++) if (Math.hypot(p[0] - M[i][0], p[1] - M[i][1]) < tol * .8) return { t: 'area', m: 'm' + i }; }
    { const Q = qe(); if (Math.hypot(p[0] - Q.end[0], p[1] - Q.end[1]) < tol) return { t: 'qe', m: 'end' }; } // poignée au bout de l'entrée de la file
    for (const d of SECS) if (d.hit) { const h = d.hit(p, tol, X); if (h) return h; } // poignées des sections des couches (travées…)
    let best = null, bd = tol;
    for (const g of gates()) { const d = Math.min(Math.hypot(p[0] - g.g.h[0], p[1] - g.g.h[1]) * .8, dSeg(p, g.g.h, g.g.a), dSeg(p, g.g.h, g.g.b)); if (d < bd) { bd = d; best = { t: 'gate', key: g.key, m: 'move' }; } }
    if (best) return best;
    const r = rooms()[0]; if (r) { const l = toLocal(r, p); if (Math.abs(l[0]) <= r.w / 2 + .2 && Math.abs(l[1]) <= r.d / 2 + .2) return { t: 'room', m: 'move' }; }
    if (pipE(areaPts(), p[0], p[1])) return { t: 'area', m: 'move' };
    return null;
  }
  function hook() {
    const cv = E('cv');
    const pos = e => toW(e.clientX, e.clientY);
    W.addEventListener('pointerdown', e => {
      if (e.target !== cv || e.button > 0) return; const p = pos(e);
      if (adding) { e.stopImmediatePropagation(); e.preventDefault(); addGate(p); return; }
      const h = hit(p); if (!h) return;
      e.stopImmediatePropagation(); e.preventDefault(); cv.setPointerCapture(e.pointerId);
      if (h.t === 'area' && h.m[0] === 'm') { const A = areaOvr(), i = +h.m.slice(1), q = mids(A.pts)[i], sn = snap(q, e.altKey); A.pts.splice(i + 1, 0, sn ? sn.p : [R2(q[0]), R2(q[1])]); h.m = 'v' + (i + 1); snapped = sn; E('reBoard()'); } // milieu d'un bord : nouveau sommet (aimanté)
      sel = h.t === 'gate' ? { t: 'gate', key: h.key } : secOf(h.t) ? { t: h.t } : h.t === 'qe' ? { t: 'qe' } : h.t === 'area' ? { t: 'area', v: h.m[0] === 'v' ? +h.m.slice(1) : (sel && sel.t === 'area' ? sel.v : undefined) } : { t: 'room' };
      if (h.t === 'room' && !migrated()) migrate(); // première modification de la salle : reprise de SITE.booth
      const r = h.t === 'room' ? GM().controlRooms[0] : null;
      drag = Object.assign({ p0: p, id: e.pointerId, moved: false, r0: r && Object.assign({}, r) }, h);
      if (h.t === 'gate') { const o = (GM().barriers || {})[h.key]; drag.o0 = o ? JSON.parse(JSON.stringify(o)) : null; }
      if (h.t === 'area') drag.a0 = JSON.parse(W.JSON.stringify(areaPts()));
      panel();
    }, true);
    W.addEventListener('pointermove', e => {
      if (!drag) { if (e.target === cv && adding) { cv.style.cursor = 'crosshair'; e.stopImmediatePropagation(); return; } if (e.target === cv && hit(pos(e))) { cv.style.cursor = 'move'; e.stopImmediatePropagation(); } return; }
      e.stopImmediatePropagation(); e.preventDefault(); const p = pos(e), dx = p[0] - drag.p0[0], dz = p[1] - drag.p0[1];
      if (!drag.moved && Math.hypot(dx, dz) * E('cam').s < 3) return; drag.moved = true;
      if (drag.t === 'gate') {
        const g = gates().find(x => x.key === drag.key); if (!g) return;
        if (!drag.o0) drag.o0 = JSON.parse(JSON.stringify(ovrOf(g.g)));
        const o = ovrOf(g.g);
        if (drag.m === 'move') { const q = [drag.o0.x + dx, drag.o0.z + dz], sn = barSnap(q, e.altKey); snapped = sn; o.x = sn ? sn.p[0] : R2(q[0]); o.z = sn ? sn.p[1] : R2(q[1]); } // pivot aimanté au bord le plus proche
        else { const sn = barSnap(p, e.altKey, [o.x, o.z]), q = sn ? sn.p : p; snapped = sn; o.ang = R1(deg(Math.atan2(p[1] - o.z, p[0] - o.x))); o.len = R2(clamp(Math.hypot(q[0] - o.x, q[1] - o.z), .2, 20)); } // poignée A : orientation (celle du curseur, gardée) et longueur, bout aimanté au bord croisé
        E('reGates()');
      } else if (drag.t === 'qe') { const Q = qe(); setQe(Math.hypot(p[0] - Q.o[0], p[1] - Q.o[1]), deg(Math.atan2(p[1] - Q.o[1], p[0] - Q.o[0]))); // aperçu ; appliqué au lâcher (rechargement)
      } else if (secOf(drag.t)) { secOf(drag.t).drag(p, X); // section d'une couche (travées…)
      } else if (drag.t === 'area') {
        const A = areaOvr();
        if (drag.m === 'move') A.pts = drag.a0.map(q => [R2(q[0] + dx), R2(q[1] + dz)]); else { const i = +drag.m.slice(1), q = [drag.a0[i][0] + dx, drag.a0[i][1] + dz], sn = snap(q, e.altKey); snapped = sn; A.pts[i] = sn ? sn.p : [R2(q[0]), R2(q[1])]; } // sommet aimanté à la fin de la file (Alt : libre)
        E('reBoard()');
      } else {
        const r = GM().controlRooms[0], r0 = drag.r0; if (!r) return;
        if (drag.m === 'move') { r.x = R2(r0.x + dx); r.z = R2(r0.z + dz); }
        else if (drag.m === 'rot') { r.angle = R1(((deg(Math.atan2(p[1] - r0.z, p[0] - r0.x)) - 90) % 360 + 540) % 360 - 180); }
        else { const [sx, sz] = CORNERS[+drag.m[1]], Q = roomPt(r0, [-sx * r0.w / 2, -sz * r0.d / 2]), t = rad(r0.angle), vx = p[0] - Q[0], vz = p[1] - Q[1];
          const lx = vx * Math.cos(t) + vz * Math.sin(t), lz = -vx * Math.sin(t) + vz * Math.cos(t), w = clamp(sx * lx, .5, 40), d = clamp(sz * lz, .5, 40);
          const c = roomPt({ x: Q[0], z: Q[1], angle: r0.angle }, [sx * w / 2, sz * d / 2]); Object.assign(r, { x: R2(c[0]), z: R2(c[1]), w: R2(w), d: R2(d) }); }
      }
      panelLite();
    }, true);
    let tap = null; // clic simple sur une allée de file (sans barrière ni zone sous le curseur) : choisit le chemin OSM dont on règle le sol (issue #45)
    W.addEventListener('pointerdown', e => { tap = e.target === cv && e.button <= 0 && !adding && !hit(pos(e)) ? { x: e.clientX, y: e.clientY } : null; }, true);
    W.addEventListener('pointerup', e => { if (!tap || drag) { tap = null; return; } const t = tap; tap = null; if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 4) return; const id = pickWay(pos(e)); if (id) { wsel = id; panel(); $('secLook').scrollIntoView({ block: 'nearest' }); } }, true);
    const up = e => { if (!drag) return; e.stopImmediatePropagation(); e.preventDefault(); const d = drag; drag = null; snapped = null; if (d.t === 'qe' && d.moved) { reSel = { t: 'qe' }; reloadPreview(); return; } panel(); };
    W.addEventListener('pointerup', up, true); W.addEventListener('pointercancel', up, true);
  }

  // ── dessin de la couche d'édition ──
  function draw() {
    requestAnimationFrame(draw);
    const r = ov.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (ov.width !== Math.round(r.width * dpr) || ov.height !== Math.round(r.height * dpr)) { ov.width = Math.round(r.width * dpr); ov.height = Math.round(r.height * dpr); }
    oc.setTransform(dpr, 0, 0, dpr, 0, 0); oc.clearRect(0, 0, r.width, r.height);
    if (!ready) return;
    let segs; try { segs = E('SEGS.map(s=>s.P)'); } catch (e) { return; }
    const P = (x, z) => toScr(x, z);
    if (wsel) for (const a of qways().filter(x => wsel === '*' || x.id === wsel)) { { oc.strokeStyle = 'rgba(242,193,78,.9)'; oc.lineWidth = 5; oc.lineCap = 'round'; oc.beginPath(); a.p.forEach((q, i) => { const s2 = P(q[0], q[1]); i ? oc.lineTo(s2[0], s2[1]) : oc.moveTo(s2[0], s2[1]); }); oc.stroke(); oc.lineCap = 'butt'; } } // chemin de file choisi (sol par chemin)
    oc.setLineDash([5, 5]); oc.strokeStyle = 'rgba(255,255,255,.55)'; oc.lineWidth = 1.2; // axe des tronçons de file
    for (const L of segs) { oc.beginPath(); L.forEach((q, i) => { const a = P(q[0], q[1]); i ? oc.lineTo(a[0], a[1]) : oc.moveTo(a[0], a[1]); }); oc.stroke(); }
    oc.setLineDash([]);
    { const V = viaEnd(); if (V) { // fin de la file à raccorder (issue #24) : dernière portion du trajet vers le quai (vert d'eau épais), bords de l'allée (losanges creux), point d'extrémité (losange plein cerclé)
        const L = V.pts.map(q => P(q[0], q[1])); oc.strokeStyle = 'rgba(11,17,32,.7)'; oc.lineWidth = 6; oc.lineCap = 'round'; oc.beginPath(); L.forEach((q, i) => i ? oc.lineTo(q[0], q[1]) : oc.moveTo(q[0], q[1])); oc.stroke();
        oc.strokeStyle = '#3ee0b0'; oc.lineWidth = 3; oc.stroke(); oc.lineCap = 'butt';
        const dia = (q, r, fill) => { oc.beginPath(); oc.moveTo(q[0], q[1] - r); oc.lineTo(q[0] + r, q[1]); oc.lineTo(q[0], q[1] + r); oc.lineTo(q[0] - r, q[1]); oc.closePath(); if (fill) { oc.fillStyle = fill; oc.fill(); } oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.stroke(); };
        const E2 = V.edges.map(q => P(q[0], q[1])); oc.strokeStyle = '#3ee0b0'; oc.lineWidth = 1.5; oc.setLineDash([3, 3]); oc.beginPath(); oc.moveTo(E2[0][0], E2[0][1]); oc.lineTo(E2[1][0], E2[1][1]); oc.stroke(); oc.setLineDash([]);
        for (const q of E2) { dia(q, 5); oc.strokeStyle = '#3ee0b0'; oc.lineWidth = 1.5; oc.beginPath(); oc.moveTo(q[0], q[1] - 3); oc.lineTo(q[0] + 3, q[1]); oc.lineTo(q[0], q[1] + 3); oc.lineTo(q[0] - 3, q[1]); oc.closePath(); oc.stroke(); }
        const en = P(V.end[0], V.end[1]); oc.strokeStyle = snapped && snapped.k === 'end' ? '#fff' : '#3ee0b0'; oc.lineWidth = 2; oc.beginPath(); oc.arc(en[0], en[1], SNAP_PX, 0, 7); oc.stroke(); dia(en, 7, '#3ee0b0');
        oc.font = '600 11px system-ui'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 3; oc.fillStyle = '#3ee0b0'; oc.strokeText('fin de file', en[0] + 12, en[1] + 14); oc.fillText('fin de file', en[0] + 12, en[1] + 14); } }
    { const AP = areaPts().map(q => P(q[0], q[1])), on = sel && sel.t === 'area'; // zone d'attente : tirets = calculée, trait plein = éditée (GAME.boardAreas)
      oc.fillStyle = 'rgba(242,193,78,.13)'; oc.strokeStyle = '#f2c14e'; oc.lineWidth = on ? 2.5 : 1.5; oc.setLineDash(areaEd() ? [] : [6, 4]);
      oc.beginPath(); AP.forEach((q, i) => i ? oc.lineTo(q[0], q[1]) : oc.moveTo(q[0], q[1])); oc.closePath(); oc.fill(); oc.stroke(); oc.setLineDash([]);
      if (on) { oc.lineWidth = 1.5; for (const q of mids(AP)) { oc.fillStyle = 'rgba(242,193,78,.85)'; oc.beginPath(); oc.arc(q[0], q[1], 3.5, 0, 7); oc.fill(); oc.strokeStyle = '#0b1120'; oc.stroke(); }
        AP.forEach((q, i) => { oc.fillStyle = sel.v === i ? '#f2c14e' : '#fff'; oc.fillRect(q[0] - 5, q[1] - 5, 10, 10); oc.strokeStyle = '#0b1120'; oc.strokeRect(q[0] - 5, q[1] - 5, 10, 10); }); } }
    { const Q = qe(), G = GM().queueEntry, ed = qeEd(), v = drag && drag.t === 'qe' && G ? G : null, on = sel && sel.t === 'qe'; // entrée de la file : trait depuis le début du chemin OSM, poignée ronde au bout
      const o = P(Q.o[0], Q.o[1]), q = P(...(v ? qeEnd(Q, v) : Q.end)), L = v ? v.len : Q.len;
      if (!v && ed && Q.clamped) { const w = P(...qeEnd(Q, { len: Q.want, ang: Q.ang })); oc.strokeStyle = 'rgba(127,178,255,.55)'; oc.lineWidth = 1.2; oc.setLineDash([2, 4]); oc.beginPath(); oc.moveTo(q[0], q[1]); oc.lineTo(w[0], w[1]); oc.stroke(); oc.setLineDash([]); } // longueur demandée au-delà de la surface praticable
      oc.strokeStyle = '#7fb2ff'; oc.lineWidth = on ? 3 : 2; oc.setLineDash(ed ? [] : [5, 4]); oc.beginPath(); oc.moveTo(o[0], o[1]); oc.lineTo(q[0], q[1]); oc.stroke(); oc.setLineDash([]);
      oc.fillStyle = '#7fb2ff'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.beginPath(); oc.arc(o[0], o[1], 3.5, 0, 7); oc.fill(); oc.stroke();
      oc.fillStyle = on ? '#7fb2ff' : '#fff'; oc.beginPath(); oc.arc(q[0], q[1], 6.5, 0, 7); oc.fill(); oc.stroke();
      const t = 'entrée ' + L.toFixed(1).replace('.', ',') + ' m'; oc.font = '600 11px system-ui'; oc.lineWidth = 3; oc.strokeText(t, q[0] + 10, q[1] + 14); oc.fillStyle = '#7fb2ff'; oc.fillText(t, q[0] + 10, q[1] + 14); }
    for (const d of SECS) if (d.draw) d.draw(P, oc, X); // poignées des sections des couches
    for (const g of gates()) {
      const col = g.g.open0 ? '#f0a23b' : '#5fd3e6', on = sel && sel.t === 'gate' && sel.key === g.key, h = P(g.g.h[0], g.g.h[1]), a = P(g.g.a[0], g.g.a[1]), b = P(g.g.b[0], g.g.b[1]);
      oc.strokeStyle = col; oc.lineWidth = on ? 3 : 2; oc.beginPath(); oc.moveTo(h[0], h[1]); oc.lineTo(a[0], a[1]); oc.stroke();
      oc.setLineDash([4, 3]); oc.lineWidth = on ? 2 : 1.3; oc.beginPath(); oc.moveTo(h[0], h[1]); oc.lineTo(b[0], b[1]); oc.stroke(); oc.setLineDash([]);
      oc.fillStyle = g.from ? '#8a94a6' : '#4cc38a'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.beginPath(); oc.arc(h[0], h[1], on ? 6 : 4.5, 0, 7); oc.fill(); oc.stroke();
      if (on) for (const [q, t] of [[a, 'A']]) { oc.fillStyle = '#fff'; oc.fillRect(q[0] - 5, q[1] - 5, 10, 10); oc.strokeRect(q[0] - 5, q[1] - 5, 10, 10); oc.fillStyle = '#fff'; oc.font = '600 11px system-ui'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 3; oc.strokeText(t, q[0] + 8, q[1] - 6); oc.fillText(t, q[0] + 8, q[1] - 6); oc.lineWidth = 1.5; }
    }
    if (snapped && snapped.k === 'bar') { const q = P(snapped.p[0], snapped.p[1]); oc.strokeStyle = '#fff'; oc.lineWidth = 2; oc.beginPath(); oc.arc(q[0], q[1], SNAP_PX, 0, 7); oc.stroke(); } // barrière aimantée à un bord
    for (const rm of rooms()) {
      const on = sel && sel.t === 'room', C = CORNERS.map(c => P(...roomPt(rm, [c[0] * rm.w / 2, c[1] * rm.d / 2])));
      oc.strokeStyle = '#c99cff'; oc.lineWidth = on ? 2.5 : 1.5; oc.setLineDash(migrated() ? [] : [6, 4]); oc.beginPath(); C.forEach((q, i) => i ? oc.lineTo(q[0], q[1]) : oc.moveTo(q[0], q[1])); oc.closePath(); oc.stroke(); oc.setLineDash([]);
      if (on) { const f = P(...roomPt(rm, [0, rm.d / 2])), rh = P(...rotH(rm)); oc.beginPath(); oc.moveTo(f[0], f[1]); oc.lineTo(rh[0], rh[1]); oc.stroke();
        oc.fillStyle = '#c99cff'; oc.beginPath(); oc.arc(rh[0], rh[1], 6, 0, 7); oc.fill(); oc.fillStyle = '#fff'; for (const q of C) { oc.fillRect(q[0] - 5, q[1] - 5, 10, 10); oc.strokeStyle = '#0b1120'; oc.strokeRect(q[0] - 5, q[1] - 5, 10, 10); } }
    }
  }
  requestAnimationFrame(draw);

  // ── paramètres de l'attraction (lot 3, D9) : GAME.site = surcharges partielles de SITE (liste blanche, editor/schema.js) ──
  // Le moteur fusionne GAME.site dans SITE au chargement (engine/core.js) : toute modification recharge le jeu en cadre ; le brouillon complet (barrières, salle, zone…)
  // voyage dans window.name du cadre (`t2z-draft:<JSON>`, lu seulement avec `?editeur=`), donc rien de non enregistré n'est perdu.
  let siteUndo = null, rt = 0, keep = null, sideTop = 0, reSel = null; // reSel : sélection rendue après le rechargement du cadre (entrée de la file)
  const setName = v => { try { fr.contentWindow.name = v; } catch (e) { } }; // window.name du cadre : survit à la navigation suivante (même origine)
  const reloadPreview = () => { try { const c = E('cam'); keep = { x: c.x, z: c.z, s: c.s }; } catch (e) { } sideTop = $('side').scrollTop; ready = false; window.ED.ready = false; sel = null; adding = null; clearTimeout(rt); rt = setTimeout(() => { setName('t2z-draft:' + JSON.stringify(draft())); fr.src = jeuUrl(site); }, 120); };
  // ── apparence de la file et du quai (issue #45, D11) : GAME.look = {queue:{col, tex}, plat:{col, tex}, rail, gate} ; le moteur relit GAME.look à chaque image
  // (engine/render.js look()) : appliqué à chaud, sans recharger le cadre. Clé absente = rendu d'origine (TEX.stone, PLAT_COL, garde-corps métal, portillons vert / rouge).
  const TEXN = { concrete: 'béton', asphalt: 'asphalte', sand: 'sable stabilisé', pavers: 'pavés', deck: 'platelage bois' }, RAILN = { metal: 'métal', wood: 'bois', stone: 'pierre (muret)' };
  function lookChange(fn) { const M = GM(); if (!M.look || typeof M.look !== 'object') M.look = {}; fn(M.look); const L = M.look;
    for (const k of ['queue', 'plat']) if (L[k] && !Object.keys(L[k]).length) delete L[k];
    if (L.ways) { for (const id of Object.keys(L.ways)) if (!Object.keys(L.ways[id]).length) delete L.ways[id]; if (!Object.keys(L.ways).length) delete L.ways; }
    if (!Object.keys(L).length) delete M.look; panel(); }
  // Sol par chemin de file (issue #45, 23/11) : GAME.look.ways = {"w123": {tex, col}} ; chemin choisi dans la liste ou en cliquant une allée sur la carte (wsel = identifiant OSM).
  let wsel = null;
  const qways = () => { try { return E('QWAYS') || []; } catch (e) { return []; } };
  function pickWay(p) { let b = null, bd = 1.6; for (const a of qways()) { const d = E('dPl(' + p[0] + ',' + p[1] + ',QWAYS.find(a=>a.id==="' + a.id + '").p)'); if (d < bd) { bd = d; b = a.id; } } return b; }
  // Origine des réglages (issue #46, D12) : valeur lue dans OSM (engine/render.js OSML, depuis OSM.attrs) ou valeur du jeu ; étiquette « OSM » (valeur d'OSM, GAME absent ou identique) ou « modifié » (GAME écarte de OSM ou règle une valeur sans équivalent lu).
  function lookHTML() {
    const L = GM().look || {}, h = [], fd = E('FLOOR_DEF'), O = E('OSML') || {};
    const badge = (g, o) => g != null ? (o != null && g === o ? '<span class="tag t-osm">OSM</span>' : '<span class="tag t-mod">modifié</span>') : o != null ? '<span class="tag t-osm">OSM</span>' : '';
    const fld = (key, label, ctl, orig, mod, g, o) => `<div class="fld${mod ? ' mod' : ''}"><span>${label} ${badge(g, o)}</span>${ctl}<span class="orig">origine : ${esc(orig)}</span><button data-lrev="${key}" ${mod ? '' : 'disabled'} title="Revenir à la valeur d'origine (OSM si elle existe)">Origine</button></div>`;
    const texSel = (key, cur, first) => `<select data-l="${key}"><option value=""${cur ? '' : ' selected'}>${first}</option>${S.LOOK.tex.map(t => `<option value="${t}"${t === cur ? ' selected' : ''}>${TEXN[t]}</option>`).join('')}</select>`;
    const q = L.queue || {}, p = L.plat || {}, oq = O.queue || {}, op = O.plat || {};
    const tx = (o, def) => o.tex ? TEXN[o.tex] + ' (OSM)' : def, cl = (o, def) => o.col ? o.col + ' (OSM)' : def;
    h.push('<h3>Sol des allées de file</h3>');
    h.push(fld('queue.tex', 'Texture', texSel('queue.tex', q.tex, tx(oq, 'béton (origine)')), tx(oq, 'béton clair'), !!q.tex, q.tex, oq.tex));
    h.push(fld('queue.col', 'Couleur', `<input data-l="queue.col" type="color" value="${q.col || oq.col || (q.tex || oq.tex ? fd[q.tex || oq.tex] : '#c4c0b6')}">`, cl(oq, 'béton clair #c4c0b6'), !!q.col, q.col, oq.col));
    const pc0 = E('PLAT_COL');
    const WS = qways(), ow = O.ways || {};
    h.push('<h3>Sol d\'un chemin de file</h3>');
    if (!WS.length) h.push('<p class="note">Aucun chemin de file OSM dans ce site (régénérer <code>lieux/' + esc(site) + '.data.js</code> avec tools/make_site.py).</p>');
    else {
      const lab = a => a.id + ' · ' + Math.round(a.l) + ' m · ' + (a.t && a.t.surface ? a.t.surface : 'sans surface');
      h.push(`<div class="wl" style="margin:4px 0"><span>Chemin</span> <select data-wsel style="max-width:100%"><option value=""${wsel ? '' : ' selected'}>cliquer une allée sur la carte, ou choisir</option><option value="*"${wsel === '*' ? ' selected' : ''}>Tous</option>${WS.map(a => `<option value="${a.id}"${a.id === wsel ? ' selected' : ''}>${esc(lab(a))}${(L.ways || {})[a.id] ? ' *' : ''}</option>`).join('')}</select></div>`);
      if (wsel === '*') { // « Tous » (propriétaire, 23/11) : même réglage écrit sur chaque chemin de file (GAME.look.ways), chacun renvoyable vers OSM
        const all = k => { const v = WS.map(a => ((L.ways || {})[a.id] || {})[k]); return v.every(x => x === v[0]) ? v[0] : undefined; }, at = all('tex'), ac = all('col'), mt = WS.some(a => ((L.ways || {})[a.id] || {}).tex), mc = WS.some(a => ((L.ways || {})[a.id] || {}).col);
        h.push(fld('ways.*.tex', 'Texture', texSel('ways.*.tex', at, at === undefined && mt ? 'valeurs différentes' : 'comme les allées'), 'chaque chemin', mt, at, null));
        h.push(fld('ways.*.col', 'Couleur', `<input data-l="ways.*.col" type="color" value="${ac || q.col || oq.col || '#c4c0b6'}">`, 'chaque chemin', mc, ac, null));
        h.push(`<p class="note">Appliqué aux ${WS.length} chemins de file ; « Origine » les remet tous à leur valeur d'origine.</p>`); }
      else if (wsel) { const w = (L.ways || {})[wsel] || {}, o = ow[wsel] || {}, base = { tex: q.tex || oq.tex, col: q.col || oq.col };
        const wt = (o2, def) => o2.tex ? TEXN[o2.tex] + ' (OSM)' : def, wc = (o2, def) => o2.col ? o2.col + ' (OSM)' : def;
        h.push(fld('ways.' + wsel + '.tex', 'Texture', texSel('ways.' + wsel + '.tex', w.tex, wt(o, 'comme les allées')), wt(o, 'comme les allées'), !!w.tex, w.tex, o.tex));
        h.push(fld('ways.' + wsel + '.col', 'Couleur', `<input data-l="ways.${wsel}.col" type="color" value="${w.col || o.col || base.col || (w.tex || o.tex || base.tex ? fd[w.tex || o.tex || base.tex] : '#c4c0b6')}">`, wc(o, 'comme les allées'), !!w.col, w.col, o.col));
        h.push('<p class="note">Ce chemin seulement ; renvoyé vers OSM sur ce way (surface, colour).</p>'); }
    }
    h.push('<h3>Sol des quais</h3>');
    h.push(fld('plat.tex', 'Texture', texSel('plat.tex', p.tex, tx(op, 'béton lissé (origine)')), tx(op, 'béton lissé'), !!p.tex, p.tex, op.tex));
    h.push(fld('plat.col', 'Couleur', `<input data-l="plat.col" type="color" value="${p.col || op.col || (p.tex || op.tex ? fd[p.tex || op.tex] : pc0)}">`, cl(op, pc0 + (E('SITE.platCol') ? ' (SITE.platCol)' : ' (défaut)')), !!p.col, p.col, op.col));
    h.push('<h3>Garde-corps et barrières de file</h3>');
    const rdef = O.rail || 'metal';
    h.push(fld('rail', 'Matériau', `<select data-l="rail">${S.LOOK.rail.map(r => `<option value="${r}"${r === (L.rail || rdef) ? ' selected' : ''}>${RAILN[r]}</option>`).join('')}</select>`, O.rail ? RAILN[O.rail] + ' (OSM)' : 'métal', !!L.rail, L.rail, O.rail));
    h.push('<h3>Portillons du quai</h3>');
    h.push(fld('gate', 'Couleur', `<input data-l="gate" type="color" value="${L.gate || '#4d525a'}">`, 'vert ouvert / rouge fermé', !!L.gate, L.gate, null));
    h.push('<h3>Toit de la gare</h3>');
    const rf0 = E('SITE.stationRoofCol');
    h.push(fld('roof', 'Couleur', `<input data-l="roof" type="color" value="${L.roof || O.roof || (/^#[0-9a-f]{6}$/i.test(rf0 || '') ? rf0 : '#a24e38')}">`, O.roof ? O.roof + ' (OSM roof:colour)' : (rf0 ? rf0 + ' (SITE.stationRoofCol)' : 'couleur du bâtiment (OSM)'), !!L.roof, L.roof, O.roof));
    h.push('<p class="note">Appliqué tout de suite dans le jeu. Textures et couleurs générées par le jeu, teintes ESTIMÉES (pas relevées). Les barrières pivotantes prennent le matériau des garde-corps (pierre : vantail en fer entre piliers de pierre). Portillons de couleur réglée : leur état se lit à l\'angle du vantail et au voyant vert / rouge du poteau. « OSM » : valeur lue dans OpenStreetMap ; « modifié » : écart avec OSM, renvoyable par « Envoyer vers OSM » (jamais automatique). Les portillons n\'ont pas d\'équivalent OSM lu.</p>');
    return h.join('');
  }
  function bindLook() {
    const B = $('lookBox');
    const allW = p => p[0] === 'ways' && p[1] === '*' ? qways().map(a => ['ways', a.id, p[2]]) : [p]; // « Tous » : un chemin après l'autre
    for (const el of B.querySelectorAll('[data-l]')) el.addEventListener('change', () => { const v = el.value;
      lookChange(L => { for (const p of allW(el.dataset.l.split('.'))) { if (p.length === 1) { if (v === '' || (p[0] === 'rail' && v === ((E('OSML') || {}).rail || 'metal'))) delete L[p[0]]; else L[p[0]] = v; return; }
        let o = L; for (const k of p.slice(0, -1)) o = o[k] || (o[k] = {}); if (v === '') delete o[p[p.length - 1]]; else o[p[p.length - 1]] = v; } }); });
    for (const el of B.querySelectorAll('[data-lrev]')) el.onclick = () => lookChange(L => { for (const p of allW(el.dataset.lrev.split('.'))) { let o = L; for (const k of p.slice(0, -1)) { o = o[k]; if (!o) break; } if (o) delete o[p[p.length - 1]]; } });
    const ws = B.querySelector('[data-wsel]'); if (ws) ws.onchange = () => { wsel = ws.value || null; panel(); };
  }

  // ── panneau ──
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const inp = (k, v, st) => `<input data-k="${k}" type="number" step="${st || .05}" value="${v}">`;
  function selHTML() {
    if (!sel) return '<span class="note">Cliquer une barrière, la salle de contrôle ou la zone d\'attente sur la carte. Glisser : déplacer ; poignée A d\'une barrière : orienter et allonger ; poignées de la salle : redimensionner, rond : tourner. La carte se déplace et se zoome comme dans le jeu.</span>';
    if (sel.t === 'gate') {
      const g = gates().find(x => x.key === sel.key); if (!g) return '<span class="err">Barrière introuvable.</span>';
      const G = g.g;
      return `<div><b>Barrière ${esc(g.key)}</b> ${g.from ? '<span class="tag t-est">reprise de ' + esc(g.from) + '</span>' : ''}</div><div class="note">Posée à la main ; dans le jeu, elle s'ouvre et se ferme seule au clic. Trait plein : fermée (A), tirets : ouverte. Fermée, elle bloque les visiteurs qui essaient d'y passer (évacuation comprise). Le pivot se colle au bord de l'allée le plus proche, le bout (poignée A) au bord opposé là où il arrive, l'angle choisi étant gardé ; maintenir <b>Alt</b> pour les poser librement.</div>
        <div class="grid" style="margin-top:6px"><span>Pivot x, z (m)</span><span>${inp('x', R2(G.h[0]))} ${inp('z', R2(G.h[1]))}</span>
        <span>Fermée : angle °, long. m</span><span>${inp('ang', R1(G.ang), 1)} ${inp('len', R2(G.len))}</span></div>
        <div class="row"><label><input type="checkbox" id="gOpen" ${G.open0 ? 'checked' : ''}> Ouverte au début de la partie</label></div>
        <div class="row"><label>Ouverture <select id="gSw"><option value="1"${G.sw !== -1 ? ' selected' : ''}>sens direct</option><option value="-1"${G.sw === -1 ? ' selected' : ''}>sens inverse</option></select></label></div>
        <div class="row"><button id="bDelGate" class="bad">Supprimer la barrière</button></div>`;
    }
    if (secOf(sel.t)) return secOf(sel.t).selHTML(X);
    if (sel.t === 'qe') { const Q = qe(); return `<div><b>Entrée de la file</b> ${qeEd() ? '<span class="tag t-ovr">réglée</span>' : '<span class="tag t-est">calcul auto</span>'}</div><div class="note">${qeTxt(Q)} Glisser la poignée (rond bleu) ou saisir les valeurs dans la section « Entrée de la file ».</div>`; }
    if (sel.t === 'area') {
      const Ps = areaPts(), v = sel.v != null && sel.v < Ps.length ? sel.v : null;
      return `<div><b>Zone d'attente du quai</b> ${areaEd() ? '<span class="tag t-ovr">éditée</span>' : '<span class="tag t-est">calcul auto</span>'}</div><div class="note">${Ps.length} sommets. Glisser un sommet (carré) pour le déplacer, un rond (milieu d'un bord) pour ajouter un sommet, l'intérieur pour tout déplacer. Un sommet se colle (aimant) au point de fin de file (losange vert plein, cercle) ou aux bords de l'allée au bout de la file (losanges creux) ; maintenir <b>Alt</b> pour le poser librement.</div>
        ${v != null ? `<div class="grid" style="margin-top:6px"><span>Sommet ${v + 1} x, z (m)</span><span>${inp('vx', R2(Ps[v][0]))} ${inp('vz', R2(Ps[v][1]))}</span></div>` : ''}
        <div class="row">${v != null ? `<button id="bDelVtx" class="bad" ${Ps.length > 3 ? '' : 'disabled'}>Supprimer le sommet</button>` : ''}<button id="bAreaAuto" ${areaEd() ? '' : 'disabled'}>Revenir au calcul auto</button></div>`;
    }
    const r = rooms()[0]; if (!r) return '<span class="note">Aucune salle.</span>';
    return `<div><b>Salle de contrôle</b> ${migrated() ? '' : (E('OSM_ROOM') ? '<span class="tag">OSM (bâtiment Salle de contrôle)</span>' : '<span class="tag t-est">SITE.booth (repli)</span>')}</div>
      <div class="grid" style="margin-top:6px"><span>Centre x, z (m)</span><span>${inp('x', r.x)} ${inp('z', r.z)}</span><span>Angle (°)</span><span>${inp('angle', r.angle, 1)}</span>
      <span>Largeur, profondeur (m)</span><span>${inp('w', r.w)} ${inp('d', r.d)}</span></div><p class="note">La vitre (côté du rond) est tournée vers la voie.</p>`;
  }
  function panelLite() { $('selBox').innerHTML = selHTML(); bindSel(); for (const d of SECS) if (d.panelLite) d.panelLite(X); status(); }
  const fr1 = v => (+v).toFixed(1).replace('.', ','), qeTxt = Q => `Prolongement de ${fr1(Q.len)} m depuis le début du chemin de file OSM, orienté à ${fr1(Q.ang)}° (0 = est, 90 = sud)${Q.game && Q.clamped ? ` ; ${fr1(Q.want)} m demandés, ramenés au bord de la surface praticable (zone piétonne, chemin)` : ''}. Calcul : ${fr1(Q.calc.len)} m à ${fr1(Q.calc.ang)}°.`;
  function bindSel() {
    for (const el of $('selBox').querySelectorAll('input[data-k]')) el.addEventListener('change', () => {
      const v = +el.value, k = el.dataset.k; if (!isFinite(v)) return;
    if (sel.t === 'area') { const A = areaOvr(); A.pts[sel.v] = k === 'vx' ? [v, A.pts[sel.v][1]] : [A.pts[sel.v][0], v]; areaApplied(); }
      else if (sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); const o = ovrOf(g.g); o[k] = k === 'len' ? R2(clamp(v, .2, 20)) : v; applied(); }
      else { migrate(); const r = GM().controlRooms[0]; r[k] = k === 'w' || k === 'd' ? clamp(v, .5, 40) : v; panel(); }
    });
    const go = $('gOpen'); if (go) go.onchange = () => { const o = ovrOf(gates().find(x => x.key === sel.key).g); if (go.checked) o.open = true; else delete o.open; applied(); };
    const gs = $('gSw'); if (gs) gs.onchange = () => { const o = ovrOf(gates().find(x => x.key === sel.key).g); if (gs.value === '-1') o.sw = -1; else delete o.sw; applied(); };
    const bd = $('bDelGate'); if (bd) bd.onclick = () => deleteGate(sel.key);
    const bv = $('bDelVtx'); if (bv) bv.onclick = () => delVertex(sel.v);
    const ba = $('bAreaAuto'); if (ba) ba.onclick = revertArea;
  }
  function panel() {
    if (!ready) return;
    $('secMig').hidden = migrated() || !E('!!B0');
    $('lookBox').innerHTML = lookHTML(); bindLook();
    panelLite();
    const R = migrated() ? GM().controlRooms : null;
    $('roomBox').innerHTML = !R ? (E('!!B0') ? '<p class="note">Salle actuelle : <code>SITE.booth</code> (repli). La première modification la reprend dans <code>game.js</code>.</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>' : '<p class="note">Aucune salle.</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>')
      : R.length ? `<p class="note">Salle « ${esc(R[0].id)} » : ${R[0].w} x ${R[0].d} m. Une seule salle par attraction (pupitre).</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>`
        : '<p class="note">Aucune salle (ni pupitre dessiné, ni gyrophare).</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>';
    if ($('bNewRoom')) $('bNewRoom').onclick = createRoom;
    if ($('bDelRoom')) $('bDelRoom').onclick = deleteRoom;
    $('areaBox').innerHTML = `<p class="note">${areaEd() ? `Zone éditée (<code>game.js</code>) : ${GM().boardAreas[0].pts.length} sommets. Les visiteurs y attendent derrière les portillons.` : 'Zone calculée (travées et couloir d\'attente, en tirets). La première modification la reprend dans <code>game.js</code>.'} Trait vert : fin de la file (losange plein = point où les visiteurs entrent dans la zone) ; un sommet glissé s'y colle (Alt : sans aimant). La zone se remplit : places des portillons, puis réserve dans tout le polygone.</p><div class="row"><button id="bSelArea">Sélectionner</button><button id="bAreaAuto2" ${areaEd() ? '' : 'disabled'}>Revenir au calcul auto</button></div>`;
    for (const d of SECS) if (d.panel) d.panel(X); // sections des couches (Attraction, travées dans la zone d'attente…)
    { const Q = qe(), G = GM().queueEntry; $('qeBox').innerHTML = `<p class="note">Prolongement de la file depuis le début du chemin de file OSM vers la zone piétonne ou l'accès : les visiteurs arrivent par là. Poignée : rond bleu sur la carte (trait plein = réglé, tirets = calcul). Le jeu se recharge à chaque réglage ; les barrières posées à la main ne bougent pas.</p>
      <div class="grid"><span>Longueur (m)</span><span><input id="qeLen" type="number" step="0.1" min="0" max="${Q.max}" value="${(+(G ? G.len : Q.len)).toFixed(1)}"></span><span>Orientation (°)</span><span><input id="qeAng" type="number" step="1" min="-180" max="180" value="${(+(G ? G.ang : Q.ang)).toFixed(1)}"></span></div>
      <p class="note" id="qeInfo">${qeTxt(Q)}</p><div class="row"><button id="bSelQe">Sélectionner</button><button id="bQeAuto" ${qeEd() ? '' : 'disabled'}>Revenir au calcul auto</button></div>`;
      const qch = () => { const l = +$('qeLen').value, a = +$('qeAng').value; if (isFinite(l) && isFinite(a) && l >= 0) setQe(l, a, true); };
      $('qeLen').onchange = qch; $('qeAng').onchange = qch; $('bQeAuto').onclick = revertQe;
      $('bSelQe').onclick = () => { sel = { t: 'qe' }; const Q2 = qe(); focus((Q2.o[0] + Q2.end[0]) / 2, (Q2.o[1] + Q2.end[1]) / 2); panel(); }; }
    $('bSelArea').onclick = () => { sel = { t: 'area' }; const Q = areaPts(); focus(Q.reduce((a, q) => a + q[0], 0) / Q.length, Q.reduce((a, q) => a + q[1], 0) / Q.length); panel(); };
    $('bAreaAuto2').onclick = revertArea;
    if ($('bSelRoom')) $('bSelRoom').onclick = () => { sel = { t: 'room' }; const r = rooms()[0]; focus(r.x, r.z); panel(); };
    const L = gates();
    $('gList').innerHTML = L.length ? L.map(g => `<div class="it${sel && sel.t === 'gate' && sel.key === g.key ? ' sel' : ''}" data-key="${esc(g.key)}"><span class="tag ${g.g.open0 ? 't-entry">ouverte' : 't-fork">fermée'}</span><span class="k" title="${esc(g.from || g.key)}">Barrière ${esc(g.key)}</span>${g.from ? '<span class="tag t-est">reprise</span>' : ''}</div>`).join('') : '<p class="note">Aucune barrière.</p>';
    for (const el of $('gList').querySelectorAll('.it')) el.onclick = () => { sel = { t: 'gate', key: el.dataset.key }; const g = gates().find(x => x.key === sel.key); focus(g.g.h[0], g.g.h[1]); panel(); };
    $('bAddGate').textContent = adding ? 'Cliquer l\'allée sur la carte… (annuler)' : 'Ajouter une barrière';
    $('bAddGate').onclick = () => { adding = !adding; panel(); };
    $('orph').innerHTML = '';
    status();
  }
  function focus(x, z) { E('cam.g=null;cam.follow=-1;cam.key="";0'); const c = E('cam'); c.x = x; c.z = z; if (c.s < 8) c.s = 12; }
  function status() {
    const d = draft(), v = S.validate(d, vctx()), t = S.text(d), dirty = orig.exists ? t !== orig.text : Object.keys(d).length > 0;
    $('dirty').textContent = dirty ? 'modifications non enregistrées' : 'aucune modification'; $('dirty').classList.toggle('on', dirty);
    $('valBox').innerHTML = (v.errors.length ? '<div class="err">' + v.errors.map(esc).join('<br>') + '</div>' : '<div>Validation : correcte.</div>') + (v.warnings.length ? '<div class="warn">' + v.warnings.map(esc).join('<br>') + '</div>' : '')
      + `<div>${gates().length} barrière(s) de file ; salle : ${Array.isArray(d.controlRooms) ? d.controlRooms.length : 'OSM ou SITE.booth (repli)'} ; zone d'attente : ${d.boardAreas && d.boardAreas.length ? 'éditée (' + d.boardAreas[0].pts.length + ' sommets)' : 'calcul auto'} ; travées : ${d.board ? d.board.depth + ' m' : 'calcul auto'} ; entrée de la file : ${d.queueEntry ? d.queueEntry.len + ' m à ' + d.queueEntry.ang + '°' : 'calcul auto'}.</div>`;
    window.ED.dirty = dirty;
  }

  // ── envoi vers OSM (issue #46, D12) : écarts GAME ↔ OSM.attrs (S.osmDiff), cases à cocher, changeset commenté ; l'envoi lui-même est fait par le serveur (OAuth2 PKCE, editor/server.js) ──
  const PLATS = '(()=>{const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2;const q=(l0,l1)=>[[a.x-a.tx*bk+a.rx*l0,a.z-a.tz*bk+a.rz*l0],[b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0],[b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1],[a.x-a.tx*bk+a.rx*l1,a.z-a.tz*bk+a.rz*l1]].map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]);return P.exit?[q(PEDGE,P.load),q(-PEDGE,-P.exit)]:[q(PEDGE,P.load)];})()';
  let osmItems = [];
  async function showOsm() {
    if (!ready) return;
    $('oSite').textContent = site; $('modalOsm').classList.add('on'); $('oSend').disabled = true; $('oLogin').hidden = true;
    const st = await api('/api/osm/status'), attrs = E('OSM.attrs') || [];
    osmItems = S.osmDiff(draft(), attrs, { plats: E(PLATS) });
    $('oCom').value = $('oCom').value || `Apparence de la file et du quai (${site}) : surface, couleur, matériau, toit`;
    const who = st.user ? ' (connecté : ' + esc(st.user) + ')' : '';
    if (!st.configured) $('oMsg').innerHTML = '<span class="err">Envoi non configuré : créer editor/osm.local.json (identifiant client OAuth2, voir editor/README.md).</span>';
    else $('oMsg').innerHTML = 'Serveur OSM : <code>' + esc(st.api) + '</code>' + (st.loggedIn ? ' — connecté' + who : ' — <span class="warn">non connecté</span>') + '. Un changeset sera ouvert, les écarts cochés envoyés, puis il sera fermé. Rien n\'est envoyé sans ce bouton.';
    $('oLogin').hidden = !st.configured || st.loggedIn;
    $('oList').innerHTML = osmItems.length ? osmItems.map((it, i) => `<label><input type="checkbox" data-oi="${i}" ${it.type === 'create' ? '' : 'checked'}> <b>${it.type === 'create' ? 'créer' : 'modifier'}</b> ${esc(it.role)} ${it.type === 'create' ? '' : '<code>' + esc(it.id) + ' v' + it.v + '</code>'} — ${esc(it.key)} : <code>${esc(it.from || '(absent)')}</code> → <code>${esc(it.to)}</code>${it.type === 'create' ? ' <span class="note">(décoché par défaut)</span>' : ''}</label>`).join('')
      : '<p class="note">Aucun écart avec OSM : tous les réglages concernés sont ceux d\'OSM (ou sans équivalent).</p>';
    const upd = () => { $('oSend').disabled = !(st.configured && st.loggedIn && $('oList').querySelector('input:checked')); };
    for (const c of $('oList').querySelectorAll('input')) c.onchange = upd; upd();
  }
  async function sendOsm() {
    const items = [...$('oList').querySelectorAll('input:checked')].map(c => osmItems[+c.dataset.oi]);
    $('oSend').disabled = true; $('oMsg').textContent = 'Envoi…';
    const r = await api('/api/osm/send/' + site, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: $('oCom').value, items }) });
    window.ED.osmResult = r;
    if (r.ok) $('oMsg').innerHTML = `<span class="ok">Envoyé : changeset <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.changeset)}</a> (${r.modified.length} objet(s) modifié(s), ${r.created.length} créé(s)).</span> Relancer l'import (<code>tools/make_site.py</code>) pour relire les nouvelles versions : les écarts ci-dessus ne disparaissent qu'après.`;
    else $('oMsg').innerHTML = '<span class="err">Refusé : ' + esc((r.errors || [r.error]).join(' ; ')) + '</span>' + (r.conflicts ? '<br>' + r.conflicts.map(c => esc(c.id + ' : version importée ' + c.have + ', version actuelle ' + c.now)).join('<br>') + '<br>Relancer l\'import avant de renvoyer.' : '');
  }
  $('bOsm').onclick = showOsm; $('oClose').onclick = () => $('modalOsm').classList.remove('on'); $('oSend').onclick = sendOsm;
  $('oLogin').onclick = () => { window.open('/osm/login', 'osmlogin', 'width=720,height=820'); };
  window.addEventListener('message', e => { if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(e.origin) && e.data === 'osm-login' && $('modalOsm').classList.contains('on')) showOsm(); });

  // ── diff et sauvegarde ──
  const summary = g => `${Object.keys((g && g.barriers) || {}).length} barrière(s) · salle : ${g && Array.isArray(g.controlRooms) ? (g.controlRooms.length ? g.controlRooms.map(r => `${r.id} (${r.x}, ${r.z}), ${r.angle}°, ${r.w} x ${r.d} m`).join('') : 'aucune') : 'OSM ou SITE.booth (repli)'} · zone d'attente : ${g && g.boardAreas && g.boardAreas.length ? g.boardAreas.map(a => a.id + ', ' + a.pts.length + ' sommets').join('') : 'calcul auto'} · travées : ${g && g.board ? g.board.depth + ' m' : 'calcul auto'} · entrée de la file : ${g && g.queueEntry ? g.queueEntry.len + ' m à ' + g.queueEntry.ang + '°' : 'calcul auto'} · attraction (SITE) : ${g && g.site ? Object.keys(g.site).join(', ') : 'valeurs d\'origine'}`;
  async function showDiff() {
    if (!ready) return;
    const g = draft(), r = await api('/api/diff/' + site, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: g, trainMax: vctx().trainMax }) });
    $('mFile').textContent = 'lieux/' + site + '.game.js'; $('modal').classList.add('on');
    $('mBefore').innerHTML = '<b>Avant</b><br>' + (orig.exists ? esc(summary(orig.game)) : 'fichier absent');
    $('mAfter').innerHTML = '<b>Après</b><br>' + esc(summary(g));
    if (!r.ok) { $('mMsg').innerHTML = '<span class="err">Refusé :<br>' + r.errors.map(esc).join('<br>') + '</span>'; $('diff').textContent = ''; $('bSave').disabled = true; return; }
    $('mMsg').innerHTML = (r.same ? 'Aucune différence avec le fichier.' : 'Lignes retirées en rouge, ajoutées en vert.') + (r.warnings.length ? '<br><span class="warn">' + r.warnings.map(esc).join('<br>') + '</span>' : '');
    $('diff').innerHTML = r.diff.map(l => `<div class="${l.t === '+' ? 'a' : l.t === '-' ? 'r' : 'c'}">${l.t} ${esc(l.s)}</div>`).join('');
    $('bSave').disabled = r.same;
  }
  async function save() {
    const r = await api('/api/game/' + site, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: draft(), trainMax: vctx().trainMax }) });
    if (!r.written) { $('mMsg').innerHTML = '<span class="err">Échec : ' + esc((r.errors || [r.error]).join(' ; ')) + '</span>'; return; }
    orig = r; $('mMsg').textContent = 'Enregistré : ' + r.written + '. Rien n\'est envoyé à Git : relire, puis committer soi-même.'; $('bSave').disabled = true;
    $('file').textContent = r.written + ' : présent'; window.ED.saved = (window.ED.saved || 0) + 1; status();
  }
  $('bDiff').onclick = showDiff; $('bSave').onclick = save; $('bCancel').onclick = () => $('modal').classList.remove('on');
  $('bReload').onclick = () => { if (!window.ED.dirty || confirm('Abandonner les modifications ?')) open(site); };
  $('bMig').onclick = () => { migrate(); sel = { t: 'room' }; panel(); };
  $('site').onchange = () => { if (window.ED.dirty && !confirm('Abandonner les modifications ?')) { $('site').value = site; return; } open($('site').value); };

  // Outils passés aux sections des couches : cadre du jeu, brouillon, panneau, rechargement, sélection
  const X = { E: s => E(s), GM: () => GM(), S, $, esc, clamp, R2, draft, panel, panelLite, reloadPreview, focus, getSel: () => sel, setSel: v => { sel = v; }, setUndo: v => { siteUndo = v; } };
  // Accès pour les tests (tools/editor-test.js) : rien de plus que ce que fait l'interface.
  window.ED = { ready: false, secs: () => SECS.map(d => d.id), isReady: () => ready, E: s => E(s), toScr: (x, z) => { const f = fr.getBoundingClientRect(), p = toScr(x, z); return [f.left + p[0], f.top + p[1]]; }, gates: () => gates(), rooms: () => rooms(), area: () => areaPts(), areaEd: () => areaEd(), viaEnd: () => viaEnd(), snapPx: SNAP_PX, qe: () => qe(), snapped: () => snapped, draft: () => draft(), site: () => site, sel: () => sel, adding: () => adding, refresh: () => panel() };
  // couches du moteur servies par editor/server.js (GET /api/couches) : schéma (sections de GAME) puis panneau, avant l'ouverture d'une attraction
  (async () => { let C = []; try { C = await api('/api/couches'); } catch (e) { }
    for (const c of C) for (const f of c.fichiers) await new Promise(ok => { const sc = document.createElement('script'); sc.src = '/engine/' + c.nom + '/' + f; sc.onload = sc.onerror = ok; document.head.appendChild(sc); });
    for (const d of SECS) if (d.titre) { const el = document.createElement('section'); el.id = d.id; el.innerHTML = '<h2>' + d.titre + '</h2><div id="' + d.box + '"></div>'; $('side').insertBefore(el, $(d.avant) || null); }
    for (const d of SECS) if (d.ed) Object.assign(window.ED, d.ed(X));
    loadSites(); })();
})();
