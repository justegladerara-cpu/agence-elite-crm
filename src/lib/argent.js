// Montants : toujours avec leur vraie devise (jamais un « € » ou « FCFA » écrit en dur dans un écran).
// Devise du CRM : réglée dans Paramètres (settings.devise). Devise d'une licence : celle que renvoie la plateforme.

export const DEVISES = [
  { code: 'XAF', label: 'Franc CFA Afrique centrale (XAF)', sym: 'FCFA', parEuro: 655.957, decimales: 0 },
  { code: 'XOF', label: 'Franc CFA Afrique de l’Ouest (XOF)', sym: 'FCFA', parEuro: 655.957, decimales: 0 },
  { code: 'EUR', label: 'Euro (€)', sym: '€', parEuro: 1, decimales: 2 },
  { code: 'USD', label: 'Dollar US ($)', sym: '$', parEuro: 1.08, decimales: 2 },
  { code: 'MAD', label: 'Dirham marocain (MAD)', sym: 'MAD', parEuro: 10.8, decimales: 2 },
  { code: 'CAD', label: 'Dollar canadien (CAD)', sym: 'CAD', parEuro: 1.47, decimales: 2 },
]
export const deviseDe = (code) => DEVISES.find((d) => d.code === code) || null

// 25000, 'XAF' → « 25 000 FCFA » ; décimales seulement si le montant en a (12,5 € mais 12 €)
export function argent(v, code) {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '—'
  const d = deviseDe(code)
  const n = Number(v)
  const dec = d && d.decimales === 0 ? 0 : Number.isInteger(n) ? 0 : 2
  const txt = n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/[  ]/g, ' ')
  return `${txt} ${d ? d.sym : code || ''}`.trim()
}

// Somme par devise : [{montant, devise}] → [{devise, total}] (jamais d'addition entre deux devises)
export function sommesParDevise(lignes, deviseParDefaut) {
  const t = new Map()
  for (const l of lignes) {
    const code = l.devise || deviseParDefaut || ''
    t.set(code, (t.get(code) || 0) + (Number(l.montant) || 0))
  }
  return [...t].map(([devise, total]) => ({ devise, total }))
}
export const afficherSommes = (sommes) => (sommes.length ? sommes.map((s) => argent(s.total, s.devise)).join(' + ') : argent(0, ''))
