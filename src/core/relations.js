// Noyau › relations entre éléments : recherche d'une fiche à relier (fonctions pures).

const sansEspaces = (x) => (x || '').replace(/\s/g, '')

// Fiches correspondant à la saisie (nom, contact ou téléphone), les plus récemment actives d'abord
export function chercherFiches(liste, q, max = 8) {
  const s = (q || '').trim().toLowerCase()
  return liste
    .filter((p) => !s || p.name.toLowerCase().includes(s) || (p.fiche?.contact || '').toLowerCase().includes(s) || sansEspaces(p.fiche?.telephone).includes(sansEspaces(s)))
    .sort((a, b) => (b.derniereAction || '').localeCompare(a.derniereAction || ''))
    .slice(0, max)
}

export const nomExiste = (liste, q) => liste.some((p) => p.name.toLowerCase() === (q || '').trim().toLowerCase())
