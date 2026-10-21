// Écran d'accueil façon Odoo / Zoho One : chaque module est une application avec son icône et sa couleur
import { lazy, Suspense, useEffect, useState } from 'react'
import { Icon } from '../icons'
import { go } from '../ui'
import { useNoyau } from '../core/contexte'
import { supabase } from '../lib/store'
import { today } from '../lib/dates'

const DeconnexionPlateforme = lazy(() => import('./Plateforme').then((m) => ({ default: m.DeconnexionPlateforme })))

const salut = () => {
  const h = new Date().getHours()
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'
}

// Tous les espaces (#/espace) ou un espace (#/espace/<id>) : chaque page de l'espace en carte.
// Remplace l'ancienne boîte à outils et l'écran des applications : une seule liste, celle du menu.
export default function Applications({ espaces, actif, pastilles }) {
  const { settings } = useNoyau()
  const prenom = settings.apparence?.prenom
  // Commandes du site à traiter : lues à part, la boutique n'est pas dans les données du CRM
  const [store, setStore] = useState(0)
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('store_commandes')
      .select('id', { count: 'exact', head: true })
      .eq('demo', false)
      .in('statut', ['en_attente', 'payee'])
      .then(({ count }) => setStore(count || 0), () => {})
  }, [])
  const extra = { commercial: store ? [store, 'hot', 'commandes à traiter'] : null }
  const date = new Date(`${today()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const espace = actif && espaces.find((e) => e.id === actif)

  if (espace)
    return (
      <div className="lanceur">
        <div className="lanceur-tete">
          <button className="btn sm ghost" onClick={() => go('/espace')}>
            ← Tous les espaces
          </button>
          <h1>{espace.nom}</h1>
          <p className="muted small">{espace.desc}</p>
        </div>
        <div className="lanceur-grille">
          {espace.entrees.map((x) => (
            <a key={x.route} className="appli" href={`#/${x.route}`} style={{ '--c': espace.couleur }}>
              <span className="appli-ic">
                <Icon n={x.ico} size={26} />
              </span>
              <span className="appli-nom">{x.label}</span>
              {x.sub?.length > 0 && <span className="appli-desc">{x.sub.map(([, l]) => l).join(' · ')}</span>}
            </a>
          ))}
        </div>
        {espace.id === 'administration' && (
          <Suspense fallback={null}>
            <DeconnexionPlateforme />
          </Suspense>
        )}
      </div>
    )

  return (
    <div className="lanceur">
      <div className="lanceur-tete">
        <div className="muted" style={{ textTransform: 'capitalize' }}>
          {date}
        </div>
        <h1>
          {salut()}
          {prenom ? ` ${prenom}` : ''}, où veux-tu aller ?
        </h1>
      </div>
      <div className="lanceur-grille">
        {espaces.map((a) => {
          const p = extra[a.id] || pastilles(a)
          return (
            <button key={a.id} type="button" className="appli" onClick={() => go(`/espace/${a.id}`)} style={{ '--c': a.couleur }}>
              <span className="appli-ic">
                <Icon n={a.ico} size={30} />
                {p && (
                  <span className={`appli-pastille ${p[1]}`} title={`${p[0]} ${p[2]}`}>
                    {p[0]}
                  </span>
                )}
              </span>
              <span className="appli-nom">{a.nom}</span>
              <span className="appli-desc">{a.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
