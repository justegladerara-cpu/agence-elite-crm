// Paramètres › Membres : qui a accès à l'espace de travail, avec quel rôle. Les contrôles sont faits en base.
import { useCallback, useEffect, useState } from 'react'
import { confirmer } from '../ui'
import { useNoyau } from '../core/contexte'
import { supabase, isLocal, espaceActif, choisirEspace } from '../lib/store'

const ROLES = { proprietaire: 'Propriétaire', admin: 'Admin', membre: 'Membre', lecteur: 'Lecteur' }
const AIDE = 'Membre : ajoute et modifie les fiches, actions, devis et factures. Lecteur : consulte seulement. Admin : gère aussi les membres.'

export default function Membres() {
  const { toast } = useNoyau()
  const [etat, setEtat] = useState(isLocal ? { local: true } : null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('membre')

  const charger = useCallback(async () => {
    if (isLocal) return
    try {
      const moi = (await supabase.auth.getSession()).data?.session?.user?.id
      const actif = await espaceActif()
      const [{ data: espaces }, { data: adhesions }, { data: membres, error }] = await Promise.all([
        supabase.from('workspaces').select('id, nom').order('created_at'),
        supabase.from('workspace_members').select('workspace_id, role').eq('user_id', moi),
        supabase.rpc('membres_espace', { w: actif }),
      ])
      if (error) throw error
      const monRole = (adhesions || []).find((a) => a.workspace_id === actif)?.role
      setEtat({ moi, actif, espaces: espaces || [], membres: membres || [], monRole })
    } catch (e) {
      setEtat({ erreur: e.message })
    }
  }, [])
  useEffect(() => {
    charger()
  }, [charger])

  const appel = async (fn, args, ok) => {
    const { error } = await supabase.rpc(fn, args)
    if (error) return toast(error.message, true)
    toast(ok)
    charger()
  }
  const inviter = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.rpc('inviter_membre', { w: etat.actif, p_email: email, p_role: role })
    if (error) return toast(error.message, true)
    toast(data === 'ajoute' ? `${email} ajouté ✓` : `Invitation enregistrée : ${email} pourra créer son compte ✓`)
    setEmail('')
    charger()
  }

  if (!etat) return <div className="card">Chargement…</div>
  if (etat.local) return <div className="card small muted">Les membres demandent la version en ligne.</div>
  if (etat.erreur) return <div className="card small">Membres indisponibles : {etat.erreur}</div>
  const gere = ['proprietaire', 'admin'].includes(etat.monRole)
  const nomEspace = etat.espaces.find((w) => w.id === etat.actif)?.nom

  return (
    <div className="stack">
      {etat.espaces.length > 1 && (
        <div className="card">
          <h2 className="section">Espace de travail</h2>
          <select className="input" aria-label="Espace de travail" value={etat.actif} onChange={(e) => {
              try {
                choisirEspace(e.target.value)
              } catch (err) {
                toast(err.message, true)
              }
            }}>
            {etat.espaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nom}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="card">
        <h2 className="section">Membres · {nomEspace}</h2>
        <p className="small muted" style={{ marginTop: 0 }}>{AIDE}</p>
        <div className="list">
          {etat.membres.map((m) => {
            const modifiable = gere && !m.en_attente && m.role !== 'proprietaire' && m.user_id !== etat.moi && (etat.monRole === 'proprietaire' || m.role !== 'admin')
            return (
              <div key={m.user_id || m.email} className="list-item">
                <div className="li-main">
                  <div className="li-title">{m.email}</div>
                  <div className="li-sub">{m.en_attente ? `Invité (${ROLES[m.role]}) · compte pas encore créé` : ROLES[m.role]}{m.user_id === etat.moi && ' · toi'}</div>
                </div>
                <div className="li-side row" style={{ gap: 6 }}>
                  {modifiable && (
                    <select className="input" aria-label={`Rôle de ${m.email}`} value={m.role} onChange={(e) => appel('changer_role', { w: etat.actif, u: m.user_id, p_role: e.target.value }, 'Rôle modifié ✓')}>
                      {(etat.monRole === 'proprietaire' ? ['admin', 'membre', 'lecteur'] : ['membre', 'lecteur']).map((r) => (
                        <option key={r} value={r}>
                          {ROLES[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  {modifiable && (
                    <button className="btn sm" onClick={async () => (await confirmer(`Retirer ${m.email} de l'espace ?`, { ok: 'Retirer' })) && appel('retirer_membre', { w: etat.actif, u: m.user_id }, 'Membre retiré ✓')}>
                      Retirer
                    </button>
                  )}
                  {gere && m.en_attente && (
                    <button className="btn sm" onClick={() => appel('annuler_invitation', { w: etat.actif, p_email: m.email }, 'Invitation annulée ✓')}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {gere && (
        <form className="card" onSubmit={inviter}>
          <h2 className="section">Inviter quelqu'un</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input className="input" type="email" required placeholder="adresse e-mail" aria-label="E-mail à inviter" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <select className="input" aria-label="Rôle" value={role} onChange={(e) => setRole(e.target.value)}>
              {(etat.monRole === 'proprietaire' ? ['admin', 'membre', 'lecteur'] : ['membre', 'lecteur']).map((r) => (
                <option key={r} value={r}>
                  {ROLES[r]}
                </option>
              ))}
            </select>
            <button className="btn primary" type="submit">
              Inviter
            </button>
          </div>
          <p className="tiny muted">La personne crée son compte avec cette adresse sur la page de connexion ; elle rejoint l'espace automatiquement.</p>
        </form>
      )}
    </div>
  )
}
