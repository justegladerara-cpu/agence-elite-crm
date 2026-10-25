// Navigation CRM 3.0 : 8 centres, aucune page orpheline, anciennes adresses redirigées
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ESPACES_NAV, PAGES_SANS_MENU, LIBELLES, REDIRECTIONS, cleDePage, entreeDe, espaceDe, espacesActifs, pagesRecherche, redirection, BAS } from '../src/navigation'
import { MENU_EDITEUR } from '../src/saas/modules/editeur/EspaceEditeur.jsx'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const parametres = readFileSync(new URL('../src/pages/Parametres.jsx', import.meta.url), 'utf8')
const routes = new Set([...ESPACES_NAV.flatMap((e) => e.entrees.flatMap((x) => [x.route, ...(x.pages || [])])), ...PAGES_SANS_MENU.map((x) => x.route)])
// Pages de détail ouvertes depuis une liste (jamais orphelines : on y arrive par une ligne de la liste)
const DETAIL = ['prospect', 'facture', 'plateforme-client', 'espace', 'prospects']

describe('navigation en 9 centres', () => {
  it('neuf centres, le tableau de bord en premier', () => {
    expect(ESPACES_NAV.map((e) => e.id)).toEqual(['pilotage', 'reseau', 'services', 'finances', 'moi', 'equipe', 'partners', 'site', 'administration'])
  })
  it('chaque page routée par App a une place (menu, recherche ou détail)', () => {
    const pages = [...app.matchAll(/page === '([a-z-]+)'\) content/g)].map((m) => m[1])
    expect(pages.length).toBeGreaterThan(20)
    const orphelines = pages.filter((p) => !routes.has(p) && !DETAIL.includes(p) && ![...routes].some((r) => r.startsWith(`${p}/`)))
    expect(orphelines).toEqual([])
  })
  it('scripts, saisie, tableau de bord et relances sont dans la recherche ; plus de session d’appels', () => {
    const r = pagesRecherche().map((x) => x.path)
    for (const p of ['scripts', 'saisie', 'controle', 'pilotage', 'relances', 'activites', 'moi', 'reseau', 'equipe', 'signature']) expect(r).toContain(p)
    expect(r).not.toContain('session')
  })
  it('chaque écran éditeur est dans un espace (plus de barre d’onglets à part)', () => {
    for (const m of MENU_EDITEUR) if (m.id !== 'editeur/clients') expect(routes.has(m.id), m.id).toBe(true)
    expect(entreeDe('editeur/clients').route).toBe('plateforme')
    expect(app).not.toMatch(/saas-onglets/)
  })
  it('chaque section de Paramètres a sa place : la prospection garde ses réglages, le reste en Administration', () => {
    const sections = [...parametres.matchAll(/^\s+\['([a-z]+)', '[^']+', ["'`]/gm)].map((m) => m[1])
    expect(sections.length).toBe(11)
    const prospection = ['objectifs', 'listes', 'scripts', 'rappels']
    for (const s of sections) expect(espaceDe(`parametres/${s}`)?.id, s).toBe(prospection.includes(s) ? 'reseau' : s === 'membres' ? 'equipe' : 'administration')
  })
  it('un seul libellé par page, jamais deux fois le même dans le menu', () => {
    const libelles = ESPACES_NAV.flatMap((e) => e.entrees.map((x) => x.label))
    expect(new Set(libelles).size).toBe(libelles.length)
    expect(LIBELLES.pilotage).toBe('Vue globale')
  })
  it('anciennes adresses : boîte à outils, applications, éditeur sans page', () => {
    expect(redirection('plateforme-outils')).toBe('espace/services')
    expect(redirection('session')).toBe('journee')
    expect(redirection('apps')).toBe('espace')
    expect(redirection('editeur')).toBe('editeur/tableau')
    expect(redirection('parametres?x=1')).toBe('parametres/identite?x=1')
    expect(redirection('factures?filtre=impayees')).toBe(null)
    // Lot 5 : la page client de l'éditeur mène à la fiche client unique ; la liste des clients reste
    expect(redirection('editeur/clients/abc')).toBe('plateforme-client/abc?onglet=avance')
    expect(redirection('editeur/clients')).toBe(null)
    expect(redirection('')).toBe('pilotage')
    for (const cible of Object.values(REDIRECTIONS)) expect(redirection(cible)).toBe(null)
  })
  it('clé et espace de la page affichée', () => {
    expect(cleDePage('dashboard', '', new URLSearchParams('onglet=ventes'))).toBe('dashboard/finances')
    expect(cleDePage('parametres')).toBe('parametres/identite')
    expect(cleDePage('editeur', 'etablissements/abc')).toBe('editeur/etablissements')
    expect(espaceDe('editeur/etablissements').id).toBe('services')
    expect(espaceDe('facture').id).toBe('finances')
    expect(espaceDe('controle').id).toBe('services')
    expect(espaceDe('pilotage').id).toBe('pilotage')
    expect(espaceDe('editeur/partenaires').id).toBe('partners')
    expect(espaceDe('site-demandes').id).toBe('site')
  })
  it('un module désactivé retire ses entrées ; la barre du bas pointe vers des espaces existants', () => {
    const sansFactu = espacesActifs((route) => !['factures', 'devis', 'paiements'].includes(route))
    expect(sansFactu.find((e) => e.id === 'finances').entrees.map((x) => x.route)).toEqual(['depenses', 'abonnements', 'charges', 'operations', 'dashboard/finances'])
    for (const b of BAS.filter((x) => x.espace)) expect(ESPACES_NAV.some((e) => e.id === b.espace)).toBe(true)
  })
})
