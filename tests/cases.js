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

  /* ---- resumen ---- */
  var failed = results.filter(function (r) { return !r.ok; });
  G.__testSummary = { total: results.length, failed: failed.length };
  if (typeof print === 'function') {
    results.forEach(function (r) { print((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' -> ' + r.err)); });
    print('\n' + (results.length - failed.length) + '/' + results.length + ' correctas' + (failed.length ? ', ' + failed.length + ' fallan' : ''));
    G.__testExit = failed.length ? 1 : 0;
  }
})(typeof self !== 'undefined' ? self : this);
