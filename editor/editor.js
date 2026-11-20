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

  // ── ouverture d'une attraction ──
  async function loadSites() {
    const L = await api('/api/sites'), s0 = new URLSearchParams(location.search).get('site');
    $('site').innerHTML = L.map(s => `<option value="${s.id}">${s.id}${s.game ? ' (game.js)' : ''}</option>`).join('');
    open(L.some(s => s.id === s0) ? s0 : L[0].id);
  }
  async function open(id) {
    ready = false; sel = null; adding = null; site = id; $('site').value = id; setName(''); siteUndo = null; keep = null; sideTop = 0;
    history.replaceState(null, '', '?site=' + id);
    orig = await api('/api/game/' + id);
    $('file').textContent = 'sites/' + id + '.game.js : ' + (orig.exists ? (orig.error ? 'ILLISIBLE (' + orig.error + ')' : 'présent') : 'absent (créé à la première sauvegarde)');
    fr.src = '/jeu.html?site=' + id + '&mode=sandbox&editeur=' + Date.now();
  }
  fr.addEventListener('load', () => {
    W = fr.contentWindow; E = s => W.eval(s);
    const t0 = Date.now(), wait = () => {
      let ok = false; try { ok = E("typeof gateList==='function'&&typeof ctlRooms==='function'&&typeof reBoard==='function'&&typeof cam==='object'"); } catch (e) { }
      if (!ok) { if (Date.now() - t0 < 20000) return setTimeout(wait, 60); $('valBox').innerHTML = '<span class="err">Le jeu ne s\'est pas chargé' + (siteUndo ? ' avec ces paramètres de l\'attraction (par exemple pas de place au garage pour tous les trains).</span> <button id="bUndoSite">Annuler la dernière modification</button>' : '.</span>'); if (siteUndo && $('bUndoSite')) $('bUndoSite').onclick = () => { setName('t2z-draft:' + siteUndo); siteUndo = null; fr.src = '/jeu.html?site=' + site + '&mode=sandbox&editeur=' + Date.now(); }; return; }
      const st = W.document.createElement('style'); // seulement la carte : pupitre, en-tête, journal masqués
      st.textContent = 'header,#side,#log,#tabs,#fsBar,#hint,#cams{display:none!important}#view{min-height:0!important}';
      W.document.head.appendChild(st); W.dispatchEvent(new W.Event('resize'));
      E("act('speed',0);synOn=false"); // simulation figée : seul le dessin tourne ; synoptique masqué (choix du joueur non modifié)
      if (keep) { const k = keep; keep = null; E('cam.g=null;cam.follow=-1;cam.key="";0'); const c = E('cam'); c.x = k.x; c.z = k.z; c.s = k.s; } // rechargement du jeu en cadre (GAME.site) : la vue de l'éditeur est gardée (issue #32)
      hook(); ready = true; panel(); $('side').scrollTop = sideTop; window.ED.ready = true;
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
  // profondeur des travées d'attente (issue #27) : GAME.board={depth} ; boardDepth() du moteur donne la valeur, le calcul, les bornes et le repère de la poignée
  // (ligne des portillons du portillon du milieu, direction vers l'arrière du quai)
  const dep = () => E('boardDepth()'), depthEd = () => !!(GM().board && GM().board.depth != null);
  const depthH = D => [D.u.o[0] + D.u.r[0] * D.depth, D.u.o[1] + D.u.r[1] * D.depth];
  function setDepth(v) { const D = dep(); GM().board = { depth: R2(clamp(v, D.min, D.max)) }; E('reBoard()'); }
  function revertDepth() { delete GM().board; E('reBoard()'); panel(); }
  const SNAP_PX = 11, viaEnd = () => { try { return E('boardViaEnd()'); } catch (e) { return null; } };
  function snap(q, alt) { if (alt) return null; const V = viaEnd(); if (!V) return null; const s = E('cam').s; let best = null, bd = SNAP_PX;
    for (const [t, k] of [[V.end, 'end'], [V.edges[0], 'edge'], [V.edges[1], 'edge']]) { const d = Math.hypot(q[0] - t[0], q[1] - t[1]) * s; if (d < bd) { bd = d; best = { p: [t[0], t[1]], k }; } if (best && best.k === 'end') break; } // le point de fin de file l'emporte sur les bords
    return best; }

  // ── données éditées ──
  function draft() { const g = JSON.parse(W.JSON.stringify(GM())); if (g.barriers && !Object.keys(g.barriers).length) delete g.barriers; if (Array.isArray(g.boardAreas) && !g.boardAreas.length) delete g.boardAreas; if (g.board && g.board.depth == null) delete g.board; if (g.site && !Object.keys(g.site).length) delete g.site; return g; }
  function ovrOf(g) { // surcharge d'une barrière, créée depuis sa géométrie actuelle au premier changement
    const M = GM(); if (!M.barriers) M.barriers = {};
    if (!M.barriers[g.key] || M.barriers[g.key].off) { const p = q => ({ ang: R1(deg(Math.atan2(q[1] - g.h[1], q[0] - g.h[0]))), len: R2(Math.hypot(q[0] - g.h[0], q[1] - g.h[1])) }); M.barriers[g.key] = { x: R2(g.h[0]), z: R2(g.h[1]), a: p(g.a), b: p(g.b) }; }
    return M.barriers[g.key];
  }
  function migrate() { // salle déduite de SITE.booth (D3) : SITE reste inchangé, la salle passe dans GAME à la sauvegarde
    const M = GM(); if (Array.isArray(M.controlRooms)) return;
    const b = E('defRoom()'); M.controlRooms = b ? [{ id: 'poste', x: R2(b.x), z: R2(b.z), angle: R1(b.angle), w: R2(b.w), d: R2(b.d), main: true }] : [];  // salle OSM (OSM.ctl), sinon SITE.booth
  }
  const applied = () => { E('reGates()'); panel(); };
  function revertGate(key) { const M = GM(); if (M.barriers) { delete M.barriers[key]; if (!Object.keys(M.barriers).length) delete M.barriers; } applied(); }
  // Supprimer : barrière calculée -> surcharge {off:true} (le calcul reste, « Rétablir » retire la surcharge) ; barrière ajoutée -> clé retirée de GAME
  function deleteGate(key) { const g = gates().find(x => x.key === key); if (!g) return; const M = GM(); if (!M.barriers) M.barriers = {};
    if (g.add) delete M.barriers[key]; else M.barriers[key] = { off: true }; if (!Object.keys(M.barriers).length) delete M.barriers; if (g.add) sel = null; applied(); }
  // Ajouter : pivot cliqué sur la carte, A en travers du raccourci, B en travers de la boucle de la fourche choisie ; clé 'add:<tronçon>:<n>' (n libre le plus petit)
  function addGate(name, p) { const M = GM(); if (!M.barriers) M.barriers = {}; let n = 1; while (M.barriers['add:' + name + ':' + n]) n++; const key = 'add:' + name + ':' + n;
    const ab = E(`(()=>{const l=LOOPS.find(l=>l.kname===${JSON.stringify(name)}),h=[${p[0]},${p[1]}],hw=qwAt(h[0],h[1])/2;return [across(h,l.short.P,hw),across(h,l.loop.P,hw)];})()`);
    const q = v => { let len = Math.hypot(v[0] - p[0], v[1] - p[1]), ang = Math.atan2(v[1] - p[1], v[0] - p[0]); if (len < .5) len = 2.2; return { ang: R1(deg(ang)), len: R2(clamp(len, .2, 20)) }; };
    M.barriers[key] = { x: R2(p[0]), z: R2(p[1]), a: q(ab[0]), b: q(ab[1]) }; adding = null; sel = { t: 'gate', key }; applied(); return key; }
  // Rattacher une barrière ajoutée à une autre fourche : la clé 'add:<fourche>:<n>' est renommée (n libre le plus petit dans la nouvelle fourche), géométrie intacte
  function moveGate(key, name) { const M = GM(), m = /^add:(.+):(\d+)$/.exec(key); if (!m || !M.barriers || !M.barriers[key] || m[1] === name) return key;
    let n = 1; while (M.barriers['add:' + name + ':' + n]) n++; const nk = 'add:' + name + ':' + n; M.barriers[nk] = M.barriers[key]; delete M.barriers[key];
    if (sel && sel.t === 'gate' && sel.key === key) sel.key = nk; applied(); return nk; }
  function areaOvr() { const M = GM(); if (!areaEd()) M.boardAreas = [{ id: 'quai', pts: areaPts().map(q => [R2(q[0]), R2(q[1])]) }]; return M.boardAreas[0]; }
  const areaApplied = () => { E('reBoard()'); panel(); };
  function revertArea() { delete GM().boardAreas; sel = sel && sel.t === 'area' ? { t: 'area' } : sel; areaApplied(); }
  function delVertex(i) { const A = areaOvr(); if (A.pts.length <= 3) return; A.pts.splice(i, 1); sel = { t: 'area' }; areaApplied(); }
  function createRoom() { migrate(); const M = GM(); if (M.controlRooms.length) return; const c = E('cam'); M.controlRooms.push({ id: 'poste', x: R2(c.x), z: R2(c.z), angle: 0, w: 3.75, d: 1.7, main: true }); sel = { t: 'room' }; panel(); }
  function deleteRoom() { migrate(); GM().controlRooms.length = 0; sel = null; panel(); }

  // ── sélection et poignées ──
  function hit(p) {
    const s = E('cam').s, tol = Math.max(.35, 9 / s);
    if (sel && sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); if (g) { if (Math.hypot(p[0] - g.g.a[0], p[1] - g.g.a[1]) < tol) return { t: 'gate', key: g.key, m: 'a' }; if (Math.hypot(p[0] - g.g.b[0], p[1] - g.g.b[1]) < tol) return { t: 'gate', key: g.key, m: 'b' }; } }
    if (sel && sel.t === 'room') { const r = rooms()[0]; if (r) { if (Math.hypot(p[0] - rotH(r)[0], p[1] - rotH(r)[1]) < tol) return { t: 'room', m: 'rot' }; for (let i = 0; i < 4; i++) { const q = roomPt(r, [CORNERS[i][0] * r.w / 2, CORNERS[i][1] * r.d / 2]); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < tol) return { t: 'room', m: 'c' + i }; } } }
    if (sel && sel.t === 'area') { const P = areaPts(); for (let i = 0; i < P.length; i++) if (Math.hypot(p[0] - P[i][0], p[1] - P[i][1]) < tol) return { t: 'area', m: 'v' + i };
      const M = mids(P); for (let i = 0; i < M.length; i++) if (Math.hypot(p[0] - M[i][0], p[1] - M[i][1]) < tol * .8) return { t: 'area', m: 'm' + i }; }
    { const D = dep(), q = depthH(D); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < tol) return { t: 'depth', m: 'depth' }; } // poignée de profondeur des travées
    let best = null, bd = tol;
    for (const g of gates()) { if (g.off) continue; const d = Math.min(Math.hypot(p[0] - g.g.h[0], p[1] - g.g.h[1]) * .8, dSeg(p, g.g.h, g.g.a), dSeg(p, g.g.h, g.g.b)); if (d < bd) { bd = d; best = { t: 'gate', key: g.key, m: 'move' }; } }
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
      if (adding) { e.stopImmediatePropagation(); e.preventDefault(); addGate(adding, p); return; }
      const h = hit(p); if (!h) return;
      e.stopImmediatePropagation(); e.preventDefault(); cv.setPointerCapture(e.pointerId);
      if (h.t === 'area' && h.m[0] === 'm') { const A = areaOvr(), i = +h.m.slice(1), q = mids(A.pts)[i], sn = snap(q, e.altKey); A.pts.splice(i + 1, 0, sn ? sn.p : [R2(q[0]), R2(q[1])]); h.m = 'v' + (i + 1); snapped = sn; E('reBoard()'); } // milieu d'un bord : nouveau sommet (aimanté)
      sel = h.t === 'gate' ? { t: 'gate', key: h.key } : h.t === 'depth' ? { t: 'depth' } : h.t === 'area' ? { t: 'area', v: h.m[0] === 'v' ? +h.m.slice(1) : (sel && sel.t === 'area' ? sel.v : undefined) } : { t: 'room' };
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
        if (drag.m === 'move') { o.x = R2(drag.o0.x + dx); o.z = R2(drag.o0.z + dz); }
        else { const q = o[drag.m]; q.ang = R1(deg(Math.atan2(p[1] - o.z, p[0] - o.x))); q.len = R2(clamp(Math.hypot(p[0] - o.x, p[1] - o.z), .2, 20)); }
        E('reGates()');
      } else if (drag.t === 'depth') { const D = dep(); setDepth((p[0] - D.u.o[0]) * D.u.r[0] + (p[1] - D.u.o[1]) * D.u.r[1]); // profondeur = distance à la ligne des portillons
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
    const up = e => { if (!drag) return; e.stopImmediatePropagation(); e.preventDefault(); drag = null; snapped = null; panel(); };
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
    { const D = dep(), o = P(D.u.o[0], D.u.o[1]), q = P(...depthH(D)), on = sel && sel.t === 'depth'; // profondeur des travées : trait depuis la ligne des portillons, poignée carrée
      oc.strokeStyle = '#ff8a3d'; oc.lineWidth = on ? 2.5 : 1.6; oc.setLineDash(D.game ? [] : [4, 3]); oc.beginPath(); oc.moveTo(o[0], o[1]); oc.lineTo(q[0], q[1]); oc.stroke(); oc.setLineDash([]);
      oc.fillStyle = on ? '#ff8a3d' : '#fff'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.beginPath(); oc.moveTo(q[0], q[1] - 6); oc.lineTo(q[0] + 6, q[1]); oc.lineTo(q[0], q[1] + 6); oc.lineTo(q[0] - 6, q[1]); oc.closePath(); oc.fill(); oc.stroke();
      const t = 'travées ' + D.depth.toFixed(2).replace('.', ',') + ' m'; oc.font = '600 11px system-ui'; oc.lineWidth = 3; oc.strokeText(t, q[0] + 9, q[1] - 7); oc.fillStyle = '#ff8a3d'; oc.fillText(t, q[0] + 9, q[1] - 7); }
    for (const g of gates()) {
      if (g.off) { const h = P(g.g.h[0], g.g.h[1]); oc.strokeStyle = '#e5484d'; oc.lineWidth = 2; oc.beginPath(); oc.moveTo(h[0] - 5, h[1] - 5); oc.lineTo(h[0] + 5, h[1] + 5); oc.moveTo(h[0] + 5, h[1] - 5); oc.lineTo(h[0] - 5, h[1] + 5); oc.stroke(); continue; }
      const col = g.kind === 'entry' ? '#f0a23b' : '#5fd3e6', on = sel && sel.t === 'gate' && sel.key === g.key, h = P(g.g.h[0], g.g.h[1]), a = P(g.g.a[0], g.g.a[1]), b = P(g.g.b[0], g.g.b[1]);
      oc.strokeStyle = col; oc.lineWidth = on ? 3 : 2; oc.beginPath(); oc.moveTo(h[0], h[1]); oc.lineTo(a[0], a[1]); oc.stroke();
      oc.setLineDash([4, 3]); oc.lineWidth = on ? 2 : 1.3; oc.beginPath(); oc.moveTo(h[0], h[1]); oc.lineTo(b[0], b[1]); oc.stroke(); oc.setLineDash([]);
      oc.fillStyle = g.g.ovr || g.add ? '#4cc38a' : col; oc.strokeStyle = '#0b1120'; oc.lineWidth = 1.5; oc.beginPath(); oc.arc(h[0], h[1], on ? 6 : 4.5, 0, 7); oc.fill(); oc.stroke();
      if (on) for (const [q, t] of [[a, 'A'], [b, 'B']]) { oc.fillStyle = '#fff'; oc.fillRect(q[0] - 5, q[1] - 5, 10, 10); oc.strokeRect(q[0] - 5, q[1] - 5, 10, 10); oc.fillStyle = '#fff'; oc.font = '600 11px system-ui'; oc.strokeStyle = '#0b1120'; oc.lineWidth = 3; oc.strokeText(t, q[0] + 8, q[1] - 6); oc.fillText(t, q[0] + 8, q[1] - 6); oc.lineWidth = 1.5; }
    }
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
  let siteUndo = null, rt = 0, keep = null, sideTop = 0;
  const setName = v => { try { fr.contentWindow.name = v; } catch (e) { } }; // window.name du cadre : survit à la navigation suivante (même origine)
  const reloadPreview = () => { try { const c = E('cam'); keep = { x: c.x, z: c.z, s: c.s }; } catch (e) { } sideTop = $('side').scrollTop; ready = false; window.ED.ready = false; sel = null; adding = null; clearTimeout(rt); rt = setTimeout(() => { setName('t2z-draft:' + JSON.stringify(draft())); fr.src = '/jeu.html?site=' + site + '&mode=sandbox&editeur=' + Date.now(); }, 120); };
  const SB = () => E('SITE_BASE'), SKIND = () => E('SITE.kind');
  // nombre de trains au plus (issue #32) : places d'attente du moteur (TRAIN_MAX, engine/state.js : gare, voies de garage, frein avant gare, frein final, freins de bloc), 8 au plus (editor/schema.js)
  const tMax = () => { let m = S.SL.trains[1]; try { m = Math.min(m, E('TRAIN_MAX')); } catch (e) { } return m; };
  function tPlaces() { let t = ''; try { const g = E('LANES.reduce((n,l)=>n+l.cap,0)'), z = E('TRAIN_SPOTS.map(p=>zName(p.z))'); t = `Au plus ${tMax()} trains : un par place où un train peut attendre (1 en gare, ${g} au garage${z.length ? ', ' + z.length + ' sur les zones de freinage : ' + z.join(', ') : ''}${E('TRAIN_MAX') > S.SL.trains[1] ? ' ; ' + S.SL.trains[1] + ' au plus dans l\'éditeur' : ''}). Les trains au-delà du garage partent arrêtés sur ces zones.`; } catch (e) { } return esc(t); }
  const pth = (o, p) => p.reduce((a, k) => a == null ? undefined : a[k], o);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function siteChange(fn) { siteUndo = JSON.stringify(draft()); const M = GM(); if (!M.site) M.site = {}; fn(M.site); prune(M); reloadPreview(); }
  function prune(M) { const s = M.site; if (!s) return; for (const k of Object.keys(s)) if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && !Object.keys(s[k]).length) delete s[k]; if (!Object.keys(s).length) delete M.site; }
  function setSite(p, v) { // valeur égale à l'origine : surcharge retirée
    siteChange(s => { const base = pth(SB(), p); if (v === '' || (base !== undefined && same(base, v))) return delSite(s, p); let o = s; for (const k of p.slice(0, -1)) { if (!o[k]) o[k] = {}; o = o[k]; } o[p[p.length - 1]] = v; });
  }
  function delSite(s, p) { let o = s; for (const k of p.slice(0, -1)) { o = o[k]; if (!o) return; } delete o[p[p.length - 1]]; }
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), rgbHex = a => '#' + a.map(c => ('0' + clamp(Math.round(c), 0, 255).toString(16)).slice(-2)).join('');
  const SF = { // champs : chemin, libellé, type, défaut si SITE n'en donne pas (ESTIMÉ = valeur du moteur)
    car: [{ p: ['car', 'len'], l: 'Longueur d\'un wagon (m)', t: 'num', st: .05, d: null }, { p: ['car', 'n'], l: 'Wagons par train', t: 'int', d: null }, { p: ['car', 'seats'], l: 'Places par wagon', t: 'int', d: 2 }, { p: ['car', 'abreast'], l: 'Places côte à côte', t: 'int', d: 2 },
      { p: ['car', 'restraint'], l: 'Sécurités', t: 'enum', o: [['lapbar', 'lapbars'], ['otsr', 'harnais'], ['belt', 'ceintures']] }],
    phys: [{ p: ['phys', 'roll'], l: 'Roulement (frottement)', t: 'num', st: .005, d: .098 }, { p: ['phys', 'drag'], l: 'Traînée (air)', t: 'num', st: .0001, d: .0006 }, { p: ['phys', 'vmin'], l: 'Vitesse minimale (m/s)', t: 'num', st: .5, d: 3 }],
  };
  const lim = p => { const L = S.SL[p[1]]; return L ? { min: L[0], max: L[1] } : {}; };
  function effRestraint() { return E('RES_KIND'); }
  function fieldHTML(f, kind) {
    const p = f.p, key = p.join('.'), ov = pth(GM().site || {}, p), base = pth(SB(), p), mod = ov !== undefined;
    let eff = mod ? ov : base !== undefined ? base : f.d; if (f.p[1] === 'restraint') eff = ov !== undefined ? ov : base !== undefined ? base : effRestraint();
    const o = base !== undefined ? base : (f.d != null ? f.d + ' (défaut du moteur)' : f.p[1] === 'restraint' ? 'défaut du type' : '');
    let ctl;
    if (f.t === 'enum') ctl = `<select data-p="${key}">${f.o.map(([v, n]) => `<option value="${v}"${v === eff ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    else { const L = lim(p); ctl = `<input data-p="${key}" data-t="${f.t}" type="number" step="${f.st || 1}"${L.min != null ? ` min="${L.min}" max="${L.max}"` : ''} value="${eff}">`; }
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
    return h.join('');
  }
  function bindSite() {
    const B = $('siteBox');
    for (const el of B.querySelectorAll('[data-p]')) el.addEventListener('change', () => {
      const p = el.dataset.p.split('.'), t = el.dataset.t; let v = el.value;
      if (t === 'num' || t === 'int') { if (v === '' || !isFinite(+v)) return; v = +v; } else if (t === 'rgb') v = hexRgb(v);
      setSite(p, v);
    });
    for (const el of B.querySelectorAll('[data-rev]')) el.onclick = () => { const p = el.dataset.rev.split('.'); siteChange(s => delSite(s, p)); };
    const trains = () => JSON.parse(JSON.stringify(E('SITE.trains')));
    const putTrains = A => { // couleurs, noms, usure : appliqués à chaud au jeu en cadre ; nombre de trains ou voie de garage : jeu en cadre rechargé (vue gardée)
      const cur = trains(), hot = A.length === cur.length && A.every((t, i) => (t.lane || null) === (cur[i].lane || null));
      if (!hot) return siteChange(s => { if (same(A, SB().trains)) delete s.trains; else s.trains = A; });
      siteUndo = JSON.stringify(draft()); const M = GM(); if (!M.site) M.site = {}; if (same(A, SB().trains)) delete M.site.trains; else M.site.trains = A; prune(M);
      E('SITE.trains=' + JSON.stringify(A) + ';SITE.trains.forEach((c,i)=>{const t=trains[i];if(t){t.name=c.name;t.col=c.col;t.col2=c.col2;t.wear=c.wear;}});0');
      panel(); };
    for (const el of B.querySelectorAll('.trow [data-tf]')) el.addEventListener('change', () => { const A = trains(), i = +el.closest('.trow').dataset.i, f = el.dataset.tf; let v = el.value;
      if (f === 'wear') v = clamp(+v || 0, 0, 100); else if (f === 'lane') { if (v === '') { delete A[i].lane; return putTrains(A); } v = Math.round(+v); }
      A[i][f] = v; putTrains(A); });
    for (const el of B.querySelectorAll('[data-tdel]')) el.onclick = () => { const A = trains(); A.splice(+el.dataset.tdel, 1); putTrains(A); };
    const ba = $('bTAdd'); if (ba) ba.onclick = () => { if (trains().length >= tMax()) { panel(); return; } const A = trains(), l = A[A.length - 1], c = Object.assign({}, l, { name: 'Train ' + (A.length + 1), wear: 30 }); delete c.lane; A.push(c); putTrains(A); };
  }

  // ── panneau ──
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const inp = (k, v, st) => `<input data-k="${k}" type="number" step="${st || .05}" value="${v}">`;
  function selHTML() {
    if (!sel) return '<span class="note">Cliquer une barrière, la salle de contrôle ou la zone d\'attente sur la carte. Glisser : déplacer ; poignées A / B : orienter et allonger ; poignées de la salle : redimensionner, rond : tourner. La carte se déplace et se zoome comme dans le jeu.</span>';
    if (sel.t === 'gate') {
      const g = gates().find(x => x.key === sel.key); if (!g) return '<span class="err">Barrière introuvable.</span>';
      if (g.off) return `<div><b>${esc(g.key)}</b></div><div class="note">Barrière <span class="tag t-orph">supprimée</span> : ignorée par le dessin, le clic et la logique du jeu (surcharge <code>{"off": true}</code>, le calcul reste).</div><div class="row"><button id="bAuto">Rétablir la barrière</button></div>`;
      const G = g.g, an = q => R1(deg(Math.atan2(q[1] - G.h[1], q[0] - G.h[0]))), ln = q => R2(Math.hypot(q[0] - G.h[0], q[1] - G.h[1]));
      const est = G.est || (G.cfg && G.cfg.est);
      const fsel = g.add ? `<div class="row"><label>Fourche <select id="selFork">${E('forkList()').map(f => `<option value="${esc(f.name)}"${f.fork === g.fork ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label></div>` : '';
      return `<div><b>${esc(g.key)}</b></div><div class="note">${g.kind === 'entry' ? 'Barrière d\'entrée — A : fermée en travers du chemin, B : ouverte.' : 'Fourche « ' + esc(g.name || '') + ' » — A : en travers du raccourci (boucle en service), B : position basculée.'} ${g.add ? '<span class="tag t-ovr">ajoutée</span>' : G.ovr ? '<span class="tag t-ovr">corrigée</span>' : 'Calcul automatique' + (est ? ' <span class="tag t-est">estimée</span>' : (G.cfg && G.cfg.osm ? ' (nœud OSM)' : ''))}</div>
        <div class="grid" style="margin-top:6px"><span>Pivot x, z (m)</span><span>${inp('x', R2(G.h[0]))} ${inp('z', R2(G.h[1]))}</span>
        <span>A : angle °, long. m</span><span>${inp('a.ang', an(G.a), 1)} ${inp('a.len', ln(G.a))}</span>
        <span>B : angle °, long. m</span><span>${inp('b.ang', an(G.b), 1)} ${inp('b.len', ln(G.b))}</span></div>
        ${fsel}<div class="row">${g.add ? '' : `<button id="bAuto" ${G.ovr ? '' : 'disabled'}>Revenir au calcul auto</button>`}<button id="bDelGate" class="bad">Supprimer la barrière</button></div>`;
    }
    if (sel.t === 'depth') { const D = dep(); return `<div><b>Profondeur des travées d'attente</b> ${D.game ? '<span class="tag t-ovr">réglée</span>' : '<span class="tag t-est">calcul auto</span>'}</div><div class="note">${D.depth.toFixed(2).replace('.', ',')} m depuis la ligne des portillons : ${D.rows} rang(s) par travée (calcul : ${D.calc.toFixed(2).replace('.', ',')} m). Glisser la poignée (losange orange) ou saisir la valeur dans la section « Zone d'attente du quai ».</div>`; }
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
  function panelLite() { $('selBox').innerHTML = selHTML(); bindSel(); const di = $('depth'); if (di && document.activeElement !== di) { const D = dep(); di.value = D.depth.toFixed(2); $('depthInfo').textContent = depthTxt(D); } status(); }
  const depthTxt = D => `${D.rows} rang(s) par travée ; ${D.game ? 'réglée' : 'calcul auto'} (calcul : ${D.calc.toFixed(2).replace('.', ',')} m ; de ${D.min.toFixed(2).replace('.', ',')} à ${D.max} m).`;
  function bindSel() {
    for (const el of $('selBox').querySelectorAll('input[data-k]')) el.addEventListener('change', () => {
      const v = +el.value, k = el.dataset.k; if (!isFinite(v)) return;
      if (sel.t === 'depth') { const D = dep(); return `<div><b>Profondeur des travées d'attente</b> ${D.game ? '<span class="tag t-ovr">réglée</span>' : '<span class="tag t-est">calcul auto</span>'}</div><div class="note">${D.depth.toFixed(2).replace('.', ',')} m depuis la ligne des portillons : ${D.rows} rang(s) par travée (calcul : ${D.calc.toFixed(2).replace('.', ',')} m). Glisser la poignée (losange orange) ou saisir la valeur dans la section « Zone d'attente du quai ».</div>`; }
    if (sel.t === 'area') { const A = areaOvr(); A.pts[sel.v] = k === 'vx' ? [v, A.pts[sel.v][1]] : [A.pts[sel.v][0], v]; areaApplied(); }
      else if (sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); const o = ovrOf(g.g); if (k.includes('.')) { const [s, f] = k.split('.'); o[s][f] = f === 'len' ? clamp(v, .2, 20) : v; } else o[k] = v; applied(); }
      else { migrate(); const r = GM().controlRooms[0]; r[k] = k === 'w' || k === 'd' ? clamp(v, .5, 40) : v; panel(); }
    });
    const b = $('bAuto'); if (b) b.onclick = () => revertGate(sel.key);
    const sf = $('selFork'); if (sf) sf.onchange = () => moveGate(sel.key, sf.value);
    const bd = $('bDelGate'); if (bd) bd.onclick = () => deleteGate(sel.key);
    const bv = $('bDelVtx'); if (bv) bv.onclick = () => delVertex(sel.v);
    const ba = $('bAreaAuto'); if (ba) ba.onclick = revertArea;
  }
  function panel() {
    if (!ready) return;
    $('secMig').hidden = migrated() || !E('!!B0');
    $('siteBox').innerHTML = siteHTML(); bindSite();
    panelLite();
    const R = migrated() ? GM().controlRooms : null;
    $('roomBox').innerHTML = !R ? (E('!!B0') ? '<p class="note">Salle actuelle : <code>SITE.booth</code> (repli). La première modification la reprend dans <code>game.js</code>.</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>' : '<p class="note">Aucune salle.</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>')
      : R.length ? `<p class="note">Salle « ${esc(R[0].id)} » : ${R[0].w} x ${R[0].d} m. Une seule salle par attraction (pupitre).</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>`
        : '<p class="note">Aucune salle (ni pupitre dessiné, ni gyrophare).</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>';
    if ($('bNewRoom')) $('bNewRoom').onclick = createRoom;
    if ($('bDelRoom')) $('bDelRoom').onclick = deleteRoom;
    $('areaBox').innerHTML = `<p class="note">${areaEd() ? `Zone éditée (<code>game.js</code>) : ${GM().boardAreas[0].pts.length} sommets. Les visiteurs y attendent derrière les portillons.` : 'Zone calculée (travées et couloir d\'attente, en tirets). La première modification la reprend dans <code>game.js</code>.'} Trait vert : fin de la file (losange plein = point où les visiteurs entrent dans la zone) ; un sommet glissé s'y colle (Alt : sans aimant). La zone se remplit : places des portillons, puis réserve dans tout le polygone.</p><div class="row"><button id="bSelArea">Sélectionner</button><button id="bAreaAuto2" ${areaEd() ? '' : 'disabled'}>Revenir au calcul auto</button></div>`;
    { const D = dep(); $('areaBox').insertAdjacentHTML('beforeend', `<h3 style="margin:10px 0 4px;font-size:12px">Profondeur des travées d'attente</h3><p class="note">Distance de la ligne des portillons au bout des séparateurs : nombre de rangs des travées ; les rangs au-delà des places des portillons servent de réserve. Poignée : losange orange sur la carte.</p>
      <div class="grid"><span>Profondeur (m)</span><span><input id="depth" type="number" step="0.1" min="${D.min}" max="${D.max}" value="${D.depth.toFixed(2)}"></span></div><p class="note" id="depthInfo">${depthTxt(D)}</p><div class="row"><button id="bDepthAuto" ${D.game ? '' : 'disabled'}>Revenir au calcul auto</button></div>`);
      $('depth').onchange = () => { const v = +$('depth').value; if (isFinite(v) && v > 0) { setDepth(v); sel = { t: 'depth' }; panel(); } };
      $('bDepthAuto').onclick = revertDepth; }
    $('bSelArea').onclick = () => { sel = { t: 'area' }; const Q = areaPts(); focus(Q.reduce((a, q) => a + q[0], 0) / Q.length, Q.reduce((a, q) => a + q[1], 0) / Q.length); panel(); };
    $('bAreaAuto2').onclick = revertArea;
    if ($('bSelRoom')) $('bSelRoom').onclick = () => { sel = { t: 'room' }; const r = rooms()[0]; focus(r.x, r.z); panel(); };
    const L = gates(), keys = new Set(L.map(g => g.key));
    $('gList').innerHTML = L.map(g => { const est = g.g.est || (g.g.cfg && g.g.cfg.est); return `<div class="it${sel && sel.t === 'gate' && sel.key === g.key ? ' sel' : ''}" data-key="${esc(g.key)}"><span class="tag ${g.kind === 'entry' ? 't-entry">entrée' : 't-fork">fourche'}</span><span class="k" title="${esc(g.key)}">${esc(g.kind === 'entry' ? 'Entrée de la file' : (g.name || '') + ' · ' + g.key.split(':').pop())}</span>${g.off ? '<span class="tag t-orph">supprimée</span>' : g.add ? '<span class="tag t-ovr">ajoutée</span>' : g.g.ovr ? '<span class="tag t-ovr">corrigée</span>' : est ? '<span class="tag t-est">estimée</span>' : ''}</div>`; }).join('');
    for (const el of $('gList').querySelectorAll('.it')) el.onclick = () => { sel = { t: 'gate', key: el.dataset.key }; const g = gates().find(x => x.key === sel.key); focus(g.g.h[0], g.g.h[1]); panel(); };
    const F = E('forkList()'), fv = $('addFork').value;
    $('addFork').innerHTML = F.map(f => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join(''); if (F.some(f => f.name === fv)) $('addFork').value = fv;
    $('secAdd').hidden = !F.length; $('bAddGate').textContent = adding ? 'Cliquer le pivot sur la carte… (annuler)' : 'Ajouter une barrière';
    $('bAddGate').onclick = () => { adding = adding ? null : $('addFork').value; panel(); };
    const orph = Object.keys(GM().barriers || {}).filter(k => !keys.has(k));
    $('orph').innerHTML = orph.length ? '<p class="err">Surcharges orphelines (la barrière n\'existe plus dans le jeu) :</p>' + orph.map(k => `<div class="it"><span class="tag t-orph">orpheline</span><span class="k">${esc(k)}</span><button data-del="${esc(k)}">Supprimer</button></div>`).join('') : '';
    for (const el of $('orph').querySelectorAll('[data-del]')) el.onclick = () => { if (confirm('Supprimer la surcharge orpheline ' + el.dataset.del + ' ?')) revertGate(el.dataset.del); };
    status();
  }
  function focus(x, z) { E('cam.g=null;cam.follow=-1;cam.key="";0'); const c = E('cam'); c.x = x; c.z = z; if (c.s < 8) c.s = 12; }
  function status() {
    const d = draft(), v = S.validate(d, { trainMax: tMax() }), t = S.text(d), dirty = orig.exists ? t !== orig.text : Object.keys(d).length > 0;
    $('dirty').textContent = dirty ? 'modifications non enregistrées' : 'aucune modification'; $('dirty').classList.toggle('on', dirty);
    const orph = Object.keys(d.barriers || {}).filter(k => !new Set(gates().map(g => g.key)).has(k)).length;
    $('valBox').innerHTML = (v.errors.length ? '<div class="err">' + v.errors.map(esc).join('<br>') + '</div>' : '<div>Validation : correcte.</div>') + (v.warnings.length ? '<div class="warn">' + v.warnings.map(esc).join('<br>') + '</div>' : '')
      + `<div>${Object.keys(d.barriers || {}).length} surcharge(s) de barrière (corrigées, ajoutées, supprimées)${orph ? ', dont ' + orph + ' orpheline(s)' : ''} ; salle : ${Array.isArray(d.controlRooms) ? d.controlRooms.length : 'OSM ou SITE.booth (repli)'} ; zone d'attente : ${d.boardAreas && d.boardAreas.length ? 'éditée (' + d.boardAreas[0].pts.length + ' sommets)' : 'calcul auto'} ; travées : ${d.board ? d.board.depth + ' m' : 'calcul auto'}.</div>`;
    window.ED.dirty = dirty;
  }

  // ── diff et sauvegarde ──
  const summary = g => `${Object.keys((g && g.barriers) || {}).length} barrière(s) corrigée(s) · salle : ${g && Array.isArray(g.controlRooms) ? (g.controlRooms.length ? g.controlRooms.map(r => `${r.id} (${r.x}, ${r.z}), ${r.angle}°, ${r.w} x ${r.d} m`).join('') : 'aucune') : 'OSM ou SITE.booth (repli)'} · zone d'attente : ${g && g.boardAreas && g.boardAreas.length ? g.boardAreas.map(a => a.id + ', ' + a.pts.length + ' sommets').join('') : 'calcul auto'} · travées : ${g && g.board ? g.board.depth + ' m' : 'calcul auto'} · attraction (SITE) : ${g && g.site ? Object.keys(g.site).join(', ') : 'valeurs d\'origine'}`;
  async function showDiff() {
    if (!ready) return;
    const g = draft(), r = await api('/api/diff/' + site, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: g, trainMax: tMax() }) });
    $('mFile').textContent = 'sites/' + site + '.game.js'; $('modal').classList.add('on');
    $('mBefore').innerHTML = '<b>Avant</b><br>' + (orig.exists ? esc(summary(orig.game)) : 'fichier absent');
    $('mAfter').innerHTML = '<b>Après</b><br>' + esc(summary(g));
    if (!r.ok) { $('mMsg').innerHTML = '<span class="err">Refusé :<br>' + r.errors.map(esc).join('<br>') + '</span>'; $('diff').textContent = ''; $('bSave').disabled = true; return; }
    $('mMsg').innerHTML = (r.same ? 'Aucune différence avec le fichier.' : 'Lignes retirées en rouge, ajoutées en vert.') + (r.warnings.length ? '<br><span class="warn">' + r.warnings.map(esc).join('<br>') + '</span>' : '');
    $('diff').innerHTML = r.diff.map(l => `<div class="${l.t === '+' ? 'a' : l.t === '-' ? 'r' : 'c'}">${l.t} ${esc(l.s)}</div>`).join('');
    $('bSave').disabled = r.same;
  }
  async function save() {
    const r = await api('/api/game/' + site, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: draft(), trainMax: tMax() }) });
    if (!r.written) { $('mMsg').innerHTML = '<span class="err">Échec : ' + esc((r.errors || [r.error]).join(' ; ')) + '</span>'; return; }
    orig = r; $('mMsg').textContent = 'Enregistré : ' + r.written + '. Rien n\'est envoyé à Git : relire, puis committer soi-même.'; $('bSave').disabled = true;
    $('file').textContent = r.written + ' : présent'; window.ED.saved = (window.ED.saved || 0) + 1; status();
  }
  $('bDiff').onclick = showDiff; $('bSave').onclick = save; $('bCancel').onclick = () => $('modal').classList.remove('on');
  $('bReload').onclick = () => { if (!window.ED.dirty || confirm('Abandonner les modifications ?')) open(site); };
  $('bMig').onclick = () => { migrate(); sel = { t: 'room' }; panel(); };
  $('site').onchange = () => { if (window.ED.dirty && !confirm('Abandonner les modifications ?')) { $('site').value = site; return; } open($('site').value); };

  // Accès pour les tests (tools/editor-test.js) : rien de plus que ce que fait l'interface.
  window.ED = { ready: false, isReady: () => ready, E: s => E(s), toScr: (x, z) => { const f = fr.getBoundingClientRect(), p = toScr(x, z); return [f.left + p[0], f.top + p[1]]; }, gates: () => gates(), rooms: () => rooms(), area: () => areaPts(), areaEd: () => areaEd(), viaEnd: () => viaEnd(), snapPx: SNAP_PX, depth: () => dep(), draft: () => draft(), site: () => site, sel: () => sel, adding: () => adding };
  loadSites();
})();
