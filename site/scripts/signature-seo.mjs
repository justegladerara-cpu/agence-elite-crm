// Signature de référencement du site construit : ce qui ne doit pas changer quand on retouche l'apparence ou le mouvement
// (titres, descriptions, canoniques, robots, données structurées, titres h1-h3 dans l'ordre, textes alternatifs, data-photo).
// Usage : node site/scripts/signature-seo.mjs site-dist > tests/fixtures/site-seo-reference.json
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
const attr = (html, re) => {
  const m = html.match(re)
  return m ? m[1] : null
}

export function signaturePage(html) {
  return {
    titre: decode(attr(html, /<title>([\s\S]*?)<\/title>/) || ''),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    canonique: attr(html, /<link rel="canonical" href="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/),
    jsonld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
    titres: [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => `h${m[1]} ${decode(m[2])}`),
    alts: [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((m) => m[1]).sort(),
    photos: [...html.matchAll(/data-photo="([^"]+)"/g)].map((m) => m[1]).sort(),
  }
}

export function signatureSite(dossier) {
  const pages = {}
  const parcourir = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (f.endsWith('.html')) pages['/' + relative(dossier, p).replace(/\\/g, '/')] = signaturePage(readFileSync(p, 'utf8'))
    }
  }
  parcourir(dossier)
  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)))
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  process.stdout.write(JSON.stringify(signatureSite(process.argv[2] || 'site-dist'), null, 1) + '\n')
}
