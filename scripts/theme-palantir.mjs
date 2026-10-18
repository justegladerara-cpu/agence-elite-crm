// Génère src/palantir.css : la version sombre « salle de contrôle » de src/index.css.
// Chaque règle qui écrit une couleur claire en dur (fond blanc, bordure grise, texte marine…) est recopiée
// sous :root[data-ui="palantir"] avec sa couleur passée en sombre. Les couleurs déjà sombres ne bougent pas.
// À relancer après chaque modification de index.css : node scripts/theme-palantir.mjs
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const source = path.join(racine, 'src/index.css')
const cible = path.join(racine, 'src/palantir.css')

const PREFIXE = ':root[data-ui="palantir"]'
// Écrans dont le fond doit rester une feuille blanche (aperçus imprimables)
const PAPIER = /apercu|papier|paper|print|imprim/i
// Barres et panneaux qui restent sombres (le fond « navy » y est voulu)
const CHROME = /sidebar|nav-|selection|mobile-top|bottom-nav|login|hero|toast|save-bar|bulk-bar|bigkpi|kpi\.navy|ck-kpi:first-child|img-prev\.dark|brand/

// ---------- Couleurs ----------
const NOMS = { white: '#ffffff', black: '#000000' }
function lire(c) {
  c = NOMS[c.toLowerCase()] || c
  let m = /^#([0-9a-f]{3,8})$/i.exec(c)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('')
    const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    return { rgb: n, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat)
    if (p.length < 3 || p.some(Number.isNaN)) return null
    return { rgb: p.slice(0, 3), a: p[3] ?? 1 }
  }
  return null
}
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
const ecrire = (h, s, l, a = 1) => {
  const f = (v) => Math.round(v * 1000) / 10
  return a < 1 ? `hsl(${Math.round(h)} ${f(s)}% ${f(l)}% / ${Math.round(a * 100) / 100})` : `hsl(${Math.round(h)} ${f(s)}% ${f(l)}%)`
}
const borne = (v, a, b) => Math.min(b, Math.max(a, v))

// Fond clair -> surface sombre (blanc = carte, gris très clair = surface au survol, teinté = teinte sombre)
function fond(c) {
  const [h, s, l] = hsl(c.rgb)
  // Voile blanc transparent : déjà fait pour un fond sombre
  if (l <= 0.6 || c.a < 0.5) return null
  if (s < 0.2 || l > 0.97) {
    if (l > 0.985) return c.a < 1 ? `rgba(28, 33, 39, ${c.a})` : '#1c2127'
    return c.a < 1 ? `rgba(37, 42, 49, ${c.a})` : '#252a31'
  }
  return ecrire(h, s * 0.45, borne(0.12 + (1 - l) * 0.5, 0.13, 0.3), c.a)
}
// Texte foncé -> texte clair de même teinte
function texte(c) {
  const [h, s, l] = hsl(c.rgb)
  if (l >= 0.55) return null
  if (s < 0.15) return l < 0.3 ? '#f6f7f9' : '#abb3bf'
  return ecrire(h, Math.min(1, s * 0.9), borne(1 - l * 0.8, 0.66, 0.9), c.a)
}
// Bordure claire -> trait sombre
function trait(c) {
  const [h, s, l] = hsl(c.rgb)
  if (l <= 0.6 || c.a < 0.5) return null
  if (s < 0.25) return c.a < 1 ? `rgba(56, 62, 71, ${c.a})` : '#383e47'
  return ecrire(h, s * 0.5, 0.32, c.a)
}

const COULEUR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi
function remplacer(valeur, f) {
  let change = false
  const v = valeur.replace(COULEUR, (m) => {
    const c = lire(m)
    const r = c && f(c)
    if (!r) return m
    change = true
    return r
  })
  return change ? v : null
}

// Variables de la palette claire employées comme couleur de texte : en sombre, elles deviennent claires
const VAR_TEXTE = { navy: 'var(--text)', 'navy-ink': 'var(--text)', 'navy-2': 'var(--text)', 'navy-3': 'var(--text)', 'navy-deep': 'var(--text)', 'gold-3': 'var(--gold-2)', 'gold-ink': 'var(--gold-2)' }
function varTexte(v) {
  let change = false
  const r = v.replace(/var\(--(navy(?:-ink|-2|-3|-deep)?|gold-3|gold-ink)\)/g, (m, n) => {
    change = true
    return VAR_TEXTE[n]
  })
  return change ? r : null
}
function varFond(v, selecteur) {
  if (CHROME.test(selecteur)) return null
  let change = false
  const r = v.replace(/var\(--navy(-2|-3)?\)/g, () => {
    change = true
    return 'var(--gold-3)'
  })
  return change ? r : null
}
function varTrait(v) {
  let change = false
  const r = v.replace(/var\(--navy(?:-2|-3|-ink)?\)/g, () => {
    change = true
    return 'var(--gold)'
  })
  return change ? r : null
}

function convertir(decl, selecteur) {
  const p = decl.prop.toLowerCase()
  const v = decl.value
  if (p === 'color' || p === '-webkit-text-fill-color' || p === 'caret-color') {
    const vt = CHROME.test(selecteur) ? null : varTexte(v)
    return remplacer(vt ?? v, texte) ?? vt
  }
  if (p === 'background' || p === 'background-color' || p === 'background-image') return remplacer(varFond(v, selecteur) ?? v, fond) ?? varFond(v, selecteur)
  if (/^(border|outline)(-(top|right|bottom|left))?(-color)?$/.test(p)) return remplacer(varTrait(v) ?? v, trait) ?? varTrait(v)
  return null
}

function prefixer(sel) {
  return sel
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (/^:root\b/.test(s)) return s.replace(/^:root/, PREFIXE)
      if (/^html\b/.test(s)) return s.replace(/^html/, 'html[data-ui="palantir"]')
      return `${PREFIXE} ${s}`
    })
    .join(',\n')
}

const css = postcss.parse(fs.readFileSync(source, 'utf8'))
const sortie = postcss.root()
css.walkRules((regle) => {
  // Pas d'impression, pas d'animations : la feuille imprimée reste blanche
  for (let p = regle.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule' && (/keyframes|font-face/i.test(p.name) || /print/i.test(p.params))) return
  }
  if (PAPIER.test(regle.selector)) return
  const decls = []
  regle.each((d) => {
    if (d.type !== 'decl' || d.prop.startsWith('--')) return
    const v = convertir(d, regle.selector)
    if (v) decls.push(postcss.decl({ prop: d.prop, value: v, important: d.important }))
  })
  if (!decls.length) return
  const r = postcss.rule({ selector: prefixer(regle.selector) })
  decls.forEach((d) => r.append(d))
  // Recopie les @media qui entourent la règle
  let noeud = r
  for (let p = regle.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') {
      const at = postcss.atRule({ name: p.name, params: p.params })
      at.append(noeud)
      noeud = at
    }
  }
  sortie.append(noeud)
})

const entete = `/* FICHIER GÉNÉRÉ par scripts/theme-palantir.mjs à partir de index.css : ne pas modifier à la main. */\n`
fs.writeFileSync(cible, entete + sortie.toString() + '\n')
console.log(`palantir.css : ${sortie.nodes.length} règles`)
