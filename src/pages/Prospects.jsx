// Fiches partagées par le hub Clients : nouvelle fiche, liste réduite de la vue côte à côte, actions groupées
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { go, Modal, Menu, confirmer } from '../ui'
import { useApp, useNoyau, useDonnees } from '../core/contexte'
import FicheForm from './FicheForm'
import { QuickInsta } from './Insta'
import { Icon } from '../icons'
import { fmtDate, today, nowTime, addDays } from '../lib/dates'
import { doublonInsta } from '../lib/logic'
import { fichesHub, CATEGORIES } from '../modules/commercial/hub'
import { ligne, ligneRelance } from '../modules/commercial/insta'

export function NewProspect({ onClose }) {
  const { api, data, toast } = useApp()
  const [name, setName] = useState('')
  const [fiche, setFiche] = useState({})
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const n = name.trim()
    if (!n) return toast("Nom de l'entreprise manquant", true)
    if (data.list.some((p) => p.name.toLowerCase() === n.toLowerCase())) return toast('Ce prospect existe déjà', true)
    const d = doublonInsta(data.list, fiche.instagram)
    if (d) return toast(`Ce compte Instagram est déjà celui de « ${d.name} »`, true)
    setBusy(true)
    try {
      const p = await api.addProspect(n, fiche)
      await api.addActions([{ prospect_id: p.id, date: today(), time: nowTime(), action: 'Ajout prospect' }])
      toast('Prospect ajouté ✓')
      onClose()
      go(`/prospect/${p.id}`)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Modal title="Nouveau prospect" onClose={onClose}>
      <FicheForm name={name} setName={setName} fiche={fiche} setFiche={setFiche} />
      <div className="ff-foot">
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn gold" disabled={busy || !name.trim()} onClick={save}>
          Ajouter le prospect
        </button>
      </div>
    </Modal>
  )
}

// Liste réduite à gauche de la fiche (vue côte à côte, grand écran) : les fiches de la même catégorie du hub
export function MiniListe({ current }) {
  const { data } = useDonnees()
  const [q, setQ] = useState('')
  const [insta, setInsta] = useState(false)
  const fiches = useMemo(() => fichesHub(data), [data])
  const cat = fiches.find((x) => x.p.id === current)?.cat || 'potentiels'
  const def = CATEGORIES.find((c) => c.id === cat)
  const liste = useMemo(() => {
    const s = q.trim().toLowerCase()
    return fiches
      .filter((x) => x.cat === cat && (!s || x.p.name.toLowerCase().includes(s)))
      .map((x) => x.p)
      .sort((a, b) => (cat === 'potentiels' ? b.score - a.score : (b.derniereAction || '').localeCompare(a.derniereAction || '')))
  }, [fiches, cat, q])
  return (
    <aside className="mini-list">
      <div className="ml-head">
        <button className="ml-title" onClick={() => go(`/clients?onglet=${cat}`)}>
          {def.label}
          <span className="pt-count">{liste.length}</span>
        </button>
        {cat === 'potentiels' && (
          <button className="btn sm" title="Nouveau prospect Instagram" onClick={() => setInsta(true)}>
            <Icon n="plus" size={14} /> Nouveau
          </button>
        )}
      </div>
      <input className="input" placeholder="Rechercher…" aria-label="Rechercher dans la liste" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ml-items">
        {liste.map((p) => (
          <button key={p.id} className={`ml-item ${p.id === current ? 'on' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
            <span className="ml-name">{p.name}</span>
            <span className="ml-sub">
              <span className={`dot-e e-${p.etape.replace(/[^A-Za-zéèÉ]/g, '')}`} />
              {p.etape}
              {p.relance ? ` · ${fmtDate(p.relance)}` : ''}
            </span>
          </button>
        ))}
      </div>
      {insta && <QuickInsta onClose={() => setInsta(false)} />}
    </aside>
  )
}

// Action à saisir pour faire passer un prospect à une étape (glisser-déposer dans le pipeline)
export const ACTION_ETAPE = ['Ajout prospect', 'Premier contact', 'Qualification', 'Loom envoyé', 'RDV', 'Proposition envoyée', 'Signature', 'Perdu']

// Actions sur plusieurs prospects cochés dans la liste
export function ActionsGroupees({ choisis, etapes, vider }) {
  const { api, settings, toast } = useNoyau()
  const [busy, setBusy] = useState(false)
  const ouverts = choisis.filter((p) => p.etape !== 'Gagné' && p.etape !== 'Perdu')
  const lancer = async (fn, msg) => {
    setBusy(true)
    try {
      await fn()
      toast(msg)
      vider()
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  const relances = () => lancer(() => api.addActions(ouverts.map((p) => ligneRelance(p, settings).row)), `${ouverts.length} relance${ouverts.length > 1 ? 's' : ''} notée${ouverts.length > 1 ? 's' : ''} ✓`)
  const programmer = (j) =>
    lancer(
      () => api.addActions(ouverts.map((p) => ligne(p.id, { canal: p.canal || 'DM', action: 'Note', notes: 'Relance programmée', date_relance: addDays(today(), j) }))),
      `Relance programmée le ${fmtDate(addDays(today(), j))} pour ${ouverts.length} prospect${ouverts.length > 1 ? 's' : ''} ✓`,
    )
  const passer = async (cible) => {
    const i = etapes.indexOf(cible)
    const action = ACTION_ETAPE[i]
    // Seulement vers l'avant, sans toucher aux clients signés
    const ok = choisis.filter((p) => (cible === 'Perdu' ? p.niveau < 7 && p.etape !== 'Perdu' : p.etape !== 'Perdu' && i + 1 > p.niveau))
    if (!ok.length) return toast(`Aucun des prospects cochés ne peut passer à « ${cible} ».`, true)
    const texte = `Noter « ${action} » pour ${ok.length} prospect${ok.length > 1 ? 's' : ''} ?${ok.length < choisis.length ? ` (${choisis.length - ok.length} ignoré${choisis.length - ok.length > 1 ? 's' : ''} : déjà plus loin)` : ''}`
    if (!(await confirmer(texte, { ok: 'Noter' }))) return
    lancer(() => api.addActions(ok.map((p) => ligne(p.id, { canal: p.canal || 'DM', action }))), `${ok.length} prospect${ok.length > 1 ? 's' : ''} passé${ok.length > 1 ? 's' : ''} à « ${cible} » ✓`)
  }
  const exporter = () => {
    const cols = [['Entreprise', (p) => p.name], ['Contact', (p) => p.fiche?.contact], ['Téléphone', (p) => p.fiche?.telephone], ['Instagram', (p) => p.fiche?.instagram], ['Secteur', (p) => p.fiche?.secteur], ['Ville', (p) => p.fiche?.ville], ['Canal', (p) => p.canal], ['Étape', (p) => p.etape], ['Score', (p) => p.score], ['Relance', (p) => p.relance], ['Montant proposé', (p) => p.montantPropose]]
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.map(([h]) => esc(h)).join(';'), ...choisis.map((p) => cols.map(([, f]) => esc(f(p))).join(';'))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `prospects-${today()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast(`${choisis.length} prospect${choisis.length > 1 ? 's' : ''} exporté${choisis.length > 1 ? 's' : ''} ✓`)
  }
  const supprimer = async () => {
    const n = choisis.length
    if (!(await confirmer(`Leur historique part avec eux. Tu pourras les restaurer depuis Paramètres › Corbeille pendant 30 jours.`, { titre: `Supprimer ${n} prospect${n > 1 ? 's' : ''} ?`, ok: 'Supprimer', danger: true }))) return
    lancer(async () => {
      for (const p of choisis) await api.deleteProspect(p.id, { silencieux: true })
    }, `${n} prospect${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''} (restaurables dans la corbeille)`)
  }
  // Barre flottante en bas de l'écran (hors du tableau qui défile)
  return createPortal(
    <div className="bulk-bar" role="toolbar" aria-label="Actions sur la sélection">
      <span className="bulk-n">
        <Icon n="check" size={14} /> {choisis.length} sélectionné{choisis.length > 1 ? 's' : ''}
      </span>
      <button className="btn sm primary" disabled={busy || !ouverts.length} onClick={relances}>
        <Icon n="check" size={14} /> Relancés
      </button>
      <Menu
        label={<><Icon n="clock" size={14} /> Relance le…</>}
        className="btn sm"
        items={[
          ['Demain', () => programmer(1)],
          ['Dans 3 jours', () => programmer(3)],
          ['Dans 7 jours', () => programmer(7)],
          ['Dans 30 jours', () => programmer(30)],
        ].map(([l, f]) => ({ label: l, onClick: f, disabled: busy || !ouverts.length }))}
      />
      <Menu label={<><Icon n="layers" size={14} /> Passer à…</>} className="btn sm" items={etapes.filter((e) => e !== 'Nouveau' && e !== 'Gagné').map((e) => ({ label: e, onClick: () => passer(e), disabled: busy }))} />
      <button className="btn sm" onClick={exporter}>
        <Icon n="download" size={14} /> Exporter
      </button>
      <button className="btn sm danger" disabled={busy} onClick={supprimer}>
        <Icon n="trash" size={14} /> Supprimer
      </button>
      <button className="icon-btn" title="Tout désélectionner" aria-label="Tout désélectionner" onClick={vider}>
        <Icon n="x" size={15} />
      </button>
    </div>,
    document.body,
  )
}
