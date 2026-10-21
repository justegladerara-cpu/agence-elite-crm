// Export CSV sûr (SEC-12) : une cellule qui commence par = + - @ tabulation ou retour chariot serait lue comme une
// formule par Excel ou LibreOffice (injection de formule). On la préfixe d'une apostrophe, sauf les nombres purs.
const NOMBRE = /^-?\d+(?:[.,]\d+)?$/
const DANGEREUX = /^[=+\-@\t\r]/

export function celluleCsv(v) {
  if (v == null) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  let t = String(v)
  if (DANGEREUX.test(t) && !NOMBRE.test(t.trim())) t = `'${t}`
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

// entetes : liste de libellés ; lignes : liste de listes de valeurs
export const versCsv = (entetes, lignes) => [entetes.map(celluleCsv).join(';'), ...lignes.map((l) => l.map(celluleCsv).join(';'))].join('\r\n')

export function telechargerCsv(nom, contenu) {
  const url = URL.createObjectURL(new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom.endsWith('.csv') ? nom : `${nom}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Avertissement avant un export qui contient des données personnelles (SEC-13)
export const AVERTISSEMENT_DONNEES =
  'Ce fichier contient des données personnelles (noms, téléphones, montants). Garde-le dans un dossier protégé, ne l’envoie pas par une messagerie publique et supprime-le quand tu n’en as plus besoin.'
