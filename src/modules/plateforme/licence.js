// Règles d'échéance d'une licence, identiques à celles de la base plateforme (renouveler_licence) :
// une nouvelle échéance est toujours strictement après l'échéance actuelle (SEC-09).
export const aujourdhuiIso = () => new Date().toISOString().slice(0, 10)

export function plusJours(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function plusMois(iso, n) {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1, 12))
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate()
  d.setUTCDate(Math.min(j, dernier))
  return d.toISOString().slice(0, 10)
}

// Point de départ d'un renouvellement : l'échéance, ou aujourd'hui si elle est dépassée
export const baseRenouvellement = (licence, auj = aujourdhuiIso()) => (licence?.echeance && licence.echeance > auj ? licence.echeance : auj)

// Échéance proposée pour une période (mensuel : +1 mois, annuel : +1 an), comme la base quand la date est vide
export function echeanceProposee(licence, auj = aujourdhuiIso()) {
  const base = baseRenouvellement(licence, auj)
  if (licence?.formule === 'mensuel') return plusMois(base, 1)
  if (licence?.formule === 'annuel') return plusMois(base, 12)
  return null
}

// Plus petite date acceptée : le lendemain de l'échéance actuelle, et jamais avant aujourd'hui
export function echeanceMinimum(licence, auj = aujourdhuiIso()) {
  const ref = licence?.echeance || licence?.debut
  const lendemain = ref ? plusJours(ref, 1) : auj
  return lendemain > auj ? lendemain : auj
}

// Message d'erreur (ou '') pour une nouvelle échéance saisie
export function erreurEcheance(licence, nouvelle, auj = aujourdhuiIso()) {
  if (!nouvelle) return 'Nouvelle échéance à choisir.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nouvelle)) return 'Date invalide.'
  const ref = licence?.echeance || licence?.debut
  if (ref && nouvelle <= ref) return 'La nouvelle échéance doit être après l’échéance actuelle.'
  if (nouvelle < auj) return 'La nouvelle échéance ne peut pas être dans le passé.'
  return ''
}
