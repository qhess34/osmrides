'use strict';
/* Clés de GAME.site communes à tous les types d'attraction (éditeur ; docs/ARCHITECTURE.md D9, D14, osmrides#53) : objectif de l'attraction (goal), caméras (cams), postes de maintenance (jobsites). Liste blanche stricte avec bornes ESTIMÉES (sûres pour le moteur, pas des mesures) ; clé absente = valeur d'origine de SITE.
   Chargé par editor/schema.js (Node : serveur, tests) ou par editor/editor.js (navigateur) ; S = editor/schema.js. Lecture dans le moteur : engine/noyau/partie.js (goal), carte.js (cams),
   decor.js (jobsites). */
(function (inscrit) {
  inscrit(function (S) {
  const NL = { goal: [10, 20000], cams: 16, camS: [2, 60], xz: 5000, text: 160, label: 40, jobs: 16 };
  const KEYS = ['goal', 'cams', 'text', 'strike', 'jobsites'];
  const txt = (v, n) => typeof v === 'string' && v.trim() && v.length <= n && !/[\u0000-\u001f<>"\\]/.test(v);
  const pt = v => Array.isArray(v) && v.length === 2 && v.every(c => S.num(c, -NL.xz, NL.xz));
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  S.sitePart({ keys: KEYS,
    validate(T, E, W, ctx) {
      if ('goal' in T && !(Number.isInteger(T.goal) && T.goal >= NL.goal[0] && T.goal <= NL.goal[1])) E.push('site.goal : entier de ' + NL.goal[0] + ' à ' + NL.goal[1] + ' passagers par plage d\'ouverture');
      if ('cams' in T) {
        const C = T.cams;
        if (!obj(C)) E.push('site.cams : objet {<id>:{label, x, z, s}} attendu');
        else {
          const ids = Object.keys(C); if (ids.length > NL.cams) E.push('site.cams : ' + NL.cams + ' caméras au plus');
          for (const id of ids) {
            const p = 'site.cams.' + id, c = C[id];
            if (!/^[a-z][a-z0-9_-]{0,23}$/.test(id) || id === 'vue' || id.startsWith('suivi')) { E.push(p + ' : identifiant de 1 à 24 caractères (a-z, 0-9, - ou _), ni « vue » ni « suivi… »'); continue; }
            if (!obj(c)) { E.push(p + ' : objet {label, x, z, s} attendu'); continue; }
            for (const f of Object.keys(c)) if (!['label', 'x', 'z', 's'].includes(f)) E.push(p + '.' + f + ' : clé refusée');
            if ('label' in c && !txt(c.label, NL.label)) E.push(p + '.label : texte de 1 à ' + NL.label + ' caractères (sans < > " \\)');
            for (const f of ['x', 'z']) if ('x' in c || 'z' in c) { if (!S.num(c[f], -NL.xz, NL.xz)) E.push(p + '.' + f + ' : en m, de -' + NL.xz + ' à ' + NL.xz); }
            if ('s' in c && !S.num(c.s, NL.camS[0], NL.camS[1])) E.push(p + '.s : échelle (px par m) de ' + NL.camS[0] + ' à ' + NL.camS[1]);
          }
        }
      }
      // text et strike : tolérés en lecture (anciens GAME.site, le moteur lit encore SITE.text / SITE.strike), ignorés ici, plus écrits ni réglables
      if ('jobsites' in T) {
        const J = T.jobsites, ok = Array.isArray(ctx.jobs) ? ctx.jobs : null;
        if (!obj(J)) E.push('site.jobsites : objet {<travail>:[x, z]} attendu');
        else {
          if (Object.keys(J).length > NL.jobs) E.push('site.jobsites : ' + NL.jobs + ' postes au plus');
          for (const id of Object.keys(J)) {
            if (!/^[A-Za-z]{2,24}$/.test(id) || (ok && !ok.includes(id))) E.push('site.jobsites.' + id + ' : travail inconnu' + (ok ? ' (' + ok.join(', ') + ')' : ''));
            else if (!pt(J[id])) E.push('site.jobsites.' + id + ' : [x, z] en m');
          }
        }
      }
    },
    normalize(t, o) {
      if ('goal' in t) o.goal = t.goal;
      if ('cams' in t) { const q = {}; for (const id of Object.keys(t.cams)) { const c = t.cams[id], r = {}; if ('label' in c) r.label = c.label; for (const f of ['x', 'z']) if (f in c) r[f] = S.r2(c[f]); if ('s' in c) r.s = S.r2(c.s); q[id] = r; } o.cams = q; }
      if ('jobsites' in t) { const q = {}; for (const id of Object.keys(t.jobsites).sort()) q[id] = t.jobsites[id].map(S.r2); o.jobsites = q; }
    } });
  S.NL = NL;
  });
})(typeof module !== 'undefined' && module.exports ? f => { module.exports = f; } : f => f(window.T2ZSchema));
