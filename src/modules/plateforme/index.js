// Contrat du module Plateforme : pont vers le SaaS et calculs de la tour de contrôle.
export { appeler, clientPlateforme, connecter, deconnecter, quitter, sessionValide, estSuperAdmin, messagePlateforme } from './connexion'
export { construireVue, alertes, indicateurs, clientsReels, ficheLiee, lireCommande, santeEtablissement, mensuelLicence, estDemo, LIBELLES_CHRONO } from './calculs'
export { ETATS_BLOC, clientsActifs, encaisseDuMois, etatCrm, etatPlateforme, licencesARenouveler, relancesEnRetard } from './accueil'
export { aujourdhuiIso, baseRenouvellement, echeanceMinimum, echeanceProposee, erreurEcheance, plusJours } from './licence'
export { A_REPRENDRE, ETATS, GESTES, creerJournal, executer, journalOperations, marquerReglee, noterGeste, preparerEncaissement } from './operations'
export { ETATS_ECHEANCE, ETATS_DEMANDE, etatAffiche, enTranches, aTraiter, baseEnRetard, joursTexte, libellePalier, lirePaliers, nomMois, parMois } from './echeances'
export { LIBELLE_FORMULE, codesDuClient, dureeTexte, lienFacture, lienWhatsApp, lignePreremplie, messageCode, modeleParDefaut, modelesPour } from './codes'
