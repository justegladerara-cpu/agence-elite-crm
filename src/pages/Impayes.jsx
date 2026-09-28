// Factures impayées : liste et bouton de relance WhatsApp (utilisés hors de la page Factures)
import { Icon } from '../icons'
import { useApp, eur } from '../ui'
import { num, totals, statutDe, paiementsDe } from '../lib/invoice'
import { today, nowTime } from '../lib/dates'
import { remplirDoc, ouvrirWhatsApp, telClient } from '../lib/whatsapp'

// Bouton « Relancer » d'une facture impayée (liste des factures, Ma journée)
export function RelanceFactureBtn({ doc, label }) {
  const { actions, data, settings, api, toast } = useApp()
  const go_ = async (e) => {
    e.stopPropagation()
    const texte = remplirDoc(settings.messageImpaye, doc, { actions, byId: data.byId, eur })
    const r = await ouvrirWhatsApp(texte, telClient(doc, data.byId), settings.clients.indicatifWhatsApp)
    if (doc.prospect_id)
      await api.addActions([{ prospect_id: doc.prospect_id, date: today(), time: nowTime(), action: 'Note', canal: 'WhatsApp', notes: `Relance de paiement ${doc.numero}` }]).catch(() => {})
    toast(r === 'wa' ? 'Message de relance prêt dans WhatsApp ✓' : 'Message copié ✓ (ajoute le téléphone sur la fiche pour ouvrir WhatsApp)')
  }
  return (
    <button type="button" className="btn sm" title="Relancer le paiement sur WhatsApp" onClick={go_}>
      <Icon n="bell" size={14} />
      {label ? ` ${label}` : ''}
    </button>
  )
}

// Factures à relancer : en retard ou partiellement payées
export function facturesImpayees(documents, actions) {
  return documents
    .filter((d) => d.type === 'facture')
    .map((d) => {
      const t = totals(d.data || {}).total
      const paye = paiementsDe(d, actions).reduce((m, a) => m + num(a.montant), 0)
      return { ...d, total: t, reste: Math.max(0, t - paye), statut: statutDe(d, actions) }
    })
    .filter((d) => d.reste > 0 && (d.statut === 'En retard' || d.statut === 'Partiellement payée'))
    .sort((a, b) => (a.data?.echeance || '').localeCompare(b.data?.echeance || ''))
}

