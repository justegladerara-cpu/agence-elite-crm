// Facturation › domaine : factures à relancer (fonction pure, sans React ni Supabase)
import { num, totals, statutDe, paiementsDe } from '../../lib/invoice'

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
