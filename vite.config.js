import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swBuild()],
  // Tests des calculs (Vitest) ; les parcours navigateur sont dans e2e/ (Playwright)
  test: { include: ['tests/**/*.test.js'] },
})
