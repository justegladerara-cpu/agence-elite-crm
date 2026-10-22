// Socle des activités : chaque ligne de facture est une vente rangée dans une activité (matériel, logiciel,
// communication…). Fonctions pures (tests/activites.test.js) : activité devinée, marges, clients, relances.
import { today, addDays, diffDays } from '../../lib/dates'
import { montant as num } from '../../lib/finances'

export const MODELES = {
  revente: 'Revente (j’achète, je revends)',
  licence: 'Licence ou abonnement',
  prestation: 'Prestation ponctuelle',
  mensuel: 'Prestation mensuelle',
}

// Activités de départ : modifiables dans Ventes et activités › Réglages
export const ACTIVITES_DEFAUT = [
  { id: 'logiciel', nom: 'Logiciel de caisse', modele: 'licence', couleur: '#0E7490', mots: ['licence', 'logiciel', 'caisse', 'elite os', 'installation', 'formation caisse', 'abonnement logiciel'] },
  { id: 'materiel', nom: 'Matériel informatique', modele: 'revente', couleur: '#7A4CDB', mots: ['tablette', 'imprimante', 'ordinateur', 'pc', 'portable', 'telephone', 'ecran', 'clavier', 'souris', 'routeur', 'cable', 'disque', 'tiroir', 'scanner', 'onduleur', 'cle usb', 'chargeur', 'materiel'] },
  { id: 'communication', nom: 'Communication et design', modele: 'prestation', couleur: '#D9468F', mots: ['affiche', 'flyer', 'logo', 'design', 'graphi', 'post', 'instagram', 'facebook', 'tiktok', 'video', 'montage', 'carte de visite', 'banderole', 'visuel', 'community', 'reseaux', 'publicite', 'campagne', 'photo', 'kakemono', 'menu'] },
  { id: 'sites', nom: 'Sites internet', modele: 'prestation', couleur: '#2563EB', mots: ['site', 'web', 'seo', 'hebergement', 'domaine', 'landing', 'boutique en ligne', 'maintenance site'] },
  { id: 'assistance', nom: 'Assistance administrative', modele: 'prestation', couleur: '#B8903F', mots: ['facture', 'saisie', 'courrier', 'administratif', 'dossier', 'excel', 'word', 'secretariat', 'cv', 'lettre', 'devis', 'impression', 'scan', 'formulaire', 'declaration'] },
  { id: 'autre', nom: 'Autres ventes', modele: 'prestation', couleur: '#5B6475', mots: [] },
]

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const activitesDe = (settings) => (Array.isArray(settings?.activites) && settings.activites.length ? settings.activites : ACTIVITES_DEFAUT)
export const activiteParId = (settings, id) => activitesDe(settings).find((a) => a.id === id) || activitesDe(settings).find((a) => a.id === 'autre') || { id: 'autre', nom: 'Autres ventes', couleur: '#5B6475' }

// Activité d'un texte : d'abord ce que tu as déjà choisi pour le même texte (apprentissage), puis les mots-clés
export function devinerActivite(texte, settings, historique = []) {
  const t = norm(texte)
  if (!t) return null
  const deja = historique.find((l) => norm(l.designation) === t && l.activite)
  if (deja) return deja.activite
  let meilleur = null
  for (const a of activitesDe(settings)) {
    const score = (a.mots || []).reduce((m, mot) => {
      const k = norm(mot)
      return k && (` ${t} `.includes(` ${k} `) || (k.length >= 5 && t.includes(k))) ? m + k.length : m
    }, 0)
    if (score && (!meilleur || score > meilleur.score)) meilleur = { id: a.id, score }
  }
  return meilleur?.id || null
}

// Total d'une ligne, remise du document répartie au prorata
function lignesDoc(d) {
  const data = d.data || {}
  const brutes = (data.lignes || []).map((l) => ({ l, montant: num(l.qte || 1) * num(l.pu) }))
  const sousTotal = brutes.reduce((m, x) => m + x.montant, 0)
  const remise = Math.min(num(data.remise), sousTotal)
  const coef = sousTotal > 0 ? (sousTotal - remise) / sousTotal : 1
  return brutes.map(({ l, montant }) => ({ l, montant: Math.round(montant * coef) }))
}

// Toutes les ventes : une entrée par ligne de facture (hors factures annulées et documents de démonstration)
export function lignesVentes(documents = [], actions = [], prospects = [], settings = {}) {
  const noms = Object.fromEntries(prospects.map((p) => [p.id, p.name]))
  const payes = {}
  for (const a of actions) if (a.action === 'Paiement reçu' && a.facture) payes[a.facture] = (payes[a.facture] || 0) + num(a.montant)
  const out = []
  const historique = []
  const factures = documents.filter((d) => d.type === 'facture' && !d.data?.annulee && !d.data?.demo).sort((a, b) => String(a.data?.date || '').localeCompare(String(b.data?.date || '')))
  for (const d of factures) {
    const lignes = lignesDoc(d)
    const total = lignes.reduce((m, x) => m + x.montant, 0)
    const ratioPaye = total > 0 ? Math.min(1, (payes[d.numero] || 0) / total) : 0
    for (const { l, montant } of lignes) {
      if (!montant && !l.designation) continue
      const designation = String(l.designation || l.description || d.data?.objet || 'Vente').trim()
      const activite = l.activite || devinerActivite(`${designation} ${l.description || ''}`, settings, historique) || devinerActivite(d.data?.objet, settings, historique) || 'autre'
      const cout = l.cout === '' || l.cout === undefined || l.cout === null ? null : num(l.cout) * num(l.qte || 1)
      const ligne = {
        docId: d.id,
        numero: d.numero,
        date: d.data?.date || String(d.created_at || '').slice(0, 10),
        prospectId: d.prospect_id || null,
        client: noms[d.prospect_id] || d.data?.client?.nom || 'Client sans nom',
        designation,
        activite,
        montant,
        cout,
        marge: cout === null ? montant : montant - cout,
        encaisse: Math.round(montant * ratioPaye),
      }
      historique.push({ designation, activite })
      out.push(ligne)
    }
  }
  return out
}

export const dansPeriode = (date, debut, fin) => !!date && date >= debut && date <= fin

// Période choisie et période d'avant de même durée
export function periodes(choix = 'mois', t = today()) {
  if (choix === 'mois') {
    const debut = `${t.slice(0, 7)}-01`
    const jours = diffDays(t, debut)
    const pDebut = addDays(debut, -1).slice(0, 7) + '-01'
    return { debut, fin: t, avantDebut: pDebut, avantFin: addDays(pDebut, jours), nom: 'ce mois' }
  }
  const n = { '7j': 7, '30j': 30, '90j': 90, '365j': 365 }[choix] || 30
  const debut = addDays(t, -(n - 1))
  return { debut, fin: t, avantDebut: addDays(debut, -n), avantFin: addDays(debut, -1), nom: `${n} derniers jours` }
}

const evolution = (cur, prev) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? null : 0)

// Chiffres par activité sur la période, comparés à la période d'avant
export function statsActivites(lignes, settings, p) {
  const total = lignes.filter((l) => dansPeriode(l.date, p.debut, p.fin)).reduce((m, l) => m + l.marge, 0)
  return activitesDe(settings)
    .map((a) => {
      const cur = lignes.filter((l) => l.activite === a.id && dansPeriode(l.date, p.debut, p.fin))
      const prev = lignes.filter((l) => l.activite === a.id && dansPeriode(l.date, p.avantDebut, p.avantFin))
      const ca = cur.reduce((m, l) => m + l.montant, 0)
      const marge = cur.reduce((m, l) => m + l.marge, 0)
      const caAvant = prev.reduce((m, l) => m + l.montant, 0)
      const clients = new Set(cur.map((l) => l.prospectId || l.client)).size
      return {
        ...a,
        ca,
        marge,
        tauxMarge: ca > 0 ? marge / ca : null,
        ventes: cur.length,
        moyenne: cur.length ? Math.round(ca / cur.length) : 0,
        clients,
        caAvant,
        evolution: evolution(ca, caAvant),
        part: total > 0 ? marge / total : 0,
        encaisse: cur.reduce((m, l) => m + l.encaisse, 0),
        toutes: lignes.filter((l) => l.activite === a.id).length,
      }
    })
    .filter((a) => a.toutes > 0 || a.id !== 'autre')
}

// Ce que vend le plus une liste de lignes (par désignation)
export function meilleursServices(lignes, n = 5) {
  const m = {}
  for (const l of lignes) {
    const k = norm(l.designation)
    m[k] = m[k] || { designation: l.designation, activite: l.activite, ca: 0, marge: 0, ventes: 0 }
    m[k].ca += l.montant
    m[k].marge += l.marge
    m[k].ventes += 1
  }
  return Object.values(m).sort((a, b) => b.marge - a.marge).slice(0, n)
}

// Bilan de chaque client : ce qu'il a rapporté, ce qu'il achète, son rythme et son étiquette
export function statsClients(lignes, t = today()) {
  const par = {}
  for (const l of lignes) {
    const k = l.prospectId || `nom:${norm(l.client)}`
    par[k] = par[k] || { cle: k, prospectId: l.prospectId, nom: l.client, lignes: [] }
    par[k].lignes.push(l)
  }
  return Object.values(par)
    .map((c) => {
      const dates = [...new Set(c.lignes.map((l) => l.date))].sort()
      const achats = [...new Set(c.lignes.map((l) => l.docId))].length
      const ca = c.lignes.reduce((m, l) => m + l.montant, 0)
      const marge = c.lignes.reduce((m, l) => m + l.marge, 0)
      const du = c.lignes.reduce((m, l) => m + (l.montant - l.encaisse), 0)
      const parActivite = {}
      for (const l of c.lignes) parActivite[l.activite] = (parActivite[l.activite] || 0) + l.montant
      const activites = Object.entries(parActivite).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, ca: v, part: ca > 0 ? v / ca : 0 }))
      const premier = dates[0]
      const dernier = dates[dates.length - 1]
      const rythme = dates.length > 1 ? Math.round(diffDays(dernier, premier) / (dates.length - 1)) : null
      const depuis = dernier ? diffDays(t, dernier) : null
      let etiquette = 'Client'
      if (premier && diffDays(t, premier) <= 60 && achats <= 2) etiquette = 'Nouveau'
      else if (rythme && depuis > rythme * 1.5 && depuis >= 30) etiquette = 'À relancer'
      else if (!rythme && depuis >= 90) etiquette = 'À relancer'
      else if (achats >= 3) etiquette = 'Fidèle'
      return { ...c, ca, marge, du, achats, premier, dernier, rythme, depuis, activites, services: meilleursServices(c.lignes, 3), etiquette }
    })
    .sort((a, b) => b.ca - a.ca)
}

// Part de la marge portée par les 3 plus gros clients (risque de dépendance)
export function dependance(clients) {
  const total = clients.reduce((m, c) => m + Math.max(0, c.marge), 0)
  const top = [...clients].sort((a, b) => b.marge - a.marge).slice(0, 3)
  return { part: total > 0 ? top.reduce((m, c) => m + Math.max(0, c.marge), 0) / total : 0, clients: top }
}

// Prix habituel d'un service (dernière vente du même texte, pour ce client d'abord)
export function prixHabituel(lignes, texte, prospectId) {
  const t = norm(texte)
  if (!t) return null
  const memes = lignes.filter((l) => norm(l.designation) === t)
  const pourLui = memes.filter((l) => prospectId && l.prospectId === prospectId)
  const l = (pourLui.length ? pourLui : memes).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return l ? { pu: l.montant, cout: l.cout, activite: l.activite, date: l.date } : null
}

const prenom = (nom) => String(nom || '').split(' ')[0]

// Mode relance : clients à recontacter, classés par argent possible
export function clientsARelancer(clients, settings, { devis = [], t = today() } = {}) {
  const liste = []
  const acts = activitesDe(settings)
  const nomAct = (id) => acts.find((a) => a.id === id)?.nom || 'nos services'
  for (const c of clients) {
    const service = c.services[0]?.designation
    const moyenne = c.achats ? Math.round(c.ca / c.achats) : 0
    if (c.rythme && c.depuis > c.rythme * 1.3 && c.depuis >= 21) {
      liste.push({ client: c, type: 'habitude', raison: `Achète en général tous les ${c.rythme} j, dernier achat il y a ${c.depuis} j`, potentiel: moyenne, message: `Bonjour ${prenom(c.nom)}, j’espère que tout va bien ! Ça fait un moment depuis votre dernière commande (${service || 'notre dernier travail'}). Avez-vous un besoin en ce moment ? Je peux vous faire une proposition rapide.` })
    } else if (!c.rythme && c.depuis >= 60) {
      liste.push({ client: c, type: 'ancien', raison: `Un seul achat (${service || '—'}), il y a ${c.depuis} j`, potentiel: moyenne, message: `Bonjour ${prenom(c.nom)}, c’était un plaisir de travailler avec vous sur ${service || 'votre projet'}. Avez-vous un nouveau projet ? J’ai quelques idées pour vous.` })
    }
    // Vente croisée : une activité jamais achetée par un client qui en achète une autre
    const achetees = new Set(c.activites.map((a) => a.id))
    if (achetees.has('materiel') && !achetees.has('logiciel')) liste.push({ client: c, type: 'croisee', raison: 'A acheté du matériel, pas encore le logiciel de caisse', potentiel: 150000, message: `Bonjour ${prenom(c.nom)}, votre matériel vous donne satisfaction ? Avec notre logiciel de caisse, vous suivez vos ventes et votre stock depuis votre téléphone. Je vous fais une démo de 10 minutes ?` })
    else if (achetees.has('logiciel') && !achetees.has('communication')) liste.push({ client: c, type: 'croisee', raison: 'Client du logiciel, jamais de communication', potentiel: 25000, message: `Bonjour ${prenom(c.nom)}, pour attirer plus de clients chez vous, je peux vous préparer une affiche ou des visuels pour vos réseaux. Voulez-vous voir quelques exemples ?` })
    else if (achetees.size === 1 && c.achats >= 2 && !achetees.has('materiel')) liste.push({ client: c, type: 'croisee', raison: `Achète seulement : ${nomAct([...achetees][0])}`, potentiel: moyenne, message: `Bonjour ${prenom(c.nom)}, merci pour votre fidélité ! Saviez-vous que nous proposons aussi ${acts.filter((a) => !achetees.has(a.id) && a.id !== 'autre').slice(0, 2).map((a) => a.nom.toLowerCase()).join(' et ')} ?` })
  }
  for (const d of devis) {
    const age = diffDays(t, d.data?.date || t)
    if (age >= 5 && age <= 60) liste.push({ client: { nom: d.client, prospectId: d.prospect_id }, type: 'devis', raison: `Devis ${d.numero} sans réponse depuis ${age} j`, potentiel: d.total, message: `Bonjour, je reviens vers vous au sujet du devis ${d.numero}. Avez-vous pu le regarder ? Je peux l’ajuster si besoin.` })
  }
  return liste.sort((a, b) => b.potentiel - a.potentiel)
}

// Recommandations du tableau de bord : constat, argent en jeu, action. Classées par argent en jeu puis urgence.
export function recommandations(c) {
  const r = []
  const eurs = (v) => `${Math.round(v).toLocaleString('fr-FR')} ${c.sym || 'FCFA'}`
  if (c.objectifDmSemaine > 0 && c.dmSemaine < c.objectifDmSemaine * 0.5) {
    const manque = Math.max(0, Math.round((c.objectifDmSemaine * c.joursPasses) / 7 - c.dmSemaine))
    r.push({ ton: 'rouge', titre: `Envoie ${Math.max(20, Math.min(50, manque))} DM aujourd’hui`, detail: `${c.dmSemaine} DM cette semaine pour un objectif de ${c.objectifDmSemaine}. Sans prospection, pas de nouvelles ventes dans 2 à 3 semaines.`, action: 'Noter mes DM', faire: 'dm', poids: 3 })
  }
  if (c.appelsSemaine < 10 && c.joursPasses >= 2) r.push({ ton: 'orange', titre: 'Bloque 1 h d’appels', detail: `${c.appelsSemaine} appel(s) cette semaine. Les appels transforment mieux que les DM pour le logiciel de caisse.`, action: 'Ma journée', route: '/journee', poids: 2 })
  if (c.facturesRetard?.n) r.push({ ton: 'rouge', titre: `Relance ${c.facturesRetard.n} facture(s) en retard`, detail: `${eurs(c.facturesRetard.montant)} à encaisser.`, impact: c.facturesRetard.montant, action: 'Voir les factures', route: '/factures?filtre=retard', poids: 3 })
  if (c.relancesRetard) r.push({ ton: 'orange', titre: `Fais tes ${c.relancesRetard} relance(s) en retard`, detail: 'Chaque jour de retard fait baisser la chance de réponse.', action: 'Ma journée', route: '/journee', poids: 2 })
  if (c.devisAttente?.n) r.push({ ton: 'orange', titre: `Relance ${c.devisAttente.n} devis sans réponse`, detail: `${eurs(c.devisAttente.montant)} en jeu.`, impact: c.devisAttente.montant * 0.4, action: 'Voir les devis', route: '/devis?filtre=attente', poids: 2 })
  if (c.aRelancer?.length) {
    const pot = c.aRelancer.slice(0, 10).reduce((m, x) => m + (x.potentiel || 0), 0)
    r.push({ ton: 'bleu', titre: `${c.aRelancer.length} ancien(s) client(s) à relancer`, detail: `Environ ${eurs(pot)} possibles. Messages déjà écrits.`, impact: pot * 0.3, action: 'Mode relance', route: '/relances', poids: 1 })
  }
  for (const a of c.activites || []) {
    if (a.caAvant > 0 && a.evolution !== null && a.evolution <= -0.3) r.push({ ton: 'orange', titre: `${a.nom} en baisse de ${Math.round(-a.evolution * 100)} %`, detail: `${eurs(a.ca)} contre ${eurs(a.caAvant)} sur la période d’avant.`, impact: a.caAvant - a.ca, action: 'Voir l’activité', route: `/activites/${a.id}`, poids: 1 })
  }
  if (c.dependance?.part >= 0.5 && c.dependance.clients.length >= 2) r.push({ ton: 'bleu', titre: `Tes 3 premiers clients font ${Math.round(c.dependance.part * 100)} % de ta marge`, detail: 'Si l’un d’eux part, ton activité chute. Trouve 2 nouveaux clients ce mois-ci.', action: 'Clients', route: '/ventes-clients', poids: 0 })
  if (c.resultat < 0) r.push({ ton: 'rouge', titre: 'Les charges dépassent les rentrées ce mois-ci', detail: `Résultat : ${eurs(c.resultat)}. Encaisse ce qui est dû et vérifie les dépenses.`, action: 'Charges', route: '/charges', poids: 3 })
  return r.sort((a, b) => b.poids - a.poids || (b.impact || 0) - (a.impact || 0))
}
