// Aide des raccourcis clavier (touche ?)
import { Modal } from '../ui'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const LIGNES = [
  [[MAC ? '⌘' : 'Ctrl', 'K'], 'Chercher une fiche, une page ou une action'],
  [['/'], 'Chercher (même chose)'],
  [['E'], 'Encaisser (argent reçu)'],
  [['V'], 'Nouvelle vente'],
  [['D'], 'Noter mes DM'],
  [['N'], 'Nouvelle action'],
  [['G', 'D'], 'Aller au tableau de bord'],
  [['G', 'V'], 'Aller aux ventes par activité'],
  [['G', 'C'], 'Aller au classement des clients'],
  [['G', 'R'], 'Aller au mode relance'],
  [['G', 'J'], 'Aller à la prospection du jour'],
  [['G', 'P'], 'Aller aux prospects'],
  [['G', 'F'], 'Aller aux factures'],
  [['G', 'T'], 'Aller au suivi du logiciel'],
  [['G', 'A'], 'Tous les espaces'],
  [['1', '…', '4'], "Après un appel : résultat (pas de réponse, rappeler, intéressé, pas intéressé)"],
  [['Échap'], 'Fermer une fenêtre'],
  [['?'], 'Afficher cette aide'],
]

export default function Raccourcis({ onClose }) {
  return (
    <Modal title="Raccourcis clavier" onClose={onClose}>
      <table className="raccourcis">
        <tbody>
          {LIGNES.map(([touches, texte]) => (
            <tr key={texte}>
              <td>
                {touches.map((t, i) => (t === '…' ? <span key={i}> à </span> : <kbd key={i}>{t}</kbd>))}
              </td>
              <td>{texte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}
