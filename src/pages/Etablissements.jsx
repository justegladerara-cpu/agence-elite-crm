import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Empty, Modal } from '../ui'
import { etablissements, membres, MODULES, modulesDe, isLocal } from '../lib/store'

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
// Identifiant court et stable de l'établissement (sert à séparer ses données)
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

// Super administrateur : les hôtels clients du logiciel, leurs modules, leur accès
export default function Etablissements() {
  const { profil, toast } = useApp()
  const [liste, setListe] = useState(null)
  const [equipes, setEquipes] = useState([])
  const [edit, setEdit] = useState(null)
  const charger = () =>
    Promise.all([etablissements.list(), etablissements.membres()])
      .then(([l, m]) => {
        setListe(l)
        setEquipes(m)
      })
      .catch((e) => toast(`Établissements : ${e.message}`, true))
  useEffect(() => {
    charger()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const entrer = async (e) => {
    try {
      await membres.setEspace(profil.email, e.id)
      window.location.hash = '/'
      window.location.reload()
    } catch (err) {
      toast(`Impossible d'entrer : ${err.message}`, true)
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Établissements</h1>
          <div className="sub">Chaque hôtel, résidence, restaurant ou bar client a ses propres données, son équipe et les modules que tu lui attribues.</div>
        </div>
        <button className="btn primary" onClick={() => setEdit({})}>
          <Icon n="plus" size={15} /> Nouvel établissement
        </button>
      </div>
      {!liste ? (
        <div className="muted">Chargement…</div>
      ) : !liste.length ? (
        <Empty>Aucun établissement.</Empty>
      ) : (
        <div className="et-grid">
          {liste.map((e) => {
            const m = modulesDe(e)
            const equipe = equipes.filter((x) => x.espace === e.id && x.role !== 'superadmin')
            const ici = profil.espace === e.id
            return (
              <div key={e.id} className={`card et-card ${ici ? 'ici' : ''} ${e.actif === false ? 'off' : ''}`}>
                <div className="et-top">
                  <div>
                    <h3>{e.nom}</h3>
                    <span className="muted small">{[e.ville, e.id].filter(Boolean).join(' · ')}</span>
                  </div>
                  {ici ? <span className="badge b-green">Affiché</span> : e.actif === false ? <span className="badge b-red">Suspendu</span> : null}
                </div>
                <div className="et-mods">
                  {MODULES.map(([k, l]) => (
                    <span key={k} className={`et-mod ${m[k] ? 'on' : ''}`}>
                      <Icon n={m[k] ? 'check' : 'x'} size={12} /> {l}
                    </span>
                  ))}
                </div>
                <div className="small muted">
                  {equipe.length ? `${equipe.length} personne${equipe.length > 1 ? 's' : ''} : ${equipe.map((x) => x.nom || x.email).join(', ')}` : "Pas encore d'équipe"}
                </div>
                <div className="row">
                  <button className="btn sm" onClick={() => setEdit(e)}>
                    <Icon n="settings" size={14} /> Modules et accès
                  </button>
                  <span className="spacer" />
                  {!ici && (
                    <button className="btn primary sm" onClick={() => entrer(e)} disabled={isLocal}>
                      Entrer <Icon n="chevron" size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {edit && (
        <FicheEtab
          etab={edit.id ? edit : null}
          existants={liste || []}
          onClose={() => setEdit(null)}
          onDone={async (e, entrerDedans) => {
            setEdit(null)
            await charger()
            if (entrerDedans) entrer(e)
            // Modules de l'établissement affiché changés : on recharge pour les appliquer
            else if (e.id === profil.espace) window.location.reload()
          }}
        />
      )}
    </>
  )
}

function FicheEtab({ etab, existants, onClose, onDone }) {
  const { toast, profil } = useApp()
  const [f, setF] = useState(() => ({
    nom: etab?.nom || '',
    ville: etab?.ville || '',
    id: etab?.id || '',
    modules: modulesDe(etab || { modules: {} }),
    actif: etab?.actif !== false,
    gerantNom: '',
    gerantEmail: '',
  }))
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const id = etab ? etab.id : f.id || slug(f.nom)
  const valider = async (entrerDedans = false) => {
    if (!f.nom.trim()) return toast("Nom de l'établissement obligatoire", true)
    if (!Object.values(f.modules).some(Boolean)) return toast('Choisis au moins un module', true)
    if (!etab && (!id || existants.some((x) => x.id === id))) return toast('Cet identifiant existe déjà : change le nom ou l’identifiant', true)
    const gEmail = f.gerantEmail.trim().toLowerCase()
    if (gEmail && !emailOk(gEmail)) return toast("L'e-mail du gérant n'est pas valide", true)
    if (gEmail && !f.gerantNom.trim()) return toast('Indique le nom du gérant', true)
    setBusy(true)
    try {
      const e = await etablissements.save({ id, nom: f.nom, ville: f.ville, modules: f.modules, actif: f.actif })
      if (gEmail) await membres.save({ email: gEmail, nom: f.gerantNom, role: 'pdg', droits: {}, espace: id })
      toast(etab ? 'Établissement mis à jour ✓' : `${f.nom.trim()} créé ✓`)
      onDone(e, entrerDedans)
    } catch (err) {
      toast(`Enregistrement impossible : ${err.message}`, true)
      setBusy(false)
    }
  }
  const retirerModule = etab && Object.entries(modulesDe(etab)).some(([k, v]) => v && !f.modules[k])
  return (
    <Modal title={etab ? etab.nom : 'Nouvel établissement'} onClose={onClose}>
      <div className="stack">
        <Field label="Nom de l'établissement">
          <input className="input" value={f.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Hôtel Les Cocotiers" autoFocus />
        </Field>
        <div className="ho-2">
          <Field label="Ville">
            <input className="input" value={f.ville} onChange={(e) => set({ ville: e.target.value })} placeholder="Pointe-Noire" />
          </Field>
          <Field label="Identifiant (ne change plus)">
            <input className="input" value={id} disabled={!!etab} onChange={(e) => set({ id: slug(e.target.value) })} />
          </Field>
        </div>
        <div className="field">
          <span>Modules attribués</span>
          <div className="et-choix">
            {MODULES.map(([k, l, aide]) => (
              <label key={k} className={`droit-ligne ${f.modules[k] ? 'perso' : ''}`}>
                <input type="checkbox" checked={!!f.modules[k]} onChange={() => set({ modules: { ...f.modules, [k]: !f.modules[k] } })} />
                <span>
                  <b>{l}</b>
                  <span className="tiny muted">{aide}</span>
                </span>
              </label>
            ))}
          </div>
          {retirerModule && <div className="small muted">Les données déjà saisies restent enregistrées ; elles réapparaissent si tu réactives le module.</div>}
        </div>
        {!etab && (
          <>
            <div className="field">
              <span>Directeur ou gérant (facultatif)</span>
              <div className="ho-2">
                <input className="input" value={f.gerantNom} onChange={(e) => set({ gerantNom: e.target.value })} placeholder="Nom" />
                <input className="input" type="email" autoCapitalize="none" value={f.gerantEmail} onChange={(e) => set({ gerantEmail: e.target.value })} placeholder="E-mail" />
              </div>
              <span className="tiny muted">Il ouvre le logiciel, touche « Première connexion » avec cet e-mail et choisit son mot de passe. Il ajoute ensuite son équipe.</span>
            </div>
          </>
        )}
        {etab && etab.id !== profil.espace && (
          <label className={`droit-ligne ${!f.actif ? 'perso' : ''}`}>
            <input type="checkbox" checked={!f.actif} onChange={() => set({ actif: !f.actif })} />
            <span>
              <b>Suspendre l'accès</b>
              <span className="tiny muted">L'équipe de l'établissement ne peut plus se connecter (abonnement impayé…). Les données sont gardées.</span>
            </span>
          </label>
        )}
        <div className="ho-btns">
          <button className="btn" onClick={onClose}>Annuler</button>
          {!etab && (
            <button className="btn" disabled={busy} onClick={() => valider(true)}>
              Créer et entrer
            </button>
          )}
          <button className="btn primary" disabled={busy} onClick={() => valider(false)}>
            {busy ? 'Enregistrement…' : etab ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
