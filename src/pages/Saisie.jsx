import { useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { ProspectPicker } from '../core/ui/ProspectPicker'
import { Field, Select, eur, Empty, Modal, LienDoc, confirmer } from '../ui'
import { useApp, useNoyau, useDonnees } from '../core/contexte'
import { FICHE_FIELDS, LISTES } from '../lib/defaults'
import { today, nowTime, addDays, fmtDate } from '../lib/dates'
import { montantRetenu } from '../lib/logic'

const GROUPS = [
  ['Prospection', ['Premier contact', 'Relance', 'Échange / suivi', 'Qualification']],
  ['Vente', ['Audit réalisé', 'Loom envoyé', 'Démo présentée', 'RDV', 'Proposition envoyée', 'Signature', 'Perdu']],
  ['Client', ['Intervention', 'Paiement reçu', 'Vente additionnelle', 'Onboarding - Contrat', 'Onboarding - Accès', 'Onboarding - Contenus', 'Onboarding - Lancement', "Demande d'avis Google", 'Satisfaction client', 'Résiliation']],
  ['Autre', ['Ajout prospect', 'Note', 'Dépense']],
]
const MONEY = ['Proposition envoyée', 'Signature', 'Paiement reçu', 'Vente additionnelle', 'Intervention', 'Dépense']
const MAIN_FICHE = ['secteur', 'ville', 'contact', 'telephone', 'instagram', 'site', 'source', 'pub_active', 'presence_google', 'taille']
const UPDATE_FICHE = ['offre', 'abonnement', 'budget_ok', 'decideur', 'besoin', 'delai']
const PROCHAINES = ['Rappeler', 'Relancer en DM', 'Envoyer le Loom', 'Faire l’audit', 'Préparer la démo', 'Envoyer la proposition', 'Relancer la proposition', 'Signature', 'Demander le paiement']

export function FicheInput({ f, value, onChange }) {
  const { settings } = useNoyau()
  const opts = f.fixed
    ? LISTES[f.fixed]
    : f.list === 'offres'
      ? settings.offres.map((o) => o.nom)
      : f.list === 'secteurs'
        ? settings.secteurs.map((s) => s.nom)
        : f.list
          ? settings[f.list]
          : null
  if (opts) return <Select value={value} onChange={onChange} options={opts} />
  return (
    <input
      type={f.type === 'number' ? 'text' : f.type || 'text'}
      inputMode={f.type === 'number' ? 'decimal' : f.type === 'tel' ? 'tel' : undefined}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const blank = (prefill) => ({
  date: today(),
  time: nowTime(),
  canal: '',
  action: '',
  resultat: '',
  montant: '',
  duree: '',
  prochaine_action: '',
  date_relance: '',
  heure_rappel: '',
  objection: '',
  modele: '',
  note: '',
  facture: '',
  remise: '',
  notes: '',
  ...prefill,
})

export function ActionForm({ prefill = {}, onDone }) {
  const { settings, data, api, toast, openAction } = useApp()
  const editing = prefill.edit
  const init = editing
    ? Object.fromEntries(Object.entries(blank(editing)).map(([k, v]) => [k, v === null || v === undefined ? '' : v]))
    : blank({ canal: prefill.canal || '', action: prefill.action || '', montant: prefill.montant ?? '' })
  const [f, setF] = useState(init)
  const [pid, setPid] = useState(editing ? editing.prospect_id : prefill.prospect_id || null)
  const [newName, setNewName] = useState(null)
  const [newFiche, setNewFiche] = useState({})
  const [moreFiche, setMoreFiche] = useState(false)
  const [ficheUpd, setFicheUpd] = useState({})
  const [showUpd, setShowUpd] = useState(false)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const topRef = useRef()

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const setE = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  // Paiement ou dépense : formulaire dédié (montant d'abord, frais liés, reçu, facture)
  const choisirAction = (a) => {
    if (!editing && (a === 'Paiement reçu' || a === 'Dépense')) {
      onDone?.()
      return openAction({ action: a, prospect_id: pid || null })
    }
    set('action')(f.action === a ? '' : a)
  }
  const L = data.L
  const actDef = L.act[f.action]
  const prospection = !!actDef?.prospection
  const p = pid ? data.byId[pid] : null
  const known = new Set(GROUPS.flatMap((g) => g[1]))
  // Actions automatiques ou rares : pas de tuile (Commande boutique vient du site, les dépenses de Facturation)
  const AUTO = ['Commande boutique']
  const groups = [
    ...GROUPS.map(([g, list]) => [g, list.filter((a) => L.act[a])]),
    ['Personnalisé', settings.actions.map((a) => a.nom).filter((a) => !known.has(a) && !AUTO.includes(a))],
  ].filter((g) => g[1].length)
  // Prospection et vente toujours visibles ; client, autres et personnalisées sur demande (ou si l'une est choisie)
  const PRINCIPAUX = ['Prospection', 'Vente']
  const [toutes, setToutes] = useState(() => !!prefill.edit || (!!prefill.action && !GROUPS.slice(0, 2).some(([, l]) => l.includes(prefill.action))))
  const visibles = groups.filter(([g, list]) => toutes || PRINCIPAUX.includes(g) || list.includes(f.action))

  const showResult = prospection || f.action === 'Loom envoyé' || !!f.resultat
  const showMoney = MONEY.includes(f.action) || f.montant !== ''
  const autoPrice = p || newName ? montantRetenu({ action: f.action, remise: f.remise }, { fiche: { ...(p?.fiche || newFiche), ...ficheUpd } }, L) : 0
  const showObjection = f.resultat === 'Pas intéressé' || f.action === 'Perdu' || !!f.objection
  const showModele = prospection && f.canal !== 'Appel'
  const showNote = f.action === 'Audit réalisé' || f.action === 'Satisfaction client' || f.note !== ''
  const showFacture = ['Paiement reçu', 'Signature', 'Vente additionnelle', 'Intervention'].includes(f.action) || f.facture !== ''
  const needsProspect = f.action !== 'Dépense' && f.action !== 'Note'

  const relanceAuto = () => {
    if (!prospection) return null
    const n = (p?.tentatives || 0) + 1
    const d = n <= 1 ? settings.relance.j1 : n === 2 ? settings.relance.j2 : settings.relance.j3
    return addDays(f.date || today(), d)
  }

  const reset = () => {
    setF(blank({ date: f.date, canal: f.canal }))
    setPid(null)
    setNewName(null)
    setNewFiche({})
    setFicheUpd({})
    setShowUpd(false)
    setMore(false)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const save = async (again) => {
    const action = f.action || (newName ? 'Ajout prospect' : '')
    if (!action) return toast('Choisis une action', true)
    if (!f.date) return toast('Date manquante', true)
    if (needsProspect && !pid && !newName) return toast('Choisis ou crée un prospect', true)
    if (prospection && !f.canal) return toast('Choisis le canal', true)
    if (f.date_relance && f.date_relance < f.date) return toast('La relance est avant la date de l’action', true)
    setBusy(true)
    try {
      let prospectId = pid
      if (newName) {
        const phone = (newFiche.telephone || '').replace(/\s/g, '')
        const dupPhone = phone && data.list.find((x) => (x.fiche?.telephone || '').replace(/\s/g, '') === phone)
        if (dupPhone && !(await confirmer(`Ce numéro est déjà utilisé par « ${dupPhone.name} ».`, { titre: 'Doublon possible', ok: 'Créer quand même', non: 'Annuler' }))) {
          setBusy(false)
          return
        }
        const np = await api.addProspect(newName, clean({ ...newFiche, ...ficheUpd }))
        prospectId = np.id
      } else if (p && Object.keys(clean(ficheUpd)).length) {
        await api.updateProspect(p.id, { fiche: { ...p.fiche, ...clean(ficheUpd) } })
      }
      const row = { ...f, action, prospect_id: needsProspect || prospectId ? prospectId : null }
      if (editing) await api.updateAction(editing.id, row)
      else await api.addActions([row])
      toast(editing ? 'Action modifiée ✓' : `${action} enregistré ✓`)
      if (onDone) onDone(prospectId)
      else if (again && prospectId) {
        setF(blank({ date: f.date, canal: f.canal }))
        setPid(prospectId)
        setNewName(null)
        setNewFiche({})
        setFicheUpd({})
      } else reset()
    } catch {
      /* toast déjà affiché */
    }
    setBusy(false)
  }

  const resultats = settings.resultats || []
  const suiteOk = needsProspect && f.action !== 'Signature' && f.action !== 'Perdu'

  return (
    <div className="af" ref={topRef}>
      <Section n={1} titre="Prospect" aide={editing ? null : 'Cherche une fiche ou tape un nouveau nom'}>
        {newName ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="selected-prospect">
              <div className="li-main">
                <div className="li-title">
                  <Icon n="user-plus" size={15} /> {newName}
                </div>
                <div className="li-sub">Nouveau prospect : remplis l'essentiel de sa fiche</div>
              </div>
              <button type="button" className="btn sm" onClick={() => setNewName(null)}>
                Annuler
              </button>
            </div>
            <div className="form-grid">
              {FICHE_FIELDS.filter((x) => moreFiche || MAIN_FICHE.includes(x.key)).map((x) => (
                <Field key={x.key} label={x.label}>
                  <FicheInput f={x} value={newFiche[x.key]} onChange={(v) => setNewFiche((s) => ({ ...s, [x.key]: v }))} />
                </Field>
              ))}
            </div>
            <div>
              <button type="button" className="btn sm" onClick={() => setMoreFiche(!moreFiche)}>
                <Icon n={moreFiche ? 'x' : 'plus'} size={14} /> {moreFiche ? 'Moins de champs' : 'Tous les champs (pub, Google, qualification, offre…)'}
              </button>
            </div>
          </div>
        ) : editing ? (
          <div className="selected-prospect">
            <div className="li-main">
              <div className="li-title">{p ? p.name : 'Sans prospect'}</div>
            </div>
          </div>
        ) : (
          <ProspectPicker value={pid} onPick={setPid} onNew={setNewName} />
        )}
        <div className="af-when">
          <label>
            <span>Le</span>
            <input className="input" type="date" value={f.date} onChange={setE('date')} aria-label="Date de l'action" />
          </label>
          <label>
            <span>à</span>
            <input className="input" type="time" value={f.time} onChange={setE('time')} aria-label="Heure de l'action" />
          </label>
        </div>
      </Section>

      <Section n={2} titre="Canal" aide={prospection ? 'Obligatoire pour une prise de contact' : 'Facultatif'}>
        <div className="tiles canaux" role="radiogroup" aria-label="Canal">
          {settings.canaux.map((c) => (
            <Tuile key={c} on={f.canal === c} ico={ICO_CANAL[c] || 'radio'} label={c} onClick={() => set('canal')(f.canal === c ? '' : c)} grand />
          ))}
        </div>
      </Section>

      <Section n={3} titre="Action">
        <div className="af-groups">
          {visibles.map(([g, list]) => (
            <div key={g} className="af-group">
              <div className="af-glabel">
                <i style={{ background: COUL_GROUPE[g] || COUL_GROUPE.Autre }} />
                {g}
              </div>
              <div className="tiles" role="radiogroup" aria-label={`Actions : ${g}`}>
                {list.map((a) => (
                  <Tuile key={a} on={f.action === a} ico={ICO_ACTION[a] || (a.startsWith('Onboarding') ? 'clipboard' : 'tag')} label={a.replace('Onboarding - ', 'Onboarding · ')} onClick={() => choisirAction(a)} ton={COUL_GROUPE[g] || COUL_GROUPE.Autre} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {visibles.length < groups.length && (
          <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={() => setToutes(true)}>
            <Icon n="plus" size={14} /> Actions client et autres ({groups.filter((g) => !visibles.includes(g)).reduce((m, [, l]) => m + l.length, 0)})
          </button>
        )}
        {(showMoney || showObjection || showModele || showNote || showFacture) && (
          <div className="af-details form-grid">
            {showMoney && (
              <Field label="Montant (€)">
                <input inputMode="decimal" value={f.montant} onChange={setE('montant')} placeholder={autoPrice ? `Auto : ${eur(autoPrice)}` : ''} />
              </Field>
            )}
            {(f.action === 'Proposition envoyée' || f.action === 'Signature' || f.remise !== '') && (
              <Field label="Remise (€)">
                <input inputMode="decimal" value={f.remise} onChange={setE('remise')} />
              </Field>
            )}
            {showFacture && (
              <Field label="N° facture">
                <input value={f.facture} onChange={setE('facture')} />
              </Field>
            )}
            {showNote && (
              <Field label={f.action === 'Satisfaction client' ? 'Satisfaction (/10)' : 'Note (audit /100)'}>
                <input inputMode="decimal" value={f.note} onChange={setE('note')} />
              </Field>
            )}
            {showObjection && (
              <Field label="Objection / motif de perte">
                <Select value={f.objection} onChange={set('objection')} options={settings.objections} />
              </Field>
            )}
            {showModele && (
              <Field label="Modèle / accroche">
                <Select value={f.modele} onChange={set('modele')} options={settings.modeles} />
              </Field>
            )}
          </div>
        )}
      </Section>

      <Section n={4} titre="Résultat" aide={showResult ? 'Comment ça s’est passé' : 'Facultatif pour cette action'}>
        <div className="tiles resultats" role="radiogroup" aria-label="Résultat">
          {resultats.map((r) => {
            const ton = /pas int[ée]ress/i.test(r.nom) ? 'neg' : Number(r.rang) > 0 || r.nom === 'Loom vu' ? 'pos' : ''
            return (
              <Tuile
                key={r.nom}
                on={f.resultat === r.nom}
                ico={ton === 'pos' ? 'check-circle' : ton === 'neg' ? 'x' : ICO_RESULTAT[r.nom] || 'message'}
                label={r.nom}
                classe={ton}
                onClick={() => set('resultat')(f.resultat === r.nom ? '' : r.nom)}
              />
            )
          })}
        </div>
      </Section>

      <Section n={5} titre="Suite">
        {suiteOk ? (
          <>
            <div className="form-grid">
              <Field label="Prochaine action">
                <input list="prochaines" value={f.prochaine_action} onChange={setE('prochaine_action')} placeholder="Rappeler, envoyer le Loom…" />
                <datalist id="prochaines">
                  {PROCHAINES.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </Field>
              <Field label="Date de relance">
                <input type="date" value={f.date_relance} onChange={setE('date_relance')} />
              </Field>
              <Field label="Heure de rappel">
                <input type="time" value={f.heure_rappel} onChange={setE('heure_rappel')} />
              </Field>
            </div>
            <div className="af-quick" role="group" aria-label="Relance rapide">
              {[
                ['Demain', 1],
                ['J+2', 2],
                ['J+5', 5],
                ['J+10', 10],
                ['1 mois', 30],
              ].map(([l, d]) => {
                const v = addDays(f.date || today(), d)
                return (
                  <button key={l} type="button" className={f.date_relance === v ? 'on' : ''} aria-pressed={f.date_relance === v} onClick={() => set('date_relance')(f.date_relance === v ? '' : v)}>
                    {l}
                  </button>
                )
              })}
              {!f.date_relance && relanceAuto() && <span className="tiny muted">Vide : relance automatique le {fmtDate(relanceAuto())}</span>}
            </div>
          </>
        ) : (
          <div className="tiny muted">{needsProspect ? 'Rien à planifier après cette action.' : 'Pas de suite pour une note ou une dépense.'}</div>
        )}
        <div className="af-more">
          <button type="button" className={`btn sm ${more ? 'on' : ''}`} aria-expanded={more} onClick={() => setMore(!more)}>
            <Icon n="note" size={14} /> Notes et durée
          </button>
          {p && !editing && (
            <button type="button" className={`btn sm ${showUpd ? 'on' : ''}`} aria-expanded={showUpd} onClick={() => setShowUpd(!showUpd)}>
              <Icon n="edit" size={14} /> Mettre à jour la fiche
            </button>
          )}
        </div>
        {more && (
          <div className="form-grid af-block">
            <Field label="Durée (min)">
              <input inputMode="decimal" value={f.duree} onChange={setE('duree')} />
            </Field>
            {!showObjection && (
              <Field label="Objection / motif">
                <Select value={f.objection} onChange={set('objection')} options={settings.objections} />
              </Field>
            )}
            {!showModele && (
              <Field label="Modèle / accroche">
                <Select value={f.modele} onChange={set('modele')} options={settings.modeles} />
              </Field>
            )}
            <Field label="Notes" style={{ gridColumn: '1 / -1' }}>
              <textarea value={f.notes} onChange={setE('notes')} />
            </Field>
          </div>
        )}
        {p && !editing && showUpd && (
          <div className="form-grid af-block">
            {FICHE_FIELDS.filter((x) => UPDATE_FICHE.includes(x.key)).map((x) => (
              <Field key={x.key} label={x.label}>
                <FicheInput f={x} value={ficheUpd[x.key] ?? p.fiche?.[x.key]} onChange={(v) => setFicheUpd((s) => ({ ...s, [x.key]: v }))} />
              </Field>
            ))}
          </div>
        )}
      </Section>

      <div className="af-save">
        <div className="af-recap">
          {[p?.name || newName, f.canal, f.action || (newName ? 'Ajout prospect' : ''), f.resultat].filter(Boolean).join(' · ') || 'Choisis un prospect et une action'}
        </div>
        {!editing && !onDone && (
          <button className="btn" disabled={busy} onClick={() => save(true)} title="Enregistrer et saisir une autre action pour ce prospect">
            <Icon n="plus" size={15} /> Autre action
          </button>
        )}
        <button className="btn gold lg" disabled={busy} onClick={() => save(false)}>
          <Icon n={busy ? 'clock' : 'check'} size={16} /> {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

const COUL_GROUPE = { Prospection: '#2F5BD3', Vente: '#B8903F', Client: '#0F7B55', Autre: '#8A93A6', Personnalisé: '#8A93A6' }
const ICO_CANAL = { DM: 'instagram', Appel: 'phone', WhatsApp: 'message', Facebook: 'facebook', Autre: 'more' }
const ICO_ACTION = {
  'Premier contact': 'send',
  Relance: 'repeat',
  'Échange / suivi': 'message',
  Qualification: 'target',
  'Audit réalisé': 'search',
  'Loom envoyé': 'play',
  'Démo présentée': 'eye',
  RDV: 'calendar',
  'Proposition envoyée': 'file',
  Signature: 'handshake',
  Perdu: 'ban',
  Intervention: 'bolt',
  'Paiement reçu': 'coins',
  'Vente additionnelle': 'trend',
  "Demande d'avis Google": 'star',
  'Satisfaction client': 'sparkles',
  Résiliation: 'x',
  'Ajout prospect': 'user-plus',
  Note: 'note',
  Dépense: 'wallet',
}
const ICO_RESULTAT = { 'Pas de réponse': 'clock', 'Messagerie - vocal laissé': 'phone', 'Messagerie - sans vocal': 'phone', Rappeler: 'repeat', 'A répondu': 'message', Autre: 'more' }

// Bloc numéroté du formulaire
function Section({ n, titre, aide, children }) {
  return (
    <section className="af-sec" aria-labelledby={`af-${n}`}>
      <div className="af-sec-h">
        <span className="af-n" aria-hidden="true">
          {n}
        </span>
        <h3 id={`af-${n}`}>{titre}</h3>
        {aide && <span className="af-aide">{aide}</span>}
      </div>
      {children}
    </section>
  )
}

// Tuile de choix (canal, action, résultat) : fond bleu nuit, liseré or et coche quand elle est choisie
function Tuile({ on, ico, label, onClick, grand, ton, classe = '' }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`tile ${grand ? 'big' : ''} ${classe} ${on ? 'on' : ''}`} style={ton ? { '--t': ton } : undefined} onClick={onClick}>
      <span className="tile-ic">
        <Icon n={ico} size={grand ? 20 : 16} />
      </span>
      <span className="tile-l">{label}</span>
      {on && (
        <span className="tile-ok" aria-hidden="true">
          <Icon n="check" size={12} />
        </span>
      )}
    </button>
  )
}

function clean(o) {
  const out = {}
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined) out[k] = typeof v === 'string' ? v.trim() : v
  })
  return out
}

export function ActionLine({ a, showProspect = true, onEdit }) {
  const { data, api } = useApp()
  const p = a.prospect_id ? data.byId[a.prospect_id] : null
  const amount = a.montant !== null && a.montant !== undefined ? Number(a.montant) : a.action === 'Proposition envoyée' || a.action === 'Signature' ? montantRetenu(a, p, data.L) : null
  return (
    <div className="list-item">
      <div className="li-main">
        <div className="li-title" style={{ whiteSpace: 'normal' }}>
          {showProspect && p && (
            <a
              href={`#/prospect/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              {p.name}
            </a>
          )}
          {showProspect && p && ' · '}
          {a.action}
          {a.resultat ? ` → ${a.resultat}` : ''}
        </div>
        <div className="li-sub" style={{ whiteSpace: 'normal' }}>
          {fmtDate(a.date)}
          {a.time ? ` ${a.time}` : ''}
          {a.canal ? ` · ${a.canal}` : ''}
          {amount ? ` · ${eur(amount)}` : ''}
          {a.objection ? ` · ${a.objection}` : ''}
          {a.modele ? ` · ${a.modele}` : ''}
          {a.duree ? ` · ${a.duree} min` : ''}
          {a.note !== null && a.note !== undefined && a.note !== '' ? ` · note ${a.note}` : ''}
          {a.prochaine_action ? ` · ➜ ${a.prochaine_action}` : ''}
          {a.date_relance ? ` (${fmtDate(a.date_relance)}${a.heure_rappel ? ' ' + a.heure_rappel : ''})` : ''}
          {a.notes ? ` · « ${a.notes} »` : ''}
          {a.facture && (
            <>
              {' · '}
              <LienDoc numero={a.facture} />
            </>
          )}
        </div>
      </div>
      <div className="li-side">
        <button className="icon-btn" title="Modifier" onClick={() => onEdit(a)}>
          <Icon n="edit" size={15} />
        </button>
        <button
          className="icon-btn"
          title="Supprimer"
          aria-label="Supprimer l'action"
          onClick={() => api.deleteAction(a.id).catch(() => {})}
        >
          <Icon n="trash" size={15} />
        </button>
      </div>
    </div>
  )
}

export default function Saisie({ prospectId }) {
  const { data, actions } = useDonnees()
  const [edit, setEdit] = useState(null)
  const [n, setN] = useState(25)
  const recent = useMemo(
    () =>
      [...actions]
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, n),
    [actions, n],
  )
  return (
    <div className="page-saisie">
      <div className="page-head">
        <div>
          <h1>Nouvelle action</h1>
          <div className="sub">Appel, DM, relance, audit, RDV, proposition, signature, paiement : une ligne par action. Raccourci : touche N.</div>
        </div>
      </div>
      <div className="saisie-grid">
        <ActionForm prefill={{ prospect_id: prospectId }} />
        <div className="card">
          <h2 className="section">
            <span className="sec-ic">
              <Icon n="clock" size={16} />
            </span>
            Dernières saisies
          </h2>
          <div className="list">
            {recent.length === 0 && <Empty>Rien pour l'instant. Ta première action apparaîtra ici.</Empty>}
            {recent.map((a) => (
              <ActionLine key={a.id} a={a} onEdit={setEdit} />
            ))}
          </div>
          {actions.length > n && (
            <button className="btn sm" onClick={() => setN(n + 50)}>
              Voir plus
            </button>
          )}
          {data.list.length > 0 && (
            <div className="tiny muted" style={{ marginTop: 10 }}>
              {actions.length} actions · {data.list.length} fiches
            </div>
          )}
        </div>
      </div>
      {edit && (
        <Modal title="Modifier l'action" onClose={() => setEdit(null)} large>
          <ActionForm prefill={{ edit }} onDone={() => setEdit(null)} />
        </Modal>
      )}
    </div>
  )
}
