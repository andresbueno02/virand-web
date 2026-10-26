/* Búsqueda, filtros y orden de pisos según la disponibilidad (contrato de availability.js). */
(function (root, f) { var m = f(root); if (typeof module === 'object' && module.exports) module.exports = m; root.VirandSearch = m; })(typeof self !== 'undefined' ? self : this, function (root) {
  var R = (typeof require === 'function' && typeof module === 'object') ? require('./ranges.js') : root.VirandRanges;

  // 'libre' | 'ocupado' | 'desconocido' (sin datos, dato obsoleto o faltan fechas).
  function estadoDisponibilidad(avail, slug, llegada, salida) {
    if (!avail || !avail.pisos || !llegada || !salida) return 'desconocido';
    var e = avail.pisos[slug];
    if (!e || e.obsoleto) return 'desconocido';
    return R.isRangeFree(e.ocupado || [], llegada, salida) ? 'libre' : 'ocupado';
  }

  function precioDesde(piso, avail) {
    var e = avail && avail.pisos && avail.pisos[piso.slug];
    var p = e && e.precio_desde != null ? e.precio_desde : piso.precio_desde;
    return p == null || p === '' || isNaN(+p) ? null : +p;
  }

  function filterPisos(pisos, q, avail) {
    q = q || {};
    var personas = +q.personas || 0;
    var zona = q.zona && q.zona !== 'todas' ? q.zona : '';
    var out = [];
    for (var i = 0; i < (pisos || []).length; i++) {
      var p = pisos[i];
      if (p.activo === false) continue;
      if (personas && !(p.viajeros >= personas)) continue;
      if (zona && p.zona !== zona) continue;
      if (estadoDisponibilidad(avail, p.slug, q.llegada, q.salida) === 'ocupado') continue;
      out.push(p);
    }
    return out;
  }

  // Estable; sin precio al final.
  function sortPisos(pisos, orden, avail) {
    var arr = (pisos || []).map(function (p, i) { return { p: p, i: i, price: precioDesde(p, avail) }; });
    if (orden === 'precio-asc' || orden === 'precio-desc') {
      var dir = orden === 'precio-asc' ? 1 : -1;
      arr.sort(function (a, b) {
        if (a.price === null && b.price === null) return a.i - b.i;
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return a.price === b.price ? a.i - b.i : (a.price - b.price) * dir;
      });
    }
    return arr.map(function (x) { return x.p; });
  }

  return { estadoDisponibilidad: estadoDisponibilidad, filterPisos: filterPisos, sortPisos: sortPisos, precioDesde: precioDesde };
});
