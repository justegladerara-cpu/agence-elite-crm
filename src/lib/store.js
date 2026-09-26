// Couche de données : Supabase si configuré, sinon stockage local du navigateur (mode démo).
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from './defaults'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = URL && KEY ? createClient(URL, KEY) : null
export const isLocal = !supabase

const ACTION_FIELDS = [
  'prospect_id', 'date', 'time', 'canal', 'action', 'resultat', 'montant', 'duree', 'prochaine_action',
  'date_relance', 'heure_rappel', 'objection', 'modele', 'note', 'facture', 'remise', 'notes',
]
const NUMERIC = ['montant', 'duree', 'note', 'remise']

export function cleanAction(a) {
  const out = {}
  ACTION_FIELDS.forEach((k) => {
    let v = a[k]
    if (v === '' || v === undefined) v = null
    if (v !== null && NUMERIC.includes(k)) v = Number(String(v).replace(',', '.'))
    if (v !== null && NUMERIC.includes(k) && isNaN(v)) v = null
    out[k] = v
  })
  return out
}

export function mergeSettings(s) {
  return { ...DEFAULT_SETTINGS, ...(s || {}) }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
const nowIso = () => new Date().toISOString()

// ---------- Local ----------
const LS = 'agence-elite-crm'
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS)) || { prospects: [], actions: [], settings: null }
  } catch {
    return { prospects: [], actions: [], settings: null }
  }
}
const writeLocal = (db) => localStorage.setItem(LS, JSON.stringify(db))

const local = {
  async load() {
    const db = readLocal()
    return { prospects: db.prospects, actions: db.actions, settings: mergeSettings(db.settings) }
  },
  async addProspect(name, fiche) {
    const db = readLocal()
    const p = { id: uid(), name, fiche: fiche || {}, created_at: nowIso() }
    db.prospects.push(p)
    writeLocal(db)
    return p
  },
  async updateProspect(id, patch) {
    const db = readLocal()
    const p = db.prospects.find((x) => x.id === id)
    Object.assign(p, patch)
    writeLocal(db)
    return p
  },
  async deleteProspect(id) {
    const db = readLocal()
    db.prospects = db.prospects.filter((x) => x.id !== id)
    db.actions = db.actions.filter((x) => x.prospect_id !== id)
    writeLocal(db)
  },
  async addActions(list) {
    const db = readLocal()
    const rows = list.map((a) => ({ id: uid(), created_at: nowIso(), ...cleanAction(a) }))
    db.actions.push(...rows)
    writeLocal(db)
    return rows
  },
  async updateAction(id, patch) {
    const db = readLocal()
    const a = db.actions.find((x) => x.id === id)
    Object.assign(a, cleanAction({ ...a, ...patch }))
    writeLocal(db)
    return a
  },
  async deleteAction(id) {
    const db = readLocal()
    db.actions = db.actions.filter((x) => x.id !== id)
    writeLocal(db)
  },
  async saveSettings(settings) {
    const db = readLocal()
    db.settings = settings
    writeLocal(db)
  },
  async bulkImport(prospects, actions) {
    const db = readLocal()
    db.prospects.push(...prospects.map((p) => ({ created_at: nowIso(), ...p })))
    db.actions.push(...actions.map((a) => ({ id: uid(), created_at: nowIso(), ...cleanAction(a) })))
    writeLocal(db)
  },
  async wipe() {
    const db = readLocal()
    db.prospects = []
    db.actions = []
    writeLocal(db)
  },
}

// ---------- Supabase ----------
const check = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
async function fetchAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const rows = check(await supabase.from(table).select('*').range(from, from + 999))
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const remote = {
  async load() {
    const [prospects, actions, settings] = await Promise.all([
      fetchAll('prospects'),
      fetchAll('actions'),
      supabase.from('settings').select('*').maybeSingle().then(check),
    ])
    return { prospects, actions, settings: mergeSettings(settings?.data) }
  },
  async addProspect(name, fiche) {
    return check(await supabase.from('prospects').insert({ name, fiche: fiche || {} }).select().single())
  },
  async updateProspect(id, patch) {
    return check(await supabase.from('prospects').update(patch).eq('id', id).select().single())
  },
  async deleteProspect(id) {
    check(await supabase.from('prospects').delete().eq('id', id))
  },
  async addActions(list) {
    return check(await supabase.from('actions').insert(list.map(cleanAction)).select())
  },
  async updateAction(id, patch) {
    return check(await supabase.from('actions').update(cleanAction(patch)).eq('id', id).select().single())
  },
  async deleteAction(id) {
    check(await supabase.from('actions').delete().eq('id', id))
  },
  async saveSettings(settings) {
    const { data: u } = await supabase.auth.getUser()
    check(await supabase.from('settings').upsert({ user_id: u.user.id, data: settings, updated_at: nowIso() }))
  },
  async bulkImport(prospects, actions) {
    for (let i = 0; i < prospects.length; i += 500) check(await supabase.from('prospects').insert(prospects.slice(i, i + 500)))
    const rows = actions.map(cleanAction)
    for (let i = 0; i < rows.length; i += 500) check(await supabase.from('actions').insert(rows.slice(i, i + 500)))
  },
  async wipe() {
    check(await supabase.from('actions').delete().not('id', 'is', null))
    check(await supabase.from('prospects').delete().not('id', 'is', null))
  },
}

export const db = supabase ? remote : local
export { uid }
