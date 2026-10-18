# Architecture

```
site/build.mjs            gabarit : script de tête (niveau), composants (chiffres, vitrine, orbites), motion.js différé
site/assets/site.css      jetons :root + bloc « Elite Motion System (EMS) » (images clés, états, pauses, réduction)
site/assets/vitrine.css   styles de la vitrine (10 Ko, 2,7 Ko gzip), chargés seulement sur l'accueil et la page ERP,
                          par un <link> placé juste avant la section (ne bloque pas l'affichage du haut de page)
site/assets/motion.js     niveau adaptatif, apparitions, compteurs, onglets de la vitrine, pointeur, pauses (13 Ko, 4,5 Ko gzip)
site/assets/site.js       menu (focus mobile), méga-menus, formulaire (retour « message prêt »), photos du CRM, mesure d'audience
site/assets/fonts/        Inter et Montserrat latin (woff2 variables) + licence OFL
site/scripts/             mesure.cjs (performance), serveur.cjs (serveur statique), signature-seo.mjs (référence SEO)
site/tests/               parcours Playwright du site ; tests/site_motion.test.js (Vitest, exécuté par la CI)
```

## Séquence au chargement

1. **`<head>`** : `site.css` (qui déclare les 2 polices locales), puis script en ligne qui décide du niveau **avant le premier affichage** : `html.js`, `data-motion`, classes `mo` / `mo-plein`. Il lit `?motion=` (mémorisé en `sessionStorage` sous `ae-motion`) et le plafond mesuré `ae-motion-auto`.
2. **Premier affichage** : l'entrée du héros (CSS) démarre aussitôt ; le contenu est déjà là.
3. **`site.js` puis `motion.js` (différés)** : `motion.js` mesure en une passe la position des blocs ciblés, ne marque `apparait` que ceux sous le pli, et les confie à **un seul** `IntersectionObserver`. Les classes sont retirées 1,5 s après l'entrée.
4. **Qualité adaptative** : échantillon de 45 images au repos (après `load` + 1,2 s) puis de 60 images au premier défilement (`requestAnimationFrame`, puis arrêt). Médiane > 25 ms, 90e centile > 60 ms, ou plus d'un quart d'images > 25 ms pendant le défilement → niveau inférieur, mémorisé pour la session.
5. **Niveau équilibré** : seules les grandes sections apparaissent (titres de section, blocs IA/CTA/sécurité, vitrine, chiffres) ; les cartes une à une et les compteurs de la vitrine sont réservés au niveau complet (mesure : saccades au défilement divisées par deux sur mobile bridé).

## Observateurs et écouteurs

- 1 `IntersectionObserver` pour les apparitions, 1 pour les chiffres, 1 par vitrine (lecture des modules), 1 pour les zones à animation continue (`.hero`, `.defile` → `.hors-champ`).
- `visibilitychange` → `html.onglet-cache` (pause des animations continues).
- Pointeur : uniquement souris (`pointerType === 'mouse'`, `hover: hover`), niveau complet ; rectangle mesuré à l'entrée ; une écriture de variables CSS par image au plus.
- Aucune boucle permanente : compteurs (1,1 s) et échantillon (45 images) s'arrêtent seuls.

## Désactiver / revenir en arrière

- **Pour un visiteur** : `https://www.agence-elite.fr/?motion=off` (session), `?motion=leger|equilibre|complet` pour tester un niveau.
- **Pour tout le site, sans toucher au reste** : `motion: false` dans `SITE` (`site/data.mjs`) ou variable `AE_MOTION=off` au build → plus de script de tête ni de `motion.js` ; le CSS du mouvement ne s'applique plus (tout est sous `.mo`), le site reste complet.
- **Retour arrière complet** : `git revert` du commit de fusion de la PR (aucune migration, aucune donnée, aucun changement côté CRM). Les polices locales peuvent rester ou être retirées avec le reste.
