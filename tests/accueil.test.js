// Tableau de bord unique (lot 4) : indicateurs, états des blocs, montants dans leur devise
import { describe, it, expect } from 'vitest'
import { etatPlateforme, etatCrm, relancesEnRetard, encaisseDuMois, licencesARenouveler, clientsActifs, ETATS_BLOC } from '../src/modules/plateforme/accueil'
import { argent, sommesParDevise, afficherSommes } from '../src/lib/argent'
import { construireVue, indicateurs } from '../src/modules/plateforme/calculs'

describe('états des blocs', () => {
  it('cinq états, dans l’ordre', () => expect(ETATS_BLOC).toEqual(['chargement', 'donnees', 'vide', 'refuse', 'erreur']))
  it('plateforme : vérification, refus, erreur, chargement, vide, données', () => {
    expect(etatPlateforme({ connecte: null }).etat).toBe('chargement')
    expect(etatPlateforme({ connecte: false }).etat).toBe('refuse')
    expect(etatPlateforme({ connecte: true, etat: { erreur: 'Ce compte n’est pas super admin de la plateforme.' } }).etat).toBe('refuse')
    expect(etatPlateforme({ connecte: true, etat: { erreur: 'Plateforme injoignable' } })).toEqual({ etat: 'erreur', raison: 'Plateforme injoignable' })
    expect(etatPlateforme({ connecte: true, etat: null }).etat).toBe('chargement')
    expect(etatPlateforme({ connecte: true, etat: { clients: [] } }).etat).toBe('vide')
    expect(etatPlateforme({ connecte: true, etat: { clients: [{}] } }).etat).toBe('donnees')
    // Données déjà là + erreur d'un rafraîchissement : on garde les données
    expect(etatPlateforme({ connecte: true, etat: { clients: [{}], erreur: 'x' } }).etat).toBe('donnees')
  })
  it('CRM : module coupé = refusé avec la raison', () => {
    expect(etatCrm({ actif: false, nom: 'Facturation' })).toEqual({ etat: 'refuse', raison: expect.stringContaining('Facturation') })
    expect(etatCrm({ vide: true }).etat).toBe('vide')
  })
})

describe('indicateurs', () => {
  it('relances en retard : date passée, fiches en cours seulement', () => {
    const list = [{ relance: '2026-10-20', etape: 'Contacté' }, { relance: '2026-10-21', etape: 'Contacté' }, { relance: '2026-10-01', etape: 'Gagné' }, { relance: '', etape: 'Nouveau' }]
    expect(relancesEnRetard(list, '2026-10-21')).toHaveLength(1)
  })
  it('encaissé ce mois : paiements reçus du mois civil', () => {
    const a = [{ action: 'Paiement reçu', date: '2026-10-02', montant: '1000' }, { action: 'Paiement reçu', date: '2026-09-30', montant: 500 }, { action: 'Appel', date: '2026-10-03', montant: 9 }]
    expect(encaisseDuMois(a, '2026-10')).toBe(1000)
  })
  it('licences : 0 à 7 jours à renouveler, échues à part, clients et établissements actifs seulement', () => {
    const e = (j, statut = 'actif') => ({ statut, licence: { jours_restants: j } })
    const clients = [
      { statut: 'actif', etablissements: [e(0), e(7), e(8), e(-1), e(3, 'suspendu')] },
      { statut: 'suspendu', etablissements: [e(2)] },
    ]
    const r = licencesARenouveler(clients)
    expect(r.bientot).toHaveLength(2)
    expect(r.echues).toHaveLength(1)
    expect(clientsActifs(clients)).toHaveLength(1)
  })
})

describe('montants dans leur devise', () => {
  it('jamais de symbole écrit en dur', () => {
    expect(argent(25000, 'XAF')).toBe('25 000 FCFA')
    expect(argent(12.5, 'EUR')).toBe('12,50 €')
    expect(argent(12, 'EUR')).toBe('12 €')
    expect(argent(10, 'GHS')).toBe('10 GHS')
    expect(argent(null, 'EUR')).toBe('—')
  })
  it('deux devises ne s’additionnent jamais', () => {
    const s = sommesParDevise([{ montant: 100, devise: 'XAF' }, { montant: 5, devise: 'EUR' }, { montant: 50, devise: 'XAF' }])
    expect(s).toEqual([{ devise: 'XAF', total: 150 }, { devise: 'EUR', total: 5 }])
    expect(afficherSommes(s)).toBe('150 FCFA + 5 €')
  })
  it('la vue plateforme garde la devise de chaque licence', () => {
    const vue = { offres: [], clients: [{ id: 'c', nom: 'Client Fictif', statut: 'actif', etablissements: [{ id: 'e', nom: 'E', statut: 'actif', licence: { statut: 'active', formule: 'mensuel', montant: 1000, devise: 'XOF', valide: true } }] }] }
    const { clients } = construireVue(vue)
    expect(clients[0].devise).toBe('XOF')
    expect(indicateurs(clients).mensuelParDevise).toEqual([{ devise: 'XOF', total: 1000 }])
  })
})
