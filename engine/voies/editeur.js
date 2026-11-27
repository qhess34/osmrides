'use strict';
/* Section de l'éditeur propre aux voies : rails mobiles (osmrides#64, #69 ; format : docs/ref/editeur.md « Rails mobiles », règles : docs/manoeuvres.md « Positions des rails mobiles »).
   Une seule mécanique pour le pont transbordeur, le rail unique et l'aiguillage coulissant : des GROUPES de rails (1 rail indépendant, ou N rails verrouillés ensemble, déplacés d'un bloc) et, pour chaque
   groupe, ses positions (une position = la distance de chacun de ses rails). Tout se règle sur la carte, sans valeur à saisir : clic sur un rail = fenêtre modale commune
   de l'éditeur (editor/editor.js) ; autres rails choisis sur la carte (ou Maj + clic) = « Verrouiller ces rails ensemble », « Défaire le groupe » ; glisser un rail = le déplacer (aimant sur
   le circuit et les voies) ; clic sur une position dessinée = la renommer (nom proposé), la redéplacer (glisser aimanté) ou la supprimer.
   Écrit GAME.site.yard.rails = {groups: [{rails, pos: [{name, d: {<rail>: m}}]}]} ; l'ancien format par rail (0.8.0) est lu. Le moteur en déduit les positions et le chariot
   (engine/voies/garage.js, railsEd()). Chargé par editor/editor.js (GET /api/couches) ; X = outils de l'éditeur. */
(function () {
  let X = null, keep = null, cache = null, cacheT = 0, ghost = null, drag0 = null, lastHit = null, snapL = null, pick = false, moveI = -1;
  const $ = id => document.getElementById(id), esc = s => X.esc(s), R2 = v => Math.round(v * 100) / 100;
  // description du moteur (relue au plus toutes les 0,3 s ; null si l'attraction n'a pas de rail mobile réglable)
  function RD() { const t = Date.now(); if (!cache || t - cacheT > 300) { try { cache = X.E('typeof railsEd==="function"?railsEd():null'); } catch (e) { cache = null; } cacheT = t; } return cache; }
  const reset = () => { cache = null; ghost = null; drag0 = null; snapL = null; moveI = -1; };
  const S0 = () => { const s = X.getSel(); return s && s.t === 'rails' ? s : null; };
  const selId = () => { const s = S0(); if (!s) return null; if (!s.id && lastHit) s.id = lastHit.id; return s.id || null; };
  const railOf = (R, id) => R.rails.find(r => r.id === id);
  // qui bouge : le chariot (rails portés, décalage c) ou un rail seul (escamotable, distance d)
  const mover = (R, r) => r.car ? 'car' : 'ra';
  const curPlace = (R, r) => ghost && ghost.k === mover(R, r) ? ghost.v : r.car ? R.c : r.d;
  const dOf = (r, place) => r.car ? -(place + r.vo) : place; // distance du rail au circuit pour un placement du chariot (c) ou du rail seul (d)
  const W = (R, u, v) => { const F = R.frame; return [F.x + F.tx * u + F.vx * v, F.z + F.tz * u + F.vz * v]; };
  const dAll = (R, ids, place) => Object.fromEntries(ids.map(id => [id, R2(dOf(railOf(R, id), place))]));
  // ── données : groupes de rails verrouillés ensemble et leurs positions ──
  // GAME.site.yard.rails (format à groupes ; ancien format par rail converti), sinon positions effectives du moteur (même comportement à la première modification)
  function groups(R) {
    const g = X.GM().site && X.GM().site.yard && X.GM().site.yard.rails;
    if (g && Array.isArray(g.groups)) return JSON.parse(JSON.stringify(g.groups));
    const ids = k => R.rails.filter(r => mover(R, r) === k).map(r => r.id), out = [], used = new Set();
    if (g) for (const id of Object.keys(g)) { const h = railOf(R, id); if (!h || !g[id] || !Array.isArray(g[id].pos)) continue; // 0.8.0 : rail porteur + rail verrouillé = un bloc
      const I = ids(mover(R, h)); if (I.some(x => used.has(x))) continue; I.forEach(x => used.add(x));
      out.push({ rails: I, pos: g[id].pos.map(q => ({ name: q.name, d: dAll(R, I, h.car ? -q.d - h.vo : q.d) })) }); }
    if (out.length) return out;
    if (R.car && ids('car').length) out.push({ rails: ids('car'), pos: R.car.map(q => ({ name: q.name, d: dAll(R, ids('car'), q.c) })) });
    if (R.ra) out.push({ rails: ids('ra'), pos: R.ra.map(q => ({ name: q.name, d: dAll(R, ids('ra'), q.d) })) });
    return out;
  }
  const grpOf = (D, id) => D.find(g => g.rails.includes(id));
  const placeOf = (R, G, q) => { const r = railOf(R, G.rails[0]); return r.car ? -q.d[r.id] - r.vo : q.d[r.id]; };
  // positions du groupe du rail id : {name, place, conn}
  function positions(R, id) { const D = groups(R), G = grpOf(D, id); if (!G) return []; const k = mover(R, railOf(R, id));
    return G.pos.map(q => { const place = placeOf(R, G, q); return { name: q.name, place, conn: connOf(R, k, place) }; }); }
  // en face de quoi est ce placement : axe d'un rail du bloc (circuit, voie k) ou rien
  function connOf(R, k, place) {
    for (const r of R.rails) { if (mover(R, r) !== k) continue; const d = dOf(r, place); for (const a of r.axes) if (Math.abs(d - a.d) < R.tol) return a.label; }
    return null;
  }
  // aimant : placement le plus proche qui met un rail du bloc en face d'un axe, à moins de 11 px écran
  function snapPlace(R, k, place) {
    const s = X.E('cam').s, tol = 11 / s; let best = null, bd = tol;
    for (const r of R.rails) { if (mover(R, r) !== k) continue; for (const a of r.axes) { const p = r.car ? -a.d - r.vo : a.d, e = Math.abs(p - place); if (e < bd) { bd = e; best = { p, label: a.label, r }; } } }
    return best;
  }
  // noms proposés (aucune saisie) : ce qui est en face, puis des noms génériques ; jamais un nom déjà pris par une autre position du groupe
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  function names(R, id, i, place) { const P = positions(R, id), taken = new Set(P.filter((_, j) => j !== i).map(q => q.name)), c = connOf(R, mover(R, railOf(R, id)), place);
    const L = [c ? cap(c) : null, 'Position ' + ((i < 0 ? P.length : i) + 1), 'Retiré', 'Hors service', 'Entretien', 'Attente'];
    return [...new Set(L.filter(n => n && !taken.has(n)))]; }
  function write(D, s) { keep = { sel: s || Object.assign({}, S0()), open: X.modalOn() }; X.siteChange(o => { if (!o.yard) o.yard = {}; o.yard.rails = { groups: D }; }); reset(); }
  function revert() { keep = { sel: S0() && { t: 'rails', id: selId() }, open: X.modalOn() }; X.siteChange(s => { if (s.yard) delete s.yard.rails; }); reset(); }
  function addPos(R, id) {
    const D = groups(R), G = grpOf(D, id), place = curPlace(R, railOf(R, id)); if (!G) return false;
    if (G.pos.length >= ((X.S.SL && X.S.SL.rails) ? X.S.SL.rails.n[1] : 12)) return false;
    G.pos.push({ name: names(R, id, -1, place)[0], d: dAll(R, G.rails, place) }); write(D, { t: 'rails', id, pos: G.pos.length - 1 }); return true;
  }
  function savePos(R, id, i, place) { const D = groups(R), G = grpOf(D, id), q = G && G.pos[i]; if (!q) return false; q.d = dAll(R, G.rails, place); write(D, { t: 'rails', id, pos: i }); return true; }
  function delPos(R, id, i) { const D = groups(R), G = grpOf(D, id); if (!G || G.pos.length <= 1 || !G.pos[i]) return false; G.pos.splice(i, 1); write(D, { t: 'rails', id }); return true; }
  function namePos(R, id, i, nm) { nm = String(nm || '').trim().slice(0, 40).replace(/[<>"\\\u0000-\u001f]/g, ''); const D = groups(R), G = grpOf(D, id), P = G && G.pos;
    if (!nm || !P || !P[i] || P.some((q, j) => j !== i && q.name === nm)) return false; P[i].name = nm; write(D, { t: 'rails', id, pos: i }); return true; }
  /* Groupes (osmrides#69) : un groupe = des rails verrouillés ensemble, de 1 (rail indépendant) à N ; même modèle et même moteur dans tous les cas.
     Former un groupe (merge) : les rails choisis se déplacent d'un bloc ; leurs écarts sont ceux de l'appareil (rails portés : d = -(c + vo)) ; positions = celles des
     groupes réunis (le plus fourni d'abord), ramenées à tout le bloc, sans doublon de placement ni de nom. Défaire un groupe (split) : chaque rail redevient indépendant et
     garde les placements où il est en face de quelque chose (circuit, voie), au moins deux. Fonctions pures (R : rails {id, vo, axes}, tol ; D : groupes). */
  function mergeG(R, D, ids) {
    const Gs = D.filter(g => g.rails.some(id => ids.includes(id))); if (Gs.length < 2) return null;
    const rails = R.rails.map(r => r.id).filter(id => Gs.some(g => g.rails.includes(id))), out = [], n1 = (X && X.S && X.S.SL && X.S.SL.rails) ? X.S.SL.rails.n[1] : 12;
    for (const g of Gs.slice().sort((a, b) => b.pos.length - a.pos.length)) for (const q of g.pos) {
      const a = railOf(R, g.rails[0]), d = {}; for (const id of rails) d[id] = R2(q.d[a.id] + a.vo - railOf(R, id).vo);
      if (out.some(o => Math.abs(o.d[rails[0]] - d[rails[0]]) < R.tol)) continue;
      let nm = q.name, k = 2; while (out.some(o => o.name === nm)) nm = q.name + ' (' + k++ + ')'; out.push({ name: nm, d }); }
    return D.filter(g => !Gs.includes(g)).concat([{ rails, pos: out.slice(0, n1) }]);
  }
  function splitG(R, D, id) {
    const G = D.find(g => g.rails.includes(id)); if (!G || G.rails.length < 2) return null; const out = D.filter(g => g !== G);
    for (const rid of G.rails) { const r = railOf(R, rid), P = [];
      for (const q of G.pos) { const d = q.d[rid]; if (P.some(o => Math.abs(o.d[rid] - d) < R.tol) || P.some(o => o.name === q.name)) continue; P.push({ name: q.name, d: { [rid]: d }, c: r.axes.some(a => Math.abs(d - a.d) < R.tol) }); }
      let K = P.filter(o => o.c); if (K.length < 2) K = K.concat(P.filter(o => !o.c).slice(0, 2 - K.length));
      out.push({ rails: [rid], pos: K.map(o => ({ name: o.name, d: o.d })) }); }
    return out;
  }
  // regrouper les rails choisis / défaire le groupe d'un rail, si l'appareil le permet (R.lockable : pont à deux rails, aiguillage coulissant ; sinon R.lockWhy, bouton grisé)
  function lockIds(R, ids) { if (!R.lockable) return false; const N = mergeG(R, groups(R), ids); if (!N) return false; write(N, { t: 'rails', id: ids[0] }); return true; }
  function unlock(R, id) { if (!R.lockable) return false; const N = splitG(R, groups(R), id); if (!N) return false; write(N, { t: 'rails', id }); return true; }
  // ── carte ──
  function strip(oc, P, R, r, place, sty) { // tracé du rail au placement donné
    const s = X.E('cam').s, d = dOf(r, place), L = r.pts.map(q => P(...W(R, q[0], q[1] - d)));
    oc.lineCap = 'butt'; oc.setLineDash(sty.dash || []); oc.strokeStyle = sty.col; oc.lineWidth = Math.max(3, 1.1 * s) * (sty.w || 1); oc.globalAlpha = sty.a || 1;
    oc.beginPath(); L.forEach((q, i) => i ? oc.lineTo(q[0], q[1]) : oc.moveTo(q[0], q[1])); oc.stroke(); oc.globalAlpha = 1; oc.setLineDash([]); return L;
  }
  function tag(oc, q, t, col) { oc.font = '600 11px system-ui'; oc.lineWidth = 3; oc.strokeStyle = '#0b1120'; oc.strokeText(t, q[0] + 8, q[1] - 6); oc.fillStyle = col; oc.fillText(t, q[0] + 8, q[1] - 6); }
  const mid = L => L[Math.floor(L.length / 2)];
  function near(R, r, d, p, w) { // point p (m) à moins de w du rail r placé à la distance d
    for (let i = 1; i < r.pts.length; i++) { const a = W(R, r.pts[i - 1][0], r.pts[i - 1][1] - d), b = W(R, r.pts[i][0], r.pts[i][1] - d), vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l2));
      if (Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t) < w) return true; }
    return false;
  }
  const selIds = R => { const s = S0(); if (!s || !railOf(R, s.id)) return []; if (s.ids) return s.ids; const k = mover(R, railOf(R, s.id)); return R.rails.filter(r => mover(R, r) === k).map(r => r.id); };
  // ── fenêtre modale (actions seulement) ──
  function modalHTML(R) {
    const s = S0(), r = s && railOf(R, s.id); if (!r) return '';
    const D = groups(R), G = grpOf(D, r.id), k = mover(R, r), nm = ids => ids.map(id => esc(railOf(R, id).name)).join(' + ');
    const out = ids => R.rails.some(q => !ids.includes(q.id));
    if (s.ids && s.ids.length > 1 && !s.ids.every(id => G.rails.includes(id))) // rails choisis sur la carte dans plusieurs groupes : les verrouiller ensemble
      return `<div><b>${nm(s.ids)}</b></div><p class="note">${s.ids.length} rails choisis ; ils ne bougent pas tous ensemble aujourd'hui. Verrouillés, ils se déplacent d'un bloc et chaque position vaut pour tous ces rails.</p>
        <div class="row"><button id="bRLockOn" class="go">Verrouiller ces rails ensemble</button>${out(s.ids) ? '<button id="bRPick">Ajouter un autre rail (sur la carte)</button>' : ''}<button id="bRBack">Annuler</button></div>`;
    const P = positions(R, r.id), i = s.pos != null && s.pos < P.length ? s.pos : -1;
    if (i >= 0) { const q = P[i], N = names(R, r.id, i, q.place); if (!N.includes(q.name)) N.unshift(q.name);
      return `<div><b>Position « ${esc(q.name)} »</b> <span class="tag">${nm(G.rails)}</span></div><p class="note">${q.conn ? 'En face : ' + esc(q.conn) + '.' : 'Non connectée : le train ne peut ni y entrer ni en sortir.'} Glisser la position (tirets) sur la carte pour la redéplacer : elle s'aimante sur le circuit et les voies.</p>
        <div class="note"><b>Nom</b></div><div class="row" role="group" aria-label="Nom de la position">${N.map(n => `<button data-rnm="${esc(n)}" aria-pressed="${n === q.name}">${esc(n)}</button>`).join('')}</div>
        <div class="row"><label class="note">Autre nom <input id="rName" type="text" maxlength="40" style="width:140px" value=""></label><button id="bRName">Renommer</button></div>
        <div class="row"><button id="bRMove" class="go">Redéplacer sur la carte</button><button id="bRDel" class="bad" ${P.length > 1 ? '' : 'disabled'}>Supprimer la position</button><button id="bRBack">Retour aux rails</button></div>`; }
    const c = connOf(R, k, curPlace(R, r)), lk = G.rails.length > 1;
    return `<div><b>${nm(G.rails)}</b> ${R.rec ? '<span class="tag t-ovr">positions réglées</span>' : '<span class="tag t-est">positions d\'origine</span>'}</div>
      <p class="note">${lk ? 'Verrouillés ensemble : ils se déplacent d\'un bloc ; chaque position vaut pour ' + (G.rails.length === 2 ? 'les deux rails' : 'les ' + G.rails.length + ' rails') + '.' : 'Bouge seul.'} Glisser le rail sur la carte (aimant sur le circuit et les voies). Placement actuel : ${c ? 'en face de ' + esc(c) : 'non connecté'}.</p>
      <div class="row"><button id="bRAdd" class="go">Ajouter une position ici</button></div>
      <div class="note"><b>Positions</b> (cliquer pour modifier, ou cliquer la position sur la carte)</div><div class="row">${P.map((q, j) => `<button data-rpos="${j}">${esc(q.name)} <span class="note">${q.conn ? esc(q.conn) : 'non connectée'}</span></button>`).join('')}</div>
      <div class="row">${lk ? '<button id="bRLockOff"' + (R.lockable ? '' : ' disabled title="' + esc(R.lockWhy || 'impossible sur cet appareil') + '"') + '>Défaire le groupe (rails indépendants)</button>' : ''}${R.lockable && out(G.rails) ? '<button id="bRPick">Ajouter un rail au groupe (sur la carte)</button>' : ''}<button id="bRRev" ${R.rec ? '' : 'disabled'} title="Revenir aux positions d'origine">Origine</button></div>`;
  }
  function modalBind(R) {
    const s = S0(), r = s && railOf(R, s.id); if (!r) return; const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('bRLockOn', () => lockIds(R, s.ids));
    on('bRLockOff', () => unlock(R, r.id));
    on('bRBack', () => { X.setSel({ t: 'rails', id: r.id }); ghost = null; X.openSel(); });
    on('bRAdd', () => addPos(R, r.id));
    on('bRRev', revert);
    on('bRPick', () => { pick = true; X.closeSel(); X.panel(); });
    for (const el of $('selBox').querySelectorAll('[data-rpos]')) el.onclick = () => { const i = +el.dataset.rpos; X.setSel({ t: 'rails', id: r.id, pos: i }); X.openSel(); };
    if (s.pos == null) return;
    for (const el of $('selBox').querySelectorAll('[data-rnm]')) el.onclick = () => namePos(R, r.id, s.pos, el.dataset.rnm);
    on('bRName', () => namePos(R, r.id, s.pos, $('rName').value));
    on('bRDel', () => delPos(R, r.id, s.pos));
    on('bRMove', () => { moveI = s.pos; ghost = { k: mover(R, r), v: positions(R, r.id)[s.pos].place }; X.closeSel(); X.panel(); });
  }
  T2ZEditeur.section({ id: 'rails', titre: 'Rails mobiles', avant: 'secLook', box: 'railsBox',
    hit(p, tol, x) { X = x; const R = RD(); if (!R) return; const w = Math.max(tol, .8), s = S0(), r0 = s && railOf(R, s.id), k = r0 && mover(R, r0), P = r0 ? positions(R, r0.id) : [];
      const onPos = i => P[i] && R.rails.some(r => mover(R, r) === k && near(R, r, dOf(r, P[i].place), p, w * .8)) ? (lastHit = { p, id: r0.id }, { t: 'rails', id: r0.id, pos: i, m: 'pos' }) : null;
      if (s && s.pos != null && onPos(s.pos)) return onPos(s.pos); // position choisie : prioritaire (glisser = la redéplacer)
      for (const r of R.rails) if (near(R, r, dOf(r, curPlace(R, r)), p, w)) { lastHit = { p, id: r.id }; return { t: 'rails', id: r.id, m: r.id }; }
      for (let i = 0; i < P.length; i++) if (onPos(i)) return onPos(i); }, // positions dessinées du bloc choisi
    drag(p, x) { X = x; const R = RD(); if (!R) return; const s = S0(), r = s && railOf(R, s.id); if (!r) return;
      const k = mover(R, r);
      if (!drag0) { if (s.pos != null) { moveI = s.pos; ghost = { k, v: positions(R, r.id)[s.pos].place }; } drag0 = { p0: lastHit ? lastHit.p : p, v0: curPlace(R, r) }; }
      const dv = (p[0] - drag0.p0[0]) * R.frame.vx + (p[1] - drag0.p0[1]) * R.frame.vz; let v = k === 'car' ? drag0.v0 + dv : drag0.v0 - dv; // glisser le long du coulissement
      const sn = snapPlace(R, k, v); snapL = sn; if (sn) v = sn.p; ghost = { k, v: R2(v) }; },
    end(d, x) { X = x; drag0 = null; const R = RD(), s = S0(); if (!R || !s || moveI < 0 || !ghost) return; const i = moveI; moveI = -1; savePos(R, s.id, i, ghost.v); }, // position redéplacée : enregistrée au lâcher
    tap(d, x, e, prev) { X = x; drag0 = null; const R = RD(); if (!R) return; const was = pick; pick = false; moveI = -1;
      if (d.pos != null) return; // position cliquée : fenêtre de la position
      if ((was || (e && e.shiftKey)) && prev && prev.t === 'rails' && prev.id && R.lockable) { // rail de plus choisi sur la carte (sélection multiple)
        const D = groups(R), ids = [...new Set((prev.ids || grpOf(D, prev.id).rails).concat(grpOf(D, d.id).rails))];
        X.setSel({ t: 'rails', id: prev.id, ids: ids.every(id => grpOf(D, prev.id).rails.includes(id)) ? undefined : ids }); } },
    draw(P, oc, x) { X = x; const R = RD(); if (!R) return; const s = S0(), sr = s && railOf(R, s.id), on = new Set(sr ? selIds(R) : []);
      for (const r of R.rails) { const o = on.has(r.id); strip(oc, P, R, r, curPlace(R, r), { col: o ? '#f2c14e' : '#d08a3a', a: o ? .75 : .45, w: o ? 1 : .8 }); } // rails à leur place (contour orange), rails choisis : clair
      const k = sr && mover(R, sr);
      for (const kk of ['car', 'ra']) { const r0 = R.rails.find(r => mover(R, r) === kk); if (!r0) continue; const mine = kk === k && !(s && s.ids && s.ids.length > 1);
        positions(R, r0.id).forEach((q, i) => { // positions : toutes pour le bloc choisi (cliquables), sinon seulement celles sans voie en face (tag « non connecté »)
          if (!mine && q.conn) return; const cur = mine && s.pos === i; let L = null;
          for (const r of R.rails) if (mover(R, r) === kk) L = strip(oc, P, R, r, q.place, { col: cur ? '#f2c14e' : '#c9ced8', dash: [5, 4], a: cur ? .95 : .7, w: .35 });
          if (L) tag(oc, mine ? L[0] : mid(L), (q.conn ? '' : 'non connecté : ') + q.name, cur ? '#f2c14e' : q.conn ? '#c9ced8' : '#e8b0a0'); }); }
      if (sr) { const L = strip(oc, P, R, sr, curPlace(R, sr), { col: '#fff', w: .25 }), c = connOf(R, k, curPlace(R, sr));
        if (snapL) { const q = mid(L); oc.strokeStyle = '#fff'; oc.lineWidth = 2; oc.beginPath(); oc.arc(q[0], q[1], 11, 0, 7); oc.stroke(); }
        tag(oc, L[L.length - 1], sr.name + (c ? ' — en face : ' + c : ' — non connecté'), c ? '#f2c14e' : '#e8b0a0'); }
      if (pick && sr) tag(oc, mid(strip(oc, P, R, sr, curPlace(R, sr), { col: '#fff', w: .15 })), 'Cliquer un autre rail', '#fff'); },
    selHTML(x) { X = x; const R = RD(); return R ? modalHTML(R) : ''; },
    selBind(x) { X = x; const R = RD(); if (R) modalBind(R); },
    panel(x) { X = x; const B = $('railsBox'); if (!B) return; drag0 = null; cache = null; const R = RD();
      if (R && keep && !X.getSel()) { const k = keep; keep = null; if (k.sel && railOf(R, k.sel.id)) { X.setSel(k.sel); if (k.open) X.openSel(); } } keep = null;
      if (!R) { B.innerHTML = '<p class="note">Aucun rail mobile réglable sur cette attraction (pont transbordeur ou aiguillage coulissant).</p>'; return; }
      const sid = selId(), on = new Set(sid ? selIds(R) : []);
      B.innerHTML = `<p class="note">Cliquer un rail mobile sur la carte (contour orange) : ses positions et actions s'ouvrent dans une fenêtre. Rails verrouillés ensemble (un groupe, de 1 à N rails) : ils se déplacent d'un bloc et chaque position vaut pour tout le groupe ; pour former un groupe, choisir les autres rails sur la carte (ou Maj + clic) ; un rail seul garde ses propres positions. Le chariot est dessiné pour couvrir toutes les positions.</p>${pick ? '<p class="note warn">Cliquer un autre rail sur la carte…</p>' : ''}${moveI >= 0 ? '<p class="note warn">Glisser le rail sur la carte : la position est enregistrée au lâcher.</p>' : ''}<div class="row">`
        + R.rails.map(q => `<button data-rsel="${q.id}"${on.has(q.id) ? ' class="go"' : ''}>${esc(q.name)}</button>`).join('') + `<button id="bRRev2" ${R.rec ? '' : 'disabled'} title="Revenir aux positions d'origine">Origine</button></div>`;
      for (const el of B.querySelectorAll('[data-rsel]')) el.onclick = () => { const q = railOf(R, el.dataset.rsel), m = q.pts[Math.floor(q.pts.length / 2)]; X.setSel({ t: 'rails', id: q.id }); ghost = null; pick = false; moveI = -1; X.focus(...W(R, m[0], m[1] - q.d)); X.panel(); X.openSel(); };
      $('bRRev2').onclick = revert;
    },
    ed(x) { X = x; const cur = () => { const R = RD(); return [R, selId()]; };
      return { rails: { info: () => RD(), groups: () => groups(RD()), sel: id => { X.setSel({ t: 'rails', id }); X.panel(); }, ghost: () => ghost, pick: () => pick,
        setGhost: v => { const [R, id] = cur(); ghost = { k: mover(R, railOf(R, id)), v }; X.panel(); },
        add: () => { const [R, id] = cur(); return addPos(R, id); }, save: i => { const [R, id] = cur(); return savePos(R, id, i, curPlace(R, railOf(R, id))); }, del: i => { const [R, id] = cur(); return delPos(R, id, i); },
        name: (i, n) => { const [R, id] = cur(); return namePos(R, id, i, n); }, revert: () => revert(),
        lock: on => { const R = RD(); return on ? lockIds(R, R.rails.map(r => r.id)) : unlock(R, selId() || R.master); }, merge: ids => lockIds(RD(), ids), split: id => unlock(RD(), id),
        _merge: (R, D, ids) => mergeG(R, D, ids), _split: (R, D, id) => splitG(R, D, id),
        conn: () => { const [R, id] = cur(); return connOf(R, mover(R, railOf(R, id)), curPlace(R, railOf(R, id))); } } }; } });
})();
