import { describe, it, expect } from 'vitest'
import { MODULES, estActif, pageAccessible, basculer, moduleDePage, dependantsDe, sectionAccessible } from '../src/core/modules'
import { permissionsDe, peut, TOUTES, refusDe, peutGerer } from '../src/core/permissions'
import { evenements, evenementDAction, evenementDeDocument, emettre, ecouter, typeAction } from '../src/core/events'
import { DEFAULT_SETTINGS } from '../src/lib/defaults'
import { depuisLigne, comparerJournal, fusionner, lireJournal, contenuDifferent } from '../src/core/journal'

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

describe('Step 6B : droits par rôle dans l’interface', () => {
  it('propriétaire et admin : tout ; rôle inconnu (local, hors ligne) : comme le propriétaire', () => {
    for (const r of ['proprietaire', 'admin', undefined]) for (const op of ['ecrire', 'supprimer', 'reglages', 'remplacer']) expect(refusDe(r, op, 'autre', 'moi')).toBeNull()
    expect(peutGerer(undefined)).toBe(true)
    expect(peutGerer('proprietaire')).toBe(true)
    expect(peutGerer('admin')).toBe(true)
  })
  it('membre : écrit, supprime le sien, pas celui des autres, ni les réglages', () => {
    expect(refusDe('membre', 'ecrire')).toBeNull()
    expect(refusDe('membre', 'supprimer', 'moi', 'moi')).toBeNull()
    expect(refusDe('membre', 'supprimer', 'autre', 'moi')).toMatch(/Seuls le propriétaire/)
    expect(refusDe('membre', 'reglages')).toMatch(/réglages/)
    expect(refusDe('membre', 'remplacer')).toMatch(/remplacer/)
    expect(peutGerer('membre')).toBe(false)
    expect(peutGerer('lecteur')).toBe(false)
  })
  it('lecteur : lecture seule partout', () => {
    for (const op of ['ecrire', 'supprimer', 'reglages', 'remplacer']) expect(refusDe('lecteur', op, 'moi', 'moi')).toMatch(/^Lecture seule/)
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

describe('sections de Paramètres par module', () => {
  it('masque la section d’un module désactivé, garde les sections communes', () => {
    expect(sectionAccessible('scripts', {})).toBe(true)
    expect(sectionAccessible('scripts', { modules: { commercial: false } })).toBe(false)
    expect(sectionAccessible('rappels', { modules: { agenda: false } })).toBe(false)
    expect(sectionAccessible('identite', { modules: { commercial: false, agenda: false } })).toBe(true)
  })
})

describe('journal d’événements (Lot B)', () => {
  const actions = [
    { id: 'a1', action: 'Paiement reçu', date: '2026-09-01', montant: 1000, facture: 'F1', prospect_id: 'p1' },
    { id: 'a2', action: 'Signature', date: '2026-08-30', prospect_id: 'p1' },
    { id: 'a3', action: 'Dépense', date: '2026-09-02', montant: 200, prospect_id: 'p1' },
    { id: 'a4', action: 'Note', date: '2026-09-02', prospect_id: 'p1' },
  ]
  const documents = [{ id: 'd1', type: 'facture', numero: 'F1', prospect_id: 'p1', data: { date: '2026-08-31' } }, { id: 'd2', type: 'devis', numero: 'D1', prospect_id: 'p2', data: {} }]
  const ligne = (e) => ({ source: e.id, type: e.type, date: e.date, acteur: null, module: e.module, entite: e.entite, entite_id: e.entiteId, meta: e.meta, correlation_id: e.correlationId })
  it('une ligne de la table redonne l’événement calculé', () => {
    const derives = evenements(actions, documents)
    expect(derives.map((e) => depuisLigne(ligne(e)))).toEqual(derives)
  })
  it('comparer : identique = aucun écart ; manquant, en trop et montant détectés', () => {
    const derives = evenements(actions, documents)
    const serveur = derives.map(ligne).map((l) => ({ ...l, id: l.source }))
    const ok = comparerJournal(serveur, derives)
    expect([ok.manquants, ok.enTrop, ok.typeDifferent]).toEqual([[], [], []])
    expect(ok.paiements).toEqual([1000, 1000])
    expect(ok.depenses).toEqual([200, 200])
    const ko = comparerJournal([...serveur.slice(1), { id: 'action:x', type: 'payment.received', meta: { montant: 5 } }], derives)
    expect(ko.manquants).toHaveLength(1)
    expect(ko.enTrop).toEqual(['action:x'])
  })
  it('fusion : garde les modifs locales non envoyées, retire les suppressions locales', () => {
    const derives = evenements(actions, documents)
    const serveur = [{ ...derives[0], meta: { ...derives[0].meta, serveur: true } }, { id: 'action:supprimee', type: 'prospect.contacted', date: '2026-01-01', meta: {} }]
    const f = fusionner(serveur, derives)
    expect(f.map((e) => e.id)).toEqual(derives.map((e) => e.id))
    expect(f.find((e) => e.id === derives[0].id).meta.serveur).toBe(true)
  })
  it('Step 6A : une modification (montant, date) est détectée et l’état local prime tant qu’elle n’est pas reflétée', () => {
    const derives = evenements(actions, documents)
    const serveur = derives.map(ligne).map((l) => depuisLigne({ ...l, version: 1 }))
    const pay = derives.find((e) => e.type === 'payment.received')
    expect(comparerJournal(serveur, derives).contenuDifferent).toEqual([])
    const modifie = derives.map((e) => (e.id === pay.id ? { ...e, date: '2026-09-05', meta: { ...e.meta, montant: 1500 } } : e))
    const r = comparerJournal(serveur, modifie)
    expect(r.contenuDifferent).toEqual([pay.id])
    expect(r.paiements).toEqual([1500, 1000])
    expect(fusionner(serveur, modifie).find((e) => e.id === pay.id).meta.montant).toBe(1500)
    const aJour = serveur.map((e) => (e.id === pay.id ? { ...e, date: '2026-09-05', meta: { ...e.meta, montant: 1500 }, version: 2, modifieLe: '2026-09-29T12:00:00Z' } : e))
    expect(comparerJournal(aJour, modifie).contenuDifferent).toEqual([])
    expect(fusionner(aJour, modifie).find((e) => e.id === pay.id).version).toBe(2)
    expect(contenuDifferent({ type: 't', date: '2026-01-01', meta: { montant: '10' } }, { type: 't', date: '2026-01-01', meta: { montant: 10, facture: '' } })).toBe(false)
  })
  it('lireJournal sans base : repli sur le calcul, filtré par client', async () => {
    const r = await lireJournal({ prospectId: 'p1', actions, documents })
    expect(r.source).toBe('calcul')
    expect(r.liste.map((e) => e.type)).toEqual(['client.won', 'invoice.created', 'payment.received', 'expense.created'])
  })
})
