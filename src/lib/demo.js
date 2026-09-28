// Données fictives de l'espace démo : articles avec images, 3 mois de ventes, factures, devis, clients et dépenses.
import PICS from './demoPics.json'
import { addDays, today } from './dates'
import { uid } from './store'

const ARTICLES = [
  ['Vanne papillon DN100', 'Vannes', 65000, 8, 'vanne', 'Genebre'],
  ['Vanne à boisseau sphérique 2"', 'Vannes', 28000, 15, 'vanne', 'Genebre'],
  ['Vanne guillotine DN150', 'Vannes', 185000, 3, 'vanne', 'Orbinox'],
  ['Robinet laiton 1/2"', 'Robinetterie', 6500, 40, 'robinet', ''],
  ['Robinet d\'arrêt 3/4"', 'Robinetterie', 9500, 25, 'robinet', ''],
  ['Clapet anti-retour 1"', 'Robinetterie', 14000, 12, 'robinet', ''],
  ['Casque de chantier', 'EPI', 8500, 50, 'casque', '3M'],
  ['Gants de manutention (paire)', 'EPI', 2500, 200, 'gants', 'Delta Plus'],
  ['Bottes de sécurité S3', 'EPI', 25000, 30, 'bottes', 'Dunlop'],
  ['Gilet haute visibilité', 'EPI', 4500, 60, 'gilet', ''],
  ['Lunettes de protection', 'EPI', 3500, 45, 'lunettes', '3M'],
  ['Masques FFP2 (boîte de 20)', 'EPI', 15000, 2, 'masque', '3M'],
  ['Combinaison de travail', 'EPI', 18000, 20, 'combinaison', ''],
  ['Tôle noire 1 mm (1 x 2 m)', 'Tôles noires', 22000, 40, 'tole', ''],
  ['Tôle noire 2 mm (1 x 2 m)', 'Tôles noires', 38000, 25, 'tole', ''],
  ['Tôle noire 3 mm (1 x 2 m)', 'Tôles noires', 55000, 10, 'tole', ''],
  ["Chiffons d'essuyage 10 kg", 'Chiffons', 12000, 30, 'chiffon', ''],
  ['Chiffons coton blanc 5 kg', 'Chiffons', 8000, 1, 'chiffon', ''],
  ['Peinture antirouille 20 L', 'Peinture', 42000, 12, 'pot', 'Seigneurie'],
  ['Peinture glycéro 4 L', 'Peinture', 15000, 18, 'pot', 'Seigneurie'],
  ['Diluant 5 L', 'Peinture', 7500, 25, 'bidon', ''],
  ['Tige filetée M12 (1 m)', 'Tiges', 1500, 300, 'tige', ''],
  ['Tige filetée M16 (1 m)', 'Tiges', 2500, 180, 'tige', ''],
  ['Fer rond 12 mm (12 m)', 'Tiges', 6500, 90, 'tige', ''],
  ['Clé à molette 300 mm', 'Outillage', 9500, 14, 'cle', 'Facom'],
  ['Meuleuse 230 mm', 'Outillage', 95000, 4, 'meuleuse', 'Makita'],
  ['Disque à tronçonner 230', 'Consommables', 2500, 120, 'disque', 'Norton'],
  ['Huile hydraulique 20 L', 'Consommables', 48000, 6, 'bidon', 'Total'],
  ['Électrodes 3,2 mm (paquet)', 'Consommables', 9000, 1, 'electrode', 'ESAB'],
]
// Clients professionnels : de vraies entreprises de Pointe-Noire et Brazzaville (les ventes, elles, sont fictives)
const PROS = [
  ['TotalEnergies EP Congo', 'Pointe-Noire', 'Pétrole et gaz', 'Centre-ville, Pointe-Noire'],
  ['Perenco Congo', 'Pointe-Noire', 'Pétrole et gaz', 'Centre-ville, Pointe-Noire'],
  ['Eni Congo', 'Pointe-Noire', 'Pétrole et gaz', 'Centre-ville, Pointe-Noire'],
  ['Congo Terminal', 'Pointe-Noire', 'Manutention portuaire', 'Port autonome, Pointe-Noire'],
  ['Port Autonome de Pointe-Noire', 'Pointe-Noire', 'Port', 'Zone portuaire, Pointe-Noire'],
  ['CORAF', 'Pointe-Noire', 'Raffinage', 'Djéno, Pointe-Noire'],
  ['CFCO', 'Pointe-Noire', 'Chemin de fer', 'Gare centrale, Pointe-Noire'],
  ['AGL Congo', 'Pointe-Noire', 'Logistique', 'Zone portuaire, Pointe-Noire'],
  ['SNPC', 'Brazzaville', 'Pétrole', 'Centre-ville, Brazzaville'],
  ['Brasseries du Congo (BRASCO)', 'Brazzaville', 'Brasserie', 'Mpila, Brazzaville'],
  ['E2C', 'Brazzaville', 'Électricité', 'Centre-ville, Brazzaville'],
  ['LCDE', 'Brazzaville', 'Eau', 'Centre-ville, Brazzaville'],
  ['MTN Congo', 'Brazzaville', 'Télécoms', 'Centre-ville, Brazzaville'],
  ['Airtel Congo', 'Brazzaville', 'Télécoms', 'Centre-ville, Brazzaville'],
]
// Achats typiques d'une entreprise : des lots d'EPI, de tôles, de consommables
const LOTS = [
  ['Dotation EPI équipes', ['Casque de chantier', 'Gants de manutention (paire)', 'Bottes de sécurité S3', 'Gilet haute visibilité', 'Lunettes de protection', 'Combinaison de travail']],
  ['Fourniture de vannes', ['Vanne papillon DN100', 'Vanne à boisseau sphérique 2"', 'Clapet anti-retour 1"', 'Vanne guillotine DN150']],
  ['Tôlerie atelier', ['Tôle noire 2 mm (1 x 2 m)', 'Tôle noire 3 mm (1 x 2 m)', 'Électrodes 3,2 mm (paquet)', 'Disque à tronçonner 230']],
  ['Maintenance et entretien', ["Chiffons d'essuyage 10 kg", 'Huile hydraulique 20 L', 'Peinture antirouille 20 L', 'Diluant 5 L']],
  ['Plomberie et robinetterie', ['Robinet laiton 1/2"', "Robinet d'arrêt 3/4\"", 'Clapet anti-retour 1"', 'Tige filetée M12 (1 m)']],
  ['Ferraillage chantier', ['Fer rond 12 mm (12 m)', 'Tige filetée M16 (1 m)', 'Tige filetée M12 (1 m)', 'Disque à tronçonner 230']],
]
const VENDEURS = ['Narcie KANGOU', 'Narcie KANGOU', 'Narcie KANGOU', 'Achille KANGOU']
const MODES = ['Espèces', 'Espèces', 'Espèces', 'Espèces', 'MTN Mobile Money', 'MTN Mobile Money', 'Airtel Money']
const DEPENSES = [
  ['Achat de marchandises', 'Fournisseur Douala', 2500000],
  ['Transport / dédouanement', 'Transit Pointe-Noire', 180000],
  ['Loyer', 'Propriétaire', 250000],
  ['Salaires', 'Personnel', 450000],
  ['Électricité / eau', 'E2C', 45000],
  ['Carburant', 'Station Puma', 60000],
  ['Téléphone / internet', 'MTN', 25000],
]

// Tirage reproductible : la démo a toujours le même visage
function hasard(graine) {
  let s = graine
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function genererDemo() {
  const r = hasard(7)
  const pick = (l) => l[Math.floor(r() * l.length)]
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1))
  const t = today()
  const docs = []
  const actions = []
  const prods = ARTICLES.map(([nom, categorie, prix, stock, pic, marque], i) => {
    const id = uid()
    docs.push({ id, type: 'produit', numero: `ART-${String(i + 1).padStart(4, '0')}`, prospect_id: null, data: { nom, categorie, prix, stock, seuil: 3, photo: PICS[pic], marque, prixAchat: Math.round((prix * 0.68) / 100) * 100, description: '' } })
    return { id, nom, prix }
  })
  const parNom = Object.fromEntries(prods.map((p) => [p.nom, p]))
  const prospects = PROS.map(([name, ville, secteur, adresse], i) => ({
    id: uid(),
    name,
    created_at: `${addDays(t, -95 + i)}T09:00:00Z`,
    fiche: { contact: 'Service achats', ville, secteur, adresse_facturation: adresse, source: 'Client professionnel' },
  }))
  const heure = () => `${String(entre(8, 17)).padStart(2, '0')}:${String(entre(0, 59)).padStart(2, '0')}`
  const ferme = (d) => new Date(`${d}T12:00`).getDay() === 0
  const ouvrable = (d) => {
    while (ferme(d)) d = addDays(d, 1)
    return d
  }
  // Les numéros sont donnés à la fin, dans l'ordre des dates
  const factures = []
  const devis = []
  const paiements = []

  // Vente au comptoir : 1 à 3 articles, payée tout de suite
  const comptoir = (date, h) => {
    const choix = [...prods].sort(() => r() - 0.5).slice(0, pick([1, 1, 2, 2, 3]))
    const lignes = choix.map((p) => ({ designation: p.nom, description: '', qte: p.prix < 20000 ? pick([1, 1, 2, 2, 3, 5, 10]) : pick([1, 1, 2]), pu: p.prix, produitId: p.id }))
    const mode = pick(MODES)
    const f = { date, heure: h, client: 'Client comptoir', prospect: null, lignes, mode, echeance: date, objet: 'Vente au comptoir', conditions: 'Payable à réception' }
    factures.push(f)
    paiements.push({ f, date, time: h, mode, part: 1 })
  }
  // Lot pour une entreprise : quantités de professionnel
  const lot = () => {
    const [objet, noms] = pick(LOTS)
    const choix = [...noms].sort(() => r() - 0.5).slice(0, entre(2, noms.length))
    const lignes = choix.map((n) => {
      const p = parNom[n]
      const qte = p.prix < 5000 ? pick([20, 30, 50, 100]) : p.prix < 30000 ? pick([5, 10, 15, 20, 25]) : pick([1, 2, 3, 4])
      return { designation: p.nom, description: '', qte, pu: p.prix, produitId: p.id }
    })
    return { objet, lignes }
  }
  const total = (lignes) => lignes.reduce((m, l) => m + l.qte * l.pu, 0)
  // Vente à une entreprise : payée au comptant, ou à 30 jours puis réglée (ou pas encore)
  const pro = (date, h, client, contenu, extra = {}) => {
    const credit = r() < 0.55
    const mode = credit ? 'À crédit' : pick(['Virement', 'Chèque', 'Espèces', 'MTN Mobile Money'])
    const f = { date, heure: h, client: client.name, prospect: client.id, ...contenu, mode, echeance: credit ? addDays(date, 30) : date, conditions: credit ? 'Paiement à 30 jours' : 'Payable à réception', bc: `BC-${entre(1000, 9999)}`, ...extra }
    factures.push(f)
    if (!credit) paiements.push({ f, date, time: h, mode, part: 1 })
    else {
      const age = Math.round((new Date(`${t}T12:00`) - new Date(`${date}T12:00`)) / 864e5)
      const x = r()
      // Réglé à l'échéance (ou un peu avant), en une ou deux fois ; quelques retards pour le réalisme
      if (age > 38 && x < 0.8) paiements.push({ f, date: ouvrable(addDays(date, entre(20, 36))), time: '11:00', mode: pick(['Virement', 'Virement', 'Chèque']), part: 1 })
      else if (age > 25 && x < 0.9) paiements.push({ f, date: ouvrable(addDays(date, entre(12, 24))), time: '10:30', mode: 'Virement', part: 0.5 })
      else if (age > 20 && x < 0.35) paiements.push({ f, date: ouvrable(addDays(date, entre(8, 18))), time: '15:00', mode: 'Chèque', part: 1 })
    }
    return f
  }

  for (let j = 90; j >= 0; j--) {
    const d = addDays(t, -j)
    if (ferme(d)) continue
    const nb = j === 0 ? 4 : entre(2, 6)
    Array.from({ length: nb }, heure).sort().forEach((h) => comptoir(d, h))
    if (j > 0 && r() < 0.45) pro(d, heure(), pick(prospects), lot())
  }

  // Devis aux entreprises : acceptés (puis facturés), refusés, en attente ou expirés
  for (let i = 0; i < 26; i++) {
    const client = pick(prospects)
    const date = ouvrable(addDays(t, -entre(1, 88)))
    const contenu = lot()
    const dv = { date, heure: heure(), client: client.name, prospect: client.id, ...contenu, validite: addDays(date, 30) }
    const age = Math.round((new Date(`${t}T12:00`) - new Date(`${date}T12:00`)) / 864e5)
    const x = r()
    if (age > 6 && x < 0.5) {
      dv.statut = 'Accepté'
      const df = ouvrable(addDays(date, entre(2, Math.min(age, 12))))
      dv.facture = pro(df, heure(), client, contenu, { devis: dv })
    } else if (age > 10 && x < 0.72) dv.statut = 'Refusé'
    devis.push(dv)
  }

  // Numérotation chronologique, puis documents et paiements
  const ordre = (a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`)
  const an = t.slice(0, 4)
  factures.sort(ordre).forEach((f, i) => {
    f.id = uid()
    f.numero = `FAC-${an}${String(i + 1).padStart(6, '0')}`
  })
  devis.sort(ordre).forEach((dv, i) => {
    dv.id = uid()
    dv.numero = `DEV-${an}${String(i + 1).padStart(6, '0')}`
    if (dv.facture) dv.facture.devis = dv
  })
  factures.forEach((f) => {
    const p = f.prospect && prospects.find((x) => x.id === f.prospect)
    docs.push({
      id: f.id,
      type: 'facture',
      numero: f.numero,
      prospect_id: f.prospect,
      created_at: `${f.date}T${f.heure}:00Z`,
      data: {
        date: f.date, echeance: f.echeance, validite: '',
        objet: f.bc ? `${f.objet} (bon de commande ${f.bc})` : f.objet,
        client: { nom: f.client, adresse: p ? p.fiche.adresse_facturation : '' },
        lignes: f.lignes, remise: '', tva: 0, conditions: f.conditions, notes: '', paiement: '',
        vente: { vendeur: pick(VENDEURS), mode: f.mode, heure: f.heure },
        ...(f.devis ? { devisId: f.devis.id, devisNumero: f.devis.numero } : {}),
      },
    })
  })
  devis.forEach((dv) => {
    const p = prospects.find((x) => x.id === dv.prospect)
    docs.push({
      id: dv.id,
      type: 'devis',
      numero: dv.numero,
      prospect_id: dv.prospect,
      created_at: `${dv.date}T${dv.heure}:00Z`,
      data: {
        date: dv.date, echeance: '', validite: dv.validite, objet: dv.objet,
        client: { nom: dv.client, adresse: p.fiche.adresse_facturation },
        lignes: dv.lignes, remise: '', tva: 0, conditions: 'Devis valable 30 jours',
        notes: 'Merci de votre confiance. Bon pour accord : date, signature et cachet.', paiement: '',
        ...(dv.statut ? { statut: dv.statut } : {}),
        ...(dv.facture ? { factureNumero: dv.facture.numero } : {}),
      },
    })
  })
  paiements.forEach(({ f, date, time, mode, part }) => {
    if (date > t) return
    const montant = part === 1 ? total(f.lignes) : Math.round((total(f.lignes) * part) / 1000) * 1000
    actions.push({ prospect_id: f.prospect, date, time, canal: 'Autre', action: 'Paiement reçu', montant, mode, facture: f.numero, notes: f.prospect ? `Règlement ${f.client}` : 'Vente au comptoir' })
  })

  // Dépenses des 3 derniers mois (et du mois en cours)
  for (let m = 3; m >= 0; m--) {
    const base = new Date(`${t.slice(0, 7)}-01T12:00`)
    base.setMonth(base.getMonth() - m)
    const ym = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    DEPENSES.forEach(([categorie, fournisseur, montant]) => {
      const jour = Math.min(m === 0 ? Number(t.slice(8)) : 27, 2 + Math.floor(r() * 25))
      const date = `${ym}-${String(jour).padStart(2, '0')}`
      if (date < addDays(t, -92)) return
      actions.push({ prospect_id: null, date, time: '10:00', canal: 'Autre', action: 'Dépense', montant: Math.round((montant * (0.8 + r() * 0.4)) / 1000) * 1000, categorie, fournisseur, mode: montant < 100000 ? 'Espèces' : 'Virement', notes: '' })
    })
  }
  actions.push({ prospect_id: null, date: t, time: '08:30', canal: 'Autre', action: 'Dépense', montant: 15000, categorie: 'Carburant', fournisseur: 'Station Puma', mode: 'Espèces', notes: 'Plein du véhicule de livraison' })
  return { prospects, docs, actions }
}
