import { useState } from 'react'
import { useApp, Kpi, Empty, Modal, Field, go, eur, nb } from '../ui'
import { PaiementForm } from './Finances'
import { fmtDate, today, nowTime } from '../lib/dates'

// Ajouter un client que tu avais déjà avant le CRM, sans refaire tout le process de prospection
export function AncienClient({ onClose }) {
  const { api, data, settings, toast } = useApp()
  const [f, setF] = useState({ name: '', contact: '', telephone: '', secteur: '', ville: '', date: today(), montant: '', paye: true, abonnement: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const save = async () => {
    const n = f.name.trim()
    if (!n) return toast("Nom de l'entreprise manquant", true)
    if (data.list.some((p) => p.name.toLowerCase() === n.toLowerCase())) return toast('Ce nom existe déjà dans ton CRM', true)
    setBusy(true)
    try {
      const fiche = Object.fromEntries(
        Object.entries({ contact: f.contact.trim(), telephone: f.telephone.trim(), secteur: f.secteur, ville: f.ville.trim(), source: 'Ancien client', abonnement: f.abonnement }).filter(([, v]) => v !== ''),
      )
      const p = await api.addProspect(n, fiche)
      const montant = Number(String(f.montant).replace(/\s/g, '').replace(',', '.')) || 0
      const rows = [
        { prospect_id: p.id, date: f.date, time: nowTime(), action: 'Ajout prospect', notes: 'Client déjà existant avant le CRM' },
        { prospect_id: p.id, date: f.date, time: nowTime(), action: 'Intervention', montant: montant || undefined, notes: f.notes.trim() || undefined },
      ]
      if (montant && f.paye) rows.push({ prospect_id: p.id, date: f.date, time: nowTime(), action: 'Paiement reçu', montant })
      await api.addActions(rows)
      toast('Client ajouté ✓')
      onClose()
      go(`/prospect/${p.id}`)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Modal title="Ajouter un ancien client" onClose={onClose}>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="tiny muted">Pour un client que tu avais déjà : il arrive directement dans Clients, sans passer par la prospection.</div>
        <Field label="Entreprise">
          <input autoFocus value={f.name} onChange={set('name')} />
        </Field>
        <div className="form-grid">
          <Field label="Nom du contact">
            <input value={f.contact} onChange={set('contact')} />
          </Field>
          <Field label="Téléphone / WhatsApp">
            <input type="tel" value={f.telephone} onChange={set('telephone')} />
          </Field>
          <Field label="Secteur">
            <select value={f.secteur} onChange={set('secteur')}>
              <option value="">—</option>
              {settings.secteurs.map((x) => (
                <option key={x.nom}>{x.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Ville">
            <input value={f.ville} onChange={set('ville')} />
          </Field>
          <Field label="Date de la dernière prestation">
            <input type="date" value={f.date} onChange={set('date')} />
          </Field>
          <Field label="Montant de cette prestation (€)">
            <input inputMode="decimal" value={f.montant} onChange={set('montant')} />
          </Field>
          <Field label="Abonnement mensuel (€, facultatif)">
            <input inputMode="decimal" value={f.abonnement} onChange={set('abonnement')} />
          </Field>
        </div>
        <label className="row small">
          <input type="checkbox" checked={f.paye} onChange={set('paye')} /> Déjà payé
        </label>
        <Field label="Note (facultatif)">
          <input placeholder="Ce que tu as fait pour lui" value={f.notes} onChange={set('notes')} />
        </Field>
        <button className="btn gold block" disabled={busy} onClick={save}>
          Ajouter le client
        </button>
      </div>
    </Modal>
  )
}

export default function Clients() {
  const { data, openAction } = useApp()
  const [pay, setPay] = useState(null)
  const [ancien, setAncien] = useState(false)
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
        <div className="row">
          <button className="btn gold" onClick={() => setAncien(true)}>
            + Ancien client
          </button>
        </div>
      </div>
      {ancien && <AncienClient onClose={() => setAncien(false)} />}
      <div className="grid grid-4">
        <Kpi label="Clients actifs" value={nb(actifs.length)} navy />
        <Kpi label="Revenu récurrent (MRR)" value={eur(mrr)} navy />
        <Kpi label="Total facturé" value={eur(total)} />
        <Kpi label="Reste à encaisser" value={eur(reste)} />
      </div>
      <div className="card flush">
        {cl.length === 0 ? (
          <Empty>Pas encore de client. Ta première signature arrivera vite, ou ajoute un ancien client.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t zt">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Statut</th>
                  <th className="hide-m">Dernière prestation</th>
                  <th className="num hide-m">Total facturé</th>
                  <th className="num">Reste</th>
                  <th className="num hide-m">Abonnement</th>
                  <th className="hide-m" />
                </tr>
              </thead>
              <tbody>
                {cl.map((c) => (
                  <tr key={c.id} className="click" onClick={() => go(`/prospect/${c.id}`)}>
                    <td className="ell-cell">
                      <div className="bold ell">{c.name}</div>
                      <div className="tiny muted ell">
                        {[c.prospect.fiche?.contact, c.prospect.fiche?.offre, c.prospect.dateSignature && `depuis le ${fmtDate(c.prospect.dateSignature)}`].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <span className={`badge ${c.statut === 'Actif' ? 'b-green' : 'b-Perdu'}`}>{c.statut}</span>
                        {c.statutPaiement && <span className={`badge ${tone[c.statutPaiement]}`}>{c.statutPaiement}</span>}
                        {c.alerte && <span className="badge b-red">{c.alerte}</span>}
                      </div>
                    </td>
                    <td className="hide-m">
                      {c.derniereIntervention ? fmtDate(c.derniereIntervention) : '—'}
                      {c.nbInterventions ? <span className="tiny muted"> · {c.nbInterventions} au total</span> : null}
                    </td>
                    <td className="num hide-m">{eur(c.total)}</td>
                    <td className={`num ${c.reste > 0 ? 'bold red' : ''}`}>{c.reste > 0 ? eur(c.reste) : '—'}</td>
                    <td className="num hide-m">{c.abonnement ? `${eur(c.abonnement)}/mois` : '—'}</td>
                    <td className="hide-m" onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <button className="btn sm gold" onClick={() => openAction({ prospect_id: c.id, action: 'Intervention', canal: 'Appel' })}>
                          + Intervention
                        </button>
                        <button className="btn sm" onClick={() => setPay({ prospect_id: c.id, montant: c.reste ? String(c.reste) : '' })}>
                          + Paiement
                        </button>
                        {!c.nbInterventions && c.onboarding < 1 && (
                          <button className="btn sm" title={`Onboarding ${Math.round(c.onboarding * 100)} %`} onClick={() => openAction({ prospect_id: c.id, action: nextOnboarding(c) })}>
                            + Suivi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
