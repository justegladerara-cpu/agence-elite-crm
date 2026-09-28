// Menu, méga-menus, apparitions au défilement et formulaire de contact (WhatsApp ou e-mail).
;(function () {
  document.documentElement.classList.add('js')
  var body = document.body
  var entete = document.getElementById('entete')
  var burger = document.getElementById('burger')
  var mobile = window.matchMedia('(max-width: 900px)')

  // Ombre de l'en-tête au défilement
  var surDefile = function () {
    entete.classList.toggle('defile-bas', window.scrollY > 8)
  }
  window.addEventListener('scroll', surDefile, { passive: true })
  surDefile()

  // Menu mobile
  burger.addEventListener('click', function () {
    var ouvert = body.classList.toggle('menu-ouvert')
    burger.setAttribute('aria-expanded', ouvert ? 'true' : 'false')
    burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu')
  })

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
      if (body.classList.contains('menu-ouvert')) burger.click()
    }
  })
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) fermerTout()
  })
  // Un lien du menu vers une ancre de la même page ferme le menu mobile
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      fermerTout()
      if (body.classList.contains('menu-ouvert')) burger.click()
    })
  })

  // Apparition douce des blocs
  if ('IntersectionObserver' in window) {
    var cibles = document.querySelectorAll('.carte-sol, .carte-sect, .etapes li, .benef, .presta, .valeur, .mv-carte, .sect, .ia, .cta, .securite')
    var obs = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('vu')
            obs.unobserve(en.target)
          }
        })
      },
      { rootMargin: '0px 0px -40px 0px' },
    )
    cibles.forEach(function (c) {
      c.classList.add('apparait')
      obs.observe(c)
    })
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
    if (canal === 'email') {
      var sujet = 'Demande de projet' + (sel.value ? ' : ' + sel.options[sel.selectedIndex].text : '')
      location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(texte)
    } else {
      window.open('https://wa.me/' + form.getAttribute('data-wa') + '?text=' + encodeURIComponent(texte), '_blank', 'noopener')
    }
  })
})()
