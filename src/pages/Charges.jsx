// Hub Charges : ce que coûte le fonctionnement de l'agence (abonnements, charges fixes, dépenses notées)
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, Modal, Chips, Repartition, eur, nb, pct, lbl, go, confirmer } from '../ui'

import { PERIODICITES, estActif, mensuel, chargesFixesMois, prochaineEcheance, echeancesEntre } from '../lib/tresorerie'
import { num } from '../modules/facturation'
import { today, fmtDate, fmtMonth, monthKey, prevMonth, addDays, diffDays } from '../lib/dates'

const PERIODE_NOM = Object.fromEntries(PERIODICITES.map(([k, l]) => [k, l.replace('Par ', '/ ')]))
const dansLeMois = (a, key) => (a.date || '').slice(0, 7) === key

// ---------- Vue d'ensemble ----------
export function ChargesVue() {
  const { actions, settings } = useApp()
  const liste = settings.depensesFixes || []
  const jour = today()
  const cle = monthKey(jour)
  const fixes = chargesFixesMois(liste)
  const depMois = actions.filter((a) => a.action === 'Dépense' && dansLeMois(a, cle))
  const variables = depMois.reduce((m, a) => m + num(a.montant), 0)
  const encaisse = actions.filter((a) => a.action === 'Paiement reçu' && dansLeMois(a, cle)).reduce((m, a) => m + num(a.montant), 0)
  const total = fixes + variables
  const echeances = echeancesEntre(liste, jour, addDays(jour, 30))
  // Répartition du mois : charges fixes (au prorata du mois) et dépenses notées, par catégorie
  const parCategorie = (() => {
    const m = {}
    liste.forEach((d) => {
      const v = mensuel(d)
      if (v > 0) m[d.categorie || 'Charges fixes'] = (m[d.categorie || 'Charges fixes'] || 0) + v
    })
    depMois.forEach((a) => (m[a.categorie || 'Sans catégorie'] = (m[a.categorie || 'Sans catégorie'] || 0) + num(a.montant)))
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  })()
  // Six derniers mois : ce qui est entré, ce qui est sorti, ce qui reste
  const historique = (() => {
    const mois = []
    let k = cle
    for (let i = 0; i < 6; i++) {
      mois.push(k)
      k = prevMonth(k)
    }
    return mois.map((key) => {
      const entre = actions.filter((a) => a.action === 'Paiement reçu' && dansLeMois(a, key)).reduce((m, a) => m + num(a.montant), 0)
      const note = actions.filter((a) => a.action === 'Dépense' && dansLeMois(a, key)).reduce((m, a) => m + num(a.montant), 0)
      return { key, entre, sorti: note + fixes, reste: entre - note - fixes }
    })
  })()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Charges</h1>
          <div className="sub">Ce que coûte le fonctionnement de l'agence en {fmtMonth(cle).toLowerCase()}.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go('/abonnements?nouveau=1')}>
            <Icon n="plus" size={14} /> Abonnement
          </button>
          <button className="btn gold" onClick={() => go('/depenses?nouveau=1')}>
            <Icon n="plus" size={14} /> Dépense
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <Kpi label="Charges fixes / mois" value={eur(fixes)} navy onClick={() => go('/abonnements')} />
        <Kpi label="Dépenses notées ce mois" value={eur(variables)} navy onClick={() => go('/depenses')} />
        <Kpi label="Total du mois" value={eur(total)} />
        <Kpi label={encaisse ? `Couvert par l'encaissé (${pct(total ? encaisse / total : 1)})` : 'Encaissé ce mois'} value={eur(encaisse)} />
      </div>

      <div className="grid fin-grid">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="section" style={{ margin: 0 }}>
              <span className="sec-ic"><Icon n="calendar" size={16} /></span> À payer dans les 30 jours
            </h2>
            <span className="spacer" />
            <button className="toggle-link tiny" onClick={() => go('/abonnements')}>
              Tout voir
            </button>
          </div>
          <div className="list">
            {echeances.length === 0 && (
              <Empty>
                Aucune échéance datée. Indique la date de paiement de tes abonnements pour les voir arriver ici.
              </Empty>
            )}
            {echeances.slice(0, 8).map((e) => {
              const dans = diffDays(e.date, jour)
              return (
                <div key={`${e.d.nom}-${e.date}`} className="list-item">
                  <div className="li-main">
                    <div className="li-title">{e.d.nom}</div>
                    <div className="li-sub">
                      {[fmtDate(e.date), dans === 0 ? "aujourd'hui" : dans === 1 ? 'demain' : `dans ${dans} jours`, e.d.fournisseur].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="li-side">
                    <b>{eur(e.montant)}</b>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="chart" size={16} /></span> Où part l'argent ce mois
          </h2>
          <Repartition rows={parCategorie} empty="Aucune charge ce mois." />
        </div>
      </div>

      <div className="card">
        <h2 className="section">
          <span className="sec-ic"><Icon n="coins" size={16} /></span> Six derniers mois
        </h2>
        <div className="table-wrap">
          <table className="t charges-histo">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="num">Encaissé</th>
                <th className="num">Charges</th>
                <th className="num">Il reste</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((h) => (
                <tr key={h.key}>
                  <td>{fmtMonth(h.key)}</td>
                  <td className="num">{eur(h.entre)}</td>
                  <td className="num">{eur(h.sorti)}</td>
                  <td className={`num bold ${h.reste < 0 ? 'red' : 'green'}`}>{eur(h.reste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>
          Charges = dépenses notées + charges fixes actuelles ({eur(fixes)} par mois).
        </div>
      </div>
    </div>
  )
}

// ---------- Abonnements et charges fixes ----------
export function Abonnements({ nouveau }) {
  const { settings, api, toast } = useApp()
  const liste = useMemo(() => settings.depensesFixes || [], [settings.depensesFixes])
  const [modal, setModal] = useState(nouveau ? { i: -1 } : null)
  const jour = today()
  const enregistrer = async (nouvelle, msg) => {
    await api.saveSettings({ ...settings, depensesFixes: nouvelle })
    if (msg) toast(msg)
  }
  const actifs = liste.filter((d) => estActif(d) && num(d.montant) > 0)
  const mois = chargesFixesMois(liste)
  const tri = liste
    .map((d, i) => ({ d, i, e: prochaineEcheance(d, jour) }))
    .sort((a, b) => Number(estActif(b.d)) - Number(estActif(a.d)) || (a.e || '9999').localeCompare(b.e || '9999') || mensuel(b.d) - mensuel(a.d))

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Abonnements et charges fixes</h1>
          <div className="sub">Loyer, internet, logiciels… comptés automatiquement chaque mois dans ton tableau de bord.</div>
        </div>
        <button className="btn gold" onClick={() => setModal({ i: -1 })}>
          <Icon n="plus" size={14} /> Abonnement
        </button>
      </div>

      <div className="grid grid-3">
        <Kpi label="Par mois" value={eur(mois)} navy />
        <Kpi label="Par an" value={eur(mois * 12)} />
        <Kpi label="Abonnements actifs" value={nb(actifs.length)} />
      </div>

      <div className="card">
        <div className="list">
          {liste.length === 0 && <Empty>Aucun abonnement. Ajoute ton loyer, ton forfait internet ou tes logiciels.</Empty>}
          {tri.map(({ d, i, e }) => {
            const actif = estActif(d)
            const retard = e && diffDays(e, jour) <= 3
            return (
              <div key={i} className={`list-item click abo ${actif ? '' : 'abo-off'}`} onClick={() => setModal({ i })}>
                <div className="li-main">
                  <div className="li-title">
                    {d.nom || 'Sans nom'}
                    {!actif && <span className="tag">En pause</span>}
                  </div>
                  <div className="li-sub">
                    {[d.categorie, d.fournisseur, e && `prochain paiement le ${fmtDate(e)}`].filter(Boolean).join(' · ') || 'Aucune date de paiement'}
                  </div>
                </div>
                <div className="li-side abo-side">
                  <b className={retard && actif ? 'orange' : ''}>
                    {eur(num(d.montant))} <span className="muted tiny">{PERIODE_NOM[d.periodicite || 'mois']}</span>
                  </b>
                  {actif && d.periodicite && d.periodicite !== 'mois' && <span className="tiny muted">soit {eur(mensuel(d))} / mois</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <Modal title={modal.i >= 0 ? "Modifier l'abonnement" : 'Nouvel abonnement'} onClose={() => setModal(null)}>
          <AbonnementForm
            poste={modal.i >= 0 ? liste[modal.i] : null}
            onSave={async (p) => {
              await enregistrer(modal.i >= 0 ? liste.map((x, j) => (j === modal.i ? p : x)) : [...liste, p], 'Abonnement enregistré ✓')
              setModal(null)
            }}
            onDelete={
              modal.i >= 0
                ? async () => {
                    if (!(await confirmer(`Supprimer « ${liste[modal.i].nom} » ?`, { ok: 'Supprimer', danger: true }))) return
                    await enregistrer(liste.filter((_, j) => j !== modal.i), 'Abonnement supprimé')
                    setModal(null)
                  }
                : null
            }
          />
        </Modal>
      )}
    </div>
  )
}

function AbonnementForm({ poste, onSave, onDelete }) {
  const { settings } = useApp()
  const cats = settings.categoriesDepenses || []
  const [f, setF] = useState({ nom: '', montant: '', periodicite: 'mois', echeance: '', categorie: '', fournisseur: '', ...(poste || {}), actif: estActif(poste || {}) })
  const set = (x) => setF((v) => ({ ...v, ...x }))
  const [busy, setBusy] = useState(false)
  const ok = f.nom.trim() && num(f.montant) > 0
  const save = async () => {
    if (!ok) return
    setBusy(true)
    try {
      await onSave({ ...f, nom: f.nom.trim(), montant: num(f.montant), fournisseur: (f.fournisseur || '').trim() })
    } catch {
      setBusy(false)
    }
  }
  const choix = PERIODICITES.map(([, l]) => l)
  const periodeLabel = (PERIODICITES.find((x) => x[0] === f.periodicite) || PERIODICITES[0])[1]
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Nom">
        <input placeholder="Ex. Loyer du bureau, Canal+, Canva Pro" autoFocus={!poste} value={f.nom} onChange={(e) => set({ nom: e.target.value })} />
      </Field>
      <div className="form-grid tight">
        <Field label={lbl('Montant (€)')}>
          <input inputMode="decimal" placeholder="Ex. 25 000" value={f.montant} onChange={(e) => set({ montant: e.target.value })} />
        </Field>
        <Field label="Prochain paiement">
          <input type="date" value={f.echeance || ''} onChange={(e) => set({ echeance: e.target.value })} />
        </Field>
      </div>
      <Field label="Je paie">
        <Chips options={choix} value={periodeLabel} allowEmpty={false} onChange={(l) => set({ periodicite: PERIODICITES.find((x) => x[1] === l)[0] })} />
      </Field>
      {f.periodicite !== 'mois' && num(f.montant) > 0 && (
        <div className="tiny muted">Compté {eur(mensuel({ ...f, actif: true }))} par mois dans ton tableau de bord.</div>
      )}
      <div className="form-grid tight">
        <Field label="Catégorie">
          <select value={f.categorie || ''} onChange={(e) => set({ categorie: e.target.value })}>
            <option value="">—</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {f.categorie && !cats.includes(f.categorie) && <option>{f.categorie}</option>}
          </select>
        </Field>
        <Field label="Fournisseur">
          <input placeholder="Ex. MTN, Airtel, Adobe" value={f.fournisseur || ''} onChange={(e) => set({ fournisseur: e.target.value })} />
        </Field>
      </div>
      <label className="check-row small">
        <input type="checkbox" checked={f.actif} onChange={(e) => set({ actif: e.target.checked })} /> Actif (décoche pour le mettre en pause sans le supprimer)
      </label>
      <div className="row">
        <button className="btn gold" disabled={busy || !ok} onClick={save}>
          {busy ? 'Enregistrement…' : "Enregistrer l'abonnement"}
        </button>
        <span className="spacer" />
        {onDelete && (
          <button className="btn ghost sm danger" onClick={onDelete}>
            <Icon n="trash" size={14} /> Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

