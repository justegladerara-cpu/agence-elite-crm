// Contrat d'interface du module Facturation : composants que les autres modules peuvent afficher
// (bouton de relance WhatsApp d'une facture impayée)
import { Icon } from '../../icons'
import { useApp, eur } from '../../ui'
import { today, nowTime } from '../../lib/dates'
import { remplirDoc, ouvrirWhatsApp, telClient } from './whatsapp'

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


