import { useState } from 'react'
import { Icon } from '../icons'
import { useApp, go } from '../ui'
import { MODULES, modulesDe, etablissements, isLocal, peut } from '../lib/store'

// Couleur et icône de chaque entrée de l'écran d'accueil (applications installées et administration)
const TUILES = {
  ...Object.fromEntries(MODULES.map(([, l, , m]) => [m.route, { couleur: m.couleur, ico: m.ico, label: l }])),
  journal: { couleur: '#2f5bd3', ico: 'chart', label: 'Mes ventes du jour' },
  etablissements: { couleur: '#475569', ico: 'briefcase', label: 'Établissements' },
  applications: { couleur: '#714b67', ico: 'grid', label: 'Applications' },
  equipe: { couleur: '#64748b', ico: 'users', label: 'Équipe' },
  parametres: { couleur: '#334155', ico: 'settings', label: 'Paramètres' },
}

// Écran d'accueil façon Odoo : une icône par application installée pour cet établissement
export function Accueil({ apps }) {
  const { profil } = useApp()
  const tuiles = apps.filter((n) => TUILES[n.path])
  const heure = new Date().getHours()
  return (
    <div className="apps-home">
      <div className="apps-hello">
        <h1>{heure < 18 ? 'Bonjour' : 'Bonsoir'}{profil?.nom ? ` ${profil.nom.split(' ')[0]}` : ''}</h1>
        <span>{profil?.etab?.nom || 'Choisis une application'}</span>
      </div>
      <div className="apps-grid">
        {tuiles.map((n) => {
          const t = TUILES[n.path]
          return (
            <button key={n.path} className="app-tile" onClick={() => go(`/${n.path}`)}>
              <span className="app-ic" style={{ background: t.couleur }}>
                <Icon n={t.ico} size={34} />
              </span>
              <span className="app-nom">{t.label}</span>
            </button>
          )
        })}
      </div>
      {!tuiles.length && <p className="apps-vide">Aucune application n'est installée pour toi dans cet établissement. Demande au superadmin.</p>}
      {profil?.espace === 'demo' && peut(profil, 'articles') && <DemoBar />}
    </div>
  )
}

// Superadmin : installer ou désinstaller chaque application pour l'établissement affiché, comme le menu Applications d'Odoo
export function Applications() {
  const { profil, toast } = useApp()
  const etab = profil?.etab
  const [mods, setMods] = useState(() => modulesDe(etab))
  const [busy, setBusy] = useState('')
  const [filtre, setFiltre] = useState('')
  if (!etab) return <p className="muted">Aucun établissement affiché.</p>
  const basculer = async (k, l) => {
    const installer = !mods[k]
    if (!installer && !window.confirm(`Désinstaller ${l} pour ${etab.nom} ? Ses données sont gardées et réapparaissent si tu la réinstalles.`)) return
    const suivant = { ...mods, [k]: installer }
    if (!Object.values(suivant).some(Boolean)) return toast('Garde au moins une application', true)
    setBusy(k)
    try {
      await etablissements.save({ ...etab, modules: suivant })
      setMods(suivant)
      toast(`${l} ${installer ? 'installée' : 'désinstallée'} ✓`)
      // Le menu et l'accueil se recalculent avec les nouvelles applications
      setTimeout(() => window.location.reload(), isLocal ? 300 : 600)
    } catch (e) {
      toast(`Impossible : ${e.message}`, true)
      setBusy('')
    }
  }
  const liste = MODULES.filter(([k]) => (filtre === 'on' ? mods[k] : filtre === 'off' ? !mods[k] : true))
  const nb = MODULES.filter(([k]) => mods[k]).length
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Applications</h1>
          <div className="sub">
            {etab.nom} · {nb} installée{nb > 1 ? 's' : ''} sur {MODULES.length} ·{' '}
            <button className="toggle-link" onClick={() => go('/etablissements')}>changer d'établissement</button>
          </div>
        </div>
        <div className="tabs">
          {[['', 'Toutes'], ['on', 'Installées'], ['off', 'Non installées']].map(([k, l]) => (
            <button key={k} className={filtre === k ? 'on' : ''} onClick={() => setFiltre(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="apps-store">
        {liste.map(([k, l, aide, m]) => (
          <div key={k} className={`card app-card ${mods[k] ? 'on' : ''}`}>
            <span className="app-ic sm" style={{ background: m.couleur }}>
              <Icon n={m.ico} size={26} />
            </span>
            <div className="app-card-t">
              <strong>{l}</strong>
              <span className="muted small">{aide}</span>
            </div>
            <div className="app-card-b">
              {mods[k] ? (
                <>
                  <span className="badge b-green">Installée</span>
                  <span className="spacer" />
                  <button className="btn sm" onClick={() => go(`/${m.route}`)}>Ouvrir</button>
                  <button className="btn sm danger" disabled={!!busy} onClick={() => basculer(k, l)}>Désinstaller</button>
                </>
              ) : (
                <button className="btn primary sm" disabled={!!busy} onClick={() => basculer(k, l)}>
                  {busy === k ? 'Installation…' : 'Installer'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Espace de démonstration : 6 mois d'activité fictive, régénérables à la date du jour
function DemoBar() {
  const { api, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const regenerer = async () => {
    if (!window.confirm("Effacer toutes les données de l'hôtel de démonstration et recréer 6 mois d'activité fictive à la date d'aujourd'hui ?")) return
    setBusy(true)
    try {
      await api.regenererDemo()
      toast('Données de démonstration régénérées ✓')
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  return (
    <div className="apps-demo">
      <span><Icon n="star" size={15} /> Hôtel de démonstration : 6 mois d'activité fictive (séjours, passages, restaurant, bar, devis, dépenses).</span>
      <button className="btn sm" disabled={busy} onClick={regenerer}>{busy ? 'Régénération…' : 'Régénérer à la date du jour'}</button>
    </div>
  )
}
