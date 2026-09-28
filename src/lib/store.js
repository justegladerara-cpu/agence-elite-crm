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
  'mode', 'reference', 'categorie', 'fournisseur', 'recu',
]
const NUMERIC = ['montant', 'duree', 'note', 'remise']

// Ne nettoie que les champs présents (mise à jour partielle)
export function cleanPatch(a) {
  const full = cleanAction(a)
  return Object.fromEntries(Object.keys(full).filter((k) => k in a).map((k) => [k, full[k]]))
}

export function cleanAction(a) {
  const out = {}
  ACTION_FIELDS.forEach((k) => {
    let v = a[k]
    if (v === '' || v === undefined) v = null
    if (v !== null && NUMERIC.includes(k)) v = Number(String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'))
    if (v !== null && NUMERIC.includes(k) && isNaN(v)) v = null
    out[k] = v
  })
  return out
}

export function mergeSettings(s) {
  const m = { ...DEFAULT_SETTINGS, ...(s || {}) }
  m.alertes = { ...DEFAULT_SETTINGS.alertes, ...(m.alertes || {}) }
  m.facturation = { ...DEFAULT_SETTINGS.facturation, ...(m.facturation || {}) }
  m.apparence = { ...DEFAULT_SETTINGS.apparence, ...(m.apparence || {}) }
  m.rappels = { ...DEFAULT_SETTINGS.rappels, ...(m.rappels || {}) }
  // Objectifs quotidiens : créés à partir des anciens objectifs du jour s'ils n'existent pas encore
  if (!s?.objectifsQuotidiens && s?.objectifsJour) {
    const oj = s.objectifsJour
    const base = { dm: oj.dm, appels: oj.appels, prospects: oj.prospects }
    // Anciennes valeurs par défaut (20/20) : on passe à la « Rule of 100 »
    if (Number(oj.dm) === 20 && Number(oj.appels) === 20) Object.assign(base, { dm: 100, appels: 100 })
    m.objectifsQuotidiens = DEFAULT_SETTINGS.objectifsQuotidiens.map((o) => (base[o.source] !== undefined ? { ...o, cible: Number(base[o.source]) || o.cible } : o))
  }
  // Actions ajoutées après coup : on les complète dans les réglages déjà enregistrés
  const noms = new Set(m.actions.map((a) => a.nom))
  const manquantes = DEFAULT_SETTINGS.actions.filter((a) => ['Intervention', 'Commande boutique'].includes(a.nom) && !noms.has(a.nom))
  if (manquantes.length) m.actions = [...m.actions, ...manquantes]
  // Résultat « A répondu » (prospection Instagram) ajouté après coup
  if (!m.resultats.some((r) => r.nom === 'A répondu')) m.resultats = [...m.resultats, DEFAULT_SETTINGS.resultats.find((r) => r.nom === 'A répondu')]
  if (!m.modeles.includes('Script principal (vidéo gratuite)') && m.modeles.length < 9) m.modeles = ['Script principal (vidéo gratuite)', ...m.modeles]
  return m
}

// Photos de reçus en attente d'envoi (mode démo ou hors ligne) : chemin → image en data URL
const RECUS = 'aecrm-recus'
const readRecus = () => {
  try {
    return JSON.parse(localStorage.getItem(RECUS)) || {}
  } catch {
    return {}
  }
}
const writeRecus = (m) => {
  try {
    localStorage.setItem(RECUS, JSON.stringify(m))
  } catch {
    throw new Error("Plus assez de place sur l'appareil pour garder la photo hors ligne.")
  }
}
const dataUrlToBlob = async (u) => (await fetch(u)).blob()
const signedUrls = {}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
const nowIso = () => new Date().toISOString()

// ---------- Local ----------
const LS = 'agence-elite-crm'
const readLocal = () => {
  try {
    const db = JSON.parse(localStorage.getItem(LS)) || { prospects: [], actions: [], settings: null }
    db.documents = db.documents || []
    return db
  } catch {
    return { prospects: [], actions: [], documents: [], settings: null }
  }
}
const writeLocal = (db) => localStorage.setItem(LS, JSON.stringify(db))

const local = {
  async load() {
    const db = readLocal()
    return { prospects: db.prospects, actions: db.actions, documents: db.documents, settings: mergeSettings(db.settings) }
  },
  async saveDoc(doc) {
    const db = readLocal()
    const row = { created_at: nowIso(), ...doc, id: doc.id || uid() }
    db.documents = [...db.documents.filter((x) => x.id !== row.id), row]
    writeLocal(db)
    return row
  },
  async uploadRecu(dataUrl, ext) {
    const path = `demo/${uid()}.${ext}`
    writeRecus({ ...readRecus(), [path]: dataUrl })
    return path
  },
  async recuUrl(path) {
    return readRecus()[path] || null
  },
  async deleteDoc(id) {
    const db = readLocal()
    db.documents = db.documents.filter((x) => x.id !== id)
    writeLocal(db)
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
    db.documents = db.documents.map((d) => (d.prospect_id === id ? { ...d, prospect_id: null } : d))
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
    Object.assign(a, cleanPatch(patch))
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
  // Annulation d'une suppression : remet les lignes avec leurs identifiants d'origine
  async restaurer({ prospects = [], actions = [], documents = [] }) {
    const db = readLocal()
    const ids = new Set(prospects.map((p) => p.id))
    db.prospects = [...db.prospects.filter((x) => !ids.has(x.id)), ...prospects]
    const aIds = new Set(actions.map((a) => a.id))
    db.actions = [...db.actions.filter((x) => !aIds.has(x.id)), ...actions]
    const dIds = new Set(documents.map((d) => d.id))
    db.documents = [...(db.documents || []).filter((x) => !dIds.has(x.id)), ...documents]
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
    const [prospects, actions, documents, settings] = await Promise.all([
      fetchAll('prospects'),
      fetchAll('actions'),
      fetchAll('documents'),
      supabase.from('settings').select('*').maybeSingle().then(check),
    ])
    return { prospects, actions, documents, settings: mergeSettings(settings?.data) }
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
    return check(await supabase.from('actions').update(cleanPatch(patch)).eq('id', id).select().single())
  },
  async deleteAction(id) {
    check(await supabase.from('actions').delete().eq('id', id))
  },
  async saveSettings(settings) {
    const { data: u, error } = await supabase.auth.getUser()
    if (error || !u?.user) throw new Error(`auth : ${error?.message || 'session expirée'}`)
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

// ---------- Hors ligne ----------
// Copie locale des données + file d'attente des modifications. Chaque écriture est appliquée
// tout de suite sur la copie locale, puis envoyée à Supabase dès que la connexion le permet.
const CACHE = 'aecrm-cache'
const QUEUE = 'aecrm-queue'
const readJson = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}
const writeJson = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    throw new Error("Mémoire de l'appareil pleine : reconnecte-toi à internet pour synchroniser avant de continuer.")
  }
}
// Déconnexion : on efface la copie locale pour ne rien laisser au compte suivant
export function clearOffline() {
  ;[CACHE, QUEUE, RECUS].forEach((k) => localStorage.removeItem(k))
  emit({ pending: 0, error: '' })
}
export const hasOfflineCache = () => !!localStorage.getItem(CACHE)

const isNetworkError = (e) =>
  !navigator.onLine || /fetch|network|load failed|timed? ?out|connexion/i.test(String(e?.message || e))
// Session expirée : on garde la file et on réessaiera après reconnexion
const isAuthError = (e) => /jwt|token|auth|401|session/i.test(String(e?.message || e))

// État de synchronisation, affiché dans l'interface
const LAST = 'aecrm-derniere-synchro'
let sync = { online: navigator.onLine, pending: readJson(QUEUE, []).length, syncing: false, error: '', derniere: readJson(LAST, null) }
const listeners = new Set()
const emit = (patch) => {
  // Heure de la dernière synchronisation réussie (tout est envoyé et en ligne)
  if (patch.online !== false && patch.pending === 0 && !patch.syncing && !patch.error) {
    patch = { ...patch, derniere: new Date().toISOString() }
    try {
      localStorage.setItem(LAST, JSON.stringify(patch.derniere))
    } catch {
      /* sans importance */
    }
  }
  sync = { ...sync, ...patch }
  listeners.forEach((f) => f(sync))
}
export const syncStatus = {
  get: () => sync,
  subscribe(f) {
    listeners.add(f)
    return () => listeners.delete(f)
  },
}

// Applique une opération sur la copie locale
function applyLocal(c, op) {
  if (op.t === 'addProspect') c.prospects = [...c.prospects.filter((x) => x.id !== op.row.id), op.row]
  if (op.t === 'updateProspect') c.prospects = c.prospects.map((x) => (x.id === op.id ? { ...x, ...op.patch } : x))
  if (op.t === 'deleteProspect') {
    c.prospects = c.prospects.filter((x) => x.id !== op.id)
    c.actions = c.actions.filter((x) => x.prospect_id !== op.id)
    c.documents = (c.documents || []).map((d) => (d.prospect_id === op.id ? { ...d, prospect_id: null } : d))
  }
  if (op.t === 'addActions') {
    const ids = new Set(op.rows.map((r) => r.id))
    c.actions = [...c.actions.filter((x) => !ids.has(x.id)), ...op.rows]
  }
  if (op.t === 'updateAction') c.actions = c.actions.map((x) => (x.id === op.id ? { ...x, ...op.patch } : x))
  if (op.t === 'deleteAction') c.actions = c.actions.filter((x) => x.id !== op.id)
  if (op.t === 'saveSettings') c.settings = op.settings
  if (op.t === 'saveDoc') c.documents = [...(c.documents || []).filter((x) => x.id !== op.row.id), op.row]
  if (op.t === 'deleteDoc') c.documents = (c.documents || []).filter((x) => x.id !== op.id)
  return c
}

// Envoie une opération à Supabase (insertions idempotentes grâce aux identifiants générés ici)
async function sendRemote(op) {
  if (op.t === 'addProspect') check(await supabase.from('prospects').upsert(op.row, { onConflict: 'id' }))
  if (op.t === 'updateProspect') check(await supabase.from('prospects').update(op.patch).eq('id', op.id))
  if (op.t === 'deleteProspect') check(await supabase.from('prospects').delete().eq('id', op.id))
  if (op.t === 'addActions') check(await supabase.from('actions').upsert(op.rows, { onConflict: 'id' }))
  if (op.t === 'updateAction') check(await supabase.from('actions').update(op.patch).eq('id', op.id))
  if (op.t === 'deleteAction') check(await supabase.from('actions').delete().eq('id', op.id))
  if (op.t === 'saveSettings') await remote.saveSettings(op.settings)
  if (op.t === 'saveDoc') check(await supabase.from('documents').upsert(op.row, { onConflict: 'id' }))
  if (op.t === 'deleteDoc') check(await supabase.from('documents').delete().eq('id', op.id))
  if (op.t === 'upload') {
    const m = readRecus()
    if (m[op.path]) {
      check(await supabase.storage.from('recus').upload(op.path, await dataUrlToBlob(m[op.path]), { upsert: true, contentType: op.type }))
      delete m[op.path]
      writeRecus(m)
    }
  }
}

let flushing = null
export function flush() {
  if (!flushing) flushing = doFlush().finally(() => (flushing = null))
  return flushing
}
async function doFlush() {
  let q = readJson(QUEUE, [])
  if (!q.length || !navigator.onLine) return emit({ pending: q.length, online: navigator.onLine })
  emit({ syncing: true })
  try {
    await supabase.auth.getSession() // rafraîchit le jeton si besoin
  } catch {
    /* hors ligne */
  }
  while (q.length) {
    const op = q[0]
    try {
      await sendRemote(op)
    } catch (e) {
      // Horloge de l'appareil un peu en retard sur Supabase : la file est gardée et renvoyée quelques secondes plus tard
      if (/issued at future|in the future/i.test(String(e?.message || e))) {
        emit({ syncing: false, pending: q.length })
        setTimeout(flush, 3000)
        return
      }
      if (isNetworkError(e) || isAuthError(e)) {
        emit({ syncing: false, online: navigator.onLine, pending: q.length, error: !isNetworkError(e) ? 'Reconnecte-toi pour synchroniser tes modifications.' : '' })
        return
      }
      // Refus du serveur (donnée invalide) : on l'écarte pour ne pas bloquer la file
      emit({ error: `Une modification n'a pas pu être synchronisée : ${e.message}` })
    }
    // Relit la file : des modifications ont pu s'ajouter pendant l'envoi
    q = readJson(QUEUE, [])
    if (q.length && (q[0].k === op.k || (!op.k && JSON.stringify(q[0]) === JSON.stringify(op)))) q = q.slice(1)
    try {
      writeJson(QUEUE, q)
    } catch {
      /* rien de plus petit à écrire */
    }
    emit({ pending: q.length })
  }
  emit({ syncing: false, online: true, pending: 0, error: '' })
}

let generation = 0
async function queued(op) {
  op = { ...op, k: uid() }
  generation++
  const q = [...readJson(QUEUE, []), op]
  writeJson(QUEUE, q)
  try {
    writeJson(CACHE, applyLocal(readJson(CACHE, { prospects: [], actions: [], settings: null }), op))
  } catch {
    /* la file est prioritaire ; la copie locale sera reconstruite au prochain chargement */
  }
  emit({ pending: q.length })
  flush()
}

const offline = {
  async load() {
    if (navigator.onLine) {
      try {
        await flush()
        if (!readJson(QUEUE, []).length) {
          const gen = generation
          const [prospects, actions, documents, settings] = await Promise.all([
            fetchAll('prospects'),
            fetchAll('actions'),
            fetchAll('documents'),
            supabase.from('settings').select('*').maybeSingle().then(check),
          ])
          // Une modification faite pendant le chargement : on garde la copie locale, plus récente
          if (gen === generation) {
            try {
              writeJson(CACHE, { prospects, actions, documents, settings: settings?.data || null })
            } catch {
              /* cache trop gros : on continue sans */
            }
            emit({ online: true, pending: 0 })
            return { prospects, actions, documents, settings: mergeSettings(settings?.data) }
          }
        }
      } catch (e) {
        if (!isNetworkError(e) || !hasOfflineCache()) throw e
      }
    }
    if (!hasOfflineCache()) throw new Error("Pas de connexion internet. Ouvre le CRM une première fois en ligne sur cet appareil.")
    emit({ online: navigator.onLine })
    const c = readJson(CACHE, {})
    return { prospects: c.prospects || [], actions: c.actions || [], documents: c.documents || [], settings: mergeSettings(c.settings) }
  },
  async addProspect(name, fiche) {
    const row = { id: uid(), name, fiche: fiche || {}, created_at: nowIso() }
    await queued({ t: 'addProspect', row })
    return row
  },
  async updateProspect(id, patch) {
    await queued({ t: 'updateProspect', id, patch })
    return patch
  },
  async deleteProspect(id) {
    await queued({ t: 'deleteProspect', id })
  },
  async addActions(list) {
    const rows = list.map((a) => ({ id: uid(), created_at: nowIso(), ...cleanAction(a) }))
    await queued({ t: 'addActions', rows })
    return rows
  },
  async updateAction(id, patch) {
    const clean = cleanPatch(patch)
    await queued({ t: 'updateAction', id, patch: clean })
    return { id, ...clean }
  },
  async deleteAction(id) {
    await queued({ t: 'deleteAction', id })
  },
  async saveSettings(settings) {
    await queued({ t: 'saveSettings', settings })
  },
  async saveDoc(doc) {
    const row = { created_at: nowIso(), ...doc, id: doc.id || uid() }
    delete row.user_id
    await queued({ t: 'saveDoc', row })
    return row
  },
  async deleteDoc(id) {
    await queued({ t: 'deleteDoc', id })
  },
  // Photo du reçu : gardée sur l'appareil puis envoyée dans le stockage privé
  async uploadRecu(dataUrl, ext, type) {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user?.id
    if (!user) throw new Error('Reconnecte-toi pour ajouter une photo.')
    const path = `${user}/${uid()}.${ext}`
    writeRecus({ ...readRecus(), [path]: dataUrl })
    await queued({ t: 'upload', path, type })
    return path
  },
  async recuUrl(path) {
    const pending = readRecus()[path]
    if (pending) return pending
    const c = signedUrls[path]
    if (c && c.exp > Date.now()) return c.url
    const { data, error } = await supabase.storage.from('recus').createSignedUrl(path, 3600)
    if (error) throw new Error(error.message)
    signedUrls[path] = { url: data.signedUrl, exp: Date.now() + 3000 * 1000 }
    return data.signedUrl
  },
  async restaurer({ prospects = [], actions = [], documents = [] }) {
    for (const p of prospects) await queued({ t: 'addProspect', row: { id: p.id, name: p.name, fiche: p.fiche || {}, created_at: p.created_at || nowIso() } })
    if (actions.length) await queued({ t: 'addActions', rows: actions.map((a) => ({ id: a.id, created_at: a.created_at || nowIso(), ...cleanAction(a) })) })
    for (const d of documents) {
      const row = { ...d }
      delete row.user_id
      await queued({ t: 'saveDoc', row })
    }
  },
  // Import et remise à zéro : uniquement en ligne
  async bulkImport(prospects, actions) {
    if (!navigator.onLine) throw new Error("L'import Excel demande une connexion internet.")
    await flush()
    await remote.bulkImport(prospects, actions)
  },
  async wipe() {
    if (!navigator.onLine) throw new Error('Cette opération demande une connexion internet.')
    await flush()
    await remote.wipe()
  },
}

if (supabase && typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emit({ online: true })
    flush()
  })
  window.addEventListener('offline', () => emit({ online: false }))
}

export const db = supabase ? offline : local
export { uid }
