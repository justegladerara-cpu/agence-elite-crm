// Vérification de bout en bout de la double authentification des comptes internes du CRM
// (migration 20261019040000_mfa_obligatoire_interne.sql) sur une VRAIE base Supabase LOCALE (Auth réel).
// Refuse toute autre adresse que localhost : jamais en production. Comptes fictifs ; aucun secret affiché.
// Variables : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL (psql), MIGRATION (chemin).
// AVANT=1 : vérifie seulement que les failles corrigées existent bien sans la migration (constat « avant »).
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL: URL = '', SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE, DATABASE_URL: DB = '' } = process.env
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(URL) || !/@(127\.0\.0\.1|localhost):/.test(DB) || !ANON || !SERVICE) {
  console.error('Base locale uniquement (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL).')
  process.exit(2)
}
const sql = (q) => execFileSync('psql', [DB, '-XAtqc', q], { encoding: 'utf8' }).trim()
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL, SERVICE, options)
const lot = Date.now().toString(36)
const mdp = `Crm-${lot}-${Math.random().toString(36).slice(2, 10)}!`
let echecs = 0
const noter = (ok, e, d = '') => {
  if (!ok) echecs += 1
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${e}${d ? ` — ${d}` : ''}`)
}
const cas = async (nom, fn) => {
  try {
    noter(true, nom, (await fn()) ?? '')
  } catch (err) {
    noter(false, nom, err.message)
  }
}
const verifier = (c, m) => {
  if (!c) throw new Error(m)
}
function codeTotp(secret, d = 0) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, '0')
  const k = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const n = Buffer.alloc(8)
  n.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + d))
  const h = createHmac('sha1', k).update(n).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0')
}
async function compte(cle) {
  const email = `${cle}-${lot}@crm.test`
  const { data, error } = await service.auth.admin.createUser({ email, password: mdp, email_confirm: true })
  if (error) throw new Error(error.message)
  return { id: data.user.id, email }
}
async function session(c) {
  const client = createClient(URL, ANON, options)
  const { error } = await client.auth.signInWithPassword({ email: c.email, password: mdp })
  if (error) throw new Error(error.message)
  return client
}
async function enroler(client) {
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `t-${Math.random()}` })
  if (error) throw new Error(error.message)
  const v = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: codeTotp(data.totp.secret) })
  if (v.error) throw new Error(v.error.message)
  return data.totp.secret
}
async function aal2(client, secret, d = 0) {
  const { data } = await client.auth.mfa.listFactors()
  const v = await client.auth.mfa.challengeAndVerify({ factorId: data.totp[0].id, code: codeTotp(secret, d) })
  if (v.error) throw new Error(v.error.message)
}

const proprio = await compte('proprio')
const membre = await compte('membre')
const candidat = await compte('candidat')
const w = sql(`insert into public.workspaces(nom, owner_id) values ('Agence', '${proprio.id}') returning id`)
sql(`insert into public.workspace_members values ('${w}', '${proprio.id}', 'proprietaire'), ('${w}', '${membre.id}', 'membre')`)
sql(`insert into public.prospects(workspace_id, nom) values ('${w}', 'Prospect fictif')`)
const proprioClient = await session(proprio)
const secret = await enroler(proprioClient) // le propriétaire a un téléphone
const aal1 = await session(proprio) // nouvelle connexion, mot de passe seul

if (process.env.AVANT) {
  await cas('AVANT : mot de passe seul (aal1) + téléphone enrôlé → données protégées par les politiques', async () => {
    const { data } = await aal1.from('prospects').select('id')
    verifier(data.length === 0, 'prospects lisibles en aal1')
  })
  await cas('AVANT (faille) : gestion des membres possible avec le mot de passe seul', async () => {
    const r = await aal1.rpc('inviter_membre', { w, p_email: `intrus-${lot}@crm.test`, p_role: 'membre' })
    const m = await aal1.rpc('membres_espace', { w })
    verifier(!r.error && m.data?.length > 0, 'faille absente')
    return 'invitation acceptée et e-mails des membres lisibles en aal1'
  })
  await cas('AVANT (faille) : fonction d’administration Emploi exécutable sans connexion', async () => {
    const r = await createClient(URL, ANON, options).rpc('emploi_profils_recus')
    verifier(!r.error, 'faille absente')
  })
  console.log(echecs ? `\n${echecs} échec(s)` : '\nConstat « avant » confirmé.')
  process.exit(echecs ? 1 : 0)
}

sql(`select 1`) // la migration est appliquée par l'appelant avant ce script
await cas('aal1 avec téléphone : données et gestion des membres refusées', async () => {
  const { data } = await aal1.from('prospects').select('id')
  verifier(data.length === 0, 'prospects lisibles')
  const r = await aal1.rpc('inviter_membre', { w, p_email: `intrus2-${lot}@crm.test`, p_role: 'membre' })
  verifier(r.error && /Double authentification/.test(r.error.message), `invitation : ${r.error?.message ?? 'acceptée'}`)
  const m = await aal1.rpc('membres_espace', { w })
  verifier(!m.error && m.data.length === 0, 'membres lisibles')
  return 'refusé'
})
await cas('aal2 : tout fonctionne', async () => {
  await aal2(aal1, secret, 1)
  const { data } = await aal1.from('prospects').select('id')
  verifier(data.length === 1, 'prospect absent')
  const r = await aal1.rpc('inviter_membre', { w, p_email: `invite-${lot}@crm.test`, p_role: 'membre' })
  verifier(!r.error, r.error?.message)
  verifier((await aal1.rpc('membres_espace', { w })).data.length >= 2, 'membres absents')
})
await cas('transition : membre interne sans téléphone garde l’accès (aucun verrouillage)', async () => {
  const s = await session(membre)
  const { data } = await s.from('prospects').select('id')
  verifier(data.length === 1, 'membre bloqué')
  const e = (await s.rpc('crm_etat_securite')).data
  verifier(e.interne && !e.enrolement_requis && !e.mfa_obligatoire, JSON.stringify(e))
})
await cas('mode obligatoire : refusé en aal1, puis tant qu’un compte interne n’a pas de téléphone', async () => {
  const s = await session(proprio)
  const r1 = await s.rpc('crm_definir_mfa_obligatoire', { p_obligatoire: true })
  verifier(r1.error && /code/.test(r1.error.message), `aal1 : ${r1.error?.message ?? 'accepté'}`)
  const r2 = await aal1.rpc('crm_definir_mfa_obligatoire', { p_obligatoire: true })
  verifier(r2.error && /1 compte\(s\) interne\(s\)/.test(r2.error.message), `sans téléphone : ${r2.error?.message ?? 'accepté'}`)
  const r3 = await (await session(membre)).rpc('crm_definir_mfa_obligatoire', { p_obligatoire: false })
  verifier(r3.error, 'un membre non propriétaire modifie le réglage')
})
await cas('le membre enrôle son téléphone, puis activation acceptée', async () => {
  await enroler(await session(membre))
  const r = await aal1.rpc('crm_definir_mfa_obligatoire', { p_obligatoire: true })
  if (r.error) throw new Error(r.error.message)
  verifier(sql('select mfa_interne_obligatoire from private.securite_crm') === 't', 'réglage non enregistré')
})
await cas('mode obligatoire : nouveau compte interne sans téléphone bloqué, enrôlement demandé', async () => {
  const recrue = await compte('recrue')
  sql(`insert into public.workspace_members values ('${w}', '${recrue.id}', 'membre')`)
  const s = await session(recrue)
  const { data } = await s.from('prospects').select('id')
  verifier(data.length === 0, 'recrue sans téléphone lit les prospects')
  verifier((await s.rpc('crm_etat_securite')).data.enrolement_requis === true, 'enrôlement non demandé')
  await enroler(s)
  verifier((await s.from('prospects').select('id')).data.length === 1, 'accès non rendu après enrôlement')
})
await cas('compte Elite Emploi (hors espace) : non concerné, rien ne change', async () => {
  const s = await session(candidat)
  const r = await s.from('client_errors').insert({ message: 'test' })
  verifier(!r.error, r.error?.message)
  const e = (await s.rpc('crm_etat_securite')).data
  verifier(!e.interne && !e.enrolement_requis, JSON.stringify(e))
})
await cas('SEC-09 : fonction d’administration Emploi fermée aux visiteurs non connectés', async () => {
  const r = await createClient(URL, ANON, options).rpc('emploi_profils_recus')
  verifier(r.error, 'encore exécutable sans connexion')
  const s = await session(candidat)
  verifier(!(await s.rpc('emploi_profils_recus')).error, 'refusée aux comptes connectés')
})
await cas('retour arrière : désactivation par le propriétaire en aal2', async () => {
  const r = await aal1.rpc('crm_definir_mfa_obligatoire', { p_obligatoire: false })
  if (r.error) throw new Error(r.error.message)
  verifier(sql('select mfa_interne_obligatoire from private.securite_crm') === 'f', 'non désactivé')
})
console.log(echecs ? `\n${echecs} échec(s)` : '\nToutes les vérifications sont passées.')
process.exit(echecs ? 1 : 0)
