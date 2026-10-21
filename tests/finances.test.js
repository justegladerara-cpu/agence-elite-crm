// Module de calcul unique (lot 6) : règles R1 à R7 de docs/superadmin-v2/08_FINANCIAL_RULES.md
import { describe, it, expect } from 'vitest'
import { montant, estPaiement, estDepense, moisDe, dansPeriode, paiementsDans, encaisse, depenses, resultat, arrondi } from '../src/lib/finances'
import { num as numLogic } from '../src/lib/logic'
import { num as numFacture } from '../src/modules/facturation/invoice'
import { encaisseDuMois } from '../src/modules/plateforme/accueil'

const actions = [
  { action: 'Paiement reçu', date: '2026-10-01', montant: '150 000' },
  { action: 'Paiement reçu', date: '2026-10-31', montant: 50000 },
  { action: 'Paiement reçu', date: '2026-09-30', montant: '10000' },
  { action: 'Paiement reçu', date: '', montant: 999 },
  { action: 'Dépense', date: '2026-10-15', montant: '20 000,5' },
  { action: 'Dépense', date: '2026-11-01', montant: 7000 },
  { action: 'Appel', date: '2026-10-02', montant: 1 },
]

describe('R1 lecture d’un montant', () => {
  it('espaces, espaces insécables, virgule', () => {
    expect(montant('150 000')).toBe(150000)
    expect(montant('150 000')).toBe(150000)
    expect(montant('150 000')).toBe(150000)
    expect(montant('12,5')).toBe(12.5)
    expect(montant(12.5)).toBe(12.5)
  })
  it('vide, illisible, infini → 0', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity, {}]) expect(montant(v)).toBe(0)
  })
  it('une seule règle dans tout le CRM', () => {
    expect(numLogic).toBe(montant)
    expect(numFacture).toBe(montant)
    expect(numLogic('1 000')).toBe(1000) // l’ancienne lecture donnait 0
  })
})

describe('R2 et R3 nature et période', () => {
  it('paiement et dépense', () => {
    expect(estPaiement(actions[0])).toBe(true)
    expect(estDepense(actions[4])).toBe(true)
    expect(estPaiement(actions[6]) || estDepense(actions[6])).toBe(false)
    expect(estPaiement(null)).toBe(false)
  })
  it('bornes incluses, mois civil, date absente exclue', () => {
    expect(moisDe('2026-10-21T10:00')).toBe('2026-10')
    expect(dansPeriode('2026-10-01', { debut: '2026-10-01', fin: '2026-10-31' })).toBe(true)
    expect(dansPeriode('2026-10-31', { debut: '2026-10-01', fin: '2026-10-31' })).toBe(true)
    expect(dansPeriode('2026-11-01', { debut: '2026-10-01', fin: '2026-10-31' })).toBe(false)
    expect(dansPeriode('2026-10-31T23:59', { mois: '2026-10' })).toBe(true)
    expect(dansPeriode('', {})).toBe(false)
    expect(dansPeriode('2020-01-01')).toBe(true)
  })
})

describe('R4 à R6 encaissé, dépenses, résultat', () => {
  it('encaissé du mois = paiements datés du mois', () => {
    expect(paiementsDans(actions, { mois: '2026-10' })).toHaveLength(2)
    expect(encaisse(actions, { mois: '2026-10' })).toBe(200000)
    expect(encaisseDuMois(actions, '2026-10')).toBe(200000)
    expect(encaisse([], { mois: '2026-10' })).toBe(0)
  })
  it('dépenses de la période', () => {
    expect(depenses(actions, { mois: '2026-10' })).toBe(20000.5)
  })
  it('résultat = encaissé − dépenses − charges fixes', () => {
    const r = resultat(actions, { mois: '2026-10' }, '30 000')
    expect(r).toMatchObject({ encaisse: 200000, depenses: 20000.5, chargesFixes: 30000, net: 149999.5 })
    expect(r.marge).toBeCloseTo(0.75, 5)
    expect(resultat([], { mois: '2026-10' }).marge).toBeNull()
  })
})

describe('R7 arrondi d’affichage', () => {
  it('sans décimales par défaut, valeur exacte gardée ailleurs', () => {
    expect(arrondi(20000.5)).toBe(20001)
    expect(arrondi('12,345', 2)).toBe(12.35)
  })
})
