// Chiffres animés du tableau de bord : lecture du nombre d'un texte formaté et valeurs intermédiaires
import { describe, it, expect } from 'vitest'
import { lireNombre, texteIntermediaire, mouvementReduit } from '../src/animations.jsx'

describe('animations des chiffres', () => {
  it('lit le nombre d’un texte formaté', () => {
    expect(lireNombre('12 500 FCFA')).toMatchObject({ valeur: 12500, decimales: 0, avant: '', apres: ' FCFA' })
    expect(lireNombre('87 %')).toMatchObject({ valeur: 87, apres: ' %' })
    expect(lireNombre('3,5 h')).toMatchObject({ valeur: 3.5, decimales: 1 })
    expect(lireNombre('€ 1 234,50')).toMatchObject({ valeur: 1234.5, decimales: 2, avant: '€ ' })
    expect(lireNombre('—')).toBeNull()
    expect(lireNombre(undefined)).toBeNull()
  })

  it('valeurs intermédiaires dans le même format, puis plus rien à la fin', () => {
    const n = lireNombre('12 500 FCFA')
    expect(texteIntermediaire(n, 0)).toBe('0 FCFA')
    expect(texteIntermediaire(n, 0.5)).toBe('6 250 FCFA')
    expect(texteIntermediaire(n, 1)).toBeNull()
  })

  it('pas d’animation sans navigateur', () => {
    expect(mouvementReduit()).toBe(true)
  })
})
