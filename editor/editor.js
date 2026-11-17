'use strict';
/* Éditeur T2Z — couche d'édition au-dessus du VRAI jeu (docs/ARCHITECTURE.md D4) : l'attraction est ouverte dans jeu.html (bac à sable, simulation figée) dans un
   cadre de même origine ; le moteur lit l'objet GAME (GM) que l'éditeur modifie en place, le rendu est donc celui du jeu. Barrières : GAME.barriers (surcharges par clé
   stable, D2) ; salle de contrôle : GAME.controlRooms (0 ou 1 salle, D3). Écriture : seulement par le serveur (editor/server.js), après diff et validation. */
(function () {
  const S = window.T2ZSchema, $ = id => document.getElementById(id), fr = $('fr'), ov = $('ov'), oc = ov.getContext('2d');
  let W = null, E = null, site = '', orig = { exists: false, text: '' }, sel = null, drag = null, ready = false, adding = null; // adding : nom du tronçon de la fourche où poser une barrière (clic du pivot)
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
    ready = false; sel = null; adding = null; site = id; $('site').value = id;
    history.replaceState(null, '', '?site=' + id);
    orig = await api('/api/game/' + id);
    $('file').textContent = 'sites/' + id + '.game.js : ' + (orig.exists ? (orig.error ? 'ILLISIBLE (' + orig.error + ')' : 'présent') : 'absent (créé à la première sauvegarde)');
    fr.src = '/jeu.html?site=' + id + '&mode=sandbox&editeur=' + Date.now();
  }
  fr.addEventListener('load', () => {
    W = fr.contentWindow; E = s => W.eval(s);
    const t0 = Date.now(), wait = () => {
      let ok = false; try { ok = E("typeof gateList==='function'&&typeof ctlRooms==='function'&&typeof cam==='object'"); } catch (e) { }
      if (!ok) { if (Date.now() - t0 < 20000) return setTimeout(wait, 60); $('valBox').innerHTML = '<span class="err">Le jeu ne s\'est pas chargé.</span>'; return; }
      const st = W.document.createElement('style'); // seulement la carte : pupitre, en-tête, journal masqués
      st.textContent = 'header,#side,#log,#tabs,#fsBar,#hint,#cams{display:none!important}#view{min-height:0!important}';
      W.document.head.appendChild(st); W.dispatchEvent(new W.Event('resize'));
      E("act('speed',0);synOn=false"); // simulation figée : seul le dessin tourne ; synoptique masqué (choix du joueur non modifié)
      hook(); ready = true; panel(); window.ED.ready = true;
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

  // ── données éditées ──
  function draft() { const g = JSON.parse(W.JSON.stringify(GM())); if (g.barriers && !Object.keys(g.barriers).length) delete g.barriers; return g; }
  function ovrOf(g) { // surcharge d'une barrière, créée depuis sa géométrie actuelle au premier changement
    const M = GM(); if (!M.barriers) M.barriers = {};
    if (!M.barriers[g.key] || M.barriers[g.key].off) { const p = q => ({ ang: R1(deg(Math.atan2(q[1] - g.h[1], q[0] - g.h[0]))), len: R2(Math.hypot(q[0] - g.h[0], q[1] - g.h[1])) }); M.barriers[g.key] = { x: R2(g.h[0]), z: R2(g.h[1]), a: p(g.a), b: p(g.b) }; }
    return M.barriers[g.key];
  }
  function migrate() { // salle déduite de SITE.booth (D3) : SITE reste inchangé, la salle passe dans GAME à la sauvegarde
    const M = GM(); if (Array.isArray(M.controlRooms)) return;
    const b = E('B0'); M.controlRooms = b ? [{ id: 'poste', x: R2(b.room.x), z: R2(b.room.z), angle: R1(b.room.angle), w: R2(b.room.w), d: R2(b.room.d), main: true }] : [];
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
  function createRoom() { migrate(); const M = GM(); if (M.controlRooms.length) return; const c = E('cam'); M.controlRooms.push({ id: 'poste', x: R2(c.x), z: R2(c.z), angle: 0, w: 3.75, d: 1.7, main: true }); sel = { t: 'room' }; panel(); }
  function deleteRoom() { migrate(); GM().controlRooms.length = 0; sel = null; panel(); }

  // ── sélection et poignées ──
  function hit(p) {
    const s = E('cam').s, tol = Math.max(.35, 9 / s);
    if (sel && sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); if (g) { if (Math.hypot(p[0] - g.g.a[0], p[1] - g.g.a[1]) < tol) return { t: 'gate', key: g.key, m: 'a' }; if (Math.hypot(p[0] - g.g.b[0], p[1] - g.g.b[1]) < tol) return { t: 'gate', key: g.key, m: 'b' }; } }
    if (sel && sel.t === 'room') { const r = rooms()[0]; if (r) { if (Math.hypot(p[0] - rotH(r)[0], p[1] - rotH(r)[1]) < tol) return { t: 'room', m: 'rot' }; for (let i = 0; i < 4; i++) { const q = roomPt(r, [CORNERS[i][0] * r.w / 2, CORNERS[i][1] * r.d / 2]); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < tol) return { t: 'room', m: 'c' + i }; } } }
    let best = null, bd = tol;
    for (const g of gates()) { if (g.off) continue; const d = Math.min(Math.hypot(p[0] - g.g.h[0], p[1] - g.g.h[1]) * .8, dSeg(p, g.g.h, g.g.a), dSeg(p, g.g.h, g.g.b)); if (d < bd) { bd = d; best = { t: 'gate', key: g.key, m: 'move' }; } }
    if (best) return best;
    const r = rooms()[0]; if (r) { const l = toLocal(r, p); if (Math.abs(l[0]) <= r.w / 2 + .2 && Math.abs(l[1]) <= r.d / 2 + .2) return { t: 'room', m: 'move' }; }
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
      sel = h.t === 'gate' ? { t: 'gate', key: h.key } : { t: 'room' };
      if (h.t === 'room' && !migrated()) migrate(); // première modification de la salle : reprise de SITE.booth
      const r = h.t === 'room' ? GM().controlRooms[0] : null;
      drag = Object.assign({ p0: p, id: e.pointerId, moved: false, r0: r && Object.assign({}, r) }, h);
      if (h.t === 'gate') { const o = (GM().barriers || {})[h.key]; drag.o0 = o ? JSON.parse(JSON.stringify(o)) : null; }
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
    const up = e => { if (!drag) return; e.stopImmediatePropagation(); e.preventDefault(); drag = null; panel(); };
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

  // ── panneau ──
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const inp = (k, v, st) => `<input data-k="${k}" type="number" step="${st || .05}" value="${v}">`;
  function selHTML() {
    if (!sel) return '<span class="note">Cliquer une barrière ou la salle de contrôle sur la carte. Glisser : déplacer ; poignées A / B : orienter et allonger ; poignées de la salle : redimensionner, rond : tourner. La carte se déplace et se zoome comme dans le jeu.</span>';
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
    const r = rooms()[0]; if (!r) return '<span class="note">Aucune salle.</span>';
    return `<div><b>Salle de contrôle</b> ${migrated() ? '' : '<span class="tag t-est">SITE.booth (repli)</span>'}</div>
      <div class="grid" style="margin-top:6px"><span>Centre x, z (m)</span><span>${inp('x', r.x)} ${inp('z', r.z)}</span><span>Angle (°)</span><span>${inp('angle', r.angle, 1)}</span>
      <span>Largeur, profondeur (m)</span><span>${inp('w', r.w)} ${inp('d', r.d)}</span></div><p class="note">La vitre (côté du rond) est tournée vers la voie.</p>`;
  }
  function panelLite() { $('selBox').innerHTML = selHTML(); bindSel(); status(); }
  function bindSel() {
    for (const el of $('selBox').querySelectorAll('input[data-k]')) el.addEventListener('change', () => {
      const v = +el.value, k = el.dataset.k; if (!isFinite(v)) return;
      if (sel.t === 'gate') { const g = gates().find(x => x.key === sel.key); const o = ovrOf(g.g); if (k.includes('.')) { const [s, f] = k.split('.'); o[s][f] = f === 'len' ? clamp(v, .2, 20) : v; } else o[k] = v; applied(); }
      else { migrate(); const r = GM().controlRooms[0]; r[k] = k === 'w' || k === 'd' ? clamp(v, .5, 40) : v; panel(); }
    });
    const b = $('bAuto'); if (b) b.onclick = () => revertGate(sel.key);
    const sf = $('selFork'); if (sf) sf.onchange = () => moveGate(sel.key, sf.value);
    const bd = $('bDelGate'); if (bd) bd.onclick = () => deleteGate(sel.key);
  }
  function panel() {
    if (!ready) return;
    $('secMig').hidden = migrated() || !E('!!B0');
    panelLite();
    const R = migrated() ? GM().controlRooms : null;
    $('roomBox').innerHTML = !R ? (E('!!B0') ? '<p class="note">Salle actuelle : <code>SITE.booth</code> (repli). La première modification la reprend dans <code>game.js</code>.</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>' : '<p class="note">Aucune salle.</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>')
      : R.length ? `<p class="note">Salle « ${esc(R[0].id)} » : ${R[0].w} x ${R[0].d} m. Une seule salle par attraction (pupitre).</p><div class="row"><button id="bSelRoom">Sélectionner</button><button id="bDelRoom" class="bad">Supprimer</button></div>`
        : '<p class="note">Aucune salle (ni pupitre dessiné, ni gyrophare).</p><div class="row"><button id="bNewRoom" class="go">Créer la salle de contrôle</button></div>';
    if ($('bNewRoom')) $('bNewRoom').onclick = createRoom;
    if ($('bDelRoom')) $('bDelRoom').onclick = deleteRoom;
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
    const d = draft(), v = S.validate(d), t = S.text(d), dirty = orig.exists ? t !== orig.text : Object.keys(d).length > 0;
    $('dirty').textContent = dirty ? 'modifications non enregistrées' : 'aucune modification'; $('dirty').classList.toggle('on', dirty);
    const orph = Object.keys(d.barriers || {}).filter(k => !new Set(gates().map(g => g.key)).has(k)).length;
    $('valBox').innerHTML = (v.errors.length ? '<div class="err">' + v.errors.map(esc).join('<br>') + '</div>' : '<div>Validation : correcte.</div>') + (v.warnings.length ? '<div class="warn">' + v.warnings.map(esc).join('<br>') + '</div>' : '')
      + `<div>${Object.keys(d.barriers || {}).length} surcharge(s) de barrière (corrigées, ajoutées, supprimées)${orph ? ', dont ' + orph + ' orpheline(s)' : ''} ; salle : ${Array.isArray(d.controlRooms) ? d.controlRooms.length : 'SITE.booth (repli)'}.</div>`;
    window.ED.dirty = dirty;
  }

  // ── diff et sauvegarde ──
  const summary = g => `${Object.keys((g && g.barriers) || {}).length} barrière(s) corrigée(s) · salle : ${g && Array.isArray(g.controlRooms) ? (g.controlRooms.length ? g.controlRooms.map(r => `${r.id} (${r.x}, ${r.z}), ${r.angle}°, ${r.w} x ${r.d} m`).join('') : 'aucune') : 'SITE.booth (repli)'}`;
  async function showDiff() {
    if (!ready) return;
    const g = draft(), r = await api('/api/diff/' + site, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: g }) });
    $('mFile').textContent = 'sites/' + site + '.game.js'; $('modal').classList.add('on');
    $('mBefore').innerHTML = '<b>Avant</b><br>' + (orig.exists ? esc(summary(orig.game)) : 'fichier absent');
    $('mAfter').innerHTML = '<b>Après</b><br>' + esc(summary(g));
    if (!r.ok) { $('mMsg').innerHTML = '<span class="err">Refusé :<br>' + r.errors.map(esc).join('<br>') + '</span>'; $('diff').textContent = ''; $('bSave').disabled = true; return; }
    $('mMsg').innerHTML = (r.same ? 'Aucune différence avec le fichier.' : 'Lignes retirées en rouge, ajoutées en vert.') + (r.warnings.length ? '<br><span class="warn">' + r.warnings.map(esc).join('<br>') + '</span>' : '');
    $('diff').innerHTML = r.diff.map(l => `<div class="${l.t === '+' ? 'a' : l.t === '-' ? 'r' : 'c'}">${l.t} ${esc(l.s)}</div>`).join('');
    $('bSave').disabled = r.same;
  }
  async function save() {
    const r = await api('/api/game/' + site, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: draft() }) });
    if (!r.written) { $('mMsg').innerHTML = '<span class="err">Échec : ' + esc((r.errors || [r.error]).join(' ; ')) + '</span>'; return; }
    orig = r; $('mMsg').textContent = 'Enregistré : ' + r.written + '. Rien n\'est envoyé à Git : relire, puis committer soi-même.'; $('bSave').disabled = true;
    $('file').textContent = r.written + ' : présent'; window.ED.saved = (window.ED.saved || 0) + 1; status();
  }
  $('bDiff').onclick = showDiff; $('bSave').onclick = save; $('bCancel').onclick = () => $('modal').classList.remove('on');
  $('bReload').onclick = () => { if (!window.ED.dirty || confirm('Abandonner les modifications ?')) open(site); };
  $('bMig').onclick = () => { migrate(); sel = { t: 'room' }; panel(); };
  $('site').onchange = () => { if (window.ED.dirty && !confirm('Abandonner les modifications ?')) { $('site').value = site; return; } open($('site').value); };

  // Accès pour les tests (tools/editor-test.js) : rien de plus que ce que fait l'interface.
  window.ED = { ready: false, E: s => E(s), toScr: (x, z) => { const f = fr.getBoundingClientRect(), p = toScr(x, z); return [f.left + p[0], f.top + p[1]]; }, gates: () => gates(), rooms: () => rooms(), draft: () => draft(), site: () => site, sel: () => sel, adding: () => adding };
  loadSites();
})();
