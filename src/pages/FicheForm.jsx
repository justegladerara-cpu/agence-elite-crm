// Formulaire de fiche prospect (création et modification) : rubriques, champs avec icône,
// choix en pastilles pour les listes courtes, liste avec recherche pour les longues.
import { useMemo, useState } from 'react'
import { useApp, lbl, Choix } from '../ui'
import { Icon } from '../icons'
import { FICHE_FIELDS, LISTES } from '../lib/defaults'
import { handleInsta, doublonInsta, instaLink } from '../lib/logic'

// Rubriques du formulaire (et de l'onglet Informations de la fiche)
export const GROUPES_FICHE = [
  { id: 'contact', titre: 'Contact', ico: 'users', sous: 'Qui joindre et comment', keys: ['contact', 'fonction', 'telephone', 'whatsapp', 'instagram', 'site'] },
  { id: 'entreprise', titre: 'Entreprise', ico: 'handshake', sous: 'Activité, lieu et taille', keys: ['secteur', 'produit', 'ville', 'zone', 'taille', 'standard', 'concurrent'] },
  { id: 'origine', titre: 'Origine et visibilité', ico: 'radio', sous: "D'où il vient, sa présence en ligne", keys: ['source', 'recommande_par', 'signal', 'pub_active', 'date_pub', 'budget_pub', 'presence_google', 'note_google', 'nb_avis'] },
  { id: 'offre', titre: 'Offre et qualification', ico: 'target', sous: 'Ce que tu lui proposes', keys: ['offre', 'abonnement', 'budget_ok', 'decideur', 'besoin', 'delai'] },
]

// Champs propres à la prospection Instagram (hors colonnes Excel)
const EXTRA = [
  { key: 'produit', label: 'Ce qu’il vend (pour les scripts)' },
  { key: 'signal', label: 'Signal repéré', list: 'signaux' },
]
export const TOUS_CHAMPS = [...FICHE_FIELDS, ...EXTRA]

const META = {
  contact: { ico: 'users', ph: 'Prénom Nom' },
  fonction: { ph: 'Gérant, fondatrice…' },
  telephone: { ico: 'phone', ph: '+225 07 00 00 00 00' },
  whatsapp: { ico: 'message', ph: 'Si différent du téléphone' },
  instagram: { ico: 'instagram', ph: '@compte ou lien du profil' },
  site: { ico: 'globe', ph: 'www.exemple.com' },
  ville: { ph: 'Abidjan, Lyon…' },
  produit: { ph: 'ex. vos bouquets, vos coupes' },
  concurrent: { ph: 'Agence ou freelance en place' },
  standard: { ph: 'Qui répond au téléphone' },
  recommande_par: { ico: 'handshake', ph: 'Nom du client qui recommande' },
  note_google: { ph: '4,5' },
  nb_avis: { ph: '120' },
  abonnement: { ph: '0' },
}

export function optionsDe(f, settings) {
  if (f.fixed) return LISTES[f.fixed]
  if (f.list === 'offres') return settings.offres.map((o) => o.nom)
  if (f.list === 'secteurs') return settings.secteurs.map((s) => s.nom)
  if (f.list) return settings[f.list] || []
  return null
}

// Un champ de la fiche : pastilles (liste courte), liste avec recherche (longue) ou saisie avec icône
export function ChampFiche({ f, value, onChange, suggestions }) {
  const { settings } = useApp()
  const opts = optionsDe(f, settings)
  const m = META[f.key] || {}
  if (opts && opts.length <= 4)
    return (
      <div className="seg" role="radiogroup">
        {opts.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(value === o ? '' : o)}>
            {o}
          </button>
        ))}
      </div>
    )
  if (opts) return <Choix value={value || ''} onChange={onChange} options={opts} />
  const liste = suggestions?.length ? `sugg-${f.key}` : undefined
  return (
    <div className={`inp ${m.ico ? 'with-ico' : ''}`}>
      {m.ico && (
        <span className="inp-ico">
          <Icon n={m.ico} size={15} />
        </span>
      )}
      <input
        type={f.type === 'number' ? 'text' : f.type || 'text'}
        inputMode={f.type === 'number' ? 'decimal' : f.type === 'tel' ? 'tel' : undefined}
        placeholder={m.ph || ''}
        value={value ?? ''}
        list={liste}
        onChange={(e) => onChange(e.target.value)}
        onBlur={f.key === 'instagram' ? () => handleInsta(value) && onChange(`@${handleInsta(value)}`) : undefined}
      />
      {liste && (
        <datalist id={liste}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}

// Formulaire complet : nom + rubriques repliables, barre de complétion, alertes de doublon
export default function FicheForm({ name, setName, fiche, setFiche, exceptId, ouvertes = ['contact', 'entreprise'] }) {
  const { data } = useApp()
  const [open, setOpen] = useState(() => new Set(ouvertes))
  const set = (k) => (v) => setFiche((s) => ({ ...s, [k]: v }))
  const remplis = TOUS_CHAMPS.filter((x) => fiche[x.key] || fiche[x.key] === 0).length
  const n = name.trim().toLowerCase()
  const memeNom = n && data.list.find((p) => p.id !== exceptId && p.name.toLowerCase() === n)
  const doublon = doublonInsta(data.list, fiche.instagram, exceptId)
  const noms = useMemo(() => data.list.filter((p) => p.id !== exceptId).map((p) => p.name), [data, exceptId])
  const basculer = (id) =>
    setOpen((s) => {
      const x = new Set(s)
      if (x.has(id)) x.delete(id)
      else x.add(id)
      return x
    })
  return (
    <div className="ff">
      <div className="ff-name">
        <label htmlFor="ff-nom">Entreprise</label>
        <input id="ff-nom" autoFocus={!exceptId} placeholder="Nom de l'entreprise" value={name} onChange={(e) => setName(e.target.value)} />
        {memeNom && (
          <div className="doublon">
            <Icon n="alert" size={14} /> Un prospect porte déjà ce nom : <b>{memeNom.name}</b> ({memeNom.etape}).
          </div>
        )}
        <div className="ff-progress" title={`${remplis} champs remplis sur ${TOUS_CHAMPS.length}`}>
          <span style={{ width: `${Math.round((remplis / TOUS_CHAMPS.length) * 100)}%` }} />
        </div>
        <div className="tiny muted">
          Fiche complétée à {Math.round((remplis / TOUS_CHAMPS.length) * 100)} % · plus elle est complète, plus le score de priorité est juste.
        </div>
      </div>
      {GROUPES_FICHE.map((g) => {
        const champs = g.keys.map((k) => TOUS_CHAMPS.find((x) => x.key === k)).filter(Boolean)
        const faits = champs.filter((x) => fiche[x.key] || fiche[x.key] === 0).length
        const ouvert = open.has(g.id)
        return (
          <section key={g.id} className={`ff-sec ${ouvert ? 'open' : ''}`}>
            <button type="button" className="ff-head" onClick={() => basculer(g.id)} aria-expanded={ouvert}>
              <span className="sec-ic">
                <Icon n={g.ico} size={16} />
              </span>
              <span className="li-main">
                <span className="ff-t">{g.titre}</span>
                <span className="ff-s">{g.sous}</span>
              </span>
              <span className={`ff-count ${faits === champs.length ? 'full' : ''}`}>
                {faits}/{champs.length}
              </span>
              <Icon n="chevron" size={15} />
            </button>
            {ouvert && (
              <div className="ff-body">
                {champs.map((x) => (
                  <div key={x.key} className="field">
                    <label>{lbl(x.label)}</label>
                    <ChampFiche f={x} value={fiche[x.key]} onChange={set(x.key)} suggestions={x.key === 'recommande_par' ? noms : undefined} />
                    {x.key === 'instagram' && doublon && (
                      <div className="doublon">
                        <Icon n="alert" size={14} /> Déjà le compte de <b>{doublon.name}</b>.
                      </div>
                    )}
                    {x.key === 'instagram' && !doublon && handleInsta(fiche.instagram) && (
                      <a className="insta-check" href={instaLink(fiche.instagram)} target="_blank" rel="noreferrer">
                        <Icon n="instagram" size={13} /> Vérifier @{handleInsta(fiche.instagram)} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
