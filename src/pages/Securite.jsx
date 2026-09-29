// Paramètres › Sécurité : sauvegarde des données, corbeille, double authentification et erreurs signalées
import { useEffect, useState } from 'react'
import { Field, confirmer } from '../ui'
import { useApp, useNoyau } from '../core/contexte'
import { Icon } from '../icons'
import { supabase, isLocal } from '../lib/store'
import { corbeille } from '../lib/corbeille'
import { today, fmtDate } from '../lib/dates'
import { derniereSauvegarde, telechargerSauvegarde } from '../lib/sauvegarde'

function Sauvegarde() {
  const ctx = useApp()
  const [date, setDate] = useState(derniereSauvegarde)
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic">
          <Icon n="download" size={16} />
        </span>
        Sauvegarde
      </h2>
      <p className="small muted">
        Télécharge une copie complète de tes données ({ctx.prospects.length} fiches, {ctx.actions.length} actions, {ctx.documents.length} documents). Garde-la dans ton Drive ou
        OneDrive. Ma journée te le rappelle si ta dernière sauvegarde date de plus de 7 jours.
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          onClick={() => {
            telechargerSauvegarde(ctx)
            setDate(today())
            ctx.toast('Sauvegarde téléchargée ✓')
          }}
        >
          <Icon n="download" size={15} /> Télécharger une sauvegarde
        </button>
        <span className="small muted">{date ? `Dernière sauvegarde sur cet appareil : ${fmtDate(date)}` : 'Aucune sauvegarde faite depuis cet appareil.'}</span>
      </div>
    </div>
  )
}

function Corbeille() {
  const { api } = useNoyau()
  const [liste, setListe] = useState(corbeille.liste)
  const restaurer = async (id) => {
    try {
      await api.restaurer(id)
    } catch {
      /* toast déjà affiché */
    }
    setListe(corbeille.liste())
  }
  const TYPE = { prospect: 'Fiche', action: 'Action', document: 'Document' }
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic">
          <Icon n="trash" size={16} />
        </span>
        Corbeille <span className="count">{liste.length}</span>
      </h2>
      <p className="small muted">Ce que tu supprimes reste ici 30 jours (sur cet appareil). Une fiche restaurée revient avec tout son historique.</p>
      <div className="list">
        {liste.length === 0 && <div className="empty">La corbeille est vide.</div>}
        {liste.map((x) => (
          <div key={x.id} className="list-item">
            <div className="li-main">
              <div className="li-title">{x.libelle}</div>
              <div className="li-sub">
                {TYPE[x.type] || 'Élément'} supprimé le {fmtDate(x.at.slice(0, 10))}
                {x.contenu.actions?.length && x.type === 'prospect' ? ` · ${x.contenu.actions.length} actions` : ''}
              </div>
            </div>
            <div className="li-side">
              <button className="btn sm" onClick={() => restaurer(x.id)}>
                <Icon n="rotate" size={14} /> Restaurer
              </button>
            </div>
          </div>
        ))}
      </div>
      {liste.length > 0 && (
        <button
          className="btn sm danger"
          style={{ marginTop: 10 }}
          onClick={async () => {
            if (!(await confirmer('Les éléments de la corbeille ne pourront plus être restaurés.', { titre: 'Vider la corbeille ?', ok: 'Vider', danger: true }))) return
            corbeille.vider()
            setListe([])
          }}
        >
          Vider la corbeille
        </button>
      )}
    </div>
  )
}

// Double authentification : code à 6 chiffres d'une application (Google Authenticator, Microsoft Authenticator…)
function DoubleAuth() {
  const { toast } = useNoyau()
  const [facteurs, setFacteurs] = useState(null)
  const [enrol, setEnrol] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const charger = () =>
    supabase.auth.mfa.listFactors().then(
      ({ data }) => setFacteurs((data?.totp || []).filter((f) => f.status === 'verified')),
      () => setFacteurs([]),
    )
  useEffect(() => {
    charger()
  }, [])
  const commencer = async () => {
    setBusy(true)
    // Un essai précédent non terminé bloque un nouvel enregistrement : on le retire
    const { data: l } = await supabase.auth.mfa.listFactors()
    for (const f of (l?.all || []).filter((f) => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Téléphone ${today()}` })
    setBusy(false)
    if (error) return toast(`Activation impossible : ${error.message}`, true)
    setEnrol(data)
  }
  const valider = async () => {
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrol.id, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (error) return toast('Code incorrect : vérifie l’heure de ton téléphone et réessaie.', true)
    setEnrol(null)
    setCode('')
    toast('Double authentification activée ✓')
    charger()
  }
  const retirer = async (f) => {
    if (!(await confirmer('Ton compte ne sera plus protégé par le code à 6 chiffres.', { titre: 'Désactiver la double authentification ?', ok: 'Désactiver', danger: true }))) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) return toast(error.message, true)
    toast('Double authentification désactivée')
    charger()
  }
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic">
          <Icon n="check-circle" size={16} />
        </span>
        Double authentification
      </h2>
      <p className="small muted">À la connexion, en plus du mot de passe, le CRM demande un code à 6 chiffres donné par une application sur ton téléphone. Même avec ton mot de passe, personne ne peut entrer sans ton téléphone.</p>
      {facteurs === null ? (
        <div className="small muted">Chargement…</div>
      ) : facteurs.length ? (
        facteurs.map((f) => (
          <div key={f.id} className="row" style={{ flexWrap: 'wrap' }}>
            <span className="badge b-green">Activée</span>
            <span className="small">{f.friendly_name || 'Application'}</span>
            <button className="btn sm danger" onClick={() => retirer(f)}>
              Désactiver
            </button>
          </div>
        ))
      ) : enrol ? (
        <div className="stack" style={{ gap: 12 }}>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Installe Google Authenticator ou Microsoft Authenticator sur ton téléphone.</li>
            <li>Dans l'application, ajoute un compte et scanne ce code (ou tape la clé).</li>
            <li>Tape le code à 6 chiffres affiché.</li>
          </ol>
          <img src={enrol.totp.qr_code} alt="QR code à scanner avec l'application d'authentification" width="180" height="180" style={{ background: '#fff', borderRadius: 8 }} />
          <div className="small">
            Clé : <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{enrol.totp.secret}</code>
          </div>
          <Field label="Code à 6 chiffres">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && valider()} />
          </Field>
          <div className="row">
            <button className="btn" onClick={() => setEnrol(null)}>
              Annuler
            </button>
            <button className="btn primary" disabled={busy || code.replace(/\s/g, '').length < 6} onClick={valider}>
              Activer
            </button>
          </div>
        </div>
      ) : (
        <button className="btn primary" disabled={busy} onClick={commencer}>
          Activer la double authentification
        </button>
      )}
    </div>
  )
}

// Erreurs rencontrées dans l'application (envoyées automatiquement)
function Erreurs() {
  const [liste, setListe] = useState(null)
  const charger = () =>
    supabase
      .from('client_errors')
      .select('id, message, page, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setListe(data || []), () => setListe([]))
  useEffect(() => {
    charger()
  }, [])
  const vider = async () => {
    await supabase.from('client_errors').delete().not('id', 'is', null)
    charger()
  }
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic">
          <Icon n="alert" size={16} />
        </span>
        Erreurs signalées <span className="count">{liste?.length ?? '…'}</span>
      </h2>
      <p className="small muted">Quand quelque chose plante dans le CRM, l'erreur est notée ici automatiquement, avec la page concernée. Utile pour la corriger sans avoir à la décrire.</p>
      <div className="list">
        {liste?.length === 0 && <div className="empty">Aucune erreur signalée.</div>}
        {liste?.map((e) => (
          <div key={e.id} className="list-item">
            <div className="li-main">
              <div className="li-title" style={{ whiteSpace: 'normal' }}>
                {e.message}
              </div>
              <div className="li-sub">
                {new Date(e.created_at).toLocaleString('fr-FR')} · {e.page || 'accueil'}
              </div>
            </div>
          </div>
        ))}
      </div>
      {liste?.length > 0 && (
        <button className="btn sm" style={{ marginTop: 10 }} onClick={vider}>
          Effacer la liste
        </button>
      )}
    </div>
  )
}

export default function Securite() {
  return (
    <>
      <Sauvegarde />
      <Corbeille />
      {!isLocal && <DoubleAuth />}
      {!isLocal && <Erreurs />}
    </>
  )
}
