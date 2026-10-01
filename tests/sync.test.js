// File de synchronisation et conflit de numéro de devis/facture (index unique documents_workspace_type_numero_unique).
// Supabase est simulé : un numéro déjà pris dans l'espace provoque l'erreur exacte renvoyée par la base.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { estConflitNumero, ajouterConflit, retirerConflit, avecConflits, messageConflits } from '../src/lib/conflits'

const ERREUR = 'duplicate key value violates unique constraint "documents_workspace_type_numero_unique"'

// localStorage et navigator minimaux (Vitest tourne sous Node)
const memoire = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: (k) => memoire.delete(k),
}
let enLigne = true
Object.defineProperty(globalThis, 'navigator', { value: { get onLine() { return enLigne } }, configurable: true })
globalThis.location = { reload() {} }

// Base simulée : documents existants sur le serveur (un autre appareil a déjà créé FAC-0001)
let serveur
const requete = (table) => {
  const filtres = []
  let op = 'select'
  let ligne
  const b = {
    select: () => b,
    order: () => b,
    range: () => b,
    limit: () => b,
    eq: (c, v) => (filtres.push((r) => r[c] === v), b),
    neq: (c, v) => (filtres.push((r) => r[c] !== v), b),
    ilike: (c, v) => (filtres.push((r) => String(r[c]).toLowerCase() === v.replace(/\\(.)/g, '$1').toLowerCase()), b),
    upsert: (r) => ((op = 'upsert'), (ligne = r), b),
    insert: (r) => ((op = 'upsert'), (ligne = r), b),
    update: () => ((op = 'update'), b),
    delete: () => ((op = 'delete'), b),
    maybeSingle: () => b,
    single: () => b,
    then(ok, ko) {
      let res
      if (table === 'workspaces') res = { data: [{ id: 'w1', owner_id: 'u1' }], error: null }
      else if (table === 'workspace_members') res = { data: { role: 'proprietaire' }, error: null }
      else if (table !== 'documents') res = { data: op === 'select' ? [] : null, error: null }
      else if (op === 'upsert') {
        const pris = serveur.some((d) => d.id !== ligne.id && d.type === ligne.type && d.numero.trim().toLowerCase() === ligne.numero.trim().toLowerCase())
        if (pris) res = { data: null, error: { message: ERREUR, code: '23505' } }
        else {
          serveur = [...serveur.filter((d) => d.id !== ligne.id), { ...ligne, workspace_id: 'w1' }]
          res = { data: null, error: null }
        }
      } else res = { data: serveur.filter((r) => filtres.every((f) => f(r))), error: null }
      return Promise.resolve(res).then(ok, ko)
    },
  }
  return b
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: requete,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({}) },
  }),
}))

async function charger() {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'cle-publique-de-test')
  return import('../src/lib/store')
}

beforeEach(() => {
  memoire.clear()
  enLigne = true
  serveur = [{ id: 'autre', type: 'facture', numero: 'FAC-0001', workspace_id: 'w1', data: {} }]
})

describe('conflits de numéro : fonctions pures', () => {
  it('reconnaît uniquement l’erreur de l’index des numéros', () => {
    expect(estConflitNumero(new Error(ERREUR))).toBe(true)
    expect(estConflitNumero(new Error('duplicate key value violates unique constraint "prospects_pkey"'))).toBe(false)
  })
  it('une entrée par document, réaffichée et marquée après chargement', () => {
    let l = ajouterConflit([], { id: 'd1', type: 'facture', numero: 'A' })
    l = ajouterConflit(l, { id: 'd1', type: 'facture', numero: 'B' })
    expect(l).toHaveLength(1)
    expect(avecConflits([{ id: 'd1', numero: 'vieux' }, { id: 'd2' }], l)).toEqual([{ id: 'd2' }, { id: 'd1', type: 'facture', numero: 'B', conflitNumero: true }])
    expect(messageConflits(l)).toMatch(/B est déjà utilisé/)
    expect(retirerConflit(l, 'd1')).toEqual([])
    expect(messageConflits([])).toBe('')
  })
})

describe('file de synchronisation : un numéro déjà pris n’est jamais perdu', () => {
  it('en ligne : l’enregistrement est refusé avec un message clair, rien n’est annoncé comme réussi', async () => {
    const { db, syncStatus } = await charger()
    await expect(db.saveDoc({ type: 'facture', numero: 'fac-0001 ', data: {} })).rejects.toMatchObject({ conflitNumero: true, message: expect.stringMatching(/fac-0001 est déjà utilisé.*choisis un autre numéro/s) })
    expect(syncStatus.get().conflits).toBe(1)
    expect(syncStatus.get().error).toMatch(/déjà utilisé/)
    expect(serveur).toHaveLength(1)
  })

  it('le document refusé reste visible après rechargement, puis se synchronise une fois le numéro changé', async () => {
    const { db, syncStatus } = await charger()
    const err = await db.saveDoc({ id: 'd1', type: 'facture', numero: 'FAC-0001', data: { objet: 'Maintenance' } }).catch((e) => e)
    expect(err.conflitNumero).toBe(true)
    let st = await db.load()
    const garde = st.documents.find((d) => d.id === 'd1')
    expect(garde).toMatchObject({ numero: 'FAC-0001', conflitNumero: true, data: { objet: 'Maintenance' } })
    // Correction : nouveau numéro, l'indicateur interne n'est pas envoyé à la base
    await db.saveDoc({ ...garde, numero: 'FAC-0002' })
    expect(serveur.find((d) => d.id === 'd1')).toMatchObject({ numero: 'FAC-0002' })
    expect(serveur.find((d) => d.id === 'd1')).not.toHaveProperty('conflitNumero')
    expect(syncStatus.get()).toMatchObject({ conflits: 0, error: '' })
    st = await db.load()
    expect(st.documents.filter((d) => d.conflitNumero)).toEqual([])
  })

  it('hors ligne : enregistré sur l’appareil comme avant, mis de côté et signalé à la synchronisation', async () => {
    const { db, flush, syncStatus } = await charger()
    enLigne = false
    const row = await db.saveDoc({ id: 'd2', type: 'facture', numero: 'FAC-0001', data: {} })
    expect(row.id).toBe('d2')
    expect(syncStatus.get().pending).toBe(1)
    enLigne = true
    await flush()
    expect(syncStatus.get()).toMatchObject({ pending: 0, conflits: 1 })
    expect(syncStatus.get().error).toMatch(/FAC-0001 est déjà utilisé/)
    expect((await db.load()).documents.find((d) => d.id === 'd2')).toMatchObject({ conflitNumero: true })
    // Supprimer le document en conflit le retire aussi de la liste
    await db.deleteDoc('d2')
    expect(syncStatus.get().conflits).toBe(0)
  })

  it('vérifie un numéro avant toute écriture, sans tenir compte de la casse', async () => {
    const { db } = await charger()
    expect(await db.numeroLibre('facture', ' fac-0001', undefined)).toBe(false)
    expect(await db.numeroLibre('facture', 'FAC-0001', 'autre')).toBe(true)
    expect(await db.numeroLibre('devis', 'FAC-0001', undefined)).toBe(true)
    enLigne = false
    expect(await db.numeroLibre('facture', 'FAC-0001', undefined)).toBe(true)
  })

  it('un autre document se synchronise normalement', async () => {
    const { db, syncStatus } = await charger()
    await db.saveDoc({ id: 'd3', type: 'devis', numero: 'FAC-0001', data: {} })
    expect(serveur.find((d) => d.id === 'd3')).toBeTruthy()
    expect(syncStatus.get()).toMatchObject({ conflits: 0, error: '' })
  })
})
