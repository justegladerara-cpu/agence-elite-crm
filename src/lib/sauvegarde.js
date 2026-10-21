// Sauvegarde des données du CRM dans un fichier JSON téléchargé
import { today } from './dates'

const CLE_SAUVEGARDE = 'aecrm-derniere-sauvegarde'
export const derniereSauvegarde = () => {
  try {
    return localStorage.getItem(CLE_SAUVEGARDE) || ''
  } catch {
    return ''
  }
}

// Fichier JSON avec toutes les données du CRM (prospects, actions, documents, réglages)
export function telechargerSauvegarde({ prospects, actions, documents, settings }) {
  const contenu = { format: 'agence-elite-crm', version: 1, date: new Date().toISOString(), prospects, actions, documents, settings }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(contenu)], { type: 'application/json' }))
  a.download = `sauvegarde-crm-${today()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  try {
    localStorage.setItem(CLE_SAUVEGARDE, today())
  } catch {
    /* rappel de sauvegarde indisponible */
  }
}


// Lecture d'un fichier de sauvegarde (SEC-11) : refuse tout ce qui n'est pas une sauvegarde de ce CRM.
// Rend { prospects, actions, documents, date } avec seulement des lignes qui ont un identifiant.
export function lireSauvegarde(texte) {
  let c
  try {
    c = JSON.parse(texte)
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde du CRM (JSON illisible).")
  }
  if (!c || c.format !== 'agence-elite-crm') throw new Error("Ce fichier n'est pas une sauvegarde du CRM.")
  if (Number(c.version) > 1) throw new Error('Sauvegarde faite par une version plus récente du CRM : mets la page à jour puis réessaie.')
  const lignes = (l) => (Array.isArray(l) ? l.filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && x.id) : [])
  const prospects = lignes(c.prospects).filter((p) => typeof p.name === 'string')
  const ids = new Set(prospects.map((p) => p.id))
  // Une action rattachée à une fiche absente de la sauvegarde est gardée sans rattachement
  const actions = lignes(c.actions).map((a) => (a.prospect_id && !ids.has(a.prospect_id) ? { ...a, prospect_id: null } : a))
  const documents = lignes(c.documents)
  if (!prospects.length && !actions.length && !documents.length) throw new Error('Cette sauvegarde est vide.')
  return { prospects, actions, documents, date: typeof c.date === 'string' ? c.date : '' }
}
