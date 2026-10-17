// Porte unique : le CRM ne s'ouvre que depuis l'espace super admin de la plateforme (saas.agence-elite.fr).
// Le bouton « CRM Agence Elite » de la plateforme ouvre crm.agence-elite.fr/#porte=<jeton de session plateforme>.
// Le CRM demande alors à la base de la plateforme si ce jeton appartient à un super admin (fonction est_super_admin).
// Si oui, l'appareil est autorisé pendant DUREE_MS ; ensuite il faut repasser par la plateforme.
// Le jeton n'est jamais gardé : seule la date d'expiration de l'autorisation est enregistrée.
// Les données du CRM restent protégées par sa propre connexion (Supabase du CRM) : la porte s'ajoute, elle ne remplace rien.

export const PLATEFORME_URL = import.meta.env.VITE_PLATEFORME_URL || 'https://xrlfedosaqtffraadmgk.supabase.co'
export const PLATEFORME_CLE = import.meta.env.VITE_PLATEFORME_CLE || 'sb_publishable_fpHQmPBtF_4pFMaOnBIKXQ_7KcmvjeX'
export const ADRESSE_SUPER_ADMIN = 'https://saas.agence-elite.fr/#/editeur/crm'
export const DUREE_MS = 12 * 60 * 60 * 1000
const CLE = 'aecrm-porte'

const lire = (stockage) => {
  try {
    return Number(stockage.getItem(CLE)) || 0
  } catch {
    return 0
  }
}

export function porteOuverte(stockage = globalThis.localStorage, maintenant = Date.now()) {
  return lire(stockage) > maintenant
}

export function fermerPorte(stockage = globalThis.localStorage) {
  try {
    stockage.removeItem(CLE)
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}

// Lit et retire le jeton de l'adresse (#porte=…), pour qu'il ne reste ni dans l'historique ni à l'écran.
export function extraireJeton(loc = globalThis.location, hist = globalThis.history) {
  const m = /^#porte=([^&]+)/.exec(loc.hash || '')
  if (!m) return null
  hist.replaceState(null, '', `${loc.pathname}${loc.search}#/`)
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

// Vérifie le jeton auprès de la plateforme. Renvoie true seulement si la plateforme répond « super admin ».
export async function verifierJeton(jeton, { fetchFn = globalThis.fetch, stockage = globalThis.localStorage, maintenant = Date.now() } = {}) {
  if (!jeton) return false
  try {
    const r = await fetchFn(`${PLATEFORME_URL}/rest/v1/rpc/est_super_admin`, {
      method: 'POST',
      headers: { apikey: PLATEFORME_CLE, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) return false
    const ok = (await r.json()) === true
    if (ok) stockage.setItem(CLE, String(maintenant + DUREE_MS))
    return ok
  } catch {
    return false
  }
}
