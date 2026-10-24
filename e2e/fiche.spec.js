// Fiche client unique (lot 5) : onglets, gestes séparés et tracés, comptes chargés à la demande, un seul chemin
// pour le mot de passe, création guidée, écran de réconciliation. Plateforme fictive, aucune donnée réelle.
import { test, expect } from '@playwright/test'
import { avecExemples, avecPlateforme, FICTIF } from './aides'

const ONGLETS = ['Résumé', 'Établissements', 'Licences et paiements', 'Modules', 'Comptes', 'Assistance', 'Réglages avancés']
const onglet = (page, nom) => page.getByRole('tab', { name: new RegExp(`^${nom}`) })

test('sept onglets ; l’onglet choisi est dans l’adresse', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1')
  for (const o of ONGLETS) await expect(onglet(page, o)).toBeVisible()
  await expect(onglet(page, 'Résumé')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Histoire du client' })).toBeVisible()
  await onglet(page, 'Licences et paiements').click()
  await expect(page).toHaveURL(/onglet=licences/)
  await page.reload()
  await expect(onglet(page, 'Licences et paiements')).toHaveAttribute('aria-selected', 'true')
})

test('gestes en tuiles : « Générer une licence » en premier, le reste dans « Plus »', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1')
  const tuiles = page.getByRole('group', { name: 'Actions sur le client' })
  await expect(tuiles.locator('.pf-tuile')).toHaveCount(5)
  await expect(tuiles.locator('.pf-tuile.principal')).toHaveCount(1)
  await expect(tuiles.locator('.pf-tuile').first()).toContainText('Générer une licence')
  await expect(tuiles.getByRole('button', { name: 'Plus', exact: true })).toBeVisible()
})

test('générer une licence : formule annuelle par défaut, code affiché, facture préremplie', async ({ page }) => {
  const modeles = [
    { id: 'm-mens', nom: 'Mensuel', formule: 'mensuel', montant: 25000, devise: 'XAF', solution_id: 'commerce', actif: true, ordre: 1 },
    { id: 'm-an', nom: 'Annuel', formule: 'annuel', montant: 150000, devise: 'XAF', solution_id: 'commerce', actif: true, ordre: 2 },
  ]
  const appels = await avecPlateforme(page, {
    partenaires_editeur: () => ({ modeles, cles: [{ id: 'k0', cle: 'ELITE-COM-OLD1-OLD2', client_nom: 'Bar Fictif', modele: 'Essai', statut: 'activee', activee_le: '2026-10-10' }] }),
    generer_cles_licence: () => ['ELITE-COM-AB12-CD34'],
  })
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1')
  await page.getByRole('button', { name: /Générer une licence/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio', { name: /Annuel/ })).toHaveAttribute('aria-checked', 'true')
  await expect(dialog).toContainText('ELITE-COM-OLD1-OLD2')
  await dialog.getByRole('button', { name: 'Générer le code' }).click()
  await expect(page.locator('.pf-code')).toHaveText('ELITE-COM-AB12-CD34')
  const appel = appels.find((a) => a.nom === 'generer_cles_licence')
  expect(appel.corps).toMatchObject({ p_modele_id: 'm-an', p_nombre: 1, p_client_nom: 'Bar Fictif' })
  await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /wa\.me\/242000000000/)
  await page.getByRole('button', { name: /Créer la facture/ }).click()
  await expect(page).toHaveURL(/facture\/new/)
  const valeurs = () => page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((i) => i.value))
  await expect.poll(valeurs).toContain('Licence Annuel (1 an)')
  expect(await valeurs()).toContain('Code d’activation ELITE-COM-AB12-CD34')
  expect((await valeurs()).some((v) => v.replace(/\D/g, '') === '150000')).toBe(true)
})

test('l’ancienne page client de l’éditeur mène à la fiche unique', async ({ page }) => {
  await avecPlateforme(page, { mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin' } }) })
  await avecExemples(page)
  await page.goto('/#/editeur/clients/c1')
  await expect(page).toHaveURL(/#\/plateforme-client\/c1\?onglet=avance$/)
  await expect(onglet(page, 'Réglages avancés')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Zone danger' })).toBeVisible()
})

test('comptes : lus seulement à l’ouverture de l’onglet ; mot de passe avec « Copier »', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1')
  await expect(page.getByRole('heading', { name: 'Histoire du client' })).toBeVisible()
  expect(appels.filter((a) => a.nom === 'editeur_comptes')).toHaveLength(0)
  await onglet(page, 'Comptes').click()
  const bloc = page.getByRole('region', { name: /Comptes/ })
  await expect(bloc).toContainText('Gérant Fictif')
  expect(appels.filter((a) => a.nom === 'editeur_comptes')).toHaveLength(1)
  // Retour à la fiche plus tard : pas de nouveau chargement (gardé 2 minutes)
  await onglet(page, 'Résumé').click()
  await onglet(page, 'Comptes').click()
  expect(appels.filter((a) => a.nom === 'editeur_comptes')).toHaveLength(1)
  await bloc.getByRole('button', { name: 'Mot de passe' }).click()
  const dialog = page.getByRole('dialog', { name: /Mot de passe/ })
  await dialog.getByRole('button', { name: 'Réinitialiser' }).click()
  await expect(dialog.getByRole('button', { name: 'Copier', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Copier le message' })).toBeVisible()
  await expect.poll(() => appels.find((a) => a.nom === 'reinitialiser_mot_de_passe_temporaire')?.corps).toMatchObject({ p_user_id: 'u1', p_expire_jours: 7 })
})

test('mot de passe demandé depuis un autre écran : un seul chemin, la fiche › Comptes', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1?onglet=comptes&mdp=u1')
  await expect(page.getByRole('dialog', { name: /Mot de passe · Gérant Fictif/ })).toBeVisible()
})

test('renouveler sans encaissement : motif, récapitulatif, aucun paiement, geste au journal', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  const paiementsAvant = await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).actions.filter((a) => a.action === 'Paiement reçu').length)
  await page.goto('/#/plateforme-client/c2?onglet=licences')
  await page.getByRole('button', { name: 'Renouveler sans encaissement' }).click()
  const dialog = page.getByRole('dialog', { name: /Renouveler sans encaissement/ })
  await expect(dialog.getByRole('textbox', { name: 'Nouvelle échéance' })).toHaveValue('2028-05-01')
  await dialog.getByRole('button', { name: 'Vérifier' }).click()
  await expect(dialog.getByText('Récapitulatif')).toHaveCount(0)
  await dialog.getByRole('textbox', { name: /Motif/ }).fill('Avoir fictif')
  await dialog.getByRole('button', { name: 'Vérifier' }).click()
  await expect(dialog.getByText('Aucun (rien n’est noté dans le CRM)')).toBeVisible()
  await dialog.getByRole('button', { name: 'Renouveler sans encaissement' }).click()
  await expect.poll(() => appels.find((a) => a.nom === 'renouveler_licence')?.corps).toMatchObject({ p_licence_id: 'l2', p_montant: 0, p_nouvelle_echeance: '2028-05-01', p_note: 'Renouvellement sans encaissement : Avoir fictif' })
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).actions.filter((a) => a.action === 'Paiement reçu').length)).toBe(paiementsAvant)
  await expect(page.getByRole('heading', { name: 'Journal des gestes' })).toBeVisible()
  await expect(page.locator('.pf-liste').filter({ hasText: 'Renouvellement sans encaissement' })).toContainText('Avoir fictif')
})

test('licences : « Encaisser et renouveler » ouvre l’encaissement sur le bon établissement', async ({ page }) => {
  await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1?onglet=licences')
  await page.getByRole('button', { name: 'Encaisser et renouveler' }).click()
  const dialog = page.getByRole('dialog', { name: /Encaisser/ })
  await expect(dialog.getByRole('textbox', { name: 'Montant reçu (FCFA)' })).toHaveValue('25000')
})

test('création guidée : « Nouveau client », puis la fiche montre l’étape suivante', async ({ page }) => {
  const vue = { ...FICTIF.editeur_vue, clients: [...FICTIF.editeur_vue.clients, { id: 'c3', nom: 'Nouveau Client Fictif', statut: 'actif', etablissements: [] }] }
  await avecPlateforme(page, { editeur_vue: () => vue, mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin' } }) })
  await avecExemples(page)
  await page.goto('/#/plateforme')
  await page.locator('.pf-tete').getByRole('button', { name: 'Nouveau client' }).click()
  await expect(page).toHaveURL(/editeur\/clients\?nouveau=1/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.goto('/#/plateforme-client/c3')
  const guide = page.getByRole('region', { name: 'Mise en route' })
  await expect(guide).toContainText('Client créé')
  await guide.getByRole('button', { name: /Étape suivante : premier établissement/ }).click()
  await expect(onglet(page, 'Réglages avancés')).toHaveAttribute('aria-selected', 'true')
})

test('écran de réconciliation : journal filtrable, gestes et encaissements', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  const dialog = page.getByRole('dialog', { name: /Prolonger/ })
  await dialog.getByRole('button', { name: '7 jours' }).click()
  await dialog.getByRole('textbox', { name: /Motif/ }).fill('Geste fictif')
  await dialog.getByRole('button', { name: 'Prolonger' }).click()
  await expect.poll(() => appels.some((a) => a.nom === 'renouveler_licence')).toBe(true)
  await page.goto('/#/operations')
  await expect(page.getByRole('heading', { level: 1, name: 'Opérations et réconciliation' })).toBeVisible()
  const journal = page.getByRole('region', { name: /^Journal \(/ })
  await expect(journal).toContainText('Prolongation commerciale gratuite')
  await expect(journal).toContainText('motif : Geste fictif')
  await page.getByRole('tab', { name: /^Encaissements/ }).click()
  await expect(journal).toHaveAttribute('data-etat', 'vide')
  await page.getByRole('tab', { name: /^Tout/ }).click()
  await page.getByRole('textbox', { name: 'Chercher une opération' }).fill('hôtel')
  await expect(journal).toContainText('Hôtel Fictif')
})
