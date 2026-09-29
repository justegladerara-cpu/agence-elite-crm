import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Logo } from './icons'
import { AppCtx, Modal, useToast, go, setDevise, DEVISES, ConfirmHost } from './ui'
import { db, supabase, isLocal, syncStatus, hasOfflineCache, flush } from './lib/store'
import { computeAll } from './lib/logic'
import { setBrand } from './lib/theme'
import { buildSeed, isExample, TAG } from './lib/seed'
import Login from './pages/Login'
import Journee from './pages/Journee'
import Saisie, { ActionForm } from './pages/Saisie'
import { MiniListe } from './pages/Prospects'
import Hub, { ESPACES } from './pages/Hub'
import { lienHub } from './lib/hub'
const Fiche = lazy(() => import('./pages/Fiche'))
const SaisieArgent = lazy(() => import('./pages/Tresorerie').then((m) => ({ default: m.SaisieArgent })))
const ARGENT = { 'Paiement reçu': 'paiement', Dépense: 'depense' }
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Parametres = lazy(() => import('./pages/Parametres'))
const Session = lazy(() => import('./pages/Session'))
import { facturesImpayees } from './pages/Impayes'
const Factures = lazy(() => import('./pages/Factures'))
const DocEditor = lazy(() => import('./pages/Factures').then((m) => ({ default: m.DocEditor })))
const Paiements = lazy(() => import('./pages/Finances').then((m) => ({ default: m.Paiements })))
const Depenses = lazy(() => import('./pages/Finances').then((m) => ({ default: m.Depenses })))
const Scripts = lazy(() => import('./pages/Scripts'))
const Recherche = lazy(() => import('./pages/Recherche'))
const Calendrier = lazy(() => import('./pages/Calendrier'))
const Boutique = lazy(() => import('./pages/Boutique'))
import Applications from './pages/Applications'
import { syncRappels } from './lib/rappels'
import { QuickForm, AppelSheet } from './pages/Rapide'
import { appelEnCours, oublierAppel } from './lib/appel'
import { corbeille } from './lib/corbeille'
import { messageErreur, installerSuiviErreurs } from './lib/erreurs'
import Raccourcis from './pages/Raccourcis'

installerSuiviErreurs()

// Menu groupé : piloter, vendre, facturer, régler
const NAV = [
  {
    titre: 'Pilotage',
    items: [
      {
        path: 'journee',
        memo: 'journee',
        label: 'Ma journée',
        ico: 'sun',
        sub: [['?onglet=jour', "Aujourd'hui"], ['?onglet=chauds', 'Prospects chauds'], ['?onglet=alertes', 'Alertes'], ['?onglet=routine', 'Ma routine'], ['?onglet=historique', 'Bilan de la semaine']],
      },
      {
        path: 'dashboard',
        memo: 'dashboard',
        label: 'Tableau de bord',
        ico: 'chart',
        sub: [['?onglet=vue', "Vue d'ensemble"], ['?onglet=acquisition', 'Acquisition'], ['?onglet=conversion', 'Conversion'], ['?onglet=finances', 'Finances']],
      },
      { path: 'calendrier', label: 'Calendrier', ico: 'calendar' },
    ],
  },
  {
    titre: 'Commercial',
    items: [
      { path: 'acquisition', memo: 'acquisition', label: 'Prospects', ico: 'target', sub: [['?onglet=potentiels', 'En cours'], ['?onglet=perdus', 'Perdus']] },
      {
        path: 'clients',
        memo: 'hub',
        label: 'Clients',
        ico: 'briefcase',
        sub: [['?onglet=nouveaux', 'Nouveaux clients'], ['?onglet=actifs', 'Clients actifs'], ['?onglet=anciens', 'Anciens clients'], ['?onglet=tous', 'Tous les clients']],
      },
      { path: 'session', label: "Session d'appels", ico: 'phone' },
      { path: 'scripts', label: 'Scripts', ico: 'message' },
      {
        path: 'boutique',
        memo: 'boutique',
        label: 'Elite Store',
        ico: 'tag',
        sub: [['?onglet=commandes', 'Commandes'], ['?onglet=produits', 'Produits'], ['?onglet=cles', 'Clés de licence']],
      },
    ],
  },
  {
    titre: 'Finances',
    items: [
      { path: 'devis', memo: 'liste-devis', label: 'Devis', ico: 'clipboard', sub: [['?filtre=toutes', 'Tous'], ['?filtre=attente', 'En attente'], ['?filtre=acceptes', 'Acceptés'], ['?filtre=refuses', 'Refusés']] },
      {
        path: 'factures',
        memo: 'liste-facture',
        label: 'Factures',
        ico: 'file',
        sub: [['?filtre=toutes', 'Toutes'], ['?filtre=impayees', 'Impayées'], ['?filtre=retard', 'En retard'], ['?filtre=payees', 'Payées']],
      },
      { path: 'paiements', label: 'Paiements reçus', ico: 'coins' },
      { path: 'depenses', label: 'Dépenses', ico: 'wallet' },
    ],
  },
]
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const PAGES = Object.fromEntries(NAV.flatMap((g) => g.items).map((n) => [n.path, n.label]))
PAGES.parametres = 'Paramètres'
const PARAMETRES = {
  path: 'parametres',
  label: 'Paramètres',
  ico: 'settings',
  sub: [['/identite', 'Identité'], ['/facturation', 'Facturation'], ['/objectifs', 'Objectifs'], ['/listes', 'Listes'], ['/scripts', 'Scripts'], ['/rappels', 'Rappels'], ['/excel', 'Import / Export'], ['/securite', 'Sécurité'], ['/compte', 'Compte']],
}
PAGES.saisie = 'Nouvelle action'
PAGES.apps = 'Applications'

// Applications (façon Odoo / Zoho One) : chaque module a son icône, sa couleur et ses propres pages
const ITEM = Object.fromEntries([...NAV.flatMap((g) => g.items), PARAMETRES].map((n) => [n.path, n]))
const APPS = [
  {
    id: 'commercial',
    nom: 'Commercial',
    desc: 'Ma journée, prospection et suivi des clients',
    ico: 'briefcase',
    couleur: '#2f6fed',
    pages: ['journee', 'acquisition', 'session', 'scripts', 'clients'],
    groupes: [
      [null, ['journee']],
      ['Acquisition', ['acquisition', 'session', 'scripts']],
      ['Suivi des clients', ['clients']],
    ],
  },
  { id: 'facturation', nom: 'Facturation', desc: 'Devis, factures, paiements et dépenses', ico: 'file', couleur: '#18a058', pages: ['factures', 'devis', 'paiements', 'depenses'] },
  { id: 'analytics', nom: 'Tableau de bord', desc: 'Chiffres, conversion et finances', ico: 'chart', couleur: '#7a4cdb', pages: ['dashboard'] },
  { id: 'agenda', nom: 'Agenda', desc: 'Rendez-vous, relances et échéances', ico: 'calendar', couleur: '#0e9aa7', pages: ['calendrier'] },
  { id: 'store', nom: 'Elite Store', desc: 'Commandes, produits et clés de licence', ico: 'tag', couleur: '#e10600', pages: ['boutique'] },
  { id: 'site', nom: 'Site web', desc: 'Le site agence-elite et sa boutique', ico: 'globe', couleur: '#10151f', pages: [], lien: '/site/' },
  { id: 'parametres', nom: 'Paramètres', desc: 'Identité, facturation, objectifs, compte', ico: 'settings', couleur: '#5b6475', pages: ['parametres'] },
].map((a) => ({ ...a, route: a.pages[0], items: a.pages.map((x) => ITEM[x]) }))
const APP_DE = Object.fromEntries(APPS.flatMap((a) => a.pages.map((x) => [x, a])))
// Barre du bas sur téléphone : Journée, Clients, Saisir (au centre), Stats, Réglages
const BOTTOM = [
  { path: 'apps', short: 'Applis', ico: 'grid' },
  { path: 'journee', short: 'Journée', ico: 'sun' },
  { path: 'saisie', short: 'Noter', ico: 'plus', cta: true },
  { path: 'acquisition', short: 'Prospects', ico: 'target' },
  { path: 'clients', short: 'Clients', ico: 'briefcase' },
]
// Un champ de saisie a le focus : les raccourcis clavier ne s'appliquent pas
const enSaisie = (e) => {
  const t = e.target
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

// Écran d'attente au démarrage (lecture de la session et des données)
function Attente() {
  return (
    <div className="attente" role="status" aria-label="Chargement du CRM">
      <Logo size={52} />
      <span className="attente-barre" />
    </div>
  )
}

function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'journee'
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const f = () => {
      setRoute(get())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return route
}

export default function App() {
  const [session, setSession] = useState(isLocal ? 'local' : undefined)
  useEffect(() => {
    if (!supabase) return
    // Hors ligne avec des données déjà enregistrées sur l'appareil : on ouvre le CRM sans attendre la session
    const offlineOk = () => !navigator.onLine && hasOfflineCache()
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session || (offlineOk() ? 'offline' : null)))
      .catch(() => setSession(offlineOk() ? 'offline' : null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession((cur) => s || (cur === 'offline' && !navigator.onLine ? cur : s)))
    return () => data.subscription.unsubscribe()
  }, [])
  // Double authentification activée : le code à 6 chiffres est demandé avant d'ouvrir le CRM
  const [aal, setAal] = useState(null)
  useEffect(() => {
    if (!supabase || !session || typeof session !== 'object') return
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(
      ({ data }) => setAal(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2' ? 'code' : 'ok'),
      () => setAal('ok'),
    )
  }, [session])
  if (session === undefined) return <Attente />
  if (!session) return <Login />
  if (typeof session === 'object' && aal === null) return <Attente />
  if (typeof session === 'object' && aal === 'code') return <Login code onCode={() => setAal('ok')} />
  return <Crm />
}

// Profil Instagram partagé depuis le téléphone vers l'application (PWA installée) : ouvre l'ajout express
const PARTAGE = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
if (PARTAGE && ['url', 'text', 'title'].some((k) => PARTAGE.has(k))) {
  const q = PARTAGE
  const tout = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ')
  const compte = (tout.match(/instagram\.com\/([A-Za-z0-9._]+)/) || tout.match(/@([A-Za-z0-9._]{2,})/) || [])[1] || ''
  window.history.replaceState(null, '', `/#/acquisition?nouveau=insta${compte ? `&compte=${encodeURIComponent(compte)}` : ''}`)
}

function Crm() {
  const route = useRoute()
  // Anciens liens (page Prospects, filtres Clients) : redirigés vers le hub Clients
  useEffect(() => {
    const [chemin, query = ''] = route.split('?')
    const q = new URLSearchParams(query)
    if (chemin === 'prospects' || (chemin === 'clients' && q.get('filtre') && !q.get('onglet'))) window.location.replace(`#/${lienHub(chemin, q)}`)
  }, [route])
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [recherche, setRecherche] = useState(false)
  const [aide, setAide] = useState(false)
  const [appel, setAppel] = useState(null)
  // Retour dans l'application après un appel lancé depuis le CRM : feuille « Comment s'est passé l'appel ? »
  useEffect(() => {
    let parti = false
    let minuteur
    const verifier = () => {
      const a = appelEnCours()
      if (!a) return
      if (document.visibilityState === 'hidden') {
        parti = true
        return
      }
      if (parti || Date.now() - a.t > 4000) {
        oublierAppel()
        parti = false
        setAppel(a.id)
      }
    }
    // Sur ordinateur, l'appel ne quitte pas la page : la feuille s'ouvre après quelques secondes
    const lance = () => {
      parti = false
      clearTimeout(minuteur)
      minuteur = setTimeout(verifier, 5000)
    }
    document.addEventListener('visibilitychange', verifier)
    window.addEventListener('focus', verifier)
    window.addEventListener('crm-appel', lance)
    return () => {
      clearTimeout(minuteur)
      document.removeEventListener('visibilitychange', verifier)
      window.removeEventListener('focus', verifier)
      window.removeEventListener('crm-appel', lance)
    }
  }, [])
  // Raccourcis : Ctrl/⌘ + K ou « / » pour la recherche, N pour une nouvelle action, ? pour l'aide, G puis une lettre pour naviguer
  useEffect(() => {
    let g = 0
    const ALLER = { j: 'journee', p: 'acquisition', c: 'clients', f: 'factures', d: 'dashboard', a: 'apps', s: 'session' }
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRecherche(true)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || enSaisie(e) || document.querySelector('.modal-bg')) return
      const touche = e.key.toLowerCase()
      if (Date.now() - g < 1200 && ALLER[touche]) {
        e.preventDefault()
        g = 0
        go(`/${ALLER[touche]}`)
        return
      }
      g = 0
      if (touche === 'g') g = Date.now()
      else if (e.key === '?') {
        e.preventDefault()
        setAide(true)
      } else if (e.key === '/') {
        e.preventDefault()
        setRecherche(true)
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setActionModal({})
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const [toast, toastNode] = useToast()
  // Rubriques dépliées à la main dans la barre de gauche (celle de la page affichée l'est toujours)
  const [ouverts, setOuverts] = useState([])
  const [sync, setSync] = useState(syncStatus.get())
  useEffect(() => syncStatus.subscribe(setSync), [])

  const reload = useCallback(async function charger(essai = 0) {
    try {
      let st = await db.load()
      // Démo publique : charge les exemples si le navigateur est vide
      if (isLocal && import.meta.env.VITE_AUTOSEED && st.prospects.length === 0 && !window.__seeded) {
        window.__seeded = true
        const seed = buildSeed()
        await db.bulkImport(seed.prospects, seed.actions)
        st = await db.load()
      }
      setState({ ...st, documents: st.documents || [] })
      setError(null)
    } catch (e) {
      // Horloge de l'appareil légèrement en retard sur Supabase juste après la connexion : on réessaie seul
      if (essai < 4 && /issued at future|in the future|\biat\b/i.test(e.message)) {
        setTimeout(() => charger(essai + 1), 1500 * (essai + 1))
        return
      }
      setError(e.message)
    }
  }, [])
  useEffect(() => {
    reload()
    // Resynchronise quand on revient sur l'onglet (téléphone ↔ ordinateur)
    const f = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', f)
    // Retour d'internet : on envoie les modifications en attente puis on recharge
    const on = () => flush().then(reload)
    window.addEventListener('online', on)
    return () => {
      document.removeEventListener('visibilitychange', f)
      window.removeEventListener('online', on)
    }
  }, [reload])

  // Les modules PDF et Excel ne sont plus préchargés au démarrage : ils se chargent à la première utilisation

  const data = useMemo(() => (state ? computeAll(state.prospects, state.actions, state.settings) : null), [state])

  // Rappels sur le téléphone : la liste à venir est envoyée au service quelques secondes après chaque changement
  useEffect(() => {
    if (!data || !state.settings.rappels?.actif) return
    const t = setTimeout(() => syncRappels(data, state.settings, state.documents || [], state.actions).catch(() => {}), 3000)
    return () => clearTimeout(t)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const wrap = (fn) => async (...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      toast(messageErreur(e), true)
      throw e
    }
  }
  const api = {
    addProspect: wrap(async (name, fiche) => {
      const p = await db.addProspect(name, fiche)
      setState((s) => ({ ...s, prospects: [...s.prospects, p] }))
      return p
    }),
    updateProspect: wrap(async (id, patch) => {
      const p = await db.updateProspect(id, patch)
      setState((s) => ({ ...s, prospects: s.prospects.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
      return p
    }),
    deleteProspect: wrap(async (id, opts = {}) => {
      const avant = state.prospects.find((x) => x.id === id)
      const contenu = {
        prospects: avant ? [avant] : [],
        actions: state.actions.filter((a) => a.prospect_id === id),
        documents: state.documents.filter((d) => d.prospect_id === id),
      }
      await db.deleteProspect(id)
      const cid = avant && corbeille.ajouter('prospect', avant.name, contenu)
      if (cid && !opts.silencieux) toast(`« ${avant.name} » supprimé ✓`, false, { annuler: () => api.restaurer(cid) })
      setState((s) => ({
        ...s,
        prospects: s.prospects.filter((x) => x.id !== id),
        actions: s.actions.filter((a) => a.prospect_id !== id),
        documents: s.documents.map((d) => (d.prospect_id === id ? { ...d, prospect_id: null } : d)),
      }))
    }),
    addActions: wrap(async (list) => {
      const rows = await db.addActions(list)
      setState((s) => ({ ...s, actions: [...s.actions, ...rows] }))
      return rows
    }),
    updateAction: wrap(async (id, patch) => {
      const a = await db.updateAction(id, patch)
      setState((s) => ({ ...s, actions: s.actions.map((x) => (x.id === id ? { ...x, ...a } : x)) }))
      return a
    }),
    deleteAction: wrap(async (id, opts = {}) => {
      const avant = state.actions.find((x) => x.id === id)
      await db.deleteAction(id)
      if (avant && !opts.silencieux) {
        const cid = corbeille.ajouter('action', `${avant.action || 'Action'} du ${avant.date || ''}`, { actions: [avant] })
        toast(`${avant.action || 'Action'} supprimée ✓`, false, { annuler: () => api.restaurer(cid) })
      }
      setState((s) => ({ ...s, actions: s.actions.filter((x) => x.id !== id) }))
    }),
    saveDoc: wrap(async (doc) => {
      const d = await db.saveDoc(doc)
      setState((s) => ({ ...s, documents: [...s.documents.filter((x) => x.id !== d.id), d] }))
      return d
    }),
    deleteDoc: wrap(async (id, opts = {}) => {
      const avant = state.documents.find((x) => x.id === id)
      await db.deleteDoc(id)
      if (avant && !opts.silencieux) {
        const cid = corbeille.ajouter('document', avant.numero || 'Document', { documents: [avant] })
        toast(`${avant.numero || 'Document'} supprimé ✓`, false, { annuler: () => api.restaurer(cid) })
      }
      setState((s) => ({ ...s, documents: s.documents.filter((x) => x.id !== id) }))
    }),
    // Remet un élément de la corbeille (annulation d'une suppression)
    restaurer: wrap(async (cid) => {
      const item = corbeille.liste().find((x) => x.id === cid)
      if (!item) return
      await db.restaurer(item.contenu)
      corbeille.retirer(cid)
      const { prospects = [], actions = [], documents = [] } = item.contenu
      const sans = (l, n) => l.filter((x) => !n.some((y) => y.id === x.id))
      setState((s) => ({
        ...s,
        prospects: [...sans(s.prospects, prospects), ...prospects],
        actions: [...sans(s.actions, actions), ...actions],
        documents: [...sans(s.documents, documents), ...documents],
      }))
      toast(`${item.libelle} restauré ✓`)
    }),
    uploadRecu: wrap((dataUrl, ext, type) => db.uploadRecu(dataUrl, ext, type)),
    recuUrl: (path) => db.recuUrl(path),
    saveSettings: wrap(async (settings) => {
      await db.saveSettings(settings)
      setState((s) => ({ ...s, settings }))
    }),
    bulkImport: wrap(async (prospects, actions, replace) => {
      if (replace) await db.wipe()
      await db.bulkImport(prospects, actions)
      await reload()
    }),
    loadSeed: wrap(async () => {
      const { prospects, actions: raw } = buildSeed()
      // Montants d'exemple (en euros) convertis dans la devise choisie
      const k = (DEVISES.find((d) => d.code === state.settings.devise) || DEVISES.find((x) => x.code === 'EUR')).parEuro
      const actions = raw.map((a) => (a.montant ? { ...a, montant: Math.round((a.montant * k) / 50) * 50 || a.montant } : a))
      await db.bulkImport(prospects, actions)
      await reload()
    }),
    clearSeed: wrap(async () => {
      const ex = state.prospects.filter(isExample)
      for (const p of ex) await db.deleteProspect(p.id)
      for (const a of state.actions.filter((a) => !a.prospect_id && (a.notes || '').includes(TAG))) await db.deleteAction(a.id)
      await reload()
    }),
    reload,
  }

  if (error && !state)
    return (
      <div className="login">
        <div className="card">
          <h2>Connexion aux données impossible</h2>
          <p className="muted">{error}</p>
          <button className="btn primary" onClick={() => reload()}>
            Réessayer
          </button>
        </div>
      </div>
    )
  if (!state) return <Attente />

  setDevise(state.settings.devise)
  setBrand(state.settings.apparence)
  const brand = state.settings.apparence || {}
  const avecNom = brand.afficherNom !== false
  const syncTxt = !sync.online
    ? `Hors ligne${sync.pending ? ` · ${sync.pending} modification${sync.pending > 1 ? 's' : ''} en attente` : ''}`
    : sync.syncing || sync.pending
      ? `Synchronisation… (${sync.pending})`
      : `Synchronisé${sync.derniere ? ` à ${new Date(sync.derniere).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ' en ligne'}`
  const syncCls = !sync.online ? 'off' : sync.syncing || sync.pending ? 'busy' : ''
  const ctx = {
    ...state,
    data,
    api,
    toast,
    openAction: (prefill) => setActionModal(prefill || {}),
  }

  const [chemin, query = ''] = route.split('?')
  const [page, arg = ''] = chemin.split(/\/(.*)/s)
  const q = new URLSearchParams(query)
  const docType = page === 'facture' ? state.documents.find((d) => d.id === arg)?.type || new URLSearchParams(query).get('type') : null
  // Prospect ou client : la fiche s'ouvre dans l'espace Acquisition ou Clients du hub Commercial
  const estClient = (id) => data.clients.some((c) => c.id === id)
  const ongletAcq = page === 'clients' && ESPACES.acquisition.cats.includes(q.get('onglet'))
  const current =
    page === 'prospect' ? (estClient(arg) ? 'clients' : 'acquisition') : page === 'prospects' || ongletAcq ? 'acquisition' : page === 'facture' ? (docType === 'devis' ? 'devis' : 'factures') : page
  // Pastilles du menu : ce qui attend une action dans chaque rubrique
  const retards = facturesImpayees(state.documents || [], state.actions).filter((d) => d.statut === 'En retard').length
  const devisAttente = (state.documents || []).filter((d) => d.type === 'devis' && !d.data?.factureNumero && !['Accepté', 'Refusé'].includes(d.data?.statut) && !(d.data?.validite && d.data.validite < new Date().toISOString().slice(0, 10))).length
  const badges = {
    journee: [data.aRelancer.length, 'hot', 'relances à faire'],
    clients: [data.clientsAlertes.length, '', 'clients à surveiller'],
    factures: [retards, 'hot', 'factures en retard'],
    devis: [devisAttente, '', 'devis en attente'],
  }
  // Application ouverte : son menu, sa couleur ; sans application (accueil, saisie) le menu liste les applications
  const basculerRubrique = (id) => setOuverts((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const appli = page === 'apps' || page === 'saisie' ? null : APP_DE[current] || APP_DE.dashboard
  let content
  if (page === 'saisie') content = <Saisie key={route} prospectId={arg} />
  else if (page === 'prospects') content = null
  else if (page === 'prospect')
    content = (
      <div className="split">
        <MiniListe current={arg} />
        <div className="split-main">
          <Fiche key={arg} id={arg} />
        </div>
      </div>
    )
  else if (page === 'journee') content = <Journee key={route} onglet={q.get('onglet')} />
  else if (page === 'clients' || page === 'acquisition') content = <Hub key={route} espace={current === 'acquisition' ? 'acquisition' : 'clients'} onglet={q.get('onglet')} etape={q.get('etape')} vue={q.get('vue')} filtre={q.get('filtre')} nouveau={q.get('nouveau')} compte={q.get('compte')} />
  else if (page === 'parametres') content = <Parametres section={arg} />
  else if (page === 'session') content = <Session />
  else if (page === 'scripts') content = <Scripts />
  else if (page === 'calendrier') content = <Calendrier />
  else if (page === 'factures' || page === 'devis') content = <Factures key={route} type={page === 'devis' ? 'devis' : 'facture'} filtre={q.get('filtre')} />
  else if (page === 'paiements') content = <Paiements />
  else if (page === 'depenses') content = <Depenses />
  else if (page === 'boutique') content = <Boutique key={route} onglet={q.get('onglet')} />
  else if (page === 'facture') content = <DocEditor key={route} id={arg} query={query} />
  else if (page === 'apps') content = <Applications apps={APPS} pastilles={(a) => a.pages.map((x) => badges[x]).find((b) => b && b[0])} />
  else content = <Dashboard key={route} onglet={q.get('onglet')} />
  const pastille = (path) => {
    const [n, cls, t] = badges[path] || []
    return n ? (
      <span className={`nav-badge ${cls}`} title={`${n} ${t}`}>
        {n}
      </span>
    ) : null
  }
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app" style={{ '--app': appli ? appli.couleur : 'var(--gold)' }}>
        <aside className="sidebar">
          <div className={`brand ${avecNom ? '' : 'no-name'}`}>
            <Logo size={36} />
            {avecNom && (
              <div style={{ minWidth: 0 }}>
                <div className="brand-name">{brand.nom}</div>
                {brand.sousTitre && <div className="brand-sub">{brand.sousTitre}</div>}
              </div>
            )}
          </div>
          <button className="nav-search" onClick={() => setRecherche(true)} aria-keyshortcuts="Control+K Meta+K /">
            <Icon n="search" size={15} /> Rechercher… <kbd>{MAC ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <button className="nav-new" onClick={() => setActionModal({})} aria-keyshortcuts="N">
            <Icon n="plus" size={17} /> Nouvelle action <kbd>N</kbd>
          </button>
          <nav className="nav-scroll nav-arbre" aria-label="Menu principal">
            <button className={`nav-item ${page === 'apps' ? 'active' : ''}`} aria-current={page === 'apps' ? 'page' : undefined} onClick={() => go('/apps')}>
              <span className="ico"><Icon n="grid" size={17} /></span>
              Accueil
            </button>
            {/* Comme Zoho Books : chaque rubrique et ses pages, jamais les filtres (ils restent dans la page) */}
            {APPS.map((a) => {
              const actif = appli?.id === a.id
              if (a.lien)
                return (
                  <button key={a.id} className="nav-item" onClick={() => window.open(a.lien, '_blank', 'noopener')}>
                    <span className="ico"><Icon n={a.ico} size={17} /></span>
                    {a.nom}
                  </button>
                )
              if (a.pages.length === 1)
                return (
                  <button key={a.id} className={`nav-item ${actif ? 'active' : ''}`} aria-current={actif ? 'page' : undefined} onClick={() => go(`/${a.route}`)}>
                    <span className="ico"><Icon n={a.ico} size={17} /></span>
                    {a.nom}
                    {pastille(a.pages[0])}
                  </button>
                )
              const ouvert = actif || ouverts.includes(a.id)
              return (
                <div key={a.id} className={`nav-rubrique ${ouvert ? 'open' : ''}`}>
                  <button className={`nav-item nav-parent ${actif ? 'dans' : ''}`} aria-expanded={ouvert} onClick={() => (actif ? go(`/${a.route}`) : basculerRubrique(a.id))}>
                    <span className="ico"><Icon n={a.ico} size={17} /></span>
                    {a.nom}
                    {!ouvert && pastille(a.pages.find((x) => badges[x]?.[0]))}
                    <span className="nav-chev" aria-hidden="true"><Icon n="chevron" size={12} /></span>
                  </button>
                  {ouvert && (
                    <div className="nav-enfants">
                      {a.pages.map((x) => {
                        const n = ITEM[x]
                        return (
                          <button key={x} className={`nav-item nav-enfant ${current === x ? 'active' : ''}`} aria-current={current === x ? 'page' : undefined} onClick={() => go(`/${x}`)}>
                            {n.label}
                            {pastille(x)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
          <div className={`sidebar-foot ${syncCls}`}>{isLocal ? 'Mode démo : données dans ce navigateur' : syncTxt}</div>
        </aside>
        <main className="main">
          <header className="mobile-top">
            <Logo size={32} />
            <div style={{ minWidth: 0 }}>
              {avecNom && <div className="brand-name">{brand.nom}</div>}
              <div className="brand-sub">{appli && appli.pages.length > 1 ? `${appli.nom} · ${PAGES[current]}` : appli ? appli.nom : PAGES[current] || brand.sousTitre}</div>
            </div>
            <button className="icon-btn mobile-settings" aria-label="Rechercher" onClick={() => setRecherche(true)}>
              <Icon n="search" size={18} />
            </button>
            <button className={`icon-btn mobile-settings mobile-gear ${page === 'apps' ? 'on' : ''}`} aria-label="Toutes les applications" onClick={() => go('/apps')}>
              <Icon n="grid" size={18} />
            </button>
          </header>
          {!isLocal && (!sync.online || sync.pending > 0 || sync.error) && (
            <div className={`sync-banner ${syncCls}`}>
              <span className="dot" />
              {sync.error || syncTxt}
              {!sync.online && <span className="muted"> · tes saisies partiront dès le retour d'internet</span>}
            </div>
          )}
          {isLocal && (route === '' || route.startsWith('dashboard')) && (
            <div className="banner">Mode démo : les données restent dans ce navigateur. La version en ligne se branche sur Supabase.</div>
          )}
          {appli && appli.items.length > 1 && (
            <nav className="app-onglets" aria-label={`Menu ${appli.nom}`}>
              {appli.items.map((n) => (
                <button key={n.path} className={current === n.path ? 'on' : ''} onClick={() => go(`/${n.path}`)}>
                  {n.label}
                  {pastille(n.path)}
                </button>
              ))}
            </nav>
          )}
          <Suspense fallback={<div className="chargement" aria-busy="true" aria-label="Chargement" />}>{content}</Suspense>
        </main>
        <nav className="bottom-nav" aria-label="Navigation principale">
          {BOTTOM.map((n) => (
            <button key={n.path} className={`${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} aria-current={current === n.path ? 'page' : undefined} onClick={() => (n.cta ? setActionModal({}) : go(`/${n.path}`))}>
              <span className="ico"><Icon n={n.ico} size={n.cta ? 22 : 20} /></span>
              {n.short}
              {!n.cta && pastille(n.path)}
            </button>
          ))}
        </nav>
      </div>
      {actionModal && !actionModal.edit && !actionModal.complet && ARGENT[actionModal.action] ? (
        // Paiement ou dépense : formulaires dédiés (frais liés au paiement, reçu, facture)
        <Suspense fallback={null}>
          <SaisieArgent modal={{ type: ARGENT[actionModal.action], prefill: { prospect_id: actionModal.prospect_id || null } }} onClose={() => setActionModal(null)} />
        </Suspense>
      ) : actionModal && actionModal.prospect_id && !actionModal.edit && !actionModal.complet ? (
        <Modal title="Noter une action" onClose={() => setActionModal(null)}>
          <QuickForm prospectId={actionModal.prospect_id} canal={actionModal.canal} action={actionModal.action} onDone={() => setActionModal(null)} onComplet={(x) => setActionModal({ ...x, complet: true })} />
        </Modal>
      ) : (
        actionModal && (
          <Modal title={actionModal.edit ? "Modifier l'action" : 'Nouvelle action'} onClose={() => setActionModal(null)} large>
            <ActionForm prefill={actionModal} onDone={() => setActionModal(null)} />
          </Modal>
        )
      )}
      {appel && !actionModal && (
        <Modal title="Comment s'est passé l'appel ?" onClose={() => setAppel(null)}>
          <AppelSheet prospectId={appel} onDone={() => setAppel(null)} onDetails={(x) => {
            setAppel(null)
            setActionModal({ ...x, complet: true })
          }} />
        </Modal>
      )}
      {aide && <Raccourcis onClose={() => setAide(false)} />}
      <ConfirmHost />
      {recherche && (
        <Suspense fallback={null}>
          <Recherche onClose={() => setRecherche(false)} pages={[...NAV.flatMap((g) => g.items), PARAMETRES]} />
        </Suspense>
      )}
      {toastNode}
    </AppCtx.Provider>
  )
}
