// Navigation SUPERADMIN 2.0 : une seule liste, 6 espaces. Elle nourrit le menu de gauche, la barre d'onglets de
// l'espace, la recherche (Ctrl K), les titres sur téléphone, l'écran « Tous les espaces » et la barre du bas.
// Chaque page a un seul libellé (LIBELLES) ; les anciennes adresses mènent à leur nouvelle place (REDIRECTIONS).
//
// Une entrée : { route, label, ico, sub: [[suffixe, libellé]] (raccourcis vers un filtre), pages: [autres pages
// qui allument cette entrée] }. « route » peut contenir un « / » (ex. editeur/comptes, parametres/identite).

const PARAM = [
  ['identite', 'Identité'],
  ['facturation', 'Facturation'],
  ['objectifs', 'Objectifs'],
  ['listes', 'Listes'],
  ['scripts', 'Textes des scripts'],
  ['rappels', 'Rappels'],
  ['excel', 'Import / Export'],
  ['modules', 'Modules du CRM'],
  ['membres', 'Membres'],
  ['securite', 'Sécurité et sauvegardes'],
  ['compte', 'Mon compte'],
]

export const ESPACES_NAV = [
  {
    id: 'ensemble',
    nom: 'Vue d’ensemble',
    desc: 'Ce qui demande une action aujourd’hui',
    ico: 'radio',
    couleur: '#2563EB',
    entrees: [
      { route: 'controle', label: 'Tour de contrôle', ico: 'radio' },
      {
        route: 'journee',
        label: 'Ma journée',
        ico: 'sun',
        sub: [['?onglet=jour', 'Aujourd’hui'], ['?onglet=chauds', 'Prospects chauds'], ['?onglet=alertes', 'Alertes'], ['?onglet=routine', 'Ma routine'], ['?onglet=historique', 'Bilan de la semaine']],
      },
      { route: 'calendrier', label: 'Calendrier', ico: 'calendar' },
    ],
  },
  {
    id: 'logiciel',
    nom: 'Clients logiciel',
    desc: 'Clients du logiciel, licences, comptes et assistance',
    ico: 'layers',
    couleur: '#0E7490',
    entrees: [
      {
        route: 'plateforme',
        label: 'Clients du logiciel',
        ico: 'briefcase',
        sub: [['?filtre=danger', 'En danger'], ['?filtre=licence', 'Licence à régler'], ['?filtre=bloques', 'Bloqués']],
        pages: ['plateforme-client', 'editeur/clients', 'editeur/etablissements'],
      },
      { route: 'editeur/comptes', label: 'Comptes et accès', ico: 'users' },
      { route: 'editeur/hubs', label: 'Points de vente (Hubs)', ico: 'layers' },
      { route: 'editeur/adresses', label: 'Adresses de connexion', ico: 'globe' },
      { route: 'editeur/sites', label: 'Sites des clients', ico: 'folder' },
      { route: 'editeur/copie-articles', label: 'Copie d’articles', ico: 'copy' },
    ],
  },
  {
    id: 'commercial',
    nom: 'Commercial',
    desc: 'Prospects, clients de l’agence, appels, site et boutique',
    ico: 'target',
    couleur: '#2F6FED',
    entrees: [
      { route: 'acquisition', label: 'Prospects', ico: 'target', sub: [['?onglet=potentiels', 'En cours'], ['?onglet=perdus', 'Perdus']], pages: ['prospects'] },
      {
        route: 'clients',
        label: 'Clients de l’agence',
        ico: 'briefcase',
        sub: [['?onglet=nouveaux', 'Nouveaux'], ['?onglet=actifs', 'Actifs'], ['?onglet=anciens', 'Anciens'], ['?onglet=tous', 'Tous']],
        pages: ['prospect'],
      },
      { route: 'session', label: 'Session d’appels', ico: 'phone' },
      { route: 'scripts', label: 'Scripts d’appel', ico: 'message' },
      { route: 'editeur/partenaires', label: 'Elite Partners', ico: 'handshake' },
      { route: 'site', label: 'Site web', ico: 'globe', pages: ['site-pages', 'site-photos'] },
      { route: 'site-demandes', label: 'Demandes du site', ico: 'mail', sub: [['?onglet=atraiter', 'À traiter'], ['?onglet=traitees', 'Traitées']] },
      { route: 'boutique', label: 'Elite Store', ico: 'tag', sub: [['?onglet=commandes', 'Commandes'], ['?onglet=produits', 'Produits'], ['?onglet=cles', 'Clés de licence']] },
    ],
  },
  {
    id: 'finances',
    nom: 'Finances',
    desc: 'Factures, devis, paiements reçus et dépenses',
    ico: 'coins',
    couleur: '#16A34A',
    entrees: [
      {
        route: 'factures',
        label: 'Factures',
        ico: 'file',
        sub: [['?filtre=toutes', 'Toutes'], ['?filtre=impayees', 'Impayées'], ['?filtre=retard', 'En retard'], ['?filtre=payees', 'Payées']],
        pages: ['facture'],
      },
      { route: 'devis', label: 'Devis', ico: 'clipboard', sub: [['?filtre=toutes', 'Tous'], ['?filtre=attente', 'En attente'], ['?filtre=acceptes', 'Acceptés'], ['?filtre=refuses', 'Refusés']] },
      { route: 'paiements', label: 'Paiements reçus', ico: 'coins' },
      { route: 'charges', label: 'Charges', ico: 'chart' },
      { route: 'depenses', label: 'Dépenses', ico: 'wallet' },
      { route: 'abonnements', label: 'Abonnements', ico: 'repeat' },
    ],
  },
  {
    id: 'analyses',
    nom: 'Analyses',
    desc: 'Chiffres de l’agence et du logiciel',
    ico: 'chart',
    couleur: '#7A4CDB',
    entrees: [
      { route: 'dashboard', label: 'Tableau de bord', ico: 'chart' },
      { route: 'dashboard/acquisition', label: 'Acquisition', ico: 'target', module: 'commercial' },
      { route: 'dashboard/conversion', label: 'Conversion', ico: 'chart', module: 'commercial' },
      { route: 'dashboard/finances', label: 'Finances', ico: 'coins', module: 'facturation' },
      { route: 'editeur/tableau', label: 'Chiffres du logiciel', ico: 'chart' },
    ],
  },
  {
    id: 'administration',
    nom: 'Administration',
    desc: 'Réglages du CRM et du logiciel, documents',
    ico: 'settings',
    couleur: '#5B6475',
    entrees: [
      ...PARAM.map(([s, l]) => ({ route: `parametres/${s}`, label: l, ico: 'settings' })),
      { route: 'editeur/offres', label: 'Offres et prix', ico: 'tag' },
      { route: 'editeur/modules', label: 'Catalogue des modules', ico: 'grid' },
      { route: 'editeur/identite', label: 'Identité du logiciel', ico: 'star' },
      { route: 'documents', label: 'Documents et modèles', ico: 'folder' },
    ],
  },
]

// Pages hors menu mais jamais orphelines : chacune a une entrée dans la recherche (Ctrl K)
export const PAGES_SANS_MENU = [{ route: 'saisie', label: 'Nouvelle action (page complète)', ico: 'plus', espace: 'ensemble' }]

// Anciennes adresses → nouvelle place (le reste de l'adresse, ex. ?filtre=…, est gardé)
export const REDIRECTIONS = {
  // Accueil : le tableau de bord unique (Tour de contrôle) ; l'ancien tableau de bord reste dans Analyses
  '': 'controle',
  'plateforme-outils': 'espace/administration',
  apps: 'espace',
  editeur: 'editeur/tableau',
  parametres: 'parametres/identite',
}

const TOUTES = ESPACES_NAV.flatMap((e) => e.entrees.map((x) => ({ ...x, espace: e.id })))

// Libellé unique de chaque page (titres, fil d'ariane, onglets, recherche)
export const LIBELLES = Object.fromEntries([
  ...TOUTES.map((x) => [x.route, x.label]),
  ...PAGES_SANS_MENU.map((x) => [x.route, x.label]),
  ['plateforme-client', 'Fiche client'],
  ['prospect', 'Fiche'],
  ['facture', 'Document'],
  ['site-pages', 'Pages du site'],
  ['site-photos', 'Photos du site'],
  ['espace', 'Tous les espaces'],
])

// Clé de la page affichée, pour retrouver son entrée : « dashboard/finances », « editeur/comptes », « parametres/x »
export function cleDePage(page, arg = '', q = new URLSearchParams()) {
  if (page === 'dashboard') {
    const o = { acquisition: 'acquisition', prospection: 'acquisition', marche: 'acquisition', conversion: 'conversion', finances: 'finances', ventes: 'finances', clients: 'finances' }[arg || q.get('onglet')]
    return o ? `dashboard/${o}` : 'dashboard'
  }
  if (page === 'parametres') return `parametres/${arg || 'identite'}`
  if (page === 'editeur') return `editeur/${(arg || 'tableau').split('/')[0]}`
  return page
}

// Entrée et espace d'une page (une page liée à une entrée allume cette entrée)
export function entreeDe(cle) {
  return TOUTES.find((x) => x.route === cle) || TOUTES.find((x) => (x.pages || []).includes(cle)) || PAGES_SANS_MENU.find((x) => x.route === cle) || null
}
export const espaceDe = (cle) => ESPACES_NAV.find((e) => e.id === entreeDe(cle)?.espace) || null

// Espaces filtrés : une entrée disparaît si son module est désactivé (accessible(route) renvoie false)
export function espacesActifs(accessible = () => true) {
  return ESPACES_NAV.map((e) => ({ ...e, entrees: e.entrees.filter((x) => accessible(x.route, x)) })).filter((e) => e.entrees.length)
}

// Pour la recherche : toutes les pages, avec l'espace en sous-titre et leurs raccourcis de filtre
export function pagesRecherche(accessible = () => true) {
  const espaces = espacesActifs(accessible)
  return [
    ...espaces.flatMap((e) => e.entrees.map((x) => ({ path: x.route, label: x.label, ico: x.ico, sub: x.sub || [], espace: e.nom }))),
    ...PAGES_SANS_MENU.filter((x) => accessible(x.route, x)).map((x) => ({ path: x.route, label: x.label, ico: x.ico, sub: [], espace: ESPACES_NAV.find((e) => e.id === x.espace).nom })),
  ]
}

// Adresse à corriger (ancienne route) ou null
export function redirection(route) {
  const [chemin, query] = route.split('?')
  const cible = REDIRECTIONS[chemin]
  return cible ? `${cible}${query ? `?${query}` : ''}` : null
}

// Barre du bas sur téléphone : 4 espaces + « Noter » au centre ; « Espaces » les montre tous
export const BAS = [
  { espace: 'ensemble', route: 'controle', short: 'Accueil', ico: 'radio' },
  { espace: 'commercial', route: 'acquisition', short: 'Commercial', ico: 'target' },
  { cta: true, short: 'Noter', ico: 'plus' },
  { espace: 'finances', route: 'factures', short: 'Finances', ico: 'coins' },
  { route: 'espace', short: 'Espaces', ico: 'grid' },
]
