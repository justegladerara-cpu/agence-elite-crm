# Performance : méthode et mesures avant / après

## Méthode (reproductible)

```bash
node site/build.mjs site-dist
node site/scripts/mesure.cjs --dir site-dist --runs 3 --out mesure.json     # ou : npm run mesure:site
node site/scripts/mesure.cjs --dir site-dist --captures captures/          # captures bureau + mobile
```

- Serveur statique local (`site/scripts/serveur.cjs`, gzip comme un CDN), Chromium 140 sans interface (Playwright du dépôt), contexte neuf à chaque passage (cache vide), **médiane de 3 passages**.
- Pages : accueil, une page service (`/solutions/agence-web/`), mentions légales.
- Scénarios : **bureau** 1366×860 sans bridage ; **cpu4x** 390×844, processeur ÷4 ; **mobile-3g** 390×844, processeur ÷4 + réseau RTT 300 ms, 750 kbit/s descendant, 250 kbit/s montant (CDP).
- FCP, LCP (avant tout défilement), CLS (fenêtres de session, chargement + défilement complet), TBT (dépassements de 50 ms des tâches longues après FCP), part des images de plus de 25 ms pendant un défilement rapide automatisé, octets transférés par type.
- Ressources tierces rejouées en local par un serveur HTTPS (même réseau bridé) : Google Fonts (avant) téléchargées une fois ; **photos Unsplash remplacées par une même image locale de 39 Ko** (Unsplash est injoignable depuis le poste de mesure) ; API Supabase coupée.

## Résultats (médianes, avant = commit 5f45ba3, après = branche `claude/elite-motion-site`)

| Page | Scénario | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Images > 25 ms au défilement | HTML (Ko) | CSS (Ko) | JS (Ko) | Polices (Ko) |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | bureau | 216 → **248** | 216 → **280** | 0.002 → **0.007** | 0 → **0** | 11.1 % → **18.3 %** | 10.8 → 14.5 | 9.8 → 15.6 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/` | cpu4x | 356 → **284** | 356 → **284** | 0.000 → **0.000** | 87 → **47** | 2.7 % → **7.1 %** | 10.8 → 14.5 | 9.8 → 15.6 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/` | mobile-3g | 1432 → **1364** | 1432 → **1364** | 0.003 → **0.003** | 71 → **155** | 2.9 % → **1.4 %** | 10.8 → 14.5 | 9.8 → 15.6 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/solutions/agence-web/` | bureau | 192 → **188** | 196 → **204** | 0.000 → **0.000** | 0 → **0** | 8.6 % → **3.7 %** | 7.3 → 7.6 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/solutions/agence-web/` | cpu4x | 332 → **284** | 332 → **328** | 0.000 → **0.000** | 46 → **9** | 0.0 % → **0.0 %** | 7.3 → 7.6 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/solutions/agence-web/` | mobile-3g | 1308 → **1328** | 1412 → **1444** | 0.000 → **0.000** | 32 → **21** | 0.0 % → **0.0 %** | 7.3 → 7.6 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/mentions-legales/` | bureau | 140 → **140** | 140 → **140** | 0.000 → **0.000** | 0 → **0** | 5.1 % → **1.7 %** | 7.8 → 8.0 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/mentions-legales/` | cpu4x | 264 → **256** | 264 → **256** | 0.000 → **0.000** | 0 → **21** | 0.0 % → **0.0 %** | 7.8 → 8.0 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |
| `/mentions-legales/` | mobile-3g | 1164 → **1184** | 1164 → **1184** | 0.000 → **0.000** | 48 → **2** | 0.0 % → **0.0 %** | 7.8 → 8.0 | 9.8 → 13.0 | 3.2 → 8.0 | 84.2 → 47.9 |

Octets : transférés compressés, après défilement complet de la page. « CSS » avant = `site.css` seul (la petite feuille Google Fonts n'est pas comptée) ; après = `site.css` (+ `vitrine.css` sur l'accueil).

### Lecture

- **LCP** : pas de régression sur mobile (accueil 3G −68 ms, service 3G +32 ms, légal +20 ms : dans le bruit de mesure de ±50 ms). Sur bureau, accueil +64 ms (216 → 280 ms) : dans le bruit observé entre passages (212 à 316 ms selon les séries, voir niveaux ci-dessous), pas de cause identifiée dans le code.
- **CLS** : ≤ 0,007 partout (seuil 0,1).
- **Polices** : 84 Ko → 48 Ko (auto-hébergement + sous-ensemble + graisses utiles), 2 domaines tiers en moins (non reproduit par la simulation : en réel, DNS + TLS vers fonts.googleapis.com et fonts.gstatic.com coûtent 2 à 3 allers-retours en 3G avant le premier affichage).
- **Poids ajouté** : accueil +3,7 Ko de HTML (vitrine, chiffres), CSS +3,2 Ko (+2,7 Ko de `vitrine.css` sur l'accueil et l'ERP), JS +4,8 Ko (`motion.js`). Bilan net par page, polices comprises : environ −25 Ko.
- **TBT** : faible partout ; accueil 3G 71 → 155 ms (motion.js + vitrine), accueil cpu4x 87 → 47 ms. Valeurs bruitées (conteneur partagé à 4 processeurs, une autre mesure tournait en parallèle).
- **Fluidité au défilement** : la mesure tourne **sans GPU** (rendu logiciel) ; les animations composées y coûtent de la peinture CPU qu'un téléphone réel ferait au GPU. Accueil bureau 11 % → 18 % d'images lentes (niveau complet), mobile bridé 2,7 % → 7,1 % (niveau équilibré, après simplification), 3G 2,9 % → 1,4 %.

### Par niveau de mouvement (accueil, médiane de 3)

| Niveau | Bureau : LCP / images lentes | cpu4x : LCP / TBT / images lentes |
|---|---|---|
| léger | 232 ms / 3,0 % | 232 ms / 137 ms / 1,4 % |
| équilibré | 244 ms / 6,1 % | 296 ms / 132 ms / 6,1 % |
| complet | 212 ms / 11,8 % | 268 ms / 225 ms / 16,2 % |

Le niveau complet n'est choisi qu'avec une souris ; sur mobile c'est le niveau équilibré, et l'échantillon de fluidité au premier défilement redescend d'un niveau si plus d'un quart des images sont lentes.

## Régressions trouvées par la mesure et corrigées

| Problème mesuré | Cause | Correction |
|---|---|---|
| LCP page service 3G 1,4 s → 2,6 s | script de tête en ligne placé **après** la feuille de style : il attend la CSS et retarde la découverte de l'image | script placé avant la feuille |
| FCP accueil 3G +500 ms | préchargement des polices en concurrence avec la CSS | préchargement retiré, polices réduites de 42 % |
| LCP du titre retardé | entrée en fondu (opacité 0) du titre et du chapô | titre et chapô glissent sans fondu |
| Tâche longue de 140 ms | premier `toLocaleString('fr-FR')` (chargement des données de langue) | formatage maison sans Intl |
| Mise en page forcée au démarrage | mesure de la position de 60 blocs | classement par le premier rappel de l'IntersectionObserver |
| Saccades au défilement (équilibré 13 % → 6 %) | compteurs (1 boucle par compteur), apparition carte par carte, retrait des classes | boucle unique à 30 images/s, apparitions limitées aux grandes sections en équilibré, classes conservées |

## Ce qui n'a pas pu être mesuré

- Le site en ligne (www.agence-elite.fr injoignable depuis le conteneur) et les vraies photos Unsplash (poids et décodage réels).
- Un vrai téléphone avec GPU, l'INP (pas d'interaction réelle), Safari et Firefox.
- Le coût réel des connexions aux domaines tiers (DNS/TLS), favorable à l'après.
