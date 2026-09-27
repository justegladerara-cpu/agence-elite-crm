import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Logo } from './icons'
import { AppCtx, Modal, useToast, go, setDevise, DEVISES } from './ui'
import { db, supabase, isLocal, syncStatus, hasOfflineCache, flush } from './lib/store'
import { computeAll } from './lib/logic'
import { setBrand } from './lib/theme'
import { buildSeed, isExample, TAG } from './lib/seed'
import Login from './pages/Login'
import Journee from './pages/Journee'
import Saisie, { ActionForm } from './pages/Saisie'
import Prospects, { MiniListe } from './pages/Prospects'
import Fiche from './pages/Fiche'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Parametres from './pages/Parametres'
import Session from './pages/Session'
import Factures, { DocEditor, facturesImpayees } from './pages/Factures'
import { Paiements, Depenses } from './pages/Finances'
import Scripts from './pages/Scripts'
import Recherche from './pages/Recherche'
import Calendrier from './pages/Calendrier'
import { syncRappels } from './lib/rappels'

// Menu groupé (façon Zoho) : le tableau de bord d'abord
const NAV = [
  {
    items: [
      { path: 'dashboard', label: 'Tableau de bord', ico: 'chart' },
      { path: 'journee', label: 'Ma journée', ico: 'sun' },
      { path: 'calendrier', label: 'Calendrier', ico: 'calendar' },
    ],
  },
  {
    titre: 'Prospection',
    items: [
      { path: 'prospects', label: 'Prospects', ico: 'users' },
      { path: 'session', label: "Session d'appels", ico: 'phone' },
      { path: 'scripts', label: 'Scripts', ico: 'message' },
    ],
  },
  {
    titre: 'Ventes',
    items: [
      { path: 'clients', label: 'Clients', ico: 'handshake' },
      { path: 'devis', label: 'Devis', ico: 'clipboard' },
      { path: 'factures', label: 'Factures', ico: 'file' },
      { path: 'paiements', label: 'Paiements reçus', ico: 'coins' },
    ],
  },
  { titre: 'Achats', items: [{ path: 'depenses', label: 'Dépenses', ico: 'wallet' }] },
]
const PAGES = Object.fromEntries(NAV.flatMap((g) => g.items).map((n) => [n.path, n.label]))
PAGES.parametres = 'Paramètres'
PAGES.saisie = 'Saisir une action'
// Barre du bas sur téléphone : 5 boutons, le reste dans « Plus »
const BOTTOM = [
  { path: 'dashboard', short: 'Accueil', ico: 'chart' },
  { path: 'journee', short: 'Journée', ico: 'sun' },
  { path: 'saisie', short: 'Saisir', ico: 'plus', cta: true },
  { path: 'prospects', short: 'Prospects', ico: 'users' },
]

function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard'
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
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [recherche, setRecherche] = useState(false)
  // Ctrl + K (ou Cmd + K) : recherche globale
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRecherche(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  // Menu « Plus » du téléphone : se referme dès qu'on change de page
  const [plusSur, setPlusSur] = useState(null)
  const plus = plusSur === route
  const setPlus = (v) => setPlusSur(v ? route : null)
  const [toast, toastNode] = useToast()
  const [sync, setSync] = useState(syncStatus.get())
  useEffect(() => syncStatus.subscribe(setSync), [])

  const reload = useCallback(async () => {
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
          <button className="btn primary" onClick={reload}>
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

  const [page, argFull = ''] = route.split(/\/(.*)/s)
  const [arg, query = ''] = argFull.split('?')
  const docType = page === 'facture' ? state.documents.find((d) => d.id === arg)?.type || new URLSearchParams(query).get('type') : null
  const current =
    page === 'prospect' ? (data.clients.some((c) => c.id === arg) ? 'clients' : 'prospects') : page === 'facture' ? (docType === 'devis' ? 'devis' : 'factures') : page
  let content
  if (page === 'saisie') content = <Saisie key={route} prospectId={arg} />
  else if (page === 'prospects') content = <Prospects />
  else if (page === 'prospect')
    content = (
      <div className="split">
        <MiniListe current={arg} />
        <div className="split-main">
          <Fiche key={arg} id={arg} />
        </div>
      </div>
    )
  else if (page === 'journee') content = <Journee />
  else if (page === 'clients') content = <Clients />
  else if (page === 'parametres') content = <Parametres section={arg} />
  else if (page === 'session') content = <Session />
  else if (page === 'scripts') content = <Scripts />
  else if (page === 'calendrier') content = <Calendrier />
  else if (page === 'factures' || page === 'devis') content = <Factures key={page} type={page === 'devis' ? 'devis' : 'facture'} />
  else if (page === 'paiements') content = <Paiements />
  else if (page === 'depenses') content = <Depenses />
  else if (page === 'facture') content = <DocEditor key={route} id={arg} query={query} />
  else content = <Dashboard />
  // Pastilles du menu : ce qui attend une action dans chaque rubrique
  const retards = facturesImpayees(state.documents || [], state.actions).filter((d) => d.statut === 'En retard').length
  const devisAttente = (state.documents || []).filter((d) => d.type === 'devis' && !d.data?.factureNumero && !['Accepté', 'Refusé'].includes(d.data?.statut) && !(d.data?.validite && d.data.validite < new Date().toISOString().slice(0, 10))).length
  const badges = {
    journee: [data.aRelancer.length, 'hot', 'relances à faire'],
    clients: [data.clientsAlertes.length, 'hot', 'clients à surveiller'],
    factures: [retards, 'hot', 'factures en retard'],
    devis: [devisAttente, '', 'devis en attente'],
    prospects: [data.list.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu').length, '', 'prospects actifs'],
  }
  const pastille = (path) => {
    const [n, cls, t] = badges[path] || []
    return n ? (
      <span className={`nav-badge ${cls}`} title={`${n} ${t}`}>
        {n}
      </span>
    ) : null
  }
  const navBtn = (n) => (
    <button key={n.path} className={`nav-item ${current === n.path ? 'active' : ''}`} onClick={() => go(`/${n.path}`)}>
      <span className="ico"><Icon n={n.ico} size={17} /></span>
      {n.label}
      {pastille(n.path)}
    </button>
  )

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
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
          <button className="nav-search" onClick={() => setRecherche(true)}>
            <Icon n="search" size={15} /> Rechercher… <kbd>Ctrl K</kbd>
          </button>
          <button className="nav-new" onClick={() => go('/saisie')}>
            <Icon n="plus" size={17} /> Saisir une action
          </button>
          <nav className="nav-scroll">
            {NAV.map((g, i) => (
              <div key={i} className="nav-group">
                {g.titre && <div className="nav-title">{g.titre}</div>}
                {g.items.map(navBtn)}
              </div>
            ))}
          </nav>
          {navBtn({ path: 'parametres', label: 'Paramètres', ico: 'settings' })}
          <div className={`sidebar-foot ${syncCls}`}>{isLocal ? 'Mode démo : données dans ce navigateur' : syncTxt}</div>
        </aside>
        <main className="main">
          <header className="mobile-top">
            <Logo size={32} />
            <div style={{ minWidth: 0 }}>
              {avecNom && <div className="brand-name">{brand.nom}</div>}
              <div className="brand-sub">{PAGES[current] || brand.sousTitre}</div>
            </div>
            <button className="icon-btn mobile-settings" title="Rechercher" onClick={() => setRecherche(true)}>
              <Icon n="search" size={18} />
            </button>
            <button className={`icon-btn mobile-settings mobile-gear ${current === 'parametres' ? 'on' : ''}`} title="Paramètres" onClick={() => go('/parametres')}>
              <Icon n="settings" size={18} />
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
          {content}
        </main>
        <nav className="bottom-nav">
          {BOTTOM.map((n) => (
            <button key={n.path} className={`${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} onClick={() => go(`/${n.path}`)}>
              <span className="ico"><Icon n={n.ico} size={n.cta ? 20 : 19} /></span>
              {n.short}
              {!n.cta && n.path === 'journee' && pastille('journee')}
            </button>
          ))}
          <button className={plus || !BOTTOM.some((n) => n.path === current) ? 'active' : ''} onClick={() => setPlus(!plus)}>
            <span className="ico"><Icon n="menu" size={19} /></span>
            Plus
          </button>
        </nav>
        {plus && (
          <div className="sheet-bg" onClick={() => setPlus(false)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              {NAV.map((g) => ({ ...g, items: g.items.filter((n) => !BOTTOM.some((b) => b.path === n.path)) })).filter((g) => g.items.length).map((g) => (
                <div key={g.titre || 'pilotage'} className="sheet-group">
                  <div className="nav-title">{g.titre || 'Pilotage'}</div>
                  <div className="sheet-grid">
                    {g.items.map((n) => (
                      <button key={n.path} className={current === n.path ? 'on' : ''} onClick={() => go(`/${n.path}`)}>
                        <Icon n={n.ico} size={20} />
                        {n.label}
                        {pastille(n.path)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sheet-group">
                <div className="sheet-grid">
                  <button className={current === 'parametres' ? 'on' : ''} onClick={() => go('/parametres')}>
                    <Icon n="settings" size={20} />
                    Paramètres
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {actionModal && (
        <Modal title="Saisir une action" onClose={() => setActionModal(null)}>
          <ActionForm prefill={actionModal} onDone={() => setActionModal(null)} />
        </Modal>
      )}
      {recherche && <Recherche onClose={() => setRecherche(false)} />}
      {toastNode}
    </AppCtx.Provider>
  )
}
