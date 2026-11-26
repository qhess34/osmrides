'use strict';
/* Section de l'éditeur propre aux voies : rails mobiles (osmrides#64, docs/ref/editeur.md « Rails mobiles », règles : docs/manoeuvres.md « Positions des rails mobiles »).
   Tout se règle sur la carte, sans valeur à saisir : clic sur un rail mobile (pont transbordeur, rail unique, aiguillage) pour le choisir, glisser pour le déplacer
   (aimant sur le circuit et les voies), « Ajouter une position ici » / « Enregistrer ici », nom de chaque position, verrouillage de deux rails (chariot commun).
   Écrit GAME.site.yard.rails ({circuit|garage: {pos:[{name, d}]} | {lock}}) ; le moteur en déduit les positions et le chariot (engine/voies/garage.js, railsEd()).
   Chargé par editor/editor.js (GET /api/couches) ; X = outils de l'éditeur. */
(function () {
  let X = null, keep = null, cache = null, cacheT = 0, ghost = null, drag0 = null, lastHit = null, snapL = null, msel = -1;
  const $ = id => document.getElementById(id), esc = s => X.esc(s), R2 = v => Math.round(v * 100) / 100;
  // description du moteur (relue au plus toutes les 0,3 s ; null si l'attraction n'a pas de rail mobile réglable)
  function RD() { const t = Date.now(); if (!cache || t - cacheT > 300) { try { cache = X.E('typeof railsEd==="function"?railsEd():null'); } catch (e) { cache = null; } cacheT = t; } return cache; }
  const reset = () => { cache = null; ghost = null; drag0 = null; snapL = null; };
  const selId = () => { const s = X.getSel(); if (!s || s.t !== 'rails') return null; if (!s.id && lastHit) s.id = lastHit.id; return s.id || null; }; // l'éditeur sélectionne {t:'rails'} : rail retenu au dernier clic
  const railOf = (R, id) => R.rails.find(r => r.id === id);
  // qui bouge : le chariot (rails portés, décalage c) ou le rail du circuit indépendant (escamotable, distance d)
  const mover = (R, r) => r.car ? 'car' : 'ra';
  const curPlace = (R, r) => ghost && ghost.k === mover(R, r) ? ghost.v : r.car ? R.c : r.d;
  const dOf = (r, place) => r.car ? -(place + r.vo) : place; // distance du rail au circuit pour un placement du chariot (c) ou du rail seul (d)
  const W = (R, u, v) => { const F = R.frame; return [F.x + F.tx * u + F.vx * v, F.z + F.tz * u + F.vz * v]; };
  // positions enregistrées (ou effectives) du rail qui bouge : {name, place, conn}
  function positions(R, r) { // dans l'ordre des données écrites (reprises du moteur si rien n'est encore réglé)
    const k = mover(R, r), D = railsData(R), id = holder(R, D, k), h = railOf(R, id);
    return D[id].pos.map(q => { const place = h.car ? -q.d - h.vo : q.d; return { name: q.name, place, conn: connOf(R, k, place) }; });
  }
  // en face de quoi est ce placement : axe d'un rail porté (circuit, voie k) ou rien
  function connOf(R, k, place) {
    for (const r of R.rails) { if (mover(R, r) !== k) continue; const d = dOf(r, place); for (const a of r.axes) if (Math.abs(d - a.d) < R.tol) return a.label; }
    return null;
  }
  // aimant : placement le plus proche qui met un rail en face d'un axe, à moins de 11 px écran
  function snapPlace(R, k, place) {
    const s = X.E('cam').s, tol = 11 / s; let best = null, bd = tol;
    for (const r of R.rails) { if (mover(R, r) !== k) continue; for (const a of r.axes) { const p = r.car ? -a.d - r.vo : a.d, e = Math.abs(p - place); if (e < bd) { bd = e; best = { p, label: a.label, r }; } } }
    return best;
  }
  // données à écrire : GAME.site.yard.rails, reprises du moteur à la première modification (même comportement)
  function railsData(R) {
    const g = X.GM().site && X.GM().site.yard && X.GM().site.yard.rails; if (g) return JSON.parse(JSON.stringify(g));
    const o = {}, m = railOf(R, R.master);
    o[R.master] = { pos: R.car.map(q => ({ name: q.name, d: R2(-(q.c + m.vo)) })) };
    for (const r of R.rails) if (r.id !== R.master) o[r.id] = r.car ? { lock: R.master } : { pos: R.ra.map(q => ({ name: q.name, d: q.d })) };
    return o;
  }
  // rail qui porte la liste de positions du mouvement k, et conversion placement → d de ce rail
  const holder = (R, D, k) => { if (k === 'ra') return 'circuit'; const ids = Object.keys(D).filter(id => D[id].pos && railOf(R, id) && railOf(R, id).car); return ids[0] || R.master; };
  const toD = (R, id, place) => R2(dOf(railOf(R, id), place));
  function write(D) { keep = selId(); X.siteChange(s => { if (!s.yard) s.yard = {}; s.yard.rails = D; }); reset(); }
  function revert() { X.siteChange(s => { if (s.yard) delete s.yard.rails; }); reset(); }
  function addPos(R, r) {
    const k = mover(R, r), D = railsData(R), id = holder(R, D, k), P = D[id].pos, place = curPlace(R, r);
    if (P.length >= ((X.S.SL && X.S.SL.rails) ? X.S.SL.rails.n[1] : 12)) return false;
    let n = P.length + 1; while (P.some(q => q.name === 'Position ' + n)) n++;
    P.push({ name: 'Position ' + n, d: toD(R, id, place) }); msel = P.length - 1; write(D); return true;
  }
  function savePos(R, r, i) { const k = mover(R, r), D = railsData(R), id = holder(R, D, k), q = D[id].pos[i]; if (!q) return false; q.d = toD(R, id, curPlace(R, r)); write(D); return true; }
  function delPos(R, r, i) { const k = mover(R, r), D = railsData(R), id = holder(R, D, k), P = D[id].pos; if (P.length <= 1 || !P[i]) return false; P.splice(i, 1); msel = -1; write(D); return true; }
  function namePos(R, r, i, nm) { nm = String(nm || '').trim().slice(0, 40).replace(/[<>"\\\u0000-\u001f]/g, ''); const k = mover(R, r), D = railsData(R), id = holder(R, D, k), P = D[id].pos;
    if (!nm || !P[i] || P.some((q, j) => j !== i && q.name === nm)) return false; P[i].name = nm; write(D); return true; }
  // verrouillage (pont à deux rails) : verrouillés = un seul chariot porte les deux rails ; déverrouillés = rail du circuit escamotable (deux positions, retiré : ESTIMÉ à l'écart des rails)
  function setLock(R, on) {
    if (!R.lockable || on === R.locked) return false;
    const D = railsData(R), g = railOf(R, 'garage'), gap = -g.vo;
    if (on) { const P = (D.garage.pos || []).filter(q => Math.abs(q.d - gap) >= R.tol); P.unshift({ name: 'P', d: R2(gap) }); D.garage = { pos: P }; D.circuit = { lock: 'garage' }; }
    else { const B = D.garage.pos ? D.garage.pos : D.circuit.pos.map(q => ({ name: q.name, d: R2(q.d + gap) }));
      D.garage = { pos: B.filter(q => Math.abs(q.d - gap) >= R.tol) }; if (!D.garage.pos.length) D.garage.pos = [{ name: 'G', d: 0 }];
      D.circuit = { pos: [{ name: 'Sur le circuit', d: 0 }, { name: 'Retiré', d: R2(-gap) }] }; }
    write(D); return true;
  }
  // ── carte ──
  function strip(oc, P, R, r, place, sty) { // tracé du rail au placement donné
    const s = X.E('cam').s, d = dOf(r, place), L = r.pts.map(q => P(...W(R, q[0], q[1] - d)));
    oc.lineCap = 'butt'; oc.setLineDash(sty.dash || []); oc.strokeStyle = sty.col; oc.lineWidth = Math.max(3, 1.1 * s) * (sty.w || 1); oc.globalAlpha = sty.a || 1;
    oc.beginPath(); L.forEach((q, i) => i ? oc.lineTo(q[0], q[1]) : oc.moveTo(q[0], q[1])); oc.stroke(); oc.globalAlpha = 1; oc.setLineDash([]); return L;
  }
  function tag(oc, q, t, col) { oc.font = '600 11px system-ui'; oc.lineWidth = 3; oc.strokeStyle = '#0b1120'; oc.strokeText(t, q[0] + 8, q[1] - 6); oc.fillStyle = col; oc.fillText(t, q[0] + 8, q[1] - 6); }
  const mid = L => L[Math.floor(L.length / 2)];
  T2ZEditeur.section({ id: 'rails', titre: 'Rails mobiles', avant: 'secLook', box: 'railsBox',
    hit(p, tol, x) { X = x; const R = RD(); if (!R) return;
      for (const r of R.rails) { const d = dOf(r, curPlace(R, r)), w = Math.max(tol, .8);
        for (let i = 1; i < r.pts.length; i++) { const a = W(R, r.pts[i - 1][0], r.pts[i - 1][1] - d), b = W(R, r.pts[i][0], r.pts[i][1] - d), vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l2));
          if (Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t) < w) { lastHit = { p, id: r.id }; return { t: 'rails', id: r.id, m: r.id }; } } } },
    drag(p, x) { X = x; const R = RD(); if (!R) return; const id = selId() || (lastHit && lastHit.id), r = id && railOf(R, id); if (!r) return; X.setSel({ t: 'rails', id });
      const k = mover(R, r);
      if (!drag0) drag0 = { p0: lastHit ? lastHit.p : p, v0: curPlace(R, r) };
      const dv = (p[0] - drag0.p0[0]) * R.frame.vx + (p[1] - drag0.p0[1]) * R.frame.vz; let v = k === 'car' ? drag0.v0 + dv : drag0.v0 - dv; // glisser le long du coulissement
      const sn = snapPlace(R, k, v); snapL = sn; if (sn) v = sn.p; ghost = { k, v: R2(v) }; },
    draw(P, oc, x) { X = x; const R = RD(); if (!R) return; const sid = selId(), sr = sid && railOf(R, sid), k = sr && mover(R, sr);
      for (const r of R.rails) { // chaque rail mobile à sa place actuelle (contour orange) ; rail choisi et ceux qui bougent avec lui : trait plein clair
        const on = sr && mover(R, r) === k; strip(oc, P, R, r, curPlace(R, r), { col: on ? '#f2c14e' : '#d08a3a', a: on ? .75 : .45, w: on ? 1 : .8 }); }
      // positions sans voie en face : tag « non connecté » (le train ne peut ni entrer ni sortir)
      for (const kk of ['car', 'ra']) { const r0 = R.rails.find(r => mover(R, r) === kk); if (!r0) continue;
        for (const q of positions(R, r0)) { if (q.conn) continue; let L = null;
          for (const r of R.rails) if (mover(R, r) === kk) L = strip(oc, P, R, r, q.place, { col: '#c9ced8', dash: [5, 4], a: .7, w: .35 });
          if (L) tag(oc, mid(L), 'non connecté : ' + q.name, '#e8b0a0'); } }
      if (sr) { const L = strip(oc, P, R, sr, curPlace(R, sr), { col: '#fff', w: .25 }), c = connOf(R, k, curPlace(R, sr));
        if (snapL) { const q = mid(L); oc.strokeStyle = '#fff'; oc.lineWidth = 2; oc.beginPath(); oc.arc(q[0], q[1], 11, 0, 7); oc.stroke(); }
        tag(oc, L[L.length - 1], sr.name + (c ? ' — en face : ' + c : ' — non connecté'), c ? '#f2c14e' : '#e8b0a0'); } },
    selHTML(x) { X = x; const R = RD(), r = R && railOf(R, selId()); if (!r) return '';
      const c = connOf(R, mover(R, r), curPlace(R, r));
      return `<div><b>${esc(r.name)}</b> ${R.rec ? '<span class="tag t-ovr">positions réglées</span>' : '<span class="tag t-est">positions d\'origine</span>'}</div><div class="note">Glisser le rail sur la carte (aimant sur le circuit et les voies), puis « Ajouter une position ici » ou « Enregistrer ici » dans la section « Rails mobiles ». Placement : ${c ? 'en face de ' + esc(c) : 'non connecté'}.</div>`; },
    panel(x) { X = x; const B = $('railsBox'); if (!B) return; drag0 = null; cache = null; const R = RD();
      if (R && keep && !X.getSel()) X.setSel({ t: 'rails', id: keep }); keep = null;
      if (!R) { B.innerHTML = '<p class="note">Aucun rail mobile réglable sur cette attraction (pont transbordeur ou aiguillage coulissant).</p>'; return; }
      const sid = selId(), r = sid && railOf(R, sid), h = [];
      h.push('<p class="note">Cliquer un rail mobile sur la carte (contour orange) pour le choisir, ou ci-dessous. Chaque position se règle en glissant le rail : il s\'aimante sur le circuit et les voies. Une position sans voie en face est marquée « non connecté » sur la carte : le train ne peut ni y entrer ni en sortir. Le chariot est dessiné pour couvrir toutes les positions.</p><div class="row">');
      for (const q of R.rails) h.push(`<button data-rsel="${q.id}"${q.id === sid ? ' class="go"' : ''}>${esc(q.name)}</button>`);
      h.push('</div>');
      if (r) {
        const k = mover(R, r), others = R.rails.filter(q => q !== r && mover(R, q) === k), P = positions(R, r), cur = curPlace(R, r), c = connOf(R, k, cur);
        h.push(`<div class="note" style="margin-top:6px"><b>${esc(r.name)}</b> : ${others.length ? 'verrouillé avec ' + others.map(q => esc(q.name)).join(', ') + ' (ils bougent ensemble)' : 'bouge seul'}.</div>`);
        if (R.lockable) h.push(`<div class="row"><button id="bRLock">${R.locked ? 'Déverrouiller les deux rails' : 'Verrouiller avec ' + esc(R.rails.find(q => q !== r).name)}</button></div>`);
        else if (R.device === 'switch') h.push('<p class="note">Aiguillage en S : le rail du circuit et le tronçon en S sont toujours verrouillés ensemble, sans position intermédiaire.</p>');
        h.push('<div class="note" style="margin-top:6px"><b>Positions</b></div>');
        P.forEach((q, i) => h.push(`<div class="fld${i === msel ? ' mod' : ''}"><input data-rname="${i}" type="text" maxlength="40" value="${esc(q.name)}" style="width:110px"><span class="tag ${q.conn ? 't-est' : 't-ovr'}">${q.conn ? 'en face : ' + esc(q.conn) : 'non connecté'}</span><button data-rgo="${i}" title="Montrer le rail à cette position">Voir</button><button data-rsave="${i}" title="Enregistrer le placement actuel du rail pour cette position">Enregistrer ici</button><button data-rdel="${i}" ${P.length > 1 ? '' : 'disabled'}>Supprimer</button></div>`));
        h.push(`<p class="note">Placement actuel : ${c ? 'en face de ' + esc(c) : 'non connecté'}.</p><div class="row"><button id="bRAdd" class="go">Ajouter une position ici</button><button id="bRRev" ${R.rec ? '' : 'disabled'} title="Revenir aux positions d'origine">Origine</button></div>`);
      }
      B.innerHTML = h.join('');
      for (const el of B.querySelectorAll('[data-rsel]')) el.onclick = () => { const q = railOf(R, el.dataset.rsel), m = q.pts[Math.floor(q.pts.length / 2)]; X.setSel({ t: 'rails', id: q.id }); ghost = null; msel = -1; X.focus(...W(R, m[0], m[1] - q.d)); X.panel(); };
      if (!r) return;
      const P = positions(R, r);
      for (const el of B.querySelectorAll('[data-rgo]')) el.onclick = () => { const i = +el.dataset.rgo; ghost = { k: mover(R, r), v: P[i].place }; msel = i; X.panel(); };
      for (const el of B.querySelectorAll('[data-rsave]')) el.onclick = () => savePos(R, r, +el.dataset.rsave);
      for (const el of B.querySelectorAll('[data-rdel]')) el.onclick = () => delPos(R, r, +el.dataset.rdel);
      for (const el of B.querySelectorAll('[data-rname]')) el.onchange = () => { if (!namePos(R, r, +el.dataset.rname, el.value)) X.panel(); };
      $('bRAdd').onclick = () => addPos(R, r); $('bRRev').onclick = revert;
      const bl = $('bRLock'); if (bl) bl.onclick = () => setLock(R, !R.locked);
    },
    ed(x) { X = x; return { rails: { info: () => RD(), sel: id => { X.setSel({ t: 'rails', id }); X.panel(); }, ghost: () => ghost, setGhost: v => { const R = RD(), r = railOf(R, selId()); ghost = { k: mover(R, r), v }; X.panel(); },
      add: () => { const R = RD(); return addPos(R, railOf(R, selId())); }, save: i => { const R = RD(); return savePos(R, railOf(R, selId()), i); }, del: i => { const R = RD(); return delPos(R, railOf(R, selId()), i); },
      name: (i, n) => { const R = RD(); return namePos(R, railOf(R, selId()), i, n); }, lock: on => setLock(RD(), on), revert: () => revert(), conn: () => { const R = RD(), r = railOf(R, selId()); return connOf(R, mover(R, r), curPlace(R, r)); } } }; } });
})();
