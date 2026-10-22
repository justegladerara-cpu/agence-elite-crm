// Centre Ventes et activités : une page par activité (ce qu'elle vend, à qui, sa marge), le classement des
// clients (ce que chacun rapporte et achète), le mode relance (qui recontacter, message prêt) et les réglages.
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Field, Empty, eur, nb, pct, go } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { today, fmtDate, addDays } from '../lib/dates'
import { waLink } from '../lib/logic'
import { copier } from '../lib/copier'
import { statutDe, totals } from '../modules/facturation'
import { ligne } from '../modules/commercial'
import { ACTIVITES_DEFAUT, MODELES, activitesDe, activiteParId, lignesVentes, periodes, statsActivites, statsClients, meilleursServices, clientsARelancer } from '../modules/activites'
import { Evolution } from './Pilotage'

const PERIODES = [
  ['mois', 'Ce mois'],
  ['30j', '30 jours'],
  ['90j', '3 mois'],
  ['365j', '12 mois'],
]

function useVentes() {
  const { settings } = useNoyau()
  const { documents = [], actions = [], data } = useDonnees()
  const lignes = useMemo(() => lignesVentes(documents, actions, data.list, settings), [documents, actions, data.list, settings])
  return { lignes, settings, documents, actions, data }
}

function ChoixPeriode({ value, onChange }) {
  return (
    <div className="pl-periodes" role="group" aria-label="Période">
      {PERIODES.map(([k, l]) => (
        <button key={k} type="button" className={value === k ? 'on' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ——— Toutes les activités ———
export default function Activites({ id }) {
  if (id) return <Activite id={id} />
  return <ListeActivites />
}

function ListeActivites() {
  const { lignes, settings } = useVentes()
  const { ouvrir } = useNoyau()
  const [choix, setChoix] = useState('mois')
  const [reglages, setReglages] = useState(false)
  const p = periodes(choix)
  const stats = statsActivites(lignes, settings, p)
  return (
    <div className="pilotage">
      <div className="pl-tete">
        <div>
          <h1>Ventes et activités</h1>
          <p className="pl-phrase">Chaque vente est rangée dans son activité. Clique sur une activité pour voir ce qu’elle vend et à qui.</p>
        </div>
        <div className="pl-actions">
          <ChoixPeriode value={choix} onChange={setChoix} />
          <button type="button" className="btn primary" onClick={() => ouvrir('vente')}>
            <Icon n="plus" size={15} /> Nouvelle vente
          </button>
          <button type="button" className="btn" onClick={() => setReglages((x) => !x)} aria-expanded={reglages}>
            <Icon n="settings" size={15} /> Réglages des activités
          </button>
        </div>
      </div>
      {reglages && <ReglagesActivites onFini={() => setReglages(false)} />}
      <div className="act-cartes">
        {stats.map((a) => (
          <button key={a.id} type="button" className="act-carte" style={{ '--c': a.couleur }} onClick={() => go(`/activites/${a.id}`)}>
            <span className="act-nom">
              <span className="pastille-act" /> {a.nom}
            </span>
            <span className="act-ca">{eur(a.ca)}</span>
            <span className="act-ligne">
              <Evolution v={a.caAvant || a.ca ? a.evolution : 0} /> <span className="muted">vs période d’avant</span>
            </span>
            <span className="act-chiffres">
              <span>
                <b>{eur(a.marge)}</b> marge{a.tauxMarge !== null ? ` (${pct(a.tauxMarge)})` : ''}
              </span>
              <span>
                <b>{nb(a.ventes)}</b> vente(s)
              </span>
              <span>
                <b>{nb(a.clients)}</b> client(s)
              </span>
              <span>
                <b>{pct(a.part)}</b> du bénéfice
              </span>
            </span>
            <span className="tiny muted">{MODELES[a.modele] || ''}</span>
          </button>
        ))}
      </div>
      <DernieresVentes lignes={lignes.slice(-12).reverse()} />
    </div>
  )
}

function DernieresVentes({ lignes, titre = 'Dernières ventes' }) {
  const { settings } = useNoyau()
  if (!lignes.length) return <div className="card empty">Aucune vente pour l’instant. Note ta première vente avec le bouton « Nouvelle vente ».</div>
  return (
    <section className="pl-carte">
      <header>
        <h2>{titre}</h2>
      </header>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau">
        <table className="t">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Ce qui a été vendu</th>
              <th>Activité</th>
              <th className="num">Montant</th>
              <th className="num">Marge</th>
              <th className="num">Payé</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const a = activiteParId(settings, l.activite)
              return (
                <tr key={`${l.docId}-${i}`} className="click" onClick={() => go(`/facture/${l.docId}`)}>
                  <td>{fmtDate(l.date)}</td>
                  <td className="bold">{l.client}</td>
                  <td>{l.designation}</td>
                  <td>
                    <span className="pastille-act" style={{ '--c': a.couleur }} /> {a.nom}
                  </td>
                  <td className="num">{eur(l.montant)}</td>
                  <td className="num">{l.cout === null ? <span className="muted" title="Aucun coût noté">{eur(l.marge)}</span> : eur(l.marge)}</td>
                  <td className="num">{l.encaisse >= l.montant ? <span className="badge b-green">Payé</span> : l.encaisse > 0 ? <span className="badge b-orange">En partie</span> : <span className="badge b-gold">À encaisser</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ——— Une activité ———
function Activite({ id }) {
  const { lignes, settings } = useVentes()
  const [choix, setChoix] = useState('365j')
  const a = activiteParId(settings, id)
  const p = periodes(choix)
  const s = statsActivites(lignes, settings, p).find((x) => x.id === a.id) || { ca: 0, marge: 0, ventes: 0, clients: 0 }
  const siennes = lignes.filter((l) => l.activite === a.id)
  const periode = siennes.filter((l) => l.date >= p.debut && l.date <= p.fin)
  const services = meilleursServices(periode, 8)
  const clients = statsClients(periode).slice(0, 8)
  const sansCout = periode.filter((l) => l.cout === null).length
  return (
    <div className="pilotage" style={{ '--app': a.couleur }}>
      <div className="pl-tete">
        <div>
          <button type="button" className="btn sm ghost" onClick={() => go('/activites')}>
            <Icon n="arrow-left" size={13} /> Toutes les activités
          </button>
          <h1>
            <span className="pastille-act grand" style={{ '--c': a.couleur }} /> {a.nom}
          </h1>
          <p className="pl-phrase">{MODELES[a.modele] || ''}</p>
        </div>
        <ChoixPeriode value={choix} onChange={setChoix} />
      </div>
      <div className="pl-tuiles">
        <div className="pl-tuile grand">
          <span className="pl-tuile-l">Chiffre d’affaires</span>
          <span className="pl-tuile-v">{eur(s.ca)}</span>
          <span className="pl-tuile-s">
            <Evolution v={s.caAvant || s.ca ? s.evolution : 0} /> vs période d’avant
          </span>
        </div>
        <div className="pl-tuile">
          <span className="pl-tuile-l">Marge</span>
          <span className="pl-tuile-v">{eur(s.marge)}</span>
          <span className="pl-tuile-s">{s.tauxMarge !== null && s.tauxMarge !== undefined ? `${pct(s.tauxMarge)} des ventes` : ''}</span>
        </div>
        <div className="pl-tuile">
          <span className="pl-tuile-l">Ventes</span>
          <span className="pl-tuile-v">{nb(s.ventes)}</span>
          <span className="pl-tuile-s">vente moyenne {eur(s.moyenne)}</span>
        </div>
        <div className="pl-tuile">
          <span className="pl-tuile-l">Clients</span>
          <span className="pl-tuile-v">{nb(s.clients)}</span>
          <span className="pl-tuile-s">{pct(s.part)} du bénéfice de l’agence</span>
        </div>
      </div>
      {sansCout > 0 && a.modele === 'revente' && <p className="small pl-alerte">{sansCout} vente(s) sans coût d’achat noté : la marge affichée est trop haute. Ouvre la facture et note le coût sur la ligne.</p>}
      <div className="pl-grille">
        <section className="pl-carte">
          <header>
            <h2>Ce qui se vend le mieux</h2>
          </header>
          {services.length === 0 ? (
            <Empty>Rien sur la période.</Empty>
          ) : (
            <ul className="pl-cats">
              {services.map((x) => (
                <li key={x.designation}>
                  <span>
                    {x.designation} <span className="tiny muted">· {x.ventes} fois</span>
                  </span>
                  <strong>
                    {eur(x.ca)} <span className="tiny muted">marge {eur(x.marge)}</span>
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pl-carte">
          <header>
            <h2>Meilleurs clients de l’activité</h2>
          </header>
          {clients.length === 0 ? (
            <Empty>Rien sur la période.</Empty>
          ) : (
            <ul className="pl-clients">
              {clients.map((c) => (
                <li key={c.cle}>
                  <button type="button" className="lien" onClick={() => c.prospectId && go(`/prospect/${c.prospectId}`)}>
                    {c.nom}
                  </button>
                  <span className="tiny muted">{c.achats} achat(s)</span>
                  <strong className="num">{eur(c.ca)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <DernieresVentes lignes={[...periode].reverse().slice(0, 30)} titre="Ventes de la période" />
    </div>
  )
}

// ——— Réglages des activités ———
function ReglagesActivites({ onFini }) {
  const { settings, api, toast } = useNoyau()
  const [liste, setListe] = useState(() => activitesDe(settings).map((a) => ({ ...a, motsTexte: (a.mots || []).join(', ') })))
  const set = (i, patch) => setListe((l) => l.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const enregistrer = async () => {
    const propre = liste
      .filter((a) => a.nom.trim())
      .map(({ motsTexte, ...a }) => ({ ...a, nom: a.nom.trim(), id: a.id || a.nom.trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'), mots: motsTexte.split(',').map((m) => m.trim()).filter(Boolean) }))
    if (!propre.some((a) => a.id === 'autre')) propre.push(ACTIVITES_DEFAUT.find((a) => a.id === 'autre'))
    await api.saveSettings({ ...settings, activites: propre })
    toast('Activités enregistrées ✓')
    onFini()
  }
  return (
    <section className="pl-carte">
      <header>
        <h2>Réglages des activités</h2>
      </header>
      <p className="small muted">Une activité = ce que tu vends (matériel, logiciel, design…). Les mots-clés servent à ranger tout seul chaque vente : « affiche » va dans Communication.</p>
      <div className="stack">
        {liste.map((a, i) => (
          <div key={a.id || i} className="act-reglage">
            <input type="color" value={a.couleur || '#5B6475'} onChange={(e) => set(i, { couleur: e.target.value })} aria-label="Couleur" />
            <Field label="Nom">
              <input className="input" value={a.nom} onChange={(e) => set(i, { nom: e.target.value })} />
            </Field>
            <Field label="Façon de gagner de l’argent">
              <select className="input" value={a.modele || 'prestation'} onChange={(e) => set(i, { modele: e.target.value })}>
                {Object.entries(MODELES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mots-clés (séparés par des virgules)">
              <input className="input" value={a.motsTexte} onChange={(e) => set(i, { motsTexte: e.target.value })} disabled={a.id === 'autre'} />
            </Field>
            {a.id !== 'autre' && (
              <button type="button" className="btn sm ghost" onClick={() => setListe((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer ${a.nom}`}>
                <Icon n="trash" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => setListe((l) => [...l.filter((a) => a.id !== 'autre'), { id: '', nom: '', modele: 'prestation', couleur: '#2F6FED', motsTexte: '' }, ...l.filter((a) => a.id === 'autre')])}>
          <Icon n="plus" size={14} /> Ajouter une activité
        </button>
        <button type="button" className="btn primary sm" onClick={enregistrer}>
          Enregistrer
        </button>
      </div>
    </section>
  )
}

// ——— Classement des clients ———
const ETIQUETTES = ['Tous', 'Fidèle', 'Nouveau', 'À relancer', 'Client']
export function ClientsVentes() {
  const { lignes, settings } = useVentes()
  const [tri, setTri] = useState('ca')
  const [filtre, setFiltre] = useState('Tous')
  const tous = statsClients(lignes)
  const liste = tous.filter((c) => filtre === 'Tous' || c.etiquette === filtre).sort((a, b) => (tri === 'recent' ? String(b.dernier).localeCompare(String(a.dernier)) : (b[tri] || 0) - (a[tri] || 0)))
  const total = tous.reduce((m, c) => m + c.ca, 0)
  return (
    <div className="pilotage">
      <div className="pl-tete">
        <div>
          <h1>Clients</h1>
          <p className="pl-phrase">
            {nb(tous.length)} client(s) · {eur(total)} vendus au total. Clique sur un client pour ouvrir sa fiche.
          </p>
        </div>
        <div className="pl-periodes" role="group" aria-label="Filtrer">
          {ETIQUETTES.map((e) => (
            <button key={e} type="button" className={filtre === e ? 'on' : ''} onClick={() => setFiltre(e)}>
              {e} <span className="tiny">{e === 'Tous' ? tous.length : tous.filter((c) => c.etiquette === e).length}</span>
            </button>
          ))}
        </div>
      </div>
      {liste.length === 0 ? (
        <div className="card empty">Aucun client dans ce filtre.</div>
      ) : (
        <div className="card flush">
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="t">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client</th>
                  <th>
                    <button type="button" className={`th-tri ${tri === 'ca' ? 'on' : ''}`} onClick={() => setTri('ca')}>
                      Rapporté
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-tri ${tri === 'marge' ? 'on' : ''}`} onClick={() => setTri('marge')}>
                      Marge
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-tri ${tri === 'achats' ? 'on' : ''}`} onClick={() => setTri('achats')}>
                      Achats
                    </button>
                  </th>
                  <th>Ce qu’il achète le plus</th>
                  <th>
                    <button type="button" className={`th-tri ${tri === 'recent' ? 'on' : ''}`} onClick={() => setTri('recent')}>
                      Dernier achat
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-tri ${tri === 'du' ? 'on' : ''}`} onClick={() => setTri('du')}>
                      Te doit
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {liste.map((c, i) => (
                  <tr key={c.cle} className={c.prospectId ? 'click' : ''} onClick={() => c.prospectId && go(`/prospect/${c.prospectId}`)}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <span className="bold">{c.nom}</span> <span className={`etiquette e-${c.etiquette.replace(/\W/g, '')}`}>{c.etiquette}</span>
                    </td>
                    <td className="num bold">{eur(c.ca)}</td>
                    <td className="num">{eur(c.marge)}</td>
                    <td className="num">{nb(c.achats)}</td>
                    <td>
                      {c.activites.slice(0, 2).map((a) => (
                        <span key={a.id} className="chip-act" style={{ '--c': activiteParId(settings, a.id).couleur }}>
                          {activiteParId(settings, a.id).nom} {pct(a.part)}
                        </span>
                      ))}
                      <span className="tiny muted bloc">{c.services[0]?.designation}</span>
                    </td>
                    <td>
                      {fmtDate(c.dernier)}
                      {c.rythme ? <span className="tiny muted bloc">tous les {c.rythme} j en moyenne</span> : null}
                    </td>
                    <td className="num">{c.du > 0 ? <span className="rouge">{eur(c.du)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ——— Mode relance ———
export function Relances() {
  const { lignes, settings, documents, actions, data } = useVentes()
  const { api, toast } = useNoyau()
  const t = today()
  const clients = statsClients(lignes, t)
  const devis = documents
    .filter((d) => d.type === 'devis' && statutDe(d, actions) === 'En attente')
    .map((d) => ({ ...d, total: totals(d.data || {}).total, client: data.byId[d.prospect_id]?.name || d.data?.client?.nom || 'Client' }))
  const liste = clientsARelancer(clients, settings, { devis, t })
  // Déjà relancé dans les 7 derniers jours : sort de la liste
  const recents = new Set(actions.filter((a) => a.action === 'Relance' && a.date >= addDays(t, -7)).map((a) => a.prospect_id))
  const visibles = liste.filter((x) => !x.client.prospectId || !recents.has(x.client.prospectId))
  const potentiel = visibles.reduce((m, x) => m + (x.potentiel || 0), 0)
  const [ouvert, setOuvert] = useState(null)
  const noter = async (x, resultat) => {
    if (!x.client.prospectId) return
    await api.addActions([ligne(x.client.prospectId, { canal: 'WhatsApp', action: 'Relance', resultat: resultat || undefined, notes: x.raison, prochaine_action: resultat ? undefined : 'Voir la réponse', date_relance: resultat ? undefined : addDays(t, 3) })])
    toast(resultat ? `${x.client.nom} : ${resultat} ✓` : `Relance de ${x.client.nom} notée ✓`)
  }
  return (
    <div className="pilotage">
      <div className="pl-tete">
        <div>
          <h1>Mode relance</h1>
          <p className="pl-phrase">
            {visibles.length ? `${nb(visibles.length)} client(s) à relancer · environ ${eur(potentiel)} possibles. Le message est déjà écrit.` : 'Personne à relancer pour l’instant : tes clients ont été contactés récemment.'}
          </p>
        </div>
      </div>
      <ul className="rl-liste">
        {visibles.map((x, i) => {
          const fiche = x.client.prospectId ? data.byId[x.client.prospectId]?.fiche || {} : {}
          const tel = fiche.whatsapp || fiche.telephone
          const lien = tel ? `${waLink(tel, settings.clients?.indicatifWhatsApp || '242')}?text=${encodeURIComponent(x.message)}` : ''
          return (
            <li key={i} className={`rl-item t-${x.type}`}>
              <div className="rl-tete">
                <div>
                  <strong>{x.client.nom}</strong>
                  <span className="small muted bloc">{x.raison}</span>
                </div>
                <span className="rl-pot">{eur(x.potentiel)}</span>
              </div>
              {ouvert === i ? <textarea className="input" rows={3} defaultValue={x.message} onChange={(e) => (x.message = e.target.value)} /> : <p className="rl-msg">{x.message}</p>}
              <div className="row">
                {lien ? (
                  <a className="btn sm primary" href={lien} target="_blank" rel="noreferrer" onClick={() => noter(x)}>
                    <Icon n="message" size={14} /> Envoyer sur WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={async () => {
                      await copier(x.message)
                      toast('Message copié ✓ · colle-le dans ta conversation')
                      noter(x)
                    }}
                  >
                    <Icon n="copy" size={14} /> Copier le message
                  </button>
                )}
                <button type="button" className="btn sm ghost" onClick={() => setOuvert(ouvert === i ? null : i)}>
                  {ouvert === i ? 'Fini' : 'Modifier le message'}
                </button>
                {x.client.prospectId && (
                  <>
                    <button type="button" className="btn sm ghost" onClick={() => noter(x, 'A répondu')}>
                      A répondu
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => noter(x, 'Intéressé')}>
                      Intéressé
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => go(`/prospect/${x.client.prospectId}`)}>
                      Fiche
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ——— Bloc « Ce client t'a rapporté » de la fiche ———
export function BilanClient({ pid }) {
  const { lignes, settings } = useVentes()
  const c = statsClients(lignes.filter((l) => l.prospectId === pid))[0]
  if (!c) return null
  return (
    <section className="card bilan-client">
      <h2 className="section">
        <Icon n="coins" size={15} /> Ce client t’a rapporté
      </h2>
      <div className="bc-chiffres">
        <div>
          <span className="pl-tuile-v">{eur(c.ca)}</span>
          <span className="tiny muted">au total · marge {eur(c.marge)}</span>
        </div>
        <div>
          <span className="pl-tuile-v">{nb(c.achats)}</span>
          <span className="tiny muted">achat(s){c.rythme ? ` · tous les ${c.rythme} j` : ''}</span>
        </div>
        <div>
          <span className="pl-tuile-v">{fmtDate(c.dernier)}</span>
          <span className="tiny muted">dernier achat · il y a {c.depuis} j</span>
        </div>
        {c.du > 0 && (
          <div>
            <span className="pl-tuile-v rouge">{eur(c.du)}</span>
            <span className="tiny muted">te doit encore</span>
          </div>
        )}
      </div>
      <div className="bc-acts">
        {c.activites.map((a) => (
          <span key={a.id} className="chip-act" style={{ '--c': activiteParId(settings, a.id).couleur }}>
            {activiteParId(settings, a.id).nom} · {pct(a.part)}
          </span>
        ))}
        <span className={`etiquette e-${c.etiquette.replace(/\W/g, '')}`}>{c.etiquette}</span>
      </div>
      {c.services.length > 0 && <p className="small muted">Ce que tu lui vends le plus : {c.services.map((s) => `${s.designation} (${s.ventes} fois)`).join(', ')}</p>}
    </section>
  )
}
