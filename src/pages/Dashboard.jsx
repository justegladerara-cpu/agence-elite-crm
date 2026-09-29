import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, Kpi, eur, pct, nb, court, Tabs, useTab } from '../ui'
import { Icon, withIcon } from '../icons'
import { Donut, HBars, Funnel, Gauge, COULEURS, useWidth } from '../charts'
import { computeStats, periodeFor, monthlySeries, activitySeries } from '../lib/logic'
import { detail } from '../lib/drill'
import Drill from './Drill'
import { ArgentPeriode, RentabiliteClients } from './Tresorerie'
import { PipelineEtapes, CumulMois, Heatmap, MeilleursClients, depensesParCategorie } from './DashPlus'
import { go } from '../ui'
import { today, fmtMonth, fmtMonthShort, fmtDate, parse } from '../lib/dates'

const C_SIGNE = '#3b5aa8'
const C_ENC = '#b8862b'

function MonthChart({ series, objectif = 0, onPick }) {
  const [hover, setHover] = useState(null)
  const [box, W] = useWidth(640)
  const H = W < 500 ? 200 : 230
  const pad = { l: 48, r: 8, t: 12, b: 26 }
  const max = Math.max(1, objectif, ...series.flatMap((m) => [m.caSigne, m.encaisse]))
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const gw = iw / series.length
  const bw = Math.min(18, (gw - 10) / 2)
  const y = (v) => pad.t + ih - (v / top) * ih
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  const bar = (x, v, color) => {
    const h = Math.max(0, pad.t + ih - y(v))
    if (h <= 0) return null
    const r = Math.min(4, h, bw / 2)
    const yy = y(v)
    return (
      <path
        d={`M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${yy + h} Z`}
        fill={color}
      />
    )
  }
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="CA signé et encaissé par mois">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e9ecf2" />
            <text x={pad.l - 6} y={y(v) + 4} fontSize="10.5" textAnchor="end" fill="#667085">
              {court(v)}
            </text>
          </g>
        ))}
        {series.map((m, i) => {
          const x0 = pad.l + i * gw + (gw - 2 * bw - 2) / 2
          return (
            <g key={m.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onPick && onPick(m.key)} style={onPick ? { cursor: 'pointer' } : undefined}>
              <rect x={pad.l + i * gw} y={pad.t} width={gw} height={ih} fill={hover === i ? '#f3f5f9' : 'transparent'} />
              {bar(x0, m.caSigne, C_SIGNE)}
              {bar(x0 + bw + 2, m.encaisse, C_ENC)}
              <text x={pad.l + i * gw + gw / 2} y={H - 8} fontSize="10.5" textAnchor="middle" fill="#667085">
                {gw < 34 ? fmtMonthShort(m.key).charAt(0).toUpperCase() : fmtMonthShort(m.key)}
              </text>
            </g>
          )
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="#c9ced9" />
        {objectif > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(objectif)} y2={y(objectif)} stroke="#c8423f" strokeWidth="1.5" strokeDasharray="5 4" />}
      </svg>
      {hover !== null && (
        <div
          className="card small"
          style={{
            position: 'absolute',
            top: 0,
            left: `${Math.min(70, ((hover + 0.5) / series.length) * 100)}%`,
            padding: '8px 12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <b>{fmtMonth(series[hover].key)}</b>
          <div>
            <i style={{ display: 'inline-block', width: 8, height: 8, background: C_SIGNE, borderRadius: 2 }} /> CA signé :{' '}
            <b>{eur(series[hover].caSigne)}</b>
          </div>
          <div>
            <i style={{ display: 'inline-block', width: 8, height: 8, background: C_ENC, borderRadius: 2 }} /> Encaissé :{' '}
            <b>{eur(series[hover].encaisse)}</b>
          </div>
          <div className="muted">Bénéfice : {eur(series[hover].benefice)}</div>
          {objectif > 0 && <div className="muted">Objectif : {eur(objectif)} ({Math.round((series[hover].caSigne / objectif) * 100)} %)</div>}
          {onPick && <div className="tiny gold-ink">Clique pour voir ce mois</div>}
        </div>
      )}
    </div>
  )
}
function niceStep(max) {
  const raw = max / 4
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw)
}

function RateTable({ title, rows, cols, onPick }) {
  return (
    <div>
      <h2 className="section">{withIcon(title)}</h2>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau">
        <table className="t">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c[0]} className={c[2] ? 'num' : ''}>
                  {c[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={onPick && r.canal !== 'Total' ? 'click' : ''} onClick={() => onPick && r.canal !== 'Total' && onPick(r)}>
                {cols.map((c) => (
                  <td key={c[0]} className={c[2] ? 'num' : ''}>
                    {c[1](r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Courbe d'activité : 4 séries sur un même axe (des nombres d'actions)
const SERIES = [
  ['dm', 'DM', '#2a78d6'],
  ['reponses', 'Réponses', '#eb6834'],
  ['looms', 'Looms', '#1baf7a'],
  ['appels', 'Appels', '#eda100'],
]
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
function ActivityChart({ buckets, parSemaine, onPick }) {
  const [hover, setHover] = useState(null)
  const [off, setOff] = useState({})
  // Largeur réelle : textes lisibles aussi sur mobile
  const box = useRef(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = W < 500 ? 220 : 250
  const pad = { l: 34, r: 92, t: 14, b: 28 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const vis = SERIES.filter(([k]) => !off[k])
  const past = buckets.filter((b) => !b.futur)
  const max = Math.max(1, ...past.flatMap((b) => vis.map(([k]) => b[k])))
  const step = Math.max(1, Math.round(niceStep(max)))
  const top = Math.ceil(max / step) * step
  const n = buckets.length
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v) => pad.t + ih - (v / top) * ih
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  const lab = (b) => {
    const dd = parse(b.date)
    return parSemaine ? `${dd.getDate()}/${dd.getMonth() + 1}` : n <= 7 ? JOURS_COURTS[dd.getDay()] : String(dd.getDate())
  }
  const every = Math.ceil(n / 12)
  const last = past.length - 1
  // Étiquettes de fin de ligne, écartées pour ne pas se chevaucher
  const ends = last >= 0 ? vis.map(([k, l, c]) => ({ k, l, c, v: past[last][k], yy: y(past[last][k]) })).sort((a, b) => a.yy - b.yy) : []
  ends.forEach((e, i) => i && e.yy - ends[i - 1].yy < 13 && (e.yy = ends[i - 1].yy + 13))
  // Si elles débordent en bas du graphique, on les remonte
  for (let i = ends.length - 1; i >= 0; i--) {
    const bas = i === ends.length - 1 ? pad.t + ih : ends[i + 1].yy - 13
    if (ends[i].yy > bas) ends[i].yy = bas
  }
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(Math.min(n - 1, last), i)))
  }
  const hb = hover !== null ? buckets[hover] : null
  return (
    <div>
      <div className="legend act-legend">
        {SERIES.map(([k, l, c]) => (
          <button key={k} type="button" className={off[k] ? 'off' : ''} onClick={() => setOff({ ...off, [k]: !off[k] })} title={off[k] ? 'Afficher' : 'Masquer'}>
            <i style={{ background: c }} />
            {l}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }} ref={box}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Activité par jour : DM, réponses, Looms et appels" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={() => onPick && hover !== null && onPick(buckets[hover])} style={onPick ? { cursor: 'pointer' } : undefined} onTouchStart={(e) => onMove(e.touches[0] ? { currentTarget: e.currentTarget, clientX: e.touches[0].clientX } : e)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#eceae4" />
              <text x={pad.l - 8} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#6b7489">{v}</text>
            </g>
          ))}
          {buckets.map((b, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={b.date} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill={b.date === today() ? '#16203a' : '#6b7489'} fontWeight={b.date === today() ? 700 : 400}>
                {lab(b)}
              </text>
            ) : null,
          )}
          {hb && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#c9ced9" strokeDasharray="3 3" />}
          {vis.map(([k, , c]) => (
            <g key={k}>
              {past.length > 1 && <polyline points={past.map((b, i) => `${x(i)},${y(b[k])}`).join(' ')} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              {past.map((b, i) => (n <= 31 || i === hover) && <circle key={i} cx={x(i)} cy={y(b[k])} r={i === hover ? 5 : 3.5} fill={c} stroke="#fff" strokeWidth="2" />)}
            </g>
          ))}
          {ends.map((e) => (
            <text key={e.k} x={x(last) + 10} y={e.yy + 4} fontSize="11.5" fill="#16203a" fontWeight="600">
              {e.l} {e.v}
            </text>
          ))}
        </svg>
        {hb && (
          <div className="card small chart-tip" style={{ left: `${Math.min(68, Math.max(2, (x(hover) / W) * 100 - 12))}%` }}>
            <b>{parSemaine ? `Semaine du ${fmtDate(hb.date)}` : fmtDate(hb.date)}</b>
            {SERIES.map(([k, l, c]) => (
              <div key={k} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <i style={{ display: 'inline-block', width: 8, height: 8, background: c, borderRadius: 2 }} />
                <span style={{ flex: 1 }}>{l}</span>
                <b>{hb[k]}</b>
              </div>
            ))}
            {onPick && <div className="tiny gold-ink">Clique pour voir le détail</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// Chiffre clé en grand, avec l'évolution par rapport à la période précédente
function BigKpi({ ico, label, value, cur, prev, sub, vs, fmt = nb, onClick }) {
  // Rien à comparer quand la période précédente est vide et l'actuelle aussi
  const comp = prev !== null && prev !== undefined && !(prev === 0 && cur === 0)
  const diff = comp ? cur - prev : 0
  const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const p = comp && prev ? Math.round((diff / prev) * 100) : null
  const pill = !comp ? null : diff === 0 ? '= stable' : `${diff > 0 ? '↑' : '↓'} ${p === null ? `+${fmt(diff)}` : `${Math.abs(p)} %`}`
  return (
    <div className={`bigkpi ${onClick ? 'pick' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}>
      <div className="bk-head">
        <span className="bk-ic"><Icon n={ico} size={16} /></span>
        {label}
      </div>
      <div className={`bk-value ${String(value).length > 13 ? 'long' : ''}`} title={String(value)}>
        {value}
      </div>
      <div className="bk-comp">
        {pill && <span className={`bk-delta ${cls}`}>{pill}</span>}
        {comp && <span className="bk-prev">{vs.charAt(0).toUpperCase() + vs.slice(1)} : {fmt(prev)}</span>}
      </div>
      {sub && <div className="bk-sub">{sub}</div>}
      {onClick && <span className="bk-more">Voir <Icon n="chevron" size={12} /></span>}
    </div>
  )
}


let dernierePeriode = '7 derniers jours'

export default function Dashboard({ onglet: ongletDemande }) {
  const { data, settings, actions } = useApp()
  const [mois, setMois] = useState(dernierePeriode)
  const [canal, setCanal] = useState('Tous')
  // Onglet mémorisé sur l'appareil ; les anciens noms d'onglets mènent au nouvel équivalent
  const [onglet, setOngletBrut] = useTab('dashboard', lireOnglet(), ANCIENS[ongletDemande] || ongletDemande)
  const setOnglet = (v) => {
    setOngletBrut(v)
    ecrireOnglet(v)
  }
  const [drill, setDrill] = useState(null)
  const periode = periodeFor(mois)
  const st = useMemo(() => computeStats(data, settings, periode, canal), [data, settings, mois, canal]) // eslint-disable-line react-hooks/exhaustive-deps
  dernierePeriode = mois
  const year = /^\d{4}-\d{2}$/.test(mois) ? Number(mois.slice(0, 4)) : Number(today().slice(0, 4))
  const series = useMemo(() => monthlySeries(data, settings, year, canal), [data, settings, year, canal])
  const months = useMemo(() => {
    const set = new Set(actions.map((a) => (a.date || '').slice(0, 7)).filter(Boolean))
    set.add(today().slice(0, 7))
    return [...set].sort().reverse()
  }, [actions])

  // Objectifs du mois en cours
  const cm = useMemo(() => computeStats(data, settings, periodeFor('Mois en cours'), 'Tous').cur, [data, settings])
  const t = parse(today())
  const dayN = t.getDate()
  const daysIn = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const om = settings.objectifsMois
  const GAUGE_KIND = { Appels: 'appels', DM: 'dm', RDV: 'rdv', 'Clients signés': 'signes', 'CA signé': 'ventes' }
  const goals = [
    ['Appels', cm.appels, om.appels, nb],
    ['DM', cm.dm, om.dm, nb],
    ['RDV', cm.rdv, om.rdv, nb],
    ['Clients signés', cm.signes, om.clients, nb],
    ['CA signé', cm.caSigne, om.ca, eur],
  ]

  const c = st.cur
  const pv = st.prev
  const d = (k) => (pv ? Math.round((c[k] - pv[k]) * 100) / 100 : null)
  const best = series.reduce((b, m) => (m.caSigne > (b?.caSigne ?? -1) ? m : b), null)
  const titre = mois === 'Tous' ? "Tout l'historique" : periode.semaine ? `${mois} (${fmtDate(periode.debut)} → ${fmtDate(periode.fin)})` : fmtMonth(periode.key)
  const vs = periode.prevLabel
  const act = activitySeries(data, periode, canal)
  const pvv = (k) => (pv ? pv[k] : null)
  const contacts = c.dm + c.appels
  // Clic sur un chiffre : ouvre la liste de ce qui le compose
  const voir = (titre, spec, opts = {}) => setDrill({ titre, spec, ...opts })
  const moisCourant = periodeFor('Mois en cours')
  const drillRes = drill
    ? detail(data, settings, periode, drill.canal ?? canal, drill.spec, drill.debut ?? periode.debut, drill.fin ?? periode.fin)
    : null
  const choisirMois = (key) => {
    setMois(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const secIc = (n) => (
    <span className="sec-ic">
      <Icon n={n} size={16} />
    </span>
  )
  const tauxRep = contacts ? c.reponses / contacts : null

  return (
    <div className="stack dash">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Tableau de bord</h1>
          <div className="sub">
            {titre}
            {canal !== 'Tous' ? `, canal ${canal}` : ', tous canaux'}
          </div>
        </div>
        <div className="row dash-filters">
          <label className="sr-only" htmlFor="dash-periode">
            Période
          </label>
          <select id="dash-periode" className="input" value={mois} onChange={(e) => setMois(e.target.value)}>
            <option value="7 derniers jours">7 derniers jours</option>
            <option value="30 derniers jours">30 derniers jours</option>
            <option value="Cette semaine">Cette semaine</option>
            <option value="Semaine dernière">Semaine dernière</option>
            <option value="Mois en cours">Mois en cours</option>
            <option value="Tous">Tout l'historique</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="dash-canal">
            Canal
          </label>
          <select id="dash-canal" className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="Tous">Tous les canaux</option>
            {settings.canaux.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>

      {drill && <Drill titre={drill.titre} sous={drill.sous || titre} res={drillRes} onClose={() => setDrill(null)} />}

      <Tabs
        items={[
          ['vue', "Vue d'ensemble"],
          ['acquisition', 'Acquisition'],
          ['conversion', 'Conversion'],
          ['finances', 'Finances'],
        ]}
        value={onglet}
        onChange={setOnglet}
      />

      {onglet === 'vue' && (
        <>
          <div className="bigkpis four">
            <BigKpi ico="coins" onClick={() => voir('Paiements reçus', { kind: 'encaisse' })} label="Encaissé" value={eur(c.encaisse)} cur={c.encaisse} prev={pvv('encaisse')} vs={vs} fmt={eur} sub={`Net après dépenses : ${eur(c.benefice)} · CA signé : ${eur(c.caSigne)}`} />
            <BigKpi ico="handshake" onClick={() => voir('Clients signés', { kind: 'signes' })} label="Clients signés" value={nb(c.signes)} cur={c.signes} prev={pvv('signes')} vs={vs} />
            <BigKpi ico="calendar" onClick={() => voir('RDV obtenus', { kind: 'rdv' })} label="RDV obtenus" value={nb(c.rdv)} cur={c.rdv} prev={pvv('rdv')} vs={vs} />
            <BigKpi ico="target" onClick={() => voir('Propositions envoyées', { kind: 'propositions' })} label="Taux de closing" value={c.propositions ? pct(c.closing) : '—'} cur={Math.round(c.closing * 100)} prev={pv ? Math.round(pv.closing * 100) : null} vs={vs} fmt={(v) => `${v} pts`} sub={`${nb(c.signes)} signé${c.signes > 1 ? 's' : ''} sur ${nb(c.propositions)} proposition${c.propositions > 1 ? 's' : ''}`} />
          </div>
          <ArgentPeriode periode={periode} titre={titre} depensesTotal={c.depenses} onVoir={voir} compact />

          <div className="mini-stats" role="list">
            <Mini label="Prospects ajoutés" v={c.prospects} d={d('prospects')} onClick={() => voir('Prospects ajoutés', { kind: 'prospects' })} />
            <Mini label="Appels" v={c.appels} d={d('appels')} onClick={() => voir('Appels', { kind: 'appels' })} />
            <Mini label="DM" v={c.dm} d={d('dm')} onClick={() => voir('DM envoyés', { kind: 'dm' })} />
            <Mini label="Réponses" v={c.reponses} d={d('reponses')} sub={tauxRep !== null ? `${pct(tauxRep)} de réponse` : null} onClick={() => voir('Réponses', { kind: 'reponses' })} />
            <Mini label="Propositions" v={c.propositions} d={d('propositions')} onClick={() => voir('Propositions envoyées', { kind: 'propositions' })} />
          </div>

          <button type="button" className="lien-journee" onClick={() => go('/journee')}>
            <Icon n="sun" size={15} /> Ce qu'il y a à faire aujourd'hui est dans Ma journée ({data.aRelancer.length} relance{data.aRelancer.length > 1 ? 's' : ''})
            <Icon n="arrow-right" size={14} />
          </button>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2 className="section">{secIc('target')} Objectifs du mois en cours</h2>
              <div className="gauges">
                {goals.map(([l, v, cible, fmt]) => (
                  <Gauge
                    key={l}
                    label={l}
                    value={v}
                    cible={cible}
                    proj={dayN ? (v / dayN) * daysIn : 0}
                    fmt={fmt}
                    onClick={() => voir(`${l} du mois`, { kind: GAUGE_KIND[l] }, { debut: moisCourant.debut, fin: moisCourant.fin, canal: 'Tous', sous: fmtMonth(moisCourant.key) })}
                  />
                ))}
              </div>
              <div className="tiny muted" style={{ marginTop: 10 }}>
                {fmtMonth(moisCourant.key)}, tous canaux. Projection : ton rythme actuel prolongé jusqu'à la fin du mois. Objectifs modifiables dans Paramètres.
              </div>
            </div>
            <div className="card">
              <h2 className="section">{secIc('funnel')} Entonnoir du pipeline</h2>
              <div className="tiny muted" style={{ marginBottom: 10 }}>Prospects ajoutés sur la période et jusqu'où ils sont allés</div>
              <Funnel steps={st.process} onPick={(i) => voir(`Entonnoir : ${st.process[i].label}`, { kind: 'etapeProcess', key: i })} />
              {st.perdus > 0 && (
                <button className="toggle-link tiny" style={{ marginTop: 4 }} onClick={() => voir('Prospects perdus', { kind: 'perdus' })}>
                  {st.perdus} perdu{st.perdus > 1 ? 's' : ''} sur la période
                </button>
              )}
            </div>
          </div>

          <CaMois series={series} year={year} om={om} best={best} choisirMois={choisirMois} canal={canal} />
        </>
      )}

      {onglet === 'acquisition' && (
        <>
          <div className="card">
            <h2 className="section">{secIc('trend')} Activité {act.parSemaine ? 'semaine par semaine' : 'jour par jour'}</h2>
            <ActivityChart buckets={act.buckets} parSemaine={act.parSemaine} onPick={(b) => voir(act.parSemaine ? `Activité de la semaine du ${fmtDate(b.date)}` : `Activité du ${fmtDate(b.date)}`, { kind: 'jour' }, { debut: b.date, fin: b.fin, sous: null })} />
          </div>
          <div className="card">
            <RateTable
              title="📡 Ce que produit chaque canal"
              onPick={(r) => voir(`Prospects du canal ${r.canal}`, { kind: 'canal', key: r.canal })}
              rows={[
                ...st.parCanal,
                st.parCanal.reduce(
                  (m, r) => ({
                    canal: 'Total',
                    actions: m.actions + r.actions,
                    reponses: m.reponses + r.reponses,
                    temps: m.temps + r.temps,
                    rdv: m.rdv + r.rdv,
                    clients: m.clients + r.clients,
                    ca: m.ca + r.ca,
                  }),
                  { actions: 0, reponses: 0, temps: 0, rdv: 0, clients: 0, ca: 0 },
                ),
              ].map((r) => ({
                ...r,
                taux: r.actions ? r.reponses / r.actions : 0,
                caHeure: r.temps ? r.ca / r.temps : 0,
                heuresClient: r.clients ? r.temps / r.clients : 0,
              }))}
              cols={[
                ['Canal', (r) => (r.canal === 'Total' ? <b>Total</b> : r.canal)],
                ['Actions', (r) => r.actions, 1],
                ['Réponses', (r) => r.reponses, 1],
                ['Taux', (r) => pct(r.taux), 1],
                ['Temps (h)', (r) => nb(r.temps, 1), 1],
                ['RDV', (r) => r.rdv, 1],
                ['Clients', (r) => r.clients, 1],
                ['CA signé', (r) => eur(r.ca), 1],
                ['CA / heure', (r) => (r.caHeure ? eur(r.caHeure) : '—'), 1],
              ]}
            />
          </div>
          <div className="card">
            <h2 className="section">{secIc('clock')} Quand tu prospectes et quand ça répond</h2>
            <div className="tiny muted" style={{ marginBottom: 10 }}>DM et appels de la période, par jour et par heure. Plus la case est foncée, plus tu as contacté ; le point doré signale des réponses.</div>
            <Heatmap periode={periode} canal={canal} onPick={(key, l) => voir(`Contacts du ${l}`, { kind: 'cellule', key })} />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2 className="section">{secIc('clock')} Meilleurs créneaux d'appel</h2>
              <HBars onPick={(r) => voir(`Appels ${r.label}`, { kind: 'creneau', key: r.key })} rows={st.creneaux.map((m) => ({ key: m.label.match(/\d+/g).map(Number), label: m.label, value: m.taux, sub: `${m.r} / ${m.n} appels` }))} fmt={pct} color={COULEURS[3]} />
            </div>
            <div className="card">
              <h2 className="section">{secIc('calendar')} Meilleurs jours d'appel</h2>
              <HBars onPick={(r) => voir(`Appels du ${r.label.toLowerCase()}`, { kind: 'jourSemaine', key: r.key })} rows={st.jours.map((m, i) => ({ key: i + 1, label: m.label, value: m.taux, sub: `${m.r} / ${m.n} appels` }))} fmt={pct} color={COULEURS[3]} />
            </div>
            <div className="card">
              <h2 className="section">{secIc('mail')} Accroches et modèles de message</h2>
              <HBars onPick={(r) => voir(`Modèle : ${r.label}`, { kind: 'modele', key: r.label })} rows={st.modeles.filter((m) => m.n).map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} envois` }))} fmt={pct} color={COULEURS[0]} empty="Choisis le modèle utilisé quand tu saisis un DM pour comparer tes accroches." />
            </div>
            <div className="card">
              <h2 className="section">{secIc('eye')} Taux de réponse par signal repéré</h2>
              <HBars onPick={(r) => voir(`Signal : ${r.label}`, { kind: 'signal', key: r.label })} rows={st.signaux.map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} prospects · ${m.signes} signé${m.signes > 1 ? 's' : ''}` }))} fmt={pct} color={COULEURS[1]} empty="Indique le signal repéré (pub moyenne, CTA flou…) à l'ajout d'un prospect." />
            </div>
            <div className="card">
              <h2 className="section">{secIc('radio')} D'où viennent tes prospects</h2>
              <Donut items={st.repCanal} total="prospects" onPick={(l) => voir(`Prospects du canal ${l}`, { kind: 'canal', key: l })} />
            </div>
            <div className="card">
              <h2 className="section">{secIc('tag')} Secteurs prospectés</h2>
              <Donut items={st.repSecteur} total="prospects" onPick={(l) => voir(`Secteur : ${l}`, { kind: 'secteur', key: l })} />
            </div>
          </div>
        </>
      )}

      {onglet === 'conversion' && (
        <>
          <div className="card">
            <h2 className="section">{secIc('layers')} Pipeline en cours, étape par étape</h2>
            <div className="tiny muted" style={{ marginBottom: 10 }}>Prospects ouverts aujourd'hui{canal !== 'Tous' ? ` venus du canal ${canal}` : ''}. Clique une étape pour ouvrir la liste filtrée.</div>
            <PipelineEtapes canal={canal} />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2 className="section">{secIc('bolt')} Vitesse et production</h2>
              <div className="tiny muted" style={{ marginBottom: 8 }}>Nombre de jours moyen pour passer d'une étape à la suivante</div>
              <HBars rows={st.vitesse.filter((r) => r.v !== null).map((r) => ({ label: r.label.replace('Jours ', ''), value: Math.round(r.v * 10) / 10 }))} fmt={(v) => `${nb(v, 1)} j`} color={COULEURS[6]} best={false} empty="Pas encore assez d'historique." />
              <table className="t" style={{ marginTop: 12 }}>
                <tbody>
                  {st.autres.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num bold">{r.v === null ? '—' : r.pct ? pct(r.v) : nb(r.v, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2 className="section">{secIc('ban')} Objections et motifs de perte</h2>
              <HBars onPick={(r) => voir(`Objection : ${r.label}`, { kind: 'objection', key: r.label })} rows={st.objections.filter((o) => o.n).map((o) => ({ label: o.label, value: o.n, sub: pct(o.part) }))} color={COULEURS[7]} empty="Aucune objection notée sur la période." />
              {st.perdus > 0 && (
                <button className="toggle-link tiny" style={{ marginTop: 8 }} onClick={() => voir('Prospects perdus', { kind: 'perdus' })}>
                  Voir les {st.perdus} prospect{st.perdus > 1 ? 's' : ''} perdu{st.perdus > 1 ? 's' : ''} sur la période
                </button>
              )}
            </div>
            <div className="card">
              <h2 className="section">{secIc('trophy')} Secteurs qui signent le plus</h2>
              <HBars onPick={(r) => voir(`Secteur : ${r.label}`, { kind: 'secteurSignes', key: r.label })} rows={st.secteurs.map((x) => ({ label: x.label, value: x.taux, sub: `${x.clients} client${x.clients > 1 ? 's' : ''} / ${x.prospects} · ${eur(x.ca)}` }))} fmt={pct} color={COULEURS[2]} />
            </div>
          </div>
        </>
      )}

      {onglet === 'finances' && (
        <>
          <div className="grid grid-4">
            <Kpi onClick={() => voir('Paiements reçus', { kind: 'encaisse' })} label="CA encaissé" value={eur(c.encaisse)} delta={d('encaisse')} vs={vs} navy />
            <Kpi onClick={() => voir('Ventes (CA signé)', { kind: 'ventes' })} label="CA signé" value={eur(c.caSigne)} delta={d('caSigne')} vs={vs} />
            <Kpi onClick={() => voir('Dépenses de la période', { kind: 'depenses' })} label="Bénéfice net" value={eur(c.benefice)} delta={d('benefice')} vs={vs} />
            <Kpi onClick={() => voir('Clients abonnés', { kind: 'abonnes' })} label="Revenu récurrent (MRR)" value={`${eur(st.mrr)}/mois`} />
          </div>
          <div className="grid grid-2 argent-grid" style={{ alignItems: 'start' }}>
            <ArgentPeriode periode={periode} titre={titre} depensesTotal={c.depenses} onVoir={voir} />
            <RentabiliteClients periode={periode} />
          </div>
          <div className="card">
            <h2 className="section">{secIc('target')} Ce mois-ci : CA cumulé face à l'objectif</h2>
            <CumulMois canal={canal} />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2 className="section">{secIc('wallet')} Pipeline et trésorerie</h2>
              <div className="info-grid">
                {[
                  ['Pipeline pondéré', eur(st.pipelinePondere), { kind: 'pipeline' }],
                  ['Propositions en attente', eur(st.propositionsEnAttente), { kind: 'propositionsAttente' }],
                  ['CA nouveaux clients', eur(c.caNouveaux)],
                  ['CA clients fidèles', eur(c.caFideles)],
                  ['Interventions', nb(c.interventions), { kind: 'interventions' }],
                  ['Reste à encaisser', eur(st.resteAEncaisser), { kind: 'resteClients' }],
                  ['Dépenses de la période', eur(c.depenses), { kind: 'depenses' }],
                  ["Coût d'acquisition / client", c.cac === null ? '—' : eur(c.cac)],
                  ['Valeur vie client moyenne', eur(st.vieMoy)],
                  ['Taux de résiliation', pct(st.churn)],
                ].map(([k, v, spec]) =>
                  spec ? (
                    <button key={k} type="button" className="info-pick" onClick={() => voir(k, spec)}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </button>
                  ) : (
                    <div key={k}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ),
                )}
              </div>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau" style={{ marginTop: 14 }}>
                <table className="t">
                  <thead>
                    <tr>
                      <th>Prévision</th>
                      <th className="num">Encaissements</th>
                      <th className="num">Dépenses fixes</th>
                      <th className="num">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((k) => {
                      const dt = new Date(t.getFullYear(), t.getMonth() + k, 1)
                      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
                      const inn = st.mrrTous + (k === 1 ? st.resteTous : 0)
                      return (
                        <tr key={k}>
                          <td>{fmtMonth(key)}</td>
                          <td className="num">{eur(inn)}</td>
                          <td className="num">{eur(st.fixes)}</td>
                          <td className={`num ${inn - st.fixes < 0 ? 'red' : 'green'}`}>{eur(inn - st.fixes)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  Prévision tous canaux : le mois prochain inclut le reste à encaisser, ensuite seulement les abonnements actifs.
                </div>
              </div>
            </div>
            <div className="stack">
              <div className="card">
                <h2 className="section">{secIc('coins')} CA signé par offre</h2>
                <Donut items={st.repOffre} fmt={eur} total="CA signé" onPick={(l) => voir(`Ventes : ${l}`, { kind: 'offre', key: l })} />
              </div>
              <div className="card">
                <h2 className="section">{secIc('wallet')} Dépenses par catégorie</h2>
                <Donut items={depensesParCategorie(data, periode)} fmt={eur} total="dépenses" onPick={(l) => voir(`Dépenses : ${l}`, { kind: 'depenses', key: l === 'Autres' ? '' : l })} />
              </div>
            </div>
          </div>
          <div className="card">
            <h2 className="section">{secIc('trophy')} Meilleurs clients (CA signé)</h2>
            <MeilleursClients canal={canal} />
          </div>
        </>
      )}
    </div>
  )
}

// Onglet du tableau de bord gardé sur l'appareil
const ONGLETS = ['vue', 'acquisition', 'conversion', 'finances']
const ANCIENS = { prospection: 'acquisition', marche: 'acquisition', ventes: 'finances', clients: 'finances' }
function lireOnglet() {
  try {
    const v = localStorage.getItem('crm-dash-onglet')
    return ONGLETS.includes(v) ? v : 'vue'
  } catch {
    return 'vue'
  }
}
function ecrireOnglet(v) {
  try {
    localStorage.setItem('crm-dash-onglet', v)
  } catch {
    /* stockage indisponible */
  }
}

// Chiffre secondaire de la ligne compacte, avec son évolution
function Mini({ label, v, d, sub, onClick }) {
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
  return (
    <button type="button" role="listitem" className="mini" onClick={onClick}>
      <span className="mini-l">{label}</span>
      <span className="mini-v">{nb(v)}</span>
      {d !== null && d !== undefined && (
        <span className={`mini-d ${cls}`}>
          <span className="sr-only">Évolution : </span>
          {d > 0 ? '↑ +' : d < 0 ? '↓ ' : '= '}
          {d === 0 ? 'stable' : nb(d)}
        </span>
      )}
      {sub && <span className="mini-s">{sub}</span>}
    </button>
  )
}

// CA mois par mois de l'année, avec l'objectif mensuel et le tableau détaillé
function CaMois({ series, year, om, best, choisirMois, canal }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 className="section" style={{ margin: 0 }}>
          <span className="sec-ic">
            <Icon n="trend" size={16} />
          </span>
          CA mois par mois ({year}
          {canal !== 'Tous' ? `, ${canal}` : ''})
        </h2>
        <div className="legend">
          <span>
            <i style={{ background: C_SIGNE }} />
            CA signé
          </span>
          <span>
            <i style={{ background: C_ENC }} />
            Encaissé
          </span>
          <span>
            <i style={{ background: 'none', borderTop: '2px dashed #C0322E', borderRadius: 0, height: 0, width: 14 }} />
            Objectif mensuel
          </span>
          {best && best.caSigne > 0 && (
            <span className="row" style={{ gap: 4 }}>
              <Icon n="trophy" size={14} /> Meilleur mois : {fmtMonth(best.key)} ({eur(best.caSigne)})
            </span>
          )}
        </div>
      </div>
      <MonthChart series={series} objectif={Number(om.ca) || 0} onPick={choisirMois} />
      <details style={{ marginTop: 10 }}>
        <summary className="small bold" style={{ cursor: 'pointer', color: 'var(--navy)' }}>
          Voir le tableau mois par mois
        </summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau" style={{ marginTop: 8 }}>
          <table className="t">
            <thead>
              <tr>
                {['Mois', 'Prospects', 'Appels', 'DM', 'RDV', 'Clients', 'CA signé', 'Encaissé', 'Dépenses', 'Bénéfice'].map((h, i) => (
                  <th key={h} className={i ? 'num' : ''}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((m) => (
                <tr key={m.key} className="click" onClick={() => choisirMois(m.key)}>
                  <td>{fmtMonth(m.key)}</td>
                  <td className="num">{m.prospects}</td>
                  <td className="num">{m.appels}</td>
                  <td className="num">{m.dm}</td>
                  <td className="num">{m.rdv}</td>
                  <td className="num">{m.signes}</td>
                  <td className="num">{eur(m.caSigne)}</td>
                  <td className="num">{eur(m.encaisse)}</td>
                  <td className="num">{eur(m.depenses)}</td>
                  <td className={`num ${m.benefice < 0 ? 'red' : ''}`}>{eur(m.benefice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
