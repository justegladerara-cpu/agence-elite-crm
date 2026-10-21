# Audit du 2026-10-21 : copie

**Bloqué : audit absent.** Le dossier source `/mnt/project-files/crm/audit-superadmin-2026-10-21/` (9 documents,
`captures/`, `mesures.json`) n'existe pas dans les fichiers du projet au 2026-10-21 06:10 UTC (aucun dossier `crm/`).
La maquette `/mnt/project-files/crm/superadmin-v2/maquette*.png` est absente elle aussi.

Conséquences, notées dans `../JOURNAL.md` :
- les inventaires de l'audit (`02_INVENTAIRE_BOUTONS.csv` avec ses identifiants `NAV-`, `PLA-`, `ADM-`, `COM-`, `ARG-`,
  `OUT-`, la liste des 206 fonctionnalités, les 71 redondances) ne peuvent pas être recopiés ;
- les chiffres de départ sont **remesurés** par les scripts de ce dépôt (`scripts/mesure/`), sur la prévisualisation
  sans donnée réelle, et rangés dans `../mesures/avant.json` ;
- les tableaux de correspondance (`02_FUNCTION_MAPPING.csv`, `03_ACTION_MAPPING.csv`, `04_REDUNDANCY_RESOLUTION.csv`)
  sont reconstruits à partir du code et des mesures, avec des identifiants propres à cette mission. Dès que l'audit
  est déposé, il faut le copier ici et rapprocher les identifiants.

Pour débloquer : déposer le dossier d'audit dans `/mnt/project-files/crm/audit-superadmin-2026-10-21/`, puis copier son
contenu ici (`cp -r … docs/superadmin-v2/audit/`).
