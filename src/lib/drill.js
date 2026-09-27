// Détail d'un chiffre du tableau de bord : la liste des prospects ou des actions qui le composent.
// Mêmes règles que computeStats (logic.js), pour que la liste corresponde toujours au chiffre affiché.
import { isProspection, isReponse, VENTES, montantRetenu } from './logic'
import { weekday } from './dates'

export function detail(data, settings, periode, canal, spec, debut = periode.debut, fin = periode.fin) {
  const { list, byId, sorted, L, clients } = data
  const inP = (d) => d && d >= debut && d <= fin
  const canalOk = (c) => canal === 'Tous' || c === canal
  const pc = (x) => byId[x.prospect_id]?.canal || ''
  const acts = sorted.filter((x) => inP(x.date))
  const cohort = list.filter((p) => inP(p.dateAjout) && canalOk(p.canal))
  const repondu = (p) => p.niveau >= 3 || (p.acts || []).some((a) => isReponse(a, L))
  const A = (items) => ({ type: 'actions', items: [...items].reverse() })
  const P = (items) => ({ type: 'prospects', items })
  const { kind, key } = spec

  switch (kind) {
    case 'dm':
      return A(acts.filter((x) => isProspection(x, L) && x.canal === 'DM' && canalOk(x.canal)))
    case 'appels':
      return A(acts.filter((x) => isProspection(x, L) && x.canal === 'Appel' && canalOk(x.canal)))
    case 'reponses':
      return A(acts.filter((x) => isReponse(x, L) && canalOk(x.canal)))
    case 'looms':
      return A(acts.filter((x) => (x.action === 'Loom envoyé' || x.action === 'Audit réalisé') && canalOk(pc(x))))
    case 'propositions':
      return A(acts.filter((x) => x.action === 'Proposition envoyée' && canalOk(pc(x))))
    case 'interventions':
      return A(acts.filter((x) => x.action === 'Intervention' && canalOk(pc(x))))
    case 'ventes':
      return A(acts.filter((x) => VENTES.includes(x.action) && canalOk(pc(x))))
    case 'encaisse':
      return A(acts.filter((x) => x.action === 'Paiement reçu' && canalOk(pc(x))))
    case 'depenses':
      return A(acts.filter((x) => x.action === 'Dépense'))
    case 'jour':
      // Un point de la courbe d'activité (key = série)
      return A(
        acts.filter((x) => {
          if (key === 'dm') return isProspection(x, L) && x.canal === 'DM' && canalOk(x.canal)
          if (key === 'appels') return isProspection(x, L) && x.canal === 'Appel' && canalOk(x.canal)
          if (key === 'reponses') return isReponse(x, L) && canalOk(x.canal)
          if (key === 'looms') return (x.action === 'Loom envoyé' || x.action === 'Audit réalisé') && canalOk(pc(x))
          return (isProspection(x, L) || isReponse(x, L)) && canalOk(pc(x) || x.canal)
        }),
      )
    case 'modele':
      return A(acts.filter((x) => x.modele === key))
    case 'objection':
      return A(acts.filter((x) => x.objection === key))
    case 'creneau': {
      const [h1, h2] = key
      return A(acts.filter((x) => x.canal === 'Appel' && isProspection(x, L) && x.time && Number(x.time.slice(0, 2)) >= h1 && Number(x.time.slice(0, 2)) < h2))
    }
    case 'jourSemaine':
      return A(acts.filter((x) => x.canal === 'Appel' && isProspection(x, L) && weekday(x.date) === key))
    case 'offre':
      return A(acts.filter((x) => VENTES.includes(x.action) && canalOk(pc(x)) && (byId[x.prospect_id]?.fiche?.offre || 'Sans offre') === key))

    case 'prospects':
      return P(cohort)
    case 'rdv':
      return P(list.filter((p) => inP(p.stageDates[3]) && canalOk(p.canal)))
    case 'signes':
      return P(list.filter((p) => inP(p.stageDates[5]) && canalOk(p.canal)))
    case 'etapeProcess': {
      const f = [
        () => true,
        (p) => p.niveau >= 2,
        repondu,
        (p) => p.niveau >= 3,
        (p) => p.niveau >= 4,
        (p) => p.niveau >= 5,
        (p) => p.niveau >= 6,
        (p) => p.niveau >= 7,
      ][key]
      return P(cohort.filter(f))
    }
    case 'canal':
      return P(cohort.filter((p) => (p.canal || 'Non renseigné') === key))
    case 'secteur':
      return P(cohort.filter((p) => (p.fiche?.secteur || 'Non renseigné') === key))
    case 'signal':
      return P(cohort.filter((p) => p.fiche?.signal === key))
    case 'secteurSignes':
      return P(list.filter((p) => p.fiche?.secteur === key && (inP(p.stageDates[5]) || inP(p.dateAjout))))
    case 'perdus':
      return P(cohort.filter((p) => p.etape === 'Perdu'))
    case 'pipeline':
      return P(list.filter((p) => canalOk(p.canal) && p.pipelinePondere > 0).sort((a, b) => b.pipelinePondere - a.pipelinePondere))
    case 'propositionsAttente':
      return P(list.filter((p) => canalOk(p.canal) && p.etape === 'Proposition'))
    case 'resteClients':
      return P(clients.filter((c) => canalOk(c.prospect.canal) && c.reste > 0).map((c) => c.prospect))
    case 'abonnes':
      return P(clients.filter((c) => c.statut === 'Actif' && c.abonnement > 0 && canalOk(c.prospect.canal)).map((c) => c.prospect))
    default:
      return P([])
  }
}

// Montant d'une action tel que compté dans le CA
export const montantAction = (a, data) => montantRetenu(a, data.byId[a.prospect_id], data.L)
