/* Origen de los datos de la web. Con useSupabase:
   1) en directo desde las vistas públicas de Supabase (timeout 8 s),
   2) si falla, copia nocturna data/snapshot.json (mismas filas, mismo adaptador),
   3) si también falla, los JSON locales de siempre (data/*.json).
   Sin useSupabase solo usa los JSON locales. fromRows/overlayI18n son puros y se prueban en tests/. */
(function (root, factory) {
  var m = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = m;
  root.VirandDataSource = m;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var TIMEOUT_MS = 8000;

  function byKey(k) { return function (a, b) { return (a[k] || 0) - (b[k] || 0); }; }
  function num(v) { return v == null ? null : +v; }
  function pair(es, en) { return { es: es == null ? '' : es, en: en == null ? (es == null ? '' : es) : en }; }

  // filas de las vistas public_* -> formas que ya consume main.js
  function fromRows(raw, supabaseUrl) {
    var photosBy = {};
    (raw.photos || []).slice().sort(byKey('sort')).forEach(function (p) {
      (photosBy[p.slug] = photosBy[p.slug] || []).push({
        src: /^assets\//.test(p.path) ? p.path : (supabaseUrl || '') + '/storage/v1/object/public/flats/' + p.path,
        alt: pair(p.alt_es, p.alt_en)
      });
    });
    var pisos = (raw.flats || []).slice().sort(byKey('sort')).map(function (f) {
      var o = {
        slug: f.slug, activo: true, nombre: pair(f.name_es, f.name_en), zona: f.zona,
        lat: num(f.lat), lng: num(f.lng), viajeros: num(f.viajeros), dormitorios: num(f.dormitorios), banos: num(f.banos),
        servicios: f.servicios || [], descripcion: pair(f.desc_es, f.desc_en), fotos: photosBy[f.slug] || []
      };
      if (f.barrio) o.barrio = f.barrio;
      if (f.camas != null) o.camas = num(f.camas);
      if (f.precio_desde != null) o.precio_desde = num(f.precio_desde);
      if (f.nota != null) o.nota = num(f.nota);
      return o;
    });
    var faq = (raw.faq || []).slice().sort(byKey('sort')).map(function (q) {
      return { pregunta: pair(q.q_es, q.q_en), respuesta: pair(q.a_es, q.a_en) };
    });
    var opiniones = (raw.reviews || []).slice().sort(byKey('sort')).map(function (r) {
      return { texto: pair(r.text_es, r.text_en), autor: pair(r.author_es, r.author_en), nota: r.rating };
    });
    var i18n = { es: {}, en: {} };
    (raw.texts || []).forEach(function (t) { if (i18n[t.lang]) i18n[t.lang][t.key] = t.value; });
    return { pisos: pisos, faq: faq, opiniones: opiniones, i18n: i18n };
  }

  // los textos de la base mandan; los que falten en la base se completan con los locales
  function overlayI18n(local, remote) {
    var out = {};
    ['es', 'en'].forEach(function (l) { out[l] = Object.assign({}, (local && local[l]) || {}, (remote && remote[l]) || {}); });
    return out;
  }

  /* ---------- parte con red (solo navegador) ---------- */
  function getJson(url, opt) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    var init = Object.assign({}, opt || {}); if (ctrl) init.signal = ctrl.signal;
    return fetch(url, init).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
      .then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function live(cfg) {
    var h = { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey } };
    function v(name) { return getJson(cfg.supabaseUrl + '/rest/v1/' + name + '?select=*', h); }
    return Promise.all([v('public_flats'), v('public_photos'), v('public_faq'), v('public_reviews'), v('public_texts')]).then(function (r) {
      if (!r[0].length) throw new Error('sin pisos');   // una base vacía no debe vaciar la web
      return { flats: r[0], photos: r[1], faq: r[2], reviews: r[3], texts: r[4] };
    });
  }

  function localLegacy() {
    return Promise.all(['data/i18n/es.json', 'data/i18n/en.json', 'data/pisos.json', 'data/opiniones.json', 'data/faq.json'].map(function (u) { return getJson(u); }))
      .then(function (r) { return { i18n: { es: r[0], en: r[1] }, pisos: r[2].pisos, opiniones: r[3].opiniones, faq: r[4].faq, source: 'local' }; });
  }

  // Devuelve { pisos, faq, opiniones, i18n:{es,en}, source:'live'|'snapshot'|'local' }
  function load(cfg) {
    cfg = cfg || root.VIRAND_CONFIG || {};
    if (!cfg.useSupabase) return localLegacy();
    return Promise.all([getJson('data/i18n/es.json').catch(function () { return {}; }), getJson('data/i18n/en.json').catch(function () { return {}; })]).then(function (loc) {
      var local = { es: loc[0], en: loc[1] };
      function shape(raw, source) {
        var d = fromRows(raw, cfg.supabaseUrl); d.i18n = overlayI18n(local, d.i18n); d.source = source; return d;
      }
      return live(cfg).then(function (raw) { return shape(raw, 'live'); })
        .catch(function () { return getJson('data/snapshot.json').then(function (raw) { if (!raw.flats || !raw.flats.length) throw new Error('snapshot vacío'); return shape(raw, 'snapshot'); }); })
        .catch(function () { return localLegacy(); });
    });
  }

  return { fromRows: fromRows, overlayI18n: overlayI18n, load: load };
});
