// Parcours navigateur du site vitrine (Elite Motion System) : node site/build.mjs site-dist puis
//   npx playwright test -c site/playwright.config.mjs
// Navigateur préinstallé : variable PW_CHROMIUM (chemin de l'exécutable Chromium), sinon celui de Playwright.
import { defineConfig } from '@playwright/test'

const executablePath = process.env.PW_CHROMIUM || undefined

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4180', locale: 'fr-FR', launchOptions: { executablePath } },
  projects: [
    { name: 'ordinateur', use: { viewport: { width: 1366, height: 860 } } },
    { name: 'téléphone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: { command: 'node site/build.mjs site-dist && node site/scripts/serveur.cjs site-dist 4180', cwd: '..', port: 4180, timeout: 60000, reuseExistingServer: !process.env.CI },
})
