# Architecture SUPERADMIN 2.0 — navigation en 6 espaces (lot 2)

## Principe

Une seule liste, `src/navigation.js` (`ESPACES_NAV`), nourrit tout ce qui sert à se déplacer :

| Usage | Avant (`ef4ac25`) | Après |
|---|---|---|
| Menu de gauche (ordinateur) | `APPS` (9 rubriques dont 3 « Outils ») | les 6 espaces, une rubrique dépliable chacun |
| Barre d'onglets de l'espace (téléphone) | `APPS[].entrees` | entrées de l'espace ouvert |
| Recherche Ctrl K | `NAV` + `PARAMETRES` (autre liste, sans Tour de contrôle ni éditeur) | `pagesRecherche()` : toutes les entrées et leurs raccourcis de filtre, avec le nom de l'espace |
| Titre sur téléphone | `PAGES` (3e liste de libellés) | « Espace · Page » depuis `LIBELLES` |
| Écran des applications / boîte à outils | `Applications` (APPS) + `OutilsPlateforme` (11 tuiles à part) | `#/espace` (6 espaces) et `#/espace/<id>` (pages de l'espace) |
| Barre d'onglets des écrans éditeur | `MENU_EDITEUR` dans `AdminSaaS` (menu concurrent) | supprimée ; chaque écran éditeur est une entrée d'un espace |
| Barre du bas (téléphone) | `BOTTOM` (Analyse, Journée, Noter, Prospects, Clients) | `BAS` : Accueil, Commercial, Noter, Finances, Espaces |

Les raccourcis de filtre (`sub`, ex. Factures › Impayées) sont gardés : ils apparaissent dans la recherche et dans
l'écran de l'espace. Un module désactivé (Paramètres › Modules du CRM) retire ses entrées partout à la fois.

Raccourcis clavier : G puis J, P, C, F, D, S comme avant ; G puis A ouvre « Tous les espaces », G puis T la Tour de contrôle.

## Pages autrefois orphelines

- `#/session` et `#/scripts` : entrées « Session d'appels » et « Scripts d'appel » de l'espace Commercial.
- `#/saisie` : « Nouvelle action (page complète) » dans la recherche.
- Tour de contrôle : entrée de Vue d'ensemble, dans la recherche (G puis T).

Le test `tests/navigation.test.js` lit `src/App.jsx` et échoue si une page routée n'a pas de place.

## Dictionnaire des libellés et espaces

### Vue d’ensemble (`ensemble`)

Ce qui demande une action aujourd’hui.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Tour de contrôle | `#/controle` | — | — |
| Ma journée | `#/journee` | Aujourd’hui, Prospects chauds, Alertes, Ma routine, Bilan de la semaine | — |
| Calendrier | `#/calendrier` | — | — |

### Clients logiciel (`logiciel`)

Clients du logiciel, licences, comptes et assistance.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Clients du logiciel | `#/plateforme` | En danger, Licence à régler, Bloqués | `plateforme-client`, `editeur/clients`, `editeur/etablissements` |
| Comptes et accès | `#/editeur/comptes` | — | — |
| Points de vente (Hubs) | `#/editeur/hubs` | — | — |
| Adresses de connexion | `#/editeur/adresses` | — | — |
| Sites des clients | `#/editeur/sites` | — | — |
| Copie d’articles | `#/editeur/copie-articles` | — | — |

### Commercial (`commercial`)

Prospects, clients de l’agence, appels, site et boutique.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Prospects | `#/acquisition` | En cours, Perdus | `prospects` |
| Clients de l’agence | `#/clients` | Nouveaux, Actifs, Anciens, Tous | `prospect` |
| Session d’appels | `#/session` | — | — |
| Scripts d’appel | `#/scripts` | — | — |
| Elite Partners | `#/editeur/partenaires` | — | — |
| Site web | `#/site` | — | `site-pages`, `site-photos` |
| Demandes du site | `#/site-demandes` | À traiter, Traitées | — |
| Elite Store | `#/boutique` | Commandes, Produits, Clés de licence | — |

### Finances (`finances`)

Factures, devis, paiements reçus et dépenses.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Factures | `#/factures` | Toutes, Impayées, En retard, Payées | `facture` |
| Devis | `#/devis` | Tous, En attente, Acceptés, Refusés | — |
| Paiements reçus | `#/paiements` | — | — |
| Charges | `#/charges` | — | — |
| Dépenses | `#/depenses` | — | — |
| Abonnements | `#/abonnements` | — | — |

### Analyses (`analyses`)

Chiffres de l’agence et du logiciel.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Tableau de bord | `#/dashboard` | — | — |
| Acquisition | `#/dashboard/acquisition` | — | — |
| Conversion | `#/dashboard/conversion` | — | — |
| Finances | `#/dashboard/finances` | — | — |
| Chiffres du logiciel | `#/editeur/tableau` | — | — |

### Administration (`administration`)

Réglages du CRM et du logiciel, documents.

| Page (libellé unique) | Adresse | Raccourcis de filtre | Pages rattachées |
|---|---|---|---|
| Identité | `#/parametres/identite` | — | — |
| Facturation | `#/parametres/facturation` | — | — |
| Objectifs | `#/parametres/objectifs` | — | — |
| Listes | `#/parametres/listes` | — | — |
| Textes des scripts | `#/parametres/scripts` | — | — |
| Rappels | `#/parametres/rappels` | — | — |
| Import / Export | `#/parametres/excel` | — | — |
| Modules du CRM | `#/parametres/modules` | — | — |
| Membres | `#/parametres/membres` | — | — |
| Sécurité et sauvegardes | `#/parametres/securite` | — | — |
| Mon compte | `#/parametres/compte` | — | — |
| Offres et prix | `#/editeur/offres` | — | — |
| Catalogue des modules | `#/editeur/modules` | — | — |
| Identité du logiciel | `#/editeur/identite` | — | — |
| Documents et modèles | `#/documents` | — | — |

### Hors menu (dans la recherche)

- Nouvelle action (page complète) : `#/saisie`

### Redirections

| Ancienne adresse | Nouvelle adresse |
|---|---|
| `#/plateforme-outils` | `#/espace/administration` |
| `#/apps` | `#/espace` |
| `#/editeur` | `#/editeur/tableau` |
| `#/parametres` | `#/parametres/identite` |

