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
    const p = f.p, key = p.join('.'), ov = pth(GM().site || {}, p), base = f.base !== undefined ? f.base : pth(SB(), p), mod = ov !== undefined; // f.base : origine qui n'est pas au même chemin dans SITE (décalage d'une voie)
    let eff = mod ? ov : base !== undefined ? base : f.d; if (f.p[1] === 'restraint') eff = ov !== undefined ? ov : base !== undefined ? base : effRestraint();
    const o = base !== undefined ? base : f.orig != null ? f.orig : (f.d != null ? f.d + ' (défaut du moteur)' : f.p[1] === 'restraint' ? 'défaut du type' : '');
    let ctl;
    if (f.t === 'enum' || f.t === 'enumn') ctl = `<select data-p="${key}" data-t="${f.t}">${f.o.map(([v, n]) => `<option value="${v}"${String(v) === String(eff) ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    else if (f.t === 'bool') ctl = `<input data-p="${key}" data-t="bool" type="checkbox"${eff ? ' checked' : ''}>`;
    else if (f.t === 'text') ctl = `<input data-p="${key}" data-t="txt" type="text" maxlength="${S.SL.txt}" value="${esc(eff == null ? '' : eff)}" style="width:100%">`;
    else { const L = f.lim ? { min: f.lim[0], max: f.lim[1] } : lim(p); ctl = `<input data-p="${key}" data-t="${f.t}" type="number" step="${f.st || 1}"${f.zero ? ' data-zero="1"' : ''}${f.base !== undefined ? ` data-base="${f.base}"` : ''}${L.min != null ? ` min="${L.min}" max="${L.max}"` : ''} value="${eff}">`;
      if (f.snap) ctl += `<select data-snap="${key}" title="Aimanter sur la position d'un autre élément"><option value="">Aimanter sur…</option>${f.snap.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select>`; }
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
    h.push(fieldHTML({ p: ['maxRun'], l: 'Trains en circulation en même temps (les autres restent au garage)', t: 'int', d: null, lim: S.SL.maxRun, orig: 'tous les trains' }, kind), '<p class="note">Sans effet sans garage. La durée d\'un tour n\'est plus un réglage : le moteur la mesure en jeu (attente affichée au pupitre).</p>');
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
  // pont transbordeur droit : la voie qui bouge (rail mobile, chariot) et ses positions successives P, G, voie 1…n (osmrides#53 lot 3) ; GAME.site.yard.post / laneGap / retract.d / laneD.<n>
  // Aimantation : pas de 0,1 m et liste « Aimanter sur… » (rail A ou B au repos, autres voies). Pas d'équivalent OSM : aucun envoi. Bornes ESTIMÉES (schema.js).
  function bridgeHTML(kind, Y) {
    const h = ['<h3>Pont transbordeur : voie qui bouge et positions</h3>'], SL = S.SL, gap = E('GAP'), nl = E('LANES.length'), dEff = E('LANES.map(l=>l.d)');
    const f = [{ p: ['yard', 'post'], l: 'Rail du chariot au-delà du train (m)', t: 'num', st: .1, d: .6, lim: SL.yard.post }, { p: ['yard', 'laneGap'], l: 'Jeu entre le rail et le début des voies (m)', t: 'num', st: .1, d: .8, lim: SL.yard.laneGap }];
    if (Y.retract) f.push({ p: ['yard', 'retract', 'd'], l: 'Course du rail mobile (m)', t: 'num', st: .1, d: gap, lim: SL.yard.ret, snap: [[gap, 'écart des deux rails (' + fx(gap) + ' m)']], orig: Y.retract.d != null ? Y.retract.d + ' (SITE, ESTIMÉE)' : fx(gap) + ' (écart des rails)' });
    for (let j = 0; j < nl; j++) {
      const sn = [[0, 'rail du circuit au repos (0 m)']]; if (!E('SG')) sn.push([gap, 'rail de garage au repos (' + fx(gap) + ' m)']);
      for (let k = 0; k < nl; k++) if (k !== j) sn.push([dEff[k], 'voie ' + (k + 1) + ' (' + fx(dEff[k]) + ' m)']);
      f.push({ p: ['yard', 'laneD', String(j + 1)], l: 'Voie ' + (j + 1) + ' (' + esc(E('LANES[' + j + '].name')) + ') : décalage (m)', t: 'num', st: .1, d: Y.lanes[j].d, base: Y.lanes[j].d, lim: SL.yard.d, snap: sn });
    }
    h.push(...f.map(x => fieldHTML(x, kind)));
    const pos = E('POS_ORDER.map(p=>posId(p)+" : "+OFF[p])').map(t => t.replace(/ : (-?[\d.]+)$/, (m, v) => ' : ' + fx(+v) + ' m')).join(' ; ');
    const sorted = dEff.slice().sort((a, b) => a - b), close = sorted.some((d, i) => i && d - sorted[i - 1] < 1.5);
    h.push(`<p class="note">Positions du chariot (décalage le long de la voie qui bouge) : ${esc(pos)}. Un décalage de voie est la position de son axe par rapport au rail du circuit au repos ; le chariot s'y arrête face à la voie. Pas de 0,1 m ; « Aimanter sur… » colle la valeur à un rail ou à une autre voie. Pas d'équivalent OSM : ces réglages ne sont pas envoyés. Bornes : rail et jeu 0 à 5 m, course 0,5 à 10 m, décalage ±40 m (ESTIMÉES).</p>`);
    if (close) h.push('<p class="note warn">Deux voies à moins de 1,5 m l\'une de l\'autre (ESTIMÉ) : les trains garés se chevauchent à l\'écran.</p>');
    return h;
  }
  function extraHTML(kind) {
    const h = [], SL = S.SL, ded = (() => { try { return E('DEDUIT'); } catch (e) { return {}; } })(), ev = k => { try { return E('SITE.' + k); } catch (e) { return undefined; } };
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
    if (ev('yard') && ev('yard').device === 'traverser') h.push(...bridgeHTML(kind, ev('yard')));
    // valeurs déduites réglables : holdBack, loadSide (dropAfter : déduit du profil, plus de champ) (SITE ne les donne plus ; l'éditeur ne sert qu'à corriger un cas particulier)
    const dl = `${ded.loadSide === 1 ? 'côté +R de la voie' : ded.loadSide === -1 ? 'côté -R de la voie' : 'indécis'}`;
    h.push('<h3>Valeurs déduites (corriger un cas particulier)</h3>', ...[
      { p: ['holdBack'], l: 'Arrêt au frein final : distance à la fin du circuit (m)', t: 'num', st: .5, d: (E('L - S_HOLD') != null ? Math.round(E('L - S_HOLD') * 10) / 10 : null), lim: SL.holdBack, orig: `déduit : fin du frein final lue dans OSM (${fx(ded.holdBack)} m)` },
      { p: ['loadSide'], l: 'Côté du quai d\'embarquement', t: 'enumn', o: [['1', 'côté +R de la voie'], ['-1', 'côté -R de la voie']], d: E('LS'), orig: `déduit : côté où arrive la file (${dl})` }].map(f => fieldHTML(f, kind)),
      '<p class="note">Déduits par le moteur, avec priorité GAME > SITE > déduction. Mettre une valeur ici seulement pour un cas particulier. </p>');
    return h;
  }
  function bindSite() {
    const B = $('siteBox');
    for (const el of B.querySelectorAll('[data-p]')) el.addEventListener('change', () => {
      const p = el.dataset.p.split('.'), t = el.dataset.t; let v = el.value;
      if (t === 'bool') v = el.checked; else if (t === 'enumn') v = +v;
      else if (t === 'num' || t === 'int') { if (v === '' || !isFinite(+v)) return; v = +v; if (el.dataset.zero && v <= 0) v = ''; } else if (t === 'rgb') v = hexRgb(v);
      if (el.dataset.base !== undefined && v === +el.dataset.base) return siteChange(s => delSite(s, p)); // origine propre au champ (décalage d'une voie)
      setSite(p, v);
    });
    for (const el of B.querySelectorAll('[data-snap]')) el.addEventListener('change', () => { // aimantation : recopie la valeur choisie dans le champ
      if (el.value === '') return; const inp = B.querySelector('input[data-p="' + el.dataset.snap + '"]'); if (!inp) return;
      inp.value = String(Math.round(+el.value * 100) / 100); inp.dispatchEvent(new Event('change')); });
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
    contexte(x) { X = x; const c = { trainMax: tMax() }; try { c.depthMax = E('boardDepth().max'); c.blocs = E('BLK.length'); c.lanes = E('LANES.length'); } catch (e) { } return c; } }); // validation : nombre de trains au plus, borne des travées (selon le quai), freins de bloc
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
  // ── Hauteurs du circuit (GAME.profile, osmrides#53 lot 2) : graphique s / hauteur, points déplaçables, repères du circuit ; le moteur (engine/voies/trace.js, PROF) applique ──
  let pf = null, psel = -1, pdrag = null;
  const fr1 = v => String(Math.round(v * 10) / 10).replace('.', ','), PL = () => S.PROF, pEd = () => Array.isArray(GM().profile), pts = () => (GM().profile || []).map(q => q.slice());
  function pfLoad() { pf = JSON.parse(E('JSON.stringify({L0:PROF.L0,on:PROF.on,tag:PROF.tag0,tun:PROF.tun0,inv:PROF.inv0,fix:PROF.fix,s0:PROF.s0,h0:PROF.h0,faisa:faisabilite(),cur:Array.from({length:Math.ceil(PROF.L0/2)+1},(_,i)=>+PROF.h(Math.min(i*2,PROF.L0-1e-6)).toFixed(2))})')); }
  const inFixP = s => pf.fix.some(f => s >= f[0] - .01 && s <= f[1] + .01), curAt = s => { const f = Math.max(0, Math.min(pf.cur.length - 1, s / 2)), a = Math.floor(f); return pf.cur[a] + ((pf.cur[Math.min(a + 1, pf.cur.length - 1)] - pf.cur[a]) * (f - a)); };
  function rdp(P, eps) { // simplification de la courbe d'origine (Douglas-Peucker) pour le premier profil
    const keep = new Array(P.length).fill(false); keep[0] = keep[P.length - 1] = true; const st = [[0, P.length - 1]];
    while (st.length) { const [a, b] = st.pop(); let m = -1, d = eps; for (let i = a + 1; i < b; i++) { const t = (P[i][0] - P[a][0]) / ((P[b][0] - P[a][0]) || 1), e = Math.abs(P[i][1] - (P[a][1] + (P[b][1] - P[a][1]) * t)); if (e > d) { d = e; m = i; } } if (m > 0) { keep[m] = true; st.push([a, m], [m, b]); } }
    return P.filter((_, i) => keep[i]); }
  function pSample() { // points de départ : courbe d'origine simplifiée (écart de 0,4 m, plus large si trop de points), sans les zones figées
    const P0 = pf.s0.map((s, i) => [s, pf.h0[i]]); let eps = .4, R; do { R = rdp(P0, eps).filter(q => !inFixP(q[0])); eps *= 1.4; } while (R.length > PL().n[1] - 6);
    const o = []; for (const q of R) { const s = Math.round(q[0] * 10) / 10, h = Math.round(q[1] * 100) / 100; if (!o.length || s - o[o.length - 1][0] >= PL().gap + .2) o.push([s, Math.max(PL().h[0], Math.min(PL().h[1], h))]); }
    // affinage : la courbe lisse du moteur (profilLisse) ne suit pas les segments droits de la simplification ; ajoute le point d'origine le plus écarté jusqu'à 0,5 m d'écart
    try { const lisse = E('profilLisse'); for (let k = 0; k < 40 && o.length < PL().n[1] - 6; k++) { const f = lisse(o.map(q => q.slice()), pf.L0); let w = -1, d = .5;
        P0.forEach((q, i) => { if (inFixP(q[0]) || o.some(p => Math.abs(p[0] - q[0]) < PL().gap + .2)) return; const e = Math.abs(f(q[0]) - q[1]); if (e > d) { d = e; w = i; } });
        if (w < 0) break; o.push([Math.round(P0[w][0] * 10) / 10, Math.round(P0[w][1] * 100) / 100]); o.sort((a, b) => a[0] - b[0]); } } catch (e) { }
    return o; }
  function pCommit(P, keepSel) { P.sort((a, b) => a[0] - b[0]); X.setUndo(JSON.stringify(draft())); GM().profile = P.map(q => q.length > 2 && q[2] === 'lin' ? [R2(q[0]), R2(q[1]), 'lin'] : [R2(q[0]), R2(q[1])]); if (!keepSel) psel = -1; reloadPreview(); }
  const pInit = () => { pfLoad(); pCommit(pSample()); };
  const pReset = () => { if (!pEd()) return; X.setUndo(JSON.stringify(draft())); delete GM().profile; psel = -1; reloadPreview(); };
  function pAdd(s) { if (!pEd() || !pf) return false; s = Math.round(s * 10) / 10; const P = pts(); if (s < 0 || s > pf.L0 || inFixP(s) || P.some(q => Math.abs(q[0] - s) < PL().gap) || P.length >= PL().n[1]) return false;
    P.push([s, Math.round(curAt(s) * 100) / 100]); P.sort((a, b) => a[0] - b[0]); psel = P.findIndex(q => q[0] === s); pCommit(P, true); return true; }
  function pSet(i, s, h, lin) { const P = pts(); if (!P[i]) return false; const a = i ? P[i - 1][0] + PL().gap : 0, b = i < P.length - 1 ? P[i + 1][0] - PL().gap : pf.L0;
    s = Math.round(Math.max(a, Math.min(b, s)) * 10) / 10; h = Math.round(Math.max(PL().h[0], Math.min(PL().h[1], h)) * 100) / 100; if (inFixP(s)) return false;
    P[i] = lin ? [s, h, 'lin'] : [s, h]; psel = i; pCommit(P, true); return true; }
  function pDel(i) { const P = pts(); if (!P[i] || P.length <= PL().n[0]) return false; P.splice(i, 1); pCommit(P); return true; }
  // dessin : bandes des repères (gare, lift, freins, tunnels, inversions), courbe d'origine (gris), courbe réglée (or), points
  const PW = 300, PH_ = 210, M = { l: 34, r: 6, t: 8, b: 18 };
  function pRange(P) { let lo = 0, hi = 10; for (const v of pf.h0.concat(pf.cur, (P || []).map(q => q[1]))) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return [Math.floor(lo - 2), Math.ceil(hi + 2)]; }
  function pDraw(P) {
    const cv = $('profCv'); if (!cv || !pf) return; const c = cv.getContext('2d'), [lo, hi] = pRange(P), X0 = s => M.l + s / pf.L0 * (PW - M.l - M.r), Y0 = h => PH_ - M.b - (h - lo) / (hi - lo) * (PH_ - M.t - M.b);
    c.clearRect(0, 0, PW, PH_); c.fillStyle = '#141d33'; c.fillRect(0, 0, PW, PH_); c.font = '9px system-ui'; c.textBaseline = 'top';
    const band = (a, b, col, lab) => { c.fillStyle = col; c.fillRect(X0(a), M.t, Math.max(1.5, X0(b) - X0(a)), PH_ - M.t - M.b); if (lab) { c.fillStyle = '#c9d3ea'; c.fillText(lab, X0(a) + 1, M.t + 1); } };
    const T = pf.tag; if (T.st0 != null && T.st1 != null) band(T.st0, T.st1, 'rgba(76,195,138,.28)', 'gare'); if (T.lift0 != null && T.lift1 != null) band(T.lift0, T.lift1, 'rgba(79,140,255,.25)', 'lift');
    for (let k = 1; T['blk' + k] != null; k++) band(T['bz' + k] != null ? T['bz' + k] : T['blk' + k] - 6, T['blk' + k], 'rgba(229,72,77,.3)', 'B' + k);
    if (T.brk != null) band(T.brk, T.fin != null ? T.fin : T.brk + 6, 'rgba(229,72,77,.3)', 'frein');
    pf.tun.forEach(t => band(t[0], t[1], 'rgba(200,170,110,.32)', 'tunnel')); pf.inv.forEach(v => band(v.s0, v.s1, 'rgba(180,120,220,.28)', v.type === 'loop' ? 'looping' : 'vrille'));
    c.lineWidth = 1; c.fillStyle = '#9aa7c4'; c.textBaseline = 'middle'; c.textAlign = 'right';
    const stp = hi - lo > 60 ? 20 : hi - lo > 25 ? 10 : 5; for (let h = Math.ceil(lo / stp) * stp; h <= hi; h += stp) { c.beginPath(); c.moveTo(M.l, Y0(h)); c.lineTo(PW - M.r, Y0(h)); c.strokeStyle = h === 0 ? '#5a6e9f' : '#2a3a5f'; c.stroke(); c.fillText(h + '', M.l - 3, Y0(h)); }
    c.textAlign = 'center'; c.textBaseline = 'top'; for (let s = 0; s <= pf.L0; s += pf.L0 > 600 ? 200 : 100) c.fillText(s + '', X0(s), PH_ - M.b + 3); c.textAlign = 'left';
    c.strokeStyle = '#7d8aa8'; c.lineWidth = 1; c.setLineDash(pEd() ? [3, 3] : []); c.beginPath(); pf.s0.forEach((s, i) => { if (i) c.lineTo(X0(s), Y0(pf.h0[i])); else c.moveTo(X0(s), Y0(pf.h0[i])); }); c.stroke(); c.setLineDash([]);
    if (pEd()) { c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); if (pdrag) (P || []).forEach((q, i) => (i ? c.lineTo(X0(q[0]), Y0(q[1])) : c.moveTo(X0(q[0]), Y0(q[1])))); else pf.cur.forEach((h, i) => { const sx = X0(Math.min(i * 2, pf.L0)); if (i) c.lineTo(sx, Y0(h)); else c.moveTo(sx, Y0(h)); }); c.stroke();
      (P || []).forEach((q, i) => { const on = i === psel; c.beginPath(); c.arc(X0(q[0]), Y0(q[1]), on ? 5.5 : 4, 0, 7); c.fillStyle = on ? '#ff8a3d' : q[2] === 'lin' ? '#5fd3e6' : '#fff'; c.fill(); c.strokeStyle = '#0b1120'; c.lineWidth = 1.5; c.stroke(); }); }
    pf._m = { lo, hi, X0, Y0 }; }
  const pHit = (P, x, y) => { const m = pf._m; let b = -1, d = 9; P.forEach((q, i) => { const e = Math.hypot(m.X0(q[0]) - x, m.Y0(q[1]) - y); if (e < d) { d = e; b = i; } }); return b; };
  function profilHTML() {
    pfLoad(); const P = pts(), ed = pEd(), h = [];
    h.push(`<p class="note">Hauteur de la voie au-dessus de la gare (m) selon l'abscisse <i>s</i> du tracé d'origine (m). ${ed ? 'Courbe réglée : <span style="color:var(--gold)">or</span> ; origine : tirets gris.' : 'Origine (grise) : aucune modification.'} Gare et inversions gardent leurs hauteurs (zones colorées : gare, lift, freins, tunnels, inversions). Hauteur de ${PL().h[0]} à ${PL().h[1]} m, ${PL().n[0]} à ${PL().n[1]} points (ESTIMÉS).</p>`,
      `<canvas id="profCv" width="${PW}" height="${PH_}" style="width:100%;max-width:${PW}px;touch-action:none;border-radius:6px"></canvas>`);
    if (!ed) h.push('<div class="row"><button id="bProfInit" class="go">Régler les hauteurs</button></div><p class="note">Crée un profil de départ qui suit la courbe d\'origine (' + pSample().length + ' points, écart de 0,4 m environ), puis chaque point se déplace. Tunnel enterré (par exemple sous l\'eau) : descendre les points sous 0 m.</p>');
    else {
      h.push(`<p class="note">Clic sur la courbe : ajoute un point ; glisser un point : le déplace ; <span style="color:#5fd3e6">cyan</span> = segment droit jusqu'au point suivant. ${P.length} point(s).</p>`);
      if (psel >= 0 && P[psel]) { const q = P[psel]; h.push(`<div class="fld mod" style="display:block"><div><b>Point ${psel + 1}</b></div><div>s <input id="pS" type="number" step="0.5" min="0" max="${R2(pf.L0)}" value="${q[0]}" style="width:70px"> m, hauteur <input id="pH" type="number" step="0.1" min="${PL().h[0]}" max="${PL().h[1]}" value="${q[1]}" style="width:62px"> m</div><label style="display:block;margin-top:4px"><input id="pLin" type="checkbox"${q[2] === 'lin' ? ' checked' : ''} style="width:auto"> segment droit jusqu'au point suivant</label><div class="row"><button id="bPDel" ${P.length <= PL().n[0] ? 'disabled' : ''}>Supprimer le point</button></div></div>`); }
      else h.push('<p class="note">Aucun point sélectionné.</p>');
      h.push('<div class="row"><button id="bProfRev" title="Revenir aux hauteurs d\'origine">Origine</button></div>');
      // alertes : pente, circuit infaisable (estimation du moteur : pente, roulement, traînée, sans freins de bloc)
      const sl = []; P.forEach((q, i) => { if (!i) return; const a = P[i - 1], g = Math.abs(q[1] - a[1]) / (q[0] - a[0]); if (g > PL().slope) sl.push(`${Math.round(g * 100)} % entre s = ${fr1(a[0])} et ${fr1(q[0])} m`); });
      if (sl.length) h.push(`<p class="note warn">Pente de plus de ${PL().slope * 100} % (ESTIMÉ) : ${esc(sl.join(' ; '))}.</p>`);
      const F = pf.faisa; if (F) h.push(F.bloque ? `<p class="note err">Circuit infaisable : le train s'arrêterait vers s = ${fr1(F.sOrig)} m (vitesse estimée ${fr1(F.vMin)} m/s, minimum du moteur ${fr1(F.vmin)} m/s).</p>` : `<p class="note">Vitesse la plus basse estimée après le lift : ${fr1(F.vMin)} m/s vers s = ${fr1(F.sOrig)} m (minimum du moteur ${fr1(F.vmin)} m/s ; estimation sans les freins de bloc).</p>`);
    }
    return h.join('');
  }
  function bindProfil() {
    const cv = $('profCv'); if (!cv) return; pDraw(pts());
    const bi = $('bProfInit'); if (bi) bi.onclick = pInit; const br = $('bProfRev'); if (br) br.onclick = pReset;
    const xy = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * PW / r.width, (e.clientY - r.top) * PH_ / r.height]; };
    const sOf = x => (x - M.l) / (PW - M.l - M.r) * pf.L0;
    cv.onpointerdown = e => { if (!pEd()) return; const [x, y] = xy(e), P = pts(), i = pHit(P, x, y);
      if (i >= 0) { psel = i; pdrag = { i, P, moved: false }; cv.setPointerCapture(e.pointerId); pDraw(P); }
      else if (x >= M.l) { if (!pAdd(sOf(x))) panel(); } e.preventDefault(); };
    cv.onpointermove = e => { if (!pdrag) return; const [x, y] = xy(e), m = pf._m, P = pdrag.P, i = pdrag.i, q = P[i];
      const a = i ? P[i - 1][0] + PL().gap : 0, b = i < P.length - 1 ? P[i + 1][0] - PL().gap : pf.L0, s = Math.max(a, Math.min(b, sOf(x))), h = Math.max(PL().h[0], Math.min(PL().h[1], m.lo + (PH_ - M.b - y) / (PH_ - M.t - M.b) * (m.hi - m.lo)));
      if (!inFixP(s)) { P[i] = q[2] === 'lin' ? [s, h, 'lin'] : [s, h]; pdrag.moved = true; } pDraw(P); };
    cv.onpointerup = () => { if (!pdrag) return; const d = pdrag; pdrag = null; if (d.moved) pCommit(d.P, true); else panel(); };
    const ps = $('pS'), ph = $('pH'), pl = $('pLin'), bd = $('bPDel');
    if (ps) { const ap = () => { if (isFinite(+ps.value) && isFinite(+ph.value)) pSet(psel, +ps.value, +ph.value, pl.checked); }; ps.onchange = ph.onchange = pl.onchange = ap; bd.onclick = () => pDel(psel); }
  }
  T2ZEditeur.section({ id: 'secProfil', titre: 'Hauteurs du circuit', avant: 'secLook', box: 'profBox',
    panel(x) { X = x; try { $('profBox').innerHTML = profilHTML(); bindProfil(); } catch (e) { $('profBox').innerHTML = '<p class="err">Section « Hauteurs du circuit » illisible : ' + String(e.message).replace(/</g, '&lt;') + '</p>'; console.error(e); } },
    contexte(x) { X = x; const c = {}; try { c.profileL = E('PROF.L0'); c.faisa = JSON.parse(E('JSON.stringify(faisabilite())')); } catch (e) { } return c; },
    ed(x) { X = x; return { prof: { pts: () => pts(), on: () => pEd(), info: () => { pfLoad(); return pf; }, sample: () => { pfLoad(); return pSample(); }, init: () => pInit(), add: s => (pfLoad(), pAdd(s)), set: (i, s, h, lin) => pSet(i, s, h, lin), del: i => pDel(i), reset: () => pReset(), sel: () => psel, select: i => { psel = i; panel(); } } }; } });
})();
