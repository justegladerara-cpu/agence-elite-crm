// Process de prospection Instagram : étapes en 1 clic, réactions après la Loom, scripts à copier.
import { today, nowTime, addDays } from './dates'
import { isReponse } from './logic'

// Chaque bouton enregistre une action de la Saisie, avec la prochaine action et la date de relance
export const ETAPES = [
  {
    id: 'script',
    label: 'Script envoyé',
    fait: (p) => p.niveau >= 2,
    row: (s) => ({ canal: 'DM', action: 'Premier contact', prochaine_action: 'Relancer si pas de réponse au script', date_relance: addDays(today(), Number(s.relance?.j1) || 2) }),
  },
  {
    id: 'reponse',
    label: 'A répondu',
    fait: (p, L) => p.niveau >= 3 || p.acts.some((a) => isReponse(a, L)),
    row: () => ({ canal: 'DM', action: 'Échange / suivi', resultat: 'A répondu', prochaine_action: 'Qualifier : 2 ou 3 questions', date_relance: today() }),
  },
  {
    id: 'qualifie',
    label: 'Qualifié',
    fait: (p) => p.niveau >= 3,
    row: () => ({ canal: 'DM', action: 'Qualification', resultat: 'Intéressé', prochaine_action: 'Préparer et envoyer la Loom', date_relance: addDays(today(), 1) }),
  },
  {
    id: 'loom',
    label: 'Loom envoyée',
    fait: (p) => p.niveau >= 4,
    row: () => ({ canal: 'DM', action: 'Loom envoyé', prochaine_action: 'Voir la réaction à la Loom', date_relance: addDays(today(), 2) }),
  },
  {
    id: 'appel',
    label: 'Appel calé',
    fait: (p) => p.niveau >= 5,
    row: () => ({ canal: 'Appel', action: 'RDV', resultat: 'RDV pris', prochaine_action: "Faire l'appel et closer" }),
  },
  {
    id: 'proposition',
    label: 'Proposition',
    fait: (p) => p.niveau >= 6,
    row: (s) => ({ canal: 'DM', action: 'Proposition envoyée', prochaine_action: 'Relancer la proposition', date_relance: addDays(today(), Number(s.alertes?.propositionSansReponse) || 3) }),
  },
  { id: 'signe', label: 'Signé', fait: (p) => p.niveau >= 7 },
]

// Réaction du prospect après la Loom (les 3 cas du process)
export const REACTIONS = [
  { id: 'chaud', label: 'Très intéressé', tone: 'green', row: () => ({ canal: 'DM', action: 'Échange / suivi', resultat: 'Intéressé', prochaine_action: 'Proposer un appel', date_relance: today() }) },
  { id: 'tiede', label: 'Tiède', tone: 'orange', row: () => ({ canal: 'DM', action: 'Échange / suivi', resultat: 'A répondu', prochaine_action: 'Relancer : quel point est prioritaire pour vous ?', date_relance: addDays(today(), 2) }) },
  { id: 'silence', label: 'Pas de réponse', tone: 'red', row: () => ({ canal: 'DM', action: 'Relance', resultat: 'Pas de réponse', prochaine_action: 'Relancer : avez-vous pu voir la vidéo ?', date_relance: addDays(today(), 3) }) },
]

export const ligne = (pid, r, extra = {}) => ({ prospect_id: pid, date: today(), time: nowTime(), ...r, ...extra })

// Remplit un script avec les infos du prospect
export function remplir(texte, p) {
  const f = p?.fiche || {}
  return String(texte || '')
    .replace(/\{entreprise\}/g, p?.name || 'votre entreprise')
    .replace(/\{produit\}/g, f.produit || 'vos produits')
    .replace(/\{contact\}/g, f.contact || '')
    .replace(/\{lien\}/g, f.loom || '[lien de la vidéo]')
}

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    // Navigateur sans presse-papiers : sélection manuelle
    const t = document.createElement('textarea')
    t.value = texte
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}

// Questions de qualification (réponses gardées dans la fiche)
export const QUALIF = [
  ['decideur', 'Décisionnaire ?'],
  ['gerePubs', 'Gère lui-même ses pubs ?'],
  ['prestataire', 'A déjà une agence / un prestataire ?'],
  ['pubsRegulieres', 'Fait de la pub régulièrement ?'],
  ['resultatsOk', 'Satisfait de ses résultats actuels ?'],
]
export const OBJECTIFS_PROSPECT = ['Plus de ventes', 'Plus de leads', 'Plus de visibilité', 'Meilleure conversion']
