// Écran d'accueil façon Odoo / Zoho One : chaque module est une application avec son icône et sa couleur
import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { useApp, go } from '../ui'
import { supabase } from '../lib/store'
import { today } from '../lib/dates'

const salut = () => {
  const h = new Date().getHours()
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'
}

export default function Applications({ apps, pastilles }) {
  const { settings } = useApp()
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
  const extra = { site: store ? [store, 'hot', 'commandes à traiter'] : null }
  const date = new Date(`${today()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="lanceur">
      <div className="lanceur-tete">
        <div className="muted" style={{ textTransform: 'capitalize' }}>
          {date}
        </div>
        <h1>
          {salut()}
          {prenom ? ` ${prenom}` : ''}, que veux-tu ouvrir ?
        </h1>
      </div>
      <div className="lanceur-grille">
        {apps.map((a) => {
          const p = extra[a.id] || pastilles(a)
          const ouvrir = () => (a.lien ? window.open(a.lien, '_blank', 'noopener') : go(`/${a.route}`))
          return (
            <button key={a.id} type="button" className="appli" onClick={ouvrir} style={{ '--c': a.couleur }}>
              <span className="appli-ic">
                <Icon n={a.ico} size={30} />
                {p && (
                  <span className={`appli-pastille ${p[1]}`} title={`${p[0]} ${p[2]}`}>
                    {p[0]}
                  </span>
                )}
              </span>
              <span className="appli-nom">
                {a.nom}
                {a.lien && <Icon n="share" size={12} />}
              </span>
              <span className="appli-desc">{a.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
