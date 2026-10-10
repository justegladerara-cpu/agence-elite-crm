// Site vitrine servi à la racine de www.agence-elite.fr depuis le projet Pages agence-elite-crm.
// Le site est publié dans dist/site (adresse /site/ du CRM) ; ce middleware ne touche que les hôtes du site :
// - agence-elite.fr → redirection permanente vers https://www.agence-elite.fr (adresse officielle, SITE.url) ;
// - www.agence-elite.fr/site/… → même adresse sans /site ;
// - www.agence-elite.fr/<chemin> → fichier /site/<chemin>, avec la page 404 du site pour une adresse inconnue
//   (/site/404 : Pages sert 404.html sans l'extension).
// Tout autre hôte (crm.agence-elite.fr, *.pages.dev) passe sans changement.
const HOTE_SITE = 'www.agence-elite.fr'
const HOTE_NU = 'agence-elite.fr'

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url)
  const hote = url.hostname.toLowerCase()
  if (hote !== HOTE_SITE && hote !== HOTE_NU) return next()

  if (hote === HOTE_NU) return Response.redirect(`https://${HOTE_SITE}${url.pathname}${url.search}`, 301)
  if (url.pathname === '/site' || url.pathname.startsWith('/site/')) {
    return Response.redirect(`https://${HOTE_SITE}${url.pathname.slice(5) || '/'}${url.search}`, 301)
  }

  const reponse = await env.ASSETS.fetch(new Request(new URL('/site' + url.pathname + url.search, url), request))

  // « Jolies adresses » de Pages : /site/contact → /site/contact/ ; on garde l'adresse du site sans /site.
  if (reponse.status >= 300 && reponse.status < 400) {
    const destination = reponse.headers.get('Location') || ''
    if (destination.startsWith('/site/') || destination === '/site') {
      const entetes = new Headers(reponse.headers)
      entetes.set('Location', destination.slice(5) || '/')
      return new Response(reponse.body, { status: reponse.status, headers: entetes })
    }
    return reponse
  }

  // Adresse inconnue : en mode application, Pages renvoie l'accueil du CRM. On sert alors la page 404 du site.
  if (reponse.status === 200 && (reponse.headers.get('Content-Type') || '').includes('text/html')) {
    const etag = reponse.headers.get('ETag')
    if (etag) {
      const accueilCrm = await env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET' }))
      if (accueilCrm.headers.get('ETag') === etag) return pageIntrouvable(env, url)
    }
  }
  return reponse
}

async function pageIntrouvable(env, url) {
  const page = await env.ASSETS.fetch(new Request(new URL('/site/404', url), { method: 'GET' }))
  return new Response(page.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } })
}
