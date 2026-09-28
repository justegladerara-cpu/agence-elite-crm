// Clients du magasin : qui achète, combien, et qui doit encore de l'argent (ventes à crédit)
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Kpi, Empty, Modal, go, eur, nb } from '../ui'
import { PaiementForm } from './Finances'
import { ventesDe } from '../lib/magasin'
import { statutDe, STATUT_TONE } from '../lib/invoice'
import { fmtDate } from '../lib/dates'

const COMPTOIR = 'client comptoir'
const cle = (n) => (n || '').trim().toLowerCase()

export function clientsDe(documents, actions, data) {
  const m = new Map()
  ventesDe(documents, actions).forEach((v) => {
    const nom = (v.client || data?.byId?.[v.doc.prospect_id]?.name || '').trim()
    if (!nom || cle(nom) === COMPTOIR) return
    const k = cle(nom)
    const c = m.get(k) || { nom, ventes: [], total: 0, reste: 0, derniere: '' }
    c.ventes.push(v)
    c.total += v.total
    c.reste += v.reste
    if (v.date > c.derniere) c.derniere = v.date
    m.set(k, c)
  })
  const fiches = Object.fromEntries((data?.list || []).map((p) => [cle(p.name), p]))
  return [...m.values()].map((c) => ({ ...c, tel: fiches[cle(c.nom)]?.fiche?.telephone || fiches[cle(c.nom)]?.fiche?.whatsapp || '' }))
}

export default function ClientsMagasin({ nom: nomDemande }) {
  const { documents, actions, data } = useApp()
  const [q, setQ] = useState('')
  const [credit, setCredit] = useState(false)
  const [paiement, setPaiement] = useState(null)
  const tous = useMemo(() => clientsDe(documents, actions, data).sort((a, b) => b.reste - a.reste || b.total - a.total), [documents, actions, data])
  const ouvert = nomDemande ? tous.find((c) => cle(c.nom) === cle(nomDemande)) : null
  const s = q.trim().toLowerCase()
  const liste = tous.filter((c) => (!s || c.nom.toLowerCase().includes(s)) && (!credit || c.reste > 0))
  const du = tous.reduce((m, c) => m + c.reste, 0)
  const debiteurs = tous.filter((c) => c.reste > 0).length
  const fermer = () => go('/clients')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <div className="sub">Les clients nommés lors des ventes. Ceux qui achètent à crédit apparaissent en premier.</div>
        </div>
      </div>
      <div className="grid grid-3">
        <Kpi label="Clients" value={nb(tous.length)} navy />
        <Kpi label="Doivent encore" value={eur(du)} onClick={debiteurs ? () => setCredit(!credit) : undefined} />
        <Kpi label="Clients à crédit" value={nb(debiteurs)} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" id="cl-q" style={{ flex: '1 1 220px' }} placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
          {debiteurs > 0 && (
            <button className={`chip ${credit ? 'on' : ''}`} onClick={() => setCredit(!credit)}>
              Doivent de l'argent ({debiteurs})
            </button>
          )}
        </div>
        {!tous.length ? (
          <Empty>Aucun client pour l'instant. À la caisse, touche « Client » avant de payer pour donner un nom à la vente.</Empty>
        ) : !liste.length ? (
          <Empty>Aucun client ne correspond.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t ztable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="num">Achats</th>
                  <th className="num">Total acheté</th>
                  <th className="num">Reste dû</th>
                  <th className="hide-m">Dernier achat</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((c) => (
                  <tr key={c.nom} className="click" onClick={() => go(`/clients?c=${encodeURIComponent(c.nom)}`)}>
                    <td className="strong">{c.nom}</td>
                    <td className="num">{nb(c.ventes.length)}</td>
                    <td className="num">{eur(c.total)}</td>
                    <td className="num">{c.reste > 0 ? <span className="badge b-orange">{eur(c.reste)}</span> : <span className="muted">—</span>}</td>
                    <td className="hide-m">{fmtDate(c.derniere)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {ouvert && (
        <Modal title={ouvert.nom} onClose={fermer} large>
          <div className="stack">
            <div className="grid grid-3">
              <Kpi label="Achats" value={nb(ouvert.ventes.length)} />
              <Kpi label="Total acheté" value={eur(ouvert.total)} />
              <Kpi label="Reste dû" value={eur(ouvert.reste)} navy={ouvert.reste > 0} />
            </div>
            {ouvert.tel && (
              <a className="btn sm" style={{ width: 'fit-content' }} href={`tel:${ouvert.tel}`}>
                <Icon n="phone" size={14} /> {ouvert.tel}
              </a>
            )}
            <div className="table-wrap">
              <table className="t ztable">
                <thead>
                  <tr>
                    <th>Facture</th>
                    <th>Date</th>
                    <th className="num">Montant</th>
                    <th className="num">Reste</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ouvert.ventes.map((v) => {
                    const st = statutDe(v.doc, actions)
                    return (
                      <tr key={v.doc.id} className="click" onClick={() => go(`/facture/${v.doc.id}`)}>
                        <td className="strong">{v.numero}</td>
                        <td>{fmtDate(v.date)}</td>
                        <td className="num">{eur(v.total)}</td>
                        <td className="num">{v.reste > 0 ? eur(v.reste) : '—'}</td>
                        <td>
                          <span className={`badge ${STATUT_TONE[st] || 'b-gold'}`}>{st}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {v.reste > 0 && (
                            <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); setPaiement({ facture: v.numero, montant: String(v.reste) }) }}>
                              Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
      {paiement && (
        <Modal title="Paiement reçu" onClose={() => setPaiement(null)}>
          <PaiementForm prefill={paiement} onDone={() => setPaiement(null)} />
        </Modal>
      )}
    </>
  )
}
