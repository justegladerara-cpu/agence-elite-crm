// Lecture des fichiers Excel (.xlsx) et CSV, sans dépendance vulnérable : un .xlsx est un zip de fichiers XML.
// Remplace la librairie xlsx 0.18.5 (failles connues, plus de correctif sur npm).
import JSZip from 'jszip'

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export const decoder = (s) =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITES[e.toLowerCase()],
  )
const attr = (tag, nom) => {
  const m = tag.match(new RegExp(`\\s${nom}="([^"]*)"`))
  return m ? decoder(m[1]) : null
}
// Texte d'un bloc (<si>, <is>) : concatène tous les <t>, y compris le texte enrichi (<r><t>)
const texte = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => decoder(m[1] || '')).join('')

// Lettres de colonne ↔ numéro (A = 0)
export const colNum = (lettres) => [...lettres].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
export const colLettres = (n) => {
  let s = ''
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function lireFeuille(xml, partages) {
  const cellules = {}
  let maxL = 0
  let maxC = 0
  for (const m of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const tag = ` ${m[1]}`
    const ref = attr(tag, 'r')
    if (!ref) continue
    const t = attr(tag, 't')
    const corps = m[2] || ''
    const v = corps.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    let val
    if (t === 's') val = partages[Number(v)] ?? ''
    else if (t === 'inlineStr') val = texte(corps.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '')
    else if (t === 'str' || t === 'e') val = v === undefined ? '' : decoder(v)
    else if (t === 'b') val = v === '1'
    else val = v === undefined ? undefined : Number(v)
    if (val === undefined || val === '') continue
    cellules[ref] = { v: val }
    const [, l, r] = ref.match(/^([A-Z]+)(\d+)$/)
    maxL = Math.max(maxL, Number(r))
    maxC = Math.max(maxC, colNum(l))
  }
  return { ...cellules, '!ref': `A1:${colLettres(maxC)}${Math.max(1, maxL)}`, '!lignes': maxL, '!colonnes': maxC + 1 }
}

// Classeur .xlsx → { SheetNames, Sheets } ; chaque feuille : { A1: { v }, ..., '!lignes', '!colonnes' }
export async function lireXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const lire = (chemin) => zip.file(chemin)?.async('string') || Promise.resolve('')
  const [classeur, liens, partagesXml] = await Promise.all([lire('xl/workbook.xml'), lire('xl/_rels/workbook.xml.rels'), lire('xl/sharedStrings.xml')])
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).")
  const partages = [...partagesXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texte(m[1]))
  const cibles = Object.fromEntries([...liens.matchAll(/<Relationship\s[^>]*>/g)].map((m) => [attr(` ${m[0].slice(1)}`, 'Id'), attr(` ${m[0].slice(1)}`, 'Target')]))
  const SheetNames = []
  const Sheets = {}
  for (const m of classeur.matchAll(/<sheet\s[^>]*>/g)) {
    const tag = ` ${m[0].slice(1)}`
    const nom = attr(tag, 'name')
    const cible = cibles[attr(tag, 'r:id')]
    if (!nom || !cible) continue
    const chemin = cible.startsWith('/') ? cible.slice(1) : `xl/${cible.replace(/^\.\//, '')}`
    SheetNames.push(nom)
    Sheets[nom] = lireFeuille(await lire(chemin), partages)
  }
  return { SheetNames, Sheets }
}

// Première ligne = en-têtes ; renvoie une liste d'objets { en-tête: valeur } (valeur '' si vide)
export function feuilleVersLignes(ws) {
  const n = ws['!colonnes'] || 0
  const entetes = Array.from({ length: n }, (_, c) => String(ws[`${colLettres(c)}1`]?.v ?? '').trim())
  const lignes = []
  for (let r = 2; r <= (ws['!lignes'] || 0); r++) {
    const o = {}
    let plein = false
    entetes.forEach((h, c) => {
      if (!h) return
      const v = ws[`${colLettres(c)}${r}`]?.v
      o[h] = v ?? ''
      if (v !== undefined && v !== '') plein = true
    })
    if (plein) lignes.push(o)
  }
  return lignes
}

// CSV (séparateur , ou ; détecté sur la 1re ligne, guillemets gérés) → liste d'objets en texte
export function lireCsv(texteCsv) {
  const s = String(texteCsv).replace(/^﻿/, '')
  const premiere = s.slice(0, s.indexOf('\n') > -1 ? s.indexOf('\n') : s.length)
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ';' : premiere.includes('\t') && !premiere.includes(',') ? '\t' : ','
  const lignes = []
  let ligne = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (guillemets) {
      if (c === '"' && s[i + 1] === '"') {
        champ += '"'
        i++
      } else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') guillemets = true
    else if (c === sep) {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else champ += c
  }
  if (champ || ligne.length) {
    ligne.push(champ)
    lignes.push(ligne)
  }
  const [entetes = [], ...reste] = lignes.filter((l) => l.some((x) => x.trim() !== ''))
  return reste.map((l) => Object.fromEntries(entetes.map((h, i) => [h.trim(), l[i] ?? ''])))
}

// Numéro de série Excel (jours depuis le 30/12/1899) → date AAAA-MM-JJ
export function serieVersDate(n) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return ''
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000)
  return d.toISOString().slice(0, 10)
}
