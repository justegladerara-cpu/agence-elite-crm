// Hub « Site web » : audience du site, demandes du formulaire de contact, pages et référencement.
// Les données viennent des tables site_visites / site_demandes (remplies par le site) et de /site/pages.json.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Kpi, Empty, Tabs, useTab, nb, pct, LienProspect, go, useToast, confirmer } from '../ui'
import { useNoyau } from '../core/contexte'
import { HBars, Donut, COULEURS } from '../charts'
import { supabase } from '../lib/store'
import { today, addDays, fmtDate } from '../lib/dates'
import { waLink } from '../lib/logic'

export const ADRESSE_SITE = 'https://crm.agence-elite.fr/site/'
const NOM_PAGE = { '': 'Accueil', '/': 'Accueil' }

// Données d'exemple en mode démo (sans base) : le hub reste lisible
function exemple() {
  const t = today()
  const pages = ['/', '/solutions/', '/solutions/agence-web/', '/boutique/', '/contact/', '/agence/']
  const sources = [null, 'google.com', 'facebook.com', 'instagram.com', 'l.wa.me']
  const visites = []
  for (let i = 0; i < 30; i++) {
    const n = 6 + ((i * 7) % 11)
    for (let k = 0; k < n; k++) visites.push({ jour: addDays(t, -i), page: pages[(i + k) % pages.length], source: sources[(i * k) % sources.length], appareil: k % 3 ? 'mobile' : 'ordinateur' })
  }
  return {
    visites,
    demandes: [
      { id: 'd1', nom: 'Grâce Mabiala', entreprise: 'Boulangerie du Port', tel: '+242 06 000 00 00', email: '', solution: 'Agence web', message: 'Bonjour, je veux un site pour ma boulangerie avec commande en ligne.', canal: 'whatsapp', created_at: `${t}T09:12:00`, traitee: false },
      { id: 'd2', nom: 'Patrick Loemba', entreprise: '', tel: '+242 05 000 00 00', email: 'patrick@example.com', solution: 'Microsoft 365', message: 'Combien pour 5 licences ?', canal: 'email', created_at: `${addDays(t, -2)}T15:40:00`, traitee: true },
    ],
    commandes: [{ created_at: `${addDays(t, -3)}T10:00:00`, total: 77000, demo: false }],
  }
}

export function useSite() {
  const [s, setS] = useState({ visites: [], demandes: [], commandes: [], pages: null, charge: true, erreur: '', exemple: false })
  const charger = useCallback(async () => {
    const pagesP = fetch('/site/pages.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    if (!supabase) {
      const pages = await pagesP
      return setS({ ...exemple(), pages, charge: false, erreur: '', exemple: true })
    }
    const depuis = addDays(today(), -59)
    const [v, d, c, pages] = await Promise.all([
      supabase.from('site_visites').select('jour,page,source,appareil').gte('jour', depuis).limit(50000),
      supabase.from('site_demandes').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('store_commandes').select('created_at,total,demo,statut').gte('created_at', depuis),
      pagesP,
    ])
    const err = v.error || d.error || c.error
    setS({ visites: v.data || [], demandes: d.data || [], commandes: (c.data || []).filter((x) => !x.demo), pages, charge: false, erreur: err ? err.message : '', exemple: false })
  }, [])
  useEffect(() => {
    charger()
  }, [charger])
  return [s, charger, setS]
}

const nomPage = (chemin, pages) => {
  const c = chemin.replace(/^\//, '')
  const p = pages?.pages?.find((x) => x.chemin === c)
  return NOM_PAGE[chemin] || (p ? p.titre.replace(/\s*\|\s*Agence Elite$/, '') : chemin)
}
const compter = (list, cle, def) => Object.entries(list.reduce((m, x) => ((m[x[cle] || def] = (m[x[cle] || def] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])

// Visites par jour sur 30 jours : barres fines, survol = chiffre du jour
function VisitesParJour({ visites }) {
  const t = today()
  const jours = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29))
  const par = visites.reduce((m, v) => ((m[v.jour] = (m[v.jour] || 0) + 1), m), {})
  const max = Math.max(1, ...jours.map((j) => par[j] || 0))
  const [survol, setSurvol] = useState(null)
  return (
    <div className="site-barres" role="img" aria-label={`Visites des 30 derniers jours : ${nb(jours.reduce((m, j) => m + (par[j] || 0), 0))} au total`}>
      <div className="sb-info tiny muted">{survol ? `${fmtDate(survol)} : ${nb(par[survol] || 0)} visite${(par[survol] || 0) > 1 ? 's' : ''}` : 'Survole une barre pour voir le jour'}</div>
      <div className="sb-zone">
        {jours.map((j) => (
          <span key={j} className="sb-col" onMouseEnter={() => setSurvol(j)} onMouseLeave={() => setSurvol(null)} title={`${fmtDate(j)} : ${par[j] || 0}`}>
            <i style={{ height: `${Math.max(2, ((par[j] || 0) / max) * 100)}%` }} className={j === t ? 'auj' : ''} />
          </span>
        ))}
      </div>
      <div className="sb-axe tiny muted">
        <span>{fmtDate(jours[0])}</span>
        <span>Aujourd'hui</span>
      </div>
    </div>
  )
}

function Bandeau({ s }) {
  return (
    <>
      {s.exemple && <div className="banner">Mode démo : chiffres d'exemple. En ligne, les visites et les demandes du vrai site s'affichent ici.</div>}
      {s.erreur && <div className="banner err">Lecture impossible : {s.erreur}</div>}
    </>
  )
}

function Entete({ titre, sous, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{titre}</h1>
        <div className="sub">{sous}</div>
      </div>
      <div className="row">
        {children}
        <a className="btn" href={ADRESSE_SITE} target="_blank" rel="noopener">
          <Icon n="globe" size={15} /> Ouvrir le site
        </a>
      </div>
    </div>
  )
}

// ---------- Vue d'ensemble ----------
export function SiteVue() {
  const [s] = useSite()
  const t = today()
  const st = useMemo(() => {
    const dans = (d, a, b) => d >= a && d <= b
    const v7 = s.visites.filter((v) => dans(v.jour, addDays(t, -6), t))
    const v7p = s.visites.filter((v) => dans(v.jour, addDays(t, -13), addDays(t, -7)))
    const v30 = s.visites.filter((v) => dans(v.jour, addDays(t, -29), t))
    const d30 = s.demandes.filter((d) => (d.created_at || '').slice(0, 10) >= addDays(t, -29))
    const c30 = s.commandes.filter((c) => (c.created_at || '').slice(0, 10) >= addDays(t, -29))
    return { v7, v7p, v30, d30, c30, aTraiter: s.demandes.filter((d) => !d.traitee) }
  }, [s, t])
  const pages = compter(st.v30, 'page', '/').slice(0, 8)
  const sources = compter(st.v30, 'source', 'Accès direct').slice(0, 6)
  const appareils = compter(st.v30, 'appareil', 'Inconnu')
  const conv = st.v30.length ? st.d30.length / st.v30.length : null

  return (
    <div className="stack">
      <Entete titre="Site web" sous="Audience, demandes de contact et boutique du site agence-elite, en un coup d'œil." />
      <Bandeau s={s} />
      <div className="grid grid-4">
        <Kpi label="Visites (7 jours)" value={nb(st.v7.length)} delta={st.v7.length - st.v7p.length} vs="7 j préc." navy />
        <Kpi label="Demandes reçues (30 jours)" value={nb(st.d30.length)} onClick={() => go('/site-demandes')} navy />
        <Kpi label="Demandes à traiter" value={nb(st.aTraiter.length)} onClick={() => go('/site-demandes')} />
        <Kpi label="Visiteurs qui écrivent" value={conv === null ? '—' : pct(conv)} />
      </div>
      <div className="card">
        <h2 className="section">
          <span className="sec-ic"><Icon n="chart" size={16} /></span> Visites des 30 derniers jours
          <span className="count">{nb(st.v30.length)}</span>
        </h2>
        {s.charge ? <div className="muted small">Chargement…</div> : <VisitesParJour visites={st.v30} />}
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="layers" size={16} /></span> Pages les plus vues
          </h2>
          <HBars rows={pages.map(([p, n]) => ({ label: nomPage(p, s.pages), value: n, sub: p }))} color={COULEURS[0]} empty="Aucune visite comptée pour l'instant." />
        </div>
        <div className="stack">
          <div className="card">
            <h2 className="section">
              <span className="sec-ic"><Icon n="share" size={16} /></span> D'où viennent les visiteurs
            </h2>
            <HBars rows={sources.map(([src, n]) => ({ label: src, value: n }))} color={COULEURS[1]} empty="Aucune visite comptée pour l'instant." />
          </div>
          <div className="card">
            <h2 className="section">
              <span className="sec-ic"><Icon n="phone" size={16} /></span> Appareils
            </h2>
            <Donut items={appareils.map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value }))} total="visites" />
          </div>
        </div>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="mail" size={16} /></span> Dernières demandes
            <button className="toggle-link" style={{ marginLeft: 'auto' }} onClick={() => go('/site-demandes')}>
              Tout voir
            </button>
          </h2>
          <ListeDemandes demandes={s.demandes.slice(0, 4)} compact />
        </div>
        <div className="card">
          <h2 className="section">
            <span className="sec-ic"><Icon n="tag" size={16} /></span> Elite Store (30 jours)
          </h2>
          <div className="info-grid">
            <div>
              <div className="k">Commandes</div>
              <div className="v">{nb(st.c30.length)}</div>
            </div>
            <div>
              <div className="k">Montant commandé</div>
              <div className="v">{nb(st.c30.reduce((m, c) => m + (Number(c.total) || 0), 0))} FCFA</div>
            </div>
          </div>
          <button className="btn sm" style={{ marginTop: 12 }} onClick={() => go('/boutique')}>
            <Icon n="tag" size={14} /> Gérer la boutique
          </button>
        </div>
      </div>
      <div className="tiny muted">Visites comptées sans cookie ni adresse IP ; les visiteurs qui refusent le suivi ne sont pas comptés.</div>
    </div>
  )
}

// ---------- Demandes du formulaire de contact ----------
function ListeDemandes({ demandes, compact, onTraitee }) {
  const [ouvert, setOuvert] = useState(null)
  if (!demandes.length) return <Empty>Aucune demande pour l'instant. Celles du formulaire de contact du site arrivent ici et dans tes prospects.</Empty>
  return (
    <ul className="demandes">
      {demandes.map((d) => {
        const reponse = `Bonjour ${d.nom.split(' ')[0]}, merci pour votre message sur le site Agence Elite${d.solution ? ` au sujet de « ${d.solution} »` : ''}. `
        const plein = ouvert === d.id
        return (
          <li key={d.id} className={`demande ${d.traitee ? 'faite' : ''}`}>
            <div className="dm-tete">
              <span className={`dm-pastille ${d.traitee ? '' : 'nouv'}`} aria-hidden="true" />
              <div className="li-main">
                <div className="li-title" title={d.entreprise || d.nom}>
                  {d.prospect_id ? <LienProspect id={d.prospect_id}>{d.entreprise || d.nom}</LienProspect> : d.entreprise || d.nom}
                </div>
                <div className="li-sub">{[fmtDate((d.created_at || '').slice(0, 10)), (d.created_at || '').slice(11, 16), d.entreprise && d.nom, d.solution].filter(Boolean).join(' · ')}</div>
              </div>
              {!d.traitee && <span className="badge b-orange">À traiter</span>}
            </div>
            <button type="button" className={`dm-message ${plein ? 'plein' : ''}`} onClick={() => setOuvert(plein ? null : d.id)} aria-expanded={plein}>
              {d.message}
            </button>
            {!compact && (
              <div className="dm-actions">
                <a className="btn sm wa" href={`${waLink(d.tel, '242')}?text=${encodeURIComponent(reponse)}`} target="_blank" rel="noopener">
                  <Icon n="message" size={14} /> Répondre sur WhatsApp
                </a>
                {d.email && (
                  <a className="btn sm" href={`mailto:${d.email}?subject=${encodeURIComponent('Votre demande sur agence-elite')}&body=${encodeURIComponent(reponse)}`}>
                    <Icon n="mail" size={14} /> E-mail
                  </a>
                )}
                <a className="btn sm" href={`tel:${d.tel.replace(/\s/g, '')}`}>
                  <Icon n="phone" size={14} /> Appeler
                </a>
                {onTraitee && (
                  <button type="button" className="btn sm" onClick={() => onTraitee(d)}>
                    <Icon n={d.traitee ? 'rotate' : 'check'} size={14} /> {d.traitee ? 'Remettre à traiter' : 'Marquer traitée'}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function SiteDemandes({ onglet: demande }) {
  const [s, , setS] = useSite()
  const { toast } = useNoyau()
  const [onglet, setOnglet] = useTab('site-demandes', 'atraiter', demande)
  const liste = s.demandes.filter((d) => (onglet === 'atraiter' ? !d.traitee : onglet === 'traitees' ? d.traitee : true))
  const basculer = async (d) => {
    const traitee = !d.traitee
    setS((x) => ({ ...x, demandes: x.demandes.map((y) => (y.id === d.id ? { ...y, traitee } : y)) }))
    if (!supabase) return
    const { error } = await supabase.from('site_demandes').update({ traitee }).eq('id', d.id)
    if (error) {
      setS((x) => ({ ...x, demandes: x.demandes.map((y) => (y.id === d.id ? { ...y, traitee: d.traitee } : y)) }))
      toast("La demande n'a pas pu être mise à jour", true)
    }
  }
  const nbA = s.demandes.filter((d) => !d.traitee).length
  return (
    <div className="stack">
      <Entete titre="Demandes du site" sous="Chaque message du formulaire de contact : il crée aussi la fiche du prospect dans le CRM." />
      <Bandeau s={s} />
      <Tabs
        items={[
          ['atraiter', 'À traiter', nbA],
          ['traitees', 'Traitées', s.demandes.length - nbA],
          ['toutes', 'Toutes', s.demandes.length],
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      <div className="card">{s.charge ? <div className="muted small">Chargement…</div> : <ListeDemandes demandes={liste} onTraitee={basculer} />}</div>
    </div>
  )
}

// ---------- Pages du site et référencement ----------
const controleSeo = (p) => {
  const t = p.titre.length
  const d = p.description.length
  const pbs = []
  if (t < 30) pbs.push('titre court')
  if (t > 65) pbs.push('titre long')
  if (!d) pbs.push('pas de description')
  else if (d < 70) pbs.push('description courte')
  else if (d > 160) pbs.push('description longue')
  return pbs
}

export function SitePages() {
  const [s] = useSite()
  const vues = useMemo(() => compter(s.visites.filter((v) => v.jour >= addDays(today(), -29)), 'page', '/'), [s.visites])
  const nbVues = (chemin) => vues.find(([p]) => p.replace(/^\//, '') === chemin)?.[1] || 0
  const pages = s.pages?.pages || []
  const aRevoir = pages.filter((p) => p.indexee && controleSeo(p).length).length
  return (
    <div className="stack">
      <Entete titre="Pages du site" sous="Toutes les pages, leurs visites sur 30 jours et leur présentation dans Google." />
      <Bandeau s={s} />
      <div className="grid grid-4">
        <Kpi label="Pages publiées" value={nb(pages.length)} navy />
        <Kpi label="Visibles dans Google" value={nb(pages.filter((p) => p.indexee).length)} />
        <Kpi label="À améliorer pour Google" value={nb(aRevoir)} />
        <Kpi label="Dernière mise à jour" value={s.pages?.genere ? fmtDate(s.pages.genere.slice(0, 10)) : '—'} />
      </div>
      <div className="card flush">
        {!s.pages && !s.charge ? (
          <Empty>La liste des pages n'est pas disponible (elle est créée à chaque publication du site).</Empty>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Pages du site">
            <table className="t">
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="hide-sm">Aperçu Google</th>
                  <th className="num">Visites</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const pbs = p.indexee ? controleSeo(p) : []
                  return (
                    <tr key={p.chemin}>
                      <td className="cell-nom">
                        <a className="rlink" href={`${ADRESSE_SITE}${p.chemin}`} target="_blank" rel="noopener" title={p.titre}>
                          {nomPage(`/${p.chemin}`, s.pages)}
                        </a>
                        <div className="tiny muted">/{p.chemin}</div>
                      </td>
                      <td className="hide-sm seo-apercu">
                        <div className="seo-t">{p.titre}</div>
                        <div className="seo-d">{p.description || '—'}</div>
                      </td>
                      <td className="num">{nb(nbVues(p.chemin))}</td>
                      <td>
                        {!p.indexee ? (
                          <span className="badge">Masquée</span>
                        ) : pbs.length ? (
                          <span className="badge b-orange" title={pbs.join(', ')}>
                            {pbs[0]}
                          </span>
                        ) : (
                          <span className="badge b-green">Bon</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="tiny muted">Google affiche environ 60 caractères de titre et 155 de description : au-delà, le texte est coupé.</div>
    </div>
  )
}

// Photos du site : chaque emplacement (site/data.mjs) peut recevoir une autre photo, envoyée depuis l'appareil ou par
// un lien. La table site_photos garde le remplacement ; le site la lit au chargement (assets/site.js).
const GROUPES_PHOTOS = ['Accueil', 'Solutions', 'Secteurs', "L'agence", 'Toutes les pages']
const TYPES_PHOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const PREFIXE_STOCKAGE = '/storage/v1/object/public/site-photos/'
const messagePhoto = (e) => {
  const m = String(e?.message || e || '')
  if (/row-level security|permission|not authorized|unauthorized|403|42501/i.test(m)) return 'Seul le compte propriétaire du site peut changer les photos.'
  if (/exceeded|too large|maximum allowed size|413/i.test(m)) return 'Photo trop lourde : 5 Mo au plus.'
  if (/mime|type/i.test(m)) return 'Format refusé : JPEG, PNG ou WebP seulement.'
  if (/fetch|network/i.test(m)) return 'Pas de connexion : réessayez dans un instant.'
  return m || 'Erreur inconnue.'
}

export function SitePhotos() {
  const [show, toast] = useToast()
  const [emplacements, setEmplacements] = useState(null)
  const [lignes, setLignes] = useState({})
  const [etat, setEtat] = useState({ charge: true, erreur: '' })
  const [occupe, setOccupe] = useState('')
  const [lien, setLien] = useState({})
  const [textes, setTextes] = useState({})

  const charger = useCallback(async () => {
    const donnees = await import('../../site/data.mjs')
    setEmplacements(donnees.EMPLACEMENTS_PHOTOS.map((e) => ({ ...e, origine: donnees.photoUnsplash(e.id, 600) })))
    if (!supabase) return setEtat({ charge: false, erreur: '' })
    const { data, error } = await supabase.from('site_photos').select('*')
    setLignes(Object.fromEntries((data || []).map((l) => [l.cle, l])))
    setEtat({ charge: false, erreur: error ? messagePhoto(error) : '' })
  }, [])
  useEffect(() => {
    charger().catch((e) => setEtat({ charge: false, erreur: messagePhoto(e) }))
  }, [charger])

  const enregistrer = async (cle, url, alt) => {
    const { error } = await supabase.from('site_photos').upsert({ cle, url, alt: alt || null, modifie_le: new Date().toISOString() }, { onConflict: 'user_id,cle' })
    if (error) throw error
  }
  const retirerFichier = async (url) => {
    const i = url ? url.indexOf(PREFIXE_STOCKAGE) : -1
    if (i >= 0) await supabase.storage.from('site-photos').remove([decodeURIComponent(url.slice(i + PREFIXE_STOCKAGE.length))])
  }
  const action = async (cle, fn, ok) => {
    if (!supabase) return show('Mode démo : les photos ne peuvent pas être changées ici.', true)
    setOccupe(cle)
    try {
      await fn()
      show(ok)
      await charger()
    } catch (e) {
      show(messagePhoto(e), true)
    } finally {
      setOccupe('')
    }
  }

  const envoyerFichier = (e, fichier) =>
    action(
      e.cle,
      async () => {
        const ext = TYPES_PHOTO[fichier.type]
        if (!ext) throw new Error('mime')
        if (fichier.size > 5 * 1024 * 1024) throw new Error('too large')
        const moi = (await supabase.auth.getSession()).data?.session?.user?.id
        if (!moi) throw new Error('not authorized')
        const chemin = `${moi}/${e.cle}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('site-photos').upload(chemin, fichier, { upsert: true, contentType: fichier.type })
        if (error) throw error
        const url = supabase.storage.from('site-photos').getPublicUrl(chemin).data.publicUrl
        const avant = lignes[e.cle]?.url
        await enregistrer(e.cle, url, textes[e.cle] ?? lignes[e.cle]?.alt)
        if (avant && avant !== url) await retirerFichier(avant).catch(() => {})
      },
      'Photo changée ✓',
    )
  const collerLien = (e) =>
    action(
      e.cle,
      async () => {
        const url = String(lien[e.cle] || '').trim()
        if (!/^https:\/\/\S+$/.test(url) || url.length > 600) throw new Error('Le lien doit commencer par https://')
        const avant = lignes[e.cle]?.url
        await enregistrer(e.cle, url, textes[e.cle] ?? lignes[e.cle]?.alt)
        if (avant && avant !== url) await retirerFichier(avant).catch(() => {})
        setLien((l) => ({ ...l, [e.cle]: undefined }))
      },
      'Photo changée ✓',
    )
  const enregistrerTexte = (e) =>
    action(e.cle, () => enregistrer(e.cle, lignes[e.cle].url, String(textes[e.cle] || '').trim().slice(0, 200)), 'Texte enregistré ✓')
  const retablir = async (e) => {
    if (!(await confirmer(`Remettre la photo d'origine pour « ${e.nom} » ?`, { ok: 'Rétablir' }))) return
    action(
      e.cle,
      async () => {
        const avant = lignes[e.cle]?.url
        const { error } = await supabase.from('site_photos').delete().eq('cle', e.cle)
        if (error) throw error
        await retirerFichier(avant).catch(() => {})
      },
      "Photo d'origine rétablie ✓",
    )
  }

  const modifiees = Object.keys(lignes).length
  return (
    <div className="stack">
      <Entete titre="Photos du site" sous="Changez les photos du site vitrine : envoyez une image (5 Mo au plus) ou collez un lien. Le site se met à jour tout seul." />
      {!supabase && <div className="banner">Mode démo : photos d'origine du site. En ligne, vos photos s'enregistrent ici.</div>}
      {etat.erreur && <div className="banner err">{etat.erreur}</div>}
      <div className="grid grid-4">
        <Kpi label="Emplacements" value={nb(emplacements?.length || 0)} navy />
        <Kpi label="Photos modifiées" value={nb(modifiees)} />
      </div>
      {!emplacements ? (
        <Empty>Chargement des photos…</Empty>
      ) : (
        GROUPES_PHOTOS.map((g) => {
          const liste = emplacements.filter((e) => e.page === g)
          if (!liste.length) return null
          return (
            <section key={g} className="stack">
              <h2 className="photos-titre">{g}</h2>
              <div className="grid grid-3">
                {liste.map((e) => {
                  const l = lignes[e.cle]
                  const actif = occupe === e.cle
                  return (
                    <div key={e.cle} className="card photo-carte">
                      <img src={l?.url || e.origine} alt={l?.alt || e.alt} loading="lazy" className="photo-apercu" />
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <strong>{e.nom}</strong>
                        <span className={`badge ${l ? 'b-green' : ''}`}>{l ? 'Modifiée' : "D'origine"}</span>
                      </div>
                      <div className="row">
                        <label className={`btn primary ${actif ? 'disabled' : ''}`}>
                          <Icon n="upload" size={15} /> Changer la photo
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            disabled={actif}
                            aria-label={`Changer la photo : ${e.nom}`}
                            onChange={(ev) => {
                              const f = ev.target.files?.[0]
                              ev.target.value = ''
                              if (f) envoyerFichier(e, f)
                            }}
                          />
                        </label>
                        <button type="button" className="btn" disabled={actif} onClick={() => setLien((x) => ({ ...x, [e.cle]: x[e.cle] === undefined ? '' : undefined }))}>
                          <Icon n="copy" size={15} /> Coller un lien
                        </button>
                        {l && (
                          <button type="button" className="btn" disabled={actif} onClick={() => retablir(e)}>
                            <Icon n="rotate" size={15} /> Rétablir l'originale
                          </button>
                        )}
                      </div>
                      {lien[e.cle] !== undefined && (
                        <div className="row">
                          <input type="url" placeholder="https://…" value={lien[e.cle]} aria-label={`Lien de la photo : ${e.nom}`} onChange={(ev) => setLien((x) => ({ ...x, [e.cle]: ev.target.value }))} />
                          <button type="button" className="btn primary" disabled={actif} onClick={() => collerLien(e)}>
                            Enregistrer
                          </button>
                        </div>
                      )}
                      <label className="tiny muted">
                        Texte de la photo (facultatif, lu par Google et les lecteurs d'écran)
                        <div className="row">
                          <input
                            maxLength={200}
                            placeholder={e.alt}
                            value={textes[e.cle] ?? l?.alt ?? ''}
                            onChange={(ev) => setTextes((x) => ({ ...x, [e.cle]: ev.target.value }))}
                          />
                          {l && textes[e.cle] !== undefined && textes[e.cle] !== (l.alt || '') && (
                            <button type="button" className="btn" disabled={actif} onClick={() => enregistrerTexte(e)}>
                              Enregistrer
                            </button>
                          )}
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
      {toast}
    </div>
  )
}
