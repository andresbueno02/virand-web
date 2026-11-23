/* Arranque, acceso y navegación del panel */
(function (root) {
  var U = root.UI, esc = U.esc, app = document.getElementById('app'), user = null;

  function loginView(msg) {
    U.setDirty(false);
    app.innerHTML = '<main class="login"><div class="card"><h1>VirAnd<small>Panel de administración</small></h1>' +
      '<form id="loginForm"><label class="fld"><span>Correo</span><input type="email" name="email" autocomplete="username" required autofocus></label>' +
      '<label class="fld"><span>Contraseña</span><div class="pw-wrap"><input type="password" name="pw" autocomplete="current-password" required><button type="button" class="pw-btn" id="pwToggle" aria-label="Mostrar contraseña">' + U.ico('eye') + '</button></div></label>' +
      '<p class="errline" id="lerr"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p>' +
      '<button class="btn btn-primary wide" type="submit">Entrar</button></form></div></main>';
    document.getElementById('pwToggle').addEventListener('click', function () {
      var pw = document.querySelector('#loginForm [name=pw]');
      var show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
      this.setAttribute('aria-pressed', String(show));
    });
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button[type=submit]'), err = document.getElementById('lerr');
      U.busy(btn, true, 'Entrando…'); err.hidden = true;
      root.Api.signIn(f.email.value.trim(), f.pw.value).then(start)
        .catch(function (x) { err.textContent = U.errMsg(x); err.hidden = false; U.busy(btn, false); });
    });
  }

  function shell() {
    app.innerHTML = '<header class="top"><a class="brand" href="#/pisos">VirAnd<small>Panel</small></a>' +
      '<nav id="nav" aria-label="Secciones">' +
      '<a href="#/pisos" data-r="pisos">' + U.ico('home') + '<span>Pisos</span></a>' +
      '<a href="#/calendario" data-r="calendario">' + U.ico('cal') + '<span>Calendario</span></a>' +
      '<a href="#/precios" data-r="precios">' + U.ico('price') + '<span>Precios</span></a>' +
      '<a href="#/preguntas" data-r="preguntas">' + U.ico('faq') + '<span>Preguntas</span></a>' +
      '<a href="#/opiniones" data-r="opiniones">' + U.ico('star') + '<span>Opiniones</span></a>' +
      '<a href="#/textos" data-r="textos">' + U.ico('text') + '<span>Textos</span></a></nav>' +
      '<div class="who"><a class="btn btn-ghost sm ext-btn" href="../" target="_blank" rel="noopener">' + U.ico('ext') + '<span>Ver web</span></a>' +
      '<span class="muted email">' + esc(user) + '</span><button type="button" class="btn btn-ghost sm" id="out">Salir</button></div></header>' +
      '<main id="view" class="view"></main>';
    document.getElementById('out').addEventListener('click', function () {
      if (U.isDirty() && !window.confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return;
      U.setDirty(false);
      root.Api.signOut().then(function () { user = null; loginView(); });
    });
  }

  var curHash = '';
  function route() {
    var view = document.getElementById('view'); if (!view) return;
    var nextHash = location.hash || '#/pisos';
    if (curHash && nextHash !== curHash && U.isDirty()) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')) {
        history.replaceState(null, '', curHash);
        return;
      }
      U.setDirty(false);
    }
    curHash = nextHash;
    var h = nextHash.replace(/^#\//, '').split('/'), r = h[0], p;
    view.onclick = null; view.onchange = null; view.oninput = null;
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-r') === r); });
    if (r === 'pisos') p = h[1] ? root.ViewPisos.edit(view, h[1]) : root.ViewPisos.list(view);
    else if (r === 'calendario') p = root.ViewCalendario.render(view, h[1]);
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
