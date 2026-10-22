// Socle des activités : activité devinée, ventes tirées des factures, marges, clients, relances
import { describe, it, expect } from 'vitest'
import { devinerActivite, lignesVentes, statsActivites, statsClients, periodes, prixHabituel, clientsARelancer, dependance, recommandations } from '../src/modules/activites'
import { lireComptes } from '../src/pages/NoterDM.jsx'

const fac = (id, numero, date, prospect_id, lignes, extra = {}) => ({ id, type: 'facture', numero, prospect_id, data: { date, lignes, ...extra } })
const prospects = [{ id: 'p1', name: 'Boutique Mama' }, { id: 'p2', name: 'Resto Le Bon' }]

describe('activité devinée', () => {
  it('reconnaît les mots-clés de chaque activité', () => {
    expect(devinerActivite('Tablette Samsung 10 pouces', {})).toBe('materiel')
    expect(devinerActivite('Création d’une affiche publicitaire', {})).toBe('communication')
    expect(devinerActivite('Refaire ses factures', {})).toBe('assistance')
    expect(devinerActivite('Licence annuelle Elite OS', {})).toBe('logiciel')
    expect(devinerActivite('', {})).toBe(null)
  })
  it('apprend d’une vente déjà rangée à la main', () => {
    expect(devinerActivite('Pack Diamant', {}, [{ designation: 'Pack diamant', activite: 'sites' }])).toBe('sites')
  })
})

describe('ventes tirées des factures', () => {
  const docs = [
    fac('d1', 'F-1', '2026-10-05', 'p1', [{ designation: 'Tablette', qte: 1, pu: 50000, cout: 30000, activite: 'materiel' }]),
    fac('d2', 'F-2', '2026-10-10', 'p2', [{ designation: 'Affiche', qte: 1, pu: 20000 }, { designation: 'Refaire factures', qte: 1, pu: 15000 }]),
    fac('d3', 'F-3', '2026-10-11', 'p2', [{ designation: 'Démo', qte: 1, pu: 99999 }], { demo: true }),
    fac('d4', 'F-4', '2026-10-12', 'p2', [{ designation: 'Annulée', qte: 1, pu: 99999 }], { annulee: true }),
  ]
  const actions = [{ action: 'Paiement reçu', facture: 'F-1', montant: 50000 }, { action: 'Paiement reçu', facture: 'F-2', montant: 17500 }]
  const lignes = lignesVentes(docs, actions, prospects, {})
  it('une ligne par vente ; démos et factures annulées exclues', () => {
    expect(lignes.map((l) => l.designation)).toEqual(['Tablette', 'Affiche', 'Refaire factures'])
  })
  it('marge avec le coût, encaissement au prorata', () => {
    expect(lignes[0]).toMatchObject({ activite: 'materiel', montant: 50000, cout: 30000, marge: 20000, encaisse: 50000, client: 'Boutique Mama' })
    expect(lignes[1]).toMatchObject({ activite: 'communication', marge: 20000, encaisse: 10000 })
    expect(lignes[2]).toMatchObject({ activite: 'assistance', encaisse: 7500 })
  })
  it('chiffres par activité et par client', () => {
    const p = { debut: '2026-10-01', fin: '2026-10-31', avantDebut: '2026-09-01', avantFin: '2026-09-30' }
    const acts = statsActivites(lignes, {}, p)
    expect(acts.find((a) => a.id === 'materiel')).toMatchObject({ ca: 50000, marge: 20000, ventes: 1, tauxMarge: 0.4 })
    const clients = statsClients(lignes, '2026-10-20')
    expect(clients[0]).toMatchObject({ nom: 'Boutique Mama', ca: 50000, du: 0 })
    expect(clients[1]).toMatchObject({ nom: 'Resto Le Bon', ca: 35000, du: 17500, achats: 1, etiquette: 'Nouveau' })
    expect(clients[1].activites[0]).toMatchObject({ id: 'communication' })
    expect(dependance(clients).part).toBe(1)
  })
  it('prix habituel : la dernière vente du même service', () => {
    expect(prixHabituel(lignes, 'tablette', 'p1')).toMatchObject({ pu: 50000, cout: 30000 })
    expect(prixHabituel(lignes, 'inconnu')).toBe(null)
  })
})

describe('périodes', () => {
  it('ce mois comparé au même nombre de jours du mois d’avant', () => {
    expect(periodes('mois', '2026-10-22')).toMatchObject({ debut: '2026-10-01', fin: '2026-10-22', avantDebut: '2026-09-01', avantFin: '2026-09-22' })
    expect(periodes('7j', '2026-10-22')).toMatchObject({ debut: '2026-10-16', avantFin: '2026-10-15' })
  })
})

describe('mode relance', () => {
  it('un client habitué qui n’achète plus, une vente croisée, un devis en attente', () => {
    const lignes = [
      { docId: 'a', date: '2026-05-01', prospectId: 'p1', client: 'Boutique Mama', designation: 'Affiche', activite: 'communication', montant: 20000, marge: 20000, encaisse: 20000 },
      { docId: 'b', date: '2026-06-01', prospectId: 'p1', client: 'Boutique Mama', designation: 'Affiche', activite: 'communication', montant: 20000, marge: 20000, encaisse: 20000 },
      { docId: 'c', date: '2026-07-01', prospectId: 'p1', client: 'Boutique Mama', designation: 'Tablette', activite: 'materiel', montant: 50000, marge: 20000, encaisse: 50000 },
    ]
    const clients = statsClients(lignes, '2026-10-22')
    const devis = [{ numero: 'D-1', client: 'Resto', prospect_id: 'p2', total: 80000, data: { date: '2026-10-10' } }]
    const r = clientsARelancer(clients, {}, { devis, t: '2026-10-22' })
    expect(r.map((x) => x.type).sort()).toEqual(['croisee', 'devis', 'habitude'])
    expect(r[0].potentiel).toBeGreaterThanOrEqual(r[1].potentiel)
    expect(r.every((x) => x.message.length > 20)).toBe(true)
  })
  it('recommande des DM quand la prospection est en retard', () => {
    const r = recommandations({ objectifDmSemaine: 200, dmSemaine: 10, joursPasses: 4 })
    expect(r[0]).toMatchObject({ faire: 'dm' })
  })
})

describe('Noter mes DM', () => {
  it('un compte par ligne, doublons retirés, comptes connus reconnus', () => {
    const list = [{ id: 'x', name: 'Resto Le Bon', fiche: { instagram: '@resto_lebon' } }]
    const c = lireComptes('@resto_lebon\nhttps://instagram.com/boutique_z\n@boutique_z\nGarage Central', list)
    expect(c.map((x) => x.nom)).toEqual(['Resto Lebon', 'Boutique Z', 'Garage Central'])
    expect(c[0].connu?.id).toBe('x')
    expect(c[1]).toMatchObject({ handle: '@boutique_z', connu: null })
  })
})
