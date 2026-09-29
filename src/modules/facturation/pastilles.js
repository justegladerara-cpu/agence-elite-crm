// Facturation › pastilles du menu : factures en retard et devis sans réponse
import { facturesImpayees } from './impayes'

export function pastillesFacturation({ documents = [], actions = [] }, jour = new Date().toISOString().slice(0, 10)) {
  const retards = facturesImpayees(documents, actions).filter((d) => d.statut === 'En retard').length
  const devisAttente = documents.filter((d) => d.type === 'devis' && !d.data?.factureNumero && !['Accepté', 'Refusé'].includes(d.data?.statut) && !(d.data?.validite && d.data.validite < jour)).length
  return {
    factures: [retards, 'hot', 'factures en retard'],
    devis: [devisAttente, '', 'devis en attente'],
  }
}
