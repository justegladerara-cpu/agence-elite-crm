// Événements métier : ce qui s'est produit, dérivé du journal `actions` et des `documents` sans changer la base.
// Forme : { id, type, date, acteur, module, entite, entiteId, meta, correlationId }
// + un petit bus local pour que les modules réagissent sans s'importer entre eux.

const TYPE_ACTION = {
  'Ajout prospect': 'prospect.created',
  'Premier contact': 'prospect.contacted',
  Relance: 'prospect.contacted',
  'Échange / suivi': 'prospect.contacted',
  Qualification: 'prospect.qualified',
  'Audit réalisé': 'prospect.demo',
  'Loom envoyé': 'prospect.demo',
  'Démo présentée': 'prospect.demo',
  RDV: 'appointment.created',
  'Proposition envoyée': 'proposal.sent',
  Signature: 'client.won',
  Intervention: 'client.won',
  Perdu: 'prospect.lost',
  'Paiement reçu': 'payment.received',
  'Vente additionnelle': 'client.upsell',
  Dépense: 'expense.created',
  'Commande boutique': 'store.order',
  'Demande site web': 'site.contact',
}

const MODULE_TYPE = { payment: 'facturation', quote: 'facturation', invoice: 'facturation', expense: 'charges', store: 'store', site: 'site' }
export const moduleDuType = (type) => MODULE_TYPE[type.split('.')[0]] || 'commercial'

// Type d'événement d'une action ; null pour les notes et actions sans portée métier
export const typeAction = (nom) => TYPE_ACTION[nom] || null

export function evenementDAction(a) {
  const type = typeAction(a.action)
  if (!type) return null
  const argent = type === 'payment.received' || type === 'expense.created'
  return {
    id: `action:${a.id}`,
    type,
    date: a.date,
    acteur: a.user_id || null,
    module: moduleDuType(type),
    entite: argent ? (type === 'payment.received' ? 'paiement' : 'depense') : 'prospect',
    entiteId: argent ? a.id : a.prospect_id,
    meta: { action: a.action, canal: a.canal || null, montant: a.montant ?? null, facture: a.facture || null, prospectId: a.prospect_id || null },
    // Un paiement se rattache à sa facture, le reste au prospect
    correlationId: a.facture ? `facture:${a.facture}` : a.prospect_id ? `prospect:${a.prospect_id}` : null,
  }
}

export function evenementDeDocument(d) {
  if (d.type !== 'facture' && d.type !== 'devis') return null
  const type = d.type === 'devis' ? 'quote.created' : 'invoice.created'
  return {
    id: `document:${d.id}`,
    type,
    date: d.data?.date || (d.created_at || '').slice(0, 10),
    acteur: d.user_id || null,
    module: 'facturation',
    entite: d.type,
    entiteId: d.id,
    meta: { numero: d.numero, prospectId: d.prospect_id || null, devisId: d.data?.devisId || null },
    correlationId: d.type === 'facture' ? `facture:${d.numero}` : d.prospect_id ? `prospect:${d.prospect_id}` : null,
  }
}

// Fil chronologique de tous les événements connus
export function evenements(actions = [], documents = []) {
  return [...actions.map(evenementDAction), ...documents.map(evenementDeDocument)].filter(Boolean).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// Bus local : emettre('payment.received', evt) ; ecouter('payment.*', fn) renvoie la fonction de désabonnement
const abonnes = new Set()
const correspond = (motif, type) => motif === '*' || motif === type || (motif.endsWith('.*') && type.startsWith(motif.slice(0, -1)))
export function ecouter(motif, fn) {
  const a = { motif, fn }
  abonnes.add(a)
  return () => abonnes.delete(a)
}
export function emettre(evt) {
  if (!evt) return
  abonnes.forEach((a) => {
    if (!correspond(a.motif, evt.type)) return
    try {
      a.fn(evt)
    } catch (e) {
      console.error('événement', evt.type, e)
    }
  })
}
