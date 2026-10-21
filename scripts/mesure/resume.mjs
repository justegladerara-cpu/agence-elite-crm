// Résumé lisible d'une ou deux passes de mesure (avant / après), en Markdown.
//   node scripts/mesure/resume.mjs avant [apres]   → affiche les tableaux (à coller dans docs/superadmin-v2/)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lire = (e) => JSON.parse(readFileSync(resolve(import.meta.dirname, '../../docs/superadmin-v2/mesures', `${e}.json`), 'utf8'))
const [a, b] = process.argv.slice(2).map(lire)
const somme = (r, k, f = () => true) => r.mesures.filter(f).reduce((s, m) => s + (Number(m[k]) || 0), 0)
const nb = (r, f) => r.mesures.filter(f).length
const ligne = (cellules) => `| ${cellules.join(' | ')} |`
const totaux = (r) => ({
  mesures: r.mesures.length,
  defilement: nb(r, (m) => m.defilementHorizontal),
  debordants: somme(r, 'debordants'),
  coupes: somme(r, 'ongletsCoupes'),
  erreursJs: somme(r, 'erreursJs') || r.mesures.reduce((s, m) => s + m.exemplesErreurs.filter((e) => e.startsWith('pageerror:')).length, 0),
  console: somme(r, 'erreursConsole'),
  production: somme(r, 'requetesProduction'),
})
const ta = totaux(a)
const tb = b && totaux(b)
console.log(`## Totaux (${a.etiquette}${b ? ` → ${b.etiquette}` : ''})\n`)
console.log(ligne(['Indicateur', a.etiquette, ...(b ? [b.etiquette] : [])]))
console.log(ligne(['---', '---:', ...(b ? ['---:'] : [])]))
for (const [k, l] of [['mesures', 'Mesures (écran × largeur)'], ['defilement', 'Écrans avec défilement horizontal'], ['debordants', 'Éléments qui débordent'], ['coupes', 'Onglets coupés'], ['erreursJs', 'Erreurs JavaScript'], ['console', 'Messages d’erreur console (tous)'], ['production', 'Requêtes vers une base de production']])
  console.log(ligne([l, ta[k], ...(b ? [tb[k]] : [])]))
for (const largeur of [390, 1280]) {
  console.log(`\n## Boutons et champs visibles à ${largeur} px (zone principale / page entière)\n`)
  console.log(ligne(['Écran', `Boutons ${a.etiquette}`, ...(b ? [`Boutons ${b.etiquette}`] : []), `Champs ${a.etiquette}`, ...(b ? [`Champs ${b.etiquette}`] : [])]))
  console.log(ligne(['---', '---:', ...(b ? ['---:'] : []), '---:', ...(b ? ['---:'] : [])]))
  for (const m of a.mesures.filter((x) => x.largeur === largeur)) {
    const n = b?.mesures.find((x) => x.largeur === largeur && x.route === m.route)
    console.log(ligne([m.route, `${m.boutonsZonePrincipale} / ${m.boutons}`, ...(b ? [n ? `${n.boutonsZonePrincipale} / ${n.boutons}` : '—'] : []), `${m.champsZonePrincipale}`, ...(b ? [n ? `${n.champsZonePrincipale}` : '—'] : [])]))
  }
}
