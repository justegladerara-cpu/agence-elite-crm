// Aides partagées des parcours e2e : exemples du mode démo et plateforme fictive (aucune donnée réelle)
import { expect } from '@playwright/test'

export async function avecExemples(page) {
  await page.goto('/#/journee')
  await expect(page.getByRole('heading', { name: 'Ajoute tes premiers prospects' })).toBeVisible()
  await page.getByRole('button', { name: 'Charger des exemples' }).click()
  await expect(page.getByText('Exemples chargés')).toBeVisible()
}

// Plateforme : données fictives servies à la place de la base du SaaS (aucune donnée réelle)
export const FICTIF = {
  editeur_vue: {
    offres: [{ id: 'standard', nom: 'Standard', description: 'Offre fictive', modules: ['stock'], devise: 'XAF', actif: true, prix_acquisition: 0, prix_mensuel: 25000, prix_annuel: 240000, prix_mise_en_service: 0, prix_support_mensuel: 0 }],
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
// reponses : fonctions qui remplacent une réponse (nom → (corps, appels, route) => valeur | undefined pour la réponse fictive)
export async function avecPlateforme(page, reponses = {}) {
  const appels = []
  await page.route(/plateforme\.fictive\.test\/rest\/v1\/rpc\/([a-z_]+)/, async (route) => {
    const nom = route.request().url().split('/rpc/')[1].split('?')[0]
    const corps = route.request().postDataJSON()
    appels.push({ nom, corps })
    if (reponses[nom]) {
      const r = await reponses[nom](corps, appels, route)
      if (r === 'coupe') return route.abort('failed')
      if (r !== undefined) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICTIF[nom] ?? null) })
  })
  await page.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const session = { access_token: 'jeton-fictif', refresh_token: 'fictif', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: 'u-admin', aud: 'authenticated', role: 'authenticated', email: 'admin@exemple.test' } }
    localStorage.setItem('aecrm-plateforme', JSON.stringify(session))
  })
  return appels
}

