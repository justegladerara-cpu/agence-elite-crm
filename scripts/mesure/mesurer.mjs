// Mesures reproductibles de l'interface, avant et après la refonte, sur la prévisualisation locale sans donnée réelle.
//   node scripts/mesure/mesurer.mjs --etiquette avant [--largeurs 390,1280] [--routes controle,factures] [--captures] [--sans-build]
// Pour chaque route et chaque largeur : boutons et champs visibles (page entière et zone principale), défilement
// horizontal, éléments qui débordent de l'écran, onglets coupés, erreurs console, requêtes vers une base de production.
// Résultat : docs/superadmin-v2/mesures/<etiquette>.json (+ captures dans docs/superadmin-v2/CAPTURES/<etiquette>/).
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { demarrer, sessionFictive, rpcFictif, URL_CRM, URL_PLATEFORME, RACINE } from './apercu-local.mjs'
import { ROUTES, LARGEURS, HAUTEUR } from './routes.mjs'

const arg = (nom, def) => {
  const i = process.argv.indexOf(`--${nom}`)
  return i < 0 ? def : process.argv[i + 1]
}
const etiquette = arg('etiquette', 'mesure')
const largeurs = arg('largeurs') ? arg('largeurs').split(',').map(Number) : LARGEURS
const filtre = arg('routes') ? arg('routes').split(',') : null
const captures = process.argv.includes('--captures')
const largeursCaptures = (arg('captures-largeurs') || '390,1280').split(',').map(Number)
const BASES = /mylgnsuoppplmfaanyze|xrlfedosaqtffraadmgk/

// Exécuté dans la page : tout ce qui se compte
function compter() {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !el.closest('[hidden],[aria-hidden="true"],[inert]')
  }
  const BOUTONS = 'button, [role="button"], a.btn, input[type="submit"], input[type="button"]'
  const CHAMPS = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]), select, textarea'
  const main = document.querySelector('.main') || document.body
  const dansModale = document.querySelector('.modal-bg')
  const boutons = [...document.querySelectorAll(BOUTONS)].filter(visible)
  const champs = [...document.querySelectorAll(CHAMPS)].filter(visible)
  const largeur = document.documentElement.clientWidth
  // Débordement : élément visible qui sort de l'écran sans qu'un parent ne le fasse défiler ou ne le coupe
  const coupeParParent = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if (o !== 'visible') return true
    }
    return false
  }
  const debordants = [...document.querySelectorAll('body *')]
    .filter((el) => el.children.length === 0 || el.matches('button, a, input, select, textarea, img, svg'))
    .filter((el) => {
      if (!visible(el) || el.closest('svg') !== null && !el.matches('svg')) return false
      const r = el.getBoundingClientRect()
      return (r.right > largeur + 1 || r.left < -1) && !coupeParParent(el) && getComputedStyle(el).position !== 'fixed'
    })
  const nom = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}${el.textContent?.trim() ? ` « ${el.textContent.trim().slice(0, 24)} »` : ''}`
  // Onglets : texte tronqué (ellipse), ou onglet à moitié visible au bord de l'écran (« Fina », « Scri »)
  const onglets = [...document.querySelectorAll('[role="tab"], .ptabs button, .app-onglets button, .bottom-nav button')].filter(visible)
  const coupes = onglets.filter((el) => {
    const r = el.getBoundingClientRect()
    return el.scrollWidth > el.clientWidth + 1 || (r.left < largeur - 1 && r.right > largeur + 1)
  })
  return {
    titre: document.querySelector('h1')?.textContent?.trim() || '',
    boutons: boutons.length,
    boutonsZonePrincipale: boutons.filter((b) => main.contains(b)).length,
    champs: champs.length,
    champsZonePrincipale: champs.filter((c) => main.contains(c)).length,
    defilementHorizontal: document.documentElement.scrollWidth > largeur + 1,
    debordants: debordants.length,
    exemplesDebordants: debordants.slice(0, 8).map(nom),
    ongletsCoupes: coupes.length,
    exemplesCoupes: coupes.slice(0, 5).map(nom),
    modaleOuverte: !!dansModale,
  }
}

const serveurs = await demarrer({ construireAvant: !process.argv.includes('--sans-build') })
const resultats = { etiquette, date: new Date().toISOString(), plateforme: (await (await fetch(`${URL_PLATEFORME}/__etat`)).json()).plateforme, mesures: [] }
try {
  const session = await sessionFictive()
  const vue = await rpcFictif('editeur_vue', {}, session)
  const client = (vue.clients || []).find((c) => c.nom === 'Bar Fictif Horizon')?.id
  const navigateur = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const dossierCaptures = resolve(RACINE, 'docs/superadmin-v2/CAPTURES', etiquette)
  if (captures) mkdirSync(dossierCaptures, { recursive: true })
  for (const largeur of largeurs) {
    const contexte = await navigateur.newContext({ viewport: { width: largeur, height: HAUTEUR(largeur) }, locale: 'fr-FR', timezoneId: 'Africa/Brazzaville', isMobile: largeur < 768, hasTouch: largeur < 1024, reducedMotion: 'reduce' })
    await contexte.addInitScript((s) => localStorage.setItem('aecrm-plateforme', JSON.stringify(s)), session)
    const page = await contexte.newPage()
    let erreurs = []
    let versProduction = []
    page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text().slice(0, 160)))
    page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message.slice(0, 160)}`))
    page.on('request', (r) => BASES.test(r.url()) && versProduction.push(r.url()))
    // Premier passage : les exemples fictifs se chargent dans le navigateur
    await page.goto(`${URL_CRM}/#/dashboard`)
    await page.waitForLoadState('networkidle')
    for (const [nomRoute, route] of ROUTES) {
      if (filtre && !filtre.includes(nomRoute)) continue
      erreurs = []
      versProduction = []
      const cible = route.replace('{client}', client || 'inconnu')
      const t0 = Date.now()
      await page.goto(`${URL_CRM}/#/${cible}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      // Fin des chargements (plateforme fictive, pages différées) avant de compter
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !/Chargement…/.test(document.querySelector('.main')?.innerText || ''), null, { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(300)
      const m = await page.evaluate(compter)
      if (captures && largeursCaptures.includes(largeur)) await page.screenshot({ path: resolve(dossierCaptures, `${nomRoute}-${largeur}.jpg`), fullPage: true, type: 'jpeg', quality: 60 })
      // Ressource externe refusée (images en ligne : le bac à sable n'a pas internet) comptée à part des erreurs JS
      const externes = erreurs.filter((e) => /Failed to load resource/.test(e)).length
      const js = erreurs.filter((e) => e.startsWith('pageerror:')).length
      resultats.mesures.push({ route: nomRoute, chemin: route, largeur, ms: Date.now() - t0, ...m, erreursConsole: erreurs.length, erreursJs: js, ressourcesRefusees: externes, exemplesErreurs: erreurs.slice(0, 3), requetesProduction: versProduction.length })
    }
    await contexte.close()
    process.stdout.write(`${largeur} px ✓  `)
  }
  await navigateur.close()
} finally {
  serveurs.arreter()
}
const sortie = resolve(RACINE, 'docs/superadmin-v2/mesures')
mkdirSync(sortie, { recursive: true })
writeFileSync(resolve(sortie, `${etiquette}.json`), JSON.stringify(resultats, null, 1))
const m = resultats.mesures
console.log(`\n${m.length} mesures · défilement horizontal : ${m.filter((x) => x.defilementHorizontal).length} · débordants : ${m.reduce((s, x) => s + x.debordants, 0)} · onglets coupés : ${m.reduce((s, x) => s + x.ongletsCoupes, 0)} · erreurs console : ${m.reduce((s, x) => s + x.erreursConsole, 0)} (dont JS : ${m.reduce((s, x) => s + (x.erreursJs || 0), 0)}) · requêtes vers la production : ${m.reduce((s, x) => s + x.requetesProduction, 0)}`)
