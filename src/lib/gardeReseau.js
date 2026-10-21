// Garde-fou du mode démo et des aperçus : aucune requête ne doit partir vers les deux bases de production.
// La vraie barrière d'un aperçu est la politique de sécurité (CSP) posée au build ; ceci la double dans le code
// et rend l'erreur lisible. Inactif quand le CRM est branché sur sa base (production).
export const BASES_PRODUCTION = ['mylgnsuoppplmfaanyze', 'xrlfedosaqtffraadmgk']

export const viseProduction = (url) => BASES_PRODUCTION.some((b) => String(url || '').includes(b))

export function installerGardeReseau(cible = globalThis) {
  if (!cible?.fetch || cible.fetch.__garde) return false
  const fetchOrigine = cible.fetch.bind(cible)
  const garde = (entree, init) => {
    const url = typeof entree === 'string' ? entree : entree?.url
    if (viseProduction(url)) return Promise.reject(new Error('Requête vers une base de production refusée (mode démo / aperçu)'))
    return fetchOrigine(entree, init)
  }
  garde.__garde = true
  cible.fetch = garde
  if (cible.navigator?.sendBeacon) {
    const beacon = cible.navigator.sendBeacon.bind(cible.navigator)
    cible.navigator.sendBeacon = (url, data) => (viseProduction(url) ? false : beacon(url, data))
  }
  return true
}
