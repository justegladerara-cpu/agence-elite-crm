// PDF des factures et devis (modèle « Pro » d'Agence Elite), généré dans le navigateur.
import { jsPDF } from 'jspdf'
import { totals, montantEnLettres, TYPES, num } from './invoice'
import { getBrand, hexToRgb } from './theme'

const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const BLACK = [17, 17, 17]
const GREY = [110, 110, 110]
const LIGHT = [243, 243, 243]
const LINE = [225, 225, 225]

// Espaces ordinaires : la police standard du PDF ne connaît pas l'espace fine insécable
const clean = (s) => String(s ?? '').replace(/[  ]/g, ' ')
// Montants et quantités : décimales gardées si besoin (ex. 1,5 ou 12,50 €)
const nd = (v) => clean(num(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 }))
const n0 = nd

// Images (logo, cachet) : chargées une fois par adresse
const imgCache = {}
export async function loadImg(src) {
  if (!src) return null
  if (imgCache[src]) return imgCache[src]
  try {
    const url = src.startsWith('data:') ? src : await new Promise((ok, ko) => {
      fetch(src)
        .then((r) => r.blob())
        .then((blob) => {
          const r = new FileReader()
          r.onload = () => ok(r.result)
          r.onerror = ko
          r.readAsDataURL(blob)
        }, ko)
    })
    const img = await new Promise((ok, ko) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = ko
      i.src = url
    })
    imgCache[src] = { url, ratio: img.height / img.width }
    return imgCache[src]
  } catch {
    return null
  }
}

// Cachet « PAYÉ » incliné, posé sur les totaux d'une facture entièrement réglée
function cachetPaye(pdf, cx, cy, date) {
  const VERT = [29, 138, 97]
  const a = (14 * Math.PI) / 180
  const c = Math.cos(a)
  const sn = Math.sin(a)
  // Point (dx, dy) du repère du cachet → page (rotation dans le sens inverse des aiguilles d'une montre)
  const P = (dx, dy) => [cx + dx * c + dy * sn, cy - dx * sn + dy * c]
  const cadre = (w, h) => {
    const pts = [P(-w, -h), P(w, -h), P(w, h), P(-w, h), P(-w, -h)]
    for (let i = 0; i < 4; i++) pdf.line(...pts[i], ...pts[i + 1])
  }
  pdf.saveGraphicsState()
  pdf.setGState(new pdf.GState({ opacity: 0.85 }))
  pdf.setDrawColor(...VERT)
  pdf.setLineWidth(1)
  cadre(29, 11)
  pdf.setLineWidth(0.35)
  cadre(26.5, 8.5)
  pdf.setTextColor(...VERT)
  const ecrire = (txt, size, dy, bold) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const w = pdf.getTextWidth(txt)
    pdf.text(txt, ...P(-w / 2, dy), { angle: 14 })
  }
  ecrire('PAYÉ', 24, date ? 2 : 3.5, true)
  if (date) ecrire(`le ${fmtDate(date)}`, 8.5, 6.8)
  pdf.restoreGraphicsState()
  pdf.setLineWidth(0.2)
}

export async function buildPdf(doc, { fact, code, statut, paye = 0, datePaiement, logo: logoSrc }) {
  const d = doc.data || {}
  const RED = hexToRgb(fact.couleur, [230, 0, 0])
  const t = totals(d)
  const cur = code === 'EUR' ? '€' : code
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 16
  const R = W - M
  let y = 14

  const text = (s, x, yy, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal')
    pdf.setFontSize(o.size || 9.5)
    pdf.setTextColor(...(o.color || BLACK))
    pdf.text(clean(s), x, yy, { align: o.align || 'left', maxWidth: o.maxWidth })
  }
  const lines = (s, width, size = 9.5) => {
    pdf.setFontSize(size)
    return pdf.splitTextToSize(clean(s), width)
  }

  // En-tête : logo + type et numéro
  const logo = fact.afficherLogo === false ? null : await loadImg(logoSrc ?? (getBrand().logo || `${import.meta.env.BASE_URL}logo-full.png`))
  // Logo tenu dans un cadre de 40 × 30 mm
  const lw = logo ? Math.min(40, 30 / logo.ratio) : 0
  const lh = logo ? lw * logo.ratio : 0
  if (logo) pdf.addImage(logo.url, 'PNG', M, y, lw, lh)
  else lines(fact.nom || '', 100, 18).slice(0, 2).forEach((s, i) => text(s, M, y + 9 + i * 8, { bold: true, size: 18, color: i ? RED : BLACK }))
  text(TYPES[doc.type].titre, R, y + 5, { size: 11, color: GREY, align: 'right' })
  text(`# ${doc.numero}`, R, y + 11, { size: 11, color: GREY, align: 'right' })
  text(doc.type === 'facture' ? 'Solde dû' : 'Montant', R, y + 20, { size: 8.5, color: GREY, align: 'right' })
  text(`${n0(Math.max(0, t.total - paye))} ${cur}`, R, y + 26, { size: 13, bold: true, align: 'right' })
  y += logo ? Math.max(lh, 30) + 4 : 34
  pdf.setFillColor(...RED)
  pdf.rect(M, y, R - M, 1.6, 'F')
  y += 8

  // Émetteur / Client / Dates
  const colW = (R - M) / 3
  const emetteur = [fact.nom, ...(fact.adresse || '').split('\n'), fact.telephone && `Tél. : ${fact.telephone}`, fact.email, fact.site].filter(Boolean)
  const client = [d.client?.nom, ...(d.client?.adresse || '').split('\n')].filter(Boolean)
  const top = y
  let y1 = top
  emetteur.forEach((l, i) => lines(l, colW - 4).forEach((s) => (text(s, M, y1, { bold: i === 0 }), (y1 += 4.8))))
  let y2 = top
  text(doc.type === 'facture' ? 'FACTURER À' : 'CLIENT', M + colW, y2, { size: 8.5, color: GREY })
  y2 += 5
  client.forEach((l, i) => lines(l, colW - 4).forEach((s) => (text(s, M + colW, y2, { bold: i === 0 }), (y2 += 4.8))))
  let y3 = top
  const dates =
    doc.type === 'facture'
      ? [['DATE DE FACTURE', fmtDate(d.date)], ['ÉCHÉANCE', d.echeance ? fmtDate(d.echeance) : '—'], ['CONDITIONS', d.conditions || '—']]
      : [['DATE DU DEVIS', fmtDate(d.date)], ['VALABLE JUSQU’AU', d.validite ? fmtDate(d.validite) : '—'], ['CONDITIONS', d.conditions || '—']]
  dates.forEach(([k, v]) => {
    text(k, M + 2 * colW + 4, y3, { size: 8, color: GREY })
    y3 += 4.5
    lines(v, colW - 6).forEach((s) => (text(s, M + 2 * colW + 4, y3, { color: [70, 70, 70] }), (y3 += 4.5)))
    y3 += 2.5
  })
  pdf.setDrawColor(...LINE)
  pdf.line(M + colW - 3, top - 3, M + colW - 3, Math.max(y1, y2, y3) - 2)
  y = Math.max(y1, y2, y3) + 3
  if (d.objet) {
    const ob = lines(`OBJET — ${d.objet}`, R - M)
    ob.forEach((s) => (text(s, M, y), (y += 5)))
    y += 2
  }

  // Tableau des lignes
  const cx = [M, M + 104, M + 124, M + 150, R]
  const head = () => {
    pdf.setFillColor(...BLACK)
    pdf.rect(M, y, R - M, 9, 'F')
    const h = ['ARTICLE & DESCRIPTION', 'QTÉ', `PU (${cur})`, `MONTANT (${cur})`]
    h.forEach((s, i) => text(s, i === 0 ? cx[0] + 3 : cx[i + 1] - 3, y + 6, { size: 8, color: [200, 200, 200], align: i === 0 ? 'left' : 'right' }))
    y += 9
  }
  head()
  t.lignes.forEach((l) => {
    const des = lines(l.designation || '', cx[1] - cx[0] - 6, 10)
    const desc = l.description ? lines(l.description, cx[1] - cx[0] - 6, 8.5) : []
    const h = 5 + des.length * 5 + desc.length * 4 + 2
    if (y + h > 270) {
      pdf.addPage()
      y = 16
      head()
    }
    let yy = y + 6
    des.forEach((s) => (text(s, cx[0] + 3, yy, { size: 10 }), (yy += 5)))
    desc.forEach((s) => (text(s, cx[0] + 3, yy - 0.5, { size: 8.5, color: [80, 80, 80] }), (yy += 4)))
    text(nd(l.qte), cx[2] - 3, y + 6, { size: 10, align: 'right' })
    text(nd(l.pu), cx[3] - 3, y + 6, { size: 10, align: 'right' })
    text(nd(l.montant), cx[4] - 3, y + 6, { size: 10, align: 'right' })
    pdf.setDrawColor(...LINE)
    pdf.rect(M, y, R - M, h)
    ;[cx[1], cx[2], cx[3]].forEach((x) => pdf.line(x, y, x, y + h))
    y += h
  })
  y += 7

  // Totaux
  if (y > 235) {
    pdf.addPage()
    y = 20
  }
  const tot = [
    ['Sous-total', `${n0(t.sousTotal)} ${cur}`],
    ['Remise', `${n0(t.remise)} ${cur}`],
    [`Taxes${Number(d.tva) ? ` (${d.tva} %)` : ''}`, t.taxes ? `${n0(t.taxes)} ${cur}` : '—'],
  ]
  if (doc.type === 'facture' && paye > 0) tot.push(['Déjà payé', `${n0(paye)} ${cur}`])
  tot.forEach(([k, v]) => {
    text(k, M + 3, y, { color: GREY })
    text(v, R - 3, y, { color: GREY, align: 'right' })
    y += 6.5
  })
  pdf.setDrawColor(...RED)
  pdf.setLineWidth(0.5)
  pdf.line(M, y - 2.5, R, y - 2.5)
  pdf.setLineWidth(0.2)
  const due = doc.type === 'facture' ? Math.max(0, t.total - paye) : t.total
  text(doc.type === 'facture' ? 'TOTAL À PAYER' : 'TOTAL DU DEVIS', M + 3, y + 5, { bold: true, size: 14, color: RED })
  text(`${n0(due)} ${cur}`, R - 3, y + 5, { bold: true, size: 14, color: RED, align: 'right' })
  if (doc.type === 'facture' && statut === 'Payée') cachetPaye(pdf, W / 2, y - 12, datePaiement)
  y += 12

  // Statut + référence
  pdf.setFillColor(...LIGHT)
  pdf.setDrawColor(...LINE)
  pdf.rect(M, y, R - M, 16, 'FD')
  const libStatut = {
    Payée: 'PAYÉE',
    'Partiellement payée': 'PARTIELLEMENT PAYÉE',
    'En retard': 'EN RETARD DE PAIEMENT',
    'En attente': doc.type === 'facture' ? 'EN ATTENTE DE PAIEMENT' : 'EN ATTENTE DE VALIDATION',
    Accepté: 'ACCEPTÉ',
    Refusé: 'REFUSÉ',
    Expiré: 'EXPIRÉ',
    Annulée: 'ANNULÉE',
  }[statut] || statut.toUpperCase()
  text('STATUT', M + 4, y + 6)
  text(libStatut, M + 4, y + 12, { color: statut === 'Payée' || statut === 'Accepté' ? [29, 138, 97] : RED })
  text(doc.type === 'facture' ? 'RÉFÉRENCE DE PAIEMENT' : 'RÉFÉRENCE', M + (R - M) / 2, y + 6)
  text(doc.numero, M + (R - M) / 2, y + 12)
  y += 24

  // Paiement / total en lettres
  const half = (R - M) / 2
  let ya = y
  let yb = y
  if (doc.type === 'facture') {
    text('INFORMATIONS DE PAIEMENT', M, ya, { size: 9.5 })
    ya += 5.5
    ;[...(d.paiement || fact.paiement || '').split('\n'), `Référence : ${doc.numero}`]
      .filter(Boolean)
      .forEach((l) => lines(l, half - 6, 8.5).forEach((s) => (text(s, M, ya, { size: 8.5 }), (ya += 4.5))))
  }
  text('TOTAL EN LETTRES', M + half, yb, { size: 9.5 })
  yb += 5.5
  lines(montantEnLettres(due, code), half - 4, 10).forEach((s) => (text(s, M + half, yb, { size: 10 }), (yb += 5)))
  y = Math.max(ya, yb) + 6
  pdf.setDrawColor(...LINE)
  pdf.line(M, y - 3, R, y - 3)

  if (d.notes) {
    text('NOTES', M + 3, y + 3, { bold: true, size: 10 })
    y += 8
    lines(d.notes, R - M - 6, 9).forEach((s) => (text(s, M + 3, y, { size: 9, color: GREY }), (y += 4.6)))
    y += 3
    pdf.line(M, y, R, y)
    y += 7
  }

  // Signature / cachet + slogan
  const sig = await loadImg(fact.signature)
  const sw = sig ? Math.min(45, 24 / sig.ratio) : 0
  const sh = sig ? sw * sig.ratio : 0
  if (y + sh > 262) {
    pdf.addPage()
    y = 20
  }
  text(fact.nom || '', M + 3, y)
  text(fact.signataire ? `Signature / Cachet — ${fact.signataire}` : 'Signature / Cachet', M + 3, y + 5, { size: 8.5 })
  if (sig) pdf.addImage(sig.url, 'PNG', M + 3, y + 7, sw, sh)
  if (fact.slogan) text(fact.slogan, R - 3, y, { size: 8.5, color: GREY, align: 'right' })

  // Mentions (CGV) en bas de chaque page
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    if (fact.cgv) lines(fact.cgv, R - M, 8).forEach((s, k) => text(s, M, 283 + k * 4, { size: 8, color: GREY }))
    if (pages > 1) text(`${i} / ${pages}`, R, 292, { size: 7.5, color: GREY, align: 'right' })
  }
  return pdf
}

export async function pdfBlob(doc, opts) {
  const pdf = await buildPdf(doc, opts)
  return pdf.output('blob')
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
export const pdfNom = (doc, fact = {}) => `${doc.type === 'facture' ? 'Facture' : 'Devis'}_${slug(fact.nom) || 'Agence_Elite'}_${doc.numero}.pdf`
