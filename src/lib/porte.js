// Porte unique : le CRM ne s'ouvre qu'avec le compte super admin de la plateforme (saas.agence-elite.fr), saisi
// sur l'écran d'entrée du CRM. Un ancien lien crm.agence-elite.fr/#porte=<jeton de session plateforme> marche encore :
// le CRM demande alors à la base de la plateforme si ce jeton appartient à un super admin (fonction est_super_admin).
// Si oui, l'appareil est autorisé pendant DUREE_MS ; ensuite il faut repasser par la plateforme.
// Le jeton n'est jamais gardé : seule la date d'expiration de l'autorisation est enregistrée.
// Les données du CRM restent protégées par sa propre connexion (Supabase du CRM) : la porte s'ajoute, elle ne remplace rien.

// Base de la plateforme : celle de production seulement quand le CRM est lui-même branché sur sa base de production.
// En mode démo ou en aperçu, seule une plateforme fictive explicitement fournie (VITE_PLATEFORME_URL) est utilisée :
// sans elle, l'espace plateforme reste vide plutôt que de lire de vraies données.
const CRM_BRANCHE = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
export const PLATEFORME_URL = import.meta.env.VITE_PLATEFORME_URL || (CRM_BRANCHE ? 'https://xrlfedosaqtffraadmgk.supabase.co' : '')
export const PLATEFORME_CLE = import.meta.env.VITE_PLATEFORME_CLE || (CRM_BRANCHE ? 'sb_publishable_fpHQmPBtF_4pFMaOnBIKXQ_7KcmvjeX' : '')
export const PLATEFORME_BRANCHEE = !!(PLATEFORME_URL && PLATEFORME_CLE)
// Fonctions serveur du SaaS (/api/…) : même règle, jamais le vrai site depuis une démo ou un aperçu
export const SAAS_ORIGINE = import.meta.env.VITE_SAAS_ORIGINE || (CRM_BRANCHE ? 'https://saas.agence-elite.fr' : '')
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

// Ouvre la porte pour DUREE_MS (connexion super admin vérifiée par la plateforme)
export function ouvrirPorte(stockage = globalThis.localStorage, maintenant = Date.now()) {
  try {
    stockage.setItem(CLE, String(maintenant + DUREE_MS))
  } catch {
    /* stockage indisponible : la porte se rouvrira à la prochaine connexion */
  }
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
