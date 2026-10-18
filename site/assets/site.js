// Menu, méga-menus et formulaire de contact (WhatsApp ou e-mail). Les animations sont dans motion.js.
;(function () {
  document.documentElement.classList.add('js')
  var body = document.body
  var entete = document.getElementById('entete')
  var burger = document.getElementById('burger')
  var mobile = window.matchMedia('(max-width: 1000px)')

  // Ombre de l'en-tête dès que la page défile : un repère invisible de 8 px en haut de page, observé
  // (aucun code exécuté pendant le défilement) ; écouteur passif en secours pour les très vieux navigateurs
  if ('IntersectionObserver' in window) {
    var repere = document.createElement('div')
    repere.setAttribute('aria-hidden', 'true')
    repere.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none'
    body.insertBefore(repere, body.firstChild)
    new IntersectionObserver(function (e) {
      entete.classList.toggle('defile-bas', !e[0].isIntersecting)
    }).observe(repere)
  } else {
    var surDefile = function () {
      entete.classList.toggle('defile-bas', window.scrollY > 8)
    }
    window.addEventListener('scroll', surDefile, { passive: true })
    surDefile()
  }

  // Menu mobile : le focus va dans le menu à l'ouverture et revient au bouton à la fermeture
  burger.addEventListener('click', function () {
    var ouvert = body.classList.toggle('menu-ouvert')
    burger.setAttribute('aria-expanded', ouvert ? 'true' : 'false')
    burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu')
    if (ouvert) {
      var premier = document.querySelector('#nav .nav-btn')
      if (premier)
        setTimeout(function () {
          premier.focus({ preventScroll: true })
        }, 30)
    }
  })
  var fermerMenu = function (rendreFocus) {
    if (!body.classList.contains('menu-ouvert')) return
    burger.click()
    if (rendreFocus) burger.focus()
  }
  // Retour sur grand écran : le menu mobile se referme (sinon le défilement resterait bloqué)
  var surLargeur = function (e) {
    if (!e.matches) fermerMenu(false)
  }
  if (mobile.addEventListener) mobile.addEventListener('change', surLargeur)

  // Méga-menus : survol sur ordinateur, clic partout, Échap pour fermer
  var items = Array.prototype.slice.call(document.querySelectorAll('.nav-item.has-mm'))
  var fermerTout = function (sauf) {
    items.forEach(function (it) {
      if (it === sauf) return
      it.classList.remove('ouvert')
      it.querySelector('.nav-btn').setAttribute('aria-expanded', 'false')
    })
  }
  items.forEach(function (it) {
    var btn = it.querySelector('.nav-btn')
    var minuterie
    btn.addEventListener('click', function () {
      var ouvert = !it.classList.contains('ouvert')
      fermerTout(it)
      it.classList.toggle('ouvert', ouvert)
      btn.setAttribute('aria-expanded', ouvert ? 'true' : 'false')
    })
    it.addEventListener('mouseenter', function () {
      if (mobile.matches) return
      clearTimeout(minuterie)
      fermerTout(it)
      it.classList.add('ouvert')
      btn.setAttribute('aria-expanded', 'true')
    })
    it.addEventListener('mouseleave', function () {
      if (mobile.matches) return
      minuterie = setTimeout(function () {
        it.classList.remove('ouvert')
        btn.setAttribute('aria-expanded', 'false')
      }, 150)
    })
  })
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      fermerTout()
      fermerMenu(true)
    }
  })
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) fermerTout()
  })
  // Un lien du menu vers une ancre de la même page ferme le menu mobile
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      fermerTout()
      fermerMenu(false)
    })
  })

  // Nombre d'articles du panier Elite Store dans l'en-tête
  try {
    var panier = JSON.parse(localStorage.getItem('ae-panier') || '[]')
    var nbArticles = panier.reduce(function (m, l) {
      return m + (l.qte || 1)
    }, 0)
    var badge = document.getElementById('panier-nb')
    if (badge && nbArticles) {
      badge.textContent = nbArticles
      badge.hidden = false
    }
  } catch (e) {
    /* stockage indisponible : pas de compteur */
  }

  // Envoi vers le CRM (fonctions publiques de la base, sans cookie) ; n'empêche jamais la navigation
  var envoyer = function (fn, corps) {
    var C = window.AE_SITE
    if (!C || !window.fetch) return
    try {
      fetch(C.url + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: C.cle, Authorization: 'Bearer ' + C.cle, 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      }).catch(function () {})
    } catch (e) {
      /* réseau indisponible : la demande part quand même par WhatsApp ou e-mail */
    }
  }
  // Photos changées depuis le CRM (Site web › Photos du site). L'original est gardé dans data-orig-* : une photo
  // rétablie dans le CRM revient même si une ancienne liste est en cache. Sans réseau, les photos d'origine restent.
  var appliquerPhotos = function (liste) {
    var parCle = {}
    ;(Array.isArray(liste) ? liste : []).forEach(function (p) {
      if (p && p.cle && /^https:\/\//.test(p.url || '')) parCle[p.cle] = p
    })
    document.querySelectorAll('img[data-photo]').forEach(function (img) {
      if (!img.hasAttribute('data-orig-src')) {
        img.setAttribute('data-orig-src', img.getAttribute('src') || '')
        img.setAttribute('data-orig-srcset', img.getAttribute('srcset') || '')
        img.setAttribute('data-orig-alt', img.getAttribute('alt') || '')
      }
      var p = parCle[img.getAttribute('data-photo')]
      if (p) {
        img.removeAttribute('srcset')
        if (img.getAttribute('src') !== p.url) img.setAttribute('src', p.url)
        img.setAttribute('alt', p.alt || img.getAttribute('data-orig-alt'))
      } else {
        img.setAttribute('src', img.getAttribute('data-orig-src'))
        if (img.getAttribute('data-orig-srcset')) img.setAttribute('srcset', img.getAttribute('data-orig-srcset'))
        img.setAttribute('alt', img.getAttribute('data-orig-alt'))
      }
    })
  }
  if (document.querySelector('img[data-photo]')) {
    try {
      var enCache = localStorage.getItem('ae-photos')
      if (enCache) appliquerPhotos(JSON.parse(enCache))
    } catch (e) {
      /* stockage indisponible : photos d'origine */
    }
    var CP = window.AE_SITE
    if (CP && window.fetch) {
      fetch(CP.url + '/rest/v1/rpc/site_photos_publiques', {
        method: 'POST',
        headers: { apikey: CP.cle, Authorization: 'Bearer ' + CP.cle, 'Content-Type': 'application/json' },
        body: '{}',
      })
        .then(function (r) {
          if (!r.ok) throw new Error('photos')
          return r.json()
        })
        .then(function (liste) {
          appliquerPhotos(liste)
          try {
            localStorage.setItem('ae-photos', JSON.stringify(liste))
          } catch (e) {
            /* stockage indisponible */
          }
        })
        .catch(function () {
          /* base injoignable (hors ligne, poste local) : la page garde ses photos */
        })
    }
  }

  // Mesure d'audience anonyme : page, site d'origine, type d'appareil (rien si « ne pas suivre »)
  try {
    var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1'
    var local = /^(localhost|127\.)/.test(location.hostname)
    if (!dnt && !local) {
      var origine = ''
      try {
        var h = document.referrer ? new URL(document.referrer).hostname : ''
        if (h && h !== location.hostname) origine = h.replace(/^www\./, '')
      } catch (e) {
        origine = ''
      }
      var w = window.innerWidth
      envoyer('site_visite', {
        p_page: location.pathname.replace(/^\/site/, '').replace(/index\.html$/, '') || '/',
        p_source: origine || null,
        p_appareil: w < 700 ? 'mobile' : w < 1100 ? 'tablette' : 'ordinateur',
      })
    }
  } catch (e) {
    /* mesure impossible : sans effet sur le site */
  }

  // Formulaire de contact
  var form = document.getElementById('form-contact')
  if (!form) return
  var params = new URLSearchParams(location.search)
  if (params.get('solution')) form.solution.value = params.get('solution')
  var canal = 'whatsapp'
  form.querySelectorAll('button[type=submit]').forEach(function (b) {
    b.addEventListener('click', function () {
      canal = b.getAttribute('data-canal')
    })
  })
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var requis = [form.nom, form.tel, form.message]
    var manque = requis.filter(function (c) {
      return !c.value.trim()
    })
    requis.forEach(function (c) {
      c.setAttribute('aria-invalid', manque.indexOf(c) >= 0 ? 'true' : 'false')
    })
    var erreur = document.getElementById('form-erreur')
    erreur.hidden = manque.length === 0
    if (manque.length) {
      manque[0].focus()
      return
    }
    var sel = form.solution
    var lignes = [
      'Bonjour Agence Elite,',
      '',
      form.message.value.trim(),
      '',
      'Nom : ' + form.nom.value.trim(),
      form.entreprise.value.trim() ? 'Entreprise : ' + form.entreprise.value.trim() : '',
      'Téléphone : ' + form.tel.value.trim(),
      form.email.value.trim() ? 'E-mail : ' + form.email.value.trim() : '',
      sel.value ? 'Solution : ' + sel.options[sel.selectedIndex].text : '',
    ].filter(function (l, i) {
      return l !== '' || i < 4
    })
    var texte = lignes.join('\n')
    // La demande arrive aussi dans le CRM (fiche + action « Demande site web »)
    envoyer('site_contact', {
      p: {
        nom: form.nom.value.trim(),
        entreprise: form.entreprise.value.trim(),
        tel: form.tel.value.trim(),
        email: form.email.value.trim(),
        solution: sel.value ? sel.options[sel.selectedIndex].text : '',
        message: form.message.value.trim(),
        canal: canal,
        page: location.pathname,
      },
    })
    // Retour visible : le message est prêt dans WhatsApp ou la messagerie
    var ok = document.getElementById('form-ok')
    if (ok) {
      ok.hidden = false
      ok.lastChild.textContent = canal === 'email' ? ' Votre message est prêt dans votre messagerie : il ne reste qu’à l’envoyer.' : ' Votre message est prêt dans WhatsApp : il ne reste qu’à l’envoyer.'
    }
    if (canal === 'email') {
      var sujet = 'Demande de projet' + (sel.value ? ' : ' + sel.options[sel.selectedIndex].text : '')
      location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(texte)
    } else {
      window.open('https://wa.me/' + form.getAttribute('data-wa') + '?text=' + encodeURIComponent(texte), '_blank', 'noopener')
    }
  })
})()
