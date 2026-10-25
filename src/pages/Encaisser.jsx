// Encaisser en un geste : qui a payé, combien, pour quoi, avec quoi. Le client est créé s'il n'existe pas.
// Ensuite : reçu PDF (signature et cachet), envoi WhatsApp, et le numéro du client demandé tout de suite.
import { useMemo, useState } from 'react'
import { Field, Modal, eur, deviseCode } from '../ui'
import { Icon } from '../icons'
import { useNoyau, useDonnees } from '../core/contexte'
import { ProspectPicker } from '../core/ui/ProspectPicker'
import { today } from '../lib/dates'
import { waLink } from '../lib/logic'
import { num, totals, statutDe, chargerRecu } from '../modules/facturation'
import { activitesDe, devinerActivite } from '../modules/activites'

const MOYENS = [
  ['Espèces', 'Espèces', 'coins'],
  ['Mobile Money', 'Mobile Money', 'phone'],
  ['Virement', 'Banque', 'wallet'],
]

// Télécharge le reçu d'un paiement (utilisé ici et dans le tableau de bord)
export async function telechargerRecu({ p, client, settings, reste = null }) {
  const { recuPdf, recuNom } = await chargerRecu()
  const pdf = await recuPdf({ p, client, fact: settings.facturation || {}, code: deviseCode(), reste })
  pdf.save(recuNom(p, client))
}

export function EncaisserForm({ prefill = {}, onDone }) {
  const { settings, api, toast } = useNoyau()
  const { documents = [], actions = [], data } = useDonnees()
  const [pid, setPid] = useState(prefill.prospect_id || null)
  const [nouveau, setNouveau] = useState('')
  const [montant, setMontant] = useState(prefill.montant ? String(prefill.montant) : '')
  const [pour, setPour] = useState(prefill.notes || '')
  const [activite, setActivite] = useState('')
  const [moyen, setMoyen] = useState(() => {
    try {
      return localStorage.getItem('aecrm-moyen') || 'Espèces'
    } catch {
      return 'Espèces'
    }
  })
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today())
  const [facture, setFacture] = useState(prefill.facture || '')
  const [busy, setBusy] = useState(false)
  const [fait, setFait] = useState(null)
  const [tel, setTel] = useState('')
  const activites = activitesDe(settings)
  const devinee = activite || devinerActivite(pour, settings) || ''
  const actDevinee = activites.find((a) => a.id === devinee)

  // Factures pas encore payées de ce client : un tap pour lier le paiement
  const ouvertes = useMemo(
    () =>
      pid
        ? documents
            .filter((d) => d.type === 'facture' && d.prospect_id === pid && !d.data?.annulee && !['Payée', 'Annulée'].includes(statutDe(d, actions)))
            .map((d) => {
              const paye = actions.filter((a) => a.action === 'Paiement reçu' && a.facture === d.numero).reduce((m, a) => m + num(a.montant), 0)
              return { d, reste: Math.max(0, totals(d.data || {}).total - paye) }
            })
        : [],
    [pid, documents, actions],
  )

  const enregistrer = async () => {
    if (!pid && !nouveau.trim()) return toast('Écris le nom de la personne qui a payé', true)
    if (!(num(montant) > 0)) return toast('Écris le montant reçu', true)
    setBusy(true)
    try {
      let id = pid
      let p = data.byId[pid]
      if (!id) {
        p = await api.addProspect(nouveau.trim(), { aCompleter: true, source: 'Encaissement' })
        id = p.id
      }
      try {
        localStorage.setItem('aecrm-moyen', moyen)
      } catch {
        // rien
      }
      const lie = ouvertes.find((x) => x.d.numero === facture)
      const [a] = await api.addActions([
        { prospect_id: id, date, canal: 'Autre', action: 'Paiement reçu', montant: num(montant), mode: moyen, reference: reference.trim() || null, facture: facture || null, categorie: devinee || null, notes: pour.trim() || null },
      ])
      setFait({ a: { ...a, date, montant: num(montant), mode: moyen, reference: reference.trim(), facture, notes: pour.trim() }, p, reste: lie ? Math.max(0, lie.reste - num(montant)) : null })
      setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  if (fait) {
    const client = { nom: fait.p?.name, telephone: fait.p?.fiche?.telephone || tel }
    const numero = fait.p?.fiche?.telephone || fait.p?.fiche?.whatsapp || tel
    const msg = `Bonjour, nous avons bien reçu votre paiement de ${eur(fait.a.montant)}${fait.a.notes ? ` pour ${fait.a.notes}` : ''}. Merci pour votre confiance. Agence Elite`
    const lien = numero ? `${waLink(numero, settings.clients?.indicatifWhatsApp || '242')}?text=${encodeURIComponent(msg)}` : ''
    return (
      <div className="stack enc-fait">
        <div className="enc-ok">
          <span className="enc-ok-ico">
            <Icon n="check" size={26} />
          </span>
          <div>
            <div className="enc-ok-v">{eur(fait.a.montant)} reçus</div>
            <div className="small muted">
              de {fait.p?.name}
              {fait.reste !== null ? ` · reste à payer ${eur(fait.reste)}` : ''}
            </div>
          </div>
        </div>
        {!fait.p?.fiche?.telephone && (
          <div className="enc-question">
            <strong>Son numéro de téléphone ?</strong>
            <span className="small muted">Pour lui envoyer son reçu et lui proposer d’autres services plus tard.</span>
            <div className="row">
              <input className="input" inputMode="tel" placeholder="06 123 45 67" value={tel} onChange={(e) => setTel(e.target.value)} />
              <button
                type="button"
                className="btn"
                disabled={!tel.trim()}
                onClick={async () => {
                  await api.updateProspect(fait.p.id, { fiche: { ...(fait.p.fiche || {}), telephone: tel.trim() } })
                  setFait((f) => ({ ...f, p: { ...f.p, fiche: { ...(f.p.fiche || {}), telephone: tel.trim() } } }))
                  toast('Numéro ajouté ✓')
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        )}
        <div className="enc-boutons">
          <button type="button" className="btn primary" onClick={() => telechargerRecu({ p: fait.a, client, settings, reste: fait.reste })}>
            <Icon n="download" size={16} /> Télécharger le reçu
          </button>
          {lien && (
            <a className="btn" href={lien} target="_blank" rel="noreferrer">
              <Icon n="message" size={16} /> Envoyer sur WhatsApp
            </a>
          )}
          <button type="button" className="btn ghost" onClick={() => onDone?.()}>
            Fermer
          </button>
        </div>
        {!(settings.facturation?.signature || settings.facturation?.cachet) && <p className="tiny muted">Astuce : ajoute ta signature et ton cachet dans Administration › Signature et cachet. Ils apparaîtront sur tous tes reçus.</p>}
      </div>
    )
  }

  return (
    <div className="stack enc">
      <Field label="Qui a payé ?">
        {nouveau ? (
          <div className="selected-prospect">
            <div className="li-main">
              <div className="li-title">{nouveau}</div>
              <div className="li-sub">Nouveau client : il sera ajouté tout seul</div>
            </div>
            <button type="button" className="btn sm" onClick={() => setNouveau('')}>
              Changer
            </button>
          </div>
        ) : (
          <ProspectPicker value={pid} onPick={setPid} onNew={setNouveau} newLabel="Nouveau client" />
        )}
      </Field>
      <Field label="Combien ?">
        <input className="input enc-montant" inputMode="numeric" placeholder="100 000" value={montant} onChange={(e) => setMontant(e.target.value)} />
      </Field>
      {ouvertes.length > 0 && (
        <Field label="Pour quelle facture ?">
          <div className="chips">
            <button type="button" className={`chip ${!facture ? 'on' : ''}`} onClick={() => setFacture('')}>
              Aucune
            </button>
            {ouvertes.map(({ d, reste }) => (
              <button
                type="button"
                key={d.id}
                className={`chip ${facture === d.numero ? 'on' : ''}`}
                onClick={() => {
                  setFacture(d.numero)
                  if (!montant) setMontant(String(reste))
                  if (!pour) setPour(d.data?.objet || '')
                }}
              >
                {d.numero} · reste {eur(reste)}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Pour quoi ?">
        <input className="input" placeholder="Ex. Licence logiciel, affiche, tablette…" value={pour} onChange={(e) => setPour(e.target.value)} />
      </Field>
      <div className="vr-sous">
        <label className="vr-activite" style={{ '--c': actDevinee?.couleur || '#5B6475' }}>
          <span className="pastille-act" />
          <select value={devinee} onChange={(e) => setActivite(e.target.value)} aria-label="Service">
            <option value="">Service : je le devine</option>
            {activites.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Payé avec">
        <div className="enc-moyens">
          {MOYENS.map(([v, l, ico]) => (
            <button type="button" key={v} className={`enc-moyen ${moyen === v ? 'on' : ''}`} onClick={() => setMoyen(v)}>
              <Icon n={ico} size={18} /> {l}
            </button>
          ))}
        </div>
      </Field>
      {moyen !== 'Espèces' && (
        <Field label="Référence (facultatif)">
          <input className="input" placeholder="Numéro de la transaction" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      )}
      <details className="vr-plus">
        <summary>Date : {date === today() ? 'aujourd’hui' : date}</summary>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
      </details>
      <div className="vr-pied">
        <div className="vr-total">{num(montant) > 0 ? eur(num(montant)) : ''}</div>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy}>
          <Icon n="check" size={16} /> Encaisser
        </button>
      </div>
    </div>
  )
}

export default function Encaisser({ onClose, prefill }) {
  return (
    <Modal title="Encaisser" onClose={onClose}>
      <EncaisserForm prefill={prefill} onDone={onClose} />
    </Modal>
  )
}
