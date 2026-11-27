#!/usr/bin/env node
/* Batterie des micro-tests du banc d'essai (docs/ref/banc.md) : une ligne par test (nom, PASS / FAIL, durée, première assertion en échec), puis un total.
     node tools/batterie.js                          tous les micro-tests de tools/banc/*.test.js, l'un après l'autre (aucune dépendance aux jeux)
     node tools/batterie.js --seulement=<nom>        un seul test (ou tous ceux dont le nom contient <nom>) : la vérification d'un correctif ciblé
     node tools/batterie.js --parcs=<dossier>        ajoute check.js, save.js et mobile.js de chaque attraction du dépôt de jeu <dossier> (osmrides_parks), moteur local
     node tools/batterie.js --parcs=<dossier> --attractions=hourra,zeus      restreint les attractions (défaut : zeus, hourra, oziris, goudurix)
   Playwright est trouvé seul (dossier global de npm). Variable MOTEUR : moteur essayé par les micro-tests (dossier engine/, chemin absolu), défaut celui de ce dépôt.
   ATTENTION, moteur local des parcs : le jeu ne l'accepte que sous la forme d'un chemin RELATIF à son jeu.html, qui commence par « ../ » et ne contient que a-z 0-9 _ . / -
   (jeu.html des parcs). Tout autre forme (chemin absolu, majuscules…) est ignorée EN SILENCE et le jeu charge le moteur PUBLIÉ : les tests passeraient sur le mauvais moteur.
   Ce script calcule donc le chemin relatif lui-même, puis VÉRIFIE dans le navigateur que moteur.js est bien chargé depuis ce dépôt avant de lancer le moindre test des parcs.
   Réserve : la batterie complète et les tests des parcs sont pour l'adoption ou la publication d'une version (AGENTS.md, « Vérifier avant de dire que c'est fait »). */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
const LIB = path.resolve(__dirname, '..'), BANC = path.join(__dirname, 'banc');
const NPMROOT = (() => { try { return spawnSync('npm', ['root', '-g']).stdout.toString().trim(); } catch (e) { return ''; } })();
const ENV = Object.assign({}, process.env, { NODE_PATH: [process.env.NODE_PATH, NPMROOT].filter(Boolean).join(path.delimiter) });
const seul = arg('seulement'), parcs = arg('parcs') ? path.resolve(arg('parcs')) : '';
const tests = fs.readdirSync(BANC).filter(f => f.endsWith('.test.js')).sort().map(f => ({ nom: f.replace(/\.test\.js$/, ''), cmd: [path.join(BANC, f)], cwd: LIB, env: ENV }));

async function moteurLocalDesParcs() { // chemin relatif du moteur local pour jeu.html des parcs, vérifié dans le navigateur
  const engine = path.join(LIB, 'engine'), rel = path.relative(parcs, engine).split(path.sep).join('/') + '/';
  if (!/^(\.\.\/)+[a-z0-9_.\/-]+\/$/.test(rel)) throw new Error('chemin du moteur local « ' + rel + ' » refusé par jeu.html des parcs (il doit commencer par ../ et ne contenir que a-z 0-9 _ . / -) : copiez ou déplacez les parcs à côté de ce dépôt');
  const { pw } = require('./banc/lib.js'); // Playwright
  const b = await pw.chromium.launch(), p = await b.newPage(); let src = '';
  try { await p.goto(`file://${parcs}/jeu.html?type=parc&lieu=asterix&el=hourra&moteur=${rel}`); await p.waitForFunction(() => window.G && typeof act === 'function', null, { timeout: 15000 });
    src = await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => /\/moteur\.js$/.test(s)) || ''); } finally { await b.close(); }
  if (src !== 'file://' + engine + '/moteur.js') throw new Error('le moteur chargé par les parcs n\'est pas le moteur local : « ' + src + ' » au lieu de file://' + engine + '/moteur.js');
  return rel;
}

(async () => {
  if (parcs) {
    let rel; try { rel = await moteurLocalDesParcs(); } catch (e) { console.log('FAIL moteur local des parcs : ' + e.message); process.exit(1); }
    console.log('moteur local des parcs vérifié : ' + rel);
    const sites = (arg('attractions') || 'zeus,hourra,oziris,goudurix').split(',').filter(Boolean), env = Object.assign({}, ENV, { MOTEUR: rel });
    for (const s of sites) for (const t of ['check', 'save', 'mobile']) tests.push({ nom: t + '-' + s, cmd: [path.join(parcs, 'tools', t + '.js'), s], cwd: parcs, env });
  }
  const choisis = seul ? tests.filter(t => t.nom.includes(seul)) : tests;
  if (!choisis.length) { console.log('aucun test ne correspond à « ' + seul + ' » (tests : ' + tests.map(t => t.nom).join(', ') + ')'); process.exit(1); }
  const T0 = Date.now(); let fails = 0; const w = Math.max(...choisis.map(t => t.nom.length));
  for (const t of choisis) { // l'un après l'autre : jamais en parallèle (clics ratés sous la charge)
    const d0 = Date.now(), r = spawnSync('node', t.cmd, { cwd: t.cwd, env: t.env, encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 26 });
    const sortie = ((r.stdout || '') + (r.stderr || '')).split('\n').map(l => l.trim()).filter(Boolean);
    const ok = r.status === 0 && !sortie.some(l => /^FAIL/.test(l)), dur = ((Date.now() - d0) / 1000).toFixed(1) + ' s';
    let info = ''; if (!ok) { fails++; info = sortie.find(l => /FAIL/.test(l) && !/^FAIL \(\d+\)$/.test(l)) || sortie.filter(l => !/^PASS/.test(l)).slice(-1)[0] || (r.error ? String(r.error.message) : 'code ' + r.status); info = '  ' + info.replace(/^(FAIL\s*)/, '').slice(0, 220); }
    console.log(t.nom.padEnd(w) + '  ' + (ok ? 'PASS' : 'FAIL') + '  ' + dur.padStart(7) + info);
  }
  console.log(`${choisis.length - fails} PASS, ${fails} FAIL sur ${choisis.length} tests, ${((Date.now() - T0) / 1000).toFixed(1)} s`);
  process.exit(fails ? 1 : 0);
})();
