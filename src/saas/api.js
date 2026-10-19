// Accès à la base de la plateforme pour les écrans d'administration : mêmes appels que le SaaS
// (rpc, lire, jeton, serveur), avec la connexion super admin du CRM.
// serveur() appelle les fonctions de saas.agence-elite.fr (dossier functions/ de la plateforme), qui
// acceptent l'origine du CRM.
export function creerApi(supabase, origineSaas) {
  const echouer = (error) => {
    if (error) throw new Error(error.message);
  };
  const jeton = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return {
    mode: 'supabase',
    async rpc(nom, args = {}) {
      const { data, error } = await supabase.rpc(nom, args);
      echouer(error);
      return data;
    },
    async lire(table, { eq = {}, gte = {}, lte = {}, dans = {}, ordre, limite, colonnes } = {}) {
      let requete = supabase.from(table).select(colonnes ? colonnes.join(',') : '*');
      for (const [cle, valeur] of Object.entries(eq)) requete = valeur === null ? requete.is(cle, null) : requete.eq(cle, valeur);
      for (const [cle, valeur] of Object.entries(gte)) requete = requete.gte(cle, valeur);
      for (const [cle, valeur] of Object.entries(lte)) requete = requete.lte(cle, valeur);
      for (const [cle, valeurs] of Object.entries(dans)) requete = requete.in(cle, valeurs);
      if (ordre) requete = requete.order(ordre[0], { ascending: ordre[1] !== 'desc' });
      if (limite) requete = requete.limit(limite);
      const { data, error } = await requete;
      echouer(error);
      return data;
    },
    jeton,
    async serveur(chemin, { methode = 'GET', corps } = {}) {
      const j = await jeton();
      if (!j) throw new Error('Session expirée : reconnectez-vous');
      const rep = await fetch(`${origineSaas}${chemin}`, {
        method: methode,
        headers: { authorization: `Bearer ${j}`, 'content-type': 'application/json' },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      });
      const donnees = await rep.json().catch(() => null);
      if (!rep.ok || !donnees) throw new Error(donnees?.erreur ?? 'Service indisponible pour le moment');
      return donnees;
    },
  };
}
