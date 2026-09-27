// Ma journée « Rule of 100 » : objectifs du jour, compteurs, to-do et historique.
// Chaque journée est un document { type: 'journee', numero: 'AAAA-MM-JJ', data }.
import { today, addDays, weekday } from './dates'
import { isProspection } from './logic'

// Ce que chaque objectif compte automatiquement à partir des saisies
export const SOURCES = [
  ['dm', 'DM envoyés (saisies DM)'],
  ['appels', 'Appels passés (saisies Appel)'],
  ['prospects', 'Nouveaux prospects ajoutés'],
  ['relances', 'Relances faites'],
  ['looms', 'Looms / audits envoyés'],
  ['rdv', 'RDV obtenus'],
  ['propositions', 'Propositions envoyées'],
  ['manuel', 'Compteur manuel uniquement'],
]
export const SOURCE_LABEL = Object.fromEntries(SOURCES)

const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v))

// Identifiant fixe par date : une seule journée par jour, même depuis deux appareils
export const jourId = (date) => `00000000-0000-4000-8000-${date.replace(/-/g, '').padStart(12, '0')}`
export const trouverJour = (documents, date) => documents.find((d) => d.type === 'journee' && d.numero === date)

// Comptage automatique pour une date
export function compterJour(data, date) {
  const { sorted, list, L } = data
  const acts = sorted.filter((a) => a.date === date)
  const prosp = acts.filter((a) => isProspection(a, L))
  return {
    dm: prosp.filter((a) => a.canal === 'DM').length,
    appels: prosp.filter((a) => a.canal === 'Appel').length,
    prospects: list.filter((p) => p.dateAjout === date).length,
    relances: acts.filter((a) => a.action === 'Relance').length,
    looms: acts.filter((a) => a.action === 'Loom envoyé' || a.action === 'Audit réalisé').length,
    rdv: acts.filter((a) => a.action === 'RDV' || a.resultat === 'RDV pris').length,
    propositions: acts.filter((a) => a.action === 'Proposition envoyée').length,
    manuel: 0,
  }
}

// Objectifs par défaut (Paramètres)
export const objectifsParDefaut = (settings) =>
  (settings.objectifsQuotidiens || []).filter((o) => o.nom).map((o) => ({ nom: o.nom, cible: num(o.cible), source: o.source || 'manuel' }))

// Journée « vue » : le document s'il existe, sinon ce qui serait créé
export function journeeVue(documents, settings, date) {
  const doc = trouverJour(documents, date)
  if (doc) return { doc, data: doc.data }
  return { doc: null, data: nouvelleJournee(documents, settings, date) }
}

export function nouvelleJournee(documents, settings, date) {
  const routine = (settings.routine || []).filter(Boolean).map((texte, i) => ({ id: `r${i}`, texte, fait: false, routine: true }))
  // Tâches ponctuelles non faites de la dernière journée : reportées
  const avant = documents
    .filter((d) => d.type === 'journee' && d.numero < date)
    .sort((a, b) => b.numero.localeCompare(a.numero))[0]
  const reportees = (avant?.data?.taches || []).filter((t) => !t.routine && !t.fait).map((t) => ({ ...t, report: (t.report || 0) + 1 }))
  return { objectifs: objectifsParDefaut(settings), compteurs: {}, principal: '', principalFait: false, taches: [...routine, ...reportees] }
}

// Avancement : fait / cible par objectif et score sur 100
export function avancement(jour, counts) {
  const lignes = (jour.objectifs || []).map((o) => {
    const auto = o.source && o.source !== 'manuel' ? counts[o.source] || 0 : 0
    const plus = num(jour.compteurs?.[o.nom])
    return { ...o, auto, plus, fait: auto + plus }
  })
  const cible = lignes.reduce((m, l) => m + num(l.cible), 0)
  const atteint = lignes.reduce((m, l) => m + Math.min(l.fait, num(l.cible)), 0)
  const volume = lignes.reduce((m, l) => m + l.fait, 0)
  return { lignes, score: cible ? Math.round((atteint / cible) * 100) : 0, volume, cible }
}

export const estJourOff = (settings, date) => (settings.joursOff || []).includes(weekday(date))

// Historique des N derniers jours (score, volume) et série de jours réussis
export function historique(documents, settings, data, n = 30) {
  const t = today()
  const jours = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(t, -i)
    const doc = trouverJour(documents, date)
    const jour = doc ? doc.data : { objectifs: objectifsParDefaut(settings), compteurs: {} }
    const av = avancement(jour, compterJour(data, date))
    jours.push({ date, score: av.score, volume: av.volume, off: estJourOff(settings, date) && av.volume === 0, today: date === t })
  }
  // Série : jours réussis consécutifs (on saute les jours off, aujourd'hui compte seulement s'il est réussi)
  let serie = 0
  for (let i = jours.length - 1; i >= 0; i--) {
    const j = jours[i]
    if (j.off) continue
    if (j.score >= 100) serie++
    else if (j.today) continue
    else break
  }
  const actifs = jours.filter((j) => !j.off && !j.today)
  const moyenne = actifs.length ? Math.round(actifs.reduce((m, j) => m + j.volume, 0) / actifs.length) : 0
  const reussis = jours.filter((j) => j.score >= 100).length
  return { jours, serie, moyenne, reussis }
}
