// Contrat public du module Facturation : ce que les autres modules et le noyau peuvent utiliser.
// Les autres modules importent d'ici (ou de ui.jsx pour les composants), jamais des fichiers internes.
export { facturesImpayees } from './impayes'
export { pastillesFacturation } from './pastilles'
export { statutDe, totals, paiementsDe, num, nouveauDoc, STATUT_TONE } from './invoice'
// Chargés à la demande : le PDF (jsPDF) et l'import Zoho restent hors du chargement initial
export const chargerPdf = () => import('./invoicePdf')
export const chargerZoho = () => import('./zoho')
