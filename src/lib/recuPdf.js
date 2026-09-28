// Reçu de vente (ticket de caisse 80 mm), généré dans le navigateur.
import { jsPDF } from 'jspdf'
import { totals, num, montantEnLettres } from './invoice'
import { getBrand } from './theme'
import { loadImg } from './invoicePdf'

const clean = (s) => String(s ?? '').replace(/[  ]/g, ' ')
const m = (v) => clean(Math.round(num(v)).toLocaleString('fr-FR'))

export async function recuBlob(doc, { fact, code = 'XAF', sym = 'FCFA', paye = 0 }) {
  const d = doc.data || {}
  const t = totals(d)
  const W = 80
  const M = 5
  const R = W - M
  const logo = await loadImg(getBrand().logo || `${import.meta.env.BASE_URL}logo-full.png`)
  // Hauteur : en-tête + lignes + totaux + pied
  const H = 92 + t.lignes.length * 9 + (logo ? 21 : 0) + (t.remise ? 8 : 0) + (fact.adresse || '').split('\n').length * 3.3
  const pdf = new jsPDF({ unit: 'mm', format: [W, H], compress: true })
  let y = 6
  const txt = (s, x, yy, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal')
    pdf.setFontSize(o.size || 8.5)
    pdf.setTextColor(...(o.color || [20, 20, 20]))
    pdf.text(clean(s), x, yy, { align: o.align || 'left', maxWidth: o.max })
  }
  const trait = () => {
    pdf.setLineDashPattern([0.8, 0.8], 0)
    pdf.setDrawColor(150)
    pdf.line(M, y, R, y)
    pdf.setLineDashPattern([], 0)
    y += 4
  }
  if (logo) {
    const w = 46
    const h = Math.min(18, w * logo.ratio)
    pdf.addImage(logo.url, 'PNG', (W - h / logo.ratio) / 2, y, h / logo.ratio, h, undefined, 'FAST')
    y += h + 3
  }
  txt(fact.nom || '', W / 2, y, { bold: true, size: 10, align: 'center' })
  y += 4
  ;(fact.adresse || '').split('\n').filter(Boolean).forEach((l) => {
    txt(l, W / 2, y, { size: 7.5, align: 'center', color: [90, 90, 90] })
    y += 3.3
  })
  if (fact.telephone) {
    txt(`Tél. ${fact.telephone}`, W / 2, y, { size: 7.5, align: 'center', color: [90, 90, 90] })
    y += 3.3
  }
  y += 1.5
  trait()
  txt('REÇU DE VENTE', W / 2, y, { bold: true, size: 11, align: 'center' })
  y += 5
  txt(`N° ${doc.numero}`, M, y, { size: 8 })
  txt(`${(d.date || '').split('-').reverse().join('/')} ${d.vente?.heure || ''}`, R, y, { size: 8, align: 'right' })
  y += 4
  txt(`Client : ${d.client?.nom || 'Client comptoir'}`, M, y, { size: 8, max: R - M })
  y += 4
  if (d.vente?.vendeur) {
    txt(`Servi par : ${d.vente.vendeur}`, M, y, { size: 8 })
    y += 4
  }
  trait()
  t.lignes.forEach((l) => {
    txt(l.designation || 'Article', M, y, { size: 8.5, bold: true, max: R - M })
    y += 4
    txt(`${m(l.qte)} x ${m(l.pu)}`, M + 2, y, { size: 8, color: [90, 90, 90] })
    txt(m(l.montant), R, y, { size: 8.5, align: 'right' })
    y += 5
  })
  trait()
  if (t.remise) {
    txt('Sous-total', M, y, { size: 8.5 })
    txt(m(t.sousTotal), R, y, { size: 8.5, align: 'right' })
    y += 4
    txt('Remise', M, y, { size: 8.5 })
    txt(`- ${m(t.remise)}`, R, y, { size: 8.5, align: 'right' })
    y += 4
  }
  txt(`TOTAL ${sym}`, M, y + 1, { size: 11, bold: true })
  txt(m(t.total), R, y + 1, { size: 12, bold: true, align: 'right' })
  y += 6
  txt(montantEnLettres(t.total, code), M, y, { size: 7, color: [90, 90, 90], max: R - M })
  y += 7
  txt(`Paiement : ${d.vente?.mode || '—'}`, M, y, { size: 8.5 })
  y += 4
  const reste = Math.max(0, t.total - num(paye))
  txt(reste > 0 ? `Reste à payer : ${m(reste)} ${sym}` : 'Réglé', M, y, { size: 8.5, bold: true })
  y += 5
  trait()
  txt('Merci de votre visite !', W / 2, y, { size: 9, bold: true, align: 'center' })
  y += 4
  txt('Marchandise ni reprise ni échangée sans ce reçu.', W / 2, y, { size: 7, align: 'center', color: [90, 90, 90] })
  return pdf.output('blob')
}
