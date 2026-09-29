// Panneau latéral « détail d'un chiffre » : la liste des prospects ou actions derrière un chiffre, avec liens
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, StageBadge, Score, Empty, go, eur, nb } from '../ui'
import { Icon } from '../icons'
import { fmtDate } from '../lib/dates'
import { montantAction } from '../lib/drill'
import { SaisieArgent, modalPour } from './Tresorerie'

export default function Drill({ titre, sous, res, onClose }) {
  const { data, documents } = useApp()
  const [modal, setModal] = useState(null)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !modal && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, modal])
  const ouvrir = (path) => {
    onClose()
    go(path)
  }
  const docDe = (numero) => numero && documents.find((d) => d.numero === numero)
  const items = res.items
  const total = res.type === 'actions' ? items.reduce((m, a) => m + (montantAction(a, data) || Number(a.montant) || 0), 0) : 0
  const nbProspects = res.type === 'actions' ? new Set(items.map((a) => a.prospect_id).filter(Boolean)).size : items.length

  return createPortal(
    <div className="drawer-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={titre}>
        <div className="drawer-head">
          <div className="li-main">
            <h2>{titre}</h2>
            <div className="tiny muted">
              {sous ? `${sous} · ` : ''}
              {res.type === 'actions'
                ? `${nb(items.length)} action${items.length > 1 ? 's' : ''} · ${nb(nbProspects)} prospect${nbProspects > 1 ? 's' : ''}`
                : `${nb(items.length)} prospect${items.length > 1 ? 's' : ''}`}
              {total ? ` · ${eur(total)}` : ''}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon n="x" size={14} />
          </button>
        </div>
        <div className="drawer-body">
          {items.length === 0 && <Empty>Rien sur cette période.</Empty>}
          {res.type === 'prospects' &&
            items.map((p) => (
              <button key={p.id} type="button" className="drill-row" onClick={() => ouvrir(`/prospect/${p.id}`)}>
                <div className="li-main">
                  <div className="li-title">{p.name}</div>
                  <div className="li-sub">
                    {[p.fiche?.contact, p.fiche?.secteur, p.canal, p.relance && `relance ${fmtDate(p.relance)}`].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="drill-side">
                  <StageBadge etape={p.etape} />
                  <Score v={p.score} />
                </div>
              </button>
            ))}
          {res.type === 'actions' &&
            items.map((a) => {
              const p = data.byId[a.prospect_id]
              const m = montantAction(a, data) || Number(a.montant) || 0
              const doc = docDe(a.facture)
              // Paiement ou dépense : ouvre la saisie pour voir ou corriger ; sinon la fiche du prospect
              const argent = a.action === 'Paiement reçu' || a.action === 'Dépense'
              const clic = () => (argent ? setModal(modalPour(a)) : p && ouvrir(`/prospect/${p.id}`))
              const titreLigne = p ? p.name : a.action === 'Dépense' ? a.notes || a.fournisseur || a.categorie || 'Dépense' : a.notes || a.fournisseur || a.categorie || a.action
              return (
                <div key={a.id} className="drill-row" role="button" tabIndex={0} onClick={clic} onKeyDown={(e) => e.key === 'Enter' && clic()}>
                  <div className="li-main">
                    <div className="li-title" title={titreLigne}>{titreLigne}</div>
                    <div className="li-sub">
                      {fmtDate(a.date)}
                      {a.time ? ` ${a.time}` : ''} · {a.action}
                      {a.resultat ? ` → ${a.resultat}` : ''}
                      {!argent && a.canal ? ` · ${a.canal}` : ''}
                      {a.modele ? ` · ${a.modele}` : ''}
                      {a.categorie ? ` · ${a.categorie}` : ''}
                      {a.mode ? ` · ${a.mode}` : ''}
                      {p && a.notes ? ` · ${a.notes}` : ''}
                      {argent && !p && a.action === 'Paiement reçu' ? ' · sans client' : ''}
                    </div>
                  </div>
                  <div className="drill-side">
                    {m ? <b>{eur(m)}</b> : null}
                    {doc && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          ouvrir(`/facture/${doc.id}`)
                        }}
                      >
                        <Icon n="file" size={13} /> {doc.numero}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </aside>
      <SaisieArgent modal={modal} onClose={() => setModal(null)} />
    </div>,
    document.body,
  )
}
