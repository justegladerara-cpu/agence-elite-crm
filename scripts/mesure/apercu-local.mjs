// Démarre la prévisualisation locale SANS donnée réelle : CRM construit en mode aperçu (démo + exemples fictifs)
// et plateforme fictive (PGlite). Utilisé par les scripts de mesure, de captures et par les parcours e2e.
//   node scripts/mesure/apercu-local.mjs        → garde les deux serveurs ouverts (Ctrl C pour arrêter)
import { spawn, execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export const RACINE = resolve(import.meta.dirname, '../..')
export const PORT_CRM = Number(process.env.PORT_APERCU || 4180)
export const PORT_PLATEFORME = Number(process.env.PORT_PLATEFORME_FICTIVE || 54399)
export const URL_CRM = `http://127.0.0.1:${PORT_CRM}`
export const URL_PLATEFORME = `http://127.0.0.1:${PORT_PLATEFORME}`
export const ENV_APERCU = {
  VITE_PREVISUALISATION: '1',
  VITE_PLATEFORME_FICTIVE: URL_PLATEFORME,
  VITE_AUTOSEED: '1',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
}

const attendre = async (url, essais = 120) => {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status < 500) return true
    } catch {
      /* pas encore prêt */
    }
    await new Promise((ok) => setTimeout(ok, 500))
  }
  throw new Error(`${url} ne répond pas`)
}

export function construire(dossier = 'dist-apercu') {
  execFileSync('node', ['node_modules/vite/bin/vite.js', 'build', '--outDir', dossier, '--emptyOutDir'], { cwd: RACINE, stdio: 'inherit', env: { ...process.env, ...ENV_APERCU } })
}

export async function demarrer({ dossier = 'dist-apercu', construireAvant = true } = {}) {
  if (construireAvant) construire(dossier)
  const enfants = []
  const lancer = (cmd, args, env = {}) => {
    // Groupe de processus à part : arreter() ferme aussi les sous-processus (sinon le port reste pris)
    const p = spawn(cmd, args, { cwd: RACINE, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', process.env.DEBUG_APERCU ? 'inherit' : 'ignore', 'inherit'] })
    enfants.push(p)
    return p
  }
  lancer('node', ['scripts/plateforme-fictive/serveur.mjs'], { PORT_PLATEFORME_FICTIVE: String(PORT_PLATEFORME) })
  lancer('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', dossier, '--port', String(PORT_CRM), '--strictPort', '--host', '127.0.0.1'])
  await attendre(`${URL_PLATEFORME}/__etat`)
  await attendre(URL_CRM)
  const arreter = () =>
    enfants.forEach((p) => {
      try {
        process.kill(-p.pid, 'SIGTERM')
      } catch {
        /* déjà arrêté */
      }
    })
  process.once('exit', arreter)
  return { arreter }
}

// Session super admin FICTIVE obtenue auprès de la plateforme fictive, à poser dans le navigateur
export async function sessionFictive(email = 'superadmin@fictif.test', motDePasse = 'fictif-1234') {
  const r = await fetch(`${URL_PLATEFORME}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email, password: motDePasse }) })
  if (!r.ok) throw new Error('Connexion à la plateforme fictive refusée')
  return r.json()
}

export async function rpcFictif(nom, args = {}, session) {
  const s = session || (await sessionFictive())
  const r = await fetch(`${URL_PLATEFORME}/rest/v1/rpc/${nom}`, { method: 'POST', headers: { authorization: `Bearer ${s.access_token}` }, body: JSON.stringify(args) })
  return r.json()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await demarrer({ construireAvant: !process.argv.includes('--sans-build') })
  console.log(`Prévisualisation locale : ${URL_CRM}  ·  plateforme fictive : ${URL_PLATEFORME}`)
  console.log('Connexion plateforme : superadmin.fictif / fictif-1234 (compte fictif)')
}
