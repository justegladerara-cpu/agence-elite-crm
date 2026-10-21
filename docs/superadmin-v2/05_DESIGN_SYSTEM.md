# 05 — Design system

La référence est `docs/DESIGN_SYSTEM.md`, section 0 « SaaS premium » (lot 3). Elle est mise à jour dans le même commit
que le code (règle du dépôt).

En bref :
- Jetons du § 9 dans `src/saas-premium.css`, limités à `:root[data-ui="saas"]` (interface par défaut). Les
  interfaces « Salle de contrôle » et « Classique » restent au choix dans Paramètres › Identité › Interface.
- Texte secondaire `#5B6779` (contraste 5,4:1), couleurs d'état en texte plus sombres que les jetons purs (D3-2).
- Une action principale par zone, bleu accent `#2563EB` (D3-3). Contrôles de 40 px, 44 px au doigt.
- Blocs à 5 états (`Bloc`, `Indicateur`) : chargement, données, vide, refusé, erreur (lot 4).
- Formulaires : champ invalide entouré de rouge, confirmation avant de fermer une saisie, double clic ignoré (lot 6).
- Contrôle automatique : `e2e/design.spec.js` (jetons, 11 largeurs, axe sur toutes les pages du menu).

Maquette : **Bloqué : maquette absente** (D0-2). Aucun contenu de maquette n'a été inventé.
