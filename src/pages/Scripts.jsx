// Scripts : messages Instagram à copier et script d'appel, au même endroit
import { useApp, go, Tabs, useTab } from '../ui'
import { Icon } from '../icons'
import { ScriptsCard } from './Insta'

export default function Scripts() {
  const { settings } = useApp()
  const [onglet, setOnglet] = useTab('scripts', 'dm')
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Scripts</h1>
          <div className="sub">Tes messages prêts à copier. Depuis la fiche d'un prospect, ils se remplissent avec son nom et ce qu'il vend.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go('/parametres/scripts')}>
            <Icon n="edit" size={15} /> Modifier mes scripts
          </button>
        </div>
      </div>
      <Tabs
        items={[
          ['dm', 'Messages Instagram et relances', (settings.scriptsDM || []).length + (settings.messagesRelance || []).length],
          ['appel', "Script d'appel"],
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      {onglet === 'dm' ? (
        <ScriptsCard p={null} />
      ) : (
        <div className="card">
          {settings.script.map((s, i) => (
            <div key={i} className="call-step">
              <span className="cs-n">{i + 1}</span>
              <div>
                <div className="bold">{s.titre}</div>
                <div className="small">{s.texte}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
