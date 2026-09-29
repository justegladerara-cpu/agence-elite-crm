// Commercial › pipeline : étapes, relances, scores, alertes et clients calculés depuis les actions
// (repris des formules du fichier Excel, onglets Prospects, Clients et Ma journée).
import { iso, addDays, addMonths, diffDays, today } from '../../lib/dates'
import { num, lookups, sortActions, actionRank, isProspection, isReponse, VENTES, montantRetenu } from '../../lib/logic'

export function computeAll(prospects, actions, settings) {
  const s = settings
  const L = lookups(s)
  const t = today()
  const sorted = sortActions(actions)
  const byProspect = new Map(prospects.map((p) => [p.id, []]))
  sorted.forEach((a) => {
    if (a.prospect_id && byProspect.has(a.prospect_id)) byProspect.get(a.prospect_id).push(a)
  })
  const etapesNoms = s.etapes.map((e) => e.nom)

  const list = prospects.map((p) => {
    const acts = byProspect.get(p.id) || []
    const f = p.fiche || {}
    const ranks = acts.map((a) => actionRank(a, L))
    const niveau = Math.max(1, ...ranks, 0)
    const lastIdx = acts.length - 1
    let perduIdx = -1
    let progIdx = -1
    let relanceIdx = -1
    acts.forEach((a, i) => {
      if (a.action === 'Perdu') perduIdx = i
      if (ranks[i] > 0) progIdx = i
      if (a.date_relance) relanceIdx = i
    })
    const etape = perduIdx >= 0 && perduIdx > progIdx && niveau < 7 ? 'Perdu' : etapesNoms[niveau - 1] || 'Nouveau'
    const tentatives = acts.filter((a) => isProspection(a, L)).length
    const reponses = acts.filter((a) => isReponse(a, L)).length
    const dates = acts.map((a) => a.date).filter(Boolean)
    const dateAjout = dates.length ? dates.reduce((m, d) => (d < m ? d : m)) : (p.created_at ? iso(new Date(p.created_at)) : '')
    const derniereAction = dates.length ? dates.reduce((m, d) => (d > m ? d : m)) : ''
    const joursSansAction = derniereAction ? diffDays(t, derniereAction) : null
    const stop = tentatives >= s.relance.stop && reponses === 0
    const closed = etape === 'Gagné' || etape === 'Perdu'

    let relance = ''
    let heureRappel = ''
    if (!closed) {
      if (relanceIdx >= 0 && relanceIdx === lastIdx) {
        relance = acts[relanceIdx].date_relance
        heureRappel = acts[relanceIdx].heure_rappel || ''
      } else if (tentatives > 0 && !stop && derniereAction) {
        const d = tentatives <= 1 ? s.relance.j1 : tentatives === 2 ? s.relance.j2 : s.relance.j3
        relance = addDays(derniereAction, d)
      }
    }
    const lastWith = (k) => {
      for (let i = acts.length - 1; i >= 0; i--) if (acts[i][k]) return acts[i]
      return null
    }
    const prochaineAction = closed ? '' : lastWith('prochaine_action')?.prochaine_action || ''
    const firstProsp = acts.find((a) => isProspection(a, L) && a.canal)
    const canal = firstProsp?.canal || acts.find((a) => a.canal)?.canal || ''

    // Score de priorité
    const sc = s.score
    let score =
      (f.pub_active === 'Oui') * sc.pubActive +
      (f.budget_pub === 'Régulière') * sc.pubReguliere +
      (f.date_pub && diffDays(t, f.date_pub) <= 30 && diffDays(t, f.date_pub) >= -9999 ? sc.pubRecente : 0) +
      (!f.site) * sc.pasDeSite +
      (f.presence_google === 'Absente') * sc.googleAbsente +
      (f.presence_google === 'Faible') * sc.googleFaible +
      (num(f.note_google) > 0 && num(f.note_google) < 4 ? sc.noteGoogleBasse : 0) +
      (f.taille === 'Moyenne') * sc.entrepriseMoyenne +
      (f.taille === 'Grande') * sc.grandeEntreprise +
      (f.recommande_par ? sc.recommande : 0)
    score = Math.min(100, score)

    const qualif =
      (f.budget_ok === 'Oui') + (f.decideur === 'Oui') + (f.besoin === 'Oui') + (f.delai === 'Immédiat' || f.delai === '< 1 mois')

    const props = acts.filter((a) => a.action === 'Proposition envoyée')
    const lastProp = props[props.length - 1]
    const montantPropose = lastProp ? montantRetenu(lastProp, p, L) : null
    const dateProposition = props.length ? props.map((a) => a.date).sort().pop() : ''
    const expiration = dateProposition ? addDays(dateProposition, s.alertes.validiteProposition) : ''
    const pipelinePondere = closed ? 0 : num(montantPropose) * num(L.proba[etape])
    const sigs = acts.filter((a) => a.action === 'Signature' || a.action === 'Intervention').map((a) => a.date).sort()
    const dateSignature = sigs[0] || ''
    const cycle = dateSignature && dateAjout ? diffDays(dateSignature, dateAjout) : null
    const objection = lastWith('objection')?.objection || ''
    const pertes = acts.filter((a) => a.action === 'Perdu').map((a) => a.date).sort()
    const datePerte = etape === 'Perdu' ? pertes[pertes.length - 1] || '' : ''
    const recontacter = datePerte ? addDays(datePerte, s.alertes.recontacterPerdu) : ''
    const tempsPasse = acts.reduce((m, a) => m + num(a.duree), 0)
    const stageDates = [2, 3, 4, 5, 6, 7].map((k) => {
      const d = acts.filter((a, i) => ranks[i] >= k).map((a) => a.date).sort()
      return d[0] || ''
    })

    let alerte = ''
    if (etape === 'Perdu') {
      if (recontacter && recontacter <= t) alerte = 'À recontacter (perdu)'
    } else if (etape !== 'Gagné') {
      if (stop) alerte = `Stop : ${s.relance.stop} tentatives sans réponse`
      else if (etape === 'Proposition' && expiration && t > expiration) alerte = 'Proposition expirée'
      else if (etape === 'Proposition' && num(joursSansAction) >= s.alertes.propositionSansReponse) alerte = 'Proposition sans réponse'
      else if (relance && relance < t) alerte = 'Relance en retard'
      else if (num(joursSansAction) >= s.alertes.sansAction) alerte = `Sans action depuis ${joursSansAction} j`
    }

    return {
      ...p,
      acts,
      etape,
      niveau,
      score,
      alerte,
      relance,
      heureRappel,
      prochaineAction,
      canal,
      tentatives,
      reponses,
      dateAjout,
      derniereAction,
      joursSansAction,
      stop,
      qualif,
      montantPropose,
      dateProposition,
      expiration,
      pipelinePondere,
      dateSignature,
      cycle,
      objection,
      datePerte,
      recontacter,
      tempsPasse,
      stageDates,
      demo: L.secteur[f.secteur]?.demo || '',
      abonnement: f.abonnement !== undefined && f.abonnement !== '' && f.abonnement !== null ? num(f.abonnement) : num(L.offre[f.offre]?.abonnement),
    }
  })

  const byId = Object.fromEntries(list.map((p) => [p.id, p]))

  // Clients : un prospect devient client dès qu'une « Signature » est saisie.
  const clients = list
    .filter((p) => p.niveau === 7)
    .map((p) => {
      const sumOf = (name) => p.acts.filter((a) => a.action === name).reduce((m, a) => m + montantRetenu(a, p, L), 0)
      const has = (name) => p.acts.some((a) => a.action === name)
      const montantSigne = sumOf('Signature')
      const ventesAdd = sumOf('Vente additionnelle')
      const interventions = p.acts.filter((a) => a.action === 'Intervention')
      const montantInterventions = sumOf('Intervention')
      const total = montantSigne + ventesAdd + montantInterventions
      const datesVentes = p.acts.filter((a) => VENTES.includes(a.action)).map((a) => a.date).sort()
      const derniereVente = datesVentes[datesVentes.length - 1] || p.dateSignature
      const derniereIntervention = interventions.map((a) => a.date).sort().pop() || ''
      const joursSansVente = derniereVente ? diffDays(t, derniereVente) : null
      const encaisse = sumOf('Paiement reçu')
      const depenses = sumOf('Dépense')
      const reste = Math.max(0, total - encaisse)
      const resil = p.acts.filter((a) => a.action === 'Résiliation').map((a) => a.date).sort().pop() || ''
      const statut = resil ? 'Résilié' : 'Actif'
      let statutPaiement = ''
      if (total > 0) {
        if (reste <= 0) statutPaiement = 'Payé'
        else if (derniereVente && diffDays(t, derniereVente) > s.alertes.delaiPaiement) statutPaiement = 'En retard'
        else if (encaisse > 0) statutPaiement = 'Partiel'
        else statutPaiement = 'En attente'
      }
      const renouvellement = has('Signature') && p.dateSignature ? addMonths(p.dateSignature, s.clients.engagementMois) : ''
      const joursRenouv = renouvellement ? diffDays(renouvellement, t) : null
      const onboarding =
        (has('Onboarding - Contrat') + has('Onboarding - Accès') + has('Onboarding - Contenus') + has('Onboarding - Lancement')) / 4
      const avisDemande = has("Demande d'avis Google")
      const sat = p.acts.filter((a) => a.action === 'Satisfaction client' && a.note !== null && a.note !== '').pop()
      const factures = p.acts.filter((a) => a.facture)
      const cout = num(L.offre[p.fiche?.offre]?.cout)
      let alerte = ''
      if (statut !== 'Résilié') {
        if (statutPaiement === 'En retard') alerte = 'Paiement en retard'
        else if (joursRenouv !== null && joursRenouv <= s.alertes.renouvellement && joursRenouv >= 0)
          alerte = `Renouvellement dans ${joursRenouv} j`
        else if (interventions.length && joursSansVente !== null && joursSansVente >= num(s.alertes.relanceClient))
          alerte = `À recontacter (${joursSansVente} j sans intervention)`
        else if (!avisDemande && p.dateSignature && diffDays(t, p.dateSignature) >= s.alertes.avisGoogle)
          alerte = 'Demander un avis Google'
        else if (onboarding < 1 && !interventions.length) alerte = 'Onboarding à terminer'
      }
      return {
        prospect: p,
        id: p.id,
        name: p.name,
        statut,
        alerte,
        montantSigne,
        ventesAdd,
        montantInterventions,
        nbInterventions: interventions.length,
        derniereIntervention,
        derniereVente,
        total,
        encaisse,
        reste,
        statutPaiement,
        derniereFacture: factures.length ? factures[factures.length - 1].facture : '',
        abonnement: p.abonnement,
        renouvellement,
        joursRenouv,
        anciennete: p.dateSignature ? Math.floor(diffDays(t, p.dateSignature) / 30.44) : null,
        valeurVie: total + p.abonnement * s.clients.dureeVieMois,
        depenses,
        marge: total - cout - depenses,
        onboarding,
        avisDemande,
        satisfaction: sat ? num(sat.note) : null,
        dateResiliation: resil,
      }
    })

  // Ma journée
  const aRelancer = list
    .filter((p) => p.relance && p.relance <= t)
    .sort((a, b) => a.relance.localeCompare(b.relance) || (a.heureRappel || '').localeCompare(b.heureRappel || ''))
  const aVenir = list
    .filter((p) => p.relance && p.relance > t)
    .sort((a, b) => a.relance.localeCompare(b.relance))
  const chauds = list
    .filter(
      (p) =>
        ['Nouveau', 'Contacté', 'Qualifié'].includes(p.etape) && (!p.relance || p.relance <= t) && !p.stop,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
  const alertes = list.filter((p) => p.alerte && p.alerte !== 'Relance en retard')
  const clientsAlertes = clients.filter((c) => c.alerte)

  return { list, byId, clients, aRelancer, aVenir, chauds, alertes, clientsAlertes, L, sorted }
}

// Statistiques du tableau de bord pour une période [debut, fin] et un canal.
