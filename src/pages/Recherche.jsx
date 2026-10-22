// Recherche globale (Ctrl/⌘ + K ou « / ») : potentiels, clients, perdus, factures et devis, pages et actions rapides
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { go, eur, StageBadge, useCouche } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { Icon } from '../icons'
import { totals, statutDe, STATUT_TONE } from '../modules/facturation'
import { fmtDate } from '../lib/dates'
import { handleInsta } from '../lib/logic'
import { fichesHub } from '../modules/commercial'

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export default function Recherche({ onClose, pages = [] }) {
  const { data, documents, actions } = useDonnees()
  const { openAction, ouvrir: ouvrirSaisie } = useNoyau()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  useCouche(true, onClose)

  const res = useMemo(() => {
    const s = norm(q.trim()).replace(/^@/, '')
    // Actions rapides et pages : toujours proposées, filtrées par le texte tapé
    const rapides = [
      { key: 'a-action', groupe: 'Actions rapides', titre: 'Nouvelle action', sous: 'Appel, DM, relance, RDV, signature… (touche N)', ico: 'plus', run: () => openAction() },
      { key: 'a-client', groupe: 'Actions rapides', titre: 'Nouveau client', sous: 'Ajouter un client existant', ico: 'user-plus', path: '/clients?onglet=nouveaux&nouveau=client' },
      { key: 'a-insta', groupe: 'Actions rapides', titre: 'Prospect Instagram', sous: 'Ajout express depuis un @', ico: 'instagram', path: '/acquisition?onglet=potentiels&nouveau=insta' },
      { key: 'a-vente', groupe: 'Actions rapides', titre: 'Nouvelle vente', sous: 'Client, ce que tu as fait, montant, payé ? (touche V)', ico: 'coins', run: () => ouvrirSaisie('vente') },
      { key: 'a-dm', groupe: 'Actions rapides', titre: 'Noter mes DM', sous: 'Plusieurs comptes d’un coup (touche D)', ico: 'message', run: () => ouvrirSaisie('dm') },
      { key: 'a-relance', groupe: 'Actions rapides', titre: 'Mode relance', sous: 'Anciens clients à recontacter, messages prêts', ico: 'repeat', path: '/relances' },
    ]
    const pagesRes = pages.flatMap((n) => [
      { key: `p-${n.path}`, groupe: 'Pages', titre: n.label, sous: n.espace || '', ico: n.ico, path: `/${n.path}` },
      ...(n.sub || []).map(([qs, l]) => ({ key: `p-${n.path}${qs}`, groupe: 'Pages', titre: `${n.label} › ${l}`, sous: n.espace || '', ico: n.ico, path: `/${n.path}${qs}`, sousPage: true })),
    ])
    if (!s) return [...rapides, ...pagesRes.filter((r) => !r.sousPage)]
    const chiffres = s.replace(/\D/g, '')
    const GROUPE = { potentiels: 'Potentiels', perdus: 'Perdus' }
    const fiches = fichesHub(data)
      .filter(({ p }) => {
        const f = p.fiche || {}
        if ([p.name, f.contact, f.ville, f.secteur, f.offre, handleInsta(f.instagram)].some((x) => norm(x).includes(s))) return true
        return chiffres.length >= 4 && [f.telephone, f.whatsapp].some((x) => String(x || '').replace(/\D/g, '').includes(chiffres))
      })
      .sort((a, b) => (norm(a.p.name).startsWith(s) ? 0 : 1) - (norm(b.p.name).startsWith(s) ? 0 : 1) || b.p.score - a.p.score)
      .slice(0, 10)
      .map(({ p, c, cat }) => ({
        key: p.id,
        groupe: GROUPE[cat] || 'Clients',
        titre: p.name,
        sous: [p.fiche?.contact, p.fiche?.instagram, p.fiche?.ville].filter(Boolean).join(' · '),
        badge: c ? <span className={`badge ${cat === 'anciens' ? 'b-Perdu' : 'b-green'}`}>{cat === 'anciens' ? 'Ancien client' : 'Client'}</span> : <StageBadge etape={p.etape} />,
        ico: c ? 'briefcase' : cat === 'perdus' ? 'ban' : 'target',
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
    const parGroupe = (g) => fiches.filter((r) => r.groupe === g)
    const texte = (r) => norm(`${r.titre} ${r.sous}`).includes(s)
    return [...parGroupe('Potentiels'), ...parGroupe('Clients'), ...parGroupe('Perdus'), ...docs, ...rapides.filter(texte), ...pagesRes.filter(texte).slice(0, 6)]
  }, [q, data, documents, actions, pages, openAction, ouvrirSaisie])

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
            placeholder="Rechercher un prospect, un client, une page, une action…"
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
          {!q.trim() && <div className="tiny muted" style={{ padding: '12px 16px 0' }}>Nom, contact, @Instagram, téléphone, ville, offre, numéro de facture… · ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer</div>}
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
