// Réseau : tous tes contacts au même endroit. Deux grandes portes (Clients, Prospects), quelques chiffres,
// ce qu'il faut compléter, et l'ajout rapide d'un prospect en une ligne.
import { useState } from 'react'
import { Icon } from '../icons'
import { eur, nb, go } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { fmtDate } from '../lib/dates'
import { paiementsDetailles, aCompleter } from '../modules/activites'

export default function Reseau() {
  const { settings, api, toast } = useNoyau()
  const { actions = [], documents = [], data } = useDonnees()
  const [nom, setNom] = useState('')
  const ids = new Set(data.clients.map((c) => c.id))
  const prospects = data.list.filter((p) => !ids.has(p.id))
  const paiements = paiementsDetailles(actions, documents, data.list, settings)
  const manque = aCompleter(paiements, data.list)
  const ouverts = prospects.filter((p) => !['Gagné', 'Perdu'].includes(p.etape))
  const chauds = ouverts.filter((p) => !['Nouveau', 'Contacté'].includes(p.etape) && p.etape)
  const oublies = ouverts.filter((p) => p.joursSansAction !== null && p.joursSansAction > 7)
  const recents = [...actions].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8)

  const ajouter = async (e) => {
    e.preventDefault()
    if (!nom.trim()) return
    const p = await api.addProspect(nom.trim(), { source: 'Ajout rapide' })
    setNom('')
    toast(`${p?.name || 'Prospect'} ajouté ✓`)
  }

  return (
    <div className="stack reseau">
      <div className="tb-tete">
        <div>
          <h1>Réseau</h1>
          <p className="tb-phrase">Tous tes contacts : {nb(data.clients.length)} clients et {nb(prospects.length)} prospects.</p>
        </div>
      </div>

      <div className="reseau-portes">
        <button type="button" className="reseau-porte clients" onClick={() => go('/clients')}>
          <span className="reseau-porte-ico">
            <Icon n="briefcase" size={26} />
          </span>
          <strong>Clients</strong>
          <span className="reseau-porte-n">{nb(data.clients.length)}</span>
          <span className="small">Ceux qui ont déjà payé : factures, devis, paiements, activité.</span>
        </button>
        <button type="button" className="reseau-porte prospects" onClick={() => go('/acquisition')}>
          <span className="reseau-porte-ico">
            <Icon n="target" size={26} />
          </span>
          <strong>Prospects</strong>
          <span className="reseau-porte-n">{nb(prospects.length)}</span>
          <span className="small">Ceux à convaincre : propositions envoyées, relances, prochaine étape.</span>
        </button>
      </div>

      <form className="reseau-ajout" onSubmit={ajouter}>
        <Icon n="user-plus" size={18} />
        <input className="input" placeholder="Ajouter un prospect : écris son nom et appuie sur Entrée" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button type="submit" className="btn primary" disabled={!nom.trim()}>
          Ajouter
        </button>
      </form>

      <div className="tb-chiffres">
        <button type="button" className="tb-chiffre" onClick={() => go('/acquisition')}>
          <span className="tb-mini-l">Prospects chauds</span>
          <strong>{nb(chauds.length)}</strong>
          <span className="tiny muted">intéressés ou en discussion</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => go('/relances')}>
          <span className="tb-mini-l">Oubliés</span>
          <strong>{nb(oublies.length)}</strong>
          <span className="tiny muted">pas de nouvelles depuis 7 jours</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => go('/clients')}>
          <span className="tb-mini-l">Fiches à compléter</span>
          <strong>{nb(manque.fiches.length)}</strong>
          <span className="tiny muted">clients sans numéro ou ville</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => go('/ventes-clients')}>
          <span className="tb-mini-l">Argent reçu des clients</span>
          <strong>{eur(paiements.reduce((m, x) => m + x.montant, 0))}</strong>
          <span className="tiny muted">depuis le début</span>
        </button>
      </div>

      <div className="tb-grille">
        <section className="tb-carte">
          <header>
            <h2>À compléter</h2>
          </header>
          {manque.fiches.length === 0 ? (
            <p className="small muted">Toutes les fiches de tes clients sont complètes.</p>
          ) : (
            <ul className="tb-completer">
              {manque.fiches.slice(0, 8).map((x) => (
                <li key={x.prospect.id}>
                  <span>
                    <b>{x.prospect.name}</b> : il manque {x.manque.join(', ')}
                  </span>
                  <button type="button" className="btn sm" onClick={() => go(`/prospect/${x.prospect.id}`)}>
                    Compléter
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="tb-carte">
          <header>
            <h2>Dernières actions</h2>
          </header>
          <ul className="tb-paiements">
            {recents.map((a) => (
              <li key={a.id}>
                <span className={`tb-statut ${a.action === 'Paiement reçu' ? 'vert' : 'bleu'}`} />
                <div className="tb-paiement-txt">
                  <button type="button" className="lien" onClick={() => a.prospect_id && go(`/prospect/${a.prospect_id}`)}>
                    <strong>{data.byId[a.prospect_id]?.name || 'Sans fiche'}</strong>
                  </button>
                  <span className="tiny muted">
                    {fmtDate(a.date)} · {a.action}
                    {a.montant ? ` · ${eur(Number(a.montant) || 0)}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
