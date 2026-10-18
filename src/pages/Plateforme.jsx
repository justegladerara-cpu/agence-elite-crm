// Plateforme : le CRM est le centre d'administration d'Agence Elite (ce que faisait le super admin du SaaS).
// Tour de contrôle (tout voir), Clients de la plateforme, fiche client complète avec ses boutons, boîte à outils.
// Les données des clients restent dans la base de la plateforme : le CRM les lit et agit par ses fonctions.
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../icons'
import { Modal, Field, Chips, Empty, confirmer, go } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { appeler, deconnecter, sessionValide } from '../modules/plateforme/connexion'
import { ConnexionPlateforme } from '../modules/plateforme/ui'
import { alertes, clientsReels, construireVue, ficheLiee, indicateurs, lireCommande, LIBELLES_CHRONO } from '../modules/plateforme/calculs'
import { statutDe } from '../modules/facturation'

export const ADRESSE_SAAS = 'https://saas.agence-elite.fr'
const fcfa = (v) => `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} FCFA`
const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const quand = (d) => {
  if (!d) return 'jamais'
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`
  return `il y a ${Math.floor(min / 1440)} j`
}
const aujourdhui = () => new Date().toISOString().slice(0, 10)
const plusJours = (base, n) => {
  const d = new Date(`${base}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const TON_BADGE = { vert: 'b-green', orange: 'b-orange', rouge: 'b-red', gris: 'b-navy' }
const MODES = ['Espèces', 'Mobile Money', 'Virement', 'Carte', 'Chèque']

// Données de la plateforme partagées entre les écrans (un seul chargement, rafraîchi toutes les minutes)
let cache = null
const abonnes = new Set()
let enCours = null
async function chargerTout() {
  if (enCours) return enCours
  enCours = Promise.all([appeler('editeur_vue'), appeler('pilotage_activite'), appeler('pilotage_messages'), appeler('editeur_tableau_de_bord')])
    .then(([vue, activite, messages, tableau]) => {
      cache = { ...construireVue(vue, activite, messages), tableau, charge: Date.now(), erreur: null }
      return cache
    })
    .catch((e) => {
      cache = { ...(cache || {}), erreur: e.message }
      return cache
    })
    .finally(() => {
      enCours = null
      abonnes.forEach((f) => f(cache))
    })
  return enCours
}
export function oublierPlateforme() {
  cache = null
}

function usePlateforme() {
  const [etat, setEtat] = useState(cache)
  const [connecte, setConnecte] = useState(cache && !cache.erreur ? true : null)
  useEffect(() => {
    abonnes.add(setEtat)
    let arret = false
    sessionValide().then((ok) => {
      if (arret) return
      setConnecte(ok)
      if (ok && (!cache || Date.now() - cache.charge > 30000)) chargerTout()
    })
    const t = setInterval(() => document.visibilityState === 'visible' && cache && chargerTout(), 60000)
    return () => {
      arret = true
      abonnes.delete(setEtat)
      clearInterval(t)
    }
  }, [])
  const recharger = useCallback(() => chargerTout(), [])
  return { etat, connecte, setConnecte, recharger }
}

// Garde commune : connexion, chargement, erreur
function Garde({ p, children }) {
  if (p.connecte === null) return <div className="chargement" aria-busy="true" aria-label="Connexion à la plateforme" />
  if (!p.connecte)
    return (
      <div style={{ maxWidth: 440, margin: '30px auto' }}>
        <ConnexionPlateforme
          onConnecte={() => {
            p.setConnecte(true)
            p.recharger()
          }}
        />
      </div>
    )
  if (!p.etat?.clients)
    return p.etat?.erreur ? (
      <div className="card empty">
        <p>{p.etat.erreur}</p>
        <button className="btn primary" onClick={p.recharger}>
          Réessayer
        </button>
      </div>
    ) : (
      <div className="chargement" aria-busy="true" aria-label="Chargement de la plateforme" />
    )
  return children
}

function Chiffre({ label, valeur, sous, ton, onClick }) {
  return (
    <button type="button" className={`pf-chiffre ${ton || ''}`} onClick={onClick} disabled={!onClick}>
      <span className="pf-chiffre-l">{label}</span>
      <span className="pf-chiffre-v">{valeur}</span>
      {sous && <span className="pf-chiffre-s">{sous}</span>}
    </button>
  )
}

function Sante({ s }) {
  return (
    <span className={`badge ${TON_BADGE[s.ton]}`} title={s.raisons.map((r) => r.texte).join(' · ') || 'Tout va bien'}>
      {s.ton === 'gris' ? s.raisons[0]?.texte : `${s.note}/100`}
    </span>
  )
}

// Barre de commande : « bloquer the dream », « prolonger hotel 2i », « encaisser epicerie »
function Commande({ clients }) {
  const [texte, setTexte] = useState('')
  const cmd = lireCommande(texte, clients)
  const lancer = (e) => {
    e.preventDefault()
    if (!cmd) return
    setTexte('')
    go(`/plateforme-client/${cmd.client.id}${cmd.verbe !== 'ouvrir' ? `?faire=${cmd.verbe}` : ''}`)
  }
  return (
    <form className="pf-commande" onSubmit={lancer} role="search">
      <Icon n="bolt" size={16} />
      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Tape une commande : bloquer The Dream, prolonger Hôtel 2i, encaisser…" aria-label="Commande" />
      {cmd && (
        <button className="btn sm primary">
          {cmd.verbe === 'ouvrir' ? 'Ouvrir' : cmd.verbe[0].toUpperCase() + cmd.verbe.slice(1)} {cmd.client.nom}
        </button>
      )}
    </form>
  )
}

// ——— Tour de contrôle ———
export function Controle() {
  const p = usePlateforme()
  const { actions = [], documents = [] } = useDonnees()
  const mois = aujourdhui().slice(0, 7)
  const encaisse = actions.filter((a) => a.action === 'Paiement reçu' && String(a.date || '').startsWith(mois)).reduce((s, a) => s + (Number(a.montant) || 0), 0)
  const impayees = documents.filter((d) => d.type === 'facture' && ['En attente', 'En retard', 'Partiellement payée'].includes(statutDe(d, actions)))
  const enRetard = impayees.filter((d) => statutDe(d, actions) === 'En retard').length
  return (
    <Garde p={p}>
      <TourDeControle p={p} encaisse={encaisse} impayees={impayees.length} enRetard={enRetard} />
    </Garde>
  )
}

function TourDeControle({ p, encaisse, impayees, enRetard }) {
  const [tout, setTout] = useState(false)
  const clients = clientsReels(p.etat.clients, tout)
  const k = indicateurs(clients)
  const liste = alertes(clients)
  const fil = clients
    .flatMap((c) => c.etablissements.filter((e) => e.activite.derniere_activite).map((e) => ({ c, e, t: e.activite.derniere_activite })))
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, 8)
  return (
    <div className="stack pf">
      <div className="pf-tete">
        <div>
          <h1 className="pf-titre">Tour de contrôle</h1>
          <p className="small muted">
            Mis à jour {quand(p.etat.charge)} · {k.clients} clients · {k.etablissements} établissements
          </p>
        </div>
        <div className="row">
          <label className="small muted row" style={{ gap: 6 }}>
            <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} /> Démo et archives
          </label>
          <button className="btn sm" onClick={p.recharger}>
            <Icon n="rotate" size={14} /> Actualiser
          </button>
        </div>
      </div>
      <Commande clients={clients} />
      <div className="pf-chiffres">
        <Chiffre label="Encaissé ce mois" valeur={fcfa(encaisse)} sous="paiements notés dans le CRM" onClick={() => go('/paiements')} />
        <Chiffre label="Abonnements par mois" valeur={fcfa(k.mensuel)} sous="licences actives" ton="or" />
        <Chiffre label="Factures à encaisser" valeur={impayees} sous={enRetard ? `${enRetard} en retard` : 'aucune en retard'} ton={enRetard ? 'rouge' : ''} onClick={() => go('/factures?filtre=impayees')} />
        <Chiffre label="Licences échues" valeur={k.enRetard} sous={`${k.finSemaine} finissent cette semaine`} ton={k.enRetard ? 'rouge' : k.finSemaine ? 'orange' : ''} onClick={() => go('/plateforme?filtre=licence')} />
        <Chiffre label="Ventes des clients aujourd’hui" valeur={fcfa(k.ventesJour)} sous="total de toutes les caisses" />
        <Chiffre label="Personnes actives (7 j)" valeur={k.utilisateursActifs} sous={`${k.bloques} client(s) bloqué(s)`} />
      </div>
      <div className="pf-grille">
        <section className="card pf-afaire">
          <h2 className="section">À faire aujourd’hui</h2>
          {liste.length === 0 ? (
            <Empty>Rien d’urgent : tous les clients vont bien.</Empty>
          ) : (
            <ul className="pf-liste">
              {liste.slice(0, 10).map((a, i) => (
                <li key={i} className={`pf-alerte ${a.ton}`}>
                  <span className="pf-point" />
                  <span className="pf-alerte-txt">
                    <strong>{a.client}</strong>
                    {a.etablissement !== a.client && <span className="muted"> · {a.etablissement}</span>}
                    <span className="bloc small">{a.titre}</span>
                  </span>
                  <button className="btn sm" onClick={() => go(`/plateforme-client/${a.clientId}${a.action === 'encaisser' ? '?faire=encaisser' : ''}`)}>
                    {a.action === 'encaisser' ? 'Encaisser' : a.action === 'appeler' ? 'Voir' : 'Ouvrir'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="section">Santé des clients</h2>
          <div className="pf-sante">
            <span className="pf-sante-n vert">{k.sante.vert}<small>vont bien</small></span>
            <span className="pf-sante-n orange">{k.sante.orange}<small>à surveiller</small></span>
            <span className="pf-sante-n rouge">{k.sante.rouge}<small>en danger</small></span>
          </div>
          <div className="pf-pastilles">
            {[...clients]
              .sort((a, b) => a.sante.note - b.sante.note)
              .map((c) => (
                <button key={c.id} className={`pf-pastille ${c.sante.ton}`} onClick={() => go(`/plateforme-client/${c.id}`)} title={c.sante.raisons.map((r) => r.texte).join(' · ') || 'Tout va bien'}>
                  {c.nom}
                </button>
              ))}
          </div>
        </section>
        <section className="card">
          <h2 className="section">En direct</h2>
          {fil.length === 0 ? (
            <Empty>Aucune activité récente.</Empty>
          ) : (
            <ul className="pf-liste">
              {fil.map(({ c, e, t }) => (
                <li key={e.id} className="pf-fil">
                  <span className="pf-point vert" />
                  <span className="pf-alerte-txt">
                    <strong>{e.nom}</strong>
                    <span className="bloc small muted">
                      {quand(t)}
                      {e.activite.ventes_jour ? ` · ${e.activite.ventes_jour} vente(s) aujourd’hui, ${fcfa(e.activite.montant_jour)}` : ''}
                      {e.activite.caisses_ouvertes ? ` · ${e.activite.caisses_ouvertes} caisse(s) ouverte(s)` : ''}
                    </span>
                  </span>
                  <button className="btn sm ghost" onClick={() => go(`/plateforme-client/${c.id}`)} aria-label={`Ouvrir ${c.nom}`}>
                    <Icon n="arrow-right" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <BoutonsRapides />
    </div>
  )
}

function BoutonsRapides() {
  return (
    <div className="pf-rapides">
      <button className="btn" onClick={() => go('/plateforme')}>
        <Icon n="briefcase" size={14} /> Tous les clients
      </button>
      <button className="btn" onClick={() => go('/factures')}>
        <Icon n="file" size={14} /> Factures
      </button>
      <button className="btn" onClick={() => go('/paiements')}>
        <Icon n="coins" size={14} /> Paiements
      </button>
      <button className="btn" onClick={() => go('/plateforme-outils')}>
        <Icon n="grid" size={14} /> Boîte à outils
      </button>
    </div>
  )
}

// ——— Liste des clients de la plateforme ———
export function ClientsPlateforme({ filtre: filtreInitial }) {
  const p = usePlateforme()
  return (
    <Garde p={p}>
      <ListeClients p={p} filtreInitial={filtreInitial} />
    </Garde>
  )
}

const FILTRES = { tous: 'Tous', danger: 'En danger', licence: 'Licence à régler', bloques: 'Bloqués' }
function ListeClients({ p, filtreInitial }) {
  const [tout, setTout] = useState(false)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState(FILTRES[filtreInitial] ? filtreInitial : 'tous')
  const { settings } = useNoyau()
  const { prospects = [] } = useDonnees()
  const clients = clientsReels(p.etat.clients, tout)
    .filter((c) => !q || c.nom.toLowerCase().includes(q.toLowerCase()) || c.etablissements.some((e) => e.nom.toLowerCase().includes(q.toLowerCase())))
    .filter((c) => filtre === 'tous' || (filtre === 'danger' && c.sante.ton === 'rouge') || (filtre === 'licence' && c.joursRestants != null && c.joursRestants <= 7) || (filtre === 'bloques' && c.statut === 'suspendu'))
    .sort((a, b) => a.sante.note - b.sante.note || a.nom.localeCompare(b.nom))
  return (
    <div className="stack pf">
      <div className="pf-tete">
        <h1 className="pf-titre">Clients de la plateforme</h1>
        <div className="row">
          <input className="pf-recherche" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un client…" aria-label="Chercher un client" />
          <label className="small muted row" style={{ gap: 6 }}>
            <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} /> Démo et archives
          </label>
        </div>
      </div>
      <div className="chips">
        {Object.entries(FILTRES).map(([id, l]) => (
          <button key={id} type="button" className={`chip ${filtre === id ? 'on' : ''}`} onClick={() => setFiltre(id)}>
            {l}
          </button>
        ))}
      </div>
      {clients.length === 0 ? (
        <Empty>Aucun client pour ce filtre.</Empty>
      ) : (
        <div className="pf-cartes">
          {clients.map((c) => {
            const fiche = ficheLiee(c, settings, prospects)
            return (
              <button key={c.id} className={`card pf-carte ${c.sante.ton}`} onClick={() => go(`/plateforme-client/${c.id}`)}>
                <span className="pf-carte-tete">
                  <strong>{c.nom}</strong>
                  <Sante s={c.sante} />
                </span>
                <span className="small muted">
                  {c.etablissements.length} établissement(s) · {c.mensuel ? `${fcfa(c.mensuel)} / mois` : 'pas d’abonnement payant'}
                </span>
                <span className="pf-carte-chiffres">
                  <span>
                    <small>Ventes 30 j</small>
                    {fcfa(c.ventes30j)}
                  </span>
                  <span>
                    <small>Licence</small>
                    {c.joursRestants == null ? '—' : c.joursRestants < 0 ? `échue (${-c.joursRestants} j)` : `${c.joursRestants} j`}
                  </span>
                  <span>
                    <small>Activité</small>
                    {quand(c.derniereActivite)}
                  </span>
                </span>
                {c.sante.raisons[0] && <span className={`small pf-raison ${c.sante.raisons[0].ton}`}>{c.sante.raisons[0].texte}</span>}
                {!fiche && <span className="small muted">Pas encore relié à une fiche CRM</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ——— Fiche client complète ———
export function FichePlateforme({ id, faire }) {
  const p = usePlateforme()
  return (
    <Garde p={p}>
      <Fiche360 key={id} p={p} id={id} faire={faire} />
    </Garde>
  )
}

function Fiche360({ p, id, faire }) {
  const c = p.etat.clients.find((x) => x.id === id)
  const { settings, api, toast } = useNoyau()
  const { prospects = [], actions = [] } = useDonnees()
  const [chrono, setChrono] = useState(null)
  const [comptes, setComptes] = useState(null)
  const [modale, setModale] = useState(['encaisser', 'prolonger', 'bloquer', 'debloquer', 'message', 'assister'].includes(faire) ? faire : null)
  const charger = useCallback(() => {
    appeler('pilotage_chronologie', { p_client_id: id, p_limite: 80 }).then(setChrono, (e) => setChrono({ erreur: e.message }))
    appeler('editeur_comptes').then(setComptes, () => setComptes([]))
  }, [id])
  useEffect(() => {
    charger()
  }, [charger])
  if (!c) return <Empty>Client introuvable sur la plateforme.</Empty>
  const fiche = ficheLiee(c, settings, prospects)
  const ids = new Set(c.etablissements.map((e) => e.id))
  const sesComptes = (comptes || []).filter((u) => u.acces.some((a) => ids.has(a.etablissement_id)))
  const paiementsCrm = fiche ? actions.filter((a) => a.prospect_id === fiche.id && a.action === 'Paiement reçu').sort((a, b) => (a.date < b.date ? 1 : -1)) : []
  // Après une action : la fenêtre se ferme (sauf si elle doit rester ouverte), puis tout est relu
  const apres = async (message, garder) => {
    if (!garder) fermer()
    toast(`${message} ✓`)
    await p.recharger()
    charger()
  }
  const fermer = () => {
    setModale(null)
    if (faire) window.history.replaceState(null, '', `#/plateforme-client/${id}`)
  }
  const bloque = c.statut === 'suspendu'
  return (
    <div className="stack pf">
      <button className="btn sm ghost pf-retour" onClick={() => go('/plateforme')}>
        ← Clients de la plateforme
      </button>
      <section className={`card pf-bandeau ${c.sante.ton}`}>
        <div className="pf-bandeau-nom">
          <h1 className="pf-titre">{c.nom}</h1>
          <div className="row small muted">
            <Sante s={c.sante} />
            {c.pays && <span>{c.pays}</span>}
            {c.contact?.telephone && <a href={`tel:${c.contact.telephone}`}>{c.contact.telephone}</a>}
            {fiche ? (
              <a href={`#/prospect/${fiche.id}`}>Fiche CRM : {fiche.name}</a>
            ) : (
              <button className="pf-lien" onClick={() => setModale('relier')}>
                Relier à une fiche CRM
              </button>
            )}
          </div>
        </div>
        <div className="pf-chiffres compact">
          <Chiffre label="Paie par mois" valeur={fcfa(c.mensuel)} />
          <Chiffre label="Licence" valeur={c.joursRestants == null ? '—' : c.joursRestants < 0 ? `Échue (${-c.joursRestants} j)` : `${c.joursRestants} j`} ton={c.joursRestants != null && c.joursRestants < 0 ? 'rouge' : c.joursRestants != null && c.joursRestants <= 7 ? 'orange' : ''} />
          <Chiffre label="Ventes 30 j" valeur={fcfa(c.ventes30j)} />
          <Chiffre label="Activité" valeur={quand(c.derniereActivite)} />
        </div>
        {c.message && (
          <p className={`pf-message ${c.message.ton}`}>
            Message affiché au client : « {c.message.texte} »
          </p>
        )}
        <div className="pf-boutons">
          <button className="btn primary" onClick={() => setModale('encaisser')}>
            <Icon n="coins" size={15} /> Encaisser
          </button>
          <button className="btn" onClick={() => go(`/facture/new?type=facture${fiche ? `&p=${fiche.id}` : ''}`)}>
            <Icon n="file" size={15} /> Facturer
          </button>
          <button className="btn" onClick={() => setModale('prolonger')}>
            <Icon n="clock" size={15} /> Prolonger
          </button>
          <button className={`btn ${bloque ? 'primary' : 'danger'}`} onClick={() => setModale(bloque ? 'debloquer' : 'bloquer')}>
            <Icon n="ban" size={15} /> {bloque ? 'Débloquer' : 'Bloquer'}
          </button>
          <button className="btn" onClick={() => setModale('message')}>
            <Icon n="message" size={15} /> Message
          </button>
          <button className="btn" onClick={() => setModale('assister')}>
            <Icon n="eye" size={15} /> Assister
          </button>
          <button className="btn" onClick={() => setModale('plus')}>
            <Icon n="more" size={15} /> Plus
          </button>
        </div>
      </section>

      <div className="pf-grille deux">
        <div className="stack">
          {c.etablissements.map((e) => (
            <section key={e.id} className="card">
              <div className="pf-carte-tete">
                <h2 className="section">{e.nom}</h2>
                <Sante s={e.sante} />
              </div>
              <div className="pf-carte-chiffres">
                <span>
                  <small>Aujourd’hui</small>
                  {fcfa(e.activite.montant_jour)} ({e.activite.ventes_jour || 0})
                </span>
                <span>
                  <small>7 jours</small>
                  {fcfa(e.activite.montant_7j)}
                </span>
                <span>
                  <small>30 jours</small>
                  {fcfa(e.activite.montant_30j)}
                </span>
                <span>
                  <small>Personnes actives</small>
                  {e.activite.utilisateurs_actifs_7j || 0}
                </span>
              </div>
              <p className="small muted">
                {e.licence ? `${e.licence.offre} · ${e.licence.formule} · échéance ${date(e.licence.echeance)}` : 'Aucune licence'} · {e.membres_actifs} membre(s) · dernière connexion {quand(e.activite.derniere_connexion)}
                {e.activite.caisses_ouvertes ? ` · ${e.activite.caisses_ouvertes} caisse(s) ouverte(s)` : ''}
              </p>
              {e.sante.raisons.length > 0 && (
                <ul className="pf-raisons">
                  {e.sante.raisons.map((r, i) => (
                    <li key={i} className={r.ton}>
                      {r.texte}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <section className="card">
            <h2 className="section">Comptes ({sesComptes.length})</h2>
            {comptes === null ? (
              <p className="small muted">Chargement…</p>
            ) : sesComptes.length === 0 ? (
              <Empty>Aucun compte.</Empty>
            ) : (
              <ul className="pf-liste">
                {sesComptes.map((u) => (
                  <li key={u.id} className="pf-fil">
                    <span className="pf-alerte-txt">
                      <strong>{u.nom || u.identifiant || u.email}</strong>
                      <span className="bloc small muted">
                        {u.identifiant ? `${u.identifiant} · ` : ''}
                        {u.acces.filter((a) => ids.has(a.etablissement_id)).map((a) => `${a.role}${a.actif ? '' : ' (désactivé)'}`).join(', ')} · connecté {quand(u.derniere_connexion)}
                      </span>
                    </span>
                    <button className="btn sm" onClick={() => setModale({ mdp: u })}>
                      Mot de passe
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {fiche && (
            <section className="card">
              <h2 className="section">Paiements reçus (CRM)</h2>
              {paiementsCrm.length === 0 ? (
                <Empty>Aucun paiement noté pour cette fiche.</Empty>
              ) : (
                <ul className="pf-liste">
                  {paiementsCrm.slice(0, 8).map((a) => (
                    <li key={a.id} className="pf-fil">
                      <span className="pf-alerte-txt">
                        <strong>{fcfa(a.montant)}</strong>
                        <span className="bloc small muted">
                          {date(a.date)} · {a.mode || '—'} {a.reference ? `· ${a.reference}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <section className="card">
          <h2 className="section">Histoire du client</h2>
          {!chrono ? (
            <p className="small muted">Chargement…</p>
          ) : chrono.erreur ? (
            <p className="pf-erreur">{chrono.erreur}</p>
          ) : chrono.length === 0 ? (
            <Empty>Rien pour l’instant.</Empty>
          ) : (
            <ol className="pf-chrono">
              {chrono.map((ev, i) => (
                <li key={i} className={ev.type.split('.')[0]}>
                  <span className="pf-chrono-date">{date(ev.date)}</span>
                  <span>
                    <strong>{LIBELLES_CHRONO[ev.type] || ev.type}</strong>
                    {ev.montant ? ` · ${fcfa(ev.montant)}` : ''}
                    <span className="bloc small muted">{[ev.etablissement, ev.detail].filter(Boolean).join(' · ')}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {modale === 'encaisser' && <Encaisser c={c} fiche={fiche} api={api} onFermer={fermer} onFait={apres} />}
      {modale === 'prolonger' && <Prolonger c={c} onFermer={fermer} onFait={apres} />}
      {(modale === 'bloquer' || modale === 'debloquer') && <Bloquer c={c} bloquer={modale === 'bloquer'} onFermer={fermer} onFait={apres} />}
      {modale === 'message' && <MessageClient c={c} onFermer={fermer} onFait={apres} />}
      {modale === 'assister' && <Assister c={c} onFermer={fermer} onFait={apres} />}
      {modale === 'relier' && <Relier c={c} fiche={fiche} onFermer={fermer} />}
      {modale === 'plus' && <Plus c={c} onChoisir={setModale} onFermer={fermer} onFait={apres} />}
      {modale?.modules && <Modules e={modale.modules} onFermer={fermer} onFait={(m) => apres(m, true)} />}
      {modale?.licence && <StatutLicence e={modale.licence} onFermer={fermer} onFait={apres} />}
      {modale?.mdp && <MotDePasse u={modale.mdp} onFermer={fermer} onFait={(m) => apres(m, true)} />}
    </div>
  )
}

function useEnvoi(onFait) {
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const envoyer = async (fn, message) => {
    setOccupe(true)
    setErreur('')
    try {
      await fn()
      await onFait(message)
      return true
    } catch (e) {
      setErreur(e.message)
      return false
    } finally {
      setOccupe(false)
    }
  }
  return { erreur, occupe, envoyer }
}

function Pied({ occupe, erreur, onFermer, ok, danger }) {
  return (
    <>
      {erreur && (
        <p className="pf-erreur" role="alert">
          {erreur}
        </p>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button type="button" className="btn" onClick={onFermer}>
          Annuler
        </button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={occupe}>
          {occupe ? 'Envoi…' : ok}
        </button>
      </div>
    </>
  )
}

function ChoixEtablissement({ c, value, onChange, filtre = () => true }) {
  const liste = c.etablissements.filter((e) => e.statut !== 'archive' && filtre(e))
  if (liste.length <= 1) return null
  return (
    <Field label="Établissement">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {liste.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
          </option>
        ))}
      </select>
    </Field>
  )
}

// Encaisser : la licence est prolongée sur la plateforme ET le paiement est noté dans le CRM, en un seul clic
function Encaisser({ c, fiche, api, onFermer, onFait }) {
  const avecLicence = c.etablissements.filter((e) => e.licence && e.statut !== 'archive')
  const [etabId, setEtabId] = useState(avecLicence[0]?.id || '')
  const e = avecLicence.find((x) => x.id === etabId)
  const [montant, setMontant] = useState(String(e?.mensuel || e?.licence?.montant || ''))
  const [mode, setMode] = useState('Mobile Money')
  const [jour, setJour] = useState(aujourdhui())
  const [reference, setReference] = useState('')
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  if (!e)
    return (
      <Modal title="Encaisser" onClose={onFermer}>
        <p>Ce client n’a pas encore de licence. Attribue-la depuis la boîte à outils, puis encaisse.</p>
        <button className="btn primary" onClick={() => go('/plateforme-outils')}>
          Boîte à outils
        </button>
      </Modal>
    )
  const valider = (ev) => {
    ev.preventDefault()
    const n = Number(String(montant).replace(/\s/g, '').replace(',', '.'))
    envoyer(async () => {
      if (!(n > 0)) throw new Error('Montant à saisir.')
      const echeance = await appeler('renouveler_licence', { p_licence_id: e.licence.id, p_nouvelle_echeance: null, p_montant: n, p_reference: reference || `CRM ${mode}`, p_note: 'Encaissé depuis le CRM' })
      try {
        await api.addActions([{ prospect_id: fiche?.id || null, date: jour, canal: 'Autre', action: 'Paiement reçu', montant: n, mode, reference: reference || `Licence ${e.nom}`, notes: `Licence prolongée jusqu’au ${date(echeance)} (plateforme)` }])
      } catch {
        throw new Error(`Licence prolongée jusqu’au ${date(echeance)}, mais le paiement n’a pas pu être noté dans le CRM : note-le dans Paiements reçus.`)
      }
    }, 'Paiement encaissé et licence prolongée')
  }
  return (
    <Modal title={`Encaisser · ${c.nom}`} onClose={onFermer}>
      <form className="stack" onSubmit={valider}>
        <p className="small muted">La licence est prolongée d’une période ({e.licence.formule}) sur la plateforme, et le paiement est noté dans le CRM{fiche ? ` sur la fiche ${fiche.name}` : ''}.</p>
        <ChoixEtablissement c={c} value={etabId} onChange={setEtabId} filtre={(x) => Boolean(x.licence)} />
        <Field label="Montant reçu (FCFA)">
          <input inputMode="decimal" value={montant} onChange={(ev) => setMontant(ev.target.value)} required autoFocus />
        </Field>
        <Field label="Moyen de paiement">
          <Chips options={MODES} value={mode} onChange={(v) => setMode(v || mode)} small allowEmpty={false} />
        </Field>
        <div className="grid grid-2">
          <Field label="Date">
            <input type="date" value={jour} onChange={(ev) => setJour(ev.target.value)} />
          </Field>
          <Field label="Référence (facultatif)">
            <input value={reference} onChange={(ev) => setReference(ev.target.value)} placeholder="N° de transaction" />
          </Field>
        </div>
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Encaisser" />
      </form>
    </Modal>
  )
}

// Prolonger sans paiement : geste commercial ou délai accordé
function Prolonger({ c, onFermer, onFait }) {
  const avecLicence = c.etablissements.filter((e) => e.licence && e.statut !== 'archive')
  const [etabId, setEtabId] = useState(avecLicence[0]?.id || '')
  const e = avecLicence.find((x) => x.id === etabId)
  const base = e?.licence?.echeance && e.licence.echeance > aujourdhui() ? e.licence.echeance : aujourdhui()
  const [jours, setJours] = useState('3 jours')
  const [fin, setFin] = useState(plusJours(base, 3))
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  const DUREES = { '3 jours': 3, '7 jours': 7, '1 mois': 30 }
  if (!e)
    return (
      <Modal title="Prolonger" onClose={onFermer}>
        <p>Ce client n’a pas de licence à prolonger.</p>
      </Modal>
    )
  return (
    <Modal title={`Prolonger · ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault()
          envoyer(() => appeler('renouveler_licence', { p_licence_id: e.licence.id, p_nouvelle_echeance: fin, p_montant: 0, p_reference: 'Prolongation CRM', p_note: 'Délai accordé depuis le CRM' }), `Licence prolongée jusqu’au ${date(fin)}`)
        }}
      >
        <ChoixEtablissement c={c} value={etabId} onChange={setEtabId} filtre={(x) => Boolean(x.licence)} />
        <p className="small muted">Échéance actuelle : {date(e.licence.echeance)}. Aucun paiement n’est noté.</p>
        <Chips
          options={Object.keys(DUREES)}
          value={jours}
          allowEmpty={false}
          onChange={(v) => {
            setJours(v)
            setFin(plusJours(base, DUREES[v]))
          }}
        />
        <Field label="Nouvelle échéance">
          <input type="date" value={fin} min={aujourdhui()} onChange={(ev) => setFin(ev.target.value)} required />
        </Field>
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Prolonger" />
      </form>
    </Modal>
  )
}

function Bloquer({ c, bloquer, onFermer, onFait }) {
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  return (
    <Modal title={`${bloquer ? 'Bloquer' : 'Débloquer'} · ${c.nom}`} onClose={onFermer}>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          envoyer(() => appeler('definir_statut_client', { p_client_id: c.id, p_statut: bloquer ? 'suspendu' : 'actif' }), bloquer ? `${c.nom} bloqué` : `${c.nom} débloqué`)
        }}
      >
        <p>
          {bloquer
            ? `Toutes les équipes de ${c.nom} passent en consultation seule : plus de ventes ni de modifications. Leurs données restent intactes.`
            : `Les équipes de ${c.nom} retrouvent l’usage normal du logiciel.`}
        </p>
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok={bloquer ? 'Bloquer' : 'Débloquer'} danger={bloquer} />
      </form>
    </Modal>
  )
}

function MessageClient({ c, onFermer, onFait }) {
  const [texte, setTexte] = useState(c.message?.texte || '')
  const [ton, setTon] = useState(c.message?.ton === 'urgent' ? 'Urgent' : c.message?.ton === 'attention' ? 'Attention' : 'Info')
  const [duree, setDuree] = useState('Sans fin')
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  const TONS = { Info: 'info', Attention: 'attention', Urgent: 'urgent' }
  const DUREES = { 'Sans fin': null, '1 jour': 1, '7 jours': 7, '30 jours': 30 }
  const modeles = ['Votre paiement est en retard : merci de régulariser pour garder l’accès.', 'Votre licence se termine bientôt : contactez Agence Elite pour la renouveler.', 'Maintenance prévue ce soir à 23 h : le logiciel peut être lent quelques minutes.']
  const poser = (t) =>
    envoyer(() => appeler('definir_message_client', { p_client_id: c.id, p_texte: t, p_ton: TONS[ton], p_expire_le: DUREES[duree] ? new Date(Date.now() + DUREES[duree] * 86400000).toISOString() : null }), t ? 'Message affiché au client' : 'Message retiré')
  return (
    <Modal title={`Message à ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault()
          poser(texte.trim())
        }}
      >
        <p className="small muted">Affiché en haut du logiciel pour toutes les équipes du client.</p>
        <div className="chips">
          {modeles.map((m) => (
            <button type="button" key={m} className="chip sm" onClick={() => setTexte(m)}>
              {m.split(':')[0]}
            </button>
          ))}
        </div>
        <Field label="Message">
          <textarea value={texte} onChange={(ev) => setTexte(ev.target.value)} maxLength={300} rows={3} required />
        </Field>
        <Field label="Ton">
          <Chips options={Object.keys(TONS)} value={ton} onChange={(v) => setTon(v || ton)} small allowEmpty={false} />
        </Field>
        <Field label="Durée">
          <Chips options={Object.keys(DUREES)} value={duree} onChange={(v) => setDuree(v || duree)} small allowEmpty={false} />
        </Field>
        {c.message && (
          <button type="button" className="btn ghost" onClick={() => poser('')} disabled={occupe}>
            Retirer le message actuel
          </button>
        )}
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Afficher" />
      </form>
    </Modal>
  )
}

// Assister : ouvre une session d'assistance (consultation, tracée chez le client), puis le logiciel du client
function Assister({ c, onFermer, onFait }) {
  const liste = c.etablissements.filter((e) => e.statut !== 'archive')
  const [etabId, setEtabId] = useState(liste[0]?.id || '')
  const [motif, setMotif] = useState('')
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  return (
    <Modal title={`Assister · ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={async (ev) => {
          ev.preventDefault()
          const ok = await envoyer(() => appeler('ouvrir_session_support', { p_etablissement_id: etabId, p_motif: motif }), 'Session d’assistance ouverte')
          if (ok) window.open(`${ADRESSE_SAAS}/#/`, '_blank', 'noopener')
        }}
      >
        <p className="small muted">Tu vois le logiciel comme le client, en consultation seule. La session est notée dans son journal. Le SaaS s’ouvre dans un nouvel onglet (connecte-toi avec le compte super admin si demandé).</p>
        <ChoixEtablissement c={c} value={etabId} onChange={setEtabId} />
        <Field label="Motif">
          <input value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Ex. le client ne trouve pas son rapport" required />
        </Field>
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Ouvrir la session" />
      </form>
    </Modal>
  )
}

function Relier({ c, fiche, onFermer }) {
  const { settings, api, toast } = useNoyau()
  const { prospects = [] } = useDonnees()
  const [choix, setChoix] = useState(fiche?.id || '')
  const enregistrer = async (id) => {
    const plateforme = settings.plateforme || {}
    await api.saveSettings({ ...settings, plateforme: { ...plateforme, liens: { ...(plateforme.liens || {}), [c.id]: id } } })
    toast(id ? 'Fiche reliée ✓' : 'Lien retiré ✓')
    onFermer()
  }
  const tries = [...prospects].sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return (
    <Modal title={`Fiche CRM de ${c.nom}`} onClose={onFermer}>
      <div className="stack">
        <p className="small muted">Les paiements encaissés depuis la plateforme sont notés sur cette fiche.</p>
        <Field label="Fiche">
          <select value={choix} onChange={(e) => setChoix(e.target.value)}>
            <option value="">— Aucune —</option>
            {tries.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn primary" onClick={() => enregistrer(choix)}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Plus : les gestes moins fréquents, rangés en boutons
function Plus({ c, onChoisir, onFermer, onFait }) {
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  const etabs = c.etablissements.filter((e) => e.statut !== 'archive')
  return (
    <Modal title={`Plus · ${c.nom}`} onClose={onFermer}>
      <div className="stack">
        {etabs.map((e) => (
          <div key={e.id} className="pf-plus">
            <strong>{e.nom}</strong>
            <div className="pf-boutons">
              <button className="btn sm" onClick={() => onChoisir({ modules: e })}>
                <Icon n="layers" size={14} /> Modules
              </button>
              {e.licence && (
                <button className="btn sm" onClick={() => onChoisir({ licence: e })}>
                  <Icon n="tag" size={14} /> {e.licence.statut === 'suspendue' ? 'Réactiver la licence' : 'Suspendre la licence'}
                </button>
              )}
              <button
                className={`btn sm ${e.statut === 'suspendu' ? '' : 'danger'}`}
                disabled={occupe}
                onClick={async () => {
                  const bloquer = e.statut !== 'suspendu'
                  if (!(await confirmer(bloquer ? `Bloquer seulement ${e.nom} ? Ses équipes passent en consultation seule.` : `Débloquer ${e.nom} ?`, { ok: bloquer ? 'Bloquer' : 'Débloquer', danger: bloquer }))) return
                  const ok = await envoyer(() => appeler('definir_statut_etablissement', { p_etablissement_id: e.id, p_statut: bloquer ? 'suspendu' : 'actif' }), bloquer ? `${e.nom} bloqué` : `${e.nom} débloqué`)
                  if (ok) onFermer()
                }}
              >
                <Icon n="ban" size={14} /> {e.statut === 'suspendu' ? 'Débloquer' : 'Bloquer'} l’établissement
              </button>
              <a className="btn sm" href={`${ADRESSE_SAAS}/#/editeur/etablissement/${e.id}`} target="_blank" rel="noreferrer">
                <Icon n="settings" size={14} /> Réglages avancés
              </a>
            </div>
          </div>
        ))}
        <div className="pf-boutons">
          <button className="btn sm" onClick={() => onChoisir('relier')}>
            <Icon n="handshake" size={14} /> Relier à une fiche CRM
          </button>
        </div>
        {erreur && <p className="pf-erreur">{erreur}</p>}
      </div>
    </Modal>
  )
}

function Modules({ e, onFermer, onFait }) {
  const [detail, setDetail] = useState(null)
  const [erreur, setErreur] = useState('')
  const charger = useCallback(() => appeler('editeur_etablissement', { p_etablissement_id: e.id }).then(setDetail, (x) => setErreur(x.message)), [e.id])
  useEffect(() => {
    charger()
  }, [charger])
  const basculer = async (m, actif) => {
    setErreur('')
    try {
      await appeler('definir_module_etablissement', { p_etablissement_id: e.id, p_module_id: m.id, p_actif: actif })
      await charger()
      await onFait(`${m.nom} ${actif ? 'activé' : 'retiré'}`)
    } catch (x) {
      setErreur(x.message)
    }
  }
  const modules = (detail?.modules || []).filter((m) => m.nature !== 'socle')
  return (
    <Modal title={`Modules · ${e.nom}`} onClose={onFermer}>
      {erreur && <p className="pf-erreur">{erreur}</p>}
      {!detail ? (
        <p className="small muted">Chargement…</p>
      ) : (
        <ul className="pf-liste">
          {modules.map((m) => (
            <li key={m.id} className="pf-fil">
              <span className="pf-alerte-txt">
                <strong>{m.nom}</strong>
                <span className="bloc small muted">{m.couvert ? 'compris dans la licence' : 'hors licence'}</span>
              </span>
              <label className="pf-interrupteur">
                <input type="checkbox" checked={m.actif} onChange={(x) => basculer(m, x.target.checked)} aria-label={`${m.nom} ${m.actif ? 'activé' : 'désactivé'}`} />
                <span />
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function StatutLicence({ e, onFermer, onFait }) {
  const suspendre = e.licence.statut !== 'suspendue'
  const [motif, setMotif] = useState('')
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  return (
    <Modal title={`${suspendre ? 'Suspendre' : 'Réactiver'} la licence · ${e.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={async (ev) => {
          ev.preventDefault()
          const ok = await envoyer(() => appeler('definir_statut_licence', { p_licence_id: e.licence.id, p_statut: suspendre ? 'suspendue' : 'active', p_motif: motif }), suspendre ? 'Licence suspendue' : 'Licence réactivée')
          if (ok) onFermer()
        }}
      >
        <Field label="Motif">
          <input value={motif} onChange={(x) => setMotif(x.target.value)} required placeholder={suspendre ? 'Ex. impayé depuis 15 jours' : 'Ex. paiement reçu'} />
        </Field>
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok={suspendre ? 'Suspendre' : 'Réactiver'} danger={suspendre} />
      </form>
    </Modal>
  )
}

// Mot de passe temporaire : affiché une seule fois, à donner au client ; il devra le changer à la connexion
const genererMotDePasse = () => {
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const t = new Uint32Array(10)
  crypto.getRandomValues(t)
  return Array.from(t, (n) => lettres[n % lettres.length]).join('')
}
function MotDePasse({ u, onFermer, onFait }) {
  const [mdp] = useState(genererMotDePasse)
  const [fait, setFait] = useState(false)
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  return (
    <Modal title={`Mot de passe · ${u.nom || u.identifiant || u.email}`} onClose={onFermer}>
      {fait ? (
        <div className="stack">
          <p>Mot de passe temporaire, valable 7 jours. Donne-le à la personne : elle en choisira un nouveau à la connexion.</p>
          <p className="pf-mdp">{mdp}</p>
          <button className="btn primary" onClick={onFermer}>
            Terminé
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            const ok = await envoyer(() => appeler('reinitialiser_mot_de_passe_temporaire', { p_user_id: u.id, p_mot_de_passe_temporaire: mdp, p_expire_jours: 7 }), 'Mot de passe réinitialisé')
            if (ok) setFait(true)
          }}
        >
          <p>Un mot de passe temporaire va remplacer l’actuel. La personne devra en choisir un nouveau.</p>
          <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Réinitialiser" />
        </form>
      )}
    </Modal>
  )
}

// ——— Boîte à outils : les fonctions moins fréquentes de l'administration ———
const OUTILS = [
  ['Nouveau client', 'Créer un client et son établissement', 'user-plus', 'editeur/clients'],
  ['Comptes', 'Toutes les personnes, rôles et identifiants', 'users', 'editeur/comptes'],
  ['Hubs', 'Points de vente, stocks et caisses', 'layers', 'editeur/hubs'],
  ['Catalogue des modules', 'Modules, catégories, dépendances', 'grid', 'editeur/modules'],
  ['Offres et prix', 'Formules, prix mensuels et annuels', 'tag', 'editeur/offres'],
  ['Elite Partners', 'Partenaires, commissions, paiements', 'handshake', 'editeur/partenaires'],
  ['Identité et apparence', 'Nom, logo et couleurs de la plateforme', 'star', 'editeur/identite'],
  ['Adresses web', 'Adresses de connexion des clients', 'globe', 'editeur/adresses'],
  ['Sites clients', 'Sites publics des clients', 'folder', 'editeur/sites'],
  ['Copier des articles', 'D’un client à un autre, bibliothèque', 'copy', 'editeur/copie-articles'],
  ['Tableau détaillé', 'Ancien tableau de bord de l’éditeur', 'chart', 'editeur/tableau'],
]
export function OutilsPlateforme() {
  const p = usePlateforme()
  return (
    <div className="stack pf">
      <div className="pf-tete">
        <div>
          <h1 className="pf-titre">Boîte à outils</h1>
          <p className="small muted">Les réglages moins fréquents de la plateforme. Chaque bouton ouvre l’écran dans le SaaS, en accès Agence Elite.</p>
        </div>
        {p.connecte && (
          <button
            className="btn sm"
            onClick={async () => {
              await deconnecter()
              oublierPlateforme()
              p.setConnecte(false)
            }}
          >
            <Icon n="logout" size={14} /> Déconnecter la plateforme
          </button>
        )}
      </div>
      <div className="pf-outils">
        {OUTILS.map(([nom, desc, ico, route]) => (
          <a key={route} className="card pf-outil" href={`${ADRESSE_SAAS}/#/${route}`} target="_blank" rel="noreferrer">
            <Icon n={ico} size={20} />
            <strong>{nom}</strong>
            <span className="small muted">{desc}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
