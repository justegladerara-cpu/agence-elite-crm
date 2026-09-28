// Données fictives de l'hôtel pour l'espace démo : chambres, tables, carte, clients en séjour,
// commandes ouvertes et un mois de ventes (séjours payés, restaurant, bar).
import { addDays, today } from './dates'
import { uid } from './store'
import { nextNumero } from './invoice'

const CARTE = [
  ['Petit-déjeuner continental', 'Petit-déjeuner', 5000, '🥐'],
  ['Petit-déjeuner complet', 'Petit-déjeuner', 8000, '🍳'],
  ['Omelette garnie', 'Petit-déjeuner', 3500, '🍳'],
  ['Café', 'Petit-déjeuner', 1000, '☕'],
  ['Thé / tisane', 'Petit-déjeuner', 1000, '🍵'],
  ['Salade composée', 'Entrées', 4000, '🥗'],
  ['Soupe de poisson', 'Entrées', 4500, '🍲'],
  ['Poulet moambé', 'Plats', 7500, '🍗'],
  ['Saka-saka au poisson salé', 'Plats', 6000, '🍲'],
  ['Liboké de poisson', 'Plats', 9000, '🐟'],
  ['Capitaine braisé', 'Plats', 12000, '🐟'],
  ['Riz sauce arachide', 'Plats', 5500, '🍛'],
  ['Ntaba braisé (chèvre)', 'Grillades', 10000, '🥩'],
  ['Brochettes de bœuf', 'Grillades', 5000, '🍢'],
  ['Poulet braisé entier', 'Grillades', 12000, '🍗'],
  ['Bananes plantain frites', 'Grillades', 2000, '🍟'],
  ['Chikwangue', 'Grillades', 1000, '🍚'],
  ['Salade de fruits', 'Desserts', 2500, '🍉'],
  ['Glace 2 boules', 'Desserts', 3000, '🍨'],
  ['Gâteau du jour', 'Desserts', 3000, '🍰'],
  ['Eau minérale 1,5 L', 'Boissons', 1000, '💧'],
  ['Coca-Cola 33 cl', 'Boissons', 1000, '🥤'],
  ['Jus de gingembre', 'Boissons', 1500, '🧃'],
  ['Jus de bissap', 'Boissons', 1500, '🧃'],
  ['Primus 65 cl', 'Bières', 1500, '🍺'],
  ["Ngok' 65 cl", 'Bières', 1500, '🍺'],
  ['Mützig 65 cl', 'Bières', 2000, '🍺'],
  ['Heineken 33 cl', 'Bières', 2500, '🍺'],
  ['Vin rouge (verre)', 'Vins et alcools', 3500, '🍷'],
  ['Vin rouge (bouteille)', 'Vins et alcools', 18000, '🍷'],
  ['Whisky (verre)', 'Vins et alcools', 4000, '🥃'],
  ['Cocktail maison', 'Vins et alcools', 5000, '🍸'],
  ['Champagne (bouteille)', 'Vins et alcools', 45000, '🍾'],
  ['Minibar · eau', 'Minibar', 1500, '💧'],
  ['Minibar · soda', 'Minibar', 2000, '🥤'],
  ['Minibar · bière', 'Minibar', 2500, '🍺'],
  ['Blanchisserie · chemise', 'Services', 2000, '🧺'],
  ['Blanchisserie · pantalon', 'Services', 2500, '🧺'],
  ['Transfert aéroport', 'Services', 15000, '🚕'],
  ['Lit supplémentaire', 'Services', 10000, '🛏️'],
]
const CHAMBRES = [
  ...['101', '102', '103', '104', '105', '106'].map((n) => [n, 'Standard', 1, 35000]),
  ...['107', '108'].map((n) => [n, 'Supérieure', 1, 50000]),
  ...['201', '202', '203', '204', '205'].map((n) => [n, 'Standard', 2, 35000]),
  ...['206', '207'].map((n) => [n, 'Supérieure', 2, 50000]),
  ['208', 'Suite', 2, 85000],
]
const TABLES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`T${n}`, 'Restaurant', n === 7 || n === 8 ? 6 : n % 2 ? 2 : 4]),
  ...[1, 2, 3, 4].map((n) => [`B${n}`, 'Bar', 2]),
  ...[1, 2, 3].map((n) => [`P${n}`, 'Terrasse', 4]),
]
const CLIENTS = ['M. Jean-Pierre MOUKO', 'Mme Grâce NGOMA', 'M. Thomas Durand (TotalEnergies)', 'M. Patrick OKEMBA', 'Mme Aïcha DIALLO', 'M. Kevin Martin (Perenco)', 'M. Serge MAMPOUYA', 'Mme Carine BOUKA', 'M. Ibrahim KONATÉ', 'Mme Sandrine LOEMBA', 'M. Arnaud Petit (SNPC)', 'M. Rodrigue ITOUA']
const MODES = ['Espèces', 'Espèces', 'Espèces', 'MTN Mobile Money', 'Airtel Money', 'Carte', 'Virement']
const ENTREPRISES = [
  ['Congo Forage Services', 'Pointe-Noire'],
  ['Société Minière du Kouilou', 'Pointe-Noire'],
  ['BTP Plateau & Fils', 'Brazzaville'],
  ['Cabinet Audit Conseil', 'Brazzaville'],
  ['ONG Santé Pour Tous', 'Brazzaville'],
  ['Transports Oyo Express', 'Oyo'],
]
const L = (designation, qte, pu, description = '') => ({ designation, description, qte, pu })
const DEVIS = [
  ['Séminaire annuel · 2 jours', 'Cabinet Audit Conseil', [L('Location salle de conférence', 2, 150000), L('Pause-café (40 pers.)', 4, 60000), L('Déjeuners (40 pers.)', 2, 320000), L('Vidéoprojecteur et sono', 2, 35000)], 'Accepté', 120],
  ['Mariage · réception 150 invités', 'Famille MABIALA', [L('Location salle et terrasse', 1, 500000), L('Menu mariage (150 pers.)', 150, 12000), L('Boissons (forfait)', 1, 650000), L('Chambre des mariés (suite)', 1, 85000)], 'Accepté', 95],
  ['Hébergement délégation · 12 chambres', 'Ministère (délégation)', [L('Chambres supérieures · 5 nuits', 60, 50000), L('Petits-déjeuners', 60, 5000), L('Salle de réunion', 5, 120000)], 'Accepté', 70],
  ['Anniversaire 60 ans · 80 invités', 'M. Joseph NGOUABI', [L('Terrasse privatisée', 1, 250000), L('Buffet (80 pers.)', 80, 10000), L('Gâteau', 1, 90000)], 'Refusé', 60],
  ['Formation 3 jours · 25 participants', 'ONG Santé Pour Tous', [L('Salle de formation', 3, 120000), L('Pauses et déjeuners (25 pers.)', 75, 12000)], 'Accepté', 45],
  ['Fin d’année du personnel', 'Congo Forage Services', [L('Dîner de gala (120 pers.)', 120, 15000), L('Animation DJ', 1, 200000), L('Boissons (forfait)', 1, 800000)], 'Envoyé', 12],
  ['Mission 4 ingénieurs · 3 semaines', 'Société Minière du Kouilou', [L('Chambres standard · 21 nuits', 84, 35000), L('Petits-déjeuners', 84, 5000), L('Dîners (forfait)', 84, 9000)], 'Envoyé', 6],
  ['Baptême · 60 invités', 'Mme Chantal OKOMBI', [L('Salle', 1, 180000), L('Menu (60 pers.)', 60, 9000)], 'Refusé', 30],
  ['Séminaire de lancement', 'BTP Plateau & Fils', [L('Salle de conférence', 1, 150000), L('Cocktail (70 pers.)', 70, 8000)], 'Envoyé', 3],
  ['Conférence de presse', 'Transports Oyo Express', [L('Salle', 1, 150000), L('Pause-café (30 pers.)', 1, 90000)], 'Accepté', 20],
]
const SERVEURS = ['Grâce (réception)', 'Grâce (réception)', 'Christian (serveur)']

function hasard(graine) {
  let s = graine
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function genererHotel({ documents, settings }) {
  const r = hasard(11)
  const pick = (l) => l[Math.floor(r() * l.length)]
  const t = today()
  const docs = []
  const actions = []
  const plats = CARTE.map(([nom, categorie, prix, emoji], i) => {
    const d = { id: uid(), type: 'plat', numero: `PL-${String(i + 1).padStart(4, '0')}`, prospect_id: null, data: { nom, categorie, prix, emoji } }
    docs.push(d)
    return { id: d.id, nom, categorie, prix }
  })
  const chambres = CHAMBRES.map(([nom, categorie, etage, prix], i) => {
    const d = { id: uid(), type: 'chambre', numero: `CH-${String(i + 1).padStart(3, '0')}`, prospect_id: null, data: { nom, categorie, etage, prix, menage: false } }
    docs.push(d)
    return d
  })
  const tables = TABLES.map(([nom, zone, places], i) => {
    const d = { id: uid(), type: 'table', numero: `TB-${String(i + 1).padStart(3, '0')}`, prospect_id: null, data: { nom, zone, places } }
    docs.push(d)
    return d
  })
  const repas = plats.filter((p) => ['Plats', 'Grillades', 'Entrées'].includes(p.categorie))
  const boissons = plats.filter((p) => ['Boissons', 'Bières', 'Vins et alcools'].includes(p.categorie))
  const extra = (date, origine) => {
    const p = origine === 'Minibar' ? pick(plats.filter((x) => x.categorie === 'Minibar')) : origine === 'Services' ? pick(plats.filter((x) => x.categorie === 'Services')) : pick([...repas, ...boissons, ...plats.filter((x) => x.categorie === 'Petit-déjeuner')])
    return { id: uid(), date, heure: `${String(7 + Math.floor(r() * 15)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, designation: p.nom, qte: pick([1, 1, 1, 2]), pu: p.prix, platId: p.id, origine, par: pick(SERVEURS) }
  }

  // Numéros de facture : à la suite de ceux déjà présents (ventes du magasin)
  // Numéros de facture et de devis : à la suite de ceux déjà présents
  const fact = settings.facturation
  let base = nextNumero(documents, 'facture', fact)
  const prefixe = base.slice(0, -6)
  let n = parseInt(base.slice(-6), 10)
  const baseDevis = nextNumero(documents, 'devis', fact)
  const prefixeDevis = baseDevis.slice(0, -6)
  let nd = parseInt(baseDevis.slice(-6), 10)
  const totalDe = (lignes) => lignes.reduce((m, l) => m + l.qte * l.pu, 0)
  const paiement = (date, heure, montant, mode, numero, notes) => actions.push({ prospect_id: null, date, time: heure, canal: 'Autre', action: 'Paiement reçu', montant, mode, facture: numero, notes })
  // Facture payée sur-le-champ (paye = true), à crédit (paye = []), ou payée en plusieurs fois (paye = [[date, montant, mode], …])
  const facture = (date, heure, objet, client, lignes, mode, paye = true, extra = {}) => {
    const numero = `${prefixe}${String(n++).padStart(6, '0')}`
    // Données compactes (6 mois de tickets) : seuls les champs utiles sont gardés
    const compactes = lignes.map((l) => (l.description ? l : { designation: l.designation, qte: l.qte, pu: l.pu }))
    docs.push({ id: uid(), type: 'facture', numero, prospect_id: null, created_at: `${date}T${heure}:00Z`, data: { date, echeance: extra.echeance || date, objet, client: { nom: client, ...(extra.adresse ? { adresse: extra.adresse } : {}) }, lignes: compactes, tva: 0, ...(extra.echeance ? { conditions: 'Payable à 30 jours' } : {}), vente: { vendeur: pick(SERVEURS), mode, heure }, ...(extra.devis ? { devis: extra.devis } : {}) } })
    if (paye === true) paiement(date, heure, totalDe(lignes), mode, numero, objet)
    else paye.forEach(([d, m, md]) => d <= t && paiement(d, '10:00', m, md, numero, objet))
    return numero
  }
  const hh = () => `${String(9 + Math.floor(r() * 3)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`
  const heureRepas = () => `${String(12 + Math.floor(r() * 10)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`
  const JOURS = 180
  // Saison : plus de monde en fin de mois, en juillet-août et en décembre ; week-end plus chargé pour le bar et les passages
  const saison = (d) => {
    const m = Number(d.slice(5, 7))
    return (m === 7 || m === 8 || m === 12 ? 1.25 : m === 5 ? 0.85 : 1) * (Number(d.slice(8, 10)) > 24 ? 1.15 : 1)
  }
  const weekEnd = (d) => [0, 5, 6].includes(new Date(`${d}T12:00`).getDay())
  const nb = (moy, d, we = 1) => Math.max(0, Math.round(moy * saison(d) * (weekEnd(d) ? we : 1) * (0.6 + r() * 0.8)))

  // 6 derniers mois : séjours terminés (fiches détaillées sur les 45 derniers jours), restaurant, bar, passages
  let sej = 0
  // Nuits déjà prises par chambre : les séjours passés ne se chevauchent pas (planning réaliste)
  const DEPUIS = [1, 2, 3, 1, 4, 2, 0, 5, 1]
  const OCCUPEES = [0, 1, 3, 6, 7, 8, 10, 13, 15]
  const pris = chambres.map((_, i) => {
    const k = OCCUPEES.indexOf(i)
    return k >= 0 ? new Set(Array.from({ length: 40 }, (_, x) => addDays(t, -DEPUIS[k] + x))) : new Set()
  })
  const libre = (i, a, nuits) => Array.from({ length: nuits }, (_, x) => addDays(a, x)).every((d) => !pris[i].has(d))
  const heure = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  for (let j = JOURS; j >= 1; j--) {
    const d = addDays(t, -j)
    // Départs du jour : séjours payés au départ
    for (let k = 0; k < nb(2.9, d, 1.2); k++) {
      const nuits = pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7])
      const arr = addDays(d, -nuits)
      const candidats = chambres.map((_, i) => i).filter((i) => libre(i, arr, nuits))
      if (!candidats.length) continue
      const i = pick(candidats)
      const chDoc = chambres[i]
      const ch = chDoc.data
      for (let x = 0; x < nuits; x++) pris[i].add(addDays(arr, x))
      const extras = Array.from({ length: Math.floor(r() * (2 + nuits)) }, () => extra(addDays(arr, Math.floor(r() * nuits)), pick(['Room service', 'Restaurant · T3', 'Bar · B1', 'Minibar', 'Services', 'Room service'])))
      sej++
      const client = pick(CLIENTS)
      const lignes = [{ designation: `Hébergement chambre ${ch.nom}`, description: `${nuits} nuit${nuits > 1 ? 's' : ''}`, qte: nuits, pu: ch.prix }, ...extras.map((l) => ({ designation: l.designation, description: l.origine, qte: l.qte, pu: l.pu }))]
      const numero = facture(d, hh(), `Séjour chambre ${ch.nom}`, client, lignes, pick(MODES))
      if (j <= 30) docs.push({ id: uid(), type: 'sejour', numero: `SEJ-${String(100 + sej).padStart(6, '0')}`, prospect_id: null, data: { statut: 'clos', chambreId: chDoc.id, chambre: ch.nom, client: { nom: client, tel: '', piece: '' }, personnes: pick([1, 1, 2]), arrivee: arr, heureArrivee: '14:00', depart: d, departReel: d, prixNuit: ch.prix, lignes: extras, acomptes: [], factureNumero: numero } })
    }
    // Restaurant et terrasse : déjeuner et dîner ; bar surtout le soir et le week-end
    for (let k = 0; k < nb(4, d, 1.4); k++) {
      const tb = pick(tables.filter((x) => x.data.zone !== 'Bar')).data
      const couverts = pick([1, 2, 2, 2, 3, 4, 4, 6])
      const lignes = [...Array.from({ length: couverts }, () => pick(repas)), ...Array.from({ length: couverts }, () => pick(boissons)), ...(r() < 0.3 ? [pick(plats.filter((x) => x.categorie === 'Desserts'))] : [])]
      const agreges = []
      lignes.forEach((p) => {
        const l = agreges.find((x) => x.designation === p.nom)
        if (l) l.qte++
        else agreges.push({ designation: p.nom, description: '', qte: 1, pu: p.prix })
      })
      facture(d, heureRepas(), `${tb.zone} · ${tb.nom}`, `Client ${tb.zone.toLowerCase()}`, agreges, pick(MODES))
    }
    for (let k = 0; k < nb(2.6, d, 1.8); k++) {
      const tb = pick(tables.filter((x) => x.data.zone === 'Bar')).data
      const lignes = Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(boissons)).map((p) => ({ designation: p.nom, description: '', qte: pick([1, 2, 2, 3, 4]), pu: p.prix }))
      facture(d, `${String(18 + Math.floor(r() * 5)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, `Bar · ${tb.nom}`, 'Client bar', lignes, pick(MODES))
    }
    // Passages (chambre louée quelques heures, payée à l'entrée, sans identité)
    for (let k = 0; k < nb(2.6, d, 1.6); k++) {
      const ch = pick(chambres).data
      const long = r() < 0.35
      const h = 10 + Math.floor(r() * 12)
      const m = Math.floor(r() * 60)
      facture(d, heure(h, m), `Passage chambre ${ch.nom}`, 'Client de passage', [{ designation: `Passage chambre ${ch.nom}`, description: `${long ? '4 heures' : '2 heures'} · ${heure(h, m)} → ${heure((h + (long ? 4 : 2)) % 24, m)}`, qte: 1, pu: long ? 10000 : 5000 }], pick(MODES))
    }
  }

  // Comptes entreprises : missions logées et facturées à 30 jours (payées, en partie, en retard, à venir)
  ENTREPRISES.forEach(([nom, adresse], k) => {
    for (let x = 0; x < 3; x++) {
      const d = addDays(t, -(8 + k * 11 + x * 47) % JOURS)
      const ch = pick(chambres).data
      const nuits = pick([3, 4, 5, 6, 8, 10])
      const pers = pick([1, 2, 3, 4])
      const lignes = [
        { designation: `Hébergement mission · ${pers} chambre${pers > 1 ? 's' : ''}`, description: `${nuits} nuits · chambres ${ch.categorie.toLowerCase()}s`, qte: nuits * pers, pu: ch.prix },
        { designation: 'Petits-déjeuners', description: `${pers} personne${pers > 1 ? 's' : ''}`, qte: nuits * pers, pu: 5000 },
        ...(r() < 0.6 ? [{ designation: 'Dîners (forfait)', description: '', qte: nuits * pers, pu: 9000 }] : []),
        ...(r() < 0.4 ? [{ designation: 'Transfert aéroport', description: 'Aller-retour', qte: 2, pu: 15000 }] : []),
      ]
      const total = totalDe(lignes)
      const echeance = addDays(d, 30)
      // Anciennes missions presque toutes réglées ; les récentes attendent leur virement
      const etat = d < addDays(t, -40) ? pick(['paye', 'paye', 'paye', 'paye', 'paye', 'partiel', 'attente']) : pick(['paye', 'partiel', 'attente', 'attente'])
      const paye = etat === 'paye' ? [[addDays(d, 10 + Math.floor(r() * 25)), total, 'Virement']] : etat === 'partiel' ? [[addDays(d, 3), Math.round(total / 2 / 1000) * 1000, 'Virement']] : []
      facture(d, '11:00', `Mission ${nom}`, nom, lignes, 'Virement', paye, { echeance, adresse })
    }
  })

  // Devis : séminaires, mariages, anniversaires, groupes ; acceptés (facturés avec acompte), en attente, refusés
  DEVIS.forEach(([objet, client, lignes, statut, ilya], k) => {
    const d = addDays(t, -ilya)
    const numero = `${prefixeDevis}${String(nd++).padStart(6, '0')}`
    const data = { date: d, echeance: '', validite: addDays(d, 30), objet, client: { nom: client, adresse: 'Brazzaville' }, lignes, remise: k % 3 === 0 ? Math.round((totalDe(lignes) * 0.05) / 1000) * 1000 : '', tva: 0, conditions: 'Devis valable 30 jours · acompte de 50 % à la commande', notes: 'Merci de votre confiance. Bon pour accord : date, signature et cachet.', paiement: '', statut }
    const doc = { id: uid(), type: 'devis', numero, prospect_id: null, created_at: `${d}T10:00:00Z`, data }
    docs.push(doc)
    if (statut === 'Accepté') {
      const total = totalDe(lignes) - (data.remise || 0)
      const lignesF = data.remise ? [...lignes, { designation: 'Remise commerciale 5 %', description: '', qte: 1, pu: -data.remise }] : lignes
      const quand = addDays(d, 4)
      const soldeLe = addDays(d, Math.min(ilya - 1, 20))
      const numF = facture(quand, '15:00', objet, client, lignesF, 'Virement', [[quand, Math.round(total / 2), 'Virement'], ...(ilya > 25 ? [[soldeLe, total - Math.round(total / 2), pick(['Virement', 'Espèces'])]] : [])], { echeance: addDays(quand, 15), devis: numero })
      data.factureNumero = numF
    }
  })

  // Dépenses : salaires, énergie, groupe électrogène, achats cuisine et boissons, entretien, taxes
  const depense = (date, montant, categorie, fournisseur, notes, mode = 'Espèces') => actions.push({ prospect_id: null, date, time: '10:30', canal: 'Autre', action: 'Dépense', montant: Math.round(montant / 500) * 500, categorie, fournisseur, mode, notes })
  for (let j = JOURS; j >= 0; j--) {
    const d = addDays(t, -j)
    const jour = Number(d.slice(8, 10))
    const dow = new Date(`${d}T12:00`).getDay()
    if (jour === 28) depense(d, 2850000 + Math.floor(r() * 4) * 50000, 'Salaires', 'Personnel', `Salaires du mois (14 employés)`, 'Virement')
    if (jour === 5) depense(d, 380000 + r() * 160000, 'Électricité / eau', 'E2C', 'Facture électricité', 'MTN Mobile Money')
    if (jour === 7) depense(d, 95000 + r() * 50000, 'Électricité / eau', 'LCDE', 'Facture eau', 'MTN Mobile Money')
    if (jour === 10) depense(d, 65000, 'Téléphone / internet', 'Fournisseur internet', 'Internet fibre + téléphone', 'Airtel Money')
    if (jour === 12) depense(d, 45000, 'Téléphone / internet', 'Bouquet TV', 'Abonnement télévision des chambres', 'Espèces')
    if (jour === 15) depense(d, 250000 + r() * 150000, 'Taxes et impôts', 'Mairie / impôts', 'Taxe de séjour et patente (acompte)', 'Virement')
    if (dow === 1 || dow === 4) depense(d, 110000 + r() * 120000, 'Achats cuisine', pick(['Marché Total', 'Marché Plateau', 'Poissonnerie du port']), pick(['Poissons, poulets, légumes', 'Viande, manioc, légumes', 'Vivres de la semaine']))
    if (dow === 2) depense(d, 280000 + r() * 220000, 'Boissons', 'Dépôt de boissons', 'Bières, sodas, eau minérale')
    if (dow === 3) depense(d, 55000 + r() * 45000, 'Carburant groupe', 'Station-service', 'Gasoil du groupe électrogène')
    if (dow === 6 && r() < 0.5) depense(d, 40000 + r() * 50000, "Produits d'entretien", 'Grossiste', 'Détergents, papier, savons, produits chambres')
    if (r() < 0.05) depense(d, 60000 + r() * 250000, 'Entretien / réparations', pick(['Froid Service', 'Plombier', 'Électricien']), pick(['Réparation climatiseur chambre', 'Fuite salle de bain', 'Remplacement ampoules et prises', 'Entretien groupe électrogène']))
    if (r() < 0.03) depense(d, 120000 + r() * 300000, 'Équipement', 'Fournisseur', pick(['Draps et serviettes', 'Vaisselle restaurant', 'Matelas chambre', 'Téléviseur chambre']))
  }

  // Aujourd'hui : quelques additions déjà encaissées (petit-déjeuner, déjeuner)
  ;['08:05', '08:40', '09:15', '12:30', '13:10'].forEach((h, k) => {
    const tb = tables[[0, 2, 8, 1, 13][k]].data
    const p = k < 3 ? plats.filter((x) => x.categorie === 'Petit-déjeuner') : repas
    const lignes = [pick(p), pick(p), pick(boissons)].map((x) => ({ designation: x.nom, description: '', qte: 1, pu: x.prix }))
    facture(t, h, `${tb.zone} · ${tb.nom}`, `Client ${tb.zone.toLowerCase()}`, lignes, pick(MODES))
  })

  // Clients actuellement dans l'hôtel
  const occupees = OCCUPEES
  occupees.forEach((i, k) => {
    const ch = chambres[i]
    const depuis = DEPUIS[k]
    const arr = addDays(t, -depuis)
    const lignes = Array.from({ length: Math.min(6, depuis * 2 + Math.floor(r() * 2)) }, (_, x) => extra(addDays(arr, Math.min(depuis, Math.floor(x / 2))), pick(['Room service', 'Restaurant · T2', 'Bar · B2', 'Minibar', 'Services'])))
    docs.push({
      id: uid(),
      type: 'sejour',
      numero: `SEJ-${String(k + 1).padStart(6, '0')}`,
      prospect_id: null,
      data: {
        statut: 'en cours',
        chambreId: ch.id,
        chambre: ch.data.nom,
        client: { nom: CLIENTS[k], tel: `+242 06 ${410 + k * 23} ${String(12 + k * 9).padStart(2, '0')} ${String(30 + k * 5).padStart(2, '0')}`, piece: k % 3 ? 'CNI' : 'Passeport' },
        personnes: k % 4 === 0 ? 2 : 1,
        arrivee: arr,
        heureArrivee: '14:30',
        depart: addDays(t, [0, 1, 2, 0, 1, 3, 2, 1, 4][k]),
        prixNuit: ch.data.prix,
        lignes,
        acomptes: k % 2 ? [{ id: uid(), date: arr, heure: '14:35', montant: ch.data.prix, mode: pick(MODES), par: 'Grâce (réception)' }] : [],
        par: 'Grâce (réception)',
      },
    })
  })
  // Deux passages en cours (dont un qui a dépassé son heure)
  ;[[9, '2 heures', 5000, 35, 2], [14, '4 heures', 10000, 250, 4]].forEach(([i, tarif, prix, minutes, heures], k) => {
    const ch = chambres[i]
    const debut = new Date(Date.now() - minutes * 60000)
    const fin = new Date(debut.getTime() + heures * 3600000)
    const hm = (x) => x.toTimeString().slice(0, 5)
    const numero = `${prefixe}${String(n).padStart(6, '0')}`
    facture(t, hm(debut), `Passage chambre ${ch.data.nom}`, 'Client de passage', [{ designation: `Passage chambre ${ch.data.nom}`, description: `${tarif} · ${hm(debut)} → ${hm(fin)}`, qte: 1, pu: prix }], 'Espèces')
    docs.push({
      id: uid(),
      type: 'sejour',
      numero: `SEJ-${String(50 + k).padStart(6, '0')}`,
      prospect_id: null,
      data: { statut: 'en cours', passage: true, chambreId: ch.id, chambre: ch.data.nom, client: { nom: 'Client de passage', tel: '', piece: '' }, personnes: 1, arrivee: t, heureArrivee: hm(debut), depart: t, debut: debut.toISOString(), fin: fin.toISOString(), tarif, paye: [{ facture: numero, montant: prix, tarif, heure: hm(debut) }], prixNuit: 0, lignes: k ? [{ ...extra(t, 'Minibar'), heure: hm(new Date(debut.getTime() + 40 * 60000)) }] : [], acomptes: [], par: 'Grâce (réception)' },
    })
  })
  // Deux chambres à nettoyer
  ;[2, 11].forEach((i) => (chambres[i].data.menage = true))

  // Tables occupées en ce moment
  const maintenant = Date.now()
  ;[[0, 2, 25], [3, 4, 50], [8, 2, 10], [12, 3, 70]].forEach(([i, couverts, minutes], k) => {
    const tb = tables[i]
    const bar = tb.data.zone === 'Bar'
    const choix = [...(bar ? [] : Array.from({ length: couverts }, () => pick(repas))), ...Array.from({ length: couverts }, () => pick(boissons))]
    const lignes = []
    choix.forEach((p) => {
      const l = lignes.find((x) => x.id === p.id)
      if (l) l.qte++
      else lignes.push({ key: `${p.id}-${k}-${lignes.length}`, id: p.id, nom: p.nom, prix: p.prix, categorie: p.categorie, qte: 1, remise: 0, envoye: 1 })
    })
    if (k === 1) lignes.push({ key: `dessert-${k}`, id: plats[18].id, nom: plats[18].nom, prix: plats[18].prix, categorie: plats[18].categorie, qte: 2, remise: 0, envoye: 0 })
    lignes.forEach((l) => l.envoye !== 0 && (l.envoye = l.qte))
    docs.push({ id: uid(), type: 'commande', numero: `CMD-${String(k + 1).padStart(6, '0')}`, prospect_id: null, data: { statut: 'ouverte', tableId: tb.id, table: tb.data.nom, zone: tb.data.zone, lignes, couverts, serveur: pick(SERVEURS), ouverte: new Date(maintenant - minutes * 60000).toISOString() } })
  })
  // Réservations à venir (et deux clients attendus aujourd'hui sur des chambres libres)
  const libres = chambres.filter((_, i) => !occupees.includes(i) && ![2, 11].includes(i))
  const RES = [
    [0, 0, 2, 'Mme Nadège MIAKALOUBA', 'Téléphone', 35000],
    [1, 0, 3, 'M. Didier OBAMBI (Congo Telecom)', 'Entreprise', 0],
    [2, 1, 3, 'M. Luc Bernard', 'Booking', 50000],
    [3, 2, 5, 'Mme Esther NKOUNKOU', 'WhatsApp', 0],
    [0, 3, 6, 'M. Alain MOUSSAVOU', 'Téléphone', 0],
    [4, 4, 8, 'Mission Perenco (4 ingénieurs)', 'Entreprise', 100000],
    [1, 5, 7, 'Mme Julie Moreau', 'E-mail', 0],
    [2, 6, 9, 'M. Hervé ELENGA', 'Sur place', 0],
  ]
  RES.forEach(([i, a, b, nom, source, acompte], k) => {
    const ch = libres[i % libres.length]
    docs.push({ id: uid(), type: 'reservation', numero: `RES-${String(k + 1).padStart(6, '0')}`, prospect_id: null, data: { statut: 'confirmee', creee: addDays(t, -3), chambreId: ch.id, chambre: ch.data.nom, client: { nom, tel: `+242 05 ${520 + k * 17} ${String(40 + k * 3).padStart(2, '0')} ${String(11 + k * 8).padStart(2, '0')}` }, personnes: 1, arrivee: addDays(t, a), depart: addDays(t, b), prixNuit: ch.data.prix, acompte, modeAcompte: acompte ? 'MTN Mobile Money' : '', source, note: '', par: 'Grâce (réception)' } })
  })
  // Numéros de facture dans l'ordre chronologique (les missions et les devis sont générés après les tickets)
  const factures = docs.filter((d) => d.type === 'facture').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const renum = {}
  factures.forEach((f, i) => {
    const nouveau = `${prefixe}${String(parseInt(base.slice(-6), 10) + i).padStart(6, '0')}`
    renum[f.numero] = nouveau
    f.numero = nouveau
  })
  actions.forEach((a) => a.facture && renum[a.facture] && (a.facture = renum[a.facture]))
  docs.forEach((d) => {
    if (d.data?.factureNumero && renum[d.data.factureNumero]) d.data.factureNumero = renum[d.data.factureNumero]
    ;(d.data?.paye || []).forEach((p) => renum[p.facture] && (p.facture = renum[p.facture]))
  })
  return { docs, actions, sejours: sej, categoriesDepenses: ['Salaires', 'Achats cuisine', 'Boissons', 'Électricité / eau', 'Carburant groupe', "Produits d'entretien", 'Entretien / réparations', 'Équipement', 'Téléphone / internet', 'Taxes et impôts'] }
}
