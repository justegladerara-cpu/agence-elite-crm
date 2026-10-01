# Catalogue des modules (écrits une seule fois)

## Socle (toujours présents)
| Module | Contenu |
|---|---|
| Établissement | identité, paramètres, points de vente |
| Membres | utilisateurs, rôles, permissions fines |
| Tableau de bord | indicateurs de l'établissement |
| Paiements | encaissements, moyens de paiement (espèces, Mobile Money…) |
| Dépenses | dépenses et justificatifs |
| Factures | factures, PDF, numérotation |

## Métier (activables)
| Module | Solutions | Référence existante |
|---|---|---|
| Caisse | Commerce, Restaurant, Hôtel | Kangourou : `pages/Caisse.jsx` |
| Articles | Commerce, Restaurant | Kangourou : `pages/Articles.jsx` (photo, catégories) |
| Ventes | toutes | Kangourou : `pages/Ventes.jsx` |
| Clôture / ticket Z | toutes | Kangourou : `pages/Cloture.jsx`, `lib/etablissements.js` |
| Clients | toutes | Kangourou : `pages/ClientsMagasin.jsx` (vente à crédit) |
| Reçus | toutes | Kangourou : `lib/recuPdf.js` (80 mm) |
| Points de vente | Commerce, Restaurant | Kangourou : établissements dans les réglages |
| Stock | Commerce, Restaurant, Hôtel | à concevoir (Kangourou : `ajuster_stock`) |
| Devis | Commerce | CRM / Kangourou |
| Salle et tables | Restaurant | à concevoir (base propre) |
| Cuisine | Restaurant | à concevoir |
| Hébergement | Hôtel | à concevoir (base propre, pas Elite Hôtel) |
| Réservations | Hôtel, Restaurant | à concevoir |

Les références Kangourou se lisent sur la branche `claude/project-thread-bm6nwc`, en lecture seule. On y reprend la logique, pas les données ni l'identité du client.
