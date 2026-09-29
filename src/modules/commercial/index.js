// Contrat public du module Commercial : ce que les autres modules et le noyau peuvent utiliser.
// computeAll : fiches, étapes, relances et clients calculés (le modèle lu par tous les modules via le contexte)
export { computeAll } from './pipeline'
export { lienHub, categorie, fichesHub } from './hub'
export { ligne } from './insta'
export { SOURCES } from './journee'
