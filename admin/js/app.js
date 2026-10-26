/* Arranque, acceso y navegación del panel */
(function (root) {
  var U = root.UI, esc = U.esc, app = document.getElementById('app'), user = null;

  function loginView(msg) {
    app.innerHTML = '<main class="login"><div class="card"><h1>VirAnd<small>Panel de administración</small></h1>' +
      '<form id="loginForm"><label class="fld"><span>Correo</span><input type="email" name="email" autocomplete="username" required autofocus></label>' +
      '<label class="fld"><span>Contraseña</span><input type="password" name="pw" autocomplete="current-password" required></label>' +
      '<p class="errline" id="lerr"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p>' +
      '<button class="btn btn-primary wide" type="submit">Entrar</button></form></div></main>';
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button'), err = document.getElementById('lerr');
      U.busy(btn, true, 'Entrando…'); err.hidden = true;
      root.Api.signIn(f.email.value.trim(), f.pw.value).then(start)
        .catch(function (x) { err.textContent = U.errMsg(x); err.hidden = false; U.busy(btn, false); });
    });
  }

  function shell() {
    app.innerHTML = '<header class="top"><a class="brand" href="#/pisos">VirAnd<small>Panel</small></a>' +
      '<nav id="nav"><a href="#/pisos" data-r="pisos">Pisos</a><a href="#/precios" data-r="precios">Precios</a><a href="#/preguntas" data-r="preguntas">Preguntas</a><a href="#/opiniones" data-r="opiniones">Opiniones</a><a href="#/textos" data-r="textos">Textos</a></nav>' +
      '<div class="who"><span class="muted">' + esc(user) + '</span><button type="button" class="btn btn-ghost" id="out">Salir</button></div></header>' +
      '<main id="view" class="view"></main>';
    document.getElementById('out').addEventListener('click', function () { root.Api.signOut().then(function () { user = null; loginView(); }); });
  }

  function route() {
    var view = document.getElementById('view'); if (!view) return;
    var h = (location.hash || '#/pisos').replace(/^#\//, '').split('/'), r = h[0], p;
    view.onclick = null; view.onchange = null;
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-r') === r); });
    if (r === 'pisos') p = h[1] ? root.ViewPisos.edit(view, h[1]) : root.ViewPisos.list(view);
    else if (r === 'precios') p = root.ViewPrecios.render(view);
    else if (r === 'preguntas') p = root.ViewLista.render(view, 'faq');
    else if (r === 'opiniones') p = root.ViewLista.render(view, 'reviews');
    else if (r === 'textos') p = root.ViewTextos.render(view);
    else { location.hash = '#/pisos'; return; }
    Promise.resolve(p).catch(function (e) { view.innerHTML = '<p class="errline">No se han podido cargar los datos: ' + esc(U.errMsg(e)) + '</p>'; });
    window.scrollTo(0, 0);
  }

  function start(data) {
    var email = data && data.user && data.user.email;
    root.Api.isAdmin().then(function (ok) {
      if (!ok) { root.Api.signOut(); loginView('Esta cuenta no tiene permiso de administrador.'); return; }
      user = email || 'Administrador'; shell(); route();
    }).catch(function (e) { loginView(U.errMsg(e)); });
  }

  window.addEventListener('hashchange', route);
  root.Api.init();
  root.Api.session().then(function (s) { if (s) start({ user: s.user }); else loginView(); }).catch(function () { loginView(); });
})(window);
