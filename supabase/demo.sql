-- Données fictives du compte de démonstration demo@agence-elite.fr : 6 mois d'activité en République du Congo.
-- Noms d'entreprises et de contacts inventés (aucune vraie entreprise). Relançable : efface puis recrée
-- uniquement les données de ce compte. Dates relatives au jour d'exécution, tirage fixe (setseed).
do $$
declare
  u uuid := '17ecf66e-9c89-4896-b7d4-a1446f037485';
  secteurs text[] := array['Restaurant','Esthétique / Beauté','Coiffure','Automobile','Santé / Bien-être','Sport / Fitness','Commerce','Immobilier','BTP / Artisan','Autre'];
  prefixes text[] := array['Restaurant|Maquis|Snack|Lounge|Traiteur','Institut|Spa|Onglerie|Beauty Center','Salon|Barber Shop|Studio Coiffure','Garage|Auto Service|Lavage Auto','Clinique|Cabinet Médical|Pharmacie|Centre Dentaire','Fitness Club|Salle de sport|Centre Yoga','Boutique|Supérette|Pâtisserie|Boulangerie|Pressing','Agence Immo|Résidence|Immobilière','Entreprise|Menuiserie|Plomberie|Électricité','Studio Photo|École privée|Auto-école|Cabinet Conseil|Imprimerie'];
  mots text[] := array['Le Palmier','La Corniche','Mami Wata','Le Djoué','Mayombe','Kouilou','Ma Mbongui','Tata Nkento','Le Manguier','Liboké','La Case Bantou','Nzela','Mboté','Le Baobab','Soleil d''Afrique','Kimia','Bolingo','Etoile du Pool','Le Congo','Makala','Lumière','Excellence','Élégance','La Référence','Nsala','Kintouari','Le Safou','Mfoa','Le Lagon','Tala-Tala','Diamant','Ndako','Horizon','Prestige','Victoire','Kiese','Mwinda','Tchimpa','Loango','Mossaka','La Grâce','Espoir'];
  villes text[] := array['Brazzaville|Poto-Poto','Brazzaville|Moungali','Brazzaville|Bacongo','Brazzaville|Ouenzé','Brazzaville|Talangaï','Brazzaville|Plateau des 15 ans','Brazzaville|Centre-ville','Brazzaville|Mfilou','Pointe-Noire|Loandjili','Pointe-Noire|Tié-Tié','Pointe-Noire|Centre-ville','Pointe-Noire|Mvou-Mvou','Dolisie|Centre','Oyo|Centre','Ouesso|Centre','Nkayi|Centre','Kintélé|Centre'];
  prenoms text[] := array['Grâce','Armel','Prisca','Christelle','Rodrigue','Merveille','Chancelvie','Exaucé','Destin','Divine','Gloire','Juvénal','Arsène','Clarisse','Nadège','Fabrice','Hermann','Ornella','Dieudonné','Aimé','Belvie','Stévy','Rolf','Mireille'];
  noms text[] := array['Mabiala','Nkounkou','Moukoko','Mampouya','Ngoma','Loubaki','Malonga','Mbemba','Ibara','Itoua','Okemba','Tchicaya','Mavoungou','Makosso','Ngouabi','Bouanga','Kimbembe','Moutsila','Ossebi','Samba','Mboungou','Poaty','Loemba','Massamba','Nzaba','Bakala'];
  canaux text[] := array['DM','DM','DM','Appel','Appel','WhatsApp','Facebook'];
  obj text[] := array['Prix trop élevé','Pas le temps','J''ai déjà quelqu''un','Pas le bon moment','Pas de besoin','Doit réfléchir / en parler','Injoignable'];
  modes text[] := array['Mobile Money','Mobile Money','Virement','Espèces'];
  offres text[] := array['Site vitrine','Site vitrine','Site + réservation','Site + SEO local','Gestion Instagram','Pack complet'];
  n int := 135; i int; k int; x float; pid uuid; d date; sig date; ago int; sc text; nom text; secteur text; ville text; quartier text; canal text; offre text;
  contact text; tel text; insta text; source text; tm text; prix numeric; abo numeric; fac text; nfac int := 0; ndev int := 0; m int; payed numeric; essais int; t date;
begin
  perform setseed(0.242);
  delete from public.documents where user_id = u;
  delete from public.actions where user_id = u;
  delete from public.prospects where user_id = u;
  delete from public.settings where user_id = u;
  insert into public.settings (user_id, data) select u, data from public.settings where user_id = '759b0b53-9fa9-4394-a2cd-beccce1a05d0';

  for i in 1..n loop
    ago := greatest(0, 182 - (i * 182 / n) + floor(random() * 5)::int - 2);
    k := 1 + floor(random() * array_length(secteurs, 1))::int;
    secteur := secteurs[k];
    nom := (string_to_array(prefixes[k], '|'))[1 + floor(random() * array_length(string_to_array(prefixes[k], '|'), 1))::int] || ' ' || mots[1 + floor(random() * array_length(mots, 1))::int];
    ville := villes[1 + floor(random() * array_length(villes, 1))::int];
    quartier := split_part(ville, '|', 2); ville := split_part(ville, '|', 1);
    if exists (select 1 from public.prospects where user_id = u and name = nom) then nom := nom || ' ' || case when quartier = 'Centre' then ville else quartier end; end if;
    if exists (select 1 from public.prospects where user_id = u and name = nom) then nom := nom || ' ' || i; end if;
    canal := canaux[1 + floor(random() * array_length(canaux, 1))::int];
    source := case canal when 'DM' then (array['Publicité Instagram','Publicité Instagram','Profil Instagram'])[1 + floor(random() * 3)::int] when 'Facebook' then 'Facebook' else (array['Google Maps','Recommandation','Google Maps','Événement / salon'])[1 + floor(random() * 4)::int] end;
    contact := prenoms[1 + floor(random() * array_length(prenoms, 1))::int] || ' ' || noms[1 + floor(random() * array_length(noms, 1))::int];
    tel := (array['06','05','04'])[1 + floor(random() * 3)::int] || ' ' || lpad((floor(random() * 900) + 100)::text, 3, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0');
    insta := case when canal in ('DM', 'Facebook') or random() < 0.4 then '@' || lower(regexp_replace(translate(split_part(nom, ' ', 2) || split_part(nom, ' ', 3), 'éèêàâîôûçÉ''', 'eeeaaioucE'), '[^a-zA-Z0-9]', '', 'g')) || (array['_bzv','242','_pnr','','_cg'])[1 + floor(random() * 5)::int] end;
    offre := offres[1 + floor(random() * array_length(offres, 1))::int];
    x := random();
    sc := case
      when ago <= 3 then case when x < 0.6 then 'N' else 'C' end
      when ago <= 14 then case when x < 0.3 then 'C' when x < 0.48 then 'Q' when x < 0.62 then 'A' when x < 0.74 then 'R' when x < 0.86 then 'P' else 'L' end
      when ago <= 45 then case when x < 0.14 then 'C' when x < 0.22 then 'Q' when x < 0.3 then 'A' when x < 0.37 then 'R' when x < 0.5 then 'P' when x < 0.75 then 'G' else 'L' end
      else case when x < 0.07 then 'C' when x < 0.11 then 'P' when x < 0.43 then 'G' when x < 0.5 then 'GR' when x < 0.6 then 'I' else 'L' end end;
    pid := gen_random_uuid();
    d := current_date - ago;
    tm := to_char(time '08:00' + floor(random() * 600)::int * interval '1 minute', 'HH24:MI');
    select coalesce((o->>'prix')::numeric, 0), coalesce((o->>'abonnement')::numeric, 0) into prix, abo
      from public.settings s, jsonb_array_elements(s.data->'offres') o where s.user_id = u and o->>'nom' = offre;
    prix := coalesce(prix, 0); abo := coalesce(abo, 0);
    if offre = 'Gestion Instagram' then prix := 295000; end if;

    insert into public.prospects (id, user_id, name, fiche, created_at) values (pid, u, nom, jsonb_strip_nulls(jsonb_build_object(
      'secteur', secteur, 'ville', ville, 'zone', quartier, 'contact', contact, 'telephone', tel, 'whatsapp', tel, 'instagram', insta, 'source', source,
      'offre', case when sc in ('P','G','GR','R','I') then offre end,
      'pub_active', case when source = 'Publicité Instagram' then 'Oui' end,
      'presence_google', (array['Absente','Faible','Bonne'])[1 + floor(random() * 3)::int],
      'taille', (array['Petite','Petite','Moyenne','Grande'])[1 + floor(random() * 4)::int],
      'adresse_facturation', case when sc in ('G','GR','I') then quartier || ', ' || ville end)), d + time '08:00');
    insert into public.actions (user_id, prospect_id, date, time, canal, action) values (u, pid, d, tm, canal, 'Ajout prospect');
    if sc = 'N' then continue; end if;

    -- Prises de contact : parfois plusieurs tentatives avant la réponse
    essais := case when sc = 'C' then 1 + floor(random() * 3)::int else floor(random() * 2)::int + 1 end;
    for m in 1..essais loop
      d := least(d + case when m = 1 then 1 else 2 end, current_date);
      insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, modele, duree, prochaine_action, date_relance)
      values (u, pid, d, to_char(time '08:00' + floor(random() * 600)::int * interval '1 minute', 'HH24:MI'), canal,
        case when m = 1 then 'Premier contact' else 'Relance' end,
        case when m < essais or sc = 'C' then (array['Pas de réponse','Messagerie - vocal laissé','Messagerie - sans vocal','Rappeler'])[1 + floor(random() * 4)::int]
             when sc = 'L' and random() < 0.5 then 'Pas intéressé' else 'Intéressé' end,
        case when canal in ('DM', 'Facebook') then (array['Accroche A - Pub Insta','Accroche B - Avis Google','DM 1 - Compliment + question','DM 2 - Audit gratuit'])[1 + floor(random() * 4)::int] end,
        case when canal = 'Appel' then 2 + floor(random() * 8)::int end,
        case when sc = 'C' and m = essais then 'Relancer' end,
        case when sc = 'C' and m = essais then greatest(d + 2, current_date - 2 + floor(random() * 5)::int) end);
    end loop;
    if sc = 'C' then continue; end if;

    if sc = 'L' then
      d := least(d + 3, current_date);
      if random() < 0.5 then
        insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, montant) values (u, pid, d, tm, canal, 'Proposition envoyée', 'Intéressé', prix);
        d := least(d + 6, current_date);
      end if;
      insert into public.actions (user_id, prospect_id, date, time, canal, action, objection, notes)
      values (u, pid, d, tm, canal, 'Perdu', obj[1 + floor(random() * array_length(obj, 1))::int], 'Motif noté lors du dernier échange');
      continue;
    end if;

    d := least(d + 2, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
    values (u, pid, d, tm, 'Appel', 'Qualification', 'Intéressé', 8 + floor(random() * 15)::int, case when sc = 'Q' then 'Faire l''audit' end, case when sc = 'Q' then current_date + floor(random() * 4)::int end);
    if sc = 'Q' then continue; end if;

    d := least(d + 2, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat) values (u, pid, d, tm, 'DM', 'Loom envoyé', 'Loom vu');
    insert into public.actions (user_id, prospect_id, date, time, canal, action, note, duree, prochaine_action, date_relance)
    values (u, pid, d, tm, 'Autre', 'Audit réalisé', 40 + floor(random() * 45)::int, 30 + floor(random() * 30)::int, case when sc = 'A' then 'Caler le RDV' end, case when sc = 'A' then current_date + floor(random() * 3)::int end);
    if sc = 'A' then continue; end if;

    d := least(d + 3, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
    values (u, pid, d, (array['09:00','10:00','11:00','15:00','16:30'])[1 + floor(random() * 5)::int], 'Appel', 'RDV', 'RDV pris', 20 + floor(random() * 25)::int,
      case when sc = 'R' then 'Envoyer la proposition' end, case when sc = 'R' then current_date + 1 end);
    if sc = 'R' then continue; end if;

    d := least(d + 2, current_date);
    ndev := ndev + 1;
    insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, prochaine_action, date_relance)
    values (u, pid, d, tm, 'DM', 'Proposition envoyée', prix, case when sc = 'P' then 'Relancer la proposition' end, case when sc = 'P' then current_date - 1 + floor(random() * 4)::int end);
    insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'devis', 'DEV-2026' || lpad(ndev::text, 6, '0'), pid, jsonb_build_object(
      'date', d, 'validite', d + 15, 'objet', offre, 'tva', 0, 'client', jsonb_build_object('nom', nom, 'adresse', quartier || ', ' || ville),
      'lignes', jsonb_build_array(jsonb_build_object('designation', offre, 'description', 'Conception, mise en ligne et formation', 'qte', 1, 'pu', prix::text)),
      'conditions', '50 % à la commande, solde à la livraison', 'notes', 'Merci de votre confiance.'), d + time '12:00');
    if sc = 'P' then continue; end if;

    d := least(d + 3 + floor(random() * 6)::int, current_date);
    sig := d; nfac := nfac + 1; fac := 'FAC-2026' || lpad(nfac::text, 6, '0');
    if sc = 'I' then prix := (array[100000, 150000, 200000])[1 + floor(random() * 3)::int]; end if;
    insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, notes)
    values (u, pid, d, tm, 'Appel', case when sc = 'I' then 'Intervention' else 'Signature' end, prix, fac, case when sc = 'I' then 'Intervention sur place' end);
    insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'facture', fac, pid, jsonb_build_object(
      'date', d, 'echeance', d + 30, 'objet', case when sc = 'I' then 'Intervention sur place' else offre end, 'tva', 0, 'client', jsonb_build_object('nom', nom, 'adresse', quartier || ', ' || ville),
      'lignes', jsonb_build_array(jsonb_build_object('designation', case when sc = 'I' then 'Intervention sur place' else offre end, 'qte', 1, 'pu', prix::text)),
      'conditions', 'Payable à réception', 'notes', 'Merci de votre confiance.'), d + time '12:00');
    x := random();
    payed := case when current_date - sig < 10 and x < 0.4 then 0 when x < 0.25 then round(prix / 2) else prix end;
    if payed > 0 then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode)
      values (u, pid, least(d + 1 + floor(random() * 4)::int, current_date), '11:00', 'Autre', 'Paiement reçu', payed, fac, modes[1 + floor(random() * 4)::int]);
    end if;
    if sc = 'I' then
      m := 1;
      while sig + 45 * m <= current_date loop
        nfac := nfac + 1; fac := 'FAC-2026' || lpad(nfac::text, 6, '0'); d := sig + 45 * m;
        insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, notes) values (u, pid, d, '09:30', 'Appel', 'Intervention', 100000, fac, 'Mise à jour et maintenance');
        insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'facture', fac, pid, jsonb_build_object(
          'date', d, 'echeance', d + 30, 'objet', 'Mise à jour et maintenance', 'tva', 0, 'client', jsonb_build_object('nom', nom, 'adresse', quartier || ', ' || ville),
          'lignes', jsonb_build_array(jsonb_build_object('designation', 'Mise à jour et maintenance', 'qte', 1, 'pu', '100000')), 'conditions', 'Payable à réception'), d + time '12:00');
        if d + 2 <= current_date then
          insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode) values (u, pid, d + 2, '15:00', 'Autre', 'Paiement reçu', 100000, fac, 'Mobile Money');
        end if;
        m := m + 1;
      end loop;
      continue;
    end if;
    if current_date - sig >= 2 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 1, 'Autre', 'Onboarding - Contrat'); end if;
    if current_date - sig >= 6 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 5, 'Autre', 'Onboarding - Accès'); end if;
    if current_date - sig >= 14 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 12, 'Autre', 'Onboarding - Contenus'); end if;
    if current_date - sig >= 25 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 21, 'Autre', 'Onboarding - Lancement'); end if;
    if current_date - sig >= 40 then insert into public.actions (user_id, prospect_id, date, canal, action, resultat) values (u, pid, sig + 35, 'WhatsApp', 'Demande d''avis Google', 'Intéressé'); end if;
    if current_date - sig >= 50 and random() < 0.6 then insert into public.actions (user_id, prospect_id, date, canal, action, note) values (u, pid, sig + 45, 'Appel', 'Satisfaction client', 8 + floor(random() * 3)::int); end if;
    if abo > 0 then
      m := 1;
      while sig + 30 * m <= current_date and (sc <> 'GR' or m <= 3) loop
        insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, mode, notes)
        values (u, pid, sig + 30 * m, '10:00', 'Autre', 'Paiement reçu', abo, modes[1 + floor(random() * 4)::int], 'Abonnement mensuel');
        m := m + 1;
      end loop;
    end if;
    if current_date - sig >= 70 and random() < 0.35 then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, notes) values (u, pid, sig + 60, '16:00', 'Appel', 'Vente additionnelle', 250000, 'Shooting photo + contenus');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, mode) values (u, pid, sig + 63, '10:00', 'Autre', 'Paiement reçu', 250000, 'Virement');
    end if;
    if sc = 'GR' then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, objection, notes)
      values (u, pid, least(sig + 100, current_date), '14:00', 'Appel', 'Résiliation', (array['Prix trop élevé','Pas le bon moment','Pas de besoin'])[1 + floor(random() * 3)::int], 'Budget réduit, à recontacter dans 6 mois');
    end if;
  end loop;

  -- Dépenses de l'agence sur 6 mois
  for m in 0..6 loop
    d := (date_trunc('month', current_date) - m * interval '1 month')::date;
    insert into public.actions (user_id, date, canal, action, montant, categorie, fournisseur, mode, notes) values
      (u, d + 2, 'Autre', 'Dépense', 39500, 'Outils', 'Loom, Canva, domaine', 'Virement', 'Abonnements outils'),
      (u, d + 5, 'Autre', 'Dépense', 16500, 'Téléphone / internet', 'Airtel Congo', 'Mobile Money', 'Forfait mensuel'),
      (u, d + 8, 'Autre', 'Dépense', 25000, 'Transport', 'Taxi / carburant', 'Espèces', 'Déplacements clients');
    if m % 2 = 0 then
      insert into public.actions (user_id, date, canal, action, montant, categorie, fournisseur, mode, notes)
      values (u, d + 10, 'Autre', 'Dépense', 60000, 'Publicité', 'Meta', 'Mobile Money', 'Publicité Instagram agence');
    end if;
  end loop;
  i := n;
  -- Activité récente soutenue : chaque jour des 14 derniers jours (aujourd'hui compris) a des nouveaux prospects,
  -- des RDV, des propositions et des signatures, pour que « Cette semaine » ne soit jamais vide, même un lundi.
  for ago in 0..13 loop
    for k in 1..(case when ago = 0 then 10 when extract(isodow from current_date - ago) = 7 then 2 else 5 end) loop
      i := i + 1;
      t := current_date - ago;
      m := 1 + floor(random() * array_length(secteurs, 1))::int;
      secteur := secteurs[m];
      nom := (string_to_array(prefixes[m], '|'))[1 + floor(random() * array_length(string_to_array(prefixes[m], '|'), 1))::int] || ' ' || mots[1 + floor(random() * array_length(mots, 1))::int];
      ville := villes[1 + floor(random() * array_length(villes, 1))::int];
      quartier := split_part(ville, '|', 2); ville := split_part(ville, '|', 1);
      if exists (select 1 from public.prospects where user_id = u and name = nom) then nom := nom || ' ' || case when quartier = 'Centre' then ville else quartier end; end if;
      if exists (select 1 from public.prospects where user_id = u and name = nom) then nom := nom || ' ' || i; end if;
      canal := canaux[1 + floor(random() * array_length(canaux, 1))::int];
      contact := prenoms[1 + floor(random() * array_length(prenoms, 1))::int] || ' ' || noms[1 + floor(random() * array_length(noms, 1))::int];
      tel := (array['06','05','04'])[1 + floor(random() * 3)::int] || ' ' || lpad((floor(random() * 900) + 100)::text, 3, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0') || ' ' || lpad(floor(random() * 100)::text, 2, '0');
      offre := offres[1 + floor(random() * array_length(offres, 1))::int];
      select coalesce((o->>'prix')::numeric, 0) into prix from public.settings s, jsonb_array_elements(s.data->'offres') o where s.user_id = u and o->>'nom' = offre;
      prix := coalesce(prix, 0); if offre = 'Gestion Instagram' then prix := 295000; end if;
      -- k = 1 : signature ce jour, 2 : proposition ce jour, 3 : RDV ce jour, sinon nouveau prospect contacté ce jour (le double aujourd'hui)
      sc := case case when ago = 0 then (k + 1) / 2 else k end when 1 then 'G' when 2 then 'P' when 3 then 'R' else 'C' end;
      d := case sc when 'G' then t - 12 when 'P' then t - 9 when 'R' then t - 7 else t end;
      pid := gen_random_uuid();
      tm := to_char(time '08:00' + floor(random() * 600)::int * interval '1 minute', 'HH24:MI');
      insert into public.prospects (id, user_id, name, fiche, created_at) values (pid, u, nom, jsonb_strip_nulls(jsonb_build_object(
        'secteur', secteur, 'ville', ville, 'zone', quartier, 'contact', contact, 'telephone', tel, 'whatsapp', tel, 'source', case when canal = 'DM' then 'Publicité Instagram' else 'Google Maps' end,
        'offre', case when sc <> 'C' then offre end, 'presence_google', (array['Absente','Faible','Bonne'])[1 + floor(random() * 3)::int],
        'adresse_facturation', case when sc = 'G' then quartier || ', ' || ville end)), d + time '08:00');
      insert into public.actions (user_id, prospect_id, date, time, canal, action) values (u, pid, d, tm, canal, 'Ajout prospect');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
      values (u, pid, d, tm, canal, 'Premier contact', case when sc = 'C' and random() < 0.6 then 'Pas de réponse' else 'Intéressé' end,
        case when canal = 'Appel' then 3 + floor(random() * 6)::int end, case when sc = 'C' then 'Relancer' end, case when sc = 'C' then t + 2 end);
      if sc = 'C' then continue; end if;
      insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree) values (u, pid, d + 2, tm, 'Appel', 'Qualification', 'Intéressé', 8 + floor(random() * 15)::int);
      insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat) values (u, pid, d + 4, tm, 'DM', 'Loom envoyé', 'Loom vu');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, note, duree) values (u, pid, d + 4, tm, 'Autre', 'Audit réalisé', 50 + floor(random() * 40)::int, 40);
      insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
      values (u, pid, d + 7, (array['09:00','10:00','11:00','15:00','16:30'])[1 + floor(random() * 5)::int], 'Appel', 'RDV', 'RDV pris', 30,
        case when sc = 'R' then 'Envoyer la proposition' end, case when sc = 'R' then t + 1 end);
      if sc = 'R' then continue; end if;
      ndev := ndev + 1;
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, prochaine_action, date_relance)
      values (u, pid, d + 9, tm, 'DM', 'Proposition envoyée', prix, case when sc = 'P' then 'Relancer la proposition' end, case when sc = 'P' then t + 3 end);
      insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'devis', 'DEV-2026' || lpad(ndev::text, 6, '0'), pid, jsonb_build_object(
        'date', d + 9, 'validite', d + 24, 'objet', offre, 'tva', 0, 'client', jsonb_build_object('nom', nom, 'adresse', quartier || ', ' || ville),
        'lignes', jsonb_build_array(jsonb_build_object('designation', offre, 'description', 'Conception, mise en ligne et formation', 'qte', 1, 'pu', prix::text)),
        'conditions', '50 % à la commande, solde à la livraison', 'notes', 'Merci de votre confiance.'), d + 9 + time '12:00');
      if sc = 'P' then continue; end if;
      nfac := nfac + 1; fac := 'FAC-2026' || lpad(nfac::text, 6, '0');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture) values (u, pid, t, tm, 'Appel', 'Signature', prix, fac);
      insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'facture', fac, pid, jsonb_build_object(
        'date', t, 'echeance', t + 30, 'objet', offre, 'tva', 0, 'client', jsonb_build_object('nom', nom, 'adresse', quartier || ', ' || ville),
        'lignes', jsonb_build_array(jsonb_build_object('designation', offre, 'qte', 1, 'pu', prix::text)),
        'conditions', '50 % à la commande, solde à la livraison', 'notes', 'Merci de votre confiance.'), t + time '12:00');
      -- Acompte de 50 % le jour même, solde une semaine plus tard
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode) values (u, pid, t, '17:00', 'Autre', 'Paiement reçu', round(prix / 2), fac, modes[1 + floor(random() * 4)::int]);
      if ago >= 7 then
        insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode) values (u, pid, t + 7, '11:00', 'Autre', 'Paiement reçu', prix - round(prix / 2), fac, 'Mobile Money');
      end if;
    end loop;
  end loop;

  delete from public.actions where user_id = u and date > current_date;
end $$;
select (select count(*) from public.prospects where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485') fiches,
       (select count(*) from public.actions where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485') actions,
       (select count(*) from public.documents where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485') documents,
       (select count(distinct prospect_id) from public.actions where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485' and action in ('Signature','Intervention')) clients,
       (select sum(montant) from public.actions where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485' and action = 'Paiement reçu') encaisse,
       (select min(date) from public.actions where user_id = '17ecf66e-9c89-4896-b7d4-a1446f037485') debut;
