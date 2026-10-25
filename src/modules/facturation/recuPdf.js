// Reçu de paiement en PDF : logo, client, montant (en chiffres et en lettres), moyen de paiement,
// signature et cachet de l'agence. Généré dans le navigateur, comme les factures.
import { jsPDF } from 'jspdf'
import { montantEnLettres, num } from './invoice'
import { loadImg, cachetPaye } from './invoicePdf'
import { getBrand, hexToRgb } from '../../lib/theme'

const clean = (s) => String(s ?? '').replace(/[  ]/g, ' ')
const n0 = (v) => clean(num(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 }))
const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Numéro lisible et stable : REC-AAAAMMJJ-xxxx (fin de l'identifiant du paiement)
export const numeroRecu = (p) => `REC-${String(p.date || '').replace(/-/g, '')}-${String(p.id || '').replace(/-/g, '').slice(-4).toUpperCase() || '0000'}`

// p : { id, date, montant, mode, reference, notes, facture }, client : { nom, telephone }, fact : settings.facturation, code : devise
export async function recuPdf({ p, client = {}, fact = {}, code = 'XAF', reste = null }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a5' })
  const W = 148
  const M = 12
  const R = W - M
  const COUL = hexToRgb(fact.couleur, [230, 0, 0])
  const cur = code === 'EUR' ? '€' : code === 'XAF' || code === 'XOF' ? 'FCFA' : code
  const text = (s, x, y, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal')
    pdf.setFontSize(o.size || 9.5)
    pdf.setTextColor(...(o.color || [17, 17, 17]))
    pdf.text(clean(s), x, y, { align: o.align || 'left', maxWidth: o.maxWidth })
  }
  let y = 12
  const logo = fact.afficherLogo === false ? null : await loadImg(getBrand().logo || `${import.meta.env.BASE_URL}logo-full.png`)
  if (logo) {
    const lw = Math.min(32, 18 / logo.ratio)
    pdf.addImage(logo.url, 'PNG', M, y, lw, lw * logo.ratio)
  } else text(fact.nom || 'Agence Elite', M, y + 8, { bold: true, size: 14 })
  text('REÇU DE PAIEMENT', R, y + 5, { bold: true, size: 12, align: 'right' })
  text(`N° ${numeroRecu(p)}`, R, y + 11, { size: 9, color: [110, 110, 110], align: 'right' })
  text(`Le ${fmtDate(p.date)}`, R, y + 16, { size: 9, color: [110, 110, 110], align: 'right' })
  y += 24
  pdf.setFillColor(...COUL)
  pdf.rect(M, y, R - M, 1.2, 'F')
  y += 9

  text('Reçu de', M, y, { size: 8.5, color: [110, 110, 110] })
  text(client.nom || 'Client', M, y + 5.5, { bold: true, size: 11 })
  if (client.telephone) text(client.telephone, M, y + 10.5, { size: 9 })
  text('Émis par', W / 2 + 4, y, { size: 8.5, color: [110, 110, 110] })
  text(fact.nom || 'Agence Elite', W / 2 + 4, y + 5.5, { bold: true, size: 10 })
  if (fact.telephone) text(fact.telephone, W / 2 + 4, y + 10.5, { size: 9 })
  y += 20

  // Montant
  pdf.setFillColor(245, 247, 250)
  pdf.roundedRect(M, y, R - M, 24, 3, 3, 'F')
  text('Montant reçu', M + 5, y + 8, { size: 9, color: [110, 110, 110] })
  text(`${n0(p.montant)} ${cur}`, M + 5, y + 18, { bold: true, size: 18 })
  const lettres = pdf.splitTextToSize(clean(montantEnLettres(num(p.montant), code)), 62)
  lettres.slice(0, 3).forEach((l, i) => text(l, R - 5, y + 8 + i * 4.5, { size: 8, color: [80, 80, 80], align: 'right' }))
  y += 32

  const lignes = [
    ['Pour', p.notes || (p.facture ? `Facture ${p.facture}` : '—')],
    ['Payé par', p.mode || '—'],
    p.reference && ['Référence', p.reference],
    p.facture && ['Facture', p.facture],
    reste !== null && ['Reste à payer', `${n0(reste)} ${cur}`],
  ].filter(Boolean)
  for (const [k, v] of lignes) {
    text(k, M, y, { size: 9, color: [110, 110, 110] })
    const vs = pdf.splitTextToSize(clean(v), R - M - 34)
    vs.slice(0, 3).forEach((l, i) => text(l, M + 34, y + i * 4.6, { size: 9.5, bold: k === 'Reste à payer' }))
    y += Math.max(1, Math.min(3, vs.length)) * 4.6 + 2.5
  }
  cachetPaye(pdf, R - 30, y + 2, p.date)
  y += 12

  // Signature et cachet
  text('Signature et cachet', M, y, { size: 8.5, color: [110, 110, 110] })
  if (fact.signataire) text(fact.signataire, M, y + 4.5, { size: 9 })
  const sig = await loadImg(fact.signature)
  const cachet = await loadImg(fact.cachet)
  let x = M
  if (sig) {
    const sw = Math.min(40, 20 / sig.ratio)
    pdf.addImage(sig.url, 'PNG', x, y + 6, sw, sw * sig.ratio)
    x += sw + 6
  }
  if (cachet) {
    const cw = Math.min(30, 26 / cachet.ratio)
    pdf.addImage(cachet.url, 'PNG', x, y + 4, cw, cw * cachet.ratio)
  }
  text('Merci pour votre confiance.', W / 2, 200, { size: 8.5, color: [110, 110, 110], align: 'center' })
  return pdf
}

export const recuNom = (p, client = {}) => `Recu_${String(client.nom || 'client').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}_${numeroRecu(p)}.pdf`
