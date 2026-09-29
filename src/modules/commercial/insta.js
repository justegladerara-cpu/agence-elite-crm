// Process de prospection Instagram : étapes en 1 clic, réactions après la Loom, scripts à copier.
import { today, nowTime, addDays } from '../../lib/dates'
import { isReponse } from '../../lib/logic'

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

// Dernière action enregistrée par une étape (pour pouvoir l'annuler)
export function actionEtape(e, p, settings) {
  const modele = e.id === 'signe' ? { action: 'Signature' } : e.row(settings)
  const rev = [...p.acts].reverse()
  const meme = (a) => a.action === modele.action && (!modele.resultat || a.resultat === modele.resultat)
  // D'abord la ligne écrite par l'étape elle-même (même prochaine action), sinon la dernière du même type
  return rev.find((a) => meme(a) && modele.prochaine_action && a.prochaine_action === modele.prochaine_action) || rev.find(meme)
}

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

export { copier } from '../../lib/copier'

// Questions de qualification (réponses gardées dans la fiche)
export const QUALIF = [
  ['decideur', 'Décisionnaire ?'],
  ['gerePubs', 'Gère lui-même ses pubs ?'],
  ['prestataire', 'A déjà une agence / un prestataire ?'],
  ['pubsRegulieres', 'Fait de la pub régulièrement ?'],
  ['resultatsOk', 'Satisfait de ses résultats actuels ?'],
]
export const OBJECTIFS_PROSPECT = ['Plus de ventes', 'Plus de leads', 'Plus de visibilité', 'Meilleure conversion']

// ---------- Relance en 1 clic ----------
// Numéro de la prochaine relance (1, 2, 3…) d'après les relances déjà notées
export const numeroRelance = (p) => p.acts.filter((a) => a.action === 'Relance').length + 1

export function messageRelance(p, settings) {
  const l = settings.messagesRelance || []
  if (!l.length) return ''
  return remplir(l[Math.min(numeroRelance(p), l.length) - 1].texte, p)
}

// Ligne de Saisie pour « Relancé » : la date de la relance suivante suit la séquence des Paramètres (J+2, J+5, J+10)
export function ligneRelance(p, settings) {
  const n = p.tentatives + 1
  const r = settings.relance || {}
  const j = Number(n <= 1 ? r.j1 : n === 2 ? r.j2 : r.j3) || 3
  return {
    row: ligne(p.id, { canal: p.canal || 'DM', action: 'Relance', prochaine_action: `Relance ${numeroRelance(p) + 1} si pas de réponse` }),
    prochaine: addDays(today(), j),
    stop: n >= Number(r.stop || 99) && !p.reponses,
  }
}
