/* Única puerta de entrada de disponibilidad y precios.
   Contrato: { actualizado, pisos: { slug: { ocupado: [[ini,fin)], precio_desde, obsoleto } } }
   Hoy lo sirve Apps Script; mañana puede servirlo otro backend sin tocar la web. */
(function (root) {
  var TIMEOUT_MS = 8000;

  function sourceUrl() {
    var cfg = root.VIRAND_CONFIG || {};
    // ?mock=1 sirve datos de ejemplo SOLO para pruebas locales.
    if (/[?&]mock=1\b/.test(root.location.search)) return 'data/availability.mock.json';
    return cfg.appsScriptUrl || '';
  }

  function valid(d) {
    return d && typeof d === 'object' && d.pisos && typeof d.pisos === 'object';
  }

  // Resuelve siempre: con datos o con null (nunca rechaza ni bloquea la web).
  function load() {
    var url = sourceUrl();
    if (!url) return Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    var full = /mock/.test(url) ? url : url + sep + 'action=disponibilidad';
    return fetch(full, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) { return valid(d) ? d : null; })
      .catch(function () { return null; })
      .then(function (d) { clearTimeout(timer); return d; });
  }

  root.VirandAvailability = { load: load };
})(window);
