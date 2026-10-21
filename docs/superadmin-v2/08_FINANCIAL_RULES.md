# 08 — Règles financières (lot 6)

Une seule source pour chaque calcul d'argent. Le code qui applique ces règles :

| Domaine | Fichier | Tests |
|---|---|---|
| Argent du CRM (paiements, dépenses, résultat) | `src/lib/finances.js` | `tests/finances.test.js` |
| Devises, affichage, sommes par devise | `src/lib/argent.js` | `tests/accueil.test.js` |
| Échéances de licence | `src/modules/plateforme/licence.js` | `tests/securite.test.js` |
| Encaissement en deux temps (plateforme + CRM) | `src/modules/plateforme/operations.js` | `tests/securite.test.js`, `e2e/fiche.spec.js` |

Avant le lot 6, la lecture d'un montant existait en trois versions (`lib/logic.js`, `facturation/invoice.js`,
`tresorerie.js`) qui ne donnaient pas le même résultat : « 1 000 » valait 0 dans les écrans qui utilisaient
`logic.num`. Les trois renvoient maintenant à `finances.montant`.

## Argent du CRM

| Règle | Énoncé | Fonction |
|---|---|---|
| **R1** Montant saisi | « 150 000 », « 150 000 » (espace insécable), « 12,5 » et 12.5 sont lus comme des nombres. Vide, illisible ou infini vaut 0. | `montant` |
| **R2** Nature | Une entrée est une action « Paiement reçu ». Une sortie est une action « Dépense ». Rien d'autre ne compte. | `estPaiement`, `estDepense` |
| **R3** Période | Dates « AAAA-MM-JJ », bornes incluses. Un mois est le mois civil « AAAA-MM ». Une ligne sans date n'est dans aucune période. | `dansPeriode`, `moisDe` |
| **R4** Encaissé | Somme des paiements reçus **datés** dans la période (date du paiement, pas celle de la facture). C'est le chiffre « Encaissé ce mois » de la Tour de contrôle et de Finances. | `encaisse`, `paiementsDans` |
| **R5** Dépenses | Somme des dépenses notées dans la période. | `depenses`, `depensesDans` |
| **R6** Résultat | Encaissé − dépenses − charges fixes du mois (comptées une fois par mois). Marge = résultat ÷ encaissé, vide si rien n'est encaissé. | `resultat` |
| **R7** Arrondi | On arrondit seulement à l'affichage (FCFA sans décimales, euro à 2). Les calculs gardent la valeur exacte. | `arrondi`, `argent` |

## Devises

- **D1** Un montant s'affiche toujours avec sa vraie devise (`argent(v, code)`), jamais un « € » ou « FCFA » écrit en
  dur. La devise du CRM se règle dans Paramètres. Celle d'une licence vient de la plateforme.
- **D2** On n'additionne jamais deux devises. Un total qui en mélange plusieurs s'affiche « 25 000 FCFA + 40 € »
  (`sommesParDevise`, `afficherSommes`). Les taux `parEuro` de `DEVISES` servent seulement à une estimation affichée
  comme telle, jamais à un total enregistré.
- **D3** Un encaissement garde la devise de la licence du début à la fin (`preparerEncaissement`).

## Licences

- **L1** Une nouvelle échéance est toujours strictement après l'échéance actuelle, et jamais dans le passé
  (`erreurEcheance`). La base plateforme applique la même règle (`renouveler_licence`, SEC-09).
- **L2** Point de départ d'un renouvellement : l'échéance actuelle si elle est à venir, sinon aujourd'hui.
  Mensuel = +1 mois (fin de mois respectée : 31 janvier → 28 ou 29 février). Annuel = +12 mois.
- **L3** Quatre gestes distincts, chacun tracé :
  - **Encaisser** : un paiement réel, qui renouvelle la licence et note le paiement.
  - **Renouveler sans encaissement** : une période normale, réglée autrement. Motif obligatoire, montant 0.
  - **Prolongation commerciale gratuite** : quelques jours offerts. Motif obligatoire, montant 0.
  - **Suspendre / réactiver** : aucun effet sur l'argent.

## Encaissement en deux temps (idempotence)

- **I1** Chaque encaissement reçoit un identifiant `OP-…`. Il est écrit comme référence du renouvellement sur la
  plateforme et dans la note du paiement CRM.
- **I2** Avant chaque étape, on vérifie qu'elle n'a pas déjà été faite (historique de la licence, paiements du CRM).
  Reprendre une opération ne crée jamais de doublon.
- **I3** Une réponse perdue fait passer l'opération à « À réconcilier ». Rien n'est refait sans vérification. Si la
  vérification est impossible, on s'arrête.
- **I4** Côté base, la PR plateforme #72 (brouillon, **non appliquée**) ajoute un index unique sur les références
  `OP-%` et vérifie la clé sous le verrou de la licence. Deux onglets au même instant ne doublent plus.

## Ce qui n'est pas couvert

- Pas de conversion automatique entre devises (décision commerciale à prendre).
- Le journal des opérations reste sur l'appareil (D5-3). Un journal partagé demanderait une migration CRM, avec accord.
