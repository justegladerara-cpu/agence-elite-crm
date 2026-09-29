// Permissions par module (socle) : un rôle donne un ensemble de permissions « module.view / module.edit ».
// Aujourd'hui un seul utilisateur, propriétaire de son espace : il a tout.
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

