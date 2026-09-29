// Permissions par module (socle) : un rôle donne un ensemble de permissions « module.view / module.edit ».
// Rôle lu dans l'espace actif (store.js roleActif) ; la base applique les mêmes règles (supabase/espace_permissions.sql).
import { MODULES } from './modules'

export const ROLES = {
  proprietaire: { nom: 'Propriétaire', tout: true },
  admin: { nom: 'Administrateur', tout: true, sauf: ['security.manage'] },
  membre: { nom: 'Membre', motif: /\.(view|edit)$/, sauf: ['settings.edit', 'security.manage'] },
  lecteur: { nom: 'Lecteur', motif: /\.view$/ },
}

export const TOUTES = MODULES.flatMap((m) => m.permissions)

export function permissionsDe(role) {
  const r = ROLES[role]
  if (!r) return []
  const base = r.tout ? TOUTES : TOUTES.filter((p) => r.motif.test(p))
  return base.filter((p) => !(r.sauf || []).includes(p))
}

export const peut = (role, permission) => permissionsDe(role).includes(permission)


export const peutEcrire = (role) => role !== 'lecteur'
export const peutGerer = (role) => !ROLES[role] || role === 'proprietaire' || role === 'admin'

// Message de refus (ou null) avant d'envoyer une opération : l'interface explique au lieu d'échouer en silence.
// op : 'ecrire' | 'supprimer' (auteur = user_id de l'élément) | 'reglages' | 'remplacer' (tout effacer / réimporter)
export function refusDe(role, op, auteur, moi) {
  if (!ROLES[role] || role === 'proprietaire' || role === 'admin') return null
  if (role === 'lecteur') return 'Lecture seule : ton rôle dans cet espace ne permet pas de modifier les données.'
  if (op === 'reglages') return 'Seuls le propriétaire et les administrateurs modifient les réglages de cet espace.'
  if (op === 'remplacer') return 'Seuls le propriétaire et les administrateurs peuvent tout remplacer dans cet espace.'
  if (op === 'supprimer' && auteur && moi && auteur !== moi) return 'Seuls le propriétaire et les administrateurs suppriment les éléments créés par d’autres.'
  return null
}
