// Serveur de la plateforme FICTIVE : imite les quelques routes de Supabase (Auth + PostgREST) dont le CRM a besoin,
// au-dessus de la base PGlite de base.mjs. Il n'écoute que sur 127.0.0.1 et ne contacte aucun service en ligne.
//   node scripts/plateforme-fictive/serveur.mjs            → http://127.0.0.1:54399
// Routes de test : GET /__journal (appels reçus), POST /__reinitialiser (base remise à l'état initial),
//                  POST /__panne {fonction, fois} (fait échouer les prochains appels d'une fonction, comme une coupure réseau).
import { createServer } from 'node:http'
import { creerBase, moteur, SUPER_ADMIN, MEMBRE, source } from './base.mjs'

const PORT = Number(process.env.PORT_PLATEFORME_FICTIVE || 54399)
const { PGlite, optionsPGlite, creerApiLocale, messageErreur } = await moteur()

let db = await creerBase()
let instantane = await db.dumpDataDir('gzip')
const journal = []
const pannes = new Map()
const sessions = new Map() // jeton → utilisateur

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function emettreSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jeton = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', aal: 'aal2', exp, email: user.email, fictif: true })}.fictif`
  const refresh = `rafraichir-${crypto.randomUUID()}`
  sessions.set(jeton, user)
  sessions.set(refresh, user)
  return { access_token: jeton, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: exp, user: utilisateurPublic(user) }
}
const utilisateurPublic = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date(0).toISOString() })

function envoyer(res, code, corps) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
  })
  res.end(corps === undefined ? '' : JSON.stringify(corps))
}
const lireCorps = (req) =>
  new Promise((ok) => {
    let s = ''
    req.on('data', (c) => (s += c))
    req.on('end', () => {
      try {
        ok(s ? JSON.parse(s) : {})
      } catch {
        ok({})
      }
    })
  })
const utilisateurDe = (req) => sessions.get(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')) || null

// Filtres PostgREST simples : ?col=eq.x, in.(a,b), gte., lte., is.null, order=col.desc, limit=n
function lecture(url) {
  const options = { eq: {}, gte: {}, lte: {}, dans: {} }
  for (const [cle, valeur] of url.searchParams) {
    if (cle === 'select') {
      if (valeur !== '*') options.colonnes = valeur.split(',')
    } else if (cle === 'order') {
      const [col, sens] = valeur.split('.')
      options.ordre = [col, sens === 'desc' ? 'desc' : 'asc']
    } else if (cle === 'limit') options.limite = Number(valeur)
    else {
      const [op, ...reste] = valeur.split('.')
      const v = reste.join('.')
      if (op === 'eq') options.eq[cle] = v
      else if (op === 'is' && v === 'null') options.eq[cle] = null
      else if (op === 'gte') options.gte[cle] = v
      else if (op === 'lte') options.lte[cle] = v
      else if (op === 'in') options.dans[cle] = v.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))
    }
  }
  return options
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') return envoyer(res, 204)
  try {
    // --- Routes de test ---
    if (url.pathname === '/__etat') return envoyer(res, 200, { ok: true, plateforme: await source(), superAdmin: SUPER_ADMIN.identifiant })
    if (url.pathname === '/__journal') return envoyer(res, 200, journal)
    if (url.pathname === '/__reinitialiser' && req.method === 'POST') {
      await db.close()
      db = new PGlite({ ...optionsPGlite, loadDataDir: instantane })
      await db.waitReady
      journal.length = 0
      pannes.clear()
      sessions.clear()
      return envoyer(res, 200, { ok: true })
    }
    if (url.pathname === '/__panne' && req.method === 'POST') {
      const { fonction, fois = 1 } = await lireCorps(req)
      pannes.set(fonction, fois)
      return envoyer(res, 200, { ok: true })
    }
    // --- Auth (GoTrue) ---
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const corps = await lireCorps(req)
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const u = sessions.get(corps.refresh_token)
        return u ? envoyer(res, 200, emettreSession(u)) : envoyer(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' })
      }
      const { rows } = await db.query(
        'select id, email from auth.users where lower(email) = lower($1) and encrypted_password is not null and extensions.crypt($2, encrypted_password) = encrypted_password',
        [corps.email || '', corps.password || ''],
      )
      if (!rows[0]) return envoyer(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
      return envoyer(res, 200, emettreSession(rows[0]))
    }
    if (url.pathname === '/auth/v1/user') {
      const u = utilisateurDe(req)
      return u ? envoyer(res, 200, utilisateurPublic(u)) : envoyer(res, 401, { msg: 'JWT expired', code: 401 })
    }
    if (url.pathname === '/auth/v1/logout') {
      sessions.delete(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
      return envoyer(res, 204)
    }
    // --- Fonctions (RPC) et lectures (PostgREST) ---
    const rpc = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(url.pathname)
    if (rpc) {
      const nom = rpc[1]
      const args = await lireCorps(req)
      const u = utilisateurDe(req)
      journal.push({ nom, args, utilisateur: u?.email || null, t: Date.now() })
      if (pannes.get(nom) > 0) {
        pannes.set(nom, pannes.get(nom) - 1)
        req.socket.destroy() // coupure : le navigateur voit une erreur réseau
        return
      }
      const api = creerApiLocale(db, () => u?.id || null)
      try {
        return envoyer(res, 200, await api.rpc(nom, args))
      } catch (e) {
        return envoyer(res, 400, { message: messageErreur(e), code: 'P0001', details: null, hint: null })
      }
    }
    const table = /^\/rest\/v1\/([a-z_0-9]+)$/.exec(url.pathname)
    if (table && req.method === 'GET') {
      const u = utilisateurDe(req)
      const api = creerApiLocale(db, () => u?.id || null)
      try {
        return envoyer(res, 200, await api.lire(table[1], lecture(url)))
      } catch (e) {
        return envoyer(res, 400, { message: messageErreur(e), code: 'PGRST', details: null, hint: null })
      }
    }
    // Fonctions serveur du SaaS (/api/…) : absentes de la plateforme fictive
    if (url.pathname.startsWith('/api/')) return envoyer(res, 503, { erreur: 'Indisponible dans la plateforme fictive' })
    return envoyer(res, 404, { message: 'Route inconnue de la plateforme fictive' })
  } catch (e) {
    return envoyer(res, 500, { message: messageErreur(e) })
  }
})

serveur.listen(PORT, '127.0.0.1', async () => {
  console.log(`Plateforme fictive prête sur http://127.0.0.1:${PORT} (dépôt plateforme ${await source()})`)
  console.log(`Super admin fictif : ${SUPER_ADMIN.identifiant} / ${SUPER_ADMIN.email} (mot de passe dans base.mjs) · compte refusé : ${MEMBRE.email}`)
})
