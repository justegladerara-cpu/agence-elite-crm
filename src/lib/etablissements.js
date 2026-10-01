// Établissements (boutiques, points de vente) et clôture de caisse (ticket Z)
import { num, totals } from './invoice'
import { A_CREDIT } from './magasin'

const PREF = 'kgr-etablissement'

// Sans établissement créé, le magasin a un établissement implicite : « Magasin principal »
export function etablissementsDe(settings) {
  const l = (settings?.etablissements || []).filter((e) => e?.id && e.nom && !e.archive)
  return l.length ? l : [{ id: 'principal', nom: 'Magasin principal', adresse: settings?.facturation?.adresse || '', telephone: settings?.facturation?.telephone || '' }]
}

// Les ventes sans établissement (avant leur création, factures faites à la main) vont au premier
export const etabDe = (doc, liste) => (liste.some((e) => e.id === doc.data?.vente?.etablissementId) ? doc.data.vente.etablissementId : liste[0].id)

// Établissement de cet appareil (la caisse d'une boutique reste sur sa boutique)
export function etabCourant(settings) {
  const liste = etablissementsDe(settings)
  let id = ''
  try {
    id = localStorage.getItem(PREF) || ''
  } catch {
    /* stockage indisponible */
  }
  return liste.find((e) => e.id === id) || liste[0]
}
export function choisirEtab(id) {
  try {
    localStorage.setItem(PREF, id)
  } catch {
    /* préférence non gardée */
  }
}

// Factures d'un établissement : numéro → établissement, pour rattacher les paiements
export function etabParFacture(documents, liste) {
  const m = {}
  documents.forEach((d) => d.type === 'facture' && (m[d.numero] = etabDe(d, liste)))
  return m
}

const ajoute = (o, k, v) => (o[k] = (o[k] || 0) + v)

// Chiffres de la journée d'un établissement : tout ce que le ticket Z récapitule
export function chiffresZ({ documents, actions, date, etabId, liste }) {
  const factures = documents.filter((d) => d.type === 'facture' && (d.data?.date || '') === date && etabDe(d, liste) === etabId)
  const valides = factures.filter((d) => !d.data?.annulee)
  const annulees = factures.filter((d) => d.data?.annulee)
  const cats = Object.fromEntries(documents.filter((d) => d.type === 'produit').map((d) => [d.id, d.data?.categorie || 'Autre']))
  const ventes = valides.map((d) => ({ d, t: totals(d.data || {}) }))
  const ca = ventes.reduce((m, v) => m + v.t.total, 0)
  const remises = ventes.reduce((m, v) => m + v.t.remise, 0)
  const credit = ventes.filter((v) => v.d.data?.vente?.mode === A_CREDIT).reduce((m, v) => m + v.t.total, 0)
  const parVendeur = {}
  const parCategorie = {}
  const parArticle = {}
  let articles = 0
  ventes.forEach(({ d, t }) => {
    ajoute(parVendeur, d.data?.vente?.vendeur || 'Non précisé', t.total)
    t.lignes.forEach((l) => {
      articles += num(l.qte)
      ajoute(parCategorie, cats[l.produitId] || 'Autre', l.montant)
      const a = (parArticle[l.designation || 'Article'] = parArticle[l.designation || 'Article'] || { q: 0, v: 0 })
      a.q += num(l.qte)
      a.v += l.montant
    })
  })
  // Paiements reçus ce jour pour cet établissement : ventes du jour et règlements d'anciennes factures
  const etabFact = etabParFacture(documents, liste)
  const numerosJour = new Set(valides.map((d) => d.numero))
  const paiements = actions.filter((a) => a.action === 'Paiement reçu' && a.date === date && (etabFact[a.facture] || liste[0].id) === etabId)
  const parMode = {}
  paiements.forEach((a) => ajoute(parMode, a.mode || 'Autre', num(a.montant)))
  const encaisse = paiements.reduce((m, a) => m + num(a.montant), 0)
  const reglementsAnciens = paiements.filter((a) => !numerosJour.has(a.facture)).reduce((m, a) => m + num(a.montant), 0)
  const heures = valides.map((d) => d.data?.vente?.heure).filter(Boolean).sort()
  const numeros = valides.map((d) => d.numero).sort()
  return {
    nbVentes: valides.length,
    ca,
    remises,
    credit,
    articles,
    panierMoyen: valides.length ? ca / valides.length : 0,
    annulees: { n: annulees.length, montant: annulees.reduce((m, d) => m + totals(d.data || {}).total, 0) },
    encaisse,
    especes: parMode['Espèces'] || 0,
    reglementsAnciens,
    parMode: Object.entries(parMode).sort((a, b) => b[1] - a[1]),
    parVendeur: Object.entries(parVendeur).sort((a, b) => b[1] - a[1]),
    parCategorie: Object.entries(parCategorie).sort((a, b) => b[1] - a[1]),
    topArticles: Object.entries(parArticle).sort((a, b) => b[1].v - a[1].v).slice(0, 10).map(([nom, x]) => [nom, x.q, x.v]),
    premiere: heures[0] || '',
    derniere: heures[heures.length - 1] || '',
    de: numeros[0] || '',
    a: numeros[numeros.length - 1] || '',
  }
}

// Clôtures déjà faites, de la plus récente à la plus ancienne
export const cloturesDe = (documents) =>
  documents.filter((d) => d.type === 'cloture').sort((a, b) => `${b.data?.date} ${b.numero}`.localeCompare(`${a.data?.date} ${a.numero}`))

export function nextZ(documents) {
  let max = 0
  documents.filter((d) => d.type === 'cloture').forEach((d) => (max = Math.max(max, parseInt(String(d.numero).replace(/\D/g, ''), 10) || 0)))
  return `Z-${String(max + 1).padStart(5, '0')}`
}

// Ticket Z en PDF : format ticket (80 mm) ou A4 pour le comptable
export async function zBlob(z, { fact, sym = 'FCFA', format = 'ticket' }) {
  const { jsPDF } = await import('jspdf')
  const d = z.data || {}
  const c = d.chiffres || {}
  const ticket = format === 'ticket'
  const W = ticket ? 80 : 210
  const M = ticket ? 5 : 22
  const R = W - M
  const fs = ticket ? 1 : 1.25
  const m = (v) => `${Math.round(num(v)).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} ${sym}`
  // Ticket : on dessine une première fois pour mesurer la hauteur, puis sur une page à la bonne taille
  const mesure = ticket ? dessiner(new jsPDF({ unit: 'mm', format: [W, 1000], compress: true })) : 0
  const pdf = new jsPDF({ unit: 'mm', format: ticket ? [W, mesure + 10] : 'a4', compress: true })
  dessiner(pdf)
  return pdf.output('blob')

  function dessiner(pdf) {
  let y = ticket ? 7 : 22
  const page = () => {
    if (!ticket && y > 275) {
      pdf.addPage()
      y = 22
    }
  }
  const txt = (s, x, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal')
    pdf.setFontSize((o.size || 8.5) * fs)
    pdf.setTextColor(...(o.color || [20, 20, 20]))
    pdf.text(String(s ?? '').replace(/[  ]/g, ' '), x, y, { align: o.align || 'left', maxWidth: o.max })
  }
  const trait = () => {
    pdf.setLineDashPattern([0.8, 0.8], 0)
    pdf.setDrawColor(150)
    pdf.line(M, y, R, y)
    pdf.setLineDashPattern([], 0)
    y += 4.5 * fs
  }
  const ligne = (l, v, o = {}) => {
    page()
    txt(l, M, { ...o, max: R - M - 30 * fs })
    txt(v, R, { ...o, align: 'right' })
    y += 4.4 * fs
  }
  const titre = (t) => {
    page()
    y += 1.5 * fs
    txt(t.toUpperCase(), M, { bold: true, size: 8 })
    y += 4.6 * fs
  }
  txt(fact.nom || '', W / 2, { bold: true, size: 10.5, align: 'center' })
  y += 4.5 * fs
  if (d.etablissement) {
    txt(d.etablissement, W / 2, { size: 8.5, align: 'center' })
    y += 4 * fs
  }
  if (d.adresse) {
    txt(d.adresse.split('\n')[0], W / 2, { size: 7.5, align: 'center', color: [90, 90, 90] })
    y += 4 * fs
  }
  y += 1
  trait()
  txt('TICKET Z · CLÔTURE DE CAISSE', W / 2, { bold: true, size: 10.5, align: 'center' })
  y += 5.5 * fs
  ligne(`N° ${z.numero}`, `Journée du ${(d.date || '').split('-').reverse().join('/')}`)
  ligne(`Clôturé par ${d.par || '—'}`, `à ${d.heure || ''}`)
  if (c.de) ligne('Factures', `${c.de} à ${c.a}`, { size: 7.5 })
  if (c.premiere) ligne('Première / dernière vente', `${c.premiere} / ${c.derniere}`, { size: 7.5 })
  trait()
  titre('Ventes')
  ligne('Nombre de ventes', String(c.nbVentes || 0))
  ligne('Articles vendus', String(Math.round(num(c.articles))))
  ligne("Chiffre d'affaires", m(c.ca), { bold: true })
  if (c.remises) ligne('dont remises accordées', m(c.remises))
  ligne('Panier moyen', m(c.panierMoyen))
  if (c.credit) ligne('Ventes à crédit (non encaissées)', m(c.credit))
  if (c.annulees?.n) ligne(`Ventes annulées (${c.annulees.n})`, m(c.annulees.montant))
  trait()
  titre('Encaissements par mode')
  ;(c.parMode || []).forEach(([k, v]) => ligne(k, m(v)))
  ligne('Total encaissé', m(c.encaisse), { bold: true })
  if (c.reglementsAnciens) ligne('dont règlements de crédits', m(c.reglementsAnciens), { size: 7.5 })
  trait()
  titre('Espèces')
  ligne('Fond de caisse', m(d.fond))
  ligne('+ Espèces encaissées', m(c.especes))
  ligne("- Sorties d'espèces", m(d.sorties))
  ligne('= Espèces attendues', m(d.attendu), { bold: true })
  ligne('Espèces comptées', m(d.compte), { bold: true })
  ligne(num(d.ecart) === 0 ? 'Écart' : num(d.ecart) > 0 ? 'Écart (excédent)' : 'Écart (manque)', m(d.ecart), { bold: true, color: num(d.ecart) < 0 ? [200, 30, 30] : [20, 20, 20] })
  if ((c.parVendeur || []).length) {
    trait()
    titre('Par vendeur')
    c.parVendeur.forEach(([k, v]) => ligne(k, m(v)))
  }
  if ((c.parCategorie || []).length) {
    trait()
    titre('Par catégorie')
    c.parCategorie.forEach(([k, v]) => ligne(k, m(v)))
  }
  if ((c.topArticles || []).length) {
    trait()
    titre('Articles les plus vendus')
    c.topArticles.forEach(([k, q, v]) => ligne(`${Math.round(q)} × ${k}`, m(v), { size: 7.5 }))
  }
  if (d.note) {
    trait()
    txt(`Note : ${d.note}`, M, { size: 7.5, max: R - M })
    y += 8
  }
  trait()
  y += 2
  txt('Signature du caissier', M, { size: 7.5, color: [90, 90, 90] })
  txt('Signature du responsable', R, { size: 7.5, color: [90, 90, 90], align: 'right' })
  return y
  }
}
