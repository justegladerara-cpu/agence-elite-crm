// Calculs du pilotage de la plateforme : fonctions pures, testées (tests/plateforme.test.js).
// Entrée : ce que renvoie la plateforme (editeur_vue, pilotage_activite, pilotage_messages).
// Sortie : clients prêts à afficher, avec leur santé, leurs raisons, et les alertes de la tour de contrôle.

const JOUR = 86400000
export const joursDepuis = (date, maintenant = Date.now()) => (date ? Math.floor((maintenant - new Date(date).getTime()) / JOUR) : null)
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Clients de démonstration ou de test automatique : jamais mélangés aux vrais clients
export const estDemo = (c) => /\b(demo|pilote fictif)\b/.test(norm(c?.nom))

// Ce que l'établissement rapporte par mois selon sa licence (prix de l'offre, sinon montant de la licence)
export function mensuelLicence(licence, offres = []) {
  if (!licence || licence.statut !== 'active') return 0
  const o = offres.find((x) => x.id === licence.offre_id)
  if (licence.formule === 'mensuel') return Number(o?.prix_mensuel || licence.montant || 0)
  if (licence.formule === 'annuel') return Math.round(Number(o?.prix_annuel || licence.montant || 0) / 12)
  return 0
}

// Santé d'un établissement : une note sur 100 et les raisons, dans l'ordre de gravité
export function santeEtablissement(e, act = {}, maintenant = Date.now()) {
  const raisons = []
  let note = 100
  const retire = (n, ton, texte) => {
    note -= n
    raisons.push({ ton, texte })
  }
  if (e.statut === 'suspendu') return { note: 0, ton: 'gris', raisons: [{ ton: 'gris', texte: 'Établissement bloqué' }] }
  const l = e.licence
  if (!l) retire(50, 'rouge', 'Aucune licence')
  else if (!l.valide) retire(50, 'rouge', l.statut === 'suspendue' ? 'Licence suspendue' : 'Licence expirée')
  else if (l.jours_restants != null && l.jours_restants < 0) retire(40, 'rouge', `Licence échue depuis ${-l.jours_restants} j (délai de grâce)`)
  else if (l.jours_restants != null && l.jours_restants <= 7) retire(20, 'orange', `${l.formule === 'essai' ? 'Essai' : 'Licence'} : fin dans ${l.jours_restants} j`)
  if (!e.mis_en_service_le) retire(10, 'orange', 'Pas encore mis en service')
  else {
    const j = joursDepuis(act.derniere_activite, maintenant)
    if (j == null || j > 14) retire(30, 'rouge', j == null ? 'Aucune activité' : `Aucune activité depuis ${j} j`)
    else if (j > 7) retire(15, 'orange', `Peu d’activité (${j} j)`)
  }
  const avant = Number(act.montant_30j_avant || 0)
  const apres = Number(act.montant_30j || 0)
  if (avant > 0 && apres < avant * 0.5) retire(15, 'orange', `Ventes en baisse de ${Math.round((1 - apres / avant) * 100)} %`)
  note = Math.max(0, note)
  return { note, ton: note >= 75 ? 'vert' : note >= 45 ? 'orange' : 'rouge', raisons }
}

// Vue complète : clients avec leurs établissements enrichis, santé du client = celle de son établissement le plus fragile
export function construireVue(vue, activite = [], messages = [], maintenant = Date.now()) {
  const parEtab = Object.fromEntries((activite || []).map((a) => [a.etablissement_id, a]))
  const parMessage = Object.fromEntries((messages || []).map((m) => [m.client_id, m]))
  const offres = vue?.offres || []
  const clients = (vue?.clients || []).map((c) => {
    const etablissements = (c.etablissements || []).map((e) => {
      const act = parEtab[e.id] || {}
      return { ...e, activite: act, sante: santeEtablissement(e, act, maintenant), mensuel: mensuelLicence(e.licence, offres) }
    })
    const actifs = etablissements.filter((e) => e.statut !== 'archive')
    const pire = actifs.reduce((m, e) => (!m || e.sante.note < m.sante.note ? e : m), null)
    const sante =
      c.statut === 'suspendu'
        ? { note: 0, ton: 'gris', raisons: [{ ton: 'gris', texte: 'Client bloqué' }] }
        : c.statut === 'archive'
          ? { note: 0, ton: 'gris', raisons: [{ ton: 'gris', texte: 'Client archivé' }] }
          : pire
            ? pire.sante
            : { note: 50, ton: 'orange', raisons: [{ ton: 'orange', texte: 'Aucun établissement' }] }
    const somme = (k) => actifs.reduce((s, e) => s + Number(e.activite[k] || 0), 0)
    const dates = actifs.map((e) => e.activite.derniere_activite).filter(Boolean).sort()
    const echeances = actifs.map((e) => e.licence?.jours_restants).filter((x) => x != null)
    return {
      ...c,
      demo: estDemo(c),
      etablissements,
      sante,
      mensuel: actifs.reduce((s, e) => s + e.mensuel, 0),
      ventesJour: somme('montant_jour'),
      ventes7j: somme('montant_7j'),
      ventes30j: somme('montant_30j'),
      utilisateursActifs: somme('utilisateurs_actifs_7j'),
      derniereActivite: dates[dates.length - 1] || null,
      joursRestants: echeances.length ? Math.min(...echeances) : null,
      message: parMessage[c.id] || null,
    }
  })
  return { clients, offres, solutions: vue?.solutions || [], roles: vue?.roles || [] }
}

export const clientsReels = (clients, tout = false) => clients.filter((c) => tout || (!c.demo && c.statut !== 'archive'))

const RANG = { rouge: 0, orange: 1, gris: 2, vert: 3 }

// Alertes de la tour de contrôle : une par problème, avec l'action proposée
export function alertes(clients) {
  const liste = []
  for (const c of clients) {
    if (c.statut !== 'actif') continue
    for (const e of c.etablissements.filter((x) => x.statut === 'actif')) {
      for (const r of e.sante.raisons) {
        if (r.ton === 'vert') continue
        const action = /licence|essai/i.test(r.texte) ? 'encaisser' : /activité|baisse/i.test(r.texte) ? 'appeler' : /service/i.test(r.texte) ? 'ouvrir' : 'ouvrir'
        liste.push({ ton: r.ton, titre: r.texte, client: c.nom, clientId: c.id, etablissement: e.nom, etablissementId: e.id, action })
      }
    }
  }
  return liste.sort((a, b) => RANG[a.ton] - RANG[b.ton] || a.client.localeCompare(b.client))
}

// Chiffres du haut de la tour de contrôle
export function indicateurs(clients) {
  const actifs = clients.filter((c) => c.statut === 'actif')
  const etabs = actifs.flatMap((c) => c.etablissements.filter((e) => e.statut === 'actif'))
  return {
    clients: actifs.length,
    bloques: clients.filter((c) => c.statut === 'suspendu').length,
    etablissements: etabs.length,
    mensuel: actifs.reduce((s, c) => s + c.mensuel, 0),
    enRetard: etabs.filter((e) => e.licence && (e.licence.jours_restants ?? 0) < 0).length,
    finSemaine: etabs.filter((e) => e.licence?.jours_restants != null && e.licence.jours_restants >= 0 && e.licence.jours_restants <= 7).length,
    ventesJour: actifs.reduce((s, c) => s + c.ventesJour, 0),
    utilisateursActifs: actifs.reduce((s, c) => s + c.utilisateursActifs, 0),
    sante: { vert: actifs.filter((c) => c.sante.ton === 'vert').length, orange: actifs.filter((c) => c.sante.ton === 'orange').length, rouge: actifs.filter((c) => c.sante.ton === 'rouge').length },
  }
}

// Fiche CRM la plus probable pour un client de la plateforme (même nom, accents et ponctuation ignorés)
export function ficheProbable(client, prospects = []) {
  const n = norm(client?.nom)
  if (!n) return null
  return prospects.find((p) => norm(p.name) === n) || prospects.find((p) => norm(p.name).includes(n) || (norm(p.name) && n.includes(norm(p.name)))) || null
}

// Lien client plateforme → fiche CRM : choix enregistré dans les réglages, sinon nom identique
export function ficheLiee(client, settings, prospects = []) {
  const id = settings?.plateforme?.liens?.[client.id]
  if (id === '') return null
  if (id) return prospects.find((p) => p.id === id) || null
  return ficheProbable(client, prospects)
}

// Commande tapée dans la barre : « bloquer the dream », « prolonger hotel 2i », « encaisser epicerie »
const VERBES = { bloquer: 'bloquer', debloquer: 'debloquer', prolonger: 'prolonger', encaisser: 'encaisser', message: 'message', ouvrir: 'ouvrir', assister: 'assister' }
export function lireCommande(texte, clients) {
  const mots = norm(texte).split(' ').filter(Boolean)
  if (!mots.length) return null
  const verbe = VERBES[mots[0]] || null
  const reste = (verbe ? mots.slice(1) : mots).join(' ')
  if (!reste) return null
  const client = clients.find((c) => norm(c.nom) === reste) || clients.find((c) => norm(c.nom).includes(reste))
  return client ? { verbe: verbe || 'ouvrir', client } : null
}

export const LIBELLES_CHRONO = {
  'licence.attribution': 'Licence attribuée',
  'licence.renouvellement': 'Licence prolongée',
  'licence.suspension': 'Licence suspendue',
  'licence.reactivation': 'Licence réactivée',
  'licence.fin': 'Licence terminée',
  'client.statut': 'Statut du client',
  'etablissement.statut': 'Statut de l’établissement',
  'module.active': 'Module activé',
  'module.retire': 'Module retiré',
  'support.session': 'Session d’assistance',
  'ventes.jour': 'Ventes du jour',
  'message.pose': 'Message affiché au client',
  'message.retire': 'Message retiré',
}
