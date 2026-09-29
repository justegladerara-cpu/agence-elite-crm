// Tests des calculs du CRM : étapes, relances, périodes, factures, lecture des fichiers
import { mouvements, resumeArgent, rentabiliteClients } from '../src/lib/tresorerie'
import { describe, test, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { computeAll, periodeFor, waLink, handleInsta, montantRetenu } from '../src/lib/logic'
import { mergeSettings } from '../src/lib/store'
import { totals, statutDe, nextNumero, num, enLettres } from '../src/lib/invoice'
import { categorie } from '../src/lib/hub'
import { addDays, weekday, diffDays } from '../src/lib/dates'
import { lireCsv, serieVersDate, colLettres, colNum, decoder } from '../src/lib/tableur'
import { avancement } from '../src/lib/journee'
import { lundiProchain, actionAppel } from '../src/pages/Rapide'
import { messageErreur } from '../src/lib/erreurs'

const AUJ = '2026-09-28' // un lundi
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${AUJ}T10:00:00`))
})
afterAll(() => vi.useRealTimers())

const S = mergeSettings(null)
const p = (id, name, fiche = {}) => ({ id, name, fiche, created_at: `${AUJ}T08:00:00Z` })
const a = (prospect_id, date, action, extra = {}) => ({ id: `${prospect_id}-${date}-${action}-${Math.random()}`, prospect_id, date, action, canal: 'Appel', ...extra })

describe('étapes et relances', () => {
  test('un premier contact fait passer à « Contacté » et programme la relance J+2', () => {
    const d = computeAll([p('1', 'Pizzeria')], [a('1', '2026-09-25', 'Premier contact')], S)
    const x = d.byId['1']
    expect(x.etape).toBe('Contacté')
    expect(x.tentatives).toBe(1)
    expect(x.relance).toBe(addDays('2026-09-25', S.relance.j1))
  })
  test('une date de relance saisie sur la dernière action est prioritaire', () => {
    const d = computeAll([p('1', 'Garage')], [a('1', '2026-09-20', 'Premier contact'), a('1', '2026-09-27', 'Note', { date_relance: '2026-10-05' })], S)
    expect(d.byId['1'].relance).toBe('2026-10-05')
    expect(d.aVenir.map((x) => x.id)).toContain('1')
  })
  test('une relance en retard est dans la liste du jour', () => {
    const d = computeAll([p('1', 'Salon')], [a('1', '2026-09-01', 'Premier contact')], S)
    expect(d.aRelancer.map((x) => x.id)).toEqual(['1'])
  })
  test('une signature fait un client et arrête les relances', () => {
    const d = computeAll([p('1', 'Hôtel')], [a('1', '2026-09-01', 'Premier contact'), a('1', '2026-09-10', 'Signature', { montant: 500000 })], S)
    expect(d.byId['1'].etape).toBe('Gagné')
    expect(d.byId['1'].relance).toBe('')
    expect(d.clients.map((c) => c.id)).toEqual(['1'])
    expect(categorie(d.byId['1'], d.clients[0], AUJ)).toBe('nouveaux')
  })
  test('« Perdu » classe la fiche dans les perdus', () => {
    const d = computeAll([p('1', 'Boutique')], [a('1', '2026-09-01', 'Premier contact'), a('1', '2026-09-02', 'Perdu')], S)
    expect(d.byId['1'].etape).toBe('Perdu')
    expect(categorie(d.byId['1'], null)).toBe('perdus')
  })
  test('le résultat « RDV pris » fait avancer à l’étape RDV', () => {
    const d = computeAll([p('1', 'Clinique')], [a('1', '2026-09-26', 'Relance', { resultat: 'RDV pris' })], S)
    expect(d.byId['1'].etape).toBe('RDV')
  })
})

describe('saisie rapide', () => {
  test('lundi prochain', () => {
    expect(lundiProchain('2026-09-28')).toBe('2026-10-05')
    expect(lundiProchain('2026-09-30')).toBe('2026-10-05')
    expect(lundiProchain('2026-10-04')).toBe('2026-10-05')
    expect(weekday(lundiProchain('2026-10-02'))).toBe(1)
  })
  test('premier appel ou relance selon l’historique', () => {
    const d = computeAll([p('1', 'Neuf'), p('2', 'Déjà appelé')], [a('2', '2026-09-20', 'Premier contact')], S)
    expect(actionAppel(d.byId['1'])).toBe('Premier contact')
    expect(actionAppel(d.byId['2'])).toBe('Relance')
  })
})

describe('périodes du tableau de bord', () => {
  test('7 derniers jours : jamais vide un lundi', () => {
    const per = periodeFor('7 derniers jours')
    expect(per.debut).toBe('2026-09-22')
    expect(per.fin).toBe(AUJ)
    expect(diffDays(per.prevFin, per.prevDebut)).toBe(6)
    expect(per.prevFin).toBe('2026-09-21')
  })
  test('cette semaine commence le lundi', () => {
    expect(periodeFor('Cette semaine').debut).toBe(AUJ)
  })
  test('mois en cours', () => {
    const per = periodeFor('Mois en cours')
    expect([per.debut, per.fin]).toEqual(['2026-09-01', '2026-09-30'])
  })
})

describe('factures', () => {
  const doc = { type: 'facture', numero: 'FAC-2026000001', data: { lignes: [{ qte: 2, pu: '50 000' }, { qte: 1, pu: 25000 }], remise: 5000, tva: 0, echeance: '2026-09-20' } }
  test('totaux avec remise', () => {
    expect(totals(doc.data).total).toBe(120000)
    expect(num('1 234,5')).toBe(1234.5)
  })
  test('statut selon les paiements et l’échéance', () => {
    expect(statutDe(doc, [])).toBe('En retard')
    expect(statutDe(doc, [{ action: 'Paiement reçu', facture: doc.numero, montant: 20000 }])).toBe('En retard')
    expect(statutDe({ ...doc, data: { ...doc.data, echeance: '2026-10-30' } }, [{ action: 'Paiement reçu', facture: doc.numero, montant: 20000 }])).toBe('Partiellement payée')
    expect(statutDe(doc, [{ action: 'Paiement reçu', facture: doc.numero, montant: 120000 }])).toBe('Payée')
  })
  test('numérotation continue', () => {
    const fact = { prefixeFacture: 'FAC-', prefixeDevis: 'DEV-' }
    expect(nextNumero([doc], 'facture', fact, AUJ)).toBe('FAC-2026000002')
    expect(nextNumero([], 'devis', fact, AUJ)).toBe('DEV-2026000001')
  })
  test('montant en lettres', () => {
    expect(enLettres(100000)).toMatch(/cent mille/)
  })
})

describe('outils', () => {
  test('liens WhatsApp et Instagram', () => {
    expect(waLink('06 12 34 56 78', '242')).toMatch(/wa\.me\/2420?6?12345678|wa\.me\/242/)
    expect(handleInsta('https://www.instagram.com/salon.elegance/')).toBe('salon.elegance')
  })
  test('prix retenu : montant saisi en priorité', () => {
    const d = computeAll([p('1', 'X', { offre: 'Site vitrine' })], [], S)
    expect(montantRetenu({ action: 'Proposition envoyée', montant: 900 }, d.byId['1'], d.L)).toBe(900)
  })
  test('score des objectifs du jour', () => {
    const jour = { objectifs: [{ nom: 'Appels', cible: 10, source: 'appels' }, { nom: 'DM', cible: 10, source: 'dm' }], compteurs: { DM: 5 } }
    const av = avancement(jour, { appels: 10, dm: 0 })
    expect(av.score).toBe(75)
  })
  test('messages d’erreur compréhensibles', () => {
    expect(messageErreur(new Error('duplicate key value violates unique constraint (23505)'))).toMatch(/existe déjà/)
    expect(messageErreur(new Error('new row violates row-level security policy'))).toMatch(/n'appartient pas/)
  })
})

describe('lecture de fichiers', () => {
  test('CSV avec point-virgule, guillemets et BOM', () => {
    const rows = lireCsv('﻿Nom;Montant;Note\r\n"Da Marco";150000;"Il a dit ""oui"""\r\nGarage;;\r\n')
    expect(rows).toEqual([
      { Nom: 'Da Marco', Montant: '150000', Note: 'Il a dit "oui"' },
      { Nom: 'Garage', Montant: '', Note: '' },
    ])
  })
  test('dates et colonnes Excel', () => {
    expect(serieVersDate(46293)).toBe('2026-09-28')
    expect(colLettres(0)).toBe('A')
    expect(colLettres(27)).toBe('AB')
    expect(colNum('AB')).toBe(27)
    expect(decoder('Caf&#233; &amp; th&eacute;')).toBe('Café & th&eacute;')
  })
})

describe('trésorerie : paiements, frais liés et net', () => {
  const actions = [
    { id: 'p1', action: 'Paiement reçu', date: '2026-09-28', montant: 34000, prospect_id: null },
    { id: 'd1', action: 'Dépense', date: '2026-09-28', montant: 2000, reference: 'paiement:p1', categorie: 'Transport' },
    { id: 'p2', action: 'Paiement reçu', date: '2026-09-27', montant: 150000, prospect_id: 'c1' },
    { id: 'd2', action: 'Dépense', date: '2026-09-27', montant: 5000, prospect_id: 'c1' },
    { id: 'x', action: 'Paiement reçu', date: '2026-08-01', montant: 999 },
  ]
  const m = mouvements(actions, '2026-09-22', '2026-09-28')
  it('garde la période, du plus récent au plus ancien', () => {
    expect(m.map((x) => x.a.id)).toEqual(['p1', 'd1', 'p2', 'd2'])
  })
  it('rattache le taxi au paiement et calcule ce qui reste', () => {
    const p1 = m.find((x) => x.a.id === 'p1')
    expect(p1.coutLie).toBe(2000)
    expect(p1.net).toBe(32000)
    expect(p1.sansClient).toBe(true)
  })
  it('résume encaissé, dépenses, charges fixes et net', () => {
    const r = resumeArgent(m, 1000)
    expect(r).toMatchObject({ encaisse: 184000, depenses: 7000, net: 176000, nbEntrees: 2, nbSorties: 2 })
    expect(r.sansClient).toHaveLength(1)
  })
  it('donne la rentabilité par client, sans compter deux fois un frais', () => {
    const rows = rentabiliteClients(m, { c1: { name: 'Client 1' } })
    expect(rows).toEqual([
      expect.objectContaining({ id: 'c1', encaisse: 150000, frais: 5000, net: 145000 }),
      expect.objectContaining({ id: '', nom: 'Sans client', encaisse: 34000, frais: 2000, net: 32000 }),
    ])
  })
})
