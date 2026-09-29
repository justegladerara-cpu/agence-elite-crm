// Journal d'événements (Lot B) : lu dans la table `events` écrite par la base, avec repli sur le calcul local.
// Rien n'est remplacé : l'historique des actions reste tel quel ; le journal ajoute une chronologie complète
// (étapes, paiements, dépenses, devis, factures) et se vérifie contre les données chargées.
import { supabase, isLocal, espaceActif } from '../lib/store'
import { evenements } from './events'

export const LIBELLE = {
  'prospect.created': 'Fiche créée',
  'prospect.contacted': 'Contact',
  'prospect.qualified': 'Qualifié',
  'prospect.demo': 'Audit / démo',
  'appointment.created': 'Rendez-vous',
  'proposal.sent': 'Proposition envoyée',
  'client.won': 'Gagné',
  'client.upsell': 'Vente additionnelle',
  'prospect.lost': 'Perdu',
  'payment.received': 'Paiement reçu',
  'expense.created': 'Dépense',
  'quote.created': 'Devis',
  'invoice.created': 'Facture',
  'store.order': 'Commande boutique',
  'site.contact': 'Demande site web',
}

// Ligne de la table → même forme que core/events.js
export const depuisLigne = (e) => ({
  id: e.source,
  type: e.type,
  date: e.date,
  acteur: e.acteur,
  module: e.module,
  entite: e.entite,
  entiteId: e.entite_id,
  meta: e.meta || {},
  correlationId: e.correlation_id,
  version: e.version,
  modifieLe: e.modifie_le,
})

const duProspect = (liste, prospectId) => (prospectId ? liste.filter((e) => e.meta?.prospectId === prospectId) : liste)
const tri = (a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id)

// Même fait métier mais contenu différent (date, montant, client, facture, numéro) : modification pas encore reflétée
const v = (x) => (x === undefined || x === '' ? null : x)
export const contenuDifferent = (s, d) =>
  s.type !== d.type ||
  v(s.date) !== v(d.date) ||
  (Number(s.meta?.montant) || 0) !== (Number(d.meta?.montant) || 0) ||
  ['prospectId', 'facture', 'numero'].some((k) => v(s.meta?.[k]) !== v(d.meta?.[k]))

// Journal du serveur complété par ce qui est encore sur l'appareil (modifs pas encore envoyées),
// sans ce qui a été supprimé localement. Le calcul local fait foi pour la présence ; le serveur pour le contenu,
// sauf s'il diffère encore (modification en cours d'envoi) : on montre alors l'état local.
export function fusionner(serveur, derives) {
  const parId = new Map(serveur.map((e) => [e.id, e]))
  return derives
    .map((d) => {
      const s = parId.get(d.id)
      if (!s) return d
      return contenuDifferent(s, d) ? { ...d, version: s.version, modifieLe: s.modifieLe } : s
    })
    .sort(tri)
}

// Écarts entre le journal du serveur et le calcul local : manquants, en trop, type ou contenu différent, montants
export function comparerJournal(serveur, derives) {
  const s = new Map(serveur.map((e) => [e.id, e]))
  const d = new Map(derives.map((e) => [e.id, e]))
  const somme = (l, t) => l.filter((e) => e.type === t).reduce((x, e) => x + (Number(e.meta?.montant) || 0), 0)
  const parType = {}
  derives.forEach((e) => (parType[e.type] = [(parType[e.type]?.[0] || 0) + 1, parType[e.type]?.[1] || 0]))
  serveur.forEach((e) => (parType[e.type] = [parType[e.type]?.[0] || 0, (parType[e.type]?.[1] || 0) + 1]))
  return {
    manquants: derives.filter((e) => !s.has(e.id)).map((e) => e.id),
    enTrop: serveur.filter((e) => !d.has(e.id)).map((e) => e.id),
    typeDifferent: derives.filter((e) => s.has(e.id) && s.get(e.id).type !== e.type).map((e) => e.id),
    contenuDifferent: derives.filter((e) => s.has(e.id) && s.get(e.id).type === e.type && contenuDifferent(s.get(e.id), e)).map((e) => e.id),
    paiements: [somme(derives, 'payment.received'), somme(serveur, 'payment.received')],
    depenses: [somme(derives, 'expense.created'), somme(serveur, 'expense.created')],
    parType,
  }
}

async function lireServeur(prospectId) {
  const w = await espaceActif()
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('events').select('source, type, date, acteur, module, entite, entite_id, meta, correlation_id, version, modifie_le').eq('annule', false)
    if (w) q = q.eq('workspace_id', w)
    if (prospectId) q = q.eq('meta->>prospectId', prospectId)
    const { data, error } = await q.order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...data.map(depuisLigne))
    if (data.length < 1000) break
  }
  return out
}

// { source: 'journal' | 'calcul', liste, serveur? } ; ne lève jamais d'erreur
export async function lireJournal({ prospectId, actions = [], documents = [] } = {}) {
  const derives = duProspect(evenements(actions, documents), prospectId)
  if (isLocal || !supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return { source: 'calcul', liste: derives }
  try {
    const serveur = await lireServeur(prospectId)
    return { source: 'journal', liste: fusionner(serveur, derives), serveur, derives }
  } catch {
    return { source: 'calcul', liste: derives }
  }
}
