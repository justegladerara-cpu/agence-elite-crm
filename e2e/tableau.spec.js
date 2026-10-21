// Tableau de bord unique (lot 4) : 4 indicateurs, 5 états par bloc, filtres visibles, vraie devise. Données fictives.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { avecExemples, avecPlateforme, FICTIF } from './aides'

const indicateur = (page, nom) => page.locator('.indicateurs .indicateur').filter({ hasText: nom })
const bloc = (page, nom) => page.getByRole('region', { name: nom })

test('données : les 4 indicateurs, les filtres actifs et les montants dans leur devise', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(indicateur(page, 'Clients logiciel actifs')).toContainText('2')
  await expect(indicateur(page, 'Licences à renouveler (7 j)')).toContainText('+ 1 déjà échue')
  await expect(indicateur(page, 'Relances en retard')).toHaveAttribute('data-etat', 'donnees')
  // Devise du CRM en mode démo : l'euro ; devise des licences : le franc CFA (jamais mélangées)
  await expect(indicateur(page, 'Encaissé ce mois')).toContainText('€')
  await expect(page.locator('.indicateur').filter({ hasText: 'Abonnements par mois' })).toContainText('FCFA')
  const filtres = page.getByRole('group', { name: 'Filtres actifs' })
  await expect(filtres).toContainText('Clients : réels seulement')
  await filtres.getByRole('checkbox', { name: 'Inclure démo et archives' }).check()
  await expect(filtres).toContainText('Clients : tous')
  await filtres.getByRole('button', { name: 'Réinitialiser' }).click()
  await expect(filtres).toContainText('Clients : réels seulement')
  await expect(bloc(page, 'À faire aujourd’hui')).toHaveAttribute('data-etat', 'donnees')
})

test('accès refusé : sans connexion plateforme, les chiffres du CRM restent visibles', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(indicateur(page, 'Clients logiciel actifs')).toHaveAttribute('data-etat', 'refuse')
  await expect(indicateur(page, 'Encaissé ce mois')).toHaveAttribute('data-etat', 'donnees')
  await expect(indicateur(page, 'Relances en retard')).toHaveAttribute('data-etat', 'donnees')
  const afaire = bloc(page, 'À faire aujourd’hui')
  await expect(afaire).toHaveAttribute('data-etat', 'refuse')
  await afaire.getByRole('button', { name: 'Se connecter à la plateforme' }).click()
  await expect(page.getByRole('dialog', { name: 'Connexion à la plateforme' })).toBeVisible()
})

test('accès refusé par la plateforme (rôle insuffisant)', async ({ page }) => {
  await avecPlateforme(page, { editeur_vue: () => 'refus' })
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(bloc(page, 'Santé des clients')).toHaveAttribute('data-etat', 'refuse')
  await expect(bloc(page, 'Santé des clients')).toContainText('pas super admin')
  await expect(bloc(page, 'Santé des clients').getByRole('button', { name: 'Se connecter à la plateforme' })).toHaveCount(0)
})

test('erreur : message et « Réessayer » qui recharge', async ({ page }) => {
  let echec = true
  await avecPlateforme(page, { editeur_vue: () => (echec ? 'erreur' : undefined) })
  await avecExemples(page)
  await page.goto('/#/controle')
  const afaire = bloc(page, 'À faire aujourd’hui')
  await expect(afaire).toHaveAttribute('data-etat', 'erreur')
  await expect(afaire.getByRole('alert')).toContainText('Impossible de charger')
  echec = false
  await afaire.getByRole('button', { name: 'Réessayer' }).click()
  await expect(afaire).toHaveAttribute('data-etat', 'donnees')
  await expect(indicateur(page, 'Clients logiciel actifs')).toContainText('2')
})

test('vide : aucun client, chaque bloc le dit', async ({ page }) => {
  await avecPlateforme(page, { editeur_vue: () => ({ ...FICTIF.editeur_vue, clients: [] }) })
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(bloc(page, 'Santé des clients')).toHaveAttribute('data-etat', 'vide')
  await expect(bloc(page, 'Santé des clients')).toContainText('Aucun client à suivre')
  await expect(indicateur(page, 'Clients logiciel actifs')).toHaveAttribute('data-etat', 'vide')
})

test('chargement : les blocs plateforme attendent, ceux du CRM s’affichent', async ({ page }) => {
  let liberer
  const attente = new Promise((r) => (liberer = r))
  await avecPlateforme(page, { editeur_vue: async () => (await attente, undefined) })
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(bloc(page, 'En direct')).toHaveAttribute('data-etat', 'chargement')
  await expect(bloc(page, 'En direct').locator('[aria-busy="true"]')).toBeVisible()
  await expect(indicateur(page, 'Encaissé ce mois')).toHaveAttribute('data-etat', 'donnees')
  liberer()
  await expect(bloc(page, 'En direct')).not.toHaveAttribute('data-etat', 'chargement')
})

test('module désactivé : le bloc dit pourquoi au lieu d’afficher 0', async ({ page }) => {
  await avecExemples(page)
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('agence-elite-crm'))
    d.settings = { ...(d.settings || {}), modules: { ...(d.settings?.modules || {}), facturation: false } }
    localStorage.setItem('agence-elite-crm', JSON.stringify(d))
  })
  await page.goto('/#/controle')
  await page.reload()
  await expect(indicateur(page, 'Encaissé ce mois')).toHaveAttribute('data-etat', 'refuse')
  await expect(indicateur(page, 'Encaissé ce mois')).toContainText('désactivé')
})

test('accessibilité et largeur avec les données (320 px et ordinateur)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await avecPlateforme(page)
  await avecExemples(page)
  for (const largeur of [320, 1440]) {
    await page.setViewportSize({ width: largeur, height: 900 })
    await page.goto('/#/controle')
    await expect(bloc(page, 'Santé des clients')).toHaveAttribute('data-etat', 'donnees')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${largeur} ${v.id} ${v.nodes[0].target.join(' ')}`)).toEqual([])
  }
})
