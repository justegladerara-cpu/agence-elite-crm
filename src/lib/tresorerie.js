// Argent de la période : paiements reçus et dépenses, reliés entre eux et aux clients.
// Une dépense peut être rattachée à un paiement (reference « paiement:<id> »), ex. le taxi d'un dépannage.
import { montant as num } from './finances'

export const REF_PAIEMENT = 'paiement:'
export const paiementLie = (a) => (String(a?.reference || '').startsWith(REF_PAIEMENT) ? a.reference.slice(REF_PAIEMENT.length) : null)

// Mouvements d'argent entre debut et fin (inclus), du plus récent au plus ancien
export function mouvements(actions, debut, fin) {
  const dans = (a) => a.date && a.date >= debut && a.date <= fin
  const liste = actions.filter((a) => (a.action === 'Paiement reçu' || a.action === 'Dépense') && dans(a))
  // Frais rattachés à chaque paiement (toutes dates confondues)
  const frais = {}
  actions.forEach((a) => {
    const id = a.action === 'Dépense' && paiementLie(a)
    if (id) (frais[id] = frais[id] || []).push(a)
  })
  return liste
    .map((a) => {
      const entree = a.action === 'Paiement reçu'
      const f = entree ? frais[a.id] || [] : []
      const coutLie = f.reduce((m, x) => m + num(x.montant), 0)
      return { a, entree, montant: num(a.montant), frais: f, coutLie, net: entree ? num(a.montant) - coutLie : null, sansClient: entree && !a.prospect_id && !a.facture }
    })
    .sort((x, y) => (y.a.date || '').localeCompare(x.a.date || '') || (y.a.created_at || '').localeCompare(x.a.created_at || ''))
}

// Totaux de la période ; fixes = part des dépenses fixes mensuelles comptée par le tableau de bord
export function resumeArgent(mvts, fixes = 0) {
  const entrees = mvts.filter((m) => m.entree)
  const sorties = mvts.filter((m) => !m.entree)
  const encaisse = entrees.reduce((s, m) => s + m.montant, 0)
  const depenses = sorties.reduce((s, m) => s + m.montant, 0)
  return {
    encaisse,
    depenses,
    fixes,
    net: encaisse - depenses - fixes,
    nbEntrees: entrees.length,
    nbSorties: sorties.length,
    sansClient: entrees.filter((m) => m.sansClient),
    marge: encaisse ? (encaisse - depenses - fixes) / encaisse : null,
  }
}

// Rentabilité par client sur la période : encaissé, frais liés (au client ou à ses paiements), net
export function rentabiliteClients(mvts, byId) {
  const m = {}
  const cle = (a) => a.prospect_id || ''
  const ajouter = (k) => (m[k] = m[k] || { id: k, nom: k ? byId[k]?.name || 'Client supprimé' : 'Sans client', encaisse: 0, frais: 0, n: 0 })
  const idsPaiement = new Set(mvts.filter((x) => x.entree).map((x) => x.a.id))
  mvts.forEach((x) => {
    if (x.entree) {
      const r = ajouter(cle(x.a))
      r.encaisse += x.montant
      r.n += 1
      r.frais += x.coutLie
    } else if (!idsPaiement.has(paiementLie(x.a)) && x.a.prospect_id) {
      // Dépense pour un client sans paiement rattaché dans la période
      ajouter(x.a.prospect_id).frais += x.montant
    }
  })
  return Object.values(m)
    .map((r) => ({ ...r, net: r.encaisse - r.frais }))
    .filter((r) => r.encaisse || r.frais)
    .sort((a, b) => b.net - a.net)
}

// ---------- Abonnements et charges fixes (settings.depensesFixes) ----------
// Un poste : { nom, montant, periodicite 'mois' | 'trimestre' | 'an', echeance (prochaine date AAAA-MM-JJ), categorie, fournisseur, actif }
export const PERIODICITES = [
  ['mois', 'Par mois', 1],
  ['trimestre', 'Par trimestre', 3],
  ['an', 'Par an', 12],
]
const nbMois = (p) => (PERIODICITES.find((x) => x[0] === p) || PERIODICITES[0])[2]
// Lignes d'exemple livrées avec le CRM, jamais confirmées (aucune date de paiement) : pas comptées tant que tu ne les valides pas
export const NOMS_EXEMPLES = ['Outils (Loom, Canva, domaine…)', 'Téléphone / internet', 'Publicité agence', 'Autre']
export const estExemple = (d) => !!d && !d.echeance && !d.confirme && NOMS_EXEMPLES.includes(d.nom)
export const estActif = (d) => d && d.actif !== false && !estExemple(d)
// Coût ramené au mois (un abonnement annuel de 120 000 compte 10 000 par mois)
export const mensuel = (d) => (estActif(d) ? num(d.montant) / nbMois(d.periodicite) : 0)
export const chargesFixesMois = (liste) => (liste || []).reduce((m, d) => m + mensuel(d), 0)

const ajouterMois = (s, n) => {
  const [y, m, j] = s.split('-').map(Number)
  const fin = new Date(y, m - 1 + n + 1, 0).getDate()
  const d = new Date(y, m - 1 + n, Math.min(j, fin))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Prochaine échéance à partir d'aujourd'hui (la date enregistrée avance d'une période tant qu'elle est passée)
export function prochaineEcheance(d, jour) {
  if (!estActif(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d.echeance || '')) return null
  const pas = nbMois(d.periodicite)
  let e = d.echeance
  for (let i = 0; e < jour && i < 600; i++) e = ajouterMois(d.echeance, pas * (i + 1))
  return e
}
// Échéances entre debut et fin (inclus), toutes charges confondues, par date
export function echeancesEntre(liste, debut, fin) {
  const out = []
  ;(liste || []).forEach((d) => {
    let e = prochaineEcheance(d, debut)
    const pas = nbMois(d.periodicite)
    for (let i = 1; e && e <= fin && i < 40; i++) {
      out.push({ d, date: e, montant: num(d.montant) })
      e = ajouterMois(e, pas)
    }
  })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// Fenêtre de saisie qui correspond à une action d'argent (paiement ou dépense) à modifier
export const modalPour = (a) => ({ type: a.action === 'Paiement reçu' ? 'paiement' : 'depense', edit: a })
