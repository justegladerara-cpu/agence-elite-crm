// Pont vers la plateforme SaaS (saas.agence-elite.fr) : le CRM est le centre d'administration d'Agence Elite.
// Le CRM se connecte à la base de la plateforme avec le compte super admin (identifiant + mot de passe du SaaS,
// puis code à 6 chiffres si la double authentification est activée sur ce compte).
// Aucune clé secrète : la clé est la clé publique de la plateforme, et chaque fonction de la base vérifie
// elle-même que la personne connectée est super admin ET, depuis le 19/10/2026, que la session est validée par le
// code (aal2), encore ouverte et récente (migration 20261019000142 du dépôt de la plateforme).
// Session gardée pour CET ONGLET seulement (sessionStorage), sous une clé à part : fermer l'onglet la termine.
// C'est une première marche vers un pont côté serveur (audit SEC-02) : un jeton super admin ne reste plus des
// semaines dans le stockage permanent du navigateur.
import { createClient } from '@supabase/supabase-js'
import { PLATEFORME_CLE, PLATEFORME_URL } from '../../lib/porte'

export const CLE_SESSION = 'aecrm-plateforme'
let client = null

const stockageOnglet = () => {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

// Sessions gardées avant le 19/10/2026 dans le stockage permanent : effacées (il faudra se reconnecter une fois).
export function oublierAncienneSession(stockage = globalThis.localStorage) {
  try {
    for (const cle of [CLE_SESSION, `${CLE_SESSION}-code-verifier`, `${CLE_SESSION}-user`]) stockage?.removeItem(cle)
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}

export function clientPlateforme() {
  if (!client) {
    oublierAncienneSession()
    client = createClient(PLATEFORME_URL, PLATEFORME_CLE, {
      auth: { storageKey: CLE_SESSION, storage: stockageOnglet(), persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}

// Messages de la base traduits en phrases simples
export function messagePlateforme(e) {
  const m = String(e?.message || e || '')
  if (/double authentification|aal2/i.test(m)) return 'Code de double authentification requis : reconnecte-toi.'
  if (/super.?admin|réservé|reserve|permission|not allowed|42501/i.test(m)) return 'Ce compte n’est pas super admin de la plateforme, ou sa session doit être revalidée.'
  if (/JWT|session|expired|refresh/i.test(m)) return 'Connexion à la plateforme expirée : reconnecte-toi.'
  if (/fetch|network|Failed to|réseau/i.test(m)) return 'Plateforme injoignable : vérifie internet puis réessaie.'
  return m || 'La plateforme a refusé l’opération.'
}

export async function appeler(fonction, args = {}) {
  const { data, error } = await clientPlateforme().rpc(fonction, args)
  if (error) throw new Error(messagePlateforme(error))
  return data
}

const journaliser = (c, evenement, details = {}) =>
  c
    .rpc('journaliser_securite', { p_evenement: evenement, p_details: { source: 'crm', ...details } })
    .then(
      () => {},
      () => {},
    )

// Code à 6 chiffres attendu ? (compte avec un téléphone enrôlé, session encore au niveau aal1)
export async function codeRequis(c = clientPlateforme()) {
  try {
    const { data } = await c.auth.mfa.getAuthenticatorAssuranceLevel()
    return Boolean(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2')
  } catch {
    return false
  }
}

// État décidé par la base (null si la base n'a pas encore la fonction : ancien comportement).
async function etatSecurite(c) {
  try {
    const { data, error } = await c.rpc('mon_etat_securite')
    return error ? null : data
  } catch {
    return null
  }
}

async function terminer(c) {
  const etat = await etatSecurite(c)
  if (etat?.enrolement_requis) {
    await c.auth.signOut()
    throw new Error('Double authentification obligatoire : active-la d’abord sur saas.agence-elite.fr, puis reviens ici.')
  }
  if (!(await estSuperAdmin(c))) {
    await c.auth.signOut()
    throw new Error('Ce compte n’est pas super admin de la plateforme.')
  }
  await journaliser(c, 'connexion_admin')
  return { etape: 'ok' }
}

// Connexion par identifiant (comme sur le SaaS) ou par e-mail.
// Renvoie { etape: 'code' } quand le code à 6 chiffres doit être saisi (voir verifierCode), sinon { etape: 'ok' }.
export async function connecter(identifiant, motDePasse, c = clientPlateforme()) {
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
  if (await codeRequis(c)) return { etape: 'code' }
  return terminer(c)
}

// Deuxième étape : code de l'application d'authentification. Supabase renouvelle alors la session (aal2).
export async function verifierCode(code, c = clientPlateforme()) {
  const propre = String(code || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(propre)) throw new Error('Le code contient 6 chiffres.')
  const { data } = await c.auth.mfa.listFactors()
  const facteur = (data?.totp || []).find((f) => f.status === 'verified')
  if (!facteur) throw new Error('Aucun téléphone enregistré sur ce compte.')
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId: facteur.id, code: propre })
  if (error) {
    await journaliser(c, 'mfa_code_refuse')
    throw new Error(/rate|limit|too many/i.test(error.message) ? 'Trop d’essais : patiente quelques minutes.' : 'Code incorrect ou expiré : vérifie l’heure du téléphone et réessaie.')
  }
  await journaliser(c, 'mfa_code_accepte')
  return terminer(c)
}

export async function estSuperAdmin(c = clientPlateforme()) {
  try {
    const { data, error } = await c.rpc('est_super_admin')
    return !error && data === true
  } catch {
    return false
  }
}

// Session encore valable dans cet onglet (rafraîchie si besoin), validée par le code si besoin, et toujours super admin
export async function sessionValide(c = clientPlateforme()) {
  try {
    const { data } = await c.auth.getSession()
    if (!data?.session) return false
    if (await codeRequis(c)) return false
    return estSuperAdmin(c)
  } catch {
    return false
  }
}

export async function deconnecter(c = clientPlateforme()) {
  try {
    await c.auth.signOut()
  } catch {
    /* déjà déconnecté */
  }
}
