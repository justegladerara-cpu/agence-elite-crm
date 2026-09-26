import { useRef, useState } from 'react'
import { useApp, Field, eur } from '../ui'
import { supabase, isLocal } from '../lib/store'
import { DEFAULT_SETTINGS, LIST_CAPACITY, MAX_PROSPECTS } from '../lib/defaults'
import { today } from '../lib/dates'

const NUM_GROUPS = [
  ['🎯 Objectifs du jour', 'objectifsJour', [['prospects', 'Nouveaux prospects / jour'], ['appels', 'Appels / jour'], ['dm', 'DM / jour']]],
  ['🎯 Objectifs du mois', 'objectifsMois', [['appels', 'Appels / mois'], ['dm', 'DM / mois'], ['rdv', 'RDV / mois'], ['clients', 'Clients signés / mois'], ['ca', 'CA signé / mois (€)']]],
  ['🔁 Séquence de relance', 'relance', [['j1', 'Après la 1re tentative (jours)'], ['j2', 'Après la 2e tentative (jours)'], ['j3', 'Après la 3e et + (jours)'], ['stop', 'Arrêt conseillé après X tentatives sans réponse']]],
  ['🟠 Alertes', 'alertes', [['sansAction', 'Prospect sans action depuis (jours)'], ['propositionSansReponse', 'Proposition sans réponse depuis (jours)'], ['validiteProposition', "Validité d'une proposition (jours)"], ['delaiPaiement', 'Délai de paiement avant retard (jours)'], ['recontacterPerdu', 'Recontacter un perdu après (jours)'], ['avisGoogle', 'Demander un avis Google après (jours)'], ['renouvellement', 'Alerte renouvellement (jours avant)']]],
  ['🤝 Clients', 'clients', [['engagementMois', "Durée d'engagement (mois)"], ['dureeVieMois', "Durée de vie moyenne d'un client (mois)"], ['indicatifWhatsApp', 'Indicatif pays WhatsApp', 'text']]],
  ['🔥 Score de priorité (points)', 'score', [['pubActive', 'Pub Instagram active'], ['pubReguliere', 'Pub régulière'], ['pubRecente', 'Pub repérée il y a moins de 30 jours'], ['pasDeSite', 'Pas de site internet'], ['googleAbsente', 'Présence Google absente'], ['googleFaible', 'Présence Google faible'], ['noteGoogleBasse', 'Note Google inférieure à 4'], ['entrepriseMoyenne', 'Entreprise moyenne'], ['grandeEntreprise', 'Grande entreprise'], ['recommande', "Recommandé par quelqu'un"]]],
]

const LIST_DEFS = [
  ['canaux', 'Canaux', null],
  ['secteurs', 'Secteurs', [['nom', 'Secteur'], ['demo', 'Lien démo type']]],
  ['offres', 'Grille tarifaire', [['nom', 'Offre'], ['prix', 'Prix (€)', 'num'], ['abonnement', '€/mois', 'num'], ['cout', 'Coût (€)', 'num']]],
  ['objections', 'Objections / motifs de perte', null],
  ['modeles', 'Modèles / accroches', null],
  ['sources', 'Sources', null],
  ['zones', 'Zones', null],
  ['depensesFixes', 'Dépenses fixes / mois', [['nom', 'Poste'], ['montant', 'Montant (€)', 'num']]],
  ['actions', 'Actions', [['nom', 'Action'], ['rang', 'Étape atteinte (n°)', 'num'], ['prospection', 'Prospection ?', 'bool']]],
  ['resultats', 'Résultats', [['nom', 'Résultat'], ['rang', 'Étape atteinte (n°)', 'num'], ['reponse', 'Compte comme réponse ?', 'bool']]],
  ['etapes', 'Probabilités par étape', [['nom', 'Étape', 'ro'], ['proba', 'Probabilité (0 à 1)', 'num']]],
]

function ListEditor({ value, cols, onChange, max, fixedLength }) {
  const upd = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)))
  return (
    <div className="list-editor">
      {cols && (
        <div className="le-row tiny muted bold">
          {cols.map((c) => (
            <span key={c[0]} style={{ flex: c[0] === 'nom' ? 2 : 1 }}>
              {c[1]}
            </span>
          ))}
          <span style={{ width: 30 }} />
        </div>
      )}
      {value.map((item, i) => (
        <div className="le-row" key={i}>
          {!cols ? (
            <input style={{ flex: 1 }} value={item} onChange={(e) => upd(i, e.target.value)} />
          ) : (
            cols.map(([k, , type]) =>
              type === 'bool' ? (
                <select key={k} style={{ flex: 1 }} value={item[k] ? 'Oui' : 'Non'} onChange={(e) => upd(i, { ...item, [k]: e.target.value === 'Oui' })}>
                  <option>Oui</option>
                  <option>Non</option>
                </select>
              ) : (
                <input
                  key={k}
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
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onChange(value.filter((_, j) => j !== i))} title="Retirer">
              ✕
            </button>
          )}
        </div>
      ))}
      {!fixedLength && value.length < max && (
        <button className="btn sm" onClick={() => onChange([...value, cols ? Object.fromEntries(cols.map(([k, , t]) => [k, t === 'num' ? 0 : t === 'bool' ? false : ''])) : ''])}>
          + Ajouter
        </button>
      )}
      {!fixedLength && <div className="tiny muted" style={{ marginTop: 4 }}>Maximum {max} (limite du fichier Excel)</div>}
    </div>
  )
}

function normalize(s) {
  const out = JSON.parse(JSON.stringify(s))
  NUM_GROUPS.forEach(([, g, fields]) => fields.forEach(([k, , t]) => t !== 'text' && (out[g][k] = Number(String(out[g][k]).replace(',', '.')) || 0)))
  LIST_DEFS.forEach(([key, , cols]) => {
    if (!cols) out[key] = out[key].map((x) => x.trim()).filter(Boolean)
    else {
      out[key] = out[key]
        .map((it) => Object.fromEntries(cols.map(([k, , t]) => [k, t === 'num' ? Number(it[k]) || 0 : t === 'bool' ? !!it[k] : String(it[k] ?? '').trim()])))
        .filter((it) => it.nom)
    }
  })
  return out
}

export default function Parametres() {
  const { settings, prospects, actions, api, toast } = useApp()
  const [s, setS] = useState(() => JSON.parse(JSON.stringify(settings)))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [imp, setImp] = useState(null)
  const fileRef = useRef()
  const change = (next) => {
    setS(next)
    setDirty(true)
  }

  const save = async () => {
    await api.saveSettings(normalize(s))
    setDirty(false)
    toast('Paramètres enregistrés ✓')
  }

  const exportXlsx = async () => {
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
      const parsed = parseExcel(new Uint8Array(await file.arrayBuffer()))
      setImp({ ...parsed, file: file.name, replace: prospects.length === 0, withSettings: true })
    } catch (err) {
      toast(err.message, true)
    }
  }
  const runImport = async () => {
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

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Paramètres</h1>
          <div className="sub">Tes réglages au même endroit, comme l'onglet Paramètres du fichier Excel.</div>
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

      <div className="card">
        <h2 className="section">📁 Fichier Excel</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Le CRM est ta base principale. L'export génère ton fichier de pilotage complet (Saisie remplie, tous les onglets et calculs,
          Paramètres à jour). L'import reprend ce que tu as saisi dans le fichier Excel.
        </p>
        <div className="row">
          <button className="btn primary" disabled={!!busy} onClick={exportXlsx}>
            {busy === 'export' ? 'Préparation…' : '⬇ Exporter vers Excel'}
          </button>
          <button className="btn" disabled={!!busy} onClick={() => fileRef.current.click()}>
            ⬆ Importer un fichier Excel
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
              <input type="radio" checked={imp.replace} onChange={() => setImp({ ...imp, replace: true })} /> Remplacer toutes mes données
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

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {NUM_GROUPS.map(([title, g, fields]) => (
          <div className="card" key={g}>
            <h2 className="section">{title}</h2>
            <div className="stack" style={{ gap: 10 }}>
              {fields.map(([k, label, t]) => (
                <div className="row" key={k} style={{ flexWrap: 'nowrap' }}>
                  <span className="small" style={{ flex: 1 }}>
                    {label}
                  </span>
                  <input
                    className="input"
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
        ))}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {LIST_DEFS.map(([key, title, cols]) => (
          <div className="card" key={key}>
            <h2 className="section">{title}</h2>
            <ListEditor
              value={s[key]}
              cols={cols}
              max={LIST_CAPACITY[key]}
              fixedLength={key === 'etapes'}
              onChange={(v) => change({ ...s, [key]: v })}
            />
            {key === 'actions' && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Étape atteinte : 1 Nouveau, 2 Contacté, 3 Qualifié, 4 Audit/Démo, 5 RDV, 6 Proposition, 7 Gagné. Garde les noms des actions de vente
                (Proposition envoyée, Signature, Paiement reçu…) : les calculs s'appuient dessus.
              </div>
            )}
          </div>
        ))}
        <div className="card">
          <h2 className="section">📞 Script d'appel</h2>
          {s.script.map((x, i) => (
            <Field key={i} label={x.titre} style={{ marginBottom: 10 }}>
              <textarea value={x.texte} onChange={(e) => change({ ...s, script: s.script.map((y, j) => (j === i ? { ...y, texte: e.target.value } : y)) })} />
            </Field>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="section">Compte</h2>
        <div className="row">
          {isLocal ? (
            <span className="small muted">Mode démo : les données sont enregistrées dans ce navigateur uniquement.</span>
          ) : (
            <button className="btn" onClick={() => supabase.auth.signOut()}>
              Se déconnecter
            </button>
          )}
          <button
            className="btn ghost sm"
            onClick={() => window.confirm('Remettre les paramètres par défaut du fichier Excel ?') && change(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))}
          >
            Paramètres par défaut
          </button>
        </div>
      </div>
    </div>
  )
}
