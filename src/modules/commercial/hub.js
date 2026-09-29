// Hub Clients : range chaque fiche dans une catégorie du parcours (prospect → nouveau client → client actif → ancien)
import { diffDays, today } from '../../lib/dates'

export const JOURS_NOUVEAU = 90

export const CATEGORIES = [
  { id: 'potentiels', label: 'Potentiels', ico: 'target', couleur: '#2F5BD3', parcours: true },
  { id: 'nouveaux', label: 'Nouveaux clients', ico: 'sparkles', couleur: '#B8903F', parcours: true },
  { id: 'actifs', label: 'Clients actifs', ico: 'briefcase', couleur: '#0F7B55', parcours: true },
  { id: 'anciens', label: 'Anciens clients', ico: 'repeat', couleur: '#5B6475', parcours: true },
  { id: 'perdus', label: 'Perdus', ico: 'ban', couleur: '#C0322E' },
  { id: 'tous', label: 'Tous', ico: 'users', couleur: '#0C1833' },
]

// Catégorie d'une fiche : client (niveau 7) selon l'ancienneté et la résiliation, sinon prospect en cours ou perdu
export function categorie(p, client, t = today()) {
  if (client) {
    if (client.statut === 'Résilié') return 'anciens'
    const debut = p.dateSignature || p.dateAjout
    return debut && diffDays(t, debut) < JOURS_NOUVEAU ? 'nouveaux' : 'actifs'
  }
  return p.etape === 'Perdu' ? 'perdus' : 'potentiels'
}

// Toutes les fiches avec leur catégorie et, pour les clients, leurs chiffres
export function fichesHub(data) {
  const parId = Object.fromEntries(data.clients.map((c) => [c.id, c]))
  return data.list.map((p) => {
    const c = parId[p.id] || null
    return { p, c, cat: categorie(p, c) }
  })
}

// Anciens liens (#/prospects?etape=…, #/clients?filtre=…) vers le hub
export function lienHub(page, q) {
  const x = new URLSearchParams()
  if (page === 'prospects') {
    const e = q.get('etape')
    if (e === 'Perdu') x.set('onglet', 'perdus')
    else if (e === 'Gagné') x.set('onglet', 'actifs')
    else if (e === 'Tous') x.set('onglet', 'tous')
    else {
      x.set('onglet', 'potentiels')
      if (e && e !== 'Actifs') x.set('etape', e)
    }
    if (q.get('vue')) x.set('vue', q.get('vue'))
  } else {
    const f = q.get('filtre')
    if (f === 'actifs') x.set('onglet', 'actifs')
    else if (['encaisser', 'abonnes', 'alertes'].includes(f)) {
      x.set('onglet', 'tous')
      x.set('filtre', f)
    }
  }
  return `clients${x.toString() ? `?${x}` : ''}`
}
