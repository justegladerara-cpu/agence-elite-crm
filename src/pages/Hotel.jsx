import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Modal, Empty, eur, nb, go } from '../ui'
import { num } from '../lib/invoice'
import { today, nowTime, addDays, fmtDate, diffDays } from '../lib/dates'
import { getBrand } from '../lib/theme'
import { peut, uid } from '../lib/store'
import { photoArticle } from '../lib/magasin'
import { facturePdf } from './Caisse'
import {
  ZONES, CATEGORIES_CHAMBRE, CATEGORIES_CARTE, TEINTES,
  chambresDe, tablesDe, platsDe, sejoursEnCours, commandesOuvertes, numeroInterne,
  folio, nuitsPrevues, arrivee, ajouterSurNote, encaisser, depart, lignesCommande, prixNet, totalLignes, imprimerTicket, etatHotel,
} from '../lib/hotel'

const PAVE = [['1', '2', '3', 'qte'], ['4', '5', '6', 'remise'], ['7', '8', '9', 'prix'], ['C', '0', ',', 'del']]
const MODE_LBL = { qte: 'Qté', remise: '% Rem.', prix: 'Prix' }
const lire = (k, d) => {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
const ecrire = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* préférence non gardée */
  }
}
const depuis = (iso) => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

// Vignette d'un plat : photo, sinon pictogramme sur la couleur de sa catégorie
export function PlatImg({ p, size = 56 }) {
  if (p.photo) return <img className="art-img" src={p.photo} alt="" style={{ width: size, height: size }} />
  return (
    <span className="plat-img" style={{ width: size, height: size, fontSize: size * 0.46, background: TEINTES[p.categorie] || '#eef0f4' }} aria-hidden="true">
      {p.emoji || (p.nom || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

// Point de vente de l'hôtel, façon Odoo Restaurant : plan de salle, chambres, commande, note de chambre, encaissement
export default function Hotel() {
  const ctx = useApp()
  const { documents, settings, toast, actions, profil, api } = ctx
  const moi = profil?.nom || profil?.email || ''
  const droitRemise = peut(profil, 'remises')
  const config = peut(profil, 'articles')
  const chambres = useMemo(() => chambresDe(documents), [documents])
  const tables = useMemo(() => tablesDe(documents), [documents])
  const plats = useMemo(() => platsDe(documents), [documents])
  const sejours = useMemo(() => sejoursEnCours(documents), [documents])
  const commandes = useMemo(() => commandesOuvertes(documents), [documents])
  const sejourDe = (chambreId) => sejours.find((s) => s.data.chambreId === chambreId)
  const commandeDe = (tableId) => commandes.find((c) => c.data.tableId === tableId)

  const [vue, setVueState] = useState(() => (lire('hotel-vue', 'salle') === 'chambres' ? 'chambres' : 'salle'))
  const setVue = (v) => {
    setVueState(v)
    if (v === 'salle' || v === 'chambres') ecrire('hotel-vue', v)
  }
  const [cible, setCible] = useState(null) // { kind: 'table', tableId } | { kind: 'chambre', sejourId } | { kind: 'direct' }
  const [folioId, setFolioId] = useState(null)
  const [paiement, setPaiement] = useState(null)
  const [fin, setFin] = useState(null)
  const [modal, setModal] = useState(null)
  const [heure, setHeure] = useState(nowTime())
  useEffect(() => {
    const t = setInterval(() => setHeure(nowTime()), 20000)
    return () => clearInterval(t)
  }, [])

  // ---------- Commande en cours ----------
  const [lignes, setLignes] = useState([])
  const [couverts, setCouverts] = useState(0)
  const [cmdId, setCmdId] = useState(null)
  const sale = useRef(false)
  const [sel, setSel] = useState(null)
  const [pave, setPave] = useState('qte')
  const [buffer, setBuffer] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')

  const table = cible?.kind === 'table' ? tables.find((t) => t.id === cible.tableId) : null
  const sejourCible = cible?.kind === 'chambre' ? documents.find((d) => d.id === cible.sejourId) : null

  // Enregistre la commande de la table (création, mise à jour, ou libération si elle est vide)
  const sauver = useCallback(
    async (l = lignes, c = couverts, id = cmdId, t = table) => {
      if (!t) return
      sale.current = false
      const doc = documents.find((d) => d.id === id)
      if (!l.length) {
        if (doc && doc.data.statut === 'ouverte') await api.saveDoc({ ...doc, data: { ...doc.data, lignes: [], statut: 'annulee' } })
        return
      }
      await api.saveDoc({
        id,
        type: 'commande',
        numero: doc?.numero || numeroInterne(documents, 'commande', 'CMD'),
        prospect_id: null,
        created_at: doc?.created_at,
        data: { ...(doc?.data || { ouverte: new Date().toISOString(), serveur: moi }), statut: 'ouverte', tableId: t.id, table: t.nom, zone: t.zone, lignes: l, couverts: c },
      })
    },
    [lignes, couverts, cmdId, table, documents, api, moi],
  )
  // Sauvegarde automatique une seconde après la dernière touche
  useEffect(() => {
    if (!sale.current || cible?.kind !== 'table') return
    const t = setTimeout(() => sauver().catch(() => {}), 1000)
    return () => clearTimeout(t)
  }, [lignes, couverts]) // eslint-disable-line react-hooks/exhaustive-deps
  const modifier = (f) => {
    sale.current = true
    setLignes(f)
  }

  const ouvrirTable = (t) => {
    const c = commandeDe(t.id)
    setCible({ kind: 'table', tableId: t.id })
    setLignes(c?.data.lignes || [])
    setCouverts(c?.data.couverts || 0)
    setCmdId(c?.id || uid())
    sale.current = false
    setSel(null)
    setQ('')
    setVue('commande')
    if (!c) setModal({ t: 'couverts', places: t.places })
  }
  const ouvrirChambre = (s) => {
    setCible({ kind: 'chambre', sejourId: s.id })
    setLignes([])
    setCmdId(null)
    setSel(null)
    setQ('')
    setVue('commande')
  }
  const venteDirecte = () => {
    setCible({ kind: 'direct' })
    setLignes([])
    setCmdId(null)
    setSel(null)
    setQ('')
    setVue('commande')
  }
  const quitterCommande = async () => {
    if (cible?.kind === 'table' && sale.current) await sauver().catch(() => {})
    if (cible?.kind === 'chambre' && lignes.length && !window.confirm('Les articles non ajoutés à la chambre seront perdus. Quitter ?')) return
    setCible(null)
    setVue(cible?.kind === 'chambre' ? 'chambres' : 'salle')
  }

  const cats = useMemo(() => {
    const presentes = new Set(plats.map((p) => p.categorie))
    return [...CATEGORIES_CARTE.filter((c) => presentes.has(c)), ...[...presentes].filter((c) => c && !CATEGORIES_CARTE.includes(c))].map((nom) => ({ nom, p: plats.find((x) => x.categorie === nom) }))
  }, [plats])
  // Dans « Tout », la carte suit l'ordre des catégories (petit-déjeuner, entrées, plats…)
  const rang = (c) => (CATEGORIES_CARTE.includes(c) ? CATEGORIES_CARTE.indexOf(c) : 99)
  const liste = plats
    .filter((p) => {
      const s = q.trim().toLowerCase()
      return (!s || [p.nom, p.categorie].some((x) => (x || '').toLowerCase().includes(s))) && (!cat || p.categorie === cat)
    })
    .sort((a, b) => rang(a.categorie) - rang(b.categorie))
  const ajouter = (p) => {
    modifier((l) => {
      const x = l.find((y) => y.id === p.id && !num(y.remise) && !(num(y.envoye) >= num(y.qte) && cible?.kind === 'table'))
      if (x) return l.map((y) => (y === x ? { ...y, qte: num(y.qte) + 1 } : y))
      return [...l, { key: `${p.id}-${Date.now()}`, id: p.id, nom: p.nom, prix: p.prix, categorie: p.categorie, qte: 1, remise: 0, envoye: 0 }]
    })
    setSel(null)
    setBuffer(null)
    setPave('qte')
  }
  const ligneSel = lignes.find((l) => l.key === sel) || lignes[lignes.length - 1]
  const changer = (key, patch) => modifier((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const touche = (k) => {
    if (MODE_LBL[k]) {
      if (k !== 'qte' && !droitRemise) return toast("Tu n'as pas le droit de faire des remises ni de changer les prix", true)
      setPave(k)
      setBuffer(null)
      return
    }
    if (!ligneSel) return
    const champ = pave
    if (k === 'del') {
      const base = buffer ?? String(num(ligneSel[champ]))
      if (champ === 'qte' && (base === '' || base === '0')) {
        modifier((l) => l.filter((x) => x.key !== ligneSel.key))
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
  const total = totalLignes(lignes)
  const nbArticles = lignes.reduce((m, l) => m + num(l.qte), 0)
  const aEnvoyer = lignes.filter((l) => num(l.qte) > num(l.envoye))

  // Bon pour la cuisine et le bar : seulement ce qui n'a pas encore été envoyé
  const envoyerCuisine = async () => {
    if (!aEnvoyer.length) return toast('Tout a déjà été envoyé en cuisine')
    const ok = imprimerTicket(
      'Bon de commande',
      [`${table?.zone || ''} · ${table?.nom || ''}`, `${couverts ? `${couverts} couvert${couverts > 1 ? 's' : ''} · ` : ''}${moi} · ${nowTime()}`],
      aEnvoyer.map((l) => ({ q: `${nb(num(l.qte) - num(l.envoye), 2)}×`, n: l.nom, d: l.categorie })),
    )
    const nl = lignes.map((l) => ({ ...l, envoye: num(l.qte) }))
    sale.current = true
    setLignes(nl)
    await sauver(nl).catch(() => {})
    toast(ok ? 'Envoyé en cuisine ✓' : 'Commande marquée envoyée (impression bloquée par le navigateur)')
  }
  const addition = () => {
    const ok = imprimerTicket(
      settings.facturation?.nom || 'Addition',
      ['ADDITION', `${table ? `${table.zone} · ${table.nom}` : 'Vente directe'}${couverts ? ` · ${couverts} couvert${couverts > 1 ? 's' : ''}` : ''}`, `${fmtDate(today())} ${nowTime()}`],
      lignes.map((l) => ({ q: `${nb(num(l.qte), 2)}×`, n: l.nom, d: num(l.remise) ? `remise ${nb(num(l.remise))} %` : '', m: eur(num(l.qte) * prixNet(l)) })),
      `<div class="t"><span>Total</span><span>${eur(total)}</span></div>`,
    )
    if (!ok) toast("Autorise les fenêtres pour imprimer l'addition", true)
  }
  const verifier = () => {
    if (!lignes.length) return toast('Ajoute au moins un article', true) || false
    if (lignes.some((l) => num(l.qte) <= 0)) return toast('Une quantité est à zéro', true) || false
    return true
  }
  const payerCommande = () => verifier() && (setPaiement({ kind: 'commande', total }), setVue('paiement'))
  // Restaurant ou bar : la note va sur la chambre du client, payée au départ
  const surChambre = async (sejourDoc) => {
    setModal(null)
    const lieu = table ? `${table.zone} · ${table.nom}` : 'Vente directe'
    await ajouterSurNote(sejourDoc, lignes.filter((l) => num(l.qte) > 0).map((l) => ({ ...l, nom: num(l.remise) ? `${l.nom} (remise ${nb(num(l.remise))} %)` : l.nom, prix: prixNet(l) })), lieu, moi, ctx)
    if (table) {
      const doc = documents.find((d) => d.id === cmdId)
      await api.saveDoc({ id: cmdId, type: 'commande', numero: doc?.numero || numeroInterne(documents, 'commande', 'CMD'), prospect_id: null, data: { ...(doc?.data || {}), tableId: table.id, table: table.nom, lignes, couverts, statut: 'transferee', chambre: sejourDoc.data.chambre } })
    }
    toast(`${eur(total)} ajoutés sur la chambre ${sejourDoc.data.chambre} ✓`)
    sale.current = false
    setLignes([])
    setCible(null)
    setVue('salle')
  }
  const validerRoomService = async () => {
    if (!verifier()) return
    const origine = (l) => (l.categorie === 'Minibar' ? 'Minibar' : l.categorie === 'Services' ? 'Services' : 'Room service')
    const groupes = {}
    lignes.forEach((l) => (groupes[origine(l)] = [...(groupes[origine(l)] || []), l]))
    let doc = sejourCible
    for (const [o, ls] of Object.entries(groupes)) doc = await ajouterSurNote(doc, ls.map((l) => ({ ...l, nom: num(l.remise) ? `${l.nom} (remise ${nb(num(l.remise))} %)` : l.nom, prix: prixNet(l) })), o, moi, ctx)
    toast(`${eur(total)} ajoutés sur la chambre ${sejourCible.data.chambre} ✓`)
    setLignes([])
    setFolioId(sejourCible.id)
    setCible(null)
    setVue('folio')
  }

  // ---------- Encaissement ----------
  const modes = settings.modesPaiement || ['Espèces']
  const [mode, setMode] = useState(modes[0])
  const [recu, setRecu] = useState('')
  const [client, setClient] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (vue === 'paiement') {
      setRecu('')
      setMode(modes[0])
      setClient(paiement?.kind === 'depart' ? '' : '')
    }
  }, [vue]) // eslint-disable-line react-hooks/exhaustive-deps
  const du = paiement?.total || 0
  const recuN = num(recu)
  const rendu = mode === 'Espèces' && recuN > du ? recuN - du : 0
  const toucheRecu = (k) => {
    if (k === 'del') return setRecu((r) => r.slice(0, -1))
    if (k === 'C') return setRecu('')
    if (k.startsWith('+')) return setRecu((r) => String(num(r) + num(k.slice(1))))
    setRecu((r) => (r + k).replace(/^0+(?=\d)/, ''))
  }
  const valider = async () => {
    if (mode === 'Espèces' && recu && recuN < du) return toast('Le montant reçu est inférieur au total', true)
    setBusy(true)
    try {
      let r
      if (paiement.kind === 'depart') {
        const s = documents.find((d) => d.id === paiement.sejourId)
        r = await depart(s, { mode, vendeur: moi }, ctx)
        setFin({ ...r, rendu, retour: 'chambres', titre: `Départ enregistré · chambre ${s.data.chambre}` })
      } else {
        const lieu = table ? `${table.zone} · ${table.nom}` : 'Vente directe'
        r = await encaisser({ lignes: lignesCommande(lignes), client: client || (table ? `Client ${table.zone.toLowerCase()}` : 'Client de passage'), mode, vendeur: moi, objet: lieu }, ctx)
        if (table) {
          const doc = documents.find((d) => d.id === cmdId)
          if (doc) await api.saveDoc({ ...doc, data: { ...doc.data, lignes, couverts, statut: 'payee', factureNumero: r.doc.numero } })
        }
        sale.current = false
        setLignes([])
        setFin({ ...r, rendu, retour: 'salle', titre: 'Paiement réussi' })
      }
      setCible(null)
      setVue('fin')
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  const imprimer = (ticket) => facturePdf(fin.doc, { settings, actions }, 'imprimer', ticket).catch((e) => toast(`Impression impossible : ${e.message}`, true))

  const brand = getBrand()
  const folioDoc = folioId ? documents.find((d) => d.id === folioId) : null
  const etat = etatHotel(documents)

  return (
    <div className="pos hotel">
      <header className="pos-top">
        <img className="pos-logo" src={brand.logo || '/logo-mark.png'} alt="" />
        <div className="pos-titre">
          <strong>Hôtel</strong>
          <span>{settings.facturation?.nom}</span>
        </div>
        <nav className="ho-tabs">
          <button className={vue === 'salle' || (vue === 'commande' && cible?.kind !== 'chambre') ? 'on' : ''} onClick={() => (vue === 'commande' ? quitterCommande() : setVue('salle'))}>
            <Icon n="grid" size={16} /> <span>Salle</span>
          </button>
          <button className={vue === 'chambres' || vue === 'folio' || cible?.kind === 'chambre' ? 'on' : ''} onClick={async () => { if (vue === 'commande' && cible?.kind === 'table' && sale.current) await sauver().catch(() => {}); setCible(null); setVue('chambres') }}>
            <Icon n="layers" size={16} /> <span>Chambres</span>
          </button>
          {vue === 'commande' && (
            <span className="ho-cible">
              {cible?.kind === 'table' ? `${table?.nom || ''}${couverts ? ` · ${couverts} pers.` : ''}` : cible?.kind === 'chambre' ? `Chambre ${sejourCible?.data.chambre} · room service` : 'Vente directe'}
            </span>
          )}
        </nav>
        {vue === 'commande' && (
          <div className="pos-search">
            <Icon n="search" size={16} />
            <input placeholder="Rechercher un plat, une boisson…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button onClick={() => setQ('')} aria-label="Effacer">
                <Icon n="x" size={14} />
              </button>
            )}
          </div>
        )}
        <div className="pos-right">
          <span className="pos-vendeur">{moi}</span>
          <span className="pos-heure">{heure}</span>
          {config && (
            <button className="pos-btn" onClick={() => setModal({ t: 'reglages' })} title="Chambres, tables et carte">
              <Icon n="settings" size={16} /> <span>Réglages</span>
            </button>
          )}
          <button className="pos-btn" onClick={() => go(peut(profil, 'finances') ? '/ventes' : '/journal')} title="Quitter le point de vente">
            <Icon n="logout" size={16} /> <span>Quitter</span>
          </button>
        </div>
      </header>

      {vue === 'salle' && <Salle tables={tables} commandeDe={commandeDe} onTable={ouvrirTable} onDirect={venteDirecte} config={config} onConfig={() => setModal({ t: 'reglages', onglet: 'tables' })} />}

      {vue === 'chambres' && (
        <Chambres
          chambres={chambres}
          sejourDe={sejourDe}
          etat={etat}
          config={config}
          onConfig={() => setModal({ t: 'reglages', onglet: 'chambres' })}
          onLibre={(c) => setModal({ t: 'arrivee', chambre: c })}
          onOccupee={(s) => { setFolioId(s.id); setVue('folio') }}
          onMenage={async (c) => { await api.saveDoc({ ...c.doc, data: { ...c.doc.data, menage: false } }); toast(`Chambre ${c.nom} prête ✓`) }}
        />
      )}

      {vue === 'folio' && folioDoc && (
        <Folio
          doc={folioDoc}
          profil={profil}
          onRetour={() => setVue('chambres')}
          onExtras={() => ouvrirChambre(folioDoc)}
          onAcompte={() => setModal({ t: 'acompte', sejour: folioDoc })}
          onProlonger={() => setModal({ t: 'prolonger', sejour: folioDoc })}
          onDepart={() => { setPaiement({ kind: 'depart', sejourId: folioDoc.id, total: folio(folioDoc).reste }); setVue('paiement') }}
          onRetirer={async (id) => { await api.saveDoc({ ...folioDoc, data: { ...folioDoc.data, lignes: folioDoc.data.lignes.filter((l) => l.id !== id) } }); toast('Ligne retirée de la note') }}
          onImprimer={() => {
            const s = folioDoc.data
            const f = folio(s)
            imprimerTicket(settings.facturation?.nom || 'Note', [`NOTE · CHAMBRE ${s.chambre}`, s.client?.nom, `Arrivée ${fmtDate(s.arrivee)} · ${f.nuits} nuit${f.nuits > 1 ? 's' : ''}`], [{ q: `${f.nuits}×`, n: 'Hébergement', m: eur(f.hebergement) }, ...(s.lignes || []).map((l) => ({ q: `${nb(num(l.qte), 2)}×`, n: l.designation, d: `${fmtDate(l.date)} · ${l.origine}`, m: eur(num(l.qte) * num(l.pu)) }))], `<div class="t"><span>Total</span><span>${eur(f.total)}</span></div>${f.acomptes ? `<div class="l"><span>Acomptes</span><span>- ${eur(f.acomptes)}</span></div><div class="t"><span>Reste à payer</span><span>${eur(f.reste)}</span></div>` : ''}`) || toast("Autorise les fenêtres pour imprimer la note", true)
          }}
        />
      )}

      {vue === 'commande' && (
        <div className="pos-body">
          <section className="pos-produits">
            <div className="pos-cats">
              <button className={`pos-cat ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>
                <span className="pc-img pc-all"><Icon n="grid" size={22} /></span>
                <span className="pc-nom">Tout</span>
              </button>
              {cats.map((c) => (
                <button key={c.nom} className={`pos-cat ${cat === c.nom ? 'on' : ''}`} onClick={() => setCat(cat === c.nom ? '' : c.nom)}>
                  <span className="pc-img"><PlatImg p={c.p} size={44} /></span>
                  <span className="pc-nom">{c.nom}</span>
                </button>
              ))}
            </div>
            {!plats.length ? (
              <Empty>
                La carte est vide.{' '}
                {config && <button className="toggle-link" onClick={() => setModal({ t: 'reglages', onglet: 'carte' })}>Ajoute les plats et boissons</button>}
              </Empty>
            ) : !liste.length ? (
              <Empty>Aucun article ne correspond.</Empty>
            ) : (
              <div className="pos-grid">
                {liste.map((p) => {
                  const dans = lignes.filter((l) => l.id === p.id).reduce((m, l) => m + num(l.qte), 0)
                  return (
                    <button key={p.id} className={`pos-card ${dans ? 'in' : ''}`} onClick={() => ajouter(p)}>
                      <span className="pk-img">
                        <PlatImg p={p} size={200} />
                        <span className="pk-prix">{eur(p.prix)}</span>
                        {dans > 0 && <span className="pk-qte">{nb(dans)}</span>}
                      </span>
                      <span className="pk-nom">{p.nom}</span>
                      <span className="pk-stock">{p.categorie}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {lignes.length > 0 && (
            <button className="pos-mbar" onClick={() => document.querySelector('.pos-ticket')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>{nb(nbArticles)} article{nbArticles > 1 ? 's' : ''}</span>
              <strong>{eur(total)}</strong>
              <span>Voir le ticket</span>
            </button>
          )}
          <aside className="pos-ticket">
            <div className="ho-ticket-head">
              <button className="ho-back" onClick={quitterCommande}>
                <Icon n="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> {cible?.kind === 'chambre' ? 'Chambres' : 'Plan de salle'}
              </button>
              <strong>{cible?.kind === 'table' ? `${table?.zone} · ${table?.nom}` : cible?.kind === 'chambre' ? `Chambre ${sejourCible?.data.chambre}` : 'Vente directe'}</strong>
              {cible?.kind === 'table' && (
                <button className="ho-couverts" onClick={() => setModal({ t: 'couverts', places: table?.places })}>
                  <Icon n="users" size={14} /> {couverts || '–'}
                </button>
              )}
              {cible?.kind === 'chambre' && <span className="muted">{sejourCible?.data.client?.nom}</span>}
            </div>
            <div className="pt-lignes">
              {!lignes.length ? (
                <div className="pt-vide">
                  <Icon n="note" size={34} />
                  <span>Touche un plat ou une boisson pour commencer la commande</span>
                </div>
              ) : (
                lignes.map((l) => (
                  <button key={l.key} className={`pt-ligne ${ligneSel?.key === l.key ? 'on' : ''}`} onClick={() => { setSel(l.key); setBuffer(null) }}>
                    <span className="pl-nom">
                      {cible?.kind === 'table' && <i className={`ho-dot ${num(l.envoye) >= num(l.qte) ? 'ok' : ''}`} title={num(l.envoye) >= num(l.qte) ? 'Envoyé en cuisine' : 'Pas encore envoyé'} />}
                      {l.nom}
                    </span>
                    <span className="pl-total">{eur(num(l.qte) * prixNet(l))}</span>
                    <span className="pl-det">
                      <strong>{nb(num(l.qte), 2)}</strong> × {eur(num(l.prix))}
                      {num(l.remise) ? <em> · remise {nb(num(l.remise))} %</em> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="pt-total">
              <span>Total</span>
              <strong>{eur(total)}</strong>
            </div>
            {cible?.kind !== 'chambre' && (
              <div className="pt-actions">
                {cible?.kind === 'table' && (
                  <button className={`pt-client ${aEnvoyer.length ? 'ho-hot' : ''}`} disabled={!lignes.length} onClick={envoyerCuisine}>
                    <Icon n="send" size={16} /> Cuisine{aEnvoyer.length ? ` (${aEnvoyer.length})` : ''}
                  </button>
                )}
                <button className="pt-client" disabled={!lignes.length} onClick={addition}>
                  <Icon n="note" size={16} /> Addition
                </button>
                <button className="pt-client" disabled={!lignes.length || !sejours.length} onClick={() => verifier() && setModal({ t: 'surChambre' })}>
                  <Icon n="layers" size={16} /> Sur chambre
                </button>
              </div>
            )}
            <div className="pt-pave">
              {PAVE.flat().map((k) => (
                <button key={k} className={`pv ${MODE_LBL[k] ? 'pv-mode' : ''} ${pave === k ? 'on' : ''} ${k === 'del' ? 'pv-del' : ''}`} disabled={(k === 'remise' || k === 'prix') && !droitRemise} onClick={() => touche(k)}>
                  {k === 'del' ? <Icon n="x" size={18} /> : MODE_LBL[k] || k}
                </button>
              ))}
            </div>
            {cible?.kind === 'chambre' ? (
              <button className="pt-payer" disabled={!lignes.length} onClick={validerRoomService}>
                <span>Ajouter à la chambre {sejourCible?.data.chambre}</span>
                <Icon n="check" size={20} />
              </button>
            ) : (
              <button className="pt-payer" disabled={!lignes.length} onClick={payerCommande}>
                <span>Paiement</span>
                <span>{nbArticles ? `${nb(nbArticles)} article${nbArticles > 1 ? 's' : ''}` : ''}</span>
                <Icon n="chevron" size={20} />
              </button>
            )}
          </aside>
        </div>
      )}

      {vue === 'paiement' && paiement && (
        <div className="pos-pay">
          <div className="pay-top">
            <button className="pos-btn light" onClick={() => setVue(paiement.kind === 'depart' ? 'folio' : 'commande')}>
              <Icon n="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /> Retour
            </button>
            <h2>{paiement.kind === 'depart' ? 'Départ et encaissement' : 'Paiement'}</h2>
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
              {paiement.kind !== 'depart' && (
                <>
                  <div className="pay-lbl" style={{ marginTop: 14 }}>Nom sur la facture (facultatif)</div>
                  <input className="input" placeholder={table ? `Client ${table.zone.toLowerCase()}` : 'Client de passage'} value={client} onChange={(e) => setClient(e.target.value)} />
                </>
              )}
            </div>
            <div className="pay-centre">
              {paiement.kind === 'depart' && <DetailDepart doc={documents.find((d) => d.id === paiement.sejourId)} />}
              <div className="pay-du">
                <span>{paiement.kind === 'depart' ? 'Reste à payer' : 'Montant à payer'}</span>
                <strong>{eur(du)}</strong>
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
                <div className="pay-info">Paiement par {mode} : vérifie la réception de {eur(du)} avant de valider.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {vue === 'fin' && fin && (
        <div className="pos-fin">
          <div className="fin-carte">
            <div className="vo-check">
              <Icon n="check" size={30} />
            </div>
            <h2>{fin.titre}</h2>
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
            <button className="pay-valider big" onClick={() => { setFin(null); setVue(fin.retour) }}>
              {fin.retour === 'chambres' ? 'Retour aux chambres' : 'Retour au plan de salle'} <Icon n="chevron" size={18} />
            </button>
          </div>
        </div>
      )}

      {modal?.t === 'couverts' && (
        <Couverts
          places={modal.places}
          valeur={couverts}
          onClose={() => setModal(null)}
          onChoix={(n) => {
            sale.current = lignes.length > 0
            setCouverts(n)
            setModal(null)
          }}
        />
      )}
      {modal?.t === 'surChambre' && <ChoixChambre sejours={sejours} total={total} onClose={() => setModal(null)} onChoix={surChambre} />}
      {modal?.t === 'arrivee' && <Arrivee chambre={modal.chambre} onClose={() => setModal(null)} onDone={(s) => { setModal(null); setFolioId(s.id); setVue('folio') }} />}
      {modal?.t === 'acompte' && <Acompte sejour={modal.sejour} onClose={() => setModal(null)} />}
      {modal?.t === 'prolonger' && <Prolonger sejour={modal.sejour} onClose={() => setModal(null)} />}
      {modal?.t === 'reglages' && <Reglages onglet={modal.onglet} onClose={() => setModal(null)} />}
    </div>
  )
}

// ---------- Plan de salle ----------
function Salle({ tables, commandeDe, onTable, onDirect, config, onConfig }) {
  const zones = [...ZONES.filter((z) => tables.some((t) => t.zone === z)), ...[...new Set(tables.map((t) => t.zone))].filter((z) => z && !ZONES.includes(z))]
  const [zone, setZone] = useState(() => lire('hotel-zone', ''))
  const z = zones.includes(zone) ? zone : zones[0]
  const [, tic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tic((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const liste = tables.filter((t) => t.zone === z)
  const occupees = tables.filter((t) => commandeDe(t.id)).length
  return (
    <div className="ho-page">
      <div className="ho-bar">
        <div className="ho-zones">
          {zones.map((x) => (
            <button key={x} className={x === z ? 'on' : ''} onClick={() => { setZone(x); ecrire('hotel-zone', x) }}>
              {x}
              <span>{tables.filter((t) => t.zone === x && commandeDe(t.id)).length}/{tables.filter((t) => t.zone === x).length}</span>
            </button>
          ))}
        </div>
        <span className="muted ho-resume">{occupees} table{occupees > 1 ? 's' : ''} occupée{occupees > 1 ? 's' : ''}</span>
        <button className="btn" onClick={onDirect}>
          <Icon n="coins" size={15} /> Vente directe
        </button>
      </div>
      {!tables.length ? (
        <Empty>
          Aucune table encore. {config && <button className="toggle-link" onClick={onConfig}>Crée les tables du restaurant et du bar</button>}
        </Empty>
      ) : (
        <div className="ho-floor">
          {liste.map((t) => {
            const c = commandeDe(t.id)
            const tot = c ? totalLignes(c.data.lignes || []) : 0
            const attente = c && (c.data.lignes || []).some((l) => num(l.qte) > num(l.envoye))
            return (
              <button key={t.id} className={`ho-table ${c ? 'occ' : ''} ${t.places > 4 ? 'large' : ''}`} onClick={() => onTable(t)}>
                <span className="ht-nom">{t.nom}</span>
                {c ? (
                  <>
                    <span className="ht-tot">{eur(tot)}</span>
                    <span className="ht-info">
                      <Icon n="users" size={12} /> {c.data.couverts || '–'} · <Icon n="clock" size={12} /> {depuis(c.data.ouverte)}
                    </span>
                    {attente && <span className="ht-attente">À envoyer</span>}
                  </>
                ) : (
                  <span className="ht-info">{t.places} places · libre</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Chambres ----------
const FILTRES = [['', 'Toutes'], ['libre', 'Libres'], ['occ', 'Occupées'], ['menage', 'À nettoyer'], ['depart', 'Départs du jour']]
function Chambres({ chambres, sejourDe, etat, config, onConfig, onLibre, onOccupee, onMenage }) {
  const [filtre, setFiltre] = useState('')
  const t = today()
  const statut = (c) => {
    const s = sejourDe(c.id)
    if (s) return s.data.depart && s.data.depart <= t ? 'depart' : 'occ'
    return c.menage ? 'menage' : 'libre'
  }
  const liste = chambres.filter((c) => !filtre || statut(c) === filtre || (filtre === 'occ' && statut(c) === 'depart'))
  const etages = [...new Set(liste.map((c) => c.etage))].sort((a, b) => a - b)
  const taux = etat.total ? Math.round((etat.occupees / etat.total) * 100) : 0
  return (
    <div className="ho-page">
      <div className="ho-kpis">
        <div className="ho-kpi"><span>Occupation</span><strong>{taux} %</strong><em>{etat.occupees} / {etat.total} chambres</em></div>
        <div className="ho-kpi"><span>Libres</span><strong>{etat.total - etat.occupees - etat.aNettoyer}</strong><em>prêtes à louer</em></div>
        <div className="ho-kpi warn"><span>À nettoyer</span><strong>{etat.aNettoyer}</strong><em>après un départ</em></div>
        <div className="ho-kpi"><span>Départs du jour</span><strong>{etat.departs}</strong><em>{etat.arrivees} arrivée{etat.arrivees > 1 ? 's' : ''} aujourd'hui</em></div>
      </div>
      <div className="ho-bar">
        <div className="ho-zones">
          {FILTRES.map(([k, l]) => (
            <button key={k} className={filtre === k ? 'on' : ''} onClick={() => setFiltre(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {!chambres.length ? (
        <Empty>
          Aucune chambre encore. {config && <button className="toggle-link" onClick={onConfig}>Crée les chambres de l'hôtel</button>}
        </Empty>
      ) : (
        etages.map((e) => (
          <div key={e} className="ho-etage">
            <div className="ho-etage-t">{e === 0 ? 'Rez-de-chaussée' : `${e}ᵉ étage`}</div>
            <div className="ho-rooms">
              {liste.filter((c) => c.etage === e).map((c) => {
                const s = sejourDe(c.id)
                const st = statut(c)
                const f = s ? folio(s) : null
                return (
                  <button key={c.id} className={`ho-room st-${st}`} onClick={() => (s ? onOccupee(s) : c.menage ? onMenage(c) : onLibre(c))}>
                    <span className="hr-top">
                      <strong>{c.nom}</strong>
                      <span className="hr-cat">{c.categorie}</span>
                    </span>
                    {s ? (
                      <>
                        <span className="hr-client">{s.data.client?.nom}</span>
                        <span className="hr-info">
                          {st === 'depart' ? 'Départ aujourd’hui' : `Jusqu'au ${fmtDate(s.data.depart)}`} · {f.nuits} nuit{f.nuits > 1 ? 's' : ''}
                        </span>
                        <span className="hr-solde">{eur(f.reste)} à payer</span>
                      </>
                    ) : c.menage ? (
                      <>
                        <span className="hr-client">À nettoyer</span>
                        <span className="hr-info">Touche quand la chambre est prête</span>
                      </>
                    ) : (
                      <>
                        <span className="hr-client">Libre</span>
                        <span className="hr-info">{eur(c.prix)} / nuit</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
      <div className="ho-legende">
        <span><i className="st-libre" /> Libre</span>
        <span><i className="st-occ" /> Occupée</span>
        <span><i className="st-depart" /> Départ du jour</span>
        <span><i className="st-menage" /> À nettoyer</span>
      </div>
    </div>
  )
}

// ---------- Note de la chambre ----------
function Folio({ doc, profil, onRetour, onExtras, onAcompte, onProlonger, onDepart, onRetirer, onImprimer }) {
  const s = doc.data
  const f = folio(s)
  const lignes = [...(s.lignes || [])].sort((a, b) => `${b.date} ${b.heure}`.localeCompare(`${a.date} ${a.heure}`))
  const prevues = nuitsPrevues(s)
  return (
    <div className="ho-page ho-folio">
      <div className="hf-head">
        <button className="pos-btn light" onClick={onRetour}>
          <Icon n="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /> Chambres
        </button>
        <div className="hf-titre">
          <h2>Chambre {s.chambre}</h2>
          <span className="muted">{doc.numero} · {s.client?.nom}{s.client?.tel ? ` · ${s.client.tel}` : ''}</span>
        </div>
        <button className="btn" onClick={onImprimer}>
          <Icon n="note" size={15} /> Imprimer la note
        </button>
      </div>
      <div className="hf-grid">
        <div className="card hf-card">
          <div className="hf-dates">
            <div><span>Arrivée</span><strong>{fmtDate(s.arrivee)}</strong><em>{s.heureArrivee}</em></div>
            <div><span>Départ prévu</span><strong>{fmtDate(s.depart)}</strong><em>{prevues} nuit{prevues > 1 ? 's' : ''} prévue{prevues > 1 ? 's' : ''}</em></div>
            <div><span>Personnes</span><strong>{s.personnes || 1}</strong><em>{eur(s.prixNuit)} / nuit</em></div>
          </div>
          <table className="hf-table">
            <thead>
              <tr><th>Date</th><th>Désignation</th><th className="num">Qté</th><th className="num">Montant</th><th /></tr>
            </thead>
            <tbody>
              <tr className="hf-heb">
                <td>{fmtDate(s.arrivee)}</td>
                <td>Hébergement · {f.nuits} nuit{f.nuits > 1 ? 's' : ''} à ce jour</td>
                <td className="num">{f.nuits}</td>
                <td className="num">{eur(f.hebergement)}</td>
                <td />
              </tr>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.date)}<div className="muted sm">{l.heure}</div></td>
                  <td>{l.designation}<div className="muted sm">{l.origine}{l.par ? ` · ${l.par}` : ''}</div></td>
                  <td className="num">{nb(num(l.qte), 2)}</td>
                  <td className="num">{eur(num(l.qte) * num(l.pu))}</td>
                  <td>
                    {peut(profil, 'annuler') && (
                      <button className="icon-btn" title="Retirer de la note" onClick={() => window.confirm(`Retirer « ${l.designation} » de la note ?`) && onRetirer(l.id)}>
                        <Icon n="trash" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lignes.length && <p className="muted" style={{ padding: '4px 12px' }}>Aucun extra pour l'instant (restaurant, bar, room service, minibar, blanchisserie…).</p>}
        </div>
        <div className="hf-side">
          <div className="card hf-tot">
            <div><span>Hébergement</span><strong>{eur(f.hebergement)}</strong></div>
            <div><span>Extras</span><strong>{eur(f.extras)}</strong></div>
            <div className="hf-total"><span>Total</span><strong>{eur(f.total)}</strong></div>
            {(s.acomptes || []).map((a) => (
              <div key={a.id} className="hf-acompte"><span>Acompte {fmtDate(a.date)} · {a.mode}</span><strong>- {eur(a.montant)}</strong></div>
            ))}
            <div className="hf-reste"><span>Reste à payer</span><strong>{eur(f.reste)}</strong></div>
          </div>
          <button className="ho-action" onClick={onExtras}><Icon n="plus" size={18} /> Ajouter des extras<em>Room service, minibar, blanchisserie</em></button>
          <button className="ho-action" onClick={onAcompte}><Icon n="wallet" size={18} /> Encaisser un acompte</button>
          <button className="ho-action" onClick={onProlonger}><Icon n="calendar" size={18} /> Modifier le départ prévu</button>
          <button className="pt-payer ho-depart" onClick={onDepart}>
            <span>Départ et encaissement</span>
            <Icon n="chevron" size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailDepart({ doc }) {
  if (!doc) return null
  const f = folio(doc)
  return (
    <div className="pay-info ho-detail">
      <strong>Chambre {doc.data.chambre} · {doc.data.client?.nom}</strong>
      <span>Hébergement {f.nuits} nuit{f.nuits > 1 ? 's' : ''} : {eur(f.hebergement)}</span>
      <span>Extras : {eur(f.extras)}</span>
      {f.acomptes > 0 && <span>Acomptes déjà reçus : − {eur(f.acomptes)}</span>}
    </div>
  )
}

// ---------- Fenêtres ----------
function Couverts({ places, valeur, onChoix, onClose }) {
  const max = Math.max(8, places || 0)
  return (
    <Modal title="Combien de personnes ?" onClose={onClose}>
      <div className="ho-nbs">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} className={n === valeur ? 'on' : ''} onClick={() => onChoix(n)}>
            {n}
          </button>
        ))}
      </div>
    </Modal>
  )
}

function ChoixChambre({ sejours, total, onChoix, onClose }) {
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const liste = sejours.filter((x) => !s || `${x.data.chambre} ${x.data.client?.nom}`.toLowerCase().includes(s)).sort((a, b) => String(a.data.chambre).localeCompare(String(b.data.chambre), 'fr', { numeric: true }))
  return (
    <Modal title={`Mettre ${eur(total)} sur une chambre`} onClose={onClose}>
      <div className="stack">
        <input className="input" placeholder="Numéro de chambre ou nom du client" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="client-liste">
          {liste.map((x) => (
            <button key={x.id} className="cl-item ho-ch" onClick={() => onChoix(x)}>
              <strong>Chambre {x.data.chambre}</strong>
              <span>{x.data.client?.nom}</span>
            </button>
          ))}
          {!liste.length && <div className="muted" style={{ padding: 12 }}>Aucune chambre occupée ne correspond.</div>}
        </div>
      </div>
    </Modal>
  )
}

function Arrivee({ chambre, onDone, onClose }) {
  const ctx = useApp()
  const { settings, toast, profil } = ctx
  const [f, setF] = useState({ client: '', tel: '', piece: '', personnes: 1, depart: addDays(today(), 1), prixNuit: chambre.prix, acompte: '', mode: (settings.modesPaiement || ['Espèces'])[0] })
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const nuits = Math.max(1, diffDays(f.depart, today()))
  const valider = async () => {
    if (!f.client.trim()) return toast('Nom du client obligatoire', true)
    if (f.depart <= today()) return toast('Le départ doit être après aujourd’hui', true)
    setBusy(true)
    try {
      const s = await arrivee({ chambre, ...f, par: profil?.nom }, ctx)
      toast(`Chambre ${chambre.nom} attribuée à ${f.client.trim()} ✓`)
      onDone(s)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Modal title={`Arrivée · chambre ${chambre.nom} (${chambre.categorie})`} onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Nom du client *</span><input className="input" value={f.client} onChange={(e) => set({ client: e.target.value })} autoFocus /></label>
        <div className="ho-2">
          <label className="field"><span>Téléphone</span><input className="input" inputMode="tel" value={f.tel} onChange={(e) => set({ tel: e.target.value })} /></label>
          <label className="field"><span>Pièce d'identité</span><input className="input" placeholder="CNI, passeport…" value={f.piece} onChange={(e) => set({ piece: e.target.value })} /></label>
        </div>
        <div className="ho-2">
          <label className="field"><span>Départ prévu</span><input className="input" type="date" min={addDays(today(), 1)} value={f.depart} onChange={(e) => set({ depart: e.target.value })} /></label>
          <label className="field"><span>Personnes</span><input className="input" type="number" min="1" value={f.personnes} onChange={(e) => set({ personnes: e.target.value })} /></label>
        </div>
        <div className="ho-2">
          <label className="field"><span>Prix par nuit</span><input className="input" inputMode="numeric" disabled={!peut(profil, 'remises')} value={f.prixNuit} onChange={(e) => set({ prixNuit: e.target.value })} /></label>
          <label className="field"><span>Acompte reçu (facultatif)</span><input className="input" inputMode="numeric" placeholder="0" value={f.acompte} onChange={(e) => set({ acompte: e.target.value })} /></label>
        </div>
        {num(f.acompte) > 0 && (
          <div className="ho-modes">
            {(settings.modesPaiement || ['Espèces']).map((m) => (
              <button key={m} className={`chip ${f.mode === m ? 'on' : ''}`} onClick={() => set({ mode: m })}>{m}</button>
            ))}
          </div>
        )}
        <div className="ho-estim">
          {nuits} nuit{nuits > 1 ? 's' : ''} × {eur(num(f.prixNuit))} = <strong>{eur(nuits * num(f.prixNuit))}</strong>
        </div>
        <button className="btn primary" disabled={busy} onClick={valider}>
          {busy ? 'Enregistrement…' : 'Enregistrer l’arrivée'}
        </button>
      </div>
    </Modal>
  )
}

function Acompte({ sejour, onClose }) {
  const { settings, api, toast, profil } = useApp()
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState((settings.modesPaiement || ['Espèces'])[0])
  const valider = async () => {
    if (num(montant) <= 0) return toast('Indique le montant', true)
    await api.saveDoc({ ...sejour, data: { ...sejour.data, acomptes: [...(sejour.data.acomptes || []), { id: uid(), date: today(), heure: nowTime(), montant: num(montant), mode, par: profil?.nom || '' }] } })
    toast(`Acompte de ${eur(num(montant))} enregistré ✓`)
    onClose()
  }
  return (
    <Modal title={`Acompte · chambre ${sejour.data.chambre}`} onClose={onClose}>
      <div className="stack">
        <input className="input ho-big" inputMode="numeric" placeholder="Montant" value={montant} onChange={(e) => setMontant(e.target.value)} autoFocus />
        <div className="ho-modes">
          {(settings.modesPaiement || ['Espèces']).map((m) => (
            <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
        <p className="muted sm">L'acompte est déduit de la facture au départ du client.</p>
        <button className="btn primary" onClick={valider}>Enregistrer</button>
      </div>
    </Modal>
  )
}

function Prolonger({ sejour, onClose }) {
  const { api, toast } = useApp()
  const [d, setD] = useState(sejour.data.depart)
  const valider = async () => {
    if (!d || d < sejour.data.arrivee) return toast('Date invalide', true)
    await api.saveDoc({ ...sejour, data: { ...sejour.data, depart: d } })
    toast('Départ prévu modifié ✓')
    onClose()
  }
  return (
    <Modal title={`Départ prévu · chambre ${sejour.data.chambre}`} onClose={onClose}>
      <div className="stack">
        <input className="input" type="date" min={sejour.data.arrivee} value={d} onChange={(e) => setD(e.target.value)} />
        <div className="ho-modes">
          {[1, 2, 3, 7].map((n) => (
            <button key={n} className="chip" onClick={() => setD(addDays(d, n))}>+{n} nuit{n > 1 ? 's' : ''}</button>
          ))}
        </div>
        <button className="btn primary" onClick={valider}>Enregistrer</button>
      </div>
    </Modal>
  )
}

// ---------- Réglages : chambres, tables, carte ----------
function Reglages({ onglet = 'carte', onClose }) {
  const { documents } = useApp()
  const [tab, setTab] = useState(onglet)
  const [edit, setEdit] = useState(null)
  const listes = { chambres: chambresDe(documents), tables: tablesDe(documents), carte: platsDe(documents) }
  const liste = listes[tab]
  return (
    <Modal title="Réglages de l'hôtel" onClose={onClose} large>
      <div className="ho-zones" style={{ marginBottom: 12 }}>
        {[['carte', 'Carte'], ['tables', 'Tables'], ['chambres', 'Chambres']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setEdit(null) }}>
            {l} <span>{listes[k].length}</span>
          </button>
        ))}
      </div>
      {edit ? (
        <Fiche type={tab} item={edit === 'new' ? null : edit} onDone={() => setEdit(null)} />
      ) : (
        <div className="stack">
          <button className="btn primary" onClick={() => setEdit('new')}>
            <Icon n="plus" size={15} /> {tab === 'carte' ? 'Nouveau plat ou boisson' : tab === 'tables' ? 'Nouvelle table' : 'Nouvelle chambre'}
          </button>
          <div className="ho-cfg">
            {liste.map((x) => (
              <button key={x.id} className="ho-cfg-l" onClick={() => setEdit(x)}>
                {tab === 'carte' && <PlatImg p={x} size={36} />}
                <span className="ho-cfg-n">
                  <strong>{tab === 'chambres' ? `Chambre ${x.nom}` : x.nom}</strong>
                  <span className="muted">{tab === 'carte' ? x.categorie : tab === 'tables' ? `${x.zone} · ${x.places} places` : `${x.categorie} · ${x.etage === 0 ? 'RDC' : `étage ${x.etage}`}`}</span>
                </span>
                {tab !== 'tables' && <strong>{eur(x.prix)}{tab === 'chambres' ? ' / nuit' : ''}</strong>}
                <Icon n="edit" size={14} />
              </button>
            ))}
            {!liste.length && <div className="muted" style={{ padding: 12 }}>Rien pour l'instant.</div>}
          </div>
        </div>
      )}
    </Modal>
  )
}

const EMOJIS = ['🍳', '🥐', '☕', '🍵', '🥗', '🍲', '🍛', '🐟', '🍗', '🥩', '🍢', '🍟', '🍚', '🍰', '🍨', '🍉', '🥤', '🧃', '💧', '🍺', '🍷', '🥃', '🍸', '🍾', '🧺', '🚕', '🧴', '🛏️']
function Fiche({ type, item, onDone }) {
  const { documents, api, toast } = useApp()
  const [f, setF] = useState(() => ({
    nom: item?.nom || '',
    categorie: item?.categorie || (type === 'carte' ? 'Plats' : 'Standard'),
    prix: item?.prix ?? '',
    emoji: item?.emoji || '',
    photo: item?.photo || '',
    zone: item?.zone || 'Restaurant',
    places: item?.places || 4,
    etage: item?.etage ?? 1,
  }))
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const fichier = useRef(null)
  const docType = type === 'carte' ? 'plat' : type === 'tables' ? 'table' : 'chambre'
  const enregistrer = async (archive = false) => {
    if (!f.nom.trim()) return toast('Le nom est obligatoire', true)
    if (type !== 'tables' && !(num(f.prix) >= 0 && String(f.prix).trim() !== '')) return toast('Indique le prix', true)
    const data =
      type === 'carte'
        ? { nom: f.nom.trim(), categorie: f.categorie, prix: num(f.prix), emoji: f.emoji, photo: f.photo }
        : type === 'tables'
          ? { nom: f.nom.trim(), zone: f.zone, places: num(f.places) || 2 }
          : { nom: f.nom.trim(), categorie: f.categorie, etage: num(f.etage), prix: num(f.prix), menage: item?.menage || false }
    await api.saveDoc({
      ...(item?.doc || { type: docType, prospect_id: null, numero: type === 'carte' ? numeroInterne(documents, 'plat', 'PL', 4) : type === 'tables' ? numeroInterne(documents, 'table', 'TB', 3) : numeroInterne(documents, 'chambre', 'CH', 3) }),
      data: { ...(item?.doc?.data || {}), ...data, ...(archive ? { archive: true } : {}) },
    })
    toast(archive ? 'Retiré ✓' : 'Enregistré ✓')
    onDone()
  }
  const photo = async (e) => {
    try {
      set({ photo: await photoArticle(e.target.files[0], 360) })
    } catch (err) {
      toast(err.message, true)
    }
  }
  return (
    <div className="stack">
      <label className="field"><span>{type === 'chambres' ? 'Numéro de la chambre *' : 'Nom *'}</span><input className="input" value={f.nom} onChange={(e) => set({ nom: e.target.value })} autoFocus /></label>
      {type === 'carte' && (
        <>
          <div className="ho-2">
            <label className="field"><span>Catégorie</span>
              <select className="input" value={f.categorie} onChange={(e) => set({ categorie: e.target.value })}>
                {CATEGORIES_CARTE.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>Prix *</span><input className="input" inputMode="numeric" value={f.prix} onChange={(e) => set({ prix: e.target.value })} /></label>
          </div>
          <div className="field">
            <span>Image</span>
            <div className="ho-emojis">
              <PlatImg p={f} size={56} />
              <button className="btn sm" onClick={() => fichier.current.click()}><Icon n="upload" size={14} /> Photo</button>
              {f.photo && <button className="btn sm" onClick={() => set({ photo: '' })}>Retirer la photo</button>}
              <input ref={fichier} type="file" accept="image/*" capture="environment" hidden onChange={photo} />
            </div>
            <div className="ho-emojis">
              {EMOJIS.map((e) => (
                <button key={e} className={`ho-emoji ${f.emoji === e ? 'on' : ''}`} onClick={() => set({ emoji: e })}>{e}</button>
              ))}
            </div>
          </div>
        </>
      )}
      {type === 'tables' && (
        <div className="ho-2">
          <label className="field"><span>Zone</span>
            <select className="input" value={f.zone} onChange={(e) => set({ zone: e.target.value })}>
              {ZONES.map((z) => <option key={z}>{z}</option>)}
            </select>
          </label>
          <label className="field"><span>Places</span><input className="input" type="number" min="1" value={f.places} onChange={(e) => set({ places: e.target.value })} /></label>
        </div>
      )}
      {type === 'chambres' && (
        <div className="ho-3">
          <label className="field"><span>Catégorie</span>
            <select className="input" value={f.categorie} onChange={(e) => set({ categorie: e.target.value })}>
              {[...new Set([...CATEGORIES_CHAMBRE, f.categorie])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span>Étage (0 = RDC)</span><input className="input" type="number" min="0" value={f.etage} onChange={(e) => set({ etage: e.target.value })} /></label>
          <label className="field"><span>Prix / nuit *</span><input className="input" inputMode="numeric" value={f.prix} onChange={(e) => set({ prix: e.target.value })} /></label>
        </div>
      )}
      <div className="ho-btns">
        <button className="btn" onClick={onDone}>Annuler</button>
        {item && <button className="btn danger" onClick={() => window.confirm('Retirer de la liste ? Les ventes passées restent.') && enregistrer(true)}><Icon n="trash" size={14} /> Retirer</button>}
        <button className="btn primary" onClick={() => enregistrer()}>Enregistrer</button>
      </div>
    </div>
  )
}
