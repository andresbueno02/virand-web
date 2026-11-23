/* Utilidades de interfaz del panel */
(function (root) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  var timer = null;
  function toast(msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + (kind || 'ok');
    clearTimeout(timer); timer = setTimeout(function () { t.className = ''; }, kind === 'err' ? 6000 : 2800);
  }
  function errMsg(e) {
    var m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
    if (/row-level security|permission denied|violates row-level/i.test(m)) return 'No tienes permiso para hacer esto. Cierra sesión y vuelve a entrar.';
    if (/duplicate key.*slug/i.test(m)) return 'Ya existe un piso con ese identificador.';
    return m;
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Guardando…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }
  // Traduce una lista [{key, es}] y devuelve un mapa key -> en; avisa si algún marcador se perdió.
  function translate(items, btn) {
    items = items.filter(function (i) { return i.es && i.es.trim(); });
    if (!items.length) { toast('Escribe primero el texto en español.', 'err'); return Promise.resolve(null); }
    busy(btn, true, 'Traduciendo…');
    return root.Api.translate(items).then(function (out) {
      var map = {}, warn = null; out.forEach(function (o) { map[o.key] = o.en; if (o.warn) warn = o.warn; });
      toast(warn || 'Traducción propuesta: revísala antes de guardar.', warn ? 'err' : 'ok'); return map;
    }).catch(function (e) { toast(errMsg(e), 'err'); return null; }).then(function (r) { busy(btn, false); return r; });
  }
  var ICONS = {
    home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    price: 'M18 7a6.5 6.5 0 1 0 0 10M4 10h10M4 14h10',
    faq: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.7-1.7 1.2-1.7 2.4M12 17h.01',
    star: 'M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z',
    text: 'M4 6h16M4 12h12M4 18h8',
    ext: 'M14 3h7v7M21 3l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5',
    eye: 'M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  };
  function ico(name) {
    var d = ICONS[name]; if (!d) return '';
    return '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var dirty = false;
  function setDirty(v) { dirty = !!v; }
  function isDirty() { return dirty; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  root.UI = { esc: esc, toast: toast, errMsg: errMsg, busy: busy, translate: translate, ico: ico, setDirty: setDirty, isDirty: isDirty };
})(window);
