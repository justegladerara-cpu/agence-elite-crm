// Recherche globale (Ctrl/⌘ + K ou « / ») : factures et devis, pages et actions rapides
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, go, eur } from '../ui'
import { Icon } from '../icons'
import { totals, statutDe, STATUT_TONE } from '../lib/invoice'
import { fmtDate } from '../lib/dates'

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function Recherche({ onClose, pages = [] }) {
  const { data, documents, actions } = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef(null)
  useEffect(() => {
    input.current?.focus()
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const res = useMemo(() => {
    const s = norm(q.trim())
    const ok = (p) => pages.some((n) => n.path === p)
    // Actions rapides et pages : toujours proposées, filtrées par le texte tapé
    const rapides = [
      ok('hotel') && { key: 'a-vente', groupe: 'Actions rapides', titre: 'Point de vente', sous: 'Salle, chambres, encaissement (touche N)', ico: 'grid', path: '/hotel' },
      { key: 'a-devis', groupe: 'Actions rapides', titre: 'Nouveau devis / proforma', sous: '', ico: 'clipboard', path: '/facture/new?type=devis' },
      { key: 'a-facture', groupe: 'Actions rapides', titre: 'Nouvelle facture', sous: 'Facture A4 pour un client', ico: 'file', path: '/facture/new?type=facture' },
      ok('depenses') && { key: 'a-depense', groupe: 'Actions rapides', titre: 'Nouvelle dépense', sous: 'Sortie d’argent', ico: 'trend', path: '/depenses' },
    ].filter(Boolean)
    const pagesRes = pages.flatMap((n) => [
      { key: `p-${n.path}`, groupe: 'Pages', titre: n.label, sous: '', ico: n.ico, path: `/${n.path}` },
      ...(n.sub || []).map(([qs, l]) => ({ key: `p-${n.path}${qs}`, groupe: 'Pages', titre: `${n.label} › ${l}`, sous: '', ico: n.ico, path: `/${n.path}${qs}`, sousPage: true })),
    ])
    if (!s) return [...rapides, ...pagesRes.filter((r) => !r.sousPage)]
    const docs = documents
      .filter((d) => d.type === 'facture' || d.type === 'devis')
      .filter((d) => [d.numero, d.data?.client?.nom, d.data?.objet].some((x) => norm(x).includes(s)))
      .sort((a, b) => (b.data?.date || '').localeCompare(a.data?.date || ''))
      .slice(0, 6)
      .map((d) => {
        const st = statutDe(d, actions)
        return {
          key: d.id,
          groupe: 'Factures et devis',
          titre: `${d.type === 'devis' ? 'Devis' : 'Facture'} ${d.numero}`,
          sous: [d.data?.client?.nom, fmtDate(d.data?.date), eur(totals(d.data || {}).total)].filter(Boolean).join(' · '),
          badge: <span className={`badge ${STATUT_TONE[st] || 'b-gold'}`}>{st}</span>,
          ico: d.type === 'devis' ? 'clipboard' : 'file',
          path: `/facture/${d.id}`,
        }
      })
    const texte = (r) => norm(`${r.titre} ${r.sous}`).includes(s)
    return [...docs, ...rapides.filter(texte), ...pagesRes.filter(texte).slice(0, 6)]
  }, [q, data, documents, actions, pages])

  // Le résultat choisi au clavier reste visible dans la liste
  useEffect(() => {
    document.getElementById(`sr-${sel}`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const ouvrir = (r) => {
    onClose()
    if (r.run) r.run()
    else go(r.path)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((v) => Math.min(res.length - 1, v + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((v) => Math.max(0, v - 1))
    } else if (e.key === 'Enter' && res[sel]) ouvrir(res[sel])
  }

  return createPortal(
    <div className="modal-bg search-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-box">
        <div className="search-in">
          <Icon n="search" size={18} />
          <input
            ref={input}
            placeholder="Rechercher un article, un client, une facture, une page…"
            aria-label="Recherche globale"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-res"
            aria-activedescendant={res[sel] ? `sr-${sel}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={onKey}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon n="x" size={16} />
          </button>
        </div>
        <div className="search-res" id="search-res" role="listbox">
          {q.trim() && res.length === 0 && <div className="empty">Aucun résultat pour « {q.trim()} ».</div>}
          {!q.trim() && <div className="tiny muted" style={{ padding: '12px 16px 0' }}>Article, référence, client, numéro de facture… · ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer</div>}
          {res.map((r, i) => (
            <div key={r.key}>
              {(i === 0 || res[i - 1].groupe !== r.groupe) && <div className="search-grp">{r.groupe}</div>}
              <button id={`sr-${i}`} role="option" aria-selected={i === sel} tabIndex={-1} className={`search-item ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => ouvrir(r)}>
                <Icon n={r.ico} size={16} />
                <span className="si-main">
                  <span className="si-t">{r.titre}</span>
                  {r.sous && <span className="si-s">{r.sous}</span>}
                </span>
                {r.badge}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
