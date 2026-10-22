// Noter mes DM : plusieurs comptes d'un coup (un par ligne), canal et script retenus, doublons reconnus,
// relance programmée toute seule. Un compte déjà connu devient une relance au lieu d'une fiche en double.
import { useMemo, useState } from 'react'
import { Field, Modal, nb } from '../ui'
import { Icon } from '../icons'
import { useNoyau, useDonnees } from '../core/contexte'
import { addDays, fmtDate, today } from '../lib/dates'
import { handleInsta } from '../lib/logic'
import { ligne } from '../modules/commercial'
import { norm } from '../modules/activites'

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
    // appareil sans stockage : le choix n'est pas retenu
  }
}

const nomDepuis = (v) =>
  (handleInsta(v) || String(v).replace(/^@/, ''))
    .replace(/[._]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())

// Une ligne collée → compte, nom affiché et fiche déjà connue
export function lireComptes(texte, list) {
  const vus = new Set()
  return String(texte || '')
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((brut) => {
      const h = handleInsta(brut)
      const nom = nomDepuis(brut)
      const cle = h || norm(nom)
      if (!cle || vus.has(cle)) return null
      vus.add(cle)
      const connu = list.find((p) => (h && handleInsta(p.fiche?.instagram) === h) || norm(p.name) === norm(nom)) || null
      return { brut, handle: h ? `@${h}` : '', nom, connu }
    })
    .filter(Boolean)
}

export function NoterDMForm({ onDone }) {
  const { settings, api, toast } = useNoyau()
  const { data, actions = [] } = useDonnees()
  const canaux = settings.canaux || ['DM']
  const [texte, setTexte] = useState('')
  const [canal, setCanal] = useState(() => lire('aecrm-dm-canal', canaux.includes('DM') ? 'DM' : canaux[0]))
  const [modele, setModele] = useState(() => lire('aecrm-modele', settings.modeles?.[0] || ''))
  const [pub, setPub] = useState(() => lire('aecrm-dm-pub', '1') === '1')
  const [relance, setRelance] = useState(Number(settings.relance?.j1) || 2)
  const [busy, setBusy] = useState(false)
  const comptes = useMemo(() => lireComptes(texte, data.list), [texte, data.list])
  const nouveaux = comptes.filter((c) => !c.connu).length
  const t = today()
  const dmDuJour = actions.filter((a) => a.date === t && a.canal === 'DM' && ['Premier contact', 'Relance'].includes(a.action)).length
  const objectif = Number(settings.objectifsJour?.dm) || 0

  const enregistrer = async () => {
    if (!comptes.length) return toast('Colle au moins un compte ou un nom', true)
    setBusy(true)
    ecrire('aecrm-dm-canal', canal)
    ecrire('aecrm-modele', modele)
    ecrire('aecrm-dm-pub', pub ? '1' : '0')
    try {
      const rows = []
      const date_relance = addDays(t, relance)
      for (const c of comptes) {
        let id = c.connu?.id
        if (!id) {
          const fiche = Object.fromEntries(Object.entries({ instagram: c.handle, source: pub ? 'Publicité Instagram' : canal === 'DM' ? 'Instagram' : canal }).filter(([, v]) => v))
          const p = await api.addProspect(c.nom, fiche)
          id = p.id
          rows.push(ligne(id, { action: 'Ajout prospect', canal }))
        }
        rows.push(
          ligne(id, {
            canal,
            action: c.connu ? 'Relance' : 'Premier contact',
            modele: modele || undefined,
            prochaine_action: 'Relancer si pas de réponse',
            date_relance,
          }),
        )
      }
      await api.addActions(rows)
      toast(`${nb(comptes.length)} DM notés ✓ · ${nb(nouveaux)} nouveaux prospects · relance le ${fmtDate(date_relance)}`)
      onDone?.()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="dm-compteur">
        <strong>{nb(dmDuJour)}</strong> DM aujourd’hui{objectif ? ` sur ${nb(objectif)}` : ''}
        {objectif > 0 && (
          <span className="dm-barre" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (dmDuJour / objectif) * 100)}%` }} />
          </span>
        )}
      </div>
      <Field label="Comptes contactés" hint="Un par ligne : @compte, lien du profil ou nom de l’entreprise">
        <textarea className="input" rows={6} autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={'@entreprise_x\n@resto_y\nhttps://instagram.com/boutique_z'} />
      </Field>
      {comptes.length > 0 && (
        <ul className="dm-liste">
          {comptes.map((c) => (
            <li key={c.brut} className={c.connu ? 'connu' : ''}>
              <Icon n={c.connu ? 'repeat' : 'plus'} size={13} />
              <span className="bold">{c.connu?.name || c.nom}</span>
              {c.handle && <span className="muted"> {c.handle}</span>}
              {c.connu && <span className="tiny muted"> · déjà dans tes prospects : noté comme relance</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-2">
        <Field label="Canal">
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
            {canaux.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Script envoyé">
          <select className="input" value={modele} onChange={(e) => setModele(e.target.value)}>
            <option value="">—</option>
            {(settings.modeles || []).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="row small">
        <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Repérés grâce à une publicité
      </label>
      <Field label="Relancer s’ils ne répondent pas">
        <div className="chips">
          {[1, 2, 3, 5, 7].map((j) => (
            <button key={j} type="button" className={`chip ${relance === j ? 'on' : ''}`} onClick={() => setRelance(j)}>
              dans {j} j
            </button>
          ))}
        </div>
      </Field>
      <div className="vr-pied">
        <div className="small muted">{comptes.length ? `${nb(comptes.length)} compte(s) · ${nb(nouveaux)} nouveau(x)` : 'Rien à noter pour l’instant'}</div>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy || !comptes.length}>
          <Icon n="check" size={16} /> Noter {comptes.length || ''} DM
        </button>
      </div>
    </div>
  )
}

export default function NoterDM({ onClose }) {
  return (
    <Modal title="Noter mes DM" onClose={onClose}>
      <NoterDMForm onDone={onClose} />
    </Modal>
  )
}
