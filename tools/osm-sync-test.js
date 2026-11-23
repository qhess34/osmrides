// Test de l'envoi vers OSM (issue #46, D12) : node tools/osm-sync-test.js [--ui] [--shot=f.jpg]
// FAUX serveur OSM local uniquement (OAuth2 PKCE simulé, API 0.6 simulée) : aucun appel réseau réel, jamais d'écriture vers openstreetmap.org.
// Vérifie : écarts GAME <-> OSM.attrs (editor/schema.js osmDiff, dont les attrs réels des .data.js lus par vm), connexion PKCE (challenge S256 et verifier), refus sans connexion,
// refus d'une valeur hors liste blanche, refus (409) si la version a changé depuis l'import (aucun changeset ouvert), osmChange envoyé (modify : tags existants gardés, nds conservés ;
// create : ids négatifs, polygone fermé, coordonnées depuis l'origine de la spec), changeset commenté (created_by) puis fermé, jeton absent des fichiers du dépôt.
// --ui : l'éditeur (Playwright, NODE_PATH=$(npm root -g)) ouvre le panneau d'envoi, se connecte (fenêtre simulée), envoie ; --shot : capture du panneau (600x450, JPEG 70).
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawn } = require('child_process');
const S = require('../editor/schema.js');
const LIB = path.resolve(__dirname, '..'), ROOT = path.resolve(process.env.JEU || path.join(LIB, '..', 'osmrides_parks')), EP = 18787, FP = 18790, BASE = 'http://127.0.0.1:' + EP, FAKE = 'http://127.0.0.1:' + FP;
const args = process.argv.slice(2), UI = args.includes('--ui'), SHOT = (args.find(a => a.startsWith('--shot=')) || '').slice(7);
const TOKEN = 'TOK-' + 'SECRET'; // construit pour que ce fichier ne contienne pas le jeton recherché dans le dépôt
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ── faux serveur OSM ──
const LOG = []; let versions = { 100: 7, 101: 3 }; const codes = new Map(); let challenge = null;
const WAYS = { 100: '<tag k="highway" v="footway"/><tag k="surface" v="asphalt"/><tag k="name" v="A &amp; B"/>', 101: '<tag k="highway" v="footway"/>' };
const fake = http.createServer((req, res) => {
  const u = new URL(req.url, FAKE); let b = ''; req.on('data', c => b += c); req.on('end', () => {
    LOG.push({ m: req.method, p: u.pathname, auth: req.headers.authorization || '', b });
    const j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/oauth2/authorize') {
      challenge = { c: u.searchParams.get('code_challenge'), m: u.searchParams.get('code_challenge_method'), cid: u.searchParams.get('client_id'), sc: u.searchParams.get('scope'), ru: u.searchParams.get('redirect_uri') };
      const code = 'code' + codes.size; codes.set(code, 1); res.writeHead(302, { Location: u.searchParams.get('redirect_uri') + '?code=' + code + '&state=' + u.searchParams.get('state') }); return res.end();
    }
    if (u.pathname === '/oauth2/token') {
      const f = new URLSearchParams(b), v = f.get('code_verifier') || '';
      const good = codes.has(f.get('code')) && challenge && crypto.createHash('sha256').update(v).digest('base64url') === challenge.c && f.get('client_id') === 'CID123' && f.get('redirect_uri') === challenge.ru;
      LOG[LOG.length - 1].tokenOk = !!good; return good ? j(200, { access_token: TOKEN, token_type: 'Bearer', scope: 'write_api' }) : j(400, { error: 'invalid_grant' });
    }
    if (u.pathname === '/api/0.6/user/details.json') return j(200, { user: { display_name: 'Testeur' } });
    let m;
    if ((m = /^\/api\/0\.6\/way\/(\d+)$/.exec(u.pathname)) && req.method === 'GET') {
      if (!WAYS[m[1]] && !versions[m[1]]) { res.writeHead(404); return res.end(); }
      if (!WAYS[m[1]]) WAYS[m[1]] = '<tag k="highway" v="footway"/>';
      res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end(`<?xml version="1.0"?><osm><way id="${m[1]}" version="${versions[m[1]]}" changeset="1"><nd ref="11"/><nd ref="12"/><nd ref="13"/>${WAYS[m[1]]}</way></osm>`);
    }
    if (u.pathname === '/api/0.6/changeset/create') { res.writeHead(200); return res.end('4242'); }
    if (u.pathname === '/api/0.6/changeset/4242/upload') {
      res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end('<diffResult version="0.6"><way old_id="100" new_id="100" new_version="8"/><way old_id="-5" new_id="900" new_version="1"/></diffResult>');
    }
    if (u.pathname === '/api/0.6/changeset/4242/close') { res.writeHead(200); return res.end(); }
    res.writeHead(404); res.end();
  });
});

// ── serveur de l'éditeur ──
let srv = null;
async function startEditor(cfg) {
  const cf = path.join(os.tmpdir(), 'osm-sync-test-' + process.pid + '.json'); fs.writeFileSync(cf, JSON.stringify(cfg));
  srv = spawn(process.execPath, [path.join(LIB, 'editor/server.js')], { env: Object.assign({}, process.env, { PORT: String(EP), T2Z_ROOT: ROOT, OSM_CONFIG: cf }), stdio: ['ignore', 'pipe', 'inherit'] });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/api/sites')).ok) return cf; } catch (e) { } await sleep(50); }
  throw new Error('serveur injoignable');
}
const post = (p, o) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).then(async r => ({ s: r.status, j: await r.json() }));
const get = p => fetch(BASE + p).then(r => r.json());
const nCs = () => LOG.filter(l => l.p === '/api/0.6/changeset/create').length;

(async () => {
  await new Promise(r => fake.listen(FP, '127.0.0.1', r));
  const cf = await startEditor({ clientId: 'CID123', api: FAKE, auth: FAKE });
  try {
    // 1. écarts (schema.osmDiff)
    const attrs = [{ role: 'queue', id: 'w100', v: 7, l: 30, t: { surface: 'asphalt' } }, { role: 'queue', id: 'w101', v: 3, l: 5, t: { surface: 'fine_gravel', colour: 'grey' }, h: { colour: '#808080' } },
      { role: 'rail', id: 'w102', v: 1, l: 4, t: { barrier: 'fence', material: 'metal' } }, { role: 'roof', id: 'w103', v: 2, l: 1, t: { 'roof:colour': '#a24e38' }, h: { 'roof:colour': '#a24e38' } },
      { role: 'track', id: 'w104', v: 2, l: 9, t: {} }];
    const plats = [[[0, 0], [10, 0], [10, 3], [0, 3]]];
    ok(S.osmDiff({}, attrs, { plats }).length === 0, 'aucun réglage dans GAME : aucun écart');
    let d = S.osmDiff({ look: { queue: { tex: 'sand' }, rail: 'metal', roof: '#a24e38', plat: { tex: 'deck', col: '#8a6c4c' } }, site: { track: { spine: '#336699' } } }, attrs, { plats });
    ok(d.filter(x => x.id === 'w100' && x.key === 'surface' && x.from === 'asphalt' && x.to === 'compacted').length === 1, 'asphalte -> sable : surface=compacted proposée');
    ok(!d.some(x => x.id === 'w101'), 'fine_gravel = sable : pas d\'écart');
    ok(!d.some(x => x.role === 'rail' || x.role === 'roof'), 'matériau et toit identiques : pas d\'écart');
    ok(d.some(x => x.role === 'track' && x.key === 'colour' && x.to === '#336699'), 'couleur de la voie : écart');
    const cr = d.filter(x => x.type === 'create'); ok(cr.length === 1 && cr[0].tags.surface === 'wood' && cr[0].tags.colour === '#8a6c4c' && cr[0].tags['area:highway'] === 'footway' && cr[0].tags.covered === 'yes', 'création du polygone du quai proposée (surface=wood, colour)');
    d = S.osmDiff({ look: { queue: { col: '#808080' }, roof: '#112233' } }, attrs, { plats });
    ok(!d.some(x => x.id === 'w101') && d.some(x => x.role === 'roof' && x.from === '#a24e38' && x.to === '#112233'), 'grey = #808080 sans écart ; toit modifié');
    for (const id of ['zeus', 'hourra', 'oziris', 'goudurix']) { // attrs réels (lus par vm, jamais affichés)
      const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(ROOT, 'lieux', 'parc', 'asterix', id + '.data.js'), 'utf8') + ';this.O=OSM', ctx);
      const A = ctx.O.attrs; ok(Array.isArray(A) && A.length && A.every(a => /^w\d+$/.test(a.id) && a.v >= 1 && a.role), id + ' : OSM.attrs ' + (A ? A.length : 0) + ' objets avec id et version');
      const dd = S.osmDiff({ look: { queue: { tex: 'pavers' } } }, A, {}); ok(dd.length === A.filter(a => a.role === 'queue').length, id + ' : un écart par chemin de file pour pavés');
    }
    // 2. sans connexion
    let st = await get('/api/osm/status'); ok(st.configured && !st.loggedIn && st.api === FAKE, 'état : configuré, non connecté');
    const items = [{ type: 'modify', role: 'queue', id: 'w100', v: 7, key: 'surface', from: 'asphalt', to: 'wood' }, { type: 'modify', role: 'queue', id: 'w100', v: 7, key: 'colour', from: '', to: '#8a6c4c' },
      { type: 'create', role: 'plat', id: 'new1', v: 0, key: 'polygone du quai 1', from: '', to: '', tags: { 'area:highway': 'footway', covered: 'yes', level: '0', surface: 'wood' }, pts: [[0, 0], [10, 0], [10, 3], [0, 3]] }];
    let r = await post('/api/osm/send/parc/asterix/zeus', { comment: 'Essai', items }); ok(r.s === 401, 'envoi refusé sans connexion (401)');
    ok(nCs() === 0, 'aucun changeset ouvert sans connexion');
    // 3. connexion OAuth2 PKCE simulée
    let l = await fetch(BASE + '/osm/login', { redirect: 'manual' }); const loc = new URL(l.headers.get('location'));
    ok(l.status === 302 && loc.origin === FAKE && loc.pathname === '/oauth2/authorize' && loc.searchParams.get('scope') === 'write_api' && loc.searchParams.get('code_challenge_method') === 'S256' && loc.searchParams.get('redirect_uri') === BASE + '/osm/callback' && loc.searchParams.get('client_id') === 'CID123', 'redirection vers /oauth2/authorize (S256, write_api, redirect 127.0.0.1)');
    const a1 = await fetch(loc, { redirect: 'manual' }), cb = a1.headers.get('location'); ok(cb.startsWith(BASE + '/osm/callback?code='), 'le faux OSM renvoie le code vers /osm/callback');
    const bad = await fetch(BASE + '/osm/callback?code=zzz&state=inconnu'); ok(bad.status === 400, 'état OAuth inconnu refusé');
    const c1 = await fetch(cb); ok(c1.status === 200, 'callback accepté'); ok(LOG.some(x => x.p === '/oauth2/token' && x.tokenOk), 'échange du jeton : code_verifier conforme au challenge S256');
    st = await get('/api/osm/status'); ok(st.loggedIn && st.user === 'Testeur', 'connecté (nom lu)'); ok(!JSON.stringify(st).includes(TOKEN), 'le jeton n\'est jamais renvoyé à la page');
    // 4. refus : valeur hors liste blanche, version changée
    r = await post('/api/osm/send/parc/asterix/zeus', { comment: 'Essai', items: [{ type: 'modify', role: 'queue', id: 'w100', v: 7, key: 'highway', to: 'path' }] }); ok(r.s === 422 && nCs() === 0, 'clé hors liste blanche refusée (422), aucun changeset');
    r = await post('/api/osm/send/parc/asterix/zeus', { comment: 'Essai', items: [{ type: 'modify', role: 'queue', id: 'w100', v: 7, key: 'surface', to: '<x>' }] }); ok(r.s === 422, 'valeur hors liste refusée');
    r = await post('/api/osm/send/parc/asterix/zeus', { comment: '', items }); ok(r.s === 422, 'commentaire vide refusé');
    versions[100] = 8; r = await post('/api/osm/send/parc/asterix/zeus', { comment: 'Essai', items }); ok(r.s === 409 && r.j.conflicts && r.j.conflicts[0].id === 'w100' && r.j.conflicts[0].have === 7 && r.j.conflicts[0].now === 8, 'version changée depuis l\'import : refus 409 avec la liste');
    ok(nCs() === 0, 'aucun changeset ouvert après un refus de version'); versions[100] = 7;
    // 5. envoi
    r = await post('/api/osm/send/parc/asterix/zeus', { comment: 'Sol de la file de Zeus : surface et couleur', items });
    ok(r.s === 200 && r.j.ok && r.j.changeset === '4242' && r.j.url === FAKE + '/changeset/4242', 'envoi accepté, changeset 4242');
    const cs = LOG.find(x => x.p === '/api/0.6/changeset/create'), up = LOG.find(x => x.p === '/api/0.6/changeset/4242/upload'), cl = LOG.find(x => x.p === '/api/0.6/changeset/4242/close');
    ok(cs.auth === 'Bearer ' + TOKEN && cs.b.includes('k="created_by" v="OSMrides editor"') && cs.b.includes('k="comment" v="Sol de la file de Zeus : surface et couleur"'), 'changeset ouvert avec created_by et comment, jeton Bearer');
    ok(up && cl && LOG.indexOf(cl) > LOG.indexOf(up), 'changeset fermé après l\'envoi');
    const x = up.b;
    ok(/<modify><way id="100" version="7" changeset="4242"><nd ref="11"\/><nd ref="12"\/><nd ref="13"\/>/.test(x), 'osmChange : modify way 100 version 7, nds conservés');
    ok(x.includes('<tag k="surface" v="wood"/>') && x.includes('<tag k="colour" v="#8a6c4c"/>') && x.includes('<tag k="highway" v="footway"/>') && x.includes('<tag k="name" v="A &amp; B"/>') && !x.includes('v="asphalt"'), 'osmChange : tags modifiés, autres tags gardés (échappés)');
    ok(/<create><node id="-1" lat="49\.\d{7}" lon="2\.\d{7}" changeset="4242"\/>/.test(x) && /<way id="-5" changeset="4242"><nd ref="-1"\/><nd ref="-2"\/><nd ref="-3"\/><nd ref="-4"\/><nd ref="-1"\/>/.test(x), 'osmChange : create, nœuds -1…-4, polygone fermé -5');
    ok(x.includes('<tag k="area:highway" v="footway"/>') && x.includes('<tag k="covered" v="yes"/>') && x.includes('<tag k="level" v="0"/>'), 'osmChange : tags du polygone de quai');
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/specs/zeus.json'), 'utf8')), n1 = /<node id="-2" lat="([\d.]+)" lon="([\d.]+)"/.exec(x);
    ok(n1 && Math.abs(+n1[2] - (spec.origin[1] + 10 / (111320 * Math.cos(spec.origin[0] * Math.PI / 180)))) < 2e-7 && Math.abs(+n1[1] - spec.origin[0]) < 2e-7, 'coordonnées du polygone calculées depuis l\'origine de la spec');
    ok(r.j.created.join() === 'w900', 'identifiant créé relu dans diffResult');
    ok(!LOG.some(l => !l.p.startsWith('/oauth2') && l.m !== 'GET' && l.auth !== 'Bearer ' + TOKEN), 'toute écriture porte le jeton');
    // 6. interface (facultatif)
    if (UI) await ui();
    // 7. le jeton n'est écrit nulle part dans le dépôt
    const hit = require('child_process').spawnSync('grep', ['-rl', TOKEN, LIB, ROOT, '--exclude-dir=.git', '--exclude-dir=node_modules'], { encoding: 'utf8' }).stdout.trim(); ok(!hit, 'jeton absent des fichiers du dépôt' + (hit ? ' : ' + hit : ''));
  } catch (e) { fails++; console.log('ERREUR', e.stack); }
  if (srv) { const p = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await p; }
  fs.rmSync(cf, { force: true }); fake.close();
  console.log(fails ? 'FAIL ' + fails : 'PASS'); process.exit(fails ? 1 : 0);
})();

async function ui() {
  const { chromium } = require('playwright'); const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  // déconnexion simulée : on repart d'un serveur sans jeton (redémarrage)
  const p = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await p;
  const cf2 = await startEditor({ clientId: 'CID123', api: FAKE, auth: FAKE });
  await page.goto(BASE + '/editor/?site=zeus'); await page.waitForFunction(() => window.ED && window.ED.isReady(), null, { timeout: 60000 });
  const real = await page.evaluate(() => window.ED.E('OSM.attrs')); for (const a of real) versions[a.id.slice(1)] = a.v; // le faux OSM connaît les objets importés, à leur version d'import
  const A = real.length; ok(A > 0, 'éditeur : OSM.attrs lu dans le jeu (' + A + ')');
  // réglage : couleur de file (la texture reste celle d'OSM : étiquette « OSM »), toit bleu, quai en platelage
  await page.evaluate(() => { window.ED.E("(GM.look={queue:{col:'#8a8a8a'},plat:{tex:'deck'},roof:'#336699'})"); window.ED.refresh(); });
  const html = await page.evaluate(() => document.getElementById('lookBox').innerHTML);
  ok(/t-mod">modifié/.test(html) && /t-osm">OSM/.test(html), 'panneau d\'apparence : étiquettes « modifié » et « OSM »');
  await page.click('#bOsm'); await page.waitForSelector('#modalOsm.on');
  ok((await page.textContent('#oMsg')).includes('non connecté'), 'panneau d\'envoi : non connecté');
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.click('#oLogin')]); await pop.waitForEvent('close', { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.getElementById('oMsg').textContent.includes('connecté :') || document.getElementById('oMsg').textContent.includes('— connecté'), null, { timeout: 10000 });
  const n = await page.locator('#oList input:checked').count(), cre = await page.locator('#oList input:not(:checked)').count(); ok(n >= 4 && cre >= 1, 'liste des écarts à cocher (' + n + ' cochés), polygone(s) du quai décoché(s) par défaut (' + cre + ')');
  await page.evaluate(() => { document.getElementById('oCom').value = 'Sol de la file, du quai et toit de la gare (Zeus), depuis OSMrides'; });
  if (SHOT) { await page.setViewportSize({ width: 600, height: 450 }); await page.screenshot({ path: SHOT, type: 'jpeg', quality: 70 }); await page.setViewportSize({ width: 1280, height: 800 }); }
  const before = nCs(); await page.click('#oSend'); await page.waitForFunction(() => window.ED.osmResult, null, { timeout: 10000 });
  ok((await page.evaluate(() => window.ED.osmResult)).ok && nCs() === before + 1, 'envoi depuis l\'éditeur : changeset ouvert une fois');
  ok(errs.length === 0, 'aucune erreur de page' + (errs.length ? ' : ' + errs[0] : '')); await b.close(); fs.rmSync(cf2, { force: true });
}
