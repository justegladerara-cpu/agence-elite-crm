// Signature et cachet : tu ajoutes, changes ou retires ta signature et ton cachet. Ils vont tout seuls
// sur tes prochains reçus et factures.
import { useRef, useState } from 'react'
import { Icon } from '../icons'
import { useNoyau } from '../core/contexte'
import { lireImage } from '../lib/theme'

function Zone({ titre, aide, valeur, onChange }) {
  const ref = useRef()
  const { toast } = useNoyau()
  const choisir = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      onChange(await lireImage(f, 700))
    } catch (err) {
      toast(err.message, true)
    }
  }
  return (
    <section className="sig-zone">
      <h2>{titre}</h2>
      <p className="small muted">{aide}</p>
      <button type="button" className={`sig-apercu ${valeur ? 'plein' : ''}`} onClick={() => ref.current.click()}>
        {valeur ? (
          <img src={valeur} alt={titre} />
        ) : (
          <span>
            <Icon n="upload" size={24} />
            <br />
            Appuie ici pour choisir une image
          </span>
        )}
      </button>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => ref.current.click()}>
          <Icon n="upload" size={15} /> {valeur ? 'Changer' : 'Ajouter'}
        </button>
        {valeur && (
          <button type="button" className="btn ghost danger" onClick={() => onChange('')}>
            <Icon n="trash" size={15} /> Retirer
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={choisir} />
    </section>
  )
}

export default function Signature() {
  const { settings, api, toast } = useNoyau()
  const [busy, setBusy] = useState(false)
  const f = settings.facturation || {}
  const changer = async (cle, v) => {
    setBusy(true)
    try {
      await api.saveSettings({ ...settings, facturation: { ...f, [cle]: v || '' } })
      toast(v ? 'Enregistré ✓ Il sera sur tes prochains reçus et factures.' : 'Retiré ✓')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack sig" aria-busy={busy}>
      <div className="tb-tete">
        <div>
          <h1>Signature et cachet</h1>
          <p className="tb-phrase">Ajoute-les une fois. Ils vont tout seuls sur tes reçus et tes factures.</p>
        </div>
      </div>
      <div className="card small">
        <strong>Conseil :</strong> prends ta signature en photo sur une feuille blanche. Demande à ChatGPT : « Enlève le fond blanc et donne-moi une image PNG transparente ». Ensuite, ajoute l’image ici. Pareil pour le cachet.
      </div>
      <div className="sig-grille">
        <Zone titre="Ma signature" aide="Elle apparaît en bas de chaque reçu et facture." valeur={f.signature} onChange={(v) => changer('signature', v)} />
        <Zone titre="Mon cachet" aide="Il apparaît à côté de la signature." valeur={f.cachet} onChange={(v) => changer('cachet', v)} />
      </div>
      {(f.signature || f.cachet) && (
        <section className="sig-exemple">
          <span className="tiny muted">Aperçu sur un reçu</span>
          <div className="sig-papier">
            <div className="small">Reçu de paiement · 100 000 FCFA</div>
            <div className="sig-bas">
              <span className="tiny muted">Signature et cachet</span>
              <div className="row">
                {f.signature && <img src={f.signature} alt="" />}
                {f.cachet && <img src={f.cachet} alt="" />}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
