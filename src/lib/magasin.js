// Magasin : articles (documents de type « produit »), ventes au comptoir, statistiques de ventes.
import { num, totals, nextNumero, nouveauDoc, paiementsDe } from './invoice'
import { today, nowTime, addDays } from './dates'

export const CATEGORIES_ARTICLES = ['EPI et sécurité', 'Outillage à main', 'Outillage électrique', 'Consommables', 'Quincaillerie', 'Levage et manutention', 'Lubrifiants', 'Électricité', 'Autre']
export const A_CREDIT = 'À crédit'

// Articles : un document « produit » par article
export const articlesDe = (documents) =>
  documents
    .filter((d) => d.type === 'produit' && !d.data?.archive)
    .map((d) => ({ id: d.id, numero: d.numero, doc: d, ...d.data, prix: num(d.data?.prix), stock: num(d.data?.stock), seuil: num(d.data?.seuil) }))
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))

export function nextRef(documents) {
  let max = 0
  documents.filter((d) => d.type === 'produit').forEach((d) => {
    const n = parseInt(String(d.numero).replace(/\D/g, ''), 10)
    if (!isNaN(n)) max = Math.max(max, n)
  })
  return `ART-${String(max + 1).padStart(4, '0')}`
}

export const enAlerte = (a) => a.stock <= Math.max(0, a.seuil)
export const statutStock = (a) => (a.stock <= 0 ? ['Rupture', 'b-red'] : enAlerte(a) ? ['Stock bas', 'b-orange'] : [`${a.stock} en stock`, 'b-green'])

// Photo prise au téléphone : réduite pour rester légère (≈ 30 Ko)
export function photoArticle(file, max = 480) {
  return new Promise((ok, ko) => {
    if (!file || !/^image\//.test(file.type)) return ko(new Error('Choisis une photo (JPG, PNG…)'))
    const r = new FileReader()
    r.onerror = () => ko(new Error('Photo illisible'))
    r.onload = () => {
      const img = new Image()
      img.onerror = () => ko(new Error('Photo illisible'))
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * f))
        c.height = Math.max(1, Math.round(img.height * f))
        const g = c.getContext('2d')
        g.fillStyle = '#fff'
        g.fillRect(0, 0, c.width, c.height)
        g.drawImage(img, 0, 0, c.width, c.height)
        ok(c.toDataURL('image/jpeg', 0.72))
      }
      img.src = r.result
    }
    r.readAsDataURL(file)
  })
}

// Vente au comptoir : une facture, son paiement (sauf vente à crédit) et la baisse du stock
export async function enregistrerVente({ panier, client, mode, vendeur, remise }, { documents, settings, api }) {
  const fact = settings.facturation
  const numero = nextNumero(documents, 'facture', fact)
  const lignes = panier.map((l) => ({ designation: l.nom, description: l.ref || '', qte: l.qte, pu: l.prix, produitId: l.id }))
  const credit = mode === A_CREDIT
  const doc = await api.saveDoc({
    type: 'facture',
    numero,
    prospect_id: null,
    data: {
      ...nouveauDoc('facture', fact),
      objet: 'Vente au comptoir',
      client: { nom: client?.trim() || 'Client comptoir', adresse: '' },
      lignes,
      remise: num(remise) || '',
      echeance: credit ? addDays(today(), 30) : today(),
      vente: { vendeur: vendeur || '', mode, heure: nowTime() },
    },
  })
  const total = totals(doc.data).total
  if (!credit && total > 0)
    await api.addActions([{ prospect_id: null, date: today(), time: nowTime(), canal: 'Autre', action: 'Paiement reçu', montant: total, mode, facture: numero, notes: 'Vente au comptoir' }])
  // Stock : on retire les quantités vendues
  for (const l of panier) {
    const p = documents.find((d) => d.id === l.id)
    if (p) await api.saveDoc({ ...p, data: { ...p.data, stock: num(p.data?.stock) - num(l.qte) } })
  }
  return { doc, total }
}

// ---------- Statistiques ----------
// Ventes = factures non annulées ; montant = total de la facture
export function ventesDe(documents, actions) {
  return documents
    .filter((d) => d.type === 'facture' && !d.data?.annulee)
    .map((d) => {
      const t = totals(d.data || {})
      const paye = paiementsDe(d, actions).reduce((m, a) => m + num(a.montant), 0)
      const date = d.data?.date || (d.created_at || '').slice(0, 10)
      const heure = d.data?.vente?.heure || (d.created_at ? new Date(d.created_at).toTimeString().slice(0, 5) : '')
      return { doc: d, numero: d.numero, date, heure, client: d.data?.client?.nom || '', total: t.total, lignes: t.lignes, paye, reste: Math.max(0, t.total - paye), vendeur: d.data?.vente?.vendeur || '', mode: d.data?.vente?.mode || '', created: d.created_at || '' }
    })
    .sort((a, b) => `${b.date} ${b.heure}`.localeCompare(`${a.date} ${a.heure}`) || b.created.localeCompare(a.created))
}

export function periodeBornes(p, ref = today()) {
  if (p === 'jour') return [ref, ref]
  if (p === 'hier') return [addDays(ref, -1), addDays(ref, -1)]
  if (p === '7j') return [addDays(ref, -6), ref]
  if (p === 'mois') return [`${ref.slice(0, 7)}-01`, ref]
  if (p === 'annee') return [`${ref.slice(0, 4)}-01-01`, ref]
  return ['0000-01-01', ref]
}
export const dansPeriode = (date, [a, b]) => !!date && date >= a && date <= b
