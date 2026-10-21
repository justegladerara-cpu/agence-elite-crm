import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Logo } from './icons'
import { Modal, useToast, go, setDevise, DEVISES, ConfirmHost, GardeErreur } from './ui'
import { db, supabase, isLocal, syncStatus, hasOfflineCache, flush, roleActif, moiActif } from './lib/store'
import { refusDe, ROLES } from './core/permissions'
import { computeAll, appelEnCours, oublierAppel, pastillesCommercial } from './modules/commercial'
import { setBrand } from './lib/theme'
import { buildSeed, isExample, TAG } from './lib/seed'
import Login from './pages/Login'
import { extraireJeton, ouvrirPorte, porteOuverte, verifierJeton } from './lib/porte'
import { sessionValide } from './modules/plateforme'
import { ConnexionPlateforme } from './modules/plateforme/ui'
import Journee from './pages/Journee'
import Saisie, { ActionForm } from './pages/Saisie'
import { MiniListe } from './pages/Prospects'
import Hub, { ESPACES } from './pages/Hub'
import { lienHub } from './modules/commercial'
const Fiche = lazy(() => import('./pages/Fiche'))
const SaisieArgent = lazy(() => import('./pages/Finances').then((m) => ({ default: m.SaisieArgent })))
const ARGENT = { 'Paiement reçu': 'paiement', Dépense: 'depense' }
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminSaaS = lazy(() => import('./pages/AdminSaaS'))
const Parametres = lazy(() => import('./pages/Parametres'))
const Session = lazy(() => import('./pages/Session'))
import { statutDe, pastillesFacturation } from './modules/facturation'
const Factures = lazy(() => import('./pages/Factures'))
const DocEditor = lazy(() => import('./pages/Factures').then((m) => ({ default: m.DocEditor })))
const Paiements = lazy(() => import('./pages/Finances').then((m) => ({ default: m.Paiements })))
const Depenses = lazy(() => import('./pages/Finances').then((m) => ({ default: m.Depenses })))
const ChargesVue = lazy(() => import('./pages/Charges').then((m) => ({ default: m.ChargesVue })))
const Abonnements = lazy(() => import('./pages/Charges').then((m) => ({ default: m.Abonnements })))
const Scripts = lazy(() => import('./pages/Scripts'))
const Documents = lazy(() => import('./pages/Documents'))
const Recherche = lazy(() => import('./pages/Recherche'))
const Calendrier = lazy(() => import('./pages/Calendrier'))
const Boutique = lazy(() => import('./pages/Boutique'))
const SiteVue = lazy(() => import('./pages/SiteWeb').then((m) => ({ default: m.SiteVue })))
const SiteDemandes = lazy(() => import('./pages/SiteWeb').then((m) => ({ default: m.SiteDemandes })))
const SitePages = lazy(() => import('./pages/SiteWeb').then((m) => ({ default: m.SitePages })))
const SitePhotos = lazy(() => import('./pages/SiteWeb').then((m) => ({ default: m.SitePhotos })))
const Controle = lazy(() => import('./pages/Plateforme').then((m) => ({ default: m.Controle })))
const Operations = lazy(() => import('./pages/Plateforme').then((m) => ({ default: m.Operations })))
const ClientsPlateforme = lazy(() => import('./pages/Plateforme').then((m) => ({ default: m.ClientsPlateforme })))
const FichePlateforme = lazy(() => import('./pages/Plateforme').then((m) => ({ default: m.FichePlateforme })))
import Applications from './pages/Applications'
import { BAS, LIBELLES, cleDePage, espaceDe, espacesActifs, pagesRecherche, redirection, entreeDe } from './navigation'
import { syncRappels } from './lib/rappels'
import { QuickForm, AppelSheet } from './pages/Rapide'
import { corbeille } from './lib/corbeille'
import { telechargerSauvegarde } from './lib/sauvegarde'
import { remplacerDonnees } from './lib/remplacer'
import { messageErreur, installerSuiviErreurs } from './lib/erreurs'
import Raccourcis from './pages/Raccourcis'
import { NoyauCtx, DonneesCtx } from './core/contexte'
import { pageAccessible, moduleDePage, estActif, sectionAccessible } from './core/modules'
import { emettre, evenementDAction, evenementDeDocument } from './core/events'

installerSuiviErreurs()

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
// Sections du tableau de bord ; les anciens noms d'onglets mènent au nouvel équivalent
const ONGLET_DASH = { vue: 'vue', acquisition: 'acquisition', conversion: 'conversion', finances: 'finances', prospection: 'acquisition', marche: 'acquisition', ventes: 'finances', clients: 'finances' }
// Pastilles fournies par les modules (App est le seul endroit qui les assemble)
const PASTILLES = { commercial: pastillesCommercial, facturation: pastillesFacturation }
// Entrée de menu visible : module actif (Paramètres › Modules) et section de réglages accessible
const accessibleAvec = (settings) => (route, entree = {}) => {
  const page = route.split('/')[0]
  if (!pageAccessible(page, settings)) return false
  if (entree.module && settings?.modules?.[entree.module] === false) return false
  return !route.startsWith('parametres/') || sectionAccessible(route.slice(11), settings)
}
// Page d'un module désactivé : ses données sont gardées, il suffit de le réactiver
function ModuleInactif({ nom }) {
  return (
    <div className="card empty" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
      <h2 className="section" style={{ justifyContent: 'center' }}>Module « {nom} » désactivé</h2>
      <p className="small muted">Ses données sont conservées. Réactive-le pour retrouver ses pages.</p>
      <button className="btn primary" onClick={() => go('/parametres/modules')}>
        Gérer les modules
      </button>
    </div>
  )
}
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
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'controle'
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

// Porte unique : le CRM s'ouvre avec le compte super admin de la plateforme (centre d'administration Agence Elite).
// La connexion reste active sur cet appareil ; la porte se rouvre seule tant que cette connexion est valable.
function PorteFermee({ onOuverte }) {
  return (
    <div className="login">
      <div className="stack" style={{ width: 'min(420px, 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <Logo full />
        </div>
        <ConnexionPlateforme
          titre="Centre d'administration Agence Elite"
          onConnecte={() => {
            ouvrirPorte()
            onOuverte()
          }}
        />
      </div>
    </div>
  )
}

// La porte se rouvre seulement si la session plateforme est toujours valable (vérifiée à chaque ouverture) ;
// l'autorisation de 12 h ne sert plus que hors ligne. Se déconnecter ferme la porte (SEC-06).
const etatPorteInitial = () => {
  if (isLocal) return 'ok'
  if (/^#porte=/.test(window.location.hash)) return 'verif'
  if (typeof navigator !== 'undefined' && navigator.onLine === false && porteOuverte()) return 'ok'
  return 'session'
}

export default function App() {
  const [porte, setPorte] = useState(etatPorteInitial)
  useEffect(() => {
    if (isLocal) return
    const jeton = extraireJeton()
    if (!jeton) return
    verifierJeton(jeton).then((ok) => setPorte(ok || porteOuverte() ? 'ok' : 'ferme'))
  }, [])
  // Connexion plateforme encore valable sur cet appareil : la porte se rouvre sans rien demander
  useEffect(() => {
    if (porte !== 'session') return
    sessionValide().then((ok) => {
      if (ok) ouvrirPorte()
      setPorte(ok ? 'ok' : 'ferme')
    })
  }, [porte])
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
  if (porte === 'verif' || porte === 'session') return <Attente />
  if (porte === 'ferme') return <PorteFermee onOuverte={() => setPorte('ok')} />
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
    // Anciennes adresses (boîte à outils, applications, éditeur sans page) : leur nouvelle place dans les 6 espaces
    const cible = redirection(route)
    if (cible) window.location.replace(`#/${cible}`)
  }, [route])
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  // Saisie ou modification d'un paiement / d'une dépense, demandée par n'importe quel module
  const [argent, setArgent] = useState(null)
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
  // La recherche Ctrl K est chargée à l'avance, quand le navigateur est libre, puis affichée sans passer par
  // Suspense (qui retarde un premier affichage d'environ 300 ms) : elle s'ouvre en moins de 300 ms
  const [RechercheChargee, setRechercheChargee] = useState(null)
  useEffect(() => {
    const charger = () =>
      import('./pages/Recherche')
        .then((m) => setRechercheChargee(() => m.default))
        .catch(() => {})
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(charger, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const t = setTimeout(charger, 1500)
    return () => clearTimeout(t)
  }, [])
  // Raccourcis : Ctrl/⌘ + K ou « / » pour la recherche, N pour une nouvelle action, ? pour l'aide, G puis une lettre pour naviguer
  useEffect(() => {
    let g = 0
    const ALLER = { j: 'journee', p: 'acquisition', c: 'clients', f: 'factures', d: 'dashboard', a: 'espace', s: 'session', t: 'controle' }
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
  // { id: true | false } : choix fait à la main ; sans choix, seule la rubrique de la page affichée est ouverte
  const [ouverts, setOuverts] = useState({})
  const [sync, setSync] = useState(syncStatus.get())
  // Tableau de bord en direct : heure du dernier chargement et abonnement aux changements Supabase
  const [majLe, setMajLe] = useState(null)
  const [direct, setDirect] = useState(false)
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
      setMajLe(Date.now())
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

  // Changements poussés par Supabase (autre appareil, formulaire du site) : rechargement groupé
  useEffect(() => {
    if (!supabase || isLocal) return
    let minuteur
    const plusTard = () => {
      clearTimeout(minuteur)
      // Modifications locales encore en cours d'envoi : on attend qu'elles partent pour ne rien écraser
      minuteur = setTimeout(() => !syncStatus.get().pending && reload(), 1200)
    }
    const canal = ['actions', 'prospects', 'documents'].reduce((c, table) => c.on('postgres_changes', { event: '*', schema: 'public', table }, plusTard), supabase.channel('crm-direct'))
    canal.subscribe((etat) => setDirect(etat === 'SUBSCRIBED'))
    return () => {
      clearTimeout(minuteur)
      setDirect(false)
      supabase.removeChannel(canal)
    }
  }, [reload])

  // Les modules PDF et Excel ne sont plus préchargés au démarrage : ils se chargent à la première utilisation

  const data = useMemo(() => (state ? computeAll(state.prospects, state.actions, state.settings) : null), [state])

  // Rappels sur le téléphone : la liste à venir est envoyée au service quelques secondes après chaque changement
  useEffect(() => {
    if (!data || !state.settings.rappels?.actif) return
    const t = setTimeout(() => syncRappels(data, state.settings, state.documents || [], state.actions, statutDe).catch(() => {}), 3000)
    return () => clearTimeout(t)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Droits du rôle dans l'espace actif, vérifiés avant l'envoi (la base refuse aussi, mais parfois sans erreur visible)
  const garde = (op, auteur) => {
    const m = refusDe(roleActif(), op, auteur, moiActif())
    if (m) throw Object.assign(new Error(m), { droits: true })
  }
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
      garde('ecrire')
      const p = await db.addProspect(name, fiche)
      setState((s) => ({ ...s, prospects: [...s.prospects, p] }))
      return p
    }),
    updateProspect: wrap(async (id, patch) => {
      garde('ecrire')
      const p = await db.updateProspect(id, patch)
      setState((s) => ({ ...s, prospects: s.prospects.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
      return p
    }),
    deleteProspect: wrap(async (id, opts = {}) => {
      const avant = state.prospects.find((x) => x.id === id)
      garde('supprimer', avant?.user_id)
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
      garde('ecrire')
      const rows = await db.addActions(list)
      setState((s) => ({ ...s, actions: [...s.actions, ...rows] }))
      rows.forEach((r) => emettre(evenementDAction(r)))
      return rows
    }),
    updateAction: wrap(async (id, patch) => {
      garde('ecrire')
      const a = await db.updateAction(id, patch)
      setState((s) => ({ ...s, actions: s.actions.map((x) => (x.id === id ? { ...x, ...a } : x)) }))
      return a
    }),
    deleteAction: wrap(async (id, opts = {}) => {
      const avant = state.actions.find((x) => x.id === id)
      garde('supprimer', avant?.user_id)
      await db.deleteAction(id)
      if (avant && !opts.silencieux) {
        const cid = corbeille.ajouter('action', `${avant.action || 'Action'} du ${avant.date || ''}`, { actions: [avant] })
        toast(`${avant.action || 'Action'} supprimée ✓`, false, { annuler: () => api.restaurer(cid) })
      }
      setState((s) => ({ ...s, actions: s.actions.filter((x) => x.id !== id) }))
    }),
    saveDoc: wrap(async (doc) => {
      garde('ecrire')
      const d = await db.saveDoc(doc)
      const nouveau = !state.documents.some((x) => x.id === d.id)
      setState((s) => ({ ...s, documents: [...s.documents.filter((x) => x.id !== d.id), d] }))
      if (nouveau) emettre(evenementDeDocument(d))
      return d
    }),
    deleteDoc: wrap(async (id, opts = {}) => {
      const avant = state.documents.find((x) => x.id === id)
      garde('supprimer', avant?.user_id)
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
      garde('ecrire')
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
    // Restaurer une sauvegarde (SEC-11) : remet les lignes du fichier avec leurs identifiants d'origine.
    // Rien n'est effacé : une ligne déjà présente (même identifiant) reprend la valeur de la sauvegarde.
    restaurerSauvegarde: wrap(async (contenu) => {
      garde('remplacer')
      await db.restaurer(contenu)
      await reload()
      toast(`Sauvegarde restaurée ✓ (${contenu.prospects.length} fiches, ${contenu.actions.length} actions, ${contenu.documents.length} documents)`)
    }),
    uploadRecu: wrap(async (dataUrl, ext, type) => {
      garde('ecrire')
      return db.uploadRecu(dataUrl, ext, type)
    }),
    recuUrl: (path) => db.recuUrl(path),
    numeroLibre: async (type, numero, id) => (db.numeroLibre ? db.numeroLibre(type, numero, id) : true),
    saveSettings: wrap(async (settings) => {
      garde('reglages')
      await db.saveSettings(settings)
      setState((s) => ({ ...s, settings }))
    }),
    // Remplacer (SEC-02) : sauvegarde téléchargée d'abord, puis les nouvelles lignes sont ajoutées, et seulement
    // si tout est passé, les anciennes sont retirées une par une (par identifiant). Un échec à l'ajout retire ce qui
    // vient d'être ajouté : les données d'avant restent intactes. Les anciennes lignes vont dans la corbeille.
    bulkImport: wrap(async (prospects, actions, replace) => {
      garde(replace ? 'remplacer' : 'ecrire')
      if (!replace) {
        await db.bulkImport(prospects, actions)
        return reload()
      }
      const avant = { prospects: state.prospects, actions: state.actions }
      telechargerSauvegarde(state)
      try {
        await remplacerDonnees(db, avant, prospects, actions)
      } catch (e) {
        await reload().catch(() => {})
        throw e
      }
      const cid = corbeille.ajouter('import', `Données remplacées par un import (${avant.prospects.length} prospects, ${avant.actions.length} actions)`, avant)
      await reload()
      if (cid) toast('Données remplacées ✓ · les anciennes sont dans la corbeille', false, { annuler: () => api.restaurer(cid) })
    }),
    loadSeed: wrap(async () => {
      garde('ecrire')
      const { prospects, actions: raw } = buildSeed()
      // Montants d'exemple (en euros) convertis dans la devise choisie
      const k = (DEVISES.find((d) => d.code === state.settings.devise) || DEVISES.find((x) => x.code === 'EUR')).parEuro
      const actions = raw.map((a) => (a.montant ? { ...a, montant: Math.round((a.montant * k) / 50) * 50 || a.montant } : a))
      await db.bulkImport(prospects, actions)
      await reload()
    }),
    clearSeed: wrap(async () => {
      garde('remplacer')
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
  const { settings, ...donneesEtat } = state
  const noyau = {
    settings,
    api,
    toast,
    // Rôle sans droit d'écriture (SEC-10) : la saisie ne s'ouvre pas, un message explique pourquoi
    openAction: (prefill) => {
      const refus = refusDe(roleActif(), 'ecrire')
      if (refus) return toast(refus, true)
      setActionModal(prefill || {})
    },
    saisirArgent: (modal) => {
      const refus = refusDe(roleActif(), 'ecrire')
      if (refus) return toast(refus, true)
      setArgent(modal)
    },
    live: { direct, majLe, sync, reload },
    role: roleActif(),
  }
  const donnees = { ...donneesEtat, data }
  // Rôle affiché sur la page : les boutons marqués « ecriture » sont masqués pour un lecteur (SEC-10)
  if (typeof document !== 'undefined' && document.body.dataset.role !== noyau.role) document.body.dataset.role = noyau.role

  const [chemin, query = ''] = route.split('?')
  const [page, arg = ''] = chemin.split(/\/(.*)/s)
  const q = new URLSearchParams(query)
  const docType = page === 'facture' ? state.documents.find((d) => d.id === arg)?.type || new URLSearchParams(query).get('type') : null
  // Prospect ou client : la fiche s'ouvre dans l'espace Acquisition ou Clients du hub Commercial
  const estClient = (id) => data.clients.some((c) => c.id === id)
  const ongletAcq = page === 'clients' && ESPACES.acquisition.cats.includes(q.get('onglet'))
  const current =
    page === 'prospect' ? (estClient(arg) ? 'clients' : 'acquisition') : page === 'prospects' || ongletAcq ? 'acquisition' : page === 'facture' ? (docType === 'devis' ? 'devis' : 'factures') : page
  // Entrée du menu à surligner : section du tableau de bord ou des paramètres, sinon la page
  const ongletDash = ONGLET_DASH[arg || q.get('onglet')] || ''
  const cle = ['dashboard', 'parametres', 'editeur'].includes(page) ? cleDePage(page, arg, q) : current
  // Pastilles du menu : chaque module actif déclare ce qui attend une action dans ses pages
  const etatPastilles = { data, documents: state.documents || [], actions: state.actions }
  const badges = Object.assign({}, ...Object.entries(PASTILLES).filter(([m]) => estActif(m, state.settings)).map(([, f]) => f(etatPastilles)))
  // Espace ouvert (un des 6) : son menu et sa couleur. Modules désactivés : leurs pages sortent de la navigation.
  const basculerRubrique = (id, ouvert) => setOuverts((m) => ({ ...m, [id]: !ouvert }))
  const accessible = accessibleAvec(state.settings)
  const espaces = espacesActifs(accessible)
  const espaceBrut = page === 'espace' ? (arg ? { id: arg } : null) : espaceDe(cle)
  const appli = espaceBrut && espaces.find((e) => e.id === espaceBrut.id)
  const titrePage = entreeDe(cle)?.label || LIBELLES[cle] || LIBELLES[current] || brand.sousTitre
  let content
  if (!pageAccessible(page, state.settings)) content = <ModuleInactif nom={moduleDePage(page).nom} />
  else if (page === 'saisie') content = <Saisie key={route} prospectId={arg} />
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
  else if (page === 'documents') content = <Documents />
  else if (page === 'calendrier') content = <Calendrier />
  else if (page === 'factures' || page === 'devis') content = <Factures key={route} type={page === 'devis' ? 'devis' : 'facture'} filtre={q.get('filtre')} />
  else if (page === 'paiements') content = <Paiements />
  else if (page === 'depenses') content = <Depenses key={route} nouveau={q.get('nouveau')} />
  else if (page === 'charges') content = <ChargesVue />
  else if (page === 'abonnements') content = <Abonnements key={route} nouveau={q.get('nouveau')} />
  else if (page === 'boutique') content = <Boutique key={route} onglet={q.get('onglet')} />
  else if (page === 'site') content = <SiteVue />
  else if (page === 'site-demandes') content = <SiteDemandes key={route} onglet={q.get('onglet')} />
  else if (page === 'site-pages') content = <SitePages />
  else if (page === 'site-photos') content = <SitePhotos />
  else if (page === 'facture') content = <DocEditor key={route} id={arg} query={query} />
  else if (page === 'controle') content = <Controle />
  else if (page === 'operations') content = <Operations />
  else if (page === 'plateforme') content = <ClientsPlateforme key={route} filtre={q.get('filtre')} />
  else if (page === 'plateforme-client') content = <FichePlateforme key={arg} id={arg} faire={q.get('faire')} onglet={q.get('onglet')} mdp={q.get('mdp')} />
  else if (page === 'editeur') content = <AdminSaaS route={chemin} />
  else if (page === 'espace') content = <Applications espaces={espaces} actif={arg} pastilles={(e) => e.entrees.map((x) => badges[x.route]).find((b) => b && b[0])} />
  else content = <Dashboard onglet={ongletDash || 'vue'} />
  const pastille = (path) => {
    const [n, cls, t] = badges[path] || []
    return n ? (
      <span className={`nav-badge ${cls}`} title={`${n} ${t}`}>
        {n}
      </span>
    ) : null
  }
  return (
    <NoyauCtx.Provider value={noyau}>
      <DonneesCtx.Provider value={donnees}>
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
            {/* Comme Zoho Books : chaque rubrique et ses pages, jamais les filtres (ils restent dans la page) */}
            {espaces.map((a) => {
              const actif = appli?.id === a.id
              const ouvert = ouverts[a.id] ?? actif
              return (
                <div key={a.id} className={`nav-rubrique ${ouvert ? 'open' : ''}`}>
                  <button className={`nav-item nav-parent ${actif ? 'dans' : ''}`} aria-expanded={ouvert} onClick={() => basculerRubrique(a.id, ouvert)}>
                    <span className="ico"><Icon n={a.ico} size={17} /></span>
                    {a.nom}
                    {!ouvert && pastille(a.entrees.map((e) => e.route).find((x) => badges[x]?.[0]))}
                    <span className="nav-chev" aria-hidden="true"><Icon n="chevron" size={12} /></span>
                  </button>
                  {ouvert && (
                    <div className="nav-enfants">
                      {a.entrees.map((e) => (
                        <button key={e.route} className={`nav-item nav-enfant ${cle === e.route || entreeDe(cle)?.route === e.route ? 'active' : ''}`} aria-current={cle === e.route || entreeDe(cle)?.route === e.route ? 'page' : undefined} onClick={() => go(`/${e.route}`)}>
                          {e.label}
                          {pastille(e.route)}
                        </button>
                      ))}
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
              <div className="brand-sub">{appli ? (page === 'espace' ? appli.nom : `${appli.nom} · ${titrePage}`) : page === 'espace' ? 'Tous les espaces' : titrePage}</div>
            </div>
            <button className="icon-btn mobile-settings" aria-label="Rechercher" onClick={() => setRecherche(true)}>
              <Icon n="search" size={18} />
            </button>
            <button className={`icon-btn mobile-settings mobile-gear ${page === 'espace' ? 'on' : ''}`} aria-label="Tous les espaces" onClick={() => go('/espace')}>
              <Icon n="grid" size={18} />
            </button>
          </header>
          {!isLocal && roleActif() === 'lecteur' && (
            <div className="sync-banner" data-role="lecteur">
              <span className="dot" />
              Lecture seule : ton rôle dans cet espace est {ROLES.lecteur.nom}.
            </div>
          )}
          {!isLocal && (!sync.online || sync.pending > 0 || sync.error) && (
            <div className={`sync-banner ${syncCls}`}>
              <span className="dot" />
              {sync.error || syncTxt}
              {!sync.online && <span className="muted"> · tes saisies partiront dès le retour d'internet</span>}
            </div>
          )}
          {isLocal && (route === '' || route.startsWith('controle') || route.startsWith('dashboard')) && (
            <div className="banner">Mode démo : les données restent dans ce navigateur. La version en ligne se branche sur Supabase.</div>
          )}
          {appli && page !== 'espace' && appli.entrees.length > 1 && (
            <nav className="app-onglets" aria-label={`Menu ${appli.nom}`}>
              {appli.entrees.map((e) => (
                <button key={e.route} className={cle === e.route || entreeDe(cle)?.route === e.route ? 'on' : ''} aria-current={cle === e.route || entreeDe(cle)?.route === e.route ? 'page' : undefined} onClick={() => go(`/${e.route}`)}>
                  {e.label}
                  {pastille(e.route)}
                </button>
              ))}
            </nav>
          )}
          <GardeErreur cle={route}>
            <Suspense fallback={<div className="chargement" aria-busy="true" aria-label="Chargement" />}>{content}</Suspense>
          </GardeErreur>
        </main>
        <nav className="bottom-nav" aria-label="Navigation principale">
          {BAS.filter((n) => n.cta || n.route === 'espace' || espaces.some((e) => e.id === n.espace)).map((n) => {
            const actif = n.route === 'espace' ? page === 'espace' || (appli && !BAS.some((b) => b.espace === appli.id)) : appli?.id === n.espace && page !== 'espace'
            const cible = n.espace ? espaces.find((e) => e.id === n.espace).entrees[0].route : n.route
            return (
              <button key={n.short} className={`${n.cta ? 'cta' : ''} ${actif ? 'active' : ''}`} aria-current={actif ? 'page' : undefined} onClick={() => (n.cta ? noyau.openAction() : go(`/${n.espace && accessible(n.route) ? n.route : cible}`))}>
                <span className="ico"><Icon n={n.ico} size={n.cta ? 22 : 20} /></span>
                {n.short}
              </button>
            )
          })}
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
      {argent && (
        <Suspense fallback={null}>
          <SaisieArgent modal={argent} onClose={() => setArgent(null)} />
        </Suspense>
      )}
      {aide && <Raccourcis onClose={() => setAide(false)} />}
      <ConfirmHost />
      {recherche &&
        (RechercheChargee ? (
          <RechercheChargee onClose={() => setRecherche(false)} pages={pagesRecherche(accessible)} />
        ) : (
          <Suspense fallback={null}>
            <Recherche onClose={() => setRecherche(false)} pages={pagesRecherche(accessible)} />
          </Suspense>
        ))}
      {toastNode}
      </DonneesCtx.Provider>
    </NoyauCtx.Provider>
  )
}
