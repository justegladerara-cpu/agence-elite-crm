-- Données fictives du compte de démonstration demo@agence-elite.fr (id 17ecf66e-…).
-- Relançable : efface puis recrée uniquement les données de ce compte. Dates relatives au jour d'exécution.
do $$
declare
  u uuid := '17ecf66e-9c89-4896-b7d4-a1446f037485';
  r record; pid uuid; d date; sig date; prix numeric; abo numeric; fac text; nfac int := 0; ndev int := 0; m int; tm text; payed numeric;
  obj text[] := array['Prix trop élevé','Pas le temps','J''ai déjà quelqu''un','Pas le bon moment','Pas de besoin','Doit réfléchir / en parler'];
  modes text[] := array['Mobile Money','Virement','Espèces'];
begin
  delete from public.documents where user_id = u;
  delete from public.actions where user_id = u;
  delete from public.prospects where user_id = u;
  delete from public.settings where user_id = u;
  insert into public.settings (user_id, data) select u, data from public.settings where user_id = '759b0b53-9fa9-4394-a2cd-beccce1a05d0';

  for r in select * from (values
    (1,'Le Terminus Restaurant','Restaurant','Brazzaville','Armel Mabiala','06 612 45 78','@leterminus_bzv','DM','Publicité Instagram','Site + réservation','G',165),
    (2,'Institut Beauté Divine','Esthétique / Beauté','Brazzaville','Grâce Nkounkou','05 530 11 24','@beautedivine242','DM','Publicité Instagram','Pack complet','G',140),
    (3,'Garage Moukondo Auto','Automobile','Brazzaville','Serge Moukondo','06 677 90 12',null,'Appel','Google Maps','Site vitrine','G',120),
    (4,'Clinique Dentaire Sourire+','Santé / Bien-être','Pointe-Noire','Dr Ibara','06 880 23 45','@sourireplus_pnr','Appel','Recommandation','Site + SEO local','G',95),
    (5,'Salon Afro Queen','Coiffure','Brazzaville','Mireille Loubaki','05 544 78 90','@afroqueen_salon','WhatsApp','Profil Instagram','Gestion Instagram','G',70),
    (6,'Fitness Club Mpila','Sport / Fitness','Brazzaville','Patrick Okemba','06 634 56 12','@fitnessmpila','DM','Publicité Instagram','Site + réservation','G',45),
    (7,'Pâtisserie Les Délices de Poto-Poto','Commerce','Brazzaville','Clarisse Mampouya','06 655 33 21','@delicespotopoto','DM','Publicité Instagram','Site vitrine','G',25),
    (8,'Agence Immo Océan','Immobilier','Pointe-Noire','Rodrigue Tchicaya','06 690 12 34','@immo_ocean','Appel','Google Maps','Site + SEO local','G',12),
    (9,'Hôtel Ma Campagne','Restaurant','Brazzaville','Mme Ngouabi','05 511 22 33',null,'Appel','Recommandation','Pack complet','GR',150),
    (10,'Boutique Wax Élégance','Commerce','Pointe-Noire','Aïcha Diallo','06 623 45 67','@waxelegance','DM','Publicité Instagram','Gestion Instagram','GR',130),
    (11,'Cabinet Comptable Ondongo','Autre','Brazzaville','M. Ondongo','06 601 23 45',null,'Appel','Recommandation','Site vitrine','I',110),
    (12,'Pharmacie du Plateau','Santé / Bien-être','Brazzaville','Dr Massamba','05 577 88 99',null,'Appel','Google Maps','Site vitrine','I',60),
    (13,'Maquis Chez Tantine','Restaurant','Brazzaville','Tantine Bibi','06 645 67 89','@cheztantine','DM','Publicité Instagram','Site + réservation','P',16),
    (14,'Spa Zen Attitude','Santé / Bien-être','Pointe-Noire','Nadège Kaya','06 612 98 76','@zenattitude_spa','DM','Publicité Instagram','Pack complet','P',22),
    (15,'BTP Congo Bâtir','BTP / Artisan','Brazzaville','Jean-Claude Mbemba','06 689 01 23',null,'Appel','Google Maps','Site + SEO local','P',30),
    (16,'Boulangerie La Congolaise','Commerce','Brazzaville','Albert Nzaba','05 566 44 22',null,'Appel','Google Maps','Site vitrine','P',19),
    (17,'Barber Shop Le Parrain','Coiffure','Brazzaville','Junior Malonga','06 677 11 00','@leparrain_barber','DM','Publicité Instagram','Site + réservation','R',11),
    (18,'Auto-école Réussite','Autre','Pointe-Noire','Mme Mavoungou','06 633 22 11','@autoecole_reussite','WhatsApp','Facebook','Site vitrine','R',14),
    (19,'Onglerie Nails by Cindy','Esthétique / Beauté','Brazzaville','Cindy Makaya','05 555 67 89','@nailsbycindy','DM','Publicité Instagram','Gestion Instagram','A',9),
    (20,'Restaurant Le Baobab','Restaurant','Pointe-Noire','Hervé Pambou','06 612 34 00','@lebaobab_pnr','DM','Publicité Instagram','Site + réservation','A',12),
    (21,'Studio Photo Lumière','Autre','Brazzaville','Kévin Ngoma','06 645 00 11','@studiolumiere242','DM','Profil Instagram','Site vitrine','A',8),
    (22,'Salle de sport Iron Gym','Sport / Fitness','Pointe-Noire','Franck Bouanga','06 690 55 44','@irongym_pnr','Facebook','Facebook','Site + réservation','Q',7),
    (23,'Traiteur Saveurs du Pool','Restaurant','Brazzaville','Estelle Moutsila','05 544 12 12','@saveursdupool','DM','Publicité Instagram','Site vitrine','Q',6),
    (24,'Garage Rapid Service','Automobile','Pointe-Noire','Didier Loemba','06 622 77 88',null,'Appel','Google Maps','Site vitrine','Q',10),
    (25,'Salon Brazza Coiffure','Coiffure','Brazzaville','Prisca Bakala','06 611 44 55','@brazzacoiffure','DM','Publicité Instagram','Gestion Instagram','Q',5),
    (26,'Lounge Bar Le Fleuve','Restaurant','Brazzaville','Stéphane Itoua','06 698 76 54','@lefleuve_lounge','DM','Publicité Instagram','Site + réservation','C',6),
    (27,'Institut Éclat Naturel','Esthétique / Beauté','Pointe-Noire','Ruth Kibangou','05 533 90 90','@eclatnaturel','DM','Publicité Instagram',null,'C',4),
    (28,'Menuiserie Moderne','BTP / Artisan','Brazzaville','Paul Mfoutou','06 655 88 77',null,'Appel','Google Maps',null,'C',8),
    (29,'Cave à vins Le Sommelier','Commerce','Brazzaville','Laurent Opa','06 601 99 88','@lesommelier_bzv','DM','Profil Instagram',null,'C',3),
    (30,'École privée Les Petits Génies','Autre','Brazzaville','Mme Kimbembe','05 577 12 34','@petitsgenies','Facebook','Facebook',null,'C',9),
    (31,'Pressing Blanc Net','Commerce','Pointe-Noire','Alain Bidounga','06 644 22 33',null,'Appel','Google Maps',null,'C',2),
    (32,'Food truck Grill 242','Restaurant','Brazzaville','Yann Mboungou','06 633 44 55','@grill242','DM','Publicité Instagram',null,'N',2),
    (33,'Boutique Kiko Mode','Commerce','Brazzaville','Kiko Mbani','05 566 77 88','@kikomode','DM','Publicité Instagram',null,'N',1),
    (34,'Centre Yoga Harmonie','Sport / Fitness','Pointe-Noire','Sandra Tati','06 612 00 99','@yogaharmonie_pnr','DM','Profil Instagram',null,'N',1),
    (35,'Plomberie Express','BTP / Artisan','Brazzaville','Gaston Kouka','06 687 12 12',null,'Appel','Google Maps',null,'N',0),
    (36,'Glacier Tropical','Commerce','Pointe-Noire','Inès Makosso','05 511 66 77','@glaciertropical','DM','Publicité Instagram',null,'N',0),
    (37,'Restaurant La Mandarine','Restaurant','Brazzaville','Mme Samba','06 666 55 44','@lamandarine_bzv','DM','Publicité Instagram','Site vitrine','L',40),
    (38,'Salon Beauté Royale','Esthétique / Beauté','Brazzaville','Josiane Ntsiba','05 599 88 77','@beauteroyale','DM','Publicité Instagram','Site + réservation','L',55),
    (39,'Garage Auto Pro 2000','Automobile','Pointe-Noire','Michel Makaya','06 620 30 40',null,'Appel','Google Maps','Site vitrine','L',100),
    (40,'Club de danse Ndombolo','Sport / Fitness','Brazzaville','Fiston Kaba','06 650 60 70','@ndombolo_club','Facebook','Facebook','Site vitrine','L',35),
    (41,'Hôtel Atlantic Palace','Restaurant','Pointe-Noire','M. Poaty','06 680 90 10',null,'Appel','Recommandation','Pack complet','L',80),
    (42,'Boutique Bébé Confort','Commerce','Brazzaville','Carine Ossebi','05 522 33 44','@bebeconfort242','DM','Publicité Instagram','Site vitrine','L',20)
  ) v(fid,nom,secteur,ville,contact,tel,insta,canal,source,offre,sc,ago) loop
    pid := gen_random_uuid();
    d := current_date - r.ago;
    tm := to_char(time '08:30' + ((r.fid * 47) % 570) * interval '1 minute', 'HH24:MI');
    select coalesce((o->>'prix')::numeric, 0), coalesce((o->>'abonnement')::numeric, 0) into prix, abo
      from public.settings s, jsonb_array_elements(s.data->'offres') o where s.user_id = u and o->>'nom' = r.offre;
    prix := coalesce(prix, 0); abo := coalesce(abo, 0);
    if r.offre = 'Gestion Instagram' then prix := 295000; end if;
    insert into public.prospects (id, user_id, name, fiche, created_at) values (pid, u, r.nom, jsonb_strip_nulls(jsonb_build_object(
      'secteur', r.secteur, 'ville', r.ville, 'contact', r.contact, 'telephone', r.tel, 'whatsapp', r.tel, 'instagram', r.insta, 'source', r.source,
      'offre', case when r.sc in ('P','G','GR','R','I') then r.offre end,
      'pub_active', case when r.source = 'Publicité Instagram' then 'Oui' end,
      'presence_google', (array['Absente','Faible','Bonne'])[1 + r.fid % 3],
      'taille', (array['Petite','Moyenne','Petite','Grande'])[1 + r.fid % 4],
      'adresse_facturation', case when r.sc in ('G','GR','I') then r.ville end)), d + time '08:00');
    insert into public.actions (user_id, prospect_id, date, time, canal, action) values (u, pid, d, tm, r.canal, 'Ajout prospect');
    if r.sc = 'N' then continue; end if;

    -- Prise de contact
    d := least(d + 1, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, modele, duree, prochaine_action, date_relance)
    values (u, pid, d, tm, r.canal, case when r.canal = 'Appel' then 'Premier contact' else 'Premier contact' end,
      case when r.sc = 'C' then (array['Pas de réponse','Messagerie - vocal laissé','Rappeler'])[1 + r.fid % 3] when r.sc = 'L' and r.fid % 2 = 0 then 'Pas intéressé' else 'Intéressé' end,
      case when r.canal = 'DM' then (array['Accroche A - Pub Insta','DM 2 - Audit gratuit','DM 1 - Compliment + question'])[1 + r.fid % 3] end,
      case when r.canal = 'Appel' then 3 + r.fid % 6 end,
      case when r.sc = 'C' then 'Relancer' end,
      case when r.sc = 'C' then current_date + (r.fid % 4) - 1 end);
    if r.sc = 'C' then continue; end if;

    if r.sc = 'L' then
      d := least(d + 3, current_date);
      if r.fid % 2 = 1 then
        insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, montant) values (u, pid, d, tm, r.canal, 'Proposition envoyée', 'Intéressé', prix);
        d := least(d + 5, current_date);
      end if;
      insert into public.actions (user_id, prospect_id, date, time, canal, action, objection, notes)
      values (u, pid, d, tm, r.canal, 'Perdu', obj[1 + r.fid % 6], 'Motif noté lors du dernier échange');
      continue;
    end if;

    -- Qualification
    d := least(d + 2, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
    values (u, pid, d, tm, 'Appel', 'Qualification', 'Intéressé', 10 + r.fid % 10, case when r.sc = 'Q' then 'Faire l''audit' end, case when r.sc = 'Q' then current_date + 1 + r.fid % 3 end);
    if r.sc = 'Q' then continue; end if;

    -- Audit / Loom
    d := least(d + 2, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, note) values (u, pid, d, tm, 'DM', 'Loom envoyé', 'Loom vu', null);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, note, duree, prochaine_action, date_relance)
    values (u, pid, d, tm, 'Autre', 'Audit réalisé', 45 + (r.fid * 7) % 40, 40, case when r.sc = 'A' then 'Caler le RDV' end, case when r.sc = 'A' then current_date + r.fid % 3 end);
    if r.sc = 'A' then continue; end if;

    -- RDV
    d := least(d + 3, current_date);
    insert into public.actions (user_id, prospect_id, date, time, canal, action, resultat, duree, prochaine_action, date_relance)
    values (u, pid, d, '10:00', 'Appel', 'RDV', 'RDV pris', 30, case when r.sc = 'R' then 'Envoyer la proposition' end, case when r.sc = 'R' then current_date + 1 end);
    if r.sc = 'R' then continue; end if;

    -- Proposition + devis
    d := least(d + 2, current_date);
    ndev := ndev + 1;
    insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, prochaine_action, date_relance)
    values (u, pid, d, tm, 'DM', 'Proposition envoyée', prix, case when r.sc = 'P' then 'Relancer la proposition' end, case when r.sc = 'P' then current_date + (r.fid % 3) - 1 end);
    insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'devis', 'DEV-2026' || lpad(ndev::text, 6, '0'), pid, jsonb_build_object(
      'date', d, 'validite', d + 15, 'objet', r.offre, 'tva', 0, 'client', jsonb_build_object('nom', r.nom, 'adresse', r.ville),
      'lignes', jsonb_build_array(jsonb_build_object('designation', r.offre, 'description', 'Conception, mise en ligne et formation', 'qte', 1, 'pu', prix::text)),
      'conditions', '50 % à la commande, solde à la livraison', 'notes', 'Merci de votre confiance.'), d + time '12:00');
    if r.sc = 'P' then continue; end if;

    -- Signature (ou intervention ponctuelle) + facture + paiements
    d := least(d + 4, current_date);
    sig := d; nfac := nfac + 1; fac := 'FAC-2026' || lpad(nfac::text, 6, '0');
    if r.sc = 'I' then prix := 150000; end if;
    insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, notes)
    values (u, pid, d, tm, 'Appel', case when r.sc = 'I' then 'Intervention' else 'Signature' end, prix, fac, case when r.sc = 'I' then 'Intervention sur place' end);
    insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'facture', fac, pid, jsonb_build_object(
      'date', d, 'echeance', d + 30, 'objet', coalesce(r.offre, 'Intervention'), 'tva', 0, 'client', jsonb_build_object('nom', r.nom, 'adresse', r.ville),
      'lignes', jsonb_build_array(jsonb_build_object('designation', case when r.sc = 'I' then 'Intervention sur place' else r.offre end, 'qte', 1, 'pu', prix::text)),
      'conditions', 'Payable à réception', 'notes', 'Merci de votre confiance.'), d + time '12:00');
    payed := case when r.fid in (7, 8) then 0 when r.fid % 3 = 0 then round(prix / 2) else prix end;
    if payed > 0 then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode)
      values (u, pid, least(d + 2, current_date), '11:00', 'Autre', 'Paiement reçu', payed, fac, modes[1 + r.fid % 3]);
    end if;
    if r.sc = 'I' then
      -- deuxième intervention, déjà payée
      nfac := nfac + 1; fac := 'FAC-2026' || lpad(nfac::text, 6, '0');
      d := least(sig + 40, current_date);
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, notes) values (u, pid, d, '09:30', 'Appel', 'Intervention', 100000, fac, 'Mise à jour du site');
      insert into public.documents (user_id, type, numero, prospect_id, data, created_at) values (u, 'facture', fac, pid, jsonb_build_object(
        'date', d, 'echeance', d + 30, 'objet', 'Mise à jour du site', 'tva', 0, 'client', jsonb_build_object('nom', r.nom, 'adresse', r.ville),
        'lignes', jsonb_build_array(jsonb_build_object('designation', 'Mise à jour du site', 'qte', 1, 'pu', '100000')), 'conditions', 'Payable à réception'), d + time '12:00');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, facture, mode) values (u, pid, least(d + 1, current_date), '15:00', 'Autre', 'Paiement reçu', 100000, fac, 'Mobile Money');
      continue;
    end if;
    -- Onboarding selon l'ancienneté
    if current_date - sig >= 2 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 1, 'Autre', 'Onboarding - Contrat'); end if;
    if current_date - sig >= 6 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 5, 'Autre', 'Onboarding - Accès'); end if;
    if current_date - sig >= 14 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 12, 'Autre', 'Onboarding - Contenus'); end if;
    if current_date - sig >= 25 then insert into public.actions (user_id, prospect_id, date, canal, action) values (u, pid, sig + 21, 'Autre', 'Onboarding - Lancement'); end if;
    if current_date - sig >= 40 then insert into public.actions (user_id, prospect_id, date, canal, action, resultat) values (u, pid, sig + 35, 'WhatsApp', 'Demande d''avis Google', 'Intéressé'); end if;
    -- Abonnement mensuel payé
    if abo > 0 then
      m := 1;
      while sig + 30 * m <= current_date and (r.sc <> 'GR' or m <= 3) loop
        insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, mode, notes)
        values (u, pid, sig + 30 * m, '10:00', 'Autre', 'Paiement reçu', abo, modes[1 + (r.fid + m) % 3], 'Abonnement mensuel');
        m := m + 1;
      end loop;
    end if;
    if r.fid in (1, 2) then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, notes) values (u, pid, sig + 60, '16:00', 'Appel', 'Vente additionnelle', 250000, 'Shooting photo + contenus');
      insert into public.actions (user_id, prospect_id, date, time, canal, action, montant, mode) values (u, pid, sig + 62, '10:00', 'Autre', 'Paiement reçu', 250000, 'Virement');
    end if;
    if r.sc = 'GR' then
      insert into public.actions (user_id, prospect_id, date, time, canal, action, objection, notes) values (u, pid, sig + 100, '14:00', 'Appel', 'Résiliation', 'Prix trop élevé', 'Budget réduit, à recontacter dans 6 mois');
    end if;
  end loop;

  -- Dépenses mensuelles
  for m in 0..5 loop
    insert into public.actions (user_id, date, canal, action, montant, categorie, fournisseur, mode, notes) values
      (u, (date_trunc('month', current_date) - m * interval '1 month')::date + 2, 'Autre', 'Dépense', 39500, 'Outils', 'Loom, Canva, domaine', 'Virement', 'Abonnements outils'),
      (u, (date_trunc('month', current_date) - m * interval '1 month')::date + 5, 'Autre', 'Dépense', 16500, 'Téléphone / internet', 'Airtel', 'Mobile Money', 'Forfait mensuel');
    if m % 2 = 0 then
      insert into public.actions (user_id, date, canal, action, montant, categorie, fournisseur, mode, notes)
      values (u, (date_trunc('month', current_date) - m * interval '1 month')::date + 10, 'Autre', 'Dépense', 50000, 'Publicité', 'Meta', 'Mobile Money', 'Publicité Instagram agence');
    end if;
  end loop;
end $$;
select (select count(*) from public.prospects where user_id='17ecf66e-9c89-4896-b7d4-a1446f037485') p,
       (select count(*) from public.actions where user_id='17ecf66e-9c89-4896-b7d4-a1446f037485') a,
       (select count(*) from public.documents where user_id='17ecf66e-9c89-4896-b7d4-a1446f037485') d,
       (select count(*) from public.actions where user_id='17ecf66e-9c89-4896-b7d4-a1446f037485' and date > current_date) futur;
