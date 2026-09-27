// Messages WhatsApp des factures et devis : relance d'impayé et envoi du document
import { totals, paiementsDe, num, TYPES } from './invoice'
import { waLink } from './logic'
import { copier } from './insta'
import { fmtDate } from './dates'

// Téléphone du client : celui de sa fiche (WhatsApp d'abord)
export const telClient = (doc, byId) => {
  const f = byId[doc.prospect_id]?.fiche || {}
  return f.whatsapp || f.telephone || doc.data?.client?.telephone || ''
}

export function remplirDoc(texte, doc, { actions, byId, eur }) {
  const d = doc.data || {}
  const p = byId[doc.prospect_id]
  const total = totals(d).total
  const paye = paiementsDe(doc, actions).reduce((m, a) => m + num(a.montant), 0)
  const client = d.client?.nom || p?.name || ''
  return String(texte || '')
    .replace(/\{contact\}/g, p?.fiche?.contact || client)
    .replace(/\{client\}/g, client)
    .replace(/\{document\}/g, doc.type === 'devis' ? 'le devis' : 'la facture')
    .replace(/\{numero\}/g, doc.numero)
    .replace(/\{date\}/g, fmtDate(d.date))
    .replace(/\{echeance\}/g, fmtDate(d.echeance || d.date))
    .replace(/\{montant\}/g, eur(total))
    .replace(/\{reste\}/g, eur(Math.max(0, total - paye)))
    .replace(/\s+([,.])/g, '$1')
}

// Ouvre WhatsApp avec le message prêt (ou le copie si on n'a pas le numéro). Renvoie 'wa' ou 'copie'.
export async function ouvrirWhatsApp(texte, tel, indicatif) {
  const lien = waLink(tel, indicatif)
  if (lien) {
    window.open(`${lien}?text=${encodeURIComponent(texte)}`, '_blank')
    return 'wa'
  }
  await copier(texte)
  return 'copie'
}

export const libelleDoc = (doc) => `${TYPES[doc.type]?.label || 'Document'} ${doc.numero}`
