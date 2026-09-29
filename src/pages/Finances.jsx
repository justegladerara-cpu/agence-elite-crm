// Paiements reçus et dépenses (onglets du menu Factures)
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, Modal, Bar, eur, nb, lbl, LienProspect, LienDoc } from '../ui'
import { REF_PAIEMENT } from '../lib/tresorerie'
import { ProspectPicker } from './Saisie'
import { totals, paiementsDe, num } from '../lib/invoice'
import { today, fmtDate, monthKey, prevMonth } from '../lib/dates'


// ---------- Période ----------
const PERIODES = [
  ['mois', 'Ce mois-ci'],
  ['prec', 'Mois dernier'],
  ['annee', 'Cette année'],
  ['tout', 'Tout'],
]
function inPeriode(date, p) {
  const m = monthKey(today())
  if (p === 'mois') return monthKey(date) === m
  if (p === 'prec') return monthKey(date) === prevMonth(m)
  if (p === 'annee') return (date || '').slice(0, 4) === m.slice(0, 4)
  return true
}
function PeriodeTabs({ value, onChange }) {
  return (
    <select className="input" aria-label="Période" style={{ width: 'auto' }} value={value} onChange={(e) => onChange(e.target.value)}>
      {PERIODES.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  )
}

// ---------- Photo du reçu ----------
// Réduit la photo (1400 px, JPEG) pour qu'elle reste légère, même hors ligne
async function preparerFichier(file) {
  const read = (f) =>
    new Promise((ok, ko) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = ko
      r.readAsDataURL(f)
    })
  if (file.type === 'application/pdf') {
    if (file.size > 4 * 1024 * 1024) throw new Error('PDF trop lourd (4 Mo maximum)')
    return { dataUrl: await read(file), ext: 'pdf', type: 'application/pdf' }
  }
  const src = await read(file)
  const img = await new Promise((ok, ko) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ko(new Error('Format de photo non reconnu'))
    i.src = src
  })
  const k = Math.min(1, 1400 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return { dataUrl: c.toDataURL('image/jpeg', 0.72), ext: 'jpg', type: 'image/jpeg' }
}

export function RecuLien({ path, children }) {
  const { api, toast } = useApp()
  const open = async (e) => {
    e.stopPropagation()
    try {
      const url = await api.recuUrl(path)
      if (!url) return toast('Reçu introuvable sur cet appareil', true)
      if (url.startsWith('data:')) {
        const w = window.open('', '_blank')
        if (w) w.document.write(url.startsWith('data:application/pdf') ? `<iframe src="${url}" style="border:0;width:100%;height:100vh"></iframe>` : `<img src="${url}" style="max-width:100%">`)
      } else window.open(url, '_blank')
    } catch (err) {
      toast(`Reçu indisponible : ${err.message}`, true)
    }
  }
  return (
    <button type="button" className="btn ghost sm" onClick={open}>
      {children || (
        <>
          <Icon n="eye" size={14} /> Voir le reçu
        </>
      )}
    </button>
  )
}

function RecuField({ value, onChange }) {
  const { api, toast } = useApp()
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  useEffect(() => {
    let ok = true
    Promise.resolve(value ? api.recuUrl(value) : '')
      .then((u) => ok && setPreview(u || ''))
      .catch(() => {})
    return () => {
      ok = false
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const { dataUrl, ext, type } = await preparerFichier(f)
      const path = await api.uploadRecu(dataUrl, ext, type)
      setPreview(dataUrl)
      onChange(path)
    } catch (err) {
      toast(err.message, true)
    }
    setBusy(false)
  }
  const isPdf = value && value.endsWith('.pdf')
  return (
    <div className="recu-field">
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      {value ? (
        <div className="row" style={{ gap: 10 }}>
          {preview && !isPdf ? <img src={preview} alt="Reçu" className="recu-thumb" /> : <div className="recu-thumb pdf">PDF</div>}
          <div className="stack" style={{ gap: 6 }}>
            <RecuLien path={value} />
            <button type="button" className="btn ghost sm danger" onClick={() => onChange('')}>
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" disabled={busy} onClick={() => ref.current.click()}>
          <Icon n="upload" size={15} /> {busy ? 'Préparation…' : 'Photo ou PDF du reçu'}
        </button>
      )}
    </div>
  )
}

// ---------- Formulaire : paiement reçu ----------
export function PaiementForm({ prefill = {}, edit, onDone }) {
  const { documents, actions, settings, api, toast } = useApp()
  const [f, setF] = useState(() =>
    edit
      ? { ...edit, montant: edit.montant ?? '', mode: edit.mode || '', reference: edit.reference || '', facture: edit.facture || '', notes: edit.notes || '' }
      : { prospect_id: null, date: today(), montant: '', mode: settings.modesPaiement?.[0] || '', reference: '', facture: '', notes: '', ...prefill },
  )
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  // Factures du client pas encore soldées
  const ouvertes = useMemo(
    () =>
      documents
        .filter((d) => d.type === 'facture' && !d.data?.annulee && (!f.prospect_id || d.prospect_id === f.prospect_id))
        .map((d) => {
          const total = totals(d.data || {}).total
          const paye = paiementsDe(d, actions)
            .filter((a) => a.id !== edit?.id)
            .reduce((m, a) => m + num(a.montant), 0)
          return { d, reste: Math.max(0, total - paye) }
        })
        .filter((x) => x.reste > 0 || x.d.numero === f.facture)
        .sort((a, b) => (b.d.data?.date || '').localeCompare(a.d.data?.date || '')),
    [documents, actions, f.prospect_id, f.facture, edit],
  )
  const choisirFacture = (numero) => {
    const x = ouvertes.find((o) => o.d.numero === numero)
    set({ facture: numero, ...(x && !f.prospect_id ? { prospect_id: x.d.prospect_id } : {}), ...(x && !num(f.montant) ? { montant: String(x.reste) } : {}) })
  }
  const save = async () => {
    if (!num(f.montant)) return toast('Indique le montant reçu', true)
    setBusy(true)
    try {
      const row = { prospect_id: f.prospect_id || null, date: f.date || today(), canal: 'Autre', action: 'Paiement reçu', montant: f.montant, mode: f.mode, reference: f.reference, facture: f.facture, notes: f.notes }
      if (edit) {
        await api.updateAction(edit.id, { ...edit, ...row })
        toast('Paiement enregistré ✓')
        return onDone()
      }
      const rows = await api.addActions([row])
      toast('Paiement enregistré ✓')
      // Étape suivante : noter tout de suite les frais de ce travail (taxi, pièces…) pour connaître le vrai gain
      if (rows?.[0]?.id) setFait(rows[0])
      else onDone()
    } catch {
      setBusy(false)
    }
  }
  const [fait, setFait] = useState(null)
  const [frais, setFrais] = useState(false)
  if (fait && frais)
    return (
      <DepenseForm
        prefill={{ prospect_id: fait.prospect_id, date: fait.date, reference: `${REF_PAIEMENT}${fait.id}`, categorie: (settings.categoriesDepenses || []).includes('Transport') ? 'Transport' : '', notes: fait.notes ? `Frais : ${fait.notes}`.slice(0, 120) : '' }}
        lie={fait}
        onDone={onDone}
      />
    )
  if (fait)
    return (
      <div className="stack frais-etape" style={{ gap: 12 }}>
        <div className="frais-ok">
          <Icon n="check" size={16} /> <b>+ {eur(fait.montant)}</b> encaissés le {fmtDate(fait.date)}
        </div>
        <p className="small" style={{ margin: 0 }}>
          As-tu eu des frais pour ce travail (taxi, carburant, pièces) ? Note-les maintenant : le tableau de bord affichera ce qu'il te reste vraiment.
        </p>
        <div className="row">
          <button type="button" className="btn gold" onClick={() => setFrais(true)}>
            <Icon n="plus" size={14} /> Ajouter des frais
          </button>
          <button type="button" className="btn" onClick={onDone}>
            Non, terminé
          </button>
        </div>
      </div>
    )
  const remove = async () => {
    await api.deleteAction(edit.id)
    onDone()
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* Le montant d'abord : c'est la seule information obligatoire */}
      <div className="form-grid tight">
        <Field label={lbl('Montant reçu (€)')}>
          <input inputMode="decimal" placeholder="Ex. 34 000" autoFocus={!edit} value={f.montant} onChange={(e) => set({ montant: e.target.value })} />
        </Field>
        <Field label="Mode de paiement">
          <select value={f.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="">—</option>
            {(settings.modesPaiement || []).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Client (facultatif)">
        <ProspectPicker value={f.prospect_id} onPick={(id) => set({ prospect_id: id, facture: '' })} />
      </Field>
      <Field label="Notes">
        <input placeholder="Pour quel travail ? Ex. dépannage du soir" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <Field label="Facture concernée">
        <select value={f.facture} onChange={(e) => choisirFacture(e.target.value)}>
          <option value="">Sans facture</option>
          {ouvertes.map(({ d, reste }) => (
            <option key={d.id} value={d.numero}>
              {d.numero} · {d.data?.client?.nom || ''} · reste {eur(reste)}
            </option>
          ))}
          {f.facture && !ouvertes.some((o) => o.d.numero === f.facture) && <option value={f.facture}>{f.facture}</option>}
        </select>
      </Field>
      <div className="form-grid tight">
        <Field label="Date">
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Référence">
          <input placeholder="N° de transaction, chèque…" value={f.reference} onChange={(e) => set({ reference: e.target.value })} />
        </Field>
      </div>
      <div className="row">
        <button className="btn gold" disabled={busy} onClick={save}>
          {busy ? 'Enregistrement…' : 'Enregistrer le paiement'}
        </button>
        <span className="spacer" />
        {edit && (
          <button className="btn ghost sm danger" onClick={remove}>
            <Icon n="trash" size={14} /> Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Formulaire : dépense ----------
export function DepenseForm({ prefill = {}, edit, lie, onDone }) {
  const { settings, api, toast, actions } = useApp()
  const cats = settings.categoriesDepenses || []
  const [f, setF] = useState(() =>
    edit
      ? { ...edit, montant: edit.montant ?? '', categorie: edit.categorie || '', fournisseur: edit.fournisseur || '', mode: edit.mode || '', notes: edit.notes || '', recu: edit.recu || '', reference: edit.reference || '' }
      : { prospect_id: null, date: today(), montant: '', categorie: '', fournisseur: '', mode: settings.modesPaiement?.[0] || '', notes: '', recu: '', reference: '', ...prefill },
  )
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const save = async () => {
    if (!num(f.montant)) return toast('Indique le montant', true)
    setBusy(true)
    try {
      const row = { prospect_id: f.prospect_id || null, date: f.date || today(), canal: 'Autre', action: 'Dépense', montant: f.montant, categorie: f.categorie, fournisseur: f.fournisseur, mode: f.mode, notes: f.notes, recu: f.recu, reference: f.reference || '' }
      if (edit) await api.updateAction(edit.id, { ...edit, ...row })
      else await api.addActions([row])
      toast('Dépense enregistrée ✓')
      onDone()
    } catch {
      setBusy(false)
    }
  }
  const remove = async () => {
    await api.deleteAction(edit.id)
    onDone()
  }
  // Paiement auquel ces frais sont rattachés (ex. le taxi d'un dépannage)
  const idLie = String(f.reference || '').startsWith(REF_PAIEMENT) ? f.reference.slice(REF_PAIEMENT.length) : null
  const paiement = lie || (idLie && actions.find((a) => a.id === idLie))
  return (
    <div className="stack" style={{ gap: 14 }}>
      {paiement && (
        <div className="lien-paiement small">
          <Icon n="coins" size={14} />
          <span>
            Frais du paiement de <b>{eur(paiement.montant)}</b> du {fmtDate(paiement.date)}
            {num(f.montant) > 0 && (
              <>
                {' '}· il te reste <b className="green">{eur(num(paiement.montant) - num(f.montant))}</b>
              </>
            )}
          </span>
          {!lie && (
            <button type="button" className="toggle-link tiny" onClick={() => set({ reference: '' })}>
              Détacher
            </button>
          )}
        </div>
      )}
      <div className="form-grid tight">
        <Field label={lbl('Montant (€)')}>
          <input inputMode="decimal" placeholder="Ex. 2 000" autoFocus={!edit} value={f.montant} onChange={(e) => set({ montant: e.target.value })} />
        </Field>
        <Field label="Date">
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <select value={f.categorie} onChange={(e) => set({ categorie: e.target.value })}>
            <option value="">—</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {f.categorie && !cats.includes(f.categorie) && <option>{f.categorie}</option>}
          </select>
        </Field>
        <Field label="Payé par">
          <select value={f.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="">—</option>
            {(settings.modesPaiement || []).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Fournisseur">
        <input placeholder="Ex. Imprimerie, station-service, Canva…" value={f.fournisseur} onChange={(e) => set({ fournisseur: e.target.value })} />
      </Field>
      <Field label="Pour un client ? (facultatif)">
        <ProspectPicker value={f.prospect_id} onPick={(id) => set({ prospect_id: id })} />
      </Field>
      <Field label="Description">
        <input placeholder="Ex. Papier 350 g pour cartes de visite" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <Field label="Reçu">
        <RecuField value={f.recu} onChange={(recu) => set({ recu })} />
      </Field>
      <div className="row">
        <button className="btn gold" disabled={busy} onClick={save}>
          {busy ? 'Enregistrement…' : 'Enregistrer la dépense'}
        </button>
        <span className="spacer" />
        {edit && (
          <button className="btn ghost sm danger" onClick={remove}>
            <Icon n="trash" size={14} /> Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

// Répartition (par mode ou par catégorie)
function Repartition({ rows, empty }) {
  const tot = rows.reduce((m, [, v]) => m + v, 0)
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="row small repart-l">
            <span title={k}>{k}</span>
            <b>
              {eur(v)} <span className="muted">· {Math.round((v / tot) * 100)} %</span>
            </b>
          </div>
          <Bar value={v} max={tot} />
        </div>
      ))}
    </div>
  )
}
const grouper = (list, key, def) =>
  Object.entries(list.reduce((m, a) => ((m[a[key] || def] = (m[a[key] || def] || 0) + num(a.montant)), m), {})).sort((a, b) => b[1] - a[1])

// ---------- Onglet Paiements reçus ----------
export function PaiementsTab() {
  const { actions, data } = useApp()
  const [periode, setPeriode] = useState('mois')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const tous = useMemo(() => actions.filter((a) => a.action === 'Paiement reçu'), [actions])
  const liste = useMemo(() => {
    const s = q.trim().toLowerCase()
    return tous
      .filter((a) => inPeriode(a.date, periode))
      .filter((a) => !s || [data.byId[a.prospect_id]?.name, a.facture, a.reference, a.notes, a.mode].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [tous, periode, q, data])
  const total = liste.reduce((m, a) => m + num(a.montant), 0)
  const mois = tous.filter((a) => inPeriode(a.date, 'mois')).reduce((m, a) => m + num(a.montant), 0)
  const annee = tous.filter((a) => inPeriode(a.date, 'annee')).reduce((m, a) => m + num(a.montant), 0)

  return (
    <>
      <div className="grid grid-4">
        <Kpi label="Encaissé ce mois-ci" value={eur(mois)} navy />
        <Kpi label="Encaissé cette année" value={eur(annee)} navy />
        <Kpi label="Encaissé (période choisie)" value={eur(total)} />
        <Kpi label="Nombre de paiements" value={nb(liste.length)} />
      </div>
      <div className="grid fin-grid">
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Rechercher : client, facture, référence…" value={q} onChange={(e) => setQ(e.target.value)} />
            <PeriodeTabs value={periode} onChange={setPeriode} />
            <button className="btn gold" onClick={() => setModal({})}>
              + Paiement reçu
            </button>
          </div>
          <div className="list">
            {liste.length === 0 && <Empty>Aucun paiement sur cette période.</Empty>}
            {liste.map((a) => (
              <div key={a.id} className="list-item click" onClick={() => setModal({ edit: a })}>
                <div className="li-main">
                  <div className="li-title">{a.prospect_id ? <LienProspect id={a.prospect_id} /> : a.notes || 'Paiement sans client'}</div>
                  <div className="li-sub">
                    {[fmtDate(a.date), a.mode].filter(Boolean).join(' · ')}
                    {a.facture && (
                      <>
                        {' · Facture '}
                        <LienDoc numero={a.facture} />
                      </>
                    )}
                    {a.reference ? ` · Réf. ${a.reference}` : ''}
                  </div>
                </div>
                <div className="li-side">
                  <b className="green">+ {eur(a.montant)}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="wallet" size={16} /></span> Par mode de paiement
          </h2>
          <Repartition rows={grouper(liste, 'mode', 'Non précisé')} empty="Rien sur cette période." />
        </div>
      </div>
      {modal && (
        <Modal title={modal.edit ? 'Modifier le paiement' : 'Paiement reçu'} onClose={() => setModal(null)}>
          <PaiementForm edit={modal.edit} prefill={modal.prefill} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}

// ---------- Onglet Dépenses ----------
export function DepensesTab() {
  const { actions, data, settings } = useApp()
  const [periode, setPeriode] = useState('mois')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const toutes = useMemo(() => actions.filter((a) => a.action === 'Dépense'), [actions])
  const liste = useMemo(() => {
    const s = q.trim().toLowerCase()
    return toutes
      .filter((a) => inPeriode(a.date, periode))
      .filter((a) => !s || [a.categorie, a.fournisseur, a.notes, data.byId[a.prospect_id]?.name].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [toutes, periode, q, data])
  const total = liste.reduce((m, a) => m + num(a.montant), 0)
  const encaisse = actions.filter((a) => a.action === 'Paiement reçu' && inPeriode(a.date, periode)).reduce((m, a) => m + num(a.montant), 0)
  const fixes = (settings.depensesFixes || []).reduce((m, d) => m + num(d.montant), 0)

  return (
    <>
      <div className="grid grid-4">
        <Kpi label="Dépenses (période)" value={eur(total)} navy />
        <Kpi label="Encaissé (période)" value={eur(encaisse)} navy />
        <Kpi label="Bénéfice (encaissé − dépenses)" value={eur(encaisse - total)} />
        <Kpi label="Dépenses fixes / mois" value={eur(fixes)} />
      </div>
      <div className="grid fin-grid">
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Rechercher : catégorie, fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} />
            <PeriodeTabs value={periode} onChange={setPeriode} />
            <button className="btn gold" onClick={() => setModal({})}>
              + Dépense
            </button>
          </div>
          <div className="list">
            {liste.length === 0 && <Empty>Aucune dépense sur cette période.</Empty>}
            {liste.map((a) => (
              <div key={a.id} className="list-item click" onClick={() => setModal({ edit: a })}>
                <div className="li-main">
                  <div className="li-title">{a.notes || a.fournisseur || a.categorie || 'Dépense'}</div>
                  <div className="li-sub">
                    {[fmtDate(a.date), a.categorie, a.fournisseur, data.byId[a.prospect_id] && `Client : ${data.byId[a.prospect_id].name}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="li-side" style={{ gap: 6 }}>
                  {a.recu && <RecuLien path={a.recu}><Icon n="file" size={14} /></RecuLien>}
                  <b className="red">− {eur(a.montant)}</b>
                </div>
              </div>
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            Les dépenses fixes mensuelles (réglées dans Paramètres) s'ajoutent automatiquement au tableau de bord.
          </div>
        </div>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="chart" size={16} /></span> Par catégorie
          </h2>
          <Repartition rows={grouper(liste, 'categorie', 'Sans catégorie')} empty="Rien sur cette période." />
        </div>
      </div>
      {modal && (
        <Modal title={modal.edit ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={() => setModal(null)}>
          <DepenseForm edit={modal.edit} prefill={modal.prefill} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}

// ---------- Pages du menu Ventes / Achats ----------
export function Paiements() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Paiements reçus</h1>
          <div className="sub">Tout ce que tes clients t'ont réglé, par période et par mode de paiement.</div>
        </div>
      </div>
      <PaiementsTab />
    </div>
  )
}
export function Depenses() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dépenses</h1>
          <div className="sub">Tes achats et frais, avec les reçus, pour connaître ton vrai bénéfice.</div>
        </div>
      </div>
      <DepensesTab />
    </div>
  )
}
