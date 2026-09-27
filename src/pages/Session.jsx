import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, StageBadge, Score, ContactButtons, Empty, go, Select, Field } from '../ui'
import { today, nowTime, fmtDate } from '../lib/dates'

// Session d'appels chronométrée : enchaîne les relances du jour puis les prospects les plus chauds.
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}h ` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Session() {
  const { data, settings, api, toast } = useApp()
  const [queue, setQueue] = useState(null)
  const [idx, setIdx] = useState(0)
  const [start, setStart] = useState(null)
  const [callStart, setCallStart] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [log, setLog] = useState([])
  const [note, setNote] = useState('')
  const [objection, setObjection] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!start) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [start])

  const candidates = useMemo(() => {
    const seen = new Set()
    return [...data.aRelancer, ...data.chauds, ...data.list.filter((p) => ['Nouveau', 'Contacté', 'Qualifié'].includes(p.etape) && !p.stop).sort((a, b) => b.score - a.score)]
      .filter((p) => p.fiche?.telephone && p.etape !== 'Gagné' && p.etape !== 'Perdu')
      .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
  }, [data])

  const begin = () => {
    setQueue(candidates.map((p) => p.id))
    setIdx(0)
    const t = Date.now()
    setNow(t)
    setStart(t)
    setCallStart(t)
    setLog([])
  }
  const next = () => {
    setIdx((i) => i + 1)
    const t = Date.now()
    setNow(t)
    setCallStart(t)
    setNote('')
    setObjection('')
  }

  const p = queue && queue[idx] ? data.byId[queue[idx]] : null
  const reponses = log.filter((l) => data.L.res[l.resultat]?.reponse).length
  const elapsedH = start ? (now - start) / 3600000 : 0

  const record = async (resultat) => {
    if (!p) return
    setBusy(true)
    try {
      const duree = Math.max(1, Math.round((Date.now() - callStart) / 60000))
      await api.addActions([
        {
          prospect_id: p.id,
          date: today(),
          time: nowTime(),
          canal: 'Appel',
          action: p.tentatives === 0 ? 'Premier contact' : 'Relance',
          resultat,
          duree,
          objection: objection || null,
          notes: note || null,
        },
      ])
      setLog((l) => [...l, { name: p.name, resultat, duree }])
      toast(`${p.name} : ${resultat}`)
      next()
    } catch {
      /* toast déjà affiché */
    }
    setBusy(false)
  }

  if (!start)
    return (
      <div className="stack">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>Session d'appels</h1>
            <div className="sub">Chronométrée : relances du jour d'abord, puis les prospects les plus chauds. Un clic sur le résultat enregistre l'appel.</div>
          </div>
          <button className="btn ghost" onClick={() => go('/journee')}>
            ← Ma journée
          </button>
        </div>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            <b>{candidates.length}</b> prospect{candidates.length > 1 ? 's' : ''} à appeler (avec un numéro de téléphone).
          </p>
          <button className="btn gold" disabled={!candidates.length} onClick={begin}>
            <Icon n="play" size={14} /> Démarrer la session
          </button>
        </div>
      </div>
    )

  const stats = (
    <div className="grid grid-4">
      {[
        ['Temps', fmt(now - start)],
        ['Appels', log.length],
        ['Réponses', reponses],
        ['Appels / heure', elapsedH > 0.01 ? Math.round(log.length / elapsedH) : '—'],
      ].map(([k, v]) => (
        <div className="kpi" key={k}>
          <div className="kpi-label">{k}</div>
          <div className="kpi-value">{v}</div>
        </div>
      ))}
    </div>
  )

  if (!p)
    return (
      <div className="stack">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>Session terminée</h1>
        </div>
        {stats}
        <div className="card">
          <div className="list">
            {log.length === 0 && <Empty>Aucun appel enregistré.</Empty>}
            {log.map((l, i) => (
              <div className="list-item" key={i}>
                <div className="li-main">
                  <div className="li-title">{l.name}</div>
                  <div className="li-sub">
                    {l.resultat} · {l.duree} min
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn gold" onClick={() => go('/journee')}>
              Retour à Ma journée
            </button>
            <button className="btn" onClick={() => setStart(null)}>
              Nouvelle session
            </button>
          </div>
        </div>
      </div>
    )

  const f = p.fiche || {}
  const last = p.acts[p.acts.length - 1]
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Session d'appels</h1>
          <div className="sub">
            Prospect {idx + 1} sur {queue.length}
          </div>
        </div>
        <button className="btn" onClick={() => setQueue((q) => q.slice(0, idx))}>
          ■ Terminer
        </button>
      </div>
      {stats}
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="li-main">
            <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: 24 }}>{p.name}</h2>
            <div className="muted" style={{ marginTop: 4 }}>
              {[f.contact && `${f.contact}${f.fonction ? ` (${f.fonction})` : ''}`, f.secteur, f.ville].filter(Boolean).join(' · ')}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <StageBadge etape={p.etape} />
              <Score v={p.score} />
              <span className="badge b-navy">{p.tentatives} tentative{p.tentatives > 1 ? 's' : ''}</span>
              {f.pub_active === 'Oui' && <span className="badge b-gold">Pub Insta active</span>}
              {f.standard && <span className="badge b-Nouveau">Standard : {f.standard}</span>}
            </div>
            {last && (
              <div className="small muted" style={{ marginTop: 8 }}>
                Dernière action : {last.action}
                {last.resultat ? ` → ${last.resultat}` : ''} ({fmtDate(last.date)}){last.notes ? ` · « ${last.notes} »` : ''}
              </div>
            )}
          </div>
          <div className="right">
            <div className="tiny muted">Appel en cours</div>
            <div className="bold" style={{ fontSize: 22 }}>{fmt(now - callStart)}</div>
          </div>
        </div>
        <a className="btn primary block" style={{ marginTop: 14, fontSize: 18, padding: 14 }} href={`tel:${f.telephone.replace(/\s/g, '')}`}>
          <Icon n="phone" size={18} /> Appeler {f.telephone}
        </a>
        <div className="row" style={{ marginTop: 8 }}>
          <ContactButtons p={p} />
          <button className="btn sm ghost" onClick={() => go(`/prospect/${p.id}`)}>
            Voir la fiche
          </button>
        </div>
        <div className="form-block">
          <div className="form-label">Résultat de l'appel</div>
          <div className="chips">
            {settings.resultats.map((r) => (
              <button key={r.nom} className="chip" disabled={busy} onClick={() => record(r.nom)}>
                {r.nom}
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Objection (si refus)">
              <Select value={objection} onChange={setObjection} options={settings.objections} />
            </Field>
            <Field label="Note rapide">
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={next}>
              Passer sans enregistrer →
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <details className="script">
          <summary><span className="sec-ic"><Icon n="phone" size={16} /></span> Script d'appel</summary>
          {settings.script.map((s, i) => (
            <p key={i}>
              <b>{s.titre} :</b> {s.texte}
            </p>
          ))}
        </details>
      </div>
    </div>
  )
}
