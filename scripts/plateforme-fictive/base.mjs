// Base plateforme FICTIVE pour la prévisualisation, les captures et les parcours e2e.
// Elle rejoue les vraies migrations du dépôt agence-elite-platform dans PGlite (Postgres en mémoire),
// puis ses données de démonstration fictives. Aucune donnée réelle, aucune connexion réseau.
// Source : l'instantané versionné ici (instantane/, voir SOURCE.md), ou un dépôt plateforme local
// si PLATEFORME_DEPOT est fourni (pour tester une PR plateforme non fusionnée).
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const ICI = import.meta.dirname
const DEPOT = process.env.PLATEFORME_DEPOT ? resolve(process.env.PLATEFORME_DEPOT) : null
const chemins = DEPOT
  ? { migrations: resolve(DEPOT, 'supabase/migrations'), demo: resolve(DEPOT, 'supabase/demo'), shim: resolve(DEPOT, 'tests/sql'), moteur: resolve(DEPOT, 'src/noyau/donnees/moteurLocal.js') }
  : { migrations: resolve(ICI, 'instantane/migrations'), demo: resolve(ICI, 'instantane/demo'), shim: resolve(ICI, 'instantane'), moteur: resolve(ICI, 'instantane/moteurLocal.js') }

// Comptes FICTIFS (n'existent que dans cette base en mémoire)
export const SUPER_ADMIN = { email: 'superadmin@fictif.test', identifiant: 'superadmin.fictif', motDePasse: 'fictif-1234' }
export const MEMBRE = { email: 'membre@fictif.test', motDePasse: 'fictif-1234' }

export async function moteur() {
  const m = await import(pathToFileURL(chemins.moteur).href)
  return { PGlite, ...m }
}

export async function creerBase() {
  const { optionsPGlite, preparerBase } = await moteur()
  const db = new PGlite(optionsPGlite)
  const noms = (await readdir(chemins.migrations)).filter((n) => n.endsWith('.sql'))
  const migrations = await Promise.all(noms.map(async (nom) => ({ nom, sql: await readFile(resolve(chemins.migrations, nom), 'utf8') })))
  await preparerBase(db, {
    shim: await readFile(resolve(chemins.shim, 'supabase_shim.sql'), 'utf8'),
    complement: await readFile(resolve(chemins.shim, 'supabase_shim_auth.sql'), 'utf8'),
    migrations,
  })
  await semer(db)
  return db
}

const demo = (f) => readFile(resolve(chemins.demo, f), 'utf8')

// Données fictives : démonstration du dépôt plateforme, puis noms et adresses rendus explicitement fictifs
async function semer(db) {
  const hache = "extensions.crypt($2, extensions.gen_salt('bf'))"
  const sa = (await db.query(`insert into auth.users(email, encrypted_password) values ($1, ${hache}) returning id`, [SUPER_ADMIN.email, SUPER_ADMIN.motDePasse])).rows[0].id
  await db.query("update public.profils set nom_complet = 'Super Admin Fictif' where id = $1", [sa])
  await db.query("insert into public.plateforme_admins(user_id, role) values ($1, 'super_admin')", [sa])
  await db.query(`insert into auth.users(email, encrypted_password) values ($1, ${hache})`, [MEMBRE.email, MEMBRE.motDePasse])
  await db.transaction(async (tx) => {
    await tx.query("select set_config('app.demo_mot_de_passe', '1234', true), set_config('app.demo_super_admin_email', $1, true)", [SUPER_ADMIN.email])
    await tx.exec(await demo('commerce_demo.sql'))
    await tx.exec(await demo('modules_demo.sql'))
    await tx.exec(await demo('historique_demo.sql'))
  })
  // Aucun identifiant ni adresse qui ressemble à un vrai compte dans les captures
  await db.query('update public.comptes_connexion set identifiant = $2 where user_id = $1', [sa, SUPER_ADMIN.identifiant])
  await db.query("update auth.users set email = replace(email, '@identifiants.agence-elite.fr', '@identifiants.fictif.test') where email like 'admin@identifiants.agence-elite.fr'")
  await portefeuille(db, sa)
  return { superAdmin: sa }
}

// Clients FICTIFS dans tous les états utiles au super admin, créés par les vraies fonctions de la plateforme
// (licence échue, à renouveler sous 7 jours, active, suspendue, client bloqué)
export const CLIENTS_FICTIFS = [
  { nom: 'Bar Fictif Horizon', etab: 'Bar Fictif Horizon', offre: 'commerce-caisse', formule: 'mensuel', debut: -32, echeance: -2, montant: 25000 },
  { nom: 'Restaurant Fictif Lumière', etab: 'Lumière Centre (fictif)', offre: 'commerce-complet', formule: 'mensuel', debut: -25, echeance: 5, montant: 25000 },
  { nom: 'Boutique Fictive Saba', etab: 'Saba Marché (fictif)', offre: 'commerce-caisse', formule: 'annuel', debut: -60, echeance: 305, montant: 150000 },
  { nom: 'Épicerie Fictive Kalo', etab: 'Kalo Plateau (fictif)', offre: 'commerce-caisse', formule: 'mensuel', debut: -10, echeance: 20, montant: 25000, statutLicence: 'suspendue' },
  { nom: 'Hôtel Fictif Atlas', etab: 'Atlas Bord de mer (fictif)', offre: 'commerce-complet', formule: 'mensuel', debut: -40, echeance: -12, montant: 25000, statutClient: 'suspendu' },
]

async function portefeuille(db, sa) {
  const { executerComme } = await moteur()
  const jour = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  for (const c of CLIENTS_FICTIFS) {
    await executerComme(db, sa, async (tx) => {
      const un = async (sql, p) => Object.values((await tx.query(sql, p)).rows[0] || {})[0]
      const client = await un('select public.creer_client($1, $2)', [c.nom, 'CG'])
      const idClient = client?.id || client
      const etab = await un("select public.creer_etablissement($1, 'commerce', $2)", [idClient, c.etab])
      const idEtab = etab?.id || etab
      const licence = await un('select public.attribuer_licence($1, $2, $3, $4::date, $5::date, $6)', [idEtab, c.offre, c.formule, jour(c.debut), jour(c.echeance), c.montant])
      if (c.statutLicence) await tx.query('select public.definir_statut_licence($1, $2, $3)', [licence?.id || licence, c.statutLicence, 'Données fictives'])
      if (c.statutClient) await tx.query('select public.definir_statut_client($1, $2)', [idClient, c.statutClient])
    })
  }
}

export async function source() {
  if (DEPOT) return `dépôt local ${DEPOT}`
  const s = await readFile(resolve(ICI, 'instantane/SOURCE.md'), 'utf8')
  return (/commit ([^\n]+)/.exec(s) || [])[1] || 'instantané'
}
