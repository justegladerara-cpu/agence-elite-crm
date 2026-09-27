// Prospection Instagram express : ajout en quelques secondes, étapes en 1 clic, scripts prêts à copier.
import { useState } from 'react'
import { useApp, Modal, Field, go } from '../ui'
import { Icon } from '../icons'
import { fmtDate } from '../lib/dates'
import { instaLink, handleInsta, doublonInsta } from '../lib/logic'
import { ETAPES, REACTIONS, ligne, remplir, copier, QUALIF, OBJECTIFS_PROSPECT, actionEtape, messageRelance, ligneRelance, numeroRelance } from '../lib/insta'

const nomDepuisCompte = (v) =>
  handleInsta(v)
    .replace(/[._]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())

// Dernier script choisi (gardé sur l'appareil)
const lirePref = (k, d) => {
  try {
    return localStorage.getItem(k) || d
  } catch {
    return d
  }
}
const ecrirePref = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // rien
  }
}

export function QuickInsta({ onClose }) {
  const { api, data, settings, toast } = useApp()
  const [compte, setCompte] = useState('')
  const [nom, setNom] = useState('')
  const [secteur, setSecteur] = useState('')
  const [produit, setProduit] = useState('')
  const [signal, setSignal] = useState('')
  const [note, setNote] = useState('')
  const [modele, setModele] = useState(() => lirePref('aecrm-modele', settings.modeles[0] || ''))
  const [busy, setBusy] = useState(false)
  const name = (nom.trim() || nomDepuisCompte(compte)).trim()
  const doublon = doublonInsta(data.list, compte)

  const save = async (envoye) => {
    if (!compte.trim() && !nom.trim()) return toast('Indique le compte Instagram', true)
    if (!name) return toast("Indique le nom de l'entreprise", true)
    if (doublon) return toast(`Ce compte est déjà dans tes prospects : ${doublon.name}`, true)
    if (data.list.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast('Ce prospect existe déjà', true)
    setBusy(true)
    try {
      const h = handleInsta(compte)
      const handle = h ? `@${h}` : compte.trim()
      const fiche = Object.fromEntries(
        Object.entries({ instagram: handle, secteur, produit: produit.trim(), signal, source: 'Publicité Instagram' }).filter(([, v]) => v),
      )
      const p = await api.addProspect(name, fiche)
      const rows = [ligne(p.id, { action: 'Ajout prospect', canal: 'DM', notes: note.trim() || undefined })]
      if (envoye) {
        ecrirePref('aecrm-modele', modele)
        rows.push(ligne(p.id, { ...ETAPES[0].row(settings), modele }))
      }
      await api.addActions(rows)
      if (envoye) {
        const s = settings.scriptsDM || []
        await copier([s[0], s[1]].filter(Boolean).map((x) => remplir(x.texte, { name, fiche })).join('\n\n'))
        toast('Prospect ajouté ✓ Script copié, colle-le dans le DM')
      } else toast('Prospect ajouté ✓')
      onClose()
      go(`/prospect/${p.id}`)
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal title="Prospect Instagram express" onClose={onClose}>
      <div className="card stack" style={{ gap: 12 }}>
        <Field label="Compte Instagram">
          <input
            autoFocus
            placeholder="@nomducompte ou lien du profil"
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            onBlur={() => handleInsta(compte) && setCompte(`@${handleInsta(compte)}`)}
          />
          {doublon && (
            <div className="doublon">
              <Icon n="alert" size={14} /> Déjà dans tes prospects : <b>{doublon.name}</b> ({doublon.etape}).{' '}
              <button type="button" className="toggle-link" onClick={() => { onClose(); go(`/prospect/${doublon.id}`) }}>
                Ouvrir sa fiche
              </button>
            </div>
          )}
          {handleInsta(compte) ? (
            <a className="insta-check" href={instaLink(compte)} target="_blank" rel="noreferrer">
              <Icon n="instagram" size={14} /> Vérifier le compte @{handleInsta(compte)} ↗
            </a>
          ) : (
            /instagram\.com|instagr\.am/i.test(compte) && (
              <div className="tiny orange" style={{ marginTop: 6 }}>
                Ce lien mène à une publication, pas au compte.{' '}
                <a href={compte.trim().startsWith('http') ? compte.trim() : `https://${compte.trim()}`} target="_blank" rel="noreferrer">
                  Ouvre-la
                </a>{' '}
                et copie le @ du compte.
              </div>
            )
          )}
        </Field>
        <Field label="Nom de l'entreprise (facultatif)">
          <input placeholder={nomDepuisCompte(compte) || 'Repris du compte'} value={nom} onChange={(e) => setNom(e.target.value)} />
        </Field>
        <div className="form-grid">
          <Field label="Secteur">
            <select value={secteur} onChange={(e) => setSecteur(e.target.value)}>
              <option value="">—</option>
              {settings.secteurs.map((x) => (
                <option key={x.nom}>{x.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Ce qu'il vend (pour le script)">
            <input placeholder="ex. vos bouquets" value={produit} onChange={(e) => setProduit(e.target.value)} />
          </Field>
        </div>
        <div>
          <div className="lbl-small">Signal repéré sur la pub</div>
          <div className="chips">
            {(settings.signaux || []).map((x) => (
              <button key={x} type="button" className={`chip ${signal === x ? 'on' : ''}`} onClick={() => setSignal(signal === x ? '' : x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <Field label="Note (facultatif)">
          <input placeholder="Ce que tu as remarqué" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Script utilisé">
          <select value={modele} onChange={(e) => setModele(e.target.value)}>
            {settings.modeles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <div className="row">
          <button className="btn gold" style={{ flex: 1 }} disabled={busy} onClick={() => save(true)}>
            <Icon n="copy" size={15} /> Ajouter + copier le script
          </button>
          <button className="btn" disabled={busy} onClick={() => save(false)}>
            Ajouter seulement
          </button>
        </div>
        <div className="tiny muted">« Ajouter + copier le script » note le script comme envoyé et programme la relance.</div>
      </div>
    </Modal>
  )
}

// Carte du process sur la fiche : où en est le prospect et le bouton de l'étape suivante
export function ProcessCard({ p }) {
  const { api, settings, data, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const L = data.L
  const etats = ETAPES.map((e) => ({ ...e, ok: e.fait(p, L) }))
  const courante = etats.findIndex((e) => !e.ok)
  const loomFaite = etats[3].ok
  const apresLoom = loomFaite && !etats[4].ok
  const lastLoom = [...p.acts].reverse().find((a) => a.action === 'Loom envoyé')
  const reaction = lastLoom && p.acts.some((a) => a.date >= lastLoom.date && a !== lastLoom && a.action !== 'Loom envoyé' && a.resultat)
  const enregistrer = async (row, msg) => {
    setBusy(true)
    try {
      await api.addActions([ligne(p.id, row)])
      toast(`${msg} ✓${row.date_relance ? ` Relance le ${fmtDate(row.date_relance)}` : ''}`)
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  // Étape déjà faite : on propose de l'annuler (supprime l'action qu'elle a enregistrée)
  const annuler = async (e) => {
    const a = actionEtape(e, p, settings)
    if (!a) return toast(`« ${e.label} » vient d'une action saisie à la main : modifie-la dans l'onglet Historique.`, true)
    if (!window.confirm(`Annuler « ${e.label} » ? L'action du ${fmtDate(a.date)} sera supprimée de l'historique.`)) return
    setBusy(true)
    try {
      await api.deleteAction(a.id)
      toast(`« ${e.label} » annulé`)
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  const cliquer = async (e) => {
    if (e.ok) return annuler(e)
    let extra = {}
    if (e.id === 'script') extra.modele = lirePref('aecrm-modele', settings.modeles[0] || '')
    if (e.id === 'loom') {
      const lien = window.prompt('Lien de la Loom (facultatif) :', p.fiche?.loom || '')
      if (lien === null) return
      if (lien.trim()) {
        await api.updateProspect(p.id, { fiche: { ...p.fiche, loom: lien.trim() } })
        extra.notes = lien.trim()
      }
    }
    await enregistrer({ ...e.row(settings), ...extra }, e.label)
  }
  return (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n="instagram" size={16} /></span> Process Instagram</h2>
      <div className="steps">
        {etats.map((e, i) => (
          <SignOrStep key={e.id} e={e} i={i} courante={courante} busy={busy} onClick={() => cliquer(e)} p={p} />
        ))}
      </div>
      {apresLoom && (
        <div className="reaction">
          <div className="small bold">Réaction à la Loom {reaction ? '(déjà notée, tu peux en ajouter une)' : ''}</div>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            {REACTIONS.map((r) => (
              <button key={r.id} className={`btn sm react-${r.tone}`} disabled={busy} onClick={() => enregistrer(r.row(), r.label)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 8 }}>Clique sur une étape faite (✓) pour l'annuler.</div>
      {p.prochaineAction && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          Prochaine action : <b>{p.prochaineAction}</b>
          {p.relance ? ` · le ${fmtDate(p.relance)}` : ''}
        </div>
      )}
    </div>
  )
}

function SignOrStep({ e, i, courante, busy, onClick, p }) {
  const { openAction } = useApp()
  const cls = e.ok ? 'done' : i === courante ? 'current' : ''
  const act = e.id === 'signe' && !e.ok ? () => openAction({ prospect_id: p.id, action: 'Signature', canal: p.canal }) : onClick
  return (
    <button type="button" className={`step ${cls}`} disabled={busy} onClick={act} title={e.ok ? 'Fait : clique pour annuler' : 'Enregistrer cette étape'}>
      <span className="step-dot">{e.ok ? '✓' : i + 1}</span>
      {e.ok && <span className="step-x" aria-hidden="true">✕</span>}
      <span className="step-l">{e.label}</span>
    </button>
  )
}

// Scripts prêts à copier, remplis avec le nom et le produit du prospect
export function ScriptsCard({ p }) {
  const { settings, toast } = useApp()
  const [ouvert, setOuvert] = useState(null)
  const scripts = [...(settings.scriptsDM || []), ...(settings.messagesRelance || [])]
  if (!scripts.length) return null
  return (
    <div className="card">
      <h2 className="section"><span className="sec-ic"><Icon n="message" size={16} /></span> Scripts à copier</h2>
      <div className="scripts">
        {scripts.map((s, i) => {
          const txt = remplir(s.texte, p)
          return (
            <div key={i} className={`script ${ouvert === i ? 'open' : ''}`}>
              <div className="script-head">
                <button type="button" className="script-t" onClick={() => setOuvert(ouvert === i ? null : i)}>
                  {s.titre}
                </button>
                <button type="button" className="btn sm" onClick={async () => toast((await copier(txt)) ? 'Copié ✓' : 'Copie impossible', false)}>
                  <Icon n="copy" size={14} /> Copier
                </button>
              </div>
              {ouvert === i && <div className="script-txt">{txt}</div>}
            </div>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        {p?.fiche?.instagram && (
          <a className="btn sm" href={instaLink(p.fiche.instagram)} target="_blank" rel="noreferrer">
            <Icon n="instagram" size={14} /> Ouvrir le compte
          </a>
        )}
        <button type="button" className="toggle-link" onClick={() => go('/parametres/scripts')}>
          Modifier mes scripts
        </button>
      </div>
    </div>
  )
}

// Qualification rapide : 5 questions Oui / Non + objectif
export function QualifCard({ p }) {
  const { api } = useApp()
  const q = p.fiche?.qualifInsta || {}
  const set = (patch) => api.updateProspect(p.id, { fiche: { ...p.fiche, qualifInsta: { ...q, ...patch } } }).catch(() => {})
  const n = QUALIF.filter(([k]) => q[k]).length
  return (
    <div className="card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="target" size={16} /></span> Qualification <span className="count">{n}/5</span>
      </h2>
      <div className="qualif">
        {QUALIF.map(([k, l]) => (
          <div key={k} className="q-row">
            <span>{l}</span>
            <div className="q-btns">
              {['Oui', 'Non'].map((v) => (
                <button key={v} type="button" className={`chip ${q[k] === v ? 'on' : ''}`} onClick={() => set({ [k]: q[k] === v ? '' : v })}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="q-row">
          <span>Objectif principal</span>
          <select className="input" style={{ width: 'auto' }} value={q.objectif || ''} onChange={(e) => set({ objectif: e.target.value })}>
            <option value="">—</option>
            {OBJECTIFS_PROSPECT.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// Relance en 1 clic : copier le message de relance adapté, puis noter « Relancé »
export function RelanceBoutons({ p, compact }) {
  const { api, settings, toast } = useApp()
  const [busy, setBusy] = useState(false)
  if (p.etape === 'Gagné' || p.etape === 'Perdu') return null
  const n = numeroRelance(p)
  const copierMsg = async (e) => {
    e.stopPropagation()
    const txt = messageRelance(p, settings)
    if (!txt) return toast('Ajoute tes messages de relance dans Paramètres > Scripts', true)
    toast((await copier(txt)) ? `Message de relance ${Math.min(n, (settings.messagesRelance || []).length)} copié ✓` : 'Copie impossible', false)
  }
  const relance = async (e) => {
    e.stopPropagation()
    setBusy(true)
    try {
      const { row, prochaine, stop } = ligneRelance(p, settings)
      await api.addActions([row])
      toast(stop ? `Relance notée ✓ C'était la dernière : ${settings.relance?.stop} tentatives sans réponse` : `Relance notée ✓ Prochaine le ${fmtDate(prochaine)}`)
    } catch {
      // erreur déjà affichée
    }
    setBusy(false)
  }
  return (
    <>
      <button type="button" className="btn sm" title={`Copier le message de relance ${n}`} onClick={copierMsg}>
        <Icon n="copy" size={14} />
        {compact ? '' : ' Message'}
      </button>
      <button type="button" className="btn sm primary" disabled={busy} title="Noter la relance et programmer la suivante" onClick={relance}>
        ✓ Relancé
      </button>
    </>
  )
}
