// Bilan du lundi : la semaine passée en chiffres (comparée à celle d'avant) et 3 conseils tirés des chiffres
import { useMemo } from 'react'
import { useApp, eur, nb, pct } from '../ui'
import { Icon } from '../icons'
import { computeStats, periodeFor } from '../lib/logic'
import { fmtDate, today } from '../lib/dates'
import { facturesImpayees } from './Factures'

export function conseilsSemaine(st, { settings, data, impayees }) {
  const c = st.cur
  const out = []
  const contacts = c.dm + c.appels
  const cibleDm = Number(settings.objectifsQuotidiens?.find((o) => o.source === 'dm')?.cible || 0) * 5
  const retard = data.aRelancer.filter((p) => p.relance < today()).length
  if (retard) out.push(['alert', `${retard} relance${retard > 1 ? 's' : ''} en retard : commence ta journée par elles avec le bouton « Relancé » dans Ma journée.`])
  if (cibleDm && c.dm < cibleDm * 0.7)
    out.push(['target', `${nb(c.dm)} DM envoyés pour ${nb(cibleDm)} visés (${pct(c.dm / cibleDm)}). Bloque deux créneaux fixes de prospection chaque jour.`])
  if (contacts >= 10 && c.reponses / contacts < 0.15) {
    const best = [...(st.modeles || [])].filter((m) => m.n >= 5).sort((a, b) => b.taux - a.taux)[0]
    out.push(['mail', `Taux de réponse de ${pct(c.reponses / contacts)} : teste une nouvelle accroche${best ? `. Ton meilleur script est « ${best.label} » (${pct(best.taux)})` : ''}.`])
  }
  if (c.reponses >= 3 && c.looms === 0) out.push(['play', `${c.reponses} réponses mais aucune Loom envoyée : c'est l'étape qui transforme. Vise au moins 2 Looms cette semaine.`])
  // Plus grosse perte de l'entonnoir
  const steps = st.process || []
  let fuite = null
  steps.forEach((s, i) => {
    if (!i || steps[i - 1].n < 3) return
    const tx = s.n / steps[i - 1].n
    if (!fuite || tx < fuite.tx) fuite = { de: steps[i - 1].label, a: s.label, tx }
  })
  if (fuite && fuite.tx < 0.5) out.push(['funnel', `Plus grosse perte : ${fuite.de} → ${fuite.a} (${pct(fuite.tx)} passent). Concentre tes efforts sur cette étape.`])
  if (impayees.length)
    out.push(['file', `${impayees.length} facture${impayees.length > 1 ? 's' : ''} à relancer (${eur(impayees.reduce((m, d) => m + d.reste, 0))}) : un message WhatsApp suffit, depuis Factures.`])
  if (c.signes) out.push(['trophy', `Bravo : ${c.signes} signature${c.signes > 1 ? 's' : ''} pour ${eur(c.caSigne)}. Demande une recommandation à ce${c.signes > 1 ? 's' : ''} client${c.signes > 1 ? 's' : ''}.`])
  if (!out.length) out.push(['sparkles', 'Semaine régulière : garde le rythme et augmente un peu tes objectifs du jour.'])
  return out.slice(0, 3)
}

export default function BilanSemaine() {
  const { data, settings, documents, actions } = useApp()
  const periode = periodeFor('Semaine dernière')
  const st = useMemo(() => computeStats(data, settings, periode, 'Tous'), [data, settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const impayees = useMemo(() => facturesImpayees(documents, actions), [documents, actions])
  const c = st.cur
  const pv = st.prev || {}
  const conseils = conseilsSemaine(st, { settings, data, impayees })
  const lignes = [
    ['DM envoyés', c.dm, pv.dm],
    ['Appels', c.appels, pv.appels],
    ['Réponses', c.reponses, pv.reponses],
    ['Looms', c.looms, pv.looms],
    ['RDV', c.rdv, pv.rdv],
    ['Signatures', c.signes, pv.signes],
    ['CA signé', c.caSigne, pv.caSigne, eur],
    ['Encaissé', c.encaisse, pv.encaisse, eur],
  ]
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="calendar" size={16} /></span> Bilan de la semaine dernière
      </h2>
      <div className="tiny muted" style={{ marginBottom: 10 }}>
        Du {fmtDate(periode.debut)} au {fmtDate(periode.fin)}, comparé à la semaine d'avant. 15 minutes le lundi pour ajuster.
      </div>
      <div className="bilan-grid">
        {lignes.map(([k, v, p, f = nb]) => {
          const d = p === undefined || p === null ? null : v - p
          return (
            <div key={k}>
              <div className="k">{k}</div>
              <div className="v">{f(v)}</div>
              {d !== null && <div className={`bd ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{d > 0 ? '↑' : d < 0 ? '↓' : '='} {d ? f(Math.abs(d)) : ''}</div>}
            </div>
          )
        })}
      </div>
      <div className="lbl-small" style={{ marginTop: 14 }}>3 conseils pour cette semaine</div>
      <div className="conseils">
        {conseils.map(([ico, txt], i) => (
          <div key={i} className="conseil">
            <span className="sec-ic"><Icon n={ico} size={15} /></span>
            <span>{txt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
