import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Icon, Logo } from './icons'
import { AppCtx, Modal, useToast, go, setDevise, DEVISES, ongletActuel } from './ui'
import { db, supabase, isLocal, syncStatus, hasOfflineCache, flush, monProfil, setRoleDemo, ROLES, clearOffline } from './lib/store'
import { computeAll } from './lib/logic'
import { setBrand } from './lib/theme'
import { buildSeed, isExample, TAG } from './lib/seed'
import Login from './pages/Login'
import Journee from './pages/Journee'
import Saisie, { ActionForm } from './pages/Saisie'
import { MiniListe } from './pages/Prospects'
import Hub from './pages/Hub'
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
import { syncRappels } from './lib/rappels'
import Caisse from './pages/Caisse'
import Articles from './pages/Articles'
import Ventes from './pages/Ventes'
import Equipe from './pages/Equipe'
import { Menu } from './ui'
import { articlesDe, enAlerte } from './lib/magasin'

// Menu groupé : piloter, vendre, facturer
const NAV = [
  {
    titre: 'Pilotage',
    items: [
      { path: 'ventes', memo: 'ventes-periode', label: 'Tableau de bord', ico: 'chart', sub: [['?periode=jour', "Aujourd'hui"], ['?periode=7j', '7 jours'], ['?periode=mois', 'Ce mois']], roles: ['superadmin', 'pdg', 'comptable'] },
      { path: 'journal', label: 'Mes ventes du jour', ico: 'chart', roles: ['caisse'] },
    ],
  },
  {
    titre: 'Magasin',
    items: [
      { path: 'caisse', label: 'Caisse', ico: 'coins', roles: ['superadmin', 'pdg', 'caisse'] },
      { path: 'articles', label: 'Articles et stock', ico: 'layers' },
    ],
  },
  {
    titre: 'Finances',
    items: [
      {
        path: 'factures',
        memo: 'liste-facture',
        label: 'Factures',
        ico: 'file',
        sub: [['?filtre=toutes', 'Toutes'], ['?filtre=impayees', 'Impayées'], ['?filtre=retard', 'En retard'], ['?filtre=payees', 'Payées']],
      },
      { path: 'devis', memo: 'liste-devis', label: 'Devis / proforma', ico: 'clipboard', sub: [['?filtre=toutes', 'Tous'], ['?filtre=attente', 'En attente'], ['?filtre=acceptes', 'Acceptés'], ['?filtre=refuses', 'Refusés']] },
      { path: 'paiements', label: 'Paiements reçus', ico: 'wallet' },
      { path: 'depenses', label: 'Dépenses et sorties', ico: 'trend', roles: ['superadmin', 'pdg', 'comptable'] },
    ],
  },
]
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const PAGES = Object.fromEntries(NAV.flatMap((g) => g.items).map((n) => [n.path, n.label]))
PAGES.parametres = 'Paramètres'
const EQUIPE = { path: 'equipe', label: 'Équipe et accès', ico: 'users', roles: ['superadmin', 'pdg'] }
PAGES.equipe = EQUIPE.label
PAGES.journal = 'Mes ventes du jour'
const PARAMETRES = {
  path: 'parametres',
  roles: ['superadmin', 'pdg'],
  label: 'Paramètres',
  ico: 'settings',
  sub: [['/identite', 'Identité'], ['/facturation', 'Facturation'], ['/listes', 'Listes'], ['/excel', 'Import / Export'], ['/compte', 'Compte']],
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
PAGES.facture = 'Facture'
// Barre du bas sur téléphone : Ventes, Articles, Caisse (au centre), Factures, Réglages
const BOTTOM = [
  { path: 'ventes', short: 'Ventes', ico: 'chart', roles: ['superadmin', 'pdg', 'comptable'] },
  { path: 'journal', short: 'Ventes', ico: 'chart', roles: ['caisse'] },
  { path: 'articles', short: 'Articles', ico: 'layers' },
  { path: 'caisse', short: 'Caisse', ico: 'plus', cta: true, roles: ['superadmin', 'pdg', 'caisse'] },
  { path: 'factures', short: 'Factures', ico: 'file' },
  { path: 'parametres', short: 'Réglages', ico: 'settings', roles: ['superadmin', 'pdg'] },
  { path: 'paiements', short: 'Paiements', ico: 'wallet', roles: ['caisse', 'comptable'] },
]
const permis = (n, role) => !n.roles || n.roles.includes(role)
// Un champ de saisie a le focus : les raccourcis clavier ne s'appliquent pas
const enSaisie = (e) => {
  const t = e.target
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'ventes'
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
  const [profil, setProfil] = useState(null)
  useEffect(() => {
    monProfil().then(setProfil).catch(() => setProfil({ role: null }))
  }, [])
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
        go('/caisse')
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  // Menu « Plus » du téléphone : se referme dès qu'on change de page
  const [plusSur, setPlusSur] = useState(null)
  const [deplies, setDeplies] = useState(() => lirePref('crm-nav-deplies'))
  // Un onglet changé dans une page met à jour le sous-menu surligné
  const [, rafraichir] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    window.addEventListener('crm-onglet', rafraichir)
    return () => window.removeEventListener('crm-onglet', rafraichir)
  }, [])
  const [replies, setReplies] = useState(() => lirePref('crm-nav-replies'))
  const plus = plusSur === route
  const setPlus = (v) => setPlusSur(v ? route : null)
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
  if (!state || !profil) return <div className="login" />
  if (!profil.role)
    return (
      <div className="login">
        <div className="card stack">
          <h2>Accès en attente</h2>
          <p className="muted">Ce compte ({profil.email}) n'a pas encore de rôle. Demande à l'administrateur de t'ajouter dans Équipe et accès.</p>
          <button className="btn" onClick={async () => { clearOffline(); await supabase?.auth.signOut() }}>Se déconnecter</button>
        </div>
      </div>
    )
  const role = profil.role
  const accueil = role === 'caisse' ? 'caisse' : 'ventes'

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
    profil,
  }

  const [chemin, query = ''] = route.split('?')
  const tousItems = [...NAV.flatMap((g) => g.items), EQUIPE, PARAMETRES]
  const pageDemandee = chemin.split('/')[0] || accueil
  const interdite = tousItems.find((n) => n.path === pageDemandee && !permis(n, role))
  const [page, arg = ''] = (interdite || !chemin ? accueil : chemin).split(/\/(.*)/s)
  const q = new URLSearchParams(query)
  const docType = page === 'facture' ? state.documents.find((d) => d.id === arg)?.type || new URLSearchParams(query).get('type') : null
  const current = page === 'prospect' || page === 'prospects' ? 'clients' : page === 'facture' ? (docType === 'devis' ? 'devis' : 'factures') : page
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
  else if (page === 'clients') content = <Hub key={route} onglet={q.get('onglet')} etape={q.get('etape')} vue={q.get('vue')} filtre={q.get('filtre')} nouveau={q.get('nouveau')} />
  else if (page === 'parametres') content = <Parametres section={arg} />
  else if (page === 'session') content = <Session />
  else if (page === 'scripts') content = <Scripts />
  else if (page === 'calendrier') content = <Calendrier />
  else if (page === 'factures' || page === 'devis') content = <Factures key={route} type={page === 'devis' ? 'devis' : 'facture'} filtre={q.get('filtre')} />
  else if (page === 'paiements') content = <Paiements />
  else if (page === 'depenses') content = <Depenses />
  else if (page === 'facture') content = <DocEditor key={route} id={arg} query={query} />
  else if (page === 'caisse') content = <Caisse />
  else if (page === 'articles') content = <Articles />
  else if (page === 'dashboard') content = <Dashboard key={route} onglet={q.get('onglet')} />
  else if (page === 'equipe') content = <Equipe />
  else if (page === 'journal') content = <Ventes key={route} caisse />
  else content = <Ventes key={route} periode={q.get('periode')} />
  // Pastilles du menu : ce qui attend une action dans chaque rubrique
  const retards = facturesImpayees(state.documents || [], state.actions).filter((d) => d.statut === 'En retard').length
  const devisAttente = (state.documents || []).filter((d) => d.type === 'devis' && !d.data?.factureNumero && !['Accepté', 'Refusé'].includes(d.data?.statut) && !(d.data?.validite && d.data.validite < new Date().toISOString().slice(0, 10))).length
  const badges = {
    journee: [data.aRelancer.length, 'hot', 'relances à faire'],
    clients: [data.clientsAlertes.length, '', 'clients à surveiller'],
    articles: [articlesDe(state.documents || []).filter(enAlerte).length, 'hot', 'articles à réapprovisionner'],
    factures: [retards, 'hot', 'factures en retard'],
    devis: [devisAttente, '', 'devis en attente'],
  }
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
          <button className="nav-search" onClick={() => setRecherche(true)} aria-keyshortcuts="Control+K Meta+K /">
            <Icon n="search" size={15} /> Rechercher… <kbd>{MAC ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {permis({ roles: ['superadmin', 'pdg', 'caisse'] }, role) && (
            <button className="nav-new" onClick={() => go('/caisse')} aria-keyshortcuts="N">
              <Icon n="plus" size={17} /> Nouvelle vente <kbd>N</kbd>
            </button>
          )}
          <nav className="nav-scroll">
            {NAV.filter((g) => g.items.some((n) => permis(n, role))).map((g, i) => {
              const replie = g.titre && replies.includes(g.titre) && !g.items.some((n) => n.path === current)
              return (
                <div key={i} className={`nav-group ${replie ? 'replie' : ''}`}>
                  {g.titre && (
                    <button className="nav-title" aria-expanded={!replie} onClick={() => basculer(setReplies, 'crm-nav-replies', g.titre)}>
                      {g.titre}
                      <Icon n="chevron" size={11} />
                    </button>
                  )}
                  {!replie && g.items.filter((n) => permis(n, role)).map(navBtn)}
                </div>
              )
            })}
          </nav>
          {permis(PARAMETRES, role) && (
            <div className="nav-group nav-admin">
              <div className="nav-title">Administration</div>
              {navBtn(EQUIPE)}
              {navBtn(PARAMETRES)}
            </div>
          )}
          <div className={`sidebar-foot ${syncCls}`}>{isLocal ? 'Mode démo : données dans ce navigateur' : syncTxt}</div>
        </aside>
        <main className="main">
          <header className="mobile-top">
            <Logo size={32} />
            <div style={{ minWidth: 0 }}>
              {avecNom && <div className="brand-name">{brand.nom}</div>}
              <div className="brand-sub">{PAGES[current] || brand.sousTitre}</div>
            </div>
            <button className="icon-btn mobile-settings" aria-label="Rechercher" onClick={() => setRecherche(true)}>
              <Icon n="search" size={18} />
            </button>
            <button className={`icon-btn mobile-settings mobile-gear ${plus ? 'on' : ''}`} aria-label="Toutes les pages" aria-expanded={plus} onClick={() => setPlus(!plus)}>
              <Icon n="grid" size={18} />
            </button>
          </header>
          <header className="topbar">
            <button className="tb-search" onClick={() => setRecherche(true)}>
              <Icon n="search" size={15} /> Rechercher une facture, un article…
            </button>
            <div className="tb-org">{state.settings.facturation?.nom || brand.nom}</div>
            {permis({ roles: ['superadmin', 'pdg', 'caisse'] }, role) && (
              <button className="btn primary sm tb-new" onClick={() => go('/caisse')}>
                <Icon n="plus" size={15} /> Nouvelle vente
              </button>
            )}
            <Menu
              className="tb-user"
              icon="chevron"
              label={
                <>
                  <span className="tb-av">{(profil.nom || profil.email || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <span className="tb-who">
                    <span className="tb-nom">{profil.nom || profil.email}</span>
                    <span className="tb-role">{ROLES[role]}</span>
                  </span>
                </>
              }
              items={[
                ...(isLocal
                  ? Object.entries(ROLES).map(([r, l]) => ({ label: `Voir en tant que : ${l}`, icon: r === role ? 'check' : 'users', onClick: () => { setRoleDemo(r); window.location.hash = '/'; window.location.reload() } }))
                  : [{ label: 'Se déconnecter', icon: 'logout', onClick: async () => { clearOffline(); await supabase.auth.signOut() } }]),
              ]}
            />
          </header>
          {!isLocal && (!sync.online || sync.pending > 0 || sync.error) && (
            <div className={`sync-banner ${syncCls}`}>
              <span className="dot" />
              {sync.error || syncTxt}
              {!sync.online && <span className="muted"> · tes saisies partiront dès le retour d'internet</span>}
            </div>
          )}
          {isLocal && (route === '' || route.startsWith('ventes')) && (
            <div className="banner">Mode démo : les données restent dans ce navigateur. La version en ligne se branche sur Supabase.</div>
          )}
          {content}
        </main>
        <nav className="bottom-nav" aria-label="Navigation principale">
          {BOTTOM.filter((n) => permis(n, role)).map((n) => (
            <button key={n.path} className={`${n.cta ? 'cta' : ''} ${current === n.path ? 'active' : ''}`} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(`/${n.path}`)}>
              <span className="ico"><Icon n={n.ico} size={n.cta ? 22 : 20} /></span>
              {n.short}
              {!n.cta && pastille(n.path)}
            </button>
          ))}
        </nav>
        {plus && (
          <div className="sheet-bg" onClick={() => setPlus(false)}>
            <div className="sheet" role="dialog" aria-label="Toutes les pages" onClick={(e) => e.stopPropagation()}>
              {[...NAV, { titre: 'Administration', items: [EQUIPE, PARAMETRES] }].map((g) => ({ ...g, items: g.items.filter((n) => permis(n, role)) })).filter((g) => g.items.length).map((g) => (
                <div key={g.titre} className="sheet-group">
                  <div className="nav-title">{g.titre}</div>
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
            </div>
          </div>
        )}
      </div>
      {actionModal && (
        <Modal title={actionModal.edit ? "Modifier l'action" : 'Nouvelle action'} onClose={() => setActionModal(null)} large>
          <ActionForm prefill={actionModal} onDone={() => setActionModal(null)} />
        </Modal>
      )}
      {recherche && <Recherche onClose={() => setRecherche(false)} pages={tousItems.filter((n) => permis(n, role))} />}
      {toastNode}
    </AppCtx.Provider>
  )
}
