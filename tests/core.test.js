import { describe, it, expect } from 'vitest'
import { MODULES, estActif, pageAccessible, basculer, moduleDePage, dependantsDe } from '../src/core/modules'
import { permissionsDe, peut, TOUTES } from '../src/core/permissions'
import { evenements, evenementDAction, evenementDeDocument, emettre, ecouter, typeAction } from '../src/core/events'
import { DEFAULT_SETTINGS } from '../src/lib/defaults'

describe('registre des modules', () => {
  it('chaque page appartient à un seul module et les dépendances existent', () => {
    const pages = MODULES.flatMap((m) => m.pages)
    expect(new Set(pages).size).toBe(pages.length)
    const ids = new Set(MODULES.map((m) => m.id))
    MODULES.forEach((m) => [...m.dependances.requis, ...m.dependances.optionnels].forEach((d) => expect(ids.has(d)).toBe(true)))
  })
  it('tout est actif par défaut, sans réglage', () => {
    MODULES.forEach((m) => expect(estActif(m.id, {})).toBe(true))
    expect(pageAccessible('factures', undefined)).toBe(true)
  })
  it('désactiver un module masque ses pages mais pas celles des autres', () => {
    const s = { modules: { facturation: false } }
    expect(pageAccessible('factures', s)).toBe(false)
    expect(pageAccessible('facture', s)).toBe(false)
    expect(pageAccessible('journee', s)).toBe(true)
    expect(pageAccessible('page-inconnue', s)).toBe(true)
  })
  it('les modules du cœur ne se désactivent pas', () => {
    const s = { modules: { dashboard: false, parametres: false } }
    expect(pageAccessible('dashboard', s)).toBe(true)
    expect(pageAccessible('parametres', s)).toBe(true)
    expect(basculer('dashboard', false, {}).modules.dashboard).toBeUndefined()
  })
  it('une dépendance forte désactive le module dépendant, une optionnelle non', () => {
    const s = { modules: { site: false } }
    expect(estActif('store', s)).toBe(false)
    expect(estActif('commercial', { modules: { agenda: false } })).toBe(true)
    expect(dependantsDe('site', {}).map((m) => m.id)).toEqual(['store'])
  })
  it('basculer signale ce qui est entraîné et réactive les requis', () => {
    const off = basculer('site', false, {})
    expect(off.modules.site).toBe(false)
    expect(off.entraines).toEqual(['store'])
    const on = basculer('store', true, { modules: { site: false, store: false } })
    expect(on.modules).toEqual({})
    expect(on.entraines).toEqual(['site'])
  })
  it('retrouve le module d’une page', () => {
    expect(moduleDePage('boutique').id).toBe('store')
    expect(moduleDePage('xyz')).toBeNull()
  })
})

describe('permissions', () => {
  it('propriétaire a tout, lecteur ne fait que voir', () => {
    expect(permissionsDe('proprietaire')).toEqual(TOUTES)
    expect(peut('lecteur', 'billing.view')).toBe(true)
    expect(peut('lecteur', 'billing.edit')).toBe(false)
    expect(peut('membre', 'settings.edit')).toBe(false)
    expect(peut('admin', 'security.manage')).toBe(false)
    expect(peut('inconnu', 'billing.view')).toBe(false)
  })
})

describe('événements métier', () => {
  it('chaque action des réglages a un type connu ou est volontairement ignorée', () => {
    const ignorees = DEFAULT_SETTINGS.actions.filter((a) => !typeAction(a.nom)).map((a) => a.nom)
    ignorees.forEach((n) => expect(n).toMatch(/^(Onboarding|Note|Demande d'avis|Satisfaction|Résiliation)/))
  })
  it('dérive paiements, dépenses et étapes des actions', () => {
    const p = evenementDAction({ id: 'a1', prospect_id: 'p1', date: '2026-09-01', action: 'Paiement reçu', montant: 1000, facture: 'FAC-1' })
    expect(p).toMatchObject({ type: 'payment.received', module: 'facturation', entite: 'paiement', entiteId: 'a1', correlationId: 'facture:FAC-1' })
    expect(evenementDAction({ id: 'a2', date: '2026-09-02', action: 'Dépense', montant: 50 })).toMatchObject({ type: 'expense.created', module: 'charges' })
    expect(evenementDAction({ id: 'a3', prospect_id: 'p1', date: '2026-09-03', action: 'Qualification' })).toMatchObject({ type: 'prospect.qualified', entiteId: 'p1', correlationId: 'prospect:p1' })
    expect(evenementDAction({ id: 'a4', action: 'Note', date: '2026-09-03' })).toBeNull()
  })
  it('dérive devis et factures, trie le fil par date', () => {
    const f = evenementDeDocument({ id: 'd1', type: 'facture', numero: 'FAC-1', data: { date: '2026-08-30' } })
    expect(f).toMatchObject({ type: 'invoice.created', correlationId: 'facture:FAC-1' })
    expect(evenementDeDocument({ id: 'j', type: 'journee', numero: '2026-09-01' })).toBeNull()
    const fil = evenements([{ id: 'a1', date: '2026-09-01', action: 'Paiement reçu', facture: 'FAC-1' }], [{ id: 'd1', type: 'facture', numero: 'FAC-1', data: { date: '2026-08-30' } }])
    expect(fil.map((e) => e.type)).toEqual(['invoice.created', 'payment.received'])
  })
  it('le bus livre selon le motif et survit à un abonné en erreur', () => {
    const recus = []
    const stop1 = ecouter('payment.*', (e) => recus.push(e.type))
    const stop2 = ecouter('*', () => {
      throw new Error('x')
    })
    const orig = console.error
    console.error = () => {}
    emettre({ type: 'payment.received' })
    emettre({ type: 'expense.created' })
    console.error = orig
    stop1()
    stop2()
    emettre({ type: 'payment.received' })
    expect(recus).toEqual(['payment.received'])
  })
})

import { chercherFiches, nomExiste } from '../src/core/relations'

describe('relations : recherche de fiche', () => {
  const liste = [
    { id: 1, name: 'Boulangerie Mavoungou', fiche: { contact: 'Aline', telephone: '06 612 34 56' }, derniereAction: '2026-09-01' },
    { id: 2, name: 'Garage Nkaya', fiche: { contact: 'Paul' }, derniereAction: '2026-09-20' },
    { id: 3, name: 'Hôtel Olympic', fiche: {}, derniereAction: '' },
  ]
  it('cherche par nom, contact ou téléphone (espaces ignorés), les plus récents d’abord', () => {
    expect(chercherFiches(liste, 'garage').map((p) => p.id)).toEqual([2])
    expect(chercherFiches(liste, 'aline').map((p) => p.id)).toEqual([1])
    expect(chercherFiches(liste, '0661234').map((p) => p.id)).toEqual([1])
    expect(chercherFiches(liste, '').map((p) => p.id)).toEqual([2, 1, 3])
    expect(chercherFiches(liste, '', 2)).toHaveLength(2)
  })
  it('reconnaît un nom déjà pris', () => {
    expect(nomExiste(liste, ' garage nkaya ')).toBe(true)
    expect(nomExiste(liste, 'Garage')).toBe(false)
  })
})

import { listeRappels } from '../src/lib/rappels'
import { addDays, today } from '../src/lib/dates'

describe('rappels : l’état des factures vient du module Facturation', () => {
  const demain = addDays(today(), 1)
  const docs = [{ id: 'f1', type: 'facture', numero: 'FAC-1', data: { echeance: demain, client: { nom: 'X' } } }]
  const data = { list: [] }
  it('sans module Facturation branché : aucun rappel de facture', () => {
    expect(listeRappels(data, {}, docs, [])).toEqual([])
  })
  it('facture non payée : rappel ; payée : aucun', () => {
    expect(listeRappels(data, {}, docs, [], () => 'Envoyée').map((r) => r.cle)).toEqual([`facture-f1-${demain}`])
    expect(listeRappels(data, {}, docs, [], () => 'Payée')).toEqual([])
  })
})

import { pastillesFacturation } from '../src/modules/facturation'
import { pastillesCommercial } from '../src/modules/commercial'

describe('pastilles déclarées par les modules', () => {
  it('Facturation : devis en attente (ni facturé, ni tranché, ni expiré)', () => {
    const docs = [
      { type: 'devis', data: {} },
      { type: 'devis', data: { statut: 'Accepté' } },
      { type: 'devis', data: { factureNumero: 'FAC-1' } },
      { type: 'devis', data: { validite: '2026-01-01' } },
    ]
    expect(pastillesFacturation({ documents: docs, actions: [] }, '2026-09-29')).toEqual({ factures: [0, 'hot', 'factures en retard'], devis: [1, '', 'devis en attente'] })
  })
  it('Commercial : relances et clients à surveiller', () => {
    expect(pastillesCommercial({ data: { aRelancer: [1, 2], clientsAlertes: [] } })).toEqual({ journee: [2, 'hot', 'relances à faire'], clients: [0, '', 'clients à surveiller'] })
  })
})
