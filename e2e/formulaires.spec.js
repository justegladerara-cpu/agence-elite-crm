// Règles communes des formulaires (lot 6) : avertir avant de fermer une saisie, ignorer le double clic,
// erreurs en rouge. Plateforme fictive, aucune donnée réelle.
import { test, expect } from '@playwright/test'
import { avecExemples, avecPlateforme } from './aides'

test('fermer une saisie commencée demande confirmation ; « Continuer la saisie » garde le texte', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  const dialog = page.getByRole('dialog', { name: /Prolonger/ })
  await dialog.getByRole('textbox', { name: /Motif/ }).fill('Saisie fictive')
  await page.keyboard.press('Escape')
  const question = page.getByRole('dialog', { name: 'Changements non enregistrés' })
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Continuer la saisie' }).click()
  await expect(question).toBeHidden()
  await expect(dialog.getByRole('textbox', { name: /Motif/ })).toHaveValue('Saisie fictive')
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('dialog', { name: 'Changements non enregistrés' }).getByRole('button', { name: 'Fermer sans enregistrer' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('une fenêtre sans saisie se ferme tout de suite', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  await expect(page.getByRole('dialog', { name: /Prolonger/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('double clic sur « Prolonger » : un seul appel à la plateforme', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  const dialog = page.getByRole('dialog', { name: /Prolonger/ })
  await dialog.getByRole('button', { name: '7 jours' }).click()
  await dialog.getByRole('textbox', { name: /Motif/ }).fill('Geste fictif')
  await dialog.getByRole('button', { name: 'Prolonger' }).dblclick()
  await expect.poll(() => appels.filter((a) => a.nom === 'renouveler_licence').length).toBe(1)
  await page.waitForTimeout(500)
  expect(appels.filter((a) => a.nom === 'renouveler_licence')).toHaveLength(1)
})

test('un champ invalide après saisie est entouré de rouge', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  const champ = page.getByRole('dialog', { name: /Prolonger/ }).getByRole('textbox', { name: /Motif/ })
  const rouge = await page.evaluate(() => {
    const t = document.createElement('span')
    t.style.color = 'var(--red, #c0322e)'
    document.body.append(t)
    const c = getComputedStyle(t).color
    t.remove()
    return c
  })
  expect(await champ.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(rouge)
  await champ.evaluate((el) => el.setAttribute('aria-invalid', 'true'))
  await expect.poll(() => champ.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rouge)
})
