import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Kpi, Tabs, useTab, Empty, eur, nb, go } from '../ui'
import { HBars, Donut, useWidth } from '../charts'
import { num } from '../lib/invoice'
import { today, addDays, fmtDate } from '../lib/dates'
import { ventesDe, periodeBornes, dansPeriode, articlesDe, enAlerte } from '../lib/magasin'
import { Vignette } from './Articles'
import { clientsDe } from './ClientsMagasin'
import { statutDe } from '../lib/invoice'
import { etablissementsDe, etabDe, etabParFacture } from '../lib/etablissements'

const PERIODES = [
  ['jour', "Aujourd'hui"],
  ['hier', 'Hier'],
  ['7j', '7 jours'],
  ['mois', 'Ce mois'],
  ['annee', 'Cette année'],
]
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

// Ventes par jour : colonnes, dernier jour mis en avant
function Colonnes({ jours }) {
  const [ref, w] = useWidth(640)
  const [hover, setHover] = useState(null)
  const H = 170
  const pad = { l: 8, r: 8, t: 22, b: 30 }
  const max = Math.max(...jours.map((j) => j.v), 1)
  const bw = (w - pad.l - pad.r) / jours.length
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const court = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : v >= 1e3 ? `${Math.round(v / 1e3)} k` : String(Math.round(v)))
  return (
    <div ref={ref} className="cols-wrap">
      <svg width={w} height={H} role="img" aria-label="Ventes par jour">
        <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
        {jours.map((j, i) => {
          const x = pad.l + i * bw + bw * 0.18
          const bwi = bw * 0.64
          const last = i === jours.length - 1
          const on = hover === i
          return (
            <g key={j.d} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect x={x} y={y(j.v)} width={bwi} height={Math.max(0, H - pad.b - y(j.v))} rx={3} fill={last || on ? 'var(--gold)' : 'rgba(var(--gold-rgb), .45)'} />
              {(last || on) && j.v > 0 && (
                <text x={x + bwi / 2} y={y(j.v) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
                  {court(j.v)}
                </text>
              )}
              {(jours.length <= 14 || i % 2 === 0 || last) && (
                <text x={x + bwi / 2} y={H - 12} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
                  {jours.length <= 7 ? JOURS[new Date(`${j.d}T12:00`).getDay()] : j.d.slice(8)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div className="cols-tip">
          {fmtDate(jours[hover].d)} : <strong>{eur(jours[hover].v)}</strong> · {jours[hover].n} vente{jours[hover].n > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default function Ventes({ periode: demandee, caisse }) {
  const { documents, actions: toutesActions, api, profil, data, settings } = useApp()
  const liste = useMemo(() => etablissementsDe(settings), [settings])
  const [etabF, setEtabF] = useState('')
  // Filtre par établissement : ventes de ses factures, paiements de ces factures ; les dépenses restent communes
  const actions = useMemo(() => {
    if (!etabF) return toutesActions
    const m = etabParFacture(documents, liste)
    return toutesActions.filter((a) => a.action !== 'Paiement reçu' || (m[a.facture] || liste[0].id) === etabF)
  }, [toutesActions, etabF, documents, liste])
  const [periodeChoisie, setPeriode] = useTab('ventes-periode', 'jour', demandee)
  const periode = caisse ? 'jour' : periodeChoisie
  const [maj, setMaj] = useState(() => new Date())
  const [, tic] = useState(0)
  // Mise à jour en direct : les ventes faites à la caisse (sur un autre appareil) arrivent seules
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') api.reload().then(() => setMaj(new Date()))
    }, 15000)
    const s = setInterval(() => tic((x) => x + 1), 5000)
    return () => {
      clearInterval(t)
      clearInterval(s)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const ventes = useMemo(() => ventesDe(documents, actions).filter((v) => !etabF || etabDe(v.doc, liste) === etabF), [documents, actions, etabF, liste])
  const bornes = periodeBornes(periode)
  const dansP = ventes.filter((v) => dansPeriode(v.date, bornes))
  // Période précédente de même durée, pour comparer
  const duree = Math.round((new Date(bornes[1]) - new Date(bornes[0])) / 86400000) + 1
  const avant = periode === 'annee' || periode === 'mois' ? null : [addDays(bornes[0], -duree), addDays(bornes[0], -1)]
  const ca = dansP.reduce((m, v) => m + v.total, 0)
  const caAvant = avant ? ventes.filter((v) => dansPeriode(v.date, avant)).reduce((m, v) => m + v.total, 0) : null
  const encaisse = actions.filter((a) => a.action === 'Paiement reçu' && dansPeriode(a.date, bornes)).reduce((m, a) => m + num(a.montant), 0)
  const depenses = actions.filter((a) => a.action === 'Dépense' && dansPeriode(a.date, bornes)).reduce((m, a) => m + num(a.montant), 0)
  const credit = ventes.reduce((m, v) => m + v.reste, 0)
  const entreesP = actions.filter((a) => a.action === 'Paiement reçu' && dansPeriode(a.date, bornes))
  const sortiesP = actions.filter((a) => a.action === 'Dépense' && dansPeriode(a.date, bornes))
  const encComptoir = entreesP.filter((a) => !a.prospect_id).reduce((m, a) => m + num(a.montant), 0)
  // Marge : prix de vente moins prix d'achat des articles vendus (quand le prix d'achat est connu)
  const achat = Object.fromEntries(articlesDe(documents).map((a) => [a.id, num(a.prixAchat)]))
  const cout = dansP.reduce((m, v) => m + v.lignes.reduce((k, l) => k + num(l.qte) * (achat[l.produitId] || 0), 0), 0)
  const marge = cout > 0 ? ca - cout : null
  const valeurStock = articlesDe(documents).reduce((m, a) => m + Math.max(0, a.stock) * (num(a.prixAchat) || a.prix), 0)
  const debiteurs = clientsDe(documents, actions, data).filter((c) => c.reste > 0).sort((a, b) => b.reste - a.reste)
  const sansNom = ventes.filter((v) => v.reste > 0 && !debiteurs.some((c) => c.nom === v.client))
  const creditComptoir = sansNom.reduce((m, v) => m + v.reste, 0)
  const nbSansNom = sansNom.length
  const devisAttente = documents.filter((d) => d.type === 'devis' && statutDe(d, actions) === 'En attente')
  const devisMontant = devisAttente.reduce((m, d) => m + ventesDe([{ ...d, type: 'facture' }], []).reduce((k, v) => k + v.total, 0), 0)
  // Tous les mouvements d'argent de la période, du plus récent au plus ancien
  const mouvements = [
    ...entreesP.map((a) => ({ id: a.id, date: a.date, time: a.time || '', sens: 1, montant: num(a.montant), titre: a.prospect_id ? data.byId[a.prospect_id]?.name || 'Client' : a.notes || 'Vente au comptoir', sous: [a.facture, a.mode].filter(Boolean).join(' · '), lien: () => { const d = documents.find((x) => x.type === 'facture' && x.numero === a.facture); go(d ? `/facture/${d.id}` : '/paiements') } })),
    ...sortiesP.map((a) => ({ id: a.id, date: a.date, time: a.time || '', sens: -1, montant: num(a.montant), titre: a.categorie || 'Dépense', sous: [a.fournisseur, a.notes, a.mode].filter(Boolean).join(' · '), lien: () => go('/depenses') })),
  ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  const parModeEnc = {}
  entreesP.forEach((a) => (parModeEnc[a.mode || 'Autre'] = (parModeEnc[a.mode || 'Autre'] || 0) + num(a.montant)))
  const panierMoyen = dansP.length ? ca / dansP.length : 0

  // Courbe : 14 derniers jours (30 pour le mois et l'année)
  const n = periode === 'mois' || periode === 'annee' ? 30 : 14
  const jours = Array.from({ length: n }, (_, i) => {
    const d = addDays(today(), i - n + 1)
    const vs = ventes.filter((v) => v.date === d)
    return { d, v: vs.reduce((m, x) => m + x.total, 0), n: vs.length }
  })

  // Articles les plus vendus (en montant)
  const parArticle = {}
  dansP.forEach((v) =>
    v.lignes.forEach((l) => {
      const k = l.designation || 'Article'
      parArticle[k] = parArticle[k] || { label: k, value: 0, q: 0 }
      parArticle[k].value += l.montant
      parArticle[k].q += num(l.qte)
    }),
  )
  const parMode = {}
  dansP.forEach((v) => (parMode[v.mode || 'Autre'] = (parMode[v.mode || 'Autre'] || 0) + v.total))
  const parVendeur = {}
  dansP.forEach((v) => (parVendeur[v.vendeur || 'Non précisé'] = (parVendeur[v.vendeur || 'Non précisé'] || 0) + v.total))
  const stockBas = articlesDe(documents).filter(enAlerte)
  const secondes = Math.round((Date.now() - maj) / 1000)

  const unites = dansP.reduce((m, v) => m + v.lignes.reduce((k, l) => k + num(l.qte), 0), 0)
  const topTable = Object.values(parArticle).sort((a, b) => b.q - a.q || b.value - a.value).slice(0, 8)
  // Dépenses de la période par catégorie, et les dernières sorties d'argent
  const sorties = actions.filter((a) => a.action === 'Dépense').sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const parCat = {}
  sorties.filter((a) => dansPeriode(a.date, bornes)).forEach((a) => (parCat[a.categorie || 'Autre'] = (parCat[a.categorie || 'Autre'] || 0) + num(a.montant)))
  // Ventes et dépenses des 6 derniers mois
  const mois = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 5 + i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      k,
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
      ventes: actions.filter((a) => a.action === 'Paiement reçu' && (a.date || '').startsWith(k)).reduce((m, a) => m + num(a.montant), 0),
      depenses: sorties.filter((a) => (a.date || '').startsWith(k)).reduce((m, a) => m + num(a.montant), 0),
    }
  })
  // Vue caisse : ce que la vendeuse a fait aujourd'hui
  const miennes = caisse ? dansP.filter((v) => !profil?.nom || v.vendeur === profil.nom) : dansP

  if (caisse)
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Mes ventes du jour</h1>
            <div className="sub live">
              <span className="live-dot" /> {profil?.nom || 'Caisse'} · {fmtDate(today())}
            </div>
          </div>
          <button className="btn primary" onClick={() => go('/caisse')}>
            <Icon n="plus" size={16} /> Nouvelle vente
          </button>
        </div>
        <div className="grid grid-3">
          <Kpi label="Ventes enregistrées" value={nb(miennes.length)} navy />
          <Kpi label="Montant vendu" value={eur(miennes.reduce((m, v) => m + v.total, 0))} />
          <Kpi label="Articles vendus" value={nb(miennes.reduce((m, v) => m + v.lignes.reduce((k, l) => k + num(l.qte), 0), 0))} />
        </div>
        <div className="grid ventes-grid" style={{ marginTop: 12 }}>
          <div className="card">
            <h2 className="section">Ventes d'aujourd'hui</h2>
            <DernieresVentes ventes={miennes} vide="Aucune vente aujourd'hui pour l'instant." />
          </div>
          <div className="card">
            <h2 className="section">Stock à surveiller {stockBas.length > 0 && <span className="badge b-orange">{stockBas.length}</span>}</h2>
            <StockBas liste={stockBas} />
          </div>
        </div>
      </>
    )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bonjour{profil?.nom ? ` ${profil.nom.split(' ')[0]}` : ''}</h1>
          <div className="sub live">
            <span className="live-dot" /> Tout l'argent du magasin en direct · mis à jour {secondes < 10 ? "à l'instant" : `il y a ${secondes} s`}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go('/depenses')}>
            <Icon n="trend" size={15} /> Ajouter une dépense
          </button>
          <button className="btn primary" onClick={() => go('/caisse')}>
            <Icon n="plus" size={16} /> Nouvelle vente
          </button>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Tabs items={PERIODES} value={periode} onChange={setPeriode} />
        {liste.length > 1 && (
          <select className="input sm" style={{ width: 'auto' }} value={etabF} onChange={(e) => setEtabF(e.target.value)} aria-label="Établissement">
            <option value="">Tous les établissements</option>
            {liste.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <div className="flux entree" role="button" tabIndex={0} onClick={() => go('/paiements')}>
          <span>Entrées d'argent</span>
          <strong>{eur(encaisse)}</strong>
          <em>{nb(entreesP.length)} paiement{entreesP.length > 1 ? 's' : ''} · comptoir {eur(encComptoir)} · clients {eur(encaisse - encComptoir)}</em>
        </div>
        <div className="flux sortie" role="button" tabIndex={0} onClick={() => go('/depenses')}>
          <span>Sorties d'argent</span>
          <strong>{eur(depenses)}</strong>
          <em>{nb(sortiesP.length)} dépense{sortiesP.length > 1 ? 's' : ''}{Object.keys(parCat).length ? ` · surtout ${Object.entries(parCat).sort((x, y) => y[1] - x[1])[0][0].toLowerCase()}` : ''}</em>
        </div>
        <div className={`flux solde ${encaisse - depenses < 0 ? 'neg' : ''}`}>
          <span>Reste en caisse (entrées − sorties)</span>
          <strong>{eur(encaisse - depenses)}</strong>
          <em>{encaisse - depenses < 0 ? "Plus d'argent sorti qu'entré" : 'Argent gagné sur la période'}</em>
        </div>
        <div className="flux credit" role="button" tabIndex={0} onClick={() => go('/clients')}>
          <span>On nous doit (crédits clients)</span>
          <strong>{eur(credit)}</strong>
          <em>
            {credit <= 0
              ? 'Aucune vente à encaisser'
              : [debiteurs.length && `${nb(debiteurs.length)} client${debiteurs.length > 1 ? 's' : ''} à relancer`, nbSansNom && `${nb(nbSansNom)} vente${nbSansNom > 1 ? 's' : ''} sans nom de client`].filter(Boolean).join(' · ')}
          </em>
        </div>
      </div>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <Kpi label="Chiffre d'affaires (ventes)" value={eur(ca)} navy delta={caAvant !== null && caAvant > 0 ? Math.round(((ca - caAvant) / caAvant) * 100) : undefined} vs="période préc. (%)" />
        <Kpi label={marge !== null && ca > 0 ? `Marge sur les ventes · ${Math.round((marge / ca) * 100)} %` : 'Marge sur les ventes'} value={marge !== null ? eur(marge) : '—'} />
        <Kpi label={`Ventes · panier moyen ${eur(panierMoyen)}`} value={nb(dansP.length)} />
        <Kpi label="Valeur du stock (prix d'achat)" value={eur(valeurStock)} onClick={() => go('/articles')} />
      </div>
      <div className="grid ventes-grid" style={{ marginTop: 12 }}>
        <div className="card plein">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <h2 className="section" style={{ margin: 0 }}>Où entre et où sort l'argent</h2>
            <span className="small muted">{nb(mouvements.length)} mouvement{mouvements.length > 1 ? 's' : ''} sur la période</span>
          </div>
          {!mouvements.length ? (
            <Empty>Aucun mouvement d'argent sur la période.</Empty>
          ) : (
            <div className="mvts">
              {mouvements.slice(0, 12).map((m) => (
                <button key={`${m.sens}-${m.id}`} className={`mvt ${m.sens > 0 ? 'in' : 'out'}`} onClick={m.lien}>
                  <span className="mvt-d">{m.date === today() ? m.time || "Aujourd'hui" : fmtDate(m.date)}</span>
                  <span className="mvt-t">
                    <b>{m.titre}</b>
                    {m.sous && <span>{m.sous}</span>}
                  </span>
                  <span className="mvt-m">{m.sens > 0 ? '+' : '−'} {eur(m.montant)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="section">Entrées et sorties · 6 mois</h2>
          <VentesDepenses mois={mois} />
        </div>
        <div className="card">
          <h2 className="section">Qui nous doit de l'argent</h2>
          {!debiteurs.length && !creditComptoir ? (
            <Empty>Personne ne doit d'argent au magasin.</Empty>
          ) : (
            <div className="sorties">
              {debiteurs.slice(0, 6).map((c) => (
                <button key={c.nom} className="so so-btn" onClick={() => go(`/clients?c=${encodeURIComponent(c.nom)}`)}>
                  <span className="so-l">
                    <b>{c.nom}</b>
                    {c.ventes.some((v) => statutDe(v.doc, actions) === 'En retard') && <span className="badge b-red" style={{ marginLeft: 6 }}>en retard</span>}
                  </span>
                  <span className="so-m">{eur(c.reste)}</span>
                </button>
              ))}
              {creditComptoir > 0 && (
                <button className="so so-btn" onClick={() => go('/factures?filtre=impayees')}>
                  <span className="so-l">{nb(nbSansNom)} vente{nbSansNom > 1 ? 's' : ''} non payée{nbSansNom > 1 ? 's' : ''} sans nom de client</span>
                  <span className="so-m">{eur(creditComptoir)}</span>
                </button>
              )}
            </div>
          )}
          {devisAttente.length > 0 && (
            <button className="toggle-link" style={{ marginTop: 10 }} onClick={() => go('/devis?filtre=attente')}>
              + {nb(devisAttente.length)} devis en attente ({eur(devisMontant)}) qui peuvent rentrer
            </button>
          )}
        </div>
        <div className="card">
          <h2 className="section">Entrées par mode de paiement</h2>
          <Donut items={Object.entries(parModeEnc).map(([label, value]) => ({ label, value }))} fmt={eur} />
        </div>
        <div className="card">
          <h2 className="section">Sorties par catégorie</h2>
          <Donut items={Object.entries(parCat).map(([label, value]) => ({ label, value }))} fmt={eur} />
        </div>
        <div className="card">
          <h2 className="section">Ventes par jour</h2>
          <Colonnes jours={jours} />
        </div>
        <div className="card">
          <h2 className="section">Articles les plus vendus</h2>
          {!topTable.length ? (
            <Empty>Pas encore de ventes sur la période.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="t ztable">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th className="num">Qté vendue</th>
                    <th className="num">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {topTable.map((r) => (
                    <tr key={r.label}>
                      <td className="strong">{r.label}</td>
                      <td className="num">{nb(r.q)}</td>
                      <td className="num">{eur(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="section">Dernières ventes</h2>
          <DernieresVentes ventes={ventes} vide="Aucune vente pour l'instant. Elles apparaîtront ici dès qu'elles sont encaissées." />
        </div>
        <div className="card">
          <h2 className="section">Ventes par vendeur</h2>
          <HBars rows={Object.entries(parVendeur).map(([label, value]) => ({ label, value }))} fmt={eur} />
        </div>
        <div className="card">
          <h2 className="section">Stock à surveiller {stockBas.length > 0 && <span className="badge b-orange">{stockBas.length}</span>}</h2>
          <StockBas liste={stockBas} />
        </div>
      </div>
    </>
  )
}

function DernieresVentes({ ventes, vide }) {
  if (!ventes.length) return <Empty>{vide}</Empty>
  return (
    <div className="flux-ventes">
      {ventes.slice(0, 8).map((v) => (
        <button key={v.doc.id} className={`fv ${v.date === today() ? 'jour' : ''}`} onClick={() => go(`/facture/${v.doc.id}`)}>
          <span className="fv-h">{v.date === today() ? v.heure : fmtDate(v.date)}</span>
          <span className="fv-body">
            <span className="fv-art">{v.lignes.map((l) => `${num(l.qte) > 1 ? `${nb(num(l.qte))} × ` : ''}${l.designation}`).join(', ')}</span>
            <span className="fv-meta">
              {v.numero} · {v.client}
              {v.vendeur ? ` · ${v.vendeur.split(' ')[0]}` : ''}
              {v.mode ? ` · ${v.mode}` : ''}
            </span>
          </span>
          <span className="fv-m">
            {eur(v.total)}
            {v.reste > 0 && <span className="badge b-orange">à crédit</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

function StockBas({ liste }) {
  if (!liste.length) return <Empty>Aucun article en rupture ou presque.</Empty>
  return (
    <div className="stock-bas">
      {liste.slice(0, 6).map((a) => (
        <button key={a.id} className="sb" onClick={() => go('/articles')}>
          <Vignette a={a} size={36} />
          <span className="sb-nom">{a.nom}</span>
          <span className={`badge ${a.stock <= 0 ? 'b-red' : 'b-orange'}`}>{a.stock <= 0 ? 'Rupture' : `${a.stock} restant${a.stock > 1 ? 's' : ''}`}</span>
        </button>
      ))}
    </div>
  )
}

// Entrées (encaissements) et sorties (dépenses) par mois, côte à côte
function VentesDepenses({ mois }) {
  const [ref, w] = useWidth(640)
  const H = 190
  const pad = { l: 8, r: 8, t: 16, b: 28 }
  const max = Math.max(...mois.flatMap((m) => [m.ventes, m.depenses]), 1)
  const gw = (w - pad.l - pad.r) / mois.length
  const bw = Math.min(26, gw * 0.3)
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const tot = mois.reduce((a, m) => ({ v: a.v + m.ventes, d: a.d + m.depenses }), { v: 0, d: 0 })
  return (
    <div ref={ref} className="cols-wrap">
      <div className="vd-leg">
        <span><i className="vd-v" /> Entrées {eur(tot.v)}</span>
        <span><i className="vd-d" /> Sorties {eur(tot.d)}</span>
        <span className={tot.v - tot.d < 0 ? 'neg' : ''}>Reste {eur(tot.v - tot.d)}</span>
      </div>
      <svg width={w} height={H} role="img" aria-label="Entrées et sorties par mois">
        <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
        {mois.map((m, i) => {
          const cx = pad.l + gw * i + gw / 2
          return (
            <g key={m.k}>
              <title>{`${m.label} : entrées ${eur(m.ventes)}, sorties ${eur(m.depenses)}, reste ${eur(m.ventes - m.depenses)}`}</title>
              <rect x={cx - bw - 2} y={y(m.ventes)} width={bw} height={Math.max(0, H - pad.b - y(m.ventes))} rx={3} fill="var(--gold)" />
              <rect x={cx + 2} y={y(m.depenses)} width={bw} height={Math.max(0, H - pad.b - y(m.depenses))} rx={3} fill="var(--red)" opacity=".8" />
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{m.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
