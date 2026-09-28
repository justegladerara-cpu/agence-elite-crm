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
  let base = nextNumero(documents, 'facture', settings.facturation)
  const prefixe = base.slice(0, -6)
  let n = parseInt(base.slice(-6), 10)
  const facture = (date, heure, objet, client, lignes, mode) => {
    const numero = `${prefixe}${String(n++).padStart(6, '0')}`
    docs.push({ id: uid(), type: 'facture', numero, prospect_id: null, created_at: `${date}T${heure}:00Z`, data: { date, echeance: date, validite: '', objet, client: { nom: client, adresse: '' }, lignes, remise: '', tva: 0, conditions: 'Payable à réception', notes: '', paiement: '', vente: { vendeur: pick(SERVEURS), mode, heure } } })
    actions.push({ prospect_id: null, date, time: heure, canal: 'Autre', action: 'Paiement reçu', montant: lignes.reduce((m, l) => m + l.qte * l.pu, 0), mode, facture: numero, notes: objet })
  }

  // 30 derniers jours : séjours terminés et tickets du restaurant et du bar
  let sej = 0
  // Nuits déjà prises par chambre : les séjours passés ne se chevauchent pas (planning réaliste)
  const DEPUIS = [1, 2, 3, 1, 4, 2, 0, 5, 1]
  const OCCUPEES = [0, 1, 3, 6, 7, 8, 10, 13, 15]
  const pris = chambres.map((_, i) => {
    const k = OCCUPEES.indexOf(i)
    return k >= 0 ? new Set(Array.from({ length: 40 }, (_, x) => addDays(t, -DEPUIS[k] + x))) : new Set()
  })
  const libre = (i, a, nuits) => Array.from({ length: nuits }, (_, x) => addDays(a, x)).every((d) => !pris[i].has(d))
  for (let j = 30; j >= 1; j--) {
    const d = addDays(t, -j)
    for (let k = 0; k < 2 + Math.floor(r() * 4); k++) {
      const nuits = pick([1, 1, 2, 2, 3, 4])
      const arr = addDays(d, -nuits)
      const candidats = chambres.map((_, i) => i).filter((i) => libre(i, arr, nuits))
      if (!candidats.length) continue
      const i = pick(candidats)
      const chDoc = chambres[i]
      const ch = chDoc.data
      for (let x = 0; x < nuits; x++) pris[i].add(addDays(arr, x))
      const extras = Array.from({ length: Math.floor(r() * 4) }, () => extra(arr, pick(['Room service', 'Restaurant · T3', 'Bar · B1', 'Minibar'])))
      sej++
      const client = pick(CLIENTS)
      const numero = `${prefixe}${String(n).padStart(6, '0')}`
      facture(d, `${String(9 + Math.floor(r() * 3)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, `Séjour chambre ${ch.nom}`, client, [
        { designation: `Hébergement chambre ${ch.nom}`, description: `${nuits} nuit${nuits > 1 ? 's' : ''}`, qte: nuits, pu: ch.prix },
        ...extras.map((l) => ({ designation: l.designation, description: l.origine, qte: l.qte, pu: l.pu })),
      ], pick(MODES))
      docs.push({ id: uid(), type: 'sejour', numero: `SEJ-${String(100 + sej).padStart(6, '0')}`, prospect_id: null, data: { statut: 'clos', chambreId: chDoc.id, chambre: ch.nom, client: { nom: client, tel: '', piece: '' }, personnes: 1, arrivee: arr, heureArrivee: '14:00', depart: d, departReel: d, prixNuit: ch.prix, lignes: extras, acomptes: [], factureNumero: numero } })
    }
    for (let k = 0; k < 2 + Math.floor(r() * 5); k++) {
      const tb = pick(tables).data
      const bar = tb.zone === 'Bar'
      const lignes = [...Array.from({ length: bar ? 0 : 1 + Math.floor(r() * 3) }, () => pick(repas)), ...Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(boissons))].map((p) => ({ designation: p.nom, description: '', qte: pick([1, 1, 2, 3]), pu: p.prix }))
      facture(d, `${String(12 + Math.floor(r() * 10)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, `${tb.zone} · ${tb.nom}`, `Client ${tb.zone.toLowerCase()}`, lignes, pick(MODES))
    }
  }

  // Passages (chambre louée quelques heures, payée à l'entrée, sans identité) : 30 derniers jours
  const heure = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  for (let j = 30; j >= 0; j--) {
    const d = addDays(t, -j)
    for (let k = 0; k < (j ? 2 + Math.floor(r() * 4) : 3); k++) {
      const ch = pick(chambres).data
      const long = r() < 0.4
      const h = 10 + Math.floor(r() * (j ? 12 : 3))
      const m = Math.floor(r() * 60)
      facture(d, heure(h, m), `Passage chambre ${ch.nom}`, 'Client de passage', [{ designation: `Passage chambre ${ch.nom}`, description: `${long ? '4 heures' : '2 heures'} · ${heure(h, m)} → ${heure(h + (long ? 4 : 2), m)}`, qte: 1, pu: long ? 10000 : 5000 }], pick(MODES))
    }
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
  return { docs, actions, sejours: sej }
}
