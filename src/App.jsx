import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppCtx, Modal, useToast, go } from './ui'
import { db, supabase, isLocal } from './lib/store'
import { computeAll } from './lib/logic'
import Login from './pages/Login'
import Journee from './pages/Journee'
import Saisie, { ActionForm } from './pages/Saisie'
import Prospects from './pages/Prospects'
import Fiche from './pages/Fiche'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Parametres from './pages/Parametres'

const NAV = [
  { path: 'journee', label: 'Ma journée', short: 'Journée', ico: '☀' },
  { path: 'prospects', label: 'Prospects', short: 'Prospects', ico: '👥' },
  { path: 'saisie', label: 'Saisir une action', short: 'Saisir', ico: '+', cta: true },
  { path: 'clients', label: 'Clients', short: 'Clients', ico: '🤝' },
  { path: 'dashboard', label: 'Tableau de bord', short: 'Stats', ico: '📊' },
  { path: 'parametres', label: 'Paramètres', short: 'Réglages', ico: '⚙' },
]

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
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
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
  const [toast, toastNode] = useToast()

  const reload = useCallback(async () => {
    try {
      setState(await db.load())
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
    return () => document.removeEventListener('visibilitychange', f)
  }, [reload])

  const data = useMemo(() => (state ? computeAll(state.prospects, state.actions, state.settings) : null), [state])

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
      setState((s) => ({ ...s, prospects: s.prospects.filter((x) => x.id !== id), actions: s.actions.filter((a) => a.prospect_id !== id) }))
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
    saveSettings: wrap(async (settings) => {
      await db.saveSettings(settings)
      setState((s) => ({ ...s, settings }))
    }),
    bulkImport: wrap(async (prospects, actions, replace) => {
      if (replace) await db.wipe()
      await db.bulkImport(prospects, actions)
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

  const ctx = {
    ...state,
    data,
    api,
    toast,
    openAction: (prefill) => setActionModal(prefill || {}),
  }

  const [page, arg] = route.split('/')
  const current = page === 'prospect' ? 'prospects' : page
  let content
  if (page === 'saisie') content = <Saisie key={route} prospectId={arg} />
  else if (page === 'prospects') content = <Prospects />
  else if (page === 'prospect') content = <Fiche key={arg} id={arg} />
  else if (page === 'dashboard') content = <Dashboard />
  else if (page === 'clients') content = <Clients />
  else if (page === 'parametres') content = <Parametres />
  else content = <Journee />

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">E</div>
            <div>
              <div className="brand-name">AGENCE ELITE</div>
              <div className="brand-sub">CRM de pilotage</div>
            </div>
          </div>
          {NAV.map((n) => (
            <button key={n.path} className={`nav-item ${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} onClick={() => go(`/${n.path}`)}>
              <span className="ico">{n.ico}</span>
              {n.label}
            </button>
          ))}
          <div className="sidebar-foot">{isLocal ? 'Mode démo : données dans ce navigateur' : 'Synchronisé en ligne'}</div>
        </aside>
        <main className="main">
          {isLocal && route.startsWith('journee') && (
            <div className="banner">Mode démo : les données restent dans ce navigateur. La version en ligne se branche sur Supabase.</div>
          )}
          {content}
        </main>
        <nav className="bottom-nav">
          {NAV.map((n) => (
            <button key={n.path} className={`${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} onClick={() => go(`/${n.path}`)}>
              <span className="ico">{n.ico}</span>
              {n.short}
            </button>
          ))}
        </nav>
      </div>
      {actionModal && (
        <Modal title="Saisir une action" onClose={() => setActionModal(null)}>
          <ActionForm prefill={actionModal} onDone={() => setActionModal(null)} />
        </Modal>
      )}
      {toastNode}
    </AppCtx.Provider>
  )
}
