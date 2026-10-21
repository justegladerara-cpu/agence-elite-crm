// Documents : papier à en-tête, contrats, modèles et textes légaux d'Agence Elite, modifiables et imprimables.
// Les modèles d'origine sont livrés avec l'application (public/documents/modeles.json) ; une modification est
// enregistrée dans la table modeles_documents de l'espace (même clé) et peut être annulée (« Rétablir l'original »).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Empty, Tabs, useToast, confirmer, nb } from '../ui'
import { supabase, espaceActif } from '../lib/store'
import { champsDe, markdownEnHtml } from '../lib/markdown'

const BASE = `${import.meta.env.BASE_URL || '/'}documents/`
const TYPES = { contrat: ['Contrat', 'b-navy'], modele: ['Modèle', 'b-gold'], texte: ['Texte', 'b-green'] }
const SOCIETE = 'infos-societe'
// Informations légales de la société, utilisées dans tous les documents
const CHAMPS_SOCIETE = [
  ['AE_SOCIETE', 'Société (raison sociale)', 'Ex. : GROUPE 7M SERVICES'],
  ['AE_FORME', 'Forme juridique', 'Ex. : SARL, SARLU, SA, entreprise individuelle'],
  ['AE_CAPITAL', 'Capital social', 'Ex. : 1 000 000 FCFA'],
  ['AE_RCCM', 'Numéro RCCM', 'Ex. : CG-PNR-01-2024-B12-00000'],
  ['AE_NIU', 'NIU', 'Numéro d’identification unique'],
  ['AE_SIEGE', 'Siège social', 'Adresse du siège'],
  ['AE_REPRESENTANT', 'Représentant légal', 'Nom et prénom'],
  ['AE_FONCTION', 'Fonction du représentant', 'Ex. : Gérant'],
  ['AE_BANQUE', 'Banque et Mobile Money', 'Banque, RIB, numéro Mobile Money'],
]
// Informations officielles (dossier d'entreprise GROUPE 7M SERVICES) ; « Infos société » peut les remplacer
const SOCIETE_DEFAUT = {
  AE_SOCIETE: 'GROUPE 7M SERVICES',
  AE_FORME: 'SARL',
  AE_CAPITAL: '1 000 000 FCFA',
  AE_RCCM: 'CG-PNR-01-2016-B12-00884',
  AE_NIU: 'M2016110000159132',
  AE_SIEGE: 'avenue Marien Ngouabi, KM4, Immeuble Le Kangourou, Pointe-Noire, République du Congo',
  AE_REPRESENTANT: 'M. KIBELO-MAZONGA Guy Blaise',
  AE_FONCTION: 'Gérant',
}
const LIBELLES_SOCIETE = Object.fromEntries(CHAMPS_SOCIETE.map(([k, l]) => [k, `à compléter : ${l.toLowerCase()}`]))
const cleLibre = (titre) =>
  `perso-${String(titre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)}-${Date.now().toString(36)}`

// Fenêtre d'impression avec l'en-tête Agence Elite : « Enregistrer au format PDF » dans la boîte d'impression
function imprimer(doc, html) {
  const w = window.open('', '_blank')
  if (!w) return false
  const logo = `${location.origin}${BASE}logo-agence-elite.png`
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${doc.titre.replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 16mm 16mm 20mm; }
body { font-family: Inter, Arial, sans-serif; color: #1c1c1f; font-size: 10.5pt; line-height: 1.55; margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #fb0000; padding-bottom: 10px; margin-bottom: 18px; }
.entete img { height: 34px; } .entete .c { text-align: right; font-size: 8pt; color: #555; line-height: 1.4; }
.cat { color: #d90000; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; }
h1 { font-family: Montserrat, Arial, sans-serif; font-size: 19pt; margin: 4px 0; color: #0b0b0c; }
.ref { color: #6b6b73; font-size: 8pt; margin-bottom: 14px; }
h2 { font-family: Montserrat, Arial, sans-serif; font-size: 12.5pt; color: #0b0b0c; margin: 18px 0 6px; break-after: avoid; }
h2::before { content: ''; display: inline-block; width: 7px; height: 7px; background: #fb0000; margin-right: 8px; vertical-align: middle; }
h3 { font-size: 11pt; margin: 12px 0 4px; break-after: avoid; } p { margin: 6px 0; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; break-inside: avoid; }
th { background: #0b0b0c; color: #fff; text-align: left; padding: 6px 8px; } td { border-bottom: 1px solid #e5e5e8; padding: 6px 8px; vertical-align: top; }
.md-champ { background: #fff3b0; border-bottom: 1px dashed #c9a400; padding: 0 3px; } .md-rempli { font-weight: 600; }
blockquote { border-left: 3px solid #fb0000; background: #f7f7f8; margin: 8px 0; padding: 4px 12px; }
.pied { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7.5pt; color: #777; text-align: center; border-top: 1px solid #e5e5e8; padding-top: 4px; }
@media screen { body { max-width: 800px; margin: 24px auto; padding: 0 24px 60px; } .pied { position: static; margin-top: 30px; } }
</style></head><body>
<div class="entete"><img src="${logo}" alt="Agence Elite"><div class="c">www.agence-elite.fr<br>contact@agence-elite.fr<br>+242 05 522 29 68</div></div>
${doc.type === 'modele' && /papier|lettre/i.test(doc.titre) ? '' : `<div class="cat">${doc.categorie}</div><h1>${doc.titre.replace(/</g, '&lt;')}</h1><div class="ref">${doc.reference ? `Réf. ${doc.reference} · ` : ''}Agence Elite</div>`}
${html}
<div class="pied">Agence Elite · 10 avenue Stéphane Tchitchelle, Centre-ville, BP 761, Pointe-Noire, République du Congo · +242 05 522 29 68 · contact@agence-elite.fr</div>
<script>window.onload = () => setTimeout(() => window.print(), 400)</script></body></html>`)
  w.document.close()
  return true
}

export default function Documents() {
  const [show, toast] = useToast()
  const [origines, setOrigines] = useState(null)
  const [lignes, setLignes] = useState({})
  const [erreur, setErreur] = useState('')
  const [recherche, setRecherche] = useState('')
  const [categorie, setCategorie] = useState('')
  const [ouvert, setOuvert] = useState(null)
  const [societeOuverte, setSocieteOuverte] = useState(false)

  const charger = useCallback(async () => {
    const r = await fetch(`${BASE}modeles.json`)
    if (!r.ok) throw new Error('Les modèles n’ont pas pu être chargés.')
    setOrigines(await r.json())
    if (!supabase) return
    const w = await espaceActif()
    let q = supabase.from('modeles_documents').select('*')
    if (w) q = q.eq('workspace_id', w)
    const { data, error } = await q
    if (error) setErreur('La base des documents n’est pas encore prête : les modèles d’origine sont affichés, sans enregistrement.')
    setLignes(Object.fromEntries((data || []).map((l) => [l.cle, l])))
  }, [])
  useEffect(() => {
    charger().catch((e) => setErreur(e.message))
  }, [charger])

  const societe = useMemo(() => {
    try {
      return { ...SOCIETE_DEFAUT, ...JSON.parse(lignes[SOCIETE]?.contenu || '{}') }
    } catch {
      return SOCIETE_DEFAUT
    }
  }, [lignes])

  // Liste affichée : modèles d'origine (remplacés par leur version modifiée) puis modèles créés dans l'espace
  const documents = useMemo(() => {
    if (!origines) return []
    const base = origines
      .map((o) => {
        const l = lignes[o.cle]
        return l ? { ...o, titre: l.titre, contenu: l.contenu, modifie: true, supprime: l.supprime, modifie_le: l.modifie_le } : o
      })
      .filter((d) => !d.supprime)
    const perso = Object.values(lignes)
      .filter((l) => l.cle.startsWith('perso-') && !l.supprime)
      .map((l) => ({ cle: l.cle, titre: l.titre, categorie: l.categorie, reference: l.reference, type: l.type, contenu: l.contenu, perso: true, modifie_le: l.modifie_le }))
    return [...base, ...perso]
  }, [origines, lignes])

  const categories = useMemo(() => [...new Set(documents.map((d) => d.categorie))], [documents])
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return documents.filter((d) => (!categorie || d.categorie === categorie) && (!q || `${d.titre} ${d.reference || ''} ${d.categorie}`.toLowerCase().includes(q)))
  }, [documents, categorie, recherche])

  const enregistrer = async (ligne) => {
    if (!supabase || erreur) {
      show('Mode démo : la modification n’est pas enregistrée.', true)
      return false
    }
    const w = await espaceActif()
    const { error } = await supabase
      .from('modeles_documents')
      .upsert({ ...ligne, ...(w ? { workspace_id: w } : {}), modifie_le: new Date().toISOString() }, { onConflict: 'workspace_id,cle' })
    if (error) {
      show(/permission|policy|row-level/i.test(error.message) ? 'Votre rôle ne permet pas de modifier les documents.' : 'Enregistrement impossible. Réessayez.', true)
      return false
    }
    await charger()
    return true
  }
  const retablir = async (d) => {
    if (!(await confirmer(`Remettre la version d'origine de « ${d.titre} » ? Vos modifications seront perdues.`, { ok: 'Rétablir' }))) return
    const w = await espaceActif()
    let q = supabase.from('modeles_documents').delete().eq('cle', d.cle)
    if (w) q = q.eq('workspace_id', w)
    const { error } = await q
    if (error) return show('Seul un administrateur de l’espace peut rétablir un document.', true)
    show('Version d’origine rétablie ✓')
    setOuvert(null)
    charger()
  }
  const nouveau = async (depuis) => {
    const titre = depuis ? `${depuis.titre} (copie)` : 'Nouveau modèle'
    const ligne = {
      cle: cleLibre(titre),
      titre,
      categorie: 'Mes modèles',
      reference: null,
      type: depuis?.type || 'modele',
      contenu: depuis?.contenu || '## Objet\n\nÉcrivez votre texte ici. Ajoutez des champs à remplir entre doubles accolades, par exemple {{Nom du client}}.\n',
    }
    if (await enregistrer(ligne)) {
      show(depuis ? 'Copie créée dans « Mes modèles » ✓' : 'Modèle créé ✓')
      setOuvert({ ...ligne, perso: true, onglet: 'modifier' })
    }
  }

  if (ouvert) {
    const doc = documents.find((d) => d.cle === ouvert.cle) || ouvert
    return (
      <Editeur
        key={doc.cle}
        doc={doc}
        ongletInitial={ouvert.onglet}
        societe={societe}
        demo={!supabase || !!erreur}
        onRetour={() => setOuvert(null)}
        onEnregistrer={(contenu, titre) =>
          enregistrer({ cle: doc.cle, titre: titre || doc.titre, categorie: doc.categorie, reference: doc.reference || null, type: doc.type, contenu })
        }
        onRetablir={() => retablir(doc)}
        onDupliquer={() => nouveau(doc)}
        onSupprimer={async () => {
          if (!(await confirmer(`Supprimer « ${doc.titre} » de la liste ?`, { ok: 'Supprimer', danger: true }))) return
          if (await enregistrer({ cle: doc.cle, titre: doc.titre, categorie: doc.categorie, reference: doc.reference || null, type: doc.type, contenu: doc.contenu, supprime: true })) {
            show('Document retiré de la liste ✓')
            setOuvert(null)
          }
        }}
        show={show}
        toast={toast}
      />
    )
  }

  const nbSociete = CHAMPS_SOCIETE.filter(([k]) => societe[k]).length
  return (
    <div className="stack docs">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <div className="sub">Papier à en-tête, contrats, devis, documents RH et textes légaux. Remplissez, modifiez, imprimez ou enregistrez en PDF.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setSocieteOuverte((x) => !x)}>
            <Icon n="settings" size={15} /> Infos société {nbSociete}/{CHAMPS_SOCIETE.length}
          </button>
          <button className="btn primary" onClick={() => nouveau(null)}>
            <Icon n="plus" size={15} /> Nouveau modèle
          </button>
        </div>
      </div>
      {!supabase && <div className="banner">Mode démo : les modèles s’affichent, les modifications ne sont pas enregistrées.</div>}
      {erreur && <div className="banner err">{erreur}</div>}
      {nbSociete < CHAMPS_SOCIETE.length && !societeOuverte && (
        <div className="banner">
          Complétez les infos de la société (RCCM, NIU, représentant…) : elles s’insèrent automatiquement dans tous les contrats.{' '}
          <button className="linkish" onClick={() => setSocieteOuverte(true)}>
            Compléter
          </button>
        </div>
      )}
      {societeOuverte && (
        <InfosSociete
          valeurs={societe}
          onFermer={() => setSocieteOuverte(false)}
          onEnregistrer={async (v) => {
            if (await enregistrer({ cle: SOCIETE, titre: 'Informations de la société', categorie: 'Réglages', type: 'texte', contenu: JSON.stringify(v) })) {
              show('Infos société enregistrées ✓')
              setSocieteOuverte(false)
            }
          }}
        />
      )}
      <div className="docs-outils">
        <label className="docs-recherche">
          <Icon n="search" size={16} />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un document, une référence…" aria-label="Rechercher un document" />
        </label>
        <div className="chips">
          <button className={`chip ${!categorie ? 'on' : ''}`} onClick={() => setCategorie('')}>
            Tous <span className="chip-n">{documents.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c} className={`chip ${categorie === c ? 'on' : ''}`} onClick={() => setCategorie(c)}>
              {c} <span className="chip-n">{documents.filter((d) => d.categorie === c).length}</span>
            </button>
          ))}
        </div>
      </div>
      {!origines ? (
        <Empty>Chargement des documents…</Empty>
      ) : filtres.length === 0 ? (
        <Empty>Aucun document ne correspond.</Empty>
      ) : (
        (categorie ? [categorie] : categories).map((c) => {
          const liste = filtres.filter((d) => d.categorie === c)
          if (!liste.length) return null
          return (
            <section key={c} className="stack">
              <h2 className="docs-titre">
                <Icon n="folder" size={16} /> {c} <span className="muted small">{nb(liste.length)}</span>
              </h2>
              <div className="docs-grille">
                {liste.map((d) => (
                  <button key={d.cle} className="card docs-carte" onClick={() => setOuvert({ cle: d.cle })}>
                    <div className="docs-ic">
                      <Icon n={d.type === 'contrat' ? 'handshake' : d.type === 'texte' ? 'file' : 'clipboard'} size={18} />
                    </div>
                    <div className="docs-txt">
                      <div className="docs-nom">{d.titre}</div>
                      <div className="tiny muted">
                        {d.reference || 'Modèle personnel'} · {champsDe(d.contenu).length} champ(s)
                      </div>
                    </div>
                    <div className="docs-badges">
                      <span className={`badge ${TYPES[d.type]?.[1] || ''}`}>{TYPES[d.type]?.[0] || d.type}</span>
                      {d.modifie && <span className="badge b-orange">Modifié</span>}
                      {d.en_ligne && <span className="badge">En ligne</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )
        })
      )}
      {toast}
    </div>
  )
}

function InfosSociete({ valeurs, onEnregistrer, onFermer }) {
  const [v, setV] = useState(valeurs)
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Informations légales de la société</strong>
        <button className="btn sm" onClick={onFermer} aria-label="Fermer">
          <Icon n="x" size={14} />
        </button>
      </div>
      <div className="form-grid docs-form">
        {CHAMPS_SOCIETE.map(([k, l, aide]) => (
          <label key={k} className="field">
            <span className="form-label">{l}</span>
            <input value={v[k] || ''} placeholder={aide} onChange={(e) => setV({ ...v, [k]: e.target.value.slice(0, 200) })} />
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => onEnregistrer(v)}>
          <Icon n="save" size={15} /> Enregistrer
        </button>
      </div>
    </div>
  )
}

function Editeur({ doc, ongletInitial, societe, demo, onRetour, onEnregistrer, onRetablir, onDupliquer, onSupprimer, show }) {
  const [onglet, setOnglet] = useState(ongletInitial || (doc.type === 'texte' ? 'lire' : 'remplir'))
  const [valeurs, setValeurs] = useState({})
  const [texte, setTexte] = useState(doc.contenu)
  const [titre, setTitre] = useState(doc.titre)
  const [occupe, setOccupe] = useState(false)
  const champs = useMemo(() => champsDe(texte).filter((c) => !c.startsWith('AE_')), [texte])
  const toutes = { ...societe, ...valeurs }
  const html = useMemo(() => markdownEnHtml(texte, toutes, LIBELLES_SOCIETE), [texte, valeurs, societe]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = texte !== doc.contenu || titre !== doc.titre
  const remplis = champs.filter((c) => String(valeurs[c] || '').trim()).length

  const sauver = async () => {
    setOccupe(true)
    const ok = await onEnregistrer(texte, titre.trim() || doc.titre)
    setOccupe(false)
    if (ok) show('Document enregistré ✓')
  }
  const pdf = () => {
    if (!imprimer({ ...doc, titre }, html)) show('Autorisez les fenêtres pour imprimer le document.', true)
  }
  const copier = async () => {
    try {
      const div = document.createElement('div')
      div.innerHTML = html
      await navigator.clipboard.writeText(div.innerText)
      show('Texte copié ✓')
    } catch {
      show('Copie impossible sur cet appareil.', true)
    }
  }

  return (
    <div className="stack docs">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <button className="linkish small" onClick={onRetour}>
            ← Tous les documents
          </button>
          <h1>{titre}</h1>
          <div className="sub">
            {doc.reference ? `${doc.reference} · ` : ''}
            {doc.categorie}
            {doc.modifie && ' · modifié'}
          </div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={pdf}>
            <Icon n="download" size={15} /> Imprimer / PDF
          </button>
          <button className="btn" onClick={copier}>
            <Icon n="copy" size={15} /> Copier
          </button>
          {doc.pdf && (
            <a className="btn" href={`${BASE}${doc.pdf}`} target="_blank" rel="noopener">
              <Icon n="file" size={15} /> PDF d’origine
            </a>
          )}
        </div>
      </div>
      <Tabs
        items={[
          ...(champs.length ? [['remplir', 'Remplir', `${remplis}/${champs.length}`]] : []),
          ['lire', 'Aperçu'],
          ['modifier', 'Modifier le modèle'],
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      {onglet === 'remplir' && champs.length > 0 && (
        <div className="docs-double">
          <div className="card stack docs-champs">
            <div className="small muted">Remplissez les champs : l’aperçu se met à jour. Rien n’est enregistré, imprimez ou enregistrez en PDF une fois terminé.</div>
            {champs.map((c) => (
              <label key={c} className="field">
                <span className="form-label">{c}</span>
                {/adresse|description|objet|liste|missions|détail|motif|ordre du jour|décisions/i.test(c) ? (
                  <textarea rows={2} value={valeurs[c] || ''} onChange={(e) => setValeurs({ ...valeurs, [c]: e.target.value })} />
                ) : (
                  <input value={valeurs[c] || ''} onChange={(e) => setValeurs({ ...valeurs, [c]: e.target.value })} />
                )}
              </label>
            ))}
            {remplis > 0 && (
              <button className="btn sm" onClick={() => setValeurs({})}>
                <Icon n="rotate" size={14} /> Vider les champs
              </button>
            )}
          </div>
          <div className="card docs-apercu" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
      {onglet === 'lire' && <div className="card docs-apercu docs-apercu-seul" dangerouslySetInnerHTML={{ __html: html }} />}
      {onglet === 'modifier' && (
        <div className="stack">
          <div className="card stack">
            <label className="field">
              <span className="form-label">Titre du document</span>
              <input value={titre} maxLength={200} onChange={(e) => setTitre(e.target.value)} />
            </label>
            <div className="tiny muted">
              Mise en forme : <code>## Titre</code>, <code>**gras**</code>, <code>- liste</code>, tableaux avec <code>|</code>. Champ à remplir : <code>{'{{Nom du champ}}'}</code>.
            </div>
          </div>
          <div className="docs-double">
            <textarea className="docs-source" value={texte} onChange={(e) => setTexte(e.target.value)} aria-label="Texte du modèle" spellCheck />
            <div className="card docs-apercu" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <div className="row docs-barre">
            <button className="btn primary" disabled={!change || occupe || demo} onClick={sauver}>
              <Icon n="save" size={15} /> {occupe ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {change && (
              <button
                className="btn"
                onClick={() => {
                  setTexte(doc.contenu)
                  setTitre(doc.titre)
                }}
              >
                Annuler les changements
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={onDupliquer} disabled={demo}>
              <Icon n="copy" size={15} /> Dupliquer
            </button>
            {doc.modifie && !doc.perso && (
              <button className="btn" onClick={onRetablir}>
                <Icon n="rotate" size={15} /> Rétablir l’original
              </button>
            )}
            {!demo && doc.perso && (
              <button className="ecriture btn" onClick={onSupprimer}>
                <Icon n="trash" size={15} /> Retirer
              </button>
            )}
          </div>
          {demo && <div className="small muted">Mode démo : l’enregistrement est désactivé.</div>}
        </div>
      )}
    </div>
  )
}
