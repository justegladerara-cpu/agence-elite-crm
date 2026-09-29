// Chronologie d'un client lue dans le journal d'événements (repli automatique sur le calcul local)
import { useEffect, useState } from 'react'
import { useDonnees } from '../contexte'
import { lireJournal, LIBELLE } from '../journal'
import { Icon } from '../../icons'
import { eur, Empty } from '../../ui'
import { fmtDate } from '../../lib/dates'

const ICONE = { payment: 'coins', expense: 'wallet', quote: 'file', invoice: 'file', appointment: 'calendar', client: 'handshake' }

export default function Chronologie({ prospectId }) {
  const { actions, documents } = useDonnees()
  const [res, setRes] = useState(null)
  useEffect(() => {
    let vivant = true
    lireJournal({ prospectId, actions, documents }).then((r) => vivant && setRes(r))
    return () => {
      vivant = false
    }
  }, [prospectId, actions, documents])
  if (!res) return <div className="card small muted">Chargement de la chronologie…</div>
  const liste = [...res.liste].reverse()
  return (
    <div className="card">
      <div className="list" data-source={res.source}>
        {liste.length === 0 && <Empty>Aucun événement.</Empty>}
        {liste.map((e) => {
          const m = Number(e.meta?.montant)
          return (
            <div key={e.id} className="list-item" data-type={e.type}>
              <div className="li-main">
                <div className="li-title">
                  <Icon n={ICONE[e.type.split('.')[0]] || 'note'} size={14} /> {LIBELLE[e.type] || e.type}
                  {e.meta?.numero ? ` ${e.meta.numero}` : ''}
                  {m ? ` · ${eur(m)}` : ''}
                </div>
                <div className="li-sub">
                  {fmtDate(e.date)}
                  {e.meta?.action && LIBELLE[e.type] !== e.meta.action ? ` · ${e.meta.action}` : ''}
                  {e.meta?.facture ? ` · facture ${e.meta.facture}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="tiny muted" style={{ marginTop: 8 }}>
        {res.source === 'journal' ? 'Lu dans le journal d’événements.' : 'Calculé depuis tes données (journal indisponible ou hors ligne).'}
      </div>
    </div>
  )
}
