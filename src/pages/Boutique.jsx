// Elite Store : commandes du site, catalogue de produits et stock de clés de licence
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Field, Kpi, Empty, Modal, Tabs, useTab, nb, LienProspect, confirmer } from '../ui'
import { useNoyau } from '../core/contexte'
import { supabase } from '../lib/store'
import { today, fmtDate } from '../lib/dates'

// Les prix de la boutique sont en FCFA, quelle que soit la devise choisie dans le CRM
const eur = (v) => `${nb(Number(v) || 0)} FCFA`
const SITE_BOUTIQUE = 'https://www.agence-elite.fr/boutique/'
const STATUTS = {
  en_attente: ['En attente', 'b-orange'],
  payee: ['Payée', 'b-gold'],
  livree: ['Livrée', 'b-green'],
  annulee: ['Annulée', 'b-Perdu'],
}
const MODES = { mobile_money: 'Mobile Money', virement: 'Virement', especes: 'Espèces', carte_simulation: 'Carte (simulation)' }
const LIVRAISONS = [
  ['cle', 'Clé de licence'],
  ['compte', 'Compte / abonnement'],
  ['service', 'Service Agence Elite'],
]
const PERIODES = ['une fois', 'par an', 'par mois']
const CA = (c) => !c.demo && (c.statut === 'payee' || c.statut === 'livree')
const ceMois = (d) => (d || '').slice(0, 7) === today().slice(0, 7)
const masquer = (k) => (k.length > 10 ? `${k.slice(0, 5)}…${k.slice(-5)}` : k)

function useStore() {
  const [s, setS] = useState({ produits: [], commandes: [], cles: [], charge: true, erreur: '' })
  const charger = useCallback(async () => {
    if (!supabase) return
    const [p, c, k] = await Promise.all([
      supabase.from('store_produits').select('*').order('ordre').order('nom'),
      supabase.from('store_commandes').select('*').order('created_at', { ascending: false }),
      supabase.from('store_cles').select('*').order('created_at'),
    ])
    const err = p.error || c.error || k.error
    setS({ produits: p.data || [], commandes: c.data || [], cles: k.data || [], charge: false, erreur: err ? err.message : '' })
  }, [])
  useEffect(() => {
    charger()
  }, [charger])
  return [s, charger]
}

export default function Boutique({ onglet: demande }) {
  const [onglet, setOnglet] = useTab('boutique', 'commandes', demande)
  const [s, recharger] = useStore()
  if (!supabase)
    return (
      <div className="stack">
        <div className="page-head">
          <h1>Elite Store</h1>
        </div>
        <Empty>La boutique nécessite la connexion au CRM en ligne.</Empty>
      </div>
    )
  const attente = s.commandes.filter((c) => c.statut === 'en_attente' && !c.demo).length
  const vraies = s.commandes.filter(CA)
  const stock = s.cles.filter((k) => !k.commande_id).length
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Elite Store</h1>
          <div className="sub">Les commandes passées sur le site, le catalogue affiché aux visiteurs et ton stock de clés de licence.</div>
        </div>
        <div className="row">
          <a className="btn" href={SITE_BOUTIQUE} target="_blank" rel="noopener noreferrer">
            <Icon n="globe" size={15} /> Voir la boutique
          </a>
          <a className="btn" href={`${SITE_BOUTIQUE}?demo=1`} target="_blank" rel="noopener noreferrer">
            <Icon n="play" size={15} /> Mode démo
          </a>
        </div>
      </div>
      <div className="grid grid-4">
        <Kpi label="Ventes ce mois-ci" value={eur(vraies.filter((c) => ceMois(c.payee_le || c.created_at)).reduce((m, c) => m + Number(c.total), 0))} navy />
        <Kpi label="Ventes au total" value={eur(vraies.reduce((m, c) => m + Number(c.total), 0))} navy />
        <Kpi label="Commandes à traiter" value={nb(attente + s.commandes.filter((c) => c.statut === 'payee' && !c.demo).length)} onClick={() => setOnglet('commandes')} />
        <Kpi label="Clés en stock" value={nb(stock)} onClick={() => setOnglet('cles')} />
      </div>
      <Tabs
        items={[
          ['commandes', 'Commandes', s.commandes.length],
          ['produits', 'Produits', s.produits.length],
          ['cles', 'Clés de licence', stock],
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      {s.erreur && <div className="card" style={{ color: 'var(--red)' }}>Erreur de chargement : {s.erreur}</div>}
      {s.charge ? <Empty>Chargement…</Empty> : onglet === 'produits' ? <Produits s={s} recharger={recharger} /> : onglet === 'cles' ? <Cles s={s} recharger={recharger} /> : <Commandes s={s} recharger={recharger} />}
    </div>
  )
}

// ---------- Commandes ----------
function Commandes({ s, recharger }) {
  const [filtre, setFiltre] = useState('actives')
  const [q, setQ] = useState('')
  const [ouverte, setOuverte] = useState(null)
  const liste = useMemo(() => {
    const t = q.trim().toLowerCase()
    return s.commandes
      .filter((c) => (filtre === 'actives' ? !c.demo && ['en_attente', 'payee'].includes(c.statut) : filtre === 'demo' ? c.demo : filtre === 'toutes' ? !c.demo : !c.demo && c.statut === filtre))
      .filter((c) => !t || [c.numero, c.client?.nom, c.client?.tel, c.client?.entreprise, ...(c.lignes || []).map((l) => l.nom)].some((x) => (x || '').toLowerCase().includes(t)))
  }, [s.commandes, filtre, q])
  const c = ouverte && s.commandes.find((x) => x.id === ouverte)
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ flex: '1 1 200px' }} placeholder="Rechercher : numéro, client, produit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label="Filtrer les commandes" style={{ width: 'auto' }} value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="actives">À traiter</option>
          <option value="en_attente">En attente de paiement</option>
          <option value="payee">Payées, à livrer</option>
          <option value="livree">Livrées</option>
          <option value="annulee">Annulées</option>
          <option value="toutes">Toutes</option>
          <option value="demo">Démonstrations</option>
        </select>
      </div>
      <div className="list">
        {liste.length === 0 && <Empty>{filtre === 'actives' ? 'Aucune commande à traiter. Les commandes du site arrivent ici.' : 'Aucune commande.'}</Empty>}
        {liste.map((c) => (
          <div key={c.id} className="list-item click" onClick={() => setOuverte(c.id)}>
            <div className="li-main">
              <div className="li-title">
                {c.client?.entreprise || c.client?.nom} <span className="muted">· {c.numero}</span>
              </div>
              <div className="li-sub">
                {[fmtDate(c.created_at.slice(0, 10)), MODES[c.mode_paiement] || c.mode_paiement, (c.lignes || []).map((l) => `${l.qte} × ${l.nom}`).join(', ')].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="li-side" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <b style={{ whiteSpace: 'nowrap' }}>{eur(c.total)}</b>
              <span className="row" style={{ gap: 6 }}>
                {c.demo && <span className="badge b-navy">Démo</span>}
                <span className={`badge ${STATUTS[c.statut][1]}`}>{STATUTS[c.statut][0]}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      {c && (
        <Modal title={`Commande ${c.numero}`} onClose={() => setOuverte(null)} large>
          <DetailCommande c={c} s={s} recharger={recharger} />
        </Modal>
      )}
    </div>
  )
}

function DetailCommande({ c, s, recharger }) {
  const { api, toast } = useNoyau()
  const [busy, setBusy] = useState(false)
  const cles = s.cles.filter((k) => k.commande_id === c.id)
  const wa = (c.client?.tel || '').replace(/\D/g, '')

  const statut = async (st) => {
    setBusy(true)
    const patch = { statut: st }
    if (st === 'payee' && !c.payee_le) patch.payee_le = new Date().toISOString()
    if (st === 'livree') {
      patch.livree_le = new Date().toISOString()
      if (!c.payee_le) patch.payee_le = patch.livree_le
    }
    const { error } = await supabase.from('store_commandes').update(patch).eq('id', c.id)
    if (error) toast(`Erreur : ${error.message}`, true)
    else {
      // Premier encaissement d'une vraie commande : il apparaît dans les paiements reçus du CRM
      if (!c.demo && !c.payee_le && patch.payee_le)
        await api.addActions([{ prospect_id: c.prospect_id, date: today(), canal: 'Autre', action: 'Paiement reçu', montant: c.total, mode: MODES[c.mode_paiement] || c.mode_paiement, reference: c.numero, notes: `Elite Store ${c.numero}` }]).catch(() => {})
      toast(`Commande ${STATUTS[st][0].toLowerCase()} ✓`)
      await recharger()
    }
    setBusy(false)
  }

  // Attribue les clés en stock aux lignes livrées par clé (une clé par exemplaire)
  const attribuer = async () => {
    setBusy(true)
    let manque = 0
    for (const l of c.lignes || []) {
      if (l.livraison !== 'cle') continue
      const deja = cles.filter((k) => k.produit_id === l.produit_id).length
      const libres = s.cles.filter((k) => !k.commande_id && k.produit_id === l.produit_id).slice(0, Math.max(0, l.qte - deja))
      manque += Math.max(0, l.qte - deja - libres.length)
      if (libres.length) {
        const { error } = await supabase
          .from('store_cles')
          .update({ commande_id: c.id, attribuee_le: new Date().toISOString() })
          .in('id', libres.map((k) => k.id))
        if (error) toast(`Erreur : ${error.message}`, true)
      }
    }
    await recharger()
    setBusy(false)
    toast(manque ? `${manque} clé(s) manquante(s) : ajoute-les dans l'onglet Clés de licence` : 'Clés attribuées ✓', !!manque)
  }

  const nomProduit = (id) => s.produits.find((p) => p.id === id)?.nom || 'Produit'
  const messageCles =
    `Bonjour ${c.client?.nom || ''}, merci pour votre commande ${c.numero} sur Elite Store.\n\n` +
    cles.map((k) => `${nomProduit(k.produit_id)} : ${k.cle}`).join('\n') +
    `\n\nBesoin d'aide pour l'installation ? Répondez à ce message, nos techniciens s'en occupent.\nAgence Elite`
  const aDesCles = (c.lignes || []).some((l) => l.livraison === 'cle')

  return (
    <div className="stack">
      {c.demo && <div className="card" style={{ background: 'var(--gold-soft)' }}>Commande de démonstration : aucun paiement réel, elle n'est pas comptée dans tes ventes.</div>}
      <div className="grid grid-2">
        <div>
          <div className="muted">Client</div>
          <b>{c.client?.nom}</b>
          {c.client?.entreprise && <div>{c.client.entreprise}</div>}
          <div>{c.client?.tel}</div>
          {c.client?.email && <div>{c.client.email}</div>}
          {c.prospect_id && (
            <div style={{ marginTop: 6 }}>
              <LienProspect id={c.prospect_id}>Ouvrir la fiche client</LienProspect>
            </div>
          )}
        </div>
        <div>
          <div className="muted">Commande</div>
          <div>Passée le {fmtDate(c.created_at.slice(0, 10))}</div>
          <div>Paiement : {MODES[c.mode_paiement] || c.mode_paiement || '—'}</div>
          <div>
            Statut : <span className={`badge ${STATUTS[c.statut][1]}`}>{STATUTS[c.statut][0]}</span>
          </div>
          {c.payee_le && <div>Payée le {fmtDate(c.payee_le.slice(0, 10))}</div>}
          {c.livree_le && <div>Livrée le {fmtDate(c.livree_le.slice(0, 10))}</div>}
        </div>
      </div>
      <div className="list">
        {(c.lignes || []).map((l, i) => (
          <div key={i} className="list-item">
            <div className="li-main">
              <div className="li-title">
                {l.qte} × {l.nom}
              </div>
              <div className="li-sub">
                {eur(l.prix)} {l.periode} · {LIVRAISONS.find((x) => x[0] === l.livraison)?.[1]}
              </div>
            </div>
            <div className="li-side">
              <b>{eur(l.prix * l.qte)}</b>
            </div>
          </div>
        ))}
        <div className="list-item">
          <div className="li-main">
            <b>Total</b>
          </div>
          <div className="li-side">
            <b>{eur(c.total)}</b>
          </div>
        </div>
      </div>
      {aDesCles && (
        <div className="card">
          <h2 className="section">
            <span className="sec-ic">
              <Icon n="tag" size={16} />
            </span>{' '}
            Clés de licence
          </h2>
          {cles.length === 0 ? (
            <div className="muted">Aucune clé attribuée pour l'instant.</div>
          ) : (
            cles.map((k) => (
              <div key={k.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{nomProduit(k.produit_id)}</span>
                <code>{k.cle}</code>
              </div>
            ))
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy || c.statut === 'annulee'} onClick={attribuer}>
              <Icon n="tag" size={15} /> Attribuer les clés du stock
            </button>
            {cles.length > 0 && wa && (
              <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(messageCles)}`} target="_blank" rel="noopener noreferrer">
                <Icon n="message" size={15} /> Envoyer les clés sur WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
      <div className="row">
        {wa && (
          <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour ${c.client?.nom || ''}, nous avons bien reçu votre commande ${c.numero} (${eur(c.total)}) sur Elite Store.`)}`} target="_blank" rel="noopener noreferrer">
            <Icon n="phone" size={15} /> Contacter le client
          </a>
        )}
        <span style={{ flex: 1 }} />
        {c.statut === 'en_attente' && (
          <button className="btn gold" disabled={busy} onClick={() => statut('payee')}>
            <Icon n="coins" size={15} /> Paiement reçu
          </button>
        )}
        {(c.statut === 'en_attente' || c.statut === 'payee') && (
          <button className={`btn ${c.statut === 'payee' ? 'gold' : ''}`} disabled={busy} onClick={() => statut('livree')}>
            <Icon n="check" size={15} /> Marquer livrée
          </button>
        )}
        {c.statut !== 'annulee' && c.statut !== 'livree' && (
          <button className="btn ghost" disabled={busy} onClick={async () => (await confirmer('Le client ne sera pas prévenu automatiquement.', { titre: 'Annuler cette commande ?', ok: 'Annuler la commande', non: 'Garder', danger: true })) && statut('annulee')}>
            Annuler
          </button>
        )}
        {c.statut === 'annulee' && (
          <button className="btn" disabled={busy} onClick={() => statut('en_attente')}>
            Rétablir
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Produits ----------
function Produits({ s, recharger }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState(null)
  const cats = [...new Set(s.produits.map((p) => p.categorie))]
  const ventes = useMemo(() => {
    const m = {}
    s.commandes.filter(CA).forEach((c) => (c.lignes || []).forEach((l) => (m[l.produit_id] = (m[l.produit_id] || 0) + l.qte)))
    return m
  }, [s.commandes])
  const liste = s.produits.filter((p) => (!cat || p.categorie === cat) && (!q.trim() || [p.nom, p.editeur, p.categorie].some((x) => (x || '').toLowerCase().includes(q.trim().toLowerCase()))))
  const aConfirmer = s.produits.filter((p) => p.a_confirmer && p.actif).length
  return (
    <div className="card">
      {aConfirmer > 0 && (
        <div className="muted" style={{ marginBottom: 10 }}>
          <Icon n="info" size={14} /> {aConfirmer} prix sont des estimations (prix publics des éditeurs convertis en FCFA) : confirme-les avec ton distributeur, puis décoche « Prix à confirmer ».
        </div>
      )}
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ flex: '1 1 200px' }} placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label="Catégorie" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn gold" onClick={() => setEdit({})}>
          + Produit
        </button>
      </div>
      <div className="list">
        {liste.length === 0 && <Empty>Aucun produit.</Empty>}
        {liste.map((p) => (
          <div key={p.id} className="list-item click" onClick={() => setEdit(p)} style={p.actif ? undefined : { opacity: 0.55 }}>
            <div className="li-main">
              <div className="li-title">{p.nom}</div>
              <div className="li-sub">{[p.categorie, p.editeur, p.duree, ventes[p.id] ? `${ventes[p.id]} vendu(s)` : ''].filter(Boolean).join(' · ')}</div>
              {(p.vedette || p.a_confirmer || !p.actif) && (
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  {p.vedette && <span className="badge b-red">Populaire</span>}
                  {p.a_confirmer && <span className="badge b-orange">Prix à confirmer</span>}
                  {!p.actif && <span className="badge b-Perdu">Masqué</span>}
                </div>
              )}
            </div>
            <div className="li-side">
              <b style={{ whiteSpace: 'nowrap' }}>
                {eur(p.prix)} <span className="muted">{p.periode}</span>
              </b>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? 'Modifier le produit' : 'Nouveau produit'} onClose={() => setEdit(null)} large>
          <ProduitForm p={edit} cats={cats} onDone={async () => {
            setEdit(null)
            await recharger()
          }} />
        </Modal>
      )}
    </div>
  )
}

const slugifier = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function ProduitForm({ p, cats, onDone }) {
  const { toast } = useNoyau()
  const [f, setF] = useState(() => ({
    nom: '',
    categorie: cats[0] || '',
    editeur: '',
    resume: '',
    description: '',
    duree: '',
    appareils: '',
    prix: '',
    prix_barre: '',
    periode: 'une fois',
    image: '',
    livraison: 'cle',
    a_confirmer: false,
    actif: true,
    vedette: false,
    ordre: 100,
    ...p,
    inclus: (p.inclus || []).join('\n'),
  }))
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const enregistrer = async (e) => {
    e.preventDefault()
    if (!f.nom.trim() || f.prix === '') return toast('Nom et prix obligatoires', true)
    setBusy(true)
    const row = {
      nom: f.nom.trim(),
      categorie: f.categorie.trim() || 'Divers',
      editeur: f.editeur.trim() || null,
      resume: f.resume.trim() || null,
      description: f.description.trim() || null,
      duree: f.duree.trim() || null,
      appareils: f.appareils.trim() || null,
      prix: Number(f.prix),
      prix_barre: f.prix_barre === '' || f.prix_barre === null ? null : Number(f.prix_barre),
      periode: f.periode,
      image: (f.image || '').trim() || null,
      livraison: f.livraison,
      a_confirmer: f.a_confirmer,
      actif: f.actif,
      vedette: f.vedette,
      ordre: Number(f.ordre) || 100,
      inclus: f.inclus
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    }
    const { error } = p.id
      ? await supabase.from('store_produits').update(row).eq('id', p.id)
      : await supabase.from('store_produits').insert({ ...row, slug: `${slugifier(row.nom)}-${Date.now().toString(36).slice(-4)}` })
    setBusy(false)
    if (error) return toast(`Erreur : ${error.message}`, true)
    toast('Produit enregistré ✓')
    onDone()
  }
  const supprimer = async () => {
    if (!(await confirmer('Ses clés en stock seront supprimées. Les commandes passées sont conservées.', { titre: 'Supprimer ce produit ?', ok: 'Supprimer', danger: true }))) return
    const { error } = await supabase.from('store_produits').delete().eq('id', p.id)
    if (error) return toast(`Erreur : ${error.message}`, true)
    toast('Produit supprimé ✓')
    onDone()
  }
  return (
    <form className="stack" onSubmit={enregistrer}>
      <div className="grid grid-2">
        <Field label="Nom *">
          <input className="input" value={f.nom} onChange={set('nom')} />
        </Field>
        <Field label="Éditeur">
          <input className="input" value={f.editeur || ''} onChange={set('editeur')} placeholder="Microsoft, Adobe…" />
        </Field>
        <Field label="Catégorie">
          <input className="input" list="store-cats" value={f.categorie} onChange={set('categorie')} />
          <datalist id="store-cats">
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Livraison">
          <select className="input" value={f.livraison} onChange={set('livraison')}>
            {LIVRAISONS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prix (FCFA) *">
          <input className="input" type="number" min="0" value={f.prix} onChange={set('prix')} />
        </Field>
        <Field label="Prix barré (promotion)">
          <input className="input" type="number" min="0" value={f.prix_barre ?? ''} onChange={set('prix_barre')} />
        </Field>
        <Field label="Facturation">
          <select className="input" value={f.periode} onChange={set('periode')}>
            {PERIODES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Durée">
          <input className="input" value={f.duree || ''} onChange={set('duree')} placeholder="1 an, Définitive…" />
        </Field>
        <Field label="Appareils">
          <input className="input" value={f.appareils || ''} onChange={set('appareils')} placeholder="1 PC, 5 appareils…" />
        </Field>
        <Field label="Ordre d'affichage">
          <input className="input" type="number" value={f.ordre} onChange={set('ordre')} />
        </Field>
      </div>
      <Field label="Résumé (carte produit)">
        <input className="input" value={f.resume || ''} onChange={set('resume')} />
      </Field>
      <Field label="Description (page produit)">
        <textarea className="input" rows={3} value={f.description || ''} onChange={set('description')} />
      </Field>
      <Field label="Inclus (une ligne par avantage)">
        <textarea className="input" rows={4} value={f.inclus} onChange={set('inclus')} />
      </Field>
      <Field label="Image (adresse web, facultatif)">
        <input className="input" value={f.image || ''} onChange={set('image')} placeholder="https://…" />
      </Field>
      <div className="row">
        <label className="row">
          <input type="checkbox" checked={f.actif} onChange={set('actif')} /> Visible sur le site
        </label>
        <label className="row">
          <input type="checkbox" checked={f.vedette} onChange={set('vedette')} /> Populaire
        </label>
        <label className="row">
          <input type="checkbox" checked={f.a_confirmer} onChange={set('a_confirmer')} /> Prix à confirmer
        </label>
      </div>
      <div className="row">
        {p.id && (
          <button type="button" className="ecriture btn ghost" onClick={supprimer}>
            <Icon n="trash" size={15} /> Supprimer
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn gold" disabled={busy}>
          Enregistrer
        </button>
      </div>
    </form>
  )
}

// ---------- Clés de licence ----------
function Cles({ s, recharger }) {
  const { toast } = useNoyau()
  const avecCles = s.produits.filter((p) => p.livraison === 'cle')
  const [produit, setProduit] = useState(avecCles[0]?.id || '')
  const [texte, setTexte] = useState('')
  const [busy, setBusy] = useState(false)
  const stockDe = (id) => s.cles.filter((k) => k.produit_id === id && !k.commande_id).length
  const ajouter = async () => {
    const lignes = [...new Set(texte.split('\n').map((x) => x.trim()).filter(Boolean))]
    if (!produit || !lignes.length) return toast('Choisis un produit et colle au moins une clé', true)
    setBusy(true)
    const { error } = await supabase.from('store_cles').insert(lignes.map((cle) => ({ produit_id: produit, cle })))
    setBusy(false)
    if (error) return toast(`Erreur : ${error.message}`, true)
    setTexte('')
    toast(`${lignes.length} clé(s) ajoutée(s) ✓`)
    recharger()
  }
  const retirer = async (k) => {
    if (!(await confirmer('Retirer cette clé du stock ?', { ok: 'Retirer', danger: true }))) return
    const { error } = await supabase.from('store_cles').delete().eq('id', k.id)
    if (error) return toast(`Erreur : ${error.message}`, true)
    recharger()
  }
  const libres = s.cles.filter((k) => !k.commande_id && k.produit_id === produit)
  return (
    <div className="grid fin-grid">
      <div className="card">
        <h2 className="section">
          <span className="sec-ic">
            <Icon n="plus" size={16} />
          </span>{' '}
          Ajouter des clés
        </h2>
        <div className="stack">
          <Field label="Produit">
            <select className="input" value={produit} onChange={(e) => setProduit(e.target.value)}>
              {avecCles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} ({stockDe(p.id)} en stock)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Clés achetées chez ton distributeur (une par ligne)">
            <textarea className="input" rows={5} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" />
          </Field>
          <div className="row">
            <span style={{ flex: 1 }} />
            <button className="btn gold" disabled={busy} onClick={ajouter}>
              Ajouter au stock
            </button>
          </div>
          <div className="list">
            {libres.length === 0 && <Empty>Aucune clé en stock pour ce produit.</Empty>}
            {libres.map((k) => (
              <div key={k.id} className="list-item">
                <div className="li-main">
                  <code>{masquer(k.cle)}</code>
                  <div className="li-sub">Ajoutée le {fmtDate(k.created_at.slice(0, 10))}</div>
                </div>
                <div className="li-side">
                  <button className="btn ghost sm" onClick={() => retirer(k)} aria-label="Retirer la clé">
                    <Icon n="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="section">
          <span className="sec-ic">
            <Icon n="tag" size={16} />
          </span>{' '}
          Stock par produit
        </h2>
        <div className="list">
          {avecCles.map((p) => {
            const n = stockDe(p.id)
            return (
              <div key={p.id} className="list-item click" onClick={() => setProduit(p.id)}>
                <div className="li-main">
                  <div className="li-title">{p.nom}</div>
                  <div className="li-sub">{s.cles.filter((k) => k.produit_id === p.id && k.commande_id).length} livrée(s)</div>
                </div>
                <div className="li-side">
                  <span className={`badge ${n ? 'b-green' : 'b-Perdu'}`}>{n} en stock</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
