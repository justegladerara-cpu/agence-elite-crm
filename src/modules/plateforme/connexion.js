// Pont vers la plateforme SaaS (saas.agence-elite.fr) : le CRM est le centre d'administration d'Agence Elite.
// Le CRM se connecte à la base de la plateforme avec le compte super admin (identifiant + mot de passe du SaaS).
// Aucune clé secrète : la clé est la clé publique de la plateforme, et chaque fonction de la base vérifie
// elle-même que la personne connectée est super admin. La session est gardée sur cet appareil seulement,
// sous une clé à part (elle ne se mélange pas avec la connexion du CRM).
import { createClient } from '@supabase/supabase-js'
import { PLATEFORME_BRANCHEE, PLATEFORME_CLE, PLATEFORME_URL } from '../../lib/porte'

export const CLE_SESSION = 'aecrm-plateforme'
let client = null

export const MESSAGE_NON_BRANCHEE = 'Mode démo : aucune plateforme n’est branchée (les vraies données ne sont jamais lues ici).'

export function clientPlateforme() {
  if (!PLATEFORME_BRANCHEE) throw new Error(MESSAGE_NON_BRANCHEE)
  if (!client) client = createClient(PLATEFORME_URL, PLATEFORME_CLE, { auth: { storageKey: CLE_SESSION, persistSession: true, autoRefreshToken: true } })
  return client
}

// Messages de la base traduits en phrases simples
export function messagePlateforme(e) {
  const m = String(e?.message || e || '')
  if (/super.?admin|réservé|reserve|permission|not allowed|42501/i.test(m)) return 'Ce compte n’est pas super admin de la plateforme.'
  if (/JWT|session|expired|refresh/i.test(m)) return 'Connexion à la plateforme expirée : reconnecte-toi.'
  if (/fetch|network|Failed to|réseau/i.test(m)) return 'Plateforme injoignable : vérifie internet puis réessaie.'
  return m || 'La plateforme a refusé l’opération.'
}

export async function appeler(fonction, args = {}) {
  const { data, error } = await clientPlateforme().rpc(fonction, args)
  if (error) throw new Error(messagePlateforme(error))
  return data
}

// Connexion par identifiant (comme sur le SaaS) ou par e-mail
export async function connecter(identifiant, motDePasse) {
  const c = clientPlateforme()
  let email = String(identifiant || '').trim()
  if (!email || !motDePasse) throw new Error('Identifiant et mot de passe obligatoires.')
  if (!email.includes('@')) {
    const { data, error } = await c.rpc('resoudre_connexion', { p_identifiant: email, p_mot_de_passe: motDePasse })
    if (error) throw new Error('Connexion impossible pour le moment.')
    if (!data?.ok) throw new Error(data?.message || 'Identifiant ou mot de passe incorrect.')
    email = data.email
  }
  const { error } = await c.auth.signInWithPassword({ email, password: motDePasse })
  if (error) throw new Error(/invalid login credentials/i.test(error.message) ? 'Identifiant ou mot de passe incorrect.' : error.message)
  if (!(await estSuperAdmin())) {
    await c.auth.signOut()
    throw new Error('Ce compte n’est pas super admin de la plateforme.')
  }
  return true
}

export async function estSuperAdmin() {
  try {
    const { data, error } = await clientPlateforme().rpc('est_super_admin')
    return !error && data === true
  } catch {
    return false
  }
}

// Session encore valable sur cet appareil (rafraîchie si besoin) et toujours super admin
export async function sessionValide() {
  try {
    const { data } = await clientPlateforme().auth.getSession()
    if (!data?.session) return false
    return estSuperAdmin()
  } catch {
    return false
  }
}

export async function deconnecter() {
  try {
    await clientPlateforme().auth.signOut()
  } catch {
    /* déjà déconnecté */
  }
}
