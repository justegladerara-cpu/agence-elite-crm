// Contrat du module Plateforme : pont vers le SaaS et calculs de la tour de contrôle.
export { appeler, clientPlateforme, connecter, deconnecter, quitter, sessionValide, estSuperAdmin, messagePlateforme } from './connexion'
export { construireVue, alertes, indicateurs, clientsReels, ficheLiee, lireCommande, santeEtablissement, mensuelLicence, estDemo, LIBELLES_CHRONO } from './calculs'
export { aujourdhuiIso, baseRenouvellement, echeanceMinimum, echeanceProposee, erreurEcheance, plusJours } from './licence'
export { A_REPRENDRE, ETATS, GESTES, creerJournal, executer, journalOperations, marquerReglee, noterGeste, preparerEncaissement } from './operations'
