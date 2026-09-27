import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, Kpi, eur, pct, nb, Tabs, useTab } from '../ui'
import { Icon, withIcon } from '../icons'
import { Donut, HBars, Funnel, Gauge, COULEURS, useWidth } from '../charts'
import { computeStats, periodeFor, monthlySeries, activitySeries } from '../lib/logic'
import { today, fmtMonth, fmtMonthShort, fmtDate, parse } from '../lib/dates'

const C_SIGNE = '#3b5aa8'
const C_ENC = '#b8862b'

function MonthChart({ series, objectif = 0 }) {
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
              {v >= 1000 ? `${nb(v / 1000, 1)} k` : v}
            </text>
          </g>
        ))}
        {series.map((m, i) => {
          const x0 = pad.l + i * gw + (gw - 2 * bw - 2) / 2
          return (
            <g key={m.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * gw} y={pad.t} width={gw} height={ih} fill={hover === i ? '#f3f5f9' : 'transparent'} />
              {bar(x0, m.caSigne, C_SIGNE)}
              {bar(x0 + bw + 2, m.encaisse, C_ENC)}
              <text x={pad.l + i * gw + gw / 2} y={H - 8} fontSize="10.5" textAnchor="middle" fill="#667085">
                {fmtMonthShort(m.key)}
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

function RateTable({ title, rows, cols }) {
  return (
    <div>
      <h2 className="section">{withIcon(title)}</h2>
      <div className="table-wrap">
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
              <tr key={i}>
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
function ActivityChart({ buckets, parSemaine }) {
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
  const pad = { l: 34, r: 74, t: 14, b: 28 }
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
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Activité par jour : DM, réponses, Looms et appels" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={(e) => onMove(e.touches[0] ? { currentTarget: e.currentTarget, clientX: e.touches[0].clientX } : e)}>
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
          </div>
        )}
      </div>
    </div>
  )
}

// Chiffre clé en grand, avec l'évolution par rapport à la période précédente
function BigKpi({ ico, label, value, cur, prev, sub, vs, fmt = nb }) {
  const comp = prev !== null && prev !== undefined
  const diff = comp ? cur - prev : 0
  const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const p = comp && prev ? Math.round((diff / prev) * 100) : null
  const pill = !comp ? null : diff === 0 ? '= stable' : `${diff > 0 ? '↑' : '↓'} ${p === null ? `+${fmt(diff)}` : `${Math.abs(p)} %`}`
  return (
    <div className="bigkpi">
      <div className="bk-head">
        <span className="bk-ic"><Icon n={ico} size={16} /></span>
        {label}
      </div>
      <div className="bk-value">{value}</div>
      <div className="bk-comp">
        {pill && <span className={`bk-delta ${cls}`}>{pill}</span>}
        {comp && <span className="bk-prev">{vs.charAt(0).toUpperCase() + vs.slice(1)} : {fmt(prev)}</span>}
      </div>
      {sub && <div className="bk-sub">{sub}</div>}
    </div>
  )
}

let dernierePeriode = 'Cette semaine'

export default function Dashboard() {
  const { data, settings, actions } = useApp()
  const [mois, setMois] = useState(dernierePeriode)
  const [canal, setCanal] = useState('Tous')
  const [onglet, setOnglet] = useTab('dashboard', 'vue')
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

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Tableau de bord</h1>
          <div className="sub">
            {titre}
            {canal !== 'Tous' ? `, canal ${canal}` : ', tous canaux'}
          </div>
        </div>
        <div className="row">
          <select className="input" style={{ width: 'auto' }} value={mois} onChange={(e) => setMois(e.target.value)}>
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
          <select className="input" style={{ width: 'auto' }} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="Tous">Tous les canaux</option>
            {settings.canaux.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>

      <Tabs
        items={[
          ['vue', "Vue d'ensemble"],
          ['prospection', 'Prospection'],
          ['ventes', 'Ventes et CA'],
          ['marche', 'Ce qui marche'],
        ]}
        value={onglet}
        onChange={setOnglet}
      />

      {onglet === 'vue' && (
        <>
        <div className="bigkpis">
          <BigKpi ico="instagram" label="DM envoyés" value={nb(c.dm)} cur={c.dm} prev={pvv('dm')} vs={vs} />
          <BigKpi ico="message" label="Réponses" value={nb(c.reponses)} cur={c.reponses} prev={pvv('reponses')} vs={vs} sub={contacts ? `${pct(c.reponses / contacts)} de réponse` : null} />
          <BigKpi ico="play" label="Looms envoyées" value={nb(c.looms)} cur={c.looms} prev={pvv('looms')} vs={vs} />
          <BigKpi ico="phone" label="Appels" value={nb(c.appels)} cur={c.appels} prev={pvv('appels')} vs={vs} />
          <BigKpi ico="handshake" label="Signatures" value={nb(c.signes)} cur={c.signes} prev={pvv('signes')} vs={vs} sub={c.propositions ? `${pct(c.closing)} des propositions` : null} />
          <BigKpi ico="coins" label="CA signé" value={eur(c.caSigne)} cur={c.caSigne} prev={pvv('caSigne')} vs={vs} fmt={eur} sub={`Encaissé : ${eur(c.encaisse)}`} />
        </div>

        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="trend" size={16} /></span> Activité {act.parSemaine ? 'semaine par semaine' : 'jour par jour'}</h2>
          <ActivityChart buckets={act.buckets} parSemaine={act.parSemaine} />
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h2 className="section"><span className="sec-ic"><Icon n="funnel" size={16} /></span> Entonnoir de ton process</h2>
            <div className="tiny muted" style={{ marginBottom: 10 }}>Prospects ajoutés sur la période et jusqu'où ils sont allés</div>
            <Funnel steps={st.process} />
            {st.perdus > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>{st.perdus} perdu{st.perdus > 1 ? 's' : ''} sur la période.</div>}
          </div>

          <div className="card">
            <h2 className="section"><span className="sec-ic"><Icon n="target" size={16} /></span> Objectifs du mois en cours</h2>
            <div className="gauges">
              {goals.map(([l, v, cible, fmt]) => (
                <Gauge key={l} label={l} value={v} cible={cible} proj={dayN ? (v / dayN) * daysIn : 0} fmt={fmt} />
              ))}
            </div>
            <div className="tiny muted" style={{ marginTop: 10 }}>Projection : ton rythme actuel prolongé jusqu'à la fin du mois. Objectifs modifiables dans Paramètres.</div>
          </div>
        </div>

        </>
      )}

      {onglet === 'prospection' && (
        <>
          <div className="grid grid-4">
            <Kpi label="Prospects ajoutés" value={nb(c.prospects)} delta={d('prospects')} vs={vs} navy />
            <Kpi label="Contacts (DM + appels)" value={nb(contacts)} delta={pv ? contacts - pv.dm - pv.appels : null} vs={vs} navy />
            <Kpi label="RDV obtenus" value={nb(c.rdv)} delta={d('rdv')} vs={vs} />
            <Kpi label="Propositions" value={nb(c.propositions)} delta={d('propositions')} vs={vs} />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="radio" size={16} /></span> D'où viennent tes prospects</h2>
          <Donut items={st.repCanal} total="prospects" />
        </div>
          <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="tag" size={16} /></span> Secteurs prospectés</h2>
          <Donut items={st.repSecteur} total="prospects" />
        </div>
          </div>
        <div className="card">
          <RateTable
            title="📡 Ce que produit chaque canal"
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
              ['Heures / client', (r) => (r.heuresClient ? nb(r.heuresClient, 1) : '—'), 1],
            ]}
          />
        </div>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="bolt" size={16} /></span> Vitesse et production</h2>
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
          </div>
        </>
      )}

      {onglet === 'ventes' && (
        <>
          <div className="grid grid-4">
            <Kpi label="CA signé" value={eur(c.caSigne)} delta={d('caSigne')} vs={vs} navy />
            <Kpi label="Bénéfice net" value={eur(c.benefice)} delta={d('benefice')} vs={vs} navy />
            <Kpi label="Taux de closing" value={pct(c.closing)} />
            <Kpi label="Revenu récurrent (MRR)" value={eur(st.mrr)} />
          </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 className="section" style={{ margin: 0 }}>
              <span className="sec-ic"><Icon n="trend" size={16} /></span> CA mois par mois ({year})
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
                <i style={{ background: 'none', borderTop: '2px dashed #c8423f', borderRadius: 0, height: 0, width: 14 }} />
                Objectif mensuel
              </span>
              {best && best.caSigne > 0 && <span className="row" style={{ gap: 4 }}><Icon n="trophy" size={14} /> Meilleur mois : {fmtMonth(best.key)} ({eur(best.caSigne)})</span>}
            </div>
          </div>
          <MonthChart series={series} objectif={Number(om.ca) || 0} />
          <details style={{ marginTop: 10 }}>
            <summary className="small bold" style={{ cursor: 'pointer', color: 'var(--navy)' }}>
              Voir le tableau mois par mois
            </summary>
            <div className="table-wrap" style={{ marginTop: 8 }}>
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
                    <tr key={m.key}>
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

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="coins" size={16} /></span> CA signé par offre</h2>
          <Donut items={st.repOffre} fmt={eur} total="CA signé" />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="wallet" size={16} /></span> Pipeline et trésorerie</h2>
          <div className="info-grid">
            {[
              ['Pipeline pondéré', eur(st.pipelinePondere)],
              ['Propositions en attente', eur(st.propositionsEnAttente)],
              ['CA nouveaux clients', eur(c.caNouveaux)],
              ['CA clients fidèles', eur(c.caFideles)],
              ['Interventions', nb(c.interventions)],
              ['Reste à encaisser', eur(st.resteAEncaisser)],
              ['Dépenses de la période', eur(c.depenses)],
              ["Coût d'acquisition / client", c.cac === null ? '—' : eur(c.cac)],
              ['Heures de prospection', nb(c.tempsH, 1)],
              ['Valeur vie client moyenne', eur(st.vieMoy)],
              ['Taux de résiliation', pct(st.churn)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="k">{k}</div>
                <div className="v">{v}</div>
              </div>
            ))}
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
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
              Le mois prochain inclut le reste à encaisser ; ensuite, seulement les abonnements actifs.
            </div>
          </div>
        </div>

          </div>
        </>
      )}

      {onglet === 'marche' && (
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="mail" size={16} /></span> Taux de réponse par script / accroche</h2>
          <HBars rows={st.modeles.filter((m) => m.n).map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} envois` }))} fmt={pct} color={COULEURS[0]} empty="Choisis le modèle utilisé quand tu saisis un DM pour comparer tes scripts." />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="eye" size={16} /></span> Taux de réponse par signal repéré</h2>
          <HBars rows={st.signaux.map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} prospects · ${m.signes} signé${m.signes > 1 ? 's' : ''}` }))} fmt={pct} color={COULEURS[1]} empty="Indique le signal repéré (pub moyenne, CTA flou…) à l'ajout d'un prospect." />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="trophy" size={16} /></span> Secteurs qui signent le plus</h2>
          <HBars rows={st.secteurs.map((x) => ({ label: x.label, value: x.taux, sub: `${x.clients} client${x.clients > 1 ? 's' : ''} / ${x.prospects} · ${eur(x.ca)}` }))} fmt={pct} color={COULEURS[2]} />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="ban" size={16} /></span> Objections et motifs de perte</h2>
          <HBars rows={st.objections.filter((o) => o.n).map((o) => ({ label: o.label, value: o.n, sub: pct(o.part) }))} color={COULEURS[7]} empty="Aucune objection notée sur la période." />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="clock" size={16} /></span> Meilleurs créneaux d'appel</h2>
          <HBars rows={st.creneaux.map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} appels` }))} fmt={pct} color={COULEURS[3]} />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="calendar" size={16} /></span> Meilleurs jours d'appel</h2>
          <HBars rows={st.jours.map((m) => ({ label: m.label, value: m.taux, sub: `${m.r} / ${m.n} appels` }))} fmt={pct} color={COULEURS[3]} />
        </div>
      </div>
      )}
    </div>
  )
}
