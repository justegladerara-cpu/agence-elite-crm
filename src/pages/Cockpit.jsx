// Cockpit de pilotage (Tableau de bord › Vue d'ensemble) : santé, chiffres clés, tendance, parcours de l'amont
// à l'aval, centre d'attention, activité en direct, qualité des données et tableau détaillé.
// Tous les chiffres viennent des données du CRM (lib/cockpit.js, mêmes règles que les listes de détail).
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, eur, pct, nb, court, go, sym } from '../ui'
import { Gauge, useWidth } from '../charts'
import { computeStats } from '../lib/logic'
import { detail } from '../lib/drill'
import { METRIQUES, agreger, somme, pasPour, objectifPeriode, anomalies, parcours, sante, qualite } from '../lib/cockpit'
import { echeancesEntre } from '../lib/tresorerie'
import { facturesImpayees } from '../modules/facturation'
import { modalPour } from '../lib/tresorerie'
import { supabase, isLocal } from '../lib/store'
import { today, addDays, diffDays, fmtDate, fmtMonth, parse, monthKey } from '../lib/dates'

// ---------- Filtres gardés dans l'adresse (vue partageable) ----------
export function paramsUrl() {
  const h = window.location.hash
  const i = h.indexOf('?')
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '')
}
export function ecrireUrl(maj) {
  const [chemin] = (window.location.hash || '#/dashboard').split('?')
  const q = paramsUrl()
  Object.entries(maj).forEach(([k, v]) => (v === null || v === undefined || v === '' ? q.delete(k) : q.set(k, v)))
  const s = q.toString()
  try {
    window.history.replaceState(window.history.state, '', `${chemin}${s ? `?${s}` : ''}`)
  } catch {
    /* adresse non modifiable (aperçu) */
  }
}

// ---------- Vues : Complète, Direction, Opérations (personnalisables, gardées sur l'appareil) ----------
const WIDGETS = {
  kpis: 'Chiffres clés',
  attention: "Centre d'attention",
  sante: 'Score de santé',
  tendance: 'Tendance',
  activite: 'Activité récente',
  parcours: "Parcours de l'amont à l'aval",
  canaux: 'Performance par canal',
  objectifs: 'Objectifs du mois',
  qualite: 'Qualité des données',
  detail: 'Tableau détaillé',
}
const VUES = {
  complete: { nom: 'Complète', ids: ['kpis', 'attention', 'sante', 'tendance', 'activite', 'parcours', 'canaux', 'objectifs', 'qualite', 'detail'] },
  direction: { nom: 'Direction', ids: ['kpis', 'sante', 'attention', 'tendance', 'objectifs', 'parcours'] },
  operations: { nom: 'Opérations', ids: ['attention', 'activite', 'parcours', 'kpis', 'qualite', 'detail', 'canaux'] },
}
const CLE_VUES = 'crm-cockpit-vues'
function lireVues() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_VUES) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}
function ecrireVues(v) {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify(v))
  } catch {
    /* stockage indisponible */
  }
}

const fmtDe = (k) => (METRIQUES[k]?.argent ? eur : nb)
const pct1 = (v) => `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0).replace('.', ',')} %`
const signe = (v, fmt) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`
const heure = (t) => (t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '')

// ---------- Micro-tendance ----------
function Spark({ vals, label }) {
  const pts = vals.filter((v) => v !== null)
  if (pts.length < 3) return null
  const W = 96
  const H = 26
  const max = Math.max(1, ...pts)
  const x = (i) => (i / (pts.length - 1)) * (W - 4) + 2
  const y = (v) => H - 3 - (v / max) * (H - 6)
  return (
    <svg className="ck-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="2.6" fill="currentColor" />
    </svg>
  )
}

// ---------- Chiffre clé ----------
// Montant trop long pour la tuile : abrégé (1,25 Md FCFA), le montant exact reste au survol
export const compact = (fmt) => (v) => {
  const s = fmt(v)
  return s.length > 12 ? `${court(v)}${fmt === eur ? ` ${sym()}` : ''}` : s
}
function KpiTile({ label, cur, prev, fmt: fmtBrut, vs, objectif, projection, spark, sub, onClick }) {
  const fmt = compact(fmtBrut)
  const comp = prev !== null && prev !== undefined && !(prev === 0 && cur === 0)
  const diff = comp ? cur - prev : 0
  // Variation en % seulement si la période précédente est positive et l'écart lisible (sinon l'écart brut)
  const p = comp && prev > 0 && Math.abs(diff / prev) < 10 ? diff / prev : null
  const sens = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const atteint = objectif ? cur / objectif : null
  return (
    <button type="button" className="ck-kpi" onClick={onClick}>
      <span className="ck-kpi-l">{label}</span>
      <span className={`ck-kpi-v ${fmt(cur).length > 10 ? 'long' : ''}`} title={fmtBrut(cur)}>
        {fmt(cur)}
      </span>
      <span className="ck-kpi-comp">
        {comp && (
          <span className={`ck-delta ${sens}`}>
            {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {p !== null ? pct1(Math.abs(p)) : !diff ? 'stable' : prev === 0 ? 'nouveau' : signe(diff, fmt)}
          </span>
        )}
        {comp && (
          <span className="ck-prev">
            {vs} : {fmt(prev)} ({signe(diff, fmt)})
          </span>
        )}
        {!comp && <span className="ck-prev">Rien à comparer</span>}
      </span>
      {objectif ? (
        <span className="ck-obj">
          <span className="ck-obj-t">
            Objectif {fmt(Math.round(objectif))} · écart {signe(Math.round(cur - objectif), fmt)}
          </span>
          <span className="ck-obj-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, atteint * 100)}%` }} className={atteint >= 1 ? 'ok' : ''} />
          </span>
          {projection !== null && projection !== undefined && <span className="ck-obj-t">Projection fin de période : {fmt(Math.round(projection))}</span>}
        </span>
      ) : (
        sub && <span className="ck-kpi-sub">{sub}</span>
      )}
      {spark}
    </button>
  )
}

// ---------- Graphique principal : période, période précédente, moyenne, objectif ----------
function niceStep(max) {
  const raw = max / 4
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) || p
}
const libCase = (b, pas, court_) => {
  const d = parse(b.date)
  if (pas === 'mois') return fmtMonth(b.date.slice(0, 7))
  if (pas === 'semaine') return `Semaine du ${fmtDate(b.date)}`
  return court_ ? `${d.getDate()}/${d.getMonth() + 1}` : fmtDate(b.date)
}
function Tendance({ cases, prev, pas, metrique, cumul, objectif, sel, jour, signatures, vs, onPick }) {
  const [box, W] = useWidth(720)
  const [hover, setHover] = useState(null)
  const fmt = fmtDe(metrique)
  const H = W < 520 ? 210 : 260
  const pad = { l: 46, r: 12, t: 14, b: 28 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const n = cases.length
  const passe = (b) => b.date <= jour
  const cumuler = (arr) => {
    let s = 0
    return arr.map((v) => (v === null ? null : (s += v)))
  }
  const brut = cases.map((b) => (passe(b) ? b[metrique] : null))
  const vals = cumul ? cumuler(brut) : brut
  const prevVals = prev ? (cumul ? cumuler(prev.map((b) => b[metrique])) : prev.map((b) => b[metrique])) : null
  const reels = brut.filter((v) => v !== null)
  const moyenne = !cumul && reels.length ? reels.reduce((m, v) => m + v, 0) / reels.length : null
  const objCase = objectif ? (cumul ? null : objectif / n) : null
  const max = Math.max(1, ...vals.filter((v) => v !== null), ...(prevVals || []).slice(0, n).filter((v) => v !== null), cumul && objectif ? objectif : 0, objCase || 0)
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v) => pad.t + ih - (v / top) * ih
  const ticks = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)
  const dernier = vals.reduce((m, v, i) => (v !== null ? i : m), -1)
  const every = Math.max(1, Math.ceil(n / (W < 520 ? 6 : 12)))
  const ligne = (arr) =>
    arr
      .map((v, i) => (v === null || i >= n ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(' ')
  const record = reels.length > 2 ? brut.indexOf(Math.max(...reels)) : -1
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1)))))
  }
  const hb = hover !== null ? cases[hover] : null
  const hv = hover !== null ? vals[hover] : null
  const hp = hover !== null && prevVals ? prevVals[hover] : null
  const selIdx = sel ? cases.findIndex((b) => b.date <= sel.au && b.fin >= sel.du) : -1
  const aire = dernier > 0 ? `${x(0)},${y(0)} ${ligne(vals.slice(0, dernier + 1))} ${x(dernier)},${y(0)}` : ''
  return (
    <div className="ck-trend" ref={box}>
      <div style={{ position: 'relative' }}>
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${METRIQUES[metrique].long || METRIQUES[metrique].label} ${cumul ? 'cumulé' : 'par ' + pas}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => e.touches[0] && onMove({ currentTarget: e.currentTarget, clientX: e.touches[0].clientX })}
          onClick={() => hover !== null && passe(cases[hover]) && onPick(cases[hover])}
          style={{ cursor: 'pointer' }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="ck-grid" />
              <text x={pad.l - 6} y={y(v) + 4} fontSize="10.5" textAnchor="end" className="ck-axis">
                {court(v)}
              </text>
            </g>
          ))}
          {selIdx >= 0 && <rect x={x(selIdx) - Math.max(4, iw / n / 2)} y={pad.t} width={Math.max(8, iw / n)} height={ih} className="ck-selband" />}
          {cases.map((b, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={b.date} x={x(i)} y={H - 8} fontSize="10.5" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="ck-axis">
                {pas === 'mois' ? fmtMonth(b.date.slice(0, 7)).slice(0, 3) : libCase(b, 'jour', true)}
              </text>
            ) : null,
          )}
          {aire && <polygon points={aire} className="ck-area" />}
          {prevVals && <polyline points={ligne(prevVals)} className="ck-prevline" fill="none" />}
          {moyenne !== null && <line x1={pad.l} x2={W - pad.r} y1={y(moyenne)} y2={y(moyenne)} className="ck-avg" />}
          {objCase && <line x1={pad.l} x2={W - pad.r} y1={y(objCase)} y2={y(objCase)} className="ck-objline" />}
          {cumul && objectif ? <line x1={x(0)} y1={y(0)} x2={x(n - 1)} y2={y(objectif)} className="ck-objline" /> : null}
          <polyline points={ligne(vals)} className="ck-line" fill="none" />
          {signatures &&
            cases.map((b, i) =>
              signatures[b.date] ? <path key={`s${b.date}`} d={`M${x(i)},${pad.t + ih - 7} l5,7 h-10 z`} className="ck-event" /> : null,
            )}
          {record >= 0 && !cumul && <circle cx={x(record)} cy={y(brut[record])} r="4.5" className="ck-record" />}
          {hb && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="ck-cross" />}
          {hb && hv !== null && <circle cx={x(hover)} cy={y(hv)} r="4.5" className="ck-dot" />}
        </svg>
        {hb && (
          <div className="card small chart-tip ck-tip" style={{ left: `${Math.min(62, Math.max(0, (x(hover) / W) * 100 - 14))}%` }}>
            <b>{libCase(hb, pas)}</b>
            {passe(hb) ? (
              <>
                <div className="row ck-tip-r">
                  <span>{cumul ? 'Cumul' : METRIQUES[metrique].label}</span>
                  <b>{fmt(hv)}</b>
                </div>
                {hp !== null && hp !== undefined && (
                  <div className="row ck-tip-r muted">
                    <span>{vs}</span>
                    <span>
                      {fmt(hp)}
                      {hp ? ` (${hv - hp >= 0 ? '+' : '−'}${pct1(Math.abs((hv - hp) / hp))})` : ''}
                    </span>
                  </div>
                )}
                {cumul && objectif ? (
                  <div className="row ck-tip-r muted">
                    <span>Objectif de la période</span>
                    <span>{pct(hv / objectif)}</span>
                  </div>
                ) : moyenne !== null ? (
                  <div className="row ck-tip-r muted">
                    <span>Moyenne</span>
                    <span>{fmt(Math.round(moyenne * 10) / 10)}</span>
                  </div>
                ) : null}
                {signatures?.[hb.date] && <div className="tiny">Signé : {signatures[hb.date].join(', ')}</div>}
                <div className="tiny gold-ink">Clique pour filtrer tout le tableau de bord</div>
              </>
            ) : (
              <div className="muted">À venir</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Parcours de l'amont à l'aval ----------
function Parcours({ pc, sel, onSel, onListe }) {
  const max = Math.max(1, ...pc.etapes.map((e) => e.n))
  return (
    <div className="ck-flow" role="list">
      {pc.etapes.map((e) => {
        const bas = e.habituel !== null && e.passage !== null && e.passage - e.habituel <= -0.1
        const haut = e.habituel !== null && e.passage !== null && e.passage - e.habituel >= 0.1
        return (
          <div key={e.i} className={`ck-step ${sel === e.i ? 'sel' : ''} ${pc.frein === e.i ? 'frein' : ''}`} role="listitem">
            <div className={`ck-pass ${bas ? 'bas' : haut ? 'haut' : ''}`}>
              {e.i === 0 ? (
                <span>Entrée</span>
              ) : (
                <>
                  <b>{e.passage === null ? '—' : pct(e.passage)}</b>
                  {e.habituel !== null && <span> hab. {pct(e.habituel)}</span>}
                </>
              )}
            </div>
            <button type="button" className="ck-step-main" onClick={() => onSel(e.i)} aria-pressed={sel === e.i} title="Filtrer le tableau de bord sur cette étape">
              <span className="ck-step-nom">
                {e.nom}
                {pc.frein === e.i && <span className="ck-frein">Frein</span>}
              </span>
              <span className="ck-step-n">{nb(e.n)}</span>
              <span className="ck-step-bar" aria-hidden="true">
                <i style={{ width: `${(e.n / max) * 100}%` }} />
              </span>
              <span className={`ck-step-sub ${e.perdus ? '' : 'vide'}`}>{e.perdus ? `${e.perdus} perdu${e.perdus > 1 ? 's' : ''} ici` : ' '}</span>
            </button>
            <div className="ck-step-foot">
              {e.enAttente.length > 0 && (
                <button type="button" className="toggle-link tiny" onClick={() => onListe(`En attente : ${e.nom}`, { type: 'prospects', items: e.enAttente })}>
                  {nb(e.enAttente.length)} en attente
                </button>
              )}
              {e.bloques.length > 0 && (
                <button type="button" className="toggle-link tiny red" onClick={() => onListe(`Bloqués : ${e.nom}`, { type: 'prospects', items: e.bloques })}>
                  {nb(e.bloques.length)} bloqué{e.bloques.length > 1 ? 's' : ''}
                </button>
              )}
              {e.delaiMoy !== null && (
                <span className="tiny muted" title={`${e.nDelais} passage${e.nDelais > 1 ? 's' : ''} mesuré${e.nDelais > 1 ? 's' : ''}`}>
                  {nb(e.delaiMoy, 1)} j (méd. {nb(e.delaiMed, 1)})
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Tableau détaillé : recherche, tri, colonnes, pages, sélection, export ----------
function exporterCsv(nom, cols, lignes) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.map((c) => esc(c.label)).join(';'), ...lignes.map((l) => cols.map((c) => esc(c.csv ? c.csv(l) : c.val(l))).join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nom}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function TableDetail({ actions, prospects, ouvrirAction }) {
  const { data } = useApp()
  const [onglet, setOnglet] = useState('actions')
  const [q, setQ] = useState('')
  const [tri, setTri] = useState({ k: 'date', dir: -1 })
  const [page, setPage] = useState(0)
  const [choix, setChoix] = useState(() => new Set())
  const [caches, setCaches] = useState({})
  const nom = (id) => data.byId[id]?.name || ''
  const COLS = {
    actions: [
      { k: 'date', label: 'Date', val: (a) => a.date || '', aff: (a) => fmtDate(a.date) },
      { k: 'time', label: 'Heure', val: (a) => a.time || '' },
      { k: 'prospect', label: 'Client / prospect', val: (a) => nom(a.prospect_id) },
      { k: 'action', label: 'Action', val: (a) => a.action || '' },
      { k: 'canal', label: 'Canal', val: (a) => a.canal || '' },
      { k: 'resultat', label: 'Résultat', val: (a) => a.resultat || a.categorie || '' },
      { k: 'montant', label: 'Montant', num: true, val: (a) => Number(a.montant) || 0, aff: (a) => (Number(a.montant) ? eur(Number(a.montant)) : ''), csv: (a) => Number(a.montant) || '' },
    ],
    prospects: [
      { k: 'name', label: 'Nom', val: (p) => p.name || '' },
      { k: 'etape', label: 'Étape', val: (p) => p.etape },
      { k: 'canal', label: 'Canal', val: (p) => p.canal || '' },
      { k: 'secteur', label: 'Secteur', val: (p) => p.fiche?.secteur || '' },
      { k: 'score', label: 'Score', num: true, val: (p) => p.score },
      { k: 'derniereAction', label: 'Dernière action', val: (p) => p.derniereAction || '', aff: (p) => fmtDate(p.derniereAction) },
      { k: 'relance', label: 'Relance', val: (p) => p.relance || '', aff: (p) => fmtDate(p.relance) },
      { k: 'pipelinePondere', label: 'Pipeline pondéré', num: true, val: (p) => p.pipelinePondere, aff: (p) => (p.pipelinePondere ? eur(p.pipelinePondere) : '') },
    ],
  }
  const cols = COLS[onglet].filter((c) => !caches[`${onglet}.${c.k}`])
  const source = onglet === 'actions' ? actions : prospects
  const s = q.trim().toLowerCase()
  const filtres = s ? source.filter((l) => COLS[onglet].some((c) => String(c.val(l)).toLowerCase().includes(s))) : source
  const colTri = COLS[onglet].find((c) => c.k === tri.k) || COLS[onglet][0]
  const tries = [...filtres].sort((a, b) => {
    const va = colTri.val(a)
    const vb = colTri.val(b)
    return (colTri.num ? va - vb : String(va).localeCompare(String(vb), 'fr')) * tri.dir
  })
  const PAR = 15
  const pages = Math.max(1, Math.ceil(tries.length / PAR))
  const pg = Math.min(page, pages - 1)
  const vus = tries.slice(pg * PAR, pg * PAR + PAR)
  const changerOnglet = (o) => {
    setOnglet(o)
    setTri({ k: o === 'actions' ? 'date' : 'score', dir: -1 })
    setPage(0)
    setChoix(new Set())
  }
  const basculer = (id) =>
    setChoix((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const tousVus = vus.length > 0 && vus.every((l) => choix.has(l.id))
  const ouvrir = (l) => (onglet === 'prospects' ? go(`/prospect/${l.id}`) : l.prospect_id ? go(`/prospect/${l.prospect_id}`) : ouvrirAction(l))
  const aExporter = choix.size ? tries.filter((l) => choix.has(l.id)) : tries
  return (
    <div>
      <div className="ck-table-bar">
        <div className="ck-seg" role="tablist" aria-label="Données du tableau">
          {[
            ['actions', `Actions (${nb(actions.length)})`],
            ['prospects', `Prospects (${nb(prospects.length)})`],
          ].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={onglet === k} className={onglet === k ? 'on' : ''} onClick={() => changerOnglet(k)}>
              {l}
            </button>
          ))}
        </div>
        <input
          className="input ck-search"
          placeholder="Rechercher dans le tableau…"
          aria-label="Rechercher dans le tableau"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
        <details className="ck-cols">
          <summary className="btn sm">
            <Icon n="columns" size={14} /> Colonnes
          </summary>
          <div className="ck-cols-pop card">
            {COLS[onglet].map((c) => (
              <label key={c.k} className="check-row small">
                <input type="checkbox" checked={!caches[`${onglet}.${c.k}`]} onChange={() => setCaches((m) => ({ ...m, [`${onglet}.${c.k}`]: !m[`${onglet}.${c.k}`] }))} /> {c.label}
              </label>
            ))}
          </div>
        </details>
        <button type="button" className="btn sm" disabled={!aExporter.length} onClick={() => exporterCsv(`tableau-de-bord-${onglet}-${today()}`, cols, aExporter)}>
          <Icon n="download" size={14} /> {choix.size ? `Exporter la sélection (${choix.size})` : 'Exporter en CSV'}
        </button>
      </div>
      <div className="table-wrap ck-tablewrap" tabIndex={0} role="region" aria-label="Tableau détaillé">
        <table className="t ck-table">
          <thead>
            <tr>
              <th className="ck-cb">
                <input type="checkbox" aria-label="Tout sélectionner sur cette page" checked={tousVus} onChange={() => setChoix((c) => {
                  const n = new Set(c)
                  vus.forEach((l) => (tousVus ? n.delete(l.id) : n.add(l.id)))
                  return n
                })} />
              </th>
              {cols.map((c) => (
                <th key={c.k} className={c.num ? 'num' : ''} aria-sort={tri.k === c.k ? (tri.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="ck-th" onClick={() => setTri((t) => ({ k: c.k, dir: t.k === c.k ? -t.dir : c.num || c.k === 'date' ? -1 : 1 }))}>
                    {c.label}
                    {tri.k === c.k && <span aria-hidden="true">{tri.dir > 0 ? ' ▲' : ' ▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vus.map((l) => (
              <tr key={l.id} className={`click ${choix.has(l.id) ? 'on' : ''}`} onClick={() => ouvrir(l)}>
                <td className="ck-cb" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label="Sélectionner la ligne" checked={choix.has(l.id)} onChange={() => basculer(l.id)} />
                </td>
                {cols.map((c) => {
                  const v = c.aff ? c.aff(l) : c.val(l)
                  return (
                    <td key={c.k} className={c.num ? 'num' : ''} title={typeof v === 'string' ? v : undefined}>
                      <span className="ck-cell">{v}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {!vus.length && (
              <tr>
                <td colSpan={cols.length + 1} className="muted ck-vide">
                  {s ? 'Aucun résultat pour cette recherche.' : 'Aucune donnée sur cette période et ces filtres.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="ck-pages">
          <button type="button" className="btn sm" disabled={pg === 0} onClick={() => setPage(pg - 1)} aria-label="Page précédente">
            ‹
          </button>
          <span className="tiny muted">
            Page {pg + 1} / {pages} · {nb(tries.length)} ligne{tries.length > 1 ? 's' : ''}
          </span>
          <button type="button" className="btn sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} aria-label="Page suivante">
            ›
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Activité récente (se met à jour dès qu'une donnée change, en direct avec Supabase) ----------
const ICONE_ACTION = (a) =>
  a.action === 'Paiement reçu' ? 'coins' : a.action === 'Dépense' ? 'wallet' : a.canal === 'Appel' ? 'phone' : a.canal === 'DM' ? 'instagram' : a.canal === 'WhatsApp' ? 'message' : a.action === 'Signature' ? 'handshake' : 'note'
function Activite({ actions, live, jour, ouvrirAction }) {
  const { data } = useApp()
  const liste = actions.slice(0, 14)
  // Actions arrivées depuis l'affichage : surlignées quelques secondes
  const cle = liste.map((a) => a.id).join(',')
  const [connus, setConnus] = useState(null)
  useEffect(() => {
    const id = setTimeout(() => setConnus(new Set(cle.split(','))), connus ? 5000 : 0)
    return () => clearTimeout(id)
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps
  const nouveaux = new Set(connus ? liste.filter((a) => !connus.has(a.id)).map((a) => a.id) : [])
  const quand = (a) => (a.date === jour ? a.time || "aujourd'hui" : a.date === addDays(jour, -1) ? `hier${a.time ? ` ${a.time}` : ''}` : fmtDate(a.date))
  return (
    <>
      {liste.length === 0 && <div className="ck-empty">Aucune activité sur cette période et ces filtres.</div>}
      <ol className="ck-feed">
        {liste.map((a) => {
          const p = data.byId[a.prospect_id]
          const m = Number(a.montant)
          return (
            <li key={a.id} className={nouveaux.has(a.id) ? 'nouveau' : ''}>
              <button type="button" onClick={() => (p ? go(`/prospect/${p.id}`) : ouvrirAction(a))}>
                <span className="ck-feed-t">{quand(a)}</span>
                <span className="ck-feed-ic" aria-hidden="true">
                  <Icon n={ICONE_ACTION(a)} size={14} />
                </span>
                <span className="ck-feed-txt">
                  <b>{a.action}</b>
                  {m ? ` · ${eur(m)}` : a.resultat ? ` · ${a.resultat}` : ''}
                  <span className="ck-feed-sub">{p ? p.name : a.notes || a.categorie || a.fournisseur || 'Sans client'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {live.direct && <div className="tiny muted ck-feed-note">Les nouvelles actions apparaissent ici toutes seules.</div>}
    </>
  )
}

// ---------- Le cockpit ----------
export default function Cockpit({ periode, titre, canal, setCanal, voir, voirListe }) {
  const { data, settings, actions, documents, live, saisirArgent } = useApp()
  const jour = today()
  const url0 = useMemo(() => paramsUrl(), [])
  const [sel, setSel] = useState(() => (url0.get('du') && url0.get('au') ? { du: url0.get('du'), au: url0.get('au') } : null))
  const [etape, setEtape] = useState(() => (url0.get('etape') !== null && url0.get('etape') !== '' ? Number(url0.get('etape')) : null))
  const [metrique, setMetrique] = useState(() => (METRIQUES[url0.get('m')] ? url0.get('m') : 'encaisse'))
  const [cumul, setCumul] = useState(url0.get('cumul') === '1')
  const [vues, setVues] = useState(lireVues)
  const mode = VUES[url0.get('vue')] && !vues.mode ? url0.get('vue') : VUES[vues.mode] ? vues.mode : 'complete'
  const [perso, setPerso] = useState(false)
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    ecrireUrl({ du: sel?.du, au: sel?.au, etape: etape === null ? null : etape, m: metrique === 'encaisse' ? null : metrique, cumul: cumul ? '1' : null })
  }, [sel, etape, metrique, cumul])

  // Bornes réelles : « Tout l'historique » commence à la première donnée
  const bornes = useMemo(() => {
    if (periode.mois !== 'Tous') return { debut: periode.debut, fin: periode.fin }
    const premiere = data.sorted.reduce((m, a) => (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.date >= '2000-01-01' && a.date < m ? a.date : m), jour)
    return { debut: premiere, fin: jour }
  }, [periode, data, jour])
  // Période effective : la sélection faite sur le graphique, sinon la période choisie
  const eff = useMemo(() => {
    if (!sel) return { ...periode, ...bornes }
    const n = diffDays(sel.au, sel.du) + 1
    return { mois: 'sel', semaine: true, debut: sel.du, fin: sel.au, prevDebut: addDays(sel.du, -n), prevFin: addDays(sel.du, -1), prevLabel: n === 1 ? 'veille' : `${n} j préc.` }
  }, [sel, periode, bornes])
  const vs = eff.prevLabel || 'période préc.'

  // Filtre croisé sur une étape du parcours : prospects de la période arrivés à cette étape
  const pc = useMemo(() => parcours(data, settings, bornes.debut, bornes.fin, canal, jour), [data, settings, bornes, canal, jour])
  const garder = useMemo(() => {
    if (etape === null) return null
    const ids = new Set(pc.cohorte.filter((p) => p.niveau >= Math.min(7, etape + 1) && (etape < 7 || (data.clients.find((c) => c.id === p.id)?.encaisse || 0) > 0)).map((p) => p.id))
    return (p) => ids.has(p.id)
  }, [etape, pc, data])

  const pas = pasPour(eff.debut, eff.fin)
  const casesEff = useMemo(() => agreger(data, eff.debut, eff.fin, canal, pas, garder), [data, eff, canal, pas, garder])
  const casesPrev = useMemo(() => (eff.prevDebut ? agreger(data, eff.prevDebut, eff.prevFin, canal, pas, garder) : null), [data, eff, canal, pas, garder])
  const pasT = pasPour(bornes.debut, bornes.fin)
  const casesT = useMemo(() => agreger(data, bornes.debut, bornes.fin, canal, pasT, garder), [data, bornes, canal, pasT, garder])
  const casesTPrev = useMemo(() => (periode.prevDebut ? agreger(data, periode.prevDebut, periode.prevFin, canal, pasT, garder) : null), [data, periode, canal, pasT, garder])
  const st = useMemo(() => computeStats(data, settings, eff, canal), [data, settings, eff, canal])
  const t = (k) => somme(casesEff, k)
  const tp = (k) => (casesPrev ? somme(casesPrev, k) : null)

  // Objectifs : mois complet = objectif mensuel, sinon ramené au nombre de jours
  const moisComplet = !!periode.key && !sel
  const obj = (k) => objectifPeriode(settings, k, eff.debut, eff.fin, moisComplet)
  const enCours = eff.debut <= jour && eff.fin > jour
  const proj = (k) => (enCours ? (t(k) / (diffDays(jour, eff.debut) + 1)) * (diffDays(eff.fin, eff.debut) + 1) : null)
  const spark = (k) => <Spark vals={casesEff.filter((b) => b.date <= jour).map((b) => b[k])} label={`Évolution : ${METRIQUES[k].label}`} />
  const filtrerRes = (res) => (garder ? { ...res, items: res.items.filter((x) => (res.type === 'prospects' ? garder(x) : data.byId[x.prospect_id] && garder(data.byId[x.prospect_id]))) } : res)
  const voirK = (titreK, kind) => voirListe(titreK, filtrerRes(detail(data, settings, eff, canal, { kind }, eff.debut, eff.fin)), sousTitre)

  // Mois en cours (objectifs, santé)
  const moisCourant = useMemo(() => {
    const key = monthKey(jour)
    return computeStats(data, settings, { mois: key, key, debut: `${key}-01`, fin: jour }, 'Tous').cur
  }, [data, settings, jour])
  const dj = parse(jour)
  const jourDuMois = dj.getDate()
  const joursDuMois = new Date(dj.getFullYear(), dj.getMonth() + 1, 0).getDate()
  const factures = useMemo(() => facturesImpayees(documents || [], actions), [documents, actions])
  const enRetard = factures.filter((f) => f.statut === 'En retard')
  const score = useMemo(
    () => sante({ mois: moisCourant, objectifs: settings.objectifsMois, jourDuMois, joursDuMois, prospects: data.list, jour, impayes: factures.reduce((m, f) => m + f.reste, 0), enRetard: enRetard.reduce((m, f) => m + f.reste, 0) }),
    [moisCourant, settings, jourDuMois, joursDuMois, data, jour, factures, enRetard],
  )
  const anos = useMemo(() => (periode.mois === 'Tous' ? [] : anomalies(data, eff.debut, eff.fin, canal, jour)), [data, eff, canal, jour, periode.mois])
  const qual = useMemo(() => qualite(data, jour), [data, jour])

  // Demandes du site encore à traiter (lues à part : elles ne sont pas dans les données du CRM)
  const [demandes, setDemandes] = useState(0)
  const majLe = live?.majLe
  useEffect(() => {
    if (!supabase || isLocal) return
    supabase
      .from('site_demandes')
      .select('id', { count: 'exact', head: true })
      .eq('traitee', false)
      .then(({ count }) => setDemandes(count || 0), () => {})
  }, [majLe])

  // Actualisation automatique toutes les 60 s quand Supabase ne pousse pas les changements
  useEffect(() => {
    if (!live || live.direct || isLocal) return
    const id = setInterval(() => document.visibilityState === 'visible' && navigator.onLine && live.reload(), 60000)
    return () => clearInterval(id)
  }, [live])

  // ---------- Centre d'attention : ce qui demande une action, du plus grave au plus positif ----------
  const attention = useMemo(() => {
    const out = []
    const retardRel = data.aRelancer.filter((p) => p.relance < jour)
    const duJour = data.aRelancer.filter((p) => p.relance === jour)
    if (retardRel.length) out.push({ niv: 'critique', titre: `${nb(retardRel.length)} relance${retardRel.length > 1 ? 's' : ''} en retard`, detail: `La plus ancienne date du ${fmtDate(retardRel[0].relance)}`, label: 'Relancer', run: () => go('/journee') })
    if (enRetard.length) out.push({ niv: 'critique', titre: `${nb(enRetard.length)} facture${enRetard.length > 1 ? 's' : ''} en retard`, detail: `${eur(enRetard.reduce((m, f) => m + f.reste, 0))} à encaisser`, label: 'Voir les factures', run: () => go('/factures?filtre=retard') })
    anos.filter((a) => a.sens === 'baisse').forEach((a) =>
      out.push({
        niv: a.k === 'encaisse' || a.k === 'caSigne' ? 'critique' : 'attention',
        titre: `${a.label} : ${a.taux ? `${Math.round(a.ecart * 100)} pts` : `${Math.round(a.ecart * 100)} %`} par rapport à d'habitude`,
        detail: a.taux ? `${pct(a.v)} contre ${pct(a.moy)} en moyenne sur les 4 périodes précédentes` : `${(a.k === 'encaisse' || a.k === 'caSigne' ? eur : nb)(a.v)} contre ${(a.k === 'encaisse' || a.k === 'caSigne' ? eur : (v) => nb(v, 1))(a.moy)} en moyenne sur les 4 périodes de ${a.jours} j précédentes`,
        label: 'Analyser',
        run: () => (a.k === 'taux' || a.k === 'contacts' || a.k === 'reponses' ? go('/dashboard/acquisition') : a.k === 'encaisse' || a.k === 'caSigne' ? go('/dashboard/finances') : go('/dashboard/conversion')),
      }),
    )
    const bloques = pc.etapes.filter((e) => e.bloques.length).sort((a, b) => b.bloques.length - a.bloques.length)
    if (bloques.length) {
      const tous = bloques.flatMap((e) => e.bloques)
      out.push({ niv: 'attention', titre: `${nb(tous.length)} prospect${tous.length > 1 ? 's' : ''} sans action depuis ${settings.alertes?.sansAction || 7} j ou plus`, detail: `Surtout à l'étape ${bloques[0].nom} (${bloques[0].bloques.length})`, label: 'Voir la liste', run: () => voirListe('Prospects bloqués', { type: 'prospects', items: tous }) })
    }
    const props = data.list.filter((p) => p.alerte === 'Proposition expirée' || p.alerte === 'Proposition sans réponse')
    if (props.length) out.push({ niv: 'attention', titre: `${nb(props.length)} proposition${props.length > 1 ? 's' : ''} sans réponse ou expirée${props.length > 1 ? 's' : ''}`, detail: eur(props.reduce((m, p) => m + (Number(p.montantPropose) || 0), 0)) + ' en jeu', label: 'Relancer', run: () => voirListe('Propositions à relancer', { type: 'prospects', items: props }) })
    if (data.clientsAlertes.length) out.push({ niv: 'attention', titre: `${nb(data.clientsAlertes.length)} client${data.clientsAlertes.length > 1 ? 's' : ''} à surveiller`, detail: [...new Set(data.clientsAlertes.map((c) => c.alerte.replace(/\d+/g, 'N')))].slice(0, 2).join(', '), label: 'Voir', run: () => go('/clients?onglet=actifs') })
    const echeances = echeancesEntre(settings.depensesFixes, jour, addDays(jour, 7))
    if (echeances.length) out.push({ niv: 'info', titre: `${nb(echeances.length)} abonnement${echeances.length > 1 ? 's' : ''} à payer dans les 7 jours`, detail: `${eur(echeances.reduce((m, e) => m + e.montant, 0))} au total`, label: 'Voir', run: () => go('/charges') })
    if (demandes) out.push({ niv: 'info', titre: `${nb(demandes)} demande${demandes > 1 ? 's' : ''} du site à traiter`, detail: 'Formulaire de contact du site', label: 'Traiter', run: () => go('/site-demandes') })
    if (duJour.length) out.push({ niv: 'info', titre: `${nb(duJour.length)} relance${duJour.length > 1 ? 's' : ''} prévue${duJour.length > 1 ? 's' : ''} aujourd'hui`, detail: duJour.slice(0, 3).map((p) => p.name).join(', '), label: 'Ma journée', run: () => go('/journee') })
    if (qual.length) out.push({ niv: 'info', titre: `${nb(qual.reduce((m, x) => m + x.res.items.length, 0))} donnée${qual.length > 1 ? 's' : ''} à vérifier`, detail: qual[0].label, label: 'Vérifier', run: () => voirListe(qual[0].label, qual[0].res) })
    anos.filter((a) => a.sens === 'hausse').forEach((a) => out.push({ niv: 'positif', titre: `${a.label} en hausse : +${a.taux ? `${Math.round(a.ecart * 100)} pts` : `${Math.round(a.ecart * 100)} %`}`, detail: "Par rapport à la moyenne des 4 périodes précédentes", label: null }))
    const objCa = Number(settings.objectifsMois?.ca) || 0
    if (objCa && moisCourant.caSigne >= objCa) out.push({ niv: 'positif', titre: 'Objectif de CA du mois atteint', detail: `${eur(moisCourant.caSigne)} signés pour ${eur(objCa)}`, label: null })
    return out
  }, [data, jour, enRetard, anos, pc, settings, demandes, qual, moisCourant, voirListe])

  // Actions et prospects de la période effective, filtrés (canal, étape) : activité et tableau
  const actsEff = useMemo(() => {
    const ok = (a) => canal === 'Tous' || a.canal === canal || data.byId[a.prospect_id]?.canal === canal
    return data.sorted
      .filter((a) => a.date && a.date >= eff.debut && a.date <= eff.fin && ok(a) && (!garder || (data.byId[a.prospect_id] && garder(data.byId[a.prospect_id]))))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || '') || (b.created_at || '').localeCompare(a.created_at || ''))
  }, [data, eff, canal, garder])
  const prospectsEff = useMemo(
    () => data.list.filter((p) => (canal === 'Tous' || p.canal === canal) && (!garder || garder(p)) && ((p.dateAjout >= eff.debut && p.dateAjout <= eff.fin) || (p.derniereAction >= eff.debut && p.derniereAction <= eff.fin))),
    [data, eff, canal, garder],
  )
  // Signatures à annoter sur le graphique
  const signatures = useMemo(() => {
    const m = {}
    data.list.forEach((p) => {
      const d = p.stageDates[5]
      if (!d || d < bornes.debut || d > bornes.fin || (canal !== 'Tous' && p.canal !== canal)) return
      const k = pasT === 'jour' ? d : casesT.find((b) => d >= b.date && d <= b.fin)?.date
      if (k) (m[k] = m[k] || []).push(p.name)
    })
    return m
  }, [data, bornes, canal, pasT, casesT])

  const sousTitre = [sel ? (sel.du === sel.au ? fmtDate(sel.du) : `${fmtDate(sel.du)} → ${fmtDate(sel.au)}`) : titre, canal !== 'Tous' && `canal ${canal}`, etape !== null && `étape ${pc.etapes[etape]?.nom}`].filter(Boolean).join(' · ')
  const ouvrirAction = (a) => (a.action === 'Paiement reçu' || a.action === 'Dépense' ? saisirArgent(modalPour(a)) : voirListe(a.action, { type: 'actions', items: [a] }))

  // Vues personnalisées
  const ids = (vues.ordre?.[mode] || VUES[mode].ids).filter((id) => WIDGETS[id])
  const caches = new Set(vues.caches?.[mode] || [])
  const visibles = ids.filter((id) => !caches.has(id))
  const majVues = (v) => {
    setVues(v)
    ecrireVues(v)
  }
  const deplacer = (id, d) => {
    const o = [...ids]
    const i = o.indexOf(id)
    const j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    majVues({ ...vues, ordre: { ...vues.ordre, [mode]: o } })
  }
  const cacher = (id) => {
    const c = new Set(caches)
    if (c.has(id)) c.delete(id)
    else c.add(id)
    majVues({ ...vues, caches: { ...vues.caches, [mode]: [...c] } })
  }
  const filtresActifs = sel || etape !== null || canal !== 'Tous'
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      window.prompt('Lien de cette vue :', window.location.href)
    }
  }

  const secIc = (n) => (
    <span className="sec-ic">
      <Icon n={n} size={16} />
    </span>
  )
  const net = garder ? t('encaisse') - t('depenses') : st.cur.benefice
  const contacts = t('contacts')
  const W = {
    kpis: (
      <div className="ck-kpis">
        <KpiTile label="Encaissé" cur={t('encaisse')} prev={tp('encaisse')} fmt={eur} vs={vs} spark={spark('encaisse')} sub={`CA signé non encore encaissé : ${eur(st.resteAEncaisser)}`} onClick={() => voirK('Paiements reçus', 'encaisse')} />
        <KpiTile label="CA signé" cur={t('caSigne')} prev={tp('caSigne')} fmt={eur} vs={vs} objectif={garder ? null : obj('caSigne')} projection={proj('caSigne')} spark={spark('caSigne')} onClick={() => voirK('Ventes (CA signé)', 'ventes')} />
        <KpiTile label="Clients signés" cur={t('signes')} prev={tp('signes')} fmt={nb} vs={vs} objectif={garder ? null : obj('signes')} projection={proj('signes')} spark={spark('signes')} onClick={() => voirK('Clients signés', 'signes')} />
        <KpiTile label="RDV obtenus" cur={t('rdv')} prev={tp('rdv')} fmt={nb} vs={vs} objectif={garder ? null : obj('rdv')} projection={proj('rdv')} spark={spark('rdv')} onClick={() => voirK('RDV obtenus', 'rdv')} />
        <KpiTile label="Contacts (DM + appels)" cur={contacts} prev={tp('contacts')} fmt={nb} vs={vs} objectif={garder ? null : obj('contacts')} projection={proj('contacts')} spark={spark('contacts')} onClick={() => voirListe('Contacts (DM + appels)', filtrerRes({ type: 'actions', items: [...detail(data, settings, eff, canal, { kind: 'dm' }).items, ...detail(data, settings, eff, canal, { kind: 'appels' }).items] }), sousTitre)} />
        <KpiTile label="Il te reste" cur={net} prev={garder ? null : st.prev ? st.prev.benefice : null} fmt={eur} vs={vs} sub={garder ? 'Encaissé moins les frais de ces prospects' : `Taux de réponse : ${contacts ? pct(t('reponses') / contacts) : '—'} · charges fixes comprises`} onClick={() => voirK('Dépenses de la période', 'depenses')} />
      </div>
    ),
    sante: (
      <section className="card ck-sante">
        <h2 className="section">{secIc('check-circle')} Santé de l'activité</h2>
        {score ? (
          <>
            <div className={`ck-score ${score.etat}`}>
              <b>{score.score}</b>
              <span>/100 · {score.etat === 'bon' ? 'Bonne santé' : score.etat === 'moyen' ? 'À surveiller' : 'En difficulté'}</span>
            </div>
            <ul className="ck-dims">
              {score.dims.map((d) => (
                <li key={d.k}>
                  <span className="ck-dim-l">{d.label}</span>
                  <span className="ck-obj-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(d.v * 100)}%` }} className={d.v >= 0.75 ? 'ok' : d.v < 0.5 ? 'ko' : ''} />
                  </span>
                  <b>{Math.round(d.v * 100)}</b>
                  <span className="ck-dim-d">{d.detail}</span>
                </li>
              ))}
            </ul>
            <details className="tiny muted ck-formule">
              <summary>Comment ce score est calculé</summary>
              Moyenne simple des dimensions disponibles ce mois-ci : prospection et ventes (réalisé face à l'objectif ramené au jour du mois, plafonné à 100), relances à jour et encaissements à l'heure. Une dimension sans objectif ou sans donnée n'est pas comptée.
            </details>
          </>
        ) : (
          <div className="ck-empty">
            Fixe tes objectifs du mois pour activer le score.
            <button type="button" className="btn sm" onClick={() => go('/parametres/objectifs')}>
              Fixer mes objectifs
            </button>
          </div>
        )}
      </section>
    ),
    attention: (
      <section className="card ck-attention">
        <h2 className="section">
          {secIc('bell')} Centre d'attention
          <span className="ck-count">{nb(attention.filter((a) => a.niv !== 'positif').length)}</span>
        </h2>
        {attention.length === 0 && <div className="ck-empty">Rien ne demande ton attention. Tout est à jour.</div>}
        <ul className="ck-alerts">
          {attention.slice(0, 8).map((a, i) => (
            <li key={i} className={`ck-alert ${a.niv}`}>
              <span className="ck-alert-ic" aria-hidden="true">
                <Icon n={a.niv === 'positif' ? 'check' : a.niv === 'info' ? 'info' : 'alert'} size={14} />
              </span>
              <span className="ck-alert-txt">
                <b>{a.titre}</b>
                <span>{a.detail}</span>
              </span>
              {a.label && (
                <button type="button" className="btn sm" onClick={a.run}>
                  {a.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    ),
    tendance: (
      <section className="card ck-tendance">
        <div className="ck-head">
          <h2 className="section">{secIc('trend')} Tendance</h2>
          <div className="ck-seg" role="tablist" aria-label="Indicateur du graphique">
            {Object.entries(METRIQUES).map(([k, m]) => (
              <button key={k} type="button" role="tab" aria-selected={metrique === k} className={metrique === k ? 'on' : ''} onClick={() => setMetrique(k)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="ck-seg" role="group" aria-label="Mode du graphique">
            <button type="button" className={!cumul ? 'on' : ''} aria-pressed={!cumul} onClick={() => setCumul(false)}>
              Par {pasT}
            </button>
            <button type="button" className={cumul ? 'on' : ''} aria-pressed={cumul} onClick={() => setCumul(true)}>
              Cumulé
            </button>
          </div>
        </div>
        <div className="legend ck-legend">
          <span>
            <i className="lg-cur" /> {periode.mois === 'Tous' ? "Tout l'historique" : titre}
          </span>
          {casesTPrev && (
            <span>
              <i className="lg-prev" /> {periode.prevLabel}
            </span>
          )}
          {!cumul && (
            <span>
              <i className="lg-avg" /> Moyenne
            </span>
          )}
          {objectifPeriode(settings, metrique, bornes.debut, bornes.fin, !!periode.key) && !garder && (
            <span>
              <i className="lg-obj" /> Objectif
            </span>
          )}
          {Object.keys(signatures).length > 0 && (
            <span>
              <i className="lg-event" /> Signature
            </span>
          )}
        </div>
        {somme(casesT, metrique) === 0 && !casesTPrev?.some((b) => b[metrique]) ? (
          <div className="ck-empty">Aucune donnée « {METRIQUES[metrique].long || METRIQUES[metrique].label} » sur cette période.</div>
        ) : (
          <Tendance
            cases={casesT}
            prev={casesTPrev}
            pas={pasT}
            metrique={metrique}
            cumul={cumul}
            objectif={garder ? null : objectifPeriode(settings, metrique, bornes.debut, bornes.fin, !!periode.key)}
            sel={sel}
            jour={jour}
            signatures={signatures}
            vs={periode.prevLabel}
            onPick={(b) => setSel((s) => (s && s.du === b.date ? null : { du: b.date, au: b.fin > jour ? jour : b.fin }))}
          />
        )}
      </section>
    ),
    activite: (
      <section className="card ck-activite">
        <h2 className="section">
          {secIc('bolt')} Activité récente
          {live?.direct && (
            <span className="ck-live">
              <i /> En direct
            </span>
          )}
        </h2>
        <Activite actions={actsEff} live={live || {}} jour={jour} ouvrirAction={ouvrirAction} />
      </section>
    ),
    parcours: (
      <section className="card ck-parcours">
        <div className="ck-head">
          <h2 className="section">{secIc('funnel')} Parcours de l'amont à l'aval</h2>
          <span className="tiny muted">
            {nb(pc.cohorte.length)} prospect{pc.cohorte.length > 1 ? 's' : ''} ajouté{pc.cohorte.length > 1 ? 's' : ''} sur {periode.mois === 'Tous' ? "tout l'historique" : 'la période'} · taux de passage d'une étape à l'autre, comparé à d'habitude
          </span>
        </div>
        {pc.cohorte.length === 0 && !pc.etapes.some((e) => e.enAttente.length) ? (
          <div className="ck-empty">Aucun prospect ajouté sur cette période.</div>
        ) : (
          <Parcours pc={pc} sel={etape} onSel={(i) => setEtape((e) => (e === i ? null : i))} onListe={(ti, res) => voirListe(ti, res, "Aujourd'hui")} />
        )}
        {pc.frein !== null && (
          <div className="ck-frein-note small">
            <Icon n="info" size={14} />
            <span>
              L'étape qui freine le plus : <b>{pc.etapes[pc.frein].nom}</b> ({pct(pc.etapes[pc.frein].passage)} des prospects y passent
              {pc.etapes[pc.frein].habituel !== null ? `, contre ${pct(pc.etapes[pc.frein].habituel)} d'habitude` : ''}).
            </span>
          </div>
        )}
      </section>
    ),
    canaux: (
      <section className="card ck-canaux">
        <div className="ck-head">
          <h2 className="section">{secIc('radio')} Performance par canal</h2>
          <span className="tiny muted">Clique un canal pour filtrer tout le tableau de bord</span>
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Performance par canal">
          <table className="t ck-canal-t">
            <thead>
              <tr>
                <th>Canal</th>
                <th className="num">Contacts</th>
                <th>Réponse</th>
                <th className="num">RDV</th>
                <th className="num">Clients</th>
                <th className="num">CA signé</th>
              </tr>
            </thead>
            <tbody>
              {st.parCanal.map((r) => (
                <tr key={r.canal} className={`click ${canal === r.canal ? 'on' : ''}`} onClick={() => setCanal(canal === r.canal ? 'Tous' : r.canal)} title={canal === r.canal ? 'Retirer le filtre' : `Filtrer sur ${r.canal}`}>
                  <td>{r.canal}</td>
                  <td className="num">{nb(r.actions)}</td>
                  <td>
                    <span className="ck-rate">
                      <span className="ck-obj-bar" aria-hidden="true">
                        <i style={{ width: `${Math.round(r.taux * 100)}%` }} />
                      </span>
                      {r.actions ? pct(r.taux) : '—'}
                    </span>
                  </td>
                  <td className="num">{nb(r.rdv)}</td>
                  <td className="num">{nb(r.clients)}</td>
                  <td className="num">{eur(r.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ),
    objectifs: (
      <section className="card ck-objectifs">
        <h2 className="section">{secIc('target')} Objectifs du mois</h2>
        <div className="gauges">
          {[
            ['Appels', moisCourant.appels, settings.objectifsMois.appels, nb, 'appels'],
            ['DM', moisCourant.dm, settings.objectifsMois.dm, nb, 'dm'],
            ['RDV', moisCourant.rdv, settings.objectifsMois.rdv, nb, 'rdv'],
            ['Clients signés', moisCourant.signes, settings.objectifsMois.clients, nb, 'signes'],
            ['CA signé', moisCourant.caSigne, settings.objectifsMois.ca, eur, 'ventes'],
          ]
            .filter(([, , cible]) => Number(cible) > 0)
            .map(([l, v, cible, fmt, kind]) => (
              <Gauge
                key={l}
                label={l}
                value={v}
                cible={Number(cible)}
                proj={(v / jourDuMois) * joursDuMois}
                fmt={compact(fmt)}
                reste
                onClick={() => voir(`${l} du mois`, { kind }, { debut: `${monthKey(jour)}-01`, fin: jour, canal: 'Tous', sous: fmtMonth(monthKey(jour)) })}
              />
            ))}
        </div>
        {!Object.values(settings.objectifsMois || {}).some((v) => Number(v) > 0) && (
          <div className="ck-empty">
            Aucun objectif fixé.
            <button type="button" className="btn sm" onClick={() => go('/parametres/objectifs')}>
              Fixer mes objectifs
            </button>
          </div>
        )}
        <div className="tiny muted">
          {fmtMonth(monthKey(jour))}, jour {jourDuMois} sur {joursDuMois}. Projection : ton rythme actuel prolongé jusqu'à la fin du mois.
        </div>
      </section>
    ),
    qualite: (
      <section className="card ck-qualite">
        <h2 className="section">{secIc('check-circle')} Qualité des données</h2>
        {qual.length === 0 ? (
          <div className="ck-empty ok">Aucune incohérence détectée : doublons, dates, montants et paiements sont en ordre.</div>
        ) : (
          <ul className="ck-qual">
            {qual.map((x) => (
              <li key={x.k}>
                <button type="button" onClick={() => voirListe(x.label, x.res, 'Toutes les données')}>
                  <b>{nb(x.res.items.length)}</b>
                  <span>{x.label}</span>
                  <Icon n="chevron" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),
    detail: (
      <section className="card ck-detail">
        <h2 className="section">{secIc('list')} Tableau détaillé</h2>
        <TableDetail actions={actsEff} prospects={prospectsEff} ouvrirAction={ouvrirAction} />
      </section>
    ),
  }

  return (
    <div className="ck">
      <div className="ck-bar">
        <div className="ck-seg" role="tablist" aria-label="Vue du tableau de bord">
          {Object.entries(VUES).map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => majVues({ ...vues, mode: k })}>
              {v.nom}
            </button>
          ))}
        </div>
        <div className="ck-chips" role="group" aria-label="Filtres actifs">
          {canal !== 'Tous' && (
            <button type="button" className="ck-chip" onClick={() => setCanal('Tous')} aria-label={`Retirer le filtre canal ${canal}`}>
              Canal : {canal} <Icon n="x" size={12} />
            </button>
          )}
          {sel && (
            <button type="button" className="ck-chip" onClick={() => setSel(null)} aria-label="Retirer la sélection de dates">
              {sel.du === sel.au ? fmtDate(sel.du) : `${fmtDate(sel.du)} → ${fmtDate(sel.au)}`} <Icon n="x" size={12} />
            </button>
          )}
          {etape !== null && (
            <button type="button" className="ck-chip" onClick={() => setEtape(null)} aria-label="Retirer le filtre d'étape">
              Étape : {pc.etapes[etape]?.nom} <Icon n="x" size={12} />
            </button>
          )}
          {filtresActifs && (
            <button
              type="button"
              className="toggle-link tiny"
              onClick={() => {
                setSel(null)
                setEtape(null)
                setCanal('Tous')
              }}
            >
              Effacer les filtres
            </button>
          )}
        </div>
        <div className="ck-tools">
          <button type="button" className="btn sm" onClick={() => setPerso((v) => !v)} aria-expanded={perso}>
            <Icon n="settings" size={14} /> Personnaliser
          </button>
          <button type="button" className="btn sm" onClick={copier}>
            <Icon n={copie ? 'check' : 'share'} size={14} /> {copie ? 'Lien copié' : 'Copier le lien'}
          </button>
          <button type="button" className="btn sm" onClick={() => window.print()}>
            <Icon n="file" size={14} /> Imprimer
          </button>
        </div>
      </div>
      {perso && (
        <div className="card ck-perso">
          <div className="ck-head">
            <b>Blocs de la vue {VUES[mode].nom}</b>
            <button type="button" className="toggle-link tiny" onClick={() => majVues({ mode: vues.mode })}>
              Rétablir toutes les vues par défaut
            </button>
          </div>
          <ul>
            {ids.map((id, i) => (
              <li key={id}>
                <label className="check-row small">
                  <input type="checkbox" checked={!caches.has(id)} onChange={() => cacher(id)} /> {WIDGETS[id]}
                </label>
                <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => deplacer(id, -1)} aria-label={`Monter ${WIDGETS[id]}`}>
                  ↑
                </button>
                <button type="button" className="icon-btn sm" disabled={i === ids.length - 1} onClick={() => deplacer(id, 1)} aria-label={`Descendre ${WIDGETS[id]}`}>
                  ↓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="ck-grid">
        {visibles.map((id) => (
          <div key={id} className={`ck-w ck-w-${id}`}>
            {W[id]}
          </div>
        ))}
      </div>
    </div>
  )
}

// Badge « En direct / actualisé à » affiché dans l'en-tête du tableau de bord
export function EtatDonnees() {
  const { live } = useApp()
  const [tourne, setTourne] = useState(false)
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  if (!live) return null
  const { direct, majLe, sync } = live
  const vieux = majLe && maintenant - majLe > 10 * 60000
  const etat = isLocal
    ? ['demo', `Données de ce navigateur · calculé à ${heure(majLe)}`]
    : !sync?.online
      ? ['off', `Hors ligne · données de ${heure(majLe)}`]
      : sync?.error
        ? ['off', 'Synchronisation en erreur']
        : sync?.pending
          ? ['busy', `${sync.pending} modification${sync.pending > 1 ? 's' : ''} en cours d'envoi`]
          : direct
            ? ['live', `En direct · mis à jour à ${heure(majLe)}`]
            : [vieux ? 'old' : 'ok', `Actualisé à ${heure(majLe)}${vieux ? ' (ancien)' : ''}`]
  const actualiser = async () => {
    setTourne(true)
    try {
      await live.reload()
    } finally {
      setTourne(false)
    }
  }
  return (
    <div className={`ck-etat ${etat[0]}`} role="status">
      <i aria-hidden="true" />
      <span>{etat[1]}</span>
      {!isLocal && (
        <button type="button" className="icon-btn sm" onClick={actualiser} aria-label="Actualiser les données" title="Actualiser" disabled={tourne}>
          <Icon n="rotate" size={14} className={tourne ? 'spin' : ''} />
        </button>
      )}
    </div>
  )
}
