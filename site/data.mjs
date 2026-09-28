// Contenu du site agence-elite.fr (tiré du catalogue Agence Elite).
// Modifier ici puis relancer `node site/build.mjs` : toutes les pages sont régénérées.

export const SITE = {
  nom: 'Agence Elite',
  slogan: "L'innovation au service de votre succès",
  url: 'https://www.agence-elite.fr',
  tel1: '+242 06 909 46 11',
  tel2: '+242 06 808 38 09',
  whatsapp: '242069094611',
  email: 'contact@agence-elite.fr',
  adresse: '10 avenue Stéphane Tchitchelle, Centre-ville',
  ville: 'Pointe-Noire, République du Congo',
  bp: 'BP 761',
  instagram: 'https://www.instagram.com/agenceelitecg/',
  facebook: 'https://www.facebook.com/agenceelitecg',
  linkedin: 'https://www.linkedin.com/company/agenceelitecg',
}

// Familles du méga-menu « Nos solutions »
export const FAMILLES = [
  { id: 'communication', titre: 'Communication & marketing', slugs: ['communication-digitale', 'creation-graphique', 'creation-audiovisuelle', 'impression'] },
  { id: 'web', titre: 'Web & intelligence artificielle', slugs: ['agence-web', 'intelligence-artificielle'] },
  { id: 'tech', titre: 'Technologies & gestion', slugs: ['services-informatiques', 'microsoft-365', 'erp'] },
]

export const SOLUTIONS = [
  {
    slug: 'agence-web',
    photo: '1531482615713-2afd69097998',
    icone: 'web',
    categorie: 'Agence web',
    titre: 'Des sites internet qui travaillent pour vous',
    court: 'Sites vitrines, sites dynamiques et boutiques en ligne, visibles sur Google et simples à mettre à jour.',
    gain: 'Un site pensé pour transformer les visiteurs en clients',
    intro:
      "Votre site est souvent le premier contact entre vous et vos clients. Nous le concevons pour inspirer confiance, se charger vite sur mobile et vous apporter des demandes, pas seulement pour être beau.",
    services: [
      ['Site vitrine', 'Présentez votre activité, vos services et vos coordonnées avec un site clair et professionnel.'],
      ['Site dynamique', 'Réservations, espace client, formulaires : un site qui fait gagner du temps à votre équipe.'],
      ['E-commerce', 'Vendez en ligne avec paiement, gestion des produits et suivi des commandes.'],
      ['WordPress, HTML/CSS, PHP/JS', 'Intégration sur mesure ou sur WordPress, selon vos besoins et votre budget.'],
      ['SEO et Google Ads', 'Apparaissez quand vos clients vous cherchent, en naturel comme en publicité.'],
      ['Maintenance', 'Mises à jour, sauvegardes et évolutions du back-office comme du front-office.'],
    ],
    benefices: [
      ['Visible sur Google', 'Référencement local pour être trouvé à Pointe-Noire, Brazzaville et au-delà.'],
      ['Pensé pour le mobile', 'La majorité de vos visiteurs arrivent depuis leur téléphone.'],
      ['Autonome', 'Vous modifiez vos textes et vos photos sans dépendre de nous.'],
    ],
    faq: [
      ['Combien de temps faut-il pour créer un site ?', "Un site vitrine est généralement en ligne en deux à quatre semaines, selon la rapidité de réception des contenus. Un site e-commerce demande plus de temps : nous fixons un planning précis dès le devis."],
      ['Pourrai-je modifier mon site moi-même ?', 'Oui. Nous vous formons à la mise à jour des textes, des photos et des produits.'],
      ['Vous occupez-vous du nom de domaine et de l\'hébergement ?', 'Oui, nous pouvons tout prendre en charge : nom de domaine, hébergement, adresses e-mail professionnelles et certificat de sécurité.'],
    ],
    image: 'equipe.webp',
  },
  {
    slug: 'communication-digitale',
    photo: '1634313946050-3fefb86a710b',
    icone: 'megaphone',
    categorie: 'Communication digitale',
    titre: 'Des réseaux sociaux qui font grandir votre marque',
    court: "Audit, gestion et animation de vos réseaux sociaux, modération, publicité et analyse des résultats.",
    gain: 'Une présence régulière et mesurée sur les réseaux',
    intro:
      "Dans un monde où l'image est roi, la première impression est cruciale. La communication n'est pas qu'une question d'esthétique : il s'agit de raconter votre histoire, de façonner votre identité de marque et d'interagir efficacement avec votre public.",
    services: [
      ['Audit des réseaux sociaux', 'Ce qui fonctionne, ce qui freine et les priorités pour vos comptes.'],
      ['Gestion et animation', 'Calendrier éditorial, création des publications et réponses à votre communauté.'],
      ['Modération', 'Commentaires et messages traités avec le ton de votre marque.'],
      ['Sponsoring de publications', 'Campagnes Facebook et Instagram ciblées sur vos clients potentiels.'],
      ['Analyses statistiques', "Rapports clairs : portée, engagement, demandes générées."],
      ['Veille sectorielle', 'Ce que font vos concurrents et les tendances de votre marché.'],
    ],
    benefices: [
      ['Régularité', 'Vos comptes vivent chaque semaine, même quand vous êtes débordé.'],
      ['Ciblage', 'Vos publicités touchent les bonnes personnes, dans la bonne ville.'],
      ['Résultats mesurés', "Chaque mois, vous savez ce que la communication vous a rapporté."],
    ],
    faq: [
      ['Quels réseaux gérez-vous ?', 'Facebook, Instagram, LinkedIn, TikTok et WhatsApp Business, selon là où se trouvent vos clients.'],
      ['Le budget publicitaire est-il compris ?', 'Non, il est séparé de notre accompagnement. Nous vous conseillons un montant adapté à vos objectifs.'],
      ['Puis-je valider les publications avant diffusion ?', 'Oui, nous vous présentons le calendrier et les visuels à l\'avance.'],
    ],
    image: 'communication.webp',
  },
  {
    slug: 'creation-graphique',
    photo: '1655720348598-526764cd2bca',
    icone: 'pen',
    categorie: 'Création graphique',
    titre: 'Une identité visuelle qui vous ressemble',
    court: 'Logos, chartes graphiques, flyers, affiches, plaquettes, catalogues, kakemonos et GIFs animés.',
    gain: 'Une image professionnelle et cohérente sur tous vos supports',
    intro:
      "Votre identité visuelle est la première chose que vos clients retiennent. Nous créons des supports cohérents, du logo jusqu'au roll-up, pour que votre marque soit reconnue au premier coup d'œil.",
    services: [
      ['Logo et charte graphique', 'Un logo unique et les règles pour l\'utiliser partout.'],
      ['Supports imprimés', 'Flyers, affiches, cartes de visite, cartes de mariage, calendriers.'],
      ["Documents d'entreprise", "Plaquettes, catalogues de services, dépliants."],
      ['Signalétique', 'Kakemonos, roll-ups, badges et pictogrammes.'],
      ['Visuels animés', 'GIFs animés et visuels pour vos réseaux sociaux.'],
    ],
    benefices: [
      ['Cohérence', 'Les mêmes couleurs et le même ton sur tous vos supports.'],
      ['Crédibilité', 'Une image soignée rassure vos clients et vos partenaires.'],
      ['Prêt à imprimer', 'Fichiers livrés aux bons formats, pour l\'impression comme pour le web.'],
    ],
    faq: [
      ['Combien de propositions de logo recevrai-je ?', 'Nous présentons plusieurs pistes, puis nous affinons celle que vous choisissez jusqu\'à votre validation.'],
      ['Recevrai-je les fichiers sources ?', 'Oui, vous êtes propriétaire de votre identité visuelle et recevez tous les fichiers.'],
    ],
    image: 'graphisme.webp',
  },
  {
    slug: 'creation-audiovisuelle',
    photo: '1771402899941-155687f230be',
    icone: 'camera',
    categorie: 'Création audiovisuelle',
    titre: 'Des vidéos qui racontent votre histoire',
    court: 'Spots publicitaires, motion design, films corporatifs, interviews, reportages et documentaires.',
    gain: 'Des vidéos qui captent l\'attention en quelques secondes',
    intro:
      "La vidéo est le format qui retient le plus l'attention. Du storyboard au montage final, nous produisons des contenus percutants pour la télévision, la radio et les réseaux sociaux.",
    services: [
      ['Spots publicitaires', 'Spots TV, radio et réseaux sociaux, du script à la diffusion.'],
      ['Motion design', 'Animations graphiques pour expliquer une offre simplement.'],
      ['Films corporatifs', "Présentez votre entreprise, vos équipes et vos réalisations."],
      ['Interviews et reportages', 'Témoignages clients, événements, portraits de dirigeants.'],
      ['Documentaires', 'Des formats longs et immersifs pour raconter un projet.'],
      ['Storyboard et scénario', 'Conception artistique et rédaction avant le tournage.'],
    ],
    benefices: [
      ['Impact', 'Un message compris et retenu en quelques secondes.'],
      ['Tous formats', 'Versions longues, courtes, verticales pour les réseaux.'],
      ['Clé en main', 'Écriture, tournage, montage et sous-titrage.'],
    ],
    faq: [
      ['Tournez-vous en dehors de Pointe-Noire ?', 'Oui, nous nous déplaçons à Brazzaville et dans tout le pays selon le projet.'],
      ['Pouvez-vous gérer la diffusion TV et radio ?', 'Nous livrons les formats demandés par les chaînes et pouvons vous accompagner dans la diffusion.'],
    ],
    image: null,
  },
  {
    slug: 'impression',
    icone: 'print',
    categorie: 'Impression tous supports',
    titre: 'Impression de qualité, impact inoubliable',
    court: "Cartes de visite, affiches, bâches, kakemonos, textiles, objets publicitaires : tout imprimer au même endroit.",
    gain: 'Des supports imprimés qui vous démarquent',
    intro:
      "Notre service d'impression tous supports répond à tous vos besoins, que ce soit pour promouvoir votre entreprise, vos événements ou vos produits. Nous vous conseillons sur le support, la finition et la quantité.",
    services: [
      ['Papeterie', 'Cartes de visite, en-têtes, carnets, plaquettes et dépliants.'],
      ['Grand format', 'Affiches, bâches, banderoles, kakemonos, roll-ups et beach flags.'],
      ['Textile', 'Polos, t-shirts et casquettes brodés ou imprimés à votre logo.'],
      ['Objets publicitaires', 'Mugs, badges, stylos et cadeaux d\'entreprise.'],
      ['Signalétique et sécurité', 'Pictogrammes et panneaux conformes pour vos locaux.'],
    ],
    benefices: [
      ['Un seul interlocuteur', 'De la création graphique à la livraison.'],
      ['Conseil', 'Le bon support et la bonne finition pour votre budget.'],
      ['Devis rapide', 'Envoyez votre besoin, nous revenons vers vous avec un prix clair.'],
    ],
    faq: [
      ['Faut-il fournir un fichier prêt à imprimer ?', "Ce n'est pas obligatoire : notre équipe graphique peut créer ou adapter votre visuel."],
      ['Y a-t-il une quantité minimum ?', 'Cela dépend du support. Nous vous indiquons les quantités les plus avantageuses dans le devis.'],
    ],
    image: 'impression.webp',
    galerie: [
      ['cartes.webp', 'Cartes de visite'],
      ['kakemono.webp', 'Kakemonos'],
      ['polo.webp', 'Polos brodés'],
      ['casquette.webp', 'Casquettes'],
      ['mugs.webp', 'Mugs'],
      ['badges.webp', 'Badges'],
      ['banderole.webp', 'Banderoles'],
      ['beach-flag.webp', 'Beach flags'],
      ['carnets.webp', 'Carnets'],
      ['plaquette.webp', 'Plaquettes'],
    ],
  },
  {
    slug: 'intelligence-artificielle',
    photo: '1652702954883-622efc786f70',
    icone: 'spark',
    categorie: 'Intelligence artificielle',
    titre: "L'intelligence artificielle au service de votre activité",
    court: 'Assistants WhatsApp et chatbots, automatisation des tâches répétitives et analyse de vos données.',
    gain: 'Répondre plus vite à vos clients, 24 h sur 24',
    intro:
      "L'intelligence artificielle n'est plus réservée aux grandes entreprises. Nous l'intégrons à vos outils du quotidien pour répondre plus vite à vos clients, gagner du temps sur les tâches répétitives et mieux décider.",
    services: [
      ['Assistants conversationnels', 'Un chatbot sur votre site ou WhatsApp qui répond aux questions fréquentes et prend des rendez-vous.'],
      ['Automatisation', 'Relances, devis, rapports et saisies répétitives faits automatiquement.'],
      ['Contenus assistés par IA', 'Textes, visuels et vidéos produits plus vite, relus par nos équipes.'],
      ['Analyse de données', 'Tableaux de bord qui mettent en avant ce qui compte pour vos décisions.'],
    ],
    benefices: [
      ['Disponibilité', 'Vos clients obtiennent une réponse même en dehors des heures d\'ouverture.'],
      ['Temps gagné', 'Votre équipe se concentre sur les tâches à forte valeur.'],
      ['Données maîtrisées', 'Nous choisissons des outils qui respectent la confidentialité de vos données.'],
    ],
    faq: [
      ['Faut-il des compétences techniques ?', 'Non. Nous installons, paramétrons et formons votre équipe.'],
      ['Un chatbot peut-il répondre en français et en lingala ?', 'Il peut répondre en plusieurs langues. Nous testons ensemble les réponses avant la mise en service.'],
    ],
    image: 'collaboration.webp',
  },
  {
    slug: 'services-informatiques',
    photo: '1728167087497-23d18400d6b9',
    icone: 'chip',
    categorie: 'Services informatiques',
    titre: 'Votre partenaire technologique',
    court: 'Applications sur mesure, bases de données, cybersécurité, cloud, big data et support technique.',
    gain: 'Une informatique fiable qui ne vous freine plus',
    intro:
      "Nous comprenons l'importance critique de la technologie pour le succès de votre entreprise. C'est pourquoi nous offrons une gamme complète de services informatiques et de support pour répondre à tous vos besoins.",
    services: [
      ['Business intelligence et big data', "L'exploitation de vos données pour des décisions stratégiques éclairées."],
      ['Systèmes et réseaux', 'La gestion et la maintenance de vos infrastructures pour une performance optimale.'],
      ['Cybersécurité', 'La protection de votre entreprise contre les menaces et la sécurité de vos données.'],
      ['Cloud computing', "L'adoption de solutions cloud pour plus d'agilité et de flexibilité."],
      ['Applications sur mesure', 'Des logiciels adaptés à vos processus, et la gestion de vos bases de données.'],
      ['Support technique proactif', 'Nous surveillons et intervenons avant que la panne ne vous arrête.'],
    ],
    benefices: [
      ['Continuité', 'Moins de pannes, des sauvegardes vérifiées.'],
      ['Sécurité', 'Vos données et vos accès sont protégés.'],
      ['Un seul contact', 'Un interlocuteur pour tout votre parc informatique.'],
    ],
    faq: [
      ['Intervenez-vous sur site ?', 'Oui, sur site à Pointe-Noire et à distance pour le reste du pays.'],
      ['Proposez-vous des contrats de maintenance ?', 'Oui, avec des visites régulières et une assistance prioritaire.'],
    ],
    image: 'informatique.webp',
    illustrations: [
      ['big-data.webp', 'Business intelligence et big data'],
      ['systemes.webp', 'Systèmes et réseaux'],
      ['cybersecurite.webp', 'Cybersécurité'],
      ['cloud.webp', 'Cloud computing'],
    ],
  },
  {
    slug: 'microsoft-365',
    photo: '1573497161249-42447f9f6706',
    icone: 'cloud',
    categorie: 'Microsoft 365',
    titre: 'Optimisez votre productivité avec Microsoft 365',
    court: 'Intégration, migration et formation à Microsoft 365 : Outlook, Teams, SharePoint, OneDrive.',
    gain: 'Travailler ensemble, partout, en toute sécurité',
    intro:
      "Microsoft 365 offre une gamme complète d'outils de productivité et de collaboration dans le cloud. Que vous soyez une petite entreprise ou une grande organisation, nous vous aidons à en exploiter tous les avantages.",
    services: [
      ['Accessibilité', 'Vos applications Office depuis n\'importe où, à tout moment, sur n\'importe quel appareil.'],
      ['Sécurité et conformité', 'Des fonctionnalités de sécurité avancées pour protéger vos données.'],
      ['Mises à jour continues', 'Toujours la dernière version des applications, sans réinstallation.'],
      ['Collaboration en temps réel', 'Travaillez à plusieurs sur les mêmes documents, où que vous soyez.'],
    ],
    etapes: [
      ['Évaluation des besoins', 'Comprendre les besoins de votre entreprise et déterminer la configuration la plus appropriée.'],
      ['Planification', "Un plan d'intégration détaillé, incluant la migration des données et la formation."],
      ['Mise en œuvre', 'Création des comptes, migration des e-mails et des fichiers, sécurisation.'],
      ['Formation et support', 'Formation de vos employés et support continu pour une adoption fluide.'],
    ],
    benefices: [
      ['Mobilité', 'Vos fichiers et e-mails vous suivent partout.'],
      ['Moins de risques', 'Sauvegarde et sécurité gérées dans le cloud.'],
      ['Adoption réussie', 'Vos équipes sont formées et accompagnées.'],
    ],
    faq: [
      ['Pouvez-vous migrer nos anciennes adresses e-mail ?', 'Oui, nous migrons vos e-mails, contacts et calendriers sans perte.'],
      ['Quelle licence choisir ?', 'Nous comparons avec vous les offres Business Basic, Standard et Premium selon vos usages.'],
    ],
    image: 'visio.webp',
  },
  {
    slug: 'erp',
    photo: '1687422808311-a776f467a468',
    icone: 'grid',
    categorie: 'Solution de gestion intégrée',
    titre: 'Un ERP pour automatiser la gestion de votre entreprise',
    court: 'Comptabilité, ressources humaines, achats, stocks et ventes réunis dans un seul outil.',
    gain: 'Toute votre entreprise pilotée depuis un seul outil',
    intro:
      "Notre solution de gestion intégrée ne se contente pas de numériser votre entreprise : elle la transforme en une machine bien huilée, avec une répartition claire des responsabilités.",
    services: [
      ['Module comptabilité', 'Enregistrez les transactions en quelques clics et gérez clients et fournisseurs au même endroit.'],
      ['Module RH', 'Recrutement, évaluations, feuilles de temps, contrats, présence et paie.'],
      ['Achats, stocks et ventes', 'Suivi des commandes, niveaux de stock et chiffre d\'affaires en temps réel.'],
      ['Rapports instantanés', 'Des graphiques pour chaque aspect de votre activité, sans ressaisie.'],
    ],
    benefices: [
      ['Optimisez vos processus', "Les opérations quotidiennes sont automatisées."],
      ['Générez des rapports rapidement', 'Toutes vos données sont centralisées.'],
      ['Simplifiez vos opérations', 'Chacun sait ce qu\'il a à faire.'],
      ['Améliorez vos services', 'Clients, employés et fournisseurs sont mieux servis.'],
    ],
    faq: [
      ['Peut-on commencer avec un seul module ?', 'Oui, vous démarrez par le module le plus utile et ajoutez les autres ensuite.'],
      ['Nos données actuelles peuvent-elles être reprises ?', 'Oui, nous importons vos fichiers Excel et vos historiques existants.'],
    ],
    image: 'erp-photo.webp',
    illustrations: [
      ['comptabilite.webp', 'Module comptabilité'],
      ['rh.webp', 'Module RH'],
      ['erp.webp', 'Gestion intégrée'],
    ],
  },
]

export const SECTEURS = [
  { slug: 'commerce', photo: '1687422808565-929533931584', icone: 'bag', titre: 'Commerce et distribution', besoin: "Attirer du monde en boutique, vendre en ligne et suivre vos stocks.", solutions: ['communication-digitale', 'agence-web', 'erp', 'impression'] },
  { slug: 'restauration', photo: '1687422808277-2334638f09fb', icone: 'fork', titre: 'Restauration et hôtellerie', besoin: 'Remplir vos tables et vos chambres, recevoir des réservations et soigner vos avis.', solutions: ['communication-digitale', 'agence-web', 'creation-audiovisuelle', 'intelligence-artificielle'] },
  { slug: 'sante-beaute', photo: '1702236240794-58dc4c6895e5', icone: 'heart', titre: 'Santé, beauté et bien-être', besoin: 'Prise de rendez-vous en ligne, image rassurante et fidélisation de la clientèle.', solutions: ['agence-web', 'communication-digitale', 'creation-graphique', 'intelligence-artificielle'] },
  { slug: 'immobilier-btp', photo: '1621905251918-48416bd8575a', icone: 'building', titre: 'Immobilier et BTP', besoin: 'Présenter vos biens et vos chantiers, générer des contacts qualifiés.', solutions: ['agence-web', 'creation-audiovisuelle', 'impression', 'erp'] },
  { slug: 'transport-logistique', photo: '1573207535342-8c0f9506112e', icone: 'truck', titre: 'Transport et logistique', besoin: 'Suivi des opérations, informatique fiable et image professionnelle auprès des clients.', solutions: ['services-informatiques', 'erp', 'microsoft-365', 'creation-graphique'] },
  { slug: 'industrie-energie', photo: '1621905251189-08b45d6a269e', icone: 'factory', titre: 'Industrie, pétrole et énergie', besoin: 'Sécurité des données, signalétique conforme et outils collaboratifs pour les équipes.', solutions: ['services-informatiques', 'microsoft-365', 'impression', 'creation-audiovisuelle'] },
  { slug: 'services-conseil', photo: '1573164574511-73c773193279', icone: 'briefcase', titre: 'Services et cabinets conseil', besoin: 'Crédibilité, organisation interne et visibilité auprès des décideurs.', solutions: ['agence-web', 'microsoft-365', 'creation-graphique', 'intelligence-artificielle'] },
  { slug: 'associations-ong', photo: '1783408355447-b01a88767e6a', icone: 'hands', titre: 'Associations et ONG', besoin: 'Faire connaître vos actions, mobiliser les donateurs et rendre compte des résultats.', solutions: ['communication-digitale', 'creation-audiovisuelle', 'agence-web', 'impression'] },
  { slug: 'education', photo: '1632215861513-130b66fe97f4', icone: 'cap', titre: 'Éducation et formation', besoin: 'Recruter des élèves, communiquer avec les familles et outiller les équipes.', solutions: ['agence-web', 'communication-digitale', 'microsoft-365', 'erp'] },
]

export const VALEURS = [
  ['Créativité', "Nous croyons en la puissance de l'innovation et de la créativité pour donner vie aux idées les plus audacieuses."],
  ['Engagement', 'Nous travaillons en étroite collaboration avec nos clients pour comprendre leurs besoins et les aider à atteindre leurs objectifs.'],
  ['Satisfaction client', "Votre réussite est notre moteur : nous restons à vos côtés bien après la livraison du projet."],
  ['Qualité', "Chaque projet est guidé par un engagement inébranlable envers l'excellence, du premier échange au dernier détail."],
]

export const PARTENAIRES = [
  ['ortec', 'Ortec Group'],
  ['stp2i', 'STP2I'],
  ['friedlander', 'Friedlander Industrie Congo'],
  ['sle-loango', 'SLE Loango Environnement'],
  ['sgsp', 'SGSP'],
  ['wbc', 'Winner Business Consulting'],
  ['excelis-services', 'Excelis Services'],
  ['zoko-village', 'Zoko Village'],
  ['easy-life', 'Easy Life'],
  ['transport-tm', 'Transport TM'],
  ['association-sodios', 'Association SO.DI.OS'],
  ['floyesh', 'Floyesh'],
  ['sihao-transit', 'Sihao Transit'],
  ['levy-services', 'Levy Services'],
  ['sam-service-africa', 'Sam Service Africa'],
]

// Photos libres de droits (licence Unsplash), affichées depuis images.unsplash.com
export const PHOTOS = {
  hero: ['1655720357872-ce227e4164ba', 'Équipe réunie autour d\'un ordinateur portable dans un bureau'],
  cta: ['1521791136064-7986c2920216', 'Poignée de main entre un client et un conseiller'],
  terrain: [
    ['1761370571806-886404629697', 'Commerçant dans sa boutique'],
    ['1717089256239-dc2ed4d9dfc6', 'Barbier au travail dans son salon'],
    ['1648977910041-f263fda3f0fe', 'Vidéaste en tournage'],
    ['1642929295388-81948818c28f', 'Femme travaillant sur une tablette au bureau'],
  ],
  agence: [
    ['1573164574572-cb89e39749b4', 'Équipe en réunion autour d\'une table'],
    ['1573166953836-06864dc70a21', 'Professionnelle travaillant sur son ordinateur'],
    ['1612299273045-362a39972259', 'Échange en visioconférence'],
    ['1528901166007-3784c7dd3653', 'Développeurs travaillant ensemble'],
    ['1634246386903-2098864bb3b1', 'Créative au travail avec son casque'],
    ['1573164574397-dd250bc8a598', 'Trois collègues travaillant ensemble'],
  ],
}
export const CREDITS_PHOTOS =
  'Iwaria Inc., Christina Morillo (WOCinTech Chat), X (@disruptxn), Oyemike Princewill, Francis Odeyemi, Moise M, Ben Iwara, Ufoma Ojo, Micheal Ogungbe, Johnnathan Tshibangu, Emmanuel Ikwuegbu, Good Faces, Ali Mkumbwa, Muhammad-Taha Ibrahim, Cytonn Photography, Patrick Marah, Ace Maxwell, Emmanuel M, Reproductive Health Supplies Coalition'
