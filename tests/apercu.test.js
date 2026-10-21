// Aperçu sûr : un build qui n'est pas celui de la production ne doit jamais viser les vraies bases
import { describe, it, expect } from 'vitest'
import { estApercu, plateformeFictive, cspApercu } from '../scripts/apercu.mjs'
import { installerGardeReseau, viseProduction } from '../src/lib/gardeReseau.js'

describe('aperçu de branche', () => {
  it('reconnaît un aperçu Cloudflare et laisse la production telle quelle', () => {
    expect(estApercu({ CF_PAGES: '1', CF_PAGES_BRANCH: 'claude/superadmin-v2-lot-1' })).toBe(true)
    expect(estApercu({ CF_PAGES: '1', CF_PAGES_BRANCH: 'claude/project-thread-j6wx9s' })).toBe(false)
    expect(estApercu({ CF_PAGES: '1', CF_PAGES_BRANCH: 'site' })).toBe(false)
    expect(estApercu({})).toBe(false)
    expect(estApercu({ VITE_PREVISUALISATION: '1' })).toBe(true)
  })
  it('refuse une « plateforme fictive » qui serait une base de production', () => {
    expect(() => plateformeFictive({ VITE_PLATEFORME_FICTIVE: 'https://xrlfedosaqtffraadmgk.supabase.co' })).toThrow()
    expect(plateformeFictive({ VITE_PLATEFORME_FICTIVE: 'http://127.0.0.1:54399' })).toBe('http://127.0.0.1:54399')
  })
  it('la politique de sécurité n’autorise que l’aperçu et la plateforme fictive', () => {
    expect(cspApercu({})).toBe("connect-src 'self' data: blob:")
    expect(cspApercu({ VITE_PLATEFORME_FICTIVE: 'http://127.0.0.1:54399' })).toBe("connect-src 'self' data: blob: http://127.0.0.1:54399")
  })
})

describe('garde-fou réseau du mode démo', () => {
  it('bloque toute requête vers les deux bases de production', async () => {
    const appels = []
    const cible = { fetch: async (u) => appels.push(u) }
    installerGardeReseau(cible)
    await expect(cible.fetch('https://mylgnsuoppplmfaanyze.supabase.co/rest/v1/prospects')).rejects.toThrow(/production/)
    await expect(cible.fetch({ url: 'https://xrlfedosaqtffraadmgk.supabase.co/rest/v1/rpc/renouveler_licence' })).rejects.toThrow(/production/)
    await cible.fetch('http://127.0.0.1:54399/rest/v1/rpc/est_super_admin')
    expect(appels).toEqual(['http://127.0.0.1:54399/rest/v1/rpc/est_super_admin'])
    expect(viseProduction('https://example.test')).toBe(false)
  })
})
