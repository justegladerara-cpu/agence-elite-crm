// Appel lancé depuis le CRM : on s'en souvient pour ouvrir la feuille au retour dans l'application
const CLE_APPEL = 'aecrm-appel-en-cours'
export function noterAppelLance(prospectId) {
  try {
    sessionStorage.setItem(CLE_APPEL, JSON.stringify({ id: prospectId, t: Date.now() }))
  } catch {
    /* navigation privée : pas de feuille après appel */
  }
  window.dispatchEvent(new Event('crm-appel'))
}
export function appelEnCours() {
  try {
    const a = JSON.parse(sessionStorage.getItem(CLE_APPEL))
    // Au-delà de 2 heures, l'appel n'est plus d'actualité
    return a && Date.now() - a.t < 2 * 3600000 ? a : null
  } catch {
    return null
  }
}
export function oublierAppel() {
  try {
    sessionStorage.removeItem(CLE_APPEL)
  } catch {
    /* rien */
  }
}
