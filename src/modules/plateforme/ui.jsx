// Interface partagée du module Plateforme : formulaire de connexion (aussi porte d'entrée du CRM).
import { useState } from 'react'
import { Field } from '../../ui'
import { connecter } from './connexion'

// Formulaire de connexion à la plateforme (aussi utilisé comme porte d'entrée du CRM)
export function ConnexionPlateforme({ onConnecte, titre = 'Connecter la plateforme' }) {
  const [identifiant, setIdentifiant] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const envoyer = async (e) => {
    e.preventDefault()
    setOccupe(true)
    setErreur('')
    try {
      await connecter(identifiant, mdp)
      setMdp('')
      onConnecte?.()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setOccupe(false)
    }
  }
  return (
    <form className="card stack pf-connexion" onSubmit={envoyer}>
      <h2 className="section">{titre}</h2>
      <p className="small muted">Identifiant et mot de passe du compte super admin de saas.agence-elite.fr. La connexion reste active sur cet appareil.</p>
      <Field label="Identifiant ou e-mail">
        <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field label="Mot de passe">
        <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
      </Field>
      {erreur && (
        <p className="pf-erreur" role="alert">
          {erreur}
        </p>
      )}
      <button className="btn primary block" disabled={occupe}>
        {occupe ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  )
}

