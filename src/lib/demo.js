// Données fictives de l'espace démo : articles avec images, ventes des derniers mois, dépenses.
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
const CLIENTS = ['Client comptoir', 'Client comptoir', 'Client comptoir', 'Client comptoir', 'Client comptoir', 'TOTAL E&P Congo', 'SOCOTRAM', 'Perenco', 'SNPC', 'BTP Congo Services', 'Chantier Mpita', 'Garage Moderne']
const VENDEURS = ['Narcie KANGOU', 'Narcie KANGOU', 'Narcie KANGOU', 'Achille KANGOU']
const MODES = ['Espèces', 'Espèces', 'Espèces', 'Espèces', 'MTN Mobile Money', 'MTN Mobile Money', 'Airtel Money', 'Virement', 'Chèque']
const DEPENSES = [
  ['Achat de marchandises', 'Fournisseur Douala', 850000],
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
  const t = today()
  const docs = []
  const actions = []
  const prods = ARTICLES.map(([nom, categorie, prix, stock, pic, marque], i) => {
    const id = uid()
    docs.push({ id, type: 'produit', numero: `ART-${String(i + 1).padStart(4, '0')}`, prospect_id: null, data: { nom, categorie, prix, stock, seuil: 3, photo: PICS[pic], marque, prixAchat: Math.round((prix * 0.68) / 100) * 100, description: '' } })
    return { id, nom, prix }
  })
  let n = 0
  const vente = (date, heure) => {
    n++
    const k = pick([1, 1, 2, 2, 3])
    const choix = [...prods].sort(() => r() - 0.5).slice(0, k)
    const lignes = choix.map((p) => ({ designation: p.nom, description: '', qte: p.prix < 20000 ? pick([1, 1, 2, 2, 3, 5, 10]) : pick([1, 1, 2]), pu: p.prix, produitId: p.id }))
    const client = pick(CLIENTS)
    let mode = pick(MODES)
    const credit = client !== 'Client comptoir' && r() < 0.25
    if (credit) mode = 'À crédit'
    const numero = `FAC-${t.slice(0, 4)}${String(n).padStart(6, '0')}`
    const total = lignes.reduce((m, l) => m + l.qte * l.pu, 0)
    docs.push({
      id: uid(),
      type: 'facture',
      numero,
      prospect_id: null,
      created_at: `${date}T${heure}:00Z`,
      data: { date, echeance: credit ? addDays(date, 30) : date, validite: '', objet: 'Vente au comptoir', client: { nom: client, adresse: '' }, lignes, remise: '', tva: 0, conditions: 'Payable à réception', notes: '', paiement: '', vente: { vendeur: pick(VENDEURS), mode, heure } },
    })
    if (!credit) actions.push({ prospect_id: null, date, time: heure, canal: 'Autre', action: 'Paiement reçu', montant: total, mode, facture: numero, notes: 'Vente au comptoir' })
  }
  const heure = () => `${String(8 + Math.floor(r() * 10)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`
  // Mois précédents : quelques ventes ; 30 derniers jours : plus dense ; aujourd'hui : 4 ventes
  for (let j = 150; j >= 1; j--) {
    const d = addDays(t, -j)
    if (new Date(`${d}T12:00`).getDay() === 0) continue
    const nb = j <= 30 ? 1 + Math.floor(r() * 4) : r() < 0.75 ? 1 + Math.floor(r() * 2) : 0
    const hs = Array.from({ length: nb }, heure).sort()
    hs.forEach((h) => vente(d, h))
  }
  ;['08:14', '09:02', '09:47', '10:31'].forEach((h) => vente(t, h))
  // Dépenses : chaque mois des 6 derniers
  for (let m = 5; m >= 0; m--) {
    const base = new Date(`${t.slice(0, 7)}-01T12:00`)
    base.setMonth(base.getMonth() - m)
    const ym = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    DEPENSES.forEach(([categorie, fournisseur, montant]) => {
      if (categorie === 'Achat de marchandises' && r() < 0.3) return
      const jour = Math.min(m === 0 ? Number(t.slice(8)) : 27, 2 + Math.floor(r() * 25))
      actions.push({ prospect_id: null, date: `${ym}-${String(jour).padStart(2, '0')}`, time: '10:00', canal: 'Autre', action: 'Dépense', montant: Math.round((montant * (0.8 + r() * 0.4)) / 1000) * 1000, categorie, fournisseur, mode: montant < 100000 ? 'Espèces' : 'Virement', notes: '' })
    })
  }
  actions.push({ prospect_id: null, date: t, time: '08:30', canal: 'Autre', action: 'Dépense', montant: 15000, categorie: 'Carburant', fournisseur: 'Station Puma', mode: 'Espèces', notes: 'Plein du véhicule de livraison' })
  return { docs, actions }
}
