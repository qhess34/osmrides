'use strict';
/* Éditeur OSMrides — serveur local (Node 22, sans dépendance npm). docs/ARCHITECTURE.md D4, editor/README.md.
   - sert en LECTURE (GET seulement, pas de fichier caché, pas de traversée de chemin) : editor/ et engine/ depuis cette copie d'osmrides (librairie,
     docs/versions.md : l'éditeur et le moteur d'une même version vont ensemble), le reste depuis le dépôt de jeu T2Z_ROOT (jeu.html, lieux/) ;
   - envoi vers OSM (issue #46) : GET /osm/login, /osm/callback (OAuth2 PKCE), GET /api/osm/status, POST /api/osm/send/<site> ;
   - API : GET /api/couches (parties d'éditeur des couches du moteur), GET /api/sites, GET /api/game/<site>, POST /api/diff/<site>, PUT /api/game/<site>, <site> = <type>/<lieu>/<el> (docs/hierarchie.md) ;
   - n'écrit QUE lieux/<type>/<lieu>/<el>.game.js (liste blanche : un lieux/<type>/<lieu>/<el>.js existant) et lieux/<type>/<lieu>/lieu.js (GET/PUT /api/lieu/<type>/<lieu>, horaires du lieu), après validation (editor/schema.js) ; aucune opération Git.
   Variables : PORT (8787), HOST (127.0.0.1 ; 0.0.0.0 dans le conteneur, le port publié reste lié à 127.0.0.1 sur l'hôte), T2Z_ROOT (dépôt de jeu, défaut : ce dépôt). */
const http = require('http'), fs = require('fs'), path = require('path');
const S = require('./schema.js');
const LIB = path.resolve(__dirname, '..');                    // cette copie d'osmrides : editor/, engine/
const ROOT = path.resolve(process.env.T2Z_ROOT || LIB);       // dépôt de jeu : jeu.html, lieux/
const LIEUX = path.join(ROOT, 'lieux');
const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '127.0.0.1';
// Envoi vers OSM (issue #46, D12) : editor/osm-sync.js ; configuration locale non versionnée editor/osm.local.json (OSM_CONFIG).
const OSM = require('./osm-sync.js')({ configPath: process.env.OSM_CONFIG || path.join(__dirname, 'osm.local.json'), port: PORT, root: ROOT });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN' };

// Éléments = lieux/<type>/<lieu>/<el>.js écrits à la main (ni .data.js ni .game.js) ; identifiant « <type>/<lieu>/<el> ».
const NOM = /^[a-z0-9-]{1,40}$/, dirs = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory() && NOM.test(e.name)).map(e => e.name); } catch (e) { return []; } };
const siteIds = () => dirs(LIEUX).flatMap(t => dirs(path.join(LIEUX, t)).flatMap(l => fs.readdirSync(path.join(LIEUX, t, l))
  .filter(f => /^[a-z0-9-]{1,40}\.js$/.test(f) && f !== 'lieu.js' && !/\.(data|game)\.js$/.test(f)).map(f => t + '/' + l + '/' + f.slice(0, -3)))).sort();
// Couches du moteur de cette version qui ont une partie d'éditeur (docs/ARCHITECTURE.md D14) : engine/<couche>/schema.js (sections de GAME), editeur.js (panneaux)
const couches = () => dirs(path.join(LIB, 'engine')).map(nom => ({ nom, fichiers: ['schema.js', 'editeur.js'].filter(f => fs.existsSync(path.join(LIB, 'engine', nom, f))) })).filter(c => c.fichiers.length);
const gamePath = id => path.join(LIEUX, id + '.game.js');
const checkSite = id => typeof id === 'string' && /^[a-z0-9-]{1,40}\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,40}$/.test(id) && siteIds().includes(id);

function send(res, code, body, type) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8' }, SEC));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readGame(id) {
  const p = gamePath(id);
  if (!fs.existsSync(p)) return { exists: false, game: null, text: '' };
  const text = fs.readFileSync(p, 'utf8');
  try { return { exists: true, game: S.parse(text), text }; } catch (e) { return { exists: true, game: null, text, error: 'fichier illisible : ' + e.message }; }
}
function body(req) {
  return new Promise((ok, ko) => {
    let n = 0; const ch = [];
    req.on('data', c => { n += c.length; if (n > 1e6) { ko(new Error('corps trop gros')); req.destroy(); } else ch.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(ch).toString('utf8'))); } catch (e) { ko(new Error('JSON invalide')); } });
    req.on('error', ko);
  });
}
// Proposition : validation, texte normalisé, diff avec le fichier actuel.
// trainMax : places d'attente des trains calculées par le moteur dans l'éditeur (TRAIN_MAX, issue #32), entier de 1 à 8 ; sinon borne générale du schéma.
// contexte de validation envoyé par l'éditeur (calculé par le moteur dans la page) : seuls les nombres sont retenus (trainMax, blocs : entiers ; depthMax : m, bornes des travées selon le quai)
function ctxOf(b) { const c = (b && b.ctx && typeof b.ctx === 'object') ? b.ctx : {}, o = {}, ti = (v, a, z) => Number.isInteger(v) && v >= a && v <= z;
  const tm = b && b.trainMax != null ? b.trainMax : c.trainMax; if (ti(tm, 1, 8)) o.trainMax = tm; if (ti(c.blocs, 0, 50)) o.blocs = c.blocs; if (typeof c.depthMax === 'number' && isFinite(c.depthMax) && c.depthMax >= 0.5 && c.depthMax <= 6) o.depthMax = c.depthMax;
  if (Array.isArray(c.jobs) && c.jobs.length <= 20 && c.jobs.every(j => typeof j === 'string' && /^[A-Za-z]{2,24}$/.test(j))) o.jobs = c.jobs; return o; }
function propose(id, game, ctx) {
  const v = S.validate(game, ctx || {}), cur = readGame(id);
  if (v.errors.length) return { ok: false, errors: v.errors, warnings: v.warnings };
  const text = S.text(game);
  return { ok: true, warnings: v.warnings, exists: cur.exists, before: cur.text, after: text, same: cur.text === text, diff: S.diff(cur.text, text) };
}

// Réglages du lieu (osmrides#53) : lieux/<type>/<lieu>/lieu.js, `const LIEU = {…}`, commun à toutes les attractions du lieu (lu par engine/moteur.js, facultatif). Seul autre fichier écrit par l'éditeur.
const lieuPath = id => path.join(LIEUX, id, 'lieu.js'), checkLieu = id => typeof id === 'string' && /^[a-z0-9-]{1,40}\/[a-z0-9-]{1,40}$/.test(id) && dirs(path.join(LIEUX, id.split('/')[0])).includes(id.split('/')[1]);
function readLieu(id) { const p = lieuPath(id); if (!fs.existsSync(p)) return { exists: false, lieu: null, text: '' }; const text = fs.readFileSync(p, 'utf8'); try { return { exists: true, lieu: S.parseLieu(text), text }; } catch (e) { return { exists: true, lieu: null, text, error: 'fichier illisible : ' + e.message }; } }
function proposeLieu(id, lieu) { const v = S.validateLieu(lieu), cur = readLieu(id); if (v.errors.length) return { ok: false, errors: v.errors, warnings: v.warnings }; const text = S.textLieu(lieu); return { ok: true, warnings: v.warnings, exists: cur.exists, before: cur.text, after: text, same: cur.text === text, diff: S.diff(cur.text, text) }; }
const server = http.createServer(async (req, res) => {
  try {
    // Hôte local seulement (contre le rebinding DNS) ; écritures : même origine et JSON (contre les requêtes d'un autre site).
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return send(res, 403, { error: 'hôte refusé' });
    const url = new URL(req.url, 'http://local'), p = decodeURIComponent(url.pathname);
    if (req.method === 'GET' && p === '/osm/login') { const r = OSM.login(); if (r.location) { res.writeHead(302, Object.assign({ Location: r.location }, SEC)); return res.end(); } return send(res, r.code, r.text, 'text/plain; charset=utf-8'); }
    if (req.method === 'GET' && p === '/osm/callback') { const r = await OSM.callback(url); return r.html ? send(res, r.code, r.html, 'text/html; charset=utf-8') : send(res, r.code, r.text, 'text/plain; charset=utf-8'); }
    if (p.startsWith('/api/')) {
      if (req.method !== 'GET') {
        const o = req.headers.origin;
        if (o && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(o)) return send(res, 403, { error: 'origine refusée' });
        if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'JSON attendu' });
      }
      if (req.method === 'GET' && p === '/api/osm/status') return send(res, 200, OSM.status());
      if (req.method === 'GET' && p === '/api/couches') return send(res, 200, couches());
      const mo = /^\/api\/osm\/send\/([^/]+\/[^/]+\/[^/]+)$/.exec(p);
      if (mo && req.method === 'POST') { if (!checkSite(mo[1])) return send(res, 404, { error: 'attraction inconnue' }); const r = await OSM.send(mo[1].split('/')[2], await body(req)); /* tools/specs/<el>.json */ return send(res, r.code, r.body); }
      const ml = /^\/api\/lieu\/([^/]+\/[^/]+)$/.exec(p);
      if (ml) {
        if (!checkLieu(ml[1])) return send(res, 404, { error: 'lieu inconnu' });
        if (req.method === 'GET') return send(res, 200, readLieu(ml[1]));
        if (req.method === 'PUT') {
          const b = await body(req), r = proposeLieu(ml[1], b.lieu);
          if (!r.ok) return send(res, 422, r);
          const tmp = lieuPath(ml[1]) + '.tmp-' + process.pid;
          fs.writeFileSync(tmp, r.after, { mode: 0o644 }); fs.renameSync(tmp, lieuPath(ml[1]));
          console.log(new Date().toISOString(), 'écrit', path.relative(ROOT, lieuPath(ml[1])));
          return send(res, 200, Object.assign(readLieu(ml[1]), { written: 'lieux/' + ml[1] + '/lieu.js', warnings: r.warnings }));
        }
        return send(res, 405, { error: 'méthode refusée' });
      }
      const m = /^\/api\/(sites|game|diff)(?:\/([^/]+\/[^/]+\/[^/]+))?$/.exec(p);
      if (!m) return send(res, 404, { error: 'inconnu' });
      if (m[1] === 'sites' && req.method === 'GET') return send(res, 200, siteIds().map(id => ({ id, game: fs.existsSync(gamePath(id)) })));
      if (!checkSite(m[2])) return send(res, 404, { error: 'attraction inconnue' });
      const id = m[2];
      if (m[1] === 'game' && req.method === 'GET') return send(res, 200, readGame(id));
      if (m[1] === 'diff' && req.method === 'POST') { const b = await body(req); return send(res, 200, propose(id, b.game, ctxOf(b))); }
      if (m[1] === 'game' && req.method === 'PUT') {
        const b = await body(req), r = propose(id, b.game, ctxOf(b));
        if (!r.ok) return send(res, 422, r);
        const tmp = gamePath(id) + '.tmp-' + process.pid;
        fs.writeFileSync(tmp, r.after, { mode: 0o644 }); fs.renameSync(tmp, gamePath(id)); // écriture atomique, seul fichier écrit par l'éditeur
        console.log(new Date().toISOString(), 'écrit', path.relative(ROOT, gamePath(id)));
        return send(res, 200, Object.assign(readGame(id), { written: 'lieux/' + id + '.game.js', warnings: r.warnings }));
      }
      return send(res, 405, { error: 'méthode refusée' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'lecture seule' });
    if (p === '/' ) { res.writeHead(302, { Location: '/editor/' }); return res.end(); }
    if (p === '/sw.js') return send(res, 404, 'pas de service worker dans l\'éditeur', 'text/plain'); // évite tout cache hors ligne de game.js
    const rel = path.normalize(p.endsWith('/') ? p + 'index.html' : p).replace(/^([/\\])+/, '');
    const base = /^(editor|engine)[/\\]/.test(rel) ? LIB : ROOT, f = path.resolve(base, rel); // éditeur et moteur : ceux de cette version
    if (!f.startsWith(base + path.sep) || /\.local\.json$/.test(f) || rel.split(/[/\\]/).some(s => s.startsWith('.')) || rel.split(/[/\\]/)[0] === 'node_modules') return send(res, 404, 'introuvable', 'text/plain');
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) return send(res, 404, '', TYPES[path.extname(f).toLowerCase()] || 'text/plain'); // script absent (game.js facultatif) : simple 404
      res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size }, SEC));
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).pipe(res);
    });
  } catch (e) { send(res, 400, { error: e.message }); }
});
server.listen(PORT, HOST, () => console.log('Éditeur OSMrides : http://127.0.0.1:' + PORT + '/ (dépôt de jeu ' + ROOT + ', éditeur et moteur ' + LIB + ')'));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
