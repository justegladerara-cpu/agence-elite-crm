// Factures et devis : numérotation, totaux, statut, montant en lettres.
import { today, addDays } from '../../lib/dates'

// Nombre saisi : accepte « 150 000 », « 12,5 »… (espaces et virgule)
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export const TYPES = {
  facture: { label: 'Facture', titre: 'FACTURE', prefixe: 'prefixeFacture' },
  devis: { label: 'Devis', titre: 'DEVIS', prefixe: 'prefixeDevis' },
}

// Numéro suivant : préfixe + année + 6 chiffres (ex. FAC-2026000204)
// dejaPris : numéros qui ne doivent jamais revenir même si leur document n'existe plus (paiements qui citent
// une facture supprimée, documents de la corbeille) : un numéro n'est jamais réattribué (SEC-08)
export function nextNumero(documents, type, fact, date = today(), dejaPris = []) {
  const prefix = `${fact[TYPES[type].prefixe] || ''}${date.slice(0, 4)}`
  let max = 0
  // Même préfixe pour factures et devis : une seule suite de numéros
  const memePrefixe = (fact.prefixeFacture || '') === (fact.prefixeDevis || '')
  const lire = (numero) => {
    const n = parseInt(String(numero).slice(prefix.length), 10)
    if (!isNaN(n)) max = Math.max(max, n)
  }
  documents.filter((d) => (d.type === type || (memePrefixe && TYPES[d.type])) && (d.numero || '').startsWith(prefix)).forEach((d) => lire(d.numero))
  dejaPris.filter((x) => typeof x === 'string' && x.startsWith(prefix)).forEach(lire)
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

// Numéros à ne jamais réattribuer : ceux que citent des paiements, et ceux des documents mis à la corbeille
export function numerosDejaPris(actions = [], corbeille = []) {
  const cites = actions.filter((a) => a.facture).map((a) => String(a.facture).trim())
  const jetes = corbeille.flatMap((x) => (x.contenu?.documents || []).map((d) => d.numero)).filter(Boolean)
  return [...cites, ...jetes]
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
  n = Math.floor(Math.abs(n))
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
const CENTIMES = { EUR: 'centimes', USD: 'cents', CAD: 'cents', MAD: 'centimes' }
export function montantEnLettres(n, code) {
  n = Math.abs(Number(n) || 0)
  // Francs CFA : pas de décimales
  if (code === 'XAF' || code === 'XOF' || !CENTIMES[code]) n = Math.round(n)
  let ent = Math.floor(n)
  let cts = Math.round((n - ent) * 100)
  if (cts === 100) {
    ent += 1
    cts = 0
  }
  const s = enLettres(ent)
  const nom = ent < 2 ? (NOM_DEVISE[code] || '').replace(/s\b/g, '') : NOM_DEVISE[code] || ''
  let out = s.charAt(0).toUpperCase() + s.slice(1)
  if (nom) out += ent >= 1e6 && ent % 1e6 === 0 ? (/^[aeiou]/i.test(nom) ? ` d'${nom}` : ` de ${nom}`) : ` ${nom}`
  if (cts) out += ` et ${enLettres(cts)} ${CENTIMES[code]}`
  return out
}
