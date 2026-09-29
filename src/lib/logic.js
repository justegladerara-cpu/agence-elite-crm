// Vocabulaire commun des actions (rang, prospection, réponse, montants) et liens de contact.
// Le pipeline commercial est dans modules/commercial/pipeline.js, les statistiques dans modules/dashboard/stats.js.

export const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v))

export function sortActions(actions) {
  return [...actions].sort(
    (a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.time || '').localeCompare(b.time || '') ||
      (a.created_at || '').localeCompare(b.created_at || ''),
  )
}

export function lookups(s) {
  const act = Object.fromEntries(s.actions.map((a) => [a.nom, a]))
  const res = Object.fromEntries(s.resultats.map((r) => [r.nom, r]))
  const offre = Object.fromEntries(s.offres.map((o) => [o.nom, o]))
  const proba = Object.fromEntries(s.etapes.map((e) => [e.nom, e.proba]))
  const secteur = Object.fromEntries(s.secteurs.map((x) => [x.nom, x]))
  return { act, res, offre, proba, secteur }
}

export const actionRank = (a, L) => Math.max(num(L.act[a.action]?.rang), num(L.res[a.resultat]?.rang))
export const isProspection = (a, L) => !!L.act[a.action]?.prospection
export const isReponse = (a, L) => !!L.res[a.resultat]?.reponse
// Actions qui comptent dans le CA signé
export const VENTES = ['Signature', 'Vente additionnelle', 'Intervention']

// Montant retenu (colonne AW de la Saisie) : montant saisi, sinon prix de l'offre
// pour une proposition ou une signature, moins la remise.
export function montantRetenu(a, prospect, L) {
  if (a.montant !== null && a.montant !== undefined && a.montant !== '') return num(a.montant)
  if (a.action === 'Proposition envoyée' || a.action === 'Signature') {
    const o = L.offre[prospect?.fiche?.offre]
    return Math.max(0, num(o?.prix) - num(a.remise))
  }
  return 0
}

export function waLink(phone, indicatif = '33') {
  if (!phone) return ''
  let n = String(phone).replace(/[\s.+\-()]/g, '')
  if (n.startsWith('0')) n = indicatif + n.slice(1)
  return `https://wa.me/${n}`
}
// Nom du compte Instagram tiré d'un @, d'un nom ou d'un lien partagé (« ?igsh=… » retiré). Vide si ce n'est pas un compte.
export function handleInsta(v) {
  let t = String(v || '').trim()
  if (!t) return ''
  const m = t.match(/(?:instagram\.com|instagr\.am)\/([^?#]*)/i)
  if (m) {
    const parts = m[1].split('/').filter(Boolean)
    // Story : le compte suit « stories/ » ; publication, reel… : pas de compte dans le lien
    if (parts[0]?.toLowerCase() === 'stories') t = parts[1] || ''
    else if (!parts.length || ['p', 'reel', 'reels', 'tv', 'explore', 'accounts'].includes(parts[0].toLowerCase())) return ''
    else t = parts[0]
  } else if (/^https?:\/\//i.test(t) || t.includes(' ')) return ''
  t = t.replace(/^@+/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t.toLowerCase() : ''
}
// Prospect déjà enregistré avec le même compte Instagram (quel que soit son nom)
export function doublonInsta(list, v, exceptId) {
  const h = handleInsta(v)
  return h ? list.find((p) => p.id !== exceptId && handleInsta(p.fiche?.instagram) === h) : null
}
export function instaLink(v) {
  if (!v) return ''
  const h = handleInsta(v)
  if (h) return `https://www.instagram.com/${h}/`
  if (v.startsWith('http')) return v
  return `https://www.instagram.com/${v.replace('@', '').replace(/\s/g, '')}`
}
export function siteLink(v) {
  if (!v) return ''
  return v.startsWith('http') ? v : `https://${v}`
}
