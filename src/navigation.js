// Navigation CRM 3.0 : 9 centres, une ligne chacun dans le menu de gauche (aucun sous-menu à dérouler).
// Un clic sur un centre ouvre sa première page ; ses autres pages sont des onglets en haut de l'écran.
// La même liste nourrit la recherche (Ctrl K), les titres sur téléphone, « Tous les espaces » et la barre du bas.
//
// Une entrée : { route, label, ico, sub: [[suffixe, libellé]] (raccourcis vers un filtre), pages: [autres pages
// qui allument cette entrée] }. « route » peut contenir un « / » (ex. editeur/comptes, parametres/identite).

export const ESPACES_NAV = [
  {
    id: 'pilotage',
    nom: 'Tableau de bord',
    desc: 'Toute l’agence sur une page : argent reçu, objectif, à faire, clients, carte',
    ico: 'grid',
    couleur: '#635BFF',
    entrees: [{ route: 'pilotage', label: 'Vue globale', ico: 'grid' }],
  },
  {
    id: 'reseau',
    nom: 'Réseau',
    desc: 'Tous tes contacts : clients et prospects, au même endroit',
    ico: 'users',
    couleur: '#2563EB',
    entrees: [
      { route: 'reseau', label: 'Accueil', ico: 'users' },
      {
        route: 'clients',
        label: 'Clients',
        ico: 'briefcase',
        sub: [['?onglet=nouveaux', 'Nouveaux'], ['?onglet=actifs', 'Actifs'], ['?onglet=anciens', 'Anciens'], ['?onglet=tous', 'Tous']],
        pages: ['prospect'],
      },
      { route: 'acquisition', label: 'Prospects', ico: 'target', sub: [['?onglet=potentiels', 'En cours'], ['?onglet=perdus', 'Perdus']], pages: ['prospects'] },
      {
        route: 'journee',
        label: 'Aujourd’hui',
        ico: 'sun',
        sub: [['?onglet=jour', 'Aujourd’hui'], ['?onglet=chauds', 'Prospects chauds'], ['?onglet=alertes', 'Alertes'], ['?onglet=routine', 'Ma routine'], ['?onglet=historique', 'Bilan de la semaine']],
      },
      { route: 'relances', label: 'Relances', ico: 'repeat' },
      { route: 'ventes-clients', label: 'Classement', ico: 'trophy' },
      { route: 'scripts', label: 'Scripts', ico: 'message', pages: ['parametres/scripts'] },
      { route: 'dashboard/acquisition', label: 'Analyses', ico: 'chart', module: 'commercial', pages: ['dashboard', 'dashboard/conversion'] },
      { route: 'parametres/listes', label: 'Réglages', ico: 'settings', pages: ['parametres/objectifs', 'parametres/rappels'] },
    ],
  },
  {
    id: 'services',
    nom: 'Services',
    desc: 'Ce que tu vends : logiciel de caisse, communication, matériel…',
    ico: 'layers',
    couleur: '#0E7490',
    entrees: [
      { route: 'activites', label: 'Mes services', ico: 'layers' },
      { route: 'controle', label: 'Logiciel de caisse', ico: 'radio' },
      {
        route: 'plateforme',
        label: 'Clients logiciel',
        ico: 'briefcase',
        sub: [['?filtre=danger', 'En danger'], ['?filtre=licence', 'Licence à régler'], ['?filtre=bloques', 'Bloqués']],
        pages: ['plateforme-client', 'editeur/clients', 'editeur/etablissements'],
      },
      { route: 'plateforme-echeances', label: 'Licences', ico: 'calendar', sub: [['?onglet=traiter', 'À traiter'], ['?onglet=demandes', 'Demandes'], ['?onglet=calendrier', 'Calendrier']] },
      { route: 'editeur/comptes', label: 'Comptes et accès', ico: 'users' },
      { route: 'editeur/hubs', label: 'Outils', ico: 'folder', pages: ['editeur/adresses', 'editeur/sites', 'editeur/copie-articles'] },
      { route: 'editeur/offres', label: 'Offres et modules', ico: 'tag', pages: ['editeur/modules', 'editeur/identite'] },
    ],
  },
  {
    id: 'finances',
    nom: 'Finances',
    desc: 'Argent reçu, factures, devis, dépenses et abonnements',
    ico: 'wallet',
    couleur: '#0F7B55',
    entrees: [
      { route: 'paiements', label: 'Encaissements', ico: 'coins' },
      {
        route: 'factures',
        label: 'Factures',
        ico: 'file',
        sub: [['?filtre=toutes', 'Toutes'], ['?filtre=impayees', 'Impayées'], ['?filtre=retard', 'En retard'], ['?filtre=payees', 'Payées']],
        pages: ['facture'],
      },
      { route: 'devis', label: 'Devis', ico: 'clipboard', sub: [['?filtre=toutes', 'Tous'], ['?filtre=attente', 'En attente'], ['?filtre=acceptes', 'Acceptés'], ['?filtre=refuses', 'Refusés']] },
      { route: 'depenses', label: 'Dépenses', ico: 'wallet' },
      { route: 'abonnements', label: 'Abonnements', ico: 'repeat' },
      { route: 'charges', label: 'Charges', ico: 'chart' },
      { route: 'operations', label: 'À rapprocher', ico: 'repeat' },
      { route: 'dashboard/finances', label: 'Vue financière', ico: 'chart', module: 'facturation' },
    ],
  },
  {
    id: 'moi',
    nom: 'Moi',
    desc: 'L’argent que tu prends pour toi, et ce qu’il te reste vraiment',
    ico: 'user-plus',
    couleur: '#D9468F',
    entrees: [{ route: 'moi', label: 'Mon argent', ico: 'wallet' }],
  },
  {
    id: 'equipe',
    nom: 'Équipe',
    desc: 'Donne un accès simple à ton assistante, ton closer, ton comptable',
    ico: 'users',
    couleur: '#C2410C',
    entrees: [
      { route: 'equipe', label: 'Mon équipe', ico: 'users' },
      { route: 'parametres/membres', label: 'Accès', ico: 'lock' },
    ],
  },
  {
    id: 'partners',
    nom: 'Elite Partners',
    desc: 'Le réseau de partenaires : ventes apportées, clés, commissions',
    ico: 'handshake',
    couleur: '#B8903F',
    entrees: [{ route: 'editeur/partenaires', label: 'Elite Partners', ico: 'handshake' }],
  },
  {
    id: 'site',
    nom: 'Site et marque',
    desc: 'Le site de l’agence, ses demandes et la boutique',
    ico: 'globe',
    couleur: '#7A4CDB',
    entrees: [
      { route: 'site-demandes', label: 'Demandes du site', ico: 'mail', sub: [['?onglet=atraiter', 'À traiter'], ['?onglet=traitees', 'Traitées']] },
      { route: 'site', label: 'Site web', ico: 'globe', pages: ['site-pages', 'site-photos'] },
      { route: 'boutique', label: 'Elite Store', ico: 'tag', sub: [['?onglet=commandes', 'Commandes'], ['?onglet=produits', 'Produits'], ['?onglet=cles', 'Clés de licence']] },
    ],
  },
  {
    id: 'administration',
    nom: 'Administration',
    desc: 'Identité, signature et cachet, facturation, sécurité, données',
    ico: 'settings',
    couleur: '#5B6475',
    entrees: [
      { route: 'parametres/identite', label: 'Identité', ico: 'star' },
      { route: 'signature', label: 'Signature et cachet', ico: 'edit' },
      { route: 'parametres/facturation', label: 'Facturation', ico: 'file' },
      { route: 'parametres/securite', label: 'Sécurité et sauvegardes', ico: 'lock' },
      { route: 'parametres/modules', label: 'Modules du CRM', ico: 'grid' },
      { route: 'parametres/excel', label: 'Données (import, export)', ico: 'folder' },
      { route: 'documents', label: 'Documents et modèles', ico: 'folder' },
      { route: 'parametres/compte', label: 'Mon compte', ico: 'users' },
    ],
  },
]

// Pages hors menu mais jamais orphelines : chacune a une entrée dans la recherche (Ctrl K)
export const PAGES_SANS_MENU = [
  { route: 'saisie', label: 'Nouvelle action (page complète)', ico: 'plus', espace: 'reseau' },
  { route: 'calendrier', label: 'Calendrier', ico: 'calendar', espace: 'reseau' },
  { route: 'editeur/tableau', label: 'Chiffres du logiciel', ico: 'chart', espace: 'services' },
  { route: 'editeur/modules', label: 'Catalogue des modules du logiciel', ico: 'grid', espace: 'services' },
  { route: 'editeur/identite', label: 'Identité du logiciel', ico: 'star', espace: 'services' },
  { route: 'editeur/adresses', label: 'Adresses de connexion', ico: 'globe', espace: 'services' },
  { route: 'editeur/sites', label: 'Sites des clients', ico: 'folder', espace: 'services' },
  { route: 'editeur/copie-articles', label: 'Copie d’articles', ico: 'copy', espace: 'services' },
  { route: 'parametres/objectifs', label: 'Objectifs', ico: 'target', espace: 'reseau' },
  { route: 'parametres/scripts', label: 'Textes des scripts', ico: 'message', espace: 'reseau' },
  { route: 'parametres/rappels', label: 'Rappels sur le téléphone', ico: 'bell', espace: 'reseau' },
  { route: 'dashboard/conversion', label: 'Analyses : conversion', ico: 'chart', espace: 'reseau' },
]

// Anciennes adresses → nouvelle place (le reste de l'adresse, ex. ?filtre=…, est gardé)
export const REDIRECTIONS = {
  // Accueil : le tableau de bord principal ; les sessions d'appel n'existent plus (la journée les remplace)
  '': 'pilotage',
  session: 'journee',
  'plateforme-outils': 'espace/services',
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
  ['activites', 'Activités'],
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
  // Page client de l'éditeur : la fiche client unique (ses réglages sont dans l'onglet « Réglages avancés »)
  const client = chemin.match(/^editeur\/clients\/([^/]+)$/)
  if (client) return `plateforme-client/${client[1]}?onglet=avance`
  const cible = REDIRECTIONS[chemin]
  return cible ? `${cible}${query ? `?${query}` : ''}` : null
}

// Barre du bas sur téléphone : 3 centres + « Encaisser » au centre ; « Espaces » les montre tous
export const BAS = [
  { espace: 'pilotage', route: 'pilotage', short: 'Accueil', ico: 'grid' },
  { espace: 'reseau', route: 'reseau', short: 'Réseau', ico: 'users' },
  { cta: true, short: 'Encaisser', ico: 'coins' },
  { espace: 'finances', route: 'paiements', short: 'Argent', ico: 'wallet' },
  { route: 'espace', short: 'Espaces', ico: 'grid' },
]
