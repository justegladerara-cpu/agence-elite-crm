// Parcours essentiels du CRM (mode démo : données dans le navigateur)
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function avecExemples(page) {
  await page.goto('/#/journee')
  await expect(page.getByRole('heading', { name: 'Ajoute tes premiers prospects' })).toBeVisible()
  await page.getByRole('button', { name: 'Charger des exemples' }).click()
  await expect(page.getByText('Exemples chargés')).toBeVisible()
}

test('l’application s’ouvre sur le tableau de bord ; Ma journée garde les relances en haut', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  await page.goto('/#/journee')
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
  test.setTimeout(60000) // 10 écrans analysés, chacun après la fin de ses animations d'arrivée
  await avecExemples(page)
  for (const route of ['journee', 'acquisition', 'clients', 'factures', 'dashboard', 'charges', 'abonnements', 'parametres/listes', 'parametres/securite', 'saisie']) {
    await page.goto(`/#/${route}`)
    await page.waitForTimeout(400)
    // Contrastes mesurés une fois les animations d'arrivée terminées (pas pendant un fondu)
    await page.waitForFunction(() => document.getAnimations().every((a) => !String(a.animationName).startsWith('mvt-') || a.playState !== 'running'))
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const graves = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(graves.map((v) => `${route} : ${v.id} (${v.nodes.length})`)).toEqual([])
  }
})

test('pas de défilement horizontal', async ({ page }) => {
  await avecExemples(page)
  for (const route of ['journee', 'acquisition', 'clients', 'factures', 'dashboard', 'charges', 'abonnements', 'parametres']) {
    await page.goto(`/#/${route}`)
    await page.waitForTimeout(300)
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(deborde, route).toBeLessThanOrEqual(1)
  }
})

test('tableau de bord : un paiement et ses frais (taxi) donnent le net', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/dashboard/finances')
  const argent = page.locator('section.argent')
  await argent.getByRole('button', { name: 'Paiement', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Paiement reçu' })
  await dialog.getByLabel(/Montant reçu/).fill('34000')
  await dialog.getByLabel('Notes').fill('Dépannage de 22 h')
  await dialog.getByRole('button', { name: 'Enregistrer le paiement' }).click()
  await dialog.getByRole('button', { name: 'Ajouter des frais' }).click()
  const frais = page.getByRole('dialog', { name: 'Paiement reçu' })
  await frais.getByLabel(/^Montant/).fill('2000')
  await expect(frais.getByText(/il te reste/)).toContainText('32')
  await frais.getByRole('button', { name: 'Enregistrer la dépense' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const ligne = argent.locator('.mvt.in', { hasText: 'Dépannage de 22 h' })
  await expect(ligne).toContainText('net 32')
  await expect(ligne.getByRole('button', { name: /Relier à un client/ })).toBeVisible()
})

test('cockpit : les filtres croisés se posent, se partagent par le lien et s’effacent', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/dashboard')
  await expect(page.getByRole('heading', { name: "Centre d'attention" })).toBeVisible()
  await page.locator('.ck-canal-t tbody tr', { hasText: 'DM' }).first().click()
  await expect(page.locator('#dash-canal')).toHaveValue('DM')
  await expect(page).toHaveURL(/canal=DM/)
  await page.locator('.ck-step-main').nth(1).click()
  await expect(page.locator('.ck-chip', { hasText: 'Étape' })).toBeVisible()
  await expect(page).toHaveURL(/etape=1/)
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect(page.locator('.ck-chip')).toHaveCount(0)
  await expect(page.locator('#dash-canal')).toHaveValue('Tous')
  await page.locator('.ck-kpi').first().click()
  await expect(page.getByRole('dialog', { name: 'Paiements reçus' })).toBeVisible()
})

test('modules : désactiver la facturation retire ses pages, la réactiver les rend', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/parametres/modules')
  const facturation = page.locator('#module-facturation')
  await facturation.uncheck()
  await expect(page.getByText(/Facturation désactivé/)).toBeVisible()
  await page.goto('/#/factures')
  await expect(page.getByRole('heading', { name: /Module « Facturation » désactivé/ })).toBeVisible()
  await expect(page.locator('.bottom-nav, .sidebar').getByRole('button', { name: 'Factures', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Gérer les modules' }).click()
  await page.locator('#module-facturation').check()
  await page.goto('/#/factures')
  await expect(page.getByRole('heading', { name: /désactivé/ })).toHaveCount(0)
  // Une dépendance forte : couper le site coupe aussi la boutique
  await page.goto('/#/parametres/modules')
  await page.locator('#module-site').click()
  await page.getByRole('button', { name: 'Désactiver' }).click()
  await expect(page.locator('#module-store')).not.toBeChecked()
  const axe = await new AxeBuilder({ page }).include('.main').analyze()
  expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([])
})

test('toutes les routes s’ouvrent sans erreur ni requête vers une base de production', async ({ page }) => {
  const erreurs = []
  const versProduction = []
  page.on('pageerror', (e) => erreurs.push(`${page.url()} : ${e.message}`))
  page.on('request', (r) => /mylgnsuoppplmfaanyze|xrlfedosaqtffraadmgk/.test(r.url()) && versProduction.push(r.url()))
  await avecExemples(page)
  const routes = [
    'dashboard', 'dashboard/acquisition', 'dashboard/conversion', 'dashboard/finances', 'journee', 'calendrier',
    'acquisition', 'clients', 'session', 'scripts', 'saisie', 'apps',
    'devis', 'factures', 'facture/new?type=facture', 'paiements', 'charges', 'depenses', 'abonnements',
    'site', 'site-demandes', 'site-pages', 'site-photos', 'boutique', 'documents', 'controle', 'plateforme', 'plateforme-outils',
    ...['identite', 'facturation', 'objectifs', 'listes', 'scripts', 'rappels', 'excel', 'modules', 'membres', 'securite', 'compte'].map((s) => `parametres/${s}`),
  ]
  for (const r of routes) {
    await page.goto(`/#/${r}`)
    await expect(page.locator('.main .chargement'), r).toHaveCount(0)
    await expect(page.locator('.main h1, .main h2, .main .empty, .main [role="status"]').first(), r).toBeVisible()
  }
  expect(erreurs).toEqual([])
  expect(versProduction).toEqual([])
})

test('saisie d’argent ouverte par le noyau : depuis les clients et depuis le tableau de bord', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/clients?onglet=tous')
  await page.locator('.main').getByRole('button', { name: 'Paiement', exact: true }).first().click()
  const pay = page.getByRole('dialog', { name: 'Paiement reçu' })
  await expect(pay).toBeVisible()
  await expect(pay.locator('.selected-prospect')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(pay).toBeHidden()
  await page.goto('/#/dashboard/finances')
  const argent = page.locator('section.argent')
  await argent.getByRole('button', { name: 'Dépense', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle dépense' })).toBeVisible()
})

test('chronologie du client : étapes, paiements, dépenses et factures lus dans le journal (repli calcul en local)', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/clients?onglet=tous')
  await page.locator('.main a[href*="#/prospect/"]').first().click()
  await page.locator('.main').getByText('Chronologie', { exact: true }).click()
  const liste = page.locator('.main .list[data-source]')
  await expect(liste).toHaveAttribute('data-source', 'calcul')
  await expect(liste.locator('[data-type="client.won"]').first()).toBeVisible()
  const avantPaiements = await liste.locator('[data-type="payment.received"]').count()
  const avantDepenses = await liste.locator('[data-type="expense.created"]').count()
  // Nouveau paiement et nouvelle dépense : la chronologie suit
  await page.locator('.main').getByText('Aperçu', { exact: true }).click()
  await page.getByRole('button', { name: '+ Paiement' }).click()
  const pay = page.getByRole('dialog', { name: 'Paiement reçu' })
  await pay.getByLabel(/Montant reçu/).fill('12345')
  await pay.getByRole('button', { name: 'Enregistrer le paiement' }).click()
  // Après un paiement, l'application propose de noter les frais liés
  await pay.getByRole('button', { name: 'Ajouter des frais' }).click()
  const dep = pay
  await dep.getByLabel(/^Montant/).fill('500')
  await dep.getByRole('button', { name: 'Enregistrer la dépense' }).click()
  await expect(dep).toBeHidden()
  await page.locator('.main').getByText('Chronologie', { exact: true }).click()
  await expect(liste.locator('[data-type="payment.received"]')).toHaveCount(avantPaiements + 1)
  await expect(liste.locator('[data-type="expense.created"]')).toHaveCount(avantDepenses + 1)
  await expect(liste.locator('[data-type="payment.received"]').first()).toContainText('12')
  // Step 6A : un paiement modifié apparaît avec son nouveau montant, sans doublon
  await page.locator('.main').getByText('Aperçu', { exact: true }).click()
  await page.locator('.main .list-item').filter({ hasText: /12\s?345/ }).first().getByTitle('Modifier').click()
  const modif = page.getByRole('dialog', { name: 'Modifier le paiement' })
  await modif.getByLabel(/Montant reçu/).fill('23456')
  await modif.getByRole('button', { name: 'Enregistrer le paiement' }).click()
  await expect(modif).toBeHidden()
  await page.locator('.main').getByText('Chronologie', { exact: true }).click()
  await expect(liste.locator('[data-type="payment.received"]')).toHaveCount(avantPaiements + 1)
  await expect(liste.locator('[data-type="payment.received"]').filter({ hasText: /23\s?456/ })).toHaveCount(1)
  await expect(liste.locator('[data-type="payment.received"]').filter({ hasText: /12\s?345/ })).toHaveCount(0)
})

test('facture : un numéro déjà utilisé (même en minuscules) est refusé avant tout enregistrement', async ({ page }) => {
  const nouvelle = async (numero) => {
    await page.goto('/#/facture/new?type=facture')
    await page.getByLabel('Nom affiché sur le document').fill('Client test numéro')
    await page.getByPlaceholder('Désignation').first().fill('Prestation')
    await page.getByRole('textbox', { name: 'Numéro' }).fill(numero)
    await page.locator('.main').getByRole('button', { name: 'Enregistrer', exact: true }).click()
  }
  await nouvelle('FAC-TEST-0001')
  await expect(page.getByRole('heading', { name: 'Facture FAC-TEST-0001' })).toBeVisible()
  await nouvelle(' fac-test-0001 ')
  await expect(page.getByText('Ce numéro existe déjà')).toBeVisible()
  await page.goto('/#/factures')
  await expect(page.locator('.main td.lnk', { hasText: /FAC-TEST-0001/i })).toHaveCount(1)
})

test('photos du site : emplacements groupés, mode démo sans écriture', async ({ page }) => {
  await avecExemples(page)
  await page.goto('/#/site-photos')
  await expect(page.getByRole('heading', { name: 'Photos du site' })).toBeVisible()
  await expect(page.getByText(/Mode démo : photos d'origine du site/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible()
  await expect(page.locator('.photo-carte').first().getByText("D'origine")).toBeVisible()
  await page.locator('.photo-carte').first().getByRole('button', { name: 'Coller un lien' }).click()
  await page.locator('.photo-carte').first().getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Mode démo : les photos ne peuvent pas être changées ici.')).toBeVisible()
})

test('documents : liste par dossier, remplir un contrat, aperçu à jour, mode démo sans écriture', async ({ page }) => {
  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Contrats clients/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Rechercher un document' }).fill('création de site')
  await page.locator('.docs-carte', { hasText: 'Contrat de création de site internet' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Contrat de création de site internet' })).toBeVisible()
  await page.getByLabel('Nom du client').first().fill('Boulangerie Mavoungou')
  await expect(page.locator('.docs-apercu .md-rempli', { hasText: 'Boulangerie Mavoungou' }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Modifier le modèle' }).click()
  await expect(page.getByText('Mode démo : l’enregistrement est désactivé.')).toBeVisible()
  await page.getByRole('button', { name: '← Tous les documents' }).click()
  await expect(page.locator('.docs-carte').first()).toBeVisible()
})

// Plateforme : données fictives servies à la place de la base du SaaS (aucune donnée réelle)
const FICTIF = {
  editeur_vue: {
    offres: [{ id: 'standard', prix_mensuel: 25000, prix_annuel: 240000 }],
    clients: [
      { id: 'c1', nom: 'Bar Fictif', statut: 'actif', pays: 'CG', contact: { telephone: '+242000000000' }, etablissements: [{ id: 'e1', nom: 'Bar Fictif', statut: 'actif', mis_en_service_le: '2026-10-01', membres_actifs: 3, licence: { id: 'l1', offre: 'Standard', offre_id: 'standard', formule: 'mensuel', statut: 'active', valide: true, jours_restants: -2, echeance: '2026-10-16', montant: 25000 } }] },
      { id: 'c2', nom: 'Hôtel Fictif', statut: 'actif', etablissements: [{ id: 'e2', nom: 'Hôtel Fictif', statut: 'actif', mis_en_service_le: '2026-10-01', membres_actifs: 5, licence: { id: 'l2', offre: 'Standard', offre_id: 'standard', formule: 'annuel', statut: 'active', valide: true, jours_restants: 200, echeance: '2027-05-01', montant: 240000 } }] },
    ],
  },
  pilotage_activite: [
    { etablissement_id: 'e1', ventes_jour: 4, montant_jour: 18000, montant_7j: 90000, montant_30j: 300000, utilisateurs_actifs_7j: 2, derniere_activite: new Date().toISOString(), caisses_ouvertes: 1 },
    { etablissement_id: 'e2', ventes_jour: 1, montant_jour: 45000, montant_7j: 200000, montant_30j: 800000, utilisateurs_actifs_7j: 4, derniere_activite: new Date().toISOString() },
  ],
  pilotage_messages: [],
  editeur_tableau_de_bord: {},
  editeur_comptes: [{ id: 'u1', nom: 'Gérant Fictif', identifiant: 'gerant.fictif', acces: [{ etablissement_id: 'e1', role: 'gerant', actif: true }], derniere_connexion: new Date().toISOString() }],
  pilotage_chronologie: [{ date: new Date().toISOString(), type: 'ventes.jour', etablissement: 'Bar Fictif', detail: '4 vente(s)', montant: 18000 }],
  est_super_admin: true,
}
async function avecPlateforme(page) {
  const appels = []
  await page.route(/plateforme\.fictive\.test\/rest\/v1\/rpc\/([a-z_]+)/, async (route) => {
    const nom = route.request().url().split('/rpc/')[1].split('?')[0]
    appels.push({ nom, corps: route.request().postDataJSON() })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICTIF[nom] ?? null) })
  })
  await page.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const session = { access_token: 'jeton-fictif', refresh_token: 'fictif', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: 'u-admin', aud: 'authenticated', role: 'authenticated', email: 'admin@exemple.test' } }
    localStorage.setItem('aecrm-plateforme', JSON.stringify(session))
  })
  return appels
}

test('plateforme : tour de contrôle, fiche client et encaissement (données fictives)', async ({ page }) => {
  const appels = await avecPlateforme(page)
  await avecExemples(page)
  await page.goto('/#/controle')
  await expect(page.getByRole('heading', { level: 1, name: 'Tour de contrôle' })).toBeVisible()
  await expect(page.getByText('Licence échue depuis 2 j (délai de grâce)')).toBeVisible()
  // Contrastes mesurés une fois les animations d'arrivée terminées (pas pendant un fondu)
  await page.waitForTimeout(400)
  await page.waitForFunction(() => document.getAnimations().every((a) => !String(a.animationName).startsWith('mvt-') || a.playState !== 'running'))
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/controle-${test.info().project.name}.png`, fullPage: true })
  const axe = await new AxeBuilder({ page }).include('.main').analyze()
  expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([])
  await page.getByRole('textbox', { name: 'Commande' }).fill('encaisser bar fictif')
  await page.getByRole('button', { name: 'Encaisser Bar Fictif' }).click()
  const dialog = page.getByRole('dialog', { name: /Encaisser/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Montant reçu (FCFA)' })).toHaveValue('25000')
  await dialog.getByRole('button', { name: 'Encaisser' }).click()
  await expect(page.getByText('Paiement encaissé et licence prolongée')).toBeVisible()
  expect(appels.find((a) => a.nom === 'renouveler_licence').corps).toMatchObject({ p_licence_id: 'l1', p_montant: 25000 })
  await expect(page.getByRole('heading', { name: 'Histoire du client' })).toBeVisible()
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/fiche-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Bloquer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Bloquer' }).click()
  await expect.poll(() => appels.find((a) => a.nom === 'definir_statut_client')?.corps).toEqual({ p_client_id: 'c1', p_statut: 'suspendu' })
})
