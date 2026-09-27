import { useMemo, useState } from 'react'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Modal, Field, Menu } from '../ui'
import { FicheInput } from './Saisie'
import { QuickInsta } from './Insta'
import { Icon } from '../icons'
import { FICHE_FIELDS } from '../lib/defaults'
import { fmtDate, today, nowTime } from '../lib/dates'
import { doublonInsta } from '../lib/logic'

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
    const d = doublonInsta(data.list, fiche.instagram)
    if (d) return toast(`Ce compte Instagram est déjà celui de « ${d.name} »`, true)
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

// Filtres gardés entre la liste et la vue côte à côte
const filtres = { q: '', etape: 'Actifs', canal: 'Tous' }
function useFiltre(k) {
  const [v, setV] = useState(filtres[k])
  return [
    v,
    (x) => {
      filtres[k] = x
      setV(x)
    },
  ]
}
const TRIS = {
  score: (a, b) => b.score - a.score,
  relance: (a, b) => (a.relance || '9999').localeCompare(b.relance || '9999'),
  recent: (a, b) => (b.derniereAction || '').localeCompare(a.derniereAction || ''),
  ajout: (a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''),
  nom: (a, b) => a.name.localeCompare(b.name, 'fr'),
}
function filtrer(list, { q, etape, canal, sort }) {
  const s = q.trim().toLowerCase()
  return list
    .filter((p) => {
      if (etape === 'Actifs' && (p.etape === 'Gagné' || p.etape === 'Perdu')) return false
      if (etape !== 'Actifs' && etape !== 'Tous' && p.etape !== etape) return false
      if (canal !== 'Tous' && p.canal !== canal) return false
      if (!s) return true
      const f = p.fiche || {}
      return [p.name, f.contact, f.telephone, f.ville, f.secteur, f.instagram].some((x) => (x || '').toLowerCase().includes(s))
    })
    .sort(TRIS[sort] || TRIS.score)
}

// Liste réduite à gauche de la fiche (vue côte à côte, grand écran)
export function MiniListe({ current }) {
  const { data } = useApp()
  const [q, setQ] = useFiltre('q')
  const [insta, setInsta] = useState(false)
  const estClient = data.clients.some((c) => c.id === current)
  const liste = useMemo(() => {
    if (estClient) {
      const s = q.trim().toLowerCase()
      return data.clients.map((c) => c.prospect).filter((p) => p && (!s || p.name.toLowerCase().includes(s)))
    }
    const l = filtrer(data.list, { ...filtres, q, sort: readPref('crm-sort', 'score') })
    const cur = data.byId[current]
    return cur && !l.includes(cur) ? [cur, ...l] : l
  }, [data, q, current, estClient])
  return (
    <aside className="mini-list">
      <div className="ml-head">
        <button className="ml-title" onClick={() => go(estClient ? '/clients' : '/prospects')}>
          {estClient ? 'Clients' : filtres.etape === 'Actifs' ? 'Prospects actifs' : filtres.etape === 'Tous' ? 'Tous les prospects' : filtres.etape}
          <span className="pt-count">{liste.length}</span>
        </button>
        {!estClient && (
          <button className="btn gold sm" title="Nouveau prospect Instagram" onClick={() => setInsta(true)}>
            + Nouveau
          </button>
        )}
      </div>
      <input className="input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ml-items">
        {liste.map((p) => (
          <button key={p.id} className={`ml-item ${p.id === current ? 'on' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
            <span className="ml-name">{p.name}</span>
            <span className="ml-sub">
              <span className={`dot-e e-${p.etape.replace(/[^A-Za-zéèÉ]/g, '')}`} />
              {p.etape}
              {p.relance ? ` · ${fmtDate(p.relance)}` : ''}
            </span>
          </button>
        ))}
      </div>
      {insta && <QuickInsta onClose={() => setInsta(false)} />}
    </aside>
  )
}

// Action à saisir pour faire passer un prospect à une étape (glisser-déposer dans le pipeline)
const ACTION_ETAPE = ['Ajout prospect', 'Premier contact', 'Qualification', 'Loom envoyé', 'RDV', 'Proposition envoyée', 'Signature', 'Perdu']

export default function Prospects() {
  const { data, settings, openAction, toast } = useApp()
  const [survol, setSurvol] = useState(null)
  const deplacer = (id, cible) => {
    const p = data.byId[id]
    if (!p || p.etape === cible) return
    const i = settings.etapes.findIndex((e) => e.nom === cible)
    const action = ACTION_ETAPE[i]
    if (!action || i === 0) return toast('Un prospect ne revient pas à « Nouveau » : annule plutôt ses étapes dans sa fiche.', true)
    if (cible !== 'Perdu' && p.etape !== 'Perdu' && i + 1 <= p.niveau)
      return toast(`${p.name} a déjà passé cette étape. Pour revenir en arrière, annule l'étape dans sa fiche.`, true)
    openAction({ prospect_id: p.id, action, canal: p.canal })
  }
  const [q, setQ] = useFiltre('q')
  const [etape, setEtape] = useFiltre('etape')
  const [canal, setCanal] = useFiltre('canal')
  const [sort, setSort] = useState(() => readPref('crm-sort', 'score'))
  const [view, setView] = useState(() => readPref('crm-view', 'liste'))
  const [adding, setAdding] = useState(false)
  const [insta, setInsta] = useState(false)
  const etapes = settings.etapes.map((e) => e.nom)

  const counts = useMemo(() => {
    const c = { Tous: data.list.length, Actifs: data.list.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu').length }
    etapes.forEach((e) => (c[e] = data.list.filter((p) => p.etape === e).length))
    return c
  }, [data, etapes])

  const filtered = useMemo(() => filtrer(data.list, { q, etape, canal, sort }), [data, q, etape, canal, sort])

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
          <button className="btn gold" onClick={() => setInsta(true)}>
            <Icon n="instagram" size={15} /> + Prospect Instagram
          </button>
          <button className="btn" onClick={() => setAdding(true)}>
            + Fiche complète
          </button>
        </div>
      </div>

      <div className="card flush">
        <div className="list-tools">
        <div className="row filters" >
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
        filtered.length === 0 ? (
          <Empty>Aucun prospect ici.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t zt">
              <thead>
                <tr>
                  <th className="num">Score</th>
                  <th>Prospect</th>
                  <th>Étape</th>
                  <th className="hide-m">Canal</th>
                  <th className="hide-m">Relance</th>
                  <th className="num hide-m">Montant</th>
                  <th className="hide-m" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="click" onClick={() => go(`/prospect/${p.id}`)}>
                    <td className="num">
                      <Score v={p.score} />
                    </td>
                    <td className="ell-cell">
                      <div className="bold ell">{p.name}</div>
                      <div className="tiny muted ell">
                        {[p.fiche?.contact, p.fiche?.secteur, p.fiche?.ville].filter(Boolean).join(' · ')}
                        {p.alerte && <span className={`t-alert ${p.alerte.startsWith('Relance') ? 'red' : 'orange'}`}> · {p.alerte}</span>}
                      </div>
                    </td>
                    <td>
                      <StageBadge etape={p.etape} />
                    </td>
                    <td className="hide-m">{p.canal || '—'}</td>
                    <td className="hide-m">{p.relance ? <RelanceTag date={p.relance} heure={p.heureRappel} /> : <span className="muted">—</span>}</td>
                    <td className="num hide-m">{p.montantPropose ? eur(p.montantPropose) : ''}</td>
                    <td className="hide-m">
                      <ContactButtons p={p} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
        <div className="tiny muted" style={{ padding: '10px 16px 0' }}>Glisse une carte dans une autre colonne (ou utilise son menu) pour saisir l'étape correspondante.</div>
        <div className="kanban">
          {etapes.map((e) => {
            const col = data.list
              .filter((p) => p.etape === e && (canal === 'Tous' || p.canal === canal))
              .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
              .sort((a, b) => b.score - a.score)
            const total = col.reduce((m, p) => m + (Number(p.montantPropose) || 0), 0)
            return (
              <div
                className={`kanban-col ${survol === e ? 'drop' : ''}`}
                key={e}
                onDragOver={(ev) => {
                  ev.preventDefault()
                  if (survol !== e) setSurvol(e)
                }}
                onDragLeave={(ev) => !ev.currentTarget.contains(ev.relatedTarget) && setSurvol(null)}
                onDrop={(ev) => {
                  ev.preventDefault()
                  setSurvol(null)
                  deplacer(ev.dataTransfer.getData('text/plain'), e)
                }}
              >
                <h3>
                  <span>{e}</span>
                  <span className="muted">
                    {col.length}
                    {total ? ` · ${eur(total)}` : ''}
                  </span>
                </h3>
                {col.slice(0, 60).map((p) => (
                  <div
                    className="kcard"
                    key={p.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData('text/plain', p.id)
                      ev.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => go(`/prospect/${p.id}`)}
                    title="Glisse la carte dans une autre colonne pour changer d'étape"
                  >
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <b style={{ fontSize: 14 }} className="ell">{p.name}</b>
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }} onClick={(ev) => ev.stopPropagation()}>
                        <Score v={p.score} />
                        <Menu
                          label=""
                          icon="menu"
                          className="icon-btn kmove"
                          items={etapes.filter((x) => x !== e && x !== 'Nouveau').map((x) => ({ label: `Passer à « ${x} »`, onClick: () => deplacer(p.id, x) }))}
                        />
                      </div>
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
        </>
      )}
      </div>
      {adding && <NewProspect onClose={() => setAdding(false)} />}
      {insta && <QuickInsta onClose={() => setInsta(false)} />}
    </div>
  )
}
