import { useMemo, useState } from 'react'
import { useApp, Kpi, Bar, eur, pct, nb } from '../ui'
import { Icon, withIcon } from '../icons'
import { computeStats, periodeFor, monthlySeries } from '../lib/logic'
import { today, fmtMonth, fmtMonthShort, parse } from '../lib/dates'

const C_SIGNE = '#3b5aa8'
const C_ENC = '#b8862b'

function MonthChart({ series }) {
  const [hover, setHover] = useState(null)
  const W = 640
  const H = 220
  const pad = { l: 48, r: 8, t: 12, b: 26 }
  const max = Math.max(1, ...series.flatMap((m) => [m.caSigne, m.encaisse]))
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
    <div style={{ position: 'relative' }}>
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

export default function Dashboard() {
  const { data, settings, actions } = useApp()
  const [mois, setMois] = useState('Mois en cours')
  const [canal, setCanal] = useState('Tous')
  const periode = periodeFor(mois)
  const st = useMemo(() => computeStats(data, settings, periode, canal), [data, settings, mois, canal]) // eslint-disable-line react-hooks/exhaustive-deps
  const year = mois === 'Tous' || mois === 'Mois en cours' ? Number(today().slice(0, 4)) : Number(mois.slice(0, 4))
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
  const funnelMax = Math.max(1, st.funnel[0]?.n || 0)
  const titre = mois === 'Tous' ? "Tout l'historique" : fmtMonth(periode.key)

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

      <div className="grid grid-6">
        <Kpi label="Prospects ajoutés" value={nb(c.prospects)} delta={d('prospects')} />
        <Kpi label="Appels passés" value={nb(c.appels)} delta={d('appels')} />
        <Kpi label="DM envoyés" value={nb(c.dm)} delta={d('dm')} />
        <Kpi label="Réponses" value={nb(c.reponses)} delta={d('reponses')} />
        <Kpi label="RDV obtenus" value={nb(c.rdv)} delta={d('rdv')} />
        <Kpi label="Propositions" value={nb(c.propositions)} delta={d('propositions')} />
        <Kpi label="Clients signés" value={nb(c.signes)} delta={d('signes')} navy />
        <Kpi label="Taux de closing" value={pct(c.closing)} navy />
        <Kpi label="CA signé" value={eur(c.caSigne)} delta={d('caSigne')} navy />
        <Kpi label="CA encaissé" value={eur(c.encaisse)} delta={d('encaisse')} navy />
        <Kpi label="Bénéfice net" value={eur(c.benefice)} delta={d('benefice')} navy />
        <Kpi label="Revenu récurrent (MRR)" value={eur(st.mrr)} navy />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="target" size={16} /></span> Objectifs du mois en cours</h2>
          {goals.map(([l, v, cible, fmt]) => {
            const proj = dayN ? (v / dayN) * daysIn : 0
            const ok = proj >= cible
            return (
              <div className="goal" key={l}>
                <div className="bold small">{l}</div>
                <div>
                  <Bar value={v} max={cible} tone={v >= cible ? 'green' : ''} />
                  <div className="tiny muted" style={{ marginTop: 3 }}>
                    Projection fin de mois : {fmt(Math.round(proj))}
                  </div>
                </div>
                <div className="right small nowrap">
                  <b>{fmt(v)}</b> / {fmt(cible)}
                  <div className={`tiny ${ok ? 'green' : 'red'}`}>{ok ? '✔ En avance' : '✖ En retard'}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="funnel" size={16} /></span> Entonnoir du pipeline</h2>
          <div className="tiny muted" style={{ marginBottom: 8 }}>
            Prospects ajoutés sur la période, étape la plus haute atteinte
          </div>
          {st.funnel.map((f, i) => (
            <div className="funnel-row" key={f.nom}>
              <div className="small bold">{f.nom}</div>
              <div>
                <div className={`funnel-bar ${f.nom === 'Gagné' ? 'win' : ''}`} style={{ width: `${Math.max(6, (f.n / funnelMax) * 100)}%` }}>
                  {f.n}
                </div>
              </div>
              <div className="tiny muted right">{i > 0 ? pct(st.funnel[i - 1].n ? f.n / st.funnel[i - 1].n : 0) : ''}</div>
            </div>
          ))}
          <div className="funnel-row">
            <div className="small bold muted">Perdus</div>
            <div className="small muted">{st.perdus}</div>
            <div />
          </div>
        </div>
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
            {best && best.caSigne > 0 && <span className="row" style={{ gap: 4 }}><Icon n="trophy" size={14} /> Meilleur mois : {fmtMonth(best.key)} ({eur(best.caSigne)})</span>}
          </div>
        </div>
        <MonthChart series={series} />
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
          <h2 className="section"><span className="sec-ic"><Icon n="wallet" size={16} /></span> Pipeline et trésorerie</h2>
          <div className="info-grid">
            {[
              ['Pipeline pondéré', eur(st.pipelinePondere)],
              ['Propositions en attente', eur(st.propositionsEnAttente)],
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

        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="bolt" size={16} /></span> Vitesse et production</h2>
          <table className="t">
            <tbody>
              {[...st.vitesse, ...st.autres].map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num bold">{r.v === null ? '—' : r.pct ? pct(r.v) : nb(r.v, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <RateTable
            title="⏰ Meilleurs créneaux d'appel"
            rows={st.creneaux}
            cols={[
              ['Créneau', (r) => r.label],
              ['Appels', (r) => r.n, 1],
              ['Réponses', (r) => r.r, 1],
              ['Taux', (r) => pct(r.taux), 1],
            ]}
          />
        </div>
        <div className="card">
          <RateTable
            title="📅 Meilleurs jours d'appel"
            rows={st.jours}
            cols={[
              ['Jour', (r) => r.label],
              ['Appels', (r) => r.n, 1],
              ['Réponses', (r) => r.r, 1],
              ['Taux', (r) => pct(r.taux), 1],
            ]}
          />
        </div>
        <div className="card">
          <RateTable
            title="✉ Accroches et modèles (test A/B)"
            rows={st.modeles}
            cols={[
              ['Modèle', (r) => r.label],
              ['Envois', (r) => r.n, 1],
              ['Réponses', (r) => r.r, 1],
              ['Taux', (r) => pct(r.taux), 1],
            ]}
          />
        </div>
        <div className="card">
          <RateTable
            title="🚫 Objections et motifs de perte"
            rows={st.objections}
            cols={[
              ['Objection', (r) => r.label],
              ['Nombre', (r) => r.n, 1],
              ['Part', (r) => pct(r.part), 1],
            ]}
          />
        </div>
      </div>

      <div className="card">
        <RateTable
          title="🏷 Secteurs qui signent le plus"
          rows={st.secteurs}
          cols={[
            ['Secteur', (r) => r.label],
            ['Prospects', (r) => r.prospects, 1],
            ['Clients', (r) => r.clients, 1],
            ['Taux', (r) => pct(r.taux), 1],
            ['CA signé', (r) => eur(r.ca), 1],
            ['Cycle moyen (j)', (r) => (r.cycle === null ? '—' : nb(r.cycle, 1)), 1],
          ]}
        />
        {st.secteurs.length === 0 && <div className="empty">Pas encore de données.</div>}
      </div>
    </div>
  )
}
