// Ma journée « Rule of 100 » : objectifs du jour, compteurs rapides, score, to-do et historique
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { Bar, Modal, Field, go, nb } from '../ui'
import { useDonnees, useNoyau } from '../core/contexte'
import { today, fmtDate } from '../lib/dates'
import { QuickInsta } from './Insta'
import { SOURCES, jourId, journeeVue, avancement, compterJour, historique, objectifsParDefaut } from '../modules/commercial/journee'

const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v))

// Journée du jour : modifications appliquées tout de suite, enregistrées une demi-seconde plus tard
export function useJournee(date = today()) {
  const { documents } = useDonnees()
  const { settings, api } = useNoyau()
  const vue = journeeVue(documents, settings, date)
  const [local, setLocal] = useState(null)
  const [localDate, setLocalDate] = useState(date)
  if (localDate !== date) {
    // Passage à minuit : on repart de la nouvelle journée
    setLocalDate(date)
    setLocal(null)
  }
  const pending = useRef(null)
  const timer = useRef(null)
  const version = useRef(0)
  const save = (data) => {
    const v = version.current
    pending.current = null
    return api
      .saveDoc({ id: jourId(date), type: 'journee', numero: date, prospect_id: null, data })
      .then(() => version.current === v && setLocal(null))
      .catch(() => {})
  }
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (pending.current) save(pending.current)
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const jour = local || vue.data
  const update = (fn) => {
    const next = fn(jour)
    version.current++
    pending.current = next
    setLocal(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(next), 500)
  }
  return { jour, update, existe: !!vue.doc }
}

function ScoreRing({ score }) {
  const r = 44
  const c = 2 * Math.PI * r
  const v = Math.min(100, score)
  return (
    <div className={`score-ring ${score >= 100 ? 'win' : ''}`}>
      <svg viewBox="0 0 100 100" width="104" height="104">
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="val" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="score-txt">
        <b>{score}</b>
        <span>/ 100</span>
      </div>
    </div>
  )
}

// ---------- Bloc principal (dans le bandeau) ----------
export function ObjectifsJour({ jour, update }) {
  const { data, documents } = useDonnees()
  const { settings } = useNoyau()
  const t = today()
  const [edit, setEdit] = useState(false)
  const [insta, setInsta] = useState(false)
  const counts = useMemo(() => compterJour(data, t), [data, t])
  const av = avancement(jour, counts)
  const hist = useMemo(() => historique(documents, settings, data, 30), [documents, settings, data])
  const plus = (nom, k) =>
    update((j) => ({ ...j, compteurs: { ...j.compteurs, [nom]: Math.max(-counts[j.objectifs.find((o) => o.nom === nom)?.source] || 0, num(j.compteurs?.[nom]) + k) } }))

  return (
    <>
      <div className="obj-head">
        <ScoreRing score={av.score} />
        <div className="obj-meta">
          <div className="obj-kicker">Score du jour</div>
          <div className="obj-big">
            {nb(av.volume)} action{av.volume > 1 ? 's' : ''} <span>/ {nb(av.cible)}</span>
          </div>
          <div className="obj-streak">
            {hist.serie > 0 ? (
              <>
                <Icon n="flame" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {hist.serie} jour{hist.serie > 1 ? 's' : ''} d'affilée
              </>
            ) : (
              'Atteins 100 pour lancer ta série'
            )}
          </div>
        </div>
      </div>

      <div className={`principal ${jour.principalFait ? 'done' : ''}`}>
        {jour.principal ? (
          <label>
            <input type="checkbox" checked={!!jour.principalFait} onChange={(e) => update((j) => ({ ...j, principalFait: e.target.checked }))} />
            <span>
              <small>Objectif n°1 du jour</small>
              {jour.principal}
            </span>
          </label>
        ) : (
          <button className="linkish" onClick={() => setEdit(true)}>
            + Écrire mon objectif n°1 du jour
          </button>
        )}
      </div>

      <div className="obj-grid">
        {av.lignes.map((l) => (
          <div className={`goal-mini ${l.fait >= l.cible && l.cible > 0 ? 'ok' : ''}`} key={l.nom}>
            <div className="l">{l.nom}</div>
            <div className="v">
              {nb(l.fait)} <span className="c">/ {nb(l.cible)}</span>
            </div>
            <Bar value={l.fait} max={l.cible || 1} />
            <div className="obj-btns">
              <button onClick={() => plus(l.nom, -1)} title="Retirer 1">
                −
              </button>
              <button onClick={() => plus(l.nom, 1)}>+1</button>
              <button onClick={() => plus(l.nom, 10)}>+10</button>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn gold" onClick={() => setEdit(true)}>
          <Icon n="target" size={15} /> Définir mes objectifs du jour
        </button>
        <button className="btn ghost-light" onClick={() => setInsta(true)}>
          <Icon n="instagram" size={14} /> + Prospect Instagram
        </button>
        <button className="btn ghost-light" onClick={() => go('/session')}>
          <Icon n="play" size={14} /> Session d'appels
        </button>
      </div>
      {insta && <QuickInsta onClose={() => setInsta(false)} />}
      <div className="tiny" style={{ color: 'var(--on-dark-2)', marginTop: 8 }}>
        Tes saisies (DM, appels, relances…) se comptent toutes seules. Les boutons +1 / +10 ajoutent le volume que tu n'as pas saisi un par un.
      </div>

      {edit && (
        <Modal title={`Mes objectifs du ${fmtDate(t)}`} onClose={() => setEdit(false)}>
          <ObjectifsForm
            jour={jour}
            onSave={(patch) => {
              update((j) => ({ ...j, ...patch }))
              setEdit(false)
            }}
            defaut={objectifsParDefaut(settings)}
          />
        </Modal>
      )}
    </>
  )
}

function ObjectifsForm({ jour, defaut, onSave }) {
  const [objs, setObjs] = useState(() => jour.objectifs.map((o) => ({ ...o })))
  const [principal, setPrincipal] = useState(jour.principal || '')
  const set = (i, patch) => setObjs((l) => l.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const valider = () => {
    const propres = objs.filter((o) => o.nom.trim()).map((o) => ({ ...o, nom: o.nom.trim(), cible: num(String(o.cible).replace(',', '.')) }))
    const noms = propres.map((o) => o.nom)
    if (new Set(noms).size !== noms.length) return window.alert('Deux objectifs ont le même nom.')
    onSave({ objectifs: propres, principal: principal.trim() })
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Objectif n°1 du jour (la chose la plus importante)">
        <input placeholder="Ex. Signer Groupe 7M" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
      </Field>
      <div className="form-label" style={{ marginBottom: -6 }}>
        Objectifs chiffrés d'aujourd'hui
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="obj-edit obj-edit-head">
          <span>Objectif</span>
          <span>Cible</span>
          <span>Compté automatiquement</span>
          <span />
        </div>
        {objs.map((o, i) => (
          <div className="obj-edit" key={i}>
            <input className="input" placeholder="Objectif" value={o.nom} onChange={(e) => set(i, { nom: e.target.value })} />
            <input className="input" inputMode="numeric" value={o.cible} onChange={(e) => set(i, { cible: e.target.value })} />
            <select className="input" value={o.source} onChange={(e) => set(i, { source: e.target.value })}>
              {SOURCES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <button className="icon-btn" title="Retirer" aria-label="Retirer" onClick={() => setObjs((l) => l.filter((_, j) => j !== i))}>
              <Icon n="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn sm" onClick={() => setObjs((l) => [...l, { nom: '', cible: 1, source: 'manuel' }])}>
          + Ajouter un objectif
        </button>
        <button className="btn ghost sm" onClick={() => setObjs(defaut.map((o) => ({ ...o })))}>
          Remettre mes objectifs habituels
        </button>
      </div>
      <div className="tiny muted">Ces chiffres valent pour aujourd'hui seulement. Tes objectifs habituels se règlent dans Paramètres.</div>
      <button className="btn gold" onClick={valider}>
        Enregistrer pour aujourd'hui
      </button>
    </div>
  )
}

// ---------- To-do list du jour ----------
export function TodoJour({ jour, update }) {
  const { data } = useDonnees()
  const [txt, setTxt] = useState('')
  const taches = jour.taches || []
  const faites = taches.filter((x) => x.fait).length
  const relances = data.aRelancer.length
  const ajouter = (e) => {
    e.preventDefault()
    if (!txt.trim()) return
    update((j) => ({ ...j, taches: [...(j.taches || []), { id: `t${Date.now()}`, texte: txt.trim(), fait: false }] }))
    setTxt('')
  }
  const toggle = (id) => update((j) => ({ ...j, taches: j.taches.map((x) => (x.id === id ? { ...x, fait: !x.fait } : x)) }))
  const suppr = (id) => update((j) => ({ ...j, taches: j.taches.filter((x) => x.id !== id) }))
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="target" size={16} /></span> To-do du jour{' '}
        <span className="count">
          {faites}/{taches.length}
        </span>
      </h2>
      <div className="todo">
        <div className={`todo-item auto ${relances === 0 ? 'fait' : ''}`}>
          <input type="checkbox" checked={relances === 0} readOnly />
          <span>{relances === 0 ? 'Toutes les relances du jour sont faites' : `Faire mes ${relances} relance${relances > 1 ? 's' : ''} du jour`}</span>
          <span className="todo-tag">auto</span>
        </div>
        {taches.map((x) => (
          <div className={`todo-item ${x.fait ? 'fait' : ''}`} key={x.id}>
            <input type="checkbox" checked={!!x.fait} onChange={() => toggle(x.id)} />
            <span onClick={() => toggle(x.id)}>{x.texte}</span>
            {x.routine && <span className="todo-tag">routine</span>}
            {x.report > 0 && <span className="todo-tag orange">reportée</span>}
            {!x.routine && (
              <button className="todo-del" title="Supprimer" aria-label="Supprimer" onClick={() => suppr(x.id)}>
                <Icon n="x" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }} onSubmit={ajouter}>
        <input className="input" placeholder="Ajouter une tâche pour aujourd'hui…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button className="btn gold" type="submit">
          Ajouter
        </button>
      </form>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        La routine revient chaque matin (réglable dans Paramètres). Une tâche non faite passe au lendemain.
      </div>
    </div>
  )
}

// ---------- Historique 30 jours ----------
export function HistoriqueJours() {
  const { data, documents } = useDonnees()
  const { settings } = useNoyau()
  const h = useMemo(() => historique(documents, settings, data, 30), [documents, settings, data])
  const ton = (j) => (j.off ? 'off' : j.score >= 100 ? 'win' : j.score >= 50 ? 'mid' : j.score > 0 ? 'low' : 'zero')
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="calendar" size={16} /></span> Mes 30 derniers jours
      </h2>
      <div className="heat">
        {h.jours.map((j) => (
          <div key={j.date} className={`heat-d ${ton(j)} ${j.today ? 'today' : ''}`} title={`${fmtDate(j.date)} : ${j.score}/100 · ${j.volume} actions`}>
            {Number(j.date.slice(8))}
          </div>
        ))}
      </div>
      <div className="heat-leg tiny muted">
        <span className="heat-d win" /> objectifs atteints <span className="heat-d mid" /> plus de 50 % <span className="heat-d low" /> moins de 50 %{' '}
        <span className="heat-d off" /> jour off
      </div>
      <div className="info-grid" style={{ marginTop: 12 }}>
        <div>
          <div className="k">Série en cours</div>
          <div className="v">
            <Icon n="flame" size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {h.serie} j
          </div>
        </div>
        <div>
          <div className="k">Jours réussis</div>
          <div className="v">{h.reussis} / 30</div>
        </div>
        <div>
          <div className="k">Volume moyen / jour</div>
          <div className="v">{nb(h.moyenne)}</div>
        </div>
      </div>
    </div>
  )
}

