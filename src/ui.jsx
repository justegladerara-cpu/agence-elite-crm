import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { waLink, instaLink, siteLink } from './lib/logic'
import { fmtDate, today } from './lib/dates'
import { Icon } from './icons'

export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

// Devise d'affichage, réglée dans Paramètres (settings.devise)
export const DEVISES = [
  { code: 'XAF', label: 'Franc CFA Afrique centrale (XAF)', sym: 'FCFA', parEuro: 655.957 },
  { code: 'XOF', label: 'Franc CFA Afrique de l’Ouest (XOF)', sym: 'FCFA', parEuro: 655.957 },
  { code: 'EUR', label: 'Euro (€)', sym: '€', parEuro: 1 },
  { code: 'USD', label: 'Dollar US ($)', sym: '$', parEuro: 1.08 },
  { code: 'MAD', label: 'Dirham marocain (MAD)', sym: 'MAD', parEuro: 10.8 },
  { code: 'CAD', label: 'Dollar canadien (CAD)', sym: 'CAD', parEuro: 1.47 },
]
export const EURO = DEVISES.find((d) => d.code === 'EUR')
let devise = EURO
export function setDevise(code) {
  devise = DEVISES.find((d) => d.code === code) || EURO
}
export const sym = () => devise.sym
export const deviseCode = () => devise.code
// Remplace le symbole € d'un libellé par la devise choisie
export const lbl = (s) => (typeof s === 'string' ? s.replace(/€/g, devise.sym) : s)
export const eur = (v, dec = 0) => {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '—'
  const n = Number(v).toLocaleString('fr-FR', { maximumFractionDigits: dec, minimumFractionDigits: dec })
  return devise.code === 'USD' ? `${n} $` : `${n} ${devise.sym}`
}
export const pct = (v) => (v === null || v === undefined || isNaN(v) ? '—' : `${Math.round(v * 100)} %`)
export const nb = (v, dec = 0) =>
  v === null || v === undefined || isNaN(v) ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: dec })

export function go(path) {
  window.location.hash = path
}

export function StageBadge({ etape }) {
  return <span className={`badge b-${etape}`}>{etape}</span>
}
export function Score({ v }) {
  return <span className={`score ${v >= 50 ? 'hot' : v >= 25 ? 'warm' : 'cold'}`} title="Score de priorité">{v}</span>
}
export function RelanceTag({ date, heure }) {
  if (!date) return null
  const t = today()
  const cls = date < t ? 'b-red' : date === t ? 'b-orange' : 'b-navy'
  const label = date < t ? `En retard · ${fmtDate(date)}` : date === t ? "Aujourd'hui" : fmtDate(date)
  return (
    <span className={`badge ${cls}`}>
      <Icon n="clock" size={12} /> {label}
      {heure ? ` ${heure}` : ''}
    </span>
  )
}

export function ContactButtons({ p, compact }) {
  const { settings } = useApp()
  const f = p.fiche || {}
  const phone = f.telephone
  const wa = waLink(f.whatsapp || f.telephone, settings.clients.indicatifWhatsApp)
  const stop = (e) => e.stopPropagation()
  return (
    <div className="row" onClick={stop}>
      {phone && (
        <a className="icon-btn" href={`tel:${phone.replace(/\s/g, '')}`} title={`Appeler ${phone}`}>
          <Icon n="phone" size={16} />
        </a>
      )}
      {wa && (
        <a className="icon-btn" href={wa} target="_blank" rel="noreferrer" title="WhatsApp">
          <Icon n="message" size={16} />
        </a>
      )}
      {f.instagram && (
        <a className="icon-btn" href={instaLink(f.instagram)} target="_blank" rel="noreferrer" title="Instagram">
          <Icon n="instagram" size={16} />
        </a>
      )}
      {!compact && f.site && (
        <a className="icon-btn" href={siteLink(f.site)} target="_blank" rel="noreferrer" title="Site internet">
          <Icon n="globe" size={16} />
        </a>
      )}
    </div>
  )
}

export function Chips({ options, value, onChange, small, allowEmpty = true }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          className={`chip ${small ? 'sm' : ''} ${value === o ? 'on' : ''}`}
          onClick={() => onChange(value === o && allowEmpty ? '' : o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, style }) {
  return (
    <div className="field" style={style}>
      {label && <label>{lbl(label)}</label>}
      {children}
    </div>
  )
}

export function Select({ value, onChange, options, placeholder = '—' }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onClose])
  // Rendue à la racine de la page : la fenêtre ne dépend pas du style de l'endroit où on l'ouvre
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Bar({ value, max = 1, tone }) {
  const w = max ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div className={`bar ${tone || ''}`}>
      <span style={{ width: `${w}%` }} />
    </div>
  )
}

export function Kpi({ label, value, delta, invert, navy }) {
  let cls = 'flat'
  let txt = ''
  if (delta !== undefined && delta !== null) {
    const good = invert ? delta < 0 : delta > 0
    cls = delta === 0 ? 'flat' : good ? 'up' : 'down'
    txt = `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${delta > 0 ? '+' : ''}${typeof delta === 'number' ? delta.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : delta} vs mois préc.`
  }
  return (
    <div className={`kpi ${navy ? 'navy' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {txt && <div className={`kpi-delta ${cls}`}>{txt}</div>}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  const show = (msg, err) => {
    clearTimeout(timer.current)
    setToast({ msg, err })
    timer.current = setTimeout(() => setToast(null), err ? 5000 : 2200)
  }
  const node = toast ? <div className={`toast ${toast.err ? 'err' : ''}`}>{toast.msg}</div> : null
  return [show, node]
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}
