import { useState } from 'react'
import { supabase } from '../lib/store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
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
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="red small">{err}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
