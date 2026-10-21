// Parcours de bout en bout sur la version de production construite en mode démo (données dans le navigateur)
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', locale: 'fr-FR', timezoneId: 'Africa/Brazzaville' },
  projects: [
    { name: 'ordinateur', use: { viewport: { width: 1366, height: 860 } } },
    { name: 'téléphone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: { command: 'npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort', port: 4173, timeout: 120000, reuseExistingServer: !process.env.CI, env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_PLATEFORME_URL: 'https://plateforme.fictive.test', VITE_PLATEFORME_CLE: 'cle-fictive' } },
})
