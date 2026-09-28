import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Icon, Logo } from './icons'
import { AppCtx, Modal, useToast, go, setDevise, DEVISES, ongletActuel } from './ui'
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
import Fiche from './pages/Fiche'
import Dashboard from './pages/Dashboard'
import Parametres from './pages/Parametres'
import Session from './pages/Session'
import Factures, { DocEditor, facturesImpayees } from './pages/Factures'
import { Paiements, Depenses } from './pages/Finances'
import Scripts from './pages/Scripts'
import Recherche from './pages/Recherche'
import Calendrier from './pages/Calendrier'
import Boutique from './pages/Boutique'
import Applications from './pages/Applications'
import { syncRappels } from './lib/rappels'

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
  sub: [['/identite', 'Identité'], ['/facturation', 'Facturation'], ['/objectifs', 'Objectifs'], ['/listes', 'Listes'], ['/scripts', 'Scripts'], ['/rappels', 'Rappels'], ['/excel', 'Import / Export'], ['/compte', 'Compte']],
}
const lirePref = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || []
  } catch {
    return []
  }
}
// Ouvre ou ferme un élément du menu et s'en souvient sur cet appareil
function basculer(set, k, x) {
  set((l) => {
    const n = l.includes(x) ? l.filter((y) => y !== x) : [...l, x]
    try {
      localStorage.setItem(k, JSON.stringify(n))
    } catch {
      /* stockage indisponible : le menu reste ouvert pour la session */
    }
    return n
  })
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
  { path: 'saisie', short: 'Saisir', ico: 'plus', cta: true },
  { path: 'acquisition', short: 'Prospects', ico: 'target' },
  { path: 'clients', short: 'Clients', ico: 'briefcase' },
]
// Un champ de saisie a le focus : les raccourcis clavier ne s'appliquent pas
const enSaisie = (e) => {
  const t = e.target
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'apps'
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
  if (session === undefined) return <div className="login" />
  if (!session) return <Login />
  return <Crm />
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
  // Raccourcis : Ctrl/⌘ + K ou « / » pour la recherche, N pour une nouvelle action
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRecherche(true)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || enSaisie(e) || document.querySelector('.modal-bg')) return
      if (e.key === '/') {
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
  const [deplies, setDeplies] = useState(() => lirePref('crm-nav-deplies'))
  // Un onglet changé dans une page met à jour le sous-menu surligné
  const [, rafraichir] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    window.addEventListener('crm-onglet', rafraichir)
    return () => window.removeEventListener('crm-onglet', rafraichir)
  }, [])
  const [toast, toastNode] = useToast()
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

  // Précharge l'export Excel pour qu'il fonctionne aussi hors ligne
  useEffect(() => {
    if (isLocal || !navigator.onLine) return
    const t = setTimeout(() => {
      import('./lib/excel').catch(() => {})
      import('./lib/invoicePdf').catch(() => {})
      fetch(`${import.meta.env.BASE_URL}template/Agence_Elite_Pilotage.xlsx`).catch(() => {})
    }, 4000)
    return () => clearTimeout(t)
  }, [])

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
      toast(`Erreur : ${e.message}`, true)
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
    deleteProspect: wrap(async (id) => {
      await db.deleteProspect(id)
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
    deleteAction: wrap(async (id) => {
      await db.deleteAction(id)
      setState((s) => ({ ...s, actions: s.actions.filter((x) => x.id !== id) }))
    }),
    saveDoc: wrap(async (doc) => {
      const d = await db.saveDoc(doc)
      setState((s) => ({ ...s, documents: [...s.documents.filter((x) => x.id !== d.id), d] }))
      return d
    }),
    deleteDoc: wrap(async (id) => {
      await db.deleteDoc(id)
      setState((s) => ({ ...s, documents: s.documents.filter((x) => x.id !== id) }))
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
  if (!state) return <div className="login" />

  setDevise(state.settings.devise)
  setBrand(state.settings.apparence)
  const brand = state.settings.apparence || {}
  const avecNom = brand.afficherNom !== false
  const syncTxt = !sync.online
    ? `Hors ligne${sync.pending ? ` · ${sync.pending} modification${sync.pending > 1 ? 's' : ''} en attente` : ''}`
    : sync.syncing || sync.pending
      ? `Synchronisation… (${sync.pending})`
      : 'Synchronisé en ligne'
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
  else if (page === 'clients' || page === 'acquisition') content = <Hub key={route} espace={current === 'acquisition' ? 'acquisition' : 'clients'} onglet={q.get('onglet')} etape={q.get('etape')} vue={q.get('vue')} filtre={q.get('filtre')} nouveau={q.get('nouveau')} />
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
  // Sous-rubrique surlignée : le lien exact, sinon l'onglet affiché dans la page
  const sousActif = (n, h, cible) => {
    if (!n.memo) return route === cible
    const val = (x) => new URLSearchParams(x.slice(1)).values().next().value
    return current === n.path && (ongletActuel(n.memo) || val(n.sub[0][0])) === val(h)
  }
  // Sous-menus : ouverts sous la rubrique active, ou dépliés à la main (mémorisé)
  const navBtn = (n) => {
    const ouvert = n.sub && (current === n.path || deplies.includes(n.path))
    return (
      <div key={n.path} className={`nav-node ${ouvert ? 'open' : ''}`}>
        <div className="nav-row">
          <button className={`nav-item ${current === n.path ? 'active' : ''}`} onClick={() => go(`/${n.path}`)}>
            <span className="ico"><Icon n={n.ico} size={17} /></span>
            {n.label}
            {pastille(n.path)}
          </button>
          {n.sub && current !== n.path && (
            <button className="nav-caret" title={ouvert ? 'Replier' : 'Voir les sous-rubriques'} aria-expanded={!!ouvert} onClick={() => basculer(setDeplies, 'crm-nav-deplies', n.path)}>
              <Icon n="chevron" size={13} />
            </button>
          )}
        </div>
        {ouvert && (
          <div className="nav-sub">
            {n.sub.map(([h, l]) => {
              const cible = `${n.path}${h}`
              return (
                <button key={h} className={sousActif(n, h, cible) ? 'on' : ''} onClick={() => go(`/${cible}`)}>
                  {l}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
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
          <button className={`app-switch ${appli ? '' : 'on'}`} style={appli ? { '--c': appli.couleur } : undefined} onClick={() => go('/apps')} title="Toutes les applications">
            <span className="app-switch-ic">
              <Icon n={appli ? appli.ico : 'grid'} size={16} />
            </span>
            <span className="app-switch-nom">{appli ? appli.nom : 'Applications'}</span>
            <Icon n="grid" size={15} />
          </button>
          <button className="nav-search" onClick={() => setRecherche(true)} aria-keyshortcuts="Control+K Meta+K /">
            <Icon n="search" size={15} /> Rechercher… <kbd>{MAC ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <button className="nav-new" onClick={() => setActionModal({})} aria-keyshortcuts="N">
            <Icon n="plus" size={17} /> Nouvelle action <kbd>N</kbd>
          </button>
          <nav className="nav-scroll">
            {appli ? (
              (appli.groupes || [[`Menu ${appli.nom}`, appli.pages]]).map(([titre, pages]) => (
                <div key={titre || 'accueil'} className="nav-group">
                  {titre && <div className="nav-title">{titre}</div>}
                  {pages.map((x) => navBtn(ITEM[x]))}
                </div>
              ))
            ) : (
              <div className="nav-group">
                <div className="nav-title">Applications</div>
                {APPS.map((a) => (
                  <button key={a.id} className="nav-item nav-appli" style={{ '--c': a.couleur }} onClick={() => (a.lien ? window.open(a.lien, '_blank', 'noopener') : go(`/${a.route}`))}>
                    <span className="ico">
                      <Icon n={a.ico} size={13} />
                    </span>
                    {a.nom}
                    {pastille(a.pages.find((x) => badges[x]?.[0]))}
                  </button>
                ))}
              </div>
            )}
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
          {content}
        </main>
        <nav className="bottom-nav" aria-label="Navigation principale">
          {BOTTOM.map((n) => (
            <button key={n.path} className={`${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(`/${n.path}`)}>
              <span className="ico"><Icon n={n.ico} size={n.cta ? 22 : 20} /></span>
              {n.short}
              {!n.cta && pastille(n.path)}
            </button>
          ))}
        </nav>
      </div>
      {actionModal && (
        <Modal title={actionModal.edit ? "Modifier l'action" : 'Nouvelle action'} onClose={() => setActionModal(null)} large>
          <ActionForm prefill={actionModal} onDone={() => setActionModal(null)} />
        </Modal>
      )}
      {recherche && <Recherche onClose={() => setRecherche(false)} pages={[...NAV.flatMap((g) => g.items), PARAMETRES]} />}
      {toastNode}
    </AppCtx.Provider>
  )
}
