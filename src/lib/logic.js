// Tous les calculs automatiques, repris des formules du fichier Excel
// (onglets Prospects, Clients, Ma journée et Tableau de bord).
import { iso, addDays, addMonths, diffDays, today, monthStart, monthEnd, prevMonth, weekday } from './dates'

const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v))

export function sortActions(actions) {
  return [...actions].sort(
    (a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.time || '').localeCompare(b.time || '') ||
      (a.created_at || '').localeCompare(b.created_at || ''),
  )
}

function lookups(s) {
  const act = Object.fromEntries(s.actions.map((a) => [a.nom, a]))
  const res = Object.fromEntries(s.resultats.map((r) => [r.nom, r]))
  const offre = Object.fromEntries(s.offres.map((o) => [o.nom, o]))
  const proba = Object.fromEntries(s.etapes.map((e) => [e.nom, e.proba]))
  const secteur = Object.fromEntries(s.secteurs.map((x) => [x.nom, x]))
  return { act, res, offre, proba, secteur }
}

export const actionRank = (a, L) => Math.max(num(L.act[a.action]?.rang), num(L.res[a.resultat]?.rang))
export const isProspection = (a, L) => !!L.act[a.action]?.prospection
export const isReponse = (a, L) => !!L.res[a.resultat]?.reponse
// Actions qui comptent dans le CA signé
export const VENTES = ['Signature', 'Vente additionnelle', 'Intervention']

// Montant retenu (colonne AW de la Saisie) : montant saisi, sinon prix de l'offre
// pour une proposition ou une signature, moins la remise.
export function montantRetenu(a, prospect, L) {
  if (a.montant !== null && a.montant !== undefined && a.montant !== '') return num(a.montant)
  if (a.action === 'Proposition envoyée' || a.action === 'Signature') {
    const o = L.offre[prospect?.fiche?.offre]
    return Math.max(0, num(o?.prix) - num(a.remise))
  }
  return 0
}

export function waLink(phone, indicatif = '33') {
  if (!phone) return ''
  let n = String(phone).replace(/[\s.+\-()]/g, '')
  if (n.startsWith('0')) n = indicatif + n.slice(1)
  return `https://wa.me/${n}`
}
// Nom du compte Instagram tiré d'un @, d'un nom ou d'un lien partagé (« ?igsh=… » retiré). Vide si ce n'est pas un compte.
export function handleInsta(v) {
  let t = String(v || '').trim()
  if (!t) return ''
  const m = t.match(/(?:instagram\.com|instagr\.am)\/([^?#]*)/i)
  if (m) {
    const parts = m[1].split('/').filter(Boolean)
    // Story : le compte suit « stories/ » ; publication, reel… : pas de compte dans le lien
    if (parts[0]?.toLowerCase() === 'stories') t = parts[1] || ''
    else if (!parts.length || ['p', 'reel', 'reels', 'tv', 'explore', 'accounts'].includes(parts[0].toLowerCase())) return ''
    else t = parts[0]
  } else if (/^https?:\/\//i.test(t) || t.includes(' ')) return ''
  t = t.replace(/^@+/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t.toLowerCase() : ''
}
// Prospect déjà enregistré avec le même compte Instagram (quel que soit son nom)
export function doublonInsta(list, v, exceptId) {
  const h = handleInsta(v)
  return h ? list.find((p) => p.id !== exceptId && handleInsta(p.fiche?.instagram) === h) : null
}
export function instaLink(v) {
  if (!v) return ''
  const h = handleInsta(v)
  if (h) return `https://www.instagram.com/${h}/`
  if (v.startsWith('http')) return v
  return `https://www.instagram.com/${v.replace('@', '').replace(/\s/g, '')}`
}
export function siteLink(v) {
  if (!v) return ''
  return v.startsWith('http') ? v : `https://${v}`
}

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
export function computeStats(data, settings, periode, canal) {
  const { list, byId, clients, sorted, L } = data
  const inP = (d, a, b) => d && d >= a && d <= b
  const canalOk = (c) => canal === 'Tous' || c === canal
  const fixes = settings.depensesFixes.reduce((m, d) => m + num(d.montant), 0)

  // CA des nouveaux clients (gagnés dans la période) et des clients fidèles (gagnés avant)
  const caParType = (ventes, debut) => {
    let caNouveaux = 0
    let caFideles = 0
    ventes.forEach((x) => {
      const p = byId[x.prospect_id]
      const m = montantRetenu(x, p, L)
      if (p?.stageDates[5] && p.stageDates[5] < debut) caFideles += m
      else caNouveaux += m
    })
    return { caNouveaux, caFideles }
  }
  const calc = (a, b, withFixes = true) => {
    const acts = sorted.filter((x) => inP(x.date, a, b))
    const pc = (x) => byId[x.prospect_id]?.canal || ''
    const prospAct = acts.filter((x) => isProspection(x, L))
    const sumAct = (name) =>
      acts.filter((x) => x.action === name && canalOk(pc(x))).reduce((m, x) => m + montantRetenu(x, byId[x.prospect_id], L), 0)
    // Dépenses fixes mensuelles : au prorata des jours pour une semaine
    const partFixes = periode.semaine ? (diffDays(b, a) + 1) / 30.44 : 1
    const depenses = acts.filter((x) => x.action === 'Dépense').reduce((m, x) => m + num(x.montant), 0) + (withFixes ? fixes * partFixes : 0)
    const signes = list.filter((p) => inP(p.stageDates[5], a, b) && canalOk(p.canal)).length
    const propositions = acts.filter((x) => x.action === 'Proposition envoyée' && canalOk(pc(x))).length
    const encaisse = sumAct('Paiement reçu')
    return {
      prospects: list.filter((p) => inP(p.dateAjout, a, b) && canalOk(p.canal)).length,
      appels: prospAct.filter((x) => x.canal === 'Appel' && canalOk(x.canal)).length,
      dm: prospAct.filter((x) => x.canal === 'DM' && canalOk(x.canal)).length,
      reponses: acts.filter((x) => isReponse(x, L) && canalOk(x.canal)).length,
      looms: acts.filter((x) => (x.action === 'Loom envoyé' || x.action === 'Audit réalisé') && canalOk(pc(x))).length,
      rdv: list.filter((p) => inP(p.stageDates[3], a, b) && canalOk(p.canal)).length,
      propositions,
      signes,
      closing: propositions ? signes / propositions : 0,
      caSigne: sumAct('Signature') + sumAct('Vente additionnelle') + sumAct('Intervention'),
      ...caParType(acts.filter((x) => VENTES.includes(x.action) && canalOk(pc(x))), a),
      interventions: acts.filter((x) => x.action === 'Intervention' && canalOk(pc(x))).length,
      encaisse,
      depenses,
      benefice: encaisse - depenses,
      cac: signes ? depenses / signes : null,
      tempsH: acts.filter((x) => isProspection(x, L) || x.action === 'Audit réalisé').reduce((m, x) => m + num(x.duree), 0) / 60,
    }
  }

  const cur = calc(periode.debut, periode.fin, periode.mois !== 'Tous')
  const prev = periode.prevDebut ? calc(periode.prevDebut, periode.prevFin) : null
  const mrr = clients.filter((c) => c.statut === 'Actif' && canalOk(c.prospect.canal)).reduce((m, c) => m + c.abonnement, 0)

  // Entonnoir : prospects ajoutés sur la période
  const cohort = list.filter((p) => inP(p.dateAjout, periode.debut, periode.fin) && canalOk(p.canal))
  const funnel = settings.etapes.slice(0, 7).map((e, i) => ({
    nom: e.nom,
    n: cohort.filter((p) => p.niveau >= i + 1).length,
  }))
  const perdus = cohort.filter((p) => p.etape === 'Perdu').length
  // Entonnoir du process Instagram : de l'ajout à la signature
  const repondu = (p) => p.niveau >= 3 || (p.acts || []).some((a) => isReponse(a, L))
  const process = [
    ['Ajoutés', () => true],
    ['Contactés', (p) => p.niveau >= 2],
    ['Ont répondu', repondu],
    ['Qualifiés', (p) => p.niveau >= 3],
    ['Loom / audit', (p) => p.niveau >= 4],
    ['Appel / RDV', (p) => p.niveau >= 5],
    ['Proposition', (p) => p.niveau >= 6],
    ['Signés', (p) => p.niveau >= 7],
  ].map(([label, f]) => ({ label, n: cohort.filter(f).length }))
  // Répartitions (camemberts)
  const compter = (arr, f) => {
    const m = {}
    arr.forEach((x) => {
      const k = f(x) || 'Non renseigné'
      m[k] = (m[k] || 0) + 1
    })
    return Object.entries(m).map(([label, value]) => ({ label, value }))
  }
  const repCanal = compter(cohort, (p) => p.canal)
  const repSecteur = compter(cohort, (p) => p.fiche?.secteur)
  const repSignal = compter(cohort.filter((p) => p.fiche?.signal), (p) => p.fiche.signal)

  // Par canal
  const acts = sorted.filter((x) => inP(x.date, periode.debut, periode.fin))
  const parCanal = settings.canaux.map((c) => {
    const a = acts.filter((x) => x.canal === c)
    const actions = a.filter((x) => isProspection(x, L)).length
    const reponses = a.filter((x) => isReponse(x, L)).length
    const temps = a.reduce((m, x) => m + num(x.duree), 0) / 60
    const ps = list.filter((p) => p.canal === c)
    const rdv = ps.filter((p) => inP(p.stageDates[3], periode.debut, periode.fin)).length
    const cl = ps.filter((p) => inP(p.stageDates[5], periode.debut, periode.fin)).length
    const ca = acts
      .filter((x) => VENTES.includes(x.action) && byId[x.prospect_id]?.canal === c)
      .reduce((m, x) => m + montantRetenu(x, byId[x.prospect_id], L), 0)
    const appels = a.filter((x) => isProspection(x, L) && c === 'Appel').length
    return {
      canal: c,
      actions,
      reponses,
      taux: actions ? reponses / actions : 0,
      temps,
      rdv,
      clients: cl,
      ca,
      caHeure: temps ? ca / temps : 0,
      heuresClient: cl ? temps / cl : 0,
      appelsHeure: temps && c === 'Appel' ? appels / temps : 0,
    }
  })

  // Pipeline et trésorerie
  const actifs = list.filter((p) => canalOk(p.canal))
  const pipelinePondere = actifs.reduce((m, p) => m + p.pipelinePondere, 0)
  const propositionsEnAttente = actifs.filter((p) => p.etape === 'Proposition').reduce((m, p) => m + num(p.montantPropose), 0)
  const resteAEncaisser = clients.filter((c) => canalOk(c.prospect.canal)).reduce((m, c) => m + c.reste, 0)
  const mrrTous = clients.filter((c) => c.statut === 'Actif').reduce((m, c) => m + c.abonnement, 0)
  const resteTous = clients.reduce((m, c) => m + c.reste, 0)
  const vieMoy = clients.length ? clients.reduce((m, c) => m + c.valeurVie, 0) / clients.length : 0
  const resilies = clients.filter((c) => inP(c.dateResiliation, periode.debut, periode.fin)).length
  const baseClients = clients.filter((c) => c.prospect.dateSignature && c.prospect.dateSignature < periode.debut).length
  const churn = baseClients ? resilies / baseClients : 0

  // Créneaux et jours d'appel
  const appels = acts.filter((x) => x.canal === 'Appel' && isProspection(x, L))
  const creneaux = [
    [8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 21],
  ].map(([h1, h2]) => {
    const a = appels.filter((x) => x.time && Number(x.time.slice(0, 2)) >= h1 && Number(x.time.slice(0, 2)) < h2)
    const r = a.filter((x) => isReponse(x, L)).length
    return { label: `${h1}h - ${h2}h`, n: a.length, r, taux: a.length ? r / a.length : 0 }
  })
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((j, i) => {
    const a = appels.filter((x) => weekday(x.date) === i + 1)
    const r = a.filter((x) => isReponse(x, L)).length
    return { label: j, n: a.length, r, taux: a.length ? r / a.length : 0 }
  })
  // Un envoi compte comme « répondu » si le prospect a répondu ensuite (DM) ou pendant l'appel
  const aRepondu = (x) => isReponse(x, L) || (byId[x.prospect_id]?.acts || []).some((y) => y !== x && y.date >= x.date && isReponse(y, L))
  const modeles = settings.modeles.map((m) => {
    const a = acts.filter((x) => x.modele === m)
    const r = a.filter(aRepondu).length
    return { label: m, n: a.length, r, taux: a.length ? r / a.length : 0 }
  })
  const objTotal = acts.filter((x) => x.objection).length
  const objections = settings.objections
    .map((o) => {
      const n = acts.filter((x) => x.objection === o).length
      return { label: o, n, part: objTotal ? n / objTotal : 0 }
    })
    .sort((a, b) => b.n - a.n)
  const secteurs = settings.secteurs
    .map((sx) => {
      const ps = cohort.filter((p) => p.fiche?.secteur === sx.nom)
      const cl = list.filter((p) => p.fiche?.secteur === sx.nom && inP(p.stageDates[5], periode.debut, periode.fin))
      const ca = cl.reduce((m, p) => m + p.acts.filter((a) => a.action === 'Signature').reduce((k, a) => k + montantRetenu(a, p, L), 0), 0)
      const cyc = cl.filter((p) => p.cycle !== null)
      return {
        label: sx.nom,
        prospects: ps.length,
        clients: cl.length,
        taux: ps.length ? cl.length / ps.length : 0,
        ca,
        cycle: cyc.length ? cyc.reduce((m, p) => m + p.cycle, 0) / cyc.length : null,
      }
    })
    .filter((x) => x.prospects || x.clients)
    .sort((a, b) => b.ca - a.ca || b.clients - a.clients)

  // CA signé par offre sur la période
  const caOffre = {}
  acts.filter((x) => VENTES.includes(x.action) && canalOk(byId[x.prospect_id]?.canal || '')).forEach((x) => {
    const p = byId[x.prospect_id]
    const k = p?.fiche?.offre || 'Sans offre'
    caOffre[k] = (caOffre[k] || 0) + montantRetenu(x, p, L)
  })
  const repOffre = Object.entries(caOffre).map(([label, value]) => ({ label, value }))
  // Taux de réponse et de signature par signal repéré
  const signaux = [...new Set(list.map((p) => p.fiche?.signal).filter(Boolean))].map((sg) => {
    const ps = cohort.filter((p) => p.fiche?.signal === sg)
    const r = ps.filter(repondu).length
    const sgn = ps.filter((p) => p.niveau >= 7).length
    return { label: sg, n: ps.length, r, taux: ps.length ? r / ps.length : 0, signes: sgn }
  }).filter((x) => x.n)

  // Vitesse
  const avg = (arr) => (arr.length ? arr.reduce((m, x) => m + x, 0) / arr.length : null)
  const inCohort = list.filter((p) => inP(p.dateAjout, periode.debut, periode.fin))
  const vitesse = ['→ Contacté', 'Contacté → Qualifié', 'Qualifié → Audit/Démo', 'Audit/Démo → RDV', 'RDV → Proposition', 'Proposition → Gagné'].map(
    (label, i) => {
      const vals = inCohort
        .map((p) => {
          const from = i === 0 ? p.dateAjout : p.stageDates[i - 1]
          const to = p.stageDates[i]
          return from && to ? diffDays(to, from) : null
        })
        .filter((v) => v !== null)
      return { label: `Jours ${label}`, v: avg(vals) }
    },
  )
  const audits = acts.filter((x) => x.action === 'Audit réalisé')
  const autres = [
    { label: 'Temps moyen par audit (min)', v: avg(audits.filter((x) => x.duree).map((x) => num(x.duree))) },
    { label: "Note moyenne d'audit (/100)", v: avg(audits.filter((x) => x.note).map((x) => num(x.note))) },
    {
      label: "Taux d'ouverture des Loom",
      v: (() => {
        const n = acts.filter((x) => x.action === 'Loom envoyé').length
        return n ? acts.filter((x) => x.resultat === 'Loom vu').length / n : null
      })(),
      pct: true,
    },
    { label: 'Clients venus par recommandation', v: clients.filter((c) => c.prospect.fiche?.recommande_par || c.prospect.fiche?.source === 'Recommandation').length },
    { label: 'Satisfaction moyenne (/10)', v: avg(clients.filter((c) => c.satisfaction !== null).map((c) => c.satisfaction)) },
  ]

  return {
    cur,
    prev,
    mrr,
    funnel,
    perdus,
    process,
    repCanal,
    repSecteur,
    repSignal,
    parCanal,
    pipelinePondere,
    propositionsEnAttente,
    resteAEncaisser,
    mrrTous,
    resteTous,
    fixes,
    vieMoy,
    churn,
    creneaux,
    jours,
    modeles,
    objections,
    secteurs,
    repOffre,
    signaux,
    vitesse,
    autres,
  }
}

// Période du tableau de bord : « Mois en cours », « Tous » ou « AAAA-MM ».
export function periodeFor(mois) {
  const t = today()
  // Semaines du lundi au dimanche. Semaine en cours : comparée aux mêmes jours de la semaine d'avant
  if (mois === 'Cette semaine' || mois === 'Semaine dernière') {
    const lundi = addDays(t, 1 - weekday(t))
    if (mois === 'Cette semaine') return { mois, semaine: true, debut: lundi, fin: t, prevDebut: addDays(lundi, -7), prevFin: addDays(t, -7), prevLabel: 'sem. dernière' }
    const l = addDays(lundi, -7)
    return { mois, semaine: true, debut: l, fin: addDays(l, 6), prevDebut: addDays(l, -7), prevFin: addDays(l, -1), prevLabel: 'sem. préc.' }
  }
  if (mois === 'Tous') return { mois, debut: '2000-01-01', fin: '2100-12-31', prevDebut: null, prevFin: null }
  const key = mois === 'Mois en cours' ? t.slice(0, 7) : mois
  const p = prevMonth(key)
  return { mois, key, debut: monthStart(key), fin: monthEnd(key), prevDebut: monthStart(p), prevFin: monthEnd(p), prevLabel: 'mois préc.' }
}

// Évolution mois par mois sur une année
export function monthlySeries(data, settings, year, canal) {
  const out = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const st = computeStats(data, settings, { mois: key, debut: monthStart(key), fin: monthEnd(key) }, canal).cur
    out.push({ key, ...st })
  }
  return out
}

// Objectifs du jour / du mois
export function todayCounts(data) {
  const t = today()
  const { sorted, list, L } = data
  const acts = sorted.filter((a) => a.date === t && isProspection(a, L))
  return {
    prospects: list.filter((p) => p.dateAjout === t).length,
    appels: acts.filter((a) => a.canal === 'Appel').length,
    dm: acts.filter((a) => a.canal === 'DM').length,
  }
}

// Activité jour par jour (ou semaine par semaine sur une longue période) : DM, réponses, Looms, appels
export function activitySeries(data, periode, canal) {
  const { sorted, byId, L } = data
  const t = today()
  let debut = periode.debut
  let fin = periode.fin
  if (periode.mois === 'Tous') {
    const dates = sorted.map((a) => a.date).filter(Boolean).sort()
    debut = dates[0] || t
    fin = t
  }
  const jours = diffDays(fin, debut) + 1
  const parSemaine = jours > 62
  const canalOk = (c) => canal === 'Tous' || c === canal
  const buckets = []
  const index = {}
  // Semaines : du lundi au dimanche
  let d = parSemaine ? addDays(debut, 1 - weekday(debut)) : debut
  while (d <= fin) {
    const b = { date: d, fin: parSemaine ? addDays(d, 6) : d, futur: d > t, dm: 0, reponses: 0, looms: 0, appels: 0 }
    buckets.push(b)
    index[d] = b
    d = addDays(d, parSemaine ? 7 : 1)
  }
  sorted.forEach((x) => {
    if (!x.date || x.date < debut || x.date > fin) return
    const key = parSemaine ? addDays(x.date, 1 - weekday(x.date)) : x.date
    const b = index[key]
    if (!b) return
    const pc = byId[x.prospect_id]?.canal || ''
    if (isProspection(x, L) && x.canal === 'DM' && canalOk(x.canal)) b.dm++
    if (isProspection(x, L) && x.canal === 'Appel' && canalOk(x.canal)) b.appels++
    if (isReponse(x, L) && canalOk(x.canal)) b.reponses++
    if ((x.action === 'Loom envoyé' || x.action === 'Audit réalisé') && canalOk(pc)) b.looms++
  })
  return { buckets, parSemaine }
}
