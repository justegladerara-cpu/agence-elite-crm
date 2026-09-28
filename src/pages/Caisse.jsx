import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Modal, Empty, eur, nb, go, deviseCode, sym } from '../ui'
import { num, statutDe } from '../lib/invoice'
import { nowTime } from '../lib/dates'
import { getBrand } from '../lib/theme'
import { articlesDe, enregistrerVente, A_CREDIT } from '../lib/magasin'
import { Vignette, ArticleForm } from './Articles'
import { peut, membres } from '../lib/store'

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

// PDF de la facture (A4) ou du reçu (ticket 80 mm) : ouvert dans un nouvel onglet pour l'imprimer, ou téléchargé
export async function facturePdf(doc, { settings, actions }, action = 'imprimer', recu = false) {
  const { pdfBlob, pdfNom } = await import('../lib/invoicePdf')
  const statut = statutDe(doc, actions)
  const paye = actions.filter((a) => a.action === 'Paiement reçu' && a.facture === doc.numero).reduce((m, a) => m + num(a.montant), 0)
  const blob = recu
    ? await (await import('../lib/recuPdf')).recuBlob(doc, { fact: settings.facturation, code: deviseCode(), sym: sym(), paye })
    : await pdfBlob(doc, { fact: settings.facturation, code: deviseCode(), statut, paye, datePaiement: paye ? doc.data?.date : '' })
  const url = URL.createObjectURL(blob)
  const w = action === 'imprimer' ? window.open(url, '_blank') : null
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    a.download = recu ? `Recu_${doc.numero}.pdf` : pdfNom(doc, settings.facturation)
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}


const PAVE = [['1', '2', '3', 'qte'], ['4', '5', '6', 'remise'], ['7', '8', '9', 'prix'], ['C', '0', ',', 'del']]
const MODE_LBL = { qte: 'Qté', remise: '% Rem.', prix: 'Prix' }
const prixNet = (l) => num(l.prix) * (1 - Math.min(100, num(l.remise)) / 100)
const totalLigne = (l) => num(l.qte) * prixNet(l)

// Point de vente façon Odoo : articles en grandes images à gauche, ticket et pavé numérique à droite
export default function Caisse() {
  const ctx = useApp()
  const { documents, settings, toast, actions, profil } = ctx
  // Qui gère l'équipe peut enregistrer une vente au nom d'un autre vendeur
  const chef = peut(profil, 'equipe')
  const droitRemise = peut(profil, 'remises')
  const sansStock = peut(profil, 'sansStock')
  const articles = useMemo(() => articlesDe(documents), [documents])
  const [equipe, setEquipe] = useState(() => [profil?.nom].filter(Boolean))
  useEffect(() => {
    if (!chef) return
    membres
      .list()
      .then((l) => {
        const noms = l.filter((m) => peut(m, 'vendre') && m.nom).map((m) => m.nom)
        if (noms.length) setEquipe([...new Set([profil?.nom, ...noms].filter(Boolean))])
      })
      .catch(() => {})
  }, [chef, profil?.nom])
  const modes = [...(settings.modesPaiement || ['Espèces']), ...(peut(profil, 'credit') ? [A_CREDIT] : [])]
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [panier, setPanier] = useState([])
  const [sel, setSel] = useState(null)
  const [pave, setPave] = useState('qte')
  const [buffer, setBuffer] = useState(null)
  const [client, setClient] = useState('')
  const [vendeur, setVendeurState] = useState(() => (!chef && profil?.nom ? profil.nom : lirePref('kgr-vendeur', profil?.nom || equipe[0])))
  const [ecran, setEcran] = useState('produits')
  const [mode, setMode] = useState(modes[0])
  const [recu, setRecu] = useState('')
  const [busy, setBusy] = useState(false)
  const [fin, setFin] = useState(null)
  const [nouvel, setNouvel] = useState(false)
  const [choixClient, setChoixClient] = useState(false)
  const [heure, setHeure] = useState(nowTime())
  useEffect(() => {
    const t = setInterval(() => setHeure(nowTime()), 20000)
    return () => clearInterval(t)
  }, [])
  const setVendeur = (v) => {
    setVendeurState(v)
    ecrirePref('kgr-vendeur', v)
  }
  // Catégories avec l'image de leur premier article (comme les boutons de catégorie d'Odoo)
  const cats = useMemo(() => {
    const m = new Map()
    articles.forEach((a) => a.categorie && !m.has(a.categorie) && m.set(a.categorie, a))
    return [...m.entries()].map(([nom, a]) => ({ nom, a, n: articles.filter((x) => x.categorie === nom).length }))
  }, [articles])
  const liste = articles.filter((a) => {
    const s = q.trim().toLowerCase()
    return (!s || [a.nom, a.numero, a.marque, a.categorie].some((x) => (x || '').toLowerCase().includes(s))) && (!cat || a.categorie === cat)
  })
  const clientsConnus = useMemo(() => [...new Set(documents.filter((d) => d.type === 'facture' || d.type === 'devis').map((d) => d.data?.client?.nom).filter((n) => n && n !== 'Client comptoir'))].sort((a, b) => a.localeCompare(b, 'fr')), [documents])

  // Quantité de chaque article déjà dans le ticket
  const dansTicket = (id, p = panier) => p.filter((x) => x.id === id).reduce((m, x) => m + num(x.qte), 0)
  const ajouter = (a) => {
    if (!sansStock && dansTicket(a.id) + 1 > a.stock) return toast(a.stock > 0 ? `Plus que ${nb(a.stock)} « ${a.nom} » en stock` : `« ${a.nom} » est en rupture de stock`, true)
    setPanier((p) => {
      const l = p.find((x) => x.id === a.id && !num(x.remise))
      if (l) return p.map((x) => (x === l ? { ...x, qte: num(x.qte) + 1 } : x))
      return [...p, { key: `${a.id}-${Date.now()}`, id: a.id, nom: a.nom, ref: a.numero, prix: a.prix, qte: 1, remise: 0, stock: a.stock }]
    })
    setSel(a.id)
    setBuffer(null)
    setPave('qte')
  }
  const ligneSel = panier.find((l) => l.id === sel) || panier[panier.length - 1]
  const changer = (key, patch) => setPanier((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const touche = (k) => {
    if (['qte', 'remise', 'prix'].includes(k)) {
      if (k !== 'qte' && !droitRemise) return toast("Tu n'as pas le droit de faire des remises ni de changer les prix", true)
      setPave(k)
      setBuffer(null)
      return
    }
    if (!ligneSel) return
    const champ = pave
    if (k === 'del') {
      const base = buffer ?? String(num(ligneSel[champ]))
      // Comme dans Odoo : effacer une quantité déjà à zéro retire la ligne
      if (champ === 'qte' && (base === '' || base === '0')) {
        setPanier((p) => p.filter((x) => x.key !== ligneSel.key))
        setSel(null)
        setBuffer(null)
        return
      }
      const v = base.slice(0, -1)
      setBuffer(v)
      changer(ligneSel.key, { [champ]: num(v) })
      return
    }
    if (k === 'C') {
      setBuffer('')
      changer(ligneSel.key, { [champ]: 0 })
      return
    }
    let v = ((buffer ?? '') + (k === ',' ? '.' : k)).replace(/^0+(?=\d)/, '')
    if ((v.match(/\./g) || []).length > 1) return
    if (champ === 'remise' && num(v) > 100) v = '100'
    setBuffer(v)
    changer(ligneSel.key, { [champ]: num(v) })
  }
  const total = panier.reduce((m, l) => m + totalLigne(l), 0)
  const nbArticles = panier.reduce((m, l) => m + num(l.qte), 0)
  const recuN = num(recu)
  const rendu = mode === 'Espèces' && recuN > total ? recuN - total : 0
  const toucheRecu = (k) => {
    if (k === 'del') return setRecu((r) => r.slice(0, -1))
    if (k === 'C') return setRecu('')
    if (k.startsWith('+')) return setRecu((r) => String(num(r) + num(k.slice(1))))
    setRecu((r) => (r + k).replace(/^0+(?=\d)/, ''))
  }
  const payer = () => {
    if (!panier.length) return toast('Ajoute au moins un article', true)
    if (panier.some((l) => num(l.qte) <= 0)) return toast('Une quantité est à zéro', true)
    if (!sansStock) {
      const trop = [...new Set(panier.map((l) => l.id))].map((id) => articles.find((a) => a.id === id)).find((a) => a && dansTicket(a.id) > a.stock)
      if (trop) return toast(`Stock insuffisant : il reste ${nb(Math.max(0, trop.stock))} « ${trop.nom} »`, true)
    }
    setRecu('')
    setEcran('paiement')
  }
  const valider = async () => {
    if (mode === A_CREDIT && !client.trim()) return toast('Vente à crédit : choisis le client', true)
    if (mode === 'Espèces' && recu && recuN < total) return toast('Le montant reçu est inférieur au total', true)
    setBusy(true)
    try {
      const lignes = panier.map((l) => ({ ...l, nom: num(l.remise) ? `${l.nom} (remise ${nb(num(l.remise))} %)` : l.nom, prix: Math.round(prixNet(l)) }))
      const r = await enregistrerVente({ panier: lignes, client, mode, vendeur }, ctx)
      setFin({ ...r, rendu, recu: recuN })
      setEcran('recu')
      setPanier([])
      setSel(null)
      setClient('')
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  const nouvelle = () => {
    setFin(null)
    setMode(modes[0])
    setRecu('')
    setEcran('produits')
  }
  const imprimer = (recuTicket) => facturePdf(fin.doc, { settings, actions }, 'imprimer', recuTicket).catch((e) => toast(`Impression impossible : ${e.message}`, true))
  const brand = getBrand()

  return (
    <div className="pos">
      <header className="pos-top">
        <img className="pos-logo" src={brand.logo || '/logo-mark.png'} alt="" />
        <div className="pos-titre">
          <strong>Point de vente</strong>
          <span>{settings.facturation?.nom}</span>
        </div>
        {ecran === 'produits' && (
          <div className="pos-search">
            <Icon n="search" size={16} />
            <input id="pos-q" placeholder="Rechercher un article…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button onClick={() => setQ('')} aria-label="Effacer">
                <Icon n="x" size={14} />
              </button>
            )}
          </div>
        )}
        <div className="pos-right">
          {chef ? (
            <select className="pos-vendeur" value={vendeur} onChange={(e) => setVendeur(e.target.value)} aria-label="Vendeur">
              {[...new Set([vendeur, ...equipe])].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          ) : (
            <span className="pos-vendeur">{vendeur}</span>
          )}
          <span className="pos-heure">{heure}</span>
          {peut(profil, 'articles') && (
            <button className="pos-btn" onClick={() => setNouvel(true)} title="Ajouter un article">
              <Icon n="plus" size={16} /> <span>Article</span>
            </button>
          )}
          <button className="pos-btn" onClick={() => go(peut(profil, 'finances') ? '/ventes' : '/journal')} title="Quitter la caisse">
            <Icon n="logout" size={16} /> <span>Quitter</span>
          </button>
        </div>
      </header>

      {ecran === 'produits' && (
        <div className="pos-body">
          <section className="pos-produits">
            <div className="pos-cats">
              <button className={`pos-cat ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>
                <span className="pc-img pc-all"><Icon n="grid" size={22} /></span>
                <span className="pc-nom">Tout</span>
              </button>
              {cats.map((c) => (
                <button key={c.nom} className={`pos-cat ${cat === c.nom ? 'on' : ''}`} onClick={() => setCat(cat === c.nom ? '' : c.nom)}>
                  <span className="pc-img"><Vignette a={c.a} size={44} /></span>
                  <span className="pc-nom">{c.nom}</span>
                </button>
              ))}
            </div>
            {!articles.length ? (
              <Empty>
                Aucun article encore.{' '}
                {peut(profil, 'articles') && <button className="toggle-link" onClick={() => setNouvel(true)}>Ajoute le premier en photo</button>}
              </Empty>
            ) : !liste.length ? (
              <Empty>Aucun article ne correspond.</Empty>
            ) : (
              <div className="pos-grid">
                {liste.map((a) => {
                  const dans = panier.filter((l) => l.id === a.id).reduce((m, l) => m + num(l.qte), 0)
                  const reste = a.stock - dans
                  return (
                    <button key={a.id} className={`pos-card ${dans ? 'in' : ''} ${reste <= 0 ? 'out' : ''}`} onClick={() => ajouter(a)}>
                      <span className="pk-img">
                        <Vignette a={a} size={200} />
                        <span className="pk-prix">{eur(a.prix)}</span>
                        {dans > 0 && <span className="pk-qte">{nb(dans)}</span>}
                      </span>
                      <span className="pk-nom">{a.nom}</span>
                      <span className={`pk-stock ${reste <= 0 ? 'out' : reste <= a.seuil ? 'bas' : ''}`}>{reste <= 0 ? 'Rupture' : `${nb(reste)} en stock`}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {panier.length > 0 && (
            <button className="pos-mbar" onClick={() => document.querySelector('.pos-ticket')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>{nb(nbArticles)} article{nbArticles > 1 ? 's' : ''}</span>
              <strong>{eur(total)}</strong>
              <span>Voir le ticket</span>
            </button>
          )}
          <aside className="pos-ticket">
            <div className="pt-lignes">
              {!panier.length ? (
                <div className="pt-vide">
                  <Icon n="coins" size={34} />
                  <span>Touche un article pour commencer la vente</span>
                </div>
              ) : (
                panier.map((l) => (
                  <button key={l.key} className={`pt-ligne ${ligneSel?.key === l.key ? 'on' : ''}`} onClick={() => { setSel(l.id); setBuffer(null) }}>
                    <span className="pl-nom">{l.nom}</span>
                    <span className="pl-total">{eur(totalLigne(l))}</span>
                    <span className="pl-det">
                      <strong>{nb(num(l.qte), 2)}</strong> × {eur(num(l.prix))}
                      {num(l.remise) ? <em> · remise {nb(num(l.remise))} %</em> : null}
                      {l.stock !== null && num(l.qte) > l.stock && <em className="pl-warn"> · stock : {l.stock}</em>}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="pt-total">
              <span>Total</span>
              <strong>{eur(total)}</strong>
            </div>
            <div className="pt-actions">
              <button className="pt-client" onClick={() => setChoixClient(true)}>
                <Icon n="users" size={16} /> {client || 'Client'}
              </button>
              {panier.length > 0 && (
                <button className="pt-client" onClick={() => { setPanier([]); setSel(null) }}>
                  <Icon n="trash" size={16} /> Vider
                </button>
              )}
            </div>
            <div className="pt-pave">
              {PAVE.flat().map((k) => (
                <button key={k} className={`pv ${MODE_LBL[k] ? 'pv-mode' : ''} ${pave === k ? 'on' : ''} ${k === 'del' ? 'pv-del' : ''}`} disabled={(k === 'remise' || k === 'prix') && !droitRemise} onClick={() => touche(k)}>
                  {k === 'del' ? <Icon n="x" size={18} /> : MODE_LBL[k] || k}
                </button>
              ))}
            </div>
            <button className="pt-payer" disabled={!panier.length} onClick={payer}>
              <span>Paiement</span>
              <span>{nbArticles ? `${nb(nbArticles)} article${nbArticles > 1 ? 's' : ''}` : ''}</span>
              <Icon n="chevron" size={20} />
            </button>
          </aside>
        </div>
      )}

      {ecran === 'paiement' && (
        <div className="pos-pay">
          <div className="pay-top">
            <button className="pos-btn light" onClick={() => setEcran('produits')}>
              <Icon n="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /> Retour
            </button>
            <h2>Paiement</h2>
            <button className="pay-valider" disabled={busy} onClick={valider}>
              {busy ? 'Enregistrement…' : 'Valider'} <Icon n="check" size={18} />
            </button>
          </div>
          <div className="pay-body">
            <div className="pay-modes">
              <div className="pay-lbl">Moyen de paiement</div>
              {modes.map((m) => (
                <button key={m} className={`pay-mode ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
              <div className="pay-lbl" style={{ marginTop: 14 }}>Client</div>
              <button className="pay-mode" onClick={() => setChoixClient(true)}>
                <Icon n="users" size={16} /> {client || 'Client comptoir'}
              </button>
            </div>
            <div className="pay-centre">
              <div className="pay-du">
                <span>Montant à payer</span>
                <strong>{eur(total)}</strong>
              </div>
              {mode === 'Espèces' ? (
                <>
                  <div className="pay-recu">
                    <span>Montant reçu</span>
                    <strong>{recu ? eur(recuN) : '—'}</strong>
                  </div>
                  <div className={`pay-rendu ${rendu > 0 ? 'on' : ''}`}>
                    <span>Monnaie à rendre</span>
                    <strong>{eur(rendu)}</strong>
                  </div>
                  <div className="pay-pave">
                    {['1', '2', '3', '+5000', '4', '5', '6', '+10000', '7', '8', '9', '+50000', 'C', '0', '000', 'del'].map((k) => (
                      <button key={k} className={`pv ${k.startsWith('+') ? 'pv-mode' : ''}`} onClick={() => toucheRecu(k)}>
                        {k === 'del' ? <Icon n="x" size={18} /> : k.startsWith('+') ? `+${nb(num(k.slice(1)))}` : k}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="pay-info">
                  {mode === A_CREDIT
                    ? `Vente à crédit : la facture reste à encaisser${client ? ` au nom de ${client}` : ' (choisis le client)'}.`
                    : `Paiement par ${mode} : vérifie la réception de ${eur(total)} avant de valider.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ecran === 'recu' && fin && (
        <div className="pos-fin">
          <div className="fin-carte">
            <div className="vo-check">
              <Icon n="check" size={30} />
            </div>
            <h2>Paiement réussi</h2>
            <div className="vo-total">{eur(fin.total)}</div>
            {fin.rendu > 0 && <div className="fin-rendu">Monnaie à rendre : <strong>{eur(fin.rendu)}</strong></div>}
            <div className="muted">
              {fin.doc.numero} · {fin.doc.data.client.nom} · {fin.doc.data.vente.mode}
            </div>
            <div className="fin-ticket">
              {fin.doc.data.lignes.map((l, i) => (
                <div key={i} className="ft-l">
                  <span>{nb(num(l.qte))} × {l.designation}</span>
                  <span>{eur(num(l.qte) * num(l.pu))}</span>
                </div>
              ))}
            </div>
            <div className="fin-btns">
              <button className="btn" onClick={() => imprimer(true)}>
                <Icon n="note" size={16} /> Imprimer le reçu
              </button>
              <button className="btn" onClick={() => imprimer(false)}>
                <Icon n="file" size={16} /> Facture A4
              </button>
            </div>
            <button className="pay-valider big" onClick={nouvelle}>
              Nouvelle vente <Icon n="chevron" size={18} />
            </button>
          </div>
        </div>
      )}

      {nouvel && (
        <Modal title="Nouvel article" onClose={() => setNouvel(false)} large>
          <ArticleForm onDone={() => setNouvel(false)} />
        </Modal>
      )}
      {choixClient && <ChoixClient clients={clientsConnus} valeur={client} onChoix={(c) => { setClient(c); setChoixClient(false) }} onClose={() => setChoixClient(false)} />}
    </div>
  )
}

function ChoixClient({ clients, valeur, onChoix, onClose }) {
  const [q, setQ] = useState(valeur || '')
  const s = q.trim().toLowerCase()
  const liste = clients.filter((c) => !s || c.toLowerCase().includes(s))
  return (
    <Modal title="Client" onClose={onClose}>
      <div className="stack">
        <input className="input" id="pos-client" placeholder="Nom du client ou de l'entreprise" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        {q.trim() && !clients.some((c) => c.toLowerCase() === s) && (
          <button className="btn primary" onClick={() => onChoix(q.trim())}>
            <Icon n="plus" size={15} /> Nouveau client : {q.trim()}
          </button>
        )}
        <div className="client-liste">
          <button className="cl-item" onClick={() => onChoix('')}>Client comptoir (sans nom)</button>
          {liste.map((c) => (
            <button key={c} className={`cl-item ${c === valeur ? 'on' : ''}`} onClick={() => onChoix(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
