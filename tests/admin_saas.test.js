// Administration de la plateforme dans le CRM (ancien espace Super Admin de saas.agence-elite.fr, déplacé le 2026-10-19).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { creerApi } from '../src/saas/api.js'
import { MENU_EDITEUR, routeEditeurActive } from '../src/saas/modules/editeur/EspaceEditeur.jsx'
import { suggererSousDomaine } from '../src/saas/modules/editeur/AdressesEditeur.jsx'
import { SITES_CLIENTS, appelerSite, trouverSite } from '../src/saas/noyau/sites.js'

const fichiers = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : [join(d, f)]))

describe('administration de la plateforme dans le CRM', () => {
  test('menu : tous les écrans, Adresses web / Sites / Copie réservés au super admin, plus de bouton « CRM »', () => {
    expect(MENU_EDITEUR.map((m) => m.id)).toEqual(expect.arrayContaining(['editeur/clients', 'editeur/comptes', 'editeur/offres', 'editeur/partenaires', 'editeur/identite']))
    for (const id of ['editeur/adresses', 'editeur/sites', 'editeur/copie-articles']) expect(MENU_EDITEUR.find((m) => m.id === id)?.superAdmin).toBe(true)
    expect(MENU_EDITEUR.some((m) => m.id === 'editeur/crm')).toBe(false)
    expect(routeEditeurActive('editeur')).toBe('editeur/tableau')
    expect(routeEditeurActive('editeur/etablissements/abc')).toBe('editeur/clients')
  })

  test('les liens envoyés aux clients mènent au SaaS, jamais au CRM', () => {
    for (const f of fichiers('src/saas').filter((x) => /\.jsx?$/.test(x))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/window\.location\.origin/)
  })

  test('la feuille de style ne touche que .saas-admin (le reste du CRM ne change pas)', () => {
    const css = postcss.parse(readFileSync('src/saas/saas.css', 'utf8'))
    css.walkRules((r) => {
      if (r.parent?.type === 'atrule' && /keyframes/i.test(r.parent.name)) return
      for (const s of r.selectors) expect(s, s).toMatch(/^\.saas-admin\b/)
    })
  })

  test('appels serveur vers saas.agence-elite.fr avec le jeton de session', async () => {
    const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton' } } }) } }
    const appels = []
    const avant = globalThis.fetch
    globalThis.fetch = async (url, init) => (appels.push([url, init]), Response.json({ ok: true }))
    try {
      await creerApi(supabase, 'https://saas.agence-elite.fr').serveur('/api/adresses', { methode: 'POST', corps: { sous_domaine: 'x' } })
    } finally {
      globalThis.fetch = avant
    }
    expect(appels[0][0]).toBe('https://saas.agence-elite.fr/api/adresses')
    expect(appels[0][1].headers.authorization).toBe('Bearer jeton')
  })

  test('adresses web : nom proposé à partir de celui de l’établissement', () => {
    expect(suggererSousDomaine('The Dream Lounge Bar Restaurant')).toBe('the-dream-lounge-bar-restaurant')
    expect(suggererSousDomaine('Hôtel 2i')).toBe('hotel-2i')
  })

  test('sites clients : adresses https, appel avec le jeton et erreurs lisibles', async () => {
    for (const s of SITES_CLIENTS) expect(s.adresse).toMatch(/^https:\/\/[a-z0-9.-]+$/)
    const site = trouverSite('express-congo')
    const appels = []
    await appelerSite(site, 'comptes', { jeton: 'j', methode: 'POST', corps: { a: 1 }, f: async (u, i) => (appels.push([u, i]), Response.json({ ok: true })) })
    expect(appels[0][0]).toBe('https://express-congo.justegladerara.workers.dev/api/plateforme/comptes/')
    expect(appels[0][1].headers.authorization).toBe('Bearer j')
    await expect(appelerSite(site, 'etat', { jeton: null, f: async () => Response.json({}) })).rejects.toThrow(/Session expirée/)
  })
})
