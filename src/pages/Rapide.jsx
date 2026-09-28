// Saisie rapide : noter une action en 1 à 3 touches quand on sait déjà de quelle fiche il s'agit,
// et feuille « Comment s'est passé l'appel ? » au retour d'un appel lancé depuis le CRM
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, StageBadge, sym } from '../ui'
import { today, nowTime, addDays, fmtDate, weekday } from '../lib/dates'

// Actions proposées selon l'étape de la fiche (les autres restent dans le formulaire complet)
const SUGGESTIONS = {
  Nouveau: ['Premier contact', 'Relance', 'Qualification', 'Échange / suivi', 'Loom envoyé', 'Perdu'],
  Contacté: ['Relance', 'Échange / suivi', 'Qualification', 'Loom envoyé', 'RDV', 'Perdu'],
  Qualifié: ['Relance', 'Audit réalisé', 'Loom envoyé', 'Démo présentée', 'RDV', 'Perdu'],
  'Audit/Démo': ['Relance', 'RDV', 'Démo présentée', 'Proposition envoyée', 'Échange / suivi', 'Perdu'],
  RDV: ['Proposition envoyée', 'Relance', 'Échange / suivi', 'Signature', 'Perdu'],
  Proposition: ['Relance', 'Échange / suivi', 'Signature', 'Perdu'],
  Gagné: ['Paiement reçu', 'Intervention', 'Échange / suivi', 'Vente additionnelle', 'Satisfaction client', "Demande d'avis Google"],
  Perdu: ['Premier contact', 'Relance', 'Échange / suivi', 'Note'],
}
const MONEY = ['Proposition envoyée', 'Signature', 'Paiement reçu', 'Vente additionnelle', 'Intervention']
const RESULTATS = ['Pas de réponse', 'Rappeler', 'Intéressé', 'RDV pris', 'Pas intéressé']

// Lundi prochain (ou dans 7 jours si on est lundi)
export const lundiProchain = (d = today()) => addDays(d, ((8 - weekday(d)) % 7) || 7)
const RELANCES = [
  ['Auto', ''],
  ['Demain', 1],
  ['J+2', 2],
  ['J+5', 5],
  ['Lundi', 'lundi'],
]
const dateRelance = (v) => (v === '' ? '' : v === 'lundi' ? lundiProchain() : addDays(today(), v))

// Action de prospection à noter pour un appel : premier contact la première fois, relance ensuite
export const actionAppel = (p) => (p.tentatives > 0 || p.etape !== 'Nouveau' ? 'Relance' : 'Premier contact')

export function QuickForm({ prospectId, canal: canalInit, action: actionInit, onDone, onComplet }) {
  const { data, settings, api, toast } = useApp()
  const p = data.byId[prospectId]
  const sugg = (SUGGESTIONS[p?.etape] || SUGGESTIONS.Nouveau).filter((a) => data.L.act[a])
  const [canal, setCanal] = useState(canalInit || (p?.etape === 'Gagné' ? '' : p?.canal || 'Appel'))
  const [action, setAction] = useState(actionInit || sugg[0] || '')
  const [resultat, setResultat] = useState('')
  const [relance, setRelance] = useState('')
  const [montant, setMontant] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  if (!p) return null
  const prospection = !!data.L.act[action]?.prospection
  const resultats = RESULTATS.filter((r) => settings.resultats.some((x) => x.nom === r))
  const suite = !['Signature', 'Perdu'].includes(action)

  const save = async () => {
    if (!action) return toast('Choisis une action', true)
    if (prospection && !canal) return toast('Choisis le canal', true)
    setBusy(true)
    try {
      const d = dateRelance(relance)
      const [row] = await api.addActions([
        {
          prospect_id: p.id,
          date: today(),
          time: nowTime(),
          canal,
          action,
          resultat,
          montant,
          notes,
          date_relance: suite ? d : '',
          prochaine_action: d && suite ? (resultat === 'Rappeler' ? 'Rappeler' : 'Relancer') : '',
        },
      ])
      toast(`Noté pour ${p.name} : ${action} ✓`, false, { annuler: () => api.deleteAction(row.id, { silencieux: true }) })
      onDone?.()
    } catch {
      /* toast déjà affiché */
    }
    setBusy(false)
  }

  return (
    <div className="rapide">
      <div className="rapide-tete">
        <div className="li-main">
          <div className="li-title">{p.name}</div>
          <div className="li-sub">{[p.fiche?.contact, p.fiche?.telephone].filter(Boolean).join(' · ') || 'Fiche sans contact'}</div>
        </div>
        <StageBadge etape={p.etape} />
      </div>
      <fieldset className="rapide-bloc">
        <legend>Canal</legend>
        <div className="chips">
          {settings.canaux.map((c) => (
            <button key={c} type="button" className={`chip ${canal === c ? 'on' : ''}`} aria-pressed={canal === c} onClick={() => setCanal(canal === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="rapide-bloc">
        <legend>Action</legend>
        <div className="chips">
          {sugg.map((a) => (
            <button key={a} type="button" className={`chip ${action === a ? 'on' : ''}`} aria-pressed={action === a} onClick={() => setAction(a)}>
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      {(prospection || resultat) && (
        <fieldset className="rapide-bloc">
          <legend>Résultat</legend>
          <div className="chips">
            {resultats.map((r) => (
              <button key={r} type="button" className={`chip ${resultat === r ? 'on' : ''}`} aria-pressed={resultat === r} onClick={() => setResultat(resultat === r ? '' : r)}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {MONEY.includes(action) && (
        <label className="rapide-bloc">
          <span className="rapide-l">Montant ({sym()})</span>
          <input className="input" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Laisser vide : prix de l'offre" />
        </label>
      )}
      {suite && (
        <fieldset className="rapide-bloc">
          <legend>Prochaine relance</legend>
          <div className="chips">
            {RELANCES.map(([l, v]) => (
              <button key={l} type="button" className={`chip ${relance === v ? 'on' : ''}`} aria-pressed={relance === v} onClick={() => setRelance(v)}>
                {l}
                {v !== '' && <span className="chip-date">{fmtDate(dateRelance(v))}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <label className="rapide-bloc">
        <span className="rapide-l">Note (facultatif)</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce qu'il faut retenir" />
      </label>
      <div className="rapide-pied">
        <button type="button" className="btn ghost" onClick={() => onComplet({ prospect_id: p.id, canal, action })}>
          Formulaire complet
        </button>
        <button type="button" className="btn gold lg" disabled={busy} onClick={save}>
          <Icon n="check" size={16} /> Enregistrer
        </button>
      </div>
    </div>
  )
}

const CHOIX_APPEL = [
  { id: 'rien', label: 'Pas de réponse', ico: 'clock', resultat: 'Pas de réponse', jours: 1, suite: 'Rappeler' },
  { id: 'rappeler', label: 'Rappeler', ico: 'repeat', resultat: 'Rappeler', jours: 2, suite: 'Rappeler' },
  { id: 'interesse', label: 'Intéressé', ico: 'check-circle', resultat: 'Intéressé', jours: 2, suite: 'Envoyer le Loom' },
  { id: 'non', label: 'Pas intéressé', ico: 'x', resultat: 'Pas intéressé', jours: 0 },
]

// Feuille après appel : 1 touche pour noter le résultat et programmer la suite
export function AppelSheet({ prospectId, onDone, onDetails }) {
  const { data, api, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const p = data.byId[prospectId]
  const choix = CHOIX_APPEL
  const noter = async (c) => {
    if (!p || busy) return
    setBusy(true)
    try {
      const d = c.jours ? addDays(today(), c.jours) : ''
      const [row] = await api.addActions([
        { prospect_id: p.id, date: today(), time: nowTime(), canal: 'Appel', action: actionAppel(p), resultat: c.resultat, date_relance: d, prochaine_action: d ? c.suite : '' },
      ])
      toast(d ? `${c.label} noté ✓ Relance le ${fmtDate(d)}` : `${c.label} noté ✓`, false, { annuler: () => api.deleteAction(row.id, { silencieux: true }) })
      onDone()
    } catch {
      /* toast déjà affiché */
    }
    setBusy(false)
  }
  const noterRef = useRef(noter)
  useEffect(() => {
    noterRef.current = noter
  })
  // Touches 1 à 4 : résultat de l'appel au clavier
  useEffect(() => {
    const k = (e) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < 4 && !e.ctrlKey && !e.metaKey) noterRef.current(CHOIX_APPEL[i])
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (!p) return null
  return (
    <div className="rapide">
      <div className="rapide-tete">
        <div className="li-main">
          <div className="li-title">{p.name}</div>
          <div className="li-sub">{[p.fiche?.contact, p.fiche?.telephone].filter(Boolean).join(' · ')}</div>
        </div>
        <StageBadge etape={p.etape} />
      </div>
      <div className="appel-choix">
        {choix.map((c, i) => (
          <button key={c.id} type="button" className={`appel-btn ${c.id}`} disabled={busy} onClick={() => noter(c)} aria-keyshortcuts={String(i + 1)}>
            <Icon n={c.ico} size={20} />
            <span>{c.label}</span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <div className="rapide-pied">
        <button type="button" className="btn ghost" onClick={onDone}>
          Ne rien noter
        </button>
        <button type="button" className="btn" onClick={() => onDetails({ prospect_id: p.id, canal: 'Appel', action: actionAppel(p) })}>
          Plus de détails
        </button>
      </div>
    </div>
  )
}
