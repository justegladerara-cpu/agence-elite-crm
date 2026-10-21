// Aperçu sûr : toute construction qui n'est pas celle de la production tourne en mode démo, sans les vraies bases.
// Cloudflare Pages fournit CF_PAGES=1 et CF_PAGES_BRANCH au moment du build. Un aperçu de branche
// (*.agence-elite-crm.pages.dev) peut recevoir les mêmes variables Supabase que la production : on les ignore alors.
// VITE_PREVISUALISATION=1 force le même mode en local (captures, parcours e2e).
export const BRANCHES_PRODUCTION = ['claude/project-thread-j6wx9s', 'site']
// Identifiants des deux bases de production : aucune requête d'un aperçu ne doit les viser
export const BASES_PRODUCTION = ['mylgnsuoppplmfaanyze', 'xrlfedosaqtffraadmgk']

export function estApercu(env = process.env) {
  if (env.VITE_PREVISUALISATION === '1') return true
  return env.CF_PAGES === '1' && !!env.CF_PAGES_BRANCH && !BRANCHES_PRODUCTION.includes(env.CF_PAGES_BRANCH)
}

// Adresse de la plateforme fictive autorisée dans un aperçu (jamais une base de production)
export function plateformeFictive(env = process.env) {
  const u = env.VITE_PLATEFORME_FICTIVE || ''
  if (BASES_PRODUCTION.some((b) => u.includes(b))) throw new Error('VITE_PLATEFORME_FICTIVE ne peut pas viser une base de production')
  return u
}

// Politique de sécurité du contenu d'un aperçu : le navigateur refuse toute connexion hors de l'aperçu lui-même
// et de la plateforme fictive.
export function cspApercu(env = process.env) {
  const fictive = plateformeFictive(env)
  return `connect-src 'self' data: blob:${fictive ? ` ${new URL(fictive).origin}` : ''}`
}
