// Plateforme : le CRM est le centre d'administration d'Agence Elite (ce que faisait le super admin du SaaS).
// Tour de contrôle (tout voir), Clients de la plateforme, fiche client complète avec ses boutons, boîte à outils.
// Les données des clients restent dans la base de la plateforme : le CRM les lit et agit par ses fonctions.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import { Modal, Field, Chips, Empty, confirmer, go, BoutonCopier, Bloc, Indicateur, deviseCode, Tabs, KV } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { appeler, deconnecter, sessionValide } from '../modules/plateforme/connexion'
import { ConnexionPlateforme } from '../modules/plateforme/ui'
import { alertes, clientsReels, construireVue, ficheLiee, indicateurs, lireCommande, LIBELLES_CHRONO } from '../modules/plateforme/calculs'
import { clientsActifs, encaisseDuMois, etatCrm, etatPlateforme, licencesARenouveler, relancesEnRetard } from '../modules/plateforme/accueil'
import { argent, afficherSommes, deviseDe } from '../lib/argent'
import { pageAccessible } from '../core/modules'
import { statutDe } from '../modules/facturation'
import { baseRenouvellement, echeanceMinimum, echeanceProposee, erreurEcheance, plusJours as plusJoursIso } from '../modules/plateforme/licence'
import { A_REPRENDRE, ETATS, GESTES, executer, journalOperations, marquerReglee, noterGeste, preparerEncaissement } from '../modules/plateforme/operations'

export const ADRESSE_SAAS = 'https://saas.agence-elite.fr'
// Montant dans sa vraie devise ; sans devise connue (paiement du CRM), celle réglée dans Paramètres
const enDevise = (v, devise) => argent(v, devise || deviseCode())
const symbole = (devise) => deviseDe(devise || deviseCode())?.sym || devise
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
// Avant les données : un titre de page (h1) reste affiché pendant la connexion, le chargement ou l'erreur
function Garde({ p, titre, children }) {
  const tete = <h1 className="pf-titre">{titre}</h1>
  if (p.connecte === null)
    return (
      <div className="stack pf">
        {tete}
        <div className="chargement" aria-busy="true" aria-label="Connexion à la plateforme" />
      </div>
    )
  if (!p.connecte)
    return (
      <div className="stack pf">
        {tete}
        <div style={{ maxWidth: 440, margin: '12px auto', width: '100%' }}>
          <ConnexionPlateforme
            onConnecte={() => {
              p.setConnecte(true)
              p.recharger()
            }}
          />
        </div>
      </div>
    )
  if (!p.etat?.clients)
    return (
      <div className="stack pf">
        {tete}
        {p.etat?.erreur ? (
          <div className="card empty" role="alert">
            <p>{p.etat.erreur}</p>
            <button className="btn primary" onClick={p.recharger}>
              Réessayer
            </button>
          </div>
        ) : (
          <div className="chargement" aria-busy="true" aria-label="Chargement de la plateforme" />
        )}
      </div>
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

// Barre de commande : « bloquer <client> », « prolonger <client> », « encaisser <client> »
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
      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Tape une commande : encaisser, prolonger ou bloquer suivi du nom du client…" aria-label="Commande" />
      {cmd && (
        <button className="btn sm primary">
          {cmd.verbe === 'ouvrir' ? 'Ouvrir' : cmd.verbe[0].toUpperCase() + cmd.verbe.slice(1)} {cmd.client.nom}
        </button>
      )}
    </form>
  )
}

// ——— Tour de contrôle : le tableau de bord unique ———
// Chaque bloc a ses 5 états (chargement, données, vide, accès refusé, erreur) : un bloc plateforme indisponible
// n'empêche pas de voir les chiffres du CRM. Montants dans leur vraie devise (lib/argent.js).
export function Controle() {
  const p = usePlateforme()
  const { settings } = useNoyau()
  const { actions = [], documents = [], data } = useDonnees()
  const [tout, setTout] = useState(false)
  const [connexion, setConnexion] = useState(false)
  const t = aujourdhui()
  const mois = t.slice(0, 7)
  const nomMois = new Date(`${mois}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const devise = settings?.devise || 'EUR'
  const finances = etatCrm({ actif: pageAccessible('paiements', settings), nom: 'Facturation' })
  const commercial = etatCrm({ actif: pageAccessible('acquisition', settings), nom: 'Commercial' })
  const encaisse = encaisseDuMois(actions, mois)
  const relances = relancesEnRetard(data?.list || [], t)
  const impayees = documents.filter((d) => d.type === 'facture' && ['En attente', 'En retard', 'Partiellement payée'].includes(statutDe(d, actions)))
  const facturesEnRetard = impayees.filter((d) => statutDe(d, actions) === 'En retard').length

  const pf = etatPlateforme(p)
  const clients = pf.etat === 'donnees' || pf.etat === 'vide' ? clientsReels(p.etat.clients, tout) : []
  const pfEtat = pf.etat === 'donnees' && clients.length === 0 ? { etat: 'vide' } : pf
  const k = indicateurs(clients)
  const actifs = clientsActifs(clients)
  const licences = licencesARenouveler(clients)
  const liste = alertes(clients)
  const fil = clients
    .flatMap((c) => c.etablissements.filter((e) => e.activite.derniere_activite).map((e) => ({ c, e, t: e.activite.derniere_activite })))
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, 8)
  const seConnecter = (
    <button type="button" className="btn sm primary" onClick={() => setConnexion(true)}>
      Se connecter à la plateforme
    </button>
  )
  const filtres = [`Période : ${nomMois}`, tout ? 'Clients : tous (démo et archives compris)' : 'Clients : réels seulement']

  return (
    <div className="stack pf">
      <div className="pf-tete">
        <div>
          <h1 className="pf-titre">Tour de contrôle</h1>
          <p className="small muted">
            {pf.etat === 'donnees' ? `Mis à jour ${quand(p.etat.charge)} · ${k.clients} clients · ${k.etablissements} établissements` : 'Ce qui demande une action aujourd’hui'}
          </p>
        </div>
        <div className="row">
          <button className="btn sm" onClick={p.recharger} disabled={!p.connecte}>
            <Icon n="rotate" size={14} /> Actualiser
          </button>
        </div>
      </div>
      <div className="filtres-actifs" role="group" aria-label="Filtres actifs">
        <span className="tiny muted bold">Filtres actifs</span>
        {filtres.map((f) => (
          <span key={f} className="chip on filtre-actif">
            {f}
          </span>
        ))}
        <label className="small row filtre-choix">
          <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} /> Inclure démo et archives
        </label>
        {tout && (
          <button type="button" className="btn sm ghost" onClick={() => setTout(false)}>
            Réinitialiser
          </button>
        )}
      </div>
      {pf.etat === 'donnees' && <Commande clients={clients} />}
      <OperationsAReconcilier onFait={() => p.recharger()} />
      <div className="indicateurs" aria-label="Indicateurs principaux">
        <Indicateur label="Clients logiciel actifs" etat={pfEtat} vide="0" valeur={actifs.length} sous={`${k.etablissements} établissement(s) · ${k.bloques} bloqué(s)`} onClick={() => go('/plateforme')} />
        <Indicateur label="Relances en retard" etat={commercial} valeur={relances.length} sous={relances.length ? 'à faire en premier' : 'aucune en retard'} ton={relances.length ? 'rouge' : 'vert'} onClick={() => go('/journee?onglet=jour')} />
        <Indicateur label="Encaissé ce mois" etat={finances} valeur={argent(encaisse, devise)} sous={`paiements notés dans le CRM · ${nomMois}`} onClick={() => go('/paiements')} />
        <Indicateur
          label="Licences à renouveler (7 j)"
          etat={pfEtat}
          vide="0"
          valeur={licences.bientot.length}
          sous={licences.echues.length ? `+ ${licences.echues.length} déjà échue(s)` : 'aucune échue'}
          ton={licences.echues.length ? 'rouge' : licences.bientot.length ? 'orange' : 'vert'}
          onClick={() => go('/plateforme?filtre=licence')}
        />
      </div>
      <div className="pf-grille">
        <Bloc id="afaire" titre="À faire aujourd’hui" className="pf-afaire" etat={pfEtat} vide="Rien d’urgent : tous les clients vont bien." action={p.connecte ? null : seConnecter} onReessayer={p.recharger}>
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
        </Bloc>
        <Bloc id="sante" titre="Santé des clients" etat={pfEtat} vide="Aucun client à suivre." action={p.connecte ? null : seConnecter} onReessayer={p.recharger}>
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
        </Bloc>
        <Bloc id="direct" titre="En direct" etat={pfEtat.etat === 'donnees' && fil.length === 0 ? { etat: 'vide' } : pfEtat} vide="Aucune activité récente." action={p.connecte ? null : seConnecter} onReessayer={p.recharger}>
          <ul className="pf-liste">
            {fil.map(({ c, e, t: quandT }) => (
              <li key={e.id} className="pf-fil">
                <span className="pf-point vert" />
                <span className="pf-alerte-txt">
                  <strong>{e.nom}</strong>
                  <span className="bloc small muted">
                    {quand(quandT)}
                    {e.activite.ventes_jour ? ` · ${e.activite.ventes_jour} vente(s) aujourd’hui, ${argent(e.activite.montant_jour, e.devise)}` : ''}
                    {e.activite.caisses_ouvertes ? ` · ${e.activite.caisses_ouvertes} caisse(s) ouverte(s)` : ''}
                  </span>
                </span>
                <button className="btn sm ghost" onClick={() => go(`/plateforme-client/${c.id}`)} aria-label={`Ouvrir ${c.nom}`}>
                  <Icon n="arrow-right" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Bloc>
      </div>
      <Bloc id="autres" titre="Autres chiffres" etat={{ etat: 'donnees' }}>
        <div className="pf-chiffres compact">
          <Indicateur label="Abonnements par mois" etat={pfEtat} vide="0" valeur={afficherSommes(k.mensuelParDevise)} sous="licences actives" />
          <Indicateur label="Factures à encaisser" etat={finances} valeur={impayees.length} sous={facturesEnRetard ? `${facturesEnRetard} en retard` : 'aucune en retard'} ton={facturesEnRetard ? 'rouge' : ''} onClick={() => go('/factures?filtre=impayees')} />
          <Indicateur label="Ventes des clients aujourd’hui" etat={pfEtat} vide="0" valeur={afficherSommes(k.ventesJourParDevise)} sous="total de toutes les caisses" />
          <Indicateur label="Personnes actives (7 j)" etat={pfEtat} vide="0" valeur={k.utilisateursActifs} sous={`${k.bloques} client(s) bloqué(s)`} />
        </div>
      </Bloc>
      <BoutonsRapides />
      {connexion && (
        <Modal title="Connexion à la plateforme" onClose={() => setConnexion(false)}>
          <ConnexionPlateforme
            onConnecte={() => {
              setConnexion(false)
              p.setConnecte(true)
              p.recharger()
            }}
          />
        </Modal>
      )}
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
      <button className="btn" onClick={() => go('/espace')}>
        <Icon n="grid" size={14} /> Tous les espaces
      </button>
    </div>
  )
}

// ——— Liste des clients de la plateforme ———
export function ClientsPlateforme({ filtre: filtreInitial }) {
  const p = usePlateforme()
  return (
    <Garde p={p} titre="Clients du logiciel">
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
        <h1 className="pf-titre">Clients du logiciel</h1>
        <div className="row">
          <input className="pf-recherche" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un client…" aria-label="Chercher un client" />
          <label className="small muted row" style={{ gap: 6 }}>
            <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} /> Démo et archives
          </label>
          {/* Création guidée : client, puis la fiche montre les étapes suivantes (établissement, licence, compte) */}
          <button className="btn primary" onClick={() => go('/editeur/clients?nouveau=1')}>
            <Icon n="plus" size={14} /> Nouveau client
          </button>
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
                  {c.etablissements.length} établissement(s) · {c.mensuel ? `${enDevise(c.mensuel, c.devise)} / mois` : 'pas d’abonnement payant'}
                </span>
                <span className="pf-carte-chiffres">
                  <span>
                    <small>Ventes 30 j</small>
                    {enDevise(c.ventes30j, c.devise)}
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

// ——— Fiche client unique (lot 5) ———
// Une seule fiche par client du logiciel, à onglets. L'ancienne page client de l'éditeur y mène (redirection) et
// reste disponible dans « Réglages avancés ». Chaque geste sur l'argent ou l'accès est séparé, confirmé et tracé.
export const ONGLETS_FICHE = [
  ['resume', 'Résumé'],
  ['etablissements', 'Établissements'],
  ['licences', 'Licences et paiements'],
  ['modules', 'Modules'],
  ['comptes', 'Comptes'],
  ['assistance', 'Assistance'],
  ['avance', 'Réglages avancés'],
]
const FAIRE = ['encaisser', 'prolonger', 'renouveler', 'bloquer', 'debloquer', 'message', 'assister']

export function FichePlateforme({ id, faire, onglet, mdp }) {
  const p = usePlateforme()
  return (
    <Garde p={p} titre="Fiche client">
      <Fiche360 key={id} p={p} id={id} faire={faire} ongletDemande={onglet} mdpDemande={mdp} />
    </Garde>
  )
}

// Comptes de la plateforme : lus seulement quand l'onglet Comptes est ouvert, gardés 2 minutes (pas à chaque fiche)
let comptesCache = null
async function lireComptes(forcer) {
  if (!forcer && comptesCache && Date.now() - comptesCache.t < 120000) return comptesCache.liste
  const liste = await appeler('editeur_comptes')
  comptesCache = { t: Date.now(), liste: liste || [] }
  return comptesCache.liste
}
export const viderComptes = () => (comptesCache = null)

function Fiche360({ p, id, faire, ongletDemande, mdpDemande }) {
  const c = p.etat.clients.find((x) => x.id === id)
  const { settings, toast } = useNoyau()
  const { prospects = [], actions = [] } = useDonnees()
  const [onglet, setOnglet] = useState(ONGLETS_FICHE.some(([k]) => k === ongletDemande) ? ongletDemande : mdpDemande ? 'comptes' : 'resume')
  const [chrono, setChrono] = useState(null)
  const [comptes, setComptes] = useState(null)
  const [modale, setModale] = useState(FAIRE.includes(faire) ? faire : null)
  const chargerChrono = useCallback(() => {
    appeler('pilotage_chronologie', { p_client_id: id, p_limite: 80 }).then(setChrono, (e) => setChrono({ erreur: e.message }))
  }, [id])
  const chargerComptes = useCallback((forcer) => {
    setComptes((x) => (forcer ? null : x))
    lireComptes(forcer).then(setComptes, (e) => setComptes({ erreur: e.message }))
  }, [])
  useEffect(() => {
    chargerChrono()
  }, [chargerChrono])
  useEffect(() => {
    if (onglet === 'comptes' && comptes === null) chargerComptes()
  }, [onglet, comptes, chargerComptes])
  // Lien « mot de passe » venu d'un autre écran : le seul chemin passe par l'onglet Comptes
  useEffect(() => {
    if (mdpDemande && Array.isArray(comptes)) {
      const u = comptes.find((x) => x.id === mdpDemande)
      if (u) setModale({ mdp: u })
    }
  }, [mdpDemande, comptes])
  if (!c) return <Empty>Client introuvable sur la plateforme.</Empty>
  const fiche = ficheLiee(c, settings, prospects)
  const ids = new Set(c.etablissements.map((e) => e.id))
  const sesComptes = Array.isArray(comptes) ? comptes.filter((u) => (u.acces || []).some((a) => ids.has(a.etablissement_id))) : []
  const paiementsCrm = fiche ? actions.filter((a) => a.prospect_id === fiche.id && a.action === 'Paiement reçu').sort((a, b) => (a.date < b.date ? 1 : -1)) : []
  const etabs = c.etablissements.filter((e) => e.statut !== 'archive')
  // Après une action : la fenêtre se ferme (sauf si elle doit rester ouverte), puis tout est relu
  const apres = async (message, garder) => {
    if (!garder) fermer()
    toast(`${message} ✓`)
    await p.recharger()
    chargerChrono()
    if (Array.isArray(comptes)) chargerComptes(true)
  }
  const fermer = () => {
    setModale(null)
    if (faire || mdpDemande) window.history.replaceState(null, '', `#/plateforme-client/${id}${onglet !== 'resume' ? `?onglet=${onglet}` : ''}`)
  }
  const changerOnglet = (o) => {
    setOnglet(o)
    window.history.replaceState(null, '', `#/plateforme-client/${id}${o !== 'resume' ? `?onglet=${o}` : ''}`)
  }
  const bloque = c.statut === 'suspendu'
  const compte = (o) => (o === 'etablissements' ? etabs.length : o === 'comptes' && Array.isArray(comptes) ? sesComptes.length : undefined)
  return (
    <div className="stack pf">
      <button className="btn sm ghost pf-retour" onClick={() => go('/plateforme')}>
        ← Clients du logiciel
      </button>
      <section className={`card pf-bandeau ${c.sante.ton}`}>
        <div className="pf-bandeau-nom">
          <h1 className="pf-titre">{c.nom}</h1>
          <div className="row small muted">
            <Sante s={c.sante} />
            {bloque && <span className="badge b-red">Client bloqué</span>}
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
        {c.message && (
          <p className={`pf-message ${c.message.ton}`}>
            Message affiché au client : « {c.message.texte} »
          </p>
        )}
        {/* Densité : 1 action principale, 3 secondaires au plus, le reste dans « Plus » */}
        <div className="pf-boutons">
          <button className="btn primary" onClick={() => setModale('encaisser')}>
            <Icon n="coins" size={15} /> Encaisser
          </button>
          <button className="btn" onClick={() => setModale('prolonger')}>
            <Icon n="clock" size={15} /> Prolonger
          </button>
          <button className="btn" onClick={() => go(`/facture/new?type=facture${fiche ? `&p=${fiche.id}` : ''}`)}>
            <Icon n="file" size={15} /> Facturer
          </button>
          <button className="btn" onClick={() => setModale('plus')}>
            <Icon n="more" size={15} /> Plus
          </button>
        </div>
      </section>
      <OperationsAReconcilier clientId={c.id} onFait={(m) => apres(m, true)} />
      <Tabs items={ONGLETS_FICHE.map(([k, l]) => [k, l, compte(k)])} value={onglet} onChange={changerOnglet} />

      {onglet === 'resume' && (
        <div className="pf-grille deux">
          <div className="stack">
            <MiseEnRoute c={c} comptes={Array.isArray(comptes) ? sesComptes : null} onOnglet={changerOnglet} />
            <section className="card">
              <h2 className="section">En bref</h2>
              <div className="pf-chiffres compact">
                <Chiffre label="Paie par mois" valeur={enDevise(c.mensuel, c.devise)} />
                <Chiffre label="Licence" valeur={c.joursRestants == null ? '—' : c.joursRestants < 0 ? `Échue (${-c.joursRestants} j)` : `${c.joursRestants} j`} ton={c.joursRestants != null && c.joursRestants < 0 ? 'rouge' : c.joursRestants != null && c.joursRestants <= 7 ? 'orange' : ''} />
                <Chiffre label="Ventes 30 j" valeur={enDevise(c.ventes30j, c.devise)} />
                <Chiffre label="Activité" valeur={quand(c.derniereActivite)} />
              </div>
            </section>
          </div>
          <Histoire chrono={chrono} c={c} />
        </div>
      )}

      {onglet === 'etablissements' && (
        <div className="stack">
          {etabs.length === 0 && <Empty>Aucun établissement. Crée-le dans « Réglages avancés ».</Empty>}
          {etabs.map((e) => (
            <section key={e.id} className="card">
              <div className="pf-carte-tete">
                <h2 className="section">{e.nom}</h2>
                <Sante s={e.sante} />
              </div>
              <div className="pf-carte-chiffres">
                <span>
                  <small>Aujourd’hui</small>
                  {enDevise(e.activite.montant_jour, e.devise)} ({e.activite.ventes_jour || 0})
                </span>
                <span>
                  <small>7 jours</small>
                  {enDevise(e.activite.montant_7j, e.devise)}
                </span>
                <span>
                  <small>30 jours</small>
                  {enDevise(e.activite.montant_30j, e.devise)}
                </span>
                <span>
                  <small>Personnes actives</small>
                  {e.activite.utilisateurs_actifs_7j || 0}
                </span>
              </div>
              <p className="small muted">
                {e.membres_actifs} membre(s) · dernière connexion {quand(e.activite.derniere_connexion)}
                {e.activite.caisses_ouvertes ? ` · ${e.activite.caisses_ouvertes} caisse(s) ouverte(s)` : ''}
                {e.statut === 'suspendu' ? ' · établissement bloqué' : ''}
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
              <div className="pf-boutons">
                <a className="btn sm" href={`#/editeur/etablissements/${e.id}`}>
                  <Icon n="settings" size={14} /> Hubs, équipe, mise en service
                </a>
              </div>
            </section>
          ))}
        </div>
      )}

      {onglet === 'licences' && (
        <div className="pf-grille deux">
          <div className="stack">
            {etabs.map((e) => (
              <section key={e.id} className="card">
                <div className="pf-carte-tete">
                  <h2 className="section">{e.nom}</h2>
                  {e.licence ? <span className={`badge ${e.licence.statut === 'suspendue' ? 'b-red' : e.licence.valide ? 'b-green' : 'b-orange'}`}>{e.licence.statut === 'suspendue' ? 'Suspendue' : e.licence.valide ? 'Valide' : 'Expirée'}</span> : <span className="badge b-orange">Aucune licence</span>}
                </div>
                {e.licence ? (
                  <>
                    <KV
                      rows={[
                        ['Offre', `${e.licence.offre || '—'} · ${e.licence.formule || '—'}`],
                        ['Échéance', `${date(e.licence.echeance)}${e.licence.jours_restants != null ? ` (${e.licence.jours_restants < 0 ? `échue depuis ${-e.licence.jours_restants} j` : `dans ${e.licence.jours_restants} j`})` : ''}`],
                        ['Montant', enDevise(e.licence.montant, e.devise)],
                      ]}
                    />
                    <div className="pf-boutons">
                      <button className="btn sm primary" onClick={() => setModale({ encaisser: e.id })}>
                        Encaisser et renouveler
                      </button>
                      <button className="btn sm" onClick={() => setModale({ renouveler: e.id })}>
                        Renouveler sans encaissement
                      </button>
                      <button className="btn sm" onClick={() => setModale({ prolonger: e.id })}>
                        Prolongation gratuite
                      </button>
                      <button className={`btn sm ${e.licence.statut === 'suspendue' ? '' : 'danger'}`} onClick={() => setModale({ licence: e })}>
                        {e.licence.statut === 'suspendue' ? 'Réactiver la licence' : 'Suspendre la licence'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="pf-boutons">
                    <a className="btn sm primary" href={`#/editeur/etablissements/${e.id}`}>
                      Attribuer une licence
                    </a>
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="stack">
            <section className="card">
              <h2 className="section">Paiements reçus (CRM)</h2>
              {!fiche ? (
                <p className="small muted">
                  Relie ce client à une fiche CRM pour voir ses paiements.{' '}
                  <button className="pf-lien" onClick={() => setModale('relier')}>
                    Relier
                  </button>
                </p>
              ) : paiementsCrm.length === 0 ? (
                <Empty>Aucun paiement noté pour cette fiche.</Empty>
              ) : (
                <ul className="pf-liste">
                  {paiementsCrm.slice(0, 12).map((a) => (
                    <li key={a.id} className="pf-fil">
                      <span className="pf-alerte-txt">
                        <strong>{enDevise(a.montant)}</strong>
                        <span className="bloc small muted">
                          {date(a.date)} · {a.mode || '—'} {a.reference ? `· ${a.reference}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <JournalGestes clientId={c.id} />
          </div>
        </div>
      )}

      {onglet === 'modules' && (
        <div className="stack">
          {etabs.map((e) => (
            <section key={e.id} className="card">
              <div className="pf-carte-tete">
                <h2 className="section">{e.nom}</h2>
                <button className="btn sm" onClick={() => setModale({ modules: e })}>
                  <Icon n="layers" size={14} /> Gérer les modules
                </button>
              </div>
              <p className="small muted">{e.licence?.modules?.length ? `Inclus dans la licence : ${e.licence.modules.join(', ')}` : 'Modules : ouvre « Gérer les modules » pour les voir et les changer.'}</p>
            </section>
          ))}
          {etabs.length === 0 && <Empty>Aucun établissement.</Empty>}
        </div>
      )}

      {onglet === 'comptes' && (
        <Bloc
          id="comptes"
          titre={`Comptes${Array.isArray(comptes) ? ` (${sesComptes.length})` : ''}`}
          etat={comptes === null ? { etat: 'chargement' } : comptes.erreur ? { etat: /super admin|refus/i.test(comptes.erreur) ? 'refuse' : 'erreur', raison: comptes.erreur } : sesComptes.length === 0 ? { etat: 'vide' } : { etat: 'donnees' }}
          vide="Aucun compte pour ce client."
          onReessayer={() => chargerComptes(true)}
          entete={
            <button className="btn sm ghost" onClick={() => chargerComptes(true)}>
              <Icon n="rotate" size={14} /> Actualiser
            </button>
          }
        >
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
        </Bloc>
      )}

      {onglet === 'assistance' && (
        <div className="grid grid-2">
          <section className="card">
            <h2 className="section">Voir ce que voit le client</h2>
            <p className="small muted">Session d’assistance en lecture, avec un motif, tracée côté plateforme.</p>
            <div className="pf-boutons">
              <button className="btn primary" onClick={() => setModale('assister')}>
                <Icon n="eye" size={15} /> Assister
              </button>
            </div>
          </section>
          <section className="card">
            <h2 className="section">Message affiché dans le logiciel</h2>
            <p className="small muted">{c.message ? `En ce moment : « ${c.message.texte} »` : 'Aucun message en ce moment.'}</p>
            <div className="pf-boutons">
              <button className="btn" onClick={() => setModale('message')}>
                <Icon n="message" size={15} /> {c.message ? 'Changer le message' : 'Écrire un message'}
              </button>
            </div>
          </section>
        </div>
      )}

      {onglet === 'avance' && (
        <div className="stack">
          <MiseEnRoute c={c} comptes={Array.isArray(comptes) ? sesComptes : null} onOnglet={changerOnglet} />
          <section className="card zone-danger">
            <h2 className="section">Zone danger</h2>
            <p className="small muted">Chaque geste demande une confirmation et un motif ; il est noté dans le journal.</p>
            <div className="pf-boutons">
              <button className={`btn ${bloque ? 'primary' : 'danger'}`} onClick={() => setModale(bloque ? 'debloquer' : 'bloquer')}>
                <Icon n="ban" size={15} /> {bloque ? 'Débloquer le client' : 'Bloquer le client'}
              </button>
              <button className="btn" onClick={() => setModale('relier')}>
                <Icon n="handshake" size={15} /> {fiche ? 'Changer la fiche CRM liée' : 'Relier à une fiche CRM'}
              </button>
            </div>
          </section>
          <section className="card">
            <h2 className="section">Fiche client de la plateforme</h2>
            <p className="small muted">Identité, dirigeants, nouvel établissement, apparence : les écrans de l’éditeur, dans la fiche.</p>
            <AdminEmbarque route={`clients/${c.id}`} />
          </section>
        </div>
      )}

      {(modale === 'encaisser' || modale?.encaisser) && <Encaisser c={c} fiche={fiche} etablissementId={modale?.encaisser} onFermer={fermer} onFait={apres} />}
      {(modale === 'prolonger' || modale?.prolonger) && <Prolonger c={c} etablissementId={modale?.prolonger} onFermer={fermer} onFait={apres} />}
      {(modale === 'renouveler' || modale?.renouveler) && <RenouvelerSansEncaissement c={c} etablissementId={modale?.renouveler} onFermer={fermer} onFait={apres} />}
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

// Histoire du client (chronologie de la plateforme)
function Histoire({ chrono, c }) {
  return (
    <section className="card">
      <h2 className="section">Histoire du client</h2>
      {!chrono ? (
        <div className="bloc-etat squelette-bloc" aria-busy="true" aria-label="Chargement de l’histoire">
          <span />
          <span />
          <span />
        </div>
      ) : chrono.erreur ? (
        <p className="pf-erreur" role="alert">
          {chrono.erreur}
        </p>
      ) : chrono.length === 0 ? (
        <Empty>Rien pour l’instant.</Empty>
      ) : (
        <ol className="pf-chrono">
          {chrono.map((ev, i) => (
            <li key={i} className={ev.type.split('.')[0]}>
              <span className="pf-chrono-date">{date(ev.date)}</span>
              <span>
                <strong>{LIBELLES_CHRONO[ev.type] || ev.type}</strong>
                {ev.montant ? ` · ${enDevise(ev.montant, c.devise)}` : ''}
                <span className="bloc small muted">{[ev.etablissement, ev.detail].filter(Boolean).join(' · ')}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// Création guidée : les étapes pour qu'un nouveau client soit prêt (client → établissement → licence → compte)
export function etapesMiseEnRoute(c, comptes) {
  const etabs = (c.etablissements || []).filter((e) => e.statut !== 'archive')
  return [
    { id: 'client', label: 'Client créé', fait: true },
    { id: 'etablissement', label: 'Premier établissement', fait: etabs.length > 0, onglet: 'avance' },
    { id: 'licence', label: 'Licence attribuée', fait: etabs.some((e) => e.licence), onglet: 'licences' },
    { id: 'compte', label: 'Compte du gérant', fait: comptes == null ? null : comptes.length > 0, onglet: 'comptes' },
    { id: 'service', label: 'Mis en service', fait: etabs.some((e) => e.mis_en_service_le), onglet: 'etablissements' },
  ]
}
function MiseEnRoute({ c, comptes, onOnglet }) {
  const etapes = etapesMiseEnRoute(c, comptes)
  const restantes = etapes.filter((x) => x.fait === false)
  if (!restantes.length) return null
  const suivante = restantes[0]
  return (
    <section className="card mise-en-route" aria-labelledby="titre-mise-en-route">
      <h2 className="section" id="titre-mise-en-route">
        Mise en route
      </h2>
      <ol className="etapes">
        {etapes.map((x) => (
          <li key={x.id} className={x.fait ? 'fait' : x === suivante ? 'suivante' : ''}>
            <span className="etape-pt" aria-hidden="true">{x.fait ? '✓' : ''}</span>
            {x.label}
            {x.fait === null && <span className="tiny muted"> (voir l’onglet Comptes)</span>}
          </li>
        ))}
      </ol>
      <button className="btn sm primary" onClick={() => onOnglet(suivante.onglet)}>
        Étape suivante : {suivante.label.toLowerCase()}
      </button>
    </section>
  )
}

// Journal des gestes de ce client (sur cet appareil)
function JournalGestes({ clientId }) {
  const journal = journalOperations()
  const [liste, setListe] = useState(() => journal.liste())
  useEffect(() => journal.abonner(() => setListe(journal.liste())), [journal])
  const miens = liste.filter((o) => o.client?.id === clientId).slice(0, 12)
  return (
    <section className="card">
      <h2 className="section">Journal des gestes</h2>
      {miens.length === 0 ? (
        <Empty>Aucun geste noté sur cet appareil.</Empty>
      ) : (
        <ul className="pf-liste">
          {miens.map((o) => (
            <li key={o.id} className="pf-fil">
              <span className="pf-alerte-txt">
                <strong>{GESTES[o.type] || o.type}</strong>
                {o.etat && o.type === 'encaisser' && <span className={`badge ${o.etat === 'terminee' ? 'b-green' : A_REPRENDRE.includes(o.etat) ? 'b-orange' : 'b-red'}`}> {ETATS[o.etat] || o.etat}</span>}
                <span className="bloc small muted">
                  {date(o.cree_le || o.le)} {o.etablissement?.nom ? `· ${o.etablissement.nom}` : ''} {o.montant ? `· ${enDevise(o.montant, o.devise)}` : ''} {o.motif ? `· motif : ${o.motif}` : ''} {o.detail ? `· ${o.detail}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <a className="btn sm ghost" href="#/operations">
        Tout le journal et la réconciliation
      </a>
    </section>
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

// Encaisser : la licence est prolongée sur la plateforme ET le paiement est noté dans le CRM.
// Deux bases : l'opération est suivie pas à pas (modules/plateforme/operations.js), avec un récapitulatif avant
// l'envoi. Une opération coupée en route est gardée dans « Opérations à réconcilier » et se reprend sans doublon.
const nombre = (v) => Number(String(v).replace(/[\s  ]/g, '').replace(',', '.'))
function useDepsOperations() {
  const { api } = useNoyau()
  const { actions = [] } = useDonnees()
  const ref = useRef(actions)
  useEffect(() => {
    ref.current = actions
  }, [actions])
  return {
    journal: journalOperations(),
    appeler,
    lireHistorique: (id) => appeler('editeur_etablissement', { p_etablissement_id: id }).then((d) => d?.historique_licences || []),
    lireActions: () => ref.current,
    ajouterPaiement: (a) => api.addActions([a]),
  }
}
function Encaisser({ c, fiche, etablissementId, onFermer, onFait }) {
  const deps = useDepsOperations()
  const avecLicence = c.etablissements.filter((e) => e.licence && e.statut !== 'archive')
  const [etabId, setEtabId] = useState(avecLicence.some((x) => x.id === etablissementId) ? etablissementId : avecLicence[0]?.id || '')
  const e = avecLicence.find((x) => x.id === etabId)
  const [montant, setMontant] = useState(String(e?.mensuel || e?.licence?.montant || ''))
  const [mode, setMode] = useState('Mobile Money')
  const [jour, setJour] = useState(aujourdhui())
  const [reference, setReference] = useState('')
  const proposee = e ? echeanceProposee(e.licence) : null
  const [echeance, setEcheance] = useState(proposee || '')
  const [recap, setRecap] = useState(false)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const verrou = useRef(false)
  if (!e)
    return (
      <Modal title="Encaisser" onClose={onFermer}>
        <p>Ce client n’a pas encore de licence. Attribue-la depuis la fiche de son établissement, puis encaisse.</p>
        <button className="btn primary" onClick={() => go(c.etablissements[0] ? `/editeur/etablissements/${c.etablissements[0].id}` : '/editeur/clients')}>
          Attribuer une licence
        </button>
      </Modal>
    )
  const n = nombre(montant)
  const verifier = (ev) => {
    ev.preventDefault()
    setErreur('')
    if (!(n > 0)) return setErreur('Montant à saisir.')
    const m = erreurEcheance(e.licence, echeance)
    if (m) return setErreur(m)
    setRecap(true)
  }
  const confirmerEnvoi = async () => {
    if (verrou.current) return
    verrou.current = true
    setOccupe(true)
    setErreur('')
    try {
      const op = preparerEncaissement({ client: c, etablissement: e, licence: e.licence, montant: n, mode, jour, reference, ficheId: fiche?.id, nouvelleEcheance: echeance === proposee ? null : echeance })
      const fin = await executer(op, deps)
      await onFait(`Paiement encaissé, licence prolongée jusqu’au ${date(fin.echeanceApres)}`)
    } catch (x) {
      setErreur(x.message)
      if (x.operation && A_REPRENDRE.includes(x.operation.etat)) await onFait('Opération gardée dans « Opérations à réconcilier »', true).catch(() => {})
    } finally {
      verrou.current = false
      setOccupe(false)
    }
  }
  return (
    <Modal title={`Encaisser · ${c.nom}`} onClose={onFermer}>
      {recap ? (
        <div className="stack">
          <p className="small muted">Vérifie avant d’envoyer. La licence est prolongée sur la plateforme, puis le paiement est noté dans le CRM.</p>
          <dl className="pf-recap">
            <dt>Établissement</dt>
            <dd>{e.nom}</dd>
            <dt>Montant reçu</dt>
            <dd>
              <strong>{enDevise(n, e.devise)}</strong> · {mode}
              {reference ? ` · réf. ${reference}` : ''}
            </dd>
            <dt>Date du paiement</dt>
            <dd>{date(jour)}</dd>
            <dt>Échéance</dt>
            <dd>
              {date(e.licence.echeance)} → <strong>{date(echeance)}</strong>
            </dd>
            <dt>Fiche CRM</dt>
            <dd>{fiche ? fiche.name : 'aucune fiche reliée (paiement noté sans fiche)'}</dd>
          </dl>
          {erreur && (
            <p className="pf-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" disabled={occupe} onClick={() => setRecap(false)}>
              Modifier
            </button>
            <button type="button" className="btn primary" disabled={occupe} aria-busy={occupe || undefined} onClick={confirmerEnvoi}>
              {occupe ? 'Envoi…' : 'Confirmer l’encaissement'}
            </button>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={verifier}>
          <ChoixEtablissement
            c={c}
            value={etabId}
            onChange={(id) => {
              setEtabId(id)
              const x = avecLicence.find((y) => y.id === id)
              setEcheance(echeanceProposee(x?.licence) || '')
            }}
            filtre={(x) => Boolean(x.licence)}
          />
          <Field label={`Montant reçu (${symbole(avecLicence.find((y) => y.id === etabId)?.devise)})`}>
            <input inputMode="decimal" value={montant} onChange={(ev) => setMontant(ev.target.value)} required autoFocus />
          </Field>
          <Field label="Moyen de paiement">
            <Chips options={MODES} value={mode} onChange={(v) => setMode(v || mode)} small allowEmpty={false} />
          </Field>
          <div className="grid grid-2">
            <Field label="Date du paiement">
              <input type="date" value={jour} onChange={(ev) => setJour(ev.target.value)} required />
            </Field>
            <Field label="Référence (facultatif)">
              <input value={reference} onChange={(ev) => setReference(ev.target.value)} placeholder="N° de transaction" />
            </Field>
          </div>
          <Field label="Nouvelle échéance" hint={`Actuelle : ${date(e.licence.echeance)}. Une période (${e.licence.formule}) est proposée.`}>
            <input type="date" value={echeance} min={echeanceMinimum(e.licence)} onChange={(ev) => setEcheance(ev.target.value)} required />
          </Field>
          {erreur && (
            <p className="pf-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="btn" onClick={onFermer}>
              Annuler
            </button>
            <button className="btn primary">Vérifier</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// Prolonger sans paiement : geste commercial ou délai accordé, avec un motif obligatoire.
// La nouvelle échéance est toujours après l'actuelle (SEC-09).
function Prolonger({ c, etablissementId, onFermer, onFait }) {
  const avecLicence = c.etablissements.filter((e) => e.licence && e.statut !== 'archive')
  const [etabId, setEtabId] = useState(avecLicence.some((x) => x.id === etablissementId) ? etablissementId : avecLicence[0]?.id || '')
  const e = avecLicence.find((x) => x.id === etabId)
  const base = e ? baseRenouvellement(e.licence) : aujourdhui()
  const [jours, setJours] = useState('3 jours')
  const [fin, setFin] = useState(plusJoursIso(base, 3))
  const [motif, setMotif] = useState('')
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  const DUREES = { '3 jours': 3, '7 jours': 7, '1 mois': 30 }
  if (!e)
    return (
      <Modal title="Prolonger" onClose={onFermer}>
        <p>Ce client n’a pas de licence à prolonger.</p>
      </Modal>
    )
  const probleme = erreurEcheance(e.licence, fin)
  return (
    <Modal title={`Prolonger sans paiement · ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (probleme || motif.trim().length < 3) return
          envoyer(async () => {
            await appeler('renouveler_licence', { p_licence_id: e.licence.id, p_nouvelle_echeance: fin, p_montant: 0, p_reference: 'Prolongation CRM', p_note: `Sans paiement : ${motif.trim()}` })
            noterGeste(journalOperations(), { type: 'prolonger', client: c, etablissement: e, motif: motif.trim(), detail: `${e.licence.echeance || '—'} → ${fin}` })
          }, `Licence prolongée jusqu’au ${date(fin)}`)
        }}
      >
        <ChoixEtablissement
          c={c}
          value={etabId}
          onChange={(id) => {
            setEtabId(id)
            const x = avecLicence.find((y) => y.id === id)
            setFin(plusJoursIso(baseRenouvellement(x?.licence), DUREES[jours]))
          }}
          filtre={(x) => Boolean(x.licence)}
        />
        <p className="small muted">Aucun paiement n’est noté. Pour un paiement reçu, utilise « Encaisser ».</p>
        <Chips
          options={Object.keys(DUREES)}
          value={jours}
          allowEmpty={false}
          onChange={(v) => {
            setJours(v)
            setFin(plusJoursIso(base, DUREES[v]))
          }}
        />
        <Field label="Nouvelle échéance" hint={`Actuelle : ${date(e.licence.echeance)}`}>
          <input type="date" value={fin} min={echeanceMinimum(e.licence)} onChange={(ev) => setFin(ev.target.value)} required aria-invalid={probleme ? true : undefined} />
        </Field>
        <Field label="Motif (obligatoire)">
          <input value={motif} onChange={(ev) => setMotif(ev.target.value)} required minLength={3} placeholder="Ex. geste commercial, panne côté client" />
        </Field>
        <p className="small">
          Récapitulatif : échéance {date(e.licence.echeance)} → <strong>{date(fin)}</strong>, sans paiement.
        </p>
        {probleme && (
          <p className="pf-erreur" role="alert">
            {probleme}
          </p>
        )}
        <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Prolonger" />
      </form>
    </Modal>
  )
}

// Renouveler sans encaissement : une période normale (1 mois ou 1 an), sans paiement dans le CRM, motif obligatoire
// (ex. payé par un autre canal, avoir). Différent de la prolongation gratuite (quelques jours, geste commercial).
function RenouvelerSansEncaissement({ c, etablissementId, onFermer, onFait }) {
  const avecLicence = c.etablissements.filter((e) => e.licence && e.statut !== 'archive')
  const [etabId, setEtabId] = useState(avecLicence.some((x) => x.id === etablissementId) ? etablissementId : avecLicence[0]?.id || '')
  const e = avecLicence.find((x) => x.id === etabId)
  const [fin, setFin] = useState(e ? echeanceProposee(e.licence) || '' : '')
  const [motif, setMotif] = useState('')
  const [recap, setRecap] = useState(false)
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  if (!e)
    return (
      <Modal title="Renouveler sans encaissement" onClose={onFermer}>
        <p>Ce client n’a pas de licence à renouveler.</p>
      </Modal>
    )
  const probleme = erreurEcheance(e.licence, fin)
  const pret = !probleme && motif.trim().length >= 3
  return (
    <Modal title={`Renouveler sans encaissement · ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (!pret) return
          if (!recap) return setRecap(true)
          envoyer(async () => {
            await appeler('renouveler_licence', { p_licence_id: e.licence.id, p_nouvelle_echeance: fin, p_montant: 0, p_reference: 'Renouvellement CRM sans encaissement', p_note: `Renouvellement sans encaissement : ${motif.trim()}` })
            noterGeste(journalOperations(), { type: 'renouveler_sans_encaissement', client: c, etablissement: e, motif: motif.trim(), detail: `${e.licence.echeance || '—'} → ${fin}` })
          }, `Licence renouvelée jusqu’au ${date(fin)}, sans encaissement`)
        }}
      >
        {!recap ? (
          <>
            <ChoixEtablissement
              c={c}
              value={etabId}
              onChange={(id) => {
                setEtabId(id)
                setFin(echeanceProposee(avecLicence.find((y) => y.id === id)?.licence) || '')
              }}
              filtre={(x) => Boolean(x.licence)}
            />
            <p className="small muted">Aucun paiement n’est noté dans le CRM. Si le client a payé, utilise plutôt « Encaisser et renouveler ».</p>
            <Field label="Nouvelle échéance" hint={`Actuelle : ${date(e.licence.echeance)} · proposée : une période ${e.licence.formule === 'annuel' ? 'd’un an' : 'd’un mois'}`}>
              <input type="date" value={fin} min={echeanceMinimum(e.licence)} onChange={(ev) => setFin(ev.target.value)} required aria-invalid={probleme ? true : undefined} />
            </Field>
            <Field label="Motif (obligatoire)">
              <input value={motif} onChange={(ev) => setMotif(ev.target.value)} required minLength={3} placeholder="Ex. payé par virement noté ailleurs, avoir" />
            </Field>
            {probleme && (
              <p className="pf-erreur" role="alert">
                {probleme}
              </p>
            )}
            <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Vérifier" />
          </>
        ) : (
          <>
            <dl className="pf-recap">
              <dt>Établissement</dt>
              <dd>{e.nom}</dd>
              <dt>Échéance</dt>
              <dd>
                {date(e.licence.echeance)} → <strong>{date(fin)}</strong>
              </dd>
              <dt>Paiement</dt>
              <dd>Aucun (rien n’est noté dans le CRM)</dd>
              <dt>Motif</dt>
              <dd>{motif.trim()}</dd>
            </dl>
            <Pied occupe={occupe} erreur={erreur} onFermer={() => setRecap(false)} ok="Renouveler sans encaissement" />
          </>
        )}
      </form>
    </Modal>
  )
}

// Fiche client de l'éditeur, affichée dans « Réglages avancés » (chargée seulement à l'ouverture de l'onglet)
const AdminSaaSDiffere = lazy(() => import('./AdminSaaS'))
function AdminEmbarque({ route }) {
  return (
    <Suspense fallback={<div className="chargement" aria-busy="true" aria-label="Chargement des réglages" />}>
      <AdminSaaSDiffere route={route} />
    </Suspense>
  )
}

// Opérations à réconcilier : encaissements coupés en route. « Reprendre » finit seulement ce qui manque.
export function OperationsAReconcilier({ clientId, onFait }) {
  const deps = useDepsOperations()
  const [liste, setListe] = useState(() => deps.journal.aReprendre())
  const [occupe, setOccupe] = useState('')
  const [erreur, setErreur] = useState('')
  useEffect(() => deps.journal.abonner(() => setListe(deps.journal.aReprendre())), [deps.journal])
  const ops = liste.filter((o) => o.type === 'encaisser' && (!clientId || o.client?.id === clientId))
  if (!ops.length) return null
  const reprendre = async (op) => {
    if (occupe) return
    setOccupe(op.id)
    setErreur('')
    try {
      await executer(op, deps)
      await onFait?.('Opération terminée')
    } catch (x) {
      setErreur(x.message)
    } finally {
      setOccupe('')
    }
  }
  const regler = async (op) => {
    const r = await confirmer('L’opération sort de la liste sans rien envoyer. Fais-le seulement si tu as réglé la situation à la main (paiement noté, licence vérifiée).', { titre: 'Marquer comme réglée ?', objet: `${op.client.nom} · ${enDevise(op.montant, op.devise)}`, ok: 'Marquer comme réglée', motif: true })
    if (r) marquerReglee(deps.journal, op, r.motif)
  }
  return (
    <section className="card pf-reconcilier" aria-labelledby="titre-reconcilier">
      <h2 id="titre-reconcilier" className="section">
        <Icon n="alert" size={16} /> Opérations à réconcilier <span className="count">{ops.length}</span>
      </h2>
      <p className="small muted">Un encaissement a été coupé en route. « Reprendre » vérifie ce qui est déjà fait et ne fait jamais rien deux fois.</p>
      <ul className="pf-liste">
        {ops.map((o) => (
          <li key={o.id} className="pf-fil">
            <span className="pf-alerte-txt">
              <strong>
                {o.client.nom} · {o.etablissement.nom} · {enDevise(o.montant, o.devise)}
              </strong>
              <span className="bloc small muted">
                {ETATS[o.etat]} · {quand(o.cree_le)} · {o.id}
              </span>
              {o.erreur && <span className="bloc small" style={{ color: "var(--red)" }}>{o.erreur}</span>}
            </span>
            <span className="row">
              <button className="btn sm primary" disabled={!!occupe} aria-busy={occupe === o.id || undefined} onClick={() => reprendre(o)}>
                {occupe === o.id ? 'Reprise…' : 'Reprendre'}
              </button>
              <button className="btn sm" disabled={!!occupe} onClick={() => regler(o)}>
                Marquer comme réglée
              </button>
            </span>
          </li>
        ))}
      </ul>
      {erreur && (
        <p className="pf-erreur" role="alert">
          {erreur}
        </p>
      )}
    </section>
  )
}

// Écran de réconciliation et journal complet des gestes (lot 5) : toutes les opérations notées sur cet appareil,
// filtrables ; celles à reprendre en tête. Fonctionne sans la plateforme (le journal est local).
const FILTRES_OPS = [
  ['reprendre', 'À reprendre'],
  ['encaissements', 'Encaissements'],
  ['gestes', 'Autres gestes'],
  ['tout', 'Tout'],
]
export function Operations() {
  const { toast } = useNoyau()
  const journal = journalOperations()
  const [liste, setListe] = useState(() => journal.liste())
  const [filtre, setFiltre] = useState(() => (journal.aReprendre().length ? 'reprendre' : 'tout'))
  const [cherche, setCherche] = useState('')
  useEffect(() => journal.abonner(() => setListe(journal.liste())), [journal])
  const n = (f) => liste.filter((o) => garder(o, f)).length
  const garder = (o, f) => (f === 'reprendre' ? A_REPRENDRE.includes(o.etat) : f === 'encaissements' ? o.type === 'encaisser' : f === 'gestes' ? o.type !== 'encaisser' : true)
  const q = cherche.trim().toLowerCase()
  const vues = liste.filter((o) => garder(o, filtre) && (!q || [o.client?.nom, o.etablissement?.nom, o.id, o.motif, o.detail, o.reference].some((x) => String(x || '').toLowerCase().includes(q))))
  return (
    <div className="stack pf">
      <div className="page-head">
        <div>
          <h1>Opérations et réconciliation</h1>
          <div className="sub">Chaque encaissement et chaque geste sensible, avec son état. Un encaissement coupé en route se reprend ici sans jamais être fait deux fois.</div>
        </div>
      </div>
      <OperationsAReconcilier onFait={(m) => toast(`${m} ✓`)} />
      <div className="filtres-actifs" role="group" aria-label="Filtres actifs">
        <Tabs items={FILTRES_OPS.map(([k, l]) => [k, l, n(k)])} value={filtre} onChange={setFiltre} />
        <input className="input" style={{ maxWidth: 260 }} value={cherche} onChange={(e) => setCherche(e.target.value)} placeholder="Client, établissement, référence…" aria-label="Chercher une opération" />
      </div>
      <Bloc id="journal-ops" titre={`Journal (${vues.length})`} etat={vues.length ? { etat: 'donnees' } : { etat: 'vide' }} vide={filtre === 'reprendre' ? 'Rien à reprendre : tous les encaissements sont terminés.' : 'Aucune opération notée sur cet appareil.'}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Journal des opérations">
          <table className="t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Geste</th>
                <th>Client</th>
                <th className="num">Montant</th>
                <th>État</th>
                <th>Motif, détail, référence</th>
              </tr>
            </thead>
            <tbody>
              {vues.map((o) => (
                <tr key={o.id}>
                  <td className="nowrap">{date(o.cree_le)}</td>
                  <td>{GESTES[o.type] || o.type}</td>
                  <td>
                    {o.client ? <a href={`#/plateforme-client/${o.client.id}?onglet=licences`}>{o.client.nom}</a> : '—'}
                    {o.etablissement?.nom && o.etablissement.nom !== o.client?.nom ? <span className="tiny muted"> · {o.etablissement.nom}</span> : null}
                  </td>
                  <td className="num">{o.montant ? enDevise(o.montant, o.devise) : '—'}</td>
                  <td>
                    <span className={`badge ${o.etat === 'terminee' ? 'b-green' : A_REPRENDRE.includes(o.etat) ? 'b-orange' : 'b-red'}`}>{ETATS[o.etat] || o.etat}</span>
                  </td>
                  <td className="small">
                    {[o.motif && `motif : ${o.motif}`, o.detail, o.erreur, o.id].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloc>
    </div>
  )
}

function Bloquer({ c, bloquer, onFermer, onFait }) {
  const { erreur, occupe, envoyer } = useEnvoi(onFait)
  const [motif, setMotif] = useState('')
  return (
    <Modal title={`${bloquer ? 'Bloquer' : 'Débloquer'} · ${c.nom}`} onClose={onFermer}>
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (motif.trim().length < 3) return
          envoyer(async () => {
            await appeler('definir_statut_client', { p_client_id: c.id, p_statut: bloquer ? 'suspendu' : 'actif' })
            noterGeste(journalOperations(), { type: bloquer ? 'bloquer_client' : 'debloquer_client', client: c, motif: motif.trim() })
          }, bloquer ? `${c.nom} bloqué` : `${c.nom} débloqué`)
        }}
      >
        <p>
          {bloquer
            ? `Toutes les équipes de ${c.nom} passent en consultation seule : plus de ventes ni de modifications. Leurs données restent intactes.`
            : `Les équipes de ${c.nom} retrouvent l’usage normal du logiciel.`}
        </p>
        <p className="small muted">{bloquer ? 'Tu pourras débloquer à tout moment.' : 'Tu pourras bloquer de nouveau à tout moment.'}</p>
        <Field label="Motif (obligatoire)">
          <input value={motif} onChange={(ev) => setMotif(ev.target.value)} required minLength={3} placeholder={bloquer ? 'Ex. impayé depuis 15 jours' : 'Ex. paiement reçu'} />
        </Field>
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
                  const r = await confirmer(bloquer ? 'Ses équipes passent en consultation seule : plus de ventes ni de modifications. Leurs données restent intactes.' : 'Ses équipes retrouvent l’usage normal du logiciel.', {
                    titre: bloquer ? 'Bloquer cet établissement ?' : 'Débloquer cet établissement ?',
                    objet: `${e.nom} (${c.nom})`,
                    effet: 'Tu pourras revenir en arrière à tout moment.',
                    ok: bloquer ? 'Bloquer' : 'Débloquer',
                    danger: bloquer,
                    motif: true,
                  })
                  if (!r) return
                  const ok = await envoyer(async () => {
                    await appeler('definir_statut_etablissement', { p_etablissement_id: e.id, p_statut: bloquer ? 'suspendu' : 'actif' })
                    noterGeste(journalOperations(), { type: bloquer ? 'bloquer_etablissement' : 'debloquer_etablissement', client: c, etablissement: e, motif: r.motif })
                  }, bloquer ? `${e.nom} bloqué` : `${e.nom} débloqué`)
                  if (ok) onFermer()
                }}
              >
                <Icon n="ban" size={14} /> {e.statut === 'suspendu' ? 'Débloquer' : 'Bloquer'} l’établissement
              </button>
              <a className="btn sm" href={`#/editeur/etablissements/${e.id}`}>
                <Icon n="settings" size={14} /> Réglages avancés
              </a>
            </div>
          </div>
        ))}
        <div className="pf-plus">
          <strong>Client</strong>
          <div className="pf-boutons">
            <button className="btn sm" onClick={() => onChoisir('renouveler')}>
              <Icon n="repeat" size={14} /> Renouveler sans encaissement
            </button>
            <button className="btn sm" onClick={() => onChoisir('message')}>
              <Icon n="message" size={14} /> Message
            </button>
            <button className="btn sm" onClick={() => onChoisir('assister')}>
              <Icon n="eye" size={14} /> Assister
            </button>
            <button className="btn sm" onClick={() => onChoisir('relier')}>
              <Icon n="handshake" size={14} /> Relier à une fiche CRM
            </button>
            <button className={`btn sm ${c.statut === 'suspendu' ? '' : 'danger'}`} onClick={() => onChoisir(c.statut === 'suspendu' ? 'debloquer' : 'bloquer')}>
              <Icon n="ban" size={14} /> {c.statut === 'suspendu' ? 'Débloquer le client' : 'Bloquer le client'}
            </button>
          </div>
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
  const [occupe, setOccupe] = useState('')
  const basculer = async (m, actif) => {
    if (occupe) return
    setErreur('')
    const r = await confirmer(
      actif
        ? `Le module ${m.nom} devient utilisable par les équipes de ${e.nom}.${m.couvert ? '' : ' Il n’est pas compris dans la licence : pense à le facturer.'}`
        : `Les équipes de ${e.nom} n’auront plus accès à ${m.nom}. Leurs données sont gardées et reviennent si le module est réactivé.`,
      { titre: actif ? `Activer ${m.nom} ?` : `Retirer ${m.nom} ?`, objet: e.nom, effet: 'Tu pourras revenir en arrière à tout moment.', ok: actif ? 'Activer' : 'Retirer', danger: !actif, motif: actif ? 'facultatif' : true }
    )
    if (!r) return
    setOccupe(m.id)
    try {
      await appeler('definir_module_etablissement', { p_etablissement_id: e.id, p_module_id: m.id, p_actif: actif })
      noterGeste(journalOperations(), { type: actif ? 'module_active' : 'module_retire', etablissement: e, motif: r.motif, detail: m.nom })
      await charger()
      await onFait(`${m.nom} ${actif ? 'activé' : 'retiré'}`)
    } catch (x) {
      setErreur(x.message)
    } finally {
      setOccupe('')
    }
  }
  const modules = (detail?.modules || []).filter((m) => m.nature !== 'socle')
  return (
    <Modal title={`Modules · ${e.nom}`} onClose={onFermer}>
      {erreur && <p className="pf-erreur" role="alert">{erreur}</p>}
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
                <input type="checkbox" checked={m.actif} disabled={!!occupe} onChange={(x) => basculer(m, x.target.checked)} aria-label={`${m.nom} ${m.actif ? 'activé' : 'désactivé'}`} />
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
          const ok = await envoyer(async () => {
            await appeler('definir_statut_licence', { p_licence_id: e.licence.id, p_statut: suspendre ? 'suspendue' : 'active', p_motif: motif })
            noterGeste(journalOperations(), { type: suspendre ? 'suspendre_licence' : 'reactiver_licence', etablissement: e, motif })
          }, suspendre ? 'Licence suspendue' : 'Licence réactivée')
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
          <div className="row">
            <BoutonCopier texte={mdp} />
            <BoutonCopier
              libelle="Copier le message"
              texte={`Bonjour${u.nom ? ` ${u.nom}` : ''},\n\nIdentifiant : ${u.identifiant || u.email}\nMot de passe provisoire : ${mdp}\n\nIl est valable 7 jours ; tu choisiras ton propre mot de passe à la connexion.`}
            />
            <button className="btn primary" onClick={onFermer}>
              Terminé
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            const ok = await envoyer(async () => {
              await appeler('reinitialiser_mot_de_passe_temporaire', { p_user_id: u.id, p_mot_de_passe_temporaire: mdp, p_expire_jours: 7 })
              noterGeste(journalOperations(), { type: 'mot_de_passe', detail: u.identifiant || u.email || u.id })
            }, 'Mot de passe réinitialisé')
            if (ok) setFait(true)
          }}
        >
          <p>Un mot de passe temporaire va remplacer l’actuel. La personne devra en choisir un nouveau.</p>
          <p className="small muted">L’ancien mot de passe cessera de fonctionner tout de suite.</p>
          <Pied occupe={occupe} erreur={erreur} onFermer={onFermer} ok="Réinitialiser" />
        </form>
      )}
    </Modal>
  )
}

// Déconnecter la plateforme sans quitter le CRM (ancienne boîte à outils, désormais dans l'espace Administration)
export function DeconnexionPlateforme() {
  const [connecte, setConnecte] = useState(false)
  useEffect(() => {
    let actif = true
    sessionValide().then((ok) => actif && setConnecte(ok), () => {})
    return () => {
      actif = false
    }
  }, [])
  if (!connecte) return null
  return (
    <div className="row" style={{ marginTop: 24 }}>
      <button
        className="btn sm"
        onClick={async () => {
          await deconnecter()
          oublierPlateforme()
          setConnecte(false)
        }}
      >
        <Icon n="logout" size={14} /> Déconnecter la plateforme
      </button>
    </div>
  )
}
