// Calendrier de la semaine : relances, RDV, échéances de factures et ce qui a été fait
import { useMemo, useState } from 'react'
import { useApp, go, eur } from '../ui'
import { Icon } from '../icons'
import { today, addDays, weekday, fmtDate, parse } from '../lib/dates'
import { facturesImpayees } from './Impayes'
import { statutDe, totals, paiementsDe, num } from '../lib/invoice'

const FAITS = ['RDV', 'Proposition envoyée', 'Signature', 'Intervention', 'Paiement reçu', 'Loom envoyé', 'Audit réalisé']
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
let derniereSemaine = 0

export default function Calendrier() {
  const { data, documents, actions } = useApp()
  const [dec, setDecState] = useState(derniereSemaine)
  const setDec = (v) => {
    derniereSemaine = v
    setDecState(v)
  }
  const t = today()
  const lundi = addDays(t, -(weekday(t) - 1) + dec * 7)
  const jours = [...Array(7)].map((_, i) => addDays(lundi, i))
  const fin = jours[6]

  const parJour = useMemo(() => {
    const m = Object.fromEntries(jours.map((j) => [j, []]))
    // À faire : relances et RDV programmés (les retards remontent sur aujourd'hui)
    data.list.forEach((p) => {
      if (!p.relance || p.etape === 'Gagné' || p.etape === 'Perdu') return
      const retard = p.relance < t
      const jour = retard ? t : p.relance
      if (!m[jour]) return
      m[jour].push({
        key: `r${p.id}`,
        type: p.etape === 'RDV' ? 'rdv' : retard ? 'retard' : 'relance',
        heure: p.heureRappel || '',
        titre: p.name,
        sous: `${p.prochaineAction || 'Relancer'}${retard ? ` · en retard depuis le ${fmtDate(p.relance)}` : ''}`,
        path: `/prospect/${p.id}`,
      })
    })
    // Échéances des factures non réglées
    documents
      .filter((d) => d.type === 'facture' && d.data?.echeance && m[d.data.echeance])
      .forEach((d) => {
        const st = statutDe(d, actions)
        if (st === 'Payée' || st === 'Annulée') return
        const reste = totals(d.data).total - paiementsDe(d, actions).reduce((s, a) => s + num(a.montant), 0)
        m[d.data.echeance].push({ key: `f${d.id}`, type: 'facture', titre: d.data?.client?.nom || data.byId[d.prospect_id]?.name || d.numero, sous: `Échéance ${d.numero} · reste ${eur(reste)}`, path: `/facture/${d.id}` })
      })
    // Renouvellements clients
    data.clients.forEach((c) => {
      if (c.renouvellement && m[c.renouvellement]) m[c.renouvellement].push({ key: `c${c.id}`, type: 'client', titre: c.name, sous: 'Renouvellement du contrat', path: `/prospect/${c.id}` })
    })
    // Fait : actions marquantes du jour
    actions
      .filter((a) => a.date >= lundi && a.date <= fin && a.date <= t && FAITS.includes(a.action))
      .forEach((a) => {
        const p = data.byId[a.prospect_id]
        m[a.date].push({
          key: `a${a.id}`,
          type: 'fait',
          heure: a.time || '',
          titre: p?.name || a.notes || a.action,
          sous: `${a.action}${num(a.montant) ? ` · ${eur(a.montant)}` : ''}`,
          path: p ? `/prospect/${p.id}` : null,
        })
      })
    const ordre = { retard: 0, rdv: 1, relance: 2, facture: 3, client: 4, fait: 5 }
    Object.values(m).forEach((l) => l.sort((a, b) => ordre[a.type] - ordre[b.type] || (a.heure || '99').localeCompare(b.heure || '99')))
    return m
  }, [data, documents, actions, lundi]) // eslint-disable-line react-hooks/exhaustive-deps

  // Activité de prospection par jour (DM + appels)
  const volume = useMemo(() => {
    const v = {}
    actions.forEach((a) => {
      if (a.date >= lundi && a.date <= fin && ['Premier contact', 'Relance', 'Échange / suivi', 'Qualification'].includes(a.action)) v[a.date] = (v[a.date] || 0) + 1
    })
    return v
  }, [actions, lundi, fin])

  const nb = (type) => Object.values(parJour).flat().filter((x) => x.type === type).length
  const impayees = facturesImpayees(documents, actions).length
  const d1 = parse(lundi)
  const d7 = parse(fin)
  const titre = `${d1.getDate()} ${d1.toLocaleDateString('fr-FR', { month: 'short' })} → ${d7.getDate()} ${d7.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Calendrier</h1>
          <div className="sub">
            {titre} · {nb('relance') + nb('retard')} relance{nb('relance') + nb('retard') > 1 ? 's' : ''} · {nb('rdv')} RDV · {nb('facture')} échéance{nb('facture') > 1 ? 's' : ''}
            {impayees ? ` · ${impayees} facture${impayees > 1 ? 's' : ''} à relancer` : ''}
          </div>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => setDec(dec - 1)} aria-label="Semaine précédente">
            ←
          </button>
          <button className={`btn sm ${dec === 0 ? 'primary' : ''}`} onClick={() => setDec(0)}>
            Cette semaine
          </button>
          <button className="btn sm" onClick={() => setDec(dec + 1)} aria-label="Semaine suivante">
            →
          </button>
        </div>
      </div>
      <div className="cal-legend">
        <span><i className="cal-dot retard" /> Relance en retard</span>
        <span><i className="cal-dot relance" /> Relance</span>
        <span><i className="cal-dot rdv" /> RDV</span>
        <span><i className="cal-dot facture" /> Échéance facture</span>
        <span><i className="cal-dot client" /> Client</span>
        <span><i className="cal-dot fait" /> Fait</span>
      </div>
      <div className="cal">
        {jours.map((j, i) => (
          <div key={j} className={`cal-day ${j === t ? 'today' : ''} ${j < t ? 'past' : ''}`}>
            <div className="cal-head">
              <span>
                {JOURS[i]} <b>{parse(j).getDate()}</b>
              </span>
              {volume[j] ? <span className="cal-vol" title="Messages et appels de prospection">{volume[j]} contact{volume[j] > 1 ? 's' : ''}</span> : null}
            </div>
            {parJour[j].length === 0 && <div className="cal-empty">—</div>}
            {parJour[j].map((x) => (
              <button key={x.key} type="button" className={`cal-item ${x.type}`} onClick={() => x.path && go(x.path)}>
                <span className="ci-t">
                  {x.heure && <b>{x.heure} </b>}
                  {x.titre}
                </span>
                <span className="ci-s">{x.sous}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="tiny muted row" style={{ gap: 6 }}>
        <Icon n="clock" size={13} /> Les relances programmées viennent de la date de relance de chaque prospect ; ajoute une heure de rappel dans la saisie pour les voir à l'heure.
      </div>
    </div>
  )
}
