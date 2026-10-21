// Temps d'ouverture de la recherche Ctrl K (objectif < 300 ms), sur un build servi en local :
//   npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4190
//   CHROMIUM_PATH=<chrome> node scripts/mesure/ctrlk.mjs [http://localhost:4190]
// Mesure 10 ouvertures : de la touche jusqu'à l'image suivant l'apparition de la fenêtre.
import { chromium } from '@playwright/test'
const url = process.argv[2] || 'http://localhost:4190'
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const p = await b.newPage({ viewport: { width: 1366, height: 860 } })
await p.goto(`${url}/#/controle`)
await p.waitForTimeout(2500)
const t = []
for (let i = 0; i < 10; i++) {
  const d = await p.evaluate(
    () =>
      new Promise((res) => {
        const t0 = performance.now()
        const obs = new MutationObserver(() => {
          if (document.querySelector('.search-bg')) {
            obs.disconnect()
            requestAnimationFrame(() => res(performance.now() - t0))
          }
        })
        obs.observe(document.body, { childList: true, subtree: true })
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
        setTimeout(() => res(-1), 2000)
      }),
  )
  t.push(Math.round(d))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)
}
console.log(JSON.stringify({ ouvertures_ms: t, premiere: t[0], max: Math.max(...t) }))
await b.close()
