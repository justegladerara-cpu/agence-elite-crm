// Recherche globale : prospects, clients, factures et devis dans une seule barre (Ctrl + K)
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, go, eur, StageBadge } from '../ui'
import { Icon } from '../icons'
import { totals, statutDe, STATUT_TONE } from '../lib/invoice'
import { fmtDate } from '../lib/dates'
import { handleInsta } from '../lib/logic'

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export default function Recherche({ onClose }) {
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
    const s = norm(q.trim()).replace(/^@/, '')
    if (!s) return []
    const chiffres = s.replace(/\D/g, '')
    const clients = new Set(data.clients.map((c) => c.id))
    const pros = data.list
      .filter((p) => {
        const f = p.fiche || {}
        if ([p.name, f.contact, f.ville, f.secteur, handleInsta(f.instagram)].some((x) => norm(x).includes(s))) return true
        return chiffres.length >= 4 && [f.telephone, f.whatsapp].some((x) => String(x || '').replace(/\D/g, '').includes(chiffres))
      })
      .sort((a, b) => (norm(a.name).startsWith(s) ? 0 : 1) - (norm(b.name).startsWith(s) ? 0 : 1) || b.score - a.score)
      .slice(0, 8)
      .map((p) => ({
        key: p.id,
        groupe: clients.has(p.id) ? 'Clients' : 'Prospects',
        titre: p.name,
        sous: [p.fiche?.contact, p.fiche?.instagram, p.fiche?.ville].filter(Boolean).join(' · '),
        badge: <StageBadge etape={p.etape} />,
        ico: clients.has(p.id) ? 'handshake' : 'users',
        path: `/prospect/${p.id}`,
      }))
    const docs = documents
      .filter((d) => d.type === 'facture' || d.type === 'devis')
      .filter((d) => [d.numero, d.data?.client?.nom, data.byId[d.prospect_id]?.name, d.data?.objet].some((x) => norm(x).includes(s)))
      .sort((a, b) => (b.data?.date || '').localeCompare(a.data?.date || ''))
      .slice(0, 6)
      .map((d) => {
        const st = statutDe(d, actions)
        return {
          key: d.id,
          groupe: 'Factures et devis',
          titre: `${d.type === 'devis' ? 'Devis' : 'Facture'} ${d.numero}`,
          sous: [d.data?.client?.nom || data.byId[d.prospect_id]?.name, fmtDate(d.data?.date), eur(totals(d.data || {}).total)].filter(Boolean).join(' · '),
          badge: <span className={`badge ${STATUT_TONE[st] || 'b-gold'}`}>{st}</span>,
          ico: d.type === 'devis' ? 'clipboard' : 'file',
          path: `/facture/${d.id}`,
        }
      })
    return [...pros.filter((r) => r.groupe === 'Prospects'), ...pros.filter((r) => r.groupe === 'Clients'), ...docs]
  }, [q, data, documents, actions])

  const ouvrir = (r) => {
    onClose()
    go(r.path)
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
            placeholder="Rechercher un prospect, un client, une facture, un @…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={onKey}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="search-res">
          {q.trim() && res.length === 0 && <div className="empty">Aucun résultat pour « {q.trim()} ».</div>}
          {!q.trim() && <div className="tiny muted" style={{ padding: 14 }}>Nom, contact, @Instagram, téléphone, ville, numéro de facture…</div>}
          {res.map((r, i) => (
            <div key={r.key}>
              {(i === 0 || res[i - 1].groupe !== r.groupe) && <div className="search-grp">{r.groupe}</div>}
              <button className={`search-item ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => ouvrir(r)}>
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
