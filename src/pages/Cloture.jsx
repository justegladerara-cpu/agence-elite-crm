// Clôture de caisse : le ticket Z récapitule la journée d'un établissement et compare les espèces comptées
import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useApp, Field, Kpi, Empty, eur, nb, sym, go } from '../ui'
import { num, estNombre } from '../lib/invoice'
import { today, nowTime, fmtDate } from '../lib/dates'
import { peut } from '../lib/store'
import { etablissementsDe, etabCourant, chiffresZ, cloturesDe, nextZ, zBlob } from '../lib/etablissements'

async function ouvrirZ(z, settings, format, toast) {
  try {
    const blob = await zBlob(z, { fact: settings.facturation, sym: sym(), format })
    const url = URL.createObjectURL(blob)
    if (!window.open(url, '_blank')) {
      const a = document.createElement('a')
      a.href = url
      a.download = `Ticket_${z.numero}_${z.data?.date || ''}.pdf`
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    toast(`PDF impossible : ${e.message}`, true)
  }
}

function Repartition({ rows }) {
  if (!rows.length) return <div className="small muted">—</div>
  return (
    <div className="sorties" style={{ marginTop: 0, borderTop: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="so deux">
          <span className="so-l">{k}</span>
          <span className="so-m">{eur(v)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Cloture({ etab: etabDemande }) {
  const { settings, documents, actions, api, toast, profil } = useApp()
  const liste = useMemo(() => etablissementsDe(settings), [settings])
  const [etabId, setEtabId] = useState(() => (liste.some((e) => e.id === etabDemande) ? etabDemande : etabCourant(settings).id))
  const [date, setDate] = useState(today())
  const etab = liste.find((e) => e.id === etabId) || liste[0]
  const c = useMemo(() => chiffresZ({ documents, actions, date, etabId: etab.id, liste }), [documents, actions, date, etab.id, liste])
  const toutes = cloturesDe(documents)
  const existant = toutes.find((z) => z.data?.date === date && z.data?.etablissementId === etab.id)
  // Sorties d'espèces proposées : dépenses payées en espèces ce jour-là (seulement s'il n'y a qu'un établissement)
  const sortiesAuto = liste.length === 1 ? actions.filter((a) => a.action === 'Dépense' && a.date === date && a.mode === 'Espèces').reduce((m, a) => m + num(a.montant), 0) : 0
  const [f, setF] = useState(null)
  const cle = `${date}|${etab.id}|${existant?.id || ''}`
  const form = f && f.cle === cle ? f : { cle, fond: existant ? String(existant.data.fond || '') : '', sorties: existant ? String(existant.data.sorties || '') : sortiesAuto ? String(sortiesAuto) : '', compte: existant ? String(existant.data.compte ?? '') : '', note: existant?.data?.note || '' }
  const set = (p) => setF({ ...form, ...p })
  const [busy, setBusy] = useState(false)
  const attendu = num(form.fond) + c.especes - num(form.sorties)
  const ecart = form.compte === '' ? null : num(form.compte) - attendu
  const peutClore = peut(profil, 'vendre') || peut(profil, 'finances')
  const changeDepuis = existant && (existant.data.chiffres?.nbVentes !== c.nbVentes || Math.round(existant.data.chiffres?.encaisse) !== Math.round(c.encaisse) || Math.round(existant.data.chiffres?.ca) !== Math.round(c.ca))

  const clore = async () => {
    for (const [k, l] of [['fond', 'Le fond de caisse'], ['sorties', "Les sorties d'espèces"], ['compte', 'Les espèces comptées']])
      if (form[k] !== '' && (!estNombre(form[k]) || num(form[k]) < 0)) return toast(`${l} doit être un montant positif`, true)
    if (form.compte === '') return toast("Compte les espèces du tiroir et indique le montant (0 s'il n'y en a pas)", true)
    if (date > today()) return toast('On ne peut pas clôturer une journée à venir', true)
    setBusy(true)
    try {
      const z = await api.saveDoc({
        ...(existant ? { id: existant.id } : {}),
        type: 'cloture',
        numero: existant?.numero || nextZ(documents),
        prospect_id: null,
        data: {
          date,
          etablissementId: etab.id,
          etablissement: etab.nom,
          adresse: etab.adresse || '',
          heure: nowTime(),
          par: profil?.nom || profil?.email || '',
          fond: num(form.fond),
          sorties: num(form.sorties),
          compte: num(form.compte),
          attendu,
          ecart: num(form.compte) - attendu,
          note: form.note.trim(),
          chiffres: c,
        },
      })
      toast(existant ? 'Clôture mise à jour ✓' : `Caisse clôturée : ${z.numero} ✓`)
      ouvrirZ(z, settings, 'ticket', toast)
    } catch {
      /* erreur déjà affichée */
    }
    setBusy(false)
  }
  const supprimer = async (z) => {
    try {
      await api.deleteDoc(z.id)
      toast(`${z.numero} supprimé ✓`)
    } catch {
      /* erreur déjà affichée */
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clôture de caisse (ticket Z)</h1>
          <div className="sub">En fin de journée : compte les espèces du tiroir, vérifie l'écart, puis clôture. Le ticket Z récapitule toutes les ventes de la journée de l'établissement.</div>
        </div>
      </div>
      <div className="card row" style={{ gap: 12, alignItems: 'flex-end' }}>
        {liste.length > 1 && (
          <Field label="Établissement">
            <select className="input" id="z-etab" value={etab.id} onChange={(e) => setEtabId(e.target.value)}>
              {liste.map((e) => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Journée">
          <input className="input" id="z-date" type="date" max={today()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <div style={{ flex: 1 }} />
        {existant ? (
          <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
            <span className="badge b-green">
              Clôturée · {existant.numero} · {existant.data.heure} par {existant.data.par || '—'}
            </span>
            {changeDepuis && <span className="badge b-orange">Des ventes ont changé depuis : mets la clôture à jour</span>}
          </div>
        ) : (
          <span className="badge b-gold">{date === today() ? "Caisse ouverte aujourd'hui" : 'Journée non clôturée'}</span>
        )}
      </div>

      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <Kpi label="Chiffre d'affaires" value={eur(c.ca)} navy />
        <Kpi label="Ventes" value={nb(c.nbVentes)} />
        <Kpi label="Total encaissé" value={eur(c.encaisse)} />
        <Kpi label="Vendu à crédit" value={eur(c.credit)} />
      </div>

      <div className="grid ventes-grid" style={{ marginTop: 12 }}>
        <div className="card stack">
          <h2 className="section" style={{ margin: 0 }}>Comptage des espèces</h2>
          <div className="grid grid-2">
            <Field label="Fond de caisse du matin (€)">
              <input className="input" id="z-fond" inputMode="numeric" value={form.fond} onChange={(e) => set({ fond: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Sorties d'espèces du jour (€)">
              <input className="input" id="z-sorties" inputMode="numeric" value={form.sorties} onChange={(e) => set({ sorties: e.target.value })} placeholder="0" />
            </Field>
          </div>
          {sortiesAuto > 0 && <div className="tiny muted">Proposé : les dépenses payées en espèces ce jour ({eur(sortiesAuto)}).</div>}
          <div className="sorties" style={{ marginTop: 0 }}>
            <div className="so deux"><span className="so-l">Fond de caisse</span><span className="so-m">{eur(num(form.fond))}</span></div>
            <div className="so deux"><span className="so-l">+ Espèces encaissées</span><span className="so-m">{eur(c.especes)}</span></div>
            <div className="so deux"><span className="so-l">− Sorties d'espèces</span><span className="so-m">{eur(num(form.sorties))}</span></div>
            <div className="so deux"><span className="so-l"><b>= Espèces attendues dans le tiroir</b></span><span className="so-m"><b>{eur(attendu)}</b></span></div>
          </div>
          <Field label="Espèces comptées dans le tiroir (€)">
            <input className="input" id="z-compte" inputMode="numeric" value={form.compte} onChange={(e) => set({ compte: e.target.value })} placeholder="Montant compté" />
          </Field>
          {ecart !== null && (
            <div className={`z-ecart ${ecart === 0 ? 'ok' : ecart > 0 ? 'plus' : 'moins'}`}>
              {ecart === 0 ? 'La caisse est juste ✓' : ecart > 0 ? `Excédent de ${eur(ecart)}` : `Il manque ${eur(-ecart)}`}
            </div>
          )}
          <Field label="Note (facultatif)">
            <input className="input" id="z-note" value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ex. billet de 10 000 abîmé mis de côté" />
          </Field>
          {!peutClore ? (
            <div className="small muted">Tu n'as pas le droit de clôturer la caisse.</div>
          ) : (!existant || changeDepuis || f?.cle === cle) && (
            <button className="btn primary" disabled={busy} onClick={clore}>
              <Icon n="check" size={16} /> {existant ? 'Mettre à jour la clôture' : 'Clôturer la caisse et imprimer le Z'}
            </button>
          )}
          {existant && (
            <div className="row">
              <button className="btn" onClick={() => ouvrirZ(existant, settings, 'ticket', toast)}>
                <Icon n="file" size={15} /> Ticket Z (80 mm)
              </button>
              <button className="btn" onClick={() => ouvrirZ(existant, settings, 'a4', toast)}>
                <Icon n="download" size={15} /> Z en A4 (comptable)
              </button>
            </div>
          )}
        </div>
        <div className="card stack">
          <h2 className="section" style={{ margin: 0 }}>Encaissements par mode</h2>
          <Repartition rows={c.parMode} />
          {c.reglementsAnciens > 0 && <div className="tiny muted">Dont {eur(c.reglementsAnciens)} de règlements de ventes à crédit des jours précédents.</div>}
          <h2 className="section" style={{ margin: '8px 0 0' }}>Ventes par vendeur</h2>
          <Repartition rows={c.parVendeur} />
          <h2 className="section" style={{ margin: '8px 0 0' }}>Ventes par catégorie</h2>
          <Repartition rows={c.parCategorie} />
          <div className="small muted">
            {c.nbVentes ? `${nb(c.articles)} articles vendus · panier moyen ${eur(c.panierMoyen)} · de ${c.premiere || '—'} à ${c.derniere || '—'}` : 'Aucune vente ce jour-là.'}
            {c.annulees.n > 0 && ` · ${nb(c.annulees.n)} vente${c.annulees.n > 1 ? 's' : ''} annulée${c.annulees.n > 1 ? 's' : ''} (${eur(c.annulees.montant)})`}
          </div>
        </div>
        <div className="card plein">
          <h2 className="section">Clôtures précédentes</h2>
          {!toutes.length ? (
            <Empty>Aucune clôture pour l'instant.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="t ztable">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Journée</th>
                    {liste.length > 1 && <th className="hide-m">Établissement</th>}
                    <th className="num">Chiffre d'affaires</th>
                    <th className="num hide-m">Encaissé</th>
                    <th className="num">Écart</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {toutes.slice(0, 60).map((z) => (
                    <tr key={z.id} className="click" onClick={() => { setDate(z.data.date); setEtabId(z.data.etablissementId); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                      <td className="strong">{z.numero}</td>
                      <td>{fmtDate(z.data.date)}</td>
                      {liste.length > 1 && <td className="hide-m">{z.data.etablissement}</td>}
                      <td className="num">{eur(z.data.chiffres?.ca)}</td>
                      <td className="num hide-m">{eur(z.data.chiffres?.encaisse)}</td>
                      <td className="num">
                        <span className={`badge ${num(z.data.ecart) === 0 ? 'b-green' : num(z.data.ecart) > 0 ? 'b-orange' : 'b-red'}`}>{num(z.data.ecart) === 0 ? 'Juste' : eur(z.data.ecart)}</span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn sm" onClick={() => ouvrirZ(z, settings, 'ticket', toast)} title="Imprimer le ticket Z">
                          <Icon n="file" size={14} />
                        </button>{' '}
                        {peut(profil, 'annuler') && (
                          <button className="btn sm ghost" onClick={() => window.confirm(`Supprimer la clôture ${z.numero} ?`) && supprimer(z)} title="Supprimer cette clôture" aria-label={`Supprimer ${z.numero}`}>
                            <Icon n="trash" size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>
        <button className="toggle-link" onClick={() => go('/caisse')}>Retour à la caisse</button>
      </div>
    </>
  )
}
