import { useEffect, useRef, useState } from 'react'
import { Field, eur, lbl, DEVISES, confirmer, go } from '../ui'
import { useNoyau, useDonnees } from '../core/contexte'
import { Icon, withIcon } from '../icons'
import { supabase, isLocal, clearOffline, syncStatus } from '../lib/store'
import { quitter } from '../modules/plateforme'
import { DEFAULT_SETTINGS, LIST_CAPACITY, MAX_PROSPECTS } from '../lib/defaults'
import { SOURCES } from '../modules/commercial'
import { today } from '../lib/dates'
import { isExample } from '../lib/seed'
import { rappelsDispo, iosSansInstall, abonnementActuel, activerRappels, desactiverRappels, testerRappels } from '../lib/rappels'
import { totals, nouveauDoc, chargerPdf, chargerZoho } from '../modules/facturation'
import { mensuel, estActif } from '../lib/tresorerie'
import Modules from './Modules'
import Membres from './Membres'
import { sectionAccessible } from '../core/modules'
import { peutGerer, ROLES, refusDe } from '../core/permissions'
import { AVERTISSEMENT_DONNEES } from '../lib/csv'
import Securite from './Securite'
import { THEMES, APPARENCE_DEFAUT, couleursDe, applyTheme, lireImage } from '../lib/theme'

const NUM_GROUPS = [
  ['🎯 Objectifs du mois', 'objectifsMois', [['appels', 'Appels / mois'], ['dm', 'DM / mois'], ['rdv', 'RDV / mois'], ['clients', 'Clients signés / mois'], ['ca', 'CA signé / mois (€)']]],
  ['🔁 Séquence de relance', 'relance', [['j1', 'Après la 1re tentative (jours)'], ['j2', 'Après la 2e tentative (jours)'], ['j3', 'Après la 3e et + (jours)'], ['stop', 'Arrêt conseillé après X tentatives sans réponse']]],
  ['🟠 Alertes', 'alertes', [['sansAction', 'Prospect sans action depuis (jours)'], ['propositionSansReponse', 'Proposition sans réponse depuis (jours)'], ['validiteProposition', "Validité d'une proposition (jours)"], ['delaiPaiement', 'Délai de paiement avant retard (jours)'], ['recontacterPerdu', 'Recontacter un perdu après (jours)'], ['avisGoogle', 'Demander un avis Google après (jours)'], ['renouvellement', 'Alerte renouvellement (jours avant)'], ['relanceClient', 'Client fidèle à recontacter après (jours sans intervention)']]],
  ['🤝 Clients', 'clients', [['engagementMois', "Durée d'engagement (mois)"], ['dureeVieMois', "Durée de vie moyenne d'un client (mois)"], ['indicatifWhatsApp', 'Indicatif pays WhatsApp', 'text']]],
  ['🔥 Score de priorité (points)', 'score', [['pubActive', 'Pub Instagram active'], ['pubReguliere', 'Pub régulière'], ['pubRecente', 'Pub repérée il y a moins de 30 jours'], ['pasDeSite', 'Pas de site internet'], ['googleAbsente', 'Présence Google absente'], ['googleFaible', 'Présence Google faible'], ['noteGoogleBasse', 'Note Google inférieure à 4'], ['entrepriseMoyenne', 'Entreprise moyenne'], ['grandeEntreprise', 'Grande entreprise'], ['recommande', "Recommandé par quelqu'un"]]],
]

const SECTIONS = [
  ['identite', 'Identité', 'Ton logo, tes couleurs et le nom affiché.', 'sparkles'],
  ['facturation', 'Facturation', 'Devise, factures et devis, tarifs et dépenses.', 'file'],
  ['objectifs', 'Objectifs', 'Objectifs du mois et du jour, relances, alertes et score.', 'target'],
  ['listes', 'Listes', 'Canaux, secteurs, sources, actions et étapes.', 'tag'],
  ['scripts', 'Scripts', "Messages Instagram, script d'appel et accroches.", 'message'],
  ['rappels', 'Rappels', 'Notifications sur ton téléphone à l’heure des relances.', 'bell'],
  ['excel', 'Import / Export', 'Excel, Zoho Invoice et données d’exemple.', 'folder'],
  ['modules', 'Modules', 'Activer ou désactiver les applications.', 'layers'],
  ['membres', 'Membres', 'Qui a accès à ton espace de travail, avec quel rôle.', 'users'],
  ['securite', 'Sécurité', 'Sauvegarde, corbeille, double authentification.', 'check-circle'],
  ['compte', 'Compte', 'Connexion et remise à zéro des réglages.', 'users'],
]

const LIST_DEFS = [
  ['canaux', 'Canaux', null],
  ['secteurs', 'Secteurs', [['nom', 'Secteur'], ['demo', 'Lien démo type']]],
  ['offres', 'Grille tarifaire', [['nom', 'Offre'], ['prix', 'Prix (€)', 'num'], ['abonnement', '€/mois', 'num'], ['cout', 'Coût (€)', 'num']]],
  ['objections', 'Objections / motifs de perte', null],
  ['modeles', 'Modèles / accroches', null],
  ['signaux', 'Signaux repérés sur les pubs Instagram', null],
  ['sources', 'Sources', null],
  ['zones', 'Zones', null],
  ['depensesFixes', 'Dépenses fixes / mois', [['nom', 'Poste'], ['montant', 'Montant (€)', 'num']]],
  ['objectifsQuotidiens', '🎯 Objectifs du jour (par défaut)', [['nom', 'Objectif'], ['cible', 'Cible / jour', 'num'], ['source', 'Compté automatiquement', 'select', SOURCES]]],
  ['routine', 'Routine quotidienne (to-do de chaque matin)', null],
  ['categoriesDepenses', 'Catégories de dépenses', null],
  ['modesPaiement', 'Modes de paiement', null],
  ['actions', 'Actions', [['nom', 'Action'], ['rang', 'Étape atteinte (n°)', 'num'], ['prospection', 'Prospection ?', 'bool']]],
  ['resultats', 'Résultats', [['nom', 'Résultat'], ['rang', 'Étape atteinte (n°)', 'num'], ['reponse', 'Compte comme réponse ?', 'bool']]],
  ['etapes', 'Probabilités par étape', [['nom', 'Étape', 'ro'], ['proba', 'Probabilité (0 à 1)', 'num']]],
]

// Convertit les montants des paramètres d'une devise à l'autre (arrondis propres)
function convertMontants(s, from, to) {
  const a = DEVISES.find((d) => d.code === from) || DEVISES.find((x) => x.code === 'EUR')
  const b = DEVISES.find((d) => d.code === to) || DEVISES.find((x) => x.code === 'EUR')
  const f = b.parEuro / a.parEuro
  const r = (v) => {
    const n = Number(v)
    if (!n || isNaN(n)) return v
    const x = n * f
    const step = x >= 100000 ? 1000 : x >= 10000 ? 500 : x >= 1000 ? 50 : x >= 100 ? 5 : 1
    return Math.max(step, Math.round(x / step) * step)
  }
  return {
    ...s,
    devise: to,
    objectifsMois: { ...s.objectifsMois, ca: r(s.objectifsMois.ca) },
    offres: s.offres.map((o) => ({ ...o, prix: r(o.prix), abonnement: r(o.abonnement), cout: r(o.cout) })),
    depensesFixes: s.depensesFixes.map((d) => ({ ...d, montant: r(d.montant) })),
  }
}

function ListEditor({ value, cols, onChange, max, fixedLength, excel }) {
  const upd = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)))
  return (
    <div className="list-editor">
      {cols && (
        <div className="le-row tiny muted bold">
          {cols.map((c) => (
            <span key={c[0]} style={{ flex: c[0] === 'nom' ? 2 : 1 }}>
              {lbl(c[1])}
            </span>
          ))}
          <span style={{ width: 30 }} />
        </div>
      )}
      {value.map((item, i) => (
        <div className={`le-row ${cols?.some((c) => c[2] === 'select') ? 'has-select' : ''}`} key={i}>
          {!cols ? (
            <input style={{ flex: 1 }} value={item} aria-label={`Élément ${i + 1}`} onChange={(e) => upd(i, e.target.value)} />
          ) : (
            cols.map(([k, libelle, type, opts]) =>
              type === 'select' ? (
                <select key={k} aria-label={`${lbl(libelle)}, ligne ${i + 1}`} style={{ flex: 1.4 }} value={item[k] || ''} onChange={(e) => upd(i, { ...item, [k]: e.target.value })}>
                  {opts.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : type === 'bool' ? (
                <select key={k} aria-label={`${lbl(libelle)}, ligne ${i + 1}`} style={{ flex: 1 }} value={item[k] ? 'Oui' : 'Non'} onChange={(e) => upd(i, { ...item, [k]: e.target.value === 'Oui' })}>
                  <option>Oui</option>
                  <option>Non</option>
                </select>
              ) : (
                <input
                  key={k}
                  aria-label={`${lbl(libelle)}, ligne ${i + 1}`}
                  style={{ flex: k === 'nom' ? 2 : 1 }}
                  inputMode={type === 'num' ? 'decimal' : undefined}
                  readOnly={type === 'ro'}
                  value={item[k] ?? ''}
                  onChange={(e) => upd(i, { ...item, [k]: type === 'num' ? e.target.value.replace(',', '.') : e.target.value })}
                />
              ),
            )
          )}
          {!fixedLength && (
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onChange(value.filter((_, j) => j !== i))} title="Retirer" aria-label={`Retirer la ligne ${i + 1}`}>
              <Icon n="x" size={14} />
            </button>
          )}
        </div>
      ))}
      {!fixedLength && value.length < max && (
        <button className="btn sm" onClick={() => onChange([...value, cols ? Object.fromEntries(cols.map(([k, , t, o]) => [k, t === 'num' ? 0 : t === 'bool' ? false : t === 'select' ? o[o.length - 1][0] : ''])) : ''])}>
          + Ajouter
        </button>
      )}
      {!fixedLength && (
        <div className="tiny muted" style={{ marginTop: 4 }}>
          Maximum {max}
          {excel ? ' (limite du fichier Excel)' : ''}
        </div>
      )}
    </div>
  )
}

// Image choisie depuis l'appareil (logo, cachet), gardée dans les paramètres
function ImagePick({ label, value, fallback, onChange, max = 600, dark, hint }) {
  const ref = useRef()
  const { toast } = useNoyau()
  const pick = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      onChange(await lireImage(f, max))
    } catch (err) {
      toast(err.message, true)
    }
  }
  return (
    <div className="img-pick">
      <div className="tiny muted bold" style={{ marginBottom: 6 }}>{label}</div>
      <div className={`img-prev ${dark ? 'dark' : ''}`}>
        {value || fallback ? <img src={value || fallback} alt="" /> : <span className="tiny muted">Aucune image</span>}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button type="button" className="btn sm" onClick={() => ref.current.click()}>
          <Icon n="upload" size={14} /> {value ? 'Changer' : 'Choisir'}
        </button>
        {value && (
          <button type="button" className="btn sm ghost danger" onClick={() => onChange('')}>
            Retirer
          </button>
        )}
      </div>
      {hint && <div className="tiny muted" style={{ marginTop: 6 }}>{hint}</div>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  )
}

function ApparenceCard({ s, change }) {
  const a = { ...APPARENCE_DEFAUT, ...(s.apparence || {}) }
  const set = (patch) => change({ ...s, apparence: { ...a, ...patch } })
  const c = couleursDe(a)
  return (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n="sparkles" size={16} /></span> Identité et apparence</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Ton logo, ton nom et tes couleurs : affichés sur l'écran de connexion, dans le menu, sur Ma journée et sur tes factures.
      </p>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <ImagePick
          label="Logo"
          value={a.logo}
          fallback="/logo-full.png"
          onChange={(logo) => set({ logo })}
          hint={a.logo ? 'Ton logo est utilisé partout (factures comprises).' : 'Logo Agence Elite par défaut. Un PNG sur fond transparent donne le meilleur rendu.'}
        />
        <ImagePick
          label="Logo pour fond sombre (menu), facultatif"
          value={a.logoSombre}
          fallback={a.logo ? '' : '/logo-mark-light.png'}
          dark
          onChange={(logoSombre) => set({ logoSombre })}
          hint="Une version claire (blanche) de ton logo. Sans elle, ton logo s'affiche sur une pastille blanche dans le menu."
        />
      </div>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <Field label="Nom affiché">
          <input className="input" value={a.nom} onChange={(e) => set({ nom: e.target.value })} />
        </Field>
        <Field label="Sous-titre">
          <input className="input" value={a.sousTitre} onChange={(e) => set({ sousTitre: e.target.value })} />
        </Field>
        <Field label="Ton prénom (Bonjour …)">
          <input className="input" value={a.prenom} onChange={(e) => set({ prenom: e.target.value })} />
        </Field>
      </div>
      <Field label="Phrase de l'écran de connexion" style={{ marginTop: 12 }}>
        <input className="input" value={a.accroche} onChange={(e) => set({ accroche: e.target.value })} />
      </Field>
      <label className="row small" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={a.afficherNom !== false} onChange={(e) => set({ afficherNom: e.target.checked })} /> Afficher le nom à côté du logo dans le
        menu (décoche si ton logo contient déjà le nom)
      </label>

      <div className="tiny muted bold" style={{ margin: '16px 0 8px' }}>Interface</div>
      <div className="theme-list">
        {[
          ['palantir', 'Salle de contrôle (sombre)'],
          ['classique', 'Classique (claire)'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`theme-opt ${(a.interface || 'palantir') === id ? 'on' : ''}`} onClick={() => set({ interface: id })}>
            <span className="theme-sw" style={{ background: id === 'palantir' ? '#111418' : '#f5f6f8' }}>
              <i style={{ background: id === 'palantir' ? '#4c90f0' : '#b8903f' }} />
            </span>
            {label}
          </button>
        ))}
      </div>
      <div className="tiny muted bold" style={{ margin: '16px 0 8px' }}>Couleurs du CRM{a.interface !== 'classique' && ' (interface classique seulement)'}</div>
      <div className="theme-list">
        {THEMES.map((t) => {
          const tc = t.id === 'perso' ? { principal: a.principal, accent: a.accent } : t
          return (
            <button key={t.id} type="button" className={`theme-opt ${a.theme === t.id ? 'on' : ''}`} onClick={() => set({ theme: t.id, ...(t.id === 'perso' ? c : {}) })}>
              <span className="theme-sw" style={{ background: tc.principal }}>
                <i style={{ background: tc.accent }} />
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
      {a.theme === 'perso' && (
        <div className="row" style={{ marginTop: 12, gap: 18 }}>
          <label className="row small">
            <input type="color" value={a.principal} onChange={(e) => set({ principal: e.target.value })} /> Couleur principale (menu, fonds)
          </label>
          <label className="row small">
            <input type="color" value={a.accent} onChange={(e) => set({ accent: e.target.value })} /> Couleur d'accent (boutons, barres)
          </label>
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 8 }}>Aperçu immédiat sur tout le CRM. Clique sur « Enregistrer » pour garder ton choix.</div>
    </div>
  )
}

// [clé, libellé, zone de texte, type]
const FACT_FIELDS = [
  ['nom', 'Nom de l’entreprise'],
  ['telephone', 'Téléphone'],
  ['email', 'E-mail'],
  ['site', 'Site web'],
  ['slogan', 'Slogan'],
  ['conditions', 'Conditions de paiement'],
  ['prefixeFacture', 'Préfixe des factures'],
  ['prefixeDevis', 'Préfixe des devis'],
  ['premierNumero', 'Premier numéro', false, 'num'],
  ['delaiPaiement', 'Délai de paiement (jours)', false, 'num'],
  ['validiteDevis', 'Validité des devis (jours)', false, 'num'],
  ['tva', 'TVA par défaut (%)', false, 'num'],
  ['adresse', 'Adresse', true],
  ['paiement', 'Informations de paiement (banque, Mobile Money…)', true],
  ['notes', 'Notes par défaut', true],
  ['cgv', 'Mentions en bas de page (CGV)', true],
]

function normalize(s) {
  const out = JSON.parse(JSON.stringify(s))
  // Garde les objectifs du fichier Excel alignés sur les objectifs quotidiens
  ;['dm', 'appels', 'prospects'].forEach((src) => {
    const o = (out.objectifsQuotidiens || []).find((x) => x.source === src)
    if (o) out.objectifsJour = { ...out.objectifsJour, [src]: Number(o.cible) || 0 }
  })
  if (out.facturation) FACT_FIELDS.forEach(([k, , , t]) => t === 'num' && (out.facturation[k] = Number(String(out.facturation[k]).replace(',', '.')) || 0))
  NUM_GROUPS.forEach(([, g, fields]) => fields.forEach(([k, , t]) => t !== 'text' && (out[g][k] = Number(String(out[g][k]).replace(',', '.')) || 0)))
  LIST_DEFS.forEach(([key, , cols]) => {
    if (!cols) out[key] = out[key].map((x) => x.trim()).filter(Boolean)
    else {
      out[key] = out[key]
        .map((it) => ({ ...(key === 'depensesFixes' ? it : {}), ...Object.fromEntries(cols.map(([k, , t]) => [k, t === 'num' ? Number(it[k]) || 0 : t === 'bool' ? !!it[k] : String(it[k] ?? '').trim()])) }))
        .filter((it) => it.nom)
    }
  })
  return out
}

// Import Zoho Invoice : factures ou devis exportés en CSV / Excel
function ZohoCard() {
  const { data, documents } = useDonnees()
  const { api, settings, toast } = useNoyau()
  const [imp, setImp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creer, setCreer] = useState(true)
  const ref = useRef()
  const nomsConnus = new Map(data.list.map((p) => [p.name.toLowerCase(), p.id]))
  const choisir = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const { lireZoho } = await chargerZoho()
      const r = await lireZoho(new Uint8Array(await file.arrayBuffer()))
      const existants = new Set(documents.filter((d) => d.type === r.type).map((d) => d.numero))
      const nouveaux = r.docs.filter((d) => !existants.has(d.numero))
      setImp({ ...r, file: file.name, nouveaux, dejaLa: r.docs.length - nouveaux.length })
    } catch (err) {
      toast(err.message, true)
    }
  }
  const clientsNouveaux = imp ? [...new Set(imp.nouveaux.map((d) => d.client).filter((c) => c && !nomsConnus.has(c.toLowerCase())))] : []
  const importer = async () => {
    setBusy(true)
    let n = 0
    try {
      const { zohoPaye, zohoAnnulee, zohoDevisStatut } = await chargerZoho()
      const ids = new Map(nomsConnus)
      for (const z of imp.nouveaux) {
        let pid = z.client ? ids.get(z.client.toLowerCase()) : null
        if (!pid && z.client && creer) {
          const np = await api.addProspect(z.client, { source: 'Zoho Invoice' })
          pid = np.id
          ids.set(z.client.toLowerCase(), pid)
        }
        const base = nouveauDoc(imp.type, settings.facturation, {})
        const dd = {
          ...base,
          date: z.date || base.date,
          echeance: imp.type === 'facture' ? z.echeance || z.date || base.echeance : '',
          validite: imp.type === 'devis' ? z.echeance || base.validite : '',
          objet: z.objet,
          client: { nom: z.client, adresse: '' },
          lignes: z.lignes,
          remise: z.remise || '',
          tva: z.tva || 0,
          notes: z.notes || base.notes,
          importZoho: true,
        }
        const total = totals(dd).total
        const annulee = imp.type === 'facture' && zohoAnnulee(z)
        if (annulee) dd.annulee = true
        if (imp.type === 'devis' && zohoDevisStatut(z)) dd.statut = zohoDevisStatut(z)
        // Le document d'abord : si la suite échoue, un nouvel import ne le recréera pas en double
        const saved = await api.saveDoc({ type: imp.type, numero: z.numero, prospect_id: pid || null, data: dd })
        if (pid && !annulee && total > 0) {
          const paye = imp.type === 'facture' ? zohoPaye(z, total) : 0
          const rows = [
            { prospect_id: pid, date: dd.date, canal: 'Autre', action: imp.type === 'facture' ? 'Intervention' : 'Proposition envoyée', montant: total, facture: imp.type === 'facture' ? z.numero : null, notes: 'Importé de Zoho Invoice' },
            ...(paye > 0 ? [{ prospect_id: pid, date: dd.date, action: 'Paiement reçu', montant: paye, facture: z.numero, notes: 'Importé de Zoho Invoice' }] : []),
          ]
          const ajoutees = await api.addActions(rows)
          const row = ajoutees.find((r) => r.action === rows[0].action) || ajoutees[0]
          await api.saveDoc({ ...saved, data: { ...dd, actionId: row.id } })
        }
        n++
      }
      toast(`${n} ${imp.type === 'devis' ? 'devis importés' : 'factures importées'} de Zoho ✓`)
      setImp(null)
    } catch (e) {
      toast(`Import interrompu après ${n} documents : ${e.message}`, true)
    }
    setBusy(false)
  }
  return (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n="download" size={16} /></span> Importer depuis Zoho Invoice</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Dans Zoho Invoice : Factures (ou Devis) › menu ⋯ › Exporter, au format CSV ou XLSX. Choisis ensuite le fichier ici : tes factures arrivent avec leurs
        lignes, leurs paiements et leurs clients. Les numéros déjà présents dans le CRM sont ignorés, et la numérotation continue après ton dernier numéro Zoho.
      </p>
      <button className="btn" disabled={busy} onClick={() => ref.current.click()}>
        <Icon n="upload" size={16} /> Choisir l'export Zoho
      </button>
      <input ref={ref} type="file" accept=".csv,.xlsx" hidden onChange={choisir} />
      {imp && (
        <div className="card" style={{ marginTop: 14, background: 'var(--gold-soft)' }}>
          <b>{imp.file}</b>
          <div className="small" style={{ margin: '6px 0 10px' }}>
            {imp.docs.length} {imp.type === 'devis' ? 'devis trouvés' : `facture${imp.docs.length > 1 ? 's' : ''} trouvée${imp.docs.length > 1 ? 's' : ''}`}
            {imp.dejaLa ? `, dont ${imp.dejaLa} déjà dans le CRM` : ''}. {imp.nouveaux.length} à importer
            {imp.nouveaux.length ? ` (${imp.nouveaux[0].numero}${imp.nouveaux.length > 1 ? ` → ${imp.nouveaux[imp.nouveaux.length - 1].numero}` : ''})` : ''}.
          </div>
          {clientsNouveaux.length > 0 && (
            <label className="row small" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={creer} onChange={(e) => setCreer(e.target.checked)} />{' '}
              {clientsNouveaux.length > 1 ? `Créer les ${clientsNouveaux.length} clients qui n'existent pas encore` : "Créer le client qui n'existe pas encore"} ({clientsNouveaux.slice(0, 3).join(', ')}
              {clientsNouveaux.length > 3 ? '…' : ''})
            </label>
          )}
          {imp.manquantes.some((k) => ['date', 'pu', 'solde', 'statut'].includes(k)) && (
            <div className="tiny orange" style={{ marginBottom: 10 }}>
              Colonnes non trouvées : {imp.manquantes.filter((k) => ['date', 'pu', 'solde', 'statut', 'qte', 'echeance'].includes(k)).join(', ')}. Vérifie le résultat après l'import.
            </div>
          )}
          <div className="row">
            <button className="btn primary" disabled={busy || !imp.nouveaux.length} onClick={importer}>
              {busy ? 'Import en cours…' : `Importer ${imp.nouveaux.length} ${imp.type === 'devis' ? 'devis' : 'factures'}`}
            </button>
            <button className="btn" disabled={busy} onClick={() => setImp(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Rappels sur le téléphone : abonnement de cet appareil, heure par défaut, test
function RappelsCard({ s, change, setS }) {
  const { settings, api, toast } = useNoyau()
  const [abonne, setAbonne] = useState(null)
  const [busy, setBusy] = useState('')
  useEffect(() => {
    abonnementActuel().then((x) => setAbonne(!!x), () => setAbonne(false))
  }, [])
  const run = async (k, fn) => {
    setBusy(k)
    try {
      await fn()
    } catch (e) {
      toast(e.message, true)
    }
    setBusy('')
  }
  const activer = () =>
    run('on', async () => {
      await activerRappels()
      const r = { ...settings.rappels, actif: true }
      await api.saveSettings({ ...settings, rappels: r })
      setS((x) => ({ ...x, rappels: { ...x.rappels, actif: true } }))
      setAbonne(true)
      toast('Rappels activés sur cet appareil ✓')
    })
  const desactiver = () =>
    run('off', async () => {
      await desactiverRappels()
      setAbonne(false)
      toast('Rappels désactivés sur cet appareil')
    })
  const tester = () =>
    run('test', async () => {
      const r = await testerRappels()
      toast(r.envoyes ? 'Notification de test envoyée ✓' : "Aucun appareil abonné : active d'abord les rappels", !r.envoyes)
    })
  if (!rappelsDispo())
    return (
      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="bell" size={16} /></span> Rappels sur le téléphone</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {isLocal ? 'Disponible dans la version en ligne (crm.agence-elite.fr).' : 'Ce navigateur ne gère pas les notifications. Essaie Chrome ou l’appli installée sur ton téléphone.'}
        </p>
      </div>
    )
  return (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n="bell" size={16} /></span> Rappels sur le téléphone</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Une notification à l'heure de chaque relance (heure de rappel de la saisie, sinon l'heure par défaut), un résumé des relances en retard le matin et les
        échéances de factures. Elles arrivent même quand le CRM est fermé.
      </p>
      {iosSansInstall() && (
        <div className="banner small" style={{ marginBottom: 12 }}>
          Sur iPhone : ouvre le CRM dans Safari, touche Partager puis « Sur l'écran d'accueil », et active les rappels depuis l'icône installée.
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <span className={`badge ${abonne ? 'b-green' : 'b-Perdu'}`}>{abonne === null ? '…' : abonne ? 'Activés sur cet appareil' : 'Pas activés sur cet appareil'}</span>
      </div>
      <div className="row">
        {!abonne ? (
          <button className="btn gold" disabled={!!busy} onClick={activer}>
            <Icon n="bell" size={15} /> {busy === 'on' ? 'Activation…' : 'Activer sur cet appareil'}
          </button>
        ) : (
          <>
            <button className="btn" disabled={!!busy} onClick={tester}>
              {busy === 'test' ? 'Envoi…' : 'Envoyer une notification de test'}
            </button>
            <button className="btn ghost danger" disabled={!!busy} onClick={desactiver}>
              Désactiver sur cet appareil
            </button>
          </>
        )}
      </div>
      <Field label="Heure par défaut des rappels" style={{ marginTop: 14, maxWidth: 220 }}>
        <input type="time" value={s.rappels?.heureDefaut || '09:00'} onChange={(e) => change({ ...s, rappels: { ...s.rappels, heureDefaut: e.target.value } })} />
      </Field>
      <div className="tiny muted" style={{ marginTop: 8 }}>Active les rappels sur chaque appareil où tu veux les recevoir (téléphone, ordinateur).</div>
    </div>
  )
}

export default function Parametres({ section }) {
  const { prospects, actions } = useDonnees()
  const { settings, api, toast, role } = useNoyau()
  const [s, setS] = useState(() => JSON.parse(JSON.stringify(settings)))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [imp, setImp] = useState(null)
  const [convertir, setConvertir] = useState(true)
  const fileRef = useRef()
  // Aperçu des couleurs pendant le réglage ; on revient aux couleurs enregistrées en quittant
  const saved = useRef(settings.apparence)
  useEffect(() => {
    saved.current = settings.apparence
  }, [settings.apparence])
  useEffect(() => applyTheme(s.apparence), [s.apparence])
  useEffect(() => () => applyTheme(saved.current), [])
  const change = (next) => {
    setS(next)
    setDirty(true)
  }

  const setFact = (patch) => change({ ...s, facturation: { ...s.facturation, ...patch } })
  // Exemple de facture avec les réglages en cours (même non enregistrés)
  const apercu = async () => {
    setBusy('apercu')
    const w = window.open('', '_blank')
    try {
      const { pdfBlob } = await chargerPdf()
      const fact = normalize(s).facturation
      const exemple = {
        type: 'facture',
        numero: `${fact.prefixeFacture}${new Date().getFullYear()}000000`,
        data: {
          date: today(),
          echeance: today(),
          conditions: fact.conditions,
          client: { nom: 'Client exemple', adresse: 'Adresse du client' },
          lignes: [{ designation: 'Prestation exemple', description: 'Description de la prestation', qte: 1, pu: (s.devise || 'EUR') === 'EUR' ? 500 : 100000 }],
          remise: 0,
          tva: fact.tva,
          notes: fact.notes,
        },
      }
      const blob = await pdfBlob(exemple, { fact, code: s.devise || 'EUR', statut: 'En attente', paye: 0, logo: s.apparence?.logo || '/logo-full.png' })
      const url = URL.createObjectURL(blob)
      if (w) w.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      w?.close()
      toast(`Aperçu impossible : ${e.message}`, true)
    }
    setBusy('')
  }

  const save = async () => {
    // Les modules se règlent dans leur propre section : on garde leur état actuel
    await api.saveSettings(normalize({ ...s, modules: settings.modules }))
    setDirty(false)
    toast('Paramètres enregistrés ✓')
  }

  const exportXlsx = async () => {
    const refus = refusDe(role, 'exporter')
    if (refus) return toast(refus, true)
    if (!(await confirmer(AVERTISSEMENT_DONNEES, { titre: 'Exporter vers Excel ?', ok: 'Exporter' }))) return
    setBusy('export')
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}template/Agence_Elite_Pilotage.xlsx`)
      if (!res.ok) throw new Error('Modèle Excel introuvable')
      const { buildExcel } = await import('../lib/excel')
      const blob = await buildExcel(await res.arrayBuffer(), prospects, actions, settings)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Agence_Elite_Pilotage_${today()}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('Fichier Excel téléchargé ✓')
    } catch (e) {
      toast(`Export impossible : ${e.message}`, true)
    }
    setBusy('')
  }

  const pickFile = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const { parseExcel } = await import('../lib/excel')
      const parsed = await parseExcel(new Uint8Array(await file.arrayBuffer()))
      setImp({ ...parsed, file: file.name, replace: prospects.length === 0 && !refusDe(role, 'remplacer'), withSettings: true })
    } catch (err) {
      toast(err.message, true)
    }
  }
  const runImport = async () => {
    // Remplacer efface toutes les données actuelles : confirmation tapée, sauvegarde automatique avant
    if (imp.replace && (prospects.length || actions.length)) {
      const ok = await confirmer(
        `Une sauvegarde de tes données actuelles sera téléchargée d'abord. Les nouvelles lignes sont ajoutées avant que les anciennes soient retirées : si l'import échoue, rien n'est perdu.`,
        { titre: 'Remplacer toutes tes données ?', objet: `${prospects.length} prospects et ${actions.length} actions remplacés par ${imp.prospects.length} prospects et ${imp.actions.length} actions`, effet: 'annulable', ok: 'Remplacer', danger: true, saisie: 'REMPLACER' }
      )
      if (!ok) return
    }
    setBusy('import')
    try {
      let list = imp.prospects
      let acts = imp.actions
      if (!imp.replace) {
        // Rattache aux prospects existants portant le même nom
        const byName = Object.fromEntries(prospects.map((p) => [p.name.toLowerCase(), p.id]))
        const remap = {}
        list = list.filter((p) => {
          const ex = byName[p.name.toLowerCase()]
          if (ex) remap[p.id] = ex
          return !ex
        })
        acts = acts.map((a) => (remap[a.prospect_id] ? { ...a, prospect_id: remap[a.prospect_id] } : a))
      }
      await api.bulkImport(list, acts, imp.replace)
      if (imp.withSettings && imp.settings) {
        const merged = { ...settings }
        Object.entries(imp.settings).forEach(([k, v]) => (merged[k] = Array.isArray(v) ? v : { ...settings[k], ...v }))
        // Abonnements : le fichier n'a que le nom et le coût par mois, on garde le détail de ceux qui n'ont pas changé
        if (imp.settings.depensesFixes)
          merged.depensesFixes = imp.settings.depensesFixes.map((d) => settings.depensesFixes.find((x) => x.nom === d.nom && Math.round(mensuel(x)) === Math.round(Number(d.montant))) || d).concat(settings.depensesFixes.filter((x) => !estActif(x)))
        // Objectifs du jour du fichier Excel : repris dans les objectifs quotidiens
        const oj = imp.settings.objectifsJour
        if (oj) merged.objectifsQuotidiens = (merged.objectifsQuotidiens || []).map((o) => (oj[o.source] !== undefined ? { ...o, cible: Number(oj[o.source]) || 0 } : o))
        await api.saveSettings(merged)
        setS(JSON.parse(JSON.stringify(merged)))
      }
      toast(`Import terminé : ${list.length} prospects, ${acts.length} actions ✓`)
      setImp(null)
    } catch (e) {
      toast(`Import impossible : ${e.message}`, true)
    }
    setBusy('')
  }

  const sec = SECTIONS.some((x) => x[0] === section) && sectionAccessible(section, settings) ? section : 'identite'
  const numCard = (g) =>
    NUM_GROUPS.filter((x) => x[1] === g).map(([title, g, fields]) => (
      <div className="card" key={g}>
        <h2 className="section">{withIcon(title)}</h2>
        <div className="stack" style={{ gap: 10 }}>
          {fields.map(([k, label, t]) => (
            <div className="row" key={k} style={{ flexWrap: 'nowrap' }}>
              <span className="small" style={{ flex: 1 }}>
                {lbl(label)}
              </span>
              <input
                className="input"
                aria-label={lbl(label)}
                style={{ width: 110, textAlign: 'right' }}
                inputMode={t === 'text' ? 'numeric' : 'decimal'}
                value={s[g][k] ?? ''}
                onChange={(e) => change({ ...s, [g]: { ...s[g], [k]: e.target.value } })}
              />
            </div>
          ))}
          {g === 'objectifsMois' && <div className="tiny muted">Soit environ {eur(Number(s.objectifsMois.ca) / Math.max(1, Number(s.objectifsMois.clients)))} par client.</div>}
        </div>
      </div>
    ))
  // Les charges fixes ont leur propre page (hub Charges)
  const chargesCard = (
    <div className="card" key="charges">
      <h2 className="section">{withIcon('Abonnements et charges fixes')}</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Loyer, internet, logiciels… se gèrent dans le menu Charges, avec leur périodicité et leur date d'échéance.
      </p>
      <button type="button" className="btn sm" onClick={() => go('/abonnements')}>
        Ouvrir mes abonnements
      </button>
    </div>
  )
  const listCard = (key) =>
    LIST_DEFS.filter((x) => x[0] === key).map(([key, title, cols]) => (
      <div className="card" key={key}>
        <h2 className="section">{withIcon(title)}</h2>
        <ListEditor
          value={s[key]}
          cols={cols}
          max={LIST_CAPACITY[key]}
          excel={!['categoriesDepenses', 'modesPaiement', 'objectifsQuotidiens', 'routine', 'signaux'].includes(key)}
          fixedLength={key === 'etapes'}
          onChange={(v) => change({ ...s, [key]: v })}
        />
        {key === 'actions' && (
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Étape atteinte : 1 Nouveau, 2 Contacté, 3 Qualifié, 4 Audit/Démo, 5 RDV, 6 Proposition, 7 Gagné. Garde les noms des actions de vente
            (Proposition envoyée, Signature, Intervention, Paiement reçu…) : les calculs s'appuient dessus.
          </div>
        )}
      </div>
    ))
  // Éditeur d'une liste de messages { titre, texte }
  const msgEditor = (key, ico, title, max) => (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n={ico} size={16} /></span> {title}</h2>
      <div className="tiny muted" style={{ marginBottom: 10 }}>
        Remplis automatiquement : {'{entreprise}'}, {'{produit}'} (ce qu'il vend), {'{contact}'}, {'{lien}'} (lien de la Loom).
      </div>
      {(s[key] || []).map((x, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
            <input className="input" style={{ flex: 1, fontWeight: 600 }} value={x.titre} onChange={(e) => change({ ...s, [key]: s[key].map((y, j) => (j === i ? { ...y, titre: e.target.value } : y)) })} />
            <button className="icon-btn" title="Retirer" aria-label="Retirer" onClick={() => change({ ...s, [key]: s[key].filter((_, j) => j !== i) })}>
              <Icon n="x" size={14} />
            </button>
          </div>
          <textarea rows={4} value={x.texte} onChange={(e) => change({ ...s, [key]: s[key].map((y, j) => (j === i ? { ...y, texte: e.target.value } : y)) })} />
        </div>
      ))}
      {(s[key] || []).length < max && (
        <button className="btn sm" onClick={() => change({ ...s, [key]: [...(s[key] || []), { titre: 'Nouveau message', texte: '' }] })}>
          + Ajouter un message
        </button>
      )}
    </div>
  )
  const cols = (...cards) => (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      {cards}
    </div>
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Paramètres</h1>
          <div className="sub">{SECTIONS.find((x) => x[0] === sec)[2]}</div>
          {!peutGerer(role) && (
            <div className="small muted" data-reglages="lecture">
              Rôle {ROLES[role]?.nom} : les réglages de l'espace sont modifiables par le propriétaire et les administrateurs.
            </div>
          )}
        </div>
        <div className="row">
          {dirty && (
            <button className="btn" onClick={() => { setS(JSON.parse(JSON.stringify(settings))); setDirty(false) }}>
              Annuler
            </button>
          )}
          <button className="btn gold" disabled={!dirty} onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>

      <div className="settings">
        {/* Les sections sont dans le menu de gauche (et en onglets sur téléphone) */}
        <div className="set-body stack">
          {sec === 'identite' && <ApparenceCard s={s} change={change} />}
          {sec === 'facturation' && (
            <>
      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="file" size={16} /></span> Factures et devis</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Informations imprimées sur tes factures et devis PDF.
        </p>
        <div className="form-grid">
          {FACT_FIELDS.filter((f) => !f[2]).map(([k, label, , type]) => (
            <Field key={k} label={label}>
              <input
                className="input"
                inputMode={type === 'num' ? 'numeric' : undefined}
                value={s.facturation?.[k] ?? ''}
                onChange={(e) => change({ ...s, facturation: { ...s.facturation, [k]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {FACT_FIELDS.filter((f) => f[2]).map(([k, label]) => (
            <Field key={k} label={label}>
              <textarea rows={3} value={s.facturation?.[k] ?? ''} onChange={(e) => change({ ...s, facturation: { ...s.facturation, [k]: e.target.value } })} />
            </Field>
          ))}
        </div>
        <div className="grid grid-2" style={{ marginTop: 14, alignItems: 'start' }}>
          <div className="stack" style={{ gap: 12 }}>
            <label className="row small">
              <input type="color" value={s.facturation?.couleur || '#e60000'} onChange={(e) => setFact({ couleur: e.target.value })} /> Couleur des factures (bandeau,
              total, statut)
            </label>
            <label className="row small">
              <input type="checkbox" checked={s.facturation?.afficherLogo !== false} onChange={(e) => setFact({ afficherLogo: e.target.checked })} /> Mettre mon logo
              en haut des factures (sinon, le nom de l'entreprise)
            </label>
            <Field label="Nom du signataire (facultatif)">
              <input className="input" value={s.facturation?.signataire || ''} onChange={(e) => setFact({ signataire: e.target.value })} />
            </Field>
            <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy === 'apercu'} onClick={apercu}>
              <Icon n="eye" size={14} /> {busy === 'apercu' ? 'Préparation…' : "Voir un exemple de facture"}
            </button>
          </div>
          <ImagePick
            label="Cachet / signature (facultatif)"
            value={s.facturation?.signature || ''}
            max={500}
            onChange={(signature) => setFact({ signature })}
            hint="Photo ou scan de ton cachet ou de ta signature, ajouté au bas des factures et devis."
          />
        </div>
      </div>

      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="coins" size={16} /></span> Devise</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Monnaie utilisée partout dans le CRM (montants, tableau de bord, clients).
        </p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Devise" style={{ minWidth: 240 }}>
            <select
              value={s.devise || 'EUR'}
              onChange={(e) => change(convertir ? convertMontants(s, s.devise || 'EUR', e.target.value) : { ...s, devise: e.target.value })}
            >
              {DEVISES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="row small" style={{ paddingBottom: 10, flexWrap: 'nowrap', alignItems: 'flex-start', flex: '1 1 260px' }}>
            <input type="checkbox" checked={convertir} onChange={(e) => setConvertir(e.target.checked)} /> Convertir aussi mes tarifs, objectif de CA et
            dépenses fixes (1 € = 655,957 FCFA)
          </label>
        </div>
        {dirty && (s.devise || 'EUR') !== (settings.devise || 'EUR') && <div className="tiny orange" style={{ marginTop: 8 }}>Clique sur « Enregistrer » en haut pour appliquer.</div>}
      </div>

              {cols(listCard('offres'), listCard('modesPaiement'), chargesCard, listCard('categoriesDepenses'))}
            </>
          )}
          {sec === 'objectifs' && (
            <>
              {cols(numCard('objectifsMois'), listCard('objectifsQuotidiens'))}
              {cols(listCard('routine'), numCard('relance'))}
              {cols(numCard('alertes'), numCard('score'))}
            </>
          )}
          {sec === 'listes' && (
            <>
              {cols(listCard('canaux'), listCard('sources'), listCard('secteurs'), listCard('zones'), listCard('objections'), numCard('clients'))}
              {cols(listCard('actions'), listCard('resultats'))}
              {listCard('etapes')}
            </>
          )}
          {sec === 'scripts' && (
            <>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
              {msgEditor('scriptsDM', 'instagram', 'Scripts Instagram (à copier depuis la fiche)', 15)}
        <div className="card">
          <h2 className="section"><span className="sec-ic"><Icon n="phone" size={16} /></span> Script d'appel</h2>
          {s.script.map((x, i) => (
            <Field key={i} label={x.titre} style={{ marginBottom: 10 }}>
              <textarea value={x.texte} onChange={(e) => change({ ...s, script: s.script.map((y, j) => (j === i ? { ...y, texte: e.target.value } : y)) })} />
            </Field>
          ))}
        </div>
              </div>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
                {msgEditor('messagesRelance', 'repeat', 'Messages de relance (1re, 2e, 3e relance…)', 6)}
                <div className="card">
                  <h2 className="section"><span className="sec-ic"><Icon n="file" size={16} /></span> Messages WhatsApp des factures</h2>
                  <div className="tiny muted" style={{ marginBottom: 10 }}>
                    Remplis automatiquement : {'{contact}'}, {'{client}'}, {'{document}'}, {'{numero}'}, {'{date}'}, {'{montant}'}, {'{reste}'}, {'{echeance}'}.
                  </div>
                  <Field label="Relance d'une facture impayée" style={{ marginBottom: 10 }}>
                    <textarea rows={4} value={s.messageImpaye || ''} onChange={(e) => change({ ...s, messageImpaye: e.target.value })} />
                  </Field>
                  <Field label="Envoi d'une facture ou d'un devis">
                    <textarea rows={4} value={s.messageEnvoi || ''} onChange={(e) => change({ ...s, messageEnvoi: e.target.value })} />
                  </Field>
                </div>
              </div>
              {cols(listCard('modeles'), listCard('signaux'))}
            </>
          )}
          {sec === 'rappels' && <RappelsCard s={s} change={change} setS={setS} />}
          {sec === 'excel' && (
            <>
              <ZohoCard />
      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="folder" size={16} /></span> Fichier Excel</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Le CRM est ta base principale. L'export génère ton fichier de pilotage complet (Saisie remplie, tous les onglets et calculs,
          Paramètres à jour). L'import reprend ce que tu as saisi dans le fichier Excel.
        </p>
        <div className="row">
          <button className="btn primary" disabled={!!busy} onClick={exportXlsx} hidden={!!refusDe(role, 'exporter')}>
            {busy === 'export' ? 'Préparation…' : <><Icon n="download" size={16} /> Exporter vers Excel</>}
          </button>
          <button className="ecriture btn" disabled={!!busy} onClick={() => fileRef.current.click()}>
            <Icon n="upload" size={16} /> Importer un fichier Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={pickFile} />
        </div>
        {prospects.length > MAX_PROSPECTS && (
          <div className="tiny orange" style={{ marginTop: 8 }}>
            Le fichier Excel affiche {MAX_PROSPECTS} prospects au maximum, tu en as {prospects.length}.
          </div>
        )}
        {imp && (
          <div className="card" style={{ marginTop: 14, background: 'var(--gold-soft)' }}>
            <b>{imp.file}</b>
            <div className="small" style={{ margin: '6px 0 10px' }}>
              {imp.prospects.length} prospects et {imp.actions.length} actions trouvés
              {imp.skipped ? ` · ${imp.skipped} lignes ignorées (exemples ou sans date)` : ''}.
            </div>
            <label className="row small" style={{ marginBottom: 6 }}>
              <input type="radio" checked={!imp.replace} onChange={() => setImp({ ...imp, replace: false })} /> Ajouter à mes données actuelles
            </label>
            <label className="row small" style={{ marginBottom: 6 }}>
              <input type="radio" checked={imp.replace} disabled={!!refusDe(role, 'remplacer')} onChange={() => setImp({ ...imp, replace: true })} /> Remplacer toutes mes données
              ({prospects.length} prospects, {actions.length} actions seront supprimés)
            </label>
            {imp.settings && (
              <label className="row small" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={imp.withSettings} onChange={(e) => setImp({ ...imp, withSettings: e.target.checked })} /> Reprendre aussi les
                Paramètres du fichier
              </label>
            )}
            <div className="row">
              <button className="btn primary" disabled={!!busy} onClick={runImport}>
                {busy === 'import' ? 'Import en cours…' : 'Importer'}
              </button>
              <button className="btn" onClick={() => setImp(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section"><span className="sec-ic"><Icon n="flask" size={16} /></span> Données d'exemple</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          8 prospects et clients fictifs marqués « (EXEMPLE) » pour voir le CRM rempli. Supprime-les avant de commencer pour de vrai.
        </p>
        <div className="row">
          <button className="btn" disabled={!!busy || prospects.some(isExample)} onClick={async () => { setBusy('seed'); try { await api.loadSeed(); toast('Exemples chargés ✓') } catch { /* toast */ } setBusy('') }}>
            Charger les exemples
          </button>
          <button className="btn danger" disabled={!!busy || !prospects.some(isExample)} onClick={async () => { if (!(await confirmer('Supprimer tous les prospects « (EXEMPLE) » et leur historique ?', { ok: 'Supprimer', danger: true }))) return; setBusy('seed'); try { await api.clearSeed(); toast('Exemples supprimés ✓') } catch { /* toast */ } setBusy('') }}>
            Supprimer les exemples
          </button>
        </div>
      </div>

            </>
          )}
          {sec === 'modules' && <Modules />}
          {sec === 'membres' && <Membres />}
          {sec === 'securite' && <Securite />}
          {sec === 'compte' && (
            <>
      <div className="card">
        <h2 className="section">Compte</h2>
        <div className="row">
          {isLocal ? (
            <span className="small muted">Mode démo : les données sont enregistrées dans ce navigateur uniquement.</span>
          ) : (
            <button
              className="btn"
              onClick={async () => {
                const n = syncStatus.get().pending
                if (n && !(await confirmer(`${n} modification${n > 1 ? 's' : ''} pas encore synchronisée${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} perdue${n > 1 ? 's' : ''}. Se déconnecter quand même ?`, { ok: 'Se déconnecter', danger: true }))) return
                clearOffline()
                await quitter(() => supabase.auth.signOut())
              }}
            >
              Se déconnecter
            </button>
          )}
          <button
            className="btn ghost sm"
            onClick={async () => (await confirmer('Ton logo, tes couleurs et ton cachet sont gardés.', { titre: 'Remettre les paramètres par défaut ?', ok: 'Remettre par défaut', danger: true })) && change({ ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), apparence: s.apparence, facturation: { ...DEFAULT_SETTINGS.facturation, signature: s.facturation?.signature || '' } })}
          >
            Paramètres par défaut
          </button>
        </div>
      </div>
            </>
          )}
        </div>
      </div>
      {dirty && (
        <div className="save-bar">
          <span>Modifications non enregistrées</span>
          <button className="btn gold" onClick={save}>
            Enregistrer
          </button>
        </div>
      )}
    </div>
  )
}
