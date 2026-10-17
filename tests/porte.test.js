import { describe, expect, it } from 'vitest'
import { DUREE_MS, extraireJeton, fermerPorte, porteOuverte, verifierJeton } from '../src/lib/porte.js'

const memoire = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
const reponse = (corps, ok = true) => async () => ({ ok, json: async () => corps })

describe('porte unique du CRM', () => {
  it('reste fermée sans autorisation enregistrée', () => {
    expect(porteOuverte(memoire())).toBe(false)
  })

  it('s’ouvre pour un super admin, pendant 12 h seulement', async () => {
    const s = memoire()
    expect(await verifierJeton('jeton', { fetchFn: reponse(true), stockage: s, maintenant: 1000 })).toBe(true)
    expect(porteOuverte(s, 1000 + DUREE_MS - 1)).toBe(true)
    expect(porteOuverte(s, 1000 + DUREE_MS + 1)).toBe(false)
    fermerPorte(s)
    expect(porteOuverte(s, 1001)).toBe(false)
  })

  it('reste fermée si la plateforme répond non, refuse ou est injoignable', async () => {
    const s = memoire()
    expect(await verifierJeton('jeton', { fetchFn: reponse(false), stockage: s })).toBe(false)
    expect(await verifierJeton('jeton', { fetchFn: reponse({ message: 'JWT expired' }, false), stockage: s })).toBe(false)
    expect(await verifierJeton('jeton', { fetchFn: async () => { throw new Error('réseau') }, stockage: s })).toBe(false)
    expect(await verifierJeton('', { fetchFn: reponse(true), stockage: s })).toBe(false)
    expect(porteOuverte(s)).toBe(false)
  })

  it('envoie le jeton à la fonction est_super_admin de la plateforme', async () => {
    let appel
    await verifierJeton('abc', { fetchFn: async (url, o) => ((appel = { url, o }), { ok: true, json: async () => true }), stockage: memoire() })
    expect(appel.url).toMatch(/\/rest\/v1\/rpc\/est_super_admin$/)
    expect(appel.o.headers.Authorization).toBe('Bearer abc')
  })

  it('retire le jeton de l’adresse dès sa lecture', () => {
    let remplace
    const hist = { replaceState: (_a, _b, u) => (remplace = u) }
    expect(extraireJeton({ hash: '#porte=a%2Eb', pathname: '/', search: '' }, hist)).toBe('a.b')
    expect(remplace).toBe('/#/')
    expect(extraireJeton({ hash: '#/clients', pathname: '/', search: '' }, hist)).toBe(null)
  })
})
