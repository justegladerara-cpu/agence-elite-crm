import { useMemo } from 'react'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Bar, Empty, go, eur, nb } from '../ui'
import { todayCounts, computeStats } from '../lib/logic'
import { isExample } from '../lib/seed'
import { today, fmtDate, addDays, diffDays, weekday } from '../lib/dates'

function ProspectRow({ p, children, overdue }) {
  const { openAction } = useApp()
  return (
    <div className={`list-item click ${overdue ? 'overdue' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
      <div className="li-main">
        <div className="li-title">{p.name}</div>
        <div className="li-sub">{children}</div>
      </div>
      <div className="li-side">
        <ContactButtons p={p} compact />
        <button
          className="btn sm gold"
          onClick={(e) => {
            e.stopPropagation()
            openAction({ prospect_id: p.id, canal: p.canal })
          }}
        >
          + Action
        </button>
      </div>
    </div>
  )
}

export default function Journee() {
  const { data, settings, prospects, api, toast } = useApp()
  const t = today()
  const counts = todayCounts(data)
  const obj = settings.objectifsJour
  const goals = [
    ['Nouveaux prospects', counts.prospects, obj.prospects],
    ['Appels', counts.appels, obj.appels],
    ['DM', counts.dm, obj.dm],
  ]
  const semaine = useMemo(() => {
    const debut = addDays(t, -(weekday(t) - 1) - 7)
    const fin = addDays(debut, 6)
    return { debut, fin, s: computeStats(data, settings, { mois: 'x', debut, fin }, 'Tous').cur }
  }, [data, settings, t])
  const h = new Date().getHours()
  const hello = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="stack">
      {prospects.length === 0 && (
        <div className="banner row">
          <span style={{ flex: 1 }}>Ton CRM est vide. Charge des exemples pour voir tout rempli, tu pourras les supprimer ensuite.</span>
          <button className="btn sm" onClick={() => api.loadSeed().then(() => toast('Exemples chargés ✓'), () => {})}>
            Charger les exemples
          </button>
        </div>
      )}
      {prospects.some(isExample) && (
        <div className="banner row">
          <span style={{ flex: 1 }}>Des prospects d'exemple sont chargés.</span>
          <button className="btn sm" onClick={() => go('/parametres')}>
            Les supprimer
          </button>
        </div>
      )}
      <div className="hero">
        <h1>{hello} Juste ☀</h1>
        <div className="sub">
          {fmtDate(t)} · {data.aRelancer.length} relance{data.aRelancer.length > 1 ? 's' : ''} à faire · {data.alertes.length} alerte
          {data.alertes.length > 1 ? 's' : ''}
        </div>
        <button className="btn gold" style={{ marginTop: 14 }} onClick={() => go('/session')}>
          ▶ Lancer une session d'appels
        </button>
        <div className="grid grid-3" style={{ marginTop: 16, gap: 10 }}>
          {goals.map(([l, v, c]) => (
            <div className="goal-mini" key={l}>
              <div className="l">{l}</div>
              <div className="v">
                {v} <span style={{ fontSize: 14, color: '#c4cde0', fontWeight: 600 }}>/ {c}</span>
              </div>
              <Bar value={v} max={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <h2 className="section">
              🔴 À relancer aujourd'hui et en retard <span className="count">{data.aRelancer.length}</span>
            </h2>
            <div className="list">
              {data.aRelancer.length === 0 && <Empty>Aucune relance en attente. Bravo !</Empty>}
              {data.aRelancer.map((p) => (
                <ProspectRow key={p.id} p={p} overdue={p.relance < t}>
                  <RelanceTag date={p.relance} heure={p.heureRappel} /> {p.prochaineAction || p.canal} ·{' '}
                  {p.fiche?.contact || ''} {p.relance < t ? `· ${diffDays(t, p.relance)} j de retard` : ''}
                </ProspectRow>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section">🔥 Les 10 prospects les plus chauds à appeler</h2>
            <div className="list">
              {data.chauds.length === 0 && <Empty>Ajoute des prospects pour voir ta liste d'appels du jour.</Empty>}
              {data.chauds.map((p) => (
                <ProspectRow key={p.id} p={p}>
                  <Score v={p.score} /> <StageBadge etape={p.etape} /> {p.fiche?.secteur || ''}
                  {p.fiche?.pub_active === 'Oui' ? ' · pub active' : ''} · {p.tentatives} tentative{p.tentatives > 1 ? 's' : ''}
                </ProspectRow>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="section">
              🟠 Alertes prospects <span className="count">{data.alertes.length}</span>
            </h2>
            <div className="list">
              {data.alertes.length === 0 && <Empty>Aucune alerte.</Empty>}
              {data.alertes.map((p) => (
                <ProspectRow key={p.id} p={p}>
                  <span className="badge b-orange">{p.alerte}</span> <StageBadge etape={p.etape} />
                  {p.montantPropose ? ` · ${eur(p.montantPropose)}` : ''}
                </ProspectRow>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section">
              🤝 Clients à surveiller <span className="count">{data.clientsAlertes.length}</span>
            </h2>
            <div className="list">
              {data.clientsAlertes.length === 0 && <Empty>Tous tes clients sont à jour.</Empty>}
              {data.clientsAlertes.map((c) => (
                <ProspectRow key={c.id} p={c.prospect}>
                  <span className="badge b-red">{c.alerte}</span>
                  {c.reste ? ` · reste ${eur(c.reste)}` : ''}
                </ProspectRow>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section">📅 Prochaines relances</h2>
            <div className="list">
              {data.aVenir.length === 0 && <Empty>Rien de planifié.</Empty>}
              {data.aVenir.slice(0, 8).map((p) => (
                <ProspectRow key={p.id} p={p}>
                  <RelanceTag date={p.relance} heure={p.heureRappel} /> {p.prochaineAction}
                </ProspectRow>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section">🗓 Revue de la semaine dernière</h2>
            <div className="tiny muted" style={{ marginBottom: 8 }}>
              Du {fmtDate(semaine.debut)} au {fmtDate(semaine.fin)} · 15 minutes le lundi pour ajuster.
            </div>
            <div className="info-grid">
              {[
                ['Prospects ajoutés', semaine.s.prospects],
                ['Appels', semaine.s.appels],
                ['DM', semaine.s.dm],
                ['Réponses', semaine.s.reponses],
                ['RDV', semaine.s.rdv],
                ['Clients signés', semaine.s.signes],
                ['CA signé', eur(semaine.s.caSigne)],
                ['Encaissé', eur(semaine.s.encaisse)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{typeof v === 'number' ? nb(v) : v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <details className="script">
              <summary>📞 Script d'appel</summary>
              {settings.script.map((s, i) => (
                <p key={i}>
                  <b>{s.titre} :</b> {s.texte}
                </p>
              ))}
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}
