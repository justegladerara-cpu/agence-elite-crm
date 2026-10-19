// Administration de la plateforme (saas.agence-elite.fr) dans le CRM : les écrans de l'ancien espace Super Admin
// du SaaS (clients, établissements, comptes, Hubs, catalogue, offres, Elite Partners, identité, adresses web,
// sites clients, copie d'articles). Depuis le 2026-10-19, ils n'existent plus que dans le CRM.
// Le code vient de la plateforme (dossier src/saas/) et garde son apparence, enfermée dans .saas-admin.
// Il parle à la base de la plateforme avec la connexion super admin du CRM ; chaque fonction de la base vérifie
// elle-même le rôle (exiger_super_admin / est_editeur), comme avant.
import { useEffect, useMemo, useState } from 'react'
import { clientPlateforme, sessionValide } from '../modules/plateforme'
import { ConnexionPlateforme } from '../modules/plateforme/ui'
import { FournisseurEspace } from '../saas/noyau/espace.jsx'
import { ADRESSE_SAAS } from '../saas/noyau/routes.js'
import EspaceEditeur, { MENU_EDITEUR, routeEditeurActive } from '../saas/modules/editeur/EspaceEditeur.jsx'
import { creerApi } from '../saas/api.js'
import '../saas/saas.css'
import '../saas/admin.css'

const naviguer = (id) => {
  window.location.hash = `/${id}`
}

export default function AdminSaaS({ route }) {
  const [connecte, setConnecte] = useState(null)
  const [contexte, setContexte] = useState(null)
  const [erreur, setErreur] = useState('')
  const [version, setVersion] = useState(0)
  const api = useMemo(() => creerApi(clientPlateforme(), ADRESSE_SAAS), [])
  const sombre = typeof document !== 'undefined' && document.documentElement.dataset.ui === 'palantir'

  useEffect(() => {
    let actif = true
    sessionValide().then((ok) => actif && setConnecte(ok))
    return () => {
      actif = false
    }
  }, [version])
  useEffect(() => {
    if (!connecte) return
    let actif = true
    api
      .rpc('mon_contexte')
      .then((c) => actif && setContexte({ ...c, etablissements: [] }))
      .catch((e) => actif && setErreur(e.message))
    return () => {
      actif = false
    }
  }, [connecte, api, version])
  // Les fenêtres (modales) s'ouvrent dans un conteneur à part, avec la même apparence
  useEffect(() => {
    let portail = document.getElementById('saas-portail')
    if (!portail) {
      portail = document.createElement('div')
      portail.id = 'saas-portail'
      portail.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:1000'
      document.body.appendChild(portail)
    }
    portail.className = `saas-admin${sombre ? ' sombre' : ''}`
  }, [sombre])

  if (connecte === null) return <div className="chargement" aria-busy="true" aria-label="Connexion à la plateforme" />
  if (!connecte)
    return (
      <div style={{ maxWidth: 440, margin: '30px auto' }}>
        <ConnexionPlateforme onConnecte={() => setVersion((v) => v + 1)} />
      </div>
    )
  if (erreur)
    return (
      <div className="card empty">
        <p>{erreur}</p>
        <button className="btn primary" onClick={() => (setErreur(''), setVersion((v) => v + 1))}>
          Réessayer
        </button>
      </div>
    )
  if (!contexte) return <div className="chargement" aria-busy="true" aria-label="Chargement de l’administration" />

  const actif = routeEditeurActive(route)
  const menu = MENU_EDITEUR.filter((m) => !m.superAdmin || contexte.editeur === 'super_admin')
  return (
    <div className={`saas-admin${sombre ? ' sombre' : ''}`}>
      <FournisseurEspace api={api} contexte={contexte} onRecharger={() => setVersion((v) => v + 1)} onDeconnexion={() => setConnecte(false)}>
        <nav className="saas-onglets" aria-label="Administration de la plateforme">
          <a href="#/plateforme-outils">← Boîte à outils</a>
          {menu.map((m) => (
            <a key={m.id} href={`#/${m.id}`} className={actif === m.id ? 'actif' : ''} aria-current={actif === m.id ? 'page' : undefined}>
              {m.libelle}
            </a>
          ))}
        </nav>
        <EspaceEditeur route={route} naviguer={naviguer} />
      </FournisseurEspace>
    </div>
  )
}
