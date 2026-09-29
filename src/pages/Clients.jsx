import { useState } from 'react'
import { Modal, Field, Select, go } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { today, nowTime } from '../lib/dates'

// Ajouter un client que tu avais déjà avant le CRM, sans refaire tout le process de prospection
export function AncienClient({ onClose }) {
  const { data } = useDonnees()
  const { api, settings, toast } = useNoyau()
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
    <Modal title="Nouveau client" onClose={onClose}>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="tiny muted">Pour un client déjà signé : il arrive directement dans le hub Clients, sans passer par la prospection.</div>
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
            <Select value={f.secteur} onChange={(v) => setF({ ...f, secteur: v })} options={settings.secteurs.map((x) => x.nom)} libre />
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
        <div className="ff-foot">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn gold" disabled={busy || !f.name.trim()} onClick={save}>
            Ajouter le client
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Prochaine étape de suivi d'un nouveau client (onboarding, puis avis et satisfaction)
export function nextOnboarding(c) {
  const done = new Set(c.prospect.acts.map((a) => a.action))
  return (
    ['Onboarding - Contrat', 'Onboarding - Accès', 'Onboarding - Contenus', 'Onboarding - Lancement', "Demande d'avis Google"].find((x) => !done.has(x)) ||
    'Satisfaction client'
  )
}
