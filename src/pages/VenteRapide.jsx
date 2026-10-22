// Nouvelle vente en 4 champs : client (créé tout seul s'il est nouveau), ce que tu as fait, montant, payé ?
// Le CRM devine l'activité, crée la facture, le suivi client et le paiement. Le coût est facultatif.
import { useMemo, useState } from 'react'
import { Field, Modal, eur } from '../ui'
import { Icon } from '../icons'
import { useNoyau, useDonnees } from '../core/contexte'
import { ProspectPicker } from '../core/ui/ProspectPicker'
import { today } from '../lib/dates'
import { corbeille } from '../lib/corbeille'
import { num, nextNumero, numerosDejaPris, nouveauDoc } from '../modules/facturation'
import { activitesDe, devinerActivite, lignesVentes, prixHabituel } from '../modules/activites'

const vide = () => ({ designation: '', pu: '', cout: '', activite: '', choisie: false })

export function VenteForm({ onDone, prefill = {} }) {
  const { settings, api, toast } = useNoyau()
  const { documents = [], actions = [], data } = useDonnees()
  const [pid, setPid] = useState(prefill.prospect_id || null)
  const [nouveau, setNouveau] = useState('')
  const [lignes, setLignes] = useState([vide()])
  const [paye, setPaye] = useState(true)
  const [mode, setMode] = useState(settings.modesPaiement?.[0] || 'Mobile Money')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today())
  const [avecCout, setAvecCout] = useState(false)
  const [busy, setBusy] = useState(false)
  const activites = activitesDe(settings)
  const historique = useMemo(() => lignesVentes(documents, actions, data.list, settings), [documents, actions, data.list, settings])
  const total = lignes.reduce((m, l) => m + num(l.pu), 0)
  const marge = lignes.reduce((m, l) => m + num(l.pu) - (l.cout === '' ? 0 : num(l.cout)), 0)

  const setLigne = (i, patch) =>
    setLignes((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l
        const n = { ...l, ...patch }
        if ('designation' in patch && !n.choisie) n.activite = devinerActivite(patch.designation, settings, historique) || ''
        return n
      }),
    )
  const habituel = (l) => (l.designation.trim().length >= 3 && !l.pu ? prixHabituel(historique, l.designation, pid) : null)

  const enregistrer = async () => {
    const valides = lignes.filter((l) => l.designation.trim() && num(l.pu) > 0)
    if (!pid && !nouveau.trim()) return toast('Indique le client', true)
    if (!valides.length) return toast('Indique ce que tu as fait et le montant', true)
    setBusy(true)
    try {
      let id = pid
      let nom = data.byId[pid]?.name
      if (!id) {
        const p = await api.addProspect(nouveau.trim(), { aCompleter: true, source: 'Vente directe' })
        id = p.id
        nom = p.name
      }
      const fact = settings.facturation || {}
      const numero = nextNumero(documents, 'facture', fact, date, numerosDejaPris(actions, corbeille.liste()))
      const doc = {
        type: 'facture',
        numero,
        prospect_id: id,
        data: nouveauDoc('facture', fact, {
          date,
          objet: valides.map((l) => l.designation.trim()).join(', ').slice(0, 120),
          client: { nom, adresse: data.byId[id]?.fiche?.adresse_facturation || '' },
          lignes: valides.map((l) => ({ designation: l.designation.trim(), description: '', qte: 1, pu: num(l.pu), activite: l.activite || 'autre', ...(l.cout !== '' ? { cout: num(l.cout) } : {}) })),
          venteRapide: true,
        }),
      }
      const [suivi] = await api.addActions([{ prospect_id: id, date, canal: 'Autre', action: 'Intervention', montant: total, facture: numero, notes: doc.data.objet }])
      doc.data.actionId = suivi?.id
      const out = await api.saveDoc(doc)
      const [paiement] = paye ? await api.addActions([{ prospect_id: id, date, canal: 'Autre', action: 'Paiement reçu', montant: total, mode, reference: reference.trim() || null, facture: numero, notes: doc.data.objet }]) : []
      // Annuler pendant 8 s : la vente, son suivi et son paiement disparaissent (le client créé reste)
      const defaire = async () => {
        if (paiement?.id) await api.deleteAction(paiement.id, { silencieux: true })
        if (suivi?.id) await api.deleteAction(suivi.id, { silencieux: true })
        await api.deleteDoc(out.id, { silencieux: true })
        toast('Vente annulée')
      }
      toast(`Vente enregistrée ✓ · ${eur(total)}${paye ? ' encaissés' : ' à encaisser'} · facture ${numero}`, false, { annuler: defaire })
      onDone?.(out)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="stack vente-rapide">
      <Field label="Client">
        {nouveau ? (
          <div className="selected-prospect">
            <div className="li-main">
              <div className="li-title">{nouveau}</div>
              <div className="li-sub">Nouveau client : créé à l’enregistrement, tu compléteras sa fiche plus tard</div>
            </div>
            <button type="button" className="btn sm" onClick={() => setNouveau('')}>
              Changer
            </button>
          </div>
        ) : (
          <ProspectPicker value={pid} onPick={setPid} onNew={setNouveau} newLabel="Nouveau client" />
        )}
      </Field>
      {lignes.map((l, i) => {
        const h = habituel(l)
        const act = activites.find((a) => a.id === l.activite)
        return (
          <div key={i} className="vr-ligne">
            <div className="vr-champs">
              <Field label={i === 0 ? 'Ce que tu as fait' : `Ligne ${i + 1}`}>
                <input className="input" autoFocus={i === 0 && !!(pid || nouveau)} value={l.designation} onChange={(e) => setLigne(i, { designation: e.target.value })} placeholder="Ex. : Création d’une affiche publicitaire" />
              </Field>
              <Field label="Montant">
                <input className="input num" inputMode="numeric" value={l.pu} onChange={(e) => setLigne(i, { pu: e.target.value })} placeholder="25 000" />
              </Field>
              {avecCout && (
                <Field label="Coût (facultatif)" hint="Prix d’achat, impression…">
                  <input className="input num" inputMode="numeric" value={l.cout} onChange={(e) => setLigne(i, { cout: e.target.value })} placeholder="0" />
                </Field>
              )}
            </div>
            <div className="vr-sous">
              <label className="vr-activite" style={{ '--c': act?.couleur || '#5B6475' }}>
                <span className="pastille-act" />
                <select value={l.activite} onChange={(e) => setLigne(i, { activite: e.target.value, choisie: true })} aria-label="Activité">
                  <option value="">Activité : je la devine en lisant</option>
                  {activites.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
              </label>
              {h && (
                <button type="button" className="chip" onClick={() => setLigne(i, { pu: String(h.pu), ...(h.cout !== null ? { cout: String(h.cout) } : {}) })}>
                  Prix habituel : {eur(h.pu)}
                </button>
              )}
              {lignes.length > 1 && (
                <button type="button" className="btn sm ghost" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label="Retirer la ligne">
                  <Icon n="x" size={14} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="row">
        <button type="button" className="btn sm ghost" onClick={() => setLignes((ls) => [...ls, vide()])}>
          <Icon n="plus" size={14} /> Ajouter une ligne
        </button>
        {!avecCout && (
          <button type="button" className="btn sm ghost" onClick={() => setAvecCout(true)}>
            <Icon n="coins" size={14} /> Noter un coût (pour la marge)
          </button>
        )}
      </div>
      <Field label="Payé ?">
        <div className="chips">
          <button type="button" className={`chip ${paye ? 'on' : ''}`} onClick={() => setPaye(true)}>
            Oui, c’est encaissé
          </button>
          <button type="button" className={`chip ${!paye ? 'on' : ''}`} onClick={() => setPaye(false)}>
            Pas encore
          </button>
        </div>
      </Field>
      {paye && (
        <div className="grid grid-2">
          <Field label="Moyen de paiement">
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              {(settings.modesPaiement || ['Espèces', 'Mobile Money', 'Virement']).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Référence (facultatif)" hint="Numéro de la transaction Mobile Money">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
      )}
      <details className="vr-plus">
        <summary>Date : {date === today() ? 'aujourd’hui' : date}</summary>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
      </details>
      <div className="vr-pied">
        <div>
          <div className="vr-total">{eur(total)}</div>
          {avecCout && <div className="small muted">Marge : {eur(marge)}</div>}
        </div>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy}>
          <Icon n="check" size={16} /> Enregistrer la vente
        </button>
      </div>
    </div>
  )
}

export default function VenteRapide({ onClose, prefill }) {
  return (
    <Modal title="Nouvelle vente" onClose={onClose}>
      <VenteForm prefill={prefill} onDone={onClose} />
    </Modal>
  )
}
