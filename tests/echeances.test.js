import { describe, expect, it } from 'vitest'
import { aTraiter, baseEnRetard, joursTexte, libellePalier, lirePaliers, parMois } from '../src/modules/plateforme/echeances'

// Échéances des licences (Elite License Guard) : calculs de l'écran CRM « Échéances des licences »
const l = (id, etat, jours, echeance) => ({ licence_id: id, etat, jours, echeance })

describe('échéances des licences', () => {
  it('« À traiter » met les expirées en premier et laisse de côté ce qui va bien', () => {
    const liste = [l('a', 'bientot', 20), l('b', 'urgent', 3), l('c', 'expiree', -20), l('d', 'grace', -2), l('e', 'urgent', 1), l('f', 'a_jour', 90)]
    expect(aTraiter(liste).map((x) => x.licence_id)).toEqual(['c', 'd', 'e', 'b'])
  })

  it('le calendrier regroupe par mois, dans l’ordre des dates, sans les licences sans échéance', () => {
    const mois = parMois([l('a', 'urgent', 3, '2026-11-03'), l('b', 'bientot', 20, '2026-10-30'), l('c', 'sans_echeance', null, null), l('d', 'a_jour', 40, '2026-11-01')])
    expect(mois.map((m) => [m.cle, m.liste.map((x) => x.licence_id)])).toEqual([
      ['2026-10', ['b']],
      ['2026-11', ['d', 'a']],
    ])
  })

  it('paliers : saisie libre, nombres entiers uniques, bornés', () => {
    expect(lirePaliers('30, 15 7;7 0 -3').paliers).toEqual([30, 15, 7, 0, -3])
    expect(lirePaliers('').erreur).toBeTruthy()
    expect(lirePaliers('7, 2.5').erreur).toMatch(/entiers/)
    expect(lirePaliers('500').erreur).toMatch(/-60/)
    expect([7, 0, -3].map(libellePalier)).toEqual(['J-7', 'Jour J', 'J+3'])
  })

  it('textes courts et migration absente reconnue', () => {
    expect([5, 0, -2, null].map(joursTexte)).toEqual(['dans 5 j', 'aujourd’hui', 'échue depuis 2 j', '—'])
    expect(baseEnRetard('Could not find the function public.editeur_echeances in the schema cache')).toBe(true)
    expect(baseEnRetard('Permission refusée')).toBe(false)
  })
})

describe('licence à vie', () => {
  it('affiche « À vie » pour une acquisition sans échéance', async () => {
    const { aVie, etatAffiche } = await import('../src/modules/plateforme/echeances.js')
    const l = { formule: 'acquisition', echeance: null, etat: 'sans_echeance' }
    expect(aVie(l)).toBe(true)
    expect(etatAffiche(l)).toEqual(['À vie', 'b-green'])
    expect(aVie({ formule: 'annuel', echeance: '2027-10-29' })).toBe(false)
    expect(etatAffiche({ ...l, etat: 'suspendue' })[0]).toBe('Suspendue')
  })
})
