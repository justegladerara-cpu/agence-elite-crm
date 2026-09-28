// Graphiques du tableau de bord (SVG, sans bibliothèque) : anneau, barres, entonnoir, jauge.
import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

// Couleurs des séries, toujours dans le même ordre (lisibles aussi pour les daltoniens)
export const COULEURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const AUTRES = '#a3a9b8'

// Largeur réelle d'un bloc (textes lisibles sur mobile)
export function useWidth(def = 600) {
  const ref = useRef(null)
  const [w, setW] = useState(def)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Anneau de répartition : 5 parts au plus, le reste regroupé dans « Autres »
export function Donut({ items, fmt = (v) => v, total: totalLabel = 'Total', max = 5, onPick }) {
  const [hover, setHover] = useState(null)
  const sorted = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const parts = sorted.slice(0, max).map((x, i) => ({ ...x, color: COULEURS[i] }))
  const reste = sorted.slice(max).reduce((m, x) => m + x.value, 0)
  if (reste > 0) parts.push({ label: 'Autres', value: reste, color: AUTRES })
  const total = parts.reduce((m, x) => m + x.value, 0)
  if (!total) return <div className="empty">Pas encore de données sur la période.</div>
  const R = 60
  const r = 40
  const C = 70
  let a0 = -Math.PI / 2
  const arcs = parts.map((p) => {
    const a = (p.value / total) * Math.PI * 2
    const a1 = a0 + a
    const gap = parts.length > 1 ? 0.025 : 0
    const s = a0 + gap / 2
    const e = a1 - gap / 2
    const large = e - s > Math.PI ? 1 : 0
    const pt = (rad, ang) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`
    const d =
      parts.length === 1
        ? `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} L${C - 0.01},${C - r} A${r},${r} 0 1 0 ${C},${C - r} Z`
        : `M${pt(R, s)} A${R},${R} 0 ${large} 1 ${pt(R, e)} L${pt(r, e)} A${r},${r} 0 ${large} 0 ${pt(r, s)} Z`
    a0 = a1
    return { ...p, d }
  })
  const h = hover !== null ? arcs[hover] : null
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {arcs.map((p, i) => (
          <path
            key={p.label}
            d={p.d}
            fill={p.color}
            opacity={hover === null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => (onPick && p.label !== 'Autres' ? onPick(p.label) : setHover(hover === i ? null : i))}
            style={onPick && p.label !== 'Autres' ? { cursor: 'pointer' } : undefined}
          />
        ))}
        <text x="70" y="66" textAnchor="middle" fontSize={String(h ? fmt(h.value) : fmt(total)).length > 9 ? 11.5 : 17} fontWeight="700" fill="#16203a">
          {h ? fmt(h.value) : fmt(total)}
        </text>
        <text x="70" y="82" textAnchor="middle" fontSize="9.5" fill="#6b7489">
          {h ? `${Math.round((h.value / total) * 100)} %` : totalLabel}
        </text>
      </svg>
      <div className="donut-legend">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={`${hover === i ? 'on' : ''} ${onPick && p.label !== 'Autres' ? 'pick' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onPick && p.label !== 'Autres' && onPick(p.label)}
          >
            <i style={{ background: p.color }} />
            <span className="dl-l">{p.label}</span>
            <b>{fmt(p.value)}</b>
            <span className="dl-p">{Math.round((p.value / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Barres horizontales : une ligne par élément, valeur au bout de la barre
export function HBars({ rows, fmt = (v) => v, color = COULEURS[0], empty = 'Pas encore de données sur la période.', best = true, onPick }) {
  const vis = rows.filter((r) => r.value !== null && r.value !== undefined)
  if (!vis.length || vis.every((r) => !r.value && !r.n)) return <div className="empty">{empty}</div>
  const max = Math.max(...vis.map((r) => r.value), 0) || 1
  const top = best ? Math.max(...vis.map((r) => r.value)) : null
  return (
    <div className="hbars">
      {vis.map((r) => (
        <div
          className={`hb-row ${onPick ? 'pick' : ''}`}
          key={r.label}
          title={r.title || (onPick ? 'Voir le détail' : '')}
          onClick={() => onPick && onPick(r)}
          role={onPick ? 'button' : undefined}
        >
          <div className="hb-l">
            {r.label}
            {r.sub && <span className="hb-sub">{r.sub}</span>}
          </div>
          <div className="hb-track">
            <span style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%`, background: best && r.value === top && top > 0 ? color : `${color}8c` }} />
          </div>
          <div className="hb-v">{fmt(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

// Entonnoir : largeur = nombre de prospects, taux de passage entre les étapes, plus grosse fuite en rouge
export function Funnel({ steps, onPick }) {
  const [ref, W] = useWidth(560)
  const top = steps[0]?.n || 0
  if (!top) return <div ref={ref} className="empty">Aucun prospect ajouté sur la période.</div>
  const rowH = 38
  const gap = 18
  const labW = W < 460 ? 96 : 130
  const rateW = W < 460 ? 64 : 90
  const iw = W - labW - rateW
  const H = steps.length * rowH + (steps.length - 1) * gap
  const wOf = (n) => Math.max(26, (n / top) * iw)
  // Plus grosse perte : le plus faible taux de passage (hors étapes vides)
  let fuite = -1
  let pire = 2
  steps.forEach((s, i) => {
    if (!i || !steps[i - 1].n) return
    const t = s.n / steps[i - 1].n
    if (t < pire) {
      pire = t
      fuite = i
    }
  })
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={steps.map((s) => `${s.label} ${s.n}`).join(', ')}>
        {steps.map((s, i) => {
          const y = i * (rowH + gap)
          const w = wOf(s.n)
          const x = labW + (iw - w) / 2
          const next = steps[i + 1]
          const win = i === steps.length - 1
          return (
            <g key={s.label} onClick={() => onPick && onPick(i)} style={onPick ? { cursor: 'pointer' } : undefined}>
              {onPick && <title>{`Voir les ${s.n} prospects « ${s.label} »`}</title>}
              <text x={0} y={y + rowH / 2 + 4} fontSize="12.5" fontWeight="600" fill="#16203a">
                {s.label}
              </text>
              <rect x={x} y={y} width={w} height={rowH} rx="8" style={{ fill: win ? '#1d8a61' : `rgba(var(--navy-rgb), ${1 - i * 0.09})` }} />
              <text x={labW + iw / 2} y={y + rowH / 2 + 5} fontSize="14" fontWeight="700" fill="#fff" textAnchor="middle">
                {s.n}
              </text>
              {next && (
                <>
                  <path d={`M${x + 6},${y + rowH} L${labW + (iw - wOf(next.n)) / 2 + 6},${y + rowH + gap} L${labW + (iw + wOf(next.n)) / 2 - 6},${y + rowH + gap} L${x + w - 6},${y + rowH} Z`} style={{ fill: i + 1 === fuite ? 'rgba(200,66,63,.18)' : 'rgba(var(--navy-rgb), .07)' }} />
                  <text x={W - 2} y={y + rowH + gap / 2 + 4} fontSize="11.5" textAnchor="end" fontWeight={i + 1 === fuite ? 700 : 500} fill={i + 1 === fuite ? '#c8423f' : '#6b7489'}>
                    {s.n ? `${Math.round((next.n / s.n) * 100)} %` : '—'}
                    {i + 1 === fuite ? ' ⚠' : ''}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      {fuite > 0 && (
        <div className="funnel-alert">
          Plus grosse perte : <b>{steps[fuite - 1].label} → {steps[fuite].label}</b> ({Math.round(pire * 100)} % passent). C'est l'étape à travailler en priorité.
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 6 }}>
        Globalement : {Math.round(((steps[steps.length - 1].n || 0) / top) * 1000) / 10} % des prospects ajoutés sont signés.
      </div>
    </div>
  )
}

// Jauge d'objectif : anneau rempli selon l'avancement, projection de fin de mois
export function Gauge({ label, value, cible, proj, fmt = (v) => v, onClick }) {
  const r = 34
  const c = 2 * Math.PI * r
  const p = cible ? Math.min(1, value / cible) : 0
  const ok = proj >= cible
  const done = value >= cible && cible > 0
  const col = done ? '#1d8a61' : ok ? 'var(--gold)' : '#c8423f'
  return (
    <div className={`gauge ${onClick ? 'pick' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <svg viewBox="0 0 84 84" role="img" aria-label={`${label} : ${fmt(value)} sur ${fmt(cible)}`}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="#eceae4" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" style={{ stroke: col }} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 42 42)" />
        <text x="42" y="47" textAnchor="middle" fontSize="15" fontWeight="700" fill="#16203a">
          {Math.round(p * 100)}%
        </text>
      </svg>
      <div className="g-l">{label}</div>
      <div className="g-v">
        <b>{fmt(value)}</b> / {fmt(cible)}
      </div>
      <div className={`g-p ${done ? 'green' : ok ? '' : 'red'}`}>
        <Icon n={done || ok ? 'check' : 'x'} size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> {done ? 'Atteint' : `Projection : ${fmt(Math.round(proj))}`}
      </div>
    </div>
  )
}
