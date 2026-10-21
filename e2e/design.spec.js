// Design SaaS premium (lot 3) : jetons appliqués, aucun défilement horizontal aux 11 largeurs, accessibilité
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { avecExemples, avecPlateforme } from './aides'
import { ESPACES_NAV } from '../src/navigation'

const LARGEURS = [320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920]
const PAGES = ['controle', 'acquisition', 'factures', 'plateforme', 'espace/administration', 'parametres/identite']

test('interface SaaS premium par défaut : menu bleu nuit, fond clair, action principale bleue', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 })
  await avecExemples(page)
  await page.goto('/#/factures')
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'saas')
  const couleurs = await page.evaluate(() => {
    const css = (s, p) => getComputedStyle(document.querySelector(s))[p]
    return { menu: css('.sidebar', 'backgroundColor'), fond: css('body', 'backgroundColor') }
  })
  expect(couleurs).toEqual({ menu: 'rgb(11, 20, 36)', fond: 'rgb(246, 248, 252)' })
  const bouton = page.locator('.main .btn.primary:visible, .main .btn.gold:visible').first()
  await expect(bouton).toHaveCSS('background-color', 'rgb(37, 99, 235)')
  const h = await bouton.evaluate((b) => b.getBoundingClientRect().height)
  expect(Math.round(h)).toBeGreaterThanOrEqual(40)
})

test('les deux autres interfaces restent au choix', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/parametres/identite')
  await page.getByRole('button', { name: /Salle de contrôle/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'palantir')
  await page.getByRole('button', { name: /SaaS premium/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'saas')
})

test('aucun défilement horizontal aux 11 largeurs', async ({ page }) => {
  test.setTimeout(120_000)
  await avecExemples(page)
  const debords = []
  for (const l of LARGEURS) {
    await page.setViewportSize({ width: l, height: 820 })
    for (const p of PAGES) {
      await page.goto(`/#/${p}`)
      await page.locator('.main h1').first().waitFor()
      const trop = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (trop > 0) debords.push(`${l}px #/${p} : +${trop}px`)
    }
  }
  expect(debords).toEqual([])
})

for (const p of PAGES) {
  test(`accessibilité (page entière, menu compris) : #/${p}`, async ({ page }) => {
    // Mouvement réduit : axe mesure les couleurs finales, pas une entrée en fondu
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await avecExemples(page)
    await page.goto(`/#/${p}`)
    await page.locator('.main h1').first().waitFor()
    const axe = await new AxeBuilder({ page }).analyze()
    const graves = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} : ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
    expect(graves).toEqual([])
  })
}

// Chaque page du menu (hors écrans éditeur, testés à part), à la largeur du projet
test('accessibilité et largeur : toutes les pages du menu', async ({ page }) => {
  test.setTimeout(240_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await avecExemples(page)
  const routes = ESPACES_NAV.flatMap((e) => e.entrees.map((x) => x.route)).filter((r) => !r.startsWith('editeur'))
  const constats = []
  for (const r of routes) {
    await page.goto(`/#/${r}`)
    await page.locator('.main h1').first().waitFor()
    const trop = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (trop > 0) constats.push(`#/${r} : défilement horizontal +${trop}px`)
    const axe = await new AxeBuilder({ page }).analyze()
    for (const v of axe.violations.filter((x) => ['serious', 'critical'].includes(x.impact))) constats.push(`#/${r} : ${v.id} (${v.nodes[0].target.join(' ')})`)
  }
  expect(constats).toEqual([])
})

test('accessibilité : écrans éditeur (plateforme fictive)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await avecPlateforme(page, {
    mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin', email: 'admin@exemple.test' } }),
    editeur_catalogue: () => ({ offres: [], modules: [], solutions: [] }),
  })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  await avecExemples(page)
  for (const r of ['editeur/comptes', 'editeur/offres']) {
    await page.goto(`/#/${r}`)
    await page.locator('.saas-admin h1, .main h1').first().waitFor()
    await expect(page.locator('html')).toHaveAttribute('data-ui', 'saas')
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${r} ${v.id} ${v.nodes[0].target.join(' ')}`)).toEqual([])
  }
  expect(erreurs).toEqual([])
})

test('une erreur d’affichage montre « Réessayer » au lieu d’un écran blanc', async ({ page }) => {
  // Réponse incomplète de la plateforme fictive : l'écran éditeur plante, la garde prend le relais
  await avecPlateforme(page, { mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin' } }), editeur_vue: () => ({ offres: [{ id: 'x' }], clients: [] }) })
  await avecExemples(page)
  await page.goto('/#/editeur/offres')
  await expect(page.getByRole('alert').filter({ hasText: 'n’a pas pu s’afficher' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).or(page.getByRole('navigation', { name: 'Navigation principale' }))).toBeVisible()
})
