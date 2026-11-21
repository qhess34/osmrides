'use strict';
/* Envoi des réglages de l'éditeur vers OpenStreetMap (issue #46, docs/ARCHITECTURE.md D12). Node 22, sans dépendance (fetch intégré).
   - OAuth2 avec PKCE (https://www.openstreetmap.org/oauth2/authorize et /oauth2/token, scope write_api) ; identifiant client dans editor/osm.local.json (non versionné, variable OSM_CONFIG) ;
     redirection http://127.0.0.1:<PORT>/osm/callback ; jeton gardé EN MÉMOIRE seulement (jamais écrit sur disque ni commité) : à refaire après un redémarrage du serveur.
   - Envoi : contrôle de chaque valeur, relecture fraîche de chaque objet (GET /api/0.6/way/<id>), refus si sa version a changé depuis l'import, changeset ouvert (comment, created_by),
     osmChange (modify / create, ids négatifs), changeset fermé. `api` du fichier de configuration : serveur de développement OSM possible. Jamais automatique : seule la route POST le déclenche. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const S = require('./schema.js');

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, '\'').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const HEX = /^#[0-9a-f]{6}$/;
const VAL = { surface: v => Object.values(S.SURF_OUT).includes(v), colour: v => HEX.test(v), 'roof:colour': v => HEX.test(v), material: v => ['metal', 'wood', 'stone'].includes(v) };

module.exports = function (opts) {
  const configPath = opts.configPath, port = opts.port, root = opts.root;
  let tok = null, user = null; const pending = new Map();
  const cfg = () => {
    let c; try { c = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return null; }
    if (!c || typeof c.clientId !== 'string' || !c.clientId) return null;
    const api = String(c.api || 'https://api.openstreetmap.org').replace(/\/+$/, ''), auth = String(c.auth || 'https://www.openstreetmap.org').replace(/\/+$/, '');
    return { clientId: c.clientId, api, auth, web: String(c.web || auth).replace(/\/+$/, '') };
  };
  const redirect = () => 'http://127.0.0.1:' + port + '/osm/callback';
  const H = t => ({ 'Authorization': 'Bearer ' + t, 'User-Agent': 'OSMrides editor' });

  function status() { const c = cfg(); return { configured: !!c, loggedIn: !!(c && tok), api: c ? c.api : null, user: c && tok ? user : null }; }

  // Redirection vers la page d'autorisation OSM (PKCE, méthode S256).
  function login() {
    const c = cfg(); if (!c) return { code: 400, text: 'editor/osm.local.json absent ou sans clientId (voir editor/README.md)' };
    const state = b64u(crypto.randomBytes(16)), verifier = b64u(crypto.randomBytes(48));
    for (const [k, v] of pending) if (Date.now() - v.t > 600000) pending.delete(k);
    pending.set(state, { verifier, t: Date.now() });
    const q = new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: redirect(), scope: 'write_api', state, code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256' });
    return { code: 302, location: c.auth + '/oauth2/authorize?' + q };
  }
  // Retour de l'autorisation : échange du code contre le jeton, nom de l'utilisateur (facultatif).
  async function callback(url) {
    const c = cfg(), p = c && pending.get(url.searchParams.get('state') || '');
    if (!c || !p) return { code: 400, text: 'état OAuth inconnu ou expiré : relancer la connexion depuis l\'éditeur' };
    pending.delete(url.searchParams.get('state'));
    if (url.searchParams.get('error') || !url.searchParams.get('code')) return { code: 400, text: 'autorisation refusée : ' + (url.searchParams.get('error') || 'pas de code') };
    const r = await fetch(c.auth + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: redirect(), client_id: c.clientId, code_verifier: p.verifier }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) return { code: 502, text: 'échange du jeton refusé (' + r.status + ')' };
    tok = j.access_token; user = null;
    try { const u = await (await fetch(c.api + '/api/0.6/user/details.json', { headers: H(tok) })).json(); user = u && u.user && u.user.display_name || null; } catch (e) { /* facultatif */ }
    return { code: 200, html: '<!doctype html><meta charset="utf-8"><title>OSM</title><p>Connecté à OpenStreetMap' + (user ? ' (' + esc(user) + ')' : '') + '. Cette fenêtre peut être fermée.</p><script>try{opener.postMessage("osm-login","*")}catch(e){}setTimeout(function(){close()},400)</script>' };
  }

  const parseWay = xml => {
    const m = /<way\b([^>]*)>([\s\S]*?)<\/way>/.exec(xml); if (!m) return null;
    const v = /\bversion="(\d+)"/.exec(m[1]);
    return { version: v ? +v[1] : 0, nds: [...m[2].matchAll(/<nd ref="(-?\d+)"\s*\/>/g)].map(x => x[1]), tags: [...m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)].map(x => [unesc(x[1]), unesc(x[2])]) };
  };
  // Contrôle d'une demande d'envoi : rôles, clés et valeurs de la liste blanche seulement.
  function check(b) {
    const E = [], items = Array.isArray(b && b.items) ? b.items : null;
    if (!items || !items.length) return { errors: ['aucun écart à envoyer'] };
    if (items.length > 200) return { errors: ['trop d\'écarts (200 au plus)'] };
    const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 255) : '';
    if (!comment) E.push('commentaire du changeset obligatoire');
    const mods = new Map(), creates = [];
    items.forEach((it, i) => {
      const w = 'écart ' + (i + 1) + ' : ';
      if (!it || typeof it !== 'object') return E.push(w + 'objet attendu');
      if (it.type === 'modify') {
        if (!S.OSM_TAGS[it.role] || !/^w[1-9]\d*$/.test(it.id || '') || !Number.isInteger(it.v) || it.v < 1) return E.push(w + 'objet à modifier invalide');
        if (!S.OSM_TAGS[it.role].includes(it.key) || typeof it.to !== 'string' || !VAL[it.key](it.to)) return E.push(w + 'clé ou valeur refusée (' + it.key + ')');
        const o = mods.get(it.id) || { id: it.id, v: it.v, set: {} };
        if (o.v !== it.v) return E.push(w + 'deux versions pour ' + it.id);
        o.set[it.key] = it.to; mods.set(it.id, o);
      } else if (it.type === 'create') {
        const t = it.tags, ok = t && typeof t === 'object' && it.role === 'plat' && Array.isArray(it.pts) && it.pts.length >= 3 && it.pts.length <= 64 && it.pts.every(p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Math.abs(n) < 5000));
        if (!ok) return E.push(w + 'polygone à créer invalide');
        const tags = { 'area:highway': 'footway', covered: 'yes', level: '0' };
        for (const k of Object.keys(t)) { if (k in tags) { if (t[k] !== tags[k]) E.push(w + 'tag ' + k + ' refusé'); } else if ((k === 'surface' || k === 'colour') && VAL[k](t[k])) tags[k] = t[k]; else E.push(w + 'tag ' + k + ' refusé'); }
        creates.push({ tags, pts: it.pts });
      } else E.push(w + 'type inconnu');
    });
    return { errors: E, comment, mods: [...mods.values()], creates };
  }

  async function api(c, method, p, body, type) {
    const r = await fetch(c.api + p, { method, headers: Object.assign(H(tok), body ? { 'Content-Type': type || 'text/xml' } : {}), body });
    return { status: r.status, text: await r.text() };
  }

  async function send(siteId, b) {
    const c = cfg(); if (!c) return { code: 400, body: { ok: false, errors: ['envoi non configuré (editor/osm.local.json)'] } };
    if (!tok) return { code: 401, body: { ok: false, errors: ['non connecté à OSM : utiliser « Se connecter à OSM »'] } };
    const k = check(b); if (k.errors.length) return { code: 422, body: { ok: false, errors: k.errors } };
    let origin = null;
    if (k.creates.length) { try { origin = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'specs', siteId + '.json'), 'utf8')).origin; } catch (e) { /* ci-dessous */ } if (!Array.isArray(origin)) return { code: 422, body: { ok: false, errors: ['origine de l\'attraction introuvable (tools/specs/' + siteId + '.json)'] } }; }
    // 1. relecture fraîche et contrôle de version : refus (rien n'est ouvert) si un objet a changé depuis l'import
    const fresh = new Map(), conflicts = [];
    for (const m of k.mods) {
      const r = await fetch(c.api + '/api/0.6/way/' + m.id.slice(1), { headers: { 'User-Agent': 'OSMrides editor' } });
      const w = r.ok ? parseWay(await r.text()) : null;
      if (!w) conflicts.push({ id: m.id, have: m.v, now: r.status === 410 || r.status === 404 ? 'supprimé' : 'illisible (' + r.status + ')' });
      else if (w.version !== m.v) conflicts.push({ id: m.id, have: m.v, now: w.version });
      else fresh.set(m.id, w);
    }
    if (conflicts.length) return { code: 409, body: { ok: false, error: 'objet modifié dans OSM depuis l\'import', conflicts } };
    // 2. changeset
    const cs = await api(c, 'PUT', '/api/0.6/changeset/create', '<osm><changeset><tag k="created_by" v="OSMrides editor"/><tag k="comment" v="' + esc(k.comment) + '"/></changeset></osm>');
    const csId = /^\d+$/.test(cs.text.trim()) ? cs.text.trim() : null;
    if (cs.status === 401 || cs.status === 403) tok = null;
    if (!csId) return { code: 502, body: { ok: false, errors: ['ouverture du changeset refusée (' + cs.status + ')' + (tok ? '' : ' : reconnecter OSM')] } };
    try {
      const attr = ' changeset="' + csId + '"', lat0 = origin && origin[0], lon0 = origin && origin[1], kx = origin && 111320 * Math.cos(lat0 * Math.PI / 180);
      let nid = 0, cre = '', mod = '';
      for (const g of k.creates) {
        const refs = g.pts.map(p => { const id = --nid; cre += '<node id="' + id + '" lat="' + (lat0 - p[1] / 111320).toFixed(7) + '" lon="' + (lon0 + p[0] / kx).toFixed(7) + '"' + attr + '/>'; return id; });
        cre += '<way id="' + (--nid) + '"' + attr + '>' + refs.concat(refs[0]).map(r => '<nd ref="' + r + '"/>').join('') + Object.keys(g.tags).map(t => '<tag k="' + esc(t) + '" v="' + esc(g.tags[t]) + '"/>').join('') + '</way>';
      }
      for (const m of k.mods) {
        const w = fresh.get(m.id), tags = new Map(w.tags); for (const t of Object.keys(m.set)) tags.set(t, m.set[t]);
        mod += '<way id="' + m.id.slice(1) + '" version="' + w.version + '"' + attr + '>' + w.nds.map(r => '<nd ref="' + r + '"/>').join('') + [...tags].map(t => '<tag k="' + esc(t[0]) + '" v="' + esc(t[1]) + '"/>').join('') + '</way>';
      }
      const xml = '<?xml version="1.0" encoding="UTF-8"?><osmChange version="0.6" generator="OSMrides editor">' + (cre ? '<create>' + cre + '</create>' : '') + (mod ? '<modify>' + mod + '</modify>' : '') + '</osmChange>';
      const up = await api(c, 'POST', '/api/0.6/changeset/' + csId + '/upload', xml);
      if (up.status !== 200) return { code: 502, body: { ok: false, errors: ['envoi refusé par OSM (' + up.status + ') : ' + up.text.slice(0, 300)], changeset: csId } };
      console.log(new Date().toISOString(), 'OSM changeset', csId, siteId, k.mods.length + ' modifié(s)', k.creates.length + ' créé(s)');
      return { code: 200, body: { ok: true, changeset: csId, url: c.web + '/changeset/' + csId, modified: k.mods.map(m => m.id), created: [...up.text.matchAll(/<way old_id="-\d+" new_id="(\d+)"/g)].map(x => 'w' + x[1]), diffResult: up.text.slice(0, 4000), osmChange: xml } };
    } finally { await api(c, 'PUT', '/api/0.6/changeset/' + csId + '/close').catch(() => {}); }
  }
  return { status, login, callback, send, cfg };
};
