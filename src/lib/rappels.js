// Rappels sur le téléphone : abonnement de l'appareil et liste des rappels envoyés par le service (Supabase)
import { supabase, isLocal } from './store'
import { today, addDays, parse } from './dates'
import { statutDe } from './invoice'

export const rappelsDispo = () => !isLocal && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// iPhone : les notifications ne marchent que dans l'appli installée sur l'écran d'accueil
export const iosSansInstall = () => /iPhone|iPad/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches

const b64 = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
const appareil = () => (/iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : /Android/i.test(navigator.userAgent) ? 'Android' : 'Ordinateur')

async function fn(action) {
  const { data, error } = await supabase.functions.invoke('rappels', { body: { action } })
  if (error) throw new Error(error.message)
  return data
}

export async function abonnementActuel() {
  if (!rappelsDispo()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function activerRappels() {
  if (!rappelsDispo()) throw new Error('Ce navigateur ne gère pas les notifications.')
  if (iosSansInstall()) throw new Error("Sur iPhone, ajoute d'abord le CRM à l'écran d'accueil (Partager > Sur l'écran d'accueil), puis ouvre-le depuis l'icône.")
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications refusées : autorise-les dans les réglages du navigateur pour ce site.')
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const { cle } = await fn('cle')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cle) })
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, keys: j.keys, appareil: appareil() }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

export async function desactiverRappels() {
  const sub = await abonnementActuel()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export const testerRappels = () => fn('test')

// Rappels des 14 prochains jours : relances (à l'heure de rappel, sinon à l'heure par défaut) et échéances de factures
export function listeRappels(data, settings, documents, actions) {
  const t = today()
  const fin = addDays(t, 14)
  const heureDef = settings.rappels?.heureDefaut || '09:00'
  const quand = (d, h) => {
    const [hh, mm] = (h || heureDef).split(':').map(Number)
    const x = parse(d)
    x.setHours(hh || 0, mm || 0, 0, 0)
    return x
  }
  const out = []
  data.list.forEach((p) => {
    if (!p.relance || p.relance < t || p.relance > fin || p.etape === 'Gagné' || p.etape === 'Perdu') return
    out.push({ cle: `relance-${p.id}-${p.relance}-${p.heureRappel || ''}`, quand: quand(p.relance, p.heureRappel), titre: `${p.etape === 'RDV' ? 'RDV' : 'Relance'} : ${p.name}`, corps: p.prochaineAction || 'À relancer aujourd\'hui', url: `/#/prospect/${p.id}` })
  })
  // Résumé du matin : relances en retard
  const retard = data.list.filter((p) => p.relance && p.relance < t && p.etape !== 'Gagné' && p.etape !== 'Perdu').length
  if (retard) out.push({ cle: `retard-${t}`, quand: quand(t), titre: `${retard} relance${retard > 1 ? 's' : ''} en retard`, corps: 'Ouvre Ma journée pour les faire en premier.', url: '/#/journee' })
  documents.forEach((d) => {
    const e = d.data?.echeance
    if (d.type !== 'facture' || !e || e < t || e > fin) return
    const st = statutDe(d, actions)
    if (st === 'Payée' || st === 'Annulée') return
    out.push({ cle: `facture-${d.id}-${e}`, quand: quand(e), titre: `Échéance de la facture ${d.numero}`, corps: `${d.data?.client?.nom || ''} : pense à vérifier le paiement.`, url: `/#/facture/${d.id}` })
  })
  return out.filter((r) => r.quand > new Date())
}

// Met à jour les rappels à venir côté serveur (remplace ceux pas encore envoyés)
let dernier = ''
export async function syncRappels(data, settings, documents, actions) {
  if (!settings.rappels?.actif || isLocal || !navigator.onLine) return
  const rows = listeRappels(data, settings, documents, actions).map((r) => ({ ...r, quand: r.quand.toISOString() }))
  const sig = JSON.stringify(rows)
  if (sig === dernier) return
  const { error: e1 } = await supabase.from('rappels').delete().eq('envoye', false).gt('quand', new Date().toISOString())
  if (e1) return
  if (rows.length) {
    const { error } = await supabase.from('rappels').upsert(rows, { onConflict: 'user_id,cle', ignoreDuplicates: true })
    if (error) return
  }
  dernier = sig
}
