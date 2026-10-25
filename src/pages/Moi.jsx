// « Moi » : l'argent que tu prends dans la caisse de l'agence pour toi (spiritualité, famille, repas…),
// séparé des dépenses de l'entreprise. Et « Dépense rapide » : 3 questions en boutons, rien d'autre.
import { useMemo, useState } from 'react'
import { Field, Modal, eur, pct, nb } from '../ui'
import { Icon } from '../icons'
import { useNoyau, useDonnees } from '../core/contexte'
import { today, fmtDate, addDays } from '../lib/dates'
import { num } from '../modules/facturation'
import { CATEGORIES_MOI, POUR_MOI, POCHES, pocheDe, poches, origineDepenses, depensesMoi, estPourMoi, norm } from '../modules/activites'

const MOYENS = [
  ['Espèces', 'Espèces'],
  ['Mobile Money', 'Mobile Money'],
  ['Virement', 'Banque'],
]

// Catégorie devinée : même texte déjà noté, sinon quelques mots connus
const MOTS = [
  ['Spiritualité', ['culte', 'eglise', 'priere', 'offrande', 'dime', 'messe', 'pasteur', 'spirituel', 'veillee']],
  ['Famille', ['famille', 'maman', 'papa', 'enfant', 'ecole', 'frere', 'soeur']],
  ['Repas', ['repas', 'manger', 'restaurant', 'dejeuner', 'diner', 'nourriture']],
  ['Transport', ['taxi', 'transport', 'carburant', 'essence', 'bus', 'moto']],
  ['Santé', ['pharmacie', 'medicament', 'hopital', 'docteur', 'sante']],
  ['Téléphone / internet', ['credit', 'forfait', 'internet', 'canal', 'recharge']],
  ['Abonnements / logiciels', ['abonnement', 'claude', 'chatgpt', 'canva', 'apple']],
  ['Impression', ['impression', 'imprimer', 'photocopie']],
  ['Publicité', ['pub', 'sponsor', 'boost', 'publicite']],
]
function devinerCategorie(texte, actions) {
  const t = norm(texte)
  if (!t) return ''
  const deja = actions.find((a) => a.action === 'Dépense' && norm(a.notes) === t && a.categorie)
  if (deja) return deja.categorie
  return MOTS.find(([, mots]) => mots.some((m) => t.includes(m)))?.[0] || ''
}

export function DepenseRapideForm({ pourMoi: initial = false, onDone }) {
  const { settings, api, toast } = useNoyau()
  const { actions = [], data } = useDonnees()
  const [montant, setMontant] = useState('')
  const [quoi, setQuoi] = useState('')
  const [moi, setMoi] = useState(initial)
  const [categorie, setCategorie] = useState('')
  const [moyen, setMoyen] = useState('Espèces')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [fait, setFait] = useState(null)
  const devinee = categorie || devinerCategorie(quoi, actions)
  const cats = moi ? [...new Set([...CATEGORIES_MOI, ...actions.filter(estPourMoi).map((a) => a.categorie).filter(Boolean)])] : settings.categoriesDepenses || []
  const soldes = poches(actions)

  const enregistrer = async () => {
    if (!(num(montant) > 0)) return toast('Écris le montant', true)
    setBusy(true)
    try {
      const [a] = await api.addActions([{ prospect_id: null, date, canal: moi ? POUR_MOI : 'Autre', action: 'Dépense', montant: num(montant), categorie: devinee || (moi ? 'Autre' : ''), mode: moyen, notes: quoi.trim() || null }])
      const tout = [...actions, { ...a, action: 'Dépense', date, montant: num(montant), created_at: new Date().toISOString() }]
      const origine = origineDepenses(tout, data.list).sources[a?.id]
      setFait({ montant: num(montant), origine })
      setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  if (fait)
    return (
      <div className="stack">
        <div className="enc-ok">
          <span className="enc-ok-ico rouge">
            <Icon n="check" size={26} />
          </span>
          <div>
            <div className="enc-ok-v">{eur(fait.montant)} notés</div>
            <div className="small muted">{moi ? 'Pour toi' : 'Pour l’entreprise'}</div>
          </div>
        </div>
        {fait.origine?.parts?.length > 0 && (
          <div className="enc-question">
            <strong>D’où vient cet argent ?</strong>
            {fait.origine.parts.map((x, i) => (
              <span key={i} className="small">
                {eur(x.montant)} pris sur le paiement de <b>{x.client}</b> du {fmtDate(x.date)}
              </span>
            ))}
            {fait.origine.nonCouvert > 0 && <span className="small rouge">{eur(fait.origine.nonCouvert)} ne viennent d’aucun paiement noté.</span>}
          </div>
        )}
        <button type="button" className="btn primary" onClick={() => onDone?.()}>
          Fermer
        </button>
      </div>
    )

  return (
    <div className="stack enc">
      <div className="grid grid-2">
        <Field label="Combien ?">
          <input className="input enc-montant" inputMode="numeric" autoFocus placeholder="20 000" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Pour quoi ?">
          <input className="input" placeholder="Ex. Culte pour le business" value={quoi} onChange={(e) => setQuoi(e.target.value)} />
        </Field>
      </div>
      <Field label="1. Pour qui ?">
        <div className="enc-moyens">
          <button type="button" className={`enc-moyen ${!moi ? 'on' : ''}`} onClick={() => (setMoi(false), setCategorie(''))}>
            <Icon n="briefcase" size={18} /> L’entreprise
          </button>
          <button type="button" className={`enc-moyen ${moi ? 'on' : ''}`} onClick={() => (setMoi(true), setCategorie(''))}>
            <Icon n="star" size={18} /> Moi
          </button>
        </div>
      </Field>
      <Field label="2. Quelle catégorie ?">
        <div className="chips">
          {cats.map((c) => (
            <button key={c} type="button" className={`chip ${devinee === c ? 'on' : ''}`} onClick={() => setCategorie(c)}>
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="3. Payé avec quoi ?">
        <div className="enc-moyens">
          {MOYENS.map(([v, l]) => {
            const s = soldes.find((p) => p.id === pocheDe(v))
            return (
              <button type="button" key={v} className={`enc-moyen ${moyen === v ? 'on' : ''}`} onClick={() => setMoyen(v)}>
                {l}
                <span className="tiny muted">reste {eur(s?.solde || 0)}</span>
              </button>
            )
          })}
        </div>
      </Field>
      <details className="vr-plus">
        <summary>Date : {date === today() ? 'aujourd’hui' : date}</summary>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
      </details>
      <div className="vr-pied">
        <div className="vr-total">{num(montant) > 0 ? eur(num(montant)) : ''}</div>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy}>
          <Icon n="check" size={16} /> Noter la dépense
        </button>
      </div>
    </div>
  )
}

export function DepenseRapide({ onClose, prefill = {} }) {
  return (
    <Modal title={prefill.moi ? 'Dépense pour moi' : 'Nouvelle dépense'} onClose={onClose}>
      <DepenseRapideForm pourMoi={!!prefill.moi} onDone={onClose} />
    </Modal>
  )
}

// Les poches d'argent : combien il reste en espèces, sur Mobile Money et à la banque
export function Poches() {
  const { actions = [] } = useDonnees()
  const liste = poches(actions)
  const total = liste.reduce((m, p) => m + p.solde, 0)
  return (
    <div className="poches">
      {liste.map((p) => (
        <div key={p.id} className="poche" style={{ '--c': p.couleur }}>
          <span className="poche-nom">{p.nom}</span>
          <span className="poche-v">{eur(p.solde)}</span>
          <span className="tiny muted">
            entré {eur(p.entre)} · sorti {eur(p.sorti)}
          </span>
        </div>
      ))}
      <div className="poche total">
        <span className="poche-nom">Total</span>
        <span className="poche-v">{eur(total)}</span>
        <span className="tiny muted">selon ce qui est noté dans le CRM</span>
      </div>
    </div>
  )
}

const PERIODES = [
  ['30', 'Ce mois-ci (30 j)'],
  ['90', '3 mois'],
  ['365', '12 mois'],
]

export default function Moi() {
  const { ouvrir } = useNoyau()
  const { actions = [], data } = useDonnees()
  const [jours, setJours] = useState('30')
  const t = today()
  const p = { debut: addDays(t, -(Number(jours) - 1)), fin: t }
  const res = depensesMoi(actions, p)
  const recu = actions.filter((a) => a.action === 'Paiement reçu' && a.date >= p.debut && a.date <= p.fin).reduce((m, a) => m + num(a.montant), 0)
  const entreprise = actions.filter((a) => a.action === 'Dépense' && !estPourMoi(a) && a.date >= p.debut && a.date <= p.fin).reduce((m, a) => m + num(a.montant), 0)
  const reste = recu - entreprise - res.total
  const origine = useMemo(() => origineDepenses(actions, data.list).sources, [actions, data.list])
  const max = Math.max(1, ...res.categories.map(([, v]) => v))

  return (
    <div className="stack moi">
      <div className="pl-tete">
        <div>
          <h1>Moi</h1>
          <p className="pl-phrase">L’argent que tu prends pour toi. Il est séparé des dépenses de l’entreprise. Toi seul le vois.</p>
        </div>
        <div className="pl-actions">
          <div className="pl-periodes" role="group" aria-label="Période">
            {PERIODES.map(([k, l]) => (
              <button key={k} type="button" className={jours === k ? 'on' : ''} aria-pressed={jours === k} onClick={() => setJours(k)}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={() => ouvrir('depense', { moi: true })}>
            <Icon n="plus" size={15} /> Dépense pour moi
          </button>
        </div>
      </div>

      <div className="pl-tuiles">
        <div className="pl-tuile grand">
          <span className="pl-tuile-l">Pris pour moi</span>
          <span className="pl-tuile-v">{eur(res.total)}</span>
          <span className="pl-tuile-s">{recu ? `${pct(res.total / recu)} de l’argent reçu` : 'aucun argent reçu sur la période'}</span>
        </div>
        <div className="pl-tuile">
          <span className="pl-tuile-l">Argent reçu</span>
          <span className="pl-tuile-v">{eur(recu)}</span>
          <span className="pl-tuile-s">paiements des clients</span>
        </div>
        <div className="pl-tuile">
          <span className="pl-tuile-l">Dépenses de l’entreprise</span>
          <span className="pl-tuile-v">{eur(entreprise)}</span>
          <span className="pl-tuile-s">notées dans Finances</span>
        </div>
        <div className={`pl-tuile ${reste < 0 ? 'rouge' : 'vert'}`}>
          <span className="pl-tuile-l">Il te reste vraiment</span>
          <span className="pl-tuile-v">{eur(reste)}</span>
          <span className="pl-tuile-s">reçu − entreprise − moi</span>
        </div>
      </div>

      <section className="pl-carte">
        <header>
          <h2>
            <Icon n="wallet" size={16} /> Mes poches d’argent
          </h2>
        </header>
        <Poches />
      </section>

      <div className="pl-grille">
        <section className="pl-carte">
          <header>
            <h2>Par catégorie</h2>
          </header>
          {res.categories.length === 0 ? (
            <p className="small muted">Rien de noté pour toi sur la période.</p>
          ) : (
            <div className="barres">
              {res.categories.map(([c, v]) => (
                <div key={c} className="barre-l">
                  <span>{c}</span>
                  <span className="barre">
                    <i style={{ width: `${(v / max) * 100}%` }} />
                  </span>
                  <strong>{eur(v)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="pl-carte">
          <header>
            <h2>Dernières dépenses pour moi</h2>
          </header>
          {res.liste.length === 0 ? (
            <p className="small muted">Quand tu prends de l’argent pour toi, note-le ici : tu sauras toujours ce qu’il te reste.</p>
          ) : (
            <ul className="pl-clients">
              {res.liste.slice(0, 12).map((a) => {
                const o = origine[a.id]?.parts?.[0]
                return (
                  <li key={a.id}>
                    <span className="bold">{a.notes || a.categorie}</span>
                    <span className="tiny muted">
                      {fmtDate(a.date)} · {a.categorie}
                      {o ? ` · venait de ${o.client}` : ''}
                    </span>
                    <strong className="num">{eur(num(a.montant))}</strong>
                  </li>
                )
              })}
            </ul>
          )}
          {res.liste.length > 0 && <p className="tiny muted">{nb(res.liste.length)} dépense(s) sur la période.</p>}
        </section>
      </div>
      <p className="tiny muted">Les poches : {POCHES.map((p) => p.nom).join(', ')}. Une dépense sort de la poche avec laquelle tu l’as payée.</p>
    </div>
  )
}
