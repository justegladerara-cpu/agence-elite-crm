import { describe, expect, test } from 'vitest'
import { codesDuClient, lienFacture, lienWhatsApp, lignePreremplie, messageCode, modeleParDefaut, modelesPour } from '../src/modules/plateforme/codes'

const modeles = [
  { id: 'e', nom: 'Essai', formule: 'essai', duree_jours: 30, montant: 0, solution_id: 'commerce', actif: true },
  { id: 'm', nom: 'Mensuel', formule: 'mensuel', montant: 25000, solution_id: 'commerce', actif: true },
  { id: 'a', nom: 'Annuel', formule: 'annuel', montant: 150000, solution_id: 'commerce', actif: true },
  { id: 'h', nom: 'Hôtel annuel', formule: 'annuel', montant: 300000, solution_id: 'hotel', actif: true },
  { id: 'x', nom: 'Retiré', formule: 'annuel', montant: 1, solution_id: 'commerce', actif: false },
]

describe('codes de licence', () => {
  test('modèles de la solution, actifs, annuel d’abord et choisi par défaut', () => {
    const l = modelesPour(modeles, { solution_id: 'commerce' })
    expect(l.map((m) => m.id)).toEqual(['a', 'm', 'e'])
    expect(modeleParDefaut(l).id).toBe('a')
    expect(modelesPour(modeles, {}).length).toBe(4)
  })

  test('facture préremplie : ligne au prix du modèle avec le code', () => {
    const url = lienFacture({ fiche: { id: 'f1' }, client: { nom: 'Bar Fictif' }, etablissement: { nom: 'Bar Fictif' }, modele: modeles[2], cle: 'ELITE-COM-AB12-CD34' })
    const p = new URLSearchParams(url.split('?')[1])
    expect(p.get('p')).toBe('f1')
    expect(p.get('client')).toBeNull()
    const l = lignePreremplie(p)
    expect(l).toEqual({ designation: 'Licence Annuel (1 an)', description: 'Code d’activation ELITE-COM-AB12-CD34', qte: 1, pu: 150000 })
    const sansFiche = new URLSearchParams(lienFacture({ client: { nom: 'Bar Fictif' }, modele: modeles[0], cle: 'K' }).split('?')[1])
    expect(sansFiche.get('client')).toBe('Bar Fictif')
    expect(lignePreremplie(sansFiche).pu).toBe('')
    expect(lignePreremplie(new URLSearchParams('type=facture'))).toBeNull()
  })

  test('message et lien WhatsApp', () => {
    const t = messageCode({ cle: 'ELITE-COM-AB12-CD34', modele: modeles[2], etablissement: { nom: 'Bar Fictif' } })
    expect(t).toContain('ELITE-COM-AB12-CD34')
    expect(t).toContain('1 an')
    expect(lienWhatsApp('+242 06 000 00 00', 'a b')).toBe('https://wa.me/242060000000?text=a%20b')
  })

  test('codes du client : par nom ou par établissement activé', () => {
    const cles = [{ cle: '1', client_nom: 'bar fictif ' }, { cle: '2', etablissement_id: 'e1' }, { cle: '3', client_nom: 'Autre' }]
    expect(codesDuClient(cles, { nom: 'Bar Fictif', etablissements: [{ id: 'e1' }] }).map((k) => k.cle)).toEqual(['1', '2'])
  })
})
