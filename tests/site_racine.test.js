import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { onRequest } from '../functions/_middleware.js'
import { EMPLACEMENTS_PHOTOS } from '../site/data.mjs'

// Faux env.ASSETS qui imite Pages : jolies adresses (redirection vers « / » final), mode application (index du CRM
// pour toute adresse inconnue), 404.html servi à /site/404.
const FICHIERS = {
  '/': ['crm', '"etag-crm"'],
  '/site/': ['accueil du site', '"etag-site"'],
  '/site/contact/': ['contact', '"etag-contact"'],
  '/site/404': ['page introuvable du site', '"etag-404"'],
  '/site/robots.txt': ['User-agent: *', '"etag-robots"', 'text/plain'],
  '/site/sitemap.xml': ['<urlset/>', '"etag-sitemap"', 'application/xml'],
}
const ASSETS = {
  appels: [],
  async fetch(req) {
    const u = new URL(req.url)
    this.appels.push(u.pathname + u.search)
    if (FICHIERS[u.pathname + '/']) return new Response(null, { status: 308, headers: { Location: u.pathname + '/' } })
    const [corps, etag, type = 'text/html; charset=utf-8'] = FICHIERS[u.pathname] || FICHIERS['/']
    return new Response(corps, { status: 200, headers: { 'Content-Type': type, ETag: etag } })
  },
}
const appel = (adresse) => onRequest({ request: new Request(adresse), env: { ASSETS }, next: async () => new Response('suite du CRM') })

describe('site servi à la racine de www.agence-elite.fr', () => {
  test('le CRM et les autres hôtes ne changent pas', async () => {
    expect(await (await appel('https://crm.agence-elite.fr/site/contact/')).text()).toBe('suite du CRM')
    expect(await (await appel('https://agence-elite-crm.pages.dev/')).text()).toBe('suite du CRM')
  })

  test('agence-elite.fr redirige vers www en gardant le chemin', async () => {
    const r = await appel('https://agence-elite.fr/contact/?a=1')
    expect(r.status).toBe(301)
    expect(r.headers.get('Location')).toBe('https://www.agence-elite.fr/contact/?a=1')
  })

  test('une ancienne adresse en /site/ redirige sans /site', async () => {
    const r = await appel('https://www.agence-elite.fr/site/contact/')
    expect(r.status).toBe(301)
    expect(r.headers.get('Location')).toBe('https://www.agence-elite.fr/contact/')
    expect((await appel('https://www.agence-elite.fr/site')).headers.get('Location')).toBe('https://www.agence-elite.fr/')
  })

  test('les pages, robots.txt et sitemap.xml viennent de /site/', async () => {
    expect(await (await appel('https://www.agence-elite.fr/')).text()).toBe('accueil du site')
    expect(await (await appel('https://www.agence-elite.fr/contact/')).text()).toBe('contact')
    const robots = await appel('https://www.agence-elite.fr/robots.txt')
    expect(robots.status).toBe(200)
    expect(await robots.text()).toBe('User-agent: *')
    expect(await (await appel('https://www.agence-elite.fr/sitemap.xml')).text()).toBe('<urlset/>')
  })

  test('jolie adresse : la redirection de Pages perd /site', async () => {
    const r = await appel('https://www.agence-elite.fr/contact')
    expect(r.status).toBe(308)
    expect(r.headers.get('Location')).toBe('/contact/')
  })

  test('adresse inconnue : page 404 du site, pas le CRM', async () => {
    const r = await appel('https://www.agence-elite.fr/nexiste-pas/')
    expect(r.status).toBe(404)
    expect(await r.text()).toBe('page introuvable du site')
  })
})

describe('emplacements de photo du site construit', () => {
  const pages = (dossier) => readdirSync(dossier).flatMap((f) => {
    const chemin = join(dossier, f)
    return statSync(chemin).isDirectory() ? pages(chemin) : f.endsWith('.html') ? [chemin] : []
  })
  test('chaque data-photo est un emplacement connu, et chaque emplacement apparaît sur le site', async () => {
    const { execFileSync } = await import('node:child_process')
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const sortie = mkdtempSync(join(tmpdir(), 'site-'))
    execFileSync('node', ['site/build.mjs', sortie], { stdio: 'ignore' })
    const vues = new Set(pages(sortie).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/data-photo="([^"]+)"/g)].map((m) => m[1])))
    const cles = EMPLACEMENTS_PHOTOS.map((e) => e.cle)
    expect(new Set(cles).size).toBe(cles.length)
    expect([...vues].filter((c) => !cles.includes(c))).toEqual([])
    expect(cles.filter((c) => !vues.has(c))).toEqual([])
    for (const c of cles) expect(c).toMatch(/^[a-z0-9-]{1,60}$/)
  }, 60000)
})
