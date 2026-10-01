# Architecture cible (non implémentée)

```
AGENCE ELITE (éditeur)
├── Agence Elite CRM ........ outil interne, inchangé
└── PLATEFORME (nom à décider)
      ├── Administration éditeur (équipe Agence Elite : super-admin, support)
      ├── Catalogue des solutions : Hôtel, Restaurant, Commerce…
      └── Client (ex. Groupe Kangourou)
            ├── Établissement → 1 solution → modules activés
            │     ├── identité (nom, logo, couleurs, adresse, devise, mentions)
            │     ├── paramètres
            │     ├── utilisateurs + rôles
            │     └── données isolées
            └── Établissement…
```

## Entités
| Entité | Rôle | Relation |
|---|---|---|
| `clients` | Entreprise ou groupe qui achète | 1 → N établissements |
| `solutions` | Hôtel, Restaurant, Commerce : liste de modules permis | 1 → N établissements |
| `etablissements` | Unité d'isolement (l'équivalent du workspace) | appartient à 1 client et à 1 solution |
| `etablissement_membres` | Utilisateur + rôle dans un établissement | un utilisateur peut avoir plusieurs établissements |
| `client_membres` | Dirigeant ou lecteur au niveau du client | voit tous les établissements du client |
| `etablissement_modules` | Modules activés (parmi ceux de la solution) | |
| `etablissement_parametres` | Réglages, **clé = établissement** (jamais l'utilisateur) | |
| `plateforme_admins` | Rôles éditeur, séparés des rôles d'établissement | |
| `abonnements` (plus tard) | Offre, statut, échéance | |

## Règles
1. **Toute donnée métier porte `etablissement_id`.** La base le remplit et le verrouille. L'accès vérifie trois choses : l'établissement, l'adhésion et le rôle (modèle repris du CRM, `supabase/espace_permissions.sql`).
2. **Une solution = un registre de modules dans le code** (même principe que `src/core/modules.js`). L'établissement active ses modules parmi ceux de sa solution.
3. **Une seule application pour toutes les solutions.** Pas de build par client.
4. **Les établissements sont créés par l'éditeur**, pas automatiquement à l'inscription.
5. **Le code est repris par copie, jamais par lien.** Du CRM : socle de sécurité, hors ligne, facturation, design system. De Kangourou : caisse, articles, ticket Z, reçu 80 mm.
