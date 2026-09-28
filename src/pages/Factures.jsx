import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, Modal, go, eur, nb, deviseCode, Tabs, useTab, LienProspect, LienDoc } from '../ui'
import { ProspectPicker } from './Saisie'
import { PaiementForm } from './Finances'
import { facturePdf } from './Caisse'
import { num, TYPES, nextNumero, totals, statutDe, paiementsDe, nouveauDoc, montantEnLettres, STATUT_TONE } from '../lib/invoice'
import { fmtDate, addDays, today, nowTime } from '../lib/dates'
import { remplirDoc, ouvrirWhatsApp, telClient } from '../lib/whatsapp'


// Bouton « Relancer » d'une facture impayée (liste des factures, Ma journée)
export function RelanceFactureBtn({ doc, label }) {
  const { actions, data, settings, api, toast } = useApp()
  const go_ = async (e) => {
    e.stopPropagation()
    const texte = remplirDoc(settings.messageImpaye, doc, { actions, byId: data.byId, eur })
    const r = await ouvrirWhatsApp(texte, telClient(doc, data.byId), settings.clients.indicatifWhatsApp)
    if (doc.prospect_id)
      await api.addActions([{ prospect_id: doc.prospect_id, date: today(), time: nowTime(), action: 'Note', canal: 'WhatsApp', notes: `Relance de paiement ${doc.numero}` }]).catch(() => {})
    toast(r === 'wa' ? 'Message de relance prêt dans WhatsApp ✓' : 'Message copié ✓ (ajoute le téléphone sur la fiche pour ouvrir WhatsApp)')
  }
  return (
    <button type="button" className="btn sm" title="Relancer le paiement sur WhatsApp" onClick={go_}>
      <Icon n="bell" size={14} />
      {label ? ` ${label}` : ''}
    </button>
  )
}

// Factures à relancer : en retard ou partiellement payées
export function facturesImpayees(documents, actions) {
  return documents
    .filter((d) => d.type === 'facture')
    .map((d) => {
      const t = totals(d.data || {}).total
      const paye = paiementsDe(d, actions).reduce((m, a) => m + num(a.montant), 0)
      return { ...d, total: t, reste: Math.max(0, t - paye), statut: statutDe(d, actions) }
    })
    .filter((d) => d.reste > 0 && (d.statut === 'En retard' || d.statut === 'Partiellement payée'))
    .sort((a, b) => (a.data?.echeance || '').localeCompare(b.data?.echeance || ''))
}

// ---------- Liste ----------
export default function Factures({ type = 'facture', filtre: filtreDemande }) {
  const { documents, actions, data } = useApp()
  const [q, setQ] = useState('')
  const docs = useMemo(
    () =>
      documents
        .filter((d) => d.type === type)
        .map((d) => {
          const t = totals(d.data || {})
          const paye = paiementsDe(d, actions).reduce((m, a) => m + num(a.montant), 0)
          return { ...d, total: t.total, paye, statut: statutDe(d, actions) }
        })
        .filter((d) => {
          const s = q.trim().toLowerCase()
          return !s || d.numero.toLowerCase().includes(s) || (d.data?.client?.nom || '').toLowerCase().includes(s) || (d.data?.objet || '').toLowerCase().includes(s)
        })
        .sort((a, b) => (b.data?.date || '').localeCompare(a.data?.date || '') || b.numero.localeCompare(a.numero)),
    [documents, actions, type, q],
  )
  const actives = docs.filter((d) => d.statut !== 'Annulée')
  const factTotal = actives.reduce((m, d) => m + d.total, 0)
  const encaisse = actives.reduce((m, d) => m + Math.min(d.paye, d.total), 0)
  const retard = actives.filter((d) => d.statut === 'En retard')
  // Filtres par statut (onglets façon Zoho)
  const FILTRES =
    type === 'facture'
      ? [
          ['toutes', 'Toutes', () => true],
          ['impayees', 'Impayées', (d) => d.statut !== 'Payée' && d.statut !== 'Annulée'],
          ['retard', 'En retard', (d) => d.statut === 'En retard'],
          ['payees', 'Payées', (d) => d.statut === 'Payée'],
          ['annulees', 'Annulées', (d) => d.statut === 'Annulée'],
        ]
      : [
          ['toutes', 'Tous', () => true],
          ['attente', 'En attente', (d) => d.statut === 'En attente'],
          ['acceptes', 'Acceptés', (d) => d.statut === 'Accepté'],
          ['refuses', 'Refusés ou expirés', (d) => d.statut === 'Refusé' || d.statut === 'Expiré'],
        ]
  const [filtre, setFiltre] = useTab(`liste-${type}`, 'toutes', filtreDemande)
  const fx = FILTRES.find(([k]) => k === filtre) || FILTRES[0]
  const vus = docs.filter(fx[2])

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{type === 'devis' ? 'Devis' : 'Factures'}</h1>
          <div className="sub">
            {type === 'devis' ? 'Tes devis en PDF, transformables en facture en un clic.' : 'Tes factures en PDF avec ton logo et leur statut de paiement.'}
          </div>
        </div>
        <div className="row">
          <button className="btn gold" onClick={() => go(`/facture/new?type=${type}`)}>
            + {type === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'}
          </button>
        </div>
      </div>

      {type === 'facture' ? (
        <div className="grid grid-4">
          <Kpi label="Total facturé" value={eur(factTotal)} navy />
          <Kpi label="Encaissé" value={eur(encaisse)} navy />
          <Kpi label="Reste à encaisser" value={eur(factTotal - encaisse)} />
          <Kpi label="Factures en retard" value={nb(retard.length)} />
        </div>
      ) : (
        <div className="grid grid-4">
          <Kpi label="Devis envoyés" value={nb(actives.length)} navy />
          <Kpi label="Montant total" value={eur(factTotal)} navy />
          <Kpi label="Acceptés" value={nb(actives.filter((d) => d.statut === 'Accepté').length)} />
          <Kpi label="En attente" value={nb(actives.filter((d) => d.statut === 'En attente').length)} />
        </div>
      )}

      <Tabs
        items={FILTRES.filter(([k, , fn]) => k !== 'annulees' || docs.some(fn)).map(([k, l, fn]) => [k, l, k === 'toutes' ? undefined : docs.filter(fn).length])}
        value={fx[0]}
        onChange={setFiltre}
      />

      <div className="card flush">
        <div className="list-tools">
          <input className="input" placeholder="Rechercher : numéro, client, objet…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {vus.length === 0 ? (
          <Empty>
            {docs.length === 0 ? (type === 'facture' ? 'Aucune facture pour le moment.' : 'Aucun devis pour le moment.') : 'Rien dans ce filtre.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="t zt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th className="hide-m">Objet</th>
                  <th>Statut</th>
                  <th className="num">Montant</th>
                  {type === 'facture' && <th className="num hide-m">Reste dû</th>}
                  {type === 'facture' && <th className="hide-m" />}
                </tr>
              </thead>
              <tbody>
                {vus.map((d) => (
                  <tr key={d.id} className="click" onClick={() => go(`/facture/${d.id}`)}>
                    <td>{fmtDate(d.data?.date)}</td>
                    <td className="lnk">{d.numero}</td>
                    <td className="bold ell">
                      <LienProspect id={d.prospect_id}>{d.data?.client?.nom || data.byId[d.prospect_id]?.name || 'Sans client'}</LienProspect>
                    </td>
                    <td className="muted ell hide-m">{d.data?.objet || ''}</td>
                    <td>
                      <span className={`badge ${STATUT_TONE[d.statut] || 'b-gold'}`}>{d.statut}</span>
                    </td>
                    <td className="num bold">{eur(d.total)}</td>
                    {type === 'facture' && <td className="num hide-m">{d.statut === 'Annulée' ? '—' : eur(Math.max(0, d.total - d.paye))}</td>}
                    {type === 'facture' && (
                      <td className="hide-m">{(d.statut === 'En retard' || d.statut === 'Partiellement payée') && <RelanceFactureBtn doc={d} label="Relancer" />}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Création / modification ----------
export function DocEditor({ id, query }) {
  const { documents, actions, data, settings, api, toast } = useApp()
  const fact = settings.facturation
  const existing = id && id !== 'new' ? documents.find((d) => d.id === id) : null
  const params = new URLSearchParams(query || '')

  const init = () => {
    if (existing) return JSON.parse(JSON.stringify(existing))
    const type = params.get('type') === 'devis' ? 'devis' : 'facture'
    const src = params.get('from') ? documents.find((d) => d.id === params.get('from')) : null
    const dup = params.get('dup') ? documents.find((d) => d.id === params.get('dup')) : null
    const base = src || dup
    const pid = base?.prospect_id || params.get('p') || null
    const p = pid ? data.byId[pid] : null
    const extra = base
      ? {
          objet: base.data.objet,
          client: { ...base.data.client },
          lignes: base.data.lignes.map((l) => ({ ...l })),
          remise: base.data.remise,
          tva: base.data.tva,
          ...(src ? { devisNumero: src.numero, devisId: src.id } : {}),
        }
      : p
        ? { client: { nom: p.name, adresse: p.fiche?.adresse_facturation || [p.fiche?.contact, p.fiche?.ville].filter(Boolean).join('\n') } }
        : {}
    return { type, numero: nextNumero(documents, type, fact), prospect_id: pid, data: nouveauDoc(type, fact, extra) }
  }
  const [doc, setDoc] = useState(init)
  const [newName, setNewName] = useState(null)
  const [suivi, setSuivi] = useState(!existing)
  const [busy, setBusy] = useState('')
  const [dirty, setDirty] = useState(!existing)
  const [payModal, setPayModal] = useState(null)
  if (id && id !== 'new' && !existing)
    return (
      <div className="card">
        <Empty>Document introuvable.</Empty>
        <button className="btn" onClick={() => go('/factures')}>
          ← Retour aux factures
        </button>
      </div>
    )

  const d = doc.data
  const t = totals(d)
  const code = deviseCode()
  const saved = !!existing
  const statut = saved ? statutDe(existing, actions) : 'En attente'
  const paye = saved ? paiementsDe(existing, actions).reduce((m, a) => m + num(a.montant), 0) : 0
  const p = doc.prospect_id ? data.byId[doc.prospect_id] : null
  const isFact = doc.type === 'facture'

  const setD = (patch) => {
    setDoc((x) => ({ ...x, data: { ...x.data, ...patch } }))
    setDirty(true)
  }
  const setLine = (i, patch) => setD({ lignes: d.lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const pick = (pid) => {
    const pp = pid ? data.byId[pid] : null
    setDoc((x) => ({
      ...x,
      prospect_id: pid,
      data: { ...x.data, client: pp ? { nom: pp.name, adresse: pp.fiche?.adresse_facturation || [pp.fiche?.contact, pp.fiche?.ville].filter(Boolean).join('\n') } : x.data.client },
    }))
    setNewName(null)
    setDirty(true)
  }

  const save = async () => {
    if (!d.client?.nom?.trim()) return toast('Indique le client', true)
    if (!t.lignes.some((l) => (l.designation || '').trim())) return toast('Ajoute au moins une ligne', true)
    if (!doc.numero.trim()) return toast('Numéro manquant', true)
    if (documents.some((x) => x.type === doc.type && x.numero === doc.numero.trim() && x.id !== doc.id)) return toast('Ce numéro existe déjà', true)
    setBusy('save')
    try {
      let pid = doc.prospect_id
      if (newName) {
        const np = await api.addProspect(newName, { adresse_facturation: d.client.adresse || '' })
        pid = np.id
      } else if (p && (d.client.adresse || '') !== (p.fiche?.adresse_facturation || '')) {
        await api.updateProspect(p.id, { fiche: { ...p.fiche, adresse_facturation: d.client.adresse || '' } })
      }
      const dataOut = { ...d, lignes: t.lignes.filter((l) => (l.designation || '').trim()).map(({ montant, ...l }) => l) }
      // Suivi client : l'intervention (ou la proposition pour un devis) reprend le montant et le numéro
      if (pid && !dataOut.annulee) {
        const linked = dataOut.actionId ? actions.find((a) => a.id === dataOut.actionId) : null
        const fields = { prospect_id: pid, date: dataOut.date, montant: t.total, facture: isFact ? doc.numero.trim() : null }
        if (linked) await api.updateAction(linked.id, { ...linked, ...fields })
        else if (suivi && t.total > 0) {
          const niveau = data.byId[pid]?.niveau || 0
          const action = !isFact ? 'Proposition envoyée' : dataOut.devisId && niveau < 7 ? 'Signature' : 'Intervention'
          const [row] = await api.addActions([{ canal: 'Autre', action, ...fields, notes: dataOut.objet || null }])
          dataOut.actionId = row.id
        }
      }
      // Numéro modifié : les paiements déjà reçus suivent la facture
      if (existing && isFact && existing.numero !== doc.numero.trim()) {
        for (const a of paiementsDe(existing, actions)) await api.updateAction(a.id, { ...a, facture: doc.numero.trim() })
      }
      const out = await api.saveDoc({ ...doc, numero: doc.numero.trim(), prospect_id: pid, data: dataOut })
      // Devis transformé en facture : on le marque accepté
      if (dataOut.devisId) {
        const dv = documents.find((x) => x.id === dataOut.devisId)
        if (dv && dv.data.statut !== 'Accepté') await api.saveDoc({ ...dv, data: { ...dv.data, statut: 'Accepté', factureNumero: doc.numero } })
      }
      toast(`${TYPES[doc.type].label} enregistré${isFact ? 'e' : ''} ✓`)
      setDirty(false)
      setNewName(null)
      if (!saved) go(`/facture/${out.id}`)
      else setDoc(out)
    } catch {
      /* toast déjà affiché */
    }
    setBusy('')
  }

  const datePaiement = saved ? paiementsDe(existing, actions).map((a) => a.date).sort().pop() : ''
  const pdfOpts = () => ({ fact, code, statut, paye, datePaiement })
  const withPdf = async (fn) => {
    if (dirty) return toast("Enregistre d'abord le document", true)
    setBusy('pdf')
    try {
      const { pdfBlob, pdfNom } = await import('../lib/invoicePdf')
      const blob = await pdfBlob(existing, pdfOpts())
      await fn(blob, pdfNom(existing, fact))
    } catch (e) {
      if (e?.name !== 'AbortError') toast(`PDF impossible : ${e.message}`, true)
    }
    setBusy('')
  }
  const download = () =>
    withPdf(async (blob, name) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    })
  const share = () =>
    withPdf(async (blob, name) => {
      const file = new File([blob], name, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: remplirDoc(settings.messageEnvoi, existing, { actions, byId: data.byId, eur }) })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        toast('Partage non disponible ici : PDF téléchargé')
      }
    })
  // Envoi sur WhatsApp : sur téléphone, le PDF part avec le message ; sur ordinateur, PDF téléchargé + WhatsApp ouvert avec le message
  const envoyerWa = () =>
    withPdf(async (blob, name) => {
      const texte = remplirDoc(settings.messageEnvoi, existing, { actions, byId: data.byId, eur })
      const file = new File([blob], name, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], text: texte })
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      const r = await ouvrirWhatsApp(texte, telClient(existing, data.byId), settings.clients.indicatifWhatsApp)
      toast(r === 'wa' ? 'PDF téléchargé : joins-le dans la conversation WhatsApp ouverte' : 'PDF téléchargé et message copié (pas de numéro sur la fiche)')
    })
  const relancerPaiement = async () => {
    const texte = remplirDoc(settings.messageImpaye, existing, { actions, byId: data.byId, eur })
    const r = await ouvrirWhatsApp(texte, telClient(existing, data.byId), settings.clients.indicatifWhatsApp)
    if (existing.prospect_id)
      await api.addActions([{ prospect_id: existing.prospect_id, date: today(), time: nowTime(), action: 'Note', canal: 'WhatsApp', notes: `Relance de paiement ${existing.numero}` }]).catch(() => {})
    toast(r === 'wa' ? 'Message de relance prêt dans WhatsApp ✓' : 'Message copié ✓ (ajoute le téléphone sur la fiche pour ouvrir WhatsApp)')
  }
  const preview = () => withPdf(async (blob) => window.open(URL.createObjectURL(blob), '_blank'))

  const addPaiement = () => setPayModal({ prospect_id: doc.prospect_id, facture: doc.numero, montant: String(Math.max(0, t.total - paye)) })
  const setDevisStatut = async (s) => {
    await api.saveDoc({ ...existing, data: { ...existing.data, statut: s } })
    setDoc((x) => ({ ...x, data: { ...x.data, statut: s } }))
    toast(`Devis ${s.toLowerCase()} ✓`)
  }
  // Facture annulée ou supprimée : son devis peut de nouveau être transformé
  const libererDevis = async () => {
    const dv = existing.data.devisId && documents.find((x) => x.id === existing.data.devisId)
    if (dv && dv.data.factureNumero === existing.numero) {
      const { factureNumero, ...rest } = dv.data // eslint-disable-line no-unused-vars
      await api.saveDoc({ ...dv, data: rest })
    }
  }
  const annuler = async () => {
    if (!window.confirm('Annuler cette facture ? Son montant sera retiré du suivi client.')) return
    const linked = existing.data.actionId && actions.find((a) => a.id === existing.data.actionId)
    if (linked) await api.deleteAction(linked.id)
    const nd = { ...existing.data, annulee: true, actionId: null }
    await api.saveDoc({ ...existing, data: nd })
    await libererDevis()
    setDoc((x) => ({ ...x, data: nd }))
    toast('Facture annulée')
  }
  const supprimer = async () => {
    if (!window.confirm(`Supprimer définitivement ${doc.numero} ?`)) return
    const linked = existing.data.actionId && actions.find((a) => a.id === existing.data.actionId)
    if (linked && window.confirm('Supprimer aussi la ligne correspondante dans le suivi client ?')) await api.deleteAction(linked.id)
    await api.deleteDoc(existing.id)
    await libererDevis()
    toast('Document supprimé')
    go(doc.type === 'devis' ? '/devis' : '/factures')
  }

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>
            {TYPES[doc.type].label} {doc.numero}
          </h1>
          <div className="sub row" style={{ gap: 8 }}>
            {saved && <span className={`badge ${STATUT_TONE[statut] || 'b-gold'}`}>{statut}</span>}
            {saved && doc.prospect_id && (
              <span>
                Client : <LienProspect id={doc.prospect_id} />
              </span>
            )}
            {d.devisNumero && (
              <span>
                Issue du devis <LienDoc id={d.devisId} numero={d.devisNumero} />
              </span>
            )}
            {d.factureNumero && (
              <span>
                Transformé en facture <LienDoc numero={d.factureNumero} />
              </span>
            )}
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => go(doc.type === 'devis' ? '/devis' : '/factures')}>
            ← Retour
          </button>
          <button className="btn gold" disabled={!!busy || !dirty} onClick={save}>
            {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="card row" style={{ gap: 8 }}>
          <button className="btn primary" disabled={!!busy} onClick={download}>
            <Icon n="download" size={16} /> Télécharger le PDF
          </button>
          {existing.type === 'facture' && (
            <button className="btn" disabled={!!busy || dirty} onClick={() => facturePdf(existing, { settings, actions }, 'imprimer', true).catch((e) => toast(`Reçu impossible : ${e.message}`, true))}>
              <Icon n="note" size={16} /> Imprimer le reçu
            </button>
          )}
          <button className="btn" disabled={!!busy} onClick={envoyerWa}>
            <Icon n="message" size={16} /> Envoyer sur WhatsApp
          </button>
          <button className="btn" disabled={!!busy} onClick={share}>
            <Icon n="share" size={16} /> Partager…
          </button>
          {isFact && !d.annulee && saved && statut !== 'Payée' && t.total - paye > 0 && (
            <button className={`btn ${statut === 'En retard' ? 'danger' : ''}`} disabled={!!busy} onClick={relancerPaiement}>
              <Icon n="bell" size={16} /> Relancer le paiement
            </button>
          )}
          <button className="btn" disabled={!!busy} onClick={preview}>
            <Icon n="eye" size={16} /> Aperçu
          </button>
          {isFact && !d.annulee && statut !== 'Payée' && (
            <button className="btn gold" disabled={!!busy} onClick={addPaiement}>
              + Paiement reçu
            </button>
          )}
          {!isFact && !d.factureNumero && (
            <>
              <button className="btn gold" onClick={() => go(`/facture/new?type=facture&from=${existing.id}`)}>
                Transformer en facture
              </button>
              {d.statut !== 'Accepté' && (
                <button className="btn" onClick={() => setDevisStatut('Accepté')}>
                  Accepté
                </button>
              )}
              {d.statut !== 'Refusé' && (
                <button className="btn" onClick={() => setDevisStatut('Refusé')}>
                  Refusé
                </button>
              )}
            </>
          )}
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => go(`/facture/new?type=${doc.type}&dup=${existing.id}`)}>
            <Icon n="copy" size={14} /> Dupliquer
          </button>
          {isFact && !d.annulee && (
            <button className="btn ghost sm danger" onClick={annuler}>
              Annuler la facture
            </button>
          )}
          <button className="btn ghost sm danger" onClick={supprimer}>
            <Icon n="trash" size={14} /> Supprimer
          </button>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 14 }}>
          <div className="form-label" style={{ marginBottom: 0 }}>
            Client
          </div>
          {newName ? (
            <div className="selected-prospect">
              <div className="li-main">
                <div className="li-title">＋ {newName}</div>
                <div className="li-sub">Nouveau client : il sera ajouté au CRM</div>
              </div>
              <button type="button" className="btn sm" onClick={() => setNewName(null)}>
                Annuler
              </button>
            </div>
          ) : (
            <ProspectPicker
              value={doc.prospect_id}
              onPick={pick}
              newLabel="Nouveau client"
              onNew={(n) => {
                setNewName(n)
                setDoc((x) => ({ ...x, prospect_id: null, data: { ...x.data, client: { nom: n, adresse: '' } } }))
                setDirty(true)
              }}
            />
          )}
          <Field label="Nom affiché sur le document">
            <input value={d.client?.nom || ''} onChange={(e) => setD({ client: { ...d.client, nom: e.target.value } })} />
          </Field>
          <Field label="Adresse (une ligne par ligne)">
            <textarea value={d.client?.adresse || ''} onChange={(e) => setD({ client: { ...d.client, adresse: e.target.value } })} />
          </Field>
        </div>

        <div className="card stack" style={{ gap: 14 }}>
          <div className="form-label" style={{ marginBottom: 0 }}>
            Document
          </div>
          <div className="form-grid tight">
            <Field label="Numéro">
              <input
                value={doc.numero}
                onChange={(e) => {
                  setDoc((x) => ({ ...x, numero: e.target.value }))
                  setDirty(true)
                }}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={d.date || ''}
                onChange={(e) =>
                  setD({
                    date: e.target.value,
                    ...(isFact && !saved ? { echeance: addDays(e.target.value, num(fact.delaiPaiement)) } : {}),
                    ...(!isFact && !saved ? { validite: addDays(e.target.value, num(fact.validiteDevis) || 30) } : {}),
                  })
                }
              />
            </Field>
            {isFact ? (
              <Field label="Échéance">
                <input type="date" value={d.echeance || ''} onChange={(e) => setD({ echeance: e.target.value })} />
              </Field>
            ) : (
              <Field label="Valable jusqu'au">
                <input type="date" value={d.validite || ''} onChange={(e) => setD({ validite: e.target.value })} />
              </Field>
            )}
          </div>
          <Field label="Objet">
            <input value={d.objet || ''} placeholder="Ex. Conception et impression de cartes de visite" onChange={(e) => setD({ objet: e.target.value })} />
          </Field>
          <Field label="Conditions">
            <input value={d.conditions || ''} onChange={(e) => setD({ conditions: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="form-label" style={{ marginBottom: 0 }}>
            Articles et prestations
          </div>
          {settings.offres.length > 0 && (
            <select
              className="input"
              style={{ width: 'auto' }}
              value=""
              onChange={(e) => {
                const o = settings.offres.find((x) => x.nom === e.target.value)
                if (!o) return
                const vide = d.lignes.length === 1 && !d.lignes[0].designation
                const l = { designation: o.nom, description: '', qte: 1, pu: o.prix || o.abonnement || '' }
                setD({ lignes: vide ? [l] : [...d.lignes, l] })
              }}
            >
              <option value="">+ Depuis ta grille tarifaire…</option>
              {settings.offres.map((o) => (
                <option key={o.nom} value={o.nom}>
                  {o.nom} ({eur(o.prix || o.abonnement)})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="doc-lines">
          <div className="doc-line head">
            <span>Désignation et description</span>
            <span>Qté</span>
            <span>Prix unitaire</span>
            <span className="num">Montant</span>
            <span />
          </div>
          {d.lignes.map((l, i) => (
            <div className="doc-line" key={i}>
              <div className="stack" style={{ gap: 6 }}>
                <input className="input" placeholder="Désignation" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} />
                <input className="input small" placeholder="Description (facultatif)" value={l.description || ''} onChange={(e) => setLine(i, { description: e.target.value })} />
              </div>
              <input className="input" inputMode="decimal" value={l.qte} onChange={(e) => setLine(i, { qte: e.target.value })} />
              <input className="input" inputMode="decimal" value={l.pu} onChange={(e) => setLine(i, { pu: e.target.value })} />
              <div className="num bold">{eur(num(l.qte) * num(l.pu))}</div>
              <button className="icon-btn" title="Supprimer la ligne" onClick={() => setD({ lignes: d.lignes.length > 1 ? d.lignes.filter((_, j) => j !== i) : [{ designation: '', description: '', qte: 1, pu: '' }] })}>
                <Icon n="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
        <button className="toggle-link" style={{ marginTop: 8 }} onClick={() => setD({ lignes: [...d.lignes, { designation: '', description: '', qte: 1, pu: '' }] })}>
          + Ajouter une ligne
        </button>

        <div className="doc-totals">
          <div>
            <span>Sous-total</span>
            <b>{eur(t.sousTotal)}</b>
          </div>
          <div>
            <span>Remise</span>
            <input className="input" inputMode="decimal" value={d.remise ?? ''} placeholder="0" onChange={(e) => setD({ remise: e.target.value })} />
          </div>
          <div>
            <span>TVA / taxes (%)</span>
            <input className="input" inputMode="decimal" value={d.tva ?? ''} placeholder="0" onChange={(e) => setD({ tva: e.target.value })} />
          </div>
          {t.taxes > 0 && (
            <div>
              <span>Taxes</span>
              <b>{eur(t.taxes)}</b>
            </div>
          )}
          {paye > 0 && (
            <div>
              <span>Déjà payé</span>
              <b className="green">{eur(paye)}</b>
            </div>
          )}
          <div className="doc-total">
            <span>{isFact ? 'Total à payer' : 'Total du devis'}</span>
            <b>{eur(isFact ? Math.max(0, t.total - paye) : t.total)}</b>
          </div>
          <div className="tiny muted right">{montantEnLettres(t.total, code)}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 12 }}>
          <Field label="Notes (en bas du document)">
            <textarea value={d.notes || ''} onChange={(e) => setD({ notes: e.target.value })} />
          </Field>
          {isFact && (
            <Field label="Informations de paiement">
              <textarea value={d.paiement || ''} onChange={(e) => setD({ paiement: e.target.value })} />
            </Field>
          )}
        </div>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="form-label" style={{ marginBottom: 0 }}>
            Suivi client
          </div>
          {d.actionId ? (
            <div className="small muted">
              Relié au suivi : {isFact ? 'le montant et le numéro sont mis à jour dans l’historique du client.' : 'la proposition est suivie dans le pipeline.'}
            </div>
          ) : !saved ? (
            <label className="row small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={suivi} onChange={(e) => setSuivi(e.target.checked)} />
              <span>
                {isFact
                  ? 'Ajouter au suivi client (une « Intervention » avec ce montant et ce numéro)'
                  : 'Ajouter au suivi (une « Proposition envoyée » avec ce montant)'}
              </span>
            </label>
          ) : (
            <div className="small muted">Non relié au suivi client.</div>
          )}
          {saved && isFact && (
            <div className="small">
              {paiementsDe(existing, actions).length === 0 ? (
                <span className="muted">Aucun paiement enregistré.</span>
              ) : (
                paiementsDe(existing, actions).map((a) => (
                  <div key={a.id}>
                    Paiement du {fmtDate(a.date)} : <b>{eur(a.montant)}</b>
                  </div>
                ))
              )}
            </div>
          )}
          {p && (
            <button className="btn sm" style={{ width: 'fit-content' }} onClick={() => go(`/prospect/${p.id}`)}>
              Voir la fiche de {p.name}
            </button>
          )}
        </div>
      </div>
      {payModal && (
        <Modal title="Paiement reçu" onClose={() => setPayModal(null)}>
          <PaiementForm prefill={payModal} onDone={() => setPayModal(null)} />
        </Modal>
      )}
    </div>
  )
}
