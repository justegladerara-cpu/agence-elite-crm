// Corbeille : chaque suppression est gardée 30 jours sur cet appareil et peut être annulée
const CLE = 'aecrm-corbeille'
const DUREE = 30 * 86400000
const MAX = 60

const lire = () => {
  try {
    const l = JSON.parse(localStorage.getItem(CLE)) || []
    return l.filter((x) => Date.now() - new Date(x.at).getTime() < DUREE)
  } catch {
    return []
  }
}
const ecrire = (l) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(l.slice(0, MAX)))
  } catch {
    // Mémoire pleine : on garde seulement les 10 dernières suppressions
    try {
      localStorage.setItem(CLE, JSON.stringify(l.slice(0, 10)))
    } catch {
      /* corbeille indisponible sur cet appareil */
    }
  }
}

export const corbeille = {
  liste: lire,
  // contenu = { prospects, actions, documents } tels qu'ils étaient avant la suppression
  ajouter(type, libelle, contenu) {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, libelle, at: new Date().toISOString(), contenu }
    ecrire([item, ...lire()])
    return item.id
  },
  retirer(id) {
    ecrire(lire().filter((x) => x.id !== id))
  },
  vider() {
    ecrire([])
  },
}
