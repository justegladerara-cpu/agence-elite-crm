// Interface partagée du module Plateforme : formulaire de connexion (aussi porte d'entrée du CRM).
import { useState } from 'react'
import { Field } from '../../ui'
import { connecter, verifierCode } from './connexion'

// Formulaire de connexion à la plateforme (aussi utilisé comme porte d'entrée du CRM).
// Deux étapes si le compte a la double authentification : mot de passe, puis code à 6 chiffres.
export function ConnexionPlateforme({ onConnecte, titre = 'Connecter la plateforme' }) {
  const [identifiant, setIdentifiant] = useState('')
  const [mdp, setMdp] = useState('')
  const [code, setCode] = useState('')
  const [etape, setEtape] = useState('mot_de_passe')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const envoyer = async (e) => {
    e.preventDefault()
    setOccupe(true)
    setErreur('')
    try {
      const r = etape === 'code' ? await verifierCode(code) : await connecter(identifiant, mdp)
      setMdp('')
      setCode('')
      if (r?.etape === 'code') {
        setEtape('code')
        return
      }
      onConnecte?.()
    } catch (err) {
      setErreur(err.message)
      setCode('')
    } finally {
      setOccupe(false)
    }
  }
  if (etape === 'code') {
    return (
      <form className="card stack pf-connexion" onSubmit={envoyer}>
        <h2 className="section">Double authentification</h2>
        <p className="small muted">Tape le code à 6 chiffres affiché dans ton application d’authentification (compte « Agence Elite »).</p>
        <Field label="Code à 6 chiffres">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus required />
        </Field>
        {erreur && (
          <p className="pf-erreur" role="alert">
            {erreur}
          </p>
        )}
        <button className="btn primary block" disabled={occupe}>
          {occupe ? 'Vérification…' : 'Valider'}
        </button>
      </form>
    )
  }
  return (
    <form className="card stack pf-connexion" onSubmit={envoyer}>
      <h2 className="section">{titre}</h2>
      <p className="small muted">Identifiant et mot de passe du compte super admin de saas.agence-elite.fr, puis le code à 6 chiffres. La connexion reste active dans cet onglet.</p>
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

