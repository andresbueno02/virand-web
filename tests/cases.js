/* Pruebas de la lógica pura. Funciona en navegador (tests/index.html) y en jsc (tests/run.sh). */
(function (G) {
  var results = [];
  function test(name, fn) {
    try { fn(); results.push({ name: name, ok: true }); }
    catch (e) { results.push({ name: name, ok: false, err: String(e && e.message || e) }); }
  }
  function ok(c, msg) { if (!c) throw new Error(msg || 'esperaba verdadero'); }
  function eq(a, b, msg) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) throw new Error((msg ? msg + ': ' : '') + 'esperaba ' + y + ' y obtuve ' + x);
  }
  G.__tests = { test: test, ok: ok, eq: eq, results: results };

  var R = G.VirandRanges, I = G.VirandIcal, S = G.VirandSearch, W = G.VirandWhatsApp;

  /* ---- ranges ---- */
  test('addDays cruza fin de mes y de año', function () {
    eq(R.addDays('2026-12-31', 1), '2027-01-01');
    eq(R.addDays('2027-03-01', -1), '2027-02-28');
    eq(R.addDays('2028-02-28', 1), '2028-02-29');
  });
  test('nights y daysBetween', function () {
    eq(R.nights("2026-12-30","2027-01-02"), 3);
    eq(R.daysBetween('2026-11-02', '2026-11-02'), 0);
  });
  test('mergeRanges fusiona solapados', function () {
    eq(R.mergeRanges([['2026-11-05', '2026-11-10'], ['2026-11-01', '2026-11-06']]), [['2026-11-01', '2026-11-10']]);
  });
  test('mergeRanges fusiona contiguos [a,b)+[b,c)', function () {
    eq(R.mergeRanges([['2026-11-01', '2026-11-05'], ['2026-11-05', '2026-11-08']]), [['2026-11-01', '2026-11-08']]);
  });
  test('mergeRanges conserva separados y descarta inválidos', function () {
    eq(R.mergeRanges([['2026-11-10', '2026-11-12'], ['2026-11-01', '2026-11-03'], ['2026-11-20', '2026-11-20'], null]),
      [['2026-11-01', '2026-11-03'], ['2026-11-10', '2026-11-12']]);
  });
  test('mergeRanges contenido dentro de otro', function () {
    eq(R.mergeRanges([['2026-11-01', '2026-11-20'], ['2026-11-05', '2026-11-08']]), [['2026-11-01', '2026-11-20']]);
  });
  test('isDayOccupied: el día de salida no está ocupado', function () {
    var o = [['2026-11-02', '2026-11-09']];
    ok(R.isDayOccupied(o, '2026-11-02'));
    ok(R.isDayOccupied(o, '2026-11-08'));
    ok(!R.isDayOccupied(o, '2026-11-09'));
    ok(!R.isDayOccupied(o, '2026-11-01'));
  });
  test('isRangeFree: el día de salida de una reserva es llegada libre', function () {
    var o = [['2026-11-02', '2026-11-09']];
    ok(R.isRangeFree(o, '2026-11-09', '2026-11-12'));
    ok(R.isRangeFree(o, '2026-10-30', '2026-11-02'), 'salir el día que llega otro');
    ok(!R.isRangeFree(o, '2026-11-08', '2026-11-10'));
    ok(!R.isRangeFree(o, '2026-10-30', '2026-11-03'));
    ok(!R.isRangeFree(o, '2026-11-03', '2026-11-05'), 'contenido dentro');
  });
  test('isRangeFree: estancia de 1 noche', function () {
    var o = [['2026-11-02', '2026-11-03']];
    ok(!R.isRangeFree(o, '2026-11-02', '2026-11-03'));
    ok(R.isRangeFree(o, '2026-11-03', '2026-11-04'));
    ok(R.isRangeFree(o, '2026-11-01', '2026-11-02'));
  });
  test('isRangeFree: cambio de año', function () {
    var o = [['2026-12-30', '2027-01-03']];
    ok(!R.isRangeFree(o, '2026-12-31', '2027-01-02'));
    ok(R.isRangeFree(o, '2027-01-03', '2027-01-05'));
  });
  test('isRangeFree: llegada >= salida nunca es libre', function () {
    ok(!R.isRangeFree([], '2026-11-05', '2026-11-05'));
    ok(!R.isRangeFree([], '2026-11-06', '2026-11-05'));
    ok(!R.isRangeFree([], '', '2026-11-05'));
  });
  test('isRangeFree sin rangos', function () { ok(R.isRangeFree([], '2026-11-05', '2026-11-06')); });

  /* ---- ical ---- */
  function cal(events) { return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' + events + 'END:VCALENDAR\r\n'; }
  test('iCal día completo con VALUE=DATE', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261109\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\n')), [['2026-11-02', '2026-11-09']]);
  });
  test('iCal evento multi-día y varios eventos fusionados', function () {
    var t = cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261105\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261105\r\nDTEND;VALUE=DATE:20261108\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261203\r\nEND:VEVENT\r\n');
    eq(I.parseIcal(t), [['2026-11-02', '2026-11-08'], ['2026-12-01', '2026-12-03']]);
  });
  test('iCal DTSTART con hora usa solo la parte fecha', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\nDTSTART:20261102T150000Z\nDTEND:20261105T110000Z\nEND:VEVENT\n')), [['2026-11-02', '2026-11-05']]);
  });
  test('iCal sin DTEND de día completo = +1 día', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261231\r\nEND:VEVENT\r\n')), [['2026-12-31', '2027-01-01']]);
  });
  test('iCal ignora CANCELLED', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261109\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\n')), []);
  });
  test('iCal líneas plegadas', function () {
    var t = cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DA\r\n TE:20261102\r\nDTEND;VALUE=DATE:2026\r\n\t1109\r\nSUMMARY:Reservado por\r\n  alguien\r\nEND:VEVENT\r\n');
    eq(I.parseIcal(t), [['2026-11-02', '2026-11-09']]);
  });
  test('iCal evento con fin <= inicio se ignora', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261109\r\nDTEND;VALUE=DATE:20261102\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261110\r\nEND:VEVENT\r\n')), []);
  });
  test('iCal vacío, basura y no-string', function () {
    eq(I.parseIcal(''), []);
    eq(I.parseIcal('esto no es un calendario'), []);
    eq(I.parseIcal(null), []);
    eq(I.parseIcal(undefined), []);
    eq(I.parseIcal(cal('')), []);
  });
  test('iCal evento sin DTSTART se ignora', function () {
    eq(I.parseIcal(cal('BEGIN:VEVENT\r\nSUMMARY:x\r\nEND:VEVENT\r\n')), []);
  });
  test('iCal no filtra SUMMARY/DESCRIPTION (solo devuelve fechas)', function () {
    var out = I.parseIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261109\r\nSUMMARY:Juan Perez 600123456\r\nDESCRIPTION:secreto\r\nEND:VEVENT\r\n'));
    ok(JSON.stringify(out).indexOf('Juan') < 0 && JSON.stringify(out).indexOf('secreto') < 0);
  });

  /* ---- search ---- */
  var pisos = [
    { slug: 'a', nombre: 'A', zona: 'Málaga', viajeros: 4, precio_desde: 100 },
    { slug: 'b', nombre: 'B', zona: 'Torremolinos', viajeros: 7 },
    { slug: 'c', nombre: 'C', zona: 'Málaga', viajeros: 2, precio_desde: 80 },
    { slug: 'd', nombre: 'D', zona: 'Málaga', viajeros: 6, activo: false, precio_desde: 50 },
    { slug: 'e', nombre: 'E', zona: 'Benalmádena', viajeros: 4, precio_desde: 100 }
  ];
  var avail = { actualizado: 'x', pisos: {
    a: { ocupado: [['2026-11-02', '2026-11-09']], precio_desde: 90 },
    b: { ocupado: [], precio_desde: 150 },
    c: { ocupado: [['2026-11-05', '2026-11-07']], obsoleto: true }
  } };
  test('estadoDisponibilidad libre/ocupado/desconocido', function () {
    eq(S.estadoDisponibilidad(avail, 'a', '2026-11-09', '2026-11-12'), 'libre');
    eq(S.estadoDisponibilidad(avail, 'a', '2026-11-08', '2026-11-12'), 'ocupado');
    eq(S.estadoDisponibilidad(null, 'a', '2026-11-09', '2026-11-12'), 'desconocido');
    eq(S.estadoDisponibilidad(avail, 'zzz', '2026-11-09', '2026-11-12'), 'desconocido');
    eq(S.estadoDisponibilidad(avail, 'c', '2026-11-05', '2026-11-06'), 'desconocido', 'obsoleto');
    eq(S.estadoDisponibilidad(avail, 'a', '', '2026-11-12'), 'desconocido');
    eq(S.estadoDisponibilidad(avail, 'a', '2026-11-09', ''), 'desconocido');
  });
  function slugs(l) { return l.map(function (p) { return p.slug; }); }
  test('filterPisos: sin filtros omite inactivos', function () {
    eq(slugs(S.filterPisos(pisos, {}, avail)), ['a', 'b', 'c', 'e']);
  });
  test('filterPisos: personas', function () {
    eq(slugs(S.filterPisos(pisos, { personas: 5 }, avail)), ['b']);
    eq(slugs(S.filterPisos(pisos, { personas: 4 }, avail)), ['a', 'b', 'e']);
  });
  test('filterPisos: zona exacta y "todas"', function () {
    eq(slugs(S.filterPisos(pisos, { zona: 'Málaga' }, avail)), ['a', 'c']);
    eq(slugs(S.filterPisos(pisos, { zona: 'todas' }, avail)), ['a', 'b', 'c', 'e']);
    eq(slugs(S.filterPisos(pisos, { zona: '' }, avail)), ['a', 'b', 'c', 'e']);
  });
  test('filterPisos: fechas excluye solo ocupados, conserva desconocidos', function () {
    eq(slugs(S.filterPisos(pisos, { llegada: '2026-11-03', salida: '2026-11-06' }, avail)), ['b', 'c', 'e']);
  });
  test('filterPisos: sin avail no excluye por fechas', function () {
    eq(slugs(S.filterPisos(pisos, { llegada: '2026-11-03', salida: '2026-11-06' }, null)), ['a', 'b', 'c', 'e']);
  });
  test('precioDesde: avail manda sobre el piso', function () {
    eq(S.precioDesde(pisos[0], avail), 90);
    eq(S.precioDesde(pisos[2], avail), 80);
    eq(S.precioDesde(pisos[1], null), null);
    eq(S.precioDesde(pisos[1], avail), 150);
  });
  test('sortPisos: recomendado conserva el orden', function () {
    eq(slugs(S.sortPisos(pisos, 'recomendado', avail)), ['a', 'b', 'c', 'd', 'e']);
  });
  test('sortPisos: precio asc con ausentes al final y estable', function () {
    var l = [pisos[1], pisos[0], pisos[2], pisos[4]];
    eq(slugs(S.sortPisos(l, 'precio-asc', null)), ['c', 'a', 'e', 'b']);
    eq(slugs(S.sortPisos(l, 'precio-asc', avail)), ['c', 'a', 'e', 'b']);
  });
  test('sortPisos: precio desc con ausentes al final', function () {
    var l = [pisos[1], pisos[0], pisos[2], pisos[4]];
    eq(slugs(S.sortPisos(l, 'precio-desc', null)), ['a', 'e', 'c', 'b']);
  });
  test('sortPisos no muta la entrada', function () {
    var l = [pisos[0], pisos[2]];
    S.sortPisos(l, 'precio-asc', null);
    eq(slugs(l), ['a', 'c']);
  });

  /* ---- whatsapp ---- */
  function decode(url) { return decodeURIComponent(url.split('?text=')[1]); }
  test('WhatsApp ES con fechas', function () {
    var u = W.buildLink({ numero: '+34 654 584 843', nombre: 'Loft Ipanema', llegada: '2026-08-12', salida: '2026-08-19', personas: 4, lang: 'es' });
    ok(u.indexOf('https://wa.me/34654584843?text=') === 0, u);
    eq(decode(u), 'Hola, me interesa «Loft Ipanema» del 12 de agosto de 2026 al 19 de agosto de 2026 para 4 personas. ¿Está disponible y cuál es el precio?');
  });
  test('WhatsApp ES sin fechas', function () {
    eq(decode(W.buildLink({ numero: '34654584843', nombre: 'Loft Ipanema', lang: 'es' })), 'Hola, me interesa «Loft Ipanema». ¿Está disponible y cuál es el precio?');
  });
  test('WhatsApp ES 1 persona', function () {
    eq(decode(W.buildLink({ numero: '34654584843', nombre: 'X', llegada: '2026-01-01', salida: '2026-01-03', personas: 1 })), 'Hola, me interesa «X» del 1 de enero de 2026 al 3 de enero de 2026 para 1 persona. ¿Está disponible y cuál es el precio?');
  });
  test('WhatsApp EN con fechas', function () {
    eq(decode(W.buildLink({ numero: '34654584843', nombre: 'Loft Ipanema', llegada: '2026-08-12', salida: '2026-08-19', personas: 4, lang: 'en' })),
      'Hi, I\'m interested in "Loft Ipanema" from August 12, 2026 to August 19, 2026 for 4 guests. Is it available and what is the price?');
  });
  test('WhatsApp EN sin fechas y 1 guest', function () {
    eq(decode(W.buildLink({ numero: '34654584843', nombre: 'Loft', lang: 'en' })), 'Hi, I\'m interested in "Loft". Is it available and what is the price?');
    eq(decode(W.buildLink({ numero: '34654584843', nombre: 'Loft', personas: 1, lang: 'en' })), 'Hi, I\'m interested in "Loft" for 1 guest. Is it available and what is the price?');
  });
  test('WhatsApp nombres con comillas, acentos y &', function () {
    var n = 'Ático "Sol" & Mar ñ';
    var u = W.buildLink({ numero: '34654584843', nombre: n, lang: 'es' });
    ok(u.indexOf('&') < 0 || u.split('?text=')[1].indexOf('&') < 0, '& debe ir codificado');
    ok(u.split('?text=')[1].indexOf('%26') > -1);
    eq(decode(u), 'Hola, me interesa «' + n + '». ¿Está disponible y cuál es el precio?');
  });

  /* ---- panel: lógica pura ---- */
  var A = G.AdminLogic;
  if (A) {
    test('slugify quita tildes, ñ y símbolos', function () {
      eq(A.slugify('Ático frente a la playa (¡con jacuzzi!)'), 'atico-frente-a-la-playa-con-jacuzzi');
      eq(A.slugify('  Sol & Centro Málaga. '), 'sol-centro-malaga');
      eq(A.slugify('Niño ñandú'), 'nino-nandu'); eq(A.slugify(''), ''); eq(A.slugify(null), '');
    });
    test('uniqueSlug evita colisiones', function () {
      eq(A.uniqueSlug('Loft Ipanema', ['loft-ipanema']), 'loft-ipanema-2');
      eq(A.uniqueSlug('Loft Ipanema', ['loft-ipanema', 'loft-ipanema-2']), 'loft-ipanema-3');
      eq(A.uniqueSlug('!!!', []), 'piso');
    });
    test('formToRow convierte tipos y vacíos a null', function () {
      var r = A.formToRow({ id: 'x1', slug: 'a-b', active: true, name_es: ' Piso ', name_en: '', zona: 'Málaga', barrio: '',
        viajeros: '4', dormitorios: '2', camas: '', banos: '1', servicios: ['wifi', 'inventado', 'piscina'],
        desc_es: 'Hola', desc_en: '', nota: '4,9', base_price: '120.50', lat: '', lng: '' });
      eq(r.name_es, 'Piso'); eq(r.name_en, null); eq(r.barrio, null); eq(r.viajeros, 4); eq(r.camas, null);
      eq(r.servicios, ['wifi', 'piscina']); eq(r.nota, 4.9); eq(r.base_price, 120.5); eq(r.lat, null); eq(r.id, 'x1');
    });
    test('flatToForm y formToRow son inversas para un piso real', function () {
      var row = { id: 'i', slug: 'loft', active: false, name_es: 'Loft', name_en: 'Loft', zona: 'Málaga', barrio: 'Centro', viajeros: 2,
        dormitorios: 1, camas: null, banos: 1, servicios: ['wifi'], desc_es: 'd', desc_en: 'e', nota: 4.9, base_price: 65, price_high: 90, lat: 36.7255, lng: -4.434 };
      eq(A.formToRow(A.flatToForm(row)), row);
    });
    test('validateFlat acepta un piso correcto', function () {
      eq(A.validateFlat(A.formToRow({ slug: 'loft', name_es: 'Loft', zona: 'Málaga', viajeros: '2', servicios: [] })), []);
    });
    test('validateFlat detecta errores', function () {
      var e = A.validateFlat(A.formToRow({ slug: 'Mal Slug', name_es: '', zona: '', viajeros: '0', dormitorios: '-1', banos: '1.5',
        nota: '7', base_price: '0', lat: '36.7', lng: '' }));
      ok(e.length >= 8, 'esperaba al menos 8 errores y hay ' + e.length + ': ' + e.join(' | '));
      eq(A.validateFlat(A.formToRow({ slug: 'a', name_es: 'A', zona: 'Z', viajeros: 'abc' })).length, 1);
      eq(A.validateFlat(A.formToRow({ slug: 'a', name_es: 'A', zona: 'Z', viajeros: '2', lat: '91', lng: '0' })).length, 1);
    });
    test('price_high se valida y convierte', function () {
      eq(A.formToRow({ slug: 'a', name_es: 'A', zona: 'Z', viajeros: '2', price_high: '140,5' }).price_high, 140.5);
      eq(A.validateFlat(A.formToRow({ slug: 'a', name_es: 'A', zona: 'Z', viajeros: '2', price_high: '-3' })).length, 1);
      eq(A.validateFlat(A.formToRow({ slug: 'a', name_es: 'A', zona: 'Z', viajeros: '2', price_high: '' })), []);
    });
    test('dayRange: inclusivo, en cualquier orden y con tope', function () {
      eq(A.dayRange('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
      eq(A.dayRange('2027-01-02', '2026-12-30').length, 4); eq(A.dayRange('2026-11-05', '2026-11-05'), ['2026-11-05']);
      eq(A.dayRange('2026-01-01', '2030-01-01').length, 400);
    });
    test('monthDays y weekendDays (viernes y sábados)', function () {
      eq(A.monthDays(2028, 1).length, 29); eq(A.monthDays(2026, 10).length, 30);
      eq(A.weekendDays(2026, 10), ['2026-11-06', '2026-11-07', '2026-11-13', '2026-11-14', '2026-11-20', '2026-11-21', '2026-11-27', '2026-11-28']);
    });
    test('validateSeason', function () {
      eq(A.validateSeason({ from_date: '2026-06-15', to_date: '2026-09-15' }), []);
      eq(A.validateSeason({ from_date: '2026-06-15', to_date: '2026-06-15' }), []);
      eq(A.validateSeason({ from_date: '2026-09-15', to_date: '2026-06-15' }).length, 1);
      eq(A.validateSeason({ from_date: '', to_date: '2026-06-15' }).length, 1);
    });
    test('moveItem intercambia y reindexa sin mutar', function () {
      var l = [{ id: 'a', sort: 0 }, { id: 'b', sort: 1 }, { id: 'c', sort: 2 }];
      var m = A.moveItem(l, 2, -1);
      eq(m.map(function (x) { return x.id; }), ['a', 'c', 'b']); eq(m.map(function (x) { return x.sort; }), [0, 1, 2]);
      eq(l.map(function (x) { return x.id; }), ['a', 'b', 'c']);
      eq(A.moveItem(l, 0, -1).map(function (x) { return x.id; }), ['a', 'b', 'c']);
      eq(A.moveItem(l, 2, 1).map(function (x) { return x.id; }), ['a', 'b', 'c']);
    });
    test('nextSort y changedSorts', function () {
      eq(A.nextSort([]), 0); eq(A.nextSort([{ sort: 0 }, { sort: 4 }]), 5);
      var before = [{ id: 'a', sort: 0 }, { id: 'b', sort: 1 }, { id: 'c', sort: 2 }];
      eq(A.changedSorts(before, A.moveItem(before, 2, -1)).map(function (x) { return x.id; }), ['c', 'b']);
      eq(A.changedSorts(before, before), []);
    });
    test('groupTexts agrupa y deja el resto en Avanzado', function () {
      var g = A.groupTexts([{ key: 'hero.title', lang: 'es', value: 'T' }, { key: 'hero.title', lang: 'en', value: 'Title' },
        { key: 'footer', lang: 'es', value: 'f' }, { key: 'svc.wifi', lang: 'es', value: 'Wifi' }, { key: 'contact.title', lang: 'es', value: 'c' }]);
      eq(g.map(function (x) { return x.title; }), ['Portada', 'Contacto y pie', 'Avanzado']);
      eq(g[0].keys, [{ key: 'hero.title', es: 'T', en: 'Title' }]);
      eq(g[1].keys.map(function (k) { return k.key; }), ['contact.title', 'footer']);
      eq(g[2].keys[0].key, 'svc.wifi');
    });
  }

  /* ---- origen de datos (adaptador) ---- */
  var D = G.VirandDataSource;
  if (D) {
    var raw = {
      flats: [{ slug: 'b', sort: 1, name_es: 'B', name_en: null, zona: 'Málaga', barrio: null, lat: '36.7', lng: -4.4, viajeros: 2, dormitorios: 1, camas: null, banos: 1, servicios: ['wifi'], desc_es: 'd', desc_en: null, nota: null, precio_desde: '65.00' },
              { slug: 'a', sort: 0, name_es: 'A', name_en: 'AA', zona: 'Torremolinos', barrio: 'Playa', lat: 36.6, lng: -4.5, viajeros: 4, dormitorios: 2, camas: 3, banos: 2, servicios: [], desc_es: 'x', desc_en: 'y', nota: 4.9, precio_desde: null }],
      photos: [{ slug: 'a', path: 'assets/img/pisos/a/2', alt_es: 'dos', alt_en: 'two', sort: 1 }, { slug: 'a', path: 'a/1', alt_es: 'uno', alt_en: null, sort: 0 }],
      faq: [{ q_es: 'q2', q_en: 'Q2', a_es: 'a2', a_en: 'A2', sort: 1 }, { q_es: 'q1', q_en: null, a_es: 'a1', a_en: null, sort: 0 }],
      reviews: [{ text_es: 't', text_en: 'T', author_es: 'au', author_en: 'AU', rating: 5, sort: 0 }],
      texts: [{ key: 'hero.title', lang: 'es', value: 'Hola' }, { key: 'hero.title', lang: 'en', value: 'Hello' }, { key: 'x', lang: 'fr', value: 'ignorar' }]
    };
    var out = D.fromRows(raw, 'https://p.supabase.co');
    test('fromRows ordena por sort y da la forma que consume la web', function () {
      eq(out.pisos.map(function (p) { return p.slug; }), ['a', 'b']);
      eq(out.pisos[0].nombre, { es: 'A', en: 'AA' }); eq(out.pisos[0].barrio, 'Playa'); eq(out.pisos[0].camas, 3); eq(out.pisos[0].nota, 4.9);
      ok(out.pisos[0].activo === true);
    });
    test('fromRows: nulos opcionales no aparecen y los numéricos se convierten', function () {
      var b = out.pisos[1];
      ok(!('barrio' in b) && !('camas' in b) && !('nota' in b), 'campos opcionales presentes');
      eq(b.precio_desde, 65); eq(b.lat, 36.7); eq(b.nombre, { es: 'B', en: 'B' }); eq(b.descripcion, { es: 'd', en: 'd' });
      ok(!('precio_desde' in out.pisos[0]));
    });
    test('fotos: orden, ruta local intacta y URL de Storage para las subidas', function () {
      eq(out.pisos[0].fotos.map(function (f) { return f.src; }), ['https://p.supabase.co/storage/v1/object/public/flats/a/1', 'assets/img/pisos/a/2']);
      eq(out.pisos[0].fotos[0].alt, { es: 'uno', en: 'uno' }); eq(out.pisos[1].fotos, []);
    });
    test('faq, opiniones e i18n', function () {
      eq(out.faq.map(function (q) { return q.pregunta.es; }), ['q1', 'q2']); eq(out.faq[0].pregunta.en, 'q1');
      eq(out.opiniones[0].nota, 5); eq(out.opiniones[0].autor, { es: 'au', en: 'AU' });
      eq(out.i18n, { es: { 'hero.title': 'Hola' }, en: { 'hero.title': 'Hello' } });
    });
    test('overlayI18n: la base manda y los locales rellenan huecos', function () {
      eq(D.overlayI18n({ es: { a: '1', b: '2' }, en: { a: 'one' } }, { es: { a: 'X' }, en: {} }), { es: { a: 'X', b: '2' }, en: { a: 'one' } });
      eq(D.overlayI18n(null, null), { es: {}, en: {} });
    });
    test('fromRows con listas vacías no falla', function () {
      eq(D.fromRows({}, 'u'), { pisos: [], faq: [], opiniones: [], i18n: { es: {}, en: {} }, pricing: null });
      var pr = { seasons: [{ from: '2026-07-01', to: '2026-08-31', yearly: false, label: 'V' }], pisos: { a: { low: 100, high: 150, days: {} } } };
      eq(D.fromRows({ pricing: pr }, 'u').pricing, pr);
    });
  }

  /* ---- precios por temporada y día ---- */
  var PR = G.VirandPricing;
  if (PR) {
    var SEAS = [{ from: '2026-07-01', to: '2026-08-31', yearly: false, label: 'Verano 2026' },
                { from: '2026-12-20', to: '2027-01-06', yearly: true, label: 'Navidad' },
                { from: '2026-04-01', to: '2026-04-10', yearly: true, label: 'Semana Santa (fija)' }];
    test('parsePrice: coma, punto, vacío, negativos y texto', function () {
      eq(PR.parsePrice('95'), 95); eq(PR.parsePrice('95,5'), 95.5); eq(PR.parsePrice(' 95.50 '), 95.5); eq(PR.parsePrice('0,99'), 0.99);
      eq(PR.parsePrice(''), null); eq(PR.parsePrice('   '), null); eq(PR.parsePrice(null), null); eq(PR.parsePrice(undefined), null);
      ['-5', '0', '0,00', 'abc', '12abc', '1,234', '1 000', '9.', '.5', '1,2,3', 'NaN', '€95'].forEach(function (x) { ok(isNaN(PR.parsePrice(x)) && PR.parsePrice(x) !== null, 'debía ser NaN: ' + x); });
      eq(PR.parsePrice(120), 120);
    });
    test('isHigh: rango exacto (inclusivo) y sin temporadas', function () {
      ok(PR.isHigh('2026-07-01', SEAS) && PR.isHigh('2026-08-31', SEAS) && PR.isHigh('2026-07-15', SEAS), 'dentro');
      ok(!PR.isHigh('2026-06-30', SEAS) && !PR.isHigh('2026-09-01', SEAS), 'fuera');
      ok(!PR.isHigh('2027-07-15', SEAS), 'un rango no yearly no se repite al año siguiente');
      ok(!PR.isHigh('2026-07-15', []) && !PR.isHigh('2026-07-15', null) && !PR.isHigh('2026-07-15', undefined));
    });
    test('isHigh yearly: se repite cada año y respeta los bordes', function () {
      ok(PR.isHigh('2030-04-01', SEAS) && PR.isHigh('2030-04-10', SEAS) && PR.isHigh('2030-04-05', SEAS), 'fija todos los años');
      ok(!PR.isHigh('2030-03-31', SEAS) && !PR.isHigh('2030-04-11', SEAS));
    });
    test('isHigh yearly cruzando fin de año (20 dic - 6 ene)', function () {
      ['2026-12-19', '2027-01-07', '2028-06-01'].forEach(function (d) { ok(!PR.isHigh(d, SEAS), 'fuera ' + d); });
      ['2026-12-20', '2026-12-31', '2027-01-01', '2027-01-06', '2031-12-25', '2032-01-03'].forEach(function (d) { ok(PR.isHigh(d, SEAS), 'dentro ' + d); });
    });
    test('priceFor: día especial > alta > baja > alta si no hay baja > null', function () {
      var p = { low: 100, high: 150, days: { '2026-07-10': 80, '2026-11-02': 130 } };
      eq(PR.priceFor('2026-07-10', p, SEAS), 80);          // día especial en temporada alta
      eq(PR.priceFor('2026-11-02', p, SEAS), 130);         // día especial en temporada baja
      eq(PR.priceFor('2026-07-11', p, SEAS), 150);         // alta
      eq(PR.priceFor('2026-10-11', p, SEAS), 100);         // baja
      eq(PR.priceFor('2026-10-11', { low: null, high: 150 }, SEAS), 150);   // sin baja -> alta
      eq(PR.priceFor('2026-07-11', { low: 100, high: null }, SEAS), 100);   // sin alta -> baja también en temporada alta
      eq(PR.priceFor('2026-07-11', { low: null, high: null }, SEAS), null);
      eq(PR.priceFor('2026-07-11', null, SEAS), null); eq(PR.priceFor('2026-07-11', {}, SEAS), null);
      eq(PR.priceFor('2026-07-11', { low: '100', high: '150' }, SEAS), 150);   // acepta números como texto
    });
    test('stayTotal: mezcla baja/alta/día especial (la noche de salida no cuenta)', function () {
      var p = { low: 100, high: 150, days: { '2026-08-31': 99.5 } };
      var r = PR.stayTotal('2026-08-30', '2026-09-02', p, SEAS);   // 30 ago alta 150 + 31 ago especial 99,5 + 1 sep baja 100
      eq(r.nights, 3); eq(r.complete, true); eq(r.total, 349.5);
      eq(r.perNight.map(function (x) { return x.price; }), [150, 99.5, 100]);
      eq(r.perNight.map(function (x) { return x.day; }), ['2026-08-30', '2026-08-31', '2026-09-01']);
    });
    test('stayTotal: una noche, cruce de año y redondeo a 2 decimales', function () {
      eq(PR.stayTotal('2026-10-05', '2026-10-06', { low: 80 }, SEAS).total, 80);
      var y = PR.stayTotal('2026-12-30', '2027-01-02', { low: 100, high: 200 }, SEAS);   // 30 dic, 31 dic, 1 ene -> todo alta
      eq(y.nights, 3); eq(y.total, 600);
      eq(PR.stayTotal('2026-10-01', '2026-10-04', { low: 33.33 }, []).total, 99.99);
      eq(PR.stayTotal('2026-10-01', '2026-10-04', { low: 0.1 }, []).total, 0.3);
    });
    test('stayTotal: noche sin precio => total null y complete false', function () {
      var r = PR.stayTotal('2026-10-05', '2026-10-08', { low: null, high: null, days: { '2026-10-06': 90 } }, SEAS);
      eq(r.nights, 3); eq(r.total, null); eq(r.complete, false);
      eq(r.perNight.map(function (x) { return x.price; }), [null, 90, null]);
      eq(PR.stayTotal('2026-10-05', '2026-10-08', null, SEAS).complete, false);
    });
    test('stayTotal: salida <= llegada o datos ausentes', function () {
      ['2026-10-05', '2026-10-04'].forEach(function (sal) {
        var r = PR.stayTotal('2026-10-05', sal, { low: 100 }, SEAS);
        eq(r, { nights: 0, total: null, complete: false, perNight: [] });
      });
      eq(PR.stayTotal('', '2026-10-05', { low: 100 }, SEAS).nights, 0); eq(PR.stayTotal('2026-10-05', null, { low: 100 }, SEAS).total, null);
      eq(PR.stayTotal('2026-01-01', '2028-01-01', { low: 100 }, SEAS).complete, false);   // estancia absurda
    });
  }

  /* ---- fotos ---- */
  var PH = G.VirandPhoto;
  if (PH) {
    test('url: WebP por defecto y JPEG cuando la ruta acaba en .jpg', function () {
      eq(PH.url('assets/img/pisos/a/1', 640), 'assets/img/pisos/a/1-640.webp');
      eq(PH.url('https://p.supabase.co/storage/v1/object/public/flats/a/x1', 1280), 'https://p.supabase.co/storage/v1/object/public/flats/a/x1-1280.webp');
      eq(PH.url('a/x1.jpg', 640), 'a/x1-640.jpg'); eq(PH.url('a/x1.JPEG', 1280), 'a/x1-1280.jpg');
    });
    test('storagePaths: vacío para fotos locales, dos rutas para las subidas', function () {
      eq(PH.storagePaths('assets/img/pisos/a/1'), []); eq(PH.storagePaths('a/x1'), ['a/x1-640.webp', 'a/x1-1280.webp']);
      eq(PH.storagePaths('a/x1.jpg'), ['a/x1-640.jpg', 'a/x1-1280.jpg']);
    });
    test('scaleSize no amplía y conserva proporción', function () {
      eq(PH.scaleSize(4000, 3000, 1280), { w: 1280, h: 960 }); eq(PH.scaleSize(800, 600, 1280), { w: 800, h: 600 });
      eq(PH.scaleSize(3000, 1, 640), { w: 640, h: 1 }); eq(PH.scaleSize(0, 10, 640), { w: 0, h: 0 });
    });
    test('newPath', function () { eq(PH.newPath('loft', 'k9x', 'webp'), 'loft/k9x'); eq(PH.newPath('loft', 'k9x', 'jpg'), 'loft/k9x.jpg'); });
    test('validateFile', function () {
      eq(PH.validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }), null);
      eq(PH.validateFile({ name: 'a.PNG', type: 'image/png', size: 1000 }), null);
      ok(/HEIC/.test(PH.validateFile({ name: 'IMG.HEIC', type: '', size: 10 })));
      ok(/HEIC/.test(PH.validateFile({ name: 'x', type: 'image/heic', size: 10 })));
      ok(/no es una foto/.test(PH.validateFile({ name: 'doc.pdf', type: 'application/pdf', size: 10 })));
      ok(/25 MB/.test(PH.validateFile({ name: 'big.jpg', type: 'image/jpeg', size: 26 * 1024 * 1024 })));
      ok(/vacía/.test(PH.validateFile({ name: 'e.jpg', type: 'image/jpeg', size: 0 })));
    });
    test('fromRows usa la ruta de Storage con la extensión elegida', function () {
      var o = G.VirandDataSource.fromRows({ flats: [{ slug: 'a', sort: 0, name_es: 'A', zona: 'Z', viajeros: 1 }], photos: [{ slug: 'a', path: 'a/k9x.jpg', alt_es: 'x', sort: 0 }, { slug: 'a', path: 'a/k9y', alt_es: 'y', sort: 1 }] }, 'https://p.supabase.co');
      eq(o.pisos[0].fotos.map(function (f) { return PH.url(f.src, 640); }), ['https://p.supabase.co/storage/v1/object/public/flats/a/k9x-640.jpg', 'https://p.supabase.co/storage/v1/object/public/flats/a/k9y-640.webp']);
    });
  }

  /* ---- traducción (función translate) ---- */
  var TC = G.TranslateCore;
  if (TC) {
    test('validateRequest limpia, ignora vacíos y rechaza lo inválido', function () {
      var v = TC.validateRequest({ items: [{ key: ' a ', es: ' Hola ' }, { key: 'b', es: '   ' }, { key: 'c', es: 'Adiós' }] });
      eq(v, { ok: true, items: [{ key: 'a', es: 'Hola' }, { key: 'c', es: 'Adiós' }] });
      ok(!TC.validateRequest(null).ok); ok(!TC.validateRequest({ items: [] }).ok); ok(!TC.validateRequest({ items: [{ key: 'a', es: '' }] }).ok);
      ok(!TC.validateRequest({ items: [{ key: '', es: 'x' }] }).ok); ok(!TC.validateRequest({ items: [{ key: 'a', es: 'x' }, { key: 'a', es: 'y' }] }).ok);
      ok(!TC.validateRequest({ items: [{ key: 'a', es: new Array(4002).join('x') }] }).ok);
      var many = []; for (var i = 0; i < 41; i++) many.push({ key: 'k' + i, es: 'x' }); ok(!TC.validateRequest({ items: many }).ok);
      var big = []; for (var j = 0; j < 5; j++) big.push({ key: 'k' + j, es: new Array(3900).join('x') }); ok(!TC.validateRequest({ items: big }).ok, 'total excedido');
    });
    test('buildRequest pide JSON estructurado e incluye los textos', function () {
      var r = TC.buildRequest([{ key: 'a', es: 'Hola' }]);
      eq(r.generationConfig.responseMimeType, 'application/json'); eq(r.generationConfig.responseSchema.type, 'ARRAY');
      eq(JSON.parse(r.contents[0].parts[0].text), [{ key: 'a', es: 'Hola' }]); ok(/\{n\}/.test(r.systemInstruction.parts[0].text));
    });
    function gem(txt) { return { candidates: [{ content: { parts: [{ text: txt }] } }] }; }
    test('parseResponse devuelve las traducciones en el orden pedido', function () {
      var items = [{ key: 'a', es: 'Hola' }, { key: 'b', es: 'Adiós' }];
      eq(TC.parseResponse(gem('[{"key":"b","en":"Bye"},{"key":"a","en":" Hello "}]'), items), [{ key: 'a', en: 'Hello' }, { key: 'b', en: 'Bye' }]);
      eq(TC.parseResponse(gem('```json\n[{"key":"a","en":"Hello"}]\n```'), [{ key: 'a', es: 'Hola' }]), [{ key: 'a', en: 'Hello' }]);
    });
    test('parseResponse avisa si se pierden marcadores {n}', function () {
      var r = TC.parseResponse(gem('[{"key":"a","en":"guests"}]'), [{ key: 'a', es: '{n} viajeros' }]);
      ok(r[0].warn, 'debía avisar'); eq(TC.parseResponse(gem('[{"key":"a","en":"{n} guests"}]'), [{ key: 'a', es: '{n} viajeros' }])[0].warn, undefined);
    });
    test('parseResponse falla con mensajes claros', function () {
      function msg(g, items) { try { TC.parseResponse(g, items || [{ key: 'a', es: 'x' }]); return null; } catch (e) { return e.message; } }
      ok(/ninguna traducción/.test(msg({}))); ok(/no ha querido/.test(msg({ promptFeedback: { blockReason: 'SAFETY' } })));
      ok(/No se ha podido leer/.test(msg(gem('esto no es json')))); ok(/formato esperado/.test(msg(gem('{"a":1}'))));
      ok(/Falta la traducción de «a»/.test(msg(gem('[{"key":"z","en":"x"}]')))); ok(/Falta la traducción/.test(msg(gem('[{"key":"a","en":"  "}]'))));
    });
  }

  /* ---- resumen ---- */
  var failed = results.filter(function (r) { return !r.ok; });
  G.__testSummary = { total: results.length, failed: failed.length };
  if (typeof print === 'function') {
    results.forEach(function (r) { print((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' -> ' + r.err)); });
    print('\n' + (results.length - failed.length) + '/' + results.length + ' correctas' + (failed.length ? ', ' + failed.length + ' fallan' : ''));
    G.__testExit = failed.length ? 1 : 0;
  }
})(typeof self !== 'undefined' ? self : this);
