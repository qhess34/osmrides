/* Retrait de l'ancien mode hors ligne : le jeu du Parc Astérix publié ici a déménagé vers https://qhess34.github.io/osmrides_parks/ (23/11/2026).
   Un téléphone qui avait installé l'ancien jeu récupère ce fichier à sa prochaine visite : il vide les anciens caches, se désinscrit et recharge la page.
   Les sauvegardes (localStorage, même site qhess34.github.io) ne sont pas touchées. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.map(n => caches.delete(n))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => cs.forEach(c => c.navigate(c.url)))
));
