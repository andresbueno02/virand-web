/* Lógica pura del panel (sin DOM): validación, conversión formulario<->fila, orden y agrupación de textos.
   Probada con tests/run.sh (jsc). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  root.AdminLogic = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SERVICIOS = [
    ['playa', 'Playa'], ['vistas-mar', 'Vistas al mar'], ['vistas', 'Vistas'], ['centro', 'Centro'],
    ['piscina', 'Piscina'], ['jacuzzi', 'Jacuzzi'], ['jardin', 'Jardín privado'], ['barbacoa', 'Barbacoa'],
    ['parking', 'Parking'], ['aire', 'Aire acondicionado'], ['wifi', 'Wifi'], ['ascensor', 'Ascensor'],
    ['llegada-autonoma', 'Llegada autónoma'], ['mascotas', 'Se admiten mascotas'], ['bicicletas', 'Bicicletas'], ['acogedor', 'Acogedor']
  ];
  var SERVICIO_KEYS = SERVICIOS.map(function (s) { return s[0]; });

  function slugify(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ñ/g, 'n')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  function uniqueSlug(base, existing) {
    var b = slugify(base) || 'piso', s = b, n = 2;
    while (existing.indexOf(s) !== -1) { s = b + '-' + n; n++; }
    return s;
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? NaN : n;
  }
  function intOrNull(v) { var n = numOrNull(v); return n === null || isNaN(n) ? n : n; }
  function txt(v) { var s = v == null ? '' : String(v).trim(); return s === '' ? null : s; }

  // fila de BD -> valores de formulario (todo texto)
  function flatToForm(r) {
    r = r || {};
    function s(v) { return v == null ? '' : String(v); }
    return {
      id: r.id || '', slug: s(r.slug), active: r.active !== false,
      name_es: s(r.name_es), name_en: s(r.name_en), zona: s(r.zona), barrio: s(r.barrio),
      viajeros: s(r.viajeros), dormitorios: s(r.dormitorios), camas: s(r.camas), banos: s(r.banos),
      servicios: (r.servicios || []).slice(), desc_es: s(r.desc_es), desc_en: s(r.desc_en),
      nota: s(r.nota), base_price: s(r.base_price), price_high: s(r.price_high), lat: s(r.lat), lng: s(r.lng)
    };
  }

  // formulario -> fila tipada lista para guardar (sin id si es nuevo)
  function formToRow(f) {
    var row = {
      id: f.id || undefined, slug: txt(f.slug), active: !!f.active, name_es: txt(f.name_es), name_en: txt(f.name_en),
      zona: txt(f.zona), barrio: txt(f.barrio), viajeros: intOrNull(f.viajeros),
      dormitorios: intOrNull(f.dormitorios), camas: intOrNull(f.camas), banos: intOrNull(f.banos),
      servicios: (f.servicios || []).filter(function (k) { return SERVICIO_KEYS.indexOf(k) !== -1; }),
      desc_es: txt(f.desc_es), desc_en: txt(f.desc_en), nota: numOrNull(f.nota),
      base_price: numOrNull(f.base_price), price_high: numOrNull(f.price_high), lat: numOrNull(f.lat), lng: numOrNull(f.lng)
    };
    if (!f.id) delete row.id;
    return row;
  }

  // devuelve lista de mensajes de error en español (vacía = válido)
  function validateFlat(r) {
    var e = [];
    if (!r.name_es) e.push('Falta el nombre del piso.');
    if (!r.zona) e.push('Falta la zona (municipio).');
    if (!r.slug || !/^[a-z0-9-]+$/.test(r.slug)) e.push('El identificador solo admite minúsculas, números y guiones.');
    if (r.viajeros === null || isNaN(r.viajeros) || r.viajeros < 1 || r.viajeros % 1 !== 0) e.push('Los viajeros deben ser un número entero de 1 o más.');
    ['dormitorios', 'camas', 'banos'].forEach(function (k) {
      var v = r[k]; if (v === null) return;
      if (isNaN(v) || v < 0 || v % 1 !== 0) e.push('«' + (k === 'banos' ? 'baños' : k) + '» debe ser un número entero de 0 o más.');
    });
    if (r.nota !== null && (isNaN(r.nota) || r.nota < 0 || r.nota > 5)) e.push('La nota debe estar entre 0 y 5.');
    if (r.base_price !== null && (isNaN(r.base_price) || r.base_price <= 0)) e.push('El precio «desde» debe ser mayor que 0.');
    if (r.price_high !== null && (isNaN(r.price_high) || r.price_high <= 0)) e.push('El precio de temporada alta debe ser mayor que 0.');
    var hasLat = r.lat !== null, hasLng = r.lng !== null;
    if (hasLat !== hasLng) e.push('Indica latitud y longitud, o deja las dos vacías.');
    if (hasLat && (isNaN(r.lat) || r.lat < -90 || r.lat > 90)) e.push('La latitud no es válida.');
    if (hasLng && (isNaN(r.lng) || r.lng < -180 || r.lng > 180)) e.push('La longitud no es válida.');
    return e;
  }

  // Intercambia un elemento con su vecino y reasigna 'sort' = posición. No muta la entrada.
  function moveItem(items, index, dir) {
    var out = items.map(function (x) { return Object.assign({}, x); });
    var j = index + dir;
    if (index < 0 || index >= out.length || j < 0 || j >= out.length) return reindex(out);
    var t = out[index]; out[index] = out[j]; out[j] = t;
    return reindex(out);
  }
  function reindex(items) { return items.map(function (x, i) { x.sort = i; return x; }); }
  function nextSort(items) {
    return items.reduce(function (m, x) { return Math.max(m, (x.sort == null ? -1 : x.sort)); }, -1) + 1;
  }
  // elementos cuyo orden cambió respecto a 'before' (para guardar solo esos)
  function changedSorts(before, after) {
    var old = {}; before.forEach(function (x) { old[x.id] = x.sort; });
    return after.filter(function (x) { return old[x.id] !== x.sort; });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m0, d) { return y + '-' + pad2(m0 + 1) + '-' + pad2(d); }
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  function addDay(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  // días de a a b, ambos inclusive, en cualquier orden; tope de 400 para no colgar la pantalla
  function dayRange(a, b) {
    if (a > b) { var t = a; a = b; b = t; }
    var out = [], d = a;
    while (d <= b && out.length < 400) { out.push(d); d = addDay(d, 1); }
    return out;
  }
  function monthDays(y, m0) { var out = [], n = daysInMonth(y, m0); for (var d = 1; d <= n; d++) out.push(ymd(y, m0, d)); return out; }
  // viernes y sábados del mes (las noches de fin de semana)
  function weekendDays(y, m0) {
    return monthDays(y, m0).filter(function (d) { var w = new Date(d + 'T00:00:00Z').getUTCDay(); return w === 5 || w === 6; });
  }
  // valida un tramo de temporada; devuelve mensajes (vacío = válido)
  function validateSeason(s) {
    var e = [];
    if (!s.from_date || !s.to_date) e.push('Indica la fecha de inicio y la de fin.');
    else if (s.to_date < s.from_date) e.push('La fecha de fin no puede ser anterior a la de inicio.');
    return e;
  }

  var GROUPS = [
    ['Portada', /^hero\./], ['Buscador', /^search\./], ['Alojamientos', /^stays\./], ['Por qué VirAnd', /^why\./],
    ['Opiniones', /^reviews\./], ['Preguntas frecuentes', /^faq\./], ['Contacto y pie', /^(contact\.|footer$)/]
  ];
  // agrupa filas {key,lang,value} en [{title, keys:[{key,es,en}]}]; lo no clasificado va a "Avanzado"
  function groupTexts(rows) {
    var by = {};
    rows.forEach(function (r) { (by[r.key] = by[r.key] || { key: r.key, es: '', en: '' })[r.lang] = r.value; });
    var keys = Object.keys(by).sort();
    var groups = GROUPS.map(function (g) { return { title: g[0], keys: [] }; });
    var adv = { title: 'Avanzado', keys: [] };
    keys.forEach(function (k) {
      var placed = false;
      GROUPS.forEach(function (g, i) { if (!placed && g[1].test(k)) { groups[i].keys.push(by[k]); placed = true; } });
      if (!placed) adv.keys.push(by[k]);
    });
    groups.push(adv);
    return groups.filter(function (g) { return g.keys.length; });
  }

  return {
    SERVICIOS: SERVICIOS, SERVICIO_KEYS: SERVICIO_KEYS, slugify: slugify, uniqueSlug: uniqueSlug,
    flatToForm: flatToForm, formToRow: formToRow, validateFlat: validateFlat,
    dayRange: dayRange, monthDays: monthDays, weekendDays: weekendDays, addDay: addDay, validateSeason: validateSeason, moveItem: moveItem, reindex: reindex, nextSort: nextSort, changedSorts: changedSorts, groupTexts: groupTexts
  };
});
