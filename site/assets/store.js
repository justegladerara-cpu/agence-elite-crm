// Elite Store : catalogue, fiche produit, panier et commande.
// Les produits sont lus dans la base du CRM ; la commande passe par la fonction store_passer_commande,
// qui relit les prix en base : le navigateur ne décide jamais du montant.
;(function () {
  var C = window.AE_STORE
  var base = C.base
  var PANIER = 'ae-panier'
  var params = new URLSearchParams(location.search)
  try {
    if (params.get('demo') === '1') sessionStorage.setItem('ae-demo', '1')
    if (params.get('demo') === '0') sessionStorage.removeItem('ae-demo')
  } catch (e) {
    /* navigation privée : pas de mode démo mémorisé */
  }
  var demo = (function () {
    try {
      return sessionStorage.getItem('ae-demo') === '1'
    } catch (e) {
      return params.get('demo') === '1'
    }
  })()

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  var fcfa = function (n) {
    return Number(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA'
  }
  var ICO = {
    panier: '<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    moins: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    poubelle: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    cle: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    compte: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    service: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  }
  var ico = function (n) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[n] + '</svg>'
  }
  // Couleurs des vignettes par éditeur (aucun logo de marque n'est reproduit)
  var TEINTES = {
    Microsoft: ['#0a58ca', '#4f9bff'],
    Google: ['#1a73e8', '#34a853'],
    Adobe: ['#b3001b', '#ff4b4b'],
    Kaspersky: ['#006d5b', '#29c7a0'],
    ESET: ['#0c5f73', '#2fb5c9'],
    Bitdefender: ['#1b1b1f', '#e1261c'],
    Norton: ['#1b1b1f', '#f5b800'],
    Canva: ['#6a2cf5', '#20c4cb'],
    Autodesk: ['#111', '#6b6b78'],
    Zoom: ['#0b5cff', '#6aa2ff'],
    'Agence Elite': ['#0b0b0f', '#e10600'],
  }
  var vignette = function (p, grand) {
    var t = TEINTES[p.editeur] || ['#2b2b35', '#6b6b78']
    var sigle = (p.editeur || p.nom)
      .split(/\s+/)
      .map(function (m) {
        return m[0]
      })
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return (
      '<div class="vignette' + (grand ? ' grande' : '') + '" style="background:linear-gradient(135deg,' + t[0] + ',' + t[1] + ')">' +
      (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '<span class="v-sigle">' + esc(sigle) + '</span>') +
      '<span class="v-editeur">' + esc(p.editeur || '') + '</span></div>'
    )
  }
  var LIVRAISON = {
    cle: ['cle', 'Clé de licence envoyée par e-mail ou WhatsApp, installation possible par nos techniciens'],
    compte: ['compte', 'Abonnement activé sur votre adresse e-mail professionnelle'],
    service: ['service', 'Projet lancé après un premier échange avec notre équipe'],
  }

  // ---------- Accès à la base ----------
  var api = function (chemin, options) {
    options = options || {}
    // Aperçu de branche : aucune base branchée, la boutique affiche son état « indisponible »
    if (!C.url) return Promise.reject(new Error('Boutique indisponible dans cet aperçu'))
    return fetch(C.url + '/rest/v1/' + chemin, {
      method: options.method || 'GET',
      headers: { apikey: C.cle, Authorization: 'Bearer ' + C.cle, 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && (data.message || data.hint)) || 'Erreur ' + res.status)
        return data
      })
    })
  }
  var CHAMPS = 'slug,categorie,nom,editeur,resume,duree,appareils,prix,prix_barre,periode,image,livraison,vedette'
  var catalogue = function () {
    return api('store_produits?select=' + CHAMPS + '&actif=eq.true&order=ordre.asc,nom.asc')
  }

  // ---------- Panier (stocké dans le navigateur) ----------
  var lirePanier = function () {
    try {
      return JSON.parse(localStorage.getItem(PANIER) || '[]').filter(function (l) {
        return l && l.slug
      })
    } catch (e) {
      return []
    }
  }
  var ecrirePanier = function (l) {
    try {
      localStorage.setItem(PANIER, JSON.stringify(l))
    } catch (e) {
      /* stockage plein ou bloqué */
    }
    majBadge()
  }
  var majBadge = function () {
    var n = lirePanier().reduce(function (m, l) {
      return m + (l.qte || 1)
    }, 0)
    var b = document.getElementById('panier-nb')
    if (b) {
      b.textContent = n
      b.hidden = !n
    }
  }
  var ajouter = function (slug, qte) {
    var l = lirePanier()
    var x = l.find(function (y) {
      return y.slug === slug
    })
    if (x) x.qte = Math.min(50, (x.qte || 1) + (qte || 1))
    else l.push({ slug: slug, qte: qte || 1 })
    ecrirePanier(l)
  }
  var toast = function (html) {
    var t = document.createElement('div')
    t.className = 'store-toast'
    t.setAttribute('role', 'status')
    t.innerHTML = html
    document.body.appendChild(t)
    setTimeout(function () {
      t.classList.add('sort')
    }, 2600)
    setTimeout(function () {
      t.remove()
    }, 3000)
  }
  var ajoute = function (p) {
    toast(ico('check') + '<span><strong>' + esc(p.nom) + '</strong> ajouté au panier</span><a href="' + base + 'boutique/panier/">Voir le panier</a>')
  }
  var erreurChargement = function (el) {
    el.innerHTML =
      '<p class="store-charge">Le catalogue est momentanément indisponible. Commandez sur <a href="https://wa.me/' + C.wa + '" target="_blank" rel="noopener">WhatsApp</a>.</p>'
  }

  var carte = function (p) {
    var lien = base + 'boutique/produit/?p=' + encodeURIComponent(p.slug)
    return (
      '<article class="produit" data-cat="' + esc(p.categorie) + '">' +
      '<a class="pr-lien" href="' + lien + '">' + vignette(p) + (p.vedette ? '<span class="pr-badge">Populaire</span>' : '') + '</a>' +
      '<span class="pr-cat">' + esc(p.categorie) + '</span>' +
      '<h3><a href="' + lien + '">' + esc(p.nom) + '</a></h3>' +
      '<p class="pr-desc">' + esc(p.resume || '') + '</p>' +
      '<p class="pr-meta">' + [p.duree, p.appareils].filter(Boolean).map(esc).join(' · ') + '</p>' +
      '<p class="pr-prix">' + (p.prix_barre ? '<s>' + fcfa(p.prix_barre) + '</s> ' : '') + '<strong>' + fcfa(p.prix) + '</strong> <span>' + esc(p.periode) + '</span></p>' +
      '<div class="pr-actions"><button class="btn btn-rouge" data-ajout="' + esc(p.slug) + '">' + ico('panier') + ' Ajouter</button>' +
      '<a class="btn btn-ligne" href="' + lien + '">Détails</a></div></article>'
    )
  }

  // ---------- Catalogue ----------
  var grille = document.getElementById('store-grille')
  if (grille) {
    catalogue()
      .then(function (produits) {
        var cats = []
        produits.forEach(function (p) {
          if (cats.indexOf(p.categorie) < 0) cats.push(p.categorie)
        })
        var zoneCats = document.getElementById('store-cats')
        var cat = params.get('categorie') || ''
        var q = ''
        zoneCats.innerHTML = ['']
          .concat(cats)
          .map(function (c) {
            return '<button class="filtre" data-filtre="' + esc(c) + '">' + (c ? esc(c) : 'Tout') + '</button>'
          })
          .join('')
        var sans = function (s) {
          return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        }
        var afficher = function () {
          var liste = produits.filter(function (p) {
            if (cat && p.categorie !== cat) return false
            if (!q) return true
            return sans([p.nom, p.editeur, p.categorie, p.resume].join(' ')).indexOf(sans(q)) >= 0
          })
          zoneCats.querySelectorAll('.filtre').forEach(function (b) {
            b.classList.toggle('actif', b.getAttribute('data-filtre') === cat)
          })
          document.getElementById('store-compte').textContent = liste.length + ' produit' + (liste.length > 1 ? 's' : '')
          grille.innerHTML = liste.length ? liste.map(carte).join('') : '<p class="store-charge">Aucun produit ne correspond. Demandez-nous sur WhatsApp : nous trouvons la licence qu\'il vous faut.</p>'
        }
        zoneCats.addEventListener('click', function (e) {
          var b = e.target.closest('.filtre')
          if (!b) return
          cat = b.getAttribute('data-filtre')
          afficher()
        })
        document.getElementById('store-recherche').addEventListener('input', function (e) {
          q = e.target.value.trim()
          afficher()
        })
        grille.addEventListener('click', function (e) {
          var b = e.target.closest('[data-ajout]')
          if (!b) return
          var p = produits.find(function (x) {
            return x.slug === b.getAttribute('data-ajout')
          })
          ajouter(p.slug, 1)
          ajoute(p)
        })
        afficher()
      })
      .catch(function () {
        erreurChargement(grille)
      })
  }

  // ---------- Fiche produit ----------
  var fiche = document.getElementById('store-fiche')
  if (fiche) {
    var slug = params.get('p') || ''
    api('store_produits?select=' + CHAMPS + ',description,inclus&actif=eq.true&slug=eq.' + encodeURIComponent(slug))
      .then(function (r) {
        var p = r[0]
        if (!p) {
          fiche.innerHTML = '<p class="store-charge">Ce produit n\'est plus disponible. <a href="' + base + 'boutique/">Voir la boutique</a></p>'
          return
        }
        document.title = p.nom + ' | Elite Store | Agence Elite'
        document.getElementById('fil-produit').textContent = p.nom
        var liv = LIVRAISON[p.livraison] || LIVRAISON.cle
        fiche.innerHTML =
          '<div class="fiche-grille">' +
          '<div>' + vignette(p, true) + '</div>' +
          '<div class="fiche-infos">' +
          '<p class="pr-cat">' + esc(p.categorie) + ' · ' + esc(p.editeur || '') + '</p>' +
          '<h1>' + esc(p.nom) + '</h1>' +
          '<p class="hero-lead">' + esc(p.resume || '') + '</p>' +
          (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
          '<dl class="fiche-kv">' +
          (p.duree ? '<div><dt>Durée</dt><dd>' + esc(p.duree) + '</dd></div>' : '') +
          (p.appareils ? '<div><dt>Appareils</dt><dd>' + esc(p.appareils) + '</dd></div>' : '') +
          '<div><dt>Livraison</dt><dd>' + ico(liv[0]) + ' ' + esc(liv[1]) + '</dd></div></dl>' +
          (p.inclus && p.inclus.length ? '<ul class="pr-inclus">' + p.inclus.map(function (x) { return '<li>' + ico('check') + esc(x) + '</li>' }).join('') + '</ul>' : '') +
          '<div class="fiche-achat">' +
          '<p class="pr-prix">' + (p.prix_barre ? '<s>' + fcfa(p.prix_barre) + '</s> ' : '') + '<strong>' + fcfa(p.prix) + '</strong> <span>' + esc(p.periode) + '</span></p>' +
          '<div class="qte" role="group" aria-label="Quantité"><button type="button" data-q="-1" aria-label="Diminuer">' + ico('moins') + '</button><input id="qte" type="number" min="1" max="50" value="1" aria-label="Quantité"><button type="button" data-q="1" aria-label="Augmenter">' + ico('plus') + '</button></div>' +
          '<div class="boutons"><button class="btn btn-rouge" id="btn-ajout">' + ico('panier') + ' Ajouter au panier</button><button class="btn btn-ligne" id="btn-acheter">Acheter maintenant</button></div>' +
          '<a class="lien-fleche" href="https://wa.me/' + C.wa + '?text=' + encodeURIComponent('Bonjour Agence Elite, j\'ai une question sur : ' + p.nom + '.') + '" target="_blank" rel="noopener">Une question ? Écrivez-nous sur WhatsApp ' + ico('fleche') + '</a>' +
          '</div></div></div>'
        var champQ = document.getElementById('qte')
        fiche.querySelectorAll('[data-q]').forEach(function (b) {
          b.addEventListener('click', function () {
            champQ.value = Math.max(1, Math.min(50, (parseInt(champQ.value, 10) || 1) + parseInt(b.getAttribute('data-q'), 10)))
          })
        })
        var qte = function () {
          return Math.max(1, Math.min(50, parseInt(champQ.value, 10) || 1))
        }
        document.getElementById('btn-ajout').addEventListener('click', function () {
          ajouter(p.slug, qte())
          ajoute(p)
        })
        document.getElementById('btn-acheter').addEventListener('click', function () {
          ajouter(p.slug, qte())
          location.href = base + 'boutique/panier/'
        })
        // Produits de la même catégorie
        return catalogue().then(function (tous) {
          var sim = tous
            .filter(function (x) {
              return x.categorie === p.categorie && x.slug !== p.slug
            })
            .slice(0, 3)
          if (!sim.length) return
          var zone = document.getElementById('store-similaires')
          zone.innerHTML = '<h2 class="sim-titre">Dans la même catégorie</h2><div class="grille-produits">' + sim.map(carte).join('') + '</div>'
          zone.addEventListener('click', function (e) {
            var b = e.target.closest('[data-ajout]')
            if (!b) return
            var x = sim.find(function (y) {
              return y.slug === b.getAttribute('data-ajout')
            })
            ajouter(x.slug, 1)
            ajoute(x)
          })
        })
      })
      .catch(function () {
        erreurChargement(fiche)
      })
  }

  // ---------- Panier et commande ----------
  var caisse = document.getElementById('store-caisse')
  if (caisse) {
    var produits = {}
    var zoneLignes = document.getElementById('panier-lignes')
    var form = document.getElementById('form-commande')
    var btn = document.getElementById('btn-commander')
    var erreur = document.getElementById('commande-erreur')
    if (demo) {
      document.getElementById('store-demo').hidden = false
      var radioCarte = form.querySelector('input[value=carte]')
      radioCarte.disabled = false
      radioCarte.checked = true
      document.getElementById('carte-info').textContent = 'Démonstration : carte de test, aucun débit.'
    }
    var majCarte = function () {
      document.getElementById('carte-test').hidden = !(demo && form.paiement.value === 'carte')
    }
    form.addEventListener('change', majCarte)
    majCarte()

    var total = function () {
      return lirePanier().reduce(function (m, l) {
        var p = produits[l.slug]
        return m + (p ? p.prix * l.qte : 0)
      }, 0)
    }
    var rendre = function () {
      var l = lirePanier().filter(function (x) {
        return produits[x.slug]
      })
      if (!l.length) {
        zoneLignes.innerHTML = '<p class="petit">Votre panier est vide. <a href="' + base + 'boutique/">Découvrir la boutique</a></p>'
        btn.disabled = true
      } else {
        btn.disabled = false
        zoneLignes.innerHTML = l
          .map(function (x) {
            var p = produits[x.slug]
            return (
              '<div class="ligne-panier">' + vignette(p) +
              '<div class="lp-infos"><strong>' + esc(p.nom) + '</strong><small>' + fcfa(p.prix) + ' ' + esc(p.periode) + '</small>' +
              '<div class="qte petite" role="group" aria-label="Quantité de ' + esc(p.nom) + '"><button type="button" data-moins="' + esc(p.slug) + '" aria-label="Diminuer">' + ico('moins') + '</button><span>' + x.qte + '</span><button type="button" data-plus="' + esc(p.slug) + '" aria-label="Augmenter">' + ico('plus') + '</button></div></div>' +
              '<div class="lp-droite"><strong>' + fcfa(p.prix * x.qte) + '</strong><button type="button" class="lp-suppr" data-suppr="' + esc(p.slug) + '" aria-label="Retirer ' + esc(p.nom) + '">' + ico('poubelle') + '</button></div></div>'
            )
          })
          .join('')
      }
      document.getElementById('panier-total').textContent = fcfa(total())
      btn.textContent = demo && form.paiement.value === 'carte' ? 'Payer ' + fcfa(total()) : 'Valider la commande'
    }
    form.addEventListener('change', rendre)
    zoneLignes.addEventListener('click', function (e) {
      var b = e.target.closest('button')
      if (!b) return
      var l = lirePanier()
      var s = b.getAttribute('data-plus') || b.getAttribute('data-moins') || b.getAttribute('data-suppr')
      var x = l.find(function (y) {
        return y.slug === s
      })
      if (!x) return
      if (b.hasAttribute('data-plus')) x.qte = Math.min(50, x.qte + 1)
      if (b.hasAttribute('data-moins')) x.qte = Math.max(1, x.qte - 1)
      if (b.hasAttribute('data-suppr')) l = l.filter(function (y) {
        return y !== x
      })
      ecrirePanier(l)
      rendre()
    })
    catalogue()
      .then(function (liste) {
        liste.forEach(function (p) {
          produits[p.slug] = p
        })
        rendre()
      })
      .catch(function () {
        erreurChargement(zoneLignes)
      })

    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var requis = [form.nom, form.tel]
      var manque = requis.filter(function (c) {
        c.setAttribute('aria-invalid', c.value.trim() ? 'false' : 'true')
        return !c.value.trim()
      })
      var lignes = lirePanier().filter(function (x) {
        return produits[x.slug]
      })
      if (manque.length || !lignes.length) {
        erreur.textContent = manque.length ? 'Indiquez votre nom et votre téléphone.' : 'Votre panier est vide.'
        erreur.hidden = false
        if (manque.length) manque[0].focus()
        return
      }
      erreur.hidden = true
      var carteDemo = demo && form.paiement.value === 'carte'
      btn.disabled = true
      btn.textContent = carteDemo ? 'Paiement en cours…' : 'Envoi de la commande…'
      var client = {
        nom: form.nom.value.trim(),
        tel: form.tel.value.trim(),
        email: form.email.value.trim(),
        entreprise: form.entreprise.value.trim(),
        paiement: carteDemo ? 'carte_simulation' : form.paiement.value,
      }
      var attente = carteDemo
        ? new Promise(function (ok) {
            setTimeout(ok, 1500)
          })
        : Promise.resolve()
      attente
        .then(function () {
          return api('rpc/store_passer_commande', { method: 'POST', body: { p_client: client, p_lignes: lignes.map(function (x) { return { slug: x.slug, qte: x.qte } }), p_demo: demo } })
        })
        .then(function (res) {
          ecrirePanier([])
          caisse.hidden = true
          var conf = document.getElementById('store-confirmation')
          document.getElementById('conf-titre').textContent = carteDemo ? 'Paiement accepté' : 'Commande enregistrée'
          document.getElementById('conf-nom').textContent = client.nom
          document.getElementById('conf-num').textContent = res.numero
          document.getElementById('conf-lignes').innerHTML =
            res.lignes
              .map(function (l) {
                return '<div class="recap-ligne"><span>' + l.qte + ' × ' + esc(l.nom) + '</span><strong>' + fcfa(l.prix * l.qte) + '</strong></div>'
              })
              .join('') + '<div class="recap-total"><span>Total</span><strong>' + fcfa(res.total) + '</strong></div>'
          var modes = { mobile_money: 'par Mobile Money', virement: 'par virement', especes: 'en espèces à l\'agence' }
          document.getElementById('conf-suite').textContent = carteDemo
            ? 'Simulation : aucun montant n\'a été débité. Dans une vraie commande, votre licence vous serait envoyée sous 24 h ouvrées.'
            : 'Nous vous contactons très vite sur WhatsApp pour le paiement ' + (modes[client.paiement] || '') + ', puis nous vous livrons vos licences.'
          document.getElementById('conf-wa').href =
            'https://wa.me/' + C.wa + '?text=' + encodeURIComponent('Bonjour Agence Elite, je viens de passer la commande ' + res.numero + ' (' + fcfa(res.total) + ') sur Elite Store.')
          conf.hidden = false
          conf.focus()
          window.scrollTo(0, 0)
        })
        .catch(function (err) {
          erreur.textContent = 'La commande n\'a pas pu être enregistrée (' + err.message + '). Réessayez ou commandez sur WhatsApp.'
          erreur.hidden = false
          btn.disabled = false
          rendre()
        })
    })
  }

  majBadge()
})()
