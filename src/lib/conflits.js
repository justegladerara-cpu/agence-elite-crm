// Devis/factures refusés par la base car leur numéro existe déjà dans l'espace (index unique
// documents_workspace_type_numero_unique). Ils ne sont jamais jetés : gardés sur l'appareil,
// réaffichés après chaque chargement et signalés jusqu'à ce que l'utilisateur change le numéro.
export const estConflitNumero = (e) => /documents_workspace_type_numero_unique/i.test(String(e?.message || e || ''))

// Une seule entrée par document : la dernière version refusée
export const ajouterConflit = (liste, row) => [...liste.filter((c) => c.row.id !== row.id), { row, le: new Date().toISOString() }]
export const retirerConflit = (liste, id) => liste.filter((c) => c.row.id !== id)

// Documents chargés + documents en conflit (la version locale refusée prime, marquée pour l'interface)
export const avecConflits = (documents, liste) => {
  if (!liste.length) return documents
  const ids = new Set(liste.map((c) => c.row.id))
  return [...documents.filter((d) => !ids.has(d.id)), ...liste.map((c) => ({ ...c.row, conflitNumero: true }))]
}

export const messageConflit = (row) =>
  `Le numéro ${String(row.numero || '').trim()} est déjà utilisé dans cet espace (créé sur un autre appareil ?). ${row.type === 'devis' ? 'Ton devis est conservé' : 'Ta facture est conservée'} sur cet appareil : ouvre-${row.type === 'devis' ? 'le' : 'la'}, choisis un autre numéro et enregistre à nouveau.`

export const messageConflits = (liste) =>
  liste.length === 1
    ? messageConflit(liste[0].row)
    : liste.length
      ? `${liste.length} devis/factures non synchronisés : numéros déjà utilisés (${liste.map((c) => c.row.numero).join(', ')}). Ils sont conservés sur cet appareil : ouvre-les, change le numéro et enregistre à nouveau.`
      : ''
