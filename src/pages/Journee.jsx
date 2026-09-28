import { useMemo } from 'react'
import { Icon } from '../icons'
import { RelanceBoutons, ReporterBouton } from './Insta'
import BilanSemaine from './Bilan'
import { RelanceFactureBtn, facturesImpayees } from './Impayes'
import { useApp, StageBadge, Score, RelanceTag, ContactButtons, Empty, go, eur, Tabs, useTab, LienProspect, Bar } from '../ui'
import { ObjectifsJour, TodoJour, HistoriqueJours, useJournee } from './Objectifs'
import { isExample } from '../lib/seed'
import { avancement, compterJour } from '../lib/journee'
import { isLocal } from '../lib/store'
import { derniereSauvegarde, telechargerSauvegarde } from '../lib/sauvegarde'
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
        {relance && <ReporterBouton p={p} />}
        {relance && <RelanceBoutons p={p} compact />}
        <button
          className="btn sm gold"
          aria-label={`Noter une action pour ${p.name}`}
          onClick={(e) => {
            e.stopPropagation()
            openAction({ prospect_id: p.id, canal: p.canal })
          }}
        >
          + Noter
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
  // Un seul bandeau à la fois : démarrage, exemples, sauvegarde, puis bilan du lundi
  const sauvegardeDue = !isLocal && prospects.length >= 5 && (!derniereSauvegarde() || diffDays(t, derniereSauvegarde()) > 7)
  const score = useMemo(() => avancement(jour, compterJour(data, t)).score, [jour, data, t])
  const h = new Date().getHours()
  const hello = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="stack">
      {prospects.length === 0 ? (
        <div className="card demarrage">
          <h2>Ajoute tes premiers prospects</h2>
          <p className="muted">Importe ton fichier Excel de pilotage, ou ajoute un compte Instagram repéré. Le CRM calcule ensuite tes relances à ta place.</p>
          <div className="row">
            <button className="btn primary" onClick={() => go('/parametres/excel')}>
              <Icon n="upload" size={15} /> Importer mon Excel
            </button>
            <button className="btn" onClick={() => go('/acquisition?nouveau=insta')}>
              <Icon n="instagram" size={15} /> Ajouter un prospect Instagram
            </button>
            {isLocal && (
              <button className="btn ghost" onClick={() => api.loadSeed().then(() => toast('Exemples chargés ✓'), () => {})}>
                Charger des exemples
              </button>
            )}
          </div>
        </div>
      ) : prospects.some(isExample) ? (
        <div className="banner row">
          <span style={{ flex: 1 }}>Des prospects d'exemple sont chargés.</span>
          <button className="btn sm" onClick={() => go('/parametres/excel')}>
            Les supprimer
          </button>
        </div>
      ) : sauvegardeDue ? (
        <div className="banner row">
          <Icon n="download" size={16} />
          <span style={{ flex: 1 }}>{derniereSauvegarde() ? `Ta dernière sauvegarde date du ${fmtDate(derniereSauvegarde())}.` : "Tu n'as pas encore fait de sauvegarde de tes données."}</span>
          <button className="btn sm" onClick={() => { telechargerSauvegarde({ prospects, actions, documents, settings }); toast('Sauvegarde téléchargée ✓') }}>
            Sauvegarder maintenant
          </button>
        </div>
      ) : null}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{[hello, settings.apparence?.prenom].filter(Boolean).join(' ')}</h1>
          <div className="sub">
            {fmtDate(t)} · {data.aRelancer.length} relance{data.aRelancer.length > 1 ? 's' : ''} à faire · {impayees.length} facture{impayees.length > 1 ? 's' : ''} à
            relancer · {data.alertes.length} alerte{data.alertes.length > 1 ? 's' : ''}
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

      {weekday(t) === 1 && tab !== 'historique' && !prospects.some(isExample) && prospects.length > 0 && !sauvegardeDue && (
        <div className="banner row">
          <Icon n="sparkles" size={16} />
          <span style={{ flex: 1 }}>C'est lundi : ton bilan de la semaine et 3 conseils sont prêts.</span>
          <button className="btn sm" onClick={() => setOnglet('historique')}>
            Voir mon bilan
          </button>
        </div>
      )}

      {tab === 'jour' && (
        <button type="button" className="score-fin" onClick={() => document.getElementById('objectifs-jour')?.scrollIntoView({ behavior: 'smooth' })}>
          <span>Objectifs du jour</span>
          <Bar value={score} max={100} tone={score >= 100 ? 'green' : ''} />
          <strong>{score}/100</strong>
        </button>
      )}

      {tab === 'jour' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h2 className="section">
              <span className="sec-ic"><Icon n="alert" size={16} /></span> Aujourd'hui et en retard <span className="count">{data.aRelancer.length}</span>
            </h2>
            <div className="list">
              {data.aRelancer.map((p) => (
                <ProspectRow key={p.id} p={p} overdue={p.relance < t} relance>
                  <RelanceTag date={p.relance} heure={p.heureRappel} /> {p.prochaineAction || p.canal} ·{' '}
                  {p.fiche?.contact || ''} {p.relance < t ? `· ${diffDays(t, p.relance)} j de retard` : ''}
                </ProspectRow>
              ))}
              {data.aRelancer.length === 0 && prospects.length > 0 && (
                <div className="journee-vide">
                  <strong>Journée à jour.</strong> C'est le moment de prospecter : 10 nouveaux contacts rapprochent de ton objectif.
                  <button className="btn sm primary" onClick={() => go('/session')}>
                    Lancer une session d'appels
                  </button>
                </div>
              )}
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

      {tab === 'jour' && (
        <div className="hero" id="objectifs-jour">
          <ObjectifsJour jour={jour} update={update} />
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
            {impayees.length === 0 && <Empty>Aucune facture en retard.</Empty>}
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
