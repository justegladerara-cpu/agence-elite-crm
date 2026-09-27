import { useState } from 'react'
import { Icon } from '../icons'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Field, Modal } from '../ui'
import { FicheInput, ActionForm, ActionLine } from './Saisie'
import { FICHE_FIELDS } from '../lib/defaults'
import { fmtDate } from '../lib/dates'
import { siteLink, instaLink } from '../lib/logic'
import { statutDe, totals, STATUT_TONE } from '../lib/invoice'

export default function Fiche({ id }) {
  const { data, api, openAction, toast } = useApp()
  const p = data.byId[id]
  const [editing, setEditing] = useState(false)
  const [fiche, setFiche] = useState(null)
  const [name, setName] = useState('')
  const [editAction, setEditAction] = useState(null)
  if (!p)
    return (
      <div className="card">
        <Empty>Prospect introuvable.</Empty>
        <button className="btn" onClick={() => go('/prospects')}>
          ← Retour aux prospects
        </button>
      </div>
    )
  const f = p.fiche || {}
  const client = data.clients.find((c) => c.id === p.id)

  const startEdit = () => {
    setFiche({ ...f })
    setName(p.name)
    setEditing(true)
  }
  const saveFiche = async () => {
    const n = name.trim()
    if (!n) return toast('Nom manquant', true)
    if (n.toLowerCase() !== p.name.toLowerCase() && data.list.some((x) => x.name.toLowerCase() === n.toLowerCase()))
      return toast('Un autre prospect porte déjà ce nom', true)
    await api.updateProspect(p.id, { name: n, fiche })
    setEditing(false)
    toast('Fiche enregistrée ✓')
  }
  const remove = async () => {
    if (!window.confirm(`Supprimer « ${p.name} » et tout son historique (${p.acts.length} actions) ?`)) return
    await api.deleteProspect(p.id)
    toast('Prospect supprimé')
    go('/prospects')
  }

  const infos = [
    ['Étape', <StageBadge key="e" etape={p.etape} />],
    ['Score priorité', <Score key="s" v={p.score} />],
    ['Prochaine relance', p.relance ? <RelanceTag key="r" date={p.relance} heure={p.heureRappel} /> : '—'],
    ['Prochaine action', p.prochaineAction || '—'],
    ['Canal principal', p.canal || '—'],
    ['Tentatives / réponses', `${p.tentatives} / ${p.reponses}`],
    ['Ajouté le', fmtDate(p.dateAjout)],
    ['Jours sans action', p.joursSansAction ?? '—'],
    ['Qualification', `${p.qualif}/4`],
    ['Montant proposé', p.montantPropose ? eur(p.montantPropose) : '—'],
    ['Expiration proposition', p.expiration ? fmtDate(p.expiration) : '—'],
    ['Pipeline pondéré', p.pipelinePondere ? eur(p.pipelinePondere) : '—'],
    ['Date de signature', p.dateSignature ? fmtDate(p.dateSignature) : '—'],
    ['Cycle de vente', p.cycle !== null ? `${p.cycle} j` : '—'],
    ['Dernière objection', p.objection || '—'],
    ['Temps passé', p.tempsPasse ? `${p.tempsPasse} min` : '—'],
    ...(p.recontacter ? [['À recontacter le', fmtDate(p.recontacter)]] : []),
    ...(p.demo ? [['Démo type du secteur', <a key="d" href={siteLink(p.demo)} target="_blank" rel="noreferrer">Ouvrir</a>]] : []),
  ]
  const history = [...p.acts].reverse()

  return (
    <div className="stack">
      <div>
        <button className="btn ghost sm" onClick={() => (window.history.length > 1 ? window.history.back() : go("/prospects"))}>
          ← Retour
        </button>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="li-main">
            <h1 style={{ margin: 0, color: 'var(--navy)', fontSize: 24 }}>{p.name}</h1>
            <div className="muted" style={{ marginTop: 4 }}>
              {[f.contact && `${f.contact}${f.fonction ? ` (${f.fonction})` : ''}`, f.secteur, f.ville, f.telephone].filter(Boolean).join(' · ')}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <StageBadge etape={p.etape} />
              <Score v={p.score} />
              {p.alerte && <span className="badge b-orange">{p.alerte}</span>}
              {client && <span className="badge b-green">Client {client.statut.toLowerCase()}</span>}
            </div>
          </div>
          <div className="row">
            <ContactButtons p={p} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn gold" onClick={() => openAction({ prospect_id: p.id, canal: p.canal })}>
            + Saisir une action
          </button>
          <button className="btn" onClick={() => go(`/facture/new?type=facture&p=${p.id}`)}>
            + Facture
          </button>
          <button className="btn" onClick={() => go(`/facture/new?type=devis&p=${p.id}`)}>
            + Devis
          </button>
          <button className="btn" onClick={startEdit}>
            ✎ Modifier la fiche
          </button>
          <div className="spacer" />
          <button className="btn danger sm" onClick={remove}>
            Supprimer
          </button>
        </div>
      </div>

      <DocsCard pid={p.id} />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <h2 className="section">Suivi</h2>
            <div className="info-grid">
              {infos.map(([k, v]) => (
                <div key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>
          </div>
          {client && (
            <div className="card">
              <h2 className="section">Client</h2>
              <div className="info-grid">
                {[
                  ['Total signé', eur(client.total)],
                  ['Encaissé', eur(client.encaisse)],
                  ['Reste à encaisser', eur(client.reste)],
                  ['Paiement', client.statutPaiement || '—'],
                  ['Abonnement', client.abonnement ? `${eur(client.abonnement)}/mois` : '—'],
                  ['Renouvellement', client.renouvellement ? fmtDate(client.renouvellement) : '—'],
                  ['Onboarding', `${Math.round(client.onboarding * 100)} %`],
                  ['Valeur vie client', eur(client.valeurVie)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="k">{k}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <AuditCard p={p} />
          <div className="card">
            <h2 className="section">Fiche</h2>
            <div className="info-grid">
              {FICHE_FIELDS.map((x) => {
                let v = f[x.key]
                if (!v && v !== 0) v = '—'
                else if (x.key === 'instagram') v = <a href={instaLink(v)} target="_blank" rel="noreferrer">{v}</a>
                else if (x.key === 'site') v = <a href={siteLink(v)} target="_blank" rel="noreferrer">{v}</a>
                else if (x.type === 'date') v = fmtDate(v)
                return (
                  <div key={x.key}>
                    <div className="k">{x.label}</div>
                    <div className="v">{v}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="card">
          <h2 className="section">
            Historique <span className="count">{p.acts.length}</span>
          </h2>
          <div className="list">
            {history.length === 0 && <Empty>Aucune action.</Empty>}
            {history.map((a) => (
              <ActionLine key={a.id} a={a} showProspect={false} onEdit={setEditAction} />
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <Modal title="Modifier la fiche" onClose={() => setEditing(false)}>
          <div className="card">
            <Field label="Entreprise">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="form-grid" style={{ marginTop: 12 }}>
              {FICHE_FIELDS.map((x) => (
                <Field key={x.key} label={x.label}>
                  <FicheInput f={x} value={fiche[x.key]} onChange={(v) => setFiche((s) => ({ ...s, [x.key]: v }))} />
                </Field>
              ))}
            </div>
            <button className="btn gold block" style={{ marginTop: 16 }} onClick={saveFiche}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
      {editAction && (
        <Modal title="Modifier l'action" onClose={() => setEditAction(null)}>
          <ActionForm prefill={{ edit: editAction }} onDone={() => setEditAction(null)} />
        </Modal>
      )}
    </div>
  )
}

const AUDIT = [
  ['site', 'Site internet (rapide, mobile, réservation / contact)'],
  ['google', 'Fiche Google (complète, photos, horaires)'],
  ['avis', 'Avis Google (note, nombre, réponses)'],
  ['instagram', 'Instagram (bio, lien, régularité)'],
  ['pubs', 'Publicités (où atterrit la pub, offre claire)'],
]
function AuditCard({ p }) {
  const { api } = useApp()
  const audit = p.fiche?.audit || {}
  const done = AUDIT.filter(([k]) => audit[k]).length
  const set = (patch) => api.updateProspect(p.id, { fiche: { ...p.fiche, audit: { ...audit, ...patch } } })
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="search" size={16} /></span> Checklist d'audit <span className="count">{done}/{AUDIT.length}</span>
      </h2>
      <div className="stack" style={{ gap: 8 }}>
        {AUDIT.map(([k, label]) => (
          <label key={k} className="row small" style={{ flexWrap: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!audit[k]} onChange={(e) => set({ [k]: e.target.checked })} style={{ width: 18, height: 18 }} />
            {label}
          </label>
        ))}
        <textarea
          className="input"
          placeholder="Constats de l'audit (points faibles à montrer dans le Loom)…"
          defaultValue={audit.notes || ''}
          onBlur={(e) => e.target.value !== (audit.notes || '') && set({ notes: e.target.value })}
          style={{ minHeight: 60 }}
        />
        <div className="tiny muted">Une fois l'audit fini, saisis l'action « Audit réalisé » avec sa note sur 100 et le temps passé.</div>
      </div>
    </div>
  )
}

function DocsCard({ pid }) {
  const { documents, actions } = useApp()
  const docs = documents.filter((d) => d.prospect_id === pid).sort((a, b) => (b.data?.date || '').localeCompare(a.data?.date || ''))
  if (!docs.length) return null
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="file" size={16} /></span> Factures et devis <span className="count">{docs.length}</span>
      </h2>
      <div className="list">
        {docs.map((d) => {
          const st = statutDe(d, actions)
          return (
            <div key={d.id} className="list-item click" onClick={() => go(`/facture/${d.id}`)}>
              <div className="li-main">
                <div className="li-title">{d.type === 'facture' ? 'Facture' : 'Devis'} {d.numero}</div>
                <div className="li-sub">
                  {fmtDate(d.data?.date)}
                  {d.data?.objet ? ` · ${d.data.objet}` : ''}
                </div>
              </div>
              <div className="li-side" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <b>{eur(totals(d.data || {}).total)}</b>
                <span className={`badge ${STATUT_TONE[st] || 'b-gold'}`}>{st}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
