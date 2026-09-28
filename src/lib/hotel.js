// Hôtel : chambres, tables, carte (restaurant, bar, services), séjours avec leur note, commandes aux tables.
// Tout est rangé dans la table « documents » (types chambre, table, plat, sejour, commande) : aucune
// modification de la base n'est nécessaire, et le magasin n'est pas touché.
import { num, totals, nextNumero, nouveauDoc } from './invoice'
import { today, nowTime, diffDays, addDays } from './dates'
import { uid } from './store'

export const ZONES = ['Restaurant', 'Bar', 'Terrasse']
export const CATEGORIES_CHAMBRE = ['Standard', 'Supérieure', 'Suite']
export const CATEGORIES_CARTE = ['Petit-déjeuner', 'Entrées', 'Plats', 'Grillades', 'Desserts', 'Boissons', 'Bières', 'Vins et alcools', 'Minibar', 'Services']
export const SUR_CHAMBRE = 'Sur la chambre'
// Couleur de fond des vignettes de la carte, par catégorie
export const TEINTES = {
  'Petit-déjeuner': '#fff4d6',
  Entrées: '#e7f6e7',
  Plats: '#ffe9dc',
  Grillades: '#fde2e0',
  Desserts: '#fbe4f3',
  Boissons: '#dff1fb',
  Bières: '#fff0c9',
  'Vins et alcools': '#efe3f8',
  Minibar: '#e6ecf5',
  Services: '#e3f3f1',
}

const actif = (d) => !d.data?.archive
const parNom = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { numeric: true })

export const chambresDe = (documents) =>
  documents
    .filter((d) => d.type === 'chambre' && actif(d))
    .map((d) => ({ id: d.id, doc: d, ...d.data, prix: num(d.data?.prix), etage: num(d.data?.etage) }))
    .sort(parNom)
export const tablesDe = (documents) =>
  documents
    .filter((d) => d.type === 'table' && actif(d))
    .map((d) => ({ id: d.id, doc: d, ...d.data, places: num(d.data?.places) }))
    .sort(parNom)
export const platsDe = (documents) =>
  documents
    .filter((d) => d.type === 'plat' && actif(d))
    .map((d) => ({ id: d.id, doc: d, numero: d.numero, ...d.data, prix: num(d.data?.prix) }))
    .sort(parNom)
// Séjours en cours (un par chambre occupée)
export const sejoursEnCours = (documents) => documents.filter((d) => d.type === 'sejour' && d.data?.statut === 'en cours')
export const commandesOuvertes = (documents) => documents.filter((d) => d.type === 'commande' && d.data?.statut === 'ouverte')

// Numéro suivant pour les documents internes (SEJ-000012, CMD-000031, PL-0005…)
export function numeroInterne(documents, type, prefixe, chiffres = 6) {
  let max = 0
  documents.filter((d) => d.type === type).forEach((d) => {
    const n = parseInt(String(d.numero).replace(/\D/g, ''), 10)
    if (!isNaN(n)) max = Math.max(max, n)
  })
  return `${prefixe}-${String(max + 1).padStart(chiffres, '0')}`
}

// ---------- Note de la chambre ----------
// Nuits facturées : au moins une ; au départ, on compte jusqu'au jour du départ
export const nuitsDe = (s, jusqua = today()) => Math.max(1, diffDays(jusqua, s.arrivee || jusqua))
export const nuitsPrevues = (s) => Math.max(1, diffDays(s.depart || s.arrivee, s.arrivee))

export function folio(sejour, jusqua = today()) {
  const s = sejour.data || sejour
  const nuits = nuitsDe(s, jusqua)
  const hebergement = nuits * num(s.prixNuit)
  const extras = (s.lignes || []).reduce((m, l) => m + num(l.qte) * num(l.pu), 0)
  const acomptes = (s.acomptes || []).reduce((m, a) => m + num(a.montant), 0)
  const total = hebergement + extras
  return { nuits, hebergement, extras, acomptes, total, reste: Math.max(0, total - acomptes) }
}

// Arrivée : crée le séjour ; un acompte éventuel est gardé sur la note
export async function arrivee({ chambre, client, tel, piece, personnes, depart, prixNuit, acompte, mode, par }, { documents, api }) {
  const acomptes = num(acompte) > 0 ? [{ id: uid(), date: today(), heure: nowTime(), montant: num(acompte), mode, par }] : []
  return api.saveDoc({
    type: 'sejour',
    numero: numeroInterne(documents, 'sejour', 'SEJ'),
    prospect_id: null,
    data: {
      statut: 'en cours',
      chambreId: chambre.id,
      chambre: chambre.nom,
      client: { nom: client.trim(), tel: tel || '', piece: piece || '' },
      personnes: num(personnes) || 1,
      arrivee: today(),
      heureArrivee: nowTime(),
      depart: depart || addDays(today(), 1),
      prixNuit: num(prixNuit),
      lignes: [],
      acomptes,
      par: par || '',
    },
  })
}

// Ajoute des consommations sur la note d'une chambre (room service, restaurant, minibar…)
export async function ajouterSurNote(sejourDoc, lignes, origine, par, { api }) {
  const nouvelles = lignes.map((l) => ({ id: uid(), date: today(), heure: nowTime(), designation: l.nom, qte: num(l.qte), pu: Math.round(num(l.prix)), platId: l.id || null, origine, par: par || '' }))
  const data = sejourDoc.data
  return api.saveDoc({ ...sejourDoc, data: { ...data, lignes: [...(data.lignes || []), ...nouvelles] } })
}

// ---------- Encaissement ----------
// Facture + paiement, comme une vente du magasin, mais sans toucher au stock
export async function encaisser({ lignes, client, mode, vendeur, objet, acomptes = [], extra = {} }, { documents, settings, api }) {
  const fact = settings.facturation
  const numero = nextNumero(documents, 'facture', fact)
  const doc = await api.saveDoc({
    type: 'facture',
    numero,
    prospect_id: null,
    data: {
      ...nouveauDoc('facture', fact),
      objet,
      client: { nom: client?.trim() || 'Client de passage', adresse: '' },
      lignes,
      echeance: today(),
      vente: { vendeur: vendeur || '', mode, heure: nowTime() },
      ...extra,
    },
  })
  const total = totals(doc.data).total
  const deja = acomptes.reduce((m, a) => m + num(a.montant), 0)
  const rows = acomptes.map((a) => ({ prospect_id: null, date: a.date, time: a.heure || nowTime(), canal: 'Autre', action: 'Paiement reçu', montant: num(a.montant), mode: a.mode, facture: numero, notes: 'Acompte séjour' }))
  if (total - deja > 0) rows.push({ prospect_id: null, date: today(), time: nowTime(), canal: 'Autre', action: 'Paiement reçu', montant: total - deja, mode, facture: numero, notes: objet })
  if (rows.length) await api.addActions(rows)
  return { doc, total }
}

// Lignes de facture d'une commande (restaurant, bar)
export const lignesCommande = (lignes) =>
  lignes.filter((l) => num(l.qte) > 0).map((l) => ({ designation: num(l.remise) ? `${l.nom} (remise ${num(l.remise)} %)` : l.nom, description: '', qte: num(l.qte), pu: Math.round(prixNet(l)) }))
export const prixNet = (l) => num(l.prix) * (1 - Math.min(100, num(l.remise)) / 100)
export const totalLignes = (lignes) => lignes.reduce((m, l) => m + num(l.qte) * prixNet(l), 0)

// Départ : facture de l'hébergement et des extras, acomptes déduits, chambre à nettoyer
export async function depart(sejourDoc, { mode, vendeur }, ctx) {
  const s = sejourDoc.data
  const f = folio(s)
  const lignes = [
    { designation: `Hébergement chambre ${s.chambre}`, description: `Du ${fr(s.arrivee)} au ${fr(today())} · ${f.nuits} nuit${f.nuits > 1 ? 's' : ''}`, qte: f.nuits, pu: num(s.prixNuit) },
    ...(s.lignes || []).map((l) => ({ designation: l.designation, description: [fr(l.date), l.origine].filter(Boolean).join(' · '), qte: num(l.qte), pu: num(l.pu) })),
  ]
  const r = await encaisser({ lignes, client: s.client?.nom, mode, vendeur, objet: `Séjour chambre ${s.chambre}`, acomptes: s.acomptes || [], extra: { sejour: sejourDoc.numero } }, ctx)
  await ctx.api.saveDoc({ ...sejourDoc, data: { ...s, statut: 'clos', departReel: today(), heureDepart: nowTime(), factureNumero: r.doc.numero } })
  const ch = ctx.documents.find((d) => d.id === s.chambreId)
  if (ch) await ctx.api.saveDoc({ ...ch, data: { ...ch.data, menage: true } })
  return r
}

const fr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

// ---------- Tickets imprimés (bon cuisine, addition) ----------
// Petite page 80 mm ouverte dans une fenêtre, prête à imprimer
export function imprimerTicket(titre, entete, lignes, pied = '') {
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return false
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titre)}</title>
<style>@page{size:80mm auto;margin:4mm}body{font:13px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;width:72mm;margin:0 auto;color:#111}
h1{font-size:17px;text-align:center;margin:4px 0}.c{text-align:center}.l{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #bbb}
.q{font-weight:800;min-width:28px}.n{flex:1}.t{font-size:16px;font-weight:800;display:flex;justify-content:space-between;margin-top:8px}.m{color:#555;font-size:12px}</style></head><body>
<h1>${esc(titre)}</h1><div class="c m">${entete.map(esc).join('<br>')}</div><div style="margin-top:8px">
${lignes.map((l) => `<div class="l"><span class="q">${esc(l.q)}</span><span class="n">${esc(l.n)}${l.d ? `<br><span class="m">${esc(l.d)}</span>` : ''}</span><span>${esc(l.m || '')}</span></div>`).join('')}
</div>${pied}<script>setTimeout(function(){window.print()},250)</script></body></html>`)
  w.document.close()
  return true
}

// ---------- Tableau de l'hôtel ----------
export function etatHotel(documents) {
  const chambres = chambresDe(documents)
  const sejours = sejoursEnCours(documents)
  const occ = new Set(sejours.map((s) => s.data.chambreId))
  const t = today()
  return {
    total: chambres.length,
    occupees: chambres.filter((c) => occ.has(c.id)).length,
    aNettoyer: chambres.filter((c) => !occ.has(c.id) && c.menage).length,
    departs: sejours.filter((s) => s.data.depart && s.data.depart <= t).length,
    arrivees: sejours.filter((s) => s.data.arrivee === t).length,
  }
}
