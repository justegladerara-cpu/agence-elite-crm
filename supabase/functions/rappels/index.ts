// Rappels sur le téléphone : clé publique, notification de test, envoi des rappels arrivés à échéance (toutes les 5 min).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

// Clés du service de notifications : créées une seule fois, gardées côté serveur
async function config() {
  const { data } = await db.from('push_config').select('*').eq('id', 1).single()
  if (data?.vapid_public && data?.vapid_private) return data
  const k = webpush.generateVAPIDKeys()
  const { data: saved } = await db.from('push_config').update({ vapid_public: k.publicKey, vapid_private: k.privateKey }).eq('id', 1).select().single()
  return saved
}

async function envoyer(subs: any[], payload: object, cfg: any) {
  webpush.setVapidDetails('mailto:contact@agence-elite.fr', cfg.vapid_public, cfg.vapid_private)
  let ok = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600 })
      ok++
    } catch (e: any) {
      // Appareil désabonné : on l'oublie
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push', e?.statusCode, e?.body || e?.message)
    }
  }
  return ok
}

async function utilisateur(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data?.user || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { action } = await req.json().catch(() => ({}))
  const cfg = await config()

  if (action === 'envoyer') {
    if (req.headers.get('x-cron') !== cfg.cron_secret) return json({ error: 'interdit' }, 403)
    const maintenant = new Date()
    const { data: dus } = await db
      .from('rappels')
      .select('*')
      .eq('envoye', false)
      .lte('quand', maintenant.toISOString())
      .gte('quand', new Date(maintenant.getTime() - 6 * 3600e3).toISOString())
      .limit(200)
    let n = 0
    for (const r of dus || []) {
      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', r.user_id)
      if (subs?.length) n += await envoyer(subs, { title: r.titre, body: r.corps || '', url: r.url || '/', tag: r.cle }, cfg)
      await db.from('rappels').update({ envoye: true }).eq('id', r.id)
    }
    // Ménage : rappels de plus de 30 jours
    await db.from('rappels').delete().lt('quand', new Date(maintenant.getTime() - 30 * 86400e3).toISOString())
    return json({ envoyes: n, rappels: dus?.length || 0 })
  }

  const user = await utilisateur(req)
  if (!user) return json({ error: 'non connecté' }, 401)
  if (action === 'cle') return json({ cle: cfg.vapid_public })
  if (action === 'test') {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', user.id)
    const n = await envoyer(subs || [], { title: 'Agence Elite CRM', body: 'Les rappels fonctionnent sur cet appareil ✓', url: '/#/journee', tag: 'test' }, cfg)
    return json({ envoyes: n, appareils: subs?.length || 0 })
  }
  return json({ error: 'action inconnue' }, 400)
})
