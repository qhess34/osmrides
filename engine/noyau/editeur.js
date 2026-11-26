'use strict';
/* Sections de l'éditeur communes à tous les types (docs/ARCHITECTURE.md D9, D14, osmrides#53) : « Exploitation » (GAME.site : objectif, postes de maintenance, caméras ; chaque
   réglage garde la valeur de SITE tant qu'on n'y touche pas, bouton « Origine ») et « Lieu » (horaires d'ouverture : lieux/<type>/<lieu>/lieu.js, commun à toutes les attractions du lieu).
   Chargé par editor/editor.js (GET /api/couches) ; X = outils de l'éditeur. */
(function () {
  let X = null; const S = window.T2ZSchema, $ = id => document.getElementById(id), E = s => X.E(s), esc = s => X.esc(s), NL = () => S.NL;
  const fr = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const SB = () => E('SITE_BASE'), cur = p => X.pth(X.GM().site || {}, p), base = p => X.pth(SB(), p), eff = (p, d) => { const v = cur(p); return v !== undefined ? v : base(p) !== undefined ? base(p) : d; };
  const fld = (p, label, ctl, orig, extra) => { const mod = cur(p) !== undefined; return `<div class="fld${mod ? ' mod' : ''}"><span>${label}</span>${ctl}<span class="orig">origine : ${esc(orig)}</span><button data-rev="${p.join('.')}" ${mod ? '' : 'disabled'} title="Revenir à la valeur d'origine">Origine</button>${extra || ''}</div>`; };
  const num = (p, v, st, min, max) => `<input data-n="${p.join('.')}" type="number" step="${st}" ${min != null ? `min="${min}" max="${max}" ` : ''}value="${v}">`;
  // objets de SITE modifiés par morceaux : jobsites (paire x, z), caméra {label, x, z, s} ; chaque pas écrit la valeur entière (tableau) ou le champ
  function exploitationHTML() {
    const h = [], goal = eff(['goal'], 400), T = E('({open:T_OPEN,close:T_CLOSE})');
    h.push('<h3>Objectif</h3>', fld(['goal'], 'Passagers par plage d\'ouverture', num(['goal'], goal, 10, NL().goal[0], NL().goal[1]), base(['goal']) !== undefined ? base(['goal']) : '400 (défaut du moteur)'),
      `<p class="note">Sert au bilan (« excellente exploitation » au-delà de l'objectif par heure sur la plage ${Math.floor(T.open / 60)} h à ${Math.floor(T.close / 60)} h ; les horaires se règlent dans la section « Lieu »). Bornes ${NL().goal[0]} à ${NL().goal[1]} (ESTIMÉES).</p>`);
    h.push('<h3>Postes de maintenance</h3>');
    let jobs = []; try { jobs = E('Object.keys(JOBS)'); } catch (e) { }
    if (!jobs.length) h.push('<p class="note">Aucun travail de maintenance déclaré par ce type d\'attraction.</p>');
    for (const j of jobs) {
      const v = eff(['jobsites', j], null), lab = (() => { try { return E('JOBS.' + j + '.label'); } catch (e) { return j; } })();
      h.push(fld(['jobsites', j], esc(lab), ['0', '1'].map(i => `<input data-arr="jobsites.${j}" data-i="${i}" type="number" step="0.5" value="${v ? v[i] : ''}" style="width:70px">`).join(' ') + ` <button data-pick="jobsites.${j}">Poser au clic</button>`, base(['jobsites', j]) ? base(['jobsites', j]).join(', ') : 'aucun'));
    }
    h.push('<p class="note">Position où les techniciens se tiennent pendant le travail (carte, m). « Poser au clic » : cliquer ensuite sur la carte.</p>');
    h.push('<h3>Caméras</h3>');
    const C = E('Object.entries(CAMS).filter(([k])=>k!=="vue")'), c0 = base(['cams']) || {};
    for (const [k, c] of C) {
      const mod = cur(['cams', k]) !== undefined, o = c0[k], mk = (f, st) => `<input data-cam="${k}.${f}" type="number" step="${st}" value="${Math.round(c[f] * 100) / 100}" style="width:62px">`;
      h.push(`<div class="fld${mod ? ' mod' : ''}"><span>${esc(k)}</span><input data-cam="${k}.label" type="text" maxlength="${NL().label}" value="${esc(c.label || '')}" style="width:100%"><span>x ${mk('x', 1)} z ${mk('z', 1)} échelle ${mk('s', .5)}</span><span class="orig">origine : ${o ? esc(o.label) + ' (' + o.x + ', ' + o.z + ', ' + o.s + ')' : 'ajoutée dans l\'éditeur'}</span><button data-camtake="${k}" title="Prend la position et le zoom actuels de la carte">Cadrage courant</button><button data-camrev="${k}" ${mod ? '' : 'disabled'}>${o ? 'Origine' : 'Supprimer'}</button></div>`);
    }
    h.push(`<div class="row"><button id="bCamAdd" ${C.length >= NL().cams ? 'disabled' : ''}>Ajouter une caméra (cadrage courant)</button></div><p class="note">« Cadrage courant » : prend la position et le zoom actuels de la carte (déplacer et zoomer la carte d'abord). Une caméra venant de SITE ne se supprime pas : seul son cadrage revient à l'origine.</p>`);
    return h.join('');
  }
  function bindExploitation() {
    const B = $('explBox');
    for (const el of B.querySelectorAll('[data-n]')) el.addEventListener('change', () => { const v = Math.round(+el.value); if (!isFinite(v)) return; X.setSite(el.dataset.n.split('.'), v); });
    for (const el of B.querySelectorAll('[data-arr]')) el.addEventListener('change', () => { // tableau de nombres (poste de maintenance) : écrit en entier
      const p = el.dataset.arr.split('.'), n = 2, ins = [...B.querySelectorAll(`[data-arr="${el.dataset.arr}"]`)], v = ins.map(i => i.value === '' ? NaN : +i.value);
      if (v.some(x => !isFinite(x))) return; X.setSite(p, v.map(X.R2)); });
    for (const el of B.querySelectorAll('[data-pick]')) el.onclick = () => { el.textContent = 'Cliquer la carte…'; X.pick(q => X.setSite(el.dataset.pick.split('.'), q)); };
    for (const el of B.querySelectorAll('[data-rev]')) el.onclick = () => X.siteChange(s => X.delSite(s, el.dataset.rev.split('.')));
    const camSet = (k, patch) => X.siteChange(s => { if (!s.cams) s.cams = {}; const c = Object.assign({}, E('CAMS.' + k), s.cams[k], patch); s.cams[k] = { label: c.label || k, x: X.R2(c.x), z: X.R2(c.z), s: X.R2(c.s) }; const o = (base(['cams']) || {})[k]; if (o && X.same(o, s.cams[k])) delete s.cams[k]; });
    for (const el of B.querySelectorAll('[data-cam]')) el.addEventListener('change', () => { const [k, f] = el.dataset.cam.split('.'); if (f === 'label') { const v = el.value.trim(); if (v) camSet(k, { label: v }); return; } const v = +el.value; if (!isFinite(v)) return; camSet(k, { [f]: f === 's' ? Math.max(NL().camS[0], Math.min(NL().camS[1], v)) : v }); });
    const take = () => { const c = E('cam'); return { x: c.x, z: c.z, s: c.s }; };
    for (const el of B.querySelectorAll('[data-camtake]')) el.onclick = () => camSet(el.dataset.camtake, take());
    for (const el of B.querySelectorAll('[data-camrev]')) el.onclick = () => X.siteChange(s => { if (s.cams) delete s.cams[el.dataset.camrev]; });
    const ba = $('bCamAdd'); if (ba) ba.onclick = () => { const t = take(); let i = 1; const ex = E('Object.keys(CAMS)'); while (ex.includes('cam' + i)) i++; const k = 'cam' + i; X.siteChange(s => { if (!s.cams) s.cams = {}; s.cams[k] = { label: 'Caméra ' + i, x: X.R2(t.x), z: X.R2(t.z), s: X.R2(Math.max(NL().camS[0], Math.min(NL().camS[1], t.s))) }; }); };
  }
  T2ZEditeur.section({ id: 'secExpl', titre: 'Exploitation', avant: 'secLook', box: 'explBox',
    panel(x) { X = x; try { $('explBox').innerHTML = exploitationHTML(); bindExploitation(); } catch (e) { $('explBox').innerHTML = '<p class="err">Section « Exploitation » illisible : ' + String(e.message).replace(/</g, '&lt;') + '</p>'; console.error(e); } },
    contexte(x) { X = x; const c = {}; try { c.jobs = E('Object.keys(JOBS)'); } catch (e) { } return c; } });

  // ── Lieu : horaires d'ouverture, communs à toutes les attractions du lieu (lieux/<type>/<lieu>/lieu.js) ──
  let lieu = null, lieuSite = '', msg = '';
  const hm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
  const lieuId = () => X.site().split('/').slice(0, 2).join('/');
  async function loadLieu() { const id = lieuId(); if (lieuSite === id && lieu) return; lieuSite = id; lieu = null; try { lieu = await X.api('/api/lieu/' + id); } catch (e) { lieu = { error: 'lecture impossible' }; } msg = ''; render(); }
  function render() {
    const B = $('lieuBox'); if (!B) return; const id = lieuId(), H = (lieu && lieu.lieu && lieu.lieu.hours) || null, d = E('({open:T_OPEN,close:T_CLOSE})'), t = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const open = H ? H.open : t(d.open), close = H ? H.close : t(d.close), ok = hm(close) - hm(open) >= S.LIEU_MIN;
    B.innerHTML = `<p class="note warn">Ce réglage vaut pour <b>tout le lieu « ${esc(id)} »</b> : toutes ses attractions ouvrent et ferment aux mêmes heures. Il s'écrit dans <code>lieux/${esc(id)}/lieu.js</code>, pas dans le <code>game.js</code> de l'attraction : « Enregistrer » ci-dessous est distinct du bouton Enregistrer du haut.</p>
      <div class="fld${H ? ' mod' : ''}"><span>Ouverture</span><input id="hOpen" type="time" value="${open}"><span>Fermeture</span><input id="hClose" type="time" value="${close}"><span class="orig">origine : 10:00 à 19:00 (défaut du moteur)</span></div>
      <p class="note${ok ? '' : ' err'}">${ok ? 'L\'horloge du jeu tourne de l\'ouverture à la fermeture puis repart à l\'ouverture ; elle règle aussi les salaires, la courbe d\'affluence et le bilan.' : 'Ouverture de ' + (S.LIEU_MIN / 60) + ' h au moins (ESTIMÉ).'} ${lieu && lieu.error ? '<span class="err">' + esc(lieu.error) + '</span>' : ''}</p>
      <div class="row"><button id="bLieuSave" class="go" ${ok ? '' : 'disabled'}>Enregistrer les horaires du lieu</button><button id="bLieuRev" ${H ? '' : 'disabled'}>Origine (retirer le réglage)</button></div><p class="note" id="lieuMsg">${esc(msg)}</p>`;
    const chg = () => { const o = $('hOpen').value, c = $('hClose').value; lieu = Object.assign({}, lieu, { lieu: { hours: { open: o, close: c } } }); const okk = hm(c) - hm(o) >= S.LIEU_MIN; $('bLieuSave').disabled = !okk; };
    $('hOpen').onchange = $('hClose').onchange = chg;
    $('bLieuSave').onclick = () => save({ hours: { open: $('hOpen').value, close: $('hClose').value } });
    $('bLieuRev').onclick = () => save({});
  }
  async function save(L) {
    const id = lieuId(); try {
      const r = await fetch('/api/lieu/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lieu: L }) }).then(x => x.json());
      if (r.errors) { msg = 'Refusé : ' + r.errors.join(' ; '); render(); return; }
      lieu = r; msg = 'Enregistré : ' + r.written + ' (toutes les attractions du lieu). Recharger le jeu pour voir les nouveaux horaires.'; render(); X.reloadPreview();
    } catch (e) { msg = 'Écriture impossible : ' + e.message; render(); }
  }
  T2ZEditeur.section({ id: 'secLieu', titre: 'Lieu', avant: 'secLook', box: 'lieuBox', panel(x) { X = x; if (lieuSite !== lieuId()) loadLieu(); else render(); } });
})();
