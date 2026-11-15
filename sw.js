/* Service worker : met en cache l'application pour jouer hors ligne.
   La liste des fichiers et la version sont injectées à la publication par
   `python3 tools/make_sw.py <dossier>` (workflow Pages). Sans injection (développement),
   la liste est vide et les fichiers sont mis en cache à la volée. */
const VERSION = /*SW_VERSION*/'dev';
const FILES = /*SW_FILES*/[];
const CACHE = 't2z-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('t2z-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });   // jeu.html?site=zeus -> jeu.html
    if (hit) return hit;
    try {
      const res = await fetch(r);
      if (res.ok) c.put(r, res.clone());
      return res;
    } catch (err) {
      return (await c.match('index.html')) || Response.error();
    }
  }));
});
