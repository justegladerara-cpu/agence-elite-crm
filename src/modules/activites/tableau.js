// Calculs du tableau de bord (fonctions pures, tests/tableau.test.js) : argent reçu par service et par jour,
// poches d'argent (espèces, Mobile Money, banque), d'où vient l'argent dépensé, prospection, villes du Congo.
import { addDays, diffDays, monthKey, today, weekday } from '../../lib/dates'
import { montant as num } from '../../lib/finances'
import { activitesDe, devinerActivite, norm } from './calculs'

// ---------- Périodes ----------
export const PERIODES_TB = [
  ['jour', 'Aujourd’hui'],
  ['7j', '7 jours'],
  ['30j', '30 jours'],
  ['90j', '3 mois'],
  ['365j', '12 mois'],
]

// Période choisie (ou dates libres) et période d'avant de même durée
export function periodeTB(choix = '30j', t = today(), libre = null) {
  if (choix === 'libre' && libre?.debut && libre?.fin) {
    const n = diffDays(libre.fin, libre.debut) + 1
    return { debut: libre.debut, fin: libre.fin, avantDebut: addDays(libre.debut, -n), avantFin: addDays(libre.debut, -1), jours: n, nom: 'sur ces dates' }
  }
  const n = { jour: 1, '7j': 7, '30j': 30, '90j': 90, '365j': 365 }[choix] || 30
  const debut = addDays(t, -(n - 1))
  return { debut, fin: t, avantDebut: addDays(debut, -n), avantFin: addDays(debut, -1), jours: n, nom: n === 1 ? 'aujourd’hui' : `sur ${n === 90 ? '3 mois' : n === 365 ? '12 mois' : `${n} jours`}` }
}
const dans = (d, debut, fin) => !!d && d >= debut && d <= fin

// ---------- Argent reçu ----------
// Chaque paiement reçu, avec son client et son service (activité)
export function paiementsDetailles(actions = [], documents = [], prospects = [], settings = {}) {
  const noms = Object.fromEntries(prospects.map((p) => [p.id, p.name]))
  const acts = new Set(activitesDe(settings).map((a) => a.id))
  const parFacture = {}
  for (const d of documents) {
    if (d.type !== 'facture' || !d.numero) continue
    const m = {}
    for (const l of d.data?.lignes || []) {
      const id = l.activite || devinerActivite(`${l.designation || ''} ${l.description || ''}`, settings) || 'autre'
      m[id] = (m[id] || 0) + num(l.pu) * num(l.qte || 1)
    }
    const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0]
    parFacture[d.numero] = { activite: top?.[0] || devinerActivite(d.data?.objet, settings) || 'autre', client: d.data?.client?.nom, objet: d.data?.objet }
  }
  return actions
    .filter((a) => a.action === 'Paiement reçu')
    .map((a) => {
      const f = a.facture ? parFacture[a.facture] : null
      const activite = (a.categorie && acts.has(a.categorie) && a.categorie) || f?.activite || devinerActivite(a.notes, settings) || 'autre'
      const client = noms[a.prospect_id] || f?.client || ''
      return { id: a.id, date: a.date, montant: num(a.montant), mode: a.mode || '', reference: a.reference || '', facture: a.facture || '', notes: a.notes || f?.objet || '', prospectId: a.prospect_id || null, client, sansClient: !a.prospect_id, activite, created_at: a.created_at }
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

// Somme reçue par service sur la période, avec la période d'avant
export function recuParService(paiements, settings, p) {
  return activitesDe(settings)
    .map((a) => {
      const cur = paiements.filter((x) => x.activite === a.id && dans(x.date, p.debut, p.fin))
      const avant = paiements.filter((x) => x.activite === a.id && dans(x.date, p.avantDebut, p.avantFin))
      const total = cur.reduce((m, x) => m + x.montant, 0)
      const totalAvant = avant.reduce((m, x) => m + x.montant, 0)
      return { ...a, total, totalAvant, n: cur.length, evolution: totalAvant > 0 ? (total - totalAvant) / totalAvant : total > 0 ? null : 0 }
    })
    .filter((a) => a.total > 0 || a.totalAvant > 0)
    .sort((a, b) => b.total - a.total)
}

// Classement des clients par argent reçu sur la période
export function classementClients(paiements, p, n = 8) {
  const m = {}
  for (const x of paiements) {
    if (!dans(x.date, p.debut, p.fin)) continue
    const k = x.prospectId || `nom:${norm(x.client || x.notes || 'sans nom')}`
    m[k] = m[k] || { cle: k, prospectId: x.prospectId, nom: x.client || 'Client sans nom', total: 0, n: 0, services: {} }
    m[k].total += x.montant
    m[k].n += 1
    m[k].services[x.activite] = (m[k].services[x.activite] || 0) + x.montant
  }
  return Object.values(m)
    .map((c) => ({ ...c, service: Object.entries(c.services).sort((a, b) => b[1] - a[1])[0]?.[0] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
}

// Courbe : une valeur par jour (par semaine au-delà de 3 mois), période d'avant superposée
export function courbe(paiements, p) {
  const pas = p.jours > 120 ? 7 : 1
  const points = []
  for (let d = p.debut, i = 0; d <= p.fin && i < 400; d = addDays(d, pas), i++) {
    const fin = pas === 1 ? d : addDays(d, pas - 1)
    const dAvant = addDays(p.avantDebut, diffDays(d, p.debut))
    const finAvant = addDays(dAvant, pas - 1)
    points.push({
      date: d,
      v: paiements.filter((x) => dans(x.date, d, fin > p.fin ? p.fin : fin)).reduce((m, x) => m + x.montant, 0),
      avant: paiements.filter((x) => dans(x.date, dAvant, finAvant)).reduce((m, x) => m + x.montant, 0),
    })
  }
  return { points, pas }
}

// Objectif du mois : reçu depuis le 1er, rythme et projection en fin de mois
export function objectifMois(paiements, objectif, t = today()) {
  const mois = monthKey(t)
  const recu = paiements.filter((x) => monthKey(x.date) === mois).reduce((m, x) => m + x.montant, 0)
  const jour = Number(t.slice(8, 10))
  const [y, mm] = mois.split('-').map(Number)
  const joursMois = new Date(y, mm, 0).getDate()
  const projection = jour ? Math.round((recu / jour) * joursMois) : recu
  const manque = Math.max(0, objectif - recu)
  const resteJours = joursMois - jour
  return { recu, objectif, part: objectif ? recu / objectif : 0, projection, manque, resteJours, parJour: resteJours > 0 ? Math.ceil(manque / resteJours) : manque }
}

// ---------- Poches d'argent ----------
export const POCHES = [
  { id: 'especes', nom: 'Espèces', couleur: '#16A34A', modes: ['espèces', 'especes', 'cash', 'liquide'] },
  { id: 'mobile', nom: 'Mobile Money', couleur: '#F59E0B', modes: ['mobile money', 'mtn', 'airtel', 'momo', 'mobile'] },
  { id: 'banque', nom: 'Banque', couleur: '#2563EB', modes: ['virement', 'chèque', 'cheque', 'carte', 'banque'] },
]
export const pocheDe = (mode) => {
  const m = norm(mode)
  return (POCHES.find((p) => p.modes.some((k) => m.includes(norm(k)))) || POCHES[0]).id
}

// Solde de chaque poche : argent reçu moins argent sorti (dépenses de l'entreprise et pour moi)
export function poches(actions = []) {
  const out = Object.fromEntries(POCHES.map((p) => [p.id, { ...p, entre: 0, sorti: 0, solde: 0 }]))
  for (const a of actions) {
    if (a.action !== 'Paiement reçu' && a.action !== 'Dépense') continue
    const p = out[pocheDe(a.mode)]
    if (a.action === 'Paiement reçu') p.entre += num(a.montant)
    else p.sorti += num(a.montant)
  }
  return POCHES.map((p) => ({ ...out[p.id], solde: out[p.id].entre - out[p.id].sorti }))
}

// D'où vient l'argent dépensé : chaque dépense prend dans les paiements reçus, du plus ancien au plus récent
export function origineDepenses(actions = [], prospects = []) {
  const noms = Object.fromEntries(prospects.map((p) => [p.id, p.name]))
  const ordre = (a, b) => (a.date || '').localeCompare(b.date || '') || String(a.created_at || '').localeCompare(String(b.created_at || ''))
  const recus = actions.filter((a) => a.action === 'Paiement reçu').sort(ordre).map((a) => ({ a, reste: num(a.montant) }))
  const sources = {}
  let i = 0
  for (const d of actions.filter((x) => x.action === 'Dépense').sort(ordre)) {
    let besoin = num(d.montant)
    const parts = []
    while (besoin > 0 && i < recus.length) {
      const r = recus[i]
      if (r.a.date > d.date) break
      const pris = Math.min(besoin, r.reste)
      if (pris > 0) parts.push({ paiementId: r.a.id, client: noms[r.a.prospect_id] || r.a.notes || 'Paiement sans nom', date: r.a.date, montant: pris })
      r.reste -= pris
      besoin -= pris
      if (r.reste <= 0) i++
    }
    sources[d.id] = { parts, nonCouvert: besoin }
  }
  const restes = Object.fromEntries(recus.map((r) => [r.a.id, r.reste]))
  return { sources, restes }
}

// ---------- Dépenses ----------
export const POUR_MOI = 'Moi'
export const estPourMoi = (a) => a?.action === 'Dépense' && a.canal === POUR_MOI
export const CATEGORIES_MOI = ['Spiritualité', 'Famille', 'Repas', 'Transport', 'Santé', 'Habits', 'Loisirs', 'Autre']

// Résumé des dépenses pour moi sur la période, par catégorie
export function depensesMoi(actions, p) {
  const liste = actions.filter((a) => estPourMoi(a) && dans(a.date, p.debut, p.fin))
  const parCat = {}
  for (const a of liste) parCat[a.categorie || 'Autre'] = (parCat[a.categorie || 'Autre'] || 0) + num(a.montant)
  return { liste: liste.sort((a, b) => (b.date || '').localeCompare(a.date || '')), total: liste.reduce((m, a) => m + num(a.montant), 0), categories: Object.entries(parCat).sort((a, b) => b[1] - a[1]) }
}

// ---------- Prospection ----------
const CONTACT = ['Premier contact', 'Relance', 'Appel', 'DM', 'Email', 'Proposition', 'Visite']
const REPONSES = ['A répondu', 'Intéressé', 'RDV pris', 'Rappeler']
export function prospection(actions, prospects, p, t = today()) {
  const per = actions.filter((a) => dans(a.date, p.debut, p.fin))
  const contactes = new Set(per.filter((a) => CONTACT.includes(a.action) || ['DM', 'Appel', 'Email'].includes(a.canal)).map((a) => a.prospect_id).filter(Boolean))
  const repondu = new Set(per.filter((a) => REPONSES.includes(a.resultat)).map((a) => a.prospect_id).filter(Boolean))
  const interesses = new Set(per.filter((a) => ['Intéressé', 'RDV pris'].includes(a.resultat) || a.action === 'RDV' || a.action === 'Proposition').map((a) => a.prospect_id).filter(Boolean))
  const gagnes = new Set(per.filter((a) => ['Signature', 'Paiement reçu', 'Intervention'].includes(a.action) && contactes.has(a.prospect_id)).map((a) => a.prospect_id))
  const estDm = (a) => a.canal === 'DM' && ['Premier contact', 'Relance'].includes(a.action)
  const lundi = addDays(t, 1 - weekday(t))
  const mois = monthKey(t)
  return {
    contactes: contactes.size,
    repondu: repondu.size,
    interesses: interesses.size,
    gagnes: gagnes.size,
    dmPeriode: per.filter(estDm).length,
    dmSemaine: actions.filter((a) => estDm(a) && dans(a.date, lundi, t)).length,
    dmMois: actions.filter((a) => estDm(a) && monthKey(a.date) === mois).length,
    appels: per.filter((a) => a.canal === 'Appel' || a.action === 'Appel').length,
    ajoutes: prospects.filter((x) => dans(x.dateAjout || String(x.created_at || '').slice(0, 10), p.debut, p.fin)).length,
    tauxReponse: contactes.size ? repondu.size / contactes.size : null,
    tauxSignature: contactes.size ? gagnes.size / contactes.size : null,
  }
}

// ---------- Carte du Congo ----------
export const VILLES = [
  ['Brazzaville', 15.28, -4.27],
  ['Pointe-Noire', 11.86, -4.78],
  ['Dolisie', 12.67, -4.2],
  ['Nkayi', 13.29, -4.18],
  ['Madingou', 13.55, -4.15],
  ['Kinkala', 14.76, -4.36],
  ['Sibiti', 13.35, -3.68],
  ['Mossendjo', 12.73, -2.95],
  ['Djambala', 14.75, -2.54],
  ['Gamboma', 15.86, -1.88],
  ['Oyo', 15.9, -1.16],
  ['Owando', 15.91, -0.48],
  ['Ewo', 14.82, -0.88],
  ['Ouesso', 16.05, 1.61],
  ['Impfondo', 18.06, 1.62],
  ['Loango', 11.83, -4.65],
]
// Contour simplifié de la République du Congo (longitude, latitude)
export const CONTOUR_CONGO = [
  [11.1, -3.95], [11.55, -3.5], [11.75, -3.05], [11.6, -2.7], [12.0, -2.4], [12.5, -2.0], [13.0, -2.35], [13.6, -2.4],
  [14.05, -2.0], [14.4, -1.5], [14.3, -0.6], [13.9, 0.0], [14.1, 0.6], [14.3, 1.3], [13.15, 1.55], [13.3, 2.2],
  [14.4, 2.05], [15.4, 2.0], [16.0, 2.3], [16.5, 3.2], [17.1, 3.7], [17.8, 3.6], [18.6, 3.45], [18.1, 2.0],
  [17.9, 1.0], [17.8, 0.3], [17.6, -0.6], [17.0, -1.0], [16.5, -1.8], [16.2, -2.5], [16.2, -3.4], [15.9, -3.8],
  [15.3, -4.3], [14.4, -4.3], [14.0, -4.45], [13.4, -4.9], [13.0, -4.8], [12.5, -4.6], [12.0, -5.02], [11.85, -4.8],
]
// Ville d'une fiche : champ ville, quartier, adresse ou zone, sinon le nom (ex. « Bar Pointe-Noire »)
export function villeDe(p) {
  const f = p?.fiche || {}
  const texte = norm([f.ville, f.adresse, f.quartier, f.zone, f.adresse_facturation, p?.name].filter(Boolean).join(' '))
  if (!texte) return null
  const v = VILLES.find(([nom]) => texte.includes(norm(nom)) || (nom === 'Brazzaville' && /\bbrazza\b|\bbzv\b/.test(texte)) || (nom === 'Pointe-Noire' && /\bpnr\b|\bponton\b/.test(texte)))
  return v ? v[0] : null
}
export function parVille(prospects, clientsIds) {
  const m = {}
  let sans = 0
  for (const p of prospects) {
    const v = villeDe(p)
    if (!v) {
      sans++
      continue
    }
    m[v] = m[v] || { ville: v, clients: 0, prospects: 0 }
    if (clientsIds.has(p.id)) m[v].clients++
    else m[v].prospects++
  }
  return { villes: Object.values(m).sort((a, b) => b.clients + b.prospects - (a.clients + a.prospects)), sans }
}

// ---------- À compléter ----------
// Clients qui ont payé mais dont la fiche manque d'infos (téléphone, mail, ville), et paiements sans client
export function aCompleter(paiements, prospects) {
  const byId = Object.fromEntries(prospects.map((p) => [p.id, p]))
  const vus = new Set()
  const fiches = []
  for (const x of paiements) {
    if (!x.prospectId || vus.has(x.prospectId)) continue
    vus.add(x.prospectId)
    const p = byId[x.prospectId]
    if (!p) continue
    const f = p.fiche || {}
    const manque = [!(f.telephone || f.tel || f.whatsapp) && 'téléphone', !f.email && 'mail', !villeDe(p) && 'ville'].filter(Boolean)
    if (manque.length) fiches.push({ prospect: p, manque, total: paiements.filter((y) => y.prospectId === p.id).reduce((m, y) => m + y.montant, 0) })
  }
  return { fiches: fiches.sort((a, b) => b.total - a.total), sansClient: paiements.filter((x) => x.sansClient) }
}
