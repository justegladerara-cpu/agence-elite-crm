import { useState } from 'react'
import { useApp, Kpi, Bar, Empty, Modal, go, eur, nb } from '../ui'
import { PaiementForm } from './Finances'
import { fmtDate } from '../lib/dates'

export default function Clients() {
  const { data, openAction } = useApp()
  const [pay, setPay] = useState(null)
  const cl = [...data.clients].sort((a, b) => (a.statut === b.statut ? (b.prospect.dateSignature || '').localeCompare(a.prospect.dateSignature || '') : a.statut === 'Actif' ? -1 : 1))
  const actifs = cl.filter((c) => c.statut === 'Actif')
  const mrr = actifs.reduce((m, c) => m + c.abonnement, 0)
  const reste = cl.reduce((m, c) => m + c.reste, 0)
  const total = cl.reduce((m, c) => m + c.total, 0)
  const tone = { Payé: 'b-green', 'En retard': 'b-red', Partiel: 'b-orange', 'En attente': 'b-gold' }
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Clients</h1>
          <div className="sub">Un prospect devient client dès que tu saisis « Signature » ou « Intervention ». Chaque intervention payée se saisit avec son montant.</div>
        </div>
      </div>
      <div className="grid grid-4">
        <Kpi label="Clients actifs" value={nb(actifs.length)} navy />
        <Kpi label="Revenu récurrent (MRR)" value={eur(mrr)} navy />
        <Kpi label="Total facturé" value={eur(total)} />
        <Kpi label="Reste à encaisser" value={eur(reste)} />
      </div>
      <div className="card">
        <div className="list">
          {cl.length === 0 && <Empty>Pas encore de client. Ta première signature arrivera vite.</Empty>}
          {cl.map((c) => (
            <div key={c.id} className="list-item click client-item" onClick={() => go(`/prospect/${c.id}`)} style={{ alignItems: 'flex-start' }}>
              <div className="li-main">
                <div className="row" style={{ gap: 6 }}>
                  <span className="li-title">{c.name}</span>
                  <span className={`badge ${c.statut === 'Actif' ? 'b-green' : 'b-Perdu'}`}>{c.statut}</span>
                  {c.statutPaiement && <span className={`badge ${tone[c.statutPaiement]}`}>{c.statutPaiement}</span>}
                  {c.alerte && <span className="badge b-red">{c.alerte}</span>}
                </div>
                <div className="li-sub" style={{ whiteSpace: 'normal' }}>
                  {[c.prospect.fiche?.offre, c.prospect.fiche?.contact, `client depuis le ${fmtDate(c.prospect.dateSignature)}`].filter(Boolean).join(' · ')}
                </div>
                <div className="info-grid" style={{ marginTop: 10 }}>
                  {[
                    ['Total facturé', eur(c.total)],
                    ['Interventions', c.nbInterventions ? `${c.nbInterventions} · ${eur(c.montantInterventions)}` : '—'],
                    ['Dernière intervention', c.derniereIntervention ? fmtDate(c.derniereIntervention) : '—'],
                    ['Encaissé', eur(c.encaisse)],
                    ['Reste', eur(c.reste)],
                    ['Abonnement', c.abonnement ? `${eur(c.abonnement)}/mois` : '—'],
                    ...(c.nbInterventions ? [] : [['Renouvellement', c.renouvellement ? fmtDate(c.renouvellement) : '—']]),
                    ...(c.depenses ? [['Dépenses liées', eur(c.depenses)]] : []),
                    ['Marge', eur(c.marge)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ))}
                </div>
                {!c.nbInterventions && <div className="row" style={{ marginTop: 10 }}>
                  <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                    Onboarding {Math.round(c.onboarding * 100)} %
                  </span>
                  <div style={{ flex: 1, maxWidth: 240 }}>
                    <Bar value={c.onboarding} tone={c.onboarding >= 1 ? 'green' : ''} />
                  </div>
                </div>}
              </div>
              <div className="li-side" style={{ flexDirection: 'column', alignItems: 'stretch' }} onClick={(e) => e.stopPropagation()}>
                <button className="btn sm gold" onClick={() => openAction({ prospect_id: c.id, action: 'Intervention', canal: 'Appel' })}>
                  + Intervention
                </button>
                <button className="btn sm" onClick={() => setPay({ prospect_id: c.id, montant: c.reste ? String(c.reste) : '' })}>
                  + Paiement
                </button>
                <button className="btn sm" onClick={() => go(`/facture/new?type=facture&p=${c.id}`)}>
                  + Facture
                </button>
                <button className="btn sm" onClick={() => openAction({ prospect_id: c.id, action: nextOnboarding(c) })}>
                  + Suivi
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {pay && (
        <Modal title="Paiement reçu" onClose={() => setPay(null)}>
          <PaiementForm prefill={pay} onDone={() => setPay(null)} />
        </Modal>
      )}
    </div>
  )
}

function nextOnboarding(c) {
  const done = new Set(c.prospect.acts.map((a) => a.action))
  return (
    ['Onboarding - Contrat', 'Onboarding - Accès', 'Onboarding - Contenus', 'Onboarding - Lancement', "Demande d'avis Google"].find((x) => !done.has(x)) ||
    'Satisfaction client'
  )
}
