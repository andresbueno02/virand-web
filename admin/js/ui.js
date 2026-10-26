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
  root.UI = { esc: esc, toast: toast, errMsg: errMsg, busy: busy };
})(window);
