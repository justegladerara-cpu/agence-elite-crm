import { useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, Modal, Chips, Choix, eur, nb } from '../ui'
import { num, estNombre } from '../lib/invoice'
import { articlesDe, nextRef, statutStock, enAlerte, photoArticle, CATEGORIES_ARTICLES } from '../lib/magasin'
import { peut } from '../lib/store'

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

// Catégories : celles des réglages, plus celles déjà utilisées par un article
export const categoriesDe = (settings, documents) => [...new Set([...(settings.categoriesArticles || CATEGORIES_ARTICLES), ...articlesDe(documents).map((a) => a.categorie).filter(Boolean)])]

// Gestion des catégories : ajouter, renommer (les articles suivent), supprimer (les articles passent dans une autre)
function CategoriesModal({ onClose }) {
  const { documents, settings, api, toast, profil } = useApp()
  const cats = categoriesDe(settings, documents)
  const articles = articlesDe(documents)
  const nbDans = (c) => articles.filter((a) => a.categorie === c).length
  const [nouvelle, setNouvelle] = useState('')
  const [edit, setEdit] = useState(null)
  const [suppr, setSuppr] = useState(null)
  const [busy, setBusy] = useState(false)
  // La liste des réglages ne se modifie qu'avec le droit « réglages » ; sinon les catégories vivent par les articles
  const sauverListe = async (liste) => {
    if (!peut(profil, 'reglages')) return
    await api.saveSettings({ ...settings, categoriesArticles: liste })
  }
  const deplacer = async (de, vers) => {
    const docs = articles.filter((a) => a.categorie === de).map((a) => ({ ...a.doc, data: { ...a.doc.data, categorie: vers } }))
    if (docs.length) await api.saveDocs(docs)
  }
  const existe = (n, sauf) => cats.some((c) => c !== sauf && c.toLowerCase() === n.toLowerCase())
  const run = async (fn, msg) => {
    setBusy(true)
    try {
      await fn()
      toast(msg)
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  const ajouter = () => {
    const n = nouvelle.trim()
    if (!n) return toast('Écris le nom de la catégorie', true)
    if (existe(n)) return toast('Cette catégorie existe déjà', true)
    if (!peut(profil, 'reglages')) return toast("Ajouter une catégorie à la liste demande le droit « Réglages ». Tu peux aussi l'écrire directement dans la fiche d'un article.", true)
    run(async () => {
      const autre = cats.includes('Autre')
      await sauverListe(autre ? [...cats.filter((c) => c !== 'Autre'), n, 'Autre'] : [...cats, n])
      setNouvelle('')
    }, `Catégorie « ${n} » ajoutée ✓`)
  }
  const renommer = () => {
    const n = edit.nom.trim()
    if (!n) return toast('Le nom ne peut pas être vide', true)
    if (n === edit.de) return setEdit(null)
    if (existe(n, edit.de)) return toast('Une autre catégorie porte déjà ce nom', true)
    run(async () => {
      await deplacer(edit.de, n)
      await sauverListe(cats.map((c) => (c === edit.de ? n : c)))
      setEdit(null)
    }, `Catégorie renommée en « ${n} » ✓`)
  }
  const supprimer = () => {
    run(async () => {
      await deplacer(suppr.de, suppr.vers)
      await sauverListe(cats.filter((c) => c !== suppr.de))
      setSuppr(null)
    }, `Catégorie « ${suppr.de} » supprimée ✓`)
  }
  return (
    <Modal title="Catégories d'articles" onClose={onClose}>
      <div className="stack">
        <div className="row">
          <input className="input" id="cat-nouvelle" style={{ flex: 1 }} value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} placeholder="Nouvelle catégorie, ex. Quincaillerie" />
          <button className="btn primary" disabled={busy} onClick={ajouter}>
            <Icon n="plus" size={15} /> Ajouter
          </button>
        </div>
        <div>
          {cats.map((c) => (
            <div key={c} className="cat-ligne">
              {edit?.de === c ? (
                <>
                  <input className="input" autoFocus value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && renommer()} aria-label={`Nouveau nom de ${c}`} />
                  <button className="btn sm primary" disabled={busy} onClick={renommer}>OK</button>
                  <button className="btn sm" onClick={() => setEdit(null)}>Annuler</button>
                </>
              ) : suppr?.de === c ? (
                <>
                  <span className="cat-nom small">Ses {nbDans(c)} article{nbDans(c) > 1 ? 's' : ''} iront dans</span>
                  <select className="input sm" style={{ flex: '0 1 160px' }} value={suppr.vers} onChange={(e) => setSuppr({ ...suppr, vers: e.target.value })} aria-label="Catégorie de remplacement">
                    {cats.filter((x) => x !== c).map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <button className="btn sm danger" disabled={busy} onClick={supprimer}>Supprimer</button>
                  <button className="btn sm" onClick={() => setSuppr(null)}>Non</button>
                </>
              ) : (
                <>
                  <span className="cat-nom">{c}</span>
                  <span className="small muted">{nbDans(c)} article{nbDans(c) > 1 ? 's' : ''}</span>
                  <button className="btn sm ghost" onClick={() => setEdit({ de: c, nom: c })} title="Renommer" aria-label={`Renommer ${c}`}>
                    <Icon n="edit" size={14} />
                  </button>
                  <button
                    className="btn sm ghost"
                    onClick={() => (nbDans(c) && cats.length > 1 ? setSuppr({ de: c, vers: cats.find((x) => x !== c && x === 'Autre') || cats.find((x) => x !== c) }) : run(() => sauverListe(cats.filter((x) => x !== c)), `Catégorie « ${c} » supprimée ✓`))}
                    title="Supprimer"
                    aria-label={`Supprimer ${c}`}
                  >
                    <Icon n="trash" size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="small muted">Renommer une catégorie met à jour tous ses articles. Les catégories apparaissent dans la caisse dès qu'un article y est rangé.</div>
      </div>
    </Modal>
  )
}

// Fiche article : photo + nom + prix + quantité suffisent, le reste est facultatif
export function ArticleForm({ article, onDone }) {
  const { documents, settings, api, toast } = useApp()
  const [ajoutCat, setAjoutCat] = useState(null)
  const [catsEnPlus, setCatsEnPlus] = useState([])
  const cats = useMemo(() => [...new Set([...categoriesDe(settings, documents), ...catsEnPlus])], [documents, settings, catsEnPlus])
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
    const nom = f.nom.trim()
    if (!nom) return toast("Indique le nom de l'article", true)
    if (!estNombre(f.prix) || !estNombre(f.stock) || !estNombre(f.prixAchat) || !estNombre(f.seuil)) return toast('Un prix ou une quantité contient autre chose que des chiffres', true)
    if (num(f.prix) <= 0) return toast('Indique le prix de vente', true)
    if (num(f.stock) < 0 || num(f.seuil) < 0 || num(f.prixAchat) < 0) return toast('Les quantités et les prix ne peuvent pas être négatifs', true)
    const doublon = articlesDe(documents).find((a) => a.id !== article?.id && a.nom.trim().toLowerCase() === nom.toLowerCase())
    if (doublon) return toast(`Un article porte déjà ce nom (${doublon.numero})`, true)
    setBusy(true)
    try {
      const data = { ...(article?.doc?.data || {}), ...f, nom, prix: num(f.prix), stock: num(f.stock), prixAchat: f.prixAchat === '' ? '' : num(f.prixAchat), seuil: num(f.seuil) }
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
        {ajoutCat === null ? (
          <button type="button" className="toggle-link" style={{ marginTop: 6 }} onClick={() => setAjoutCat('')}>
            + Nouvelle catégorie
          </button>
        ) : (
          <div className="row" style={{ marginTop: 6 }}>
            <input
              className="input sm"
              id="art-cat-nouvelle"
              autoFocus
              style={{ flex: 1 }}
              value={ajoutCat}
              onChange={(e) => setAjoutCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.nextSibling.click())}
              placeholder="Nom de la catégorie"
            />
            <button
              type="button"
              className="btn sm primary"
              onClick={() => {
                const n = ajoutCat.trim()
                if (!n) return setAjoutCat(null)
                const ex = cats.find((c) => c.toLowerCase() === n.toLowerCase())
                if (!ex) setCatsEnPlus((l) => [...l, n])
                set({ categorie: ex || n })
                setAjoutCat(null)
              }}
            >
              OK
            </button>
          </div>
        )}
      </Field>
      {!plus ? (
        <button type="button" className="toggle-link" onClick={() => setPlus(true)}>
          + Plus de détails (prix d'achat, marque, alerte de stock)
        </button>
      ) : (
        <div className="grid grid-2">
          <Field label="Prix d'achat (€)">
            <input className="input" id="art-achat" inputMode="numeric" value={f.prixAchat} onChange={(e) => set({ prixAchat: e.target.value })} />
            {num(f.prixAchat) > 0 && num(f.prix) > 0 && num(f.prixAchat) >= num(f.prix) && <div className="tiny orange">Prix d'achat supérieur ou égal au prix de vente : aucune marge.</div>}
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
  const { documents, profil } = useApp()
  const modifier = peut(profil, 'articles')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [filtre, setFiltre] = useState('')
  const [modal, setModal] = useState(null)
  const [gererCats, setGererCats] = useState(false)
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
          <div className="sub">{modifier ? "Une photo, un nom, un prix, une quantité : l'article apparaît aussitôt dans la caisse." : 'Prix et quantités en stock (consultation).'}</div>
        </div>
        {modifier && (
          <div className="row">
            <button className="btn" onClick={() => setGererCats(true)}>
              <Icon n="tag" size={15} /> Catégories
            </button>
            <button className="btn primary" onClick={() => setModal({})}>
              <Icon n="plus" size={16} /> Nouvel article
            </button>
          </div>
        )}
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
          <Empty>{modifier ? "Aucun article pour l'instant. Touche « Nouvel article » et prends le premier en photo." : "Aucun article pour l'instant."}</Empty>
        ) : !liste.length ? (
          <Empty>Aucun article ne correspond.</Empty>
        ) : (
          <div className="art-grid" style={{ marginTop: 12 }}>
            {liste.map((a) => {
              const [st, tone] = statutStock(a)
              return (
                <button key={a.id} className="art-card" disabled={!modifier} onClick={() => modifier && setModal({ article: a })}>
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
      {gererCats && <CategoriesModal onClose={() => setGererCats(false)} />}
      {modal && (
        <Modal title={modal.article ? modal.article.nom : 'Nouvel article'} onClose={() => setModal(null)} large>
          <ArticleForm article={modal.article} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}
