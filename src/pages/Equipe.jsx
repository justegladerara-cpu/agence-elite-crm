import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Empty, Chips } from '../ui'
import { membres, ROLES } from '../lib/store'

const DROITS = {
  superadmin: 'Tout : réglages, équipe, rôles, ventes, finances.',
  pdg: 'Tableau de bord complet, ventes, dépenses, factures, stock. Peut aussi vendre.',
  caisse: 'Caisse, factures, devis, reçus, paiements et articles. Ne voit pas les finances.',
  comptable: 'Tableau de bord, factures, paiements et dépenses. Ne vend pas.',
}

export default function Equipe() {
  const { profil, toast } = useApp()
  const admin = profil.role === 'superadmin'
  const [liste, setListe] = useState(null)
  const [f, setF] = useState({ email: '', nom: '', role: 'caisse' })
  const [busy, setBusy] = useState(false)
  const charger = () => membres.list().then(setListe).catch((e) => toast(`Équipe : ${e.message}`, true))
  useEffect(() => {
    charger()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const libelles = Object.values(ROLES)
  const roleDe = (l) => Object.keys(ROLES).find((k) => ROLES[k] === l)
  const ajouter = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast("Indique l'e-mail de la personne", true)
    if (!f.nom.trim()) return toast('Indique son nom', true)
    setBusy(true)
    try {
      await membres.save(f)
      toast(`${f.nom} ajouté(e) ✓`)
      setF({ email: '', nom: '', role: 'caisse' })
      await charger()
    } catch (e) {
      toast(`Ajout impossible : ${e.message}`, true)
    }
    setBusy(false)
  }
  const changerRole = async (m, role) => {
    try {
      await membres.save({ ...m, role })
      await charger()
      toast('Rôle mis à jour ✓')
    } catch (e) {
      toast(`Modification impossible : ${e.message}`, true)
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
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Équipe et accès</h1>
          <div className="sub">Chaque personne a son propre compte. Son rôle décide de ce qu'elle voit.</div>
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
                    <th>E-mail</th>
                    <th>Rôle</th>
                    {admin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((m) => (
                    <tr key={m.email}>
                      <td className="strong">{m.nom || '—'}</td>
                      <td>{m.email}</td>
                      <td>
                        {admin && m.email !== profil.email ? (
                          <select className="input sm" value={m.role} onChange={(e) => changerRole(m, e.target.value)} aria-label={`Rôle de ${m.nom}`}>
                            {Object.entries(ROLES).map(([k, l]) => (
                              <option key={k} value={k}>{l}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge role-${m.role}`}>{ROLES[m.role]}</span>
                        )}
                      </td>
                      {admin && (
                        <td style={{ textAlign: 'right' }}>
                          {m.email !== profil.email && (
                            <button className="btn sm ghost" onClick={() => retirer(m)} title="Retirer l'accès">
                              <Icon n="trash" size={14} />
                            </button>
                          )}
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
          {admin && (
            <div className="card stack">
              <h2 className="section">Ajouter une personne</h2>
              <Field label="Nom">
                <input className="input" id="eq-nom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Narcie KANGOU" />
              </Field>
              <Field label="E-mail (sert d'identifiant)">
                <input className="input" id="eq-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="narcie@lekangourou-cg.com" />
              </Field>
              <Field label="Rôle">
                <Chips small allowEmpty={false} options={libelles} value={ROLES[f.role]} onChange={(l) => setF({ ...f, role: roleDe(l) })} />
              </Field>
              <div className="small muted">{DROITS[f.role]}</div>
              <button className="btn primary" disabled={busy} onClick={ajouter}>
                <Icon n="plus" size={15} /> Ajouter
              </button>
              <div className="small muted">
                Ensuite, la personne ouvre le logiciel, touche « Première connexion ? Crée ton mot de passe » avec cet e-mail, et choisit son mot de passe.
              </div>
            </div>
          )}
          <div className="card">
            <h2 className="section">Ce que chaque rôle peut faire</h2>
            <div className="stack" style={{ gap: 8 }}>
              {Object.entries(ROLES).map(([k, l]) => (
                <div key={k}>
                  <span className={`badge role-${k}`}>{l}</span>
                  <div className="small muted" style={{ marginTop: 4 }}>{DROITS[k]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
