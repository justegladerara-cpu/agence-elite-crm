// Noyau › relations : choisir la fiche (prospect ou client) à laquelle rattacher un élément.
// Utilisé par Commercial (saisie), Facturation (devis, factures, paiements) et Charges (dépenses).
import { useMemo, useState } from 'react'
import { StageBadge } from '../../ui'
import { useDonnees } from '../contexte'
import { chercherFiches, nomExiste } from '../relations'

export function ProspectPicker({ value, onPick, onNew, newLabel = "Nouveau prospect" }) {
  const { data } = useDonnees()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const selected = value ? data.byId[value] : null
  const matches = useMemo(() => chercherFiches(data.list, q), [q, data])
  const exact = nomExiste(data.list, q)
  const items = [...matches.map((p) => ({ p })), ...(onNew && q.trim() && !exact ? [{ nouveau: q.trim() }] : [])]

  if (selected)
    return (
      <div className="selected-prospect">
        <div className="li-main">
          <div className="li-title">{selected.name}</div>
          <div className="li-sub">
            {[selected.fiche?.contact, selected.fiche?.telephone, selected.fiche?.secteur].filter(Boolean).join(' · ') || 'Fiche vide'}
          </div>
        </div>
        <StageBadge etape={selected.etape} />
        <button type="button" className="btn sm" onClick={() => onPick(null)}>
          Changer
        </button>
      </div>
    )
  const choose = (it) => {
    if (!it) return
    if (it.p) onPick(it.p.id)
    else onNew(it.nouveau)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="combo">
      <input
        className="input"
        placeholder="Nom de l'entreprise, contact ou téléphone…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHl(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, items.length - 1))
          if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0))
          if (e.key === 'Enter') {
            e.preventDefault()
            choose(items[hl])
          }
        }}
      />
      {open && items.length > 0 && (
        <div className="combo-list">
          {items.map((it, i) =>
            it.p ? (
              <div key={it.p.id} className={`combo-item ${i === hl ? 'hl' : ''}`} onMouseDown={() => choose(it)}>
                <div className="li-main">
                  <div className="li-title">{it.p.name}</div>
                  <div className="li-sub">{[it.p.fiche?.contact, it.p.fiche?.telephone].filter(Boolean).join(' · ')}</div>
                </div>
                <StageBadge etape={it.p.etape} />
              </div>
            ) : (
              <div key="new" className={`combo-item new ${i === hl ? 'hl' : ''}`} onMouseDown={() => choose(it)}>
                ＋ {newLabel} : « {it.nouveau} »
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
