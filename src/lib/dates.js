// Dates au format ISO « AAAA-MM-JJ », en heure locale.
export const pad = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())
export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const parse = (s) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + Number(n))
  return iso(d)
}
export const addMonths = (s, n) => {
  const d = parse(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + Number(n))
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return iso(d)
}
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000)
export const monthKey = (s) => (s ? s.slice(0, 7) : '')
export const monthStart = (key) => `${key}-01`
export const monthEnd = (key) => {
  const [y, m] = key.split('-').map(Number)
  return iso(new Date(y, m, 0))
}
export const prevMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
export const fmtDate = (s) => {
  if (!s) return ''
  const d = parse(s)
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}
export const fmtMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  return `${MOIS_LONG[m - 1]} ${y}`
}
export const fmtMonthShort = (key) => MOIS[Number(key.slice(5, 7)) - 1]
// Lundi = 1 … dimanche = 7
export const weekday = (s) => ((parse(s).getDay() + 6) % 7) + 1
