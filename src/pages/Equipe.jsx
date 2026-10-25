// Équipe : les personnes qui t'aident (assistante DM, closer, comptable). Chacune voit une page très simple :
// ses missions, ses gros boutons, les scripts et le kit de vente à télécharger. Tu ajoutes ou retires tout toi-même.
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import { go, confirmer } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { supabase, isLocal } from '../lib/store'
import { today } from '../lib/dates'

export const POSTES = {
  dm: { nom: 'Assistante DM', ico: 'message', couleur: '#D9468F', missions: ['Envoyer 50 DM sur Instagram', 'Noter chaque réponse', 'Passer les intéressés au patron'] },
  closer: { nom: 'Closer', ico: 'handshake', couleur: '#2563EB', missions: ['Appeler les prospects intéressés', 'Envoyer les devis', 'Relancer les devis sans réponse'] },
  comptable: { nom: 'Comptable', ico: 'wallet', couleur: '#0F7B55', missions: ['Vérifier les encaissements', 'Noter les dépenses', 'Préparer le point du mois'] },
}

const KIT_DEFAUT = [
  { nom: 'Grille des prix', url: '/documents/04-commercial-et-facturation/grille-tarifaire.pdf' },
  { nom: 'Proposition commerciale', url: '/documents/04-commercial-et-facturation/proposition-commerciale.pdf' },
]

const equipeDe = (settings) => ({ personnes: [], kit: KIT_DEFAUT, ...(settings.equipe || {}) })
const uid = () => Math.random().toString(36).slice(2, 10)

// Ce que voit la personne de l'équipe : gros boutons, missions du jour, scripts, kit de vente
export function VueSimple({ personne, equipe }) {
  const { ouvrir, settings } = useNoyau()
  const { actions = [] } = useDonnees()
  const poste = POSTES[personne.poste] || POSTES.dm
  const missions = personne.missions?.length ? personne.missions : poste.missions
  const cle = `aecrm-missions-${personne.id}-${today()}`
  const [faites, setFaites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(cle) || '[]')
    } catch {
      return []
    }
  })
  const cocher = (i) => {
    const n = faites.includes(i) ? faites.filter((x) => x !== i) : [...faites, i]
    setFaites(n)
    try {
      localStorage.setItem(cle, JSON.stringify(n))
    } catch {
      // rien
    }
  }
  const dmJour = actions.filter((a) => a.date === today() && a.canal === 'DM').length
  const objectif = Number(settings.objectifsJour?.dm) || 50
  return (
    <div className="stack simple" style={{ '--c': poste.couleur }}>
      <div className="simple-bonjour">
        <h1>Bonjour {personne.nom.split(' ')[0]} 👋</h1>
        <p>Tu es {poste.nom.toLowerCase()}. Voici ton travail d’aujourd’hui.</p>
      </div>
      {personne.poste === 'dm' && (
        <div className="simple-compteur">
          <strong>{dmJour}</strong> DM aujourd’hui sur {objectif}
          <span className="tb-barre">
            <i style={{ width: `${Math.min(100, (dmJour / objectif) * 100)}%`, background: poste.couleur }} />
          </span>
        </div>
      )}
      <div className="simple-boutons">
        {personne.poste === 'dm' && (
          <button type="button" className="simple-gros" onClick={() => ouvrir('dm')}>
            <Icon n="message" size={30} /> Noter mes DM
          </button>
        )}
        {personne.poste === 'closer' && (
          <button type="button" className="simple-gros" onClick={() => go('/acquisition')}>
            <Icon n="target" size={30} /> Mes prospects
          </button>
        )}
        {personne.poste === 'comptable' && (
          <button type="button" className="simple-gros" onClick={() => ouvrir('encaisser')}>
            <Icon n="coins" size={30} /> Encaisser
          </button>
        )}
        {personne.poste === 'comptable' && (
          <button type="button" className="simple-gros" onClick={() => ouvrir('depense')}>
            <Icon n="wallet" size={30} /> Noter une dépense
          </button>
        )}
        <button type="button" className="simple-gros" onClick={() => go('/scripts')}>
          <Icon n="note" size={30} /> Les scripts
        </button>
      </div>
      <section className="tb-carte">
        <header>
          <h2>Mes missions du jour</h2>
          <span className="tiny muted">
            {faites.length} / {missions.length} faites
          </span>
        </header>
        <ul className="simple-missions">
          {missions.map((m, i) => (
            <li key={i}>
              <label className={faites.includes(i) ? 'fait' : ''}>
                <input type="checkbox" checked={faites.includes(i)} onChange={() => cocher(i)} /> {m}
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className="tb-carte">
        <header>
          <h2>Kit de vente</h2>
          <span className="tiny muted">à télécharger et envoyer aux clients</span>
        </header>
        <ul className="simple-kit">
          {equipe.kit.map((k, i) => (
            <li key={i}>
              <a className="btn" href={k.url} download target="_blank" rel="noreferrer">
                <Icon n="download" size={16} /> {k.nom}
              </a>
            </li>
          ))}
        </ul>
        {equipe.kit.length === 0 && <p className="small muted">Pas encore de document.</p>}
      </section>
    </div>
  )
}

function PersonneForm({ init, onSave, onCancel }) {
  const [p, setP] = useState(init || { id: uid(), nom: '', email: '', poste: 'dm', missions: [] })
  const [mission, setMission] = useState('')
  const poste = POSTES[p.poste]
  const missions = p.missions?.length ? p.missions : poste.missions
  return (
    <div className="tb-carte stack">
      <h2>{init ? 'Modifier' : 'Ajouter une personne'}</h2>
      <label className="small">
        Son prénom et nom
        <input className="input" value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} placeholder="Ex. Grâce Mabiala" />
      </label>
      <label className="small">
        Son e-mail (pour se connecter)
        <input className="input" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} placeholder="nom@gmail.com" />
      </label>
      <div className="small">Son travail</div>
      <div className="chips">
        {Object.entries(POSTES).map(([k, v]) => (
          <button key={k} type="button" className={`chip ${p.poste === k ? 'on' : ''}`} onClick={() => setP({ ...p, poste: k, missions: [] })}>
            {v.nom}
          </button>
        ))}
      </div>
      <div className="small">Ses missions de chaque jour</div>
      <ul className="simple-missions edit">
        {missions.map((m, i) => (
          <li key={i}>
            {m}
            <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setP({ ...p, missions: missions.filter((_, j) => j !== i) })}>
              <Icon n="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input className="input" value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Ajouter une mission" />
        <button
          type="button"
          className="btn"
          disabled={!mission.trim()}
          onClick={() => {
            setP({ ...p, missions: [...missions, mission.trim()] })
            setMission('')
          }}
        >
          Ajouter
        </button>
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!p.nom.trim()} onClick={() => onSave({ ...p, missions })}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}

export default function Equipe({ vue }) {
  const { settings, api, toast } = useNoyau()
  const equipe = equipeDe(settings)
  const [edit, setEdit] = useState(null)
  const [email, setEmail] = useState(isLocal || !supabase ? '' : null)
  const [kitNom, setKitNom] = useState('')
  const [kitUrl, setKitUrl] = useState('')
  const fichier = useRef()
  useEffect(() => {
    if (isLocal || !supabase) return
    supabase.auth.getSession().then(({ data }) => setEmail(data?.session?.user?.email || ''))
  }, [])
  const sauver = (patch) => api.saveSettings({ ...settings, equipe: { ...equipe, ...patch } })

  // La personne connectée fait partie de l'équipe : elle voit directement sa page simple
  const moi = email && equipe.personnes.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase())
  const apercu = vue && equipe.personnes.find((p) => p.id === vue)
  if (moi && !vue) return <VueSimple personne={moi} equipe={equipe} />
  if (apercu)
    return (
      <div className="stack">
        <div className="card small row">
          <span>Aperçu : voici ce que voit {apercu.nom}.</span>
          <button type="button" className="btn sm" onClick={() => go('/equipe')}>
            Retour
          </button>
        </div>
        <VueSimple personne={apercu} equipe={equipe} />
      </div>
    )

  const ajouterFichier = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 900000) return toast('Fichier trop lourd (900 Ko au plus). Mets plutôt un lien Google Drive.', true)
    const r = new FileReader()
    r.onload = () => sauver({ kit: [...equipe.kit, { nom: kitNom.trim() || f.name.replace(/\.[a-z]+$/i, ''), url: r.result }] }).then(() => (setKitNom(''), toast('Document ajouté ✓')))
    r.readAsDataURL(f)
  }

  return (
    <div className="stack equipe">
      <div className="tb-tete">
        <div>
          <h1>Mon équipe</h1>
          <p className="tb-phrase">Donne un accès simple aux personnes qui t’aident. Elles voient seulement leur travail.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setEdit('nouveau')}>
          <Icon n="user-plus" size={15} /> Ajouter une personne
        </button>
      </div>

      {edit && (
        <PersonneForm
          init={edit === 'nouveau' ? null : edit}
          onCancel={() => setEdit(null)}
          onSave={async (p) => {
            const liste = equipe.personnes.some((x) => x.id === p.id) ? equipe.personnes.map((x) => (x.id === p.id ? p : x)) : [...equipe.personnes, p]
            await sauver({ personnes: liste })
            setEdit(null)
            toast('Enregistré ✓')
          }}
        />
      )}

      <div className="equipe-liste">
        {equipe.personnes.map((p) => {
          const poste = POSTES[p.poste] || POSTES.dm
          return (
            <div key={p.id} className="equipe-carte" style={{ '--c': poste.couleur }}>
              <span className="equipe-ico">
                <Icon n={poste.ico} size={22} />
              </span>
              <div className="equipe-txt">
                <strong>{p.nom}</strong>
                <span className="small muted">
                  {poste.nom}
                  {p.email ? ` · ${p.email}` : ' · pas encore d’e-mail'}
                </span>
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => go(`/equipe?vue=${p.id}`)}>
                  <Icon n="eye" size={14} /> Ce qu’elle voit
                </button>
                <button type="button" className="btn sm ghost" onClick={() => setEdit(p)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn sm ghost danger"
                  onClick={async () => (await confirmer(`${p.nom} ne fera plus partie de l’équipe.`, { titre: 'Retirer cette personne ?', ok: 'Retirer', danger: true })) && sauver({ personnes: equipe.personnes.filter((x) => x.id !== p.id) })}
                >
                  Retirer
                </button>
              </div>
            </div>
          )
        })}
        {equipe.personnes.length === 0 && !edit && (
          <div className="tb-carte">
            <p className="small">Personne pour l’instant. Exemple : ajoute ton assistante, choisis « Assistante DM ». Elle verra un gros bouton « Noter mes DM », les scripts et le kit de vente.</p>
          </div>
        )}
      </div>

      <section className="tb-carte">
        <header>
          <h2>Comment donner l’accès</h2>
        </header>
        <ol className="small equipe-etapes">
          <li>Ajoute la personne ici avec son e-mail.</li>
          <li>
            Va dans{' '}
            <button type="button" className="lien" onClick={() => go('/parametres/membres')}>
              Accès
            </button>{' '}
            et invite le même e-mail avec le rôle « Membre ».
          </li>
          <li>Elle crée son compte avec cet e-mail. En ouvrant « Équipe », elle voit sa page simple.</li>
        </ol>
      </section>

      <section className="tb-carte">
        <header>
          <h2>Kit de vente</h2>
          <span className="tiny muted">les documents que ton équipe peut télécharger</span>
        </header>
        <ul className="tb-completer">
          {equipe.kit.map((k, i) => (
            <li key={i}>
              <a href={k.url} target="_blank" rel="noreferrer" download>
                <Icon n="file" size={14} /> {k.nom}
              </a>
              <button type="button" className="btn sm ghost danger" onClick={() => sauver({ kit: equipe.kit.filter((_, j) => j !== i) })}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <input className="input" placeholder="Nom du document (ex. Catalogue)" value={kitNom} onChange={(e) => setKitNom(e.target.value)} />
          <input className="input" placeholder="Lien (Google Drive…) facultatif" value={kitUrl} onChange={(e) => setKitUrl(e.target.value)} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (kitUrl.trim()) sauver({ kit: [...equipe.kit, { nom: kitNom.trim() || 'Document', url: kitUrl.trim() }] }).then(() => (setKitNom(''), setKitUrl(''), toast('Document ajouté ✓')))
              else fichier.current.click()
            }}
          >
            <Icon n="upload" size={14} /> {kitUrl.trim() ? 'Ajouter le lien' : 'Choisir un PDF'}
          </button>
        </div>
        <input ref={fichier} type="file" accept="application/pdf,image/*" hidden onChange={ajouterFichier} />
      </section>
    </div>
  )
}
