// Contrat du module Plateforme : pont vers le SaaS et calculs de la tour de contrôle.
export { appeler, clientPlateforme, connecter, deconnecter, sessionValide, estSuperAdmin, messagePlateforme } from './connexion'
export { construireVue, alertes, indicateurs, clientsReels, ficheLiee, lireCommande, santeEtablissement, mensuelLicence, estDemo, LIBELLES_CHRONO } from './calculs'
