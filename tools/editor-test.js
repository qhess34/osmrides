// Test de l'éditeur (lot 1) : node tools/editor-test.js [goudurix zeus] [--check] [--shot=f.jpg]
// (NODE_PATH=$(npm root -g) pour Playwright). Pour chaque attraction : serveur editor/server.js lancé ici, éditeur ouvert, une barrière déplacée, orientée
// et allongée à la souris, salle de contrôle reprise de SITE.booth, déplacée, redimensionnée, tournée, supprimée puis recréée, diff, sauvegarde ; serveur redémarré,
// relecture identique ; zone d'attente du quai (GAME.boardAreas, issue #22) : polygone calculé affiché, sommet déplacé, sommet ajouté (milieu d'un bord) puis supprimé, retour au calcul
// auto, sommet déplacé de nouveau (écrit) ; barrière calculée supprimée ({off:true}), barrière ajoutée à une fourche, supprimée puis rajoutée ('add:<tronçon>:1') ; puis jeu.html (file://) :
// barrières et salle appliquées (géométrie, dessin, clic sur la carte, barrière supprimée ignorée, barrière ajoutée liée à sa fourche), visiteurs qui passent,
// zone d'attente appliquée (visiteurs à leur place dans le polygone, deux par portillon, évacuation depuis le polygone) ; profondeur des travées (GAME.board, issue #27) :
// calcul affiché, poignée glissée, valeur saisie, bornes, retour au calcul, valeur écrite ; dans le jeu, avec et sans zone éditée : visiteurs dans les rangs ajoutés.
// apparence de la file et du quai (issue #45, GAME.look) : choix enregistré, relu, appliqué à chaud et dans le jeu.
// paramètres de l'attraction (lot 3, GAME.site) : couleur d'un train, nombre de trains, sous-type, physique, hors bornes refusé, sauvegarde, relecture, effet dans le jeu.
// --check : tools/check.js de l'attraction avec ce game.js (offpath, strollQ, bars). Les sites/<site>.game.js créés sont retirés à la fin (ceux qui existaient
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
      // ── barrières (issue #37) : posées à la main, indépendantes, GAME.barriers 'b<n>' = {x, z, ang, len, open?, sw?} ──
      ok((await ed(page, `ED.gates().length`)) === 0 && /Aucune barrière/.test(await page.textContent('#gList')), 'sans game.js : aucune barrière (plus de calcul)');
      // anciennes clés (surcharge, suppression, ajout) : converties par le moteur, réécrites au format b<n> à la première modification
      const lg = await ed(page, `(()=>{const S=ED.E('SEG_IN'),q=S.P[1],r=S.P[0];ED.E('GM').barriers={entry:{x:r[0],z:r[1],a:{ang:10,len:1.5},b:{ang:100,len:1.5}},'fork:x:fork0':{off:true},'add:x:1':{x:q[0],z:q[1],a:{ang:0,len:2},b:{ang:-90,len:2}}};ED.E('reGates()');
        ED.refresh();return ED.gates().map(g=>[g.key,g.from,g.open]);})()`);
      ok(JSON.stringify(lg) === JSON.stringify([['b1', 'add:x:1', false], ['b2', 'entry', true]]), 'anciennes clés converties en barrières indépendantes ' + JSON.stringify(lg));
      await page.click('#gList .it[data-key="b2"]'); await sleep(120); await page.click('#bDelGate'); await sleep(100);
      ok(JSON.stringify(await ed(page, `Object.keys(ED.draft().barriers)`)) === '["b1"]', 'première modification : fichier réécrit au format b<n> (ancienne entrée supprimée)');
      await page.click('#gList .it[data-key="b1"]'); await sleep(120); await page.click('#bDelGate'); await sleep(100);
      ok(!(await ed(page, `!!ED.draft().barriers`)) && (await ed(page, `ED.gates().length`)) === 0, 'barrière supprimée (clé retirée de GAME)');
      // ajouter : bouton puis clic sur l'allée (milieu du premier tronçon de la file)
      const addOn = async (P) => { await page.click('#bAddGate'); await sleep(60); await ed(page, `(()=>{const c=ED.E('cam');c.x=${P[0]};c.z=${P[1]};c.s=18;})()`); await sleep(150);
        const q = await ed(page, `ED.toScr(${P[0]},${P[1]})`); await page.mouse.click(q[0], q[1]); await sleep(150); };
      const M1 = await ed(page, `(()=>{const S=ED.E('SEG_IN'),d=Math.min(S.len*.5,12);let i=1;while(i<S.P.length-1&&S.C[i]<d)i++;const a=S.P[i-1],b=S.P[i],k=(d-S.C[i-1])/(S.C[i]-S.C[i-1]);return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];})()`);
      await addOn(M1);
      let b1 = await ed(page, `ED.draft().barriers&&ED.draft().barriers.b1`);
      ok(b1 && b1.len >= .2 && !b1.open && await ed(page, `ED.E('SEG_IN.bx.some(x=>x.b.key==="b1")')`), `barrière ajoutée en travers de l'allée (b1, pivot ${b1 && b1.x}, ${b1 && b1.z}, ${b1 && b1.len} m, fermée)`);
      // déplacer (glisser le pivot), tourner et allonger (poignée A)
      const s0 = await ed(page, `ED.E('cam.s')`);
      let p = await ed(page, `ED.toScr(${b1.x},${b1.z})`);
      await page.keyboard.down('Alt'); await drag(page, p, [p[0] + 30, p[1] + 18]); await page.keyboard.up('Alt'); // Alt : sans aimant
      let o = await ed(page, `ED.draft().barriers.b1`);
      ok(Math.abs(o.x - b1.x - 30 / s0) < .15 && Math.abs(o.z - b1.z - 18 / s0) < .15, `barrière b1 déplacée (${o.x}, ${o.z})`);
      const A = await ed(page, `(()=>{const g=ED.gates().find(g=>g.key==='b1').g;return {a:g.a,h:g.h};})()`);
      p = await ed(page, `ED.toScr(${A.a[0]},${A.a[1]})`); const hS = await ed(page, `ED.toScr(${A.h[0]},${A.h[1]})`);
      await page.keyboard.down('Alt'); await drag(page, p, [hS[0] + (p[0] - hS[0]) * 1.3 + 8, hS[1] + (p[1] - hS[1]) * 1.3 - 8]); await page.keyboard.up('Alt');
      const o2 = await ed(page, `ED.draft().barriers.b1`);
      ok(Math.abs(o2.len - o.len) > .1 && o2.ang !== o.ang, `barrière b1 tournée et allongée (${o.ang}° ${o.len} m -> ${o2.ang}° ${o2.len} m)`);
      // remise en travers de l'allée (champs du panneau) : le test du jeu ci-dessous en dépend
      await ed(page, `(()=>{const s=ED.E('barPlace(${M1[0]},${M1[1]})'),o=ED.E('GM').barriers.b1;Object.assign(o,{x:s.x,z:s.z,ang:s.ang,len:s.len});ED.E('reGates()');})()`);
      // aimant des barrières (propriétaire, 20/11) : pivot écarté de 6 px du bord puis relâché → collé au bord ; bout du vantail amené à 6 px du bord opposé → collé en face
      { await page.click('#gList .it[data-key="b1"]'); await sleep(120); await ed(page, `(()=>{const o=ED.E('GM').barriers.b1,c=ED.E('cam');c.x=o.x;c.z=o.z;c.s=22;})()`); await sleep(120);
        const g0 = await ed(page, `ED.draft().barriers.b1`), n = [-Math.cos(g0.ang * Math.PI / 180), -Math.sin(g0.ang * Math.PI / 180)]; // vers l'extérieur de l'allée
        const ps = await ed(page, `ED.toScr(${g0.x},${g0.z})`); await drag(page, ps, [ps[0] + n[0] * 6, ps[1] + n[1] * 6]);
        const g1 = await ed(page, `ED.draft().barriers.b1`), e1 = await ed(page, `ED.E('edgeSnap(${g1.x},${g1.z},.02)')`);
        ok(e1 && e1.d < .02, `aimant : pivot glissé à 6 px du bord, collé au bord (${g1.x}, ${g1.z})`);
        const A1 = await ed(page, `(()=>{const g=ED.gates().find(g=>g.key==='b1').g;return g.a;})()`), op = e1.o, pa = await ed(page, `ED.toScr(${A1[0]},${A1[1]})`), po = await ed(page, `ED.toScr(${op[0]},${op[1]})`);
        // barrière à 60° de l'allée : bout amené à 5 px du bord opposé → angle du curseur gardé, longueur ajustée, bout sur le bord opposé (jamais de perpendiculaire imposée)
        const nn = [(op[0] - g1.x) / e1.w, (op[1] - g1.z) / e1.w], tt = [-nn[1], nn[0]], u60 = [nn[0] * Math.sin(Math.PI / 3) + tt[0] * Math.cos(Math.PI / 3), nn[1] * Math.sin(Math.PI / 3) + tt[1] * Math.cos(Math.PI / 3)];
        const L60 = await ed(page, `ED.E('(()=>{let bL=null,bd=1;for(let L=${e1.w * .8};L<8;L+=.005){const s=edgeSnap(${g1.x}+${u60[0]}*L,${g1.z}+${u60[1]}*L,.5);if(s&&s.d<bd){bd=s.d;bL=L;}if(bL&&s&&s.d>bd+.2)break;}return bL;})()')`), tgt = [g1.x + u60[0] * L60, g1.z + u60[1] * L60], cs = await ed(page, `ED.E('cam.s')`), dropW = [tgt[0] + u60[0] * 5 / cs, tgt[1] + u60[1] * 5 / cs];
        await drag(page, pa, await ed(page, `ED.toScr(${dropW[0]},${dropW[1]})`)); const g2 = await ed(page, `ED.draft().barriers.b1`), t2 = g2.ang * Math.PI / 180, end = [g2.x + Math.cos(t2) * g2.len, g2.z + Math.sin(t2) * g2.len];
        const aCur = Math.atan2(dropW[1] - g1.z, dropW[0] - g1.x) * 180 / Math.PI, eS = await ed(page, `ED.E('edgeSnap(${end[0]},${end[1]},.5)')`);
        ok(Math.abs(((g2.ang - aCur) % 360 + 540) % 360 - 180) < .3 && eS && eS.d < .03 && Math.hypot(end[0] - tgt[0], end[1] - tgt[1]) < .06 && Math.abs(g2.len - L60) < .05,
          `aimant : barrière à 60° de l'allée, angle gardé (${g2.ang}° / curseur ${aCur.toFixed(1)}°), bout collé au bord opposé (${g2.len} m, croisement à ${L60.toFixed(2)}, à ${eS && eS.d} m du bord, ${Math.hypot(end[0] - tgt[0], end[1] - tgt[1]).toFixed(2)} m de la cible ; allée ${e1.w} m)`);
        await drag(page, await ed(page, `ED.toScr(${end[0]},${end[1]})`), [po[0] + 3, po[1] - 2]); const g4 = await ed(page, `ED.draft().barriers.b1`), t4 = g4.ang * Math.PI / 180, e4 = [g4.x + Math.cos(t4) * g4.len, g4.z + Math.sin(t4) * g4.len];
        ok(Math.hypot(e4[0] - op[0], e4[1] - op[1]) < .3 && (await ed(page, `ED.E('edgeSnap(${e4[0]},${e4[1]},.5)')`)).d < .03, `aimant : en travers aussi possible (bout sur le bord opposé, ${g4.ang}°)`);
        await page.keyboard.down('Alt'); const ps2 = await ed(page, `ED.toScr(${g2.x},${g2.z})`); await drag(page, ps2, [ps2[0] + n[0] * 6, ps2[1] + n[1] * 6]); await page.keyboard.up('Alt');
        const g3 = await ed(page, `ED.draft().barriers.b1`), e3 = await ed(page, `ED.E('edgeSnap(${g3.x},${g3.z},1)')`); ok(e3 && e3.d > .1, `Alt maintenue : pivot posé librement (${e3 && e3.d} m du bord)`); }
      await ed(page, `(()=>{const s=ED.E('barPlace(${M1[0]},${M1[1]})'),o=ED.E('GM').barriers.b1;Object.assign(o,{x:s.x,z:s.z,ang:s.ang,len:s.len});ED.E('reGates()');})()`);
      // état initial : ouverte au début de la partie (case du panneau)
      await page.click('#gList .it[data-key="b1"]'); await sleep(120); await page.check('#gOpen'); await sleep(80);
      ok((await ed(page, `ED.draft().barriers.b1.open`)) === true, 'b1 ouverte au début de la partie (open: true)');
      // deuxième barrière (raccourci de la première fourche, sinon fin de la file), puis supprimée et rajoutée
      const M2 = await ed(page, `(()=>{const L=ED.E('LOOPS'),S=L.length?L[0].short:ED.E('SEG_OUT'),P=S.P;return [(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2];})()`);
      await addOn(M2); ok(!!(await ed(page, `ED.draft().barriers.b2`)), 'deuxième barrière ajoutée (b2)');
      await page.click('#bDelGate'); await sleep(80); ok(!(await ed(page, `!!ED.draft().barriers.b2`)), 'b2 supprimée');
      await addOn(M2); const b2 = await ed(page, `ED.draft().barriers.b2`); ok(!!b2, 'b2 rajoutée (même clé)');
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
      if (SHOT) { await page.click(`#gList .it[data-key="b1"]`); await page.setViewportSize({ width: 800, height: 500 }); await sleep(600); await page.screenshot({ path: SHOT, type: 'jpeg', quality: 70 }); await page.setViewportSize({ width: 1200, height: 760 }); await sleep(300); }
      // ── entrée de la file (GAME.queueEntry, issue #39) : calcul affiché, poignée glissée (rechargement du cadre), champs, bornes, retour au calcul, réglée de nouveau (écrite) ──
      { const rdy = async () => { await sleep(400); await page.waitForFunction(() => window.ED && window.ED.ready && window.ED.isReady(), null, { timeout: 60000 }); await sleep(300); };
        const Q0 = await ed(page, `ED.qe()`);
        ok(!Q0.game && Q0.len === Q0.calc.len && await page.isDisabled('#bQeAuto') && Math.abs(+(await page.inputValue('#qeLen')) - Q0.calc.len) < .06, `entrée : calcul affiché (${Q0.calc.len} m à ${Q0.calc.ang}°)`);
        await ed(page, `ED.E('cam.g=null;cam.follow=-1;cam.key="";cam.x=${Q0.end[0]};cam.z=${Q0.end[1]};cam.s=18;0')`); await sleep(100);
        const t = (Q0.calc.ang + 25) * Math.PI / 180, L = Math.max(1.5, Q0.calc.len * .8), tg = [Q0.o[0] + Math.cos(t) * L, Q0.o[1] + Math.sin(t) * L];
        await drag(page, await ed(page, `ED.toScr(${Q0.end.join(',')})`), await ed(page, `ED.toScr(${tg.join(',')})`)); await rdy();
        let Q1 = await ed(page, `ED.qe()`), dq = await ed(page, `ED.draft().queueEntry`);
        ok(Q1.game && dq && Math.abs(dq.len - L) < .2 && Math.abs(((dq.ang - Q0.calc.ang - 25) % 360 + 540) % 360 - 180) < 2 && await ed(page, `ED.sel()&&ED.sel().t==='qe'`), `entrée : poignée glissée (${dq && dq.len} m à ${dq && dq.ang}°, retenu ${Q1.len} m)`);
        ok(await ed(page, `ED.E('(QS.link.length?QS.link[0]:ENTRY0).every((v,i)=>Math.abs(v-queueEntry().end[i])<.01)&&SITE.approach.every(a=>{const q=a.pts[a.pts.length-1],e=queueEntry().end;return Math.hypot(q[0]-e[0],q[1]-e[1])<.01;})')`), 'entrée : appliquée par le moteur (raccord et accès jusqu\'au bout)');
        await page.fill('#qeLen', '40'); await page.$eval('#qeLen', e => e.dispatchEvent(new Event('change'))); await rdy();
        Q1 = await ed(page, `ED.qe()`); ok((await ed(page, `ED.draft().queueEntry.len`)) === 30 && Q1.len <= 30, `entrée : borne haute 30 m (retenu ${Q1.len} m${Q1.clamped ? ', ramené sur la surface praticable' : ''})`);
        ok(S.validate({ queueEntry: { len: 31, ang: 0 } }).errors.length === 1 && S.validate({ queueEntry: { len: 2, ang: 0, x: 1 } }).errors.length === 1 && !S.validate({ queueEntry: { len: 2, ang: -90 } }).errors.length, 'entrée : validation (bornes, clé inconnue)');
        await page.click('#bQeAuto'); await rdy(); Q1 = await ed(page, `ED.qe()`);
        ok(!(await ed(page, `'queueEntry' in ED.draft()`)) && !Q1.game && JSON.stringify(Q1.end) === JSON.stringify(Q0.end), 'entrée : retour au calcul auto (clé retirée de GAME)');
        const LS = Math.round((Q0.calc.len + 1) * 10) / 10, AS = Math.round(Q0.calc.ang + 10);
        await page.fill('#qeLen', String(LS)); await page.$eval('#qeLen', e => e.dispatchEvent(new Event('change'))); await rdy();
        await page.fill('#qeAng', String(AS)); await page.$eval('#qeAng', e => e.dispatchEvent(new Event('change'))); await rdy();
        dq = await ed(page, `ED.draft().queueEntry`); ok(dq && dq.len === LS && dq.ang === AS && !!(await ed(page, `ED.draft().barriers.b1`)), `entrée : réglée aux champs (${LS} m à ${AS}°, écrite) ; barrières gardées`); }
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
      const ov = exp.barriers.b1;
      const gj = await jp.evaluate(`(()=>{const g=gateList().find(x=>x.key==='b1');return g&&{h:g.g.h,a:g.g.a,open:g.g.open};})()`);
      const ea = [ov.x + Math.cos(ov.ang * Math.PI / 180) * ov.len, ov.z + Math.sin(ov.ang * Math.PI / 180) * ov.len];
      ok(gj && gj.open === true && Math.abs(gj.h[0] - ov.x) < 1e-6 && Math.abs(gj.h[1] - ov.z) < 1e-6 && Math.hypot(gj.a[0] - ea[0], gj.a[1] - ea[1]) < 1e-6, 'jeu : barrière b1 appliquée (pivot, position fermée, ouverte au départ)');
      ok(await jp.evaluate(`gateList().length===2&&!BARS[1].open`), 'jeu : b2 présente, fermée au départ');
      { const qj = await jp.evaluate(`queueEntry()`); ok(qj.game && qj.ang === exp.queueEntry.ang && qj.want === exp.queueEntry.len, `jeu : entrée de la file appliquée (${qj.len} m à ${qj.ang}°${qj.clamped ? ', ramenée sur la surface praticable' : ''})`); }
      const rj = await jp.evaluate(`ctlRooms()`), re = exp.controlRooms[0];
      ok(rj.length === 1 && ['x', 'z', 'angle', 'w', 'd'].every(k => rj[0][k] === re[k]), 'jeu : salle de contrôle appliquée');
      // dessin : couleur du local au centre de la salle (toits retirés, caméra sur la salle)
      const px = await jp.evaluate(`(()=>{const r=ctlRooms()[0];act('roof');cam.g=null;cam.follow=-1;cam.key='';cam.x=r.x;cam.z=r.z;cam.s=30;for(let i=0;i<60;i++)render(.05);
        const t=r.angle*Math.PI/180,lx=-r.w*.3,lz=-r.d*.3,X=(r.x+lx*Math.cos(t)-lz*Math.sin(t)-cam.x)*cam.s+VW/2,Z=(r.z+lx*Math.sin(t)+lz*Math.cos(t)-cam.z)*cam.s+VH/2;
        const d=ctx.getImageData(Math.round(X*DPR),Math.round(Z*DPR),1,1).data;return [d[0],d[1],d[2]];})()`);
      ok(Math.abs(px[0] - 0x3a) < 14 && Math.abs(px[1] - 0x43) < 14 && Math.abs(px[2] - 0x4f) < 14, `jeu : salle dessinée à sa nouvelle place (pixel ${px})`);
      // clic sur la carte : à mi-longueur du vantail ouvert de b1 = fermeture de b1 seule ; visiteurs arrêtés devant ; nouveau clic = ouverture
      const clk = async () => { const c = await jp.evaluate(`(()=>{const g=BARS[0];cam.g=null;cam.follow=-1;cam.key='';cam.x=g.h[0];cam.z=g.h[1];cam.s=24;render(.05);const e=g.t>.5?g.a:g.b,x=g.h[0]+(e[0]-g.h[0])*.6,z=g.h[1]+(e[1]-g.h[1])*.6,rc=cv.getBoundingClientRect();
        return {x:rc.left+(x-cam.x)*cam.s+VW/2,y:rc.top+(z-cam.z)*cam.s+VH/2};})()`); await jp.mouse.click(c.x, c.y); await sleep(100); };
      await clk(); ok(await jp.evaluate(`!BARS[0].open&&!BARS[1].open`), 'jeu : clic sur la carte = b1 fermée, b2 inchangée');
      const blk = await jp.evaluate(`(()=>{if(!G.open)act('open');G.crowd=3;for(let i=0;i<3000;i++)step(.05);const x=SEG_IN.bx.find(x=>x.b===BARS[0]);return {d:x&&x.d,past:G.queue.filter(v=>v.mode==='q'&&(v.e!==SEG_IN||SEG_IN.len-v.r>x.d)).length,wait:G.queue.filter(v=>v.mode==='q'&&v.e===SEG_IN).length};})()`);
      ok(blk.d != null && blk.past === 0 && blk.wait > 0, `jeu : b1 fermée, visiteurs arrêtés devant (${blk.wait}), aucun au-delà`);
      await clk(); ok(await jp.evaluate(`BARS[0].open`), 'jeu : nouveau clic = b1 ouverte');
      // logique : visiteurs qui entrent dans la file et la parcourent (barrière d'entrée ouverte, fourches ouvertes)
      const vis = await jp.evaluate(`(()=>{if(!G.open)act('open');for(let i=0;i<4000;i++){step(.05);}return {q:G.queue.filter(v=>v.mode==='q'&&(v.e!==SEG_IN||SEG_IN.len-v.r>SEG_IN.bx[0].d)).length};})()`);
      ok(vis.q > 0, `jeu : visiteurs au-delà de b1 rouverte (${vis.q})`);
      await jp.close();
      if (CHECK) {
        const r = (() => { try { return execFileSync(process.execPath, [path.join(ROOT, 'tools/check.js'), id], { encoding: 'utf8', env: process.env }); } catch (e) { return String(e.stdout || '') + 'FAIL'; } })();
        const last = r.trim().split('\n'), line = last.find(l => /offpath=/.test(l)) || '', gm = (r.match(/bars: [^|\n]*/) || [''])[0];
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
      //    signalée et refusée par le serveur, Origine ; sauvegarde, relecture après redémarrage, effet dans jeu.html (SITE fusionné) ; clé hors liste refusée
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
        ok(await ed(ps, `'phys' in (ED.draft().site||{})`) === false && await ed(ps, `ED.E('PH.roll')`) === (base.phys.roll), 'attraction : Origine revient à la valeur d\'origine (surcharge retirée)');
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
      // ── apparence de la file et du quai (issue #45, D11) : GAME.look ──
      //    formulaire : texture et couleur de la file, texture du quai, matériau des garde-corps, couleur des portillons ; appliqué à chaud (cadre non rechargé),
      //    Origine, valeur invalide refusée par le serveur ; sauvegarde, relecture après redémarrage, effet dans jeu.html
      {
        await startServer();
        const pl = await browser.newPage({ viewport: { width: 1200, height: 760 } });
        pl.on('pageerror', e => errors.push('look: ' + String(e.message || e)));
        await pl.goto(BASE + '/editor/?site=' + id); await pl.waitForFunction(() => window.ED && window.ED.ready, null, { timeout: 40000 }); await sleep(500);
        ok(await ed(pl, `document.querySelectorAll('#lookBox .fld').length`) === 6 && await ed(pl, `document.querySelectorAll('#lookBox .fld.mod').length`) === 0 && await ed(pl, `ED.E('LK.q===TEX.stone&&LK.pf===PLAT_COL&&LK.rail===RAILM.metal&&LK.gate===null')`), 'apparence : formulaire sans réglage, rendu d\'origine');
        await ed(pl, `ED.E('window.__mk=1')`);
        const chg = async (sel, v, fill) => { if (fill) { await pl.fill(sel, v); await pl.dispatchEvent(sel, 'change'); } else await pl.selectOption(sel, v); await sleep(250); };
        await chg('#lookBox select[data-l="queue.tex"]', 'deck'); await chg('#lookBox input[data-l="queue.col"]', '#7a5c40', 1);
        await chg('#lookBox select[data-l="plat.tex"]', 'pavers'); await chg('#lookBox select[data-l="rail"]', 'stone'); await chg('#lookBox input[data-l="gate"]', '#3c5a78', 1);
        const hot = await ed(pl, `ED.E('window.__mk===1&&LK.q!==TEX.stone&&typeof LK.pf==="object"&&!LK.prow&&LK.rail===RAILM.stone&&LK.gate==="#3c5a78"')`);
        ok(hot && await ed(pl, `document.querySelectorAll('#lookBox .fld.mod').length`) === 5, 'apparence : platelage brun, pavés, pierre, portillons bleus appliqués à chaud (cadre non rechargé)');
        await pl.click('#lookBox [data-lrev="plat.tex"]'); await sleep(250);
        ok(await ed(pl, `!('plat' in ED.draft().look)`) && await ed(pl, `ED.E('LK.pf===PLAT_COL&&LK.prow')`), 'apparence : Origine (texture du quai) revient au béton lissé');
        await chg('#lookBox input[data-l="plat.col"]', '#b8b2a6', 1);
        const badL = await ed(pl, `fetch('/api/diff/${id}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:{look:{rail:'gold',queue:{tex:'marble'},plat:{col:'gris'},x:1}}})}).then(r=>r.json()).then(j=>j.ok===false&&j.errors.length===4)`);
        ok(badL === true, 'apparence : serveur refuse matériau, texture, couleur et clé inconnus');
        await pl.click('#bDiff'); await pl.waitForSelector('#diff .a', { timeout: 30000 });
        ok(/"look"/.test(await ed(pl, `document.getElementById('diff').textContent`)), 'apparence : diff lisible (clé look)');
        await pl.click('#bSave'); await pl.waitForFunction(() => window.ED.saved >= 1, null, { timeout: 30000 });
        const expL = await ed(pl, `ED.draft()`), txtL = fs.readFileSync(gp(id), 'utf8'), LL = S.parse(txtL).look;
        ok(txtL === S.text(expL) && LL.queue.tex === 'deck' && LL.queue.col === '#7a5c40' && LL.plat.col === '#b8b2a6' && !LL.plat.tex && LL.rail === 'stone' && LL.gate === '#3c5a78', 'apparence : sites/' + id + '.game.js écrit avec "look"');
        await pl.close(); await stopServer(); await startServer();
        const p4 = await browser.newPage({ viewport: { width: 1200, height: 760 } });
        p4.on('pageerror', e => errors.push('look: ' + String(e.message || e)));
        await p4.goto(BASE + '/editor/?site=' + id); await p4.waitForFunction(() => window.ED && window.ED.ready, null, { timeout: 40000 }); await sleep(300);
        ok(JSON.stringify(S.normalize(await p4.evaluate(`ED.draft()`))) === JSON.stringify(S.normalize(expL)) && !(await p4.evaluate('ED.dirty')) && await p4.evaluate(`document.querySelectorAll('#lookBox .fld.mod').length`) === 5, 'apparence : relecture identique après redémarrage, 5 champs réglés');
        await p4.close(); await stopServer();
        const jl = await browser.newPage({ viewport: { width: 1100, height: 760 } });
        jl.on('pageerror', e => errors.push('jeu look: ' + String(e.message || e)));
        await jl.goto('file://' + ROOT + '/jeu.html?site=' + id + '&mode=sandbox');
        await jl.waitForFunction(() => typeof render === 'function' && typeof LK === 'object', null, { timeout: 30000 });
        const jL = await jl.evaluate(`(()=>{localStorage.clear();act('speed',0);G.wx.next=1e6;for(let i=0;i<200;i++)step(.05);cam.s=12;render(.05);render(.05);return LK.q!==TEX.stone&&LK.pf==='#b8b2a6'&&LK.prow&&LK.rail===RAILM.stone&&LK.gate==='#3c5a78';})()`);
        ok(jL === true, 'apparence : réglages appliqués dans jeu.html (file://)');
        await jl.close();
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
