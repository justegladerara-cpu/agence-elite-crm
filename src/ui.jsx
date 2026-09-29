import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { waLink, instaLink, siteLink } from './lib/logic'
import { fmtDate, today } from './lib/dates'
import { Icon } from './icons'
import { noterAppelLance } from './lib/appel'

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

// Nombre abrégé pour les axes et les petits espaces : 1 250 000 000 → « 1,25 Md », 987 654 → « 988 k »
export const court = (v) => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${nb(v / 1e9, 2)} Md`
  if (a >= 1e6) return `${nb(v / 1e6, a >= 1e8 ? 0 : 1)} M`
  if (a >= 1e3) return `${nb(v / 1e3, a >= 1e5 ? 0 : 1)} k`
  return nb(v)
}

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
        <a className="icon-btn" href={`tel:${phone.replace(/\s/g, '')}`} title={`Appeler ${phone}`} aria-label={`Appeler ${phone}`} onClick={() => p.id && noterAppelLance(p.id)}>
          <Icon n="phone" size={16} />
        </a>
      )}
      {wa && (
        <a className="icon-btn" href={wa} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="Écrire sur WhatsApp">
          <Icon n="message" size={16} />
        </a>
      )}
      {f.instagram && (
        <a className="icon-btn" href={instaLink(f.instagram)} target="_blank" rel="noreferrer" title="Instagram" aria-label="Ouvrir Instagram">
          <Icon n="instagram" size={16} />
        </a>
      )}
      {!compact && f.site && (
        <a className="icon-btn" href={siteLink(f.site)} target="_blank" rel="noreferrer" title="Site internet" aria-label="Ouvrir le site internet">
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

// Champ avec son libellé : le libellé est relié au premier champ de saisie (lecteurs d'écran, clic sur le libellé)
let champN = 0
export function Field({ label, children, style }) {
  const boite = useRef(null)
  const [id] = useState(() => `champ-${++champN}`)
  useEffect(() => {
    const el = boite.current?.querySelector('input, select, textarea, button.choix')
    if (!el || !label) return
    if (!el.id) el.id = `${id}-x`
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-labelledby', id)
  })
  return (
    <div className="field" style={style} ref={boite}>
      {label && (
        <label id={id} htmlFor={`${id}-x`}>
          {lbl(label)}
        </label>
      )}
      {children}
    </div>
  )
}

// Liste de choix : même usage qu'un <select>, mais avec recherche et saisie libre
export function Select({ value, onChange, options, placeholder = '—', libre = false }) {
  return <Choix value={value ?? ''} onChange={onChange} options={options} placeholder={placeholder === '—' ? 'Choisir…' : placeholder} libre={libre} />
}

// Liste déroulante avec recherche (et saisie libre), affichée par-dessus la page
export function Choix({ value, onChange, options, placeholder = 'Choisir…', libre = true }) {
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  const btn = useRef(null)
  const pop = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !btn.current?.contains(e.target) && !pop.current?.contains(e.target) && setOpen(null)
    const k = (e) => e.key === 'Escape' && setOpen(null)
    // Si la fenêtre défile, la liste (en position fixe) se refermerait décalée : on la ferme,
    // sauf pendant la saisie de la recherche (le clavier du téléphone fait défiler l'écran)
    const t0 = Date.now()
    const defile = (e) =>
      Date.now() - t0 > 250 && !pop.current?.contains(e.target) && !pop.current?.contains(document.activeElement) && setOpen(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', k)
    window.addEventListener('scroll', defile, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', k)
      window.removeEventListener('scroll', defile, true)
    }
  }, [open])
  const ouvrir = () => {
    if (open) return setOpen(null)
    const r = btn.current.getBoundingClientRect()
    const bas = window.innerHeight - r.bottom
    const haut = bas < 260 && r.top > bas
    setQ('')
    setOpen({ left: r.left, width: Math.max(r.width, 220), ...(haut ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(320, r.top - 12) } : { top: r.bottom + 4, maxHeight: Math.min(320, bas - 12) }) })
  }
  const s = q.trim().toLowerCase()
  const liste = options.filter((o) => !s || o.toLowerCase().includes(s))
  const choisir = (v) => {
    onChange(v)
    setOpen(null)
  }
  return (
    <>
      <button type="button" ref={btn} className={`choix ${value ? 'has' : ''}`} onClick={ouvrir} aria-expanded={!!open}>
        <span className="ell">{value || placeholder}</span>
        <Icon n="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <div className="choix-pop" ref={pop} style={open} role="listbox">
            {options.length > 6 && (
              <input
                className="input choix-q"
                autoFocus
                placeholder="Rechercher…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (liste[0]) choisir(liste[0])
                    else if (libre && q.trim()) choisir(q.trim())
                  }
                }}
              />
            )}
            <div className="choix-items">
              {value && (
                <button type="button" className="choix-item vide" onClick={() => choisir('')}>
                  Effacer le choix
                </button>
              )}
              {liste.map((o) => (
                <button key={o} type="button" role="option" aria-selected={o === value} className={`choix-item ${o === value ? 'on' : ''}`} onClick={() => choisir(o)}>
                  {o}
                  {o === value && <span className="choix-ok">✓</span>}
                </button>
              ))}
              {libre && q.trim() && !options.some((o) => o.toLowerCase() === s) && (
                <button type="button" className="choix-item nouveau" onClick={() => choisir(q.trim())}>
                  + Utiliser « {q.trim()} »
                </button>
              )}
              {!liste.length && !q.trim() && <div className="choix-vide">Aucune option : ajoute-en dans Paramètres › Listes.</div>}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

let modalN = 0
export function Modal({ title, onClose, children, large }) {
  const boite = useRef(null)
  const [id] = useState(() => `modal-${++modalN}`)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onClose])
  // Au clavier, le focus entre dans la fenêtre (sauf si un champ a déjà pris le focus)
  useEffect(() => {
    const b = boite.current
    if (b && !b.contains(document.activeElement)) b.focus()
  }, [])
  // Rendue à la racine de la page : la fenêtre ne dépend pas du style de l'endroit où on l'ouvre
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={boite}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon n="x" size={16} />
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

export function Kpi({ label, value, delta, invert, navy, vs = 'mois préc.', onClick }) {
  let cls = 'flat'
  let txt = ''
  if (delta !== undefined && delta !== null) {
    const good = invert ? delta < 0 : delta > 0
    cls = delta === 0 ? 'flat' : good ? 'up' : 'down'
    txt = `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${delta > 0 ? '+' : ''}${typeof delta === 'number' ? delta.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : delta} vs ${vs}`
  }
  return (
    <div
      className={`kpi ${navy ? 'navy' : ''} ${onClick ? 'pick' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {txt && <div className={`kpi-delta ${cls}`}>{txt}</div>}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  // show(message, erreur, { annuler }) : avec « annuler », le toast reste 8 s et propose de revenir en arrière
  const show = (msg, err, opts = {}) => {
    clearTimeout(timer.current)
    setToast({ msg, err, annuler: opts.annuler, n: Date.now() })
    timer.current = setTimeout(() => setToast(null), opts.annuler ? 8000 : err ? 5000 : 2200)
  }
  // Le ✓ final du message devient l'icône de succès
  const node = toast ? (
    <div className={`toast ${toast.err ? 'err' : 'ok'}`} role={toast.err ? 'alert' : 'status'} key={toast.n}>
      <span className="toast-ic">
        <Icon n={toast.err ? 'alert-circle' : 'check'} size={15} />
      </span>
      {String(toast.msg).replace(/\s*✓\s*/g, ' ').trim()}
      {toast.annuler && (
        <button
          type="button"
          className="toast-annuler"
          onClick={() => {
            clearTimeout(timer.current)
            setToast(null)
            Promise.resolve(toast.annuler()).catch(() => {})
          }}
        >
          Annuler
        </button>
      )}
    </div>
  ) : null
  return [show, node]
}

// Boîte de confirmation dans l'application (remplace window.confirm) : confirmer('Supprimer ?', { ok: 'Supprimer', danger: true })
let ouvrirConfirm = null
export function confirmer(message, opts = {}) {
  if (!ouvrirConfirm) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => ouvrirConfirm({ message, ...opts, resolve }))
}
export function ConfirmHost() {
  const [q, setQ] = useState(null)
  useEffect(() => {
    ouvrirConfirm = setQ
    return () => {
      ouvrirConfirm = null
    }
  }, [])
  if (!q) return null
  const fin = (v) => {
    setQ(null)
    q.resolve(v)
  }
  return (
    <Modal title={q.titre || 'Confirmer'} onClose={() => fin(false)}>
      <p style={{ margin: '4px 0 18px', whiteSpace: 'pre-line' }}>{q.message}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={() => fin(false)}>
          {q.non || 'Annuler'}
        </button>
        <button type="button" autoFocus className={`btn ${q.danger ? 'danger' : 'primary'}`} onClick={() => fin(true)}>
          {q.ok || 'Confirmer'}
        </button>
      </div>
    </Modal>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

// Onglets de page (façon Zoho) : l'onglet choisi est gardé tant que l'appli est ouverte
const ongletsMemo = {}
// Onglet affiché en dernier dans une page (pour surligner le bon sous-menu)
export const ongletActuel = (key) => ongletsMemo[key]
export function useTab(key, def, force) {
  const [v, setV] = useState(() => {
    if (force) ongletsMemo[key] = force
    return force || ongletsMemo[key] || def
  })
  // Onglet imposé par un lien : le menu (déjà affiché) doit surligner la bonne sous-rubrique
  useEffect(() => {
    if (force) window.dispatchEvent(new Event('crm-onglet'))
  }, [force])
  const set = (x) => {
    ongletsMemo[key] = x
    setV(x)
    window.dispatchEvent(new Event('crm-onglet'))
  }
  return [v, set]
}
export function Tabs({ items, value, onChange }) {
  return (
    <div className="ptabs" role="tablist">
      {items.map(([id, label, count]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          {label}
          {count !== undefined && count !== null && <span className="pt-count">{count}</span>}
        </button>
      ))}
    </div>
  )
}

// Menu déroulant (bouton « Plus » façon Zoho) : se ferme au clic dehors ou sur un choix
export function Menu({ label, icon = 'chevron', items, className = 'btn sm', align = 'right', ariaLabel }) {
  const [open, setOpen] = useState(null)
  const ref = useRef()
  const pop = useRef()
  const dedans = (t) => t instanceof Node && (ref.current?.contains(t) || pop.current?.contains(t))
  useEffect(() => {
    if (!open) return
    const close = (e) => !dedans(e.target) && setOpen(null)
    const k = (e) => e.key === 'Escape' && setOpen(null)
    const t0 = Date.now()
    // Le défilement provoqué par l'ouverture elle-même ne ferme pas le menu
    const fermer = (e) => Date.now() - t0 > 250 && !dedans(e?.target) && setOpen(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', k)
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', k)
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('resize', fermer)
    }
  }, [open])
  // Position fixe calculée à l'ouverture : le menu n'est jamais coupé par un bloc qui défile
  const ouvrir = (e) => {
    if (open) return setOpen(null)
    const r = e.currentTarget.getBoundingClientRect()
    const bas = window.innerHeight - r.bottom
    const haut = bas < 240 && r.top > bas
    const pos = haut ? { bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 14 } : { top: r.bottom + 6, maxHeight: bas - 14 }
    const cote = align === 'left' || r.right < 220 ? { left: Math.max(8, r.left) } : { right: Math.max(8, window.innerWidth - r.right) }
    setOpen({ ...pos, ...cote })
  }
  return (
    <div className="menu" ref={ref}>
      <button type="button" className={className} aria-expanded={!!open} aria-haspopup="menu" aria-label={ariaLabel} title={ariaLabel} onClick={ouvrir}>
        {label}
        {icon && <Icon n={icon} size={14} />}
      </button>
      {open &&
        createPortal(
          <div className="menu-pop" role="menu" style={open} ref={pop}>
            {items.filter(Boolean).map((it, i) =>
              it === '-' ? (
                <div key={i} className="menu-sep" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  className={`menu-item ${it.danger ? 'danger' : ''}`}
                  onClick={() => {
                    setOpen(null)
                    it.onClick()
                  }}
                >
                  {it.icon && <Icon n={it.icon} size={15} />}
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

// Liste « libellé : valeur » en lignes (panneau de détails façon Zoho)
export function KV({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Liens entre fiches : vers un prospect / client, ou vers une facture / un devis par son numéro
export function LienProspect({ id, children }) {
  const { data } = useApp()
  const p = id && data.byId[id]
  if (!p) return children || null
  return (
    <a className="rlink" href={`#/prospect/${p.id}`} onClick={(e) => e.stopPropagation()}>
      {children || p.name}
    </a>
  )
}
export function LienDoc({ numero, id, children }) {
  const { documents } = useApp()
  const d = id ? documents.find((x) => x.id === id) : numero && documents.find((x) => x.numero === numero)
  if (!d) return children || numero || null
  return (
    <a className="rlink" href={`#/facture/${d.id}`} onClick={(e) => e.stopPropagation()}>
      {children || d.numero}
    </a>
  )
}

// Répartition (par mode ou par catégorie)
export function Repartition({ rows, empty }) {
  const tot = rows.reduce((m, [, v]) => m + v, 0)
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="row small repart-l">
            <span title={k}>{k}</span>
            <b>
              {eur(v)} <span className="muted">· {Math.round((v / tot) * 100)} %</span>
            </b>
          </div>
          <Bar value={v} max={tot} />
        </div>
      ))}
    </div>
  )
}
