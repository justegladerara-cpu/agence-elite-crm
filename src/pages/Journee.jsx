import { useMemo } from 'react'
import { Icon } from '../icons'
import { RelanceBoutons } from './Insta'
import BilanSemaine from './Bilan'
import { RelanceFactureBtn, facturesImpayees } from './Factures'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Tabs, useTab, LienProspect } from '../ui'
import { ObjectifsJour, TodoJour, HistoriqueJours, useJournee } from './Objectifs'
import { isExample } from '../lib/seed'
import { today, fmtDate, diffDays, weekday } from '../lib/dates'

function ProspectRow({ p, children, overdue, relance }) {
  const { openAction } = useApp()
  return (
    <div className={`list-item click ${overdue ? 'overdue' : ''} ${relance ? 'with-relance' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
      <div className="li-main">
        <div className="li-title">{p.name}</div>
        <div className="li-sub">{children}</div>
      </div>
      <div className="li-side">
        <ContactButtons p={p} compact />
        {relance && <RelanceBoutons p={p} compact />}
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

export default function Journee({ onglet: ongletDemande }) {
  const { data, settings, prospects, api, toast, documents, actions } = useApp()
  const impayees = useMemo(() => facturesImpayees(documents, actions), [documents, actions])
  const t = today()
  const { jour, update } = useJournee(t)
  const [onglet, setOnglet] = useTab('journee', 'jour', ongletDemande)
  const tab = onglet === 'relances' ? 'jour' : onglet
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
          <button className="btn sm" onClick={() => go('/parametres/excel')}>
            Les supprimer
          </button>
        </div>
      )}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{[hello, settings.apparence?.prenom].filter(Boolean).join(' ')}</h1>
          <div className="sub">
            {fmtDate(t)} · {data.aRelancer.length} relance{data.aRelancer.length > 1 ? 's' : ''} à faire · {data.alertes.length} alerte
            {data.alertes.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <Tabs
        items={[
          ['jour', "Aujourd'hui", data.aRelancer.length],
          ['chauds', 'Prospects chauds'],
          ['alertes', 'Alertes', data.alertes.length + data.clientsAlertes.length + impayees.length],
          ['routine', 'Ma routine'],
          ['historique', 'Bilan de la semaine'],
        ]}
        value={tab}
        onChange={setOnglet}
      />

      {weekday(t) === 1 && tab !== 'historique' && (
        <div className="banner row">
          <Icon n="sparkles" size={16} />
          <span style={{ flex: 1 }}>C'est lundi : ton bilan de la semaine et 3 conseils sont prêts.</span>
          <button className="btn sm" onClick={() => setOnglet('historique')}>
            Voir mon bilan
          </button>
        </div>
      )}

      {tab === 'jour' && (
        <div className="hero">
          <ObjectifsJour jour={jour} update={update} />
        </div>
      )}

      {tab === 'jour' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h2 className="section">
              <span className="sec-ic"><Icon n="alert" size={16} /></span> Aujourd'hui et en retard <span className="count">{data.aRelancer.length}</span>
            </h2>
            <div className="list">
              {data.aRelancer.length === 0 && <Empty>Aucune relance en attente. Bravo !</Empty>}
              {data.aRelancer.map((p) => (
                <ProspectRow key={p.id} p={p} overdue={p.relance < t} relance>
                  <RelanceTag date={p.relance} heure={p.heureRappel} /> {p.prochaineAction || p.canal} ·{' '}
                  {p.fiche?.contact || ''} {p.relance < t ? `· ${diffDays(t, p.relance)} j de retard` : ''}
                </ProspectRow>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="section"><span className="sec-ic"><Icon n="calendar" size={16} /></span> Prochaines relances</h2>
            <div className="list">
              {data.aVenir.length === 0 && <Empty>Rien de planifié.</Empty>}
              {data.aVenir.slice(0, 10).map((p) => (
                <ProspectRow key={p.id} p={p}>
                  <RelanceTag date={p.relance} heure={p.heureRappel} /> {p.prochaineAction}
                </ProspectRow>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'chauds' && (
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="flame" size={16} /></span> Les 10 prospects les plus chauds à appeler</h2>
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
      )}

      {tab === 'alertes' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h2 className="section">
              <span className="sec-ic"><Icon n="bell" size={16} /></span> Alertes prospects <span className="count">{data.alertes.length}</span>
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
              <span className="sec-ic"><Icon n="handshake" size={16} /></span> Clients à surveiller <span className="count">{data.clientsAlertes.length}</span>
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
        </div>
      )}

      {tab === 'alertes' && (
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="file" size={16} /></span> Factures à relancer <span className="count">{impayees.length}</span>
          </h2>
          <div className="list">
            {impayees.length === 0 && <Empty>Aucune facture en retard. 👌</Empty>}
            {impayees.map((d) => (
              <div key={d.id} className="list-item click" onClick={() => go(`/facture/${d.id}`)}>
                <div className="li-main">
                  <div className="li-title">
                    <LienProspect id={d.prospect_id}>{d.data?.client?.nom || data.byId[d.prospect_id]?.name || 'Sans client'}</LienProspect>
                  </div>
                  <div className="li-sub">
                    {d.numero} · reste {eur(d.reste)} · échéance {fmtDate(d.data?.echeance)}
                  </div>
                </div>
                <div className="li-side">
                  <span className={`badge ${d.statut === 'En retard' ? 'b-red' : 'b-orange'}`}>{d.statut}</span>
                  <RelanceFactureBtn doc={d} label="Relancer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'routine' && <TodoJour jour={jour} update={update} />}

      {tab === 'historique' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <HistoriqueJours />
          <BilanSemaine />
        </div>
      )}
    </div>
  )
}
