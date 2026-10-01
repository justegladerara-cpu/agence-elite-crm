import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('reconstruction Supabase Pareto V1', () => {
  const ordre = read('supabase/migrations/legacy-order.txt')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith('#'))

  it('référence uniquement des scripts présents et exclut les scripts obsolètes ou destructifs', () => {
    ordre.forEach((file) => expect(existsSync(resolve(root, 'supabase', file)), file).toBe(true))
    expect(ordre).not.toContain('owner.sql')
    expect(existsSync(resolve(root, 'supabase/owner.sql'))).toBe(false)
    expect(ordre).not.toContain('demo.sql')
    expect(ordre).not.toContain('store_catalogue.sql')
  })

  it('respecte les dépendances structurantes des Steps 6A et 6B', () => {
    const avant = (a, b) => expect(ordre.indexOf(a), `${a} avant ${b}`).toBeLessThan(ordre.indexOf(b))
    avant('bootstrap_prerequis.sql', 'site.sql')
    avant('bootstrap_prerequis.sql', 'store.sql')
    avant('store.sql', 'double_auth.sql')
    avant('double_auth.sql', 'espaces.sql')
    avant('espaces.sql', 'audit.sql')
    avant('audit.sql', 'espace_donnees.sql')
    avant('espace_donnees.sql', 'evenements.sql')
    avant('evenements.sql', 'acces_membres.sql')
    avant('acces_membres.sql', 'evenements_modifications.sql')
    avant('evenements_modifications.sql', 'espace_permissions.sql')
  })

  it('versionne la garantie d’unicité des devis et factures par espace', () => {
    const migration = read('supabase/migrations/20260930180000_pareto_v1_documents_uniques.sql')
    expect(migration).toMatch(/create unique index if not exists documents_workspace_type_numero_unique/i)
    expect(migration).toMatch(/workspace_id, type, lower\(btrim\(numero\)\)/i)
    expect(migration).toMatch(/type in \('devis', 'facture'\)/i)
  })

  it('garde un contrôle reproductible des invariants multi-espace critiques', () => {
    const controle = read('supabase/tests/pareto_v1.sql')
    for (const invariant of ['membres lecture', 'membres ajout', 'membres modification', 'gestion suppression', 'membres suppression propre', 'rattacher_espace', 'enregistrer_reglages']) {
      expect(controle, invariant).toContain(invariant)
    }
    expect(controle).toContain("policyname like 'own %'")

    const diagnostic = read('supabase/tests/diagnostic_avant_migration.sql')
    for (const invariant of ['having count(*) > 1', 'workspace_id is null', 'is distinct from p.workspace_id', "role = 'proprietaire'", "policyname like 'own %'"]) {
      expect(diagnostic, invariant).toContain(invariant)
    }
  })
})
