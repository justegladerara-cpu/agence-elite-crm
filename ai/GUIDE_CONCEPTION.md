# Guide de conception Agence Elite : à lire avant toute intervention

Ce document est destiné à toute IA (GPT, Codex…) qui travaille sur les logiciels d'Agence Elite. Il décrit la façon de penser, de travailler et surtout de **designer** qui a produit le CRM actuel. Suis-le à la lettre. En cas de contradiction : la demande écrite de Juste prime, puis le code existant (source de vérité), puis ce guide.

---

## 1. Pour qui tu travailles

- **Juste**, fondateur d'Agence Elite (Afrique de l'Ouest/Centrale, montants en **FCFA**, parfois EUR). Il vend des prestations ponctuelles sur site (ex. 100 000 FCFA) et du récurrent. Prospection : Instagram → DM ou appel → qualification → audit/Loom/démo → RDV → proposition → client.
- Il écrit en français. **Réponds toujours en français, en tutoyant**, dans l'interface comme dans tes messages.
- Il veut des outils **simples, pragmatiques, utilisables au quotidien sur téléphone**, pas des usines à gaz. Chaque écran doit servir à décider ou agir.
- Il teste sur le vrai produit, souvent sur mobile, souvent avec une connexion instable.

## 2. Posture et façon de répondre

- **Mène le travail jusqu'au bout.** Une demande validée = tu analyses, codes, testes, livres. Tu ne poses pas une question par étape. Quand un détail n'est pas précisé, tu choisis la solution raisonnable, tu dis laquelle, tu avances.
- **Réponses courtes.** Une ligne pour dire ce que tu vas faire, puis à la fin : `✓ Corrigé / ✓ Testé / ✓ Build OK` + fichiers modifiés + ce que Juste doit vérifier. Pas de pavé de code dans la réponse, pas de récit de ton investigation.
- **N'invente jamais** : pas de chiffre, pas de config, pas de fonctionnalité « déjà faite » que tu n'as pas vérifiée. Si tu n'as pas pu vérifier, dis-le (« non vérifiable d'ici »).
- **Ne prétends jamais qu'une sauvegarde a réussi** si ce n'est pas sûr (ni dans tes messages, ni dans l'interface).
- **Arrête-toi et demande** seulement avant une action irréversible : suppression de données, migration destructive, modification de la base de production, DNS, envoi de messages à l'extérieur.
- Ne révèle jamais de secret (clés, mots de passe, jetons) dans le code, les commits, les logs ou la documentation. Pas de requêtes sur les données personnelles des clients sans raison.

## 3. Méthode de travail (obligatoire)

1. **Lire d'abord** : `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, puis `ai/CLAUDE/JOURNAL.md` (dernières entrées, section « À transmettre à Codex »). Le code reste la source de vérité.
2. **Contexte minimum** : recherche ciblée, ne lis que les fichiers concernés, petits patchs. Pas de refonte générale non demandée.
3. **Réutilise avant de créer** : composants de `src/ui.jsx`, `src/charts.jsx`, `src/icons.jsx`, `src/core/ui/`, jetons CSS de `src/index.css`. Pas de nouvelle librairie (pas de Tailwind, MUI, Chart.js, routeur, gestionnaire d'état) sans accord.
4. **Respecte l'architecture** : `core/` et `lib/` n'importent aucun module ; un module n'en importe un autre que via son `index.js`/`ui.jsx` (contrôlé par `tests/architecture.test.js`).
5. **Teste avant de livrer** : `npm run check` (lint + tests + build), tests ciblés d'abord, Playwright (`npm run test:e2e`) pour un parcours modifié. Ajoute un test de non-régression pour chaque bug corrigé et chaque logique pure (`src/lib/` → `tests/lib.test.js`).
6. **Base de production (Supabase `mylgnsuoppplmfaanyze`)** : aucune migration destructive, aucune suppression, toujours un retour arrière documenté en fin de fichier SQL, diagnostic en lecture seule avant, contrôle après. Présente le périmètre et attends la validation explicite de Juste avant d'appliquer.
7. **Déploiement** : un push sur `claude/project-thread-j6wx9s` déploie le CRM en production (Cloudflare Pages → crm.agence-elite.fr). Le site public se déploie depuis la branche `site`. Ne pousse jamais du code non testé sur la branche de production.
8. **Journal** : à la fin d'une mission, mets à jour la documentation (`docs/*`, uniquement les faits nouveaux) et tiens ton propre journal chronologique (date, mission, fichiers, tests, résultats, problèmes, état final, prochaine étape). Ne modifie jamais le journal d'une autre IA.

## 4. Principes produit

- **Une seule saisie, tout le reste calculé.** L'utilisateur saisit un fait (appel, étape, paiement, dépense) une fois ; tableaux de bord, statuts, relances, chiffres se calculent. L'étape d'un prospect et le statut d'une facture sont **calculés, jamais stockés**.
- **Tout chiffre est cliquable.** Un KPI, une barre, une case de calendrier ouvre la liste qui le compose (drill-down). Rien n'est une impasse.
- **Tout est relié.** Une fiche client montre ses actions, devis, factures, paiements, dépenses liées, chronologie. Un paiement pointe vers sa facture, une dépense vers son paiement.
- **Rien ne se perd.** File hors ligne : ce qui est saisi sans réseau est gardé et synchronisé. Un refus du serveur est conservé et expliqué, avec un moyen de corriger. Suppression = corbeille + « Annuler » dans le toast.
- **Action d'abord.** Chaque écran met en avant la prochaine action utile (bouton or « + Nouvelle action », « Relancer », « Encaisser »). « Ma journée » donne des objectifs chiffrés (style Hormozi : volume d'appels, DM, relances).
- **Argent visible.** Encaissé, à encaisser, dépenses, net : toujours en évidence, montants complets, devise des réglages.
- **Données réalistes.** Jamais de lorem ipsum. Les exemples de démo sont crédibles (noms, villes et montants d'Afrique centrale) et clairement marqués comme démo.
- **Rôles respectés dans l'interface** : propriétaire, admin, membre, lecteur. Un lecteur voit un bandeau « lecture seule » et des boutons désactivés avec l'explication, jamais une erreur brute.

## 5. Identité visuelle

Inspirations assumées : **Zoho One / Zoho Books / Odoo** pour la structure (lanceur d'applis, menus par appli, onglets, vue côte à côte), **Linear/Stripe** pour la sobriété et la précision. Résultat visé : un logiciel de gestion professionnel, dense mais aéré, sérieux, haut de gamme, jamais « template ».

### 5.1 Couleurs (jetons dans `src/index.css`, ne jamais coder une couleur en dur)

| Rôle | Jeton | Valeur par défaut |
|---|---|---|
| Couleur principale (menu, titres forts, bouton primaire) | `--navy` | `#0c1833` (marine) |
| Variantes | `--navy-2` `#14224a`, `--navy-3` `#1e2f5c`, `--navy-deep` `#081024` | |
| Accent (CTA, élément actif, focus de marque) | `--gold` | `#b8903f` (or) |
| Variantes or | `--gold-2` `#d9bd83`, `--gold-3` `#97742f`, `--gold-soft` `#f8f3e8`, `--gold-line` `#e8dabd`, `--gold-ink` `#6b5020` | |
| Fond de page | `--bg` | `#f5f6f8` |
| Cartes | `--card` | `#ffffff` |
| Texte | `--text` | `#0f172a` |
| Texte secondaire | `--muted` | `#5b6475` |
| Bordures | `--line` `#e4e7ec`, `--line-2` `#eef0f3` | |
| Succès | `--green` `#0f7b55` / `--green-soft` `#e4f3ec` | |
| Attention | `--orange` `#b45309` / `--orange-soft` `#fdf1e3` | |
| Danger | `--red` `#c0322e` / `--red-soft` `#fbeceb` | |
| Info / liens / focus | `--blue` `#2f5bd3` / `--blue-soft` `#eaf0fc` | |

Règles :
- **Le thème est personnalisable** (Paramètres > Identité : marine & or, noir & rouge, noir & or, vert & or, bleu & corail, personnalisé). `src/lib/theme.js` génère toute la palette à partir de 2 couleurs. Donc : utilise toujours `var(--navy)`, `var(--gold)`, `rgba(var(--navy-rgb), .x)`… jamais `#0c1833` en dur, sinon le thème casse.
- Le menu latéral reste **foncé** (texte clair dessus) quel que soit le thème.
- L'or est **rare** : bouton d'action principal, élément actif du menu (barre verticale or à gauche), un indicateur clé. Si tout est or, plus rien ne ressort.
- Couleurs de statut **réservées** à leur sens (vert = payé/gagné, orange = en retard/attention, rouge = danger/perdu d'argent) et toujours accompagnées d'un texte ou d'une icône, jamais la couleur seule.
- Badges d'étape du pipeline (fond doux + texte foncé de la même teinte) : Nouveau gris, Contacté bleu, Qualifié violet, Audit/Démo turquoise, RDV or, Proposition orange, Gagné vert, Perdu gris.
- Graphiques : palette catégorielle fixe `#2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948`, « Autres » `#a3a9b8`. La couleur suit l'entité (un canal garde sa couleur partout), pas son rang.

### 5.2 Typographie

- Police unique **Inter** (fichiers hébergés dans `src/assets/fonts`, fonctionne hors ligne). Pas de police serif, pas de Google Fonts dans le CRM.
- Échelle fixe, 7 tailles seulement : `--fs-xs` 11.5px · `--fs-sm` 12.5px · `--fs-base` 14px · `--fs-md` 15px · `--fs-lg` 17px · `--fs-xl` 22px · `--fs-2xl` clamp(22→30px). Interligne `--lh-tight` 1.2 (titres), `--lh-base` 1.5 (texte).
- Titres de page : 22px, gras 700, `letter-spacing: -0.02em`, couleur texte. Titres de section : 15px gras avec une petite icône dans un carré 26px (`.sec-ic`).
- En-têtes de tableau : 11px, majuscules, `letter-spacing: .04em`, couleur `--muted`.
- **Chiffres** : `font-variant-numeric: tabular-nums` sur tout KPI, montant, colonne de tableau. Montants complets formatés (`100 000 FCFA`), abréviations (`1,2 M`) seulement dans les axes et donuts (`court()` de `ui.jsx`).

### 5.3 Espacements, rayons, ombres, couches

- Grille de 4px : `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32. Espacer avec `gap` en flex/grid, pas avec des marges au cas par cas.
- Rayons : cartes `--radius` 12px, boutons `--r-btn` 8px, badges `--r-badge` 6px, modales `--r-modal` 16px.
- Ombres : très légères (`--shadow` = 0 1px 2px). Grande ombre (`--shadow-lg`) seulement pour modales, menus déroulants, toast.
- Couches (z-index) uniquement via jetons : sticky 20, nav 30, dropdown 250, drawer 300, modal 400, popover 450, toast 500.
- Zone tactile minimum `--tap` 44px sur mobile.

## 6. Structure des écrans

### 6.1 Coquille de l'application
- **Ordinateur** : menu latéral fixe 232px, fond `--navy`, logo + nom en haut, menu groupé par appli, bouton or « + Nouvelle action » en haut du menu, indicateur de connexion (point vert) en bas. Contenu : marge gauche 232px, padding 22px 28px, largeur max 1440px.
- **Mobile (< 860px)** : barre du haut marine collante (logo, nom, accès « Toutes les pages » / réglages), **barre de navigation basse à 5 entrées** avec le bouton central rond or surélevé (action principale), flou d'arrière-plan, respect des encoches (`env(safe-area-inset-*)`). Le contenu garde 14px de marge latérale et 104px en bas pour ne pas passer sous la barre.
- **Lanceur d'applis** (`#/apps`, façon Zoho One/Odoo) : Tableau de bord, Commercial, Facturation, Charges, Agenda, Site web, Paramètres. Chaque appli a son propre menu.
- Recherche globale `Ctrl/⌘ K` ou `/`, `N` = nouvelle action.

### 6.2 Anatomie d'une page
1. **En-tête** (`.page-head`) : titre + sous-titre court (contexte ou chiffre clé) à gauche, actions à droite (bouton principal + menu « ⋯ » pour le reste). Passe à la ligne proprement sur mobile.
2. **Onglets** (`Tabs`, fond gris segmenté, onglet actif blanc) pour les vues d'une même appli ; l'onglet est dans l'URL (`#/route?onglet=`) et mémorisé.
3. **Filtres** sur une seule ligne au-dessus du contenu (chips avec compteur, période, canal).
4. **Contenu** : hub en premier (vue d'ensemble), puis listes, puis détail.
5. **Vue côte à côte** sur ordinateur : liste à gauche, fiche à droite (panneau). Sur mobile : la fiche s'ouvre en plein écran.

### 6.3 Tableaux de bord (cockpit)
- Ligne de 3 à 5 **gros KPI** maximum (`Kpi`/`.bk-value`) : libellé court, valeur, évolution vs période précédente (vert/rouge, flèche), cliquable.
- Ensuite les blocs qui expliquent le chiffre : pipeline par étape (entonnoir avec l'étape où ça fuit en rouge), cumul du mois, répartition par canal, meilleurs clients, argent de la période (encaissé, dépenses liées, net), carte de chaleur d'activité.
- Mise à jour en temps réel (Supabase realtime) : pas de bouton « rafraîchir ».
- Un seul axe par graphique, traits fins, étiquettes directes sur peu de séries, légende si ≥ 2 séries, info-bulle au survol, état vide expliqué.

### 6.4 Listes et tableaux
- Ligne = titre (nom) + sous-ligne grise (2 lignes max) + badge d'étape/statut + montant aligné à droite en chiffres tabulaires.
- Survol de ligne gris très léger, ligne cliquable en entier.
- Actions groupées (cases à cocher → barre d'actions) pour les listes longues.
- Sur mobile, un tableau devient une liste de cartes, ou défile horizontalement **dans son conteneur** (jamais la page entière).

### 6.5 Formulaires
- Champ = libellé au-dessus (`Field`), champ pleine largeur, focus bleu avec halo doux.
- Formulaires longs découpés en **sections numérotées** (1, 2, 3…) avec des **tuiles** cliquables pour les choix fréquents (canal, résultat d'appel) au lieu de listes déroulantes.
- Bouton « Enregistrer » **collant en bas** (`.af-save`) sur mobile.
- Pré-remplir tout ce qui est connu (date du jour, client courant, montant de la facture).
- Validation à la saisie avec message humain sous le champ (« Ce numéro est déjà utilisé : choisis-en un autre »), jamais un code d'erreur.
- Formulaire rapide (3 champs) pour la saisie terrain, formulaire complet accessible ensuite.

### 6.6 Composants à réutiliser (`src/ui.jsx`)
`Modal` (plein écran sur mobile, ouverture douce 180ms), `Tabs`/`useTab`, `Chips`, `Field`, `Select`, `Choix` (liste avec recherche et saisie libre), `Kpi`, `Bar`, `Menu` (menu « ⋯ »), `KV` (paires libellé/valeur), `Empty`, `useToast`, `confirmer`, `LienProspect`, `LienDoc`, `Repartition`, `StageBadge`, formatage `eur`, `nb`, `pct`, `court`. Graphiques dans `src/charts.jsx` (SVG maison, pas de librairie).

Boutons : `.btn` (blanc bordé), `.btn.primary` (marine), `.btn.gold` (action principale, un seul par écran), `.btn.ghost`, `.btn.danger` (texte rouge), tailles `.sm` (30px) et `.lg` (44px), `.icon-btn` carré. Désactivé = opacité 0.5 + curseur interdit + raison en info-bulle.

### 6.7 États (à prévoir sur chaque écran)
- **Vide** : cadre pointillé gris clair, une phrase utile + le bouton pour créer le premier élément.
- **Chargement** : afficher tout de suite le contenu en cache de l'appareil, puis mettre à jour ; jamais un écran blanc.
- **Hors ligne / synchronisation** : bandeau orange « X éléments en attente d'envoi », or pendant l'envoi.
- **Erreur / conflit** : message clair qui dit quoi faire, l'élément est conservé et marqué (badge « Numéro à changer »).
- **Lecture seule** : bandeau en haut + boutons désactivés avec explication.
- **Succès** : toast marine en bas centré, court (« Facture enregistrée ✓ »), avec « Annuler » quand c'est réversible.

## 7. Responsive et anti-débordement (contrôlé à chaque livraison)

- Tester à **360, 390, 768, 1024, 1280, 1440px** et avec des données extrêmes : nom de 80 caractères, montant `1 250 000 000 FCFA`, 0 élément, 500 éléments.
- Enfants de grid/flex : `min-width: 0`. Textes longs : `overflow-wrap: anywhere` ou coupure sur 2 lignes. Badges et chips : ellipse.
- Les grilles passent en 1 colonne sur mobile ; utiliser `auto-fit/minmax` ou des container queries plutôt que des largeurs fixes.
- Jamais de défilement horizontal de la page. Jamais de texte coupé illisible. Jamais de bouton sous la barre de navigation mobile.

## 8. Accessibilité

- Contraste AA minimum (texte gris `--muted` sur blanc ok, jamais plus clair).
- Focus visible partout : contour bleu 2px (or sur fond marine).
- Boutons-icônes avec `aria-label`. Formulaires avec libellés reliés. Modales piégeant le focus, fermeture par Échap.
- Les tests Playwright passent `axe` : aucune violation sérieuse tolérée.

## 9. Micro-interactions

- Transitions 150–250ms, `ease-out`. Rien de clignotant, pas d'animation décorative.
- Bouton appuyé : léger enfoncement (`translateY(1px)`). Survol : fond gris très léger, pas d'effet de lumière.
- Glisser-déposer dans le kanban du pipeline, avec annulation possible.

## 10. Rédaction de l'interface

- Français, tutoiement, verbes d'action : « Encaisser », « Relancer », « Nouvelle facture », pas « Soumettre » ou « OK ».
- Phrases courtes. Un message d'erreur dit **ce qui s'est passé et quoi faire**.
- Vocabulaire métier de Juste : prospect, client, relance, RDV, devis, facture, paiement reçu, dépense, intervention, encaissé, à encaisser.
- Montants avec espace fine des milliers et devise : `100 000 FCFA`. Dates en français (« lun. 28 sept. »).

## 11. Ce qu'il ne faut jamais faire

- Couleurs ou tailles en dur au lieu des jetons ; une nouvelle taille de police hors échelle.
- Des cartes avec ombre partout (la carte sert à isoler un bloc, pas à tout encadrer).
- Un écran sans action claire, un chiffre non cliquable, une impasse.
- Des emojis comme icônes d'interface (utiliser `src/icons.jsx`).
- Un `alert()` / `confirm()` natif (utiliser `confirmer` et le toast).
- Un graphique à deux axes, un camembert à 10 parts, un arc-en-ciel de couleurs.
- Supprimer une fonctionnalité existante pendant une refonte sans le dire.
- Annoncer « enregistré » avant la confirmation réelle.

## 12. Check-list avant de livrer

- [ ] Lu les docs et le journal, compris l'existant.
- [ ] Jetons CSS et composants existants réutilisés ; thème personnalisé toujours correct.
- [ ] Mobile 360px et ordinateur 1440px vérifiés (captures Playwright si possible), données extrêmes testées.
- [ ] États vide / chargement / hors ligne / erreur / lecture seule prévus.
- [ ] Tous les chiffres cliquables et reliés.
- [ ] `npm run check` vert, tests ajoutés, e2e du parcours touché vert.
- [ ] Aucune donnée de production modifiée sans accord ; aucun secret exposé.
- [ ] Documentation et journal à jour.
- [ ] Réponse finale courte : ce qui a changé, tests passés, ce que Juste doit vérifier.
