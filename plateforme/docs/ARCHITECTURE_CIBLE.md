# Architecture cible : un socle unique (non implémentée)

```
AGENCE ELITE (éditeur / super-admin)
└── PLATEFORME (nom à décider) : un seul code, une seule base
      ├── Catalogue des modules (écrits une fois)
      ├── Catalogue des solutions = listes de modules + réglages par défaut
      └── Clients
            └── Établissements (chacun : 1 solution)
                  ├── modules activés (parmi ceux de sa solution)
                  ├── identité et paramètres
                  ├── utilisateurs → rôles → permissions
                  └── données isolées
```

Exemple : Client « Groupe X »
- Établissement A → Solution Commerce
- Établissement B → Solution Restaurant
- Établissement C → Solution Hôtel

Les trois établissements tournent sur la même application et la même base. Seuls changent les modules activés et les réglages.

## Niveaux
| Niveau | Rôle | Qui le gère |
|---|---|---|
| Éditeur | Agence Elite : crée les clients et les établissements, choisit la solution, active les modules, peut suspendre | super-admin, support |
| Client | Entreprise ou groupe, 1 → N établissements, ne porte aucune donnée métier | dirigeant du client |
| Établissement | Unité d'isolement : données, utilisateurs, rôles, paramètres, identité | gérant |
| Solution | Entrée du catalogue : modules proposés, modules par défaut, rôles et vocabulaire par défaut | éditeur |
| Module | Fonction écrite une fois : socle (toujours présent) ou métier (activable) | éditeur active, gérant utilise |
| Utilisateur | Peut appartenir à plusieurs établissements, avec un rôle dans chacun | gérant ou éditeur |

## Entités
| Entité | Relation |
|---|---|
| `clients` | 1 → N établissements |
| `solutions` | catalogue, 1 → N établissements |
| `modules` | catalogue unique |
| `solution_modules` | modules proposés par une solution (et activés par défaut ou non) |
| `etablissements` | appartient à 1 client et à 1 solution |
| `etablissement_modules` | modules réellement activés, obligatoirement parmi ceux de la solution |
| `etablissement_parametres` | réglages, clé = établissement |
| `etablissement_membres` | utilisateur + rôle + permissions fines |
| `client_membres` | dirigeant ou lecteur du client (voit tous ses établissements) |
| `plateforme_admins` | rôles éditeur, séparés des rôles d'établissement |
| données métier (articles, ventes…) | toujours avec `etablissement_id` |

## Règles
1. **Une seule application.** L'interface affiche les modules activés de l'établissement actif. Pas de build par solution ni par client.
2. **Isolation par la base.** Toute donnée porte `etablissement_id`. La base le remplit et le verrouille. L'accès vérifie trois choses : l'établissement, l'adhésion et le rôle (modèle repris du CRM).
3. **Permissions = rôle + permissions fines par module.** Un rôle donne des permissions par défaut. Le gérant peut les ajuster par personne, comme dans le Kangourou.
4. **Désactiver un module masque ses écrans**, sans supprimer ses données.
5. **Les établissements sont créés par l'éditeur**, pas automatiquement à l'inscription.
6. **Le code est repris par copie, jamais par lien.** Du CRM : sécurité, hors ligne, facturation, design system. Du Kangourou : logique de caisse, d'articles, de clôture et de reçus. Le Kangourou lui-même n'est pas modifié.
