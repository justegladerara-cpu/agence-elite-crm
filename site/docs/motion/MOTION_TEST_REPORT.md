# Rapport de tests

Date : 2026-10-18, branche `claude/elite-motion-site`.

| Suite | Commande | Résultat |
|---|---|---|
| Lint | `npx oxlint` | 0 erreur (avertissements existants `catch (e)`) |
| Tests unitaires (dont 11 nouveaux pour le site) | `npx vitest run` | **105 / 105** |
| Build complet (CRM + site) | `npm run build` | OK |
| Parcours navigateur du site (ordinateur + téléphone) | `PW_CHROMIUM=… npm run test:site` | **21 réussis, 1 ignoré** (menu mobile, projet ordinateur) |
| Mesures avant / après | `node site/scripts/mesure.cjs` | voir MOTION_PERFORMANCE.md |

## `tests/site_motion.test.js` (Vitest, exécuté par la CI « controle »)

- Mêmes pages, titres, descriptions, canoniques, robots, `og:url` et JSON-LD que la référence prise **avant** les changements (`tests/fixtures/site-seo-reference.json`).
- Tous les titres h1-h3 d'origine présents dans le même ordre, un seul h1 ; pas de saut de niveau sur l'accueil et la page ERP.
- Textes alternatifs et clés `data-photo` (photos modifiables depuis le CRM) inchangés.
- Aucun contenu masqué dans le HTML ; 5 modules de vitrine présents sans `hidden`.
- `motion.js` différé, niveau décidé en tête, plus de Google Fonts ; chiffres en texte final ; vitrine annoncée « données fictives », onglets ARIA reliés ; réduction des animations ; pas de `will-change` ni de `setInterval` ; `AE_MOTION=off` retire tout le mouvement.

Contenu modifié volontairement : régénérer la référence (`node site/build.mjs site-dist && node site/scripts/signature-seo.mjs site-dist > tests/fixtures/site-seo-reference.json`).

## `site/tests/motion.spec.mjs` (Playwright, manuel : non ajouté à la CI pour ne pas l'allonger)

Aucune erreur console sur 7 pages ; aucun bloc invisible après défilement ; sans JavaScript tout est visible ; réduction des animations → niveau léger, 0 animation en cours ; `?motion=off` ; onglets au clavier ; bouton pause des logos ; menu mobile (focus, Échap) ; formulaire (erreur puis « message prêt ») ; axe-core WCAG A/AA sur les nouveaux blocs : 0 violation ; CLS ≤ 0,1 sur 3 pages.

## Captures

Avant / après, bureau (1366×860) et mobile (390×844), haut de page et page entière : accueil, service, ERP, mentions légales, contact (`node site/scripts/mesure.cjs --captures`). La barre d'en-tête qui apparaît au milieu des captures « page entière » est un artefact de capture (présent aussi avant).
