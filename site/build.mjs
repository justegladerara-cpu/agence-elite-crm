// Générateur du site vitrine agence-elite.fr (HTML statique, sans dépendance).
// Usage : node site/build.mjs [dossier de sortie]   (par défaut : site-dist)
// Les liens sont relatifs : le site fonctionne à la racine d'un domaine comme dans un sous-dossier.
import { mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE, FAMILLES, SOLUTIONS, SECTEURS, VALEURS, PARTENAIRES, PHOTOS, CREDITS_PHOTOS } from './data.mjs'

const ici = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] || join(ici, '..', 'site-dist')
const VERSION = Date.now().toString(36)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const sol = (slug) => SOLUTIONS.find((s) => s.slug === slug)
// Photo Unsplash redimensionnée à la volée (largeur w)
const unsplash = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`
const srcset = (id, ws) => ws.map((w) => `${unsplash(id, w)} ${w}w`).join(', ')
const photo = (id, alt, { w = 800, ws = [480, 800, 1200], sizes = '(max-width: 900px) 100vw, 50vw', cls = '', eager = false } = {}) =>
  `<img${cls ? ` class="${cls}"` : ''} src="${unsplash(id, w)}" srcset="${srcset(id, ws)}" sizes="${sizes}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`
const fcfa = (n) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA'
const telHref = (t) => 'tel:' + t.replace(/[^+\d]/g, '')

// Icônes (trait 1.8, 24×24)
const P = {
  web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  camera: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4.75 4.75 0 0 0 6.5 19z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bag: '<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  fork: '<path d="M7 2v9M4 2v5a3 3 0 0 0 6 0V2M7 11v11M17 22V2c-2.5 1.5-4 4-4 8h4"/>',
  heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  factory: '<path d="M2 21V10l6 4V10l6 4V6l8 4v11z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20"/>',
  hands: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
}
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`
const SOCIAL = {
  facebook: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z"/></svg>',
  instagram: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  linkedin: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9h4v12H4zM6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h4v1.7c.6-1 1.9-2 3.9-2 4 0 4.1 2.7 4.1 6V21h-4v-5.4c0-1.4 0-3.1-2-3.1s-2 1.5-2 3V21h-4z"/></svg>',
  whatsapp: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
}

const waLink = (txt) => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(txt)}`

// ---------- Gabarit commun ----------
function page({ chemin, titre, description, corps, actif = '', robots = '', scripts = null }) {
  const prof = chemin === '' ? 0 : chemin.split('/').filter(Boolean).length
  const r = (p) => '../'.repeat(prof) + p
  const canon = SITE.url + '/' + chemin
  const menuSolutions = FAMILLES.map(
    (f) => `<div class="mm-col"><div class="mm-titre">${esc(f.titre)}</div>${f.slugs
      .map((s) => {
        const x = sol(s)
        return `<a class="mm-lien" href="${r('solutions/' + s + '/')}">${ico(x.icone)}<span><strong>${esc(x.categorie)}</strong><small>${esc(x.court)}</small></span></a>`
      })
      .join('')}</div>`,
  ).join('')
  const menuSecteurs = SECTEURS.map((s) => `<a class="mm-lien simple" href="${r('secteurs/#' + s.slug)}">${ico(s.icone)}<span><strong>${esc(s.titre)}</strong></span></a>`).join('')
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: SITE.nom,
    slogan: SITE.slogan,
    url: SITE.url,
    logo: SITE.url + '/assets/img/logo.webp',
    telephone: SITE.tel1,
    email: SITE.email,
    address: { '@type': 'PostalAddress', streetAddress: SITE.adresse, addressLocality: 'Pointe-Noire', addressCountry: 'CG', postOfficeBoxNumber: '761' },
    areaServed: 'République du Congo',
    sameAs: [SITE.instagram, SITE.facebook, SITE.linkedin],
  }
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
${robots ? `<meta name="robots" content="${robots}">` : `<link rel="canonical" href="${canon}">`}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${SITE.url}/assets/img/equipe.webp">
<meta property="og:locale" content="fr_FR">
<meta name="theme-color" content="#0b0b0f">
<link rel="icon" type="image/png" href="${r('assets/img/favicon.png')}">
<link rel="apple-touch-icon" href="${r('assets/img/apple-touch-icon.png')}">
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r('assets/site.css')}?v=${VERSION}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="entete" id="entete">
  <div class="conteneur entete-in">
    <a class="marque" href="${r('')}" aria-label="Agence Elite, accueil">
      <img src="${r('assets/img/mark.webp')}" alt="" width="62" height="30">
      <span class="marque-txt"><span class="m-nom">AGENCE <b>ELITE</b></span><span class="m-slogan">${esc(SITE.slogan)}</span></span>
    </a>
    <nav class="nav" id="nav" aria-label="Navigation principale">
      <div class="nav-item has-mm">
        <button class="nav-btn${actif === 'solutions' ? ' actif' : ''}" aria-expanded="false" aria-controls="mm-solutions">Nos solutions ${ico('down', 'car')}</button>
        <div class="mm" id="mm-solutions"><div class="conteneur mm-in mm-3">${menuSolutions}</div>
          <div class="conteneur mm-pied"><a href="${r('solutions/')}">Voir toutes nos solutions ${ico('arrow')}</a></div></div>
      </div>
      <div class="nav-item has-mm">
        <button class="nav-btn${actif === 'secteurs' ? ' actif' : ''}" aria-expanded="false" aria-controls="mm-secteurs">Votre secteur ${ico('down', 'car')}</button>
        <div class="mm" id="mm-secteurs"><div class="conteneur mm-in mm-sect">${menuSecteurs}</div>
          <div class="conteneur mm-pied"><a href="${r('secteurs/')}">Toutes les solutions par secteur ${ico('arrow')}</a></div></div>
      </div>
      <div class="nav-item has-mm">
        <button class="nav-btn${actif === 'agence' ? ' actif' : ''}" aria-expanded="false" aria-controls="mm-agence">L'agence ${ico('down', 'car')}</button>
        <div class="mm mm-petit" id="mm-agence"><div class="conteneur mm-in mm-sect">
          <a class="mm-lien simple" href="${r('agence/#histoire')}">${ico('clock')}<span><strong>Notre histoire</strong></span></a>
          <a class="mm-lien simple" href="${r('agence/#mission')}">${ico('target')}<span><strong>Mission et vision</strong></span></a>
          <a class="mm-lien simple" href="${r('agence/#valeurs')}">${ico('heart')}<span><strong>Nos valeurs</strong></span></a>
          <a class="mm-lien simple" href="${r('agence/#partenaires')}">${ico('hands')}<span><strong>Nos partenaires</strong></span></a>
        </div></div>
      </div>
      <a class="nav-btn nav-lien${actif === 'boutique' ? ' actif' : ''}" href="${r('boutique/')}">Elite Store</a>
      <a class="nav-btn nav-lien${actif === 'contact' ? ' actif' : ''}" href="${r('contact/')}">Contact</a>
      <a class="btn btn-rouge nav-cta" href="${r('contact/')}">Demander un devis</a>
    </nav>
    <a class="panier-btn" href="${r('boutique/panier/')}" aria-label="Panier">${ico('bag')}<span class="panier-nb" id="panier-nb" hidden>0</span></a>
    <button class="burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nav">${ico('menu', 'i-ouvrir')}${ico('close', 'i-fermer')}</button>
  </div>
</header>
<main id="contenu">
${corps(r)}
</main>
<footer class="pied">
  <div class="conteneur pied-grille">
    <div class="pied-marque">
      <a class="marque clair" href="${r('')}"><img src="${r('assets/img/mark-light.webp')}" alt="" width="62" height="30"><span class="marque-txt"><span class="m-nom">AGENCE <b>ELITE</b></span><span class="m-slogan">${esc(SITE.slogan)}</span></span></a>
      <p>Agence de marketing 360 et de services numériques à Pointe-Noire : communication, création, web, intelligence artificielle et informatique d'entreprise.</p>
      <div class="sociaux">
        <a href="${SITE.facebook}" aria-label="Facebook" rel="noopener" target="_blank">${SOCIAL.facebook}</a>
        <a href="${SITE.instagram}" aria-label="Instagram" rel="noopener" target="_blank">${SOCIAL.instagram}</a>
        <a href="${SITE.linkedin}" aria-label="LinkedIn" rel="noopener" target="_blank">${SOCIAL.linkedin}</a>
        <a href="${waLink('Bonjour Agence Elite, ')}" aria-label="WhatsApp" rel="noopener" target="_blank">${SOCIAL.whatsapp}</a>
      </div>
    </div>
    <div><div class="pied-titre">Solutions</div>${SOLUTIONS.map((s) => `<a href="${r('solutions/' + s.slug + '/')}">${esc(s.categorie)}</a>`).join('')}</div>
    <div><div class="pied-titre">L'agence</div>
      <a href="${r('agence/#histoire')}">Notre histoire</a><a href="${r('agence/#valeurs')}">Nos valeurs</a><a href="${r('agence/#partenaires')}">Nos partenaires</a><a href="${r('secteurs/')}">Votre secteur</a><a href="${r('boutique/')}">Elite Store</a><a href="${r('contact/')}">Contact</a></div>
    <div><div class="pied-titre">Contact</div>
      <p class="pied-ligne">${ico('pin')}<span>${esc(SITE.adresse)}<br>${esc(SITE.ville)}<br>${esc(SITE.bp)}</span></p>
      <a class="pied-ligne" href="${telHref(SITE.tel1)}">${ico('phone')}<span>${esc(SITE.tel1)}</span></a>
      <a class="pied-ligne" href="${telHref(SITE.tel2)}">${ico('phone')}<span>${esc(SITE.tel2)}</span></a>
      <a class="pied-ligne" href="mailto:${SITE.email}">${ico('mail')}<span>${esc(SITE.email)}</span></a>
    </div>
  </div>
  <div class="conteneur pied-bas"><span>© ${new Date().getFullYear()} Agence Elite. Tous droits réservés.</span><a href="${r('mentions-legales/')}">Mentions légales</a></div>
</footer>
<a class="wa-flottant" href="${waLink('Bonjour Agence Elite, je souhaite parler de mon projet.')}" target="_blank" rel="noopener" aria-label="Écrire sur WhatsApp">${SOCIAL.whatsapp}</a>
<script src="${r('assets/site.js')}?v=${VERSION}" defer></script>
${scripts ? scripts(r) : ''}
</body>
</html>
`
}

// ---------- Blocs réutilisables ----------
const carteSolution = (s, r) => `
<a class="carte-sol" href="${r('solutions/' + s.slug + '/')}">
  <span class="cs-img">${
    s.photo
      ? photo(s.photo, s.categorie, { w: 640, ws: [400, 640, 900], sizes: '(max-width: 600px) 100vw, (max-width: 1080px) 50vw, 380px' })
      : `<img src="${r('assets/img/' + s.image)}" alt="${esc(s.categorie)}" loading="lazy">`
  }</span>
  <span class="cs-tete"><span class="pastille">${ico(s.icone)}</span><span class="cs-cat">${esc(s.categorie)}</span></span>
  <span class="cs-titre">${esc(s.titre)}</span>
  <span class="cs-txt">${esc(s.court)}</span>
  <span class="cs-gain">${ico('check')}${esc(s.gain)}</span>
  <span class="lien-fleche">En savoir plus ${ico('arrow')}</span>
</a>`

const bandePartenaires = (r) => {
  const logos = PARTENAIRES.map(([f, n]) => `<li><img src="${r('assets/img/partenaires/' + f + '.webp')}" alt="${esc(n)}" loading="lazy"></li>`).join('')
  return `<div class="defile" aria-label="Quelques-uns de nos partenaires"><ul class="defile-piste">${logos}</ul><ul class="defile-piste" aria-hidden="true">${logos}</ul></div>`
}

const blocCta = (r, titre = 'Parlez-nous de votre projet', txt = "Un échange de 20 minutes suffit pour comprendre votre besoin et vous proposer la bonne solution. C'est gratuit et sans engagement.") => `
<section class="section">
  <div class="conteneur">
    <div class="cta">
      <div class="cta-txt">
        <h2>${esc(titre)}</h2>
        <p>${esc(txt)}</p>
        <div class="boutons">
          <a class="btn btn-rouge" href="${r('contact/')}">Demander un devis ${ico('arrow')}</a>
          <a class="btn btn-clair" href="${waLink('Bonjour Agence Elite, je souhaite parler de mon projet.')}" target="_blank" rel="noopener">${SOCIAL.whatsapp} Écrire sur WhatsApp</a>
        </div>
      </div>
      ${photo(PHOTOS.cta[0], PHOTOS.cta[1], { cls: 'cta-img', sizes: '(max-width: 900px) 100vw, 480px' })}
    </div>
  </div>
</section>`

const faqBloc = (items) => `<div class="faq">${items
  .map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}${ico('plus')}</summary><p>${esc(a)}</p></details>`)
  .join('')}</div>`

// ---------- Pages ----------
const PAGES = []

// Accueil
PAGES.push({
  chemin: '',
  titre: "Agence Elite | Communication, web, IA et informatique à Pointe-Noire",
  description: "Agence Elite, agence de marketing 360 à Pointe-Noire : réseaux sociaux, sites internet, création graphique et audiovisuelle, impression, intelligence artificielle, Microsoft 365 et ERP.",
  corps: (r) => `
<section class="hero">
  <div class="hero-fond" aria-hidden="true"></div>
  <div class="conteneur hero-grille">
    <div class="hero-txt">
      <p class="surtitre">Agence de marketing 360 en République du Congo</p>
      <h1>Communication, marketing digital et technologies <span class="rouge">au service de votre succès.</span></h1>
      <p class="hero-lead">Agence Elite réunit sous un même toit la création, le web, l'intelligence artificielle et l'informatique d'entreprise, pour transformer vos idées en résultats concrets.</p>
      <div class="boutons">
        <a class="btn btn-rouge" href="${r('contact/')}">Parlez-nous de votre projet ${ico('arrow')}</a>
        <a class="btn btn-ligne" href="${r('solutions/')}">Découvrir nos solutions</a>
      </div>
      <ul class="hero-points">
        <li>${ico('check')}9 expertises réunies</li>
        <li>${ico('check')}Un interlocuteur unique</li>
        <li>${ico('check')}Basés à Pointe-Noire</li>
      </ul>
    </div>
    <div class="hero-visuel">
      ${photo(PHOTOS.hero[0], PHOTOS.hero[1], { w: 1200, ws: [600, 900, 1200, 1600], sizes: '(max-width: 900px) 100vw, 580px', eager: true })}
      <div class="hero-badge b1">${ico('megaphone')}<span><strong>Réseaux sociaux</strong><small>Gestion et publicité</small></span></div>
      <div class="hero-badge b2">${ico('spark')}<span><strong>Intelligence artificielle</strong><small>Chatbots et automatisation</small></span></div>
    </div>
  </div>
  <div class="conteneur confiance">
    <p>Ils nous font confiance</p>
    ${bandePartenaires(r)}
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="ia">
      <div class="ia-txt">
        <p class="surtitre clair">Intelligence artificielle intégrée</p>
        <h2>L'IA dans vos outils, pour aller plus vite et décider mieux</h2>
        <p>Nous intégrons l'intelligence artificielle là où elle vous fait gagner du temps : dans vos échanges clients, vos contenus et vos données.</p>
        <a class="btn btn-blanc" href="${r('solutions/intelligence-artificielle/')}">Découvrir l'IA ${ico('arrow')}</a>
      </div>
      <div class="ia-grille">
        ${[
          ['chat', 'Assistants conversationnels', 'Un chatbot WhatsApp ou sur votre site qui répond 24 h sur 24.'],
          ['clock', 'Automatisation', 'Relances, devis et rapports faits sans ressaisie.'],
          ['pen', 'Contenus assistés', 'Textes et visuels produits plus vite, relus par nos équipes.'],
          ['grid', 'Aide à la décision', 'Vos données transformées en tableaux de bord clairs.'],
        ]
          .map(([i, t, d]) => `<div class="ia-carte">${ico(i)}<strong>${t}</strong><span>${d}</span></div>`)
          .join('')}
      </div>
    </div>
  </div>
</section>

<section class="section section-douce" id="solutions">
  <div class="conteneur">
    <div class="titre-section">
      <p class="surtitre">Nos solutions</p>
      <h2>Toutes les expertises pour développer votre entreprise</h2>
      <p>De la première impression à la gestion quotidienne, chaque solution est pensée pour produire un résultat mesurable.</p>
    </div>
    <div class="grille-sol">${SOLUTIONS.map((s) => carteSolution(s, r)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="titre-section">
      <p class="surtitre">Votre secteur</p>
      <h2>Des solutions adaptées à votre métier</h2>
      <p>Commerçants, restaurateurs, industriels ou associations : nous partons de vos enjeux, pas d'un catalogue.</p>
    </div>
    <div class="grille-sect">${SECTEURS.map(
      (s) => `<a class="carte-sect avec-photo" href="${r('secteurs/#' + s.slug)}"><span class="sect-img">${photo(s.photo, s.titre, { w: 600, ws: [400, 600, 900], sizes: '(max-width: 600px) 100vw, (max-width: 1080px) 50vw, 380px' })}<span class="pastille">${ico(s.icone)}</span></span><strong>${esc(s.titre)}</strong><span>${esc(s.besoin)}</span></a>`,
    ).join('')}</div>
  </div>
</section>

<section class="section section-douce">
  <div class="conteneur">
    <div class="titre-section">
      <p class="surtitre">Sur le terrain</p>
      <h2>Au plus près des entrepreneurs d'ici</h2>
      <p>Commerçants, artisans, créateurs et équipes de bureau : nous travaillons avec ceux qui font vivre l'économie locale.</p>
    </div>
    <div class="mosaique">${PHOTOS.terrain.map(([id, alt], i) => `<figure class="m${i}">${photo(id, alt, { w: 700, ws: [400, 700, 1000], sizes: '(max-width: 600px) 100vw, 50vw' })}<figcaption>${esc(alt)}</figcaption></figure>`).join('')}</div>
  </div>
</section>

<section class="section section-sombre">
  <div class="conteneur">
    <div class="titre-section clair">
      <p class="surtitre">Notre méthode</p>
      <h2>Un accompagnement en quatre étapes</h2>
      <p>Le même processus éprouvé pour chaque projet, du simple flyer à l'intégration d'un ERP.</p>
    </div>
    <ol class="etapes">
      ${[
        ['Écoute et diagnostic', 'Nous comprenons vos objectifs, vos clients et vos contraintes.'],
        ['Proposition', 'Un plan d\'action clair, un planning et un devis détaillé.'],
        ['Réalisation', 'Nos équipes créent, développent et installent, avec des points réguliers.'],
        ['Formation et suivi', 'Vous êtes autonome, et nous restons disponibles pour la suite.'],
      ]
        .map(([t, d], i) => `<li><span class="num">${i + 1}</span><strong>${t}</strong><span>${d}</span></li>`)
        .join('')}
    </ol>
  </div>
</section>

<section class="section">
  <div class="conteneur deux-col">
    <div>
      <p class="surtitre">Pourquoi Agence Elite</p>
      <h2>Bien plus qu'une agence de marketing</h2>
      <p>Fondée avec passion et créativité, Agence Elite est née d'une vision audacieuse : créer un lieu où l'innovation, la créativité et l'engagement envers l'excellence se rencontrent.</p>
      <ul class="liste-check">
        ${VALEURS.map(([t, d]) => `<li>${ico('check')}<span><strong>${t}.</strong> ${d}</span></li>`).join('')}
      </ul>
      <a class="lien-fleche" href="${r('agence/')}">Découvrir l'agence ${ico('arrow')}</a>
    </div>
    <div class="securite">
      ${ico('shield', 'grand')}
      <h3>Vos données restent les vôtres</h3>
      <p>Sites, comptes, fichiers sources et données clients : tout ce que nous créons pour vous vous appartient. Accès sécurisés, sauvegardes et bonnes pratiques de cybersécurité sont inclus dans nos projets.</p>
      <div class="badges"><span>Sauvegardes</span><span>Accès sécurisés</span><span>Fichiers sources livrés</span><span>Confidentialité</span></div>
    </div>
  </div>
</section>
${blocCta(r)}`,
})

// Liste des solutions
PAGES.push({
  chemin: 'solutions/',
  actif: 'solutions',
  titre: 'Nos solutions | Agence Elite',
  description: 'Communication digitale, création graphique et audiovisuelle, impression, sites internet, intelligence artificielle, services informatiques, Microsoft 365 et ERP.',
  corps: (r) => `
<section class="bandeau">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>Nos solutions</span></nav>
    <h1>Nos solutions</h1>
    <p class="hero-lead">Neuf expertises complémentaires, un seul interlocuteur.</p>
  </div>
</section>
${FAMILLES.map(
  (f, i) => `<section class="section${i % 2 ? ' section-douce' : ''}"><div class="conteneur">
  <div class="titre-section gauche"><h2>${esc(f.titre)}</h2></div>
  <div class="grille-sol">${f.slugs.map((s) => carteSolution(sol(s), r)).join('')}</div></div></section>`,
).join('')}
${blocCta(r)}`,
})

// Une page par solution
for (const s of SOLUTIONS) {
  const autres = SOLUTIONS.filter((x) => x.slug !== s.slug && FAMILLES.find((f) => f.slugs.includes(s.slug)).slugs.includes(x.slug))
  const suggestions = (autres.length >= 2 ? autres : SOLUTIONS.filter((x) => x.slug !== s.slug)).slice(0, 3)
  PAGES.push({
    chemin: `solutions/${s.slug}/`,
    actif: 'solutions',
    titre: `${s.categorie} | Agence Elite`,
    description: s.court,
    corps: (r) => `
<section class="bandeau bandeau-sol">
  <div class="conteneur bandeau-grille">
    <div>
      <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><a href="${r('solutions/')}">Nos solutions</a><span>/</span><span>${esc(s.categorie)}</span></nav>
      <p class="surtitre">${ico(s.icone)} ${esc(s.categorie)}</p>
      <h1>${esc(s.titre)}</h1>
      <p class="hero-lead">${esc(s.intro)}</p>
      <div class="boutons">
        <a class="btn btn-rouge" href="${r('contact/?solution=' + s.slug)}">Demander un devis ${ico('arrow')}</a>
        <a class="btn btn-ligne" href="${waLink(`Bonjour Agence Elite, je souhaite des informations sur : ${s.categorie}.`)}" target="_blank" rel="noopener">${SOCIAL.whatsapp} WhatsApp</a>
      </div>
    </div>
    ${
      s.photo
        ? photo(s.photo, s.categorie, { w: 900, ws: [500, 900, 1300], sizes: '(max-width: 900px) 100vw, 520px', cls: 'bandeau-img', eager: true })
        : s.image
        ? `<img class="bandeau-img${/webp$/.test(s.image) && ['communication.webp', 'graphisme.webp', 'collaboration.webp', 'visio.webp'].includes(s.image) ? ' illu' : ''}" src="${r('assets/img/' + s.image)}" alt="${esc(s.categorie)}" width="600" height="400">`
        : `<div class="bandeau-img video" aria-hidden="true"><span class="play">${ico('camera')}</span><span class="rec">● REC</span></div>`
    }
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="titre-section gauche"><p class="surtitre">Ce que nous faisons</p><h2>Nos prestations</h2></div>
    <div class="grille-presta">${s.services.map(([t, d]) => `<div class="presta">${ico('check')}<div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></div>`).join('')}</div>
    ${
      s.illustrations
        ? `<div class="grille-illu">${s.illustrations.map(([f, t]) => `<figure><img src="${r('assets/img/' + f)}" alt="${esc(t)}" loading="lazy"><figcaption>${esc(t)}</figcaption></figure>`).join('')}</div>`
        : ''
    }
    ${
      s.galerie
        ? `<div class="galerie">${s.galerie.map(([f, t]) => `<figure><img src="${r('assets/img/' + f)}" alt="${esc(t)}" loading="lazy"><figcaption>${esc(t)}</figcaption></figure>`).join('')}</div>`
        : ''
    }
  </div>
</section>

${
  s.slug === 'microsoft-365'
    ? `<section class="section section-sombre"><div class="conteneur offre-phare"><div><p class="surtitre">Disponible sur Elite Store</p><h2>Microsoft 365 Business Standard : 77 000 FCFA par an</h2><p>Licence officielle, e-mail professionnel, installation et configuration par nos techniciens.</p></div>
    <a class="btn btn-rouge" href="${r('boutique/produit/?p=microsoft-365-business-standard')}">Commander ${ico('arrow')}</a></div></section>`
    : ''
}
<section class="section section-douce">
  <div class="conteneur">
    <div class="titre-section gauche"><p class="surtitre">Ce que vous y gagnez</p><h2>${esc(s.gain)}</h2></div>
    <div class="grille-benef">${s.benefices.map(([t, d]) => `<div class="benef"><span class="pastille">${ico('target')}</span><strong>${esc(t)}</strong><p>${esc(d)}</p></div>`).join('')}</div>
  </div>
</section>

${
  s.etapes
    ? `<section class="section section-sombre"><div class="conteneur"><div class="titre-section clair"><p class="surtitre">Notre processus d'intégration</p><h2>Une intégration réussie en quatre étapes</h2></div>
<ol class="etapes">${s.etapes.map(([t, d], i) => `<li><span class="num">${i + 1}</span><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join('')}</ol></div></section>`
    : ''
}

<section class="section">
  <div class="conteneur deux-col haut">
    <div><p class="surtitre">Questions fréquentes</p><h2>Vous vous demandez peut-être</h2><p>Une autre question ? <a href="${r('contact/')}">Écrivez-nous</a>, nous répondons rapidement.</p></div>
    ${faqBloc(s.faq)}
  </div>
</section>

<section class="section section-douce">
  <div class="conteneur">
    <div class="titre-section gauche"><h2>Ces solutions peuvent aussi vous intéresser</h2></div>
    <div class="grille-sol trois">${suggestions.map((x) => carteSolution(x, r)).join('')}</div>
  </div>
</section>
${blocCta(r)}`,
  })
}

// Secteurs
PAGES.push({
  chemin: 'secteurs/',
  actif: 'secteurs',
  titre: 'Votre secteur | Agence Elite',
  description: 'Commerce, restauration, santé, immobilier, transport, industrie, conseil, associations, éducation : les solutions Agence Elite adaptées à votre métier.',
  corps: (r) => `
<section class="bandeau">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>Votre secteur</span></nav>
    <h1>Des solutions adaptées à votre métier</h1>
    <p class="hero-lead">Chaque secteur a ses clients, ses contraintes et ses priorités. Voici par où nous commençons avec les entreprises comme la vôtre.</p>
  </div>
</section>
<section class="section">
  <div class="conteneur liste-sect">
    ${SECTEURS.map(
      (s) => `<article class="sect" id="${s.slug}">
      <div class="sect-gauche">${photo(s.photo, s.titre, { w: 700, ws: [400, 700, 1000], sizes: '(max-width: 1080px) 100vw, 480px', cls: 'sect-photo' })}
      <div class="sect-tete"><span class="pastille grande">${ico(s.icone)}</span><div><h2>${esc(s.titre)}</h2><p>${esc(s.besoin)}</p></div></div></div>
      <div class="sect-sols">${s.solutions
        .map((x) => {
          const y = sol(x)
          return `<a href="${r('solutions/' + x + '/')}">${ico(y.icone)}<span><strong>${esc(y.categorie)}</strong><small>${esc(y.gain)}</small></span></a>`
        })
        .join('')}</div>
    </article>`,
    ).join('')}
  </div>
</section>
${blocCta(r, "Votre secteur n'est pas dans la liste ?", 'Nous accompagnons tous types d\'entreprises. Décrivez-nous votre activité et vos objectifs, nous vous proposerons un plan adapté.')}`,
})

// L'agence
PAGES.push({
  chemin: 'agence/',
  actif: 'agence',
  titre: "L'agence | Agence Elite",
  description: "Histoire, mission, vision, valeurs et partenaires d'Agence Elite, agence de marketing 360 à Pointe-Noire.",
  corps: (r) => `
<section class="bandeau">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>L'agence</span></nav>
    <h1>Bien plus qu'une agence de marketing</h1>
    <p class="hero-lead">Une équipe talentueuse qui se consacre à transformer les idées en résultats concrets.</p>
  </div>
</section>
<section class="section" id="histoire">
  <div class="conteneur deux-col">
    <div>
      <p class="surtitre">Notre histoire</p>
      <h2>Une vision audacieuse</h2>
      <p>Fondée avec passion et créativité, Agence Elite est bien plus qu'une agence de marketing. Notre histoire a débuté avec une vision audacieuse : créer un lieu où l'innovation, la créativité et l'engagement envers l'excellence se rencontrent pour offrir à nos clients une expérience exceptionnelle.</p>
      <p>Depuis nos débuts, nous avons évolué pour devenir un pilier du marketing 360, avec un portefeuille diversifié de services et une équipe qui se consacre à transformer les idées en résultats concrets.</p>
    </div>
    ${photo(PHOTOS.agence[0][0], PHOTOS.agence[0][1], { cls: 'img-arrondie' })}
  </div>
</section>
<section class="section section-douce" id="mission">
  <div class="conteneur mv">
    <div class="mv-carte"><span class="pastille grande">${ico('target')}</span><h2>Notre mission</h2><p>Elle est simple : aider nos clients à atteindre leurs objectifs en leur offrant des solutions de marketing et de communication de classe mondiale. Nous sommes motivés par la réussite de nos clients, et chaque projet est guidé par un engagement inébranlable envers l'excellence.</p></div>
    <div class="mv-carte"><span class="pastille grande">${ico('spark')}</span><h2>Notre vision</h2><p>Devenir le partenaire de confiance de nos clients, en les aidant à réussir dans un monde en constante évolution. Nous voulons être reconnus non seulement pour nos compétences techniques, mais aussi pour notre capacité à comprendre les besoins uniques de chaque client et à les traduire en résultats tangibles.</p></div>
  </div>
</section>
<section class="section">
  <div class="conteneur">
    <div class="titre-section"><p class="surtitre">Notre quotidien</p><h2>Créer, conseiller, accompagner</h2></div>
    <div class="galerie-photos">${PHOTOS.agence.slice(1).map(([id, alt]) => `<figure>${photo(id, alt, { w: 600, ws: [400, 600, 900], sizes: '(max-width: 600px) 100vw, 33vw' })}</figure>`).join('')}</div>
  </div>
</section>
<section class="section" id="valeurs">
  <div class="conteneur">
    <div class="titre-section"><p class="surtitre">Nos valeurs</p><h2>Ce qui guide chacun de nos projets</h2></div>
    <div class="grille-valeurs">${VALEURS.map(([t, d], i) => `<div class="valeur"><span class="num">0${i + 1}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
  </div>
</section>
<section class="section section-douce" id="partenaires">
  <div class="conteneur">
    <div class="titre-section"><p class="surtitre">Nos partenaires</p><h2>Quelques-uns de nos partenaires</h2></div>
    <ul class="grille-logos">${PARTENAIRES.map(([f, n]) => `<li><img src="${r('assets/img/partenaires/' + f + '.webp')}" alt="${esc(n)}" loading="lazy"></li>`).join('')}</ul>
  </div>
</section>
${blocCta(r)}`,
})

// Elite Store : pages générées vides, remplies par assets/store.js à partir de la base (catalogue géré dans le CRM)
const storeScript = (r) =>
  `<script>window.AE_STORE = ${JSON.stringify({ url: SITE.supabaseUrl, cle: SITE.supabaseCle, wa: SITE.whatsapp })}; window.AE_STORE.base = '${r('')}';</script><script src="${r('assets/store.js')}?v=${VERSION}" defer></script>`
const rassurance = `<div class="rassurance">
  <div>${ico('shield')}<span><strong>Licences officielles</strong><small>Achetées auprès de distributeurs agréés</small></span></div>
  <div>${ico('clock')}<span><strong>Livraison rapide</strong><small>Clé ou compte activé sous 24 h ouvrées</small></span></div>
  <div>${ico('chip')}<span><strong>Installation incluse</strong><small>Nous installons et configurons pour vous</small></span></div>
  <div>${SOCIAL.whatsapp}<span><strong>Assistance WhatsApp</strong><small>${esc(SITE.tel1)}</small></span></div>
</div>`

PAGES.push({
  chemin: 'boutique/',
  actif: 'boutique',
  titre: 'Elite Store : licences et logiciels professionnels | Agence Elite',
  description: 'Microsoft 365, Windows, Office, antivirus Kaspersky et ESET, Adobe, Canva, Google Workspace, AutoCAD : licences officielles en FCFA, livrées et installées par Agence Elite à Pointe-Noire.',
  scripts: storeScript,
  corps: (r) => `
<section class="bandeau bandeau-store">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>Elite Store</span></nav>
    <p class="surtitre">Elite Store</p>
    <h1>Les logiciels de votre entreprise, en FCFA</h1>
    <p class="hero-lead">Licences officielles Microsoft, Google, Adobe, Kaspersky et bien d'autres, livrées, installées et suivies par nos techniciens.</p>
    <label class="recherche-store">${ico('target')}<span class="sr-only">Rechercher un produit</span><input id="store-recherche" type="search" placeholder="Rechercher : Windows, Office, antivirus…" autocomplete="off"></label>
  </div>
</section>
<section class="section section-store">
  <div class="conteneur">
    ${rassurance}
    <div class="filtres" id="store-cats" role="group" aria-label="Catégories"></div>
    <p class="store-compte" id="store-compte" aria-live="polite"></p>
    <div class="grille-produits" id="store-grille"><p class="store-charge">Chargement du catalogue…</p></div>
    <noscript><p>Activez JavaScript pour afficher la boutique, ou commandez sur WhatsApp au ${esc(SITE.tel1)}.</p></noscript>
  </div>
</section>
${blocCta(r, 'Plusieurs postes à équiper ?', 'Parc informatique, licences en volume ou migration complète : nous préparons un devis adapté à votre entreprise.')}`,
})

PAGES.push({
  chemin: 'boutique/produit/',
  actif: 'boutique',
  titre: 'Produit | Elite Store | Agence Elite',
  description: 'Licence officielle livrée et installée par Agence Elite.',
  scripts: storeScript,
  corps: (r) => `
<section class="section section-fiche">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><a href="${r('boutique/')}">Elite Store</a><span>/</span><span id="fil-produit">Produit</span></nav>
    <div id="store-fiche"><p class="store-charge">Chargement du produit…</p></div>
    ${rassurance}
    <div id="store-similaires"></div>
  </div>
</section>`,
})

PAGES.push({
  chemin: 'boutique/panier/',
  actif: 'boutique',
  robots: 'noindex',
  titre: 'Panier | Elite Store | Agence Elite',
  description: 'Votre panier Elite Store.',
  scripts: storeScript,
  corps: (r) => `
<section class="section paiement">
  <div class="conteneur">
    <div class="demo-banniere" id="store-demo" hidden role="note">${ico('shield')}<span><strong>Mode démonstration.</strong> La carte de test est pré-remplie, aucun paiement réel n'est effectué et la commande est marquée « démo » dans le CRM.</span></div>
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><a href="${r('boutique/')}">Elite Store</a><span>/</span><span>Panier</span></nav>
    <div class="paie-grille" id="store-caisse">
      <form class="formulaire" id="form-commande" novalidate>
        <h1 class="paie-titre">Finaliser la commande</h1>
        <fieldset>
          <legend>Vos coordonnées</legend>
          <div class="champs-2">
            <label>Nom et prénom *<input class="champ" name="nom" autocomplete="name" required></label>
            <label>Téléphone / WhatsApp *<input class="champ" name="tel" type="tel" autocomplete="tel" required></label>
          </div>
          <div class="champs-2">
            <label>E-mail<input class="champ" name="email" type="email" autocomplete="email"></label>
            <label>Entreprise<input class="champ" name="entreprise" autocomplete="organization"></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Mode de paiement</legend>
          <div class="modes">
            <label class="mode"><input type="radio" name="paiement" value="mobile_money" checked><span><strong>Mobile Money</strong><small>MTN MoMo ou Airtel Money : nous vous envoyons le numéro de paiement.</small></span></label>
            <label class="mode"><input type="radio" name="paiement" value="virement"><span><strong>Virement bancaire</strong><small>Nous vous envoyons la facture avec nos coordonnées bancaires.</small></span></label>
            <label class="mode"><input type="radio" name="paiement" value="especes"><span><strong>Espèces à l'agence</strong><small>10 avenue Stéphane Tchitchelle, Pointe-Noire.</small></span></label>
            <label class="mode" id="mode-carte"><input type="radio" name="paiement" value="carte" disabled><span><strong>Carte bancaire</strong><small id="carte-info">Bientôt disponible.</small></span></label>
          </div>
          <div class="carte-test" id="carte-test" hidden>
            <label>Numéro de carte<input class="champ verrou" value="4242 4242 4242 4242" readonly tabindex="-1"></label>
            <div class="champs-2"><label>Expiration<input class="champ verrou" value="12 / 30" readonly tabindex="-1"></label><label>Cryptogramme<input class="champ verrou" value="123" readonly tabindex="-1"></label></div>
          </div>
        </fieldset>
        <p class="form-erreur" id="commande-erreur" role="alert" hidden></p>
        <button class="btn btn-rouge btn-large" type="submit" id="btn-commander">Valider la commande</button>
        <p class="petit">${ico('shield')} Vos informations servent uniquement à traiter votre commande.</p>
      </form>
      <aside class="recap">
        <h2>Votre panier</h2>
        <div id="panier-lignes"><p class="petit">Votre panier est vide.</p></div>
        <div class="recap-total"><span>Total</span><strong id="panier-total">0 FCFA</strong></div>
        <a class="lien-fleche" href="${r('boutique/')}">Continuer mes achats ${ico('arrow')}</a>
      </aside>
    </div>
    <div class="confirmation" id="store-confirmation" hidden tabindex="-1">
      <span class="conf-ico">${ico('check')}</span>
      <h1 id="conf-titre">Commande enregistrée</h1>
      <p>Merci <strong id="conf-nom"></strong>. Votre commande <strong id="conf-num"></strong> est bien enregistrée.</p>
      <div class="recap conf-recap" id="conf-lignes"></div>
      <p id="conf-suite"></p>
      <div class="boutons"><a class="btn btn-rouge" id="conf-wa" target="_blank" rel="noopener">${SOCIAL.whatsapp} Confirmer sur WhatsApp</a><a class="btn btn-ligne" href="${r('boutique/')}">Retour à la boutique</a></div>
    </div>
  </div>
</section>`,
})

// Contact
PAGES.push({
  chemin: 'contact/',
  actif: 'contact',
  titre: 'Contact | Agence Elite',
  description: `Contactez Agence Elite à Pointe-Noire : ${SITE.tel1}, ${SITE.email}. Devis gratuit et sans engagement.`,
  corps: (r) => `
<section class="bandeau">
  <div class="conteneur">
    <nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>Contact</span></nav>
    <h1>Parlez-nous de votre projet</h1>
    <p class="hero-lead">Décrivez votre besoin en quelques lignes : nous revenons vers vous rapidement avec une proposition claire.</p>
  </div>
</section>
<section class="section">
  <div class="conteneur contact-grille">
    <form class="formulaire" id="form-contact" novalidate data-wa="${SITE.whatsapp}" data-email="${SITE.email}">
      <div class="champs-2">
        <label>Nom et prénom *<input class="champ" name="nom" autocomplete="name" required></label>
        <label>Entreprise<input class="champ" name="entreprise" autocomplete="organization"></label>
      </div>
      <div class="champs-2">
        <label>Téléphone / WhatsApp *<input class="champ" name="tel" type="tel" autocomplete="tel" required placeholder="06 000 00 00"></label>
        <label>E-mail<input class="champ" name="email" type="email" autocomplete="email"></label>
      </div>
      <label>Solution qui vous intéresse
        <select class="champ" name="solution"><option value="">Je ne sais pas encore</option>${SOLUTIONS.map((s) => `<option value="${s.slug}">${esc(s.categorie)}</option>`).join('')}</select>
      </label>
      <label>Votre projet *<textarea class="champ" name="message" rows="5" required placeholder="Votre activité, votre objectif, votre délai…"></textarea></label>
      <p class="form-erreur" id="form-erreur" role="alert" hidden>Merci d'indiquer votre nom, votre téléphone et quelques mots sur votre projet.</p>
      <div class="boutons">
        <button class="btn btn-rouge" type="submit" data-canal="whatsapp">${SOCIAL.whatsapp} Envoyer sur WhatsApp</button>
        <button class="btn btn-ligne" type="submit" data-canal="email">${ico('mail')} Envoyer par e-mail</button>
      </div>
      <p class="petit">Votre message s'ouvre dans WhatsApp ou dans votre messagerie, prêt à être envoyé.</p>
    </form>
    <aside class="coordonnees">
      <h2>Nos coordonnées</h2>
      <a class="coord" href="${telHref(SITE.tel1)}"><span class="pastille">${ico('phone')}</span><span><small>Téléphone et WhatsApp</small><strong>${esc(SITE.tel1)}</strong></span></a>
      <a class="coord" href="${telHref(SITE.tel2)}"><span class="pastille">${ico('phone')}</span><span><small>Téléphone</small><strong>${esc(SITE.tel2)}</strong></span></a>
      <a class="coord" href="mailto:${SITE.email}"><span class="pastille">${ico('mail')}</span><span><small>E-mail</small><strong>${esc(SITE.email)}</strong></span></a>
      <div class="coord"><span class="pastille">${ico('pin')}</span><span><small>Adresse</small><strong>${esc(SITE.adresse)}</strong><span>${esc(SITE.ville)}, ${esc(SITE.bp)}</span></span></div>
      <iframe class="carte" title="Plan d'accès Agence Elite" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps?q=${encodeURIComponent('Avenue Stéphane Tchitchelle, Pointe-Noire, Congo')}&output=embed"></iframe>
    </aside>
  </div>
</section>`,
})

// Mentions légales
PAGES.push({
  chemin: 'mentions-legales/',
  titre: 'Mentions légales | Agence Elite',
  description: 'Mentions légales du site agence-elite.fr.',
  corps: (r) => `
<section class="bandeau"><div class="conteneur"><nav class="fil" aria-label="Fil d'Ariane"><a href="${r('')}">Accueil</a><span>/</span><span>Mentions légales</span></nav><h1>Mentions légales</h1></div></section>
<section class="section"><div class="conteneur texte">
  <h2>Éditeur du site</h2>
  <p>Agence Elite, ${esc(SITE.adresse)}, ${esc(SITE.ville)}, ${esc(SITE.bp)}.<br>Téléphone : ${esc(SITE.tel1)} / ${esc(SITE.tel2)}. E-mail : ${esc(SITE.email)}.</p>
  <h2>Hébergement</h2>
  <p>Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis.</p>
  <h2>Propriété intellectuelle</h2>
  <p>Les textes, logos et visuels de ce site sont la propriété d'Agence Elite ou de ses partenaires. Toute reproduction sans autorisation est interdite.</p>
  <h2>Crédits photos</h2>
  <p>Visuels du catalogue Agence Elite. Photographies libres de droits issues d'Unsplash (licence Unsplash) : ${esc(CREDITS_PHOTOS)}.</p>
  <h2>Données personnelles</h2>
  <p>Le formulaire de contact n'enregistre aucune donnée sur ce site : votre message est transmis directement par WhatsApp ou par e-mail. Les informations que vous nous envoyez servent uniquement à répondre à votre demande. Vous pouvez demander leur suppression à tout moment en écrivant à ${esc(SITE.email)}.</p>
</div></section>`,
})

// 404
PAGES.push({
  chemin: '404/',
  titre: 'Page introuvable | Agence Elite',
  description: 'Cette page est introuvable.',
  corps: (r) => `<section class="bandeau vide"><div class="conteneur"><p class="surtitre">Erreur 404</p><h1>Cette page est introuvable</h1><p class="hero-lead">Elle a peut-être été déplacée. Revenez à l'accueil ou découvrez nos solutions.</p>
  <div class="boutons"><a class="btn btn-rouge" href="${r('')}">Retour à l'accueil</a><a class="btn btn-ligne" href="${r('solutions/')}">Nos solutions</a></div></div></section>`,
})

// ---------- Écriture ----------
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(join(ici, 'assets'), join(OUT, 'assets'), { recursive: true })
for (const p of PAGES) {
  const html = page(p)
  if (p.chemin === '404/') {
    // Cloudflare Pages sert /404.html à la racine : liens absolus depuis la racine du site
    writeFileSync(join(OUT, '404.html'), page({ ...p, chemin: '' }).replace('<link rel="canonical" href="https://agence-elite.fr/">', ''))
    continue
  }
  mkdirSync(join(OUT, p.chemin), { recursive: true })
  writeFileSync(join(OUT, p.chemin, 'index.html'), html)
}
const urls = PAGES.filter((p) => p.chemin !== '404/').map((p) => `  <url><loc>${SITE.url}/${p.chemin}</loc></url>`)
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`)
console.log(`Site Agence Elite : ${PAGES.length} pages dans ${OUT}`)
