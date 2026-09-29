// Cockpit du tableau de bord : calculs purs sur les données réelles du CRM (aucune donnée inventée).
// Mêmes règles que computeStats (logic.js) pour que chaque chiffre corresponde à sa liste de détail.
import { isProspection, isReponse, VENTES, montantRetenu } from '../../lib/logic'
import { addDays, diffDays, weekday, pad } from '../../lib/dates'

const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0

// Indicateurs suivis dans le temps. objectif : clé(s) de settings.objectifsMois
export const METRIQUES = {
  encaisse: { label: 'Encaissé', argent: true },
  caSigne: { label: 'CA signé', argent: true, objectif: ['ca'] },
  contacts: { label: 'Contacts', long: 'Contacts (DM + appels)', objectif: ['dm', 'appels'] },
  reponses: { label: 'Réponses' },
  rdv: { label: 'RDV', long: 'RDV obtenus', objectif: ['rdv'] },
  signes: { label: 'Signés', long: 'Clients signés', objectif: ['clients'] },
  prospects: { label: 'Prospects', long: 'Prospects ajoutés' },
}

// ---------- Découpage du temps ----------
// Jour par jour jusqu'à 2 mois, puis semaine par semaine jusqu'à 13 mois, puis mois par mois
export const pasPour = (debut, fin) => {
  const n = diffDays(fin, debut) + 1
  return n <= 62 ? 'jour' : n <= 400 ? 'semaine' : 'mois'
}
const moisSuivant = (d) => {
  const [y, m] = d.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`
}
const debutCase = (d, pas) => (pas === 'jour' ? d : pas === 'semaine' ? addDays(d, 1 - weekday(d)) : `${d.slice(0, 7)}-01`)
const caseSuivante = (d, pas) => (pas === 'jour' ? addDays(d, 1) : pas === 'semaine' ? addDays(d, 7) : moisSuivant(d))
const finCase = (d, pas) => (pas === 'jour' ? d : pas === 'semaine' ? addDays(d, 6) : addDays(moisSuivant(d), -1))

// Tous les indicateurs, case par case, en un seul passage sur les actions et les prospects.
// garder(p) : filtre croisé sur les prospects (ex. une étape cliquée) ; l'argent sans client est alors exclu.
export function agreger(data, debut, fin, canal = 'Tous', pas = pasPour(debut, fin), garder = null) {
  const { sorted, list, byId, L } = data
  const ok = (c) => canal === 'Tous' || c === canal
  const cases = []
  const index = {}
  for (let d = debutCase(debut, pas); d <= fin; d = caseSuivante(d, pas)) {
    const b = { date: d, fin: finCase(d, pas), encaisse: 0, caSigne: 0, contacts: 0, reponses: 0, rdv: 0, signes: 0, prospects: 0, propositions: 0, depenses: 0 }
    cases.push(b)
    index[d] = b
    if (cases.length > 2000) break
  }
  const caseDe = (d) => index[debutCase(d, pas)]
  const dans = (d) => d && d >= debut && d <= fin
  for (const x of sorted) {
    if (!dans(x.date)) continue
    const b = caseDe(x.date)
    if (!b) continue
    const p = byId[x.prospect_id]
    if (garder && !(p && garder(p))) continue
    const pc = p?.canal || ''
    if (isProspection(x, L) && (x.canal === 'DM' || x.canal === 'Appel') && ok(x.canal)) b.contacts++
    if (isReponse(x, L) && ok(x.canal)) b.reponses++
    if (x.action === 'Paiement reçu' && ok(pc)) b.encaisse += montantRetenu(x, p, L)
    if (VENTES.includes(x.action) && ok(pc)) b.caSigne += montantRetenu(x, p, L)
    if (x.action === 'Proposition envoyée' && ok(pc)) b.propositions++
    if (x.action === 'Dépense') b.depenses += num(x.montant)
  }
  for (const p of list) {
    if (!ok(p.canal) || (garder && !garder(p))) continue
    const ajout = dans(p.dateAjout) && caseDe(p.dateAjout)
    const rdv = dans(p.stageDates[3]) && caseDe(p.stageDates[3])
    const signe = dans(p.stageDates[5]) && caseDe(p.stageDates[5])
    if (ajout) ajout.prospects++
    if (rdv) rdv.rdv++
    if (signe) signe.signes++
  }
  return cases
}
export const somme = (cases, k) => cases.reduce((m, b) => m + (b[k] || 0), 0)

// Objectif d'un indicateur pour une période : objectif mensuel × nombre de jours / jours du mois moyen (30,44).
// Un mois complet reçoit donc exactement son objectif mensuel.
export function objectifPeriode(settings, metrique, debut, fin, moisComplet) {
  const cles = METRIQUES[metrique]?.objectif
  if (!cles) return null
  const mensuel = cles.reduce((m, k) => m + num(settings.objectifsMois?.[k]), 0)
  if (!mensuel) return null
  return moisComplet ? mensuel : (mensuel * (diffDays(fin, debut) + 1)) / 30.44
}

// ---------- Anomalies : comparaison aux 4 périodes de même durée qui précèdent ----------
export function anomalies(data, debut, fin, canal, jour) {
  const finEff = fin > jour ? jour : fin
  const n = diffDays(finEff, debut) + 1
  if (n < 1 || n > 400) return []
  const fen = [1, 2, 3, 4].map((k) => agreger(data, addDays(debut, -k * n), addDays(debut, -(k - 1) * n - 1), canal, 'mois'))
  const cur = agreger(data, debut, finEff, canal, 'mois')
  const out = []
  const libelle = { contacts: 'Contacts (DM + appels)', reponses: 'Réponses', rdv: 'RDV obtenus', signes: 'Clients signés', encaisse: 'Encaissé', caSigne: 'CA signé' }
  Object.keys(libelle).forEach((k) => {
    const vals = fen.map((c) => somme(c, k))
    const actives = vals.filter((v) => v > 0).length
    const moy = vals.reduce((m, v) => m + v, 0) / 4
    const v = somme(cur, k)
    const argent = k === 'encaisse' || k === 'caSigne'
    if (actives < 2 || (!argent && moy < 3)) return
    const r = v / moy
    if (r <= 0.5) out.push({ k, sens: 'baisse', v, moy, ecart: r - 1, label: libelle[k] })
    else if (r >= 1.8) out.push({ k, sens: 'hausse', v, moy, ecart: r - 1, label: libelle[k] })
  })
  // Taux de réponse : écart d'au moins 10 points avec suffisamment d'envois
  const cC = somme(cur, 'contacts')
  const bC = fen.reduce((m, c) => m + somme(c, 'contacts'), 0)
  if (cC >= 10 && bC >= 20) {
    const t = somme(cur, 'reponses') / cC
    const b = fen.reduce((m, c) => m + somme(c, 'reponses'), 0) / bC
    if (t - b <= -0.1) out.push({ k: 'taux', sens: 'baisse', v: t, moy: b, ecart: t - b, label: 'Taux de réponse', taux: true })
    else if (t - b >= 0.1) out.push({ k: 'taux', sens: 'hausse', v: t, moy: b, ecart: t - b, label: 'Taux de réponse', taux: true })
  }
  return out.map((a) => ({ ...a, jours: n }))
}

// ---------- Parcours de l'amont à l'aval ----------
// Pour chaque étape : prospects de la période qui l'ont atteinte, taux de passage, perdus à cette étape,
// comparaison au taux habituel (prospects ajoutés avant la période), dossiers en attente et délai de passage.
const mediane = (arr) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const atteinte = (p, i) => (i === 0 ? p.dateAjout : p.stageDates[i - 1])
export function parcours(data, settings, debut, fin, canal, jour) {
  const { list, clients } = data
  const ok = (c) => canal === 'Tous' || c === canal
  const noms = settings.etapes.slice(0, 7).map((e) => e.nom)
  const dans = (d) => d && d >= debut && d <= fin
  const cohorte = list.filter((p) => dans(p.dateAjout) && ok(p.canal))
  const avant = list.filter((p) => p.dateAjout && p.dateAjout < debut && ok(p.canal))
  const seuil = num(settings.alertes?.sansAction) || 7
  const ouverts = list.filter((p) => ok(p.canal) && p.etape !== 'Perdu')
  const etapes = noms.map((nom, i) => {
    const n = cohorte.filter((p) => p.niveau >= i + 1).length
    const nPrec = i ? cohorte.filter((p) => p.niveau >= i).length : null
    const hN = avant.filter((p) => p.niveau >= i + 1).length
    const hPrec = i ? avant.filter((p) => p.niveau >= i).length : null
    const enAttente = i < 6 ? ouverts.filter((p) => p.etape === nom) : []
    const bloques = enAttente.filter((p) => p.joursSansAction !== null && p.joursSansAction >= seuil)
    // Délai pour arriver à cette étape depuis la précédente, pour les prospects arrivés pendant la période
    const delais = i
      ? list
          .filter((p) => ok(p.canal) && dans(atteinte(p, i)) && atteinte(p, i - 1))
          .map((p) => diffDays(atteinte(p, i), atteinte(p, i - 1)))
          .filter((d) => d >= 0)
      : []
    return {
      i,
      nom,
      n,
      passage: i ? (nPrec ? n / nPrec : null) : null,
      habituel: i && hPrec >= 5 ? hN / hPrec : null,
      perdus: cohorte.filter((p) => p.etape === 'Perdu' && p.niveau === i + 1).length,
      enAttente,
      bloques,
      delaiMoy: delais.length ? delais.reduce((m, d) => m + d, 0) / delais.length : null,
      delaiMed: mediane(delais),
      nDelais: delais.length,
    }
  })
  // Dernière étape : clients de la période qui ont déjà payé
  const payes = cohorte.filter((p) => p.niveau >= 7 && (clients.find((c) => c.id === p.id)?.encaisse || 0) > 0).length
  const signes = etapes[6]?.n || 0
  etapes.push({ i: 7, nom: 'Payé', n: payes, passage: signes ? payes / signes : null, habituel: null, perdus: 0, enAttente: [], bloques: [], delaiMoy: null, delaiMed: null, nDelais: 0, argent: true })
  // Étape qui freine le plus : le plus bas taux de passage par rapport à l'habitude (ou le plus bas tout court)
  const candidats = etapes.filter((e) => e.passage !== null && e.i > 0 && e.i < 7 && (cohorte.filter((p) => p.niveau >= e.i).length >= 3))
  const frein = candidats.length
    ? candidats.reduce((m, e) => {
        const s = e.habituel !== null ? e.passage - e.habituel : e.passage - 1
        const sm = m.habituel !== null ? m.passage - m.habituel : m.passage - 1
        return s < sm ? e : m
      })
    : null
  return { etapes, cohorte, frein: frein ? frein.i : null, jour }
}

// ---------- Score de santé ----------
// Formule (documentée, sans pondération arbitraire) : moyenne simple des dimensions disponibles, chacune de 0 à 100 %.
// - Prospection : contacts du mois / objectif (DM + appels) ramené au jour du mois, plafonné à 100 %.
// - Ventes : CA signé du mois / objectif de CA ramené au jour du mois, plafonné à 100 %.
// - Relances : part des prospects à relancer qui ne sont pas en retard.
// - Encaissements : part du reste à encaisser sur factures qui n'est pas en retard.
// Une dimension sans objectif ou sans donnée est ignorée (jamais comptée à 0 ni à 100).
export function sante({ mois, objectifs, jourDuMois, joursDuMois, prospects, jour, impayes, enRetard }) {
  const prorata = jourDuMois / joursDuMois
  const dims = []
  const objContacts = num(objectifs?.dm) + num(objectifs?.appels)
  if (objContacts) dims.push({ k: 'prospection', label: 'Prospection', v: Math.min(1, (mois.dm + mois.appels) / (objContacts * prorata)), detail: `${mois.dm + mois.appels} contacts pour ${Math.round(objContacts * prorata)} attendus à ce jour` })
  if (num(objectifs?.ca)) dims.push({ k: 'ventes', label: 'Ventes', v: Math.min(1, mois.caSigne / (num(objectifs.ca) * prorata)), detail: 'CA signé face à l’objectif ramené à ce jour' })
  const aRelancer = prospects.filter((p) => p.relance && p.etape !== 'Perdu' && p.etape !== 'Gagné')
  if (aRelancer.length) {
    const retard = aRelancer.filter((p) => p.relance < jour).length
    dims.push({ k: 'relances', label: 'Relances', v: 1 - retard / aRelancer.length, detail: `${retard} en retard sur ${aRelancer.length} à relancer` })
  }
  if (impayes > 0) dims.push({ k: 'encaissements', label: 'Encaissements', v: 1 - Math.min(1, enRetard / impayes), detail: 'Part du reste à encaisser qui n’est pas en retard' })
  if (!dims.length) return null
  const score = Math.round((dims.reduce((m, d) => m + d.v, 0) / dims.length) * 100)
  return { score, dims, etat: score >= 75 ? 'bon' : score >= 50 ? 'moyen' : 'faible' }
}

// ---------- Qualité des données ----------
const chiffres = (s) => String(s || '').replace(/\D/g, '').slice(-8)
export function qualite(data, jour) {
  const { list, sorted, L } = data
  const out = []
  // Doublons : même téléphone (8 derniers chiffres) ou même nom
  const groupes = {}
  list.forEach((p) => {
    const tel = chiffres(p.fiche?.telephone || p.fiche?.whatsapp)
    if (tel.length >= 8) (groupes[`t${tel}`] = groupes[`t${tel}`] || []).push(p)
    const nom = String(p.name || '').trim().toLowerCase()
    if (nom) (groupes[`n${nom}`] = groupes[`n${nom}`] || []).push(p)
  })
  const doublons = [...new Set(Object.values(groupes).filter((g) => g.length > 1).flat())]
  if (doublons.length) out.push({ k: 'doublons', label: 'Fiches en double (même nom ou même téléphone)', res: { type: 'prospects', items: doublons } })
  const sansContact = list.filter((p) => p.etape !== 'Perdu' && !['telephone', 'whatsapp', 'email', 'instagram'].some((k) => String(p.fiche?.[k] || '').trim()))
  if (sansContact.length) out.push({ k: 'contact', label: 'Fiches ouvertes sans téléphone, e-mail ni Instagram', res: { type: 'prospects', items: sansContact } })
  const faits = (x) => x.action === 'Paiement reçu' || x.action === 'Dépense' || VENTES.includes(x.action) || isProspection(x, L)
  const futures = sorted.filter((x) => faits(x) && x.date && x.date > addDays(jour, 1))
  if (futures.length) out.push({ k: 'futur', label: 'Actions réalisées datées dans le futur', res: { type: 'actions', items: futures } })
  const invalides = sorted.filter((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '') || x.date < '2000-01-01')
  if (invalides.length) out.push({ k: 'dates', label: 'Actions sans date valide', res: { type: 'actions', items: invalides } })
  const sansClient = sorted.filter((x) => x.action === 'Paiement reçu' && !x.prospect_id && !x.facture)
  if (sansClient.length) out.push({ k: 'sansClient', label: 'Paiements reliés à aucun client ni facture', res: { type: 'actions', items: sansClient } })
  // Montants extrêmes : plus de 20 fois la médiane des montants du même type (5 montants au moins)
  const extremes = []
  ;['Paiement reçu', 'Dépense', 'Signature'].forEach((type) => {
    const xs = sorted.filter((x) => x.action === type && num(x.montant) > 0)
    const med = mediane(xs.map((x) => num(x.montant)))
    if (xs.length >= 5 && med) extremes.push(...xs.filter((x) => num(x.montant) > 20 * med))
  })
  if (extremes.length) out.push({ k: 'extremes', label: 'Montants inhabituels (plus de 20 fois le montant courant)', res: { type: 'actions', items: extremes } })
  const incoherents = data.clients.filter((c) => c.total > 0 && c.encaisse > c.total * 1.5).map((c) => c.prospect)
  if (incoherents.length) out.push({ k: 'encaisse', label: 'Clients qui ont payé bien plus que ce qui a été vendu', res: { type: 'prospects', items: incoherents } })
  return out
}
