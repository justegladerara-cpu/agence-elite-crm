// Parcours de sécurité du lot 1 (registre docs/superadmin-v2/07_SECURITY_REGISTER.md), sur données fictives
import { test, expect } from '@playwright/test'
import { avecExemples, avecPlateforme } from './aides'

// Historique fictif des licences : ce que la plateforme a vraiment enregistré
function plateformeAvecHistorique() {
  const historique = []
  const etab = () => ({
    etablissement: { id: 'e1', nom: 'Bar Fictif', statut: 'actif' },
    client: { id: 'c1', nom: 'Bar Fictif', statut: 'actif' },
    historique_licences: historique,
    modules: [
      { id: 'stock', nom: 'Stock', nature: 'module', actif: true, couvert: true, depend_de: [] },
      { id: 'cuisine', nom: 'Cuisine', nature: 'module', actif: false, couvert: false, depend_de: [] },
    ],
  })
  return { historique, etab }
}
const paiementsCrm = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).actions.filter((a) => a.action === 'Paiement reçu' && String(a.notes || '').includes('OP-')).length)

async function ouvrirEncaisser(page) {
  await page.goto('/#/plateforme-client/c1?faire=encaisser')
  const dialog = page.getByRole('dialog', { name: /Encaisser/ })
  await expect(dialog).toBeVisible()
  return dialog
}

test('SEC-03 · réponse perdue après le renouvellement : à réconcilier, reprise sans doublon', async ({ page }) => {
  const { historique, etab } = plateformeAvecHistorique()
  let coupe = true
  const appels = await avecPlateforme(page, {
    editeur_etablissement: () => etab(),
    renouveler_licence: (corps) => {
      historique.push({ type: 'renouvellement', reference: corps.p_reference, nouvelle_echeance: '2026-11-21', montant: corps.p_montant })
      if (coupe) {
        coupe = false
        return 'coupe'
      }
      return '2026-11-21'
    },
  })
  await avecExemples(page)
  const dialog = await ouvrirEncaisser(page)
  await dialog.getByRole('button', { name: 'Vérifier' }).click()
  await expect(dialog.getByText('Échéance')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmer l’encaissement' }).click()
  await expect(dialog.getByRole('alert')).toContainText('à réconcilier')
  await page.keyboard.press('Escape')
  const carte = page.getByRole('region', { name: /Opérations à réconcilier/ })
  await expect(carte).toBeVisible()
  await carte.getByRole('button', { name: 'Reprendre' }).click()
  await expect(carte).toBeHidden()
  expect(appels.filter((a) => a.nom === 'renouveler_licence')).toHaveLength(1)
  expect(historique).toHaveLength(1)
  expect(await paiementsCrm(page)).toBe(1)
})

test('SEC-03 · double clic sur « Confirmer » : un seul renouvellement, un seul paiement', async ({ page }) => {
  const { historique, etab } = plateformeAvecHistorique()
  const appels = await avecPlateforme(page, {
    editeur_etablissement: () => etab(),
    renouveler_licence: async (corps) => {
      await new Promise((r) => setTimeout(r, 300))
      historique.push({ reference: corps.p_reference, nouvelle_echeance: '2026-11-21' })
      return '2026-11-21'
    },
  })
  await avecExemples(page)
  const dialog = await ouvrirEncaisser(page)
  await dialog.getByRole('button', { name: 'Vérifier' }).click()
  const ok = dialog.getByRole('button', { name: 'Confirmer l’encaissement' })
  await ok.dblclick()
  await expect(page.getByText(/Paiement encaissé, licence prolongée/)).toBeVisible()
  expect(appels.filter((a) => a.nom === 'renouveler_licence')).toHaveLength(1)
  expect(await paiementsCrm(page)).toBe(1)
})

test('SEC-09 · prolonger : motif obligatoire, jamais avant l’échéance actuelle', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c2?faire=prolonger')
  const dialog = page.getByRole('dialog', { name: /Prolonger/ })
  await expect(dialog).toBeVisible()
  const date = dialog.getByRole('textbox', { name: 'Nouvelle échéance' })
  await expect(date).toHaveAttribute('min', '2027-05-02')
  await date.fill('2027-04-01')
  await expect(dialog.getByRole('alert')).toContainText('après l’échéance actuelle')
  await dialog.getByRole('button', { name: 'Prolonger' }).click()
  expect(appels.some((a) => a.nom === 'renouveler_licence')).toBe(false)
  await dialog.getByRole('button', { name: '7 jours' }).click()
  await dialog.getByRole('textbox', { name: /Motif/ }).fill('Geste commercial fictif')
  await dialog.getByRole('button', { name: 'Prolonger' }).click()
  await expect.poll(() => appels.find((a) => a.nom === 'renouveler_licence')?.corps).toMatchObject({ p_licence_id: 'l2', p_montant: 0, p_nouvelle_echeance: '2027-05-08', p_note: 'Sans paiement : Geste commercial fictif' })
})

test('SEC-05 · retirer un module demande une confirmation avec motif ; Échap ne ferme que la fenêtre du dessus', async ({ page }) => {
  const { etab } = plateformeAvecHistorique()
  const appels = await avecPlateforme(page, { editeur_etablissement: () => etab() })
  await avecExemples(page)
  await page.goto('/#/plateforme-client/c1')
  await page.getByRole('button', { name: 'Plus', exact: true }).click()
  await page.getByRole('dialog', { name: /Plus/ }).getByRole('button', { name: 'Modules' }).click()
  const modules = page.getByRole('dialog', { name: /Modules/ })
  await expect(modules).toBeVisible()
  await modules.getByRole('checkbox', { name: /Stock/ }).click()
  const confirmation = page.getByRole('dialog', { name: 'Retirer Stock ?' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole('button', { name: 'Retirer' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(modules).toBeVisible()
  expect(appels.some((a) => a.nom === 'definir_module_etablissement')).toBe(false)
  await modules.getByRole('checkbox', { name: /Stock/ }).click()
  await confirmation.getByRole('textbox', { name: /Motif/ }).fill('Fin de contrat fictive')
  await confirmation.getByRole('button', { name: 'Retirer' }).click()
  await expect.poll(() => appels.find((a) => a.nom === 'definir_module_etablissement')?.corps).toEqual({ p_etablissement_id: 'e1', p_module_id: 'stock', p_actif: false })
})

test('SEC-04 · l’écran éditeur ne saisit plus de montant au renouvellement', async ({ page }) => {
  const { etab } = plateformeAvecHistorique()
  await avecPlateforme(page, {
    editeur_etablissement: () => ({ ...etab(), licence: { id: 'l1', offre: 'Standard', offre_id: 'standard', formule: 'mensuel', statut: 'active', valide: true, echeance: '2026-10-16', debut: '2026-09-16', montant: 25000, devise: 'XAF', modules: ['stock'], support: false }, ecriture: true, sessions_support: [], hubs: [], equipe: { membres: [], invitations: [] }, mise_en_service: { faites: 0, total: 5, etapes: [] }, modules_complementaires: { modules: [], historique: [] } }),
    editeur_catalogue: () => ({ offres: [], modules: [], solutions: [] }),
    mon_contexte: () => ({ editeur: 'super_admin', utilisateur: { id: 'u-admin', email: 'admin@exemple.test' } }),
  })
  await avecExemples(page)
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  await page.goto('/#/editeur/etablissements/e1')
  await page.getByRole('button', { name: 'Licence', exact: true }).click()
  const renouveler = page.getByRole('button', { name: 'Renouveler sans encaissement' })
  await renouveler.click()
  const dialog = page.getByRole('dialog', { name: 'Renouveler sans encaissement' })
  await expect(dialog.getByText('Montant encaissé')).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: /Encaisser sur la fiche client/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Renouveler sans encaissement' })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('SEC-11 · restaurer une sauvegarde : fichier vérifié, confirmation, données remises', async ({ page }) => {
  await page.goto('/#/parametres/securite')
  await expect(page.getByRole('button', { name: 'Restaurer une sauvegarde' })).toBeVisible()
  const sauvegarde = { format: 'agence-elite-crm', version: 1, date: '2026-10-01T10:00:00Z', prospects: [{ id: 'p-fictif', name: 'Fiche Fictive Restaurée', fiche: {} }], actions: [{ id: 'a-fictive', prospect_id: 'p-fictif', date: '2026-10-01', action: 'Note' }], documents: [] }
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restaurer une sauvegarde' }).click()])
  await choix.setFiles({ name: 'sauvegarde-fictive.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sauvegarde)) })
  const dialog = page.getByRole('dialog', { name: 'Restaurer cette sauvegarde ?' })
  await expect(dialog).toContainText('1 fiches, 1 actions, 0 documents')
  await dialog.getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText(/Sauvegarde restaurée/)).toBeVisible()
  const noms = await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).prospects.map((p) => p.name))
  expect(noms).toContain('Fiche Fictive Restaurée')
})

test('SEC-11 · un fichier qui n’est pas une sauvegarde est refusé sans rien toucher', async ({ page }) => {
  await page.goto('/#/parametres/securite')
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restaurer une sauvegarde' }).click()])
  await choix.setFiles({ name: 'autre.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"autre"}') })
  await expect(page.getByText(/Ce fichier n.est pas une sauvegarde du CRM/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('SEC-15 · les touches 1 à 4 ne notent rien pendant une saisie', async ({ page }) => {
  await avecExemples(page)
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).prospects[0].id)
  const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).actions.length)
  await page.evaluate((x) => {
    sessionStorage.setItem('aecrm-appel-en-cours', JSON.stringify({ id: x, t: Date.now() - 10000 }))
    window.dispatchEvent(new Event('focus'))
  }, pid)
  const dialog = page.getByRole('dialog', { name: "Comment s'est passé l'appel ?" })
  await expect(dialog).toBeVisible()
  // Un champ de saisie ouvert pendant la feuille (ex. note dans une autre fenêtre) : la touche 1 y est tapée, rien n'est noté
  await page.evaluate(() => {
    const champ = document.createElement('input')
    champ.id = 'champ-essai'
    champ.setAttribute('aria-label', 'Champ d’essai')
    document.querySelector('[role="dialog"]').appendChild(champ)
    champ.focus()
  })
  await page.keyboard.press('1')
  await expect(page.locator('#champ-essai')).toHaveValue('1')
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('agence-elite-crm')).actions.length)).toBe(avant)
})
