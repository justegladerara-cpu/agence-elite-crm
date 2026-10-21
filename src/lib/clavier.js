// Raccourci d'une seule touche (ex. 1 à 4 dans la fiche d'appel, SEC-15) : jamais pendant une saisie
// (champ, zone de texte, liste, texte modifiable) ni avec Ctrl, Cmd, Alt ou une touche maintenue.
export function estRaccourciLibre(e) {
  const t = e.target
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return false
  return !(e.ctrlKey || e.metaKey || e.altKey || e.repeat)
}
