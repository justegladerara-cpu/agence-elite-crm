import { describe, expect, it } from 'vitest'
import { alertes, clientsReels, construireVue, estDemo, ficheLiee, indicateurs, lireCommande, mensuelLicence, santeEtablissement } from '../src/modules/plateforme/calculs.js'

const MAINTENANT = new Date('2026-10-18T12:00:00Z').getTime()
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString()
const offres = [{ id: 'standard', prix_mensuel: 25000, prix_annuel: 240000 }]
const licence = (o = {}) => ({ id: 'l1', offre_id: 'standard', formule: 'mensuel', statut: 'active', valide: true, jours_restants: 20, montant: 25000, ...o })
const etab = (o = {}) => ({ id: 'e1', nom: 'Bar', statut: 'actif', mis_en_service_le: '2026-10-01', licence: licence(), ...o })

describe('santé d’un établissement', () => {
  it('va bien avec une licence valable et de l’activité récente', () => {
    expect(santeEtablissement(etab(), { derniere_activite: ilYa(0) }, MAINTENANT)).toEqual({ note: 100, ton: 'vert', raisons: [] })
  })

  it('passe au rouge sans licence ou sans activité depuis longtemps', () => {
    const s = santeEtablissement(etab({ licence: null }), { derniere_activite: ilYa(20) }, MAINTENANT)
    expect(s.ton).toBe('rouge')
    expect(s.raisons.map((r) => r.texte)).toEqual(['Aucune licence', 'Aucune activité depuis 20 j'])
  })

  it('signale une licence qui finit, une licence échue et une baisse des ventes', () => {
    expect(santeEtablissement(etab({ licence: licence({ jours_restants: 3 }) }), { derniere_activite: ilYa(1) }, MAINTENANT).raisons[0].texte).toBe('Licence : fin dans 3 j')
    expect(santeEtablissement(etab({ licence: licence({ jours_restants: -2 }) }), { derniere_activite: ilYa(1) }, MAINTENANT).raisons[0].texte).toBe('Licence échue depuis 2 j (délai de grâce)')
    const baisse = santeEtablissement(etab(), { derniere_activite: ilYa(1), montant_30j: 100000, montant_30j_avant: 400000 }, MAINTENANT)
    expect(baisse.raisons.map((r) => r.texte)).toEqual(['Ventes en baisse de 75 %'])
    expect(baisse.ton).toBe('vert')
  })

  it('un établissement bloqué est gris', () => {
    expect(santeEtablissement(etab({ statut: 'suspendu' }), {}, MAINTENANT).ton).toBe('gris')
  })
})

describe('vue de la plateforme', () => {
  const vue = {
    offres,
    clients: [
      { id: 'c1', nom: 'The Dream', statut: 'actif', etablissements: [etab({ id: 'e1' })] },
      { id: 'c2', nom: 'Hôtel 2i', statut: 'actif', etablissements: [etab({ id: 'e2', nom: 'H-2i', licence: licence({ jours_restants: -3, formule: 'annuel' }) })] },
      { id: 'c3', nom: 'Commerce Démo', statut: 'actif', etablissements: [etab({ id: 'e3' })] },
      { id: 'c4', nom: 'Ancien', statut: 'archive', etablissements: [] },
      { id: 'c5', nom: 'Bloqué', statut: 'suspendu', etablissements: [etab({ id: 'e5' })] },
    ],
  }
  const activite = [
    { etablissement_id: 'e1', montant_jour: 12000, montant_30j: 300000, utilisateurs_actifs_7j: 3, derniere_activite: ilYa(0) },
    { etablissement_id: 'e2', montant_jour: 5000, derniere_activite: ilYa(1) },
  ]
  const { clients } = construireVue(vue, activite, [{ client_id: 'c2', texte: 'Paiement en retard', ton: 'urgent' }], MAINTENANT)

  it('calcule ce que chaque client paie par mois et sa santé', () => {
    const dream = clients.find((c) => c.id === 'c1')
    expect(dream).toMatchObject({ mensuel: 25000, ventesJour: 12000, ventes30j: 300000, utilisateursActifs: 3, joursRestants: 20 })
    expect(dream.sante.ton).toBe('vert')
    const hotel = clients.find((c) => c.id === 'c2')
    expect(hotel.mensuel).toBe(20000)
    expect(hotel.sante.ton).toBe('orange')
    expect(hotel.message.texte).toBe('Paiement en retard')
    expect(clients.find((c) => c.id === 'c5').sante.ton).toBe('gris')
  })

  it('cache la démo et les archives par défaut', () => {
    expect(clientsReels(clients).map((c) => c.id)).toEqual(['c1', 'c2', 'c5'])
    expect(clientsReels(clients, true)).toHaveLength(5)
    expect(estDemo({ nom: 'Pilote fictif 202610181121' })).toBe(true)
    expect(estDemo({ nom: 'The Dream Lounge Bar' })).toBe(false)
  })

  it('donne les alertes les plus graves d’abord et les chiffres du haut', () => {
    const reels = clientsReels(clients)
    const a = alertes(reels)
    expect(a[0]).toMatchObject({ ton: 'rouge', client: 'Hôtel 2i', action: 'encaisser' })
    const k = indicateurs(reels)
    expect(k).toMatchObject({ clients: 2, bloques: 1, etablissements: 2, mensuel: 45000, enRetard: 1, ventesJour: 17000 })
  })
})

describe('liens et commandes', () => {
  const prospects = [{ id: 'p1', name: 'The Dream Lounge Bar' }, { id: 'p2', name: 'Hotel 2I' }]
  it('relie un client à sa fiche CRM par le nom, ou par le choix enregistré', () => {
    expect(ficheLiee({ id: 'c2', nom: 'Hôtel 2i' }, {}, prospects).id).toBe('p2')
    expect(ficheLiee({ id: 'c1', nom: 'The Dream' }, {}, prospects).id).toBe('p1')
    expect(ficheLiee({ id: 'c1', nom: 'The Dream' }, { plateforme: { liens: { c1: 'p2' } } }, prospects).id).toBe('p2')
    expect(ficheLiee({ id: 'c1', nom: 'The Dream' }, { plateforme: { liens: { c1: '' } } }, prospects)).toBeNull()
  })

  it('comprend une commande tapée', () => {
    const clients = [{ id: 'c1', nom: 'The Dream Lounge Bar' }, { id: 'c2', nom: 'Hôtel 2i' }]
    expect(lireCommande('bloquer the dream', clients)).toEqual({ verbe: 'bloquer', client: clients[0] })
    expect(lireCommande('Prolonger hotel 2i', clients)).toEqual({ verbe: 'prolonger', client: clients[1] })
    expect(lireCommande('hotel', clients)).toEqual({ verbe: 'ouvrir', client: clients[1] })
    expect(lireCommande('bloquer', clients)).toBeNull()
    expect(lireCommande('inconnu', clients)).toBeNull()
  })

  it('prix mensuel d’une licence', () => {
    expect(mensuelLicence(licence(), offres)).toBe(25000)
    expect(mensuelLicence(licence({ formule: 'annuel' }), offres)).toBe(20000)
    expect(mensuelLicence(licence({ formule: 'essai' }), offres)).toBe(0)
    expect(mensuelLicence(licence({ statut: 'suspendue' }), offres)).toBe(0)
  })
})
