#!/usr/bin/env node
// Mesure de performance reproductible du site vitrine (avant / après), sans dépendance ajoutée (Playwright du dépôt).
//
// Usage :
//   node site/build.mjs site-dist
//   node site/scripts/mesure.cjs --dir site-dist --out mesure.json [--runs 3] [--cache dossier]
//
// Méthode (détaillée dans site/docs/motion/MOTION_PERFORMANCE.md) :
// - petit serveur statique local (gzip pour HTML/CSS/JS/SVG/JSON, comme un CDN) ;
// - Chromium sans interface piloté par Playwright, contexte neuf à chaque passage (cache vide) ;
// - 3 scénarios : « bureau » (1366×860, sans bridage), « cpu4x » (390×844, processeur ÷4),
//   « mobile-3g » (390×844, processeur ÷4 + réseau RTT 300 ms, 750 kbit/s descendant, 250 kbit/s montant) ;
// - ressources tierces rejouées localement pour être reproductibles : Google Fonts (CSS + woff2 téléchargés une fois
//   dans --cache), photos Unsplash remplacées par une image locale de taille fixe (Unsplash est injoignable depuis
//   le poste de mesure), API Supabase coupée. Elles passent par un serveur HTTPS local, donc par le même réseau bridé ;
// - FCP, LCP (avant tout défilement), CLS (fenêtres de session, chargement + défilement complet), tâches longues et TBT
//   (somme des dépassements de 50 ms entre FCP et la fin de la mesure), intervalle d'images p95 et part des images > 25 ms pendant le défilement,
//   octets transférés par type de ressource. Médiane de --runs passages.
// - --captures dossier : captures d'écran bureau + mobile au lieu des mesures.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []),
)
const DIR = path.resolve(args.dir || 'site-dist')
const OUT = args.out ? path.resolve(args.out) : null
const RUNS = Number(args.runs || 3)
const CACHE = path.resolve(args.cache || path.join(require('node:os').tmpdir(), 'ae-mesure-cache'))
const PAGES = (args.pages || '/,/solutions/agence-web/,/mentions-legales/').split(',')
const SCENARIOS = {
  bureau: { viewport: { width: 1366, height: 860 }, mobile: false, cpu: 1, net: null },
  cpu4x: { viewport: { width: 390, height: 844 }, mobile: true, cpu: 4, net: null },
  'mobile-3g': { viewport: { width: 390, height: 844 }, mobile: true, cpu: 4, net: { latency: 300, down: (750 * 1024) / 8, up: (250 * 1024) / 8 } },
}
const choisis = (args.scenarios || Object.keys(SCENARIOS).join(',')).split(',')
const UA_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

function chromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM
  const base = '/opt/pw-browsers'
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, 'chrome-linux', d.startsWith('chromium_headless_shell') ? 'headless_shell' : 'chrome')
      if (d.startsWith('chromium_headless_shell') && fs.existsSync(p)) return p
    }
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, 'chrome-linux', 'chrome')
      if (fs.existsSync(p)) return p
    }
  } catch {
    /* pas de navigateur préinstallé : Playwright choisit le sien */
  }
  return undefined
}

const { demarrer: serveur } = require('./serveur.cjs')

// ---------- Ressources tierces rejouées ----------
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap'
function curl(url, dest) {
  execFileSync('curl', ['-sS', '--fail', '-A', UA_CHROME, '-o', dest, url], { stdio: 'pipe' })
}
function preparerCache(htmls) {
  fs.mkdirSync(CACHE, { recursive: true })
  const urls = new Set()
  for (const h of htmls) for (const m of h.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/g)) urls.add(m[0].replace(/&amp;/g, '&'))
  urls.add(FONTS_CSS)
  const carte = {}
  for (const u of urls) {
    const nom = 'css-' + Buffer.from(u).toString('base64url').slice(-40) + '.css'
    const f = path.join(CACHE, nom)
    if (!fs.existsSync(f)) {
      try {
        curl(u, f)
      } catch {
        console.warn('Google Fonts injoignable : polices non mesurées pour', u)
        continue
      }
    }
    carte[u] = { fichier: f, type: 'text/css; charset=utf-8' }
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
      const fu = m[1]
      const ff = path.join(CACHE, 'font-' + Buffer.from(fu).toString('base64url').slice(-48) + '.woff2')
      if (!fs.existsSync(ff)) {
        try {
          curl(fu, ff)
        } catch {
          continue
        }
      }
      carte[fu] = { fichier: ff, type: 'font/woff2' }
    }
  }
  return carte
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const mediane = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

const INIT = `(() => {
  const m = (window.__mesure = { fcp: null, lcp: null, lcpEl: '', shifts: [], longues: [], frames: [] })
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime }).observe({ type: 'paint', buffered: true }) } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.lcp = e.startTime; const el = e.element; m.lcpEl = el ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') : '' } }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.shifts.push([e.startTime, e.value]) }).observe({ type: 'layout-shift', buffered: true }) } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) m.longues.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }) } catch (e) {}
})()`

// CLS : plus grande fenêtre de session (écart < 1 s, durée < 5 s)
function cls(shifts) {
  let max = 0
  let cur = 0
  let debut = -1e9
  let prec = -1e9
  for (const [t, v] of shifts.sort((a, b) => a[0] - b[0])) {
    if (t - prec > 1000 || t - debut > 5000) {
      cur = 0
      debut = t
    }
    cur += v
    prec = t
    max = Math.max(max, cur)
  }
  return max
}


// Ressources tierces servies par un serveur HTTPS local (certificat autosigné) : la requête est redirigée de façon
// invisible pour la page (Fetch.continueRequest), elle passe donc par le même réseau bridé que le site lui-même
// (même débit partagé, même latence par requête). Seul le coût d'ouverture de connexion vers un domaine tiers
// (DNS + TLS, ≈ 2 à 3 allers-retours en 3G) n'est pas reproduit : l'avantage réel de l'auto-hébergement est sous-estimé.
let TIERS = null
async function serveurTiers(cache, images) {
  const https = require('node:https')
  const zlib = require('node:zlib')
  const cle = path.join(CACHE, 'tiers-cle.pem')
  const cert = path.join(CACHE, 'tiers-cert.pem')
  if (!fs.existsSync(cert)) execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', cle, '-out', cert, '-days', '365', '-subj', '/CN=127.0.0.1'], { stdio: 'pipe' })
  const s = https.createServer({ key: fs.readFileSync(cle), cert: fs.readFileSync(cert) }, (req, res) => {
    const u = new URL(req.url, 'https://x').searchParams.get('u') || ''
    const c = cache[u]
    let corps = /^https:\/\/images\.unsplash\.com\//.test(u) ? images : c ? fs.readFileSync(c.fichier) : null
    if (!corps) {
      res.writeHead(404)
      return res.end()
    }
    const type = c ? c.type : 'image/webp'
    const h = { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
    if (/^text\//.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      corps = zlib.gzipSync(corps)
      h['Content-Encoding'] = 'gzip'
    }
    res.writeHead(200, h)
    res.end(corps)
  })
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok))
  return s
}
async function routerTiers(page, cache) {
  const port = TIERS.address().port
  await page.route(/^https:\/\//, async (route) => {
    const u = route.request().url()
    if (u.startsWith('https://127.0.0.1')) return route.continue()
    if (/^https:\/\/images\.unsplash\.com\//.test(u) || cache[u]) return route.continue({ url: `https://127.0.0.1:${port}/tiers?u=${encodeURIComponent(u)}` })
    return route.abort()
  })
}

// Captures d'écran (haut de page + page entière après défilement) : --captures dossier
async function captures(browser, base, cache, images, dossier) {
  fs.mkdirSync(dossier, { recursive: true })
  const pages = { accueil: '/', service: '/solutions/agence-web/', erp: '/solutions/erp/', legal: '/mentions-legales/', contact: '/contact/' }
  for (const [nomSc, sc] of [['bureau', SCENARIOS.bureau], ['mobile', SCENARIOS.cpu4x]]) {
    for (const [nom, chemin] of Object.entries(pages)) {
      if (!fs.existsSync(path.join(DIR, chemin, 'index.html'))) continue
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: sc.viewport, isMobile: sc.mobile, hasTouch: sc.mobile, deviceScaleFactor: 1, locale: 'fr-FR' })
      const page = await ctx.newPage()
      await routerTiers(page, cache)
      await page.goto(base + chemin, { waitUntil: 'load' })
      await attendre(1500)
      await page.screenshot({ path: path.join(dossier, `${nom}-${nomSc}-haut.png`) })
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
          scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        await new Promise((r) => setTimeout(r, 1500))
        scrollTo(0, 0)
      })
      await attendre(400)
      await page.screenshot({ path: path.join(dossier, `${nom}-${nomSc}-page.png`), fullPage: true })
      await ctx.close()
    }
  }
  console.log('Captures dans', dossier)
}

async function unPassage(browser, base, chemin, sc, cache) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: sc.viewport, isMobile: sc.mobile, hasTouch: sc.mobile, deviceScaleFactor: sc.mobile ? 2 : 1, locale: 'fr-FR', userAgent: UA_CHROME + (sc.mobile ? ' Mobile' : '') })
  const page = await ctx.newPage()
  await page.addInitScript(INIT)
  const octets = {}
  const erreurs = []
  // Les appels tiers coupés volontairement (API Supabase) produisent « net::ERR_FAILED » : ignorés
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED/.test(m.text()) && erreurs.push(m.text()))
  page.on('pageerror', (e) => erreurs.push(String(e)))
  page.on('requestfinished', async (req) => {
    try {
      const s = await req.sizes()
      const t = req.resourceType()
      octets[t] = (octets[t] || 0) + s.responseBodySize
      if (process.env.MESURE_RESEAU) {
        const tm = req.timing()
        if (!octets.__t0 && t === 'document') octets.__t0 = tm.startTime
        const t0 = octets.__t0 || tm.startTime
        console.log(`  ${t.padEnd(10)} début ${Math.round(tm.startTime - t0)} ms, fin ${Math.round(tm.startTime - t0 + tm.responseEnd)} ms ${String(s.responseBodySize).padStart(7)} o ${req.url().slice(0, 90)}`)
      }
    } catch {
      /* requête annulée */
    }
  })
  await routerTiers(page, cache)
  const cdp = await ctx.newCDPSession(page)
  if (sc.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: sc.cpu })
  if (sc.net) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: sc.net.latency, downloadThroughput: sc.net.down, uploadThroughput: sc.net.up })
  }
  await page.goto(base + chemin, { waitUntil: 'load', timeout: 120000 })
  await attendre(sc.net ? 4000 : 2500)
  const avant = await page.evaluate(() => ({ lcp: window.__mesure.lcp, lcpEl: window.__mesure.lcpEl, fcp: window.__mesure.fcp }))
  // Défilement jusqu'en bas par paliers, avec relevé des intervalles d'images
  await page.evaluate(async () => {
    const m = window.__mesure
    let prec = performance.now()
    let actif = true
    const boucle = (t) => {
      m.frames.push(t - prec)
      prec = t
      if (actif) requestAnimationFrame(boucle)
    }
    requestAnimationFrame(boucle)
    const pas = Math.round(innerHeight * 0.7)
    for (let y = 0; y < document.documentElement.scrollHeight; y += pas) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 160))
    }
    await new Promise((r) => setTimeout(r, 800))
    actif = false
  })
  const m = await page.evaluate(() => window.__mesure)
  const fcp = avant.fcp || m.fcp || 0
  const tbt = m.longues.filter(([t]) => t + 0 >= fcp).reduce((s, [, d]) => s + Math.max(0, d - 50), 0)
  const frames = m.frames.slice(2).sort((a, b) => a - b)
  const p95 = frames.length ? frames[Math.floor(frames.length * 0.95)] : null
  // Part des images de plus de 25 ms pendant le défilement (saccades), plus stable que le 95e centile
  const lentes = frames.length ? (100 * frames.filter((f) => f > 25).length) / frames.length : null
  await ctx.close()
  return {
    fcp: avant.fcp,
    lcp: avant.lcp,
    lcpEl: avant.lcpEl,
    cls: cls(m.shifts),
    longues: m.longues.length,
    tbt,
    frameP95: p95,
    lentes,
    octets,
    erreurs,
  }
}

async function main() {
  if (!fs.existsSync(path.join(DIR, 'index.html'))) throw new Error('Site introuvable dans ' + DIR + ' : lancez node site/build.mjs ' + DIR)
  const { chromium: pw } = require('playwright')
  const htmls = PAGES.map((p) => fs.readFileSync(path.join(DIR, p.split('?')[0], 'index.html'), 'utf8'))
  const cache = preparerCache(htmls)
  const images = fs.readFileSync(path.join(DIR, 'assets/img/equipe.webp'))
  const srv = await serveur(DIR)
  const base = 'http://127.0.0.1:' + srv.address().port
  TIERS = await serveurTiers(cache, images)
  const browser = await pw.launch({ executablePath: chromium(), args: ['--no-sandbox', '--ignore-certificate-errors'] })
  const fichiers = {
    css: fs.readdirSync(path.join(DIR, 'assets')).filter((f) => f.endsWith('.css')).reduce((s, f) => s + fs.statSync(path.join(DIR, 'assets', f)).size, 0),
    js: ['site.js', 'motion.js'].filter((f) => fs.existsSync(path.join(DIR, 'assets', f))).reduce((s, f) => s + fs.statSync(path.join(DIR, 'assets', f)).size, 0),
  }
  if (args.captures) {
    try {
      await captures(browser, base, cache, images, path.resolve(args.captures))
    } finally {
      await browser.close()
      srv.close()
      TIERS.close()
    }
    return
  }
  const resultats = { date: new Date().toISOString(), dossier: DIR, passages: RUNS, navigateur: browser.version(), fichiersBruts: fichiers, pages: {} }
  try {
    for (const chemin of PAGES) {
      resultats.pages[chemin] = {}
      for (const nom of choisis) {
        const sc = SCENARIOS[nom]
        const runs = []
        for (let i = 0; i < RUNS; i++) runs.push(await unPassage(browser, base, chemin, sc, cache))
        const types = [...new Set(runs.flatMap((r) => Object.keys(r.octets)))].filter((t) => t !== '__t0')
        const r = {
          fcp: mediane(runs.map((x) => x.fcp)),
          lcp: mediane(runs.map((x) => x.lcp)),
          lcpEl: runs[0].lcpEl,
          cls: mediane(runs.map((x) => x.cls)),
          longues: mediane(runs.map((x) => x.longues)),
          tbt: mediane(runs.map((x) => x.tbt)),
          frameP95: mediane(runs.map((x) => x.frameP95)),
          lentes: mediane(runs.map((x) => x.lentes)),
          octets: Object.fromEntries(types.map((t) => [t, mediane(runs.map((x) => x.octets[t] || 0))])),
          erreurs: [...new Set(runs.flatMap((x) => x.erreurs))],
        }
        resultats.pages[chemin][nom] = r
        const ko = (n) => (n == null ? '-' : (n / 1024).toFixed(1))
        console.log(
          `${chemin.padEnd(26)} ${nom.padEnd(10)} FCP ${Math.round(r.fcp)} ms  LCP ${Math.round(r.lcp)} ms (${r.lcpEl})  CLS ${r.cls.toFixed(3)}  TBT ${Math.round(r.tbt)} ms (${r.longues} longues)  image p95 ${r.frameP95 ? r.frameP95.toFixed(1) : '-'} ms, lentes ${r.lentes == null ? '-' : r.lentes.toFixed(1)} %  ` +
            `doc ${ko(r.octets.document)} css ${ko(r.octets.stylesheet)} js ${ko(r.octets.script)} police ${ko(r.octets.font)} img ${ko(r.octets.image)} Ko` +
            (r.erreurs.length ? `  ERREURS: ${r.erreurs.join(' | ')}` : ''),
        )
      }
    }
  } finally {
    await browser.close()
    srv.close()
    TIERS.close()
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(resultats, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
