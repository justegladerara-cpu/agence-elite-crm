# 06 — Parcours avant / après (en clics)

Compté sur la prévisualisation sans donnée réelle, depuis l'ouverture de l'application, en mode ordinateur.
« Avant » = production `ef4ac25`, compté en relisant son code (pas rejoué par un test : la maquette et l'audit,
qui donnaient ces parcours, sont absents). « Après » = lot 7, rejoué par les tests cités en bas. Un clic = un clic ou une touche validée ; la saisie de texte
n'est pas comptée.

| Parcours | Avant | Après | Ce qui a changé |
|---|---|---|---|
| Voir ce qui demande une action aujourd'hui | 1 (le Tableau de bord s'ouvre en démo, la Tour est ailleurs) | 0 (la Tour de contrôle est l'accueil) | Accueil unique (D4-1) |
| Encaisser un client et renouveler sa licence | 4 : Plateforme › client › Encaisser › Confirmer | 3 : Clients du logiciel › client › Encaisser, Confirmer après récapitulatif | Fiche unique ; récapitulatif avant envoi ; suivi pas à pas |
| Encaisser depuis un indicateur « Licences à renouveler » | impossible (pas d'indicateur) | 3 : indicateur › licence › Encaisser et renouveler › Confirmer (4) | Indicateur cliquable (lot 4) |
| Renouveler sans paiement (avoir) | 5 : écran éditeur › client › établissement › Renouveler › montant saisi (et paiement absent du CRM) | 4 : fiche › Plus › Renouveler sans encaissement › Vérifier › Renouveler | Montant 0, motif, aucun faux encaissement (SEC-04) |
| Donner un nouveau mot de passe à un gérant | 2 chemins différents (équipe d'établissement ou écran comptes) | 1 chemin : fiche › Comptes › Mot de passe › Copier le message | Un seul chemin (RED-16) |
| Reprendre un encaissement interrompu | impossible (aucun suivi) | 2 : Opérations et réconciliation › Reprendre | Écran `#/operations` |
| Bloquer un client | 2, sans motif | 3 : fiche › Plus › Bloquer le client, motif, Bloquer | Motif obligatoire, geste tracé (densité : passé dans « Plus ») |
| Trouver une page oubliée (session, scripts, saisie) | pas dans le menu | Ctrl K › nom de la page | Plus de page orpheline (lot 2) |

Les parcours sont rejoués par les tests : `e2e/fiche.spec.js`, `e2e/securite.spec.js`, `e2e/tableau.spec.js`,
`e2e/navigation.spec.js`, `e2e/parcours.spec.js` (parcours « plateforme »).
