import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Kpi, Tabs, useTab, Empty, eur, nb, go } from '../ui'
import { HBars, Donut, useWidth } from '../charts'
import { num } from '../lib/invoice'
import { today, addDays, fmtDate } from '../lib/dates'
import { ventesDe, periodeBornes, dansPeriode, articlesDe, enAlerte } from '../lib/magasin'
import { Vignette } from './Articles'

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
  const { documents, actions, api, profil } = useApp()
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
  const ventes = useMemo(() => ventesDe(documents, actions), [documents, actions])
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
      ventes: ventes.filter((v) => v.date.startsWith(k)).reduce((m, v) => m + v.total, 0),
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
            <span className="live-dot" /> Ventes en direct · mis à jour {secondes < 10 ? "à l'instant" : `il y a ${secondes} s`}
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
      <Tabs items={PERIODES} value={periode} onChange={setPeriode} />
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <Kpi label="Chiffre d'affaires" value={eur(ca)} navy delta={caAvant !== null && caAvant > 0 ? Math.round(((ca - caAvant) / caAvant) * 100) : undefined} vs="période préc. (%)" />
        <Kpi label="Articles vendus" value={nb(unites)} />
        <Kpi label="Nombre de ventes" value={nb(dansP.length)} />
        <Kpi label="Panier moyen" value={eur(panierMoyen)} />
      </div>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <div className="flux entree">
          <span>Entrées (encaissé)</span>
          <strong>{eur(encaisse)}</strong>
        </div>
        <div className="flux sortie" role="button" tabIndex={0} onClick={() => go('/depenses')}>
          <span>Sorties (dépenses)</span>
          <strong>{eur(depenses)}</strong>
        </div>
        <div className={`flux solde ${encaisse - depenses < 0 ? 'neg' : ''}`}>
          <span>Solde de la période</span>
          <strong>{eur(encaisse - depenses)}</strong>
        </div>
        <div className="flux credit" role="button" tabIndex={0} onClick={() => go('/factures?filtre=impayees')}>
          <span>À encaisser (crédits clients)</span>
          <strong>{eur(credit)}</strong>
        </div>
      </div>
      <div className="grid ventes-grid" style={{ marginTop: 12 }}>
        <div className="card">
          <h2 className="section">Ventes par jour</h2>
          <Colonnes jours={jours} />
        </div>
        <div className="card">
          <h2 className="section">Ventes et dépenses · 6 mois</h2>
          <VentesDepenses mois={mois} />
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
          <h2 className="section">Principales dépenses</h2>
          <Donut items={Object.entries(parCat).map(([label, value]) => ({ label, value }))} fmt={eur} />
          {sorties.length > 0 && (
            <div className="sorties">
              {sorties.slice(0, 4).map((a) => (
                <div key={a.id} className="so">
                  <span className="so-d">{fmtDate(a.date)}</span>
                  <span className="so-l">{a.categorie || 'Dépense'}{a.fournisseur ? ` · ${a.fournisseur}` : ''}{a.notes ? ` · ${a.notes}` : ''}</span>
                  <span className="so-m">− {eur(a.montant)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="section">Paiements reçus par mode</h2>
          <Donut items={Object.entries(parMode).map(([label, value]) => ({ label, value }))} fmt={eur} />
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

// Ventes (bleu) et dépenses (rouge) par mois, côte à côte
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
        <span><i className="vd-v" /> Ventes {eur(tot.v)}</span>
        <span><i className="vd-d" /> Dépenses {eur(tot.d)}</span>
      </div>
      <svg width={w} height={H} role="img" aria-label="Ventes et dépenses par mois">
        <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
        {mois.map((m, i) => {
          const cx = pad.l + gw * i + gw / 2
          return (
            <g key={m.k}>
              <title>{`${m.label} : ventes ${eur(m.ventes)}, dépenses ${eur(m.depenses)}`}</title>
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
