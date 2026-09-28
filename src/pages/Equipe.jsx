import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Empty, Chips, Modal } from '../ui'
import { membres, ROLES, DROITS, peut, droitDefaut } from '../lib/store'

const RESUME = {
  superadmin: 'Tout, sans exception. Réservé à Agence Elite (maintenance).',
  pdg: 'Tout : ventes, finances, stock, équipe et réglages.',
  caisse: 'Vend, fait les factures, reçus et devis, gère les articles. Ne voit pas les finances.',
  comptable: 'Voit les finances, saisit les dépenses, peut annuler une vente. Ne vend pas.',
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

// Réglage fin des droits d'une personne : chaque case part de la valeur de son rôle
function DroitsModal({ membre, onSave, onClose }) {
  const [droits, setDroits] = useState(() => ({ ...(membre.droits || {}) }))
  const [busy, setBusy] = useState(false)
  const effectif = (d) => peut({ ...membre, droits }, d)
  const perso = Object.keys(droits).filter((d) => droits[d] !== droitDefaut(membre.role, d))
  const basculer = (d) => {
    const v = !effectif(d)
    const next = { ...droits }
    if (v === droitDefaut(membre.role, d)) delete next[d]
    else next[d] = v
    setDroits(next)
  }
  return (
    <Modal title={`Droits de ${membre.nom || membre.email}`} onClose={onClose}>
      <div className="stack">
        <div className="small muted">
          Rôle : <span className={`badge role-${membre.role}`}>{ROLES[membre.role]}</span>. Les cases cochées au départ sont celles du rôle ; tu peux ajouter ou retirer un droit pour cette personne seulement.
        </div>
        <div className="droits-liste">
          {DROITS.map(([d, label, aide]) => (
            <label key={d} className={`droit-ligne ${droits[d] !== undefined ? 'perso' : ''}`}>
              <input type="checkbox" checked={effectif(d)} onChange={() => basculer(d)} />
              <span>
                <b>{label}</b>
                <span className="tiny muted">{aide}</span>
              </span>
              {droits[d] !== undefined && <span className="badge b-orange">Modifié</span>}
            </label>
          ))}
        </div>
        <div className="row">
          {perso.length > 0 && (
            <button className="btn ghost sm" onClick={() => setDroits({})}>
              Revenir aux droits du rôle
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await onSave(Object.fromEntries(perso.map((d) => [d, droits[d]])))
              if (!ok) setBusy(false)
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Equipe() {
  const { profil, toast } = useApp()
  const admin = profil.role === 'superadmin'
  const gerer = peut(profil, 'equipe')
  const [liste, setListe] = useState(null)
  const [f, setF] = useState({ email: '', nom: '', role: 'caisse' })
  const [busy, setBusy] = useState(false)
  const [droitsDe, setDroitsDe] = useState(null)
  const [retrait, setRetrait] = useState(null)
  const charger = () => membres.list().then(setListe).catch((e) => toast(`Équipe : ${e.message}`, true))
  useEffect(() => {
    charger()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Seul le super admin attribue le rôle super admin ; seul un PDG (ou le super admin) touche au rôle PDG
  const chefPdg = admin || profil.role === 'pdg'
  const rolesPermis = Object.keys(ROLES).filter((r) => (admin || r !== 'superadmin') && (chefPdg || r !== 'pdg'))
  const modifiable = (m) => gerer && m.email !== profil.email && (admin || m.role !== 'superadmin') && (chefPdg || m.role !== 'pdg')
  const roleDe = (l) => Object.keys(ROLES).find((k) => ROLES[k] === l)
  const ajouter = async () => {
    const email = f.email.trim().toLowerCase()
    if (!f.nom.trim()) return toast('Indique son nom', true)
    if (!emailOk(email)) return toast("L'e-mail n'est pas valide", true)
    if ((liste || []).some((m) => m.email === email)) return toast('Cette personne est déjà dans l’équipe', true)
    setBusy(true)
    try {
      await membres.save({ ...f, email, droits: {}, espace: profil.espace })
      toast(`${f.nom.trim()} ajouté(e) ✓`)
      setF({ email: '', nom: '', role: 'caisse' })
      await charger()
    } catch (e) {
      toast(`Ajout impossible : ${e.message}`, true)
    }
    setBusy(false)
  }
  const enregistrer = async (m, patch, msg) => {
    try {
      await membres.save({ ...m, ...patch })
      await charger()
      toast(msg)
      return true
    } catch (e) {
      toast(`Modification impossible : ${e.message}`, true)
      return false
    }
  }
  const retirer = async (m) => {
    try {
      await membres.remove(m.email)
      await charger()
      toast(`${m.nom || m.email} n'a plus accès ✓`)
    } catch (e) {
      toast(`Retrait impossible : ${e.message}`, true)
    }
    setRetrait(null)
  }
  const nbPerso = (m) => Object.keys(m.droits || {}).length
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Équipe et accès</h1>
          <div className="sub">Chaque personne a son propre compte. Son rôle, et ses droits ajustés si besoin, décident de ce qu'elle voit et peut faire.</div>
        </div>
      </div>
      <div className="grid equipe-grid">
        <div className="card">
          <h2 className="section">Membres</h2>
          {!liste ? (
            <div className="muted">Chargement…</div>
          ) : !liste.length ? (
            <Empty>Personne pour l'instant.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="t ztable">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th className="hide-m">E-mail</th>
                    <th>Rôle</th>
                    <th>Droits</th>
                    {gerer && <th />}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((m) => (
                    <tr key={m.email}>
                      <td className="strong">
                        {m.nom || '—'}
                        {m.email === profil.email && <span className="tiny muted"> (toi)</span>}
                        <div className="tiny muted show-m">{m.email}</div>
                      </td>
                      <td className="hide-m">{m.email}</td>
                      <td>
                        {modifiable(m) ? (
                          <select className="input sm" value={m.role} onChange={(e) => enregistrer(m, { role: e.target.value, droits: {} }, 'Rôle mis à jour ✓')} aria-label={`Rôle de ${m.nom}`}>
                            {rolesPermis.map((k) => (
                              <option key={k} value={k}>{ROLES[k]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge role-${m.role}`}>{ROLES[m.role]}</span>
                        )}
                      </td>
                      <td>
                        {m.role === 'superadmin' ? (
                          <span className="small muted">Tous</span>
                        ) : modifiable(m) ? (
                          <button className="btn sm" onClick={() => setDroitsDe(m)}>
                            {DROITS.filter(([d]) => peut(m, d)).length} / {DROITS.length}
                            {nbPerso(m) > 0 && <span className="badge b-orange" style={{ marginLeft: 6 }}>ajustés</span>}
                          </button>
                        ) : (
                          <span className="small muted">{DROITS.filter(([d]) => peut(m, d)).length} / {DROITS.length}</span>
                        )}
                      </td>
                      {gerer && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {modifiable(m) &&
                            (retrait === m.email ? (
                              <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                <button className="btn sm danger" onClick={() => retirer(m)}>Retirer</button>
                                <button className="btn sm" onClick={() => setRetrait(null)}>Non</button>
                              </span>
                            ) : (
                              <button className="btn sm ghost" onClick={() => setRetrait(m.email)} title="Retirer l'accès" aria-label={`Retirer l'accès de ${m.nom || m.email}`}>
                                <Icon n="trash" size={14} />
                              </button>
                            ))}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="stack">
          {gerer && (
            <div className="card stack">
              <h2 className="section">Ajouter une personne</h2>
              <Field label="Nom">
                <input className="input" id="eq-nom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Narcie KANGOU" />
              </Field>
              <Field label="E-mail (sert d'identifiant)">
                <input className="input" id="eq-email" type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="narcie@lekangourou-cg.com" />
              </Field>
              <Field label="Rôle">
                <Chips small allowEmpty={false} options={rolesPermis.map((r) => ROLES[r])} value={ROLES[f.role]} onChange={(l) => setF({ ...f, role: roleDe(l) })} />
              </Field>
              <div className="small muted">{RESUME[f.role]}</div>
              <button className="btn primary" disabled={busy} onClick={ajouter}>
                <Icon n="plus" size={15} /> Ajouter
              </button>
              <div className="small muted">
                Ensuite, la personne ouvre le logiciel, touche « Première connexion ? Crée ton mot de passe » avec cet e-mail, et choisit son mot de passe.
              </div>
            </div>
          )}
          {admin && (
            <div className="card stack">
              <h2 className="section">Espace affiché</h2>
              <div className="small muted">Tu es dans l'espace « {profil.espace === 'demo' ? 'Démo (données fictives)' : 'Le Kangourou (vraies données)'} ». Les deux espaces sont séparés.</div>
              <div className="row">
                {[['kangourou', 'Le Kangourou'], ['demo', 'Démo']].map(([k, l]) => (
                  <button key={k} className={`btn ${profil.espace === k ? 'primary' : ''}`} disabled={profil.espace === k} onClick={async () => { await membres.setEspace(profil.email, k); window.location.hash = '/'; window.location.reload() }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <h2 className="section">Droits de chaque rôle</h2>
            <div className="table-wrap">
              <table className="t ztable droits-table">
                <thead>
                  <tr>
                    <th />
                    {['pdg', 'caisse', 'comptable'].map((r) => (
                      <th key={r} className="num">{ROLES[r].split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DROITS.map(([d, label]) => (
                    <tr key={d}>
                      <td className="small">{label}</td>
                      {['pdg', 'caisse', 'comptable'].map((r) => (
                        <td key={r} className="num">{droitDefaut(r, d) ? <Icon n="check" size={15} /> : <span className="muted">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {droitsDe && (
        <DroitsModal
          membre={droitsDe}
          onClose={() => setDroitsDe(null)}
          onSave={async (droits) => {
            const ok = await enregistrer(droitsDe, { droits }, 'Droits mis à jour ✓')
            if (ok) setDroitsDe(null)
            return ok
          }}
        />
      )}
    </>
  )
}
