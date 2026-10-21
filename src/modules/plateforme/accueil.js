// Tableau de bord unique (Tour de contrôle) : les 4 indicateurs et l'état de chaque bloc. Fonctions pures, testées
// (tests/accueil.test.js). Règles : docs/superadmin-v2/08_FINANCIAL_RULES.md (encaissé) et JOURNAL (D4-x).

import { encaisse } from '../../lib/finances'

// Les 5 états d'un bloc
export const ETATS_BLOC = ['chargement', 'donnees', 'vide', 'refuse', 'erreur']

const REFUS = /refus|interdit|autoris|droit|permission|42501|super admin|non branch/i

// État du bloc plateforme : p = { connecte (null = vérification en cours), etat: { clients, erreur } }
export function etatPlateforme(p, vide = (clients) => clients.length === 0) {
  if (p.connecte === null) return { etat: 'chargement' }
  if (!p.connecte) return { etat: 'refuse', raison: 'Connecte-toi à la plateforme pour voir les clients du logiciel.' }
  if (p.etat?.erreur && !p.etat?.clients) return REFUS.test(p.etat.erreur) ? { etat: 'refuse', raison: p.etat.erreur } : { etat: 'erreur', raison: p.etat.erreur }
  if (!p.etat?.clients) return { etat: 'chargement' }
  return vide(p.etat.clients) ? { etat: 'vide' } : { etat: 'donnees' }
}

// État d'un bloc du CRM : module coupé = refusé ; sinon vide ou données
export function etatCrm({ actif = true, nom = '', vide = false }) {
  if (!actif) return { etat: 'refuse', raison: `Le module ${nom} est désactivé (Paramètres › Modules du CRM).` }
  return { etat: vide ? 'vide' : 'donnees' }
}

// Relances en retard : fiches en cours dont la date de relance est passée (même règle que Ma journée)
export const relancesEnRetard = (list = [], t) => list.filter((p) => p.relance && p.relance < t && p.etape !== 'Gagné' && p.etape !== 'Perdu')

// Encaissé ce mois (mois civil « AAAA-MM ») : paiements reçus notés dans le CRM, dans la devise du CRM
export const encaisseDuMois = (actions = [], mois) => encaisse(actions, { mois })

// Licences à renouveler : échéance dans 0 à 7 jours (les licences déjà échues sont comptées à part)
export function licencesARenouveler(clients = [], jours = 7) {
  const etabs = clients.filter((c) => c.statut === 'actif').flatMap((c) => c.etablissements.filter((e) => e.statut === 'actif' && e.licence).map((e) => ({ c, e })))
  const j = (x) => x.e.licence.jours_restants
  return {
    bientot: etabs.filter((x) => j(x) != null && j(x) >= 0 && j(x) <= jours),
    echues: etabs.filter((x) => j(x) != null && j(x) < 0),
  }
}

export const clientsActifs = (clients = []) => clients.filter((c) => c.statut === 'actif')
