// Copie dans ce dépôt ce qu'il faut pour rejouer la base plateforme FICTIVE sans le dépôt plateforme
// (CI, aperçu de branche) : migrations, données de démonstration fictives, simulateur Supabase, moteur PGlite.
//   PLATEFORME_DEPOT=../agence-elite-platform node scripts/plateforme-fictive/synchroniser.mjs
// Aucune donnée réelle : uniquement des fichiers versionnés du dépôt plateforme.
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const ici = import.meta.dirname
const depot = resolve(process.env.PLATEFORME_DEPOT || resolve(ici, '../../../agence-elite-platform'))
const cible = resolve(ici, 'instantane')
rmSync(cible, { recursive: true, force: true })
mkdirSync(resolve(cible, 'migrations'), { recursive: true })
mkdirSync(resolve(cible, 'demo'), { recursive: true })
for (const f of readdirSync(resolve(depot, 'supabase/migrations')).filter((n) => n.endsWith('.sql'))) cpSync(resolve(depot, 'supabase/migrations', f), resolve(cible, 'migrations', f))
for (const f of ['commerce_demo.sql', 'modules_demo.sql', 'historique_demo.sql']) cpSync(resolve(depot, 'supabase/demo', f), resolve(cible, 'demo', f))
cpSync(resolve(depot, 'tests/sql/supabase_shim.sql'), resolve(cible, 'supabase_shim.sql'))
cpSync(resolve(depot, 'tests/sql/supabase_shim_auth.sql'), resolve(cible, 'supabase_shim_auth.sql'))
cpSync(resolve(depot, 'src/noyau/donnees/moteurLocal.js'), resolve(cible, 'moteurLocal.js'))
let commit = 'inconnu'
try {
  commit = execFileSync('git', ['-C', depot, 'log', '-1', '--format=%h %cs %s'], { encoding: 'utf8' }).trim()
} catch {
  /* pas de git : commit inconnu */
}
const n = readdirSync(resolve(cible, 'migrations')).length
writeFileSync(resolve(cible, 'SOURCE.md'), `# Instantané de la plateforme (fictive)\n\nCopié du dépôt \`agence-elite-platform\`, commit ${commit}.\n${n} migrations, données de démonstration fictives, simulateur Supabase (tests/sql) et moteur PGlite.\nNe pas modifier à la main : relancer \`node scripts/plateforme-fictive/synchroniser.mjs\`.\n`)
console.log(`Instantané : ${n} migrations (${commit})`)
void readFileSync
