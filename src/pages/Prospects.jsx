import { useMemo, useState } from 'react'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Modal, Field } from '../ui'
import { FicheInput } from './Saisie'
import { FICHE_FIELDS } from '../lib/defaults'
import { fmtDate, today, nowTime } from '../lib/dates'

function readPref(k, d) {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
function writePref(k, v) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

export function NewProspect({ onClose }) {
  const { api, data, toast } = useApp()
  const [name, setName] = useState('')
  const [fiche, setFiche] = useState({})
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const n = name.trim()
    if (!n) return toast("Nom de l'entreprise manquant", true)
    if (data.list.some((p) => p.name.toLowerCase() === n.toLowerCase())) return toast('Ce prospect existe déjà', true)
    setBusy(true)
    try {
      const p = await api.addProspect(n, fiche)
      await api.addActions([{ prospect_id: p.id, date: today(), time: nowTime(), action: 'Ajout prospect' }])
      toast('Prospect ajouté ✓')
      onClose()
      go(`/prospect/${p.id}`)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Modal title="Nouveau prospect" onClose={onClose}>
      <div className="card">
        <Field label="Entreprise">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="form-grid" style={{ marginTop: 12 }}>
          {FICHE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <FicheInput f={f} value={fiche[f.key]} onChange={(v) => setFiche((s) => ({ ...s, [f.key]: v }))} />
            </Field>
          ))}
        </div>
        <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          Ajouter le prospect
        </button>
      </div>
    </Modal>
  )
}

export default function Prospects() {
  const { data, settings } = useApp()
  const [q, setQ] = useState('')
  const [etape, setEtape] = useState('Actifs')
  const [canal, setCanal] = useState('Tous')
  const [sort, setSort] = useState(() => readPref('crm-sort', 'score'))
  const [view, setView] = useState(() => readPref('crm-view', 'liste'))
  const [adding, setAdding] = useState(false)
  const etapes = settings.etapes.map((e) => e.nom)

  const counts = useMemo(() => {
    const c = { Tous: data.list.length, Actifs: data.list.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu').length }
    etapes.forEach((e) => (c[e] = data.list.filter((p) => p.etape === e).length))
    return c
  }, [data, etapes])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let l = data.list.filter((p) => {
      if (etape === 'Actifs' && (p.etape === 'Gagné' || p.etape === 'Perdu')) return false
      if (etape !== 'Actifs' && etape !== 'Tous' && p.etape !== etape) return false
      if (canal !== 'Tous' && p.canal !== canal) return false
      if (!s) return true
      const f = p.fiche || {}
      return [p.name, f.contact, f.telephone, f.ville, f.secteur, f.instagram].some((x) => (x || '').toLowerCase().includes(s))
    })
    const cmp = {
      score: (a, b) => b.score - a.score,
      relance: (a, b) => (a.relance || '9999').localeCompare(b.relance || '9999'),
      recent: (a, b) => (b.derniereAction || '').localeCompare(a.derniereAction || ''),
      ajout: (a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''),
      nom: (a, b) => a.name.localeCompare(b.name, 'fr'),
    }[sort]
    return l.sort(cmp)
  }, [data, q, etape, canal, sort])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Prospects</h1>
          <div className="sub">
            {counts.Actifs} en cours · {counts['Gagné'] || 0} gagnés · {counts.Perdu || 0} perdus
          </div>
        </div>
        <div className="row">
          <div className="tabs">
            {['liste', 'pipeline'].map((v) => (
              <button
                key={v}
                className={view === v ? 'on' : ''}
                onClick={() => {
                  setView(v)
                  writePref('crm-view', v)
                }}
              >
                {v === 'liste' ? 'Liste' : 'Pipeline'}
              </button>
            ))}
          </div>
          <button className="btn gold" onClick={() => setAdding(true)}>
            + Nouveau prospect
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row filters" style={{ marginBottom: 12 }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Rechercher : nom, contact, téléphone, ville…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="Tous">Tous les canaux</option>
            {settings.canaux.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {view === 'liste' && (
            <select
              className="input"
              style={{ width: 'auto' }}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                writePref('crm-sort', e.target.value)
              }}
            >
              <option value="score">Tri : score de priorité</option>
              <option value="relance">Tri : prochaine relance</option>
              <option value="recent">Tri : dernière action</option>
              <option value="ajout">Tri : date d'ajout</option>
              <option value="nom">Tri : nom</option>
            </select>
          )}
        </div>
        {view === 'liste' && (
          <div className="chips">
            {['Actifs', 'Tous', ...etapes].map((e) => (
              <button key={e} className={`chip sm ${etape === e ? 'on' : ''}`} onClick={() => setEtape(e)}>
                {e} <span className="muted" style={{ color: 'inherit', opacity: 0.7 }}>{counts[e] || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'liste' ? (
        <div className="card">
          <div className="list">
            {filtered.length === 0 && <Empty>Aucun prospect ici.</Empty>}
            {filtered.map((p) => (
              <div key={p.id} className="list-item click" onClick={() => go(`/prospect/${p.id}`)}>
                <Score v={p.score} />
                <div className="li-main">
                  <div className="li-title">{p.name}</div>
                  <div className="li-sub">
                    {[p.fiche?.contact, p.fiche?.secteur, p.fiche?.ville, p.canal].filter(Boolean).join(' · ')}
                    {p.derniereAction ? ` · dernière action ${fmtDate(p.derniereAction)}` : ''}
                  </div>
                  <div className="row" style={{ marginTop: 6, gap: 6 }}>
                    <StageBadge etape={p.etape} />
                    <RelanceTag date={p.relance} heure={p.heureRappel} />
                    {p.alerte && <span className={`badge ${p.alerte.startsWith('Relance') ? 'b-red' : 'b-orange'}`}>{p.alerte}</span>}
                    {p.montantPropose ? <span className="badge b-gold">{eur(p.montantPropose)}</span> : null}
                  </div>
                </div>
                <div className="li-side">
                  <ContactButtons p={p} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="kanban">
          {etapes.map((e) => {
            const col = data.list
              .filter((p) => p.etape === e && (canal === 'Tous' || p.canal === canal))
              .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
              .sort((a, b) => b.score - a.score)
            const total = col.reduce((m, p) => m + (Number(p.montantPropose) || 0), 0)
            return (
              <div className="kanban-col" key={e}>
                <h3>
                  <span>{e}</span>
                  <span className="muted">
                    {col.length}
                    {total ? ` · ${eur(total)}` : ''}
                  </span>
                </h3>
                {col.slice(0, 60).map((p) => (
                  <div className="kcard" key={p.id} onClick={() => go(`/prospect/${p.id}`)}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <b style={{ fontSize: 14 }}>{p.name}</b>
                      <Score v={p.score} />
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      {[p.fiche?.contact, p.canal].filter(Boolean).join(' · ')}
                    </div>
                    <div className="row" style={{ marginTop: 6, gap: 4 }}>
                      <RelanceTag date={p.relance} />
                      {p.alerte && !p.alerte.startsWith('Relance') && <span className="badge b-orange">{p.alerte}</span>}
                    </div>
                  </div>
                ))}
                {col.length > 60 && <div className="tiny muted">+ {col.length - 60} autres</div>}
              </div>
            )
          })}
        </div>
      )}
      {adding && <NewProspect onClose={() => setAdding(false)} />}
    </div>
  )
}
