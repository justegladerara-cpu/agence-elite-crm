// Registre de sécurité SEC-01 à SEC-15 (docs/superadmin-v2/07_SECURITY_REGISTER.md) : un test de non-régression
// par défaut corrigé, sur les règles pures. Les parcours dans le navigateur sont dans e2e/securite.spec.js.
import { describe, it, expect, beforeAll, vi } from 'vitest'

// localStorage, navigator et window minimaux (Vitest tourne sous Node)
const memoire = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: (k) => memoire.delete(k),
}
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })

import { nextNumero, numerosDejaPris } from '../src/modules/facturation/invoice'
import { remplacerDonnees } from '../src/lib/remplacer'
import { lireSauvegarde } from '../src/lib/sauvegarde'
import { echeanceMinimum, echeanceProposee, erreurEcheance } from '../src/modules/plateforme/licence'
import { creerJournal, executer, preparerEncaissement, noterGeste, marquerReglee, A_REPRENDRE } from '../src/modules/plateforme/operations'
import { celluleCsv, versCsv } from '../src/lib/csv'
import { refusDe } from '../src/core/permissions'
import { estRaccourciLibre } from '../src/lib/clavier'

const FACT = { prefixeFacture: 'FAC-', prefixeDevis: 'DEV-', premierNumero: 1 }

describe('SEC-01 / SEC-08 · numéros de facture', () => {
  it('ne réattribue jamais un numéro cité par un paiement, même si la facture a disparu', () => {
    const actions = [{ action: 'Paiement reçu', facture: 'FAC-2026000007' }]
    expect(nextNumero([], 'facture', FACT, '2026-10-21')).toBe('FAC-2026000001')
    expect(nextNumero([], 'facture', FACT, '2026-10-21', numerosDejaPris(actions, []))).toBe('FAC-2026000008')
  })
  it('compte aussi les numéros des factures dans la corbeille', () => {
    const corbeille = [{ contenu: { documents: [{ numero: 'FAC-2026000012' }] } }]
    expect(nextNumero([{ type: 'facture', numero: 'FAC-2026000003' }], 'facture', FACT, '2026-10-21', numerosDejaPris([], corbeille))).toBe('FAC-2026000013')
  })
})

describe('SEC-02 · remplacer sans passer par un état vide', () => {
  const avant = { prospects: [{ id: 'p1' }, { id: 'p2' }], actions: [{ id: 'a1' }] }
  it('un import qui échoue retire ce qui vient d’être ajouté et ne touche pas aux anciennes données', async () => {
    const supprimes = []
    const db = {
      bulkImport: vi.fn(async () => {
        throw Object.assign(new Error('réseau coupé'), { inseres: { prospects: ['n1'], actions: [] } })
      }),
      supprimerLot: vi.fn(async (l) => supprimes.push(l)),
    }
    await expect(remplacerDonnees(db, avant, [{ id: 'n1' }, { id: 'n2' }], [])).rejects.toThrow(/intactes/)
    expect(supprimes).toEqual([{ prospects: ['n1'], actions: [] }])
  })
  it('les anciennes lignes sont retirées par identifiant, seulement après un ajout réussi', async () => {
    const ordre = []
    const db = { bulkImport: async () => ordre.push('ajout'), supprimerLot: async (l) => ordre.push(l) }
    await remplacerDonnees(db, avant, [{ id: 'n1' }], [])
    expect(ordre).toEqual(['ajout', { prospects: ['p1', 'p2'], actions: ['a1'] }])
  })
  it('le stockage local garde les identifiants importés et supprime seulement ceux demandés', async () => {
    const { db } = await import('../src/lib/store')
    await db.bulkImport([{ id: 'x1', name: 'Fictif Un' }], [{ id: 'y1', prospect_id: 'x1', date: '2026-10-01', action: 'Note' }])
    await db.bulkImport([{ id: 'x2', name: 'Fictif Deux' }], [])
    await db.supprimerLot({ prospects: ['x1'], actions: [] })
    const st = await db.load()
    expect(st.prospects.map((p) => p.id)).toEqual(['x2'])
    expect(st.actions.some((a) => a.id === 'y1')).toBe(false)
  })
})

describe('SEC-11 · restaurer une sauvegarde', () => {
  it('refuse un fichier qui n’est pas une sauvegarde du CRM', () => {
    expect(() => lireSauvegarde('pas du json')).toThrow(/illisible/)
    expect(() => lireSauvegarde(JSON.stringify({ format: 'autre' }))).toThrow(/pas une sauvegarde/)
    expect(() => lireSauvegarde(JSON.stringify({ format: 'agence-elite-crm', version: 1, prospects: [] }))).toThrow(/vide/)
  })
  it('garde les identifiants et détache une action dont la fiche manque', () => {
    const c = lireSauvegarde(JSON.stringify({ format: 'agence-elite-crm', version: 1, prospects: [{ id: 'p1', name: 'Fictif' }, { name: 'sans id' }], actions: [{ id: 'a1', prospect_id: 'p9' }], documents: [] }))
    expect(c.prospects.map((p) => p.id)).toEqual(['p1'])
    expect(c.actions[0].prospect_id).toBe(null)
  })
})

describe('SEC-09 · échéance de licence', () => {
  const licence = { echeance: '2026-11-10', formule: 'mensuel', debut: '2026-10-10' }
  it('refuse une nouvelle échéance avant ou égale à l’actuelle', () => {
    expect(erreurEcheance(licence, '2026-11-10', '2026-10-21')).toMatch(/après/)
    expect(erreurEcheance(licence, '2026-11-05', '2026-10-21')).toMatch(/après/)
    expect(erreurEcheance(licence, '2026-11-11', '2026-10-21')).toBe('')
    expect(echeanceMinimum(licence, '2026-10-21')).toBe('2026-11-11')
  })
  it('licence échue : la date minimum est aujourd’hui, la période part d’aujourd’hui', () => {
    const echue = { echeance: '2026-10-19', formule: 'mensuel' }
    expect(echeanceMinimum(echue, '2026-10-21')).toBe('2026-10-21')
    expect(echeanceProposee(echue, '2026-10-21')).toBe('2026-11-21')
    expect(echeanceProposee({ echeance: '2026-01-31', formule: 'mensuel' }, '2026-01-01')).toBe('2026-02-28')
    expect(echeanceProposee({ echeance: '2026-03-01', formule: 'annuel' }, '2026-01-01')).toBe('2027-03-01')
  })
})

describe('SEC-03 · encaissement sur deux bases, sans doublon', () => {
  const client = { id: 'c1', nom: 'Client Fictif' }
  const etablissement = { id: 'e1', nom: 'Bar Fictif' }
  const licence = { id: 'l1', echeance: '2026-11-10', formule: 'mensuel' }
  const monde = () => {
    const historique = []
    const actions = []
    const appels = []
    const pannes = { plateforme: 0, plateformeApres: 0, crm: 0 }
    return {
      historique,
      actions,
      appels,
      pannes,
      deps: {
        journal: creerJournal(globalThis.localStorage),
        appeler: async (fn, p) => {
          appels.push(fn)
          if (pannes.plateforme-- > 0) throw new Error('Failed to fetch')
          historique.push({ reference: p.p_reference, nouvelle_echeance: '2026-12-10' })
          if (pannes.plateformeApres-- > 0) throw new Error('Failed to fetch')
          return '2026-12-10'
        },
        lireHistorique: async () => historique,
        lireActions: () => actions,
        ajouterPaiement: async (a) => {
          if (pannes.crm-- > 0) throw new Error('Supabase indisponible')
          actions.push(a)
        },
      },
    }
  }
  const op = () => preparerEncaissement({ client, etablissement, licence, montant: 15000, mode: 'Espèces', jour: '2026-10-21', reference: '' })

  it('chemin normal : préparée → licence faite → paiement fait → terminée', async () => {
    const m = monde()
    const fin = await executer(op(), m.deps)
    expect(fin.etat).toBe('terminee')
    expect(fin.etapes.map((e) => e.etat)).toEqual(['preparee', 'licence_faite', 'paiement_fait', 'terminee'])
    expect(m.historique).toHaveLength(1)
    expect(m.actions).toHaveLength(1)
    expect(m.actions[0].notes).toContain(fin.id)
  })
  it('paiement CRM refusé : opération partielle, la reprise ne renouvelle pas une 2e fois', async () => {
    const m = monde()
    m.pannes.crm = 1
    const o = op()
    await expect(executer(o, m.deps)).rejects.toThrow(/réconcilier/)
    const gardee = m.deps.journal.lire(o.id)
    expect(gardee.etat).toBe('partielle')
    expect(A_REPRENDRE).toContain('partielle')
    const fin = await executer(gardee, m.deps)
    expect(fin.etat).toBe('terminee')
    expect(m.appels.filter((f) => f === 'renouveler_licence')).toHaveLength(1)
    expect(m.actions).toHaveLength(1)
  })
  it('réponse perdue après le renouvellement : à réconcilier, puis reprise sans doublon', async () => {
    const m = monde()
    m.pannes.plateformeApres = 1
    const o = op()
    await expect(executer(o, m.deps)).rejects.toThrow(/perdue/)
    const gardee = m.deps.journal.lire(o.id)
    expect(gardee.etat).toBe('a_reconcilier')
    const fin = await executer(gardee, m.deps)
    expect(fin.etat).toBe('terminee')
    expect(m.historique).toHaveLength(1)
    expect(m.actions).toHaveLength(1)
  })
  it('refus net de la plateforme : échouée, rien n’est noté dans le CRM', async () => {
    const m = monde()
    m.deps.appeler = async () => {
      throw new Error('La nouvelle échéance doit être postérieure à l’actuelle')
    }
    const o = op()
    await expect(executer(o, m.deps)).rejects.toThrow(/postérieure/)
    expect(m.deps.journal.lire(o.id).etat).toBe('echouee')
    expect(m.actions).toHaveLength(0)
  })
  it('paiement déjà noté (double clic, autre onglet) : pas de deuxième ligne', async () => {
    const m = monde()
    const o = op()
    m.historique.push({ reference: o.id, nouvelle_echeance: '2026-12-10' })
    m.actions.push({ notes: `… ${o.id}` })
    const fin = await executer(o, m.deps)
    expect(fin.etat).toBe('terminee')
    expect(m.appels).toHaveLength(0)
    expect(m.actions).toHaveLength(1)
  })
  it('les gestes et les réglages à la main sont gardés avec leur motif', () => {
    const j = creerJournal(globalThis.localStorage)
    const g = noterGeste(j, { type: 'bloquer_client', client, motif: 'impayé fictif' })
    expect(j.lire(g.id).motif).toBe('impayé fictif')
    const r = marquerReglee(j, { ...op(), etat: 'partielle' }, 'noté à la main')
    expect(r.etat).toBe('terminee')
    expect(r.motif).toBe('noté à la main')
  })
})

describe('SEC-12 / SEC-13 · exports', () => {
  it('neutralise les formules dans les cellules CSV', () => {
    expect(celluleCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(celluleCsv('+33 6 00')).toBe("'+33 6 00")
    expect(celluleCsv('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(celluleCsv('\tcache')).toBe("'\tcache")
    expect(celluleCsv('-500')).toBe('-500')
    expect(celluleCsv(-500)).toBe('-500')
    expect(celluleCsv('Bar; Fictif')).toBe('"Bar; Fictif"')
    expect(versCsv(['Nom'], [['=1+1']])).toBe("Nom\r\n'=1+1")
  })
  it('seuls le propriétaire et les administrateurs exportent', () => {
    expect(refusDe('proprietaire', 'exporter')).toBe(null)
    expect(refusDe('admin', 'exporter')).toBe(null)
    expect(refusDe('membre', 'exporter')).toMatch(/exportent/)
    expect(refusDe('lecteur', 'exporter')).toMatch(/exportent/)
  })
})

describe('SEC-10 · droits par rôle', () => {
  it('un lecteur ne peut ni écrire, ni remplacer, ni régler', () => {
    for (const op of ['ecrire', 'remplacer', 'reglages', 'supprimer']) expect(refusDe('lecteur', op)).toBeTruthy()
  })
  it('un membre écrit mais ne remplace pas tout et ne supprime pas le travail des autres', () => {
    expect(refusDe('membre', 'ecrire')).toBe(null)
    expect(refusDe('membre', 'remplacer')).toBeTruthy()
    expect(refusDe('membre', 'supprimer', 'autre', 'moi')).toBeTruthy()
    expect(refusDe('membre', 'supprimer', 'moi', 'moi')).toBe(null)
  })
})

describe('SEC-15 · raccourcis 1 à 4', () => {
  it('ignorés pendant une saisie ou avec une touche de modification', () => {
    expect(estRaccourciLibre({ key: '1', target: { tagName: 'INPUT' } })).toBe(false)
    expect(estRaccourciLibre({ key: '1', target: { tagName: 'TEXTAREA' } })).toBe(false)
    expect(estRaccourciLibre({ key: '1', target: { tagName: 'DIV', isContentEditable: true } })).toBe(false)
    expect(estRaccourciLibre({ key: '1', ctrlKey: true, target: { tagName: 'BODY' } })).toBe(false)
    expect(estRaccourciLibre({ key: '1', repeat: true, target: { tagName: 'BODY' } })).toBe(false)
    expect(estRaccourciLibre({ key: '1', target: { tagName: 'BODY' } })).toBe(true)
  })
})

describe('§ 10 · Échap ferme seulement la fenêtre du dessus', () => {
  let empiler, nombreDeCouches
  beforeAll(async () => {
    globalThis.window = new EventTarget()
    ;({ empiler, nombreDeCouches } = await import('../src/lib/couches'))
  })
  it('deux couches : Échap ferme la dernière, puis la première', () => {
    const fermees = []
    const r1 = empiler(() => fermees.push('fenetre'))
    const r2 = empiler(() => fermees.push('menu'))
    const echap = () => {
      const e = new Event('keydown')
      e.key = 'Escape'
      window.dispatchEvent(e)
    }
    echap()
    expect(fermees).toEqual(['menu'])
    r2()
    echap()
    expect(fermees).toEqual(['menu', 'fenetre'])
    r1()
    expect(nombreDeCouches()).toBe(0)
  })
})
