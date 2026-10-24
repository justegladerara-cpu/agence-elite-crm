// Codes de licence (clés ELITE-XXX-XXXX-XXXX) générés depuis le CRM. Le client entre le code dans son logiciel
// (écran « Licence expirée » ou Mon abonnement) : la licence du modèle choisi (ex. annuelle = 1 an) remplace la sienne.
// Rien n'est prolongé tant que le code n'est pas entré ; un code ne sert qu'une fois.

const ORDRE = { annuel: 0, mensuel: 1, acquisition: 2, essai: 3 }
export const LIBELLE_FORMULE = { annuel: '1 an', mensuel: '1 mois', acquisition: 'À vie', essai: 'Essai' }

// Modèles proposés pour un établissement : actifs, de sa solution (si connue), annuel d'abord.
export function modelesPour(modeles = [], etablissement) {
  const solution = etablissement?.solution_id
  return modeles
    .filter((m) => m.actif !== false && (!solution || !m.solution_id || m.solution_id === solution))
    .sort((a, b) => (ORDRE[a.formule] ?? 9) - (ORDRE[b.formule] ?? 9) || (a.ordre ?? 0) - (b.ordre ?? 0))
}

export const modeleParDefaut = (liste) => liste.find((m) => m.formule === 'annuel') || liste[0] || null

export function dureeTexte(m) {
  if (!m) return ''
  if (m.duree_jours) return `${m.duree_jours} jours`
  return LIBELLE_FORMULE[m.formule] || m.formule
}

// Codes déjà générés pour ce client (même nom) ou activés dans un de ses établissements.
export function codesDuClient(cles = [], client) {
  const ids = new Set((client?.etablissements || []).map((e) => e.id))
  const nom = String(client?.nom || '').trim().toLowerCase()
  return cles.filter((k) => (k.etablissement_id && ids.has(k.etablissement_id)) || (nom && String(k.client_nom || '').trim().toLowerCase() === nom))
}

// Message à envoyer au client (WhatsApp ou SMS).
export function messageCode({ cle, modele, etablissement }) {
  return [
    `Bonjour, voici votre code de licence ${etablissement?.nom ? `pour ${etablissement.nom} ` : ''}(${modele?.nom || 'licence'}, ${dureeTexte(modele)}) :`,
    cle,
    'Pour l’activer : connectez-vous avec le compte du responsable, cliquez sur « Renouveler · entrer le code de licence » (ou Paramètres › Mon abonnement), puis tapez le code.',
    'Agence Elite',
  ].join('\n')
}

export function lienWhatsApp(telephone, texte) {
  const numero = String(telephone || '').replace(/[^\d]/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`
}

// Facture préremplie dans le CRM : une ligne « Licence … » au prix du modèle, avec le code en description.
export function lienFacture({ fiche, client, etablissement, modele, cle }) {
  const p = new URLSearchParams({ type: 'facture' })
  if (fiche?.id) p.set('p', fiche.id)
  else if (client?.nom) p.set('client', client.nom)
  p.set('objet', `Licence logiciel ${dureeTexte(modele)}${etablissement?.nom ? ` · ${etablissement.nom}` : ''}`)
  p.set('designation', `Licence ${modele?.nom || ''} (${dureeTexte(modele)})`.replace(/\s+/g, ' ').trim())
  p.set('description', `Code d’activation ${cle}`)
  p.set('pu', String(Number(modele?.montant) || 0))
  return `/facture/new?${p.toString()}`
}

// Ligne de facture lue depuis l'adresse (lienFacture) ; null si rien n'est demandé.
export function lignePreremplie(params) {
  const designation = (params.get('designation') || '').trim()
  if (!designation) return null
  const pu = Number(params.get('pu'))
  return { designation: designation.slice(0, 200), description: (params.get('description') || '').slice(0, 300), qte: 1, pu: pu > 0 ? pu : '' }
}
