// Tableau de bord › statistiques : chiffres d'une période, séries mensuelles et activité
// (repris de l'onglet Tableau de bord du fichier Excel).
import { addDays, diffDays, today, monthStart, monthEnd, prevMonth, weekday } from '../../lib/dates'
import { num, isProspection, isReponse, VENTES, montantRetenu } from '../../lib/logic'
import { chargesFixesMois } from '../../lib/tresorerie'

export function computeStats(data, settings, periode, canal) {
  const { list, byId, clients, sorted, L } = data
  const inP = (d, a, b) => d && d >= a && d <= b
  const canalOk = (c) => canal === 'Tous' || c === canal
  const fixes = chargesFixesMois(settings.depensesFixes)

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
  // Jours glissants : jamais vide un lundi matin, comparés aux N jours d'avant
  if (mois === '7 derniers jours' || mois === '30 derniers jours') {
    const n = mois.startsWith('7') ? 7 : 30
    const debut = addDays(t, 1 - n)
    return { mois, semaine: true, debut, fin: t, prevDebut: addDays(debut, -n), prevFin: addDays(debut, -1), prevLabel: `${n} j préc.` }
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
