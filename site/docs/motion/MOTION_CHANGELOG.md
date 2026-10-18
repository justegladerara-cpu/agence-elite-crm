# Journal des modifications

## 2026-10-18 — Elite Motion System, première version (branche `claude/elite-motion-site`)

### Ajouté
- Jetons de mouvement (durées, courbes, cascade, amplitude) et bloc CSS « EMS ».
- Niveaux `complet` / `equilibre` / `leger` décidés avant le premier affichage, dégradation automatique mesurée (fluidité), `?motion=off`, `SITE.motion = false`, `AE_MOTION=off`.
- `site/assets/motion.js` : apparitions (sous le pli uniquement), compteurs, vitrine à onglets, parallaxe et inclinaison (souris), pauses hors écran / onglet masqué.
- Héros : entrée en cascade, orbites SVG, surlignage du titre, reflet du bouton, badges animés.
- Bande « chiffres clés » (valeurs tirées du contenu : 9 expertises, 9 secteurs, 15 partenaires, 1 interlocuteur).
- Vitrine interactive de la solution de gestion (données fictives) sur l'accueil et la page ERP.
- Barre de lecture liée au défilement, soulignement de rubrique, cascade du menu mobile, FAQ fluide, transitions de page.
- Bouton pause du défilement des logos ; message « prêt à envoyer » du formulaire de contact.
- Scripts : `site/scripts/mesure.cjs`, `serveur.cjs`, `signature-seo.mjs` ; tests `tests/site_motion.test.js` et `site/tests/motion.spec.mjs`.

### Modifié
- Polices Inter et Montserrat auto-hébergées (sous-ensemble latin, sans préchargement : mesuré, le préchargement retardait le premier affichage en 3G), polices de secours aux métriques ajustées ; plus d’appel à Google Fonts.
- Styles de la vitrine dans `site/assets/vitrine.css`, chargés seulement sur l’accueil et la page ERP.
- `width`/`height` sur les images locales (logos, illustrations, galerie).
- Menu mobile : gestion du focus, fermeture en grand écran ; `aria-current` sur les liens actifs.
- Écouteur de défilement de l'en-tête : écrit seulement quand l'état change.
- Le code d'apparition quitte `site.js` pour `motion.js` (corrige le clignotement des blocs déjà visibles et la perte des transitions de survol).

### Inchangé
- URL, titres, descriptions, canoniques, Open Graph, JSON-LD, sitemap, robots, titres d'origine, textes alternatifs, clés `data-photo` (vérifié par test contre une référence prise avant les changements).
- CRM (`src/`), Supabase, `functions/`, Elite Emploi (`public/recrutement`).
