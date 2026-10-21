// Tailles des fichiers produits par le build (octets bruts et compressés gzip), pour comparer avant / après.
//   node scripts/mesure/tailles.mjs [dossier dist]   (par défaut : dist)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const dossier = resolve(process.argv[2] || 'dist', 'assets')
const fichiers = readdirSync(dossier).map((nom) => {
  const contenu = readFileSync(join(dossier, nom))
  return { nom, octets: statSync(join(dossier, nom)).size, gzip: gzipSync(contenu).length }
})
const somme = (l, k) => l.reduce((s, f) => s + f[k], 0)
const js = fichiers.filter((f) => f.nom.endsWith('.js'))
const css = fichiers.filter((f) => f.nom.endsWith('.css'))
const initial = js.filter((f) => /^index-[\w-]+\.js$/.test(f.nom))
const cssInitial = css.filter((f) => /^index-[\w-]+\.css$/.test(f.nom))
const ko = (n) => `${(n / 1000).toFixed(1)} ko`
const r = {
  jsInitial: { octets: somme(initial, 'octets'), gzip: somme(initial, 'gzip') },
  cssInitial: { octets: somme(cssInitial, 'octets'), gzip: somme(cssInitial, 'gzip') },
  jsTotal: { octets: somme(js, 'octets'), gzip: somme(js, 'gzip'), fichiers: js.length },
  cssTotal: { octets: somme(css, 'octets'), gzip: somme(css, 'gzip'), fichiers: css.length },
  plusGros: [...js].sort((a, b) => b.octets - a.octets).slice(0, 6).map((f) => `${f.nom} ${ko(f.octets)}`),
}
console.log(JSON.stringify(r, null, 1))
console.log(`JS initial ${ko(r.jsInitial.octets)} (gzip ${ko(r.jsInitial.gzip)}) · CSS initial ${ko(r.cssInitial.octets)} (gzip ${ko(r.cssInitial.gzip)}) · JS total ${ko(r.jsTotal.octets)} en ${r.jsTotal.fichiers} fichiers`)
