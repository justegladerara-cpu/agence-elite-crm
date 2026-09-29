// Contrat public du module Commercial : ce que les autres modules et le noyau peuvent utiliser.
// computeAll : fiches, étapes, relances et clients calculés (le modèle lu par tous les modules via le contexte)
export { computeAll } from './pipeline'
export { lienHub, categorie, fichesHub } from './hub'
export { ligne } from './insta'
export { SOURCES } from './journee'
// Appel lancé depuis le CRM : retrouvé au retour dans l'application (feuille « Comment s'est passé l'appel ? »)
export { appelEnCours, oublierAppel } from './appel'
export { pastillesCommercial } from './pastilles'
