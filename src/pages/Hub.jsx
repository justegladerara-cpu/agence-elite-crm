// Hub Clients : prospects, nouveaux clients, clients actifs, anciens clients et perdus sur une seule page
import { useEffect, useMemo, useState } from 'react'
import { StageBadge, go, eur, nb, Menu, useTab } from '../ui'
import { useApp, useNoyau } from '../core/contexte'
import { Score, RelanceTag, ContactButtons } from '../modules/commercial/ui'
import { Icon } from '../icons'
import { NewProspect, ActionsGroupees, ACTION_ETAPE } from './Prospects'
import { QuickInsta } from './Insta'
import { AncienClient, nextOnboarding } from './Clients'
import { CATEGORIES, fichesHub } from '../modules/commercial/hub'
import { waLink } from '../lib/logic'
import { fmtDate } from '../lib/dates'

function lirePref(k, d) {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
function ecrirePref(k, v) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}

// Filtres gardés quand on ouvre une fiche puis qu'on revient
const memo = { q: '', canal: 'Tous', etape: 'Toutes', filtre: 'tous' }

const TRIS = [
  ['priorite', 'Priorité'],
  ['relance', 'Prochaine relance'],
  ['recent', 'Dernière action'],
  ['valeur', 'Valeur'],
  ['ajout', "Date d'ajout"],
  ['nom', 'Nom'],
]
const valeur = ({ p, c }) => (c ? c.total : Number(p.montantPropose) || 0)
const ORDRE = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]))
const COMPARE = {
  priorite: (a, b) => {
    if (a.c || b.c) return !!b.c?.alerte - !!a.c?.alerte || (b.c?.reste || 0) - (a.c?.reste || 0) || b.p.score - a.p.score
    return b.p.score - a.p.score
  },
  relance: (a, b) => (a.p.relance || '9999').localeCompare(b.p.relance || '9999'),
  recent: (a, b) => (b.p.derniereAction || '').localeCompare(a.p.derniereAction || ''),
  valeur: (a, b) => valeur(b) - valeur(a),
  ajout: (a, b) => (b.p.dateAjout || '').localeCompare(a.p.dateAjout || ''),
  nom: (a, b) => a.p.name.localeCompare(b.p.name, 'fr'),
}
const FILTRES_CLIENTS = [
  ['tous', 'Tous', () => true],
  ['encaisser', 'À encaisser', (c) => c.reste > 0],
  ['abonnes', 'Abonnés', (c) => c.abonnement > 0],
  ['alertes', 'À surveiller', (c) => !!c.alerte],
]
const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
const initiales = (n) =>
  String(n || '?')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0])
    .join('')
    .toUpperCase()
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Le hub Commercial a deux espaces : Acquisition (prospects en cours et perdus) et Clients (le portefeuille)
export const ESPACES = {
  acquisition: { cats: ['potentiels', 'perdus'], defaut: 'potentiels', memo: 'acquisition' },
  clients: { cats: ['nouveaux', 'actifs', 'anciens', 'tous'], defaut: 'actifs', memo: 'hub' },
}
export const espaceDe = (cat) => (ESPACES.acquisition.cats.includes(cat) ? 'acquisition' : 'clients')

export default function Hub({ espace: esp = 'clients', onglet: ongletDemande, etape: etapeDemandee, vue: vueDemandee, filtre: filtreDemande, nouveau, compte }) {
  const { data, settings, openAction, toast, saisirArgent } = useApp()
  const E = ESPACES[esp]
  const [ongletMemo, setOngletBrut] = useTab(E.memo, E.defaut, E.cats.includes(ongletDemande) ? ongletDemande : undefined)
  const onglet = E.cats.includes(ongletMemo) ? ongletMemo : E.defaut
  useState(() => {
    // Un lien (menu, tableau de bord) impose l'étape ou le filtre
    if (ongletDemande) memo.etape = etapeDemandee || 'Toutes'
    if (filtreDemande) memo.filtre = filtreDemande
  })
  const [q, setQBrut] = useState(memo.q)
  const [canal, setCanalBrut] = useState(memo.canal)
  const [etape, setEtapeBrut] = useState(memo.etape)
  const [filtre, setFiltreBrut] = useState(memo.filtre)
  const [tri, setTriBrut] = useState(() => lirePref('crm-hub-tri', 'priorite'))
  const [vue, setVueBrut] = useState(() => (vueDemandee === 'pipeline' || vueDemandee === 'liste' ? vueDemandee : lirePref('crm-view', 'liste')))
  const garder = (k, set) => (v) => {
    memo[k] = v
    set(v)
  }
  const setQ = garder('q', setQBrut)
  const setCanal = garder('canal', setCanalBrut)
  const setEtape = garder('etape', setEtapeBrut)
  const setFiltre = garder('filtre', setFiltreBrut)
  const setTri = (v) => {
    ecrirePref('crm-hub-tri', v)
    setTriBrut(v)
  }
  const setVue = (v) => {
    ecrirePref('crm-view', v)
    setVueBrut(v)
  }
  const [sel, setSel] = useState(() => new Set())
  const setOnglet = (v) => {
    setOngletBrut(v)
    setSel(new Set())
    setFiltre('tous')
  }
  // « Nouveau client » depuis la recherche globale : ouvre la fenêtre puis retire le paramètre de l'adresse
  const [modal, setModal] = useState(['client', 'fiche', 'insta'].includes(nouveau) ? nouveau : null)
  useEffect(() => {
    if (nouveau) window.history.replaceState(null, '', window.location.hash.replace(/[?&]nouveau=[^&]*/, '').replace(/[?&]compte=[^&]*/, '').replace(/\?$/, ''))
  }, [nouveau])
  const etapesOuvertes = settings.etapes.map((e) => e.nom).filter((e) => e !== 'Gagné' && e !== 'Perdu')
  const etapes = settings.etapes.map((e) => e.nom)

  const fiches = useMemo(() => fichesHub(data), [data])
  const parCat = useMemo(() => {
    const m = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]))
    fiches.forEach((x) => m[x.cat].push(x))
    // Dans l'espace Clients, « Tous » = tous les clients (les prospects sont dans Acquisition)
    m.tous = fiches.filter((x) => x.c)
    return m
  }, [fiches])

  // Indicateur de chaque carte
  const somme = (l, f) => l.reduce((m, x) => m + (f(x) || 0), 0)
  const indic = {
    potentiels: `${eur(somme(parCat.potentiels, (x) => Number(x.p.montantPropose)))} en jeu`,
    nouveaux: `${nb(parCat.nouveaux.filter((x) => x.c.onboarding < 1 && !x.c.nbInterventions).length)} en onboarding`,
    actifs: `${eur(somme(parCat.actifs, (x) => x.c.abonnement))}/mois`,
    anciens: 'à reconquérir',
    perdus: `${nb(parCat.perdus.filter((x) => x.p.alerte === 'À recontacter (perdu)').length)} à recontacter`,
    tous: pluriel(parCat.tous.length, 'client'),
  }

  // Liste filtrée
  const s = norm(q.trim()).replace(/^@/, '')
  const chiffres = s.replace(/\D/g, '')
  const estClients = ['nouveaux', 'actifs', 'anciens'].includes(onglet)
  const fx = FILTRES_CLIENTS.find(([k]) => k === filtre) || FILTRES_CLIENTS[0]
  const base = parCat[onglet] || []
  const liste = useMemo(
    () =>
      base
        .filter(({ p, c }) => {
          if (canal !== 'Tous' && p.canal !== canal) return false
          if (onglet === 'potentiels' && etape !== 'Toutes' && p.etape !== etape) return false
          if ((estClients || onglet === 'tous') && fx[0] !== 'tous' && !(c && fx[2](c))) return false
          if (!s) return true
          const f = p.fiche || {}
          if ([p.name, f.contact, f.ville, f.offre, f.secteur, f.instagram].some((v) => norm(v).includes(s))) return true
          return chiffres.length >= 3 && [f.telephone, f.whatsapp].some((v) => String(v || '').replace(/\D/g, '').includes(chiffres))
        })
        .sort((a, b) => (onglet === 'tous' ? ORDRE[a.cat] - ORDRE[b.cat] : 0) || (COMPARE[tri] || COMPARE.priorite)(a, b)),
    [base, canal, onglet, etape, estClients, fx, s, chiffres, tri],
  )
  const filtreActif = !!q || canal !== 'Tous' || (onglet === 'potentiels' && etape !== 'Toutes') || ((estClients || onglet === 'tous') && filtre !== 'tous') || tri !== 'priorite'
  const reinit = () => {
    setQ('')
    setCanal('Tous')
    setEtape('Toutes')
    setFiltre('tous')
    setTri('priorite')
  }

  // Sélection (prospects seulement)
  const cochables = liste.filter((x) => !x.c)
  const choisis = cochables.filter((x) => sel.has(x.p.id)).map((x) => x.p)
  const tousCoches = cochables.length > 0 && choisis.length === cochables.length
  const cocher = (id) =>
    setSel((x) => {
      const n = new Set(x)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Glisser-déposer du pipeline
  const [survol, setSurvol] = useState(null)
  const deplacer = (id, cible) => {
    const p = data.byId[id]
    if (!p || p.etape === cible) return
    const i = etapes.indexOf(cible)
    const action = ACTION_ETAPE[i]
    if (cible === 'Perdu' && p.niveau >= 7) return toast(`${p.name} est déjà client : pour l'arrêter, saisis plutôt une « Résiliation » dans sa fiche.`, true)
    if (!action || i === 0) return toast('Un prospect ne revient pas à « Nouveau » : annule plutôt ses étapes dans sa fiche.', true)
    if (cible !== 'Perdu' && p.etape !== 'Perdu' && i + 1 <= p.niveau) return toast(`${p.name} a déjà passé cette étape. Pour revenir en arrière, annule l'étape dans sa fiche.`, true)
    openAction({ prospect_id: p.id, action, canal: p.canal })
  }

  // Bandeau des onglets clients
  const clientsVus = liste.filter((x) => x.c).map((x) => x.c)
  const cat = CATEGORIES.find((c) => c.id === onglet) || CATEGORIES[0]

  return (
    <div className="hub">
      <div className="page-head">
        <div>
          <h1>{esp === 'acquisition' ? 'Prospects' : 'Clients'}</h1>
          <div className="sub">
            {esp === 'acquisition'
              ? 'Trouver et convertir : tes prospects du premier contact à la signature. Un prospect gagné passe tout seul dans Clients.'
              : 'Garder et faire grandir : onboarding, interventions, encaissements et fidélisation de tes clients.'}
          </div>
        </div>
        <div className="row head-actions">
          {esp === 'acquisition' ? (
            <>
              <button className="btn" onClick={() => setModal('fiche')}>
                <Icon n="note" size={15} /> Fiche complète
              </button>
              <button className="btn gold" onClick={() => setModal('insta')}>
                <Icon n="instagram" size={15} /> Prospect Instagram
              </button>
            </>
          ) : (
            <button className="btn gold" onClick={() => setModal('client')}>
              <Icon n="user-plus" size={15} /> Nouveau client
            </button>
          )}
        </div>
      </div>

      <div className="hub-cards" role="tablist" aria-label="Catégories">
        {E.cats.map((id, i) => {
          const c = CATEGORIES.find((x) => x.id === id)
          const suivant = CATEGORIES.find((x) => x.id === E.cats[i + 1])
          return <HubCarte key={id} c={id === 'tous' ? { ...c, label: 'Tous les clients' } : c} n={parCat[id].length} indic={indic[id]} on={onglet === id} lien={c.parcours && suivant?.parcours} onClick={() => setOnglet(id)} />
        })}
      </div>

      <div className="card flush hub-panel">
        <div className="hub-tools">
          <div className="hub-search">
            <Icon n="search" size={16} />
            <input
              className="input"
              placeholder="Rechercher : nom, contact, téléphone, ville, offre…"
              aria-label="Rechercher"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            />
            {q && (
              <button className="hub-clear" aria-label="Effacer la recherche" onClick={() => setQ('')}>
                <Icon n="x" size={14} />
              </button>
            )}
          </div>
          <select className="input" aria-label="Canal" value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="Tous">Tous les canaux</option>
            {settings.canaux.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select className="input" aria-label="Trier par" value={tri} onChange={(e) => setTri(e.target.value)}>
            {TRIS.map(([k, l]) => (
              <option key={k} value={k}>
                Tri : {l.toLowerCase()}
              </option>
            ))}
          </select>
          {filtreActif && (
            <button className="btn ghost" onClick={reinit}>
              <Icon n="rotate" size={14} /> Réinitialiser
            </button>
          )}
        </div>

        {onglet === 'potentiels' && (
          <div className="hub-sub">
            <div className="chips" role="group" aria-label="Étape">
              {['Toutes', ...etapesOuvertes].map((e) => {
                const n = e === 'Toutes' ? parCat.potentiels.length : parCat.potentiels.filter((x) => x.p.etape === e).length
                return (
                  <button key={e} className={`chip sm ${etape === e ? 'on' : ''}`} aria-pressed={etape === e} onClick={() => setEtape(e)}>
                    {e} <span className="chip-n">{n}</span>
                  </button>
                )
              })}
            </div>
            <div className="seg" role="group" aria-label="Affichage">
              <button className={vue === 'liste' ? 'on' : ''} aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
                <Icon n="list" size={14} /> Liste
              </button>
              <button className={vue === 'pipeline' ? 'on' : ''} aria-pressed={vue === 'pipeline'} onClick={() => setVue('pipeline')}>
                <Icon n="columns" size={14} /> Pipeline
              </button>
            </div>
          </div>
        )}

        {(estClients || onglet === 'tous') && (
          <div className="hub-sub">
            <div className="chips" role="group" aria-label="Filtre clients">
              {FILTRES_CLIENTS.map(([k, l, f]) => {
                const n = k === 'tous' ? null : base.filter((x) => x.c && f(x.c)).length
                return (
                  <button key={k} className={`chip sm ${filtre === k ? 'on' : ''}`} aria-pressed={filtre === k} onClick={() => setFiltre(k)}>
                    {l}
                    {n !== null && <span className="chip-n">{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {estClients && (
          <div className="hub-strip">
            {[
              ['Total signé', eur(somme(clientsVus, (c) => c.total))],
              ['Encaissé', eur(somme(clientsVus, (c) => c.encaisse))],
              ['Reste à encaisser', eur(somme(clientsVus, (c) => c.reste)), somme(clientsVus, (c) => c.reste) > 0 ? 'red' : ''],
              ['Revenu récurrent', `${eur(somme(clientsVus.filter((c) => c.statut === 'Actif'), (c) => c.abonnement))}/mois`],
            ].map(([k, v, cls]) => (
              <div key={k}>
                <div className="k">{k}</div>
                <div className={`v ${cls || ''}`}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {onglet === 'potentiels' && vue === 'pipeline' ? (
          <Pipeline
            colonnes={etapesOuvertes}
            fiches={liste}
            survol={survol}
            setSurvol={setSurvol}
            deplacer={deplacer}
            etapes={etapes}
          />
        ) : liste.length === 0 ? (
          <Vide onglet={onglet} filtre={filtreActif} reinit={reinit} ouvrir={setModal} n={base.length} />
        ) : (
          <div className="hub-list">
            {cochables.length > 0 && (
              <div className="hub-head">
                <label className="hub-check">
                  <input type="checkbox" aria-label="Tout sélectionner" checked={tousCoches} ref={(el) => el && (el.indeterminate = choisis.length > 0 && !tousCoches)} onChange={() => setSel(tousCoches ? new Set() : new Set(cochables.map((x) => x.p.id)))} />
                </label>
                <span>
                  {pluriel(liste.length, esp === 'clients' ? 'client' : 'prospect')}
                  {filtreActif && base.length !== liste.length ? ` sur ${base.length}` : ''}
                </span>
              </div>
            )}
            {cochables.length === 0 && (
              <div className="hub-head">
                <span>
                  {pluriel(liste.length, estClients ? 'client' : 'fiche')}
                  {filtreActif && base.length !== liste.length ? ` sur ${base.length}` : ''}
                </span>
              </div>
            )}
            <div role="list" className="hub-rows">
              {liste.map((x) =>
                x.c ? (
                  <LigneClient key={x.p.id} x={x} onPay={() => saisirArgent({ type: 'paiement', prefill: { prospect_id: x.p.id, montant: x.c.reste ? String(x.c.reste) : '' } })} />
                ) : (
                  <LigneProspect key={x.p.id} p={x.p} coche={sel.has(x.p.id)} cocher={() => cocher(x.p.id)} montrerCat={onglet === 'tous'} />
                ),
              )}
            </div>
            {choisis.length > 0 && (
              <>
                <div className="bulk-space" />
                <ActionsGroupees choisis={choisis} etapes={etapes} vider={() => setSel(new Set())} />
              </>
            )}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite">
        {cat.label} : {pluriel(liste.length, 'résultat')}
      </div>

      {modal === 'insta' && <QuickInsta compte={compte} onClose={() => setModal(null)} />}
      {modal === 'fiche' && <NewProspect onClose={() => setModal(null)} />}
      {modal === 'client' && <AncienClient onClose={() => setModal(null)} />}
    </div>
  )
}

function HubCarte({ c, n, indic, on, lien, onClick }) {
  return (
    <button type="button" role="tab" aria-selected={on} className={`hub-card ${on ? 'on' : ''} ${c.parcours ? 'parcours' : ''}`} style={{ '--c': c.couleur }} onClick={onClick}>
      <span className="hc-top">
        <span className="hc-ic">
          <Icon n={c.ico} size={15} />
        </span>
        <span className="hc-l">{c.label}</span>
      </span>
      <span className="hc-n">{nb(n)}</span>
      <span className="hc-i">{indic}</span>
      {lien && (
        <span className="hc-link" aria-hidden="true">
          <Icon n="chevron" size={12} />
        </span>
      )}
    </button>
  )
}

// Ligne prospect : score, étape, relance, montant proposé, contacts et « + Action »
function LigneProspect({ p, coche, cocher, montrerCat }) {
  const { openAction } = useNoyau()
  const alerte = p.alerte && !p.alerte.startsWith('Relance') ? p.alerte : ''
  return (
    <div role="listitem" className={`hub-row prospect ${coche ? 'sel' : ''}`} onClick={() => go(`/prospect/${p.id}`)}>
      <label className="hub-check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={coche} onChange={cocher} />
      </label>
      <Score v={p.score} />
      <div className="hr-main">
        <a className="hr-name" href={`#/prospect/${p.id}`} onClick={(e) => e.stopPropagation()}>
          {p.name}
        </a>
        <div className="hr-sub">
          <span className="hr-sub-t" title={[p.fiche?.contact, p.fiche?.secteur, p.fiche?.ville].filter(Boolean).join(' · ') || undefined}>
            {[p.fiche?.contact, p.fiche?.secteur, p.fiche?.ville].filter(Boolean).join(' · ') || 'Fiche à compléter'}
          </span>
          {alerte && (
            <span className="hr-alert">
              <Icon n="alert-circle" size={12} /> {alerte}
            </span>
          )}
        </div>
      </div>
      <div className="hr-tags">
        {montrerCat && p.etape === 'Perdu' ? <span className="badge b-Perdu">Perdu</span> : <StageBadge etape={p.etape} />}
        {p.relance ? <RelanceTag date={p.relance} heure={p.heureRappel} /> : <span className="hr-none">Pas de relance</span>}
      </div>
      <div className={`hr-money ${p.montantPropose ? '' : 'vide'}`}>
        <span className="k">Proposé</span>
        <span className="v">{p.montantPropose ? eur(p.montantPropose) : '—'}</span>
      </div>
      <div className="hr-actions" onClick={(e) => e.stopPropagation()}>
        <ContactButtons p={p} compact />
        <button className="btn sm" onClick={() => openAction({ prospect_id: p.id, canal: p.canal })}>
          <Icon n="plus" size={14} /> Action
        </button>
      </div>
    </div>
  )
}

const BADGE_CAT = { nouveaux: ['Nouveau client', 'b-gold'], actifs: ['Client actif', 'b-green'], anciens: ['Ancien client', 'b-Perdu'] }
const TON_PAIEMENT = { Payé: 'b-green', 'En retard': 'b-red', Partiel: 'b-orange', 'En attente': 'b-gold' }

// Ligne client : montants, paiement, onboarding, « + Paiement » et « + Suivi »
function LigneClient({ x, onPay }) {
  const { openAction, settings } = useNoyau()
  const { p, c, cat } = x
  const [lib, ton] = BADGE_CAT[cat] || BADGE_CAT.actifs
  const ancien = cat === 'anciens'
  const suivi = c.onboarding < 1 && !c.nbInterventions ? nextOnboarding(c) : 'Échange / suivi'
  const wa = waLink(p.fiche?.whatsapp || p.fiche?.telephone, settings.clients.indicatifWhatsApp)
  return (
    <div role="listitem" className="hub-row client" onClick={() => go(`/prospect/${p.id}`)}>
      <span className="hr-avatar" style={{ '--c': (CATEGORIES.find((k) => k.id === cat) || CATEGORIES[2]).couleur }} aria-hidden="true">
        {initiales(p.name)}
      </span>
      <div className="hr-main">
        <a className="hr-name" href={`#/prospect/${p.id}`} onClick={(e) => e.stopPropagation()}>
          {p.name}
        </a>
        <div className="hr-sub">
          <span className="hr-sub-t">{[p.fiche?.contact, p.fiche?.offre, p.dateSignature && `client depuis le ${fmtDate(p.dateSignature)}`].filter(Boolean).join(' · ')}</span>
          {c.alerte && (
            <span className="hr-alert">
              <Icon n="alert-circle" size={12} /> {c.alerte}
            </span>
          )}
        </div>
        {!ancien && c.onboarding < 1 && !c.nbInterventions && (
          <div className="hr-onb" title={`Onboarding ${Math.round(c.onboarding * 100)} %`}>
            <span className="bar">
              <span style={{ width: `${Math.round(c.onboarding * 100)}%` }} />
            </span>
            <span>Onboarding {Math.round(c.onboarding * 100)} %</span>
          </div>
        )}
      </div>
      <div className="hr-tags">
        <span className={`badge ${ton}`}>{lib}</span>
        {c.statutPaiement && <span className={`badge ${TON_PAIEMENT[c.statutPaiement] || ''}`}>{c.statutPaiement}</span>}
      </div>
      <div className="hr-nums">
        <div>
          <span className="k">Signé</span>
          <span className="v">{eur(c.total)}</span>
        </div>
        <div>
          <span className="k">Encaissé</span>
          <span className="v">{eur(c.encaisse)}</span>
        </div>
        <div>
          <span className="k">Reste</span>
          <span className={`v ${c.reste > 0 ? 'red' : ''}`}>{c.reste > 0 ? eur(c.reste) : '—'}</span>
        </div>
        <div>
          <span className="k">Abonnement</span>
          <span className="v">{c.abonnement ? `${eur(c.abonnement)}/mois` : '—'}</span>
        </div>
      </div>
      <div className="hr-actions" onClick={(e) => e.stopPropagation()}>
        {ancien ? (
          <button className="btn sm" onClick={() => openAction({ prospect_id: p.id, action: 'Relance', canal: 'Appel' })}>
            <Icon n="repeat" size={14} /> Relancer
          </button>
        ) : (
          <>
            <button className="btn sm" onClick={onPay}>
              <Icon n="coins" size={14} /> Paiement
            </button>
            <button className="btn sm" onClick={() => openAction({ prospect_id: p.id, action: suivi })}>
              <Icon n="plus" size={14} /> Suivi
            </button>
          </>
        )}
        <Menu
          label=""
          icon="more"
          className="icon-btn"
          ariaLabel={`Plus d'actions pour ${p.name}`}
          items={[
            { label: 'Nouvelle facture', icon: 'file', onClick: () => go(`/facture/new?type=facture&p=${p.id}`) },
            { label: 'Nouveau devis', icon: 'clipboard', onClick: () => go(`/facture/new?type=devis&p=${p.id}`) },
            '-',
            { label: 'Saisir une intervention', icon: 'bolt', onClick: () => openAction({ prospect_id: p.id, action: 'Intervention', canal: 'Appel' }) },
            { label: 'Autre action', icon: 'plus', onClick: () => openAction({ prospect_id: p.id }) },
            '-',
            p.fiche?.telephone && { label: 'Appeler', icon: 'phone', onClick: () => (window.location.href = `tel:${p.fiche.telephone.replace(/\s/g, '')}`) },
            wa && { label: 'WhatsApp', icon: 'message', onClick: () => window.open(wa, '_blank') },
            { label: 'Ouvrir la fiche', icon: 'eye', onClick: () => go(`/prospect/${p.id}`) },
          ]}
        />
      </div>
    </div>
  )
}

// Pipeline des potentiels : une colonne par étape ouverte, plus deux zones pour signer ou perdre
function Pipeline({ colonnes, fiches, survol, setSurvol, deplacer, etapes }) {
  const zone = (e) => ({
    onDragOver: (ev) => {
      ev.preventDefault()
      if (survol !== e) setSurvol(e)
    },
    onDragLeave: (ev) => !ev.currentTarget.contains(ev.relatedTarget) && setSurvol(null),
    onDrop: (ev) => {
      ev.preventDefault()
      setSurvol(null)
      deplacer(ev.dataTransfer.getData('text/plain'), e)
    },
  })
  return (
    <>
      <div className="hub-hint">
        <Icon n="info" size={14} /> Glisse une carte vers une autre colonne (ou utilise son menu) pour saisir l'étape correspondante.
      </div>
      <div className="kanban">
        {colonnes.map((e) => {
          const col = fiches.filter((x) => x.p.etape === e).map((x) => x.p)
          const total = col.reduce((m, p) => m + (Number(p.montantPropose) || 0), 0)
          return (
            <div className={`kanban-col ${survol === e ? 'drop' : ''}`} key={e} {...zone(e)}>
              <h3>
                <span>{e}</span>
                <span className="kc-n">
                  {col.length}
                  {total ? ` · ${eur(total)}` : ''}
                </span>
              </h3>
              {col.length === 0 && <div className="kc-empty">Aucun prospect</div>}
              {col.slice(0, 60).map((p) => (
                <div
                  className="kcard"
                  key={p.id}
                  draggable
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === 'Enter' && go(`/prospect/${p.id}`)}
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData('text/plain', p.id)
                    ev.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => go(`/prospect/${p.id}`)}
                >
                  <div className="kc-top">
                    <b className="ell">{p.name}</b>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }} onClick={(ev) => ev.stopPropagation()}>
                      <Score v={p.score} />
                      <Menu
                        label=""
                        icon="more"
                        className="icon-btn kmove"
                        ariaLabel={`Changer l'étape de ${p.name}`}
                        items={etapes.filter((x) => x !== e && x !== 'Nouveau').map((x) => ({ label: x === 'Gagné' ? 'Signer (passe en client)' : `Passer à « ${x} »`, onClick: () => deplacer(p.id, x) }))}
                      />
                    </div>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {[p.fiche?.contact, p.canal].filter(Boolean).join(' · ')}
                    {p.montantPropose ? ` · ${eur(p.montantPropose)}` : ''}
                  </div>
                  {(p.relance || (p.alerte && !p.alerte.startsWith('Relance'))) && (
                    <div className="row" style={{ marginTop: 6, gap: 4 }}>
                      <RelanceTag date={p.relance} />
                      {p.alerte && !p.alerte.startsWith('Relance') && <span className="badge b-orange">{p.alerte}</span>}
                    </div>
                  )}
                </div>
              ))}
              {col.length > 60 && <div className="tiny muted">+ {col.length - 60} autres</div>}
            </div>
          )
        })}
        <div className="kanban-drops">
          {[
            ['Gagné', 'Signé', 'Dépose ici pour saisir la signature : le prospect passe en client.', 'check-circle'],
            ['Perdu', 'Perdu', 'Dépose ici pour noter la perte.', 'ban'],
          ].map(([e, l, t, ico]) => (
            <div key={e} className={`kanban-drop ${e === 'Gagné' ? 'win' : 'lost'} ${survol === e ? 'drop' : ''}`} {...zone(e)}>
              <Icon n={ico} size={18} />
              <b>{l}</b>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// États vides : un message utile et le bon bouton
function Vide({ onglet, filtre, reinit, ouvrir, n }) {
  if (filtre && n > 0)
    return (
      <div className="hub-empty">
        <Icon n="search" size={22} />
        <b>Aucune fiche ne correspond à ces filtres.</b>
        <button className="btn" onClick={reinit}>
          <Icon n="rotate" size={14} /> Réinitialiser les filtres
        </button>
      </div>
    )
  const T = {
    potentiels: ['Aucun prospect en cours.', 'Ajoute un compte Instagram repéré ou une fiche complète pour lancer la prospection.', 'Ajouter un prospect Instagram', 'insta'],
    nouveaux: ['Aucun nouveau client ces 90 derniers jours.', 'Un prospect passe ici dès que tu saisis sa signature ou une première intervention.', 'Ajouter un client', 'client'],
    actifs: ['Aucun client actif depuis plus de 90 jours.', 'Tes nouveaux clients arrivent ici automatiquement après 90 jours.', 'Ajouter un client existant', 'client'],
    anciens: ['Aucun ancien client.', 'Les clients qui ont résilié apparaissent ici, pour les reconquérir plus tard.', null],
    perdus: ['Aucun prospect perdu.', 'Les prospects notés « Perdu » arrivent ici avec leur date pour les recontacter.', null],
    tous: ['Aucun client pour le moment.', 'Un prospect devient client dès que tu saisis sa signature, ou ajoute un client existant.', 'Ajouter un client', 'client'],
  }[onglet]
  return (
    <div className="hub-empty">
      <Icon n="users" size={22} />
      <b>{T[0]}</b>
      <span>{T[1]}</span>
      {T[2] && (
        <button className="btn gold" onClick={() => ouvrir(T[3])}>
          <Icon n="plus" size={14} /> {T[2]}
        </button>
      )}
    </div>
  )
}
