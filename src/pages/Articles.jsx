import { useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, Modal, Chips, Choix, eur, nb } from '../ui'
import { num } from '../lib/invoice'
import { articlesDe, nextRef, statutStock, enAlerte, photoArticle, CATEGORIES_ARTICLES } from '../lib/magasin'

// Vignette d'un article : sa photo, sinon ses initiales sur une pastille
export function Vignette({ a, size = 56 }) {
  if (a.photo) return <img className="art-img" src={a.photo} alt="" style={{ width: size, height: size }} />
  const ini = (a.nom || '?').split(/\s+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase()
  return (
    <span className="art-img art-ini" style={{ width: size, height: size, fontSize: size / 2.8 }} aria-hidden="true">
      {ini}
    </span>
  )
}

// Fiche article : photo + nom + prix + quantité suffisent, le reste est facultatif
export function ArticleForm({ article, onDone }) {
  const { documents, settings, api, toast } = useApp()
  const cats = useMemo(() => [...new Set([...(settings.categoriesArticles || CATEGORIES_ARTICLES), ...articlesDe(documents).map((a) => a.categorie).filter(Boolean)])], [documents, settings])
  const [f, setF] = useState(() => ({
    nom: article?.nom || '',
    prix: article?.prix ?? '',
    stock: article?.stock ?? '',
    categorie: article?.categorie || '',
    photo: article?.photo || '',
    prixAchat: article?.prixAchat ?? '',
    seuil: article?.seuil ?? 2,
    marque: article?.marque || '',
    description: article?.description || '',
  }))
  const [plus, setPlus] = useState(!!(article?.prixAchat || article?.marque || article?.description))
  const [busy, setBusy] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const fichier = useRef(null)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const choisirPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      set({ photo: await photoArticle(file) })
    } catch (err) {
      toast(err.message, true)
    }
  }
  const save = async (encore) => {
    if (!f.nom.trim()) return toast("Indique le nom de l'article", true)
    if (!num(f.prix)) return toast('Indique le prix de vente', true)
    setBusy(true)
    try {
      const data = { ...(article?.doc?.data || {}), ...f, nom: f.nom.trim(), prix: num(f.prix), stock: num(f.stock), prixAchat: f.prixAchat === '' ? '' : num(f.prixAchat), seuil: num(f.seuil) }
      await api.saveDoc(article ? { ...article.doc, data } : { type: 'produit', numero: nextRef(documents), prospect_id: null, data })
      toast(article ? 'Article mis à jour ✓' : `${data.nom} ajouté au magasin ✓`)
      if (encore) {
        setF({ nom: '', prix: '', stock: '', categorie: f.categorie, photo: '', prixAchat: '', seuil: 2, marque: '', description: '' })
        setBusy(false)
        fichier.current?.focus()
      } else onDone?.()
    } catch {
      setBusy(false)
    }
  }
  const supprimer = async () => {
    setBusy(true)
    try {
      await api.saveDoc({ ...article.doc, data: { ...article.doc.data, archive: true } })
      toast('Article retiré du magasin ✓')
      onDone?.()
    } catch {
      setBusy(false)
    }
  }
  return (
    <div className="stack art-form">
      <div className="art-photo-row">
        <button type="button" className={`art-photo ${f.photo ? 'has' : ''}`} ref={fichier} onClick={() => fichier.current?.nextSibling?.click()}>
          {f.photo ? <img src={f.photo} alt="Photo de l'article" /> : (
            <>
              <Icon n="upload" size={26} />
              <span>Prendre une photo</span>
            </>
          )}
        </button>
        <input type="file" accept="image/*" capture="environment" hidden onChange={choisirPhoto} />
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <Field label="Nom de l'article">
            <input className="input" id="art-nom" value={f.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Ex. Bottes de sécurité S3 pointure 42" autoFocus={!article} />
          </Field>
          <div className="grid grid-2">
            <Field label="Prix de vente (€)">
              <input className="input" id="art-prix" inputMode="numeric" value={f.prix} onChange={(e) => set({ prix: e.target.value })} placeholder="25 000" />
            </Field>
            <Field label="Quantité en magasin">
              <input className="input" id="art-stock" inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value })} placeholder="10" />
            </Field>
          </div>
        </div>
      </div>
      <Field label="Catégorie">
        <Chips small options={cats} value={f.categorie} onChange={(v) => set({ categorie: v })} />
      </Field>
      {!plus ? (
        <button type="button" className="toggle-link" onClick={() => setPlus(true)}>
          + Plus de détails (prix d'achat, marque, alerte de stock)
        </button>
      ) : (
        <div className="grid grid-2">
          <Field label="Prix d'achat (€)">
            <input className="input" id="art-achat" inputMode="numeric" value={f.prixAchat} onChange={(e) => set({ prixAchat: e.target.value })} />
          </Field>
          <Field label="Alerte quand il en reste">
            <input className="input" id="art-seuil" inputMode="numeric" value={f.seuil} onChange={(e) => set({ seuil: e.target.value })} />
          </Field>
          <Field label="Marque">
            <input className="input" id="art-marque" value={f.marque} onChange={(e) => set({ marque: e.target.value })} />
          </Field>
          <Field label="Description">
            <input className="input" id="art-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {article && !confirmer && (
          <button type="button" className="btn ghost red" style={{ marginRight: 'auto' }} onClick={() => setConfirmer(true)}>
            <Icon n="trash" size={15} /> Retirer
          </button>
        )}
        {confirmer && (
          <span className="row" style={{ marginRight: 'auto' }}>
            <span className="small">Retirer cet article ?</span>
            <button type="button" className="btn sm danger" disabled={busy} onClick={supprimer}>Oui, retirer</button>
            <button type="button" className="btn sm" onClick={() => setConfirmer(false)}>Non</button>
          </span>
        )}
        {!article && (
          <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>
            Enregistrer et ajouter un autre
          </button>
        )}
        <button type="button" className="btn primary" disabled={busy} onClick={() => save(false)}>
          <Icon n="check" size={16} /> Enregistrer
        </button>
      </div>
    </div>
  )
}

export default function Articles() {
  const { documents } = useApp()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [filtre, setFiltre] = useState('')
  const [modal, setModal] = useState(null)
  const tous = useMemo(() => articlesDe(documents), [documents])
  const cats = [...new Set(tous.map((a) => a.categorie).filter(Boolean))]
  const liste = tous.filter((a) => {
    const s = q.trim().toLowerCase()
    return (!s || [a.nom, a.numero, a.marque, a.categorie].some((x) => (x || '').toLowerCase().includes(s))) && (!cat || a.categorie === cat) && (!filtre || enAlerte(a))
  })
  const valeur = tous.reduce((m, a) => m + a.stock * (num(a.prixAchat) || a.prix), 0)
  const alertes = tous.filter(enAlerte)
  const unites = tous.reduce((m, a) => m + Math.max(0, a.stock), 0)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Articles du magasin</h1>
          <div className="sub">Une photo, un nom, un prix, une quantité : l'article apparaît aussitôt dans la caisse.</div>
        </div>
        <button className="btn primary" onClick={() => setModal({})}>
          <Icon n="plus" size={16} /> Nouvel article
        </button>
      </div>
      <div className="grid grid-4">
        <Kpi label="Articles" value={nb(tous.length)} navy />
        <Kpi label="Unités en magasin" value={nb(unites)} />
        <Kpi label="Valeur du stock" value={eur(valeur)} />
        <Kpi label="À réapprovisionner" value={nb(alertes.length)} onClick={alertes.length ? () => setFiltre(filtre ? '' : 'alerte') : undefined} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" id="art-q" style={{ flex: '1 1 220px' }} placeholder="Rechercher un article, une marque, une référence…" value={q} onChange={(e) => setQ(e.target.value)} />
          {alertes.length > 0 && (
            <button className={`chip ${filtre ? 'on' : ''}`} onClick={() => setFiltre(filtre ? '' : 'alerte')}>
              Stock bas ({alertes.length})
            </button>
          )}
        </div>
        {cats.length > 1 && <Chips small options={cats} value={cat} onChange={setCat} />}
        {!tous.length ? (
          <Empty>Aucun article pour l'instant. Touche « Nouvel article » et prends le premier en photo.</Empty>
        ) : !liste.length ? (
          <Empty>Aucun article ne correspond.</Empty>
        ) : (
          <div className="art-grid" style={{ marginTop: 12 }}>
            {liste.map((a) => {
              const [st, tone] = statutStock(a)
              return (
                <button key={a.id} className="art-card" onClick={() => setModal({ article: a })}>
                  <Vignette a={a} size={64} />
                  <div className="art-body">
                    <div className="art-nom">{a.nom}</div>
                    <div className="art-meta">
                      {a.numero}
                      {a.categorie ? ` · ${a.categorie}` : ''}
                    </div>
                    <div className="art-foot">
                      <strong>{eur(a.prix)}</strong>
                      <span className={`badge ${tone}`}>{st}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {modal && (
        <Modal title={modal.article ? modal.article.nom : 'Nouvel article'} onClose={() => setModal(null)} large>
          <ArticleForm article={modal.article} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}
