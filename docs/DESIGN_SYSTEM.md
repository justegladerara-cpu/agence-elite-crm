# Agence Elite : design system et méthode de conception

Référence permanente commune à Claude, GPT et Codex. Elle décrit **le design réellement codé** dans ce dépôt (état du 2026-10-01, commit de fusion `0306e72` et suivants), puis les règles pour l'étendre sans créer une nouvelle identité.

- Le code reste la source de vérité. Chaque règle cite le fichier où elle vit (`fichier:ligne` approximatif : les lignes bougent, cherche le nom cité).
- Ordre de priorité : demande écrite de Juste > code existant > ce document > goûts personnels.
- Si tu modifies le design system (jeton, composant, pattern), mets ce fichier à jour dans le même commit.

Sommaire :
1. Identité et philosophie
2. Structure de l'application (coquille)
3. Jetons : couleurs, typographie, espacements, rayons, ombres, couches
4. Composants (catalogue et règles d'usage)
5. Patterns d'écrans (liste, hub, fiche, formulaire, tableau de bord, paramètres)
6. Retours utilisateur : notifications, erreurs, confirmations, chargement, vide, droits, hors ligne
7. Responsive, tactile, accessibilité
8. Conventions de code et de nommage
9. À réutiliser absolument / erreurs à éviter / dette connue
10. Comment concevoir un nouveau module Agence Elite (pas à pas + exemples)
11. Check-list avant livraison
12. Instructions prêtes à transmettre à GPT

---

## 1. Identité et philosophie

### 1.1 Identité
- **Marque** : AGENCE ELITE, logo « AE » (A noir/blanc + barres, accent rouge sur le logo d'origine), sous-titre « CRM de pilotage ». Composant `Logo` dans `src/icons.jsx`, réglages dans Paramètres › Identité (`src/pages/Parametres.jsx`, `src/lib/theme.js`).
- **Ambiance** : logiciel de gestion professionnel, sobre et dense, inspiré de **Zoho One / Zoho Books / Odoo** pour la structure (lanceur d'applications, une couleur par application, menu par application, onglets, vue côte à côte) et de la rigueur Linear/Stripe pour les détails (chiffres tabulaires, bordures fines, ombres quasi absentes).
- **Palette de marque** : **marine** profond `#0c1833` (menu, boutons primaires, tuiles KPI fortes) + **or** `#b8903f` (action principale, accent). Fond de page gris très clair `#f5f6f8`, cartes blanches.
- **Une couleur par application** (variable `--app`) qui marque l'élément actif du menu et les onglets mobiles. La marque (marine/or) reste partout ailleurs.
- **Police unique Inter**, hébergée avec l'appli (`src/assets/fonts`, `src/index.css:1-17`) : fonctionne hors ligne. Pas de serif (la variable `--serif` est un reste de nom : elle vaut Inter).
- **Langue** : français, **tutoiement** partout (« Tes factures en PDF avec ton logo et leur statut de paiement. »).
- **Contexte d'usage** : Juste (Afrique centrale/de l'Ouest), montants en **FCFA** ou EUR selon les réglages, usage fréquent **sur téléphone**, réseau instable.

### 1.2 Philosophie UI/UX (ce qui guide chaque écran)
1. **Une seule saisie, tout le reste est calculé.** On note un fait (appel, étape, paiement, dépense) ; statuts, relances, chiffres, tableaux de bord se déduisent. L'étape d'un prospect et le statut d'une facture sont calculés, jamais stockés (`src/lib/logic.js`, `src/modules/*`).
2. **Action d'abord.** Chaque écran met en avant la prochaine action utile : un seul bouton or par écran (« Nouveau client », « + Nouvelle facture », « Enregistrer »), actions de ligne courtes (« Paiement », « Suivi », « Relancer »).
3. **Tout chiffre est cliquable** et ouvre la liste qui le compose (drill-down `src/pages/Drill.jsx`), tout élément est relié (fiche ↔ actions ↔ devis ↔ factures ↔ paiements ↔ dépenses).
4. **Rien ne se perd.** File hors ligne (`src/lib/store.js`), suppression = corbeille + « Annuler » dans le toast (`src/lib/corbeille.js`), refus serveur conservé et expliqué (`src/lib/conflits.js`). On n'annonce jamais « enregistré » avant la confirmation réelle.
5. **Densité lisible** : beaucoup d'information, mais hiérarchie nette (titre 22px, sections 15px, texte 14px, méta 12.5px gris), chiffres alignés, bordures fines plutôt qu'ombres.
6. **Pas de chiffre inventé** (`docs/DECISIONS.md`) : sans donnée, on affiche un état vide qui explique comment en obtenir.
7. **Simple et pragmatique** : Juste préfère un outil utilisable au quotidien à un outil exhaustif. Divulgation progressive (champs avancés repliés, « + Actions client et autres »).

---

## 2. Structure de l'application (coquille)

Fichier central : `src/App.jsx`. Styles : `src/index.css` (feuille unique, blocs successifs : base `1-610`, « Zoho » `611-1087`, « Operating System » `1088-1497`, « Design system v2 » `1499-1742`, « Cockpit » `1743-1976` ; **les blocs plus bas l'emportent**).

### 2.1 Données de navigation (`src/App.jsx`)
- `NAV` (`:48`) : groupes `{titre, items:[{path, label, ico, memo?, sub?}]}`. N'est plus dessiné tel quel : alimente les libellés de page, la recherche Ctrl K (`sub` → « Page › Sous-page ») et la surbrillance.
- `APPS` (`:142`) : **ce que voient le menu, le lanceur et les onglets mobiles**. `{id, nom, desc, ico, couleur, pages:[…], entrees?:[[route,label]], lien?}`.
- Couleurs d'applications actuelles :

| Application | id | couleur | icône |
|---|---|---|---|
| Tableau de bord | analytics | `#7a4cdb` (violet) | chart |
| Commercial | commercial | `#2f6fed` (bleu) | briefcase |
| Facturation | facturation | `#18a058` (vert) | file |
| Charges | charges | `#c2410c` (orange brûlé) | wallet |
| Agenda | agenda | `#0e9aa7` (turquoise) | calendar |
| Site web | site | `#10151f` (noir) | globe |
| Paramètres | parametres | `#5b6475` (gris) | settings |

- `APP_DE` (`:160`) page → application ; `PASTILLES` (`:162`) compteurs du menu ; `BOTTOM` (`:185`) barre basse mobile ; `PARAMETRES` (`:125`) sections de réglages.
- `<div className="app" style={{'--app': appli.couleur}}>` (`:655`) injecte la couleur de l'application courante.

### 2.2 Menu latéral (ordinateur)
`aside.sidebar` (`App.jsx:656-715`, CSS `index.css:79, :1151, :1691-1704`)
- Largeur **232px**, fixe, fond `var(--navy)`, padding `18px 12px 12px`, colonne avec gap 3px.
- De haut en bas :
  1. Marque : logo + nom + sous-titre (masquable : `apparence.afficherNom`).
  2. `button.nav-search` « Rechercher… » avec badge `Ctrl K`.
  3. `button.nav-new` **or** « + Nouvelle action » avec badge `N` (ouvre la saisie d'action).
  4. `nav.nav-arbre` : une **rubrique par application**. Rubrique repliable (`.nav-rubrique` + `.nav-parent` avec chevron) ; seule l'application courante est ouverte par défaut. Enfants `.nav-enfant` (padding gauche 42px). Application à une seule page = simple `.nav-item`.
  5. `.sidebar-foot` : point vert + état de synchronisation (« Mode démo… », « Synchronisé à 20:16 »).
- `.nav-item` : 13px, poids 500, couleur `--on-dark`, radius 6px, min-height 34. Survol `rgba(255,255,255,.05)`. **Actif** : fond `rgba(255,255,255,.07)`, blanc, poids 600, barre intérieure gauche 3px `var(--app)` ; enfant actif = fond plein `color-mix(var(--app) 85%, #000)` texte blanc (cf. captures : « Vue d'ensemble » violet, « Factures » vert, « Clients » bleu).
- Pastilles `.nav-badge` (20×19, pilule ; `.hot` = or).
- **Règle (décision de Juste 2026-09-29)** : pas de sous-menus de filtres/onglets dans le menu ; le menu liste les pages, les filtres vivent dans la page.

### 2.3 Zone de contenu
- `.main` (`index.css:104`) : `margin-left: 232px`, padding `22px 28px 60px`, **max-width 1440px**, `min-width: 0`.
- Chaque page commence par `.page-head` (titre + sous-titre à gauche, actions à droite), puis un empilement vertical (`.stack` ou flex column gap 14).
- Bandeaux globaux au-dessus du contenu (`App.jsx:730-745`) : mode démo (`.banner` or doux), lecture seule et synchronisation (`.sync-banner`).

### 2.4 Mobile (≤ 860px)
- Le menu latéral disparaît (`index.css:105`).
- `header.mobile-top` (`App.jsx:717-729`) : barre marine collante, logo + nom + ligne « Application · Page », boutons 44×44 Recherche et Grille (→ lanceur `#/apps`). Respecte `env(safe-area-inset-top)`.
- `nav.app-onglets` (`App.jsx:746-755`) : **pilules horizontales** des pages de l'application courante, défilantes (actif = `--app` assombri).
- `nav.bottom-nav` (`App.jsx:758-766`, `index.css:114, :1169`) : **5 entrées fixes** Tableau · Journée · **Noter** (rond or 46px surélevé, `margin-top:-22px`, anneau marine) · Prospects · Clients. Hauteur min 48px, padding bas `env(safe-area-inset-bottom)`. On remplace une entrée, on n'en ajoute pas.
- `.main` : marge 0, padding `0 12px 100px` (place pour la barre basse).

### 2.5 Lanceur d'applications
`src/pages/Applications.jsx`, route `#/apps` (CSS `.lanceur*`, `.appli*`, `index.css:1405-1430`).
- Date du jour en gris, titre « Bonsoir Juste, que veux-tu ouvrir ? ».
- Grille 4 colonnes (3 ≤1100px, grille d'icônes sur mobile) de tuiles blanches `button.appli` (padding 20, radius 16, se soulève de 2px au survol) : icône 60px dans un carré arrondi en **dégradé de la couleur de l'application** (`--c`), pastille rouge de compteur, nom en gras, description grise.

### 2.6 Recherche et raccourcis
- `src/pages/Recherche.jsx` : Ctrl/⌘ K ou `/`. Boîte max 620px, résultats groupés (`.search-grp`), navigation ↑ ↓ Entrée, plein écran sur mobile.
- Raccourcis (`App.jsx:309-342`, aide dans `src/pages/Raccourcis.jsx`) : `N` nouvelle action, `?` aide, `G` puis lettre (J journée, P prospects, C clients, F factures, D tableau de bord, A applis, S session). Ignorés pendant la saisie ou si une modale est ouverte.

### 2.7 Routage
- Hash `#/page/arg?query` (`useRoute`, `App.jsx:208`), découpé `:592-594`. Navigation `go('/factures?filtre=retard')` (`src/ui.jsx:43`).
- Les paramètres d'URL deviennent des props (`onglet`, `filtre`, `nouveau=1` ouvre la modale de création), page montée avec `key={route}`.
- Pages lourdes en `lazy()` (`App.jsx:15-34`) dans un seul `<Suspense fallback={<div className="chargement"/>}>`.

---

## 3. Jetons

Tous dans `:root` de `src/index.css` (`:18`, `:1482`, `:1503`). **N'écris jamais une couleur de marque en dur** : `src/lib/theme.js` (`palette()`, `:53-80`) régénère `--navy*`, `--gold*`, `--on-dark*`, `--on-accent` à partir de 2 couleurs quand l'utilisateur change de thème (Marine & or, Noir & rouge, Noir & or, Vert & or, Bleu & corail, Personnalisé).

### 3.1 Couleurs

| Rôle | Jeton | Valeur |
|---|---|---|
| Principale (menu, primaire, tuile forte) | `--navy` | `#0c1833` |
| Variantes | `--navy-2` `#14224a` (survol primaire), `--navy-3` `#1e2f5c`, `--navy-ink` `#0f172a`, `--navy-rgb` `12, 24, 51` | |
| Accent | `--gold` | `#b8903f` |
| Variantes or | `--gold-2` `#d9bd83` (accent sur fond sombre), `--gold-3` `#7d5f25` (survol bouton or, texte or lisible), `--gold-soft` `#f8f3e8` (fond), `--gold-line` `#e8dabd` (bordure), `--gold-ink` `#6b5020` (texte sur fond or doux), `--gold-rgb` | |
| Texte sur fond sombre | `--on-dark` `#b9c3d9`, `--on-dark-2` `#9fb0cf` ; sur accent `--on-accent` (= marine) | |
| Fond de page | `--bg` | `#f5f6f8` |
| Carte | `--card` | `#ffffff` |
| Texte | `--text` | `#0f172a` |
| Texte secondaire | `--muted` | `#5b6475` (le plus clair autorisé pour du texte) |
| Bordures | `--line` `#e4e7ec`, séparateurs internes `--line-2` `#eef0f3` | |
| Succès | `--green` `#0f7b55` / `--green-soft` `#e4f3ec` | |
| Attention | `--orange` `#b45309` / `--orange-soft` `#fdf1e3` | |
| Danger | `--red` `#c0322e` / `--red-soft` `#fbeceb` | |
| Info, liens, focus | `--blue` `#2f5bd3` / `--blue-soft` `#eaf0fc` | |
| Couleur de l'application | `--app` (inline, cf. §2.1) | |

Gris d'interface utilisés en dur (à remplacer par des jetons si tu touches la zone, voir §9.3) : survol `#f7f8fa`, bordure survol `#cdd2da`, fond segmenté `#ebedf1`, fond icône de section `#f1f3f6`, fond vide `#fafbfc`.

**Règles couleur**
- Or = **rare** : un bouton principal par écran, CTA du menu, indicateur actif. Si tout est or, rien ne ressort.
- Statuts réservés à leur sens : vert = payé/gagné/positif, orange = retard/attention, rouge = danger/argent dû/perdu, bleu = info/lien. Toujours accompagnés d'un texte ou d'une icône.
- Badges d'étape du pipeline (`index.css:186-198`) — fond doux + texte de la même teinte :
  Nouveau gris `#eef0f4/#4b5570` · Contacté bleu · Qualifié violet `#f0eafb/#6c46bb` · Audit/Démo turquoise `#e2f3f5/#11788a` · RDV or doux · Proposition orange · Gagné vert · Perdu gris.
- Graphiques : palette catégorielle **fixe et ordonnée** `COULEURS` (`src/charts.jsx:7`) `#2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948` + « Autres » `#a3a9b8`. Une entité garde sa couleur partout.
- Pas de mode sombre dans l'appli (le menu est sombre, le contenu clair). Le thème se change par Paramètres › Identité.

### 3.2 Typographie
- Inter, 14px, interligne 1.5. Chiffres : `font-variant-numeric: tabular-nums` sur KPI, montants, colonnes (`index.css:1108` et suivantes).
- Échelle (`index.css:1505-1511`) — **n'en sors pas** :

| Jeton | Taille | Usage |
|---|---|---|
| `--fs-xs` | 11.5px | badges, méta, `.tiny` |
| `--fs-sm` | 12.5px | sous-lignes, `.small`, `.btn.sm` |
| (base) | 14px | texte, champs |
| `--fs-md` | 15px | titre de section `h2.section` |
| `--fs-lg` | 17px | titre de modale/panneau |
| `--fs-xl` | 22px | titre de page `h1` |
| `--fs-2xl` | clamp(22–30px) | grands nombres éventuels |

- Hiérarchie réelle :
  - `h1` de page : 22px, 700, `letter-spacing -0.02em`, couleur texte (`index.css:1542`).
  - `.sub` sous le titre : 13px gris, une phrase en tutoiement.
  - `h2.section` : 15px, 700, précédé d'une icône dans `.sec-ic` (26×26, radius 7, fond `#f1f3f6`, bordure `--line`, icône marine 16px).
  - Libellé de KPI : 10.5–11px, **majuscules**, gris, `letter-spacing` léger (« ENCAISSÉ », « CA SIGNÉ »).
  - Valeur de KPI : `clamp(18px, 1vw + 13px, 24px)`, 700 (cockpit : `clamp(19px, 1.2vw + 10px, 26px)`).
  - En-tête de tableau : 11px, 600, majuscules, `.04em`, gris.
  - Libellé de champ : 12px, 700, gris.
  - Titre de ligne `.li-title` : 700, ellipse ; sous-ligne `.li-sub` : 12.5px gris, 2 lignes max.
- Formats (`src/ui.jsx:8-41`, `src/lib/dates.js`) : `eur(v)` → « 100 000 FCFA » / « 1 200 € » (devise des réglages, « — » si vide), `nb`, `pct` (« 42 % »), `court` (« 1,2 M », « 988 k », axes et donuts seulement), `lbl('Montant (€)')` remplace € par la devise, `fmtDate` → « mar. 1 oct. », `fmtMonth` → « octobre 2026 ».

### 3.3 Espacements, grilles, alignements
- Grille de 4px (`index.css:1514-1520`) : `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32.
- Valeurs réellement utilisées : gap de grille **12px**, gap de pile **14px**, padding de carte **16px** (13 mobile), gap de formulaire **14px**, marge sous `.page-head` 14px.
- Grilles utilitaires (`index.css:147-153`) : `.grid` (gap 12) + `.grid-2/3/4/6` en `minmax(0,1fr)` ; `grid-4`→2 colonnes ≤1100px ; `grid-2/3`→1 colonne ≤860px. `.row` (flex wrap gap 8), `.spacer` (pousse à droite), `.stack` (colonne).
- `.form-grid` : `repeat(auto-fill, minmax(180px, 1fr))` gap 14 ; `.form-grid.tight` 140px. Pleine largeur : `style={{gridColumn:'1 / -1'}}`.
- Alignements : montants et nombres **à droite** (`th.num/td.num`, `.li-side`) ; titres à gauche ; actions de page à droite de l'en-tête ; actions de ligne en fin de ligne.

### 3.4 Rayons, ombres, couches
- Rayons : carte `--radius` **12px**, bouton `--r-btn` **8px**, badge `--r-badge` **6px**, modale `--r-modal` **16px**, onglets segmentés 10/8px, tuile du lanceur 16px.
- Ombres : `--shadow` `0 1px 2px rgba(navy,.05)` (cartes, presque invisible) ; `--shadow-lg` `0 16px 40px -16px rgba(navy,.28)` (modales, menus, toast). La séparation se fait par **bordures 1px**, pas par ombres.
- Couches (`index.css:1522-1538`) : dropdown 250, drawer 300, modal 400, popover 450, toast 500. Coquille en littéral : sidebar 20, mobile-top 25, bottom-nav 30, save-bar 40, bulk-bar 60.
- Zone tactile minimale `--tap` **44px**.

---

## 4. Composants (catalogue)

Tous dans `src/ui.jsx` sauf mention. **Réutilise-les, ne les recrée pas.**

### 4.1 Boutons (`index.css:205-218, :1110-1121, :1560`)
| Classe | Rendu | Usage |
|---|---|---|
| `.btn` | blanc, bordure `--line`, texte, radius 8, `8px 14px`, 13px 600, min-height 36 | action secondaire |
| `.btn.gold` | fond or, texte marine ; survol `--gold-3` texte blanc | **l'action principale de l'écran (une seule)** |
| `.btn.primary` | marine, texte blanc ; survol `--navy-2` | action forte secondaire (« Ajouter », barre groupée) |
| `.btn.ghost` | transparent | « Annuler », « ← Retour », « Réinitialiser » |
| `.btn.danger` | texte rouge (plein rouge dans une modale de confirmation) | suppression |
| `.btn.sm` | `5px 10px`, 12.5px, min-height 30 (40 tactile) | actions de ligne, barres d'outils |
| `.btn.lg` | min-height 44, 14.5px 700 | « Enregistrer » d'un grand formulaire |
| `.btn.block` | pleine largeur | mobile |
| `.btn.on` | bordure marine, fond `#f1f3f6` | bascule active |
| `.icon-btn` | carré 30×30 (44 tactile), bordure, radius 8, **`aria-label` obligatoire** | fermer, modifier, supprimer, « ⋯ » |

- Survol : fond `#f7f8fa` + bordure `#cdd2da` ; appui : `translateY(1px)` ; désactivé : opacité .5, curseur interdit.
- Contenu : icône 14–16px (`<Icon n="plus" size={14}/>`) + verbe ou nom court. Préférer l'icône `plus` au caractère « + » pour les nouveaux écrans (les deux coexistent).

### 4.2 Champs et sélecteurs
- `Field({label, style})` (`ui.jsx:67-88`) : `div.field` > `label` + enfant. Relie automatiquement le libellé (`aria-labelledby`). Passe un `<input>` nu dedans (le style vient de `.field input`). Libellé passé par `lbl()`.
- Champ : bordure `--line`, radius 8, `8px 11px`, 14px ; **focus = bordure bleue + halo `0 0 0 3px rgba(47,91,211,.18)`** (`index.css:1097`). `textarea` min-height 76.
- Nombres : `type="text" inputMode="decimal"` ; téléphone `inputMode="tel"`. Placeholders utiles : « Auto : 1 200 € », « Rechercher : nom, contact, téléphone, ville, offre… ».
- `Choix({value, onChange, options, placeholder='Choisir…', libre=true})` (`ui.jsx:96-182`) : **le sélecteur standard**. Bouton `.choix` (survol/ouvert = bordure or + halo or) → popover portail `.choix-pop` (radius 12, ombre forte, max 320px, s'ouvre au-dessus si peu de place), recherche si > 6 options, ✓ sur l'option choisie, « Effacer le choix », « + Utiliser « x » » si saisie libre, vide : « Aucune option : ajoute-en dans Paramètres › Listes. ».
- `Select(...)` : alias de `Choix` sans saisie libre.
- `Chips({options, value, onChange, small, allowEmpty})` (`ui.jsx:50`) : choix rapides ; `.chip.on` = marine texte blanc ; recliquer = vider. Compteur `<span className="chip-n">`.
- Pilules segmentées `.seg` (`FicheForm.jsx:55-64`, `index.css:1219`) : **règle : ≤ 4 options → pilules segmentées ; plus → `Choix`** ; `role="radiogroup"`/`radio`.
- Tuiles `Tuile` (`Saisie.jsx`, `.tiles`, `.tile`) : grands boutons icône + libellé pour les choix fréquents (canal, action), couleur de groupe via `--t`, coche quand actif, 2 par ligne sur mobile.
- `ProspectPicker` (`src/core/ui/ProspectPicker.jsx`) : combobox de recherche d'un client/prospect avec « ＋ Nouveau prospect : « q » ». À réutiliser pour toute sélection d'une fiche.
- `<input list>` + `<datalist>` pour des suggestions libres simples ; `<select className="input">` natif toléré pour les filtres de barre d'outils (période, canal, tri).

### 4.3 Cartes
- `.card` : blanc, bordure 1px `--line`, radius 12, ombre `--shadow`, padding 16 (13 mobile). `.card + .card` = 12px d'écart.
- `.card.flush` : padding 0, `overflow:hidden` : pour envelopper une barre d'outils + liste/tableau bord à bord.
- Titre de carte : `<h2 className="section"><span className="sec-ic"><Icon n="…" size={16}/></span> Titre</h2>`, éventuel lien à droite `toggle-link` (« Tout voir (12) ») poussé par `marginLeft:'auto'`.
- Une carte isole un **bloc logique** ; ne mets pas une carte dans une carte sans raison.

### 4.4 KPI
- `Kpi({label, value, delta, invert, navy, vs='mois préc.', onClick})` (`ui.jsx:228-249`) : tuile `.kpi` (padding `12px 14px`), libellé majuscule, valeur grande, delta ▲/▼ coloré (`invert` quand une baisse est bonne), cliquable (`role="button"`, Entrée) → drill-down.
- Rangée : `<div className="grid grid-4">` ; **convention : les 1 ou 2 premiers KPI en `navy`** (tuile marine, texte blanc), les suivants blancs (cf. Factures : Total facturé, Encaissé en marine ; Reste à encaisser, Factures en retard en blanc).
- Libellés courts : « Total facturé », « Encaissé », « Reste à encaisser », « Factures en retard », « Abonnements actifs ».
- KPI riches du cockpit : `KpiTile` local à `src/pages/Cockpit.jsx:99-142` (comparaison avec la période précédente, barre d'objectif, projection, mini-courbe `Spark`). À copier si un module a un vrai cockpit.
- `Bar({value, max, tone})` : barre de progression fine.

### 4.5 Badges, statuts, score
- `<span className="badge b-green|b-red|b-orange|b-gold|b-navy">` (`index.css:185, :1104`) : radius 6, `3px 8px`, 11.5px 600, ellipse.
- `StageBadge({etape})` → `badge b-{etape}` (étapes du pipeline).
- Statut = table de correspondance `{statut: [libellé, ton]}` ou `STATUT_TONE[statut]` dans le module, jamais une couleur inline.
- `.score` (`.hot` rouge plein, `.warm` orange doux, `.cold` gris) pour un score de priorité.
- `.tag` gris pour un état secondaire (« En pause »). Badge rouge d'alerte : « Numéro à changer ».

### 4.6 Onglets
- `Tabs({items:[[id, label, count?]], value, onChange})` (`ui.jsx:343`) : contrôle **segmenté** (fond `#ebedf1`, radius 10, onglet actif blanc avec ombre). `count` affiché en pastille `.pt-count`, `undefined` = pas de pastille.
- `useTab(key, défaut, forcé)` (`ui.jsx:327`) : onglet mémorisé pendant la session, forcé par l'URL (`?onglet=`), synchronise la surbrillance du menu (`crm-onglet`). La clé correspond au `memo` de l'entrée NAV.
- `.ptabs` : onglets **soulignés** (trait or 2px) dans l'en-tête de fiche (`Fiche.jsx`) et listes Factures/Devis. Défilent horizontalement sur mobile.
- `.ck-seg` : vues du cockpit (Complète / Direction / Opérations).

### 4.7 Tableaux et listes
- Liste d'entités : `div.list` > `div.list-item.click` > `.li-main` (`.li-title`, `.li-sub`) + `.li-side` (montant `<b>`, badges) (`index.css:259-267`). Sous-ligne = `[a, b, c].filter(Boolean).join(' · ') || 'Repli'`. Ligne inactive : opacité .55. `.overdue` = barre rouge intérieure gauche.
- Tableau de documents/chiffres : `div.table-wrap[tabIndex=0][role=region][aria-label]` > `table.t` (+ `.zt` dans une carte flush). `th.num/td.num` à droite ; `tr.click` + `onClick={() => go(...)}` ; `td.lnk` identifiant bleu ; `td.ell` nom tronqué ; `.hide-m` colonnes masquées sur mobile ; dernière colonne = action en ligne.
- Ligne riche du hub `.hub-row` (`index.css:1221-1300`) : grille case à cocher · score/avatar · nom + sous-ligne + alerte · badges · montants (`.k` libellé / `.v` valeur, `.v.red` si dû) · actions (`btn sm` + `Menu` « ⋯ »).
- Pas de pagination : listes complètes ; résumés limités avec « Tout voir » / « Voir 20 de plus ».

### 4.8 Menus
- `Menu({label, icon='chevron', items, className='btn sm', align='right', ariaLabel})` (`ui.jsx:357-424`) : popover portail `.menu-pop` (`role="menu"`), items `{label, icon, onClick, danger, disabled}`, `'-'` = séparateur, items falsy ignorés (`cond && {...}`). Kebab de ligne : `label="" icon="more" className="icon-btn" ariaLabel="Plus d'actions pour X"`. Ferme sur clic extérieur, Échap, défilement.

### 4.9 Modales et panneaux
- `Modal({title, onClose, children, large})` (`ui.jsx:185-217`) : portail, fond `rgba(navy,.45)`, boîte fond `--bg` radius 16 padding 22, max 740px (`large` 900px), animation 180ms ; **plein écran sur mobile** avec en-tête collant et bouton fermer 44px ; Échap et clic sur le fond ferment ; focus placé dans la boîte.
- Le pied de formulaire est dans les enfants : `.ff-foot` (collant, « Annuler » + `btn gold` « Enregistrer ») ou `.af-save` pour les grands formulaires.
- Panneau latéral (drill-down) : `src/pages/Drill.jsx` : `.drawer` à droite 460px (`slideIn` 180ms), en-tête titre + résumé gris (« 12 actions · 5 prospects · 450 000 FCFA »), corps défilant ; **bottom sheet 86 %** sur mobile.
- Vue côte à côte : `.split` (`App.jsx:617-624`) mini-liste 270px + fiche ; mini-liste masquée < 1100px.

### 4.10 Icônes
- `Icon({n, size=18})` (`src/icons.jsx`) : SVG maison style Lucide, viewBox 24, trait `currentColor` 1.8, `aria-hidden`. Nom inconnu = rien.
- Noms disponibles : facebook, briefcase, x, info, check-circle, alert-circle, arrow-right, list, columns, rotate, user-plus, more, send, save, keyboard, grid, note, star, layers, check, sun, users, plus, handshake, chart, settings, phone, message, instagram, globe, alert, flame, bell, calendar, clock, target, trophy, folder, repeat, flask, bolt, mail, tag, coins, trend, funnel, radio, ban, search, edit, trash, play, sparkles, download, upload, logout, file, share, eye, copy, menu, clipboard, chevron, wallet.
- Tailles : 14 dans les petits boutons, 16 dans `.sec-ic`, 18 par défaut, 22 état vide, 30 lanceur. Retour = `arrow-right` tourné à 180°. Pour une nouvelle icône : ajouter un `d` dans la table de `icons.jsx`, même style (trait, pas de remplissage). **Jamais d'emoji comme icône d'interface** (`withIcon('🎯 Titre')` convertit un emoji de titre en icône).

### 4.11 Graphiques (`src/charts.jsx`, SVG maison, pas de librairie)
- `Donut({items, fmt, total, max=5, onPick})` (top 5 + « Autres »), `HBars({rows, fmt, color, empty, best, onPick})`, `Funnel({steps, onPick})` (étape qui fuit en rouge), `Gauge({label, value, cible, proj, fmt, onClick, reste})`, `useWidth()` pour la largeur.
- Locaux réutilisables par copie : `Spark` (Cockpit), `MonthChart`, `ActivityChart` (Dashboard), `PipelineEtapes`, `CumulMois`, `Heatmap`, `MeilleursClients` (DashPlus).
- Règles : un seul axe, traits fins, couleur = entité, info-bulle au survol, **chaque élément cliquable** (`onPick` → drill), vide : « Pas encore de données sur la période. », `role="img"` + `aria-label`.

---

## 5. Patterns d'écrans (observés dans le code)

### 5.1 Page liste standard — modèle à copier par défaut
Exemples : `src/pages/Factures.jsx:58-145`, `src/pages/Charges.jsx:169-237` (Abonnements), `src/pages/Boutique.jsx:54-145`.
```
.stack
  .page-head
    div > h1 « Factures » + .sub « Tes factures en PDF avec ton logo et leur statut de paiement. »
    .row > btn gold « Nouvelle facture »
  .grid.grid-4 > Kpi navy ×2, Kpi ×2          (chiffres de la liste, cliquables)
  Tabs [[toutes,'Toutes'], [impayees,'Impayées',n], [retard,'En retard',n], [payees,'Payées',n]]
  .card.flush
    .list-tools > input.input « Rechercher : numéro, client, objet… »
    vide ? <Empty> : .table-wrap > table.t.zt (ou .list > .list-item)
  {modale de création/édition}
```
- Filtres définis en **tableaux de tuples** `[id, libellé, prédicat]` ; onglets/chips générés avec le compte du prédicat. Onglet optionnel vide = masqué.
- Recherche en `useState('')`, insensible aux accents (`norm()` NFD dans `Hub.jsx:59-63`).
- Tri par défaut dans `useMemo` (ex. date décroissante).
- Vide : « Aucune facture pour le moment. » si aucune donnée ; « Rien dans ce filtre. » si le filtre vide la liste.

### 5.2 Hub (entité riche multi-catégories)
Exemple unique : `src/pages/Hub.jsx` (Prospects/Acquisition et Clients). À utiliser seulement pour une entité centrale avec catégories et actions.
- `.hub-cards` : cartes-catégories cliquables à la place des onglets (icône colorée `--c`, libellé, grand nombre, indicateur « 1 en onboarding », « 0 FCFA/mois » ; active = bordure marine 2px + barre de couleur en bas). Défilement horizontal sur mobile.
- `.card.flush.hub-panel` : `.hub-tools` (recherche avec icône et bouton ×, sélecteur canal, « Tri : priorité », « Réinitialiser » si filtre actif) → `.hub-sub` (chips de filtre avec compteurs + bascule Liste/Pipeline) → `.hub-strip` (4 totaux : Total signé, Encaissé, Reste à encaisser en rouge, Revenu récurrent) → en-tête « 1 client » + case tout cocher → lignes `.hub-row`.
- Sélection multiple → barre flottante marine `ActionsGroupees` (`Prospects.jsx:101-182`, `.bulk-bar`) : « N sélectionnés », actions, Exporter (CSV `;` avec BOM), Supprimer (avec `confirmer`), ×.
- Préférences durables (tri, vue) en `localStorage` via `lirePref/ecrirePref` avec try/catch ; filtres de session dans un objet `memo` de module.
- Annonce accessible `div.sr-only[aria-live=polite]` « Clients actifs : 3 résultats ».
- Kanban (vue Pipeline) : colonnes par étape, glisser-déposer, 60 cartes max puis « + N autres ».

### 5.3 Page détail (fiche)
Exemple : `src/pages/Fiche.jsx` (route `#/prospect/:id`), document : `Factures.jsx:366-457`.
- En-tête `.rec-head` : bouton retour (`icon-btn`, flèche) · avatar initiales `.rec-avatar` · `h1` + sous-titre gris (champs joints par « · », repli « Ajoute ses infos avec « Modifier » ») + badges (étape, score, statut) · à droite `.rec-actions` : boutons contact, **`btn gold sm` « + Action »**, `Menu` « Plus » (Nouveau devis, Nouvelle facture, Modifier, —, Supprimer en danger).
- Sous l'en-tête : barre de progression du processus (prospect) ou `.rec-strip` 4 chiffres clés (client ; `.v.red` si dû ; 2×2 sur mobile).
- Onglets soulignés `.ptabs` : Aperçu · Historique · Chronologie · Devis et factures · Informations (`useTab('fiche','apercu')`).
- Aperçu `.rec-grid` : colonne principale (prochaine étape, suivi, historique avec note rapide en ligne) + colonne de droite 340px « Détails » en `KV` groupés (titres `.kv-title` majuscules or : Contact / Suivi / Vente), lignes vides masquées. 1 colonne < 1100px.
- Édition : modale `FicheForm` ; petites cases à cocher / zones de texte qui s'enregistrent seules (`onChange`/`onBlur`).
- Introuvable : carte + `Empty` « Cette fiche est introuvable : elle a peut-être été supprimée. » + retour.
- Éditeur de document : `.page-head` avec badges dans `.sub`, « ← Retour » (`btn ghost`) + `btn gold` « Enregistrer » (désactivé si rien n'a changé, « Enregistrement… » pendant l'envoi), puis barre d'actions du document (PDF, WhatsApp…, `.spacer`, actions danger en `btn ghost sm danger`).

### 5.4 Formulaires
- **Formulaire court** (modale) : `.form-grid` de `Field` + `.ff-foot` (Annuler / Enregistrer or).
- **Formulaire de fiche** `src/pages/FicheForm.jsx` : grand champ nom, barre « Fiche complétée à N % », sections repliables `.ff-sec` (icône, titre, sous-titre, compteur « 3/5 » vert quand complet), champs en grille 210px, ≤ 4 options = pilules.
- **Grand formulaire d'action** `src/pages/Saisie.jsx` (`ActionForm`) : **sections numérotées** (rond marine 1 Prospect · 2 Canal · 3 Action · 4 Résultat · 5 Suite) avec aide grise (« Obligatoire pour une prise de contact »), **tuiles** pour les choix, champs de détail qui apparaissent selon l'action, dates rapides (Demain, J+2, J+5, J+10, 1 mois), **barre collante `.af-save`** en bas avec récapitulatif en direct (« Prospect · Canal · Action · Résultat ») + « Autre action » + `btn gold lg` « Enregistrer ».
- **Saisie rapide** `src/pages/Rapide.jsx` (`QuickForm`) : 3-4 groupes de chips (`fieldset` + `legend`), note, « Formulaire complet » (ghost) + « Enregistrer » (or lg). Utilisée quand le contexte est connu (prospect déjà choisi).
- Règles : tout pré-remplir (date du jour, heure, client courant, canal du prospect, prochain numéro, échéance calculée) ; champs obligatoires **non marqués d'astérisque** : l'aide ou « (facultatif) » dans le libellé le dit ; validation à l'envoi avec **toast d'erreur précis** (« Choisis une action », « Date manquante », « Indique le client ») ; doublons signalés en direct sous le champ (`.doublon`, fond rouge doux + icône) ; `busy` désactive le bouton et change son libellé.

### 5.5 Tableau de bord
Exemples : `src/pages/Cockpit.jsx` (Vue d'ensemble), `src/pages/Dashboard.jsx` (Acquisition, Conversion, Finances), `src/pages/DashPlus.jsx`.
- En-tête : `h1` + `.sub` « 7 derniers jours (ven. 25 sept. → jeu. 1 oct.), tous canaux » ; à droite badge d'état des données (`EtatDonnees` : « En direct · mis à jour à HH:MM ») + sélecteurs période et canal. Deuxième ligne : vues segmentées + « Personnaliser », « Copier le lien », « Imprimer ».
- Filtres **dans l'URL** sans historique (`paramsUrl/ecrireUrl`, `Cockpit.jsx:19-34`), valeurs par défaut retirées de l'URL.
- Rangée de KPI : 1re tuile marine, autres blanches ; libellé majuscule, valeur, delta en pastille (▼ 100 % rouge doux / ▲ 50 % vert doux) + « 7 j préc. : 1 500 € (−1 500 €) », ligne objectif + barre fine, mini-courbe en haut à droite.
- Grille 12 colonnes `.ck-grid` : **Centre d'attention** (8 col. ; alertes triées par gravité `critique/attention/info/positif`, bordure gauche colorée, icône, titre gras, détail gris, bouton d'action « Relancer », « Voir la liste ») + **Santé de l'activité** (4 col. ; score /100 coloré, dimensions avec barres, `<details>` « Comment ce score est calculé »), puis tendance, parcours, canaux, objectifs, flux d'activité, tableau détaillé avec export CSV.
- Temps réel Supabase (`App.jsx:390-405`) : pas de bouton rafraîchir obligatoire ; secours par interrogation 60 s.
- Tout chiffre ouvre `Drill`.

### 5.6 Paramètres
Exemple : `src/pages/Parametres.jsx`, `src/pages/Membres.jsx`, `src/pages/Modules.jsx`.
- Les sections sont **dans le menu latéral** (rubrique Paramètres) et en pilules sur mobile ; `SECTIONS = [[id, libellé, description, icône]]` (`:28`) **et** `PARAMETRES.sub` (`App.jsx:125`) à tenir à jour ensemble.
- En-tête : « Paramètres » + description de la section ; à droite « Annuler » (si modifié) + `btn gold` « Enregistrer » (désactivé tant que rien n'a changé). Barre collante « Modifications non enregistrées » quand c'est modifié.
- Contenu : cartes en 2 colonnes (`cols(...)` = `grid grid-2`), construites par `numCard` (champs numériques alignés à droite) et `listCard` (éditeur de liste `ListEditor`), aperçu immédiat (couleurs).
- Enregistrement : `api.saveSettings(normalize(...))` → RPC `enregistrer_reglages` (propriétaire/admin) → toast « Paramètres enregistrés ✓ ». Nouveaux réglages : défauts dans `src/lib/defaults.js`.
- Rôle sans droit : note grise « Rôle Membre : … » (`data-reglages="lecture"`).
- Exceptions à enregistrement immédiat : Modules (cases Activé/Désactivé), Membres, Rappels.

### 5.7 Autres patterns
- Calendrier (`src/pages/Calendrier.jsx`) : grille 7 jours, aujourd'hui entouré d'or, éléments avec bordure gauche colorée par type, légende.
- Écran de connexion (`src/pages/Login.jsx`) : logo, phrase d'accroche des réglages.
- Hub d'aperçu d'un domaine (ex. `ChargesVue` dans `Charges.jsx`) : cartes de section avec « Tout voir » vers la liste complète.

---

## 6. Retours utilisateur

| Situation | Implémentation | Exemple de texte |
|---|---|---|
| Succès | `toast(msg)` (`useToast`, `ui.jsx:251-283`) : marine, icône ✓ verte, bas centré (96px mobile / 30px ordi), 2,2 s | « Abonnement enregistré ✓ » (le ✓ final est remplacé par l'icône) |
| Succès réversible | `toast(msg, false, {annuler})`, 8 s, bouton « Annuler » | « Noté pour Pizzeria Da Marco : Appel ✓ » |
| Suppression | pas de confirmation : corbeille + toast « Annuler » (`App.jsx:444-501`, `lib/corbeille.js`, 30 jours) | « « Cabinet Traoré » supprimé ✓ » |
| Action irréversible ou à effet de bord | `await confirmer(texte, {titre, ok, non, danger})` (`ui.jsx:287`) | titre « Annuler cette facture ? », ok « Annuler la facture », non « Garder » |
| Erreur | `toast(msg, true)`, rouge, 5 s ; messages traduits par `messageErreur` (`lib/erreurs.js`) | « Pas de connexion. Ta saisie est gardée sur le téléphone et partira toute seule. » |
| Validation | toast d'erreur précis, première règle en échec | « La relance est avant la date de l'action » |
| Droits | `garde()` dans l'API → toast | « Lecture seule : ton rôle dans cet espace ne permet pas de modifier les données. » |
| Lecture seule | `.sync-banner[data-role=lecteur]` en haut | « Lecture seule : ton rôle dans cet espace est Lecteur. » |
| Hors ligne / synchro | `.sync-banner` orange (or pendant l'envoi) + pied du menu | « Hors ligne · 3 modifications en attente · tes saisies partiront dès le retour d'internet » |
| Conflit serveur | élément conservé, badge rouge, message de correction | « Numéro déjà utilisé : change-le puis enregistre » |
| Vide | `<Empty>` (cadre pointillé gris) ou vide riche `.hub-empty` (icône + titre + explication + bouton or) | « Aucun abonnement. Ajoute ton loyer, ton forfait internet ou tes logiciels. » |
| Vide par filtre | message + bouton | « Aucune fiche ne correspond à ces filtres. » + « Réinitialiser les filtres » |
| Chargement | données locales affichées immédiatement (`useDonnees`, cache) ; données distantes : `<Empty>Chargement…</Empty>` ; page : `.chargement` ; bouton : libellé « Enregistrement… » | pas de squelettes dans l'appli |
| Introuvable | carte + `Empty` + retour | « Document introuvable. » |
| Fonction indisponible hors ligne | `Empty` explicatif | « La boutique nécessite la connexion au CRM en ligne. » |

Règles :
- Les pages appellent `api.*` dans `try { … } catch { /* toast déjà affiché */ }` : **l'API affiche déjà l'erreur** (`wrap`, `App.jsx:423-430`) ; ne pas doubler.
- Ne jamais afficher un code ou un message technique brut ; dire ce qui se passe et quoi faire.
- `alert()` / `confirm()` natifs interdits.

---

## 7. Responsive, tactile, accessibilité

### 7.1 Points de rupture (`index.css`)
| Largeur | Effet |
|---|---|
| ≤ 1280 | lignes client du hub sur 2 rangées |
| ≤ 1180 | widgets du cockpit pleine largeur |
| ≤ 1100 | `grid-4`→2, `grid-6`→3, mini-liste masquée, fiche et saisie sur 1 colonne, lanceur 3 colonnes |
| **≤ 860** | **bascule mobile** : menu → barre haute + barre basse + pilules d'application, `grid-2/3`→1, cartes padding 13, modales et recherche plein écran, `.hide-m` masqué, barres flottantes au-dessus de la barre basse |
| ≤ 720 | onglets défilants pleine largeur, lignes de document empilées |
| ≤ 640 | panneau latéral → bottom sheet, `.hide-sm`, bandeau 4 chiffres en 2×2, graphiques compacts |
| ≤ 480 | onglets de fiche avec fondu à droite |
| `pointer: coarse` | boutons, chips, onglets ≥ 44px (`.btn.sm` 40px) |
| conteneur | `.argent`, `.rentab`, `.ck-w-kpis`, `.ck-parcours` s'adaptent à **leur largeur** (container queries) |

### 7.2 Règles anti-débordement (`index.css:1541-1570`, `:1631-1660`)
- `min-width: 0` sur les enfants de grilles/flex, `overflow-wrap: anywhere` sur titres et sous-titres, badges/chips/boutons en ellipse avec `max-width: 100%`, sous-lignes limitées à 2 lignes, tableaux défilants **dans** `.table-wrap` (jamais la page), `img/svg/canvas { max-width: 100% }`.
- Tests réalisés à 10 largeurs (360 → 1440px) avec données extrêmes (noms de 80 caractères, `1 250 000 000 FCFA`) : refais-le pour chaque nouvel écran.

### 7.3 Tactile
- Cibles ≥ 44px (`--tap`), actions de ligne pleine largeur sur mobile, bouton principal en pleine largeur (cf. « Nouveau client » sur mobile), barre d'enregistrement collante à 48px, `env(safe-area-inset-*)` sur barres haute/basse et barres flottantes.
- Pas d'information disponible uniquement au survol (les actions cachées au survol deviennent visibles en tactile : `.bk-more`).

### 7.4 Accessibilité déjà en place
- Focus visible global : contour **bleu 2px** décalé de 2px (`index.css:1095`), **or** sur fond marine ; champs : halo bleu.
- `Field` relie libellé et champ ; `Modal` : `role="dialog"`, `aria-modal`, `aria-labelledby`, focus à l'ouverture, Échap.
- Rôles : `tablist/tab` + `aria-selected`, `radiogroup/radio` + `aria-checked` (tuiles, pilules), `aria-pressed` (chips), `listbox/option`, `menu/menuitem`, `aria-expanded` (menus, sections repliables, rubriques), `aria-current="page"` (menu).
- `aria-label` sur tout bouton-icône (« Fermer », « Retour au hub Clients », « Plus d'actions pour X »).
- Toast `role="status"` (ou `alert` en erreur) ; annonces `aria-live` de nombre de résultats ; graphiques `role="img"` + `aria-label` ; tableaux `role="region"` focusables.
- `prefers-reduced-motion` coupe animations et transitions (`index.css:1142`) ; styles d'impression (`:1969`).
- Contrôle automatique : tests Playwright + axe (`e2e/parcours.spec.js:163`) — aucune violation sérieuse/critique tolérée.

### 7.5 Mouvement
- Transitions 120–250 ms `ease` : chips/listes .12s, boutons/champs .15s, modale .18s, toast .25s, barres .4s. Rien de décoratif ni de clignotant (sauf pastille « En direct »).

---

## 8. Conventions de code et de nommage

- React 19 + Vite, **JavaScript (pas de TS)**, pas de routeur ni de gestionnaire d'état, **pas de librairie UI/CSS/graphique** (pas de Tailwind, MUI, Chart.js…). Une seule feuille `src/index.css`.
- Identifiants et textes **en français** (`nom`, `entrees`, `pastilles`, `reglages`, `enregistrer`, `voir`), commentaire d'**une ligne en tête de chaque fichier** décrivant son rôle.
- Pages : `src/pages/NomPascal.jsx`, export par défaut + sous-vues nommées. Domaine d'un module : `src/modules/<id>/` (`index.js` = contrat public, `ui.jsx` = composants partagés, `*.js` = logique pure sans JSX, `pastilles.js`). Noyau : `src/core/` ; services partagés : `src/lib/`.
- Frontières vérifiées par `tests/architecture.test.js` : pas de cycle ; `core/` et `lib/` n'importent aucun module ; un module n'en importe un autre que via `index.js`/`ui.jsx` ; chaque page est rattachée à un module dans `PAGES` du test.
- Contextes : `useNoyau()` (`settings, api, toast, openAction, saisirArgent, live, role`) et `useDonnees()` (`prospects, actions, documents, data`) (`src/core/contexte.js`). `useApp()` est réservé à Sécurité.
- Toute écriture passe par `api.*` (`App.jsx:431-554`) : contrôle des droits, toasts d'erreur, corbeille, événements.
- Classes CSS : kebab-case français, préfixe par domaine (`hub-`, `hr-`, `ck-`, `af-`, `ff-`, `rec-`, `li-`, `kv-`, `mvt-`) ; états en classe courte (`.on`, `.click`, `.red`, `.vide`, `.sel`).
- Préférences par appareil en `localStorage` préfixées `crm-` (UI) ou `aecrm-` (données), toujours dans un try/catch.
- Tests : `tests/lib.test.js` (fonctions pures), `tests/core.test.js` (registre, droits, pastilles), `e2e/parcours.spec.js` (parcours + axe, ordinateur 1366 et téléphone 390). Commande : `npm run check`.

---

## 9. À réutiliser / à éviter / dette connue

### 9.1 À réutiliser absolument (ne jamais recréer)
`Modal`, `Field`, `Choix`/`Select`, `Chips`, `Tabs`/`useTab`, `Kpi`, `Bar`, `Menu`, `KV`, `Empty`, `useToast`, `confirmer`, `StageBadge`, `LienProspect`, `LienDoc`, `Repartition`, `eur/nb/pct/court/lbl`, `go`, `Icon`, `Logo`, `ProspectPicker`, `Chronologie`, `Donut/HBars/Funnel/Gauge`, `Drill`, `ActionsGroupees`, `api.*`, `useNoyau/useDonnees`, `src/lib/dates.js`, jetons CSS. Et les classes : `.page-head`, `.card(.flush)`, `.grid-*`, `.form-grid`, `.list/.list-item`, `table.t`, `.badge.b-*`, `.btn.*`, `.icon-btn`, `h2.section` + `.sec-ic`.

### 9.2 Erreurs de design à éviter
- Inventer une nouvelle identité : nouvelle police, nouvelle palette, coins très arrondis, ombres marquées, dégradés (seule exception : icônes du lanceur), glassmorphism, mode sombre du contenu.
- Coder une couleur de marque en dur (casse les thèmes) ; créer une taille de police hors échelle.
- Plusieurs boutons or sur un écran ; un bouton or pour une action secondaire.
- Remettre des sous-menus de filtres dans le menu latéral.
- Un chiffre non cliquable, un graphique sans drill-down, une impasse sans action.
- Carte dans une carte dans une carte ; ombre sur chaque bloc.
- Emojis comme icônes ; caractères décoratifs ; textes en anglais ; vouvoiement.
- `alert()`/`confirm()` natifs ; toasts d'erreur en double ; message technique brut.
- Annoncer « enregistré » avant la réponse ; supprimer sans annulation possible.
- Tableau qui fait défiler la page horizontalement ; boutons sous la barre basse mobile ; cibles < 44px en tactile.
- Graphique à deux axes, camembert à 10 parts, couleurs cycliques.
- Supprimer une fonctionnalité existante pendant une refonte sans le dire.

### 9.3 Dette connue (ne pas l'imiter ; corriger si tu touches la zone)
- `index.css` empile des blocs historiques : des règles mobiles anciennes sont écrasées par des règles plus bas (ex. taille du `h1` mobile, bordure de modale mobile). Ajoute tes règles **en fin de bloc correspondant** et vérifie la valeur effective.
- Gris en dur (`#f7f8fa`, `#ebedf1`, `#f1f3f6`, `#fafbfc`, `#cdd2da`…) et couleurs d'étape sans jeton ; jetons déclarés mais inutilisés (`--success`, `--fs-base`, `--z-nav`…). Si tu en as besoin, crée/emploie un jeton plutôt qu'un nouveau littéral.
- Focus incohérent : bleu sur les champs, or sur `Choix`. Pour un nouveau champ texte, garde le bleu.
- Deux styles d'onglets coexistent (segmenté `Tabs` et souligné `.ptabs`) : segmenté pour filtrer une page, souligné pour les sections d'une fiche/document.
- Classes probablement mortes : `.bigkpis/.bigkpi`, `.mini-stats`, `.nav-group/.nav-sub`, `.set-menu`, `.timeline`, `.funnel-row`. Ne pas les réutiliser.
- `.split-main` sans style ; le bandeau « lecture seule » a le même style que le bandeau hors ligne.
- Positions de `.save-bar`/`.bulk-bar` calculées sur la largeur 232px du menu.
- Plein écran mobile en `100vh` (pas `dvh`).
- Le temps réel ne couvre que `actions`, `prospects`, `documents` : une nouvelle table doit y être ajoutée (`App.jsx:398`).

---

## 10. Comment concevoir un nouveau module Agence Elite

Objectif : un écran qui semble avoir **toujours** fait partie du CRM. Tu n'inventes rien de visuel : tu **assembles** les patterns du §5 avec les composants du §4.

### Étape 1 — Comprendre le besoin métier
- Qui l'utilise (Juste seul, un caissier, un comptable), où (bureau, téléphone, comptoir), à quelle fréquence, quelle décision ou action l'écran doit permettre.
- Lister les **entités** (ex. Article, Mouvement), les **faits saisis** (entrée de stock, vente, inventaire), les **chiffres calculés** (stock courant, valeur, ruptures), les **états** (actif, sous le seuil, épuisé).
- Règle Agence Elite : on saisit des **faits**, on **calcule** les états (le stock courant = somme des mouvements, pas un champ modifié à la main).

### Étape 2 — Choisir les écrans (toujours la même famille)
| Besoin | Pattern | Référence |
|---|---|---|
| Vue d'ensemble du module | hub d'aperçu ou tableau de bord (KPI + centre d'attention + blocs) | `Charges.jsx` (ChargesVue), `Cockpit.jsx` |
| Liste d'éléments | page liste standard | `Factures.jsx`, `Charges.jsx` |
| Entité centrale riche | hub | `Hub.jsx` |
| Détail | fiche (`.rec-head` + onglets + `.rec-grid`) ou modale `large` si simple | `Fiche.jsx`, `Boutique.jsx` (DetailCommande) |
| Création rapide | modale + `.form-grid` + `.ff-foot` | `Fiche.jsx`, `Charges.jsx` |
| Saisie terrain fréquente | tuiles + sections numérotées + `.af-save`, ou saisie rapide à chips | `Saisie.jsx`, `Rapide.jsx` |
| Réglages du module | section de Paramètres (`numCard`/`listCard`) | `Parametres.jsx` |

### Étape 3 — Déclarer le module (voir §8)
1. `src/core/modules.js` → entrée `MODULES` : `id, nom, version, desc, pages, permissions:['<id>.view','<id>.edit'], entites, evenements, dependances, reglages, sections`.
2. `src/App.jsx` → items `NAV` (libellés + recherche), entrée `APPS` (`ico` existant ou ajouté dans `icons.jsx`, **couleur distincte des 7 existantes**, saturée moyenne, lisible en blanc sur fond assombri), branche de route `lazy`, éventuellement `PASTILLES`, raccourci `G`+lettre (et `Raccourcis.jsx`), entrée `BOTTOM` seulement si c'est un usage quotidien mobile (en remplacement).
3. `src/modules/<id>/index.js` (contrat), `*.js` (calculs purs testés), `ui.jsx` si d'autres modules l'affichent, `pastilles.js`.
4. `src/pages/<Nom>.jsx` + mapping dans `PAGES` de `tests/architecture.test.js`.
5. Réglages : `SECTIONS` (Parametres) + `PARAMETRES.sub` (App) + `sections` du module + défauts dans `src/lib/defaults.js`.
6. Base : tables avec `workspace_id`, RLS par espace et rôle (modèle `supabase/espace_permissions.sql`), migration additive avec retour arrière, **validation de Juste avant la production**. Ajouter la table au temps réel si le tableau de bord la suit.
7. Docs : `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, ce fichier si un nouveau pattern apparaît.

### Étape 4 — Construire chaque écran avec le gabarit
1. `.page-head` : titre = nom de la page (« Stock »), `.sub` = une phrase en tutoiement qui dit à quoi sert l'écran, à droite **un** `btn gold` avec icône.
2. KPI (`grid grid-4`, 1–2 en marine), **cliquables**.
3. `Tabs` de filtres avec compteurs (tuples `[id, libellé, prédicat]`).
4. `card flush` : recherche + liste/tableau ; montants à droite ; statuts en badges ; actions de ligne `btn sm` + `Menu` « ⋯ ».
5. États : vide (deux variantes), chargement, erreur, lecture seule, hors ligne.
6. Mobile : vérifier à 360/390px ; colonnes secondaires `.hide-m` ; bouton principal pleine largeur ; rien sous la barre basse.
7. Textes : verbes d'action, tutoiement, vocabulaire du métier du client final.

### Étape 5 — Relier
- Chaque chiffre → `Drill` ou route filtrée (`go('/stock?filtre=rupture')`).
- Chaque élément lié → `LienProspect`, `LienDoc` ou lien de route.
- Alertes du module → ajout au **Centre d'attention** (`attention` dans `Cockpit.jsx`, vers la ligne 659) : `{niv, titre, detail, label, run}`.
- Événements métier → `emettre()` (`src/core/events.js`).

### Étape 6 — Vérifier (§11)

### 10.1 Exemple : page liste « Stock »
```jsx
// Stock › liste des articles : quantités calculées depuis les mouvements, seuils et ruptures
const FILTRES = [
  ['tous', 'Tous', () => true],
  ['bas', 'Sous le seuil', (a) => a.qte > 0 && a.qte <= a.seuil],
  ['rupture', 'En rupture', (a) => a.qte <= 0],
  ['inactifs', 'Archivés', (a) => !a.actif],
]
export default function Stock({ filtre: demande }) {
  const [filtre, setFiltre] = useTab('stock', 'tous', demande)
  const [q, setQ] = useState('')
  const f = FILTRES.find(([k]) => k === filtre) || FILTRES[0]
  const vus = articles.filter(f[2]).filter((a) => norm(a.nom).includes(norm(q)))
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Stock</h1><div className="sub">Tes articles, leurs quantités et ceux à racheter.</div></div>
        <div className="row"><button className="btn gold" onClick={() => setModal({})}><Icon n="plus" size={16} /> Nouvel article</button></div>
      </div>
      <div className="grid grid-4">
        <Kpi navy label="Valeur du stock" value={eur(valeur)} onClick={() => setFiltre('tous')} />
        <Kpi navy label="Articles" value={nb(actifs)} />
        <Kpi label="Sous le seuil" value={nb(bas)} onClick={() => setFiltre('bas')} />
        <Kpi label="En rupture" value={nb(rupture)} onClick={() => setFiltre('rupture')} />
      </div>
      <Tabs items={FILTRES.map(([k, l, fn]) => [k, l, k === 'tous' ? undefined : articles.filter(fn).length])} value={f[0]} onChange={setFiltre} />
      <div className="card flush">
        <div className="list-tools"><input className="input" placeholder="Rechercher : nom, référence, fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {vus.length === 0 ? <Empty>{articles.length ? 'Rien dans ce filtre.' : 'Aucun article. Ajoute ton premier article pour suivre ton stock.'}</Empty> : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Articles">
            <table className="t zt">
              <thead><tr><th>Article</th><th className="hide-m">Référence</th><th className="num">Quantité</th><th className="num hide-m">Valeur</th><th /></tr></thead>
              <tbody>{vus.map((a) => (
                <tr key={a.id} className="click" onClick={() => go(`/article/${a.id}`)}>
                  <td className="bold ell">{a.nom}</td>
                  <td className="muted hide-m">{a.ref || '—'}</td>
                  <td className="num">{a.qte <= 0 ? <span className="badge b-red">Rupture</span> : a.qte <= a.seuil ? <span className="badge b-orange">{nb(a.qte)}</span> : nb(a.qte)}</td>
                  <td className="num hide-m">{eur(a.qte * a.cout)}</td>
                  <td onClick={(e) => e.stopPropagation()}><button className="btn sm" onClick={() => setMouvement(a)}>Mouvement</button></td>
                </tr>))}</tbody>
            </table>
          </div>)}
      </div>
    </div>
  )
}
```

### 10.2 Exemple : page détail « Article »
- `.rec-head` : retour · avatar (initiales ou photo) · `h1` nom + sous-titre « Réf. A-102 · Boissons · Fournisseur Brasco » + badges (`b-green` « En stock » / `b-orange` « Sous le seuil » / `b-red` « Rupture ») · actions : `btn gold sm` « + Mouvement », `Menu` « Plus » (Modifier, Dupliquer, —, Archiver en danger).
- `.rec-strip` 4 chiffres : Quantité · Seuil · Valeur · Ventes 30 j (`.v.red` si rupture).
- `.ptabs` : Aperçu · Mouvements · Ventes · Informations.
- Aperçu `.rec-grid` : à gauche « Derniers mouvements » (`.list` de `.list-item` : « Entrée · +24 » / « Vente · −2 », sous-ligne date · auteur · pièce, montant à droite ; « Tout voir ») ; à droite carte « Détails » en `KV` groupés (Article / Achat / Vente).

### 10.3 Exemple : formulaire de création
- Modale `title="Nouvel article"`, `.form-grid` : Nom (pleine largeur, autoFocus), Référence, Catégorie (`Choix` libre, options des réglages), Unité (pilules si ≤ 4 : Pièce / Carton / Kg / Litre), Prix d'achat et Prix de vente (`inputMode="decimal"`, libellé `lbl('Prix de vente (€)')`), Seuil d'alerte, Note (facultatif, pleine largeur).
- `.ff-foot` : `btn` « Annuler » + `btn gold` « Enregistrer » (`busy` → « Enregistrement… »).
- Validation : « Indique le nom de l'article », doublon de référence signalé sous le champ.
- Succès : toast « Article enregistré ✓ » ; création depuis la liste via `?nouveau=1`.
- Saisie fréquente (mouvement de stock au comptoir) : saisie rapide à chips (Entrée / Sortie / Inventaire, quantités rapides +1 +6 +12 +24) avec « Enregistrer » or et toast « Annuler ».

### 10.4 Exemple : tableau de bord du module
- `h1` « Stock », `.sub` période ; à droite sélecteur de période.
- KPI : Valeur du stock (marine) · Entrées · Sorties · Taux de rupture (delta vs période précédente, `invert` pour la rupture).
- `.ck-grid` : Centre d'attention (« 3 articles en rupture » → « Voir la liste » ; « 5 sous le seuil » → « Préparer la commande ») + Santé du stock ; `HBars` Top ventes (clic → drill) ; `Donut` valeur par catégorie ; tableau des mouvements avec export CSV.
- Vide : « Pas encore de mouvements sur la période. »

### 10.5 Exemple : paramètres du module
- Section `['stock', 'Stock', 'Unités, catégories et seuils par défaut.', 'layers']` dans `SECTIONS` + `PARAMETRES.sub` + `sections:['stock']` du module.
- `cols(numCard('stockSeuils'), listCard('stockCategories'))` ; enregistrement par le bouton or global ; défauts dans `defaults.js`.

### 10.6 Exemple : affichage mobile
- Barre haute « AGENCE ELITE · Stock · Articles », pilules d'application (Articles · Mouvements · Inventaire).
- `btn gold` « Nouvel article » pleine largeur sous le titre ; KPI 2×2 ; onglets défilants ; colonnes Référence/Valeur masquées (`.hide-m`) ; bouton de ligne ≥ 40px ; modales plein écran avec en-tête collant ; barre d'enregistrement collante au-dessus de la barre basse.

### 10.7 Transposer à d'autres modules
| Module | Écran principal | Saisie | Fiche | Tableau de bord |
|---|---|---|---|---|
| Point de vente | caisse plein écran : tuiles produits (`.tiles`) à gauche, ticket en `.card` à droite (lignes `.list-item`, total en grand chiffre tabulaire, `btn gold lg` « Encaisser ») ; sur mobile ticket en bas collant | tuiles + quantités en chips | ticket (document) | ventes du jour, panier moyen, top produits |
| Rapport Z | liste des clôtures (table) | « Clôturer la caisse » avec récapitulatif et `confirmer` | document Z (comme une facture, PDF) | écarts de caisse |
| Hôtel | planning chambres (grille comme Calendrier) + liste des séjours | réservation rapide (chambre, dates, client facultatif) | séjour | occupation, revenu par chambre |
| Personnel | hub des employés (cartes catégories : actifs, en congé…) | pointage rapide | fiche employé (`.rec-head`) | présence, coût salarial |

Toujours : même coquille, mêmes jetons, mêmes composants, une couleur d'application nouvelle, un bouton or par écran, tout chiffre cliquable.

---

## 11. Check-list avant livraison
- [ ] `docs/PROJECT_CONTEXT.md`, `DECISIONS.md`, `KNOWN_ISSUES.md` et ce fichier relus.
- [ ] Aucun nouveau style visuel : jetons et composants existants uniquement ; thèmes Paramètres › Identité testés (au moins Noir & rouge).
- [ ] Un seul bouton or par écran ; titres et `.sub` en tutoiement ; montants via `eur()`.
- [ ] Chiffres cliquables, éléments reliés, alertes au centre d'attention si pertinent.
- [ ] États vide (2 variantes), chargement, erreur, lecture seule, hors ligne.
- [ ] 360, 390, 768, 1024, 1366, 1440px vérifiés (captures Playwright), données extrêmes, pas de défilement horizontal de page, cibles ≥ 44px.
- [ ] Accessibilité : libellés, `aria-label` des boutons-icônes, rôles, focus visible, axe sans violation sérieuse.
- [ ] Registre, droits, architecture, tests (`npm run check` vert, e2e du parcours vert).
- [ ] Aucune modification de la base de production sans validation de Juste ; aucun secret exposé.
- [ ] Docs mises à jour (ce fichier si nouveau pattern).

---

## 12. Instructions prêtes à transmettre à GPT

> Copie tout le bloc ci-dessous dans ChatGPT. Il est autonome.

```text
Tu vas concevoir et développer des écrans et des modules pour « Agence Elite CRM », le logiciel de gestion de Juste (Agence Elite, Afrique centrale/de l'Ouest). Ton travail doit être indiscernable de l'existant : même structure, même style, même façon de penser. Tu n'inventes jamais une nouvelle identité graphique.

1. CONTEXTE ET POSTURE
- Utilisateur : Juste. Réponds en français, tutoie-le. L'interface est en français et tutoie aussi (« Tes factures… », « Ajoute ton premier article »).
- Montants en FCFA ou EUR selon les réglages, usage fréquent sur téléphone, réseau instable.
- Juste veut des outils simples et pragmatiques. Mène le travail jusqu'au bout sans poser une question à chaque étape ; choisis la solution raisonnable et dis laquelle. Arrête-toi seulement avant une action irréversible (suppression de données, migration de base, production, DNS, envoi externe).
- N'invente jamais un chiffre, une configuration ou un fait non vérifié. N'annonce jamais « enregistré » avant la confirmation réelle. Ne révèle aucun secret.
- Réponses courtes : ce qui change, puis « ✓ Corrigé / ✓ Testé / ✓ Build OK », fichiers modifiés, ce que Juste doit vérifier.

2. STACK ET RÈGLES TECHNIQUES
- Dépôt GitHub justegladerara-cpu/agence-elite-crm, branche de production claude/project-thread-j6wx9s (un push déploie crm.agence-elite.fr via Cloudflare Pages ; ne pousse que du code testé).
- React 19 + Vite, JavaScript (pas de TypeScript), pas de routeur ni de gestionnaire d'état, AUCUNE librairie UI/CSS/graphique (pas de Tailwind, MUI, shadcn, Chart.js, Recharts). Une seule feuille de style : src/index.css (jetons CSS). Graphiques en SVG maison (src/charts.jsx). Icônes maison (src/icons.jsx, composant <Icon n="nom" size={16}/>, style Lucide trait 1.8, jamais d'emoji comme icône).
- Supabase (Postgres + RLS par espace de travail et rôle : proprietaire, admin, membre, lecteur). Toute écriture passe par api.* (src/App.jsx) qui contrôle les droits, affiche les erreurs, gère la corbeille. Données via useNoyau() et useDonnees() (src/core/contexte.js).
- Avant de coder : lis docs/PROJECT_CONTEXT.md, docs/DECISIONS.md, docs/KNOWN_ISSUES.md, docs/DESIGN_SYSTEM.md, puis seulement les fichiers concernés. Petits patchs, pas de refonte non demandée.
- Après : npm run check (lint + tests + build) et les tests Playwright du parcours touché ; ajoute des tests pour toute logique pure et tout bug corrigé. Base de production : jamais de migration destructive, toujours un retour arrière, validation explicite de Juste avant d'appliquer.
- Identifiants et commentaires en français, commentaire d'une ligne en tête de chaque fichier.

3. IDENTITÉ VISUELLE (valeurs exactes, via variables CSS uniquement)
- Ambiance : logiciel de gestion pro façon Zoho One / Zoho Books / Odoo, sobre, dense mais aéré, bordures fines, ombres quasi nulles.
- Couleurs : --navy #0c1833 (menu latéral, boutons primaires, tuiles KPI fortes), --gold #b8903f (action principale, accent, rare), --gold-3 #7d5f25 (survol or), --gold-soft #f8f3e8, --bg #f5f6f8 (fond de page), --card #fff, --text #0f172a, --muted #5b6475 (texte secondaire, jamais plus clair), --line #e4e7ec (bordures), --green #0f7b55/--green-soft #e4f3ec (payé, gagné), --orange #b45309/--orange-soft #fdf1e3 (retard, attention), --red #c0322e/--red-soft #fbeceb (danger, dû), --blue #2f5bd3/--blue-soft #eaf0fc (info, liens, focus). N'écris jamais ces couleurs en dur : le thème est personnalisable (src/lib/theme.js régénère --navy* et --gold*).
- Chaque application a sa couleur (--app) qui marque l'élément actif du menu : Tableau de bord #7a4cdb, Commercial #2f6fed, Facturation #18a058, Charges #c2410c, Agenda #0e9aa7, Site web #10151f, Paramètres #5b6475. Un nouveau module reçoit une couleur distincte.
- Police unique Inter. Échelle : 11.5 (badges, méta), 12.5 (sous-lignes, petits boutons), 14 (texte), 15 (titre de section, gras), 17 (titre de modale), 22 (titre de page, 700, letter-spacing -0.02em). Libellés de KPI et en-têtes de tableau en petites majuscules grises. Chiffres en tabular-nums, montants alignés à droite, formatés avec eur() (« 100 000 FCFA »).
- Espacements sur grille de 4 px : gap de grille 12, gap de pile 14, padding de carte 16 (13 mobile), gap de formulaire 14. Rayons : carte 12, bouton 8, badge 6, modale 16. Ombre de carte 0 1px 2px très légère ; grande ombre seulement pour modales, menus, toast.
- Graphiques : palette fixe dans l'ordre #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948, « Autres » #a3a9b8 ; un seul axe ; chaque élément cliquable.

4. COQUILLE
- Ordinateur : menu latéral fixe 232 px fond marine : logo + « AGENCE ELITE » + « CRM de pilotage », bouton « Rechercher… Ctrl K », bouton or « + Nouvelle action N », puis une rubrique repliable par application (seule la courante ouverte, pages en dessous, pastilles de compteur), pied avec état de synchronisation. Élément actif : fond plein de la couleur de l'application, texte blanc. Pas de sous-menus de filtres dans le menu.
- Contenu : marge gauche 232, padding 22px 28px, largeur max 1440. Bandeaux (démo, lecture seule, hors ligne) en haut.
- Mobile (≤ 860 px) : barre haute marine collante (logo, « Application · Page », boutons Recherche et Grille 44 px), pilules horizontales des pages de l'application, barre basse fixe à 5 entrées avec le bouton central rond or surélevé « Noter ». Modales plein écran. Respect des encoches (safe-area).
- Lanceur d'applications : « Bonsoir Juste, que veux-tu ouvrir ? » + tuiles blanches (icône 60 px dans un carré en dégradé de la couleur de l'application, nom, description, pastille rouge de compteur).

5. COMPOSANTS À RÉUTILISER (src/ui.jsx sauf mention) — ne jamais les recréer
- Modal({title,onClose,large}) ; Field({label}) avec un <input> nu dedans ; Choix/Select (sélecteur à popover avec recherche si > 6 options et saisie libre) ; Chips ; pilules segmentées .seg (règle : ≤ 4 options = pilules, sinon Choix) ; Tabs({items:[[id,label,count]]}) + useTab(clé, défaut, forcé par l'URL) ; Kpi({label,value,delta,invert,navy,onClick}) ; Bar ; Menu({items:[{label,icon,onClick,danger}], '-' = séparateur}) ; KV({rows}) ; Empty ; useToast() → toast(msg, erreur?, {annuler}) ; confirmer(msg,{titre,ok,non,danger}) ; StageBadge ; LienProspect ; LienDoc ; eur, nb, pct, court, lbl ; go('/route?x=y') ; ProspectPicker (src/core/ui) ; Donut, HBars, Funnel, Gauge (src/charts.jsx) ; Drill (panneau latéral de détail, src/pages/Drill.jsx).
- Classes : .page-head (h1 + .sub à gauche, actions à droite), .card / .card.flush, .grid.grid-2|3|4, .form-grid, .list > .list-item.click > .li-main(.li-title,.li-sub) + .li-side, table.t (th.num/td.num à droite, tr.click, .hide-m pour masquer sur mobile) dans .table-wrap, .badge.b-green|b-red|b-orange|b-gold|b-navy, .btn / .btn.gold (une seule action principale par écran) / .btn.primary / .btn.ghost / .btn.danger / .btn.sm / .btn.lg, .icon-btn (aria-label obligatoire), h2.section avec <span className="sec-ic"><Icon n=".." size={16}/></span>.

6. PATTERNS D'ÉCRANS
- Liste : .page-head (titre, phrase en tutoiement, un bouton or avec icône) → rangée de 4 KPI (les 1-2 premiers en marine, tous cliquables) → Tabs de filtres avec compteurs (filtres définis en tuples [id, libellé, prédicat]) → .card.flush avec recherche (« Rechercher : nom, référence… ») puis tableau ou liste ; état vide « Aucun X pour le moment. » ou « Rien dans ce filtre. ».
- Hub (entité centrale riche) : cartes-catégories cliquables avec grand nombre et indicateur, barre d'outils (recherche, canal, tri, réinitialiser), chips de filtre avec compteurs, bandeau de 4 totaux, lignes riches avec actions (btn sm + menu ⋯), sélection multiple avec barre flottante marine.
- Fiche : en-tête (retour, avatar initiales, h1, sous-titre « a · b · c », badges de statut, bouton or « + Action », menu « Plus »), bandeau de 4 chiffres clés, onglets soulignés (Aperçu, Historique, Documents, Informations), aperçu en 2 colonnes (contenu + colonne « Détails » 340 px en paires libellé/valeur groupées).
- Formulaire court : modale, .form-grid de Field, pied « Annuler » + bouton or « Enregistrer » (« Enregistrement… » pendant l'envoi). Grand formulaire : sections numérotées (rond marine 1, 2, 3…) avec aide grise, tuiles pour les choix fréquents, champs qui apparaissent selon le contexte, barre collante en bas avec récapitulatif et bouton or large. Saisie rapide : groupes de chips + Enregistrer.
- Tout pré-remplir (date, heure, client, numéro, échéance). Pas d'astérisque : « (facultatif) » dans le libellé ou une aide. Validation à l'envoi avec message d'erreur précis en toast ; doublons signalés en direct sous le champ.
- Tableau de bord : titre + période ; sélecteurs (période, canal) dans l'URL ; KPI avec comparaison à la période précédente (pastille ▲/▼ verte ou rouge), objectif et mini-courbe ; « Centre d'attention » (alertes triées par gravité avec bordure gauche colorée et bouton d'action) ; « Santé » (score /100 et barres) ; graphiques cliquables ; tableau avec export CSV ; état des données « En direct · mis à jour à HH:MM ».
- Paramètres : sections listées dans le menu, cartes en 2 colonnes, bouton or « Enregistrer » désactivé tant que rien n'a changé, barre « Modifications non enregistrées ».

7. RETOURS UTILISATEUR
- Succès : toast marine bas centré « Article enregistré ✓ ». Suppression : pas de confirmation mais corbeille + toast « Annuler ». Action irréversible : confirmer() avec titre et bouton explicite (« Annuler la facture » / « Garder »). Erreur : toast rouge qui dit quoi faire (« Pas de connexion. Ta saisie est gardée sur le téléphone et partira toute seule. »). L'API affiche déjà ses erreurs : ne les double pas. Jamais alert()/confirm() natifs, jamais de message technique brut.
- Prévois toujours : vide (avec une phrase qui explique comment remplir et un bouton), vide par filtre (« Réinitialiser les filtres »), chargement (données locales tout de suite, « Chargement… » pour le distant), erreur, lecture seule (bandeau + refus expliqué), hors ligne (bandeau orange, rien n'est perdu).

8. RESPONSIVE, TACTILE, ACCESSIBILITÉ
- Points de rupture : 1100 (grilles 4→2, colonnes latérales masquées), 860 (bascule mobile), 640 (panneaux en bottom sheet). Cibles tactiles ≥ 44 px. Rien ne fait défiler la page horizontalement (tableaux dans .table-wrap, min-width:0, textes longs qui passent à la ligne, ellipses). Teste 360, 390, 768, 1024, 1366, 1440 px avec données extrêmes (nom de 80 caractères, 1 250 000 000 FCFA).
- Focus visible bleu 2 px (or sur fond marine), libellés reliés, aria-label sur les boutons-icônes, rôles (tablist, radiogroup, menu, dialog), toast role=status, prefers-reduced-motion respecté. Transitions 120-250 ms, rien de décoratif.

9. PHILOSOPHIE PRODUIT
- Une seule saisie de faits, tout le reste calculé (états, stocks, statuts ne sont pas saisis à la main).
- Tout chiffre est cliquable et ouvre la liste qui le compose ; tout est relié (client ↔ documents ↔ paiements).
- Action d'abord : un bouton or par écran, la prochaine action utile mise en avant.
- Pas de chiffre inventé ; rien ne se perd ; simple avant exhaustif.

10. NOUVEAU MODULE, PAS À PAS
1) Comprendre le besoin : utilisateurs, lieu d'usage, entités, faits saisis, chiffres calculés, états.
2) Choisir les écrans dans la famille existante : aperçu/tableau de bord, liste, fiche, formulaire, saisie rapide, section de paramètres.
3) Déclarer le module : src/core/modules.js (id, nom, pages, permissions '<id>.view'/'<id>.edit', sections…), src/App.jsx (NAV, APPS avec icône et couleur distincte, route lazy, pastilles), src/modules/<id>/ (index.js contrat, logique pure testée), src/pages/<Nom>.jsx (+ mapping dans tests/architecture.test.js), réglages (SECTIONS de Parametres.jsx + PARAMETRES.sub de App.jsx + defaults.js), tables Supabase avec workspace_id et RLS par rôle (validation de Juste avant la production).
4) Construire chaque écran avec le gabarit de liste/fiche/formulaire ci-dessus, uniquement avec les composants et jetons existants.
5) Relier : chiffres → panneau Drill ou route filtrée ; alertes → Centre d'attention du tableau de bord ; liens vers fiches et documents.
6) Vérifier : thèmes, largeurs, états, accessibilité, npm run check, Playwright ; mettre à jour docs/DESIGN_SYSTEM.md si un nouveau pattern apparaît.

11. À NE JAMAIS FAIRE
Nouvelle police ou palette, couleurs de marque en dur, tailles hors échelle, plusieurs boutons or, ombres marquées, dégradés (sauf icônes du lanceur), coins très arrondis, mode sombre du contenu, cartes imbriquées, emojis comme icônes, textes en anglais ou au vouvoiement, chiffre non cliquable, sous-menus de filtres dans le menu latéral, alert()/confirm(), « enregistré » annoncé trop tôt, suppression sans annulation, défilement horizontal de la page, cible tactile < 44 px, graphique à deux axes, nouvelle librairie sans accord, suppression d'une fonctionnalité existante sans le dire.

Quand tu proposes un écran, décris d'abord sa structure avec ces patterns (en-tête, KPI, onglets, liste, états, mobile), puis code-le. Si tu as accès au dépôt, la référence complète est docs/DESIGN_SYSTEM.md.
```
