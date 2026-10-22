// Tableau de bord principal : toute l'agence sur une page. Argent, une ligne par activité, logiciel, prospection,
// clients, charges, recommandations. Un seul filtre de période pour toute la page ; chaque bloc ouvre son détail.
import { Suspense, lazy, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { eur, nb, pct, go, sym } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { today, addDays, weekday, diffDays, fmtDate } from '../lib/dates'
import { encaisse, depenses, depensesDans } from '../lib/finances'
import { chargesFixesMois, echeancesEntre } from '../lib/tresorerie'
import { facturesImpayees, totals, statutDe } from '../modules/facturation'
import { lignesVentes, periodes, statsActivites, statsClients, dependance, clientsARelancer, recommandations, activitesDe } from '../modules/activites'

const ResumeLogiciel = lazy(() => import('./Plateforme').then((m) => ({ default: m.ResumeLogiciel })))

const PERIODES = [
  ['mois', 'Ce mois'],
  ['7j', '7 jours'],
  ['30j', '30 jours'],
  ['90j', '3 mois'],
  ['365j', '12 mois'],
]

const lirePeriode = () => {
  try {
    return localStorage.getItem('aecrm-pilotage-periode') || 'mois'
  } catch {
    return 'mois'
  }
}

export function Evolution({ v, inverse }) {
  if (v === null || v === undefined || !isFinite(v)) return <span className="evo neutre">nouveau</span>
  if (Math.abs(v) < 0.005) return <span className="evo neutre">= stable</span>
  const bon = inverse ? v < 0 : v > 0
  return (
    <span className={`evo ${bon ? 'haut' : 'bas'}`}>
      {v > 0 ? '▲' : '▼'} {Math.round(Math.abs(v) * 100)} %
    </span>
  )
}

function Tuile({ label, valeur, sous, evo, inverse, ton, onClick, grand }) {
  return (
    <button type="button" className={`pl-tuile ${ton || ''} ${grand ? 'grand' : ''}`} onClick={onClick} disabled={!onClick}>
      <span className="pl-tuile-l">{label}</span>
      <span className="pl-tuile-v">{valeur}</span>
      <span className="pl-tuile-s">
        {evo !== undefined && <Evolution v={evo} inverse={inverse} />} {sous}
      </span>
    </button>
  )
}

function Carte({ titre, ico, lien, libelleLien = 'Tout voir', children, className = '' }) {
  return (
    <section className={`pl-carte ${className}`}>
      <header>
        <h2>
          {ico && <Icon n={ico} size={16} />} {titre}
        </h2>
        {lien && (
          <button type="button" className="btn sm ghost" onClick={() => go(lien)}>
            {libelleLien} <Icon n="arrow-right" size={13} />
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

export default function Pilotage() {
  const { settings, ouvrir } = useNoyau()
  const { documents = [], actions = [], data } = useDonnees()
  const [choix, setChoix] = useState(lirePeriode)
  const changer = (c) => {
    setChoix(c)
    try {
      localStorage.setItem('aecrm-pilotage-periode', c)
    } catch {
      // rien
    }
  }
  const t = today()
  const p = periodes(choix, t)
  const per = { debut: p.debut, fin: p.fin }
  const avant = { debut: p.avantDebut, fin: p.avantFin }

  const lignes = useMemo(() => lignesVentes(documents, actions, data.list, settings), [documents, actions, data.list, settings])
  const parActivite = useMemo(() => statsActivites(lignes, settings, p), [lignes, settings, p.debut, p.fin]) // eslint-disable-line react-hooks/exhaustive-deps
  const clients = useMemo(() => statsClients(lignes, t), [lignes, t])
  const dep = useMemo(() => dependance(clients), [clients])

  // Argent
  const vendu = lignes.filter((l) => l.date >= p.debut && l.date <= p.fin).reduce((m, l) => m + l.montant, 0)
  const venduAvant = lignes.filter((l) => l.date >= p.avantDebut && l.date <= p.avantFin).reduce((m, l) => m + l.montant, 0)
  const marge = parActivite.reduce((m, a) => m + a.marge, 0)
  const margeAvant = lignes.filter((l) => l.date >= p.avantDebut && l.date <= p.avantFin).reduce((m, l) => m + l.marge, 0)
  const entre = encaisse(actions, per)
  const entreAvant = encaisse(actions, avant)
  const nbMois = Math.max(1, Math.round((diffDays(p.fin, p.debut) + 1) / 30))
  const fixes = chargesFixesMois(settings.depensesFixes) * (choix === 'mois' ? 1 : nbMois)
  const sorti = depenses(actions, per) + fixes
  const sortiAvant = depenses(actions, avant) + fixes
  const resultat = entre - sorti
  const impayees = documents
    .filter((d) => d.type === 'facture' && !d.data?.annulee)
    .map((d) => ({ d, statut: statutDe(d, actions), total: totals(d.data || {}).total }))
  const reste = facturesImpayees(documents, actions)
  const aEncaisser = documents
    .filter((d) => d.type === 'facture' && !d.data?.annulee)
    .reduce((m, d) => {
      const tot = totals(d.data || {}).total
      const paye = actions.filter((a) => a.action === 'Paiement reçu' && a.facture === d.numero).reduce((s, a) => s + Number(a.montant || 0), 0)
      return m + Math.max(0, tot - paye)
    }, 0)
  const retard = reste.filter((d) => d.statut === 'En retard')
  const devisAttente = documents
    .filter((d) => d.type === 'devis' && statutDe(d, actions) === 'En attente')
    .map((d) => ({ ...d, total: totals(d.data || {}).total, client: data.byId[d.prospect_id]?.name || d.data?.client?.nom || 'Client' }))

  // Prospection de la semaine (depuis lundi)
  const lundi = addDays(t, 1 - weekday(t))
  const semaine = actions.filter((a) => a.date >= lundi && a.date <= t)
  const dmSemaine = semaine.filter((a) => a.canal === 'DM' && ['Premier contact', 'Relance'].includes(a.action)).length
  const appelsSemaine = semaine.filter((a) => a.canal === 'Appel' || a.action === 'Appel').length
  const reponses = semaine.filter((a) => ['A répondu', 'Intéressé', 'RDV pris', 'Rappeler'].includes(a.resultat)).length
  const rdv = semaine.filter((a) => a.action === 'RDV' || a.resultat === 'RDV pris').length
  const nouveaux = data.list.filter((x) => (x.dateAjout || '') >= lundi).length
  const objDm = (Number(settings.objectifsJour?.dm) || 0) * 5
  const objAppels = (Number(settings.objectifsJour?.appels) || 0) * 5
  const relancesRetard = data.list.filter((x) => x.relance && x.relance < t && x.etape !== 'Gagné' && x.etape !== 'Perdu').length

  // Charges : catégories du mois et abonnements qui tombent sous 7 jours
  const parCat = {}
  for (const a of depensesDans(actions, per)) parCat[a.categorie || 'Sans catégorie'] = (parCat[a.categorie || 'Sans catégorie'] || 0) + Number(a.montant || 0)
  const cats = Object.entries(parCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const abos = echeancesEntre(settings.depensesFixes, t, addDays(t, 7))

  const aRelancer = clientsARelancer(clients, settings, { devis: devisAttente, t })
  const recos = recommandations({
    sym: sym(),
    dmSemaine,
    objectifDmSemaine: objDm,
    appelsSemaine,
    joursPasses: Math.min(5, weekday(t)),
    facturesRetard: { n: retard.length, montant: retard.reduce((m, d) => m + d.reste, 0) },
    relancesRetard,
    devisAttente: { n: devisAttente.length, montant: devisAttente.reduce((m, d) => m + d.total, 0) },
    aRelancer,
    activites: parActivite,
    dependance: dep,
    resultat,
  })

  // Quoi de neuf depuis la dernière visite
  const [derniere] = useState(() => {
    try {
      const v = localStorage.getItem('aecrm-pilotage-vu')
      localStorage.setItem('aecrm-pilotage-vu', new Date().toISOString())
      return v
    } catch {
      return null
    }
  })
  const depuis = derniere ? derniere.slice(0, 10) : t
  const neuf = actions.filter((a) => (a.created_at || a.date) > (derniere || t))
  const neufPaiements = neuf.filter((a) => a.action === 'Paiement reçu')
  const neufReponses = neuf.filter((a) => ['A répondu', 'Intéressé', 'RDV pris'].includes(a.resultat)).length

  const top = clients.slice(0, 6)
  const max = Math.max(1, ...parActivite.map((a) => a.ca))
  const phrase = (() => {
    const meilleure = [...parActivite].sort((a, b) => b.marge - a.marge)[0]
    const morceaux = []
    if (meilleure?.ca) morceaux.push(`${meilleure.nom} porte l’agence (${eur(meilleure.marge)} de marge)`)
    if (objDm && dmSemaine < objDm * 0.5) morceaux.push(`la prospection est en retard (${dmSemaine} DM sur ${objDm})`)
    else if (dmSemaine) morceaux.push(`${dmSemaine} DM envoyés cette semaine`)
    if (retard.length) morceaux.push(`${retard.length} facture(s) en retard`)
    return morceaux.length ? `${morceaux.join(', ')}.` : 'Note tes ventes et tes DM : le tableau de bord se remplit tout seul.'
  })()

  return (
    <div className="pilotage">
      <div className="pl-tete">
        <div>
          <h1>Tableau de bord</h1>
          <p className="pl-phrase">{phrase.charAt(0).toUpperCase() + phrase.slice(1)}</p>
        </div>
        <div className="pl-actions">
          <div className="pl-periodes" role="group" aria-label="Période">
            {PERIODES.map(([k, l]) => (
              <button key={k} type="button" className={choix === k ? 'on' : ''} aria-pressed={choix === k} onClick={() => changer(k)}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={() => ouvrir('vente')}>
            <Icon n="plus" size={15} /> Nouvelle vente
          </button>
          <button type="button" className="btn" onClick={() => ouvrir('dm')}>
            <Icon n="message" size={15} /> Noter mes DM
          </button>
        </div>
      </div>

      {derniere && (neufPaiements.length > 0 || neufReponses > 0) && (
        <div className="pl-neuf">
          <span className="pl-direct" /> Depuis ta dernière visite ({fmtDate(depuis)}) :
          {neufPaiements.length > 0 && <strong> {neufPaiements.length} paiement(s) reçu(s), {eur(neufPaiements.reduce((m, a) => m + Number(a.montant || 0), 0))}</strong>}
          {neufReponses > 0 && <strong> · {neufReponses} réponse(s) de prospects</strong>}
        </div>
      )}

      <div className="pl-tuiles">
        <Tuile grand label={`Encaissé · ${p.nom}`} valeur={eur(entre)} evo={entreAvant || entre ? (entreAvant ? (entre - entreAvant) / entreAvant : null) : 0} sous="vs période d’avant" onClick={() => go('/paiements')} />
        <Tuile label="Vendu" valeur={eur(vendu)} evo={venduAvant ? (vendu - venduAvant) / venduAvant : vendu ? null : 0} sous={`${lignes.filter((l) => l.date >= p.debut && l.date <= p.fin).length} vente(s)`} onClick={() => go('/activites')} />
        <Tuile label="Marge" valeur={eur(marge)} evo={margeAvant ? (marge - margeAvant) / margeAvant : marge ? null : 0} sous={vendu ? `${pct(marge / vendu)} des ventes` : ''} onClick={() => go('/activites')} />
        <Tuile label="Charges" valeur={eur(sorti)} evo={sortiAvant ? (sorti - sortiAvant) / sortiAvant : 0} inverse sous="dépenses + abonnements" onClick={() => go('/charges')} />
        <Tuile label="Résultat" valeur={eur(resultat)} ton={resultat < 0 ? 'rouge' : 'vert'} sous="encaissé − charges" onClick={() => go('/charges')} />
        <Tuile label="À encaisser" valeur={eur(aEncaisser)} ton={retard.length ? 'orange' : ''} sous={retard.length ? `${retard.length} facture(s) en retard` : 'aucune en retard'} onClick={() => go('/factures?filtre=impayees')} />
      </div>

      <div className="pl-grille">
        <Carte titre="Activités" ico="layers" lien="/activites" className="pl-large">
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="t pl-table">
              <thead>
                <tr>
                  <th>Activité</th>
                  <th className="num">Ventes</th>
                  <th className="num">Chiffre d’affaires</th>
                  <th className="num">Marge</th>
                  <th className="num">Évolution</th>
                  <th className="num">Part du bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {parActivite.map((a) => (
                  <tr key={a.id} className="click" onClick={() => go(`/activites/${a.id}`)}>
                    <td>
                      <span className="pastille-act" style={{ '--c': a.couleur }} /> {a.nom}
                      <span className="pl-barre" aria-hidden="true">
                        <i style={{ width: `${(a.ca / max) * 100}%`, background: a.couleur }} />
                      </span>
                    </td>
                    <td className="num">{nb(a.ventes)}</td>
                    <td className="num bold">{eur(a.ca)}</td>
                    <td className="num">
                      {eur(a.marge)}
                      {a.tauxMarge !== null && <span className="tiny muted"> · {pct(a.tauxMarge)}</span>}
                    </td>
                    <td className="num">
                      <Evolution v={a.caAvant || a.ca ? a.evolution : 0} />
                    </td>
                    <td className="num">{pct(a.part)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="bold">Total</td>
                  <td className="num">{nb(parActivite.reduce((m, a) => m + a.ventes, 0))}</td>
                  <td className="num bold">{eur(vendu)}</td>
                  <td className="num bold">{eur(marge)}</td>
                  <td className="num">
                    <Evolution v={venduAvant ? (vendu - venduAvant) / venduAvant : vendu ? null : 0} />
                  </td>
                  <td className="num">100 %</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Carte>

        <Carte titre="À faire maintenant" ico="bolt" className="pl-recos">
          {recos.length === 0 ? (
            <p className="small muted">Rien d’urgent. Profite-en pour prospecter ou relancer un ancien client.</p>
          ) : (
            <ul className="pl-reco-liste">
              {recos.slice(0, 5).map((r, i) => (
                <li key={i} className={r.ton}>
                  <div>
                    <strong>{r.titre}</strong>
                    <span className="small muted bloc">{r.detail}</span>
                  </div>
                  <button type="button" className="btn sm" onClick={() => (r.faire ? ouvrir(r.faire) : go(r.route))}>
                    {r.action}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Logiciel de caisse" ico="briefcase" lien="/controle" libelleLien="Centre logiciel">
          <Suspense fallback={<div className="chargement" aria-busy="true" />}>
            <ResumeLogiciel objectif={Number(settings.objectifLicences) || 10} />
          </Suspense>
        </Carte>

        <Carte titre="Prospection de la semaine" ico="target" lien="/journee" libelleLien="Prospection">
          <div className="pl-mini">
            <Mini label="DM envoyés" v={dmSemaine} obj={objDm} />
            <Mini label="Appels" v={appelsSemaine} obj={objAppels} />
            <Mini label="Réponses" v={reponses} sous={dmSemaine ? `${pct(reponses / Math.max(1, dmSemaine + appelsSemaine))} de réponse` : ''} />
            <Mini label="RDV" v={rdv} />
            <Mini label="Nouveaux prospects" v={nouveaux} />
            <Mini label="Relances en retard" v={relancesRetard} ton={relancesRetard ? 'rouge' : ''} />
          </div>
        </Carte>

        <Carte titre="Meilleurs clients" ico="users" lien="/ventes-clients">
          {top.length === 0 ? (
            <p className="small muted">Tes clients apparaîtront ici dès la première vente notée.</p>
          ) : (
            <>
              <ul className="pl-clients">
                {top.map((c) => (
                  <li key={c.cle}>
                    <button type="button" className="lien" onClick={() => c.prospectId && go(`/prospect/${c.prospectId}`)}>
                      {c.nom}
                    </button>
                    <span className={`etiquette e-${c.etiquette.replace(/\W/g, '')}`}>{c.etiquette}</span>
                    <span className="tiny muted">{c.services[0]?.designation}</span>
                    <strong className="num">{eur(c.ca)}</strong>
                  </li>
                ))}
              </ul>
              {dep.part >= 0.5 && dep.clients.length >= 2 && <p className="tiny pl-alerte">Tes 3 premiers clients font {pct(dep.part)} de ta marge.</p>}
            </>
          )}
        </Carte>

        <Carte titre="Charges" ico="wallet" lien="/charges">
          {cats.length === 0 && !fixes ? (
            <p className="small muted">Aucune dépense notée sur la période.</p>
          ) : (
            <ul className="pl-cats">
              {fixes > 0 && (
                <li>
                  <span>Abonnements et charges fixes</span>
                  <strong>{eur(fixes)}</strong>
                </li>
              )}
              {cats.slice(0, 5).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong>{eur(v)}</strong>
                </li>
              ))}
            </ul>
          )}
          {abos.length > 0 && <p className="tiny muted">À payer sous 7 jours : {abos.map((x) => `${x.d.nom} (${eur(x.montant)})`).join(', ')}</p>}
        </Carte>

        <Carte titre="À relancer" ico="repeat" lien="/relances" libelleLien="Mode relance">
          {aRelancer.length === 0 ? (
            <p className="small muted">Aucun client à relancer pour l’instant.</p>
          ) : (
            <ul className="pl-clients">
              {aRelancer.slice(0, 4).map((x, i) => (
                <li key={i}>
                  <span className="bold">{x.client.nom}</span>
                  <span className="tiny muted">{x.raison}</span>
                  <strong className="num">{eur(x.potentiel)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
      {impayees.length === 0 && lignes.length === 0 && (
        <div className="card empty">
          Aucune vente notée pour l’instant.{' '}
          <button type="button" className="btn sm primary" onClick={() => ouvrir('vente')}>
            Noter ma première vente
          </button>
        </div>
      )}
      <p className="tiny muted pl-pied">Activités : {activitesDe(settings).length} · les ventes viennent des factures, les marges des coûts notés. Les démos ne sont jamais comptées.</p>
    </div>
  )
}

function Mini({ label, v, obj, sous, ton }) {
  return (
    <div className={`pl-mini-c ${ton || ''}`}>
      <span className="pl-mini-v">
        {nb(v)}
        {obj ? <small> / {nb(obj)}</small> : null}
      </span>
      <span className="pl-mini-l">{label}</span>
      {obj ? (
        <span className="dm-barre" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (v / obj) * 100)}%` }} />
        </span>
      ) : sous ? (
        <span className="tiny muted">{sous}</span>
      ) : null}
    </div>
  )
}
