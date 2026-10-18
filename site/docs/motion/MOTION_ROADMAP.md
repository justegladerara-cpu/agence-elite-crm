# Feuille de route

Classée par impact attendu sur l'expérience et la performance.

1. **CSS critique en ligne + feuille de la boutique séparée** : `site.css` (≈ 62 Ko, ≈ 13 Ko gzip) bloque l'affichage sur toutes les pages alors que ≈ 15 % ne sert qu'à Elite Store. Gain attendu : FCP mobile 3G −150 à −300 ms.
2. **Photos réelles optimisées** : héberger les photos (ou les servir via Cloudflare Images) en AVIF/WebP avec dimensions explicites ; Unsplash n'a pas pu être mesuré depuis le poste de mesure (voir MOTION_PERFORMANCE).
3. **Mesure terrain (RUM)** : envoyer LCP / CLS / INP anonymisés avec la mesure d'audience existante (`site_visite`) pour vérifier les gains sur de vrais téléphones congolais.
4. **Vitrine enrichie** : captures animées (vidéo courte AV1/WebM, chargée à la demande) de la vraie plateforme une fois des données de démonstration officielles disponibles.
5. **Transitions de page partagées** : `view-transition-name` sur les cartes solution → image du bandeau de la page solution (morphing), navigateurs compatibles uniquement.
6. **Réalisations / études de cas** : section avec cartes animées (même système) quand des projets clients publiables seront fournis.
7. **Animations liées au défilement sans JS** (`animation-timeline: view()`) pour remplacer l'observateur des apparitions quand Safari et Firefox les prendront en charge partout.
8. **Mode sombre** du site (jetons couleur déjà centralisés).
