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

