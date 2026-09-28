// Export vers le fichier Excel de pilotage (même onglets, mêmes formules) et import depuis ce fichier.
import JSZip from 'jszip'
import { lireXlsx } from './tableur'
import { FICHE_FIELDS, ACTION_COLS } from './defaults'
import { sortActions } from './logic'
import { uid } from './store'
import { parse, pad, iso } from './dates'

// ---------- Correspondance Paramètres <-> cellules ----------
const SCALARS = [
  ['B6', 'objectifsJour.prospects'], ['B7', 'objectifsJour.appels'], ['B8', 'objectifsJour.dm'],
  ['B11', 'objectifsMois.appels'], ['B12', 'objectifsMois.dm'], ['B13', 'objectifsMois.rdv'],
  ['B14', 'objectifsMois.clients'], ['B15', 'objectifsMois.ca'],
  ['B18', 'relance.j1'], ['B19', 'relance.j2'], ['B20', 'relance.j3'], ['B21', 'relance.stop'],
  ['B24', 'alertes.sansAction'], ['B25', 'alertes.propositionSansReponse'], ['B26', 'alertes.validiteProposition'],
  ['B27', 'alertes.delaiPaiement'], ['B28', 'alertes.recontacterPerdu'], ['B29', 'alertes.avisGoogle'],
  ['B30', 'alertes.renouvellement'],
  ['B33', 'clients.engagementMois'], ['B34', 'clients.dureeVieMois'], ['B35', 'clients.indicatifWhatsApp', 'text'],
  ['B38', 'score.pubActive'], ['B39', 'score.pubReguliere'], ['B40', 'score.pubRecente'], ['B41', 'score.pasDeSite'],
  ['B42', 'score.googleAbsente'], ['B43', 'score.googleFaible'], ['B44', 'score.noteGoogleBasse'],
  ['B45', 'score.entrepriseMoyenne'], ['B46', 'score.grandeEntreprise'], ['B47', 'score.recommande'],
]
// liste : [clé, première ligne, dernière ligne, colonnes [colonne, champ, type]]
const LISTS = [
  ['canaux', 6, 10, [['D']]],
  ['etapes', 6, 13, [['F', 'nom'], ['G', 'proba', 'num']]],
  ['actions', 6, 33, [['I', 'nom'], ['J', 'rang', 'num'], ['K', 'prospection', 'bool']]],
  ['resultats', 6, 17, [['M', 'nom'], ['N', 'rang', 'num'], ['O', 'reponse', 'bool']]],
  ['offres', 6, 15, [['Q', 'nom'], ['R', 'prix', 'num'], ['S', 'abonnement', 'num'], ['T', 'cout', 'num']]],
  ['secteurs', 6, 20, [['V', 'nom'], ['W', 'demo']]],
  ['objections', 6, 17, [['Y']]],
  ['modeles', 6, 14, [['AA']]],
  ['sources', 6, 16, [['AC']]],
  ['zones', 6, 13, [['AE']]],
  ['depensesFixes', 6, 12, [['AG', 'nom'], ['AH', 'montant', 'num']]],
]

const getPath = (o, p) => p.split('.').reduce((m, k) => (m ? m[k] : undefined), o)
const setPath = (o, p, v) => {
  const ks = p.split('.')
  let m = o
  ks.slice(0, -1).forEach((k) => (m = m[k] = m[k] || {}))
  m[ks[ks.length - 1]] = v
}

// ---------- Utilitaires Excel ----------
const colNum = (c) => c.split('').reduce((m, ch) => m * 26 + ch.charCodeAt(0) - 64, 0)
const EPOCH = Date.UTC(1899, 11, 30)
const toSerial = (isoDate) => {
  const d = parse(isoDate)
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000)
}
const fromSerial = (n) => {
  const d = new Date(EPOCH + Math.round(Number(n)) * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const timeToSerial = (t) => {
  const [h, m] = t.split(':').map(Number)
  return (h * 60 + (m || 0)) / 1440
}
const serialToTime = (n) => {
  const mins = Math.round((Number(n) % 1) * 1440)
  return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`
}
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // caractères interdits en XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function cellXml(ref, style, value) {
  const s = style ? ` s="${style}"` : ''
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s} t="n" />`
  if (typeof value === 'number') return `<c r="${ref}"${s} t="n"><v>${value}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

// Applique des modifications { "A5": valeur } à un XML de feuille, en gardant les styles.
function editSheet(xml, edits) {
  const byRow = new Map()
  Object.entries(edits).forEach(([ref, v]) => {
    const [, col, row] = ref.match(/^([A-Z]+)(\d+)$/)
    if (!byRow.has(+row)) byRow.set(+row, new Map())
    byRow.get(+row).set(col, v)
  })
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  const done = new Set()
  xml = xml.replace(/<row r="(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (whole, r, attrs, inner) => {
    const rn = +r
    const ed = byRow.get(rn)
    if (!ed) return whole
    done.add(rn)
    const cells = []
    ;(inner || '').replace(cellRe, (c, col, _row, cattrs) => {
      cells.push({ col, xml: c, style: (cattrs.match(/ s="(\d+)"/) || [])[1] })
      return ''
    })
    ed.forEach((v, col) => {
      const ex = cells.find((c) => c.col === col)
      const x = cellXml(`${col}${rn}`, ex?.style, v)
      if (ex) ex.xml = x
      else cells.push({ col, xml: x })
    })
    cells.sort((a, b) => colNum(a.col) - colNum(b.col))
    return `<row r="${rn}"${attrs.replace(/\s*\/$/, '')}>${cells.map((c) => c.xml).join('')}</row>`
  })
  // Lignes absentes : on les crée
  const missing = [...byRow.keys()].filter((r) => !done.has(r)).sort((a, b) => a - b)
  if (missing.length) {
    missing.forEach((rn) => {
      const cells = [...byRow.get(rn).entries()]
        .sort((a, b) => colNum(a[0]) - colNum(b[0]))
        .map(([col, v]) => cellXml(`${col}${rn}`, null, v))
        .join('')
      const rowXml = `<row r="${rn}">${cells}</row>`
      // insère avant la première ligne de numéro supérieur
      let inserted = false
      xml = xml.replace(/<row r="(\d+)"/g, (m, r) => {
        if (!inserted && +r > rn) {
          inserted = true
          return rowXml + m
        }
        return m
      })
      if (!inserted) xml = xml.replace('</sheetData>', rowXml + '</sheetData>')
    })
  }
  return xml
}

async function sheetPaths(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const out = {}
  for (const m of wb.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const rel = rels.match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${m[2]}"`)) ||
      rels.match(new RegExp(`<Relationship[^>]*Id="${m[2]}"[^>]*Target="([^"]+)"`))
    let target = rel[1].replace(/^\//, '')
    if (!target.startsWith('xl/')) target = 'xl/' + target
    out[m[1]] = target
  }
  return out
}

// ---------- Export ----------
export const SAISIE_ROWS = 2000
const INTERV = 'Intervention : '
// Champs propres au CRM (paiements, dépenses) : ajoutés en fin de notes « [Mode : … · Réf : …] »
const EXTRAS = [['mode', 'Mode'], ['reference', 'Réf'], ['categorie', 'Catégorie'], ['fournisseur', 'Fournisseur'], ['recu', 'Reçu']]
const extrasTexte = (a) => {
  const parts = EXTRAS.filter(([k]) => a[k]).map(([k, l]) => `${l} : ${String(a[k]).replace(/[·\]]/g, ' ')}`)
  return parts.length ? `[${parts.join(' · ')}]` : ''
}
function lireExtras(notes) {
  const m = /\s*\[((?:Mode|Réf|Catégorie|Fournisseur|Reçu) : [^\]]*)\]$/.exec(notes || '')
  if (!m) return { notes }
  const out = { notes: notes.slice(0, m.index).trim() || null }
  m[1].split(' · ').forEach((part) => {
    const i = part.indexOf(' : ')
    const e = EXTRAS.find(([, l]) => l === part.slice(0, i))
    if (e) out[e[0]] = part.slice(i + 3).trim()
  })
  return out
}

export async function buildExcel(templateBuffer, prospects, actions, settings) {
  const zip = await JSZip.loadAsync(templateBuffer)
  const paths = await sheetPaths(zip)
  const byId = Object.fromEntries(prospects.map((p) => [p.id, p]))
  const rows = sortActions(actions)
  // Un prospect sans action reçoit une ligne « Ajout prospect » pour apparaître dans le fichier.
  const withActs = new Set(rows.map((a) => a.prospect_id))
  prospects
    .filter((p) => !withActs.has(p.id))
    .forEach((p) => rows.push({ prospect_id: p.id, date: p.created_at ? iso(new Date(p.created_at)) : '', action: 'Ajout prospect' }))
  const ordered = sortActions(rows)
  if (ordered.length > SAISIE_ROWS) throw new Error(`Le fichier Excel accepte ${SAISIE_ROWS} lignes de saisie, tu en as ${ordered.length}.`)

  // Saisie : on vide les colonnes A → AQ puis on écrit le journal.
  const edits = {}
  const inputCols = [...Object.values(ACTION_COLS), ...FICHE_FIELDS.map((f) => f.col)]
  for (let r = 5; r < 5 + SAISIE_ROWS; r++) inputCols.forEach((c) => (edits[`${c}${r}`] = null))
  const seen = new Set()
  // « Intervention » n'existe que dans le CRM : exportée en Signature (la 1re, si le client n'en a pas)
  // ou en Vente additionnelle, avec le repère « Intervention : » dans les notes pour la réimporter.
  const signes = new Set(ordered.filter((a) => a.action === 'Signature').map((a) => a.prospect_id))
  ordered.forEach((a, k) => {
    if (a.action !== 'Intervention') return
    const action = signes.has(a.prospect_id) ? 'Vente additionnelle' : 'Signature'
    signes.add(a.prospect_id)
    ordered[k] = { ...a, action, notes: `${INTERV}${a.notes || ''}` }
  })
  ordered.forEach((a, i) => {
    const r = 5 + i
    const p = byId[a.prospect_id]
    const set = (col, v) => (edits[`${col}${r}`] = v)
    set('A', a.date ? toSerial(a.date) : null)
    set('B', a.time ? timeToSerial(a.time) : null)
    set('C', p ? p.name : null)
    set('D', a.canal)
    set('E', a.action)
    set('F', a.resultat)
    set('G', a.montant === null || a.montant === undefined ? null : Number(a.montant))
    set('H', a.duree === null || a.duree === undefined ? null : Number(a.duree))
    set('I', a.prochaine_action)
    set('J', a.date_relance ? toSerial(a.date_relance) : null)
    set('K', a.heure_rappel ? timeToSerial(a.heure_rappel) : null)
    set('L', a.objection)
    set('M', a.modele)
    set('N', a.note === null || a.note === undefined ? null : Number(a.note))
    set('O', a.facture)
    set('P', a.remise === null || a.remise === undefined ? null : Number(a.remise))
    set('Q', [a.notes, extrasTexte(a)].filter(Boolean).join(' ') || null)
    // Fiche complète sur la première ligne du prospect
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      FICHE_FIELDS.forEach((f) => {
        let v = p.fiche?.[f.key]
        if (v === '' || v === undefined) v = null
        if (v !== null && f.type === 'date') v = toSerial(v)
        else if (v !== null && f.type === 'number' && !isNaN(Number(v))) v = Number(v)
        set(f.col, v)
      })
    }
  })
  const saisiePath = paths['Saisie']
  zip.file(saisiePath, editSheet(await zip.file(saisiePath).async('string'), edits))

  // Paramètres
  const pe = {}
  SCALARS.forEach(([ref, path, type]) => {
    const v = getPath(settings, path)
    pe[ref] = type === 'text' ? String(v ?? '') : v === '' || v === undefined ? null : Number(v)
  })
  LISTS.forEach(([key, r1, r2, cols]) => {
    const list = settings[key] || []
    for (let r = r1; r <= r2; r++) {
      const item = list[r - r1]
      cols.forEach(([col, field, type]) => {
        let v = item === undefined ? null : field ? item[field] : item
        if (v !== null && type === 'num') v = v === '' ? null : Number(v)
        if (v !== null && type === 'bool') v = v ? 'Oui' : 'Non'
        if (v === '') v = null
        pe[`${col}${r}`] = v
      })
    }
  })
  const paramPath = paths['Paramètres']
  zip.file(paramPath, editSheet(await zip.file(paramPath).async('string'), pe))

  // Recalcul complet à l'ouverture
  let wbXml = await zip.file('xl/workbook.xml').async('string')
  if (!/fullCalcOnLoad="1"/.test(wbXml)) wbXml = wbXml.replace(/<calcPr([^>]*?)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>')
  wbXml = wbXml.replace(/activeTab="\d+"/, 'activeTab="0"')
  zip.file('xl/workbook.xml', wbXml)

  // Devise : remplace le symbole € des formats de nombre
  const devSym = { XOF: 'FCFA', XAF: 'FCFA', USD: '$', MAD: 'MAD', CAD: 'CAD' }[settings.devise]
  if (devSym) {
    const st = await zip.file('xl/styles.xml').async('string')
    zip.file('xl/styles.xml', st.replace(/formatCode="[^"]*"/g, (m) => m.replace(/ €/g, ` &quot;${devSym}&quot;`)))
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---------- Import ----------
function readCell(ws, ref) {
  const c = ws[ref]
  if (!c || c.v === undefined || c.v === null || c.v === '') return null
  return c.v
}

export async function parseExcel(buffer, { skipExamples = true } = {}) {
  const wb = await lireXlsx(buffer)
  const ws = wb.Sheets['Saisie']
  if (!ws) throw new Error("Onglet « Saisie » introuvable : ce n'est pas le fichier de pilotage.")
  const prospects = new Map()
  const actions = []
  const toDate = (v) => (v === null ? null : typeof v === 'number' ? fromSerial(v) : frDate(String(v)))
  const toTime = (v) => (v === null ? null : typeof v === 'number' ? serialToTime(v) : String(v).slice(0, 5))
  let skipped = 0
  for (let r = 5; r <= ws['!lignes']; r++) {
    const g = (col) => readCell(ws, `${col}${r}`)
    const name = g('C') === null ? null : String(g('C')).trim()
    const action = g('E')
    if (!name && !action) continue
    if (skipExamples && ((name && name.includes('EXEMPLE')) || String(g('Q') || '').includes('EXEMPLE'))) {
      skipped++
      continue
    }
    const date = toDate(g('A'))
    if (!date) {
      skipped++
      continue
    }
    let pid = null
    if (name) {
      if (!prospects.has(name)) prospects.set(name, { id: uid(), name, fiche: {}, created_at: new Date(date).toISOString() })
      const p = prospects.get(name)
      pid = p.id
      FICHE_FIELDS.forEach((f) => {
        let v = g(f.col)
        if (v === null) return
        if (f.type === 'date') v = toDate(v)
        else if (f.type === 'number') v = Number(v)
        else v = String(v)
        p.fiche[f.key] = v
      })
    }
    const s = (col) => (g(col) === null ? null : String(g(col)))
    actions.push({
      prospect_id: pid,
      date,
      time: toTime(g('B')),
      canal: s('D'),
      action: action ? String(action) : 'Note',
      resultat: s('F'),
      montant: g('G'),
      duree: g('H'),
      prochaine_action: s('I'),
      date_relance: toDate(g('J')),
      heure_rappel: toTime(g('K')),
      objection: s('L'),
      modele: s('M'),
      note: g('N'),
      facture: s('O'),
      remise: g('P'),
      notes: s('Q'),
      ...(String(g('Q') || '').startsWith(INTERV) && ['Signature', 'Vente additionnelle'].includes(String(action))
        ? { action: 'Intervention', notes: String(g('Q')).slice(INTERV.length) || null }
        : {}),
    })
    Object.assign(actions[actions.length - 1], lireExtras(actions[actions.length - 1].notes))
  }

  // Paramètres
  let settings = null
  const pw = wb.Sheets['Paramètres']
  if (pw) {
    settings = {}
    SCALARS.forEach(([ref, path, type]) => {
      const v = readCell(pw, ref)
      if (v !== null) setPath(settings, path, type === 'text' ? String(v) : Number(v))
    })
    LISTS.forEach(([key, r1, r2, cols]) => {
      const list = []
      for (let r = r1; r <= r2; r++) {
        const first = readCell(pw, `${cols[0][0]}${r}`)
        if (first === null) continue
        if (!cols[0][1]) {
          list.push(String(first))
          continue
        }
        const item = {}
        cols.forEach(([col, field, type]) => {
          const v = readCell(pw, `${col}${r}`)
          item[field] = type === 'num' ? Number(v ?? 0) : type === 'bool' ? v === 'Oui' : v === null ? '' : String(v)
        })
        list.push(item)
      }
      if (list.length) settings[key] = list
    })
  }
  return { prospects: [...prospects.values()], actions, settings, skipped }
}

function frDate(s) {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m2 ? m2[0] : null
}
