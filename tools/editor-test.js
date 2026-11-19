// Test de l'éditeur (lot 1) : node tools/editor-test.js [goudurix zeus] [--check] [--shot=f.jpg]
// (NODE_PATH=$(npm root -g) pour Playwright). Pour chaque attraction : serveur editor/server.js lancé ici, éditeur ouvert, une barrière déplacée, orientée
// et allongée à la souris, salle de contrôle reprise de SITE.booth, déplacée, redimensionnée, tournée, supprimée puis recréée, diff, sauvegarde ; serveur redémarré,
// relecture identique ; zone d'attente du quai (GAME.boardAreas, issue #22) : polygone calculé affiché, sommet déplacé, sommet ajouté (milieu d'un bord) puis supprimé, retour au calcul
// auto, sommet déplacé de nouveau (écrit) ; barrière calculée supprimée ({off:true}), barrière ajoutée à une fourche, supprimée puis rajoutée ('add:<tronçon>:1') ; puis jeu.html (file://) :
// barrières et salle appliquées (géométrie, dessin, clic sur la carte, barrière supprimée ignorée, barrière ajoutée liée à sa fourche), visiteurs qui passent,
// zone d'attente appliquée (visiteurs à leur place dans le polygone, deux par portillon, évacuation depuis le polygone) ; profondeur des travées (GAME.board, issue #27) :
// calcul affiché, poignée glissée, valeur saisie, bornes, retour au calcul, valeur écrite ; dans le jeu, avec et sans zone éditée : visiteurs dans les rangs ajoutés.
// paramètres de l'attraction (lot 3, GAME.site) : couleur d'un train, nombre de trains, sous-type, physique, hors bornes refusé, sauvegarde, relecture, effet dans le jeu.
// --check : tools/check.js de l'attraction avec ce game.js (offpath, strollQ, gatesMove). Les sites/<site>.game.js créés sont retirés à la fin (ceux qui existaient
// avant sont restaurés).
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const S = require('../editor/schema.js');
const ROOT = path.resolve(__dirname, '..'), PORT = 8791, BASE = 'http://127.0.0.1:' + PORT;
const args = process.argv.slice(2), SITES = args.filter(a => !a.startsWith('--')), CHECK = args.includes('--check');
const SHOT = (args.find(a => a.startsWith('--shot=')) || '').slice(7);
if (!SITES.length) SITES.push('goudurix', 'zeus');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gp = id => path.join(ROOT, 'sites', id + '.game.js');

let srv = null;
async function startServer() {
  srv = spawn(process.execPath, [path.join(ROOT, 'editor/server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), T2Z_ROOT: ROOT }), stdio: ['ignore', 'pipe', 'inherit'] });
  for (let i = 0; i < 100; i++) { try { const r = await fetch(BASE + '/api/sites'); if (r.ok) return; } catch (e) { } await sleep(50); }
  throw new Error('serveur injoignable');
}
async function stopServer() { if (!srv) return; const p = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await p; srv = null; }

async function drag(page, from, to) {
  await page.mouse.move(from[0], from[1]); await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(from[0] + (to[0] - from[0]) * k / 6, from[1] + (to[1] - from[1]) * k / 6);
  await page.mouse.up(); await sleep(60);
}
const ed = (page, s) => page.evaluate(s);

(async () => {
  const backup = {}; for (const id of SITES) if (fs.existsSync(gp(id))) backup[id] = fs.readFileSync(gp(id), 'utf8');
  const browser = await chromium.launch(); let fail = 0;
  try {
    for (const id of SITES) {
      if (fs.existsSync(gp(id))) fs.unlinkSync(gp(id)); // part d'une attraction sans game.js
      const out = [], errors = [];
      const ok = (c, m) => { out.push((c ? '' : 'FAIL ') + m); if (!c) fail++; };
      await startServer();
      const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
      page.on('pageerror', e => errors.push(String(e.message || e)));
      page.on('console', m => { if (m.type() === 'error' && !/\.game\.js$|404/.test(((m.location() || {}).url || '') + m.text())) errors.push('console: ' + m.text()); });
      await page.goto(BASE + '/editor/?site=' + id);
      await page.waitForFunction(() => window.ED && window.ED.ready, null, { timeout: 30000 });
      ok(await page.isVisible('#secMig'), 'migration proposée');
      // ── barrière : fourche si possible, sinon entrée ──
      const G0 = await ed(page, `ED.gates().map(g=>({key:g.key,kind:g.kind,h:g.g.h,a:g.g.a,b:g.g.b}))`);
      const g0 = G0.find(g => g.kind === 'fork') || G0[0];
      ok(G0.some(g => g.kind === 'entry') && G0.length > 1, `barrières listées (${G0.length}, ${G0.filter(g => g.kind === 'fork').length} de fourche)`);
      await page.click(`#gList .it[data-key="${g0.key}"]`); await sleep(150);
      const s0 = await ed(page, `ED.E('cam.s')`);
      let p = await ed(page, `ED.toScr(${g0.h[0]},${g0.h[1]})`);
      await drag(page, p, [p[0] + 30, p[1] + 18]);
      let o = await ed(page, `ED.draft().barriers&&ED.draft().barriers[${JSON.stringify(g0.key)}]`);
      ok(o && Math.abs(o.x - g0.h[0] - 30 / s0) < .15 && Math.abs(o.z - g0.h[1] - 18 / s0) < .15, `barrière ${g0.key} déplacée (${o && o.x}, ${o && o.z})`);
      const A = await ed(page, `(()=>{const g=ED.gates().find(g=>g.key===${JSON.stringify(g0.key)}).g;return {a:g.a,h:g.h};})()`);
      p = await ed(page, `ED.toScr(${A.a[0]},${A.a[1]})`); const hS = await ed(page, `ED.toScr(${A.h[0]},${A.h[1]})`);
      const to = [hS[0] + (p[0] - hS[0]) * 1.3 + 8, hS[1] + (p[1] - hS[1]) * 1.3 - 8];
      await drag(page, p, to);
      const o2 = await ed(page, `ED.draft().barriers[${JSON.stringify(g0.key)}]`);
      ok(Math.abs(o2.a.len - o.a.len) > .1 && o2.b.ang === o.b.ang, `position A orientée et allongée (${o.a.ang}° ${o.a.len} m -> ${o2.a.ang}° ${o2.a.len} m)`);
      // ── supprimer une barrière calculée (surcharge {off:true}), ajouter une barrière à une fourche puis la supprimer (clé retirée), la rajouter ──
      const gd = G0.find(g => g.kind === 'fork' && g.key !== g0.key) || G0.find(g => g.key !== g0.key);
      await page.click(`#gList .it[data-key="${gd.key}"]`); await sleep(120); await page.click('#bDelGate'); await sleep(80);
      let dd = await ed(page, `ED.draft().barriers[${JSON.stringify(gd.key)}]`);
      ok(dd && dd.off === true && Object.keys(dd).length === 1 && await ed(page, `ED.gates().find(g=>g.key===${JSON.stringify(gd.key)}).off===true`), `barrière ${gd.key} supprimée (surcharge {off:true}, calcul gardé)`);
      let fk = await ed(page, `ED.E('forkList()')[0].name`), fg = G0.find(g => g.kind === 'fork');
      const addAt = async () => { await page.selectOption('#addFork', fk); await page.click('#bAddGate'); await sleep(60);
        const q = await ed(page, `ED.toScr(${fg.h[0] + 1.5},${fg.h[1] - 1})`); await page.mouse.click(q[0], q[1]); await sleep(120); };
      await addAt(); let ak = 'add:' + fk + ':1';
      let ab = await ed(page, `ED.draft().barriers[${JSON.stringify(ak)}]`);
      ok(ab && typeof ab.x === 'number' && ab.a.len >= .2 && ab.b.len >= .2 && await ed(page, `ED.gates().some(g=>g.key===${JSON.stringify(ak)}&&g.add&&g.kind==='fork')`), `barrière ajoutée à la fourche « ${fk} » (${ak}, pivot ${ab && ab.x}, ${ab && ab.z})`);
      await page.click('#bDelGate'); await sleep(80);
      ok(!(await ed(page, `!!(ED.draft().barriers||{})[${JSON.stringify(ak)}]`)) && !(await ed(page, `ED.gates().some(g=>g.key===${JSON.stringify(ak)})`)), 'barrière ajoutée supprimée (clé retirée de GAME)');
      await addAt(); ab = await ed(page, `ED.draft().barriers[${JSON.stringify(ak)}]`); ok(!!ab, 'barrière rajoutée (même clé ' + ak + ')');
      // barrière supprimée puis ajoutée sur la même fourche : les deux restent listées ; « Rétablir » rend la barrière calculée ; la fourche d'une barrière ajoutée se change
      const dk = await ed(page, `ED.gates().find(g=>g.off&&g.kind==='fork')`).then(g => g && g.key);
      ok(!!dk && await page.isVisible(`#gList .it[data-key="${dk}"]`) && await ed(page, `ED.gates().some(g=>g.key===${JSON.stringify(ak)})`), `barrière supprimée ${dk} et barrière ajoutée listées ensemble`);
      await page.click(`#gList .it[data-key="${dk}"]`); await sleep(100); await page.click('#bAuto'); await sleep(100);
      ok(await ed(page, `ED.gates().some(g=>g.key===${JSON.stringify(dk)}&&!g.off)&&!ED.draft().barriers[${JSON.stringify(dk)}]`), `barrière ${dk} rétablie (surcharge retirée)`);
      await page.click(`#gList .it[data-key="${dk}"]`); await sleep(100); await page.click('#bDelGate'); await sleep(100); // supprimée de nouveau (vérifiée dans jeu.html)
      await page.click(`#gList .it[data-key="${ak}"]`); await sleep(100);
      const forks = await ed(page, `ED.E('forkList()').map(f=>f.name)`);
      ok(await page.isVisible('#selFork'), 'barrière ajoutée : choix de la fourche proposé');
      if (forks.length > 1) {
        const nf = forks.find(n => n !== fk), before = await ed(page, `ED.draft().barriers[${JSON.stringify(ak)}]`);
        await page.selectOption('#selFork', nf); await sleep(120);
        const nk = 'add:' + nf + ':1', after = await ed(page, `ED.draft().barriers[${JSON.stringify(nk)}]`);
        ok(JSON.stringify(after) === JSON.stringify(before) && !(await ed(page, `!!ED.draft().barriers[${JSON.stringify(ak)}]`)), `barrière ajoutée rattachée à « ${nf} » (${ak} -> ${nk}, géométrie intacte)`);
        ok(await ed(page, `ED.sel().key===${JSON.stringify(nk)}&&ED.gates().find(g=>g.key===${JSON.stringify(nk)}).fork===ED.E('forkList()').find(f=>f.name===${JSON.stringify(nf)}).fork`), 'sélection suivie, fourche changée');
        ak = nk; fk = nf; ab = after;
      }
      // check.js (gatesMove) exige qu'aucune barrière ne pivote sur une main courante fixe : la barrière ajoutée (posée ci-dessus à un endroit quelconque) reprend la
      // géométrie d'une barrière calculée de sa fourche (champ de saisie équivalent du panneau « Sélection »), pour que --check reste significatif
      ab = await ed(page, `(()=>{const k=${JSON.stringify(ak)},a=ED.gates().find(g=>g.key===k),c=ED.gates().find(g=>g.kind==='fork'&&g.fork===a.fork&&!g.add&&!g.off)||ED.gates().find(g=>g.fork===a.fork&&!g.add);if(!c)return ED.draft().barriers[k];
        const h=c.g.h,P=e=>({ang:+(Math.atan2(e[1]-h[1],e[0]-h[0])*180/Math.PI).toFixed(1),len:+Math.hypot(e[0]-h[0],e[1]-h[1]).toFixed(2)});
        ED.E('GM').barriers[k]={x:+h[0].toFixed(2),z:+h[1].toFixed(2),a:P(c.g.a),b:P(c.g.b)};ED.E('reGates()');return ED.draft().barriers[k];})()`);
      // ── salle de contrôle ──
      await page.click('#bSelRoom'); await sleep(150);
      const r0 = await ed(page, `ED.rooms()[0]`), s1 = await ed(page, `ED.E('cam.s')`);
      p = await ed(page, `ED.toScr(${r0.x},${r0.z})`);
      await drag(page, p, [p[0] - 25, p[1] + 20]);
      let d = await ed(page, `ED.draft()`);
      ok(Array.isArray(d.controlRooms) && d.controlRooms.length === 1 && Math.abs(d.controlRooms[0].x - r0.x + 25 / s1) < .15, `salle reprise de SITE.booth et déplacée (${d.controlRooms && d.controlRooms[0].x}, ${d.controlRooms && d.controlRooms[0].z})`);
      ok(await page.isHidden('#secMig'), 'migration faite');
      await page.click('#bDelRoom'); await sleep(80);
      d = await ed(page, `ED.draft()`); ok(d.controlRooms.length === 0, 'salle supprimée');
      ok(await ed(page, `ED.E('beaconAt()===null&&boothLabelAt()===null')`), 'sans salle : ni gyrophare ni étiquette');
      await page.click('#bNewRoom'); await sleep(80);
      let r = await ed(page, `ED.rooms()[0]`);
      ok(r && r.w === 3.75, 'salle créée');
      p = await ed(page, `ED.toScr(${r.x},${r.z})`);
      const tgt = await ed(page, `ED.toScr(${r0.x + 1},${r0.z - .5})`);
      await page.click('#bSelRoom'); await sleep(100); p = await ed(page, `ED.toScr(${r.x},${r.z})`); const tg2 = await ed(page, `ED.toScr(${r0.x + 1},${r0.z - .5})`); void tgt;
      await drag(page, p, tg2);
      r = await ed(page, `ED.rooms()[0]`);
      const c = await ed(page, `(()=>{const r=ED.rooms()[0],t=r.angle*Math.PI/180,l=[r.w/2,r.d/2];return ED.toScr(r.x+l[0]*Math.cos(t)-l[1]*Math.sin(t),r.z+l[0]*Math.sin(t)+l[1]*Math.cos(t));})()`);
      await drag(page, c, [c[0] + 20, c[1] + 12]);
      const rw = await ed(page, `ED.rooms()[0]`);
      ok(rw.w > r.w + .5 && rw.d > r.d + .3, `salle redimensionnée (${r.w} x ${r.d} -> ${rw.w} x ${rw.d} m)`);
      const rh = await ed(page, `(()=>{const r=ED.rooms()[0],t=r.angle*Math.PI/180,l=[0,r.d/2+1.4];return ED.toScr(r.x+l[0]*Math.cos(t)-l[1]*Math.sin(t),r.z+l[0]*Math.sin(t)+l[1]*Math.cos(t));})()`);
      const rc = await ed(page, `ED.toScr(ED.rooms()[0].x,ED.rooms()[0].z)`);
      await drag(page, rh, [rc[0] + (rh[0] - rc[0]) * .2 + 60, rc[1] + (rh[1] - rc[1]) * .2]);
      const ra = await ed(page, `ED.rooms()[0]`);
      ok(Math.abs(ra.angle - rw.angle) > 20, `salle tournée (${rw.angle}° -> ${ra.angle}°)`);
      // ── profondeur des travées d'attente (GAME.board, issue #27) : calcul affiché, poignée glissée, valeur saisie, bornes, retour au calcul, réglée de nouveau (écrite) ──
      const D0 = await ed(page, `ED.depth()`), dTxt = async () => +(await page.inputValue('#depth'));
      ok(!D0.game && D0.depth === D0.calc && await page.isDisabled('#bDepthAuto') && Math.abs(await dTxt() - D0.calc) < .01, `travées : calcul affiché (${D0.calc} m, ${D0.rows} rang(s))`);
      const dH = d => [D0.u.o[0] + D0.u.r[0] * d, D0.u.o[1] + D0.u.r[1] * d];
      await ed(page, `ED.E('cam.g=null;cam.follow=-1;cam.key="";cam.x=${dH(D0.depth)[0]};cam.z=${dH(D0.depth)[1]};cam.s=22;0')`); await sleep(100);
      await drag(page, await ed(page, `ED.toScr(${dH(D0.depth).join(',')})`), await ed(page, `ED.toScr(${dH(D0.depth + 1.5).join(',')})`));
      let D1 = await ed(page, `ED.depth()`);
      ok(D1.game && Math.abs(D1.depth - D0.depth - 1.5) < .15 && (await ed(page, `ED.draft().board.depth`)) === D1.depth && D1.rows > D0.rows && await ed(page, `ED.sel().t==='depth'`), `travées : poignée glissée (${D0.depth} -> ${D1.depth} m, ${D1.rows} rangs)`);
      const setD = async v => { await page.fill('#depth', String(v)); await page.$eval('#depth', e => e.dispatchEvent(new Event('change'))); await sleep(80); return ed(page, `ED.depth()`); };
      D1 = await setD(20); ok(D1.depth === D1.max && (await ed(page, `ED.draft().board.depth`)) === D1.max, `travées : borne haute (${D1.depth} m)`);
      D1 = await setD(.1); ok(D1.depth === D1.min && D1.rows === 1, `travées : borne basse, un rang (${D1.depth} m)`);
      await page.click('#bDepthAuto'); await sleep(80); D1 = await ed(page, `ED.depth()`);
      ok(!(await ed(page, `'board' in ED.draft()`)) && D1.depth === D0.calc && !D1.game, 'travées : retour au calcul auto (clé retirée de GAME)');
      const DT = Math.round((D0.calc + 1.9) * 100) / 100; D1 = await setD(DT);
      ok(D1.depth === DT && D1.rows === Math.floor((DT - D1.min) / .6 + 1e-6) + 1 && await ed(page, `ED.E('GDEPTH===${DT}&&BWALK>=PGATE+GDEPTH+.5-.31')`), `travées : profondeur saisie ${DT} m, ${D1.rows} rangs (écrite)`);
      // ── zone d'attente du quai (GAME.boardAreas) ──
      await page.click('#bSelArea'); await sleep(150);
      const A0 = await ed(page, `ED.area()`);
      ok(A0.length >= 3 && !(await ed(page, `ED.areaEd()`)) && await ed(page, `ED.sel().t==='area'`), `zone d'attente calculée affichée (${A0.length} sommets)`);
      const back = await ed(page, `(()=>{const P=ED.area();let i=0,m=-1e9;P.forEach((q,j)=>{const l=ED.E('latA('+q[0]+','+q[1]+')');if(l>m){m=l;i=j;}});const b=ED.E('BAYS[0]');return {i,rx:b.rx,rz:b.rz};})()`);
      const s2 = await ed(page, `ED.E('cam.s')`), mv = [back.rx * 1.5 * s2, back.rz * 1.5 * s2];
      const dragV = async () => { const q = (await ed(page, `ED.area()`))[back.i], v = await ed(page, `ED.toScr(${q[0]},${q[1]})`); await drag(page, v, [v[0] + mv[0], v[1] + mv[1]]); return q; };
      let q0 = await dragV(), A1 = await ed(page, `ED.draft().boardAreas&&ED.draft().boardAreas[0]`);
      ok(A1 && A1.pts.length === A0.length && Math.abs(A1.pts[back.i][0] - q0[0] - back.rx * 1.5) < .15 && Math.abs(A1.pts[back.i][1] - q0[1] - back.rz * 1.5) < .15, `sommet ${back.i + 1} déplacé à la souris (${A1 && A1.pts[back.i]})`);
      const mid = await ed(page, `(()=>{const P=ED.area(),i=${back.i},r=P[(i+1)%P.length];return ED.toScr((P[i][0]+r[0])/2,(P[i][1]+r[1])/2);})()`);
      await drag(page, mid, [mid[0] + mv[0] * .4, mid[1] + mv[1] * .4]);
      let A2 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(A2.pts.length === A0.length + 1 && await ed(page, `ED.sel().v===${back.i + 1}`), `sommet ajouté au milieu d'un bord (${A2.pts.length} sommets)`);
      await page.click('#bDelVtx'); await sleep(80); A2 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(A2.pts.length === A0.length, 'sommet supprimé (bouton Supprimer le sommet)');
      await page.click('#bAreaAuto'); await sleep(80);
      ok(!(await ed(page, `'boardAreas' in ED.draft()`)) && !(await ed(page, `ED.areaEd()`)) && JSON.stringify(await ed(page, `ED.area()`)) === JSON.stringify(A0), 'retour au calcul auto (clé retirée de GAME)');
      q0 = await dragV(); A1 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(await ed(page, `ED.E('BSLOTS.length===SEATS&&BSLOTS.every(s=>inA(s[0],s[2],.19))')`), 'éditeur : places d\'attente recalculées dans le polygone');
      // ── fin de file et aimant (issue #24) : repère de fin de file, sommet créé au milieu du bord le plus proche puis glissé près du point de fin de file (collé
      //    exactement), Alt maintenue (pas d'aimant), relâché de nouveau près du point (collé) ; ce polygone est écrit et vérifié dans le jeu (entrée sans saut)
      const V = await ed(page, `ED.viaEnd()`), via = await ed(page, `ED.E('(SITE.board.via||[]).slice(-1)[0]||null')`);
      ok(V && V.pts.length >= 2 && V.edges.length === 2 && (!via || Math.hypot(V.end[0] - via[0], V.end[1] - via[1]) < .01), `fin de file affichée (${V && V.end}, ${V && V.pts.length} points, allée ${V && V.w} m)`);
      const sPx = await ed(page, `ED.snapPx`);
      const em = await ed(page, `(()=>{const P=ED.area(),e=${JSON.stringify(V.end)};let i=0,m=1e9;P.forEach((q,j)=>{const r=P[(j+1)%P.length],d=Math.hypot((q[0]+r[0])/2-e[0],(q[1]+r[1])/2-e[1]);if(d<m){m=d;i=j;}});const r=P[(i+1)%P.length];return {i,s:ED.toScr((P[i][0]+r[0])/2,(P[i][1]+r[1])/2)};})()`);
      let es = await ed(page, `ED.toScr(${V.end[0]},${V.end[1]})`);
      await drag(page, em.s, [es[0] + 5, es[1] - 4]);
      let A3 = await ed(page, `ED.draft().boardAreas[0]`), vi = em.i + 1;
      ok(A3.pts.length === A1.pts.length + 1 && A3.pts[vi][0] === V.end[0] && A3.pts[vi][1] === V.end[1], `aimant : sommet créé collé au point de fin de file à 6 px (${A3.pts[vi]})`);
      es = await ed(page, `ED.toScr(${V.end[0]},${V.end[1]})`); const s3 = await ed(page, `ED.E('cam.s')`);
      await page.keyboard.down('Alt'); await drag(page, es, [es[0] + 6, es[1]]); await page.keyboard.up('Alt');
      A3 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(Math.abs(A3.pts[vi][0] - V.end[0] - 6 / s3) < .03 && A3.pts[vi][1] === V.end[1], `Alt maintenue : sommet posé librement à 6 px (${A3.pts[vi]})`);
      es = await ed(page, `ED.toScr(${A3.pts[vi][0]},${A3.pts[vi][1]})`); const far = await ed(page, `ED.toScr(${V.end[0]},${V.end[1]})`);
      await drag(page, es, [far[0] + sPx + 6, far[1]]); A3 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(!(A3.pts[vi][0] === V.end[0] && A3.pts[vi][1] === V.end[1]), `au-delà de ${sPx} px : pas d'aimant`);
      es = await ed(page, `ED.toScr(${A3.pts[vi][0]},${A3.pts[vi][1]})`);
      await drag(page, es, [far[0] - 3, far[1] + 7]); A3 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(A3.pts[vi][0] === V.end[0] && A3.pts[vi][1] === V.end[1], `sommet glissé collé de nouveau au point de fin de file (${A3.pts[vi]})`);
      const eg = V.edges[0], egs = await ed(page, `ED.toScr(${eg[0]},${eg[1]})`), es2 = await ed(page, `ED.toScr(${V.end[0]},${V.end[1]})`);
      const egOk = Math.hypot(egs[0] - es2[0], egs[1] - es2[1]) > 2 * sPx + 4; // bord de l'allée assez loin du point de fin pour un test sans ambiguïté
      if (egOk) { await drag(page, es2, [egs[0] + 4, egs[1] + 4]); const A4 = await ed(page, `ED.draft().boardAreas[0]`);
        ok(A4.pts[vi][0] === eg[0] && A4.pts[vi][1] === eg[1], `aimant : bord de l'allée au bout de la file (${A4.pts[vi]})`);
        const eb = await ed(page, `ED.toScr(${eg[0]},${eg[1]})`); await drag(page, eb, [es2[0] + 2, es2[1] + 2]); }
      A3 = await ed(page, `ED.draft().boardAreas[0]`);
      ok(A3.pts[vi][0] === V.end[0] && A3.pts[vi][1] === V.end[1], 'polygone raccordé à la fin de file (écrit)');
      if (SHOT) { await page.click(`#gList .it[data-key="${g0.key}"]`); await page.setViewportSize({ width: 800, height: 500 }); await sleep(600); await page.screenshot({ path: SHOT, type: 'jpeg', quality: 70 }); await page.setViewportSize({ width: 1200, height: 760 }); await sleep(300); }
      // ── diff puis sauvegarde ──
      await page.click('#bDiff'); await page.waitForSelector('#diff .a', { timeout: 5000 });
      const nAdd = await page.$$eval('#diff .a', e => e.length);
      ok(nAdd > 5 && !(await page.isDisabled('#bSave')), `diff affiché (${nAdd} lignes ajoutées)`);
      await page.click('#bSave'); await page.waitForFunction(() => window.ED.saved >= 1, null, { timeout: 5000 });
      const exp = await ed(page, `ED.draft()`);
      ok(fs.existsSync(gp(id)) && fs.readFileSync(gp(id), 'utf8') === S.text(exp), 'sites/' + id + '.game.js écrit (JSON strict, normalisé)');
      ok(!(await ed(page, `ED.dirty`)), 'plus de modification en attente');
      await page.close();
      // ── redémarrage du serveur, relecture ──
      await stopServer(); await startServer();
      const p2 = await browser.newPage({ viewport: { width: 1200, height: 760 } });
      p2.on('pageerror', e => errors.push(String(e.message || e)));
      await p2.goto(BASE + '/editor/?site=' + id); await p2.waitForFunction(() => window.ED && window.ED.ready, null, { timeout: 30000 });
      const rd = await p2.evaluate(`ED.draft()`);
      ok(JSON.stringify(S.normalize(rd)) === JSON.stringify(S.normalize(exp)) && !(await p2.evaluate('ED.dirty')), 'relecture identique après redémarrage du serveur');
      ok(await p2.isHidden('#secMig'), 'pas de migration reproposée');
      await p2.close(); await stopServer();
      // ── jeu.html (file://) ──
      const jp = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      jp.on('pageerror', e => errors.push('jeu: ' + String(e.message || e)));
      await jp.goto('file://' + ROOT + '/jeu.html?site=' + id + '&mode=sandbox');
      await jp.waitForFunction(() => typeof gateList === 'function' && typeof render === 'function', null, { timeout: 30000 });
      await jp.evaluate(() => { localStorage.clear(); act('speed', 0); G.wx.next = 1e6; });
      const ov = exp.barriers[g0.key], gk = JSON.stringify(g0.key);
      const gj = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key===${gk});return g&&{ovr:g.g.ovr,h:g.g.h,a:g.g.a,kind:g.kind,fork:g.fork};})()`);
      const ea = [ov.x + Math.cos(ov.a.ang * Math.PI / 180) * ov.a.len, ov.z + Math.sin(ov.a.ang * Math.PI / 180) * ov.a.len];
      ok(gj && gj.ovr && Math.abs(gj.h[0] - ov.x) < 1e-6 && Math.abs(gj.h[1] - ov.z) < 1e-6 && Math.hypot(gj.a[0] - ea[0], gj.a[1] - ea[1]) < 1e-6, 'jeu : barrière corrigée appliquée (pivot, position A)');
      // barrière supprimée : ni dessin ni clic ; barrière ajoutée : liée à sa fourche (bascule avec elle, clic sur la carte)
      const ofd = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key===${JSON.stringify(gd.key)});return g&&g.off;})()`);
      ok(ofd === true && exp.barriers[gd.key].off === true, 'jeu : barrière supprimée ignorée (g.off)');
      const ag = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key===${JSON.stringify(ak)});if(!g)return null;const l=LOOPS[g.fork];return {add:g.add,fork:g.fork,name:l.kname,h:g.g.h,a:g.g.a,b:g.g.b,loop:g.g.loop};})()`);
      ok(ag && ag.add && ag.name === fk && Math.abs(ag.h[0] - ab.x) < 1e-6, `jeu : barrière ajoutée présente sur la fourche « ${ag && ag.name} »`);
      const agc = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key===${JSON.stringify(ak)}),L=LOOPS[g.fork],t=L.t;cam.g=null;cam.follow=-1;cam.key='';cam.x=g.g.h[0];cam.z=g.g.h[1];cam.s=24;render(.05);
        const e=t>.5?g.g.a:g.g.b,x=g.g.h[0]+(e[0]-g.g.h[0])*.6,z=g.g.h[1]+(e[1]-g.g.h[1])*.6,rc=cv.getBoundingClientRect();return {on:L.on,f:g.fork,x:rc.left+(x-cam.x)*cam.s+VW/2,y:rc.top+(z-cam.z)*cam.s+VH/2};})()`);
      await jp.mouse.click(agc.x, agc.y); await sleep(100);
      ok((await jp.evaluate(`LOOPS[${agc.f}].on`)) !== agc.on, 'jeu : clic sur la barrière ajoutée = bascule de sa fourche');
      await jp.evaluate(`(()=>{const L=LOOPS[${agc.f}];if(L.on!==${agc.on})act('loop',${agc.f});for(let i=0;i<40;i++)step(.05);})()`);
      const rj = await jp.evaluate(`ctlRooms()`), re = exp.controlRooms[0];
      ok(rj.length === 1 && ['x', 'z', 'angle', 'w', 'd'].every(k => rj[0][k] === re[k]), 'jeu : salle de contrôle appliquée');
      // dessin : couleur du local au centre de la salle (toits retirés, caméra sur la salle)
      const px = await jp.evaluate(`(()=>{const r=ctlRooms()[0];act('roof');cam.g=null;cam.follow=-1;cam.key='';cam.x=r.x;cam.z=r.z;cam.s=30;for(let i=0;i<60;i++)render(.05);
        const t=r.angle*Math.PI/180,lx=-r.w*.3,lz=-r.d*.3,X=(r.x+lx*Math.cos(t)-lz*Math.sin(t)-cam.x)*cam.s+VW/2,Z=(r.z+lx*Math.sin(t)+lz*Math.cos(t)-cam.z)*cam.s+VH/2;
        const d=ctx.getImageData(Math.round(X*DPR),Math.round(Z*DPR),1,1).data;return [d[0],d[1],d[2]];})()`);
      ok(Math.abs(px[0] - 0x3a) < 14 && Math.abs(px[1] - 0x43) < 14 && Math.abs(px[2] - 0x4f) < 14, `jeu : salle dessinée à sa nouvelle place (pixel ${px})`);
      // clic sur la carte : à mi-longueur de la position courante du vantail corrigé
      const st0 = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key===${gk});const L=g.kind==='entry'?null:LOOPS[g.fork];const t=L?(g.g.loop?1-L.t:L.t):ENTRY_GATE.t;cam.x=g.g.h[0];cam.z=g.g.h[1];cam.s=24;render(.05);
        const ta=Math.atan2(g.g.a[1]-g.g.h[1],g.g.a[0]-g.g.h[0]),tb=Math.atan2(g.g.b[1]-g.g.h[1],g.g.b[0]-g.g.h[0]);let d=ta-tb;d=Math.atan2(Math.sin(d),Math.cos(d));const th=tb+d*t,
        len=(Math.hypot(g.g.b[0]-g.g.h[0],g.g.b[1]-g.g.h[1])*(1-t)+Math.hypot(g.g.a[0]-g.g.h[0],g.g.a[1]-g.g.h[1])*t)*.6,x=g.g.h[0]+Math.cos(th)*len,z=g.g.h[1]+Math.sin(th)*len,rc=cv.getBoundingClientRect();
        return {on:L?L.on:G.open,x:rc.left+(x-cam.x)*cam.s+VW/2,y:rc.top+(z-cam.z)*cam.s+VH/2,fork:g.fork};})()`);
      await jp.mouse.click(st0.x, st0.y); await sleep(100);
      const on1 = await jp.evaluate(`${st0.fork}>=0?LOOPS[${st0.fork}].on:G.open`);
      ok(on1 !== st0.on, 'jeu : clic sur la barrière corrigée = bascule de sa fourche');
      // logique : visiteurs qui entrent dans la file et la parcourent (barrière d'entrée ouverte, fourches ouvertes)
      const vis = await jp.evaluate(`(()=>{if(!G.open)act('open');for(const l of LOOPS)l.on=true;buildQueue();let n=0;for(let i=0;i<4000;i++){step(.05);}return {q:G.queue.filter(v=>v.mode==='q').length,ok:G.queue.length};})()`);
      ok(vis.q > 0, `jeu : visiteurs dans la file (${vis.q})`);
      await jp.close();
      if (CHECK) {
        const r = (() => { try { return execFileSync(process.execPath, [path.join(ROOT, 'tools/check.js'), id], { encoding: 'utf8', env: process.env }); } catch (e) { return String(e.stdout || '') + 'FAIL'; } })();
        const last = r.trim().split('\n'), line = last.find(l => /offpath=/.test(l)) || '', gm = (r.match(/gatesMove=(FAIL [^|\n]*|\S+)/) || [''])[0];
        ok(/\nPASS\s*$/.test('\n' + r.trim().split('\n').pop() + '\n') || /^PASS$/m.test(r), `check.js ${id} avec game.js : ${r.trim().split('\n').pop()} ${line.split(' (')[0]} ${line.match(/strollQ=\d+/) || ''} ${gm}`);
      }
      // zone d'attente appliquée : polygone, visiteurs à leur place dans le polygone, deux par portillon, évacuation depuis le polygone
      const jp2 = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      jp2.on('pageerror', e => errors.push('jeu: ' + String(e.message || e)));
      await jp2.goto('file://' + ROOT + '/jeu.html?site=' + id + '&mode=sandbox');
      await jp2.waitForFunction(() => typeof reBoard === 'function' && typeof render === 'function', null, { timeout: 30000 });
      const za = await jp2.evaluate(`(()=>{localStorage.clear();act('speed',0);G.wx.next=1e6;if(!G.open)act('open');for(const l of LOOPS)l.on=true;buildQueue();
        let n=0,out=0,wout=0;for(let i=0;i<6000;i++){step(.05);if(i%25)continue;G.plat.forEach((r,j)=>{if(r&&r.on){n++;const s=slotPos(j);if(!pipA(BAREA,s[0],s[2]))out++;}});
          for(const k of G.walkers)if(k.kind==='wait'&&k.i>BVIA.pre.length+1&&!pipA(BAREA,k.x,k.z))wout++;}
        const per=GUNITS.map((_,u)=>G.plat.filter((r,j)=>r&&r.on&&seatUnit(j).u===u).length),on=G.plat.filter(r=>r&&r.on).length+G.platR.filter(r=>r&&r.on).length;
        const travOn=G.platR.filter((r,j)=>r&&r.on&&BRES[j].t).length,travMax=Math.max(0,...BRES.filter((p,j)=>p.t&&G.platR[j]&&G.platR[j].on).map(p=>latA(p[0],p[2])-PGATE));
        const res=G.platR.filter(r=>r&&r.on).length,resOut=BRES.filter(p=>!inA(p[0],p[2],.19)).length,V=boardViaEnd(),eJump=BVIA.e?Math.hypot(BVIA.e[0]-V.end[0],BVIA.e[1]-V.end[1]):-1;
        const wIn=G.walkers.filter(k=>k.kind==='wait'&&pipA(BAREA,k.x,k.z)).length;act('evac');const ev=G.walkers.filter(k=>k.kind==='evac'&&k.pe>0&&pipA(BAREA,k.pts[0][0],k.pts[0][2])).length;
        return {pts:BAREA,n,out,wout,per,on:on+wIn,ev,cap:GPR>1?S_COLS:CSEATS,left:G.plat.filter(r=>r).length+G.platR.filter(r=>r).length,res,nres:BRES.length,resOut,eJump,gd:GDEPTH,trav:BRES.filter(p=>p.t).length,travOn,travMax};})()`);
      ok(JSON.stringify(za.pts) === JSON.stringify(exp.boardAreas[0].pts), 'jeu : zone d\'attente appliquée (polygone de game.js)');
      ok(za.n > 0 && za.out === 0 && za.wout === 0, `jeu : visiteurs dans le polygone (${za.n} relevés à leur place, ${za.out} hors du polygone ; en marche : ${za.wout} hors)`);
      ok(za.per.every(c => c <= za.cap) && za.on > 0, `jeu : visiteurs par portillon ${za.per.join(' ')} (au plus ${za.cap})`);
      ok(za.ev === za.on && za.left === 0, `jeu : évacuation depuis le polygone (${za.ev} / ${za.on})`);
      ok(za.nres > 0 && za.res > 0 && za.resOut === 0, `jeu : la zone d'attente se remplit (réserve : ${za.res} visiteurs sur ${za.nres} places, toutes dans le polygone)`);
      ok(za.eJump >= 0 && za.eJump < .45, `jeu : entrée dans le polygone au point de fin de file (écart ${za.eJump.toFixed(2)} m)`);
      ok(za.gd === exp.board.depth && za.trav > 0 && za.travOn > 0 && za.travMax <= exp.board.depth - .4 + .01, `jeu : travées de ${za.gd} m, visiteurs dans les rangs ajoutés (${za.travOn} sur ${za.trav} places, ${za.travMax.toFixed(2)} m des portillons au plus)`);
      await jp2.close();
      // travées réglées sans zone éditée (GAME.boardAreas retiré dans la page) : rangs supplémentaires remplis, visiteurs à la profondeur choisie, évacuation
      const jp3 = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      jp3.on('pageerror', e => errors.push('jeu: ' + String(e.message || e)));
      await jp3.goto('file://' + ROOT + '/jeu.html?site=' + id + '&mode=sandbox');
      await jp3.waitForFunction(() => typeof reBoard === 'function' && typeof render === 'function', null, { timeout: 30000 });
      const zc = await jp3.evaluate(`(()=>{localStorage.clear();act('speed',0);G.wx.next=1e6;delete GM.boardAreas;reBoard();if(!G.open)act('open');for(const l of LOOPS)l.on=true;buildQueue();
        let mx=0,n=0,bad=0;for(let i=0;i<6000;i++){step(.05);if(i%25)continue;G.platR.forEach((r,j)=>{if(r&&r.on){n++;const l=latA(BRES[j][0],BRES[j][2])-PGATE;mx=Math.max(mx,l);if(!BRES[j].t||l>GDEPTH-.39)bad++;}});}
        const on=G.platR.filter(r=>r&&r.on).length;act('evac');for(let i=0;i<800;i++)step(.05);
        return {gd:GDEPTH,rows:GROWS,nres:BRES.length,n,mx,bad,on,left:G.plat.filter(r=>r).length+G.platR.filter(r=>r).length+G.walkers.filter(k=>k.kind==='wait').length};})()`);
      ok(zc.gd === exp.board.depth && zc.nres > 0 && zc.n > 0 && zc.bad === 0 && zc.left === 0, `jeu sans zone éditée : ${zc.rows} rangs, réserve dans les travées (${zc.n} relevés, ${zc.mx.toFixed(2)} m au plus, ${zc.bad} hors travée), évacuation (${zc.left} restant)`);
      await jp3.close();
      // ── paramètres de l'attraction (lot 3, D9) : GAME.site ──
      //    formulaire : couleur d'un train, nombre de trains (retrait puis ajout), sous-type ; brouillon conservé au rechargement du jeu en cadre ; valeur hors bornes
      //    signalée et refusée par le serveur, ↺ ; sauvegarde, relecture après redémarrage, effet dans jeu.html (SITE fusionné) ; clé hors liste refusée
      {
        await startServer();
        const ps = await browser.newPage({ viewport: { width: 1200, height: 760 } });
        ps.on('pageerror', e => errors.push('site: ' + String(e.message || e)));
        await ps.goto(BASE + '/editor/?site=' + id);
        // jeu en cadre rechargé et stable (un champ peut déclencher deux rechargements rapprochés) : prêt, puis toujours prêt 700 ms plus tard
        const rdy = async () => { for (;;) { await ps.waitForFunction(() => window.ED && window.ED.ready && window.ED.isReady(), null, { timeout: 60000 }); await sleep(700); if (await ps.evaluate(() => window.ED.ready && window.ED.isReady())) return; } };
        await rdy();
        const base = await ed(ps, `JSON.parse(ED.E('JSON.stringify(SITE_BASE)'))`), n0 = base.trains.length;
        const prior = await ed(ps, `JSON.stringify(ED.draft())`), hadSite = 'site' in JSON.parse(prior);
        ok(!hadSite && await ed(ps, `document.querySelectorAll('#siteBox .fld.mod').length`) === 0, 'attraction : formulaire sans surcharge au départ (valeurs de SITE)');
        // brouillon non enregistré (profondeur des travées) : doit survivre au rechargement du cadre
        const dmax = await ed(ps, `ED.depth().max`), d0 = await ed(ps, `ED.depth().depth`), dnew = Math.round((d0 > 1 ? d0 - 0.2 : d0 + 0.2) * 100) / 100;
        await ps.fill('#depth', String(dnew)); await ps.dispatchEvent('#depth', 'change'); await sleep(100);
        // couleur du premier train
        await ps.fill('.trow[data-i="0"] [data-tf="col"]', '#123456'); await rdy();
        ok(await ed(ps, `ED.E('SITE.trains[0].col')`) === '#123456' && await ed(ps, `ED.E('trains[0].col')`) === '#123456', 'attraction : couleur du train 1 appliquée au jeu en cadre (SITE et train)');
        ok(await ed(ps, `ED.draft().site.trains.length`) === n0 && await ed(ps, `ED.draft().board.depth`) === dnew, 'attraction : brouillon (travées) conservé au rechargement du jeu');
        ok(await ed(ps, `document.querySelectorAll('#siteBox .fld.mod').length`) === 1, 'attraction : champ modifié mis en évidence (liste des trains)');
        // nombre de trains : un de moins, puis un de plus (copie du dernier)
        await ps.click(`[data-tdel="${n0 - 1}"]`); await rdy();
        ok(await ed(ps, `ED.E('trains.length')`) === n0 - 1 && await ed(ps, `ED.draft().site.trains[0].col`) === '#123456', `attraction : ${n0 - 1} train(s) dans le jeu`);
        await ps.click('#bTAdd'); await rdy();
        const nAddT = await ed(ps, `ED.E('trains.length')`);
        ok(nAddT === n0 || (nAddT === n0 - 1 && (await ed(ps, `document.getElementById('bUndoSite')`)) === null), `attraction : train ajouté (${nAddT} trains)`);
        // sous-type
        const k1 = base.kind === 'steel' ? 'wood' : 'steel';
        await ps.selectOption('#siteBox select[data-p="kind"]', k1); await rdy();
        ok(await ed(ps, `ED.E('SITE.kind')`) === k1 && await ed(ps, `ED.draft().site.kind`) === k1 && await ed(ps, `ED.E('BOB===(SITE.kind==="bob")&&STL===(SITE.kind==="steel")')`), `attraction : sous-type ${base.kind} -> ${k1} appliqué`);
        // valeur hors bornes : signalée dans le formulaire, refusée par le serveur
        await ps.fill('#siteBox input[data-p="phys.roll"]', '5'); await ps.dispatchEvent('#siteBox input[data-p="phys.roll"]', 'change'); await rdy();
        ok(/phys\.roll/.test(await ed(ps, `document.getElementById('valBox').textContent`)), 'attraction : valeur hors bornes signalée (validation)');
        const bad = await ed(ps, `fetch('/api/game/${id}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:ED.draft()})}).then(r=>r.status)`);
        const bad2 = await ed(ps, `fetch('/api/diff/${id}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:{site:{kind:'wood',segs:[1]}}})}).then(r=>r.json()).then(j=>j.ok===false&&/segs/.test(j.errors.join()))`);
        const bad3 = await ed(ps, `fetch('/api/diff/${id}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:{site:{trains:[{name:'x',col:'rouge',col2:'#000000',wear:3}],car:{n:99}}}})}).then(r=>r.json()).then(j=>j.ok===false&&j.errors.length>=2)`);
        ok(bad === 422 && bad2 === true && bad3 === true, `attraction : serveur refuse hors bornes (${bad}), clé hors liste, couleur invalide`);
        await ps.click('#siteBox [data-rev="phys.roll"]'); await rdy();
        ok(await ed(ps, `'phys' in (ED.draft().site||{})`) === false && await ed(ps, `ED.E('PH.roll')`) === (base.phys.roll), 'attraction : ↺ revient à la valeur d\'origine (surcharge retirée)');
        // valeur valable : traînée
        const dr1 = Math.round(base.phys.drag * 1.5 * 1e5) / 1e5;
        await ps.fill('#siteBox input[data-p="phys.drag"]', String(dr1)); await ps.dispatchEvent('#siteBox input[data-p="phys.drag"]', 'change'); await rdy();
        ok(await ed(ps, `ED.E('PH.drag')`) === dr1, `attraction : physique modifiée (traînée ${dr1})`);
        await ps.click('#bDiff'); await ps.waitForSelector('#diff .a', { timeout: 30000 }).catch(async e => { throw new Error(errors.join(' ; ') + out.slice(-1).join(' // ') + await ed(ps, `' ready='+ED.ready+document.getElementById('mMsg').textContent`)); });
        ok(/"site"/.test(await ed(ps, `document.getElementById('diff').textContent`)), 'attraction : diff lisible (clé site)');
        await ps.click('#bSave'); await ps.waitForFunction(() => window.ED.saved >= 1, null, { timeout: 30000 });
        const expS = await ed(ps, `ED.draft()`), txt = fs.readFileSync(gp(id), 'utf8');
        ok(txt === S.text(expS) && S.parse(txt).site.trains[0].col === '#123456' && S.parse(txt).site.kind === k1, 'attraction : sites/' + id + '.game.js écrit avec "site"');
        await ps.close(); await stopServer(); await startServer();
        const p3 = await browser.newPage({ viewport: { width: 1200, height: 760 } });
        p3.on('pageerror', e => errors.push('site: ' + String(e.message || e)));
        await p3.goto(BASE + '/editor/?site=' + id); await p3.waitForFunction(() => window.ED && window.ED.ready, null, { timeout: 40000 });
        ok(JSON.stringify(S.normalize(await p3.evaluate(`ED.draft()`))) === JSON.stringify(S.normalize(expS)) && !(await p3.evaluate('ED.dirty')) && await p3.evaluate(`document.querySelectorAll('#siteBox .fld.mod').length`) >= 2, 'attraction : relecture identique après redémarrage, champs modifiés en évidence');
        await p3.close(); await stopServer();
        // jeu.html (file://) : SITE fusionné
        const jq = await browser.newPage({ viewport: { width: 1100, height: 760 } });
        jq.on('pageerror', e => errors.push('jeu site: ' + String(e.message || e)));
        await jq.goto('file://' + ROOT + '/jeu.html?site=' + id + '&mode=sandbox');
        await jq.waitForFunction(() => typeof reBoard === 'function' && typeof render === 'function', null, { timeout: 30000 });
        const jg = await jq.evaluate(`(()=>{localStorage.clear();act('speed',0);G.wx.next=1e6;for(let i=0;i<400;i++)step(.05);render(.05);return {kind:SITE.kind,c:SITE.trains[0].col,n:SITE.trains.length,nt:trains.length,tc:trains[0].col,drag:PH.drag,car:SITE.car.len};})()`);
        ok(jg.kind === k1 && jg.c === '#123456' && jg.tc === '#123456' && jg.n === jg.nt && jg.drag === dr1 && jg.car === base.car.len, `attraction : SITE fusionné dans le jeu (kind ${jg.kind}, ${jg.n} trains, train 1 ${jg.c}, traînée ${jg.drag})`);
        await jq.close();
      }
      ok(!errors.length, 'aucune erreur de page' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
      console.log(id + ':\n  ' + out.join('\n  '));
    }
  } finally {
    await browser.close(); await stopServer();
    for (const id of SITES) { if (backup[id] != null) fs.writeFileSync(gp(id), backup[id]); else if (fs.existsSync(gp(id))) fs.unlinkSync(gp(id)); }
  }
  console.log(fail ? 'FAIL (' + fail + ')' : 'PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); try { srv && srv.kill(); } catch (_) { } process.exit(1); });
