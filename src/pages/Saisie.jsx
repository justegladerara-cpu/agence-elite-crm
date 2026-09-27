import { useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Chips, Field, Select, StageBadge, eur, Empty, Modal } from '../ui'
import { FICHE_FIELDS, LISTES } from '../lib/defaults'
import { today, nowTime, addDays, fmtDate } from '../lib/dates'
import { montantRetenu } from '../lib/logic'

const GROUPS = [
  ['Prospection', ['Premier contact', 'Relance', 'Échange / suivi', 'Qualification']],
  ['Vente', ['Audit réalisé', 'Loom envoyé', 'Démo présentée', 'RDV', 'Proposition envoyée', 'Signature', 'Perdu']],
  ['Client', ['Paiement reçu', 'Vente additionnelle', 'Onboarding - Contrat', 'Onboarding - Accès', 'Onboarding - Contenus', 'Onboarding - Lancement', "Demande d'avis Google", 'Satisfaction client', 'Résiliation']],
  ['Autre', ['Ajout prospect', 'Note', 'Dépense']],
]
const MONEY = ['Proposition envoyée', 'Signature', 'Paiement reçu', 'Vente additionnelle', 'Dépense']
const MAIN_FICHE = ['secteur', 'ville', 'contact', 'telephone', 'instagram', 'site', 'source', 'pub_active', 'presence_google', 'taille']
const UPDATE_FICHE = ['offre', 'abonnement', 'budget_ok', 'decideur', 'besoin', 'delai']
const PROCHAINES = ['Rappeler', 'Relancer en DM', 'Envoyer le Loom', 'Faire l’audit', 'Préparer la démo', 'Envoyer la proposition', 'Relancer la proposition', 'Signature', 'Demander le paiement']

export function FicheInput({ f, value, onChange }) {
  const { settings } = useApp()
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

function ProspectPicker({ value, onPick, onNew }) {
  const { data } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const selected = value ? data.byId[value] : null
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = data.list.filter(
      (p) =>
        !s ||
        p.name.toLowerCase().includes(s) ||
        (p.fiche?.contact || '').toLowerCase().includes(s) ||
        (p.fiche?.telephone || '').replace(/\s/g, '').includes(s.replace(/\s/g, '')),
    )
    return list.sort((a, b) => (b.derniereAction || '').localeCompare(a.derniereAction || '')).slice(0, 8)
  }, [q, data])
  const exact = data.list.some((p) => p.name.toLowerCase() === q.trim().toLowerCase())
  const items = [...matches.map((p) => ({ p })), ...(q.trim() && !exact ? [{ nouveau: q.trim() }] : [])]

  if (selected)
    return (
      <div className="selected-prospect">
        <div className="li-main">
          <div className="li-title">{selected.name}</div>
          <div className="li-sub">
            {[selected.fiche?.contact, selected.fiche?.telephone, selected.fiche?.secteur].filter(Boolean).join(' · ') || 'Fiche vide'}
          </div>
        </div>
        <StageBadge etape={selected.etape} />
        <button type="button" className="btn sm" onClick={() => onPick(null)}>
          Changer
        </button>
      </div>
    )
  const choose = (it) => {
    if (!it) return
    if (it.p) onPick(it.p.id)
    else onNew(it.nouveau)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="combo">
      <input
        className="input"
        placeholder="Nom de l'entreprise, contact ou téléphone…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHl(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, items.length - 1))
          if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0))
          if (e.key === 'Enter') {
            e.preventDefault()
            choose(items[hl])
          }
        }}
      />
      {open && items.length > 0 && (
        <div className="combo-list">
          {items.map((it, i) =>
            it.p ? (
              <div key={it.p.id} className={`combo-item ${i === hl ? 'hl' : ''}`} onMouseDown={() => choose(it)}>
                <div className="li-main">
                  <div className="li-title">{it.p.name}</div>
                  <div className="li-sub">{[it.p.fiche?.contact, it.p.fiche?.telephone].filter(Boolean).join(' · ')}</div>
                </div>
                <StageBadge etape={it.p.etape} />
              </div>
            ) : (
              <div key="new" className={`combo-item new ${i === hl ? 'hl' : ''}`} onMouseDown={() => choose(it)}>
                ＋ Nouveau prospect : « {it.nouveau} »
              </div>
            ),
          )}
        </div>
      )}
    </div>
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
  const { settings, data, api, toast } = useApp()
  const editing = prefill.edit
  const init = editing
    ? Object.fromEntries(Object.entries(blank(editing)).map(([k, v]) => [k, v === null || v === undefined ? '' : v]))
    : blank({ canal: prefill.canal || '', action: prefill.action || '' })
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
  const L = data.L
  const actDef = L.act[f.action]
  const prospection = !!actDef?.prospection
  const p = pid ? data.byId[pid] : null
  const known = new Set(GROUPS.flatMap((g) => g[1]))
  const groups = [
    ...GROUPS.map(([g, list]) => [g, list.filter((a) => L.act[a])]),
    ['Personnalisé', settings.actions.map((a) => a.nom).filter((a) => !known.has(a))],
  ].filter((g) => g[1].length)

  const showResult = prospection || f.action === 'Loom envoyé' || !!f.resultat
  const showMoney = MONEY.includes(f.action) || f.montant !== ''
  const autoPrice = p || newName ? montantRetenu({ action: f.action, remise: f.remise }, { fiche: { ...(p?.fiche || newFiche), ...ficheUpd } }, L) : 0
  const showObjection = f.resultat === 'Pas intéressé' || f.action === 'Perdu' || !!f.objection
  const showModele = prospection && f.canal !== 'Appel'
  const showNote = f.action === 'Audit réalisé' || f.action === 'Satisfaction client' || f.note !== ''
  const showFacture = ['Paiement reçu', 'Signature', 'Vente additionnelle'].includes(f.action) || f.facture !== ''
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
        if (dupPhone && !window.confirm(`Ce numéro est déjà utilisé par « ${dupPhone.name} ». Créer quand même ?`)) {
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

  return (
    <div className="card" ref={topRef}>
      <div className="form-block">
        <div className="form-label">Prospect</div>
        {newName ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="selected-prospect">
              <div className="li-main">
                <div className="li-title">＋ {newName}</div>
                <div className="li-sub">Nouveau prospect : remplis sa fiche</div>
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
            <button type="button" className="toggle-link" onClick={() => setMoreFiche(!moreFiche)}>
              {moreFiche ? '− Moins de champs' : '+ Tous les champs (pub, Google, qualification, offre…)'}
            </button>
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
      </div>

      <div className="form-block">
        <div className="form-grid tight">
          <Field label="Date">
            <input type="date" value={f.date} onChange={setE('date')} />
          </Field>
          <Field label="Heure">
            <input type="time" value={f.time} onChange={setE('time')} />
          </Field>
        </div>
      </div>

      <div className="form-block">
        <div className="form-label">Canal</div>
        <Chips options={settings.canaux} value={f.canal} onChange={set('canal')} />
      </div>

      <div className="form-block">
        <div className="form-label">Action</div>
        <div className="stack" style={{ gap: 10 }}>
          {groups.map(([g, list]) => (
            <div key={g}>
              <div className="tiny muted" style={{ marginBottom: 5 }}>
                {g}
              </div>
              <Chips options={list} value={f.action} onChange={set('action')} small={g !== 'Prospection'} />
            </div>
          ))}
        </div>
      </div>

      {showResult && (
        <div className="form-block">
          <div className="form-label">Résultat</div>
          <Chips options={settings.resultats.map((r) => r.nom)} value={f.resultat} onChange={set('resultat')} />
        </div>
      )}

      {(showMoney || showObjection || showModele || showNote || showFacture) && (
        <div className="form-block">
          <div className="form-grid">
            {showMoney && (
              <Field label="Montant (€)">
                <input
                  inputMode="decimal"
                  value={f.montant}
                  onChange={setE('montant')}
                  placeholder={autoPrice ? `Auto : ${eur(autoPrice)}` : ''}
                />
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
        </div>
      )}

      {needsProspect && f.action !== 'Signature' && f.action !== 'Perdu' && (
        <div className="form-block">
          <div className="form-label">Suite</div>
          <div className="form-grid">
            <Field label="Prochaine action">
              <input list="prochaines" value={f.prochaine_action} onChange={setE('prochaine_action')} />
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
          <div className="row" style={{ marginTop: 8 }}>
            {[
              ['Demain', 1],
              ['J+2', 2],
              ['J+5', 5],
              ['J+10', 10],
              ['1 mois', 30],
            ].map(([l, d]) => (
              <button key={l} type="button" className="chip sm" onClick={() => set('date_relance')(addDays(f.date || today(), d))}>
                {l}
              </button>
            ))}
            {!f.date_relance && relanceAuto() && <span className="tiny muted">Vide = relance auto le {fmtDate(relanceAuto())}</span>}
          </div>
        </div>
      )}

      <div className="form-block">
        {!more ? (
          <button type="button" className="toggle-link" onClick={() => setMore(true)}>
            + Notes, durée{!showObjection ? ', objection' : ''}
            {!showModele ? ', modèle' : ''}
          </button>
        ) : (
          <div className="form-grid">
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
      </div>

      {p && !editing && (
        <div className="form-block">
          {!showUpd ? (
            <button type="button" className="toggle-link" onClick={() => setShowUpd(true)}>
              + Mettre à jour la fiche (offre, qualification…)
            </button>
          ) : (
            <div className="form-grid">
              {FICHE_FIELDS.filter((x) => UPDATE_FICHE.includes(x.key)).map((x) => (
                <Field key={x.key} label={x.label}>
                  <FicheInput
                    f={x}
                    value={ficheUpd[x.key] ?? p.fiche?.[x.key]}
                    onChange={(v) => setFicheUpd((s) => ({ ...s, [x.key]: v }))}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-block row">
        <button className="btn gold" style={{ flex: 1, padding: '12px' }} disabled={busy} onClick={() => save(false)}>
          {editing ? 'Enregistrer les modifications' : 'Enregistrer'}
        </button>
        {!editing && !onDone && (
          <button className="btn" disabled={busy} onClick={() => save(true)} title="Enregistrer et saisir une autre action pour ce prospect">
            + Autre action
          </button>
        )}
      </div>
    </div>
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
              style={{ color: 'var(--navy)' }}
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
        </div>
      </div>
      <div className="li-side">
        <button className="icon-btn" title="Modifier" onClick={() => onEdit(a)}>
          ✎
        </button>
        <button
          className="icon-btn"
          title="Supprimer"
          onClick={() => window.confirm('Supprimer cette action ?') && api.deleteAction(a.id)}
        >
          <Icon n="trash" size={15} />
        </button>
      </div>
    </div>
  )
}

export default function Saisie({ prospectId }) {
  const { data, actions } = useApp()
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
    <div>
      <div className="page-head">
        <div>
          <h1>Saisir une action</h1>
          <div className="sub">Appel, DM, relance, audit, RDV, proposition, signature, paiement… une ligne par action.</div>
        </div>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <ActionForm prefill={{ prospect_id: prospectId }} />
        <div className="card">
          <h2 className="section">Dernières saisies</h2>
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
              {actions.length} actions · {data.list.length} prospects
            </div>
          )}
        </div>
      </div>
      {edit && (
        <Modal title="Modifier l'action" onClose={() => setEdit(null)}>
          <ActionForm prefill={{ edit }} onDone={() => setEdit(null)} />
        </Modal>
      )}
    </div>
  )
}
