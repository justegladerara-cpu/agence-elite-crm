// Identité et apparence du CRM (Paramètres > Identité) : logo, nom, couleurs.
// Gardées aussi sur l'appareil pour l'écran de connexion, affiché avant le chargement des réglages.

export const THEMES = [
  { id: 'kangourou', label: 'Kangourou (anthracite & jaune)', principal: '#15191e', accent: '#d99a00' },
  { id: 'marine-or', label: 'Marine & or', principal: '#0c1833', accent: '#b8903f' },
  { id: 'noir-rouge', label: 'Noir & rouge (logo)', principal: '#121212', accent: '#e10600' },
  { id: 'noir-or', label: 'Noir & or', principal: '#141414', accent: '#c9a24e' },
  { id: 'vert-or', label: 'Vert & or', principal: '#0e2a22', accent: '#c9a24e' },
  { id: 'bleu', label: 'Bleu & corail', principal: '#10204a', accent: '#f0674f' },
  { id: 'perso', label: 'Personnalisé' },
]

export const APPARENCE_DEFAUT = {
  nom: 'LE KANGOUROU',
  sousTitre: 'Gestion du magasin',
  prenom: '',
  accroche: 'Caisse, articles, factures et ventes en temps réel.',
  afficherNom: true,
  logo: '',
  logoSombre: '',
  theme: 'kangourou',
  principal: '#15191e',
  accent: '#d99a00',
}

const KEY = 'kgr-brand'

// ---------- Couleurs ----------
const hex = (h) => {
  const m = String(h || '').trim().replace('#', '')
  const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  return /^[0-9a-f]{6}$/i.test(f) ? [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) : null
}
export const hexToRgb = (h, def = [0, 0, 0]) => hex(h) || def
const toHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const W = [255, 255, 255]
const K = [0, 0, 0]
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const couleursDe = (a = {}) => {
  const t = THEMES.find((x) => x.id === a.theme)
  return t && t.id !== 'perso' ? { principal: t.principal, accent: t.accent } : { principal: a.principal || '#0c1833', accent: a.accent || '#b8903f' }
}

// Palette complète à partir de 2 couleurs (le fond du menu doit rester foncé pour que le texte blanc se lise)
export function palette(principal, accent) {
  let p = hex(principal) || [11, 24, 48]
  const a = hex(accent) || [201, 162, 78]
  for (let i = 0; i < 12 && lum(p) > 0.05; i++) p = mix(p, K, 0.2)
  const a2 = mix(a, W, 0.35)
  return {
    '--navy': toHex(p),
    '--navy-2': toHex(mix(p, W, 0.07)),
    '--navy-3': toHex(mix(p, W, 0.15)),
    '--navy-ink': toHex(mix(p, W, 0.1)),
    '--navy-deep': toHex(mix(p, K, 0.3)),
    '--navy-rgb': p.map(Math.round).join(', '),
    '--gold': toHex(a),
    '--gold-2': toHex(a2),
    '--gold-3': toHex(mix(a, K, 0.18)),
    '--gold-soft': toHex(mix(a, W, 0.93)),
    '--gold-line': toHex(mix(a, W, 0.78)),
    '--gold-ink': toHex(lum(a) > 0.3 ? mix(a, K, 0.5) : mix(a, K, 0.25)),
    '--gold-rgb': a.map(Math.round).join(', '),
    '--gold-2-rgb': a2.map(Math.round).join(', '),
    '--on-dark': toHex(mix(p, W, 0.76)),
    '--on-dark-2': toHex(mix(p, W, 0.6)),
    '--on-accent': lum(a) > 0.3 ? toHex(p) : '#ffffff',
    '--bg': '#f5f6f8',
    '--line': '#e4e7ec',
    '--line-2': '#eef0f3',
  }
}

// Applique les couleurs (thème d'origine : on garde les valeurs du CSS)
let appliquees = []
export function applyTheme(a) {
  const root = document.documentElement
  appliquees.forEach((k) => root.style.removeProperty(k))
  appliquees = []
  const c = couleursDe(a)
  const origine = !a || a.theme === 'marine-or' || !a.theme
  if (!origine) {
    Object.entries(palette(c.principal, c.accent)).forEach(([k, v]) => {
      root.style.setProperty(k, v)
      appliquees.push(k)
    })
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', origine ? '#0c1833' : toHex(hex(palette(c.principal, c.accent)['--navy'])))
}

// ---------- Identité ----------
let brand = { ...APPARENCE_DEFAUT, ...lireCache() }
function lireCache() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
export const getBrand = () => brand

// Appelé à chaque rendu avec les réglages : met à jour l'identité, le titre, l'icône et le cache
let dernier = null
export function setBrand(a) {
  const next = { ...APPARENCE_DEFAUT, ...(a || {}) }
  const sig = JSON.stringify(next)
  if (sig === dernier) return
  dernier = sig
  brand = next
  applyTheme(next)
  document.title = `${next.nom || 'CRM'} · CRM`
  const ico = document.querySelector('link[rel="icon"]')
  if (ico) {
    if (!ico.dataset.orig) ico.dataset.orig = ico.getAttribute('href')
    ico.setAttribute('href', next.logo || ico.dataset.orig)
  }
  try {
    localStorage.setItem(KEY, sig)
  } catch {
    // Mémoire pleine : l'écran de connexion gardera l'ancienne apparence
  }
}

// Au démarrage (écran de connexion compris)
export function initBrand() {
  applyTheme(brand)
  document.title = `${brand.nom || 'CRM'} · CRM`
}
// ---------- Images (logo, cachet) ----------
// Redimensionne une image et la renvoie en data URL PNG (transparence gardée)
export function lireImage(file, max = 600) {
  return new Promise((ok, ko) => {
    if (!file || !/^image\//.test(file.type)) return ko(new Error('Choisis une image (PNG, JPG…)'))
    const r = new FileReader()
    r.onerror = () => ko(new Error('Image illisible'))
    r.onload = () => {
      const img = new Image()
      img.onerror = () => ko(new Error('Image illisible'))
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * f))
        c.height = Math.max(1, Math.round(img.height * f))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        ok(c.toDataURL('image/png'))
      }
      img.src = r.result
    }
    r.readAsDataURL(file)
  })
}
