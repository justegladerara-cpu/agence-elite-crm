// Établissements : les boutiques ou points de vente de l'entreprise, chacun avec sa caisse et son ticket Z
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Modal, Kpi, eur, nb, go } from '../ui'
import { uid, peut } from '../lib/store'
import { etablissementsDe, etabDe, etabCourant, choisirEtab } from '../lib/etablissements'
import { ventesDe } from '../lib/magasin'
import { today } from '../lib/dates'

function EtabForm({ etab, liste, onSave, onClose }) {
  const [f, setF] = useState({ nom: '', adresse: '', telephone: '', responsable: '', ...etab })
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const { toast } = useApp()
  const save = async () => {
    const nom = f.nom.trim()
    if (!nom) return toast("Donne un nom à l'établissement", true)
    if (liste.some((e) => e.id !== f.id && e.nom.trim().toLowerCase() === nom.toLowerCase())) return toast('Un établissement porte déjà ce nom', true)
    setBusy(true)
    const ok = await onSave({ ...f, nom, adresse: f.adresse.trim(), telephone: f.telephone.trim(), responsable: f.responsable.trim() })
    if (!ok) setBusy(false)
  }
  return (
    <Modal title={etab?.id ? `Modifier ${etab.nom}` : 'Nouvel établissement'} onClose={onClose}>
      <div className="stack">
        <Field label="Nom">
          <input className="input" id="et-nom" autoFocus value={f.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Ex. Boutique Pointe-Noire centre-ville" />
        </Field>
        <Field label="Adresse">
          <textarea className="input" id="et-adresse" rows={2} value={f.adresse} onChange={(e) => set({ adresse: e.target.value })} placeholder="Ex. Avenue Charles de Gaulle, Pointe-Noire" />
        </Field>
        <div className="grid grid-2">
          <Field label="Téléphone">
            <input className="input" id="et-tel" inputMode="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} />
          </Field>
          <Field label="Responsable">
            <input className="input" id="et-resp" value={f.responsable} onChange={(e) => set({ responsable: e.target.value })} placeholder="Ex. Narcie KANGOU" />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy} onClick={save}>
            <Icon n="check" size={16} /> Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Etablissements() {
  const { settings, documents, actions, api, toast, profil } = useApp()
  const gerer = peut(profil, 'reglages')
  const liste = useMemo(() => etablissementsDe(settings), [settings])
  const [modal, setModal] = useState(null)
  const [retrait, setRetrait] = useState(null)
  const [, maj] = useState(0)
  const ici = etabCourant(settings)
  const stats = useMemo(() => {
    const out = {}
    const ventes = ventesDe(documents, actions)
    liste.forEach((e) => (out[e.id] = { jour: 0, mois: 0, n: 0 }))
    const t = today()
    ventes.forEach((v) => {
      const s = out[etabDe(v.doc, liste)]
      if (!s) return
      s.n++
      if (v.date === t) s.jour += v.total
      if (v.date.slice(0, 7) === t.slice(0, 7)) s.mois += v.total
    })
    return out
  }, [documents, actions, liste])
  // L'établissement implicite « Magasin principal » devient réel dès qu'on enregistre la liste
  const enregistrer = async (nouvelle, msg) => {
    try {
      await api.saveSettings({ ...settings, etablissements: nouvelle })
      toast(msg)
      return true
    } catch {
      return false
    }
  }
  const sauver = async (e) => {
    const base = (settings.etablissements || []).length ? settings.etablissements : liste
    const existe = e.id && base.some((x) => x.id === e.id)
    const ok = await enregistrer(existe ? base.map((x) => (x.id === e.id ? e : x)) : [...base, { ...e, id: e.id || uid() }], existe ? 'Établissement modifié ✓' : `${e.nom} ajouté ✓`)
    if (ok) setModal(null)
    return ok
  }
  const retirer = async (e) => {
    if (stats[e.id]?.n) {
      // Des ventes y sont rattachées : on le masque sans perdre l'historique
      await enregistrer(settings.etablissements.map((x) => (x.id === e.id ? { ...x, archive: true } : x)), `${e.nom} n'est plus proposé (ses ventes restent dans l'historique) ✓`)
    } else await enregistrer(settings.etablissements.filter((x) => x.id !== e.id), `${e.nom} retiré ✓`)
    setRetrait(null)
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Établissements</h1>
          <div className="sub">Tes boutiques ou points de vente. Chaque caisse travaille pour un établissement, et chaque établissement a son ticket Z en fin de journée.</div>
        </div>
        {gerer && (
          <button className="btn primary" onClick={() => setModal({})}>
            <Icon n="plus" size={16} /> Nouvel établissement
          </button>
        )}
      </div>
      <div className="grid grid-3">
        <Kpi label="Établissements" value={nb(liste.length)} navy />
        <Kpi label="Ventes du jour (tous)" value={eur(Object.values(stats).reduce((m, s) => m + s.jour, 0))} />
        <Kpi label="Ventes du mois (tous)" value={eur(Object.values(stats).reduce((m, s) => m + s.mois, 0))} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="table-wrap">
          <table className="t ztable">
            <thead>
              <tr>
                <th>Établissement</th>
                <th className="hide-m">Responsable</th>
                <th className="num">Aujourd'hui</th>
                <th className="num hide-m">Ce mois</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="strong">
                      {e.nom} {e.id === ici.id && <span className="badge b-green">cet appareil</span>}
                    </div>
                    <div className="tiny muted">{[e.adresse?.split('\n')[0], e.telephone].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="hide-m">{e.responsable || '—'}</td>
                  <td className="num">{eur(stats[e.id]?.jour || 0)}</td>
                  <td className="num hide-m">{eur(stats[e.id]?.mois || 0)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {e.id !== ici.id && liste.length > 1 && (
                      <button className="btn sm" onClick={() => { choisirEtab(e.id); maj((x) => x + 1); toast(`Cet appareil vend maintenant pour ${e.nom} ✓`) }}>
                        Utiliser ici
                      </button>
                    )}{' '}
                    <button className="btn sm" onClick={() => go(`/cloture?e=${e.id}`)}>Ticket Z</button>{' '}
                    {gerer && (
                      <button className="btn sm ghost" onClick={() => setModal(e)} title="Modifier" aria-label={`Modifier ${e.nom}`}>
                        <Icon n="edit" size={14} />
                      </button>
                    )}
                    {gerer && liste.length > 1 && (retrait === e.id ? (
                      <>
                        <button className="btn sm danger" onClick={() => retirer(e)}>Retirer</button>
                        <button className="btn sm" onClick={() => setRetrait(null)}>Non</button>
                      </>
                    ) : (
                      <button className="btn sm ghost" onClick={() => setRetrait(e.id)} title="Retirer" aria-label={`Retirer ${e.nom}`}>
                        <Icon n="trash" size={14} />
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          « Utiliser ici » règle cet appareil (ordinateur, tablette ou téléphone de la boutique) : ses ventes iront à cet établissement. On peut aussi changer d'établissement depuis la caisse. Le stock des articles est commun à tous les établissements.
        </div>
      </div>
      {modal && <EtabForm etab={modal} liste={liste} onSave={sauver} onClose={() => setModal(null)} />}
    </>
  )
}
