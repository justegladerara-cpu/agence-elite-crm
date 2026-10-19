import { useState } from 'react'
import { supabase } from '../lib/store'
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
        <button type="button" className="toggle-link" onClick={() => supabase.auth.signOut()}>
          Changer de compte
        </button>
      </form>
    </div>
  )
}

// Double authentification obligatoire (mode activé par le propriétaire) et aucun téléphone enrôlé :
// l'enrôlement se fait ici, avant d'ouvrir le CRM (la base refuse déjà les données sans lui).
function Enrolement({ onActive }) {
  const [enrol, setEnrol] = useState(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const commencer = async () => {
    setBusy(true)
    setErr('')
    const { data: l } = await supabase.auth.mfa.listFactors()
    for (const f of (l?.all || []).filter((x) => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Téléphone ${new Date().toISOString().slice(0, 10)}` })
    setBusy(false)
    if (error) return setErr('Activation impossible pour le moment. Réessaie dans quelques minutes.')
    setEnrol(data)
  }
  const valider = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrol.id, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (error) return setErr('Code incorrect. Vérifie l’heure de ton téléphone et réessaie.')
    // Les sessions ouvertes ailleurs avant l'activation sont fermées.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
    onActive()
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={valider}>
        <Logo full />
        <p className="login-tag">La double authentification est obligatoire pour l’équipe. Installe Google Authenticator ou Microsoft Authenticator, puis active-la.</p>
        {enrol ? (
          <>
            <img src={enrol.totp.qr_code} alt="QR code à scanner avec l'application d'authentification" width="180" height="180" style={{ background: '#fff', borderRadius: 8, alignSelf: 'center' }} />
            <div className="small">
              Clé : <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{enrol.totp.secret}</code>
            </div>
            <div className="field">
              <label htmlFor="code-enrol">Code à 6 chiffres</label>
              <input id="code-enrol" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Vérification…' : 'Activer'}
            </button>
          </>
        ) : (
          <button type="button" className="btn primary block" disabled={busy} onClick={commencer}>
            Activer la double authentification
          </button>
        )}
        {err && <div className="red small" role="alert">{err}</div>}
        <button type="button" className="toggle-link" onClick={() => supabase.auth.signOut()}>
          Changer de compte
        </button>
      </form>
    </div>
  )
}

export default function Login({ code, onCode, enrolement, onActive }) {
  if (enrolement) return <Enrolement onActive={onActive} />
  if (code) return <Code onCode={onCode} />
  return <Connexion />
}

function Connexion() {
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
        <Logo full />
        {getBrand().sousTitre && <div className="login-sub">{getBrand().sousTitre}</div>}
        {getBrand().accroche && <p className="login-tag">{getBrand().accroche}</p>}
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="login-mdp">Mot de passe</label>
          <input id="login-mdp" type="password" autoComplete={create ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="red small" role="alert">{err}</div>}
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
