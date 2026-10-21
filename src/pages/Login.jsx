import { useState } from 'react'
import { supabase } from '../lib/store'
import { quitter } from '../modules/plateforme'
import { Logo } from '../icons'
import { getBrand } from '../lib/theme'

// Deuxième étape de connexion : code de l'application d'authentification
function Code({ onCode }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { data } = await supabase.auth.mfa.listFactors()
    const f = (data?.totp || []).find((x) => x.status === 'verified')
    const { error } = f ? await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.replace(/\s/g, '') }) : { error: { message: 'Aucune application enregistrée' } }
    setBusy(false)
    if (error) return setErr('Code incorrect. Vérifie l’heure de ton téléphone et réessaie.')
    onCode()
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <Logo full />
        <p className="login-tag">Tape le code à 6 chiffres affiché dans ton application d'authentification.</p>
        <div className="field">
          <label htmlFor="code-2fa">Code</label>
          <input id="code-2fa" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        {err && <div className="red small" role="alert">{err}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Vérification…' : 'Valider'}
        </button>
        <button type="button" className="toggle-link" onClick={() => quitter(() => supabase.auth.signOut())}>
          Changer de compte
        </button>
      </form>
    </div>
  )
}

export default function Login({ code, onCode }) {
  if (code) return <Code onCode={onCode} />
  return <Connexion />
}

function Connexion() {
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
        <Logo full />
        {getBrand().sousTitre && <div className="login-sub">{getBrand().sousTitre}</div>}
        {getBrand().accroche && <p className="login-tag">{getBrand().accroche}</p>}
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="login-mdp">Mot de passe</label>
          <input id="login-mdp" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="red small" role="alert">{err}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        {/* Pas d'inscription depuis l'écran de connexion (SEC-14) : un compte se crée dans le tableau de bord Supabase */}
      </form>
    </div>
  )
}
