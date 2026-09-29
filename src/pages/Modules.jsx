// Paramètres › Modules : activer ou désactiver chaque application. Les données d'un module désactivé restent en base.
import { confirmer } from '../ui'
import { useNoyau } from '../core/contexte'
import { MODULES, estActif, basculer, moduleParId } from '../core/modules'

const noms = (ids) => ids.map((x) => moduleParId(x).nom).join(', ')

export default function Modules() {
  const { settings, api, toast } = useNoyau()
  const changer = async (m, actif) => {
    const { modules, entraines } = basculer(m.id, actif, settings)
    if (entraines.length && !actif && !(await confirmer(`Désactiver ${m.nom} désactive aussi : ${noms(entraines)}. Continuer ?`, { ok: 'Désactiver' }))) return
    try {
      await api.saveSettings({ ...settings, modules })
      toast(`${m.nom} ${actif ? 'activé' : 'désactivé'}${entraines.length ? ` (et ${noms(entraines)})` : ''} ✓`)
    } catch {
      /* toast déjà affiché */
    }
  }
  return (
    <div className="card">
      <h2 className="section">Modules</h2>
      <p className="small muted">Un module désactivé disparaît du menu et de ses pages. Ses données sont gardées : il suffit de le réactiver.</p>
      <div className="list">
        {MODULES.map((m) => {
          const actif = estActif(m.id, settings)
          const bloque = !m.coeur && settings?.modules?.[m.id] !== false && !actif
          return (
            <div key={m.id} className="list-item">
              <div className="li-main">
                <div className="li-title">{m.nom}</div>
                <div className="li-sub">
                  {m.coeur ? 'Toujours actif' : m.desc}
                  {m.dependances.requis.length > 0 && ` · nécessite ${noms(m.dependances.requis)}`}
                  {bloque && ' · inactif tant que ce module requis est désactivé'}
                </div>
              </div>
              <div className="li-side">
                {!m.coeur && (
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" id={`module-${m.id}`} checked={actif} onChange={(e) => changer(m, e.target.checked)} />
                    {actif ? 'Activé' : 'Désactivé'}
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
