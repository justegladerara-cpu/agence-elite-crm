import { useState } from 'react'
import { supabase } from '../lib/store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [create, setCreate] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    if (create) {
      if (password.length < 8) {
        setErr('Choisis un mot de passe d’au moins 8 caractères.')
        setBusy(false)
        return
      }
      const { error: e1 } = await supabase.auth.signUp({ email, password })
      if (e1) {
        setErr(/fermées|Database error/i.test(e1.message) ? 'Le compte existe déjà : connecte-toi.' : e1.message)
        setBusy(false)
        return
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message)
    setBusy(false)
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <div className="brand-name">AGENCE ELITE</div>
            <div className="brand-sub">CRM de pilotage</div>
          </div>
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" autoComplete={create ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="red small">{err}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Connexion…' : create ? 'Créer mon compte' : 'Se connecter'}
        </button>
        <button type="button" className="toggle-link" onClick={() => { setCreate(!create); setErr('') }}>
          {create ? 'J’ai déjà un compte' : 'Première connexion ? Crée ton mot de passe'}
        </button>
      </form>
    </div>
  )
}
