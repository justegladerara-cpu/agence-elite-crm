// « Remplacer toutes mes données » (SEC-02), sans jamais passer par un état vide :
// 1. les nouvelles lignes sont ajoutées ; si l'ajout échoue, ce qui vient d'être ajouté est retiré et rien d'autre
//    n'a bougé ;
// 2. seulement ensuite, les anciennes lignes sont retirées par identifiant (jamais « tout l'espace »).
// db : { bulkImport(prospects, actions) → { prospects, actions } (identifiants), supprimerLot({ prospects, actions }) }
export async function remplacerDonnees(db, avant, prospects, actions) {
  try {
    await db.bulkImport(prospects, actions)
  } catch (e) {
    let retire = true
    if (e.inseres) await db.supprimerLot(e.inseres).catch(() => (retire = false))
    const fin = retire ? "rien n'a été remplacé, tes données d'avant sont intactes" : "tes données d'avant sont intactes, mais une partie de l'import est restée : vérifie puis supprime-la"
    throw Object.assign(new Error(`${e.message} · ${fin}`), { cause: e })
  }
  await db.supprimerLot({ prospects: avant.prospects.map((x) => x.id), actions: avant.actions.map((x) => x.id) })
}
