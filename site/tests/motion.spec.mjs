// Parcours du site vitrine : mouvement en amélioration progressive, accessibilité, aucune erreur.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

const PHOTO = readFileSync(new URL('../assets/img/equipe.webp', import.meta.url))
const PAGES = ['/', '/solutions/agence-web/', '/solutions/erp/', '/mentions-legales/', '/contact/', '/agence/', '/secteurs/']

// Ressources tierces rejouées : photos Unsplash (image locale), API du CRM (liste vide) ; le reste est coupé
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => {
    const u = route.request().url()
    if (u.startsWith('https://images.unsplash.com/')) return route.fulfill({ status: 200, contentType: 'image/webp', body: PHOTO })
    if (u.includes('.supabase.co/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    return route.abort()
  })
})

const defilerJusquEnBas = (page) =>
  page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    await new Promise((r) => setTimeout(r, 1800))
  })

test('aucune erreur dans la console sur les pages principales', async ({ page }) => {
  const erreurs = []
  page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text()) && erreurs.push(`${page.url()} : ${m.text()}`))
  page.on('pageerror', (e) => erreurs.push(`${page.url()} : ${e}`))
  for (const p of PAGES) {
    await page.goto(p)
    await defilerJusquEnBas(page)
  }
  expect(erreurs).toEqual([])
})

test('après défilement complet, aucun bloc ne reste invisible', async ({ page }) => {
  for (const p of ['/', '/solutions/erp/', '/agence/']) {
    await page.goto(p)
    await defilerJusquEnBas(page)
    const invisibles = await page.evaluate(() =>
      [...document.querySelectorAll('main *')].filter((e) => e.checkVisibility && !e.closest('[hidden]') && getComputedStyle(e).opacity === '0' && !e.closest('.vt-panneau[hidden]')).map((e) => e.className),
    )
    expect(invisibles, p).toEqual([])
  }
})

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('tout le contenu est visible, les cinq modules de la vitrine aussi', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('h1')).toHaveCSS('opacity', '1')
    await expect(page.locator('.vt-panneau')).toHaveCount(5)
    for (const p of await page.locator('.vt-panneau').all()) await expect(p).toBeVisible()
    await expect(page.locator('.vt-onglets')).toBeHidden()
    await expect(page.locator('.chiffre .compte').first()).toHaveText('9')
    await page.locator('.cta').scrollIntoViewIfNeeded()
    await expect(page.locator('.cta')).toHaveCSS('opacity', '1')
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', /./)
  })
})

test.describe('réduire les animations', () => {
  test('niveau léger, aucune animation en cours, chiffres finaux', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'leger')
    await defilerJusquEnBas(page)
    const enCours = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
    expect(enCours).toBe(0)
    await expect(page.locator('.chiffre .compte').nth(2)).toHaveText('15')
    await expect(page.locator('.apparait')).toHaveCount(0)
    // Les logos ne défilent plus : la copie de la liste est masquée
    await expect(page.locator('.defile-piste[aria-hidden="true"]')).toBeHidden()
  })
})

test('?motion=off désactive le mouvement pour la session', async ({ page }) => {
  await page.goto('/?motion=off')
  await expect(page.locator('html')).not.toHaveAttribute('data-motion', /./)
  await page.goto('/contact/')
  await expect(page.locator('html')).not.toHaveAttribute('data-motion', /./)
  await expect(page.locator('h1')).toHaveCSS('opacity', '1')
})

test('vitrine : onglets au clavier, un seul module affiché', async ({ page }) => {
  await page.goto('/')
  const onglets = page.getByRole('tab')
  await expect(onglets).toHaveCount(5)
  await onglets.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Ventes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Ventes' })).toBeFocused()
  await expect(page.getByRole('tabpanel')).toHaveCount(1)
  await expect(page.getByRole('tabpanel')).toContainText('Dernières ventes')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Établissements' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Stock' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('Niveaux de stock')
  await expect(page.locator('#vt-stock .vt-b-h').first()).toBeVisible()
})

test('défilement des logos : bouton pause', async ({ page }) => {
  await page.goto('/')
  const b = page.locator('.defile-pause')
  await expect(b).toBeVisible()
  await b.click()
  await expect(b).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.defile')).toHaveClass(/en-pause/)
  await expect(b).toContainText('Reprendre')
})

test('menu mobile : focus dans le menu, Échap referme et rend le focus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'menu mobile seulement')
  await page.goto('/solutions/agence-web/')
  await page.locator('#burger').click()
  await expect(page.locator('#burger')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#nav .nav-btn').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#burger')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#burger')).toBeFocused()
})

test('formulaire de contact : erreur puis message prêt', async ({ page, context }) => {
  await page.goto('/contact/')
  await page.getByRole('button', { name: /Envoyer sur WhatsApp/ }).click()
  await expect(page.locator('#form-erreur')).toBeVisible()
  await page.getByLabel('Nom et prénom *').fill('Test')
  await page.getByLabel('Téléphone / WhatsApp *').fill('060000000')
  await page.getByLabel('Votre projet *').fill('Un site')
  const nouvelle = context.waitForEvent('page')
  await page.getByRole('button', { name: /Envoyer sur WhatsApp/ }).click()
  await (await nouvelle).close()
  await expect(page.locator('#form-ok')).toBeVisible()
  await expect(page.locator('#form-ok')).toContainText('WhatsApp')
})

test('accessibilité (axe) des nouveaux blocs', async ({ page }) => {
  await page.goto('/')
  await defilerJusquEnBas(page)
  const r = await new AxeBuilder({ page }).include('.vitrine-section').include('.chiffres-section').include('.confiance').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(r.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

test('décalages de mise en page : CLS ≤ 0,1 au chargement et au défilement', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  for (const p of ['/', '/solutions/agence-web/', '/mentions-legales/']) {
    await page.goto(p)
    await defilerJusquEnBas(page)
    expect(await page.evaluate(() => window.__cls), p).toBeLessThanOrEqual(0.1)
  }
})
