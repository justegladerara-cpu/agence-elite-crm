// Messages d'erreur compréhensibles et suivi des erreurs de l'application (table client_errors)
import { supabase } from './store'

// Traduit une erreur technique en phrase utile
export function messageErreur(e) {
  const m = String(e?.message || e || '')
  if (navigator.onLine === false || /failed to fetch|network|load failed|timed? ?out/i.test(m))
    return 'Pas de connexion. Ta saisie est gardée sur le téléphone et partira toute seule.'
  if (/jwt|token|session expir|401|auth/i.test(m)) return 'Ta session a expiré. Reconnecte-toi : tes saisies en attente sont conservées.'
  if (/23505|duplicate key|unique/i.test(m)) return 'Cet élément existe déjà.'
  if (/42501|row-level security|permission denied/i.test(m)) return "Cette donnée n'appartient pas à ton compte."
  if (/mémoire de l'appareil|quota/i.test(m)) return m
  return `Une erreur est survenue : ${m || 'inconnue'}. Réessaie ; si ça continue, elle est déjà signalée.`
}

// Envoi des erreurs JavaScript : au plus 20 par session, sans doublon
const vues = new Set()
let envoyees = 0
export function signaler(message, extra = {}) {
  if (!supabase || envoyees >= 20) return
  const cle = `${message}|${extra.source || ''}`
  if (vues.has(cle)) return
  vues.add(cle)
  envoyees++
  supabase
    .from('client_errors')
    .insert({
      message: String(message).slice(0, 500),
      stack: String(extra.stack || '').slice(0, 2000),
      page: location.hash.slice(0, 200),
      agent: navigator.userAgent.slice(0, 300),
      version: import.meta.env.VITE_VERSION || '',
    })
    .then(
      () => {},
      () => {},
    )
}

export function installerSuiviErreurs() {
  if (typeof window === 'undefined' || window.__suiviErreurs) return
  window.__suiviErreurs = true
  window.addEventListener('error', (e) => {
    // Erreurs de chargement de script ou d'extensions du navigateur : sans intérêt
    if (!e.message || /ResizeObserver loop/i.test(e.message)) return
    signaler(e.message, { stack: e.error?.stack, source: `${e.filename}:${e.lineno}` })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    const m = String(r?.message || r || '')
    // Erreurs réseau et de session déjà affichées à l'utilisateur
    if (!m || /fetch|network|load failed|jwt|token/i.test(m)) return
    signaler(m, { stack: r?.stack })
  })
}
