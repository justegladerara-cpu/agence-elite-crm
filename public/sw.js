// ARCHIVE — ELITE HÔTEL — À SUPPRIMER
// Service worker de retrait : efface les caches de l'ancienne application, se désinscrit et recharge les pages ouvertes.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k)
    await self.registration.unregister()
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url)
  })())
})
