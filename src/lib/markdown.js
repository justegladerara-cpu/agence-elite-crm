// Petit moteur Markdown pour les documents et modèles (titres, paragraphes, listes, tableaux, gras, italique, liens).
// Le texte est échappé avant tout : aucun HTML saisi par l'utilisateur n'est exécuté.
// Les champs {{Nom du champ}} sont remplacés par valeurs[nom] ou surlignés s'ils sont vides.

const echap = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const CHAMP = /\{\{\s*([^}]+?)\s*\}\}/g

// Liste des champs d'un modèle, dans l'ordre d'apparition, sans doublon
export function champsDe(texte) {
  const vus = new Set()
  for (const m of String(texte || '').matchAll(CHAMP)) vus.add(m[1])
  return [...vus]
}

function enLigne(s, valeurs, libelles) {
  let h = echap(s)
  h = h.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, nom) => {
    const brut = nom.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    const v = valeurs?.[brut]
    if (v !== undefined && v !== null && String(v).trim() !== '') return `<span class="md-rempli">${echap(v)}</span>`
    return `<span class="md-champ">${echap(libelles?.[brut] || brut)}</span>`
  })
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
  h = h.replace(/(^|\s)_([^_\s][^_]*?)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>')
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  return h
}

const cellules = (ligne) =>
  ligne
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

export function markdownEnHtml(texte, valeurs = {}, libelles = {}) {
  const lignes = String(texte || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const out = []
  let i = 0
  const L = (s) => enLigne(s, valeurs, libelles)
  while (i < lignes.length) {
    const l = lignes[i]
    if (!l.trim()) {
      i++
      continue
    }
    const t = l.match(/^(#{1,4})\s+(.*)$/)
    if (t) {
      const n = Math.min(4, t[1].length + (t[1].length === 1 ? 1 : 0))
      out.push(`<h${n}>${L(t[2])}</h${n}>`)
      i++
      continue
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(l)) {
      out.push('<hr>')
      i++
      continue
    }
    if (/^\s*```/.test(l)) {
      const bloc = []
      i++
      while (i < lignes.length && !/^\s*```/.test(lignes[i])) bloc.push(lignes[i++])
      i++
      out.push(`<pre>${echap(bloc.join('\n'))}</pre>`)
      continue
    }
    if (/^\s*\|/.test(l) && i + 1 < lignes.length && /^\s*\|?\s*:?-{2,}/.test(lignes[i + 1])) {
      const tete = cellules(l)
      i += 2
      const corps = []
      while (i < lignes.length && /^\s*\|/.test(lignes[i])) corps.push(cellules(lignes[i++]))
      const vide = tete.every((c) => !c)
      out.push(
        `<table>${vide ? '' : `<thead><tr>${tete.map((c) => `<th>${L(c)}</th>`).join('')}</tr></thead>`}<tbody>${corps
          .map((r) => `<tr>${r.map((c) => `<td>${L(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      )
      continue
    }
    if (/^\s*>/.test(l)) {
      const bloc = []
      while (i < lignes.length && /^\s*>/.test(lignes[i])) bloc.push(lignes[i++].replace(/^\s*>\s?/, ''))
      out.push(`<blockquote>${markdownEnHtml(bloc.join('\n'), valeurs, libelles)}</blockquote>`)
      continue
    }
    const puce = /^\s*([-*+]|\d+[.)])\s+/
    if (puce.test(l)) {
      const ordonnee = /^\s*\d/.test(l)
      const items = []
      while (i < lignes.length && (puce.test(lignes[i]) || (/^\s{2,}\S/.test(lignes[i]) && items.length))) {
        if (puce.test(lignes[i])) items.push(lignes[i].replace(puce, ''))
        else items[items.length - 1] += ' ' + lignes[i].trim()
        i++
      }
      const tag = ordonnee ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((x) => `<li>${L(x.replace(/^\[ \]\s*/, '☐ ').replace(/^\[x\]\s*/i, '☑ '))}</li>`).join('')}</${tag}>`)
      continue
    }
    const para = []
    while (i < lignes.length && lignes[i].trim() && !/^(#{1,4})\s/.test(lignes[i]) && !/^\s*(\||>|```|[-*+]\s|\d+[.)]\s)/.test(lignes[i]) && !/^\s*(---|\*\*\*)\s*$/.test(lignes[i])) {
      para.push(lignes[i].replace(/\s{2,}$/, '@@BR@@'))
      i++
    }
    out.push(`<p>${para.map(L).join(' ').replace(/@@BR@@ ?/g, '<br>')}</p>`)
  }
  return out.join('\n')
}
