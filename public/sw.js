// Service worker : permet d'ouvrir le CRM sans internet.
// Pages : réseau d'abord, copie locale en secours. Fichiers de l'appli : copie locale d'abord.
// VERSION et ASSETS sont remplis à chaque build (vite.config.js)
const VERSION = 'aecrm-dev'
const ASSETS = [] /* ASSETS */
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo-full.png', '/logo-mark.png', '/logo-mark-light.png', '/icon-192.png', '/favicon-64.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL).then(() => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const put = (req, res) => {
  // Les polices Google arrivent en réponse « opaque » : on les garde aussi
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone()
    caches.open(VERSION).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== self.location.origin && !fonts) return // Supabase : jamais mis en cache

  // Navigation : dernière version en ligne, sinon la copie locale
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => put('/index.html', res))
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    )
    return
  }
  // Fichiers versionnés (assets) et polices : copie locale d'abord
  if (url.pathname.startsWith('/assets/') || fonts) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)).catch(() => Response.error())))
    return
  }
  // Le reste (logo, modèle Excel…) : copie locale tout de suite, mise à jour en arrière-plan
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => put(req, res))
        .catch(() => hit || Response.error())
      return hit || net
    }),
  )
})
