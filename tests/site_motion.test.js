// Site vitrine : le système de mouvement (Elite Motion System) ne doit rien retirer au référencement ni à l'accessibilité.
// Le site est construit dans un dossier temporaire puis comparé à la référence d'avant le mouvement.
// Contenu modifié volontairement (titres, textes, photos) : régénérer la référence avec
//   node site/build.mjs site-dist && node site/scripts/signature-seo.mjs site-dist > tests/fixtures/site-seo-reference.json
import { readFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { signatureSite } from '../site/scripts/signature-seo.mjs'
import { SITE } from '../site/data.mjs'

let sortie
let sig
const lire = (chemin) => readFileSync(join(sortie, chemin), 'utf8')
const reference = JSON.parse(readFileSync(new URL('./fixtures/site-seo-reference.json', import.meta.url), 'utf8'))
// a est-elle une sous-suite de b (mêmes éléments, même ordre, d'autres éléments pouvant s'intercaler) ?
const sousSuite = (a, b) => {
  let i = 0
  for (const x of b) if (x === a[i]) i++
  return i === a.length
}

beforeAll(() => {
  sortie = mkdtempSync(join(tmpdir(), 'site-motion-'))
  execFileSync('node', ['site/build.mjs', sortie], { stdio: 'ignore' })
  sig = signatureSite(sortie)
}, 60000)

describe('référencement préservé', () => {
  test('mêmes pages, titres, descriptions, canoniques, robots et données structurées', () => {
    expect(Object.keys(sig)).toEqual(Object.keys(reference))
    for (const [page, ref] of Object.entries(reference)) {
      const s = sig[page]
      expect({ page, titre: s.titre, description: s.description, canonique: s.canonique, robots: s.robots, ogUrl: s.ogUrl, jsonld: s.jsonld }).toEqual({
        page,
        titre: ref.titre,
        description: ref.description,
        canonique: ref.canonique,
        robots: ref.robots,
        ogUrl: ref.ogUrl,
        jsonld: ref.jsonld,
      })
    }
  })

  test('les titres h1 à h3 d’origine sont tous là, dans le même ordre ; un seul h1 par page', () => {
    for (const [page, ref] of Object.entries(reference)) {
      expect(sousSuite(ref.titres, sig[page].titres), `${page} : titres d'origine manquants ou déplacés`).toBe(true)
      expect(sig[page].titres.filter((t) => t.startsWith('h1 ')).length, page).toBe(ref.titres.filter((t) => t.startsWith('h1 ')).length)
    }
  })

  test('hiérarchie des titres sans saut de niveau sur les pages ajoutées au mouvement', () => {
    for (const page of ['/index.html', '/solutions/erp/index.html']) {
      const niveaux = sig[page].titres.map((t) => Number(t[1]))
      expect(niveaux[0]).toBe(1)
      niveaux.forEach((n, i) => i && expect(n - niveaux[i - 1], `${page} : saut de niveau`).toBeLessThanOrEqual(1))
    }
  })

  test('textes alternatifs et emplacements de photo du CRM conservés', () => {
    for (const [page, ref] of Object.entries(reference)) {
      const alts = [...sig[page].alts]
      for (const a of ref.alts) {
        const k = alts.indexOf(a)
        expect(k, `${page} : alt « ${a} » disparu`).toBeGreaterThanOrEqual(0)
        alts.splice(k, 1)
      }
      expect(sig[page].photos).toEqual(ref.photos)
    }
  })
})

describe('mouvement en amélioration progressive', () => {
  test('aucun contenu masqué dans le HTML : pas de classe d’apparition ni d’opacité nulle en ligne', () => {
    const html = lire('index.html')
    expect(html).not.toMatch(/class="[^"]*\bapparait\b/)
    expect(html).not.toMatch(/style="[^"]*opacity:\s*0/)
    // Les modules de la vitrine sont tous présents et visibles sans JavaScript (aucun attribut hidden)
    const panneaux = [...html.matchAll(/<div class="vt-panneau(?: [^"]*)?"[^>]*>/g)].map((m) => m[0])
    expect(panneaux).toHaveLength(5)
    for (const p of panneaux) expect(p).not.toMatch(/\bhidden\b/)
  })

  test('script de mouvement différé, niveau décidé dans l’en-tête, polices locales', () => {
    const html = lire('index.html')
    expect(html).toMatch(/<script src="assets\/motion\.js\?v=[a-z0-9]+" defer><\/script>/)
    expect(html).toMatch(/prefers-reduced-motion: reduce/)
    expect(html).toMatch(/saveData/)
    expect(html).not.toMatch(/fonts\.googleapis\.com/)
    expect(readFileSync('site/assets/site.css', 'utf8')).toMatch(/src: url\(fonts\/inter-latin\.woff2\)/)
  })

  test('les chiffres affichés existent en texte final (lecteurs d’écran et moteurs de recherche)', () => {
    const html = lire('index.html')
    const comptes = [...html.matchAll(/<span class="sr-only">([^<]+)<\/span><span class="compte" aria-hidden="true" data-compte="(\d+)">([^<]+)<\/span>/g)]
    expect(comptes.length).toBeGreaterThanOrEqual(4)
    for (const [, lu, n, vu] of comptes) {
      expect(vu).toBe(n.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'))
      expect(lu.startsWith(vu)).toBe(true)
    }
  })

  test('vitrine de démonstration : données annoncées comme fictives, onglets ARIA reliés aux modules', () => {
    for (const page of ['index.html', 'solutions/erp/index.html']) {
      const html = lire(page)
      expect(html).toMatch(/données fictives/)
      const onglets = [...html.matchAll(/role="tab" id="(vt-onglet-[a-z]+)" aria-controls="(vt-[a-z]+)"/g)]
      expect(onglets).toHaveLength(5)
      for (const [, id, cible] of onglets) {
        expect(html).toContain(`id="${cible}" aria-labelledby="${id}"`)
      }
    }
  })

  test('CSS : réduction des animations respectée, pas de will-change global', () => {
    const css = readFileSync('site/assets/site.css', 'utf8')
    const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(rm).toMatch(/animation: none !important/)
    expect(rm).toMatch(/transition: none !important/)
    expect(css).not.toMatch(/will-change/)
    expect(readFileSync('site/assets/vitrine.css', 'utf8')).not.toMatch(/will-change/)
    expect(css).toMatch(/--ease-standard:/)
  })

  test('motion.js : pas de boucle permanente, onglet masqué et hors écran gérés', () => {
    const js = readFileSync('site/assets/motion.js', 'utf8')
    expect(js).toMatch(/visibilitychange/)
    expect(js).toMatch(/hors-champ/)
    expect(js).not.toMatch(/setInterval/)
  })

  test('désactivation : SITE.motion = false (ou AE_MOTION=off au build) retire tout le mouvement', () => {
    expect(SITE.motion).not.toBe(false)
    const sansMotion = mkdtempSync(join(tmpdir(), 'site-sans-motion-'))
    execFileSync('node', ['site/build.mjs', sansMotion], { stdio: 'ignore', env: { ...process.env, AE_MOTION: 'off' } })
    const html = readFileSync(join(sansMotion, 'index.html'), 'utf8')
    expect(html).not.toMatch(/motion\.js/)
    expect(html).not.toMatch(/data-motion/)
    expect(html).toMatch(/<h1>/)
  }, 60000)
})
