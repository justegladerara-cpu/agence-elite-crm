// Tableau de bord : le centre de commande de l'agence. Argent reçu, objectif du mois, services, clients,
// prospection, carte du Congo, logiciel de caisse, abonnements. Tout se calcule seul ; un clic ouvre le détail
// dans un panneau à droite, sans quitter la page.
import { Suspense, lazy, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import { eur, nb, pct, go, court, useCouche } from '../ui'
import { ChiffreAnime } from '../animations'
import { useNoyau, useDonnees } from '../core/contexte'
import { today, addDays, diffDays, fmtDate } from '../lib/dates'
import { waLink } from '../lib/logic'
import { chargesFixesMois, echeancesEntre } from '../lib/tresorerie'
import { totals, statutDe, num } from '../modules/facturation'
import {
  PERIODES_TB,
  periodeTB,
  paiementsDetailles,
  recuParService,
  classementClients,
  courbe,
  objectifMois,
  prospection,
  parVille,
  aCompleter,
  activitesDe,
  activiteParId,
  lignesVentes,
  statsClients,
  clientsARelancer,
  VILLES,
  CONTOUR_CONGO,
  norm,
} from '../modules/activites'
import { telechargerRecu } from './Encaisser'

const ResumeLogiciel = lazy(() => import('./Plateforme').then((m) => ({ default: m.ResumeLogiciel })))

const lire = (k, d) => {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
const ecrire = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // appareil sans stockage
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
const evo = (cur, avant) => (avant > 0 ? (cur - avant) / avant : cur > 0 ? null : 0)

// ---------- Panneau de détail (à droite) ----------
function Panneau({ titre, sous, onClose, children }) {
  useCouche(true, onClose)
  return createPortal(
    <div className="tb-voile" onClick={onClose}>
      <aside className="tb-panneau" role="dialog" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2>{titre}</h2>
            {sous && <p className="small muted">{sous}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            <Icon n="x" size={18} />
          </button>
        </header>
        <div className="tb-panneau-corps">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}

// ---------- Graphiques ----------
function Courbe({ points, hauteur = 120 }) {
  const W = 600
  const H = hauteur
  const max = Math.max(1, ...points.map((p) => Math.max(p.v, p.avant)))
  const x = (i) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W)
  const y = (v) => H - 6 - (v / max) * (H - 16)
  const ligne = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')
  const aire = `${ligne('v')} L${x(points.length - 1)},${H} L0,${H} Z`
  return (
    <svg className="tb-courbe" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Argent reçu jour par jour">
      <defs>
        <linearGradient id="tbDegrade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={ligne('avant')} className="tb-courbe-avant" />
      <path d={aire} fill="url(#tbDegrade)" />
      <path d={ligne('v')} className="tb-courbe-ligne" />
      {points.map((p, i) =>
        p.v > 0 ? (
          <circle key={i} cx={x(i)} cy={y(p.v)} r="3.5" className="tb-courbe-point">
            <title>{`${fmtDate(p.date)} : ${eur(p.v)}`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  )
}

function Donut({ parts, total, onPick }) {
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <svg viewBox="0 0 140 140" className="tb-donut" role="img" aria-label="Argent reçu par service">
      <circle cx="70" cy="70" r={R} className="tb-donut-fond" />
      {parts.map((p) => {
        const part = total ? p.total / total : 0
        const el = (
          <circle
            key={p.id}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={p.couleur}
            strokeWidth="18"
            strokeDasharray={`${Math.max(0, part * C - 2)} ${C}`}
            strokeDashoffset={-acc * C}
            transform="rotate(-90 70 70)"
            className="tb-donut-part"
            onClick={() => onPick?.(p)}
          >
            <title>{`${p.nom} : ${eur(p.total)} (${pct(part)})`}</title>
          </circle>
        )
        acc += part
        return el
      })}
      <text x="70" y="66" textAnchor="middle" className="tb-donut-v">
        {court(total)}
      </text>
      <text x="70" y="84" textAnchor="middle" className="tb-donut-l">
        reçus
      </text>
    </svg>
  )
}

function Jauge({ part, taille = 150, epaisseur = 14, children }) {
  const R = (taille - epaisseur) / 2
  const C = 2 * Math.PI * R
  const v = Math.max(0, Math.min(1, part))
  return (
    <div className="tb-jauge" style={{ width: taille, height: taille }}>
      <svg viewBox={`0 0 ${taille} ${taille}`}>
        <circle cx={taille / 2} cy={taille / 2} r={R} className="tb-jauge-fond" strokeWidth={epaisseur} />
        <circle cx={taille / 2} cy={taille / 2} r={R} className="tb-jauge-val" strokeWidth={epaisseur} strokeDasharray={`${v * C} ${C}`} transform={`rotate(-90 ${taille / 2} ${taille / 2})`} />
      </svg>
      <div className="tb-jauge-centre">{children}</div>
    </div>
  )
}

function Carte({ prospects, clientsIds }) {
  const { villes, sans } = parVille(prospects, clientsIds)
  const W = 260
  const H = 300
  const px = (lon) => ((lon - 10.9) / (18.9 - 10.9)) * W
  const py = (lat) => ((3.9 - lat) / (3.9 + 5.2)) * H
  const contour = CONTOUR_CONGO.map(([lo, la], i) => `${i ? 'L' : 'M'}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' ') + ' Z'
  const max = Math.max(1, ...villes.map((v) => v.clients + v.prospects))
  const [sel, setSel] = useState(null)
  return (
    <div className="tb-congo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carte du Congo : clients et prospects par ville">
        <path d={contour} className="tb-congo-pays" />
        {VILLES.map(([nom, lo, la]) => {
          const v = villes.find((x) => x.ville === nom)
          const n = v ? v.clients + v.prospects : 0
          const r = n ? 5 + (n / max) * 14 : 2.2
          return (
            <g key={nom} className={`tb-ville ${n ? 'pleine' : ''} ${sel === nom ? 'on' : ''}`} onClick={() => setSel(sel === nom ? null : nom)}>
              {n > 0 && <circle cx={px(lo)} cy={py(la)} r={r + 6} className="tb-ville-halo" />}
              <circle cx={px(lo)} cy={py(la)} r={r} className={v?.clients ? 'client' : 'prospect'} />
              {(n > 0 || ['Brazzaville', 'Pointe-Noire'].includes(nom)) && (
                <text x={px(lo) + r + 4} y={py(la) + 4}>
                  {nom}
                  {n ? ` · ${n}` : ''}
                </text>
              )}
              <title>{v ? `${nom} : ${v.clients} client(s), ${v.prospects} prospect(s)` : `${nom} : personne pour l’instant`}</title>
            </g>
          )
        })}
      </svg>
      <div className="tb-congo-leg">
        <span>
          <i className="client" /> Clients
        </span>
        <span>
          <i className="prospect" /> Prospects
        </span>
        {sans > 0 && <span className="muted">{nb(sans)} fiche(s) sans ville</span>}
      </div>
      {sel && (
        <p className="small">
          <strong>{sel}</strong> : {(() => {
            const v = villes.find((x) => x.ville === sel)
            return v ? `${v.clients} client(s), ${v.prospects} prospect(s).` : 'personne pour l’instant. Une ville à prospecter ?'
          })()}
        </p>
      )}
    </div>
  )
}

// ---------- Page ----------
export default function Pilotage() {
  const { settings, ouvrir } = useNoyau()
  const { documents = [], actions = [], data } = useDonnees()
  const [choix, setChoix] = useState(() => lire('aecrm-tb-periode', '30j'))
  const [libre, setLibre] = useState({ debut: addDays(today(), -29), fin: today() })
  const [panneau, setPanneau] = useState(null)
  const changer = (c) => {
    setChoix(c)
    ecrire('aecrm-tb-periode', c)
  }
  const t = today()
  const p = periodeTB(choix, t, libre)
  const objectif = Number(settings.objectifEncaisse) || 1500000

  const paiements = useMemo(() => paiementsDetailles(actions, documents, data.list, settings), [actions, documents, data.list, settings])
  const dansP = paiements.filter((x) => x.date >= p.debut && x.date <= p.fin)
  const recu = dansP.reduce((m, x) => m + x.montant, 0)
  const recuAvant = paiements.filter((x) => x.date >= p.avantDebut && x.date <= p.avantFin).reduce((m, x) => m + x.montant, 0)
  const payeurs = new Set(dansP.map((x) => x.prospectId || x.client)).size
  const obj = objectifMois(paiements, objectif, t)
  const services = recuParService(paiements, settings, p)
  const top = classementClients(paiements, p, 6)
  const { points } = courbe(paiements, p)
  const pros = prospection(actions, data.list, p, t)
  const panier = paiements.length ? paiements.reduce((m, x) => m + x.montant, 0) / paiements.length : 100000
  const clientsIds = useMemo(() => new Set(data.clients.map((c) => c.id)), [data.clients])
  const manque = aCompleter(paiements, data.list)

  // Ce qui reste à recevoir : factures pas payées (avec le client et le retard)
  const ouvertes = documents
    .filter((d) => d.type === 'facture' && !d.data?.annulee && !d.data?.demo)
    .map((d) => {
      const statut = statutDe(d, actions)
      const paye = actions.filter((a) => a.action === 'Paiement reçu' && a.facture === d.numero).reduce((m, a) => m + num(a.montant), 0)
      return { d, statut, reste: Math.max(0, totals(d.data || {}).total - paye), client: data.byId[d.prospect_id]?.name || d.data?.client?.nom || 'Client' }
    })
    .filter((x) => x.reste > 0 && !['Payée', 'Annulée'].includes(x.statut))
    .sort((a, b) => b.reste - a.reste)
  const aRecevoir = ouvertes.reduce((m, x) => m + x.reste, 0)
  const devis = documents
    .filter((d) => d.type === 'devis' && statutDe(d, actions) === 'En attente')
    .map((d) => ({ d, total: totals(d.data || {}).total, client: data.byId[d.prospect_id]?.name || d.data?.client?.nom || 'Client', age: diffDays(t, d.data?.date || t) }))
    .sort((a, b) => b.total - a.total)

  // Abonnements : les 30 prochains jours, et le total par mois (seulement ceux que tu as confirmés)
  const abos = echeancesEntre(settings.depensesFixes, t, addDays(t, 30))
  const abosMois = chargesFixesMois(settings.depensesFixes)

  // ---------- À faire maintenant : 3 grandes tuiles, classées par argent en jeu ----------
  const lignes = useMemo(() => lignesVentes(documents, actions, data.list, settings), [documents, actions, data.list, settings])
  const aRelancer = useMemo(() => clientsARelancer(statsClients(lignes, t), settings, { t }), [lignes, settings, t])
  const effet = (montant) => (obj.manque > 0 ? `${pct(Math.min(1, montant / obj.manque))} de ce qui manque pour l’objectif du mois` : 'objectif du mois déjà atteint : c’est du bonus')
  const indicatif = settings.clients?.indicatifWhatsApp || '242'
  const telDe = (pid) => data.byId[pid]?.fiche?.telephone || data.byId[pid]?.fiche?.whatsapp
  const taches = []
  const retard = ouvertes.filter((x) => x.statut === 'En retard')
  for (const x of (retard.length ? retard : ouvertes).slice(0, 2)) {
    const tel = telDe(x.d.prospect_id)
    taches.push({
      ton: x.statut === 'En retard' ? 'rouge' : 'orange',
      titre: `Encaisse ${eur(x.reste)} de ${x.client}`,
      pourquoi: `Facture ${x.d.numero}${x.statut === 'En retard' ? ' en retard' : ' pas encore payée'}. C’est de l’argent déjà gagné : il suffit de le récupérer.`,
      enJeu: x.reste,
      effet: effet(x.reste),
      boutons: [
        { l: 'Encaisser', primaire: true, run: () => ouvrir('encaisser', { prospect_id: x.d.prospect_id, facture: x.d.numero, montant: x.reste }) },
        tel && { l: 'Rappel WhatsApp', href: `${waLink(tel, indicatif)}?text=${encodeURIComponent(`Bonjour, petit rappel pour la facture ${x.d.numero} (${eur(x.reste)}). Merci !`)}` },
      ].filter(Boolean),
    })
  }
  for (const x of devis.filter((d) => d.age >= 3).slice(0, 2)) {
    const tel = telDe(x.d.prospect_id)
    taches.push({
      ton: 'orange',
      titre: `Relance le devis de ${x.client}`,
      pourquoi: `Devis ${x.d.numero} de ${eur(x.total)} sans réponse depuis ${x.age} jours. Pour : un client relancé signe plus souvent. Contre : trop attendre le refroidit.`,
      enJeu: x.total,
      effet: effet(x.total),
      boutons: [
        tel ? { l: 'Relancer sur WhatsApp', primaire: true, href: `${waLink(tel, indicatif)}?text=${encodeURIComponent(`Bonjour, je reviens vers vous pour le devis ${x.d.numero}. Avez-vous pu le regarder ? Je peux l’ajuster si besoin.`)}` } : { l: 'Ouvrir la fiche', primaire: true, run: () => go(`/prospect/${x.d.prospect_id}`) },
      ],
    })
  }
  const objDmSemaine = (Number(settings.objectifsJour?.dm) || 50) * 5
  if (pros.dmSemaine < objDmSemaine) {
    const n = Math.min(50, Math.max(20, objDmSemaine - pros.dmSemaine))
    const tr = pros.tauxReponse ?? 0.1
    const ts = pros.tauxSignature ?? 0.02
    const reponses = Math.max(1, Math.round(n * tr))
    const clients = n * ts
    taches.push({
      ton: 'bleu',
      titre: `Envoie ${n} DM aujourd’hui`,
      pourquoi: `${pros.dmSemaine} DM cette semaine sur ${objDmSemaine}. Avec tes résultats (${pct(tr)} de réponses), ${n} DM donnent environ ${reponses} réponse(s) et ${clients >= 1 ? `${Math.round(clients)} client(s)` : 'un client tous les ' + Math.max(1, Math.round(1 / Math.max(ts * n, 0.01))) + ' jours'}. Pas le temps ? Confie les DM à quelqu’un de l’équipe.`,
      enJeu: Math.round(clients * panier),
      effet: effet(Math.round(clients * panier)),
      boutons: [
        { l: 'Noter mes DM', primaire: true, run: () => ouvrir('dm') },
        { l: 'Déléguer les DM', run: () => go('/equipe') },
      ],
    })
  }
  for (const x of aRelancer.slice(0, 1)) {
    taches.push({
      ton: 'vert',
      titre: `Recontacte ${x.client.nom}`,
      pourquoi: `${x.raison}. Message prêt : « ${x.message.slice(0, 110)}… »`,
      enJeu: x.potentiel,
      effet: effet(x.potentiel),
      boutons: [{ l: 'Voir le message', primaire: true, run: () => go('/relances') }],
    })
  }
  const faire = taches.sort((a, b) => b.enJeu - a.enJeu).slice(0, 3)

  const sousTitre = (() => {
    if (obj.part >= 1) return `Objectif du mois atteint : ${eur(obj.recu)} reçus. Bravo.`
    if (!obj.recu) return `Objectif du mois : ${eur(objectif)}. Note chaque argent reçu avec « Encaisser ».`
    return `Ce mois-ci : ${eur(obj.recu)} reçus sur ${eur(objectif)}. Il manque ${eur(obj.manque)}, soit ${eur(obj.parJour)} par jour.`
  })()

  const ouvrirPaiements = (filtre = {}) => setPanneau({ type: 'recu', ...filtre })

  return (
    <div className="tb">
      <div className="tb-tete">
        <div>
          <h1>Tableau de bord</h1>
          <p className="tb-phrase">{sousTitre}</p>
        </div>
        <div className="tb-actions">
          <div className="pl-periodes" role="group" aria-label="Période">
            {PERIODES_TB.map(([k, l]) => (
              <button key={k} type="button" className={choix === k ? 'on' : ''} aria-pressed={choix === k} onClick={() => changer(k)}>
                {l}
              </button>
            ))}
            <button type="button" className={choix === 'libre' ? 'on' : ''} aria-pressed={choix === 'libre'} onClick={() => changer('libre')}>
              Dates
            </button>
          </div>
          {choix === 'libre' && (
            <div className="tb-dates">
              <input type="date" className="input" aria-label="Du" value={libre.debut} max={libre.fin} onChange={(e) => e.target.value && setLibre((l) => ({ ...l, debut: e.target.value }))} />
              <input type="date" className="input" aria-label="Au" value={libre.fin} min={libre.debut} onChange={(e) => e.target.value && setLibre((l) => ({ ...l, fin: e.target.value }))} />
            </div>
          )}
          <button type="button" className="btn ghost" onClick={() => setPanneau({ type: 'objectifs' })}>
            <Icon n="target" size={15} /> Objectifs
          </button>
          <button type="button" className="btn primary" onClick={() => ouvrir('encaisser')}>
            <Icon n="coins" size={15} /> Encaisser
          </button>
        </div>
      </div>

      {/* Ligne 1 : l'argent reçu et l'objectif du mois */}
      <div className="tb-haut">
        <button type="button" className="tb-hero" onClick={() => ouvrirPaiements()}>
          <div className="tb-hero-tete">
            <span className="tb-hero-l">Argent reçu {p.nom}</span>
            <Evolution v={evo(recu, recuAvant)} />
          </div>
          <div className="tb-hero-v">
            <ChiffreAnime valeur={eur(recu)} />
          </div>
          <div className="tb-hero-s">
            {nb(dansP.length)} paiement(s) de {nb(payeurs)} client(s) · période d’avant : {eur(recuAvant)}
          </div>
          <Courbe points={points} />
          <span className="tb-hero-lien">
            Voir chaque paiement <Icon n="arrow-right" size={13} />
          </span>
        </button>
        <div className="tb-objectif">
          <Jauge part={obj.part}>
            <strong>{pct(obj.part)}</strong>
            <span>de l’objectif</span>
          </Jauge>
          <div className="tb-objectif-txt">
            <span className="tb-mini-l">Objectif du mois</span>
            <strong className="tb-gros">{eur(objectif)}</strong>
            <span className="small">Reçu : {eur(obj.recu)}</span>
            <span className="small">À ce rythme : {eur(obj.projection)} en fin de mois</span>
            {obj.manque > 0 && <span className="small muted">Il faut {eur(obj.parJour)} par jour pendant {obj.resteJours} j</span>}
          </div>
        </div>
      </div>

      {/* Ligne 2 : petits chiffres cliquables */}
      <div className="tb-chiffres">
        <button type="button" className="tb-chiffre" onClick={() => setPanneau({ type: 'arecevoir' })}>
          <span className="tb-mini-l">À recevoir</span>
          <strong>{eur(aRecevoir)}</strong>
          <span className="tiny muted">{ouvertes.length} facture(s) pas encore payée(s)</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => setPanneau({ type: 'devis' })}>
          <span className="tb-mini-l">Devis en attente</span>
          <strong>{eur(devis.reduce((m, x) => m + x.total, 0))}</strong>
          <span className="tiny muted">{devis.length} devis sans réponse</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => setPanneau({ type: 'prospection' })}>
          <span className="tb-mini-l">DM cette semaine</span>
          <strong>
            {nb(pros.dmSemaine)} <small>/ {nb(objDmSemaine)}</small>
          </strong>
          <span className="tiny muted">{nb(pros.dmMois)} DM ce mois-ci</span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => setPanneau({ type: 'abonnements' })}>
          <span className="tb-mini-l">Abonnements</span>
          <strong>{eur(abosMois)}</strong>
          <span className="tiny muted">par mois · {abos.length} paiement(s) dans les 30 j</span>
        </button>
      </div>

      {/* Ligne 3 : à faire maintenant */}
      {faire.length > 0 && (
        <section className="tb-faire">
          <h2>
            <Icon n="bolt" size={17} /> À faire maintenant
          </h2>
          {faire.map((x, i) => (
            <div key={i} className={`tb-tache ${x.ton}`}>
              <div className="tb-tache-txt">
                <strong>{x.titre}</strong>
                <span className="small">{x.pourquoi}</span>
              </div>
              <div className="tb-tache-chiffre">
                <span className="tb-mini-l">En jeu</span>
                <strong>{eur(x.enJeu)}</strong>
                <span className="tiny muted">{x.effet}</span>
              </div>
              <div className="tb-tache-boutons">
                {x.boutons.map((b) =>
                  b.href ? (
                    <a key={b.l} className={`btn ${b.primaire ? 'primary' : ''}`} href={b.href} target="_blank" rel="noreferrer">
                      {b.l}
                    </a>
                  ) : (
                    <button key={b.l} type="button" className={`btn ${b.primaire ? 'primary' : ''}`} onClick={b.run}>
                      {b.l}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Ligne 4 : d'où vient l'argent, meilleurs clients */}
      <div className="tb-grille">
        <section className="tb-carte">
          <header>
            <h2>D’où vient l’argent</h2>
            <span className="tiny muted">par service, {p.nom}</span>
          </header>
          {services.length === 0 ? (
            <p className="small muted">Aucun argent reçu sur la période.</p>
          ) : (
            <div className="tb-services">
              <Donut parts={services.filter((s) => s.total > 0)} total={recu} onPick={(s) => ouvrirPaiements({ service: s.id })} />
              <ul>
                {services.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="tb-ligne" onClick={() => ouvrirPaiements({ service: s.id })}>
                      <span className="pastille-act" style={{ '--c': s.couleur }} />
                      <span className="tb-ligne-nom">{s.nom}</span>
                      <strong>{eur(s.total)}</strong>
                      <Evolution v={s.evolution} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {services.length > 1 && (
            <p className="tb-conseil small">
              <Icon n="sparkles" size={14} /> {services[0].nom} rapporte le plus ({pct(recu ? services[0].total / recu : 0)}).{' '}
              {services.find((s) => s.evolution !== null && s.evolution < -0.2) ? `${services.find((s) => s.evolution !== null && s.evolution < -0.2).nom} baisse : relance tes anciens clients de ce service.` : 'Propose ce service à tes autres clients.'}
            </p>
          )}
        </section>

        <section className="tb-carte">
          <header>
            <h2>Meilleurs clients</h2>
            <span className="tiny muted">{p.nom}</span>
          </header>
          {top.length === 0 ? (
            <p className="small muted">Tes clients apparaîtront ici dès le premier paiement.</p>
          ) : (
            <ol className="tb-classement">
              {top.map((c, i) => (
                <li key={c.cle}>
                  <button type="button" className="tb-ligne" onClick={() => setPanneau({ type: 'client', cle: c.cle })}>
                    <span className="tb-rang">{i + 1}</span>
                    <span className="tb-ligne-nom">
                      {c.nom}
                      <span className="tiny muted bloc">
                        {activiteParId(settings, c.service).nom} · {c.n} paiement(s)
                      </span>
                    </span>
                    <span className="tb-barre">
                      <i style={{ width: `${(c.total / top[0].total) * 100}%`, background: activiteParId(settings, c.service).couleur }} />
                    </span>
                    <strong>{eur(c.total)}</strong>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Ligne 5 : prospection, carte */}
      <div className="tb-grille">
        <section className="tb-carte">
          <header>
            <h2>Prospection</h2>
            <span className="tiny muted">{p.nom}</span>
          </header>
          <div className="tb-entonnoir">
            {[
              ['Contactés', pros.contactes, '#2563EB'],
              ['Ont répondu', pros.repondu, '#7A4CDB'],
              ['Intéressés', pros.interesses, '#D9468F'],
              ['Devenus clients', pros.gagnes, '#16A34A'],
            ].map(([l, v, c], i, tout) => (
              <div key={l} className="tb-etage" style={{ '--c': c, '--w': `${tout[0][1] ? Math.max(18, (v / tout[0][1]) * 100) : 100 - i * 18}%` }}>
                <span className="tb-etage-barre">
                  <strong>{nb(v)}</strong> {l}
                </span>
                {i > 0 && tout[i - 1][1] > 0 && <span className="tiny muted">{pct(v / tout[i - 1][1])}</span>}
              </div>
            ))}
          </div>
          <div className="tb-pros-chiffres">
            <span>
              <strong>{nb(pros.dmPeriode)}</strong> DM
            </span>
            <span>
              <strong>{nb(pros.appels)}</strong> appels
            </span>
            <span>
              <strong>{nb(pros.ajoutes)}</strong> entreprises ajoutées
            </span>
          </div>
          <p className="tb-conseil small">
            <Icon n="sparkles" size={14} />{' '}
            {pros.contactes === 0
              ? 'Aucun contact sur la période : sans prospection, pas de nouveaux clients dans 2 à 3 semaines.'
              : pros.tauxReponse !== null && pros.tauxReponse < 0.1
                ? `Peu de réponses (${pct(pros.tauxReponse)}). Change ton premier message ou essaie l’appel.`
                : `${pct(pros.tauxReponse)} de réponses : continue et relance ceux qui sont intéressés.`}
          </p>
        </section>

        <section className="tb-carte">
          <header>
            <h2>Carte du Congo</h2>
            <span className="tiny muted">où sont tes clients et prospects</span>
          </header>
          <Carte prospects={data.list} clientsIds={clientsIds} />
        </section>
      </div>

      {/* Ligne 6 : logiciel de caisse, à compléter */}
      <div className="tb-grille">
        <section className="tb-carte">
          <header>
            <h2>Logiciel de caisse</h2>
          </header>
          <Suspense fallback={<div className="chargement" aria-busy="true" />}>
            <ResumeLogiciel objectif={Number(settings.objectifLicences) || 10} />
          </Suspense>
        </section>

        <section className="tb-carte">
          <header>
            <h2>À compléter</h2>
            <span className="tiny muted">pour mieux suivre tes clients</span>
          </header>
          <ul className="tb-completer">
            {!settings.facturation?.signature && !settings.facturation?.cachet && (
              <li>
                <span>Ta signature et ton cachet pour les reçus et factures</span>
                <button type="button" className="btn sm" onClick={() => go('/signature')}>
                  Ajouter
                </button>
              </li>
            )}
            {manque.sansClient.length > 0 && (
              <li>
                <span>
                  {manque.sansClient.length} paiement(s) sans nom de client ({eur(manque.sansClient.reduce((m, x) => m + x.montant, 0))})
                </span>
                <button type="button" className="btn sm" onClick={() => setPanneau({ type: 'recu', sansClient: true })}>
                  Voir
                </button>
              </li>
            )}
            {manque.fiches.slice(0, 4).map((x) => (
              <li key={x.prospect.id}>
                <span>
                  <b>{x.prospect.name}</b> a payé {eur(x.total)} : il manque {x.manque.join(', ')}
                </span>
                <button type="button" className="btn sm" onClick={() => go(`/prospect/${x.prospect.id}`)}>
                  Compléter
                </button>
              </li>
            ))}
            {(settings.depensesFixes || []).length === 0 && (
              <li>
                <span>Tes abonnements (Claude, ChatGPT, Canal Box…)</span>
                <button type="button" className="btn sm" onClick={() => go('/abonnements')}>
                  Ajouter
                </button>
              </li>
            )}
          </ul>
        </section>
      </div>

      {panneau && (
        <DetailPanneau
          panneau={panneau}
          fermer={() => setPanneau(null)}
          p={p}
          paiements={paiements}
          ouvertes={ouvertes}
          devis={devis}
          abos={abos}
          abosMois={abosMois}
          pros={pros}
        />
      )}
    </div>
  )
}

// ---------- Contenu des panneaux ----------
function DetailPanneau({ panneau, fermer, p, paiements, ouvertes, devis, abos, abosMois, pros }) {
  const { settings, ouvrir } = useNoyau()
  const { data, actions = [] } = useDonnees()
  const [service, setService] = useState(panneau.service || '')

  if (panneau.type === 'recu' || panneau.type === 'client') {
    let liste = paiements.filter((x) => x.date >= p.debut && x.date <= p.fin)
    if (panneau.sansClient) liste = paiements.filter((x) => x.sansClient)
    if (panneau.type === 'client') liste = paiements.filter((x) => (x.prospectId || `nom:${norm(x.client || x.notes || 'sans nom')}`) === panneau.cle)
    if (service) liste = liste.filter((x) => x.activite === service)
    const total = liste.reduce((m, x) => m + x.montant, 0)
    const fiche = panneau.type === 'client' ? data.byId[liste[0]?.prospectId] : null
    return (
      <Panneau titre={panneau.type === 'client' ? liste[0]?.client || 'Client' : panneau.sansClient ? 'Paiements sans client' : 'Argent reçu'} sous={`${liste.length} paiement(s) · ${eur(total)}`} onClose={fermer}>
        {panneau.type !== 'client' && (
          <div className="chips">
            <button type="button" className={`chip ${!service ? 'on' : ''}`} onClick={() => setService('')}>
              Tous
            </button>
            {activitesDe(settings).map((a) => (
              <button key={a.id} type="button" className={`chip ${service === a.id ? 'on' : ''}`} onClick={() => setService(a.id)}>
                {a.nom}
              </button>
            ))}
          </div>
        )}
        {fiche && (
          <div className="tb-fiche-mini">
            <span className="small muted">{[fiche.fiche?.telephone, fiche.fiche?.ville, fiche.fiche?.secteur].filter(Boolean).join(' · ') || 'Fiche à compléter'}</span>
            <button type="button" className="btn sm" onClick={() => go(`/prospect/${fiche.id}`)}>
              Ouvrir la fiche
            </button>
          </div>
        )}
        <ul className="tb-paiements">
          {liste.map((x) => {
            const act = activiteParId(settings, x.activite)
            return (
              <li key={x.id}>
                <span className="pastille-act" style={{ '--c': act.couleur }} />
                <div className="tb-paiement-txt">
                  <strong>{x.client || 'Sans nom'}</strong>
                  <span className="tiny muted">
                    {fmtDate(x.date)} · {x.mode || 'moyen non noté'} · {act.nom}
                    {x.notes ? ` · ${x.notes}` : ''}
                  </span>
                </div>
                <strong className="num">{eur(x.montant)}</strong>
                <button
                  type="button"
                  className="btn sm ghost"
                  title="Télécharger le reçu"
                  onClick={() => telechargerRecu({ p: x, client: { nom: x.client, telephone: data.byId[x.prospectId]?.fiche?.telephone }, settings })}
                >
                  <Icon n="download" size={14} /> Reçu
                </button>
              </li>
            )
          })}
        </ul>
        {liste.length === 0 && <p className="small muted">Aucun paiement.</p>}
      </Panneau>
    )
  }

  if (panneau.type === 'arecevoir')
    return (
      <Panneau titre="À recevoir" sous={`${ouvertes.length} facture(s) · ${eur(ouvertes.reduce((m, x) => m + x.reste, 0))}`} onClose={fermer}>
        <ul className="tb-paiements">
          {ouvertes.map((x) => (
            <li key={x.d.id}>
              <span className={`tb-statut ${x.statut === 'En retard' ? 'rouge' : ''}`} />
              <div className="tb-paiement-txt">
                <strong>{x.client}</strong>
                <span className="tiny muted">
                  {x.d.numero} · {x.statut} · {x.d.data?.objet || ''}
                </span>
              </div>
              <strong className="num">{eur(x.reste)}</strong>
              <button type="button" className="btn sm" onClick={() => (fermer(), ouvrir('encaisser', { prospect_id: x.d.prospect_id, facture: x.d.numero, montant: x.reste }))}>
                Encaisser
              </button>
            </li>
          ))}
        </ul>
        {ouvertes.length === 0 && <p className="small muted">Tout est payé.</p>}
      </Panneau>
    )

  if (panneau.type === 'devis')
    return (
      <Panneau titre="Devis en attente" sous={`${devis.length} devis · ${eur(devis.reduce((m, x) => m + x.total, 0))} en jeu`} onClose={fermer}>
        <ul className="tb-paiements">
          {devis.map((x) => (
            <li key={x.d.id}>
              <span className="tb-statut orange" />
              <div className="tb-paiement-txt">
                <strong>{x.client}</strong>
                <span className="tiny muted">
                  {x.d.numero} · depuis {x.age} j · {x.d.data?.objet || ''}
                </span>
              </div>
              <strong className="num">{eur(x.total)}</strong>
              <button type="button" className="btn sm" onClick={() => go(`/facture/${x.d.id}`)}>
                Ouvrir
              </button>
            </li>
          ))}
        </ul>
        {devis.length === 0 && <p className="small muted">Aucun devis en attente.</p>}
      </Panneau>
    )

  if (panneau.type === 'abonnements')
    return (
      <Panneau titre="Abonnements" sous={`${eur(abosMois)} par mois`} onClose={fermer}>
        <ul className="tb-paiements">
          {abos.map((x, i) => (
            <li key={i}>
              <span className="tb-statut" />
              <div className="tb-paiement-txt">
                <strong>{x.d.nom}</strong>
                <span className="tiny muted">
                  le {fmtDate(x.date)}
                  {x.d.fournisseur ? ` · ${x.d.fournisseur}` : ''}
                </span>
              </div>
              <strong className="num">{eur(x.montant)}</strong>
            </li>
          ))}
        </ul>
        {abos.length === 0 && <p className="small muted">Aucun paiement prévu dans les 30 jours. Ajoute tes abonnements avec leur date de paiement.</p>}
        <button type="button" className="btn" onClick={() => go('/abonnements')}>
          Gérer mes abonnements
        </button>
      </Panneau>
    )

  if (panneau.type === 'objectifs') return <Objectifs fermer={fermer} />

  // Prospection : les derniers contacts notés
  const derniers = actions
    .filter((a) => ['Premier contact', 'Relance', 'Appel', 'Proposition', 'RDV'].includes(a.action) || ['DM', 'Appel', 'Email'].includes(a.canal))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 25)
  return (
    <Panneau titre="Prospection" sous={`${nb(pros.dmSemaine)} DM cette semaine · ${nb(pros.dmMois)} ce mois-ci`} onClose={fermer}>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => (fermer(), ouvrir('dm'))}>
          Noter mes DM
        </button>
        <button type="button" className="btn" onClick={() => go('/acquisition')}>
          Mes prospects
        </button>
      </div>
      <ul className="tb-paiements">
        {derniers.map((a) => (
          <li key={a.id}>
            <span className="tb-statut bleu" />
            <div className="tb-paiement-txt">
              <strong>{data.byId[a.prospect_id]?.name || 'Prospect'}</strong>
              <span className="tiny muted">
                {fmtDate(a.date)} · {a.action} · {a.canal}
                {a.resultat ? ` · ${a.resultat}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panneau>
  )
}

// Réglages simples : trois curseurs, enregistrés tout de suite
function Objectifs({ fermer }) {
  const { settings, api, toast } = useNoyau()
  const [v, setV] = useState({
    encaisse: Number(settings.objectifEncaisse) || 1500000,
    dm: Number(settings.objectifsJour?.dm) || 50,
    licences: Number(settings.objectifLicences) || 10,
  })
  const curseurs = [
    ['encaisse', 'Argent à recevoir chaque mois', 100000, 10000000, 50000, eur],
    ['dm', 'DM à envoyer chaque jour', 5, 300, 5, (x) => `${x} DM`],
    ['licences', 'Licences du logiciel actives', 1, 100, 1, (x) => `${x} licences`],
  ]
  const enregistrer = async () => {
    await api.saveSettings({ ...settings, objectifEncaisse: v.encaisse, objectifLicences: v.licences, objectifsJour: { ...(settings.objectifsJour || {}), dm: v.dm } })
    toast('Objectifs enregistrés ✓')
    fermer()
  }
  return (
    <Panneau titre="Mes objectifs" sous="Glisse pour changer. Le tableau de bord se calcule avec." onClose={fermer}>
      {curseurs.map(([k, l, min, max, pas, f]) => (
        <label key={k} className="tb-curseur">
          <span className="tb-curseur-tete">
            <span>{l}</span>
            <strong>{f(v[k])}</strong>
          </span>
          <input type="range" min={min} max={max} step={pas} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <button type="button" className="btn primary" onClick={enregistrer}>
        Enregistrer
      </button>
    </Panneau>
  )
}
