// Calculs financiers : module unique (règles dans docs/superadmin-v2/08_FINANCIAL_RULES.md).
// Toute somme d'argent du CRM passe par ici : lecture d'un montant saisi, période, encaissé, dépenses, résultat.
// Les montants de la plateforme (licences) gardent leur devise : voir lib/argent.js (jamais additionnés entre devises).

// R1. Montant saisi : « 150 000 », « 12,5 », 12.5 → nombre ; vide ou illisible → 0
export function montant(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'boolean') return Number(v)
  const n = Number(String(v).replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// R2. Ce qui compte comme entrée et comme sortie
export const estPaiement = (a) => a?.action === 'Paiement reçu'
export const estDepense = (a) => a?.action === 'Dépense'

// R3. Période : dates « AAAA-MM-JJ », bornes incluses ; un mois = « AAAA-MM »
export const moisDe = (date) => String(date || '').slice(0, 7)
export const dansPeriode = (date, { debut, fin, mois } = {}) => {
  const d = String(date || '').slice(0, 10)
  if (!d) return false
  if (mois) return moisDe(d) === mois
  return (!debut || d >= debut) && (!fin || d <= fin)
}

const somme = (liste) => liste.reduce((s, a) => s + montant(a.montant), 0)

// R4. Encaissé : paiements reçus dont la date est dans la période (date du paiement, pas celle de la facture)
export const paiementsDans = (actions = [], periode) => actions.filter((a) => estPaiement(a) && dansPeriode(a.date, periode))
export const encaisse = (actions, periode) => somme(paiementsDans(actions, periode))

// R5. Dépenses notées dans la période
export const depensesDans = (actions = [], periode) => actions.filter((a) => estDepense(a) && dansPeriode(a.date, periode))
export const depenses = (actions, periode) => somme(depensesDans(actions, periode))

// R6. Résultat de la période = encaissé − dépenses notées − charges fixes du mois (comptées une fois par mois)
export function resultat(actions, periode, chargesFixes = 0) {
  const e = encaisse(actions, periode)
  const d = depenses(actions, periode)
  const net = e - d - montant(chargesFixes)
  return { encaisse: e, depenses: d, chargesFixes: montant(chargesFixes), net, marge: e ? net / e : null }
}

// R7. Arrondi d'affichage selon la devise (FCFA sans décimales) ; les calculs gardent la valeur exacte
export const arrondi = (v, decimales = 0) => {
  const f = 10 ** decimales
  return Math.round(montant(v) * f) / f
}
