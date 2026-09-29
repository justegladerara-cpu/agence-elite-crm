import { useState } from 'react'
import { modalPour } from '../lib/tresorerie'
import { Icon } from '../icons'
import { lbl, StageBadge, Empty, go, eur, Modal, Tabs, useTab, Menu, KV, LienProspect } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { Score, ContactButtons } from '../modules/commercial/ui'
import { ActionForm, ActionLine } from './Saisie'
import FicheForm, { GROUPES_FICHE, TOUS_CHAMPS } from './FicheForm'
import { ProcessBar, ProchaineEtape, ScriptsCard, QualifCard } from './Insta'
import { ligne } from '../modules/commercial'
import { fmtDate } from '../lib/dates'
import { siteLink, instaLink, doublonInsta } from '../lib/logic'
import { categorie } from '../modules/commercial'
import { statutDe, totals, STATUT_TONE } from '../modules/facturation'

export default function Fiche({ id }) {
  const { data, documents } = useDonnees()
  const { api, openAction, toast, saisirArgent } = useNoyau()
  const p = data.byId[id]
  const [editing, setEditing] = useState(false)
  const [fiche, setFiche] = useState(null)
  const [name, setName] = useState('')
  const [editAction, setEditAction] = useState(null)
  // Paiement ou dépense : fenêtre dédiée ouverte par le noyau ; autre action : formulaire de la fiche
  const editer = (a) => (a.action === 'Paiement reçu' || a.action === 'Dépense' ? saisirArgent(modalPour(a)) : setEditAction(a))
  const [tousChamps, setTousChamps] = useState(false)
  const [onglet, setOnglet] = useTab('fiche', 'apercu')
  // Historique visible directement dans l'aperçu : c'est ce qu'on relit avant d'appeler
  const [nHisto, setNHisto] = useState(10)
  if (!p)
    return (
      <div className="card">
        <Empty>Cette fiche est introuvable : elle a peut-être été supprimée.</Empty>
        <button className="btn" onClick={() => go('/clients')}>
          <Icon n="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }} /> Retour aux clients
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
    const d = doublonInsta(data.list, fiche.instagram, p.id)
    if (d) return toast(`Ce compte Instagram est déjà celui de « ${d.name} »`, true)
    await api.updateProspect(p.id, { name: n, fiche })
    setEditing(false)
    toast('Fiche enregistrée ✓')
  }
  const remove = async () => {
    await api.deleteProspect(p.id)
    go('/acquisition')
  }

  const ig = f.instagram
  // Relations : qui l'a recommandé, qui il a recommandé, ses factures
  const memeNom = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
  const parrain = f.recommande_par && data.list.find((x) => x.id !== p.id && memeNom(x.name, f.recommande_par))
  const filleuls = data.list.filter((x) => x.id !== p.id && memeNom(x.fiche?.recommande_par, p.name))
  const factures = documents.filter((d) => d.prospect_id === p.id && d.type === 'facture' && !d.data?.annulee)
  const lien = (href, txt) => (
    <a href={href} target="_blank" rel="noreferrer">
      {txt}
    </a>
  )
  const nonVide = (rows) => rows.filter(([, v]) => v)
  const detailsContact = nonVide([
    ['Instagram', ig && lien(instaLink(ig), ig)],
    ['Contact', f.contact && `${f.contact}${f.fonction ? ` (${f.fonction})` : ''}`],
    ['Téléphone', f.telephone && <a key="tel" href={`tel:${f.telephone.replace(/\s/g, '')}`}>{f.telephone}</a>],
    ['WhatsApp', f.whatsapp],
    ['Site', f.site && lien(siteLink(f.site), f.site)],
    ['Secteur', f.secteur],
    ['Ce qu’il vend', f.produit],
    ['Ville', [f.ville, f.zone].filter(Boolean).join(' · ')],
    ['Signal repéré', f.signal],
    ['Source', f.source],
    ['Recommandé par', f.recommande_par && (parrain ? <LienProspect key="rp" id={parrain.id} /> : f.recommande_par)],
    [
      'A recommandé',
      filleuls.length > 0 && (
        <span key="fl">
          {filleuls.map((x, i) => (
            <span key={x.id}>
              {i ? ', ' : ''}
              <LienProspect id={x.id} />
            </span>
          ))}
        </span>
      ),
    ],
  ])
  const detailsSuivi = [
    ['Étape', <StageBadge key="e" etape={p.etape} />],
    ['Score priorité', <Score key="s" v={p.score} />],
    ['Canal principal', p.canal || '—'],
    ['Tentatives / réponses', `${p.tentatives} / ${p.reponses}`],
    ['Qualification', `${p.qualif}/4`],
    ['Ajouté le', fmtDate(p.dateAjout)],
    ['Jours sans action', p.joursSansAction ?? '—'],
    ...(p.recontacter ? [['À recontacter le', fmtDate(p.recontacter)]] : []),
  ]
  const detailsVente = nonVide([
    ['Montant proposé', p.montantPropose && eur(p.montantPropose)],
    ['Expiration', p.expiration && fmtDate(p.expiration)],
    ['Pipeline pondéré', p.pipelinePondere && eur(p.pipelinePondere)],
    ['Signé le', p.dateSignature && fmtDate(p.dateSignature)],
    ['Cycle de vente', p.cycle !== null && p.cycle !== undefined && `${p.cycle} j`],
    ['Dernière objection', p.objection],
    ['Temps passé', p.tempsPasse && `${p.tempsPasse} min`],
    ['Démo du secteur', p.demo && lien(siteLink(p.demo), 'Ouvrir')],
    [
      'Factures',
      factures.length > 0 && (
        <button key="fa" type="button" className="toggle-link" onClick={() => setOnglet('docs')}>
          {factures.length} facture{factures.length > 1 ? 's' : ''}
          {client?.reste > 0 ? `, reste ${eur(client.reste)}` : ''}
        </button>
      ),
    ],
  ])
  const history = [...p.acts].reverse()

  const docs = documents.filter((d) => d.prospect_id === p.id)
  const ONGLETS = client
    ? [
        ['apercu', 'Aperçu'],
        ['historique', 'Historique', p.acts.length],
        ['docs', 'Factures', docs.length],
        ['fiche', 'Informations'],
      ]
    : [
        ['apercu', 'Aperçu'],
        ['messages', 'Messages'],
        ['qualif', 'Qualification'],
        ['historique', 'Historique', p.acts.length],
        ['docs', 'Factures', docs.length],
        ['fiche', 'Informations'],
      ]
  const tab = ONGLETS.some(([k]) => k === onglet) ? onglet : 'apercu'
  const initiales = p.name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()

  return (
    <div className="stack fiche">
      <div className="rec-head">
        <div className="rec-top">
          <button className="icon-btn back-btn" title="Retour" aria-label="Retour au hub Clients" onClick={() => go(`/clients?onglet=${categorie(p, client)}`)}>
            <Icon n="arrow-right" size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div className={`rec-avatar ${ig ? 'ig' : ''}`}>{ig ? <Icon n="instagram" size={20} /> : initiales || '?'}</div>
          <div className="li-main">
            <h1 className="ell">{p.name}</h1>
            <div className="muted small ell">
              {[f.contact, ig, f.secteur, f.ville].filter(Boolean).join(' · ') || 'Ajoute ses infos avec « Modifier »'}
            </div>
            <div className="row rec-badges">
              <StageBadge etape={p.etape} />
              <Score v={p.score} />
              {p.alerte && <span className="badge b-orange">{p.alerte}</span>}
              {client && <span className="badge b-green">Client {client.statut.toLowerCase()}</span>}
              {f.signal && <span className="badge b-gold">{f.signal}</span>}
            </div>
          </div>
          <div className="rec-actions">
            <ContactButtons p={p} />
            <button className="btn gold sm" onClick={() => openAction({ prospect_id: p.id, canal: p.canal })}>
              + Action
            </button>
            <Menu
              label="Plus"
              items={[
                { label: 'Nouveau devis', icon: 'file', onClick: () => go(`/facture/new?type=devis&p=${p.id}`) },
                { label: 'Nouvelle facture', icon: 'file', onClick: () => go(`/facture/new?type=facture&p=${p.id}`) },
                { label: 'Modifier la fiche', icon: 'edit', onClick: startEdit },
                '-',
                { label: 'Supprimer', icon: 'trash', danger: true, onClick: remove },
              ]}
            />
          </div>
        </div>
        {!client ? (
          <ProcessBar p={p} />
        ) : (
          <div className="rec-strip">
            {[
              ['Total signé', eur(client.total)],
              ['Encaissé', eur(client.encaisse)],
              ['Reste', eur(client.reste)],
              ['Abonnement', client.abonnement ? `${eur(client.abonnement)}/mois` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="k">{k}</div>
                <div className={`v ${k === 'Reste' && client.reste > 0 ? 'red' : ''}`}>{v}</div>
              </div>
            ))}
          </div>
        )}
        <Tabs items={ONGLETS} value={tab} onChange={setOnglet} />
      </div>

      {tab === 'apercu' && (
        <div className="rec-grid">
          <div className="stack">
            {!client && <ProchaineEtape p={p} />}
            {client && (
              <div className="card">
                <h2 className="section">
                  <span className="sec-ic"><Icon n="handshake" size={16} /></span> Suivi client
                </h2>
                <KV
                  rows={[
                    ['Paiement', client.statutPaiement || '—'],
                    ['Dernière prestation', client.derniereIntervention ? fmtDate(client.derniereIntervention) : '—'],
                    ['Renouvellement', client.renouvellement ? fmtDate(client.renouvellement) : '—'],
                    ['Onboarding', `${Math.round(client.onboarding * 100)} %`],
                    ['Valeur vie client', eur(client.valeurVie)],
                    ['Frais engagés', client.depenses ? eur(client.depenses) : '—'],
                    ['Gain net encaissé', eur(client.encaisse - client.depenses)],
                  ]}
                />
                <div className="row" style={{ gap: 6, marginTop: 12 }}>
                  <button className="btn sm gold" onClick={() => openAction({ prospect_id: p.id, action: 'Intervention', canal: 'Appel' })}>
                    + Intervention
                  </button>
                  <button className="btn sm" onClick={() => openAction({ prospect_id: p.id, action: 'Paiement reçu' })}>
                    + Paiement
                  </button>
                  <button className="btn sm" onClick={() => openAction({ prospect_id: p.id, action: 'Dépense' })}>
                    + Frais
                  </button>
                </div>
              </div>
            )}
            <div className="card">
              <h2 className="section">
                <span className="sec-ic"><Icon n="clock" size={16} /></span> Historique
                <button className="toggle-link" style={{ marginLeft: 'auto' }} onClick={() => setOnglet('historique')}>
                  Tout voir ({p.acts.length})
                </button>
              </h2>
              <NoteRapide pid={p.id} />
              <div className="list">
                {history.length === 0 && <Empty>Aucune action.</Empty>}
                {history.slice(0, nHisto).map((a) => (
                  <ActionLine key={a.id} a={a} showProspect={false} onEdit={editer} />
                ))}
              </div>
              {history.length > nHisto && (
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setNHisto(nHisto + 20)}>
                  Voir {Math.min(20, history.length - nHisto)} de plus
                </button>
              )}
            </div>
          </div>
          <aside className="stack">
            <div className="card">
              <h2 className="section">
                Détails
                <button className="toggle-link" style={{ marginLeft: 'auto' }} onClick={startEdit}>
                  Modifier
                </button>
              </h2>
              {detailsContact.length > 0 && (
                <>
                  <div className="kv-title">Contact</div>
                  <KV rows={detailsContact} />
                </>
              )}
              <div className="kv-title">Suivi</div>
              <KV rows={detailsSuivi} />
              {detailsVente.length > 0 && (
                <>
                  <div className="kv-title">Vente</div>
                  <KV rows={detailsVente} />
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === 'historique' && (
        <div className="card">
          <div className="list">
            {history.length === 0 && <Empty>Aucune action.</Empty>}
            {history.map((a) => (
              <ActionLine key={a.id} a={a} showProspect={false} onEdit={editer} />
            ))}
          </div>
        </div>
      )}

      {tab === 'messages' && <ScriptsCard p={p} />}

      {tab === 'qualif' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <QualifCard p={p} />
          <AuditCard p={p} />
        </div>
      )}

      {tab === 'docs' && <DocsCard pid={p.id} />}

      {tab === 'fiche' && (
        <div className="stack">
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            {GROUPES_FICHE.map(({ titre, keys, ico }) => {
              const champs = keys.map((k) => TOUS_CHAMPS.find((x) => x.key === k)).filter((x) => x && (tousChamps || f[x.key] || f[x.key] === 0))
              if (!champs.length) return null
              return (
                <div key={titre} className="card">
                  <h2 className="section">
                    <span className="sec-ic"><Icon n={ico} size={16} /></span> {titre}
                  </h2>
                  <KV
                    rows={champs.map((x) => {
                      let v = f[x.key]
                      if (!v && v !== 0) v = '—'
                      else if (x.key === 'instagram') v = lien(instaLink(v), v)
                      else if (x.key === 'site') v = lien(siteLink(v), v)
                      else if (x.type === 'date') v = fmtDate(v)
                      return [lbl(x.label), v]
                    })}
                  />
                </div>
              )
            })}
            {client && <AuditCard p={p} />}
          </div>
          <div className="row">
            <button className="btn sm" onClick={startEdit}>
              <Icon n="edit" size={14} /> Modifier la fiche
            </button>
            {TOUS_CHAMPS.some((x) => !f[x.key] && f[x.key] !== 0) && (
              <button className="toggle-link" onClick={() => setTousChamps((v) => !v)}>
                {tousChamps ? 'Masquer les champs vides' : `Afficher les champs vides (${TOUS_CHAMPS.filter((x) => !f[x.key] && f[x.key] !== 0).length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <Modal title="Modifier la fiche" onClose={() => setEditing(false)}>
          <FicheForm name={name} setName={setName} fiche={fiche} setFiche={setFiche} exceptId={p.id} ouvertes={['contact', 'entreprise', 'origine', 'offre']} />
          <div className="ff-foot">
            <button className="btn" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button className="btn gold" onClick={saveFiche}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
      {editAction && (
        <Modal title="Modifier l'action" onClose={() => setEditAction(null)} large>
          <ActionForm prefill={{ edit: editAction }} onDone={() => setEditAction(null)} />
        </Modal>
      )}
    </div>
  )
}

// Note rapide : une ligne « Note » dans l'historique, sans ouvrir le formulaire
function NoteRapide({ pid }) {
  const { api, toast } = useNoyau()
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const ajouter = async (e) => {
    e.preventDefault()
    const t = txt.trim()
    if (!t) return
    setBusy(true)
    try {
      await api.addActions([ligne(pid, { action: 'Note', notes: t })])
      setTxt('')
      toast('Note ajoutée ✓')
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  return (
    <form className="note-rapide" onSubmit={ajouter}>
      <input className="input" placeholder="Ajouter une note (appel, remarque, idée…)" value={txt} onChange={(e) => setTxt(e.target.value)} />
      <button className="btn sm primary" disabled={busy || !txt.trim()}>
        Ajouter
      </button>
    </form>
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
  const { api } = useNoyau()
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
  const { documents, actions } = useDonnees()
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
