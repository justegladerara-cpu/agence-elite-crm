// Échéances des licences de la plateforme (Elite License Guard) : états, tri « à traiter », calendrier par mois,
// paliers d'alerte. Entrée : ce que renvoie editeur_echeances() (base plateforme, migration 20261021000151).
export const ETATS_ECHEANCE = {
  a_jour: ['À jour', 'b-green'],
  sans_echeance: ['Sans échéance', 'b-green'],
  bientot: ['Échéance proche', 'b-navy'],
  urgent: ['À renouveler', 'b-orange'],
  aujourdhui: ['Aujourd’hui', 'b-red'],
  grace: ['Délai de grâce', 'b-red'],
  expiree: ['Expirée', 'b-red'],
  suspendue: ['Suspendue', 'b-red'],
  terminee: ['Terminée', 'b-navy'],
}

// Paiement en tranches (ex. The Dream : 3 × 100 000, code d'une semaine) : la fin proche est normale,
// ce n'est pas « à renouveler » tant que la tranche est payée.
export const enTranches = (l) => /semaine|tranche/i.test(`${l?.offre || ''} ${l?.formule || ''} ${l?.modele || ''} ${l?.note || ''}`)
// Licence à vie (formule « acquisition », sans échéance) : jamais à renouveler, jamais coupée.
export const aVie = (l) => l?.formule === 'acquisition' && !l?.echeance
export function etatAffiche(l) {
  if (aVie(l) && l?.etat !== 'terminee' && l?.etat !== 'suspendue') return ['À vie', 'b-green']
  if (enTranches(l) && ['bientot', 'urgent', 'a_jour'].includes(l?.etat)) return ['Tranche payée', 'b-green']
  return ETATS_ECHEANCE[l?.etat] || [l?.etat, 'b-navy']
}

export const ETATS_DEMANDE = { nouvelle: 'Nouvelle', en_cours: 'En cours', traitee: 'Traitée', abandonnee: 'Abandonnée' }

// Ordre d'urgence : expirée d'abord, puis grâce, aujourd'hui, urgent… (la suspension est une décision, à part)
const URGENCE = ['expiree', 'grace', 'aujourdhui', 'urgent', 'suspendue', 'bientot', 'a_jour', 'sans_echeance', 'terminee']

export const aTraiter = (licences = []) =>
  licences
    .filter((l) => ['expiree', 'grace', 'aujourdhui', 'urgent', 'suspendue'].includes(l.etat))
    .sort((a, b) => URGENCE.indexOf(a.etat) - URGENCE.indexOf(b.etat) || (a.jours ?? 0) - (b.jours ?? 0))

// Calendrier : licences regroupées par mois d'échéance (« 2026-11 »), dans l'ordre des dates
export function parMois(licences = []) {
  const mois = new Map()
  for (const l of [...licences].filter((x) => x.echeance).sort((a, b) => (a.echeance < b.echeance ? -1 : 1))) {
    const cle = l.echeance.slice(0, 7)
    if (!mois.has(cle)) mois.set(cle, [])
    mois.get(cle).push(l)
  }
  return [...mois.entries()].map(([cle, liste]) => ({ cle, liste }))
}

export const nomMois = (cle) => new Date(`${cle}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

// Texte court des jours restants : « dans 5 j », « aujourd’hui », « échue depuis 3 j »
export function joursTexte(j) {
  if (j == null) return '—'
  if (j > 0) return `dans ${j} j`
  if (j === 0) return 'aujourd’hui'
  return `échue depuis ${-j} j`
}

// Paliers saisis « 30, 15, 7, 0, -3 » → nombres entiers uniques, du plus tôt au plus tard ; erreur lisible sinon
export function lirePaliers(texte) {
  const morceaux = String(texte || '').split(/[\s,;]+/).filter(Boolean)
  if (!morceaux.length) return { erreur: 'Au moins un palier.' }
  const nombres = morceaux.map(Number)
  if (nombres.some((n) => !Number.isInteger(n))) return { erreur: 'Des nombres entiers seulement (ex. 30, 7, 0, -3).' }
  if (nombres.some((n) => n < -60 || n > 120)) return { erreur: 'Entre -60 (après l’échéance) et 120 jours avant.' }
  return { paliers: [...new Set(nombres)].sort((a, b) => b - a) }
}

// « J-7 », « Jour J », « J+3 »
export const libellePalier = (p) => (p > 0 ? `J-${p}` : p === 0 ? 'Jour J' : `J+${-p}`)

// La fonction n'existe pas encore dans la base (migration non appliquée) : message clair plutôt qu'une erreur brute
export const baseEnRetard = (message = '') => /could not find the function|schema cache|editeur_echeances/i.test(message)
