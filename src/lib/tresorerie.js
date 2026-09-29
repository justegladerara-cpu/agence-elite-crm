// Argent de la période : paiements reçus et dépenses, reliés entre eux et aux clients.
// Une dépense peut être rattachée à un paiement (reference « paiement:<id> »), ex. le taxi d'un dépannage.
const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0

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
