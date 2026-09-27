// Données d'exemple pour découvrir le CRM (supprimables en un clic).
import { addDays, today } from './dates'
import { uid } from './store'

export const TAG = '(EXEMPLE)'
export const isExample = (p) => (p.name || '').includes(TAG)

export function buildSeed() {
  const t = today()
  const d = (n) => addDays(t, n)
  const prospects = []
  const actions = []
  const P = (name, fiche, acts) => {
    const id = uid()
    prospects.push({ id, name: `${name} ${TAG}`, fiche, created_at: new Date().toISOString() })
    acts.forEach((a) => actions.push({ prospect_id: id, ...a }))
  }
  P('Pizzeria Da Marco', { secteur: 'Restaurant', ville: 'Lyon', zone: 'Centre-ville', contact: 'Marco Rossi', fonction: 'Gérant', telephone: '06 55 44 33 22', instagram: '@damarco', source: 'Publicité Instagram', pub_active: 'Oui', date_pub: d(-5), budget_pub: 'Régulière', presence_google: 'Faible', note_google: '3.8', taille: 'Petite' }, [
    { date: d(-6), time: '17:40', canal: 'Appel', action: 'Premier contact', resultat: 'Messagerie - vocal laissé', modele: 'Accroche A - Pub Insta', duree: 1 },
    { date: d(-3), time: '11:10', canal: 'Appel', action: 'Relance', resultat: 'Rappeler', prochaine_action: 'Rappeler', date_relance: t, heure_rappel: '15:00', duree: 3 },
  ])
  P('Institut Belle Peau', { secteur: 'Esthétique / Beauté', ville: 'Lyon', contact: 'Sarah Martin', telephone: '06 12 34 56 78', instagram: '@bellepeau', source: 'Profil Instagram', pub_active: 'Oui', presence_google: 'Bonne', taille: 'Petite', offre: 'Site + réservation', budget_ok: 'Oui', decideur: 'Oui', besoin: 'Oui', delai: '< 1 mois' }, [
    { date: d(-14), time: '10:00', canal: 'DM', action: 'Premier contact', resultat: 'Intéressé', modele: 'DM 2 - Audit gratuit' },
    { date: d(-12), time: '14:00', canal: 'DM', action: 'Loom envoyé', resultat: 'Loom vu' },
    { date: d(-9), time: '10:30', canal: 'Appel', action: 'RDV', resultat: 'RDV pris', duree: 25 },
    { date: d(-5), time: '09:30', canal: 'DM', action: 'Proposition envoyée', prochaine_action: 'Relancer la proposition' },
  ])
  P('Garage Auto Plus', { secteur: 'Automobile', ville: 'Villeurbanne', contact: 'Karim Benali', telephone: '07 11 22 33 44', source: 'Google Maps', presence_google: 'Absente', taille: 'Moyenne', offre: 'Pack complet' }, [
    { date: d(-25), time: '09:15', canal: 'Appel', action: 'Premier contact', resultat: 'Intéressé', duree: 6 },
    { date: d(-20), time: '16:00', canal: 'Appel', action: 'Audit réalisé', note: 62, duree: 45 },
    { date: d(-15), time: '11:00', canal: 'Appel', action: 'Proposition envoyée' },
    { date: d(-10), time: '18:00', canal: 'Appel', action: 'Signature', facture: 'F-2026-001' },
    { date: d(-8), canal: 'Autre', action: 'Paiement reçu', montant: 1500, facture: 'F-2026-001' },
    { date: d(-7), canal: 'Autre', action: 'Onboarding - Contrat' },
  ])
  P('Studio Fit', { secteur: 'Sport / Fitness', ville: 'Lyon', contact: 'Léa Dubois', telephone: '06 11 22 33 45', instagram: '@studiofit', site: 'studiofit.fr', source: 'Facebook', presence_google: 'Bonne', taille: 'Moyenne' }, [
    { date: d(-12), time: '11:00', canal: 'Facebook', action: 'Premier contact', resultat: 'Pas intéressé', objection: "J'ai déjà quelqu'un" },
    { date: d(-11), action: 'Perdu', objection: "J'ai déjà quelqu'un" },
  ])
  P('Salon Coiffure Élégance', { secteur: 'Coiffure', ville: 'Lyon', contact: 'Nadia', telephone: '06 98 76 54 32', instagram: '@elegance.coiffure', source: 'Publicité Instagram', pub_active: 'Oui', date_pub: d(-2), presence_google: 'Absente', taille: 'Petite' }, [])
  P('Boulangerie Dupont', { secteur: 'Commerce', ville: 'Bron', telephone: '04 78 00 11 22', source: 'Google Maps', presence_google: 'Faible', taille: 'Petite' }, [
    { date: d(-9), time: '08:45', canal: 'Appel', action: 'Premier contact', resultat: 'Pas de réponse' },
    { date: d(-7), time: '09:00', canal: 'Appel', action: 'Relance', resultat: 'Pas de réponse' },
  ])
  P('BTP Renov 69', { secteur: 'BTP / Artisan', ville: 'Vénissieux', contact: 'Julien', telephone: '06 22 33 44 55', source: 'Recommandation', recommande_par: 'Karim Benali', taille: 'Moyenne' }, [
    { date: d(-4), time: '12:30', canal: 'WhatsApp', action: 'Premier contact', resultat: 'Intéressé' },
    { date: d(-2), time: '17:00', canal: 'Appel', action: 'Qualification', resultat: 'Intéressé', duree: 12, prochaine_action: "Faire l’audit", date_relance: d(1) },
  ])
  // Client de longue date, payé à l'intervention
  P('Cabinet Traoré & Associés', { secteur: 'Services', ville: 'Lyon', contact: 'M. Traoré', fonction: 'Dirigeant', telephone: '06 45 67 89 01', source: 'Recommandation', taille: 'Moyenne' }, [
    { date: d(-160), canal: 'Appel', action: 'Intervention', montant: 150, notes: 'Mise à jour du site sur place' },
    { date: d(-158), canal: 'Autre', action: 'Paiement reçu', montant: 150 },
    { date: d(-70), time: '09:30', canal: 'Appel', action: 'Intervention', montant: 150, notes: 'Formation Instagram au bureau' },
    { date: d(-70), canal: 'Autre', action: 'Paiement reçu', montant: 150 },
  ])
  // Prospects sans action : on leur donne une ligne « Ajout prospect »
  prospects.forEach((p) => {
    if (!actions.some((a) => a.prospect_id === p.id)) actions.push({ prospect_id: p.id, date: t, action: 'Ajout prospect' })
  })
  actions.push({ prospect_id: null, date: d(-3), action: 'Dépense', montant: 15, notes: `Abonnement Loom ${TAG}` })
  return { prospects, actions }
}
