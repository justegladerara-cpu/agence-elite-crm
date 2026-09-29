// Registre des modules : ce qui existe, ce qui est activé, ce dont chaque module dépend.
// Un module désactivé disparaît du menu et de ses routes ; ses données restent en base.
// Voir docs/ARCHITECTURE.md (contrat d'un module).

export const MODULES = [
  {
    id: 'dashboard',
    nom: 'Tableau de bord',
    version: '1.0',
    coeur: true,
    pages: ['dashboard'],
    permissions: ['dashboard.view'],
    entites: [],
    evenements: { produits: [], consommes: ['*'] },
    dependances: { requis: [], optionnels: ['commercial', 'facturation', 'charges'] },
  },
  {
    id: 'commercial',
    nom: 'Commercial',
    version: '1.0',
    desc: 'Ma journée, prospects, clients, appels, scripts, Instagram',
    pages: ['journee', 'acquisition', 'clients', 'prospect', 'prospects', 'session', 'scripts'],
    permissions: ['commercial.view', 'commercial.edit'],
    entites: ['prospect', 'journee'],
    evenements: {
      produits: ['prospect.created', 'prospect.contacted', 'prospect.qualified', 'prospect.demo', 'appointment.created', 'proposal.sent', 'client.won', 'prospect.lost'],
      consommes: ['quote.accepted', 'payment.received', 'site.contact', 'store.order'],
    },
    dependances: { requis: [], optionnels: ['agenda', 'facturation'] },
    reglages: ['etapes', 'actions', 'objectifs', 'objectifsQuotidiens', 'alertes', 'scripts'],
  },
  {
    id: 'facturation',
    nom: 'Facturation',
    version: '1.0',
    desc: 'Devis, factures et paiements reçus',
    pages: ['factures', 'devis', 'facture', 'paiements'],
    permissions: ['billing.view', 'billing.edit'],
    entites: ['devis', 'facture', 'paiement'],
    evenements: { produits: ['quote.created', 'invoice.created', 'payment.received'], consommes: ['client.won'] },
    dependances: { requis: [], optionnels: ['commercial'] },
    reglages: ['facturation', 'devise'],
  },
  {
    id: 'charges',
    nom: 'Charges',
    version: '1.0',
    desc: 'Dépenses, abonnements et charges fixes',
    pages: ['charges', 'depenses', 'abonnements'],
    permissions: ['expenses.view', 'expenses.edit'],
    entites: ['depense', 'abonnement'],
    evenements: { produits: ['expense.created'], consommes: [] },
    dependances: { requis: [], optionnels: ['commercial'] },
    reglages: ['depensesFixes', 'categoriesDepenses'],
  },
  {
    id: 'agenda',
    nom: 'Agenda',
    version: '1.0',
    desc: 'Rendez-vous, relances et échéances',
    pages: ['calendrier'],
    permissions: ['agenda.view'],
    entites: [],
    evenements: { produits: [], consommes: ['appointment.created', 'invoice.created'] },
    dependances: { requis: [], optionnels: ['commercial', 'facturation'] },
    reglages: ['rappels'],
  },
  {
    id: 'site',
    nom: 'Site web',
    version: '1.0',
    desc: 'Audience, demandes de contact et pages du site',
    pages: ['site', 'site-demandes', 'site-pages'],
    permissions: ['site.view', 'site.edit'],
    entites: ['visite', 'demande'],
    evenements: { produits: ['site.contact'], consommes: [] },
    dependances: { requis: [], optionnels: ['commercial'] },
  },
  {
    id: 'store',
    nom: 'Elite Store',
    version: '1.0',
    desc: 'Boutique de licences vendue sur le site',
    pages: ['boutique'],
    permissions: ['store.view', 'store.edit'],
    entites: ['produit', 'commande', 'cle'],
    evenements: { produits: ['store.order'], consommes: [] },
    dependances: { requis: ['site'], optionnels: ['commercial', 'facturation'] },
  },
  {
    id: 'parametres',
    nom: 'Paramètres',
    version: '1.0',
    coeur: true,
    pages: ['parametres', 'apps', 'saisie'],
    permissions: ['settings.view', 'settings.edit', 'security.manage'],
    entites: [],
    evenements: { produits: [], consommes: [] },
    dependances: { requis: [], optionnels: [] },
  },
]

const PAR_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]))
const PAR_PAGE = Object.fromEntries(MODULES.flatMap((m) => m.pages.map((p) => [p, m])))

export const moduleParId = (id) => PAR_ID[id] || null
export const moduleDePage = (page) => PAR_PAGE[page] || null

// Un module est actif sauf s'il a été désactivé (settings.modules[id] === false) ou si un module requis est inactif
export function estActif(id, settings) {
  const m = PAR_ID[id]
  if (!m) return false
  if (m.coeur) return true
  if (settings?.modules?.[id] === false) return false
  return m.dependances.requis.every((r) => estActif(r, settings))
}

export const modulesActifs = (settings) => MODULES.filter((m) => estActif(m.id, settings))

// Page inconnue du registre (ancien lien, page commune) : accessible
export function pageAccessible(page, settings) {
  const m = PAR_PAGE[page]
  return !m || estActif(m.id, settings)
}

// Modules actifs qui ne peuvent pas fonctionner sans celui-ci
export const dependantsDe = (id, settings) => MODULES.filter((m) => m.dependances.requis.includes(id) && estActif(m.id, settings))

// Nouveau réglage des modules après activation ou désactivation, avec ce que ça entraîne
export function basculer(id, actif, settings) {
  const m = PAR_ID[id]
  if (!m || m.coeur) return { modules: { ...(settings?.modules || {}) }, entraines: [] }
  const modules = { ...(settings?.modules || {}) }
  let entraines = []
  if (actif) {
    // Réactiver aussi ce qu'il requiert
    const requis = (x) => PAR_ID[x].dependances.requis.flatMap((r) => [r, ...requis(r)])
    entraines = requis(id).filter((r) => modules[r] === false)
    ;[id, ...entraines].forEach((x) => delete modules[x])
  } else {
    entraines = dependantsDe(id, settings).map((x) => x.id)
    modules[id] = false
  }
  return { modules, entraines }
}
