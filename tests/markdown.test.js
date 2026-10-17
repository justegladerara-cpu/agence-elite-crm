import { describe, it, expect } from 'vitest'
import { champsDe, markdownEnHtml } from '../src/lib/markdown.js'

describe('markdown des documents', () => {
  it('titres, listes, tableaux, gras', () => {
    const h = markdownEnHtml('## Objet\n\nTexte **fort** et *léger*.\n\n- un\n- deux\n\n| A | B |\n|---|---|\n| 1 | 2 |')
    expect(h).toContain('<h2>Objet</h2>')
    expect(h).toContain('<strong>fort</strong>')
    expect(h).toContain('<em>léger</em>')
    expect(h).toContain('<ul><li>un</li><li>deux</li></ul>')
    expect(h).toContain('<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>')
  })
  it('tableau sans en-tête : pas de ligne noire vide', () => {
    expect(markdownEnHtml('| | |\n|---|---|\n| a | b |')).not.toContain('<thead>')
  })
  it('champs : liste sans doublon, remplis ou surlignés', () => {
    const t = 'Entre {{Nom du client}} et {{AE_RCCM}}, le {{Date}} ; {{Nom du client}} signe.'
    expect(champsDe(t)).toEqual(['Nom du client', 'AE_RCCM', 'Date'])
    const h = markdownEnHtml(t, { 'Nom du client': 'Total <SA>' }, { AE_RCCM: 'à compléter : n° RCCM' })
    expect(h).toContain('<span class="md-rempli">Total &lt;SA&gt;</span>')
    expect(h).toContain('<span class="md-champ">à compléter : n° RCCM</span>')
    expect(h).toContain('<span class="md-champ">Date</span>')
  })
  it('aucun HTML saisi n’est exécuté', () => {
    const h = markdownEnHtml('<script>alert(1)</script>\n\n[lien](javascript:alert(1))')
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('href="javascript')
  })
})
