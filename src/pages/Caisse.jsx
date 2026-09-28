import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Modal, Chips, Empty, eur, go, deviseCode } from '../ui'
import { num, statutDe } from '../lib/invoice'
import { articlesDe, enregistrerVente, A_CREDIT } from '../lib/magasin'
import { Vignette, ArticleForm } from './Articles'

const lirePref = (k, d) => {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
const ecrirePref = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* préférence non gardée */
  }
}

// PDF de la facture : ouvert dans un nouvel onglet pour l'imprimer, ou téléchargé
export async function facturePdf(doc, { settings, actions }, action = 'imprimer') {
  const { pdfBlob, pdfNom } = await import('../lib/invoicePdf')
  const statut = statutDe(doc, actions)
  const paye = actions.filter((a) => a.action === 'Paiement reçu' && a.facture === doc.numero).reduce((m, a) => m + num(a.montant), 0)
  const blob = await pdfBlob(doc, { fact: settings.facturation, code: deviseCode(), statut, paye, datePaiement: paye ? doc.data?.date : '' })
  const url = URL.createObjectURL(blob)
  const w = action === 'imprimer' ? window.open(url, '_blank') : null
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    a.download = pdfNom(doc, settings.facturation)
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export default function Caisse() {
  const ctx = useApp()
  const { documents, settings, toast, actions } = ctx
  const articles = useMemo(() => articlesDe(documents), [documents])
  const equipe = settings.equipe?.length ? settings.equipe : ['Narcie KANGOU', 'Achille KANGOU', 'ITOUA']
  const modes = [...(settings.modesPaiement || ['Espèces']), A_CREDIT]
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [panier, setPanier] = useState([])
  const [client, setClient] = useState('')
  const [mode, setMode] = useState(modes[0])
  const [remise, setRemise] = useState('')
  const [vendeur, setVendeurState] = useState(() => lirePref('kgr-vendeur', equipe[0]))
  const [busy, setBusy] = useState(false)
  const [fin, setFin] = useState(null)
  const [nouvel, setNouvel] = useState(false)
  const [libre, setLibre] = useState(null)
  const setVendeur = (v) => {
    setVendeurState(v)
    ecrirePref('kgr-vendeur', v)
  }
  const cats = [...new Set(articles.map((a) => a.categorie).filter(Boolean))]
  const liste = articles.filter((a) => {
    const s = q.trim().toLowerCase()
    return (!s || [a.nom, a.numero, a.marque].some((x) => (x || '').toLowerCase().includes(s))) && (!cat || a.categorie === cat)
  })
  const ajouter = (a) => {
    setPanier((p) => {
      const l = p.find((x) => x.id === a.id)
      if (l) return p.map((x) => (x.id === a.id ? { ...x, qte: x.qte + 1 } : x))
      return [...p, { id: a.id, nom: a.nom, ref: a.numero, prix: a.prix, qte: 1, stock: a.stock, photo: a.photo }]
    })
  }
  const changer = (id, patch) => setPanier((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const retirer = (id) => setPanier((p) => p.filter((x) => x.id !== id))
  const sousTotal = panier.reduce((m, l) => m + num(l.qte) * num(l.prix), 0)
  const total = Math.max(0, sousTotal - num(remise))
  const nbArticles = panier.reduce((m, l) => m + num(l.qte), 0)
  const encaisser = async () => {
    if (!panier.length) return toast('Ajoute au moins un article', true)
    if (panier.some((l) => num(l.qte) <= 0)) return toast('Une quantité est à zéro', true)
    if (mode === A_CREDIT && !client.trim()) return toast('Vente à crédit : indique le nom du client', true)
    setBusy(true)
    try {
      const r = await enregistrerVente({ panier, client, mode, vendeur, remise }, ctx)
      setFin(r)
      setPanier([])
      setClient('')
      setRemise('')
      setMode(modes[0])
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  const ajouterLibre = () => {
    if (!libre?.nom?.trim() || !num(libre.prix)) return toast('Indique la désignation et le prix', true)
    setPanier((p) => [...p, { id: `libre-${Date.now()}`, nom: libre.nom.trim(), ref: '', prix: num(libre.prix), qte: 1, stock: null }])
    setLibre(null)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caisse</h1>
          <div className="sub">Touche un article pour l'ajouter au panier, puis encaisse : la facture est créée et classée toute seule.</div>
        </div>
        <div className="row">
          <label className="caisse-vendeur">
            <Icon n="users" size={15} />
            <select value={vendeur} onChange={(e) => setVendeur(e.target.value)} aria-label="Vendeur">
              {equipe.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => setNouvel(true)}>
            <Icon n="plus" size={15} /> Nouvel article
          </button>
        </div>
      </div>
      <div className="caisse">
        <div className="caisse-cat card">
          <div className="caisse-search">
            <Icon n="search" size={16} />
            <input id="caisse-q" placeholder="Chercher un article…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {cats.length > 1 && <Chips small options={cats} value={cat} onChange={setCat} />}
          {!articles.length ? (
            <Empty>
              Aucun article encore. <button className="toggle-link" onClick={() => setNouvel(true)}>Ajoute le premier en photo</button>
            </Empty>
          ) : (
            <div className="caisse-grid">
              {liste.map((a) => {
                const dans = panier.find((l) => l.id === a.id)?.qte || 0
                return (
                  <button key={a.id} className={`caisse-tile ${dans ? 'in' : ''} ${a.stock - dans <= 0 ? 'out' : ''}`} onClick={() => ajouter(a)}>
                    {dans > 0 && <span className="caisse-count">{dans}</span>}
                    <Vignette a={a} size={72} />
                    <span className="ct-nom">{a.nom}</span>
                    <span className="ct-prix">{eur(a.prix)}</span>
                    <span className="ct-stock">{a.stock - dans <= 0 ? 'Plus en stock' : `${a.stock - dans} dispo`}</span>
                  </button>
                )
              })}
              <button className="caisse-tile libre" onClick={() => setLibre({ nom: q, prix: '' })}>
                <Icon n="edit" size={22} />
                <span className="ct-nom">Article hors catalogue</span>
              </button>
            </div>
          )}
        </div>
        <div className="caisse-panier card">
          <div className="cp-head">
            <h2>Panier</h2>
            {panier.length > 0 && (
              <button className="toggle-link" onClick={() => setPanier([])}>
                Vider
              </button>
            )}
          </div>
          {!panier.length ? (
            <div className="cp-vide">Le panier est vide.</div>
          ) : (
            <div className="cp-lignes">
              {panier.map((l) => (
                <div className="cp-ligne" key={l.id}>
                  <div className="cp-info">
                    <div className="cp-nom">{l.nom}</div>
                    <div className="cp-pu">
                      <input className="cp-prix" inputMode="numeric" value={l.prix} onChange={(e) => changer(l.id, { prix: e.target.value })} aria-label={`Prix de ${l.nom}`} /> × {num(l.qte)}
                      {l.stock !== null && num(l.qte) > l.stock && <span className="cp-warn"> · stock : {l.stock}</span>}
                    </div>
                  </div>
                  <div className="cp-qte">
                    <button onClick={() => (l.qte > 1 ? changer(l.id, { qte: l.qte - 1 }) : retirer(l.id))} aria-label="Moins">−</button>
                    <input inputMode="numeric" value={l.qte} onChange={(e) => changer(l.id, { qte: e.target.value.replace(/\D/g, '') })} aria-label={`Quantité de ${l.nom}`} />
                    <button onClick={() => changer(l.id, { qte: num(l.qte) + 1 })} aria-label="Plus">+</button>
                  </div>
                  <div className="cp-total">{eur(num(l.qte) * num(l.prix))}</div>
                </div>
              ))}
            </div>
          )}
          <div className="cp-form">
            <input className="input" id="caisse-client" placeholder="Client (facultatif) : nom ou entreprise" value={client} onChange={(e) => setClient(e.target.value)} />
            <div className="cp-label">Paiement</div>
            <Chips small allowEmpty={false} options={modes} value={mode} onChange={setMode} />
            <div className="cp-remise">
              <span>Remise</span>
              <input className="input" id="caisse-remise" inputMode="numeric" placeholder="0" value={remise} onChange={(e) => setRemise(e.target.value)} />
            </div>
          </div>
          <div className="cp-sum">
            <span>
              Total{nbArticles ? ` · ${nbArticles} article${nbArticles > 1 ? 's' : ''}` : ''}
            </span>
            <strong>{eur(total)}</strong>
          </div>
          <button className="btn primary block cp-go" disabled={busy || !panier.length} onClick={encaisser}>
            <Icon n="check" size={18} /> {busy ? 'Enregistrement…' : mode === A_CREDIT ? 'Enregistrer la vente à crédit' : `Encaisser ${eur(total)}`}
          </button>
        </div>
      </div>
      {panier.length > 0 && (
        <div className="caisse-bar">
          <span>
            {nbArticles} article{nbArticles > 1 ? 's' : ''} · <strong>{eur(total)}</strong>
          </span>
          <button className="btn primary" disabled={busy} onClick={() => document.querySelector('.caisse-panier')?.scrollIntoView({ behavior: 'smooth' })}>
            Voir le panier
          </button>
        </div>
      )}
      {fin && (
        <Modal title="Vente enregistrée" onClose={() => setFin(null)}>
          <div className="stack vente-ok">
            <div className="vo-check">
              <Icon n="check" size={30} />
            </div>
            <div className="vo-total">{eur(fin.total)}</div>
            <div className="muted">
              Facture {fin.doc.numero} · {fin.doc.data.client.nom} · {fin.doc.data.vente.mode}
            </div>
            <div className="muted small">Classée dans Factures, et visible tout de suite sur le tableau de bord.</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => facturePdf(fin.doc, { settings, actions }).catch((e) => toast(`PDF impossible : ${e.message}`, true))}>
                <Icon n="file" size={16} /> Imprimer la facture
              </button>
              <button className="btn" onClick={() => facturePdf(fin.doc, { settings, actions }, 'telecharger').catch((e) => toast(`PDF impossible : ${e.message}`, true))}>
                <Icon n="download" size={16} /> PDF
              </button>
              <button className="btn" onClick={() => go(`/facture/${fin.doc.id}`)}>
                Ouvrir
              </button>
            </div>
            <button className="btn block" onClick={() => setFin(null)}>
              Nouvelle vente
            </button>
          </div>
        </Modal>
      )}
      {nouvel && (
        <Modal title="Nouvel article" onClose={() => setNouvel(false)} large>
          <ArticleForm onDone={() => setNouvel(false)} />
        </Modal>
      )}
      {libre && (
        <Modal title="Article hors catalogue" onClose={() => setLibre(null)}>
          <div className="stack">
            <input className="input" id="libre-nom" placeholder="Désignation" value={libre.nom} onChange={(e) => setLibre({ ...libre, nom: e.target.value })} autoFocus />
            <input className="input" id="libre-prix" inputMode="numeric" placeholder="Prix" value={libre.prix} onChange={(e) => setLibre({ ...libre, prix: e.target.value })} />
            <button className="btn primary" onClick={ajouterLibre}>
              Ajouter au panier
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
