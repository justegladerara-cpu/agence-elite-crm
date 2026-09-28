// Parcours essentiels du CRM (mode démo : données dans le navigateur)
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function avecExemples(page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ajoute tes premiers prospects' })).toBeVisible()
  await page.getByRole('button', { name: 'Charger des exemples' }).click()
  await expect(page.getByText('Exemples chargés')).toBeVisible()
}

test('l’application s’ouvre sur Ma journée avec les relances en haut', async ({ page }) => {
  await avecExemples(page)
  await expect(page).toHaveURL(/\/$|#\/?$|journee/)
  const relances = page.getByRole('heading', { name: /Aujourd'hui et en retard/ })
  const objectifs = page.locator('#objectifs-jour')
  await expect(relances).toBeVisible()
  const [y1, y2] = [(await relances.boundingBox()).y, (await objectifs.boundingBox()).y]
  expect(y1).toBeLessThan(y2)
})

test('noter une action en saisie rapide puis l’annuler', async ({ page }) => {
  await avecExemples(page)
  await page.getByRole('button', { name: /^Noter une action pour/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Noter une action' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Pas de réponse' }).click()
  await dialog.getByRole('button', { name: /^Demain/ }).click()
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(dialog).toBeHidden()
  const toast = page.getByRole('status').filter({ hasText: 'noté pour' })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'Annuler' }).click()
  await expect(toast).toBeHidden()
})

test('feuille après appel : une touche note le résultat', async ({ page }) => {
  await avecExemples(page)
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).prospects[0].id)
  await page.evaluate((x) => {
    sessionStorage.setItem('aecrm-appel-en-cours', JSON.stringify({ id: x, t: Date.now() - 10000 }))
    window.dispatchEvent(new Event('focus'))
  }, pid)
  const dialog = page.getByRole('dialog', { name: "Comment s'est passé l'appel ?" })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('1')
  await expect(page.getByRole('status').filter({ hasText: 'Pas de réponse noté' })).toBeVisible()
})

test('supprimer une fiche, annuler, puis la restaurer depuis la corbeille', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/acquisition')
  await page.locator('.hub-row').first().click()
  const titre = (await page.locator('.split-main h1').first().textContent()).trim()
  await page.getByRole('button', { name: 'Plus', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  const toast = page.getByRole('status').filter({ hasText: 'supprimé' })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'restauré' })).toBeVisible()
  // Deuxième suppression, restaurée depuis Paramètres › Sécurité
  await page.goto('/#/acquisition')
  await page.locator('.hub-row', { hasText: titre }).first().click()
  await page.getByRole('button', { name: 'Plus', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await page.goto('/#/parametres/securite')
  await page.locator('.list-item', { hasText: titre }).getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'restauré' })).toBeVisible()
  await page.goto('/#/acquisition')
  await expect(page.locator('.hub-row', { hasText: titre }).first()).toBeVisible()
})

test('raccourcis clavier et tableau de bord sur 7 jours', async ({ page, isMobile }) => {
  test.skip(isMobile, 'raccourcis clavier : ordinateur seulement')
  await avecExemples(page)
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('g')
  await page.keyboard.press('d')
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(page.locator('#dash-periode')).toHaveValue('7 derniers jours')
})

test('accessibilité : aucune violation grave sur les écrans principaux', async ({ page }) => {
  await avecExemples(page)
  for (const route of ['journee', 'acquisition', 'clients', 'factures', 'dashboard', 'parametres/listes', 'parametres/securite', 'saisie']) {
    await page.goto(`/#/${route}`)
    await page.waitForTimeout(400)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const graves = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(graves.map((v) => `${route} : ${v.id} (${v.nodes.length})`)).toEqual([])
  }
})

test('pas de défilement horizontal', async ({ page }) => {
  await avecExemples(page)
  for (const route of ['journee', 'acquisition', 'clients', 'factures', 'dashboard', 'parametres']) {
    await page.goto(`/#/${route}`)
    await page.waitForTimeout(300)
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(deborde, route).toBeLessThanOrEqual(1)
  }
})
