// Opérations qui touchent les deux bases (SEC-03) : « Encaisser » prolonge la licence sur la plateforme ET note
// le paiement dans le CRM. Les deux bases ne peuvent pas être écrites d'un seul coup, alors chaque encaissement
// devient une opération suivie pas à pas, gardée sur l'appareil :
//
//   préparée → licence faite → paiement fait → terminée
//                     └─ (paiement refusé) → partielle        (à reprendre : il ne reste que le paiement)
//   préparée ─ (réponse perdue)            → à réconcilier    (on ne sait pas si la licence a été prolongée)
//   préparée ─ (refus net de la base)      → échouée          (rien n'a été fait)
//
// L'identifiant de l'opération (OP-…) sert aussi de clé d'idempotence : il est écrit comme référence du
// renouvellement sur la plateforme et dans la note du paiement CRM. Avant chaque étape, on vérifie si elle a déjà
// été faite (historique de la licence, paiements du CRM) : reprendre une opération ne crée jamais de doublon.

const CLE = 'aecrm-operations'
const MAX = 200

export const ETATS = {
  preparee: 'Préparée',
  licence_faite: 'Licence prolongée',
  paiement_fait: 'Paiement noté',
  terminee: 'Terminée',
  partielle: 'Partielle : paiement à noter',
  a_reconcilier: 'À réconcilier',
  echouee: 'Échouée : rien n’a été fait',
}
export const A_REPRENDRE = ['preparee', 'licence_faite', 'paiement_fait', 'partielle', 'a_reconcilier']

const lire = (stockage) => {
  try {
    const l = JSON.parse(stockage.getItem(CLE))
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}
const ecrire = (stockage, l) => {
  try {
    stockage.setItem(CLE, JSON.stringify(l.slice(0, MAX)))
  } catch {
    /* mémoire pleine : le suivi reste en mémoire pour cette page */
  }
}

export function creerJournal(stockage = globalThis.localStorage) {
  const abonnes = new Set()
  const prevenir = () => abonnes.forEach((f) => f(lire(stockage)))
  const journal = {
    liste: () => lire(stockage),
    aReprendre: () => lire(stockage).filter((o) => A_REPRENDRE.includes(o.etat)),
    lire: (id) => lire(stockage).find((o) => o.id === id) || null,
    enregistrer(op) {
      ecrire(stockage, [op, ...lire(stockage).filter((o) => o.id !== op.id)])
      prevenir()
      return op
    },
    retirer(id) {
      ecrire(stockage, lire(stockage).filter((o) => o.id !== id))
      prevenir()
    },
    abonner(f) {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
  }
  return journal
}

const nouvelId = () => `OP-${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

// Prépare un encaissement (rien n'est envoyé)
export function preparerEncaissement({ client, etablissement, licence, montant, mode, jour, reference, ficheId, nouvelleEcheance = null }) {
  const at = new Date().toISOString()
  return {
    id: nouvelId(),
    type: 'encaisser',
    etat: 'preparee',
    cree_le: at,
    client: { id: client.id, nom: client.nom },
    etablissement: { id: etablissement.id, nom: etablissement.nom },
    licence: { id: licence.id, echeance: licence.echeance || null, formule: licence.formule || null },
    montant,
    mode,
    jour,
    reference: reference || '',
    ficheId: ficheId || null,
    nouvelleEcheance,
    echeanceApres: null,
    erreur: '',
    etapes: [{ at, etat: 'preparee' }],
  }
}

const avec = (op, etat, extra = {}) => ({ ...op, ...extra, etat, etapes: [...op.etapes, { at: new Date().toISOString(), etat, ...(extra.erreur ? { erreur: extra.erreur } : {}) }] })

// Réponse perdue (réseau) : la base a peut-être exécuté la demande
export const estErreurReseau = (e) => /fetch|network|load failed|timed? ?out|connexion|socket|abort|failed to|injoignable|réseau/i.test(String(e?.message || e))

// Le renouvellement de cette opération est-il déjà inscrit sur la plateforme ?
async function licenceDejaFaite(op, lireHistorique) {
  const historique = await lireHistorique(op.etablissement.id)
  const ev = (historique || []).find((h) => h.reference === op.id)
  return ev ? ev.nouvelle_echeance || ev.nouvelleEcheance || null : false
}

export const noteDuPaiement = (op) => `Licence ${op.etablissement.nom} prolongée jusqu’au ${op.echeanceApres || '?'} (plateforme) · ${op.id}`
const paiementDejaNote = (op, actions) => (actions || []).some((a) => a.reference === op.id || String(a.notes || '').includes(op.id))

// Exécute (ou reprend) l'opération jusqu'au bout. Chaque changement d'état est enregistré tout de suite.
// deps : { journal, appeler(fonction, params), lireHistorique(etablissementId), lireActions(), ajouterPaiement(action) }
export async function executer(op, deps) {
  const { journal, appeler, lireHistorique, lireActions, ajouterPaiement } = deps
  let o = journal.enregistrer(op)

  // 1. Licence sur la plateforme
  if (o.etat === 'preparee' || o.etat === 'a_reconcilier') {
    let deja
    try {
      deja = await licenceDejaFaite(o, lireHistorique)
    } catch (e) {
      // Impossible de vérifier : on ne prend pas le risque d'un double renouvellement
      if (o.etat === 'a_reconcilier') throw Object.assign(new Error(`Vérification impossible : ${e.message}`), { operation: o })
      deja = false
    }
    if (deja !== false) {
      o = journal.enregistrer(avec(o, 'licence_faite', { echeanceApres: deja, erreur: '' }))
    } else {
      try {
        const echeance = await appeler('renouveler_licence', {
          p_licence_id: o.licence.id,
          p_nouvelle_echeance: o.nouvelleEcheance,
          p_montant: o.montant,
          p_reference: o.id,
          p_note: ['Encaissé depuis le CRM', o.mode, o.reference && `réf. ${o.reference}`].filter(Boolean).join(' · '),
        })
        o = journal.enregistrer(avec(o, 'licence_faite', { echeanceApres: echeance, erreur: '' }))
      } catch (e) {
        const etat = estErreurReseau(e) ? 'a_reconcilier' : 'echouee'
        o = journal.enregistrer(avec(o, etat, { erreur: e.message }))
        throw Object.assign(new Error(etat === 'echouee' ? e.message : `Réponse de la plateforme perdue : ${e.message}. L’opération est à réconcilier, rien ne sera fait deux fois.`), { operation: o })
      }
    }
  }

  // 2. Paiement dans le CRM
  if (o.etat === 'licence_faite' || o.etat === 'partielle') {
    try {
      if (!paiementDejaNote(o, await lireActions())) {
        await ajouterPaiement({
          prospect_id: o.ficheId,
          date: o.jour,
          canal: 'Autre',
          action: 'Paiement reçu',
          montant: o.montant,
          mode: o.mode,
          reference: o.reference || `Licence ${o.etablissement.nom}`,
          notes: noteDuPaiement(o),
        })
      }
      o = journal.enregistrer(avec(o, 'paiement_fait', { erreur: '' }))
    } catch (e) {
      o = journal.enregistrer(avec(o, 'partielle', { erreur: e.message }))
      throw Object.assign(new Error(`Licence prolongée jusqu’au ${o.echeanceApres || '?'}, mais le paiement n’a pas pu être noté dans le CRM. L’opération est gardée dans « Opérations à réconcilier » : reprends-la, rien ne sera fait deux fois.`), { operation: o })
    }
  }

  if (o.etat === 'paiement_fait') o = journal.enregistrer(avec(o, 'terminee'))
  return o
}

// Gestes simples (bloquer, suspendre, modules, prolonger…) : notés dans le même journal, avec leur motif.
// La plateforme garde aussi sa propre trace (journal_audit), sans le motif pour les gestes qui n'en prennent pas.
export const GESTES = {
  encaisser: 'Encaissement',
  prolonger: 'Prolongation sans paiement',
  bloquer_client: 'Client bloqué',
  debloquer_client: 'Client débloqué',
  bloquer_etablissement: 'Établissement bloqué',
  debloquer_etablissement: 'Établissement débloqué',
  suspendre_licence: 'Licence suspendue',
  reactiver_licence: 'Licence réactivée',
  module_active: 'Module activé',
  module_retire: 'Module retiré',
  mot_de_passe: 'Mot de passe temporaire',
  role_admin: 'Rôle admin changé',
  identite: 'Identité réinitialisée',
  renouveler_sans_encaissement: 'Renouvellement sans encaissement',
  reglee_a_la_main: 'Opération réglée à la main',
}
export function noterGeste(journal, { type, client, etablissement, motif = '', detail = '' }) {
  const at = new Date().toISOString()
  return journal.enregistrer({
    id: nouvelId(),
    type,
    etat: 'terminee',
    cree_le: at,
    client: client ? { id: client.id, nom: client.nom } : null,
    etablissement: etablissement ? { id: etablissement.id, nom: etablissement.nom } : null,
    motif,
    detail,
    etapes: [{ at, etat: 'terminee' }],
  })
}
// Opération reprise et réglée hors du CRM (ex. paiement noté à la main) : gardée, avec le motif
export function marquerReglee(journal, op, motif) {
  return journal.enregistrer(avec(op, 'terminee', { motif, regleeALaMain: true }))
}

let journalPartage = null
export const journalOperations = () => (journalPartage ||= creerJournal())
