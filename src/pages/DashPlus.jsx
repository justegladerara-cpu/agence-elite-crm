// Vues supplémentaires du tableau de bord : pipeline par étape, CA cumulé du mois, carte de chaleur
// des contacts, dépenses par catégorie et vue Clients. Tout est cliquable et relié aux fiches.
import { useMemo, useState } from 'react'
import { useApp, Kpi, eur, pct, nb, go, LienProspect } from '../ui'
import { Icon } from '../icons'
import { Donut, HBars, COULEURS, useWidth } from '../charts'
import { isProspection, isReponse, VENTES, montantRetenu } from '../lib/logic'
import { today, fmtDate, fmtMonth, weekday } from '../lib/dates'

const COUL_ETAPE = { Nouveau: '#8a93a6', Contacté: '#2a78d6', Qualifié: '#6c46bb', 'Audit/Démo': '#11788a', RDV: '#b8862b', Proposition: '#eb6834', Gagné: '#1baf7a' }

// Pipeline : combien de prospects à chaque étape et ce qu'ils pèsent
export function PipelineEtapes() {
  const { data, settings } = useApp()
  const etapes = settings.etapes.map((e) => e.nom).filter((e) => e !== 'Perdu' && e !== 'Gagné')
  const lignes = etapes.map((e) => {
    const ps = data.list.filter((p) => p.etape === e)
    return { e, n: ps.length, propose: ps.reduce((m, p) => m + (Number(p.montantPropose) || 0), 0), pondere: ps.reduce((m, p) => m + p.pipelinePondere, 0) }
  })
  const total = lignes.reduce((m, l) => m + l.n, 0)
  const [hover, setHover] = useState(null)
  if (!total) return <div className="empty">Aucun prospect en cours : ajoute tes premiers prospects.</div>
  const lien = (e) => go(`/prospects?etape=${encodeURIComponent(e)}&vue=liste`)
  return (
    <div className="pipe">
      <div className="pipe-bar" role="img" aria-label={lignes.map((l) => `${l.e} ${l.n}`).join(', ')}>
        {lignes
          .filter((l) => l.n)
          .map((l) => (
            <button
              key={l.e}
              type="button"
              style={{ flexGrow: l.n, background: COUL_ETAPE[l.e] || COULEURS[0], opacity: hover && hover !== l.e ? 0.4 : 1 }}
              title={`${l.e} : ${l.n}`}
              onMouseEnter={() => setHover(l.e)}
              onMouseLeave={() => setHover(null)}
              onClick={() => lien(l.e)}
            >
              {l.n / total > 0.08 ? l.n : ''}
            </button>
          ))}
      </div>
      <div className="pipe-rows">
        {lignes.map((l) => (
          <button key={l.e} type="button" className={`pipe-row ${hover === l.e ? 'hl' : ''}`} onMouseEnter={() => setHover(l.e)} onMouseLeave={() => setHover(null)} onClick={() => lien(l.e)}>
            <i style={{ background: COUL_ETAPE[l.e] || COULEURS[0] }} />
            <span className="pr-l">{l.e}</span>
            <span className="pr-n">{l.n}</span>
            <span className="pr-v">{l.propose ? eur(l.propose) : '—'}</span>
            <span className="pr-v pr-pond muted">{l.pondere ? eur(l.pondere) : '—'}</span>
            <Icon n="chevron" size={13} />
          </button>
        ))}
        <div className="pipe-row head">
          <i />
          <span className="pr-l">Étape</span>
          <span className="pr-n">Prospects</span>
          <span className="pr-v">Proposé</span>
          <span className="pr-v pr-pond">Pondéré</span>
          <span style={{ width: 13 }} />
        </div>
      </div>
    </div>
  )
}

// CA signé et encaissé cumulés jour après jour, face à l'objectif du mois
export function CumulMois() {
  const { data, settings } = useApp()
  const [ref, W] = useWidth(640)
  const [hover, setHover] = useState(null)
  const t = today()
  const key = t.slice(0, 7)
  const nbJours = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate()
  const jourAuj = Number(t.slice(8, 10))
  const objectif = Number(settings.objectifsMois?.ca) || 0
  const pts = useMemo(() => {
    const sig = Array(nbJours + 1).fill(0)
    const enc = Array(nbJours + 1).fill(0)
    data.sorted.forEach((a) => {
      if (!a.date || a.date.slice(0, 7) !== key) return
      const j = Number(a.date.slice(8, 10))
      if (VENTES.includes(a.action)) sig[j] += montantRetenu(a, data.byId[a.prospect_id], data.L)
      else if (a.action === 'Paiement reçu') enc[j] += montantRetenu(a, data.byId[a.prospect_id], data.L)
    })
    const out = []
    let s = 0
    let e = 0
    for (let j = 1; j <= jourAuj; j++) {
      s += sig[j]
      e += enc[j]
      out.push({ j, s, e })
    }
    return out
  }, [data, key, nbJours, jourAuj])
  const H = W < 500 ? 200 : 230
  const pad = { l: 8, r: 12, t: 16, b: 24 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const dernier = pts[pts.length - 1] || { s: 0, e: 0 }
  const max = Math.max(1, objectif, dernier.s, dernier.e)
  const x = (j) => pad.l + ((j - 1) / Math.max(1, nbJours - 1)) * iw
  const y = (v) => pad.t + ih - (v / max) * ih
  const ligne = (k) => pts.map((p) => `${x(p.j)},${y(p[k])}`).join(' ')
  const aire = pts.length ? `${x(1)},${y(0)} ${ligne('s')} ${x(pts[pts.length - 1].j)},${y(0)}` : ''
  const rythme = jourAuj ? (dernier.s / jourAuj) * nbJours : 0
  const hp = hover !== null ? pts[hover] : null
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * W
    const j = Math.round(((px - pad.l) / iw) * (nbJours - 1)) + 1
    setHover(Math.max(0, Math.min(pts.length - 1, j - 1)))
  }
  return (
    <div>
      <div className="legend" style={{ marginBottom: 6 }}>
        <span><i style={{ background: '#3b5aa8' }} />CA signé {eur(dernier.s)}</span>
        <span><i style={{ background: '#b8862b' }} />Encaissé {eur(dernier.e)}</span>
        {objectif > 0 && (
          <span><i style={{ background: 'none', borderTop: '2px dashed #c8423f', borderRadius: 0, height: 0, width: 14 }} />Objectif {eur(objectif)}</span>
        )}
      </div>
      <div ref={ref} style={{ position: 'relative' }}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`CA signé cumulé du mois : ${eur(dernier.s)}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={(e) => e.touches[0] && onMove({ currentTarget: e.currentTarget, clientX: e.touches[0].clientX })}>
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#eceae4" />
          {objectif > 0 && <line x1={x(1)} x2={x(nbJours)} y1={y(0)} y2={y(objectif)} stroke="#c8423f" strokeDasharray="5 4" strokeWidth="1.5" />}
          {aire && <polygon points={aire} fill="#3b5aa8" opacity="0.1" />}
          {pts.length > 0 && <polyline points={ligne('s')} fill="none" stroke="#3b5aa8" strokeWidth="2" strokeLinejoin="round" />}
          {pts.length > 0 && <polyline points={ligne('e')} fill="none" stroke="#b8862b" strokeWidth="2" strokeLinejoin="round" />}
          {[1, Math.ceil(nbJours / 2), nbJours].map((j) => (
            <text key={j} x={x(j)} y={H - 6} fontSize="11" fill="#6b7489" textAnchor={j === 1 ? 'start' : j === nbJours ? 'end' : 'middle'}>
              {j}
            </text>
          ))}
          {hp && (
            <g>
              <line x1={x(hp.j)} x2={x(hp.j)} y1={pad.t} y2={pad.t + ih} stroke="#c9ced9" strokeDasharray="3 3" />
              <circle cx={x(hp.j)} cy={y(hp.s)} r="5" fill="#3b5aa8" stroke="#fff" strokeWidth="2" />
              <circle cx={x(hp.j)} cy={y(hp.e)} r="5" fill="#b8862b" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hp && (
          <div className="card small chart-tip" style={{ left: `${Math.min(62, Math.max(2, (x(hp.j) / W) * 100 - 14))}%` }}>
            <b>{fmtDate(`${key}-${String(hp.j).padStart(2, '0')}`)}</b>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span style={{ flex: 1 }}>CA signé</span><b>{eur(hp.s)}</b></div>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span style={{ flex: 1 }}>Encaissé</span><b>{eur(hp.e)}</b></div>
            {objectif > 0 && <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span style={{ flex: 1 }}>Objectif à date</span><b>{eur((objectif / nbJours) * hp.j)}</b></div>}
          </div>
        )}
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        {fmtMonth(key)} · à ce rythme : <b>{eur(rythme)}</b> en fin de mois
        {objectif > 0 && (rythme >= objectif ? ' · objectif atteint au rythme actuel' : ` · il manque ${eur(objectif - dernier.s)} pour l'objectif`)}
      </div>
    </div>
  )
}

// Carte de chaleur : jours × heures des prises de contact, avec le taux de réponse
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export function Heatmap({ periode, canal, onPick }) {
  const { data } = useApp()
  const [hover, setHover] = useState(null)
  const { grille, heures, max, sansHeure } = useMemo(() => {
    const g = {}
    let sans = 0
    data.sorted.forEach((a) => {
      if (!a.date || a.date < periode.debut || a.date > periode.fin) return
      if (!isProspection(a, data.L) || (canal !== 'Tous' && a.canal !== canal)) return
      if (!a.time) return sans++
      const k = `${weekday(a.date)}-${Number(a.time.slice(0, 2))}`
      g[k] = g[k] || { n: 0, r: 0 }
      g[k].n++
      if (isReponse(a, data.L)) g[k].r++
    })
    const hs = Object.keys(g).map((k) => Number(k.split('-')[1]))
    const h1 = Math.min(8, ...hs)
    const h2 = Math.max(19, ...hs)
    const heures = []
    for (let h = h1; h <= h2; h++) heures.push(h)
    return { grille: g, heures, max: Math.max(1, ...Object.values(g).map((c) => c.n)), sansHeure: sans }
  }, [data, periode.debut, periode.fin, canal])
  const vide = !Object.keys(grille).length
  if (vide) return <div className="empty">Aucune prise de contact avec une heure sur la période.</div>
  const cellule = (d, h) => grille[`${d}-${h}`]
  const hc = hover && cellule(...hover)
  return (
    <div className="hm-wrap">
      <div className="hm" style={{ gridTemplateColumns: `34px repeat(${heures.length}, minmax(18px, 1fr))` }}>
        <span />
        {heures.map((h) => (
          <span key={h} className="hm-h">
            {h % 2 === 0 ? `${h}h` : ''}
          </span>
        ))}
        {JOURS.map((j, i) => (
          <HeatLigne key={j} j={j} d={i + 1} heures={heures} cellule={cellule} max={max} hover={hover} setHover={setHover} onPick={onPick} />
        ))}
      </div>
      <div className="hm-foot tiny muted">
        <span>
          {hc ? (
            <>
              <b>{JOURS[hover[0] - 1]} {hover[1]}h</b> : {hc.n} contact{hc.n > 1 ? 's' : ''}, {hc.r} réponse{hc.r > 1 ? 's' : ''} ({pct(hc.r / hc.n)})
            </>
          ) : (
            'Survole une case pour le détail, clique pour la liste.'
          )}
        </span>
        <span className="hm-scale">
          moins <i style={{ opacity: 0.15 }} /><i style={{ opacity: 0.45 }} /><i style={{ opacity: 0.75 }} /><i style={{ opacity: 1 }} /> plus
        </span>
      </div>
      {sansHeure > 0 && <div className="tiny muted">{sansHeure} contact{sansHeure > 1 ? 's' : ''} sans heure non comptés.</div>}
    </div>
  )
}
function HeatLigne({ j, d, heures, cellule, max, hover, setHover, onPick }) {
  return (
    <>
      <span className="hm-j">{j}</span>
      {heures.map((h) => {
        const c = cellule(d, h)
        const on = hover && hover[0] === d && hover[1] === h
        return (
          <button
            key={h}
            type="button"
            className={`hm-c ${c ? 'has' : ''} ${on ? 'on' : ''}`}
            style={c ? { '--o': 0.15 + (c.n / max) * 0.85 } : undefined}
            aria-label={`${j} ${h}h : ${c ? c.n : 0} contacts`}
            onMouseEnter={() => setHover([d, h])}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover([d, h])}
            onClick={() => c && onPick([d, h], `${j} ${h}h`)}
          >
            {c && c.r > 0 && <b />}
          </button>
        )
      })}
    </>
  )
}

// Dépenses de la période par catégorie
export function depensesParCategorie(data, periode) {
  const m = {}
  data.sorted.forEach((a) => {
    if (a.action !== 'Dépense' || !a.date || a.date < periode.debut || a.date > periode.fin) return
    const k = a.categorie || 'Sans catégorie'
    m[k] = (m[k] || 0) + (Number(a.montant) || 0)
  })
  return Object.entries(m).map(([label, value]) => ({ label, value }))
}

// Onglet Clients : chiffre d'affaires, encaissements, abonnements et clients à suivre
export function ClientsVue({ voir }) {
  const { data } = useApp()
  const cl = data.clients
  const actifs = cl.filter((c) => c.statut === 'Actif')
  const caTotal = cl.reduce((m, c) => m + c.total, 0)
  const reste = cl.reduce((m, c) => m + c.reste, 0)
  const mrr = actifs.reduce((m, c) => m + c.abonnement, 0)
  const top = [...cl].sort((a, b) => b.total - a.total).slice(0, 8)
  const secteurs = {}
  cl.forEach((c) => {
    const s = c.prospect.fiche?.secteur || 'Non renseigné'
    secteurs[s] = (secteurs[s] || 0) + c.total
  })
  const paiement = {}
  cl.filter((c) => c.statutPaiement).forEach((c) => (paiement[c.statutPaiement] = (paiement[c.statutPaiement] || 0) + 1))
  const renouv = actifs.filter((c) => c.joursRenouv !== null && c.joursRenouv >= 0 && c.joursRenouv <= 60).sort((a, b) => a.joursRenouv - b.joursRenouv)
  if (!cl.length)
    return (
      <div className="card empty">
        Pas encore de client. Un prospect devient client dès que tu saisis sa signature.
      </div>
    )
  return (
    <>
      <div className="grid grid-4">
        <Kpi label="Clients actifs" value={nb(actifs.length)} navy onClick={() => go('/clients?filtre=actifs')} />
        <Kpi label="CA total clients" value={eur(caTotal)} navy />
        <Kpi label="Reste à encaisser" value={eur(reste)} onClick={() => voir('Reste à encaisser', { kind: 'resteClients' })} />
        <Kpi label="Revenu récurrent (MRR)" value={eur(mrr)} onClick={() => voir('Clients abonnés', { kind: 'abonnes' })} />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="trophy" size={16} /></span> Meilleurs clients</h2>
          <HBars rows={top.map((c) => ({ id: c.id, label: c.name, value: c.total, sub: c.reste > 0 ? `reste ${eur(c.reste)}` : c.nbInterventions ? `${c.nbInterventions} intervention${c.nbInterventions > 1 ? 's' : ''}` : '' }))} fmt={eur} color={COULEURS[2]} onPick={(r) => go(`/prospect/${r.id}`)} />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="tag" size={16} /></span> CA par secteur</h2>
          <Donut items={Object.entries(secteurs).map(([label, value]) => ({ label, value }))} fmt={eur} total="CA clients" onPick={(l) => voir(`Clients du secteur ${l}`, { kind: 'secteurClients', key: l })} />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="coins" size={16} /></span> État des paiements</h2>
          <Donut items={Object.entries(paiement).map(([label, value]) => ({ label, value }))} total="clients" onPick={(l) => voir(`Paiement : ${l}`, { kind: 'paiementClients', key: l })} />
        </div>
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="alert" size={16} /></span> Clients à suivre</h2>
          {data.clientsAlertes.length || renouv.length ? (
            <div className="suivi">
              {data.clientsAlertes.slice(0, 6).map((c) => (
                <div key={c.id} className="suivi-l">
                  <LienProspect id={c.id}>{c.name}</LienProspect>
                  <span className="badge b-red">{c.alerte}</span>
                </div>
              ))}
              {renouv
                .filter((c) => !c.alerte)
                .slice(0, 4)
                .map((c) => (
                  <div key={c.id} className="suivi-l">
                    <LienProspect id={c.id}>{c.name}</LienProspect>
                    <span className="badge b-orange">Renouvellement dans {c.joursRenouv} j</span>
                  </div>
                ))}
              <button className="toggle-link tiny" onClick={() => go('/clients?filtre=alertes')}>
                Voir tous les clients à surveiller
              </button>
            </div>
          ) : (
            <div className="empty">Tout est à jour, aucun client à relancer.</div>
          )}
        </div>
      </div>
      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="handshake" size={16} /></span> Tous les clients</h2>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Client</th>
                <th>Statut</th>
                <th className="num">CA</th>
                <th className="num">Encaissé</th>
                <th className="num">Reste</th>
                <th className="num">Abonnement</th>
                <th>Dernière vente</th>
              </tr>
            </thead>
            <tbody>
              {[...cl]
                .sort((a, b) => b.total - a.total)
                .map((c) => (
                  <tr key={c.id} className="click" onClick={() => go(`/prospect/${c.id}`)}>
                    <td className="bold">{c.name}</td>
                    <td><span className={`badge ${c.statut === 'Actif' ? 'b-green' : 'b-Perdu'}`}>{c.statut}</span></td>
                    <td className="num">{eur(c.total)}</td>
                    <td className="num">{eur(c.encaisse)}</td>
                    <td className={`num ${c.reste > 0 ? 'red' : ''}`}>{c.reste ? eur(c.reste) : '—'}</td>
                    <td className="num">{c.abonnement ? eur(c.abonnement) : '—'}</td>
                    <td>{c.derniereVente ? fmtDate(c.derniereVente) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

