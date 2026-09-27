// Import des factures et devis exportés de Zoho Invoice (CSV ou Excel), sans connexion ni mot de passe.
import * as XLSX from 'xlsx'
import { num } from './invoice'

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%#]+/g, ' ')
    .trim()

// Noms de colonnes possibles (export Zoho en anglais ou en français)
const COLS = {
  numero: ['invoice number', 'invoice#', 'invoice #', 'numero de facture', 'n de facture', 'facture#', 'facture #', 'estimate number', 'estimate#', 'numero de devis', 'devis#', 'quote number', 'numero du devis'],
  date: ['invoice date', 'date de facture', 'date de la facture', 'estimate date', 'date du devis', 'date de devis', 'date'],
  echeance: ['due date', 'date d echeance', 'date echeance', 'echeance', 'expiry date', 'date d expiration', 'expiration date'],
  statut: ['invoice status', 'statut de la facture', 'estimate status', 'statut du devis', 'statut', 'status'],
  client: ['customer name', 'nom du client', 'client', 'display name', 'nom affiche', 'company name', 'nom de l entreprise'],
  article: ['item name', 'nom de l article', 'article', 'product name', 'nom de l element'],
  description: ['item desc', 'item description', 'description de l article', 'description'],
  qte: ['quantity', 'quantite', 'qte'],
  pu: ['item price', 'prix de l article', 'rate', 'prix unitaire', 'taux', 'prix'],
  totalLigne: ['item total', 'total de l article', 'montant de l article'],
  tva: ['item tax %', 'item tax', 'taxe de l article %', 'taxe %', 'tax %', 'tax percentage'],
  remise: ['entity discount amount', 'montant de la remise', 'discount amount', 'remise'],
  total: ['total', 'montant total', 'total amount'],
  solde: ['balance', 'solde', 'balance due', 'solde du', 'montant du'],
  notes: ['notes', 'customer notes', 'notes client', 'notes du client'],
  objet: ['subject', 'objet'],
}

const MOIS = { jan: 1, janv: 1, feb: 2, fev: 2, mar: 3, mars: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, juin: 6, jul: 7, juil: 7, aug: 8, aou: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
const p2 = (n) => String(n).padStart(2, '0')
export function dateZoho(v) {
  if (!v) return ''
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${p2(d.m)}-${p2(d.d)}` : ''
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}`
  m = norm(s).match(/^(\d{1,2}) ([a-z]+) (\d{4})/)
  const mois = m && (MOIS[m[2].slice(0, 4)] || MOIS[m[2].slice(0, 3)])
  if (mois) return `${m[3]}-${p2(mois)}-${p2(m[1])}`
  return ''
}

export function lireZoho(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })
  if (!rows.length) throw new Error('Fichier vide.')
  const headers = Object.keys(rows[0])
  const col = {}
  Object.entries(COLS).forEach(([k, noms]) => {
    const h = noms.map((n) => headers.find((x) => norm(x) === n)).find(Boolean)
    if (h) col[k] = h
  })
  if (!col.numero || !col.client) throw new Error('Colonnes « numéro » et « client » introuvables : exporte les factures ou les devis depuis Zoho Invoice (CSV ou XLSX).')
  const type = headers.some((h) => /estimate|devis|quote/.test(norm(h))) ? 'devis' : 'facture'
  const get = (r, k) => (col[k] ? r[col[k]] : '')
  const docs = new Map()
  rows.forEach((r) => {
    const numero = String(get(r, 'numero')).trim()
    if (!numero) return
    if (!docs.has(numero)) {
      docs.set(numero, {
        numero,
        date: dateZoho(get(r, 'date')),
        echeance: dateZoho(get(r, 'echeance')),
        statut: norm(get(r, 'statut')),
        client: String(get(r, 'client')).trim(),
        remise: num(get(r, 'remise')),
        tva: num(String(get(r, 'tva')).replace('%', '')),
        total: col.total ? num(get(r, 'total')) : null,
        solde: col.solde ? num(get(r, 'solde')) : null,
        notes: String(get(r, 'notes') || '').trim(),
        objet: String(get(r, 'objet') || '').trim(),
        lignes: [],
      })
    }
    const d = docs.get(numero)
    const designation = String(get(r, 'article') || '').trim()
    const qte = num(get(r, 'qte')) || 1
    const pu = col.pu ? num(get(r, 'pu')) : num(get(r, 'totalLigne')) / qte
    if (designation || pu) d.lignes.push({ designation: designation || 'Prestation', description: String(get(r, 'description') || '').trim(), qte, pu })
  })
  const liste = [...docs.values()].map((d) => {
    // Pas de ligne détaillée : une ligne avec le total
    if (!d.lignes.length) d.lignes.push({ designation: 'Prestation', description: '', qte: 1, pu: d.total || 0 })
    return d
  })
  const ignorees = Object.keys(COLS).filter((k) => !col[k])
  return { type, docs: liste, colonnes: col, manquantes: ignorees }
}

// Statut Zoho → statut du CRM
export const zohoPaye = (d, total) => {
  if (/void|annul/.test(d.statut)) return 0
  if (d.solde !== null && d.solde !== undefined) return Math.max(0, total - d.solde)
  return /paid|paye/.test(d.statut) && !/partial|partiel/.test(d.statut) ? total : 0
}
export const zohoAnnulee = (d) => /void|annul/.test(d.statut)
export const zohoDevisStatut = (d) => (/accept|invoiced|factur/.test(d.statut) ? 'Accepté' : /declin|refus|reject/.test(d.statut) ? 'Refusé' : '')
