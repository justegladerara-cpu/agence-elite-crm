// Copie d'un texte dans le presse-papiers (avec repli pour les navigateurs sans API)
export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    // Navigateur sans presse-papiers : sélection manuelle
    const t = document.createElement('textarea')
    t.value = texte
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}
