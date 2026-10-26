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
  root.UI = { esc: esc, toast: toast, errMsg: errMsg, busy: busy, translate: translate };
})(window);
