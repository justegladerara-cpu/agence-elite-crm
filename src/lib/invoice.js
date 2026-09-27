// Factures et devis : numérotation, totaux, statut, montant en lettres.
import { today, addDays } from './dates'

const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(String(v).replace(',', '.'))) ? 0 : Number(String(v).replace(',', '.')))

export const TYPES = {
  facture: { label: 'Facture', titre: 'FACTURE', prefixe: 'prefixeFacture' },
  devis: { label: 'Devis', titre: 'DEVIS', prefixe: 'prefixeDevis' },
}

// Numéro suivant : préfixe + année + 6 chiffres (ex. FAC-2026000204)
export function nextNumero(documents, type, fact, date = today()) {
  const prefix = `${fact[TYPES[type].prefixe] || ''}${date.slice(0, 4)}`
  let max = 0
  documents
    .filter((d) => d.type === type && (d.numero || '').startsWith(prefix))
    .forEach((d) => {
      const n = parseInt(d.numero.slice(prefix.length), 10)
      if (!isNaN(n)) max = Math.max(max, n)
    })
  const n = Math.max(max + 1, num(fact.premierNumero) || 1)
  return `${prefix}${String(n).padStart(6, '0')}`
}

export function totals(d) {
  const lignes = (d.lignes || []).map((l) => ({ ...l, montant: num(l.qte) * num(l.pu) }))
  const sousTotal = lignes.reduce((m, l) => m + l.montant, 0)
  const remise = num(d.remise)
  const base = Math.max(0, sousTotal - remise)
  const taxes = Math.round((base * num(d.tva)) / 100)
  return { lignes, sousTotal, remise, taxes, total: base + taxes }
}

// Paiements rattachés : actions « Paiement reçu » portant le numéro de la facture
export function paiementsDe(doc, actions) {
  return actions.filter((a) => a.action === 'Paiement reçu' && a.facture && a.facture === doc.numero)
}

export function statutDe(doc, actions) {
  const d = doc.data || {}
  const { total } = totals(d)
  if (doc.type === 'devis') {
    if (d.statut === 'Accepté' || d.statut === 'Refusé') return d.statut
    if (d.validite && d.validite < today()) return 'Expiré'
    return 'En attente'
  }
  if (d.annulee) return 'Annulée'
  const paye = paiementsDe(doc, actions).reduce((m, a) => m + num(a.montant), 0)
  if (total > 0 && paye >= total) return 'Payée'
  if (d.echeance && d.echeance < today()) return 'En retard'
  if (paye > 0) return 'Partiellement payée'
  return 'En attente'
}

export const STATUT_TONE = {
  Payée: 'b-green',
  Accepté: 'b-green',
  'En retard': 'b-red',
  Refusé: 'b-Perdu',
  Annulée: 'b-Perdu',
  Expiré: 'b-Perdu',
  'Partiellement payée': 'b-orange',
  'En attente': 'b-gold',
}

export function nouveauDoc(type, fact, extra = {}) {
  const date = today()
  return {
    date,
    echeance: type === 'facture' ? addDays(date, num(fact.delaiPaiement)) : '',
    validite: type === 'devis' ? addDays(date, num(fact.validiteDevis) || 30) : '',
    objet: '',
    client: { nom: '', adresse: '' },
    lignes: [{ designation: '', description: '', qte: 1, pu: '' }],
    remise: '',
    tva: fact.tva || 0,
    conditions: type === 'facture' ? fact.conditions : `Devis valable ${num(fact.validiteDevis) || 30} jours`,
    notes: type === 'facture' ? fact.notes : 'Merci de votre confiance. Bon pour accord : date, signature et cachet.',
    paiement: fact.paiement,
    ...extra,
  }
}

// ---------- Montant en lettres ----------
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
const D = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function sous100(n) {
  if (n <= 16) return U[n]
  if (n < 20) return `dix-${U[n - 10]}`
  if (n < 70) {
    const d = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? D[d] : u === 1 ? `${D[d]} et un` : `${D[d]}-${U[u]}`
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${sous100(n - 60)}`
  if (n === 80) return 'quatre-vingts'
  return `quatre-vingt-${sous100(n - 80)}`
}
function sous1000(n) {
  const c = Math.floor(n / 100)
  const r = n % 100
  let s = ''
  if (c === 1) s = 'cent'
  else if (c > 1) s = `${U[c]} cent${r === 0 ? 's' : ''}`
  if (r) s = s ? `${s} ${sous100(r)}` : sous100(r)
  return s
}
export function enLettres(n) {
  n = Math.round(Math.abs(n))
  if (n === 0) return 'zéro'
  const parts = []
  const milliards = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const milliers = Math.floor((n % 1e6) / 1000)
  const reste = n % 1000
  if (milliards) parts.push(`${sous1000(milliards)} milliard${milliards > 1 ? 's' : ''}`)
  if (millions) parts.push(`${sous1000(millions)} million${millions > 1 ? 's' : ''}`)
  if (milliers) parts.push(milliers === 1 ? 'mille' : `${sous1000(milliers).replace(/(cent|vingt)s$/, '$1')} mille`)
  if (reste) parts.push(sous1000(reste))
  return parts.join(' ')
}
const NOM_DEVISE = { XAF: 'francs CFA', XOF: 'francs CFA', EUR: 'euros', USD: 'dollars', MAD: 'dirhams', CAD: 'dollars canadiens' }
export function montantEnLettres(n, code) {
  const s = enLettres(n)
  const de = Math.round(n) >= 1e6 && Math.round(n) % 1e6 === 0 ? 'de ' : ''
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${de}${NOM_DEVISE[code] || ''}`.trim()
}
