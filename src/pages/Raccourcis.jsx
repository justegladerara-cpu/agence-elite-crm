// Aide des raccourcis clavier (touche ?)
import { Modal } from '../ui'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const LIGNES = [
  [[MAC ? '⌘' : 'Ctrl', 'K'], 'Chercher une fiche, une page ou une action'],
  [['/'], 'Chercher (même chose)'],
  [['N'], 'Nouvelle action'],
  [['G', 'J'], 'Aller à Ma journée'],
  [['G', 'P'], 'Aller aux prospects'],
  [['G', 'C'], 'Aller aux clients'],
  [['G', 'F'], 'Aller aux factures'],
  [['G', 'D'], 'Aller au tableau de bord'],
  [['G', 'S'], "Lancer une session d'appels"],
  [['G', 'A'], 'Tous les espaces'],
  [['G', 'T'], 'Aller à la Tour de contrôle'],
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
