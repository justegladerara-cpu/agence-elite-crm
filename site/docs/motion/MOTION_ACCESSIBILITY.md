# Accessibilité du mouvement

## Préférences respectées

- **`prefers-reduced-motion: reduce`** : niveau `leger` décidé avant le premier affichage, et règle CSS globale `animation: none` / `transition: none` ; logos figés (liste unique, centrée) ; défilement doux désactivé. Changement de préférence pendant la visite pris en compte (`matchMedia` `change`).
- **Économiseur de données** (`navigator.connection.saveData`) : niveau `leger`.
- **Pause** : bouton « Mettre en pause le défilement » (WCAG 2.2.2), `aria-pressed`, libellé mis à jour ; pause aussi au survol et au focus clavier.
- **Aucun clignotement** (rien au-delà de 1 flash par seconde) ; aucune animation qui déplace le contenu pendant la lecture (CLS ≤ 0,1 vérifié).

## Contenu et lecteurs d'écran

- Tout le contenu est dans le HTML ; aucun texte n'apparaît uniquement par JavaScript.
- Compteurs : valeur finale lue par les lecteurs d'écran (`sr-only`), copie animée en `aria-hidden`.
- Vitrine : `role="tablist"` / `tab` / `tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, tabulation itinérante (flèches gauche/droite, Début, Fin), panneau focalisable ; graphiques SVG avec `role="img"` et libellé ; tableau des factures avec `caption`.
- Sans JavaScript, la liste d'onglets reste masquée (`hidden`) et les rôles ARIA de panneau ne sont pas posés : pas de faux onglets.
- Orbites et éléments décoratifs en `aria-hidden`.
- Liens actifs du menu : `aria-current="page"` en plus de la couleur et du soulignement.

## Clavier et focus

- Menu mobile : le focus entre dans le menu à l'ouverture, Échap le referme et rend le focus au bouton ; fermeture automatique en repassant en grand écran.
- Contour de focus existant (`:focus-visible`, 3 px rouge) conservé ; `overflow: hidden` des boutons ne coupe pas le contour.
- Cibles tactiles ≥ 44 px (onglets, boutons, bouton pause 36 px de haut dans une zone dégagée).

## Vérifications automatisées

- Playwright : sans JS, réduction des animations, onglets au clavier, menu mobile, bouton pause, `?motion=off`, absence d'erreurs.
- axe-core (WCAG 2.0/2.1 A et AA) sur les nouveaux blocs (vitrine, chiffres, logos) : 0 violation.
