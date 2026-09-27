// Prospection Instagram express : ajout en quelques secondes, étapes en 1 clic, scripts prêts à copier.
import { useEffect, useRef, useState } from 'react'
import { useApp, Modal, Field, go, RelanceTag } from '../ui'
import { Icon } from '../icons'
import { fmtDate } from '../lib/dates'
import { instaLink, handleInsta, doublonInsta, actionRank } from '../lib/logic'
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

// Un seul enregistrement à la fois par prospect (la barre et la carte « Prochaine étape » partagent ce verrou)
const enCours = new Set()

// Process Instagram : état des 7 étapes et actions (enregistrer, annuler, réaction à la Loom)
function useProcess(p) {
  const { api, settings, data, toast, openAction } = useApp()
  const [busy, setBusy] = useState(false)
  const etats = ETAPES.map((e) => ({ ...e, ok: e.fait(p, data.L) }))
  const courante = etats.findIndex((e) => !e.ok)
  const apresLoom = etats[3].ok && !etats[4].ok
  const lastLoom = [...p.acts].reverse().find((a) => a.action === 'Loom envoyé')
  const reaction = lastLoom && p.acts.some((a) => a.date >= lastLoom.date && a !== lastLoom && a.action !== 'Loom envoyé' && a.resultat)
  const enregistrer = async (row, msg) => {
    if (enCours.has(p.id)) return
    enCours.add(p.id)
    setBusy(true)
    try {
      await api.addActions([ligne(p.id, row)])
      toast(`${msg} ✓${row.date_relance ? ` Relance le ${fmtDate(row.date_relance)}` : ''}`)
    } catch {
      // erreur déjà affichée
    }
    enCours.delete(p.id)
    setBusy(false)
  }
  // Étape déjà faite : on propose de l'annuler (supprime l'action qu'elle a enregistrée)
  // On n'annule que la dernière étape faite, et seulement si supprimer son action la décoche vraiment
  const annuler = async (e) => {
    const derniere = [...etats].reverse().find((x) => x.ok)
    if (derniere && derniere.id !== e.id) return toast(`Annule d'abord la dernière étape faite : « ${derniere.label} ».`, true)
    const a = actionEtape(e, p, settings)
    const reste = a && p.acts.filter((x) => x.id !== a.id)
    const niveau = reste ? Math.max(1, ...reste.map((x) => actionRank(x, data.L))) : 0
    if (!a || e.fait({ ...p, acts: reste, niveau }, data.L))
      return toast(`« ${e.label} » vient aussi d'autres actions : modifie-les dans l'onglet Historique.`, true)
    if (!window.confirm(`Annuler « ${e.label} » ? L'action du ${fmtDate(a.date)} sera supprimée de l'historique.`)) return
    if (enCours.has(p.id)) return
    enCours.add(p.id)
    setBusy(true)
    try {
      await api.deleteAction(a.id)
      toast(`« ${e.label} » annulé`)
    } catch {
      // erreur déjà affichée
    }
    enCours.delete(p.id)
    setBusy(false)
  }
  const cliquer = async (e) => {
    if (e.ok) return annuler(e)
    if (e.id === 'signe') return openAction({ prospect_id: p.id, action: 'Signature', canal: p.canal })
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
  return { etats, courante, apresLoom, reaction, busy, cliquer, enregistrer }
}

// Barre d'étapes façon Zoho (en haut de la fiche) : clic = enregistrer l'étape, clic sur une étape faite = l'annuler
export function ProcessBar({ p }) {
  const { etats, courante, busy, cliquer } = useProcess(p)
  const bar = useRef(null)
  // Sur téléphone, la barre défile pour montrer l'étape en cours
  useEffect(() => {
    const el = bar.current
    const cur = el?.querySelector('.stage.current')
    if (el && cur && el.scrollWidth > el.clientWidth) el.scrollLeft = cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2
  }, [courante, p.id])
  return (
    <div className="stagebar" role="list" aria-label="Process Instagram" ref={bar}>
      {etats.map((e, i) => {
        const cls = e.ok ? 'done' : i === courante ? 'current' : ''
        return (
          <button
            key={e.id}
            type="button"
            role="listitem"
            className={`stage ${cls}`}
            disabled={busy}
            onClick={() => cliquer(e)}
            title={e.ok ? `${e.label} : fait. Clique pour annuler` : `Marquer « ${e.label} »`}
          >
            <span className="stage-n">{e.ok ? '✓' : i + 1}</span>
            <span className="stage-l">{e.label}</span>
            {e.ok && <span className="stage-x" aria-hidden="true">✕</span>}
          </button>
        )
      })}
    </div>
  )
}

// Carte « Prochaine étape » : ce qu'il faut faire maintenant, en 1 clic
export function ProchaineEtape({ p }) {
  const { etats, courante, apresLoom, reaction, busy, cliquer, enregistrer } = useProcess(p)
  const suivante = courante >= 0 ? etats[courante] : null
  return (
    <div className="card next-card">
      <h2 className="section">
        <span className="sec-ic"><Icon n="bolt" size={16} /></span> Prochaine étape
      </h2>
      <div className="next-main">
        <div className="li-main">
          <div className="bold">{p.prochaineAction || (suivante ? suivante.label : 'Rien de prévu')}</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {p.relance ? <RelanceTag date={p.relance} heure={p.heureRappel} /> : 'Pas de relance programmée'}
            {p.tentatives ? ` · ${p.tentatives} tentative${p.tentatives > 1 ? 's' : ''}, ${p.reponses} réponse${p.reponses > 1 ? 's' : ''}` : ''}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 12 }}>
        {suivante && (
          <button type="button" className="btn sm gold" disabled={busy} onClick={() => cliquer(suivante)}>
            ✓ {suivante.label}
          </button>
        )}
        {p.tentatives > 0 && <RelanceBoutons p={p} />}
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
      <div className="tiny muted" style={{ marginTop: 10 }}>Les étapes en haut se cochent d'un clic ; clique sur une étape faite (✓) pour l'annuler.</div>
    </div>
  )
}

// Messages prêts à copier, en 2 panneaux : la liste à gauche, le texte rempli à droite
export function ScriptsCard({ p }) {
  const { settings, toast } = useApp()
  const groupes = [
    ['Premier contact et suivi', settings.scriptsDM || []],
    ['Relances', settings.messagesRelance || []],
  ].filter(([, l]) => l.length)
  const tous = groupes.flatMap(([g, l]) => l.map((s, i) => ({ ...s, g, k: `${g}-${i}` })))
  const [choix, setChoix] = useState(0)
  if (!tous.length) return null
  const sel = tous[Math.min(choix, tous.length - 1)]
  const txt = remplir(sel.texte, p)
  const copierTxt = async (ouvrir) => {
    const ok = await copier(txt)
    toast(ok ? (ouvrir ? 'Copié ✓ Colle-le dans le DM' : 'Copié ✓') : 'Copie impossible', !ok)
    if (ouvrir && p?.fiche?.instagram) window.open(instaLink(p.fiche.instagram), '_blank', 'noreferrer')
  }
  return (
    <div className="card flush msg-pane">
      <div className="msg-list">
        {groupes.map(([g]) => (
          <div key={g}>
            <div className="msg-grp">{g}</div>
            {tous
              .map((s, i) => [s, i])
              .filter(([s]) => s.g === g)
              .map(([s, i]) => (
                <button key={s.k} type="button" className={`msg-item ${sel === s ? 'on' : ''}`} onClick={() => setChoix(i)}>
                  {s.titre}
                </button>
              ))}
          </div>
        ))}
        <button type="button" className="toggle-link msg-edit" onClick={() => go('/parametres/scripts')}>
          Modifier mes messages
        </button>
      </div>
      <div className="msg-view">
        <div className="msg-head">
          <div className="bold">{sel.titre}</div>
          <div className="tiny muted">{sel.g}</div>
        </div>
        <div className="msg-txt">{txt}</div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn sm primary" onClick={() => copierTxt(false)}>
            <Icon n="copy" size={14} /> Copier
          </button>
          {p?.fiche?.instagram && (
            <button type="button" className="btn sm" onClick={() => copierTxt(true)}>
              <Icon n="instagram" size={14} /> Copier et ouvrir le DM
            </button>
          )}
        </div>
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
