import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { estApercu, plateformeFictive, cspApercu } from './scripts/apercu.mjs'

// Service worker : version et liste des fichiers de chaque build (mise en cache hors ligne complète,
// anciennes versions supprimées automatiquement)
function swBuild() {
  let files = []
  let outDir = 'dist'
  return {
    name: 'sw-build',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => f.startsWith('assets/')).map((f) => `/${f}`)
    },
    writeBundle() {
      const p = join(outDir, 'sw.js')
      if (!existsSync(p)) return
      const version = `aecrm-${Date.now().toString(36)}`
      const src = readFileSync(p, 'utf8').replace("'aecrm-dev'", `'${version}'`).replace('[] /* ASSETS */', JSON.stringify(files))
      writeFileSync(p, src)
    },
  }
}

// Aperçu (branche autre que la production, ou VITE_PREVISUALISATION=1) : mode démo forcé, plateforme fictive,
// et le navigateur refuse toute connexion vers une autre adresse (voir scripts/apercu.mjs)
const APERCU = estApercu()
function apercuSur() {
  return {
    name: 'apercu-sur',
    transformIndexHtml: (html) =>
      APERCU ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${cspApercu()}" />`) : html,
  }
}
const defineApercu = APERCU
  ? {
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
      'import.meta.env.VITE_PLATEFORME_URL': JSON.stringify(plateformeFictive()),
      'import.meta.env.VITE_PLATEFORME_CLE': JSON.stringify(plateformeFictive() ? 'cle-publique-fictive' : ''),
      'import.meta.env.VITE_SAAS_ORIGINE': JSON.stringify(plateformeFictive()),
      'import.meta.env.VITE_PREVISUALISATION': '"1"',
    }
  : {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swBuild(), apercuSur()],
  define: defineApercu,
  // Tests des calculs (Vitest) ; les parcours navigateur sont dans e2e/ (Playwright)
  test: { include: ['tests/**/*.test.js'] },
})
