import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Modal, Menu } from '../ui'
import FicheForm from './FicheForm'
import { QuickInsta } from './Insta'
import { Icon } from '../icons'
import { fmtDate, today, nowTime } from '../lib/dates'
import { doublonInsta } from '../lib/logic'
import { ligne, ligneRelance } from '../lib/insta'
import { addDays } from '../lib/dates'

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
      <FicheForm name={name} setName={setName} fiche={fiche} setFiche={setFiche} />
      <div className="ff-foot">
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn gold" disabled={busy || !name.trim()} onClick={save}>
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

// Actions sur plusieurs prospects cochés dans la liste
function ActionsGroupees({ choisis, etapes, vider }) {
  const { api, settings, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const ouverts = choisis.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu')
  const lancer = async (fn, msg) => {
    setBusy(true)
    try {
      await fn()
      toast(msg)
      vider()
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  const relances = () => lancer(() => api.addActions(ouverts.map((p) => ligneRelance(p, settings).row)), `${ouverts.length} relance${ouverts.length > 1 ? 's' : ''} notée${ouverts.length > 1 ? 's' : ''} ✓`)
  const programmer = (j) =>
    lancer(
      () => api.addActions(ouverts.map((p) => ligne(p.id, { canal: p.canal || 'DM', action: 'Note', notes: 'Relance programmée', date_relance: addDays(today(), j) }))),
      `Relance programmée le ${fmtDate(addDays(today(), j))} pour ${ouverts.length} prospect${ouverts.length > 1 ? 's' : ''} ✓`,
    )
  const passer = (cible) => {
    const i = etapes.indexOf(cible)
    const action = ACTION_ETAPE[i]
    // Seulement vers l'avant, sans toucher aux clients signés
    const ok = choisis.filter((p) => (cible === 'Perdu' ? p.niveau < 7 && p.etape !== 'Perdu' : p.etape !== 'Perdu' && i + 1 > p.niveau))
    if (!ok.length) return toast(`Aucun des prospects cochés ne peut passer à « ${cible} ».`, true)
    if (!window.confirm(`Noter « ${action} » pour ${ok.length} prospect${ok.length > 1 ? 's' : ''} ?${ok.length < choisis.length ? ` (${choisis.length - ok.length} ignoré${choisis.length - ok.length > 1 ? 's' : ''} : déjà plus loin)` : ''}`)) return
    lancer(() => api.addActions(ok.map((p) => ligne(p.id, { canal: p.canal || 'DM', action }))), `${ok.length} prospect${ok.length > 1 ? 's' : ''} passé${ok.length > 1 ? 's' : ''} à « ${cible} » ✓`)
  }
  const exporter = () => {
    const cols = [['Entreprise', (p) => p.name], ['Contact', (p) => p.fiche?.contact], ['Téléphone', (p) => p.fiche?.telephone], ['Instagram', (p) => p.fiche?.instagram], ['Secteur', (p) => p.fiche?.secteur], ['Ville', (p) => p.fiche?.ville], ['Canal', (p) => p.canal], ['Étape', (p) => p.etape], ['Score', (p) => p.score], ['Relance', (p) => p.relance], ['Montant proposé', (p) => p.montantPropose]]
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.map(([h]) => esc(h)).join(';'), ...choisis.map((p) => cols.map(([, f]) => esc(f(p))).join(';'))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `prospects-${today()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast(`${choisis.length} prospect${choisis.length > 1 ? 's' : ''} exporté${choisis.length > 1 ? 's' : ''} ✓`)
  }
  const supprimer = () => {
    if (!window.confirm(`Supprimer définitivement ${choisis.length} prospect${choisis.length > 1 ? 's' : ''} et tout leur historique ?`)) return
    lancer(async () => {
      for (const p of choisis) await api.deleteProspect(p.id)
    }, `${choisis.length} prospect${choisis.length > 1 ? 's' : ''} supprimé${choisis.length > 1 ? 's' : ''}`)
  }
  // Barre flottante en bas de l'écran (hors du tableau qui défile)
  return createPortal(
    <div className="bulk-bar" role="toolbar" aria-label="Actions sur la sélection">
      <span className="bulk-n">
        <Icon n="check" size={14} /> {choisis.length} sélectionné{choisis.length > 1 ? 's' : ''}
      </span>
      <button className="btn sm primary" disabled={busy || !ouverts.length} onClick={relances}>
        ✓ Relancés
      </button>
      <Menu
        label={<><Icon n="clock" size={14} /> Relance le…</>}
        className="btn sm"
        items={[
          ['Demain', () => programmer(1)],
          ['Dans 3 jours', () => programmer(3)],
          ['Dans 7 jours', () => programmer(7)],
          ['Dans 30 jours', () => programmer(30)],
        ].map(([l, f]) => ({ label: l, onClick: f, disabled: busy || !ouverts.length }))}
      />
      <Menu label={<><Icon n="layers" size={14} /> Passer à…</>} className="btn sm" items={etapes.filter((e) => e !== 'Nouveau' && e !== 'Gagné').map((e) => ({ label: e, onClick: () => passer(e), disabled: busy }))} />
      <button className="btn sm" onClick={exporter}>
        <Icon n="download" size={14} /> Exporter
      </button>
      <button className="btn sm danger" disabled={busy} onClick={supprimer}>
        <Icon n="trash" size={14} /> Supprimer
      </button>
      <button className="icon-btn" title="Tout désélectionner" onClick={vider}>
        ✕
      </button>
    </div>,
    document.body,
  )
}

export default function Prospects({ vue, etape: etapeDemandee }) {
  const { data, settings, openAction, toast } = useApp()
  const [survol, setSurvol] = useState(null)
  const deplacer = (id, cible) => {
    const p = data.byId[id]
    if (!p || p.etape === cible) return
    const i = settings.etapes.findIndex((e) => e.nom === cible)
    const action = ACTION_ETAPE[i]
    if (cible === 'Perdu' && p.niveau >= 7) return toast(`${p.name} est déjà client : pour l'arrêter, saisis plutôt une « Résiliation » dans sa fiche.`, true)
    if (!action || i === 0) return toast('Un prospect ne revient pas à « Nouveau » : annule plutôt ses étapes dans sa fiche.', true)
    if (cible !== 'Perdu' && p.etape !== 'Perdu' && i + 1 <= p.niveau)
      return toast(`${p.name} a déjà passé cette étape. Pour revenir en arrière, annule l'étape dans sa fiche.`, true)
    openAction({ prospect_id: p.id, action, canal: p.canal })
  }
  const [q, setQ] = useFiltre('q')
  // Sous-menu : l'étape demandée devient le filtre (la page est remontée à chaque lien)
  useState(() => etapeDemandee && (filtres.etape = etapeDemandee))
  const [etape, setEtape] = useFiltre('etape')
  const [canal, setCanal] = useFiltre('canal')
  const [sort, setSort] = useState(() => readPref('crm-sort', 'score'))
  const [view, setView] = useState(() => {
    if (vue === 'pipeline' || vue === 'liste') writePref('crm-view', vue)
    return vue === 'pipeline' || vue === 'liste' ? vue : readPref('crm-view', 'liste')
  })
  const [adding, setAdding] = useState(false)
  const [insta, setInsta] = useState(false)
  const etapes = settings.etapes.map((e) => e.nom)

  const counts = useMemo(() => {
    const c = { Tous: data.list.length, Actifs: data.list.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu').length }
    etapes.forEach((e) => (c[e] = data.list.filter((p) => p.etape === e).length))
    return c
  }, [data, etapes])

  const filtered = useMemo(() => filtrer(data.list, { q, etape, canal, sort }), [data, q, etape, canal, sort])
  const [sel, setSel] = useState(() => new Set())
  const choisis = filtered.filter((p) => sel.has(p.id))
  const cocher = (id) =>
    setSel((x) => {
      const n = new Set(x)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const tousCoches = filtered.length > 0 && choisis.length === filtered.length

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
                  <th className="sel-cell">
                    <input type="checkbox" aria-label="Tout sélectionner" checked={tousCoches} ref={(el) => el && (el.indeterminate = choisis.length > 0 && !tousCoches)} onChange={() => setSel(tousCoches ? new Set() : new Set(filtered.map((p) => p.id)))} />
                  </th>
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
                  <tr key={p.id} className={`click ${sel.has(p.id) ? 'sel' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
                    <td className="sel-cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={sel.has(p.id)} onChange={() => cocher(p.id)} />
                    </td>
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
            {choisis.length > 0 && <><div className="bulk-space" /><ActionsGroupees choisis={choisis} etapes={etapes} vider={() => setSel(new Set())} /></>}
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
