// Navigation en 6 espaces (lot 2) : une seule liste pour le menu, la recherche, la barre du bas et les titres
import { test, expect } from '@playwright/test'
import { avecExemples, avecPlateforme } from './aides'

const ESPACES = ['Vue d’ensemble', 'Clients logiciel', 'Commercial', 'Finances', 'Analyses', 'Administration']

test('le menu de gauche montre les 6 espaces ; la page ouverte est allumée dans son espace', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 })
  await avecExemples(page)
  await page.goto('/#/factures?filtre=impayees')
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  for (const nom of ESPACES) await expect(menu.getByRole('button', { name: new RegExp(`^${nom}`) })).toBeVisible()
  await expect(menu.getByRole('button', { name: /^Finances/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.locator('[aria-current="page"]')).toHaveText(/Factures/)
})

test('téléphone : la barre du bas mène aux espaces, et « Espaces » les montre tous', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await avecExemples(page)
  const bas = page.getByRole('navigation', { name: 'Navigation principale' })
  await bas.getByRole('button', { name: 'Finances' }).click()
  await expect(page).toHaveURL(/#\/factures$/)
  await expect(page.locator('.mobile-top .brand-sub')).toHaveText('Finances · Factures')
  await bas.getByRole('button', { name: 'Espaces' }).click()
  const lanceur = page.locator('.lanceur')
  for (const nom of ESPACES) await expect(lanceur.getByRole('button', { name: new RegExp(nom) })).toBeVisible()
  await lanceur.getByRole('button', { name: /Administration/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sécurité et sauvegardes/ })).toBeVisible()
})

test('anciennes adresses : boîte à outils et applications mènent aux espaces', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/plateforme-outils')
  await expect(page).toHaveURL(/#\/espace\/administration$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
  await page.goto('/#/apps')
  await expect(page).toHaveURL(/#\/espace$/)
  await page.goto('/#/parametres')
  await expect(page).toHaveURL(/#\/parametres\/identite$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Identité' })).toBeVisible()
})

test('recherche Ctrl K : la Tour de contrôle et les pages autrefois orphelines sont proposées', async ({ page }) => {
  await avecExemples(page)
  const ouvrir = async (texte) => {
    await page.keyboard.press('Control+k')
    const champ = page.locator('.search-in input')
    await champ.fill(texte)
    return champ
  }
  await ouvrir('tour de')
  await expect(page.getByRole('option', { name: /Tour de contrôle/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await ouvrir('session')
  await expect(page.getByRole('option', { name: /Session d’appels/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await ouvrir('nouvelle action (page')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/saisie$/)
})

test('écrans éditeur : rangés dans les espaces, plus de barre d’onglets à part', async ({ page }) => {
  await avecPlateforme(page, { mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin' } }), editeur_comptes: () => [] })
  await avecExemples(page)
  await page.setViewportSize({ width: 1366, height: 860 })
  await page.goto('/#/editeur/comptes')
  await expect(page.getByRole('heading', { name: 'Comptes' }).first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Administration de la plateforme' })).toHaveCount(0)
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu.getByRole('button', { name: 'Comptes et accès' })).toHaveAttribute('aria-current', 'page')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Menu Clients logiciel' }).getByRole('button', { name: 'Comptes et accès' })).toHaveAttribute('aria-current', 'page')
})
