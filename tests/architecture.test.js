// Frontières des modules : pas de cycle, la logique du noyau et des domaines (.js) n'importe jamais l'interface,
// et aucune nouvelle dépendance directe entre pages de modules différents (voir docs/MIGRATION.md).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../src')
const fichiers = []
const parcourir = (d) =>
  fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) parcourir(p)
    else if (/\.(js|jsx)$/.test(f)) fichiers.push(p)
  })
parcourir(SRC)
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/')
const resoudre = (de, spec) => {
  const base = path.join(path.dirname(de), spec)
  return ['', '.js', '.jsx', '/index.js'].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
}
const graphe = Object.fromEntries(
  fichiers.map((f) => {
    const src = fs.readFileSync(f, 'utf8')
    const deps = [...src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)].map((m) => resoudre(f, m[1])).filter(Boolean)
    return [rel(f), [...new Set(deps.map(rel))]]
  }),
)

// Module de chaque page (les pages du noyau sont communes)
const PAGES = {
  commercial: ['Journee', 'Objectifs', 'Bilan', 'Hub', 'Prospects', 'Clients', 'Fiche', 'FicheForm', 'Insta', 'Session', 'Scripts', 'Saisie', 'Rapide'],
  facturation: ['Factures', 'Finances'],
  charges: ['Charges'],
  dashboard: ['Dashboard', 'Cockpit', 'DashPlus', 'Drill', 'Tresorerie'],
  agenda: ['Calendrier'],
  site: ['SiteWeb'],
  store: ['Boutique'],
  coeur: ['Parametres', 'Modules', 'Securite', 'Applications', 'Recherche', 'Raccourcis', 'Login'],
}
const MODULE = Object.fromEntries(Object.entries(PAGES).flatMap(([m, l]) => l.map((p) => [`pages/${p}.jsx`, m])))

// Module propriétaire d'un fichier : dossier modules/<id>, ou module de la page
const proprietaire = (f) => (f.startsWith('modules/') ? f.split('/')[1] : MODULE[f] || null)

// Dépendances directes entre modules encore à découpler (la liste ne doit que diminuer)
const DETTE = [
]

describe('architecture', () => {
  it('aucune dépendance circulaire', () => {
    const etat = {}
    const cycles = []
    const pile = []
    const visiter = (n) => {
      etat[n] = 1
      pile.push(n)
      for (const d of graphe[n] || []) {
        if (etat[d] === 1) cycles.push([...pile.slice(pile.indexOf(d)), d].join(' -> '))
        else if (!etat[d]) visiter(d)
      }
      pile.pop()
      etat[n] = 2
    }
    Object.keys(graphe).forEach((n) => !etat[n] && visiter(n))
    expect(cycles).toEqual([])
  })

  it('noyau, bibliothèques et domaines des modules ne dépendent pas de l’interface', () => {
    const interdits = Object.entries(graphe)
      .filter(([f]) => /^(core|lib|modules)\//.test(f) && f.endsWith('.js'))
      .flatMap(([f, deps]) => deps.filter((d) => /^pages\/|^ui\.jsx$|^App\.jsx$|^charts\.jsx$|\.jsx$/.test(d)).map((d) => `${f} -> ${d}`))
    expect(interdits).toEqual([])
  })

  it('le noyau et les bibliothèques communes ne dépendent d’aucun module', () => {
    const versModules = Object.entries(graphe)
      .filter(([f]) => /^(core|lib)\//.test(f))
      .flatMap(([f, deps]) => deps.filter((d) => d.startsWith('modules/')).map((d) => `${f} -> ${d}`))
    expect(versModules).toEqual([])
  })

  it('chaque page est rattachée à un module', () => {
    const pages = Object.keys(graphe).filter((f) => f.startsWith('pages/'))
    expect(pages.filter((p) => !MODULE[p])).toEqual([])
  })

  it('pas de nouvelle dépendance directe entre pages de modules différents', () => {
    const croisees = Object.entries(graphe)
      .filter(([f]) => MODULE[f] && MODULE[f] !== 'coeur')
      .flatMap(([f, deps]) => deps.filter((d) => MODULE[d] && MODULE[d] !== MODULE[f] && MODULE[d] !== 'coeur').map((d) => `${f} -> ${d}`))
      .sort()
    expect(croisees).toEqual([...DETTE].sort())
  })

  it('un module n’est utilisé par les autres que via son contrat (modules/<id>/index.js ou ui.jsx)', () => {
    const internes = Object.entries(graphe).flatMap(([f, deps]) =>
      deps.filter((d) => /^modules\/[^/]+\/(?!(index\.js|ui\.jsx)$)/.test(d) && d.split('/')[1] !== proprietaire(f)).map((d) => `${f} -> ${d}`),
    )
    expect(internes).toEqual([])
  })
  // Étape 3 : useApp (noyau + données fusionnés) ne gagne plus de nouveaux utilisateurs ; on migre vers useNoyau / useDonnees
  it('pas de nouvel utilisateur du contexte fusionné useApp', () => {
    const users = fichiers.filter((f) => fs.readFileSync(f, 'utf8').includes('useApp()')).length
    expect(users).toBeLessThanOrEqual(23)
  })
})
