import { useState } from 'react'
import { Icon } from '../icons'
import { lbl, useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Field, Modal, Tabs, useTab } from '../ui'
import { FicheInput, ActionForm, ActionLine } from './Saisie'
import { ProcessCard, ScriptsCard, QualifCard } from './Insta'
import { FICHE_FIELDS } from '../lib/defaults'
import { fmtDate } from '../lib/dates'
import { siteLink, instaLink } from '../lib/logic'
import { statutDe, totals, STATUT_TONE } from '../lib/invoice'

export default function Fiche({ id }) {
  const { data, api, openAction, toast, documents } = useApp()
  const p = data.byId[id]
  const [editing, setEditing] = useState(false)
  const [fiche, setFiche] = useState(null)
  const [name, setName] = useState('')
  const [editAction, setEditAction] = useState(null)
  const [tousChamps, setTousChamps] = useState(false)
  const [onglet, setOnglet] = useTab('fiche', 'apercu')
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

  const docs = documents.filter((d) => d.prospect_id === p.id)
  const ONGLETS = [
    ['apercu', 'Aperçu'],
    ['historique', 'Historique', p.acts.length],
    ...(client ? [] : [['scripts', 'Scripts et qualification']]),
    ['docs', 'Devis et factures', docs.length],
    ['fiche', 'Fiche'],
  ]
  const tab = ONGLETS.some(([k]) => k === onglet) ? onglet : 'apercu'

  return (
    <div className="stack fiche">
      <div className="fiche-head">
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <button className="icon-btn back-btn" title="Retour" onClick={() => go(client ? '/clients' : '/prospects')}>
            ←
          </button>
          <div className="li-main">
            <h1>{p.name}</h1>
            <div className="muted small ell-2">
              {[f.contact && `${f.contact}${f.fonction ? ` (${f.fonction})` : ''}`, f.instagram, f.secteur, f.produit, f.ville, f.telephone].filter(Boolean).join(' · ')}
            </div>
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <StageBadge etape={p.etape} />
              <Score v={p.score} />
              {p.alerte && <span className="badge b-orange">{p.alerte}</span>}
              {client && <span className="badge b-green">Client {client.statut.toLowerCase()}</span>}
              {f.signal && <span className="badge b-gold">{f.signal}</span>}
            </div>
          </div>
          <div className="row hide-m">
            <ContactButtons p={p} />
          </div>
        </div>
        <div className="row fiche-actions">
          <button className="btn gold sm" onClick={() => openAction({ prospect_id: p.id, canal: p.canal })}>
            + Saisir une action
          </button>
          <button className="btn sm" onClick={() => go(`/facture/new?type=devis&p=${p.id}`)}>
            + Devis
          </button>
          <button className="btn sm" onClick={() => go(`/facture/new?type=facture&p=${p.id}`)}>
            + Facture
          </button>
          <button className="btn sm" onClick={startEdit}>
            <Icon n="edit" size={14} /> Modifier
          </button>
          <div className="show-m">
            <ContactButtons p={p} />
          </div>
          <div className="spacer" />
          <button className="btn ghost danger sm" onClick={remove}>
            <Icon n="trash" size={14} /> Supprimer
          </button>
        </div>
        <Tabs items={ONGLETS} value={tab} onChange={setOnglet} />
      </div>

      {tab === 'apercu' && (
        <>
          {!client && <ProcessCard p={p} />}
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
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
            <div className="stack">
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
              <div className="card">
                <h2 className="section">
                  Dernières actions
                  <button className="toggle-link" style={{ marginLeft: 'auto' }} onClick={() => setOnglet('historique')}>
                    Tout voir
                  </button>
                </h2>
                <div className="list">
                  {history.length === 0 && <Empty>Aucune action.</Empty>}
                  {history.slice(0, 4).map((a) => (
                    <ActionLine key={a.id} a={a} showProspect={false} onEdit={setEditAction} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'historique' && (
        <div className="card">
          <div className="list">
            {history.length === 0 && <Empty>Aucune action.</Empty>}
            {history.map((a) => (
              <ActionLine key={a.id} a={a} showProspect={false} onEdit={setEditAction} />
            ))}
          </div>
        </div>
      )}

      {tab === 'scripts' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <ScriptsCard p={p} />
          <div className="stack">
            <QualifCard p={p} />
            <AuditCard p={p} />
          </div>
        </div>
      )}

      {tab === 'docs' && <DocsCard pid={p.id} />}

      {tab === 'fiche' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 className="section" style={{ margin: 0 }}>Informations</h2>
            <button className="btn sm" onClick={startEdit}>
              <Icon n="edit" size={14} /> Modifier la fiche
            </button>
          </div>
          <div className="info-grid">
            {FICHE_FIELDS.filter((x) => tousChamps || f[x.key] || f[x.key] === 0).map((x) => {
              let v = f[x.key]
              if (!v && v !== 0) v = '—'
              else if (x.key === 'instagram') v = <a href={instaLink(v)} target="_blank" rel="noreferrer">{v}</a>
              else if (x.key === 'site') v = <a href={siteLink(v)} target="_blank" rel="noreferrer">{v}</a>
              else if (x.type === 'date') v = fmtDate(v)
              return (
                <div key={x.key}>
                  <div className="k">{lbl(x.label)}</div>
                  <div className="v">{v}</div>
                </div>
              )
            })}
          </div>
          {FICHE_FIELDS.some((x) => !f[x.key] && f[x.key] !== 0) && (
            <button className="toggle-link" style={{ marginTop: 10 }} onClick={() => setTousChamps((v) => !v)}>
              {tousChamps ? 'Masquer les champs vides' : `Afficher les champs vides (${FICHE_FIELDS.filter((x) => !f[x.key] && f[x.key] !== 0).length})`}
            </button>
          )}
          {client && (
            <div style={{ marginTop: 16 }}>
              <AuditCard p={p} />
            </div>
          )}
        </div>
      )}

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
  const set = (patch) => api.updateProspect(p.id, { fiche: { ...p.fiche, audit: { ...audit, ...patch } } }).catch(() => {})
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
  return (
    <div className="card">
      <div className="list">
        {docs.length === 0 && <Empty>Aucun devis ni facture pour ce contact. Utilise « + Devis » ou « + Facture » en haut.</Empty>}
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
