// Elite Motion System du site vitrine : niveau de mouvement adaptatif, apparitions au défilement, compteurs,
// vitrine interactive (onglets), parallaxe et inclinaison légères, pauses hors écran.
// Amélioration progressive : sans ce fichier (ou avec ?motion=off), le contenu reste entièrement visible et utilisable ;
// seuls les onglets de la vitrine deviennent une liste de modules affichés les uns sous les autres.
// Pas de boucle requestAnimationFrame permanente : chaque animation JS s'arrête d'elle-même.
;(function () {
  var html = document.documentElement
  var NIVEAUX = ['leger', 'equilibre', 'complet']
  var niveau = html.getAttribute('data-motion') || ''
  var anime = function () {
    return html.classList.contains('mo')
  }
  var plein = function () {
    return html.classList.contains('mo-plein')
  }
  var sourisFine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches
  var $$ = function (sel, racine) {
    return Array.prototype.slice.call((racine || document).querySelectorAll(sel))
  }

  function regler(n) {
    niveau = n
    html.setAttribute('data-motion', n)
    html.classList.toggle('mo', n !== 'leger')
    html.classList.toggle('mo-plein', n === 'complet')
  }

  // « Réduire les animations » activé pendant la visite : passage immédiat au niveau léger
  if (niveau && window.matchMedia) {
    var rm = matchMedia('(prefers-reduced-motion: reduce)')
    var surRm = function () {
      if (rm.matches) regler('leger')
    }
    if (rm.addEventListener) rm.addEventListener('change', surRm)
    else if (rm.addListener) rm.addListener(surRm)
  }

  // Qualité adaptative : deux échantillons courts d'intervalles entre images (requestAnimationFrame, puis arrêt) :
  // ~45 images au repos après le chargement, ~60 images au premier défilement. Images lentes (médiane > 25 ms,
  // 90e centile > 60 ms, ou plus d'un quart des images > 25 ms pendant le défilement) : niveau inférieur, mémorisé
  // pour la session (repris dès le premier affichage des pages suivantes par le script de tête).
  function sonder(nb, partMax) {
    if (niveau !== 'complet' && niveau !== 'equilibre') return
    var t = []
    var prec = 0
    var n = 0
    var image = function (ts) {
      if (prec) t.push(ts - prec)
      prec = ts
      if (++n <= nb && !document.hidden) requestAnimationFrame(image)
      else juger()
    }
    var juger = function () {
      if (t.length < 20 || niveau === 'leger') return
      var lentes = t.filter(function (x) {
        return x > 25
      }).length
      t.sort(function (a, b) {
        return a - b
      })
      if (t[t.length >> 1] > 25 || t[Math.floor(t.length * 0.9)] > 60 || lentes / t.length > partMax) {
        var bas = NIVEAUX[Math.max(0, NIVEAUX.indexOf(niveau) - 1)]
        regler(bas)
        try {
          sessionStorage.setItem('ae-motion-auto', bas)
        } catch (e) {
          /* stockage indisponible */
        }
      }
    }
    requestAnimationFrame(image)
  }
  if (niveau) {
    var auRepos = function () {
      setTimeout(function () {
        sonder(45, 1)
      }, 1200)
    }
    if (document.readyState === 'complete') auRepos()
    else window.addEventListener('load', auRepos)
    var premierDefilement = function () {
      window.removeEventListener('scroll', premierDefilement)
      sonder(60, 0.25)
    }
    window.addEventListener('scroll', premierDefilement, { passive: true })
  }

  // Onglet masqué : animations continues en pause
  document.addEventListener('visibilitychange', function () {
    html.classList.toggle('onglet-cache', document.hidden)
  })

  var IO = 'IntersectionObserver' in window
  // Zones à animation continue (héros, logos) : pause quand elles sortent de l'écran
  if (IO) {
    var zones = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        en.target.classList.toggle('hors-champ', !en.isIntersecting)
      })
    })
    $$('.hero, .defile').forEach(function (z) {
      zones.observe(z)
    })
  }

  // Bouton pause du défilement des logos (WCAG 2.2.2)
  $$('.defile-pause').forEach(function (b) {
    var d = b.previousElementSibling
    if (!d || !d.classList.contains('defile')) return
    b.hidden = false
    b.addEventListener('click', function () {
      var pause = !d.classList.contains('en-pause')
      d.classList.toggle('en-pause', pause)
      b.setAttribute('aria-pressed', pause ? 'true' : 'false')
      b.querySelector('span').textContent = pause ? 'Reprendre le défilement' : 'Mettre en pause le défilement'
    })
  })

  // Compteurs : de 0 à la valeur finale (déjà dans le HTML), ~1 s, puis arrêt.
  // Pas d'Intl/toLocaleString : leur première utilisation charge les données de langue (≈ 100 ms sur mobile lent).
  var fmt = function (n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  }
  // Une seule boucle pour tous les compteurs en cours, ~30 images/s (chaque texte modifié coûte une mise en page) ;
  // elle s'arrête dès que le dernier compteur a fini.
  var enCours = []
  var boucle = 0
  var tic = function (t) {
    enCours = enCours.filter(function (c) {
      if (!c.t0) c.t0 = t
      if (t - c.der < 30) return true
      c.der = t
      var k = Math.min(1, (t - c.t0) / 1000)
      c.el.textContent = k < 1 ? fmt(c.fin * (1 - Math.pow(1 - k, 3))) : c.texte
      return k < 1
    })
    boucle = enCours.length ? requestAnimationFrame(tic) : 0
  }
  function compter(el) {
    var fin = Number(el.getAttribute('data-compte'))
    var texte = el.getAttribute('data-texte') || el.textContent
    el.setAttribute('data-texte', texte)
    enCours = enCours.filter(function (c) {
      return c.el !== el
    })
    if (!anime() || !(fin > 0)) {
      el.textContent = texte
      return
    }
    el.style.minWidth = texte.length + 'ch'
    el.textContent = fmt(0)
    enCours.push({ el: el, fin: fin, texte: texte, t0: 0, der: 0 })
    if (!boucle) boucle = requestAnimationFrame(tic)
  }

  // Apparitions : seulement les blocs SOUS le pli au chargement (rien ne disparaît sous les yeux du visiteur)
  // Niveau équilibré (écrans tactiles, souvent des téléphones modestes) : seulement les grands blocs, pas chaque carte
  // (chaque apparition coûte une couche à peindre pendant le défilement).
  var CIBLES_BLOCS = '.titre-section, .ia, .cta, .securite, .vitrine, .chiffre, .mv-carte, .deux-col > div'
  var CIBLES = plein()
    ? CIBLES_BLOCS + ', .carte-sol, .carte-sect, .etapes li, .benef, .presta, .valeur, .sect, .mosaique figure, .galerie-photos figure, .grille-logos li, .faq-item, .grille-illu figure, .galerie figure'
    : CIBLES_BLOCS
  // Le premier rappel de l'observateur classe les blocs sans forcer de mise en page : visibles → laissés tels quels ;
  // sous l'écran → masqués (hors de vue, donc sans effet visible) puis révélés à leur entrée ; au-dessus → laissés.
  if (IO && anime()) {
    var rangs = []
    var obs = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (en) {
          var el = en.target
          if (!el.__ems) {
            el.__ems = 1
            var sous = !en.isIntersecting && en.boundingClientRect.top >= window.innerHeight
            if (!sous) return obs.unobserve(el)
            var p = el.parentNode
            if (rangs.indexOf(p) < 0) {
              rangs.push(p)
              p.__emsN = 0
            }
            el.style.setProperty('--i', p.__emsN++ % 4)
            el.classList.add('apparait')
            return
          }
          if (!en.isIntersecting) return
          obs.unobserve(el)
          el.classList.add('vu')
        })
      },
      { rootMargin: '0px 0px -6% 0px' },
    )
    $$(CIBLES).forEach(function (el) {
      obs.observe(el)
    })
  }

  // Chiffres clés : comptés quand ils entrent à l'écran
  var chiffres = $$('.chiffres [data-compte]')
  if (chiffres.length && IO && anime()) {
    var obsC = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (en) {
          if (!en.isIntersecting) return
          obsC.unobserve(en.target)
          compter(en.target)
        })
      },
      { threshold: 0.6 },
    )
    chiffres.forEach(function (c) {
      obsC.observe(c)
    })
  }

  // Vitrine de la solution de gestion : onglets accessibles (flèches, Début, Fin), modules animés à l'affichage
  $$('[data-vitrine]').forEach(function (v) {
    var liste = v.querySelector('[role=tablist]')
    if (!liste) return
    var onglets = $$('[role=tab]', liste)
    var panneaux = onglets.map(function (t) {
      return document.getElementById(t.getAttribute('aria-controls'))
    })
    var actif = 0
    var visible = !IO
    var jouer = function (p) {
      p.classList.remove('joue')
      if (!anime()) {
        p.classList.add('joue')
        return
      }
      // Deux images : l'état de départ est affiché avant de relancer les transitions (pas de mise en page forcée)
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          p.classList.add('joue')
          // Indicateurs comptés au niveau complet ; au niveau équilibré ils apparaissent en fondu, déjà à leur valeur
          if (plein()) $$('[data-compte]', p).forEach(compter)
        })
      })
    }
    var choisir = function (i, focus) {
      actif = i
      onglets.forEach(function (t, k) {
        var on = k === i
        t.setAttribute('aria-selected', on ? 'true' : 'false')
        t.tabIndex = on ? 0 : -1
        panneaux[k].hidden = !on
        if (!on) panneaux[k].classList.remove('joue')
      })
      if (focus) onglets[i].focus()
      if (visible) jouer(panneaux[i])
    }
    liste.hidden = false
    v.classList.add('vt-pret')
    panneaux.forEach(function (p) {
      p.setAttribute('role', 'tabpanel')
      p.tabIndex = 0
    })
    onglets.forEach(function (t, i) {
      t.addEventListener('click', function () {
        choisir(i, false)
      })
      t.addEventListener('keydown', function (e) {
        var n = onglets.length
        var k = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
        if (k === undefined) return
        e.preventDefault()
        choisir(k, true)
      })
    })
    choisir(0, false)
    if (IO) {
      new IntersectionObserver(
        function (entrees) {
          entrees.forEach(function (en) {
            if (en.isIntersecting && !visible) {
              visible = true
              jouer(panneaux[actif])
            }
          })
        },
        { threshold: 0.3 },
      ).observe(v)
    } else jouer(panneaux[actif])
  })

  // Pointeur (souris uniquement, niveau complet) : parallaxe du héros et inclinaison des cartes.
  // Mises à jour regroupées dans une image (requestAnimationFrame), rectangle mesuré à l'entrée seulement.
  if (sourisFine) {
    var hero = document.querySelector('.hero')
    var visuel = hero && hero.querySelector('.hero-visuel')
    if (visuel) {
      var rh = null
      var px = 0
      var py = 0
      var rafH = 0
      var poser = function () {
        rafH = 0
        visuel.style.setProperty('--px', px.toFixed(3))
        visuel.style.setProperty('--py', py.toFixed(3))
      }
      hero.addEventListener('pointerenter', function () {
        rh = hero.getBoundingClientRect()
      })
      hero.addEventListener('pointermove', function (e) {
        if (!plein() || !rh || e.pointerType !== 'mouse') return
        px = (e.clientX - rh.left) / rh.width - 0.5
        py = (e.clientY - rh.top) / rh.height - 0.5
        if (!rafH) rafH = requestAnimationFrame(poser)
      })
      hero.addEventListener('pointerleave', function () {
        rh = null
        px = py = 0
        if (!rafH) rafH = requestAnimationFrame(poser)
      })
    }
    $$('.carte-sol, .carte-sect').forEach(function (c) {
      var r = null
      var x = 0.5
      var y = 0
      var raf = 0
      var poserC = function () {
        raf = 0
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%')
        c.style.setProperty('--my', (y * 100).toFixed(1) + '%')
        c.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg')
        c.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg')
      }
      c.addEventListener('pointerenter', function () {
        r = c.getBoundingClientRect()
      })
      c.addEventListener('pointermove', function (e) {
        if (!r || e.pointerType !== 'mouse') return
        x = (e.clientX - r.left) / r.width
        y = (e.clientY - r.top) / r.height
        if (!plein()) return
        if (!raf) raf = requestAnimationFrame(poserC)
      })
      c.addEventListener('pointerleave', function () {
        r = null
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        ;['--mx', '--my', '--rx', '--ry'].forEach(function (p) {
          c.style.removeProperty(p)
        })
      })
    })
  }
})()
