// Contrat d'interface du module Commercial : composants que les autres modules peuvent afficher
// (score de priorité, date de relance, boutons appeler / WhatsApp / Instagram / site)
import { Icon } from '../../icons'
import { useNoyau } from '../../core/contexte'
import { today, fmtDate } from '../../lib/dates'
import { waLink, instaLink, siteLink } from '../../lib/logic'
import { noterAppelLance } from './appel'

export function Score({ v }) {
  return <span className={`score ${v >= 50 ? 'hot' : v >= 25 ? 'warm' : 'cold'}`} title="Score de priorité">{v}</span>
}
export function RelanceTag({ date, heure }) {
  if (!date) return null
  const t = today()
  const cls = date < t ? 'b-red' : date === t ? 'b-orange' : 'b-navy'
  const label = date < t ? `En retard · ${fmtDate(date)}` : date === t ? "Aujourd'hui" : fmtDate(date)
  return (
    <span className={`badge ${cls}`}>
      <Icon n="clock" size={12} /> {label}
      {heure ? ` ${heure}` : ''}
    </span>
  )
}

export function ContactButtons({ p, compact }) {
  const { settings } = useNoyau()
  const f = p.fiche || {}
  const phone = f.telephone
  const wa = waLink(f.whatsapp || f.telephone, settings.clients.indicatifWhatsApp)
  const stop = (e) => e.stopPropagation()
  return (
    <div className="row" onClick={stop}>
      {phone && (
        <a className="icon-btn" href={`tel:${phone.replace(/\s/g, '')}`} title={`Appeler ${phone}`} aria-label={`Appeler ${phone}`} onClick={() => p.id && noterAppelLance(p.id)}>
          <Icon n="phone" size={16} />
        </a>
      )}
      {wa && (
        <a className="icon-btn" href={wa} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="Écrire sur WhatsApp">
          <Icon n="message" size={16} />
        </a>
      )}
      {f.instagram && (
        <a className="icon-btn" href={instaLink(f.instagram)} target="_blank" rel="noreferrer" title="Instagram" aria-label="Ouvrir Instagram">
          <Icon n="instagram" size={16} />
        </a>
      )}
      {!compact && f.site && (
        <a className="icon-btn" href={siteLink(f.site)} target="_blank" rel="noreferrer" title="Site internet" aria-label="Ouvrir le site internet">
          <Icon n="globe" size={16} />
        </a>
      )}
    </div>
  )
}
