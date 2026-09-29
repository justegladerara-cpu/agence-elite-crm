// Tableau de bord : l'argent de la période, mouvement par mouvement, avec liens vers le client, la facture et la saisie
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Empty, eur, nb, pct, go, LienProspect, LienDoc } from '../ui'
import { mouvements, resumeArgent, rentabiliteClients, mensuel, chargesFixesMois, modalPour } from '../lib/tresorerie'
import { fmtDate } from '../lib/dates'


function Ligne({ m, onOpen }) {
  const { data } = useApp()
  const a = m.a
  const client = a.prospect_id && data.byId[a.prospect_id]
  const titre = m.entree ? client?.name || a.notes || 'Paiement sans client' : a.notes || a.fournisseur || a.categorie || 'Dépense'
  const infos = m.entree ? [a.mode, a.reference && !a.reference.startsWith('paiement:') && `Réf. ${a.reference}`] : [a.categorie, a.fournisseur !== titre && a.fournisseur, a.mode]
  return (
    <li className={`mvt ${m.entree ? 'in' : 'out'}`}>
      <button type="button" className="mvt-main" onClick={() => onOpen(a)} aria-label={`${m.entree ? 'Paiement' : 'Dépense'} ${titre}, ${eur(m.montant)}, ${fmtDate(a.date)}`}>
        <span className="mvt-ic" aria-hidden="true">
          <Icon n={m.entree ? 'coins' : 'wallet'} size={15} />
        </span>
        <span className="mvt-txt">
          <span className="mvt-titre" title={titre}>
            {titre}
          </span>
          <span className="mvt-sub">
            {[fmtDate(a.date), a.time, ...infos].filter(Boolean).join(' · ')}
            {m.entree && client && a.notes ? ` · ${a.notes}` : ''}
          </span>
        </span>
        <span className="mvt-m">
          <b className={m.entree ? 'green' : 'red'}>
            {m.entree ? '+' : '−'} {eur(m.montant)}
          </b>
          {m.coutLie > 0 && <span className="mvt-net">net {eur(m.net)}</span>}
        </span>
      </button>
      {(client || a.facture || m.frais.length > 0 || m.sansClient) && (
        <div className="mvt-liens">
          {client && (
            <LienProspect id={a.prospect_id}>
              <Icon n="user-plus" size={12} /> {m.entree ? 'Fiche client' : client.name}
            </LienProspect>
          )}
          {a.facture && (
            <LienDoc numero={a.facture}>
              <Icon n="file" size={12} /> {a.facture}
            </LienDoc>
          )}
          {m.frais.map((f) => (
            <button key={f.id} type="button" className="chip-lien red" onClick={() => onOpen(f)}>
              − {eur(f.montant)} {f.categorie || f.notes || 'frais'}
            </button>
          ))}
          {m.sansClient && (
            <button type="button" className="chip-lien warn" onClick={() => onOpen(a)}>
              <Icon n="alert-circle" size={12} /> Relier à un client
            </button>
          )}
        </div>
      )}
    </li>
  )
}

// Bloc « Argent de la période » : encaissé, dépensé, net, et chaque mouvement cliquable
// depensesTotal : dépenses du tableau de bord (charges fixes comprises), pour afficher leur part
export function ArgentPeriode({ periode, titre, depensesTotal = 0, onVoir, compact }) {
  const { actions, settings, saisirArgent } = useApp()
  const postesFixes = (settings.depensesFixes || []).filter((d) => mensuel(d) > 0)
  const fixesMois = chargesFixesMois(postesFixes)
  const [tout, setTout] = useState(false)
  const mvts = useMemo(() => mouvements(actions, periode.debut, periode.fin), [actions, periode.debut, periode.fin])
  const saisies = mvts.filter((m) => !m.entree).reduce((t, m) => t + m.montant, 0)
  const r = resumeArgent(mvts, Math.max(0, Math.round(depensesTotal - saisies)))
  const max = compact ? 5 : 8
  const visibles = tout ? mvts : mvts.slice(0, max)
  const ouvrir = (a) => saisirArgent(modalPour(a))
  const nouveau = (type, prefill) => saisirArgent({ type, prefill })
  const aClient = mvts.filter((m) => m.entree && m.a.prospect_id).length

  return (
    <section className="card argent" aria-labelledby="argent-titre">
      <div className="argent-head">
        <h2 className="section" id="argent-titre">
          <span className="sec-ic">
            <Icon n="coins" size={16} />
          </span>
          Argent de la période
        </h2>
        <div className="argent-actions">
          <button type="button" className="btn sm" onClick={() => nouveau('paiement')}>
            <Icon n="plus" size={13} /> Paiement
          </button>
          <button type="button" className="btn sm" onClick={() => nouveau('depense')}>
            <Icon n="plus" size={13} /> Dépense
          </button>
        </div>
      </div>
      <div className="argent-sous tiny muted">{titre}</div>

      <div className="argent-totaux">
        <button type="button" className="at in" onClick={() => onVoir('Paiements reçus', { kind: 'encaisse' })}>
          <span className="at-k">Encaissé</span>
          <span className="at-v">{eur(r.encaisse)}</span>
          <span className="at-s">
            {nb(r.nbEntrees)} paiement{r.nbEntrees > 1 ? 's' : ''}
            {r.nbEntrees ? ` · ${nb(aClient)} relié${aClient > 1 ? 's' : ''} à un client` : ''}
          </span>
        </button>
        <button type="button" className="at out" onClick={() => onVoir('Dépenses de la période', { kind: 'depenses' })}>
          <span className="at-k">Dépensé</span>
          <span className="at-v">{eur(r.depenses + r.fixes)}</span>
          <span className="at-s">
            {nb(r.nbSorties)} dépense{r.nbSorties > 1 ? 's' : ''}
            {r.fixes ? ` + ${eur(r.fixes)} de charges fixes (automatique)` : ''}
          </span>
        </button>
        <div className={`at net ${r.net < 0 ? 'neg' : ''}`}>
          <span className="at-k">Il te reste</span>
          <span className="at-v">{eur(r.net)}</span>
          <span className="at-s">{r.marge === null ? 'Aucun encaissement' : `${pct(r.marge)} de ce que tu as encaissé`}</span>
        </div>
      </div>

      {r.fixes > 0 && (
        <div className="argent-fixes small">
          <Icon n="info" size={14} />
          <span>
            Le dépensé comprend <b>{eur(r.fixes)}</b> de charges fixes : la part de cette période de tes {eur(fixesMois)} par mois (
            {postesFixes.map((d) => `${d.nom} ${eur(mensuel(d))}`).join(', ')}). Ce ne sont pas des dépenses que tu as notées.
          </span>
          <button type="button" className="toggle-link tiny" onClick={() => go('/abonnements')}>
            Modifier
          </button>
        </div>
      )}

      {mvts.length === 0 ? (
        <Empty>Aucun paiement ni dépense sur cette période. Note chaque rentrée et chaque frais, même un taxi : le net se calcule tout seul.</Empty>
      ) : (
        <>
          <ul className="mvts" aria-label="Mouvements d'argent">
            {visibles.map((m) => (
              <Ligne key={m.a.id} m={m} onOpen={ouvrir} />
            ))}
          </ul>
          {mvts.length > max && (
            <button type="button" className="toggle-link tiny" onClick={() => setTout((v) => !v)}>
              {tout ? 'Voir moins' : `Voir les ${nb(mvts.length)} mouvements`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

// Ce que chaque client t'a vraiment rapporté sur la période (encaissé moins les frais liés)
export function RentabiliteClients({ periode }) {
  const { actions, data } = useApp()
  const rows = useMemo(() => rentabiliteClients(mouvements(actions, periode.debut, periode.fin), data.byId), [actions, data, periode.debut, periode.fin])
  return (
    <div className="card rentab">
      <h2 className="section">
        <span className="sec-ic">
          <Icon n="trophy" size={16} />
        </span>
        Ce que chaque client t'a rapporté
      </h2>
      {rows.length === 0 ? (
        <Empty>Aucun paiement sur cette période.</Empty>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Rentabilité par client">
          <table className="t t-resp">
            <thead>
              <tr>
                <th>Client</th>
                <th className="num">Encaissé</th>
                <th className="num hide-sm">Frais liés</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || 'sans'}>
                  <td className="cell-nom">
                    {r.id ? <LienProspect id={r.id}>{r.nom}</LienProspect> : <span className="muted">{r.nom}</span>}
                    <span className="tiny muted"> · {nb(r.n)} paiement{r.n > 1 ? 's' : ''}</span>
                  </td>
                  <td className="num">{eur(r.encaisse)}</td>
                  <td className="num hide-sm red">{r.frais ? `− ${eur(r.frais)}` : '—'}</td>
                  <td className={`num ${r.net < 0 ? 'red' : 'green'}`}>
                    <b>{eur(r.net)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
