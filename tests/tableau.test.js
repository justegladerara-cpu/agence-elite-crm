// Tableau de bord lot 2 : périodes, argent reçu, objectif, poches, origine des dépenses, carte, fiches à compléter
import { describe, it, expect } from 'vitest'
import { periodeTB, paiementsDetailles, classementClients, objectifMois, poches, origineDepenses, villeDe, parVille, aCompleter, prospection } from '../src/modules/activites'
import { estExemple, chargesFixesMois } from '../src/lib/tresorerie'
import { conseilAlerte } from '../src/modules/plateforme/calculs'
import { etatAffiche } from '../src/modules/plateforme/echeances'

const prospects = [
  { id: 'td', name: 'The Dream', fiche: { ville: 'Brazzaville' } },
  { id: 'gm', name: 'GROUPE 7M', fiche: { telephone: '06 000 00 00', email: 'a@b.cg', ville: 'Pointe-Noire' } },
]
const actions = [
  { id: 'p1', action: 'Paiement reçu', prospect_id: 'td', date: '2026-10-24', montant: 100000, mode: 'Espèces', categorie: 'logiciel' },
  { id: 'p2', action: 'Paiement reçu', prospect_id: 'gm', date: '2026-10-10', montant: 20000, mode: 'Mobile Money', notes: 'affiche' },
  { id: 'p3', action: 'Paiement reçu', prospect_id: null, date: '2026-09-20', montant: 15000, mode: 'Espèces' },
  { id: 'd1', action: 'Dépense', canal: 'Moi', date: '2026-10-25', montant: 30000, mode: 'Espèces', categorie: 'Spiritualité' },
]

describe('tableau de bord', () => {
  it('périodes : aujourd’hui, 30 jours et dates libres, avec la période d’avant', () => {
    expect(periodeTB('jour', '2026-10-25')).toMatchObject({ debut: '2026-10-25', fin: '2026-10-25', avantDebut: '2026-10-24', jours: 1 })
    expect(periodeTB('30j', '2026-10-25')).toMatchObject({ debut: '2026-09-26', avantFin: '2026-09-25' })
    expect(periodeTB('libre', '2026-10-25', { debut: '2026-10-01', fin: '2026-10-10' })).toMatchObject({ jours: 10, avantDebut: '2026-09-21', avantFin: '2026-09-30' })
  })
  it('paiements : client, service et paiements sans client', () => {
    const ps = paiementsDetailles(actions, [], prospects, {})
    expect(ps.map((x) => x.id)).toEqual(['p1', 'p2', 'p3'])
    expect(ps[0]).toMatchObject({ client: 'The Dream', activite: 'logiciel', montant: 100000 })
    expect(ps[2].sansClient).toBe(true)
    const top = classementClients(ps, periodeTB('30j', '2026-10-25'))
    expect(top[0]).toMatchObject({ nom: 'The Dream', total: 100000, service: 'logiciel' })
  })
  it('objectif du mois : reçu, manque et besoin par jour', () => {
    const o = objectifMois(paiementsDetailles(actions, [], prospects, {}), 1500000, '2026-10-25')
    expect(o.recu).toBe(120000)
    expect(o.manque).toBe(1380000)
    expect(o.resteJours).toBe(6)
    expect(o.parJour).toBe(230000)
  })
  it('poches et origine de l’argent dépensé', () => {
    const p = poches(actions)
    expect(p.find((x) => x.id === 'especes').solde).toBe(85000)
    expect(p.find((x) => x.id === 'mobile').solde).toBe(20000)
    const { sources } = origineDepenses(actions, prospects)
    expect(sources.d1.parts[0]).toMatchObject({ montant: 15000 })
    expect(sources.d1.parts.map((x) => x.client)).toContain('GROUPE 7M')
    expect(sources.d1.nonCouvert).toBe(0)
  })
  it('carte du Congo et fiches à compléter', () => {
    expect(villeDe({ name: 'Bar Pointe-Noire' })).toBe('Pointe-Noire')
    expect(villeDe({ name: 'X', fiche: { ville: 'brazza' } })).toBe('Brazzaville')
    const v = parVille(prospects, new Set(['td']))
    expect(v.villes.find((x) => x.ville === 'Brazzaville').clients).toBe(1)
    const m = aCompleter(paiementsDetailles(actions, [], prospects, {}), prospects)
    expect(m.fiches.map((x) => x.prospect.id)).toEqual(['td'])
    expect(m.fiches[0].manque).toEqual(['téléphone', 'mail'])
    expect(m.sansClient).toHaveLength(1)
  })
  it('prospection : compte les DM de la semaine et du mois', () => {
    const dm = [{ id: 'a', action: 'Premier contact', canal: 'DM', date: '2026-10-25', prospect_id: 'td' }]
    const r = prospection(dm, prospects, periodeTB('7j', '2026-10-25'), '2026-10-25')
    expect(r.dmMois).toBe(1)
    expect(r.dmPeriode).toBe(1)
  })
})

describe('corrections', () => {
  it('les charges d’exemple ne comptent plus (fin des 672 000 faux)', () => {
    const liste = [{ nom: 'Outils (Loom, Canva, domaine…)', montant: 39500, periodicite: 'mensuel' }, { nom: 'Canal Box', montant: 25000, periodicite: 'mensuel', confirme: true }]
    expect(estExemple(liste[0])).toBe(true)
    expect(chargesFixesMois(liste)).toBe(25000)
  })
  it('The Dream en tranches : « Tranche payée », pas « À renouveler »', () => {
    expect(etatAffiche({ etat: 'urgent', offre: 'E-Zéro Fuite · 1 semaine' })[0]).toBe('Tranche payée')
    expect(etatAffiche({ etat: 'urgent', offre: 'Commerce', formule: 'annuel' })[0]).toBe('À renouveler')
    expect(conseilAlerte('Tranche payée : prochaine tranche dans 6 j')).toMatch(/tranche est payée/)
    expect(conseilAlerte('Établissement suspendu')).toMatch(/essai gratuit/)
  })
})
