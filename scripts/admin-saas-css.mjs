// Génère src/saas/saas.css : la feuille de style de l'administration de la plateforme (anciennement l'espace
// Super Admin de saas.agence-elite.fr), enfermée dans .saas-admin pour ne rien changer au reste du CRM.
// :root devient .saas-admin, le thème sombre devient .saas-admin.sombre ; les réglages d'affichage du SaaS
// (contraste, taille du texte, tactile, thème « auto ») ne servent pas ici et sont retirés.
// Usage : node scripts/admin-saas-css.mjs <chemin vers agence-elite-platform/src/styles.css>
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const source = process.argv[2]
if (!source) throw new Error('Chemin de styles.css de la plateforme manquant')
const cible = path.join(racine, 'src/saas/saas.css')
const P = '.saas-admin'

function portee(s) {
  s = s.trim()
  if (/^:root\[data-(contraste|texte|tactile)/.test(s) || /\[data-theme='auto'\]/.test(s)) return null
  if (/^(html|#root)$/.test(s)) return null
  const sombre = /^:root\[data-theme='sombre'\]\s*/
  if (sombre.test(s)) {
    const reste = s.replace(sombre, '').replace(/^body\b\s*/, '')
    return reste ? `${P}.sombre ${reste}` : `${P}.sombre`
  }
  if (/^:root\b/.test(s)) {
    const reste = s.replace(/^:root/, '').trim()
    return reste ? `${P} ${reste}` : P
  }
  if (/^body\b/.test(s)) return s.replace(/^body/, P)
  return `${P} ${s}`
}

const css = postcss.parse(fs.readFileSync(source, 'utf8'))
css.walkRules((r) => {
  if (r.parent?.type === 'atrule' && /keyframes/i.test(r.parent.name)) return
  const sels = r.selectors.map(portee).filter(Boolean)
  if (!sels.length) return r.remove()
  r.selectors = sels
})
// Hauteur pleine page du SaaS : sans objet dans une page du CRM
css.walkRules((r) => {
  if (r.selector === P) r.walkDecls('height', (d) => d.remove())
  if (!r.nodes.length) r.remove()
})
css.walkAtRules((a) => {
  if (!a.nodes?.length && a.nodes) a.remove()
})
const entete = `/* FICHIER GÉNÉRÉ par scripts/admin-saas-css.mjs : ne pas modifier à la main. */\n`
fs.writeFileSync(cible, entete + css.toString() + '\n')
console.log('saas.css :', css.nodes.length, 'nœuds')
