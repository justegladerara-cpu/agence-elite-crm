// Pile des fenêtres ouvertes (fenêtres, menus, listes, recherche) : Échap ne ferme que celle du dessus.
// Un seul écouteur, en phase de capture : il passe avant les écouteurs propres à chaque composant.
const pile = []
let installe = false

function installer() {
  if (installe || typeof window === 'undefined') return
  installe = true
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !pile.length) return
      e.preventDefault()
      e.stopImmediatePropagation()
      pile[pile.length - 1].fermer(e)
    },
    true,
  )
}

// Ajoute une couche ; renvoie la fonction qui la retire
export function empiler(fermer) {
  installer()
  const couche = { fermer }
  pile.push(couche)
  return () => {
    const i = pile.indexOf(couche)
    if (i >= 0) pile.splice(i, 1)
  }
}

export const nombreDeCouches = () => pile.length
