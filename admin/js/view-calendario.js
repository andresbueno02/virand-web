/* Pantalla de calendario: ocupación, reservas directas, bloqueos manuales y enlaces iCal (Airbnb/Booking). */
(function (root) {
  var L = root.AdminLogic, R = root.VirandRanges, P = root.VirandPricing, U = root.UI, esc = U.esc;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(s) { if (!s) return ''; var p = s.split('-'); return +p[2] + ' ' + MESES[+p[1] - 1].slice(0, 3) + ' ' + p[0]; }
  function fmtEur(v) { return v == null ? '' : String(Math.round(+v * 100) / 100).replace('.', ',') + ' €'; }
  function fmtAgo(iso) {
    if (!iso) return 'Sin sincronizar aún';
    var mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 2) return 'Hace un momento';
    if (mins < 60) return 'Hace ' + mins + ' min';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return 'Hace ' + hrs + ' h';
    return 'Hace ' + Math.round(hrs / 24) + ' d';
  }

  function render(el, initialFlatId) {
    var t0 = today();
    var S = {
      flats: [], allSources: [], flatId: initialFlatId || null,
      bookings: [], sources: [], blocks: [],
      y: +t0.slice(0, 4), m: +t0.slice(5, 7) - 1,
      selIn: '', selOut: '', kind: 'booking'
    };

    function nextMonth(y, m) { return m === 11 ? [y + 1, 0] : [y, m + 1]; }
    function dayState(d) {
      for (var i = 0; i < S.bookings.length; i++) {
        var b = S.bookings[i];
        if (d >= b.check_in && d < b.check_out) return b.kind === 'block' ? 'bl' : 'bk';
      }
      for (var j = 0; j < S.blocks.length; j++) {
        var x = S.blocks[j];
        if (d >= x.start_date && d < x.end_date) return 'ic';
      }
      return '';
    }
    function hasOverlap(ci, co) {
      if (!ci || !co || co <= ci) return false;
      var ranges = S.bookings.map(function (b) { return [b.check_in, b.check_out]; })
        .concat(S.blocks.map(function (x) { return [x.start_date, x.end_date]; }));
      return !R.isRangeFree(R.mergeRanges(ranges), ci, co);
    }

    function monthHtml(y, m) {
      var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), lead = (first + 6) % 7, days = L.monthDays(y, m);
      var h = '<div class="pm"><h4>' + MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1) + ' ' + y + '</h4><div class="pg">' +
        DOW.map(function (d) { return '<span class="dw">' + d + '</span>'; }).join('');
      for (var i = 0; i < lead; i++) h += '<span></span>';
      days.forEach(function (d) {
        var st = dayState(d), past = d < t0;
        var edge = d === S.selIn || d === S.selOut;
        var inR = S.selIn && S.selOut && d > S.selIn && d < S.selOut;
        var cls = ['cc'];
        if (st) cls.push('cb-' + st);
        if (edge) cls.push('cb-sel');
        else if (inR) cls.push('cb-in');
        if (past) cls.push('past');
        h += '<button type="button" class="' + cls.join(' ') + '" data-day="' + d + '"' + (past ? ' disabled' : '') + ' aria-label="' + fmtDate(d) + '"><b>' + (+d.slice(8)) + '</b></button>';
      });
      return h + '</div></div>';
    }

    function paint() {
      var withIcal = {};
      S.allSources.forEach(function (s) { if (s.active) withIcal[s.flat_id] = true; });
      var icalCount = Object.keys(withIcal).length;
      var nm = nextMonth(S.y, S.m);
      var upcoming = S.bookings.filter(function (b) { return b.check_out >= t0; });
      var overlap = hasOverlap(S.selIn, S.selOut);

      el.innerHTML =
        '<div class="head"><h1>Calendario</h1></div>' +
        '<div class="stats"><span class="stat' + (icalCount === S.flats.length && S.flats.length ? ' ok' : ' warn') + '"><strong>' + icalCount + ' / ' + S.flats.length + '</strong> pisos con iCal conectado</span></div>' +
        '<label class="fld"><span>Piso</span><select id="cflat">' +
        S.flats.map(function (f) {
          return '<option value="' + esc(f.id) + '"' + (f.id === S.flatId ? ' selected' : '') + '>' + (withIcal[f.id] ? '✓ ' : '· ') + esc(f.name_es) + '</option>';
        }).join('') + '</select></label>' +

        '<fieldset><legend>1 · Ocupación y nueva reserva o bloqueo</legend>' +
        '<p class="muted">Toca en el calendario el día de <strong>entrada</strong> y el de <strong>salida</strong> (el día de salida queda libre para otra llegada), o escríbelos abajo.</p>' +
        '<div class="cnav"><button type="button" class="ico" data-act="prev" aria-label="Mes anterior">‹</button>' +
        (S.selIn || S.selOut ? '<button type="button" class="btn btn-ghost sm" data-act="clear-sel">Limpiar selección</button>' : '<span class="muted">Toca 2 días para marcar fechas</span>') +
        '<button type="button" class="ico" data-act="next" aria-label="Mes siguiente">›</button></div>' +
        '<div class="pcal">' + monthHtml(S.y, S.m) + monthHtml(nm[0], nm[1]) + '</div>' +
        '<div class="legend">' +
        '<span><i class="lg cb-bk"></i>Reserva directa</span>' +
        '<span><i class="lg cb-bl"></i>Bloqueo manual</span>' +
        '<span><i class="lg cb-ic"></i>Airbnb / Booking</span>' +
        '<span><i class="lg cb-sel"></i>Selección</span></div>' +

        '<form id="bkForm" class="bk-form" novalidate>' +
        '<div class="seg" role="group" aria-label="Tipo">' +
        '<button type="button" data-kind="booking" aria-pressed="' + String(S.kind === 'booking') + '">Reserva directa</button>' +
        '<button type="button" data-kind="block" aria-pressed="' + String(S.kind === 'block') + '">Bloqueo manual</button></div>' +
        (overlap ? '<p class="warn">Aviso: las fechas elegidas coinciden con días ya ocupados en este piso.</p>' : '') +
        '<div class="grid2">' +
        '<label class="fld"><span>Entrada</span><input type="date" name="check_in" value="' + esc(S.selIn) + '" min="' + t0 + '" required></label>' +
        '<label class="fld"><span>Salida (día libre)</span><input type="date" name="check_out" value="' + esc(S.selOut) + '" min="' + t0 + '" required></label></div>' +
        (S.kind === 'booking'
          ? '<div class="grid2">' +
            '<label class="fld"><span>Nombre del huésped</span><input type="text" name="guest_name" placeholder="Ej. Laura García"></label>' +
            '<label class="fld"><span>Teléfono (opcional)</span><input type="text" name="phone" inputmode="tel" placeholder="Ej. +34 600 123 456"></label>' +
            '<label class="fld"><span>Precio total € (opcional)</span><input type="text" name="total_price" inputmode="decimal" placeholder="450"></label>' +
            '<label class="fld"><span>Notas (opcional)</span><input type="text" name="notes" placeholder="Llegada a las 17h, cuna…"></label></div>'
          : '<label class="fld"><span>Motivo / nota (opcional)</span><input type="text" name="notes" placeholder="Ej. Mantenimiento, uso familiar…"></label>') +
        '<div class="actions"><button type="submit" class="btn btn-primary">' + (S.kind === 'booking' ? 'Guardar reserva' : 'Bloquear fechas') + '</button></div></form></fieldset>' +

        '<fieldset><legend>2 · Próximas reservas y bloqueos (' + upcoming.length + ')</legend>' +
        (upcoming.length ? '<div class="bk-list">' + upcoming.map(function (b) {
          var nn = R.nights(b.check_in, b.check_out);
          var dig = (b.phone || '').replace(/\D/g, '');
          return '<div class="bk-card" data-id="' + esc(b.id) + '">' +
            '<div class="bk-main"><div class="bk-top"><span class="tag ' + (b.kind === 'block' ? '' : 'bk') + '">' + (b.kind === 'block' ? 'Bloqueo' : 'Reserva') + '</span>' +
            '<strong>' + fmtDate(b.check_in) + ' → ' + fmtDate(b.check_out) + '</strong><span class="muted">(' + nn + ' noche' + (nn === 1 ? '' : 's') + ')</span></div>' +
            (b.guest_name ? '<div class="bk-who">' + esc(b.guest_name) + (b.total_price != null ? ' · <strong>' + fmtEur(b.total_price) + '</strong>' : '') + '</div>' : (b.total_price != null ? '<div class="bk-who"><strong>' + fmtEur(b.total_price) + '</strong></div>' : '')) +
            (b.notes ? '<div class="muted">' + esc(b.notes) + '</div>' : '') + '</div>' +
            '<div class="bk-act">' +
            (b.kind === 'booking' ? '<a class="btn btn-ghost sm" href="#/facturas/' + esc(b.id) + '">🧾 Facturar</a>' : '') +
            (dig ? '<a class="btn btn-ghost sm" href="https://wa.me/' + esc(dig) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
            '<button type="button" class="btn btn-danger sm" data-act="bk-del">Borrar</button></div></div>';
        }).join('') + '</div>' : '<p class="empty">No hay reservas ni bloqueos próximos en este piso.</p>') + '</fieldset>' +

        '<fieldset><legend>3 · Calendarios conectados (Airbnb / Booking)</legend>' +
        '<p class="muted">Pega aquí el enlace «Exportar calendario (iCal)» de Airbnb y/o Booking para que las fechas ocupadas aparezcan solas en la web.</p>' +
        (S.sources.length ? '<div class="ical-list">' + S.sources.map(function (s) {
          var ok = s.last_status === 'ok';
          var stCls = ok ? 'ok' : (s.last_status ? 'err' : 'warn');
          var stTxt = ok ? ('Al día · ' + fmtAgo(s.last_fetch)) : (s.last_status ? ('Error: ' + s.last_status) : 'Pendiente de sincronizar');
          return '<div class="ical-row" data-id="' + esc(s.id) + '">' +
            '<div class="grow"><strong>' + esc(s.label || 'Calendario iCal') + '</strong>' +
            '<span class="ical-st ' + stCls + '">' + esc(stTxt) + '</span></div>' +
            '<label class="switch" title="Activo"><input type="checkbox" data-act="ical-toggle"' + (s.active ? ' checked' : '') + '><span></span><em>' + (s.active ? 'Activo' : 'Pausado') + '</em></label>' +
            '<button type="button" class="btn btn-danger sm" data-act="ical-del">Borrar</button></div>';
        }).join('') + '</div>' : '<p class="empty">Este piso aún no tiene enlaces iCal. Añade abajo el de Airbnb o Booking cuando los tengas.</p>') +
        '<div class="actions" style="margin:12px 0 16px">' +
        (S.sources.length ? '<button type="button" class="btn btn-ghost" data-act="ical-sync">🔄 Sincronizar ahora</button>' : '') + '</div>' +
        '<form id="icalForm" class="ical-add" novalidate>' +
        '<div class="grid2">' +
        '<label class="fld"><span>Plataforma</span><input type="text" name="label" list="plats" placeholder="Airbnb" required><datalist id="plats"><option value="Airbnb"><option value="Booking.com"><option value="Vrbo"></datalist></label>' +
        '<label class="fld"><span>Enlace iCal (https://…)</span><input type="text" name="url" placeholder="https://www.airbnb.es/calendar/ical/..." required></label></div>' +
        '<button type="submit" class="btn btn-primary sm">＋ Añadir enlace iCal</button></form></fieldset>';

      var bkForm = document.getElementById('bkForm');
      if (bkForm) {
        bkForm.addEventListener('change', function (e) {
          if (e.target.name === 'check_in') { S.selIn = e.target.value; paint(); }
          else if (e.target.name === 'check_out') { S.selOut = e.target.value; paint(); }
        });
        bkForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var f = e.target, ci = f.elements.check_in.value, co = f.elements.check_out.value;
          if (!ci || !co || co <= ci) { U.toast('La fecha de salida debe ser posterior a la de entrada.', 'err'); return; }
          var price = f.elements.total_price ? P.parsePrice(f.elements.total_price.value) : null;
          if (price !== null && isNaN(price)) { U.toast('El precio total no es válido.', 'err'); return; }
          var row = {
            flat_id: S.flatId, check_in: ci, check_out: co, kind: S.kind,
            guest_name: f.elements.guest_name ? (f.elements.guest_name.value.trim() || null) : null,
            phone: f.elements.phone ? (f.elements.phone.value.trim() || null) : null,
            total_price: price,
            notes: f.elements.notes ? (f.elements.notes.value.trim() || null) : null
          };
          var btn = f.querySelector('button[type=submit]'); U.busy(btn, true);
          root.Api.saveBooking(row).then(function () {
            S.selIn = ''; S.selOut = '';
            U.toast(S.kind === 'booking' ? 'Reserva guardada' : 'Fechas bloqueadas');
            return loadFlat();
          }).then(paint).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(btn, false); });
        });
      }

      var icalForm = document.getElementById('icalForm');
      if (icalForm) icalForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, label = f.elements.label.value.trim(), url = f.elements.url.value.trim();
        if (!label) { U.toast('Escribe la plataforma (por ejemplo Airbnb o Booking).', 'err'); return; }
        if (!/^https:\/\//i.test(url)) { U.toast('El enlace iCal debe empezar por https://', 'err'); return; }
        var btn = f.querySelector('button[type=submit]'); U.busy(btn, true, 'Guardando…');
        root.Api.saveIcalSource({ flat_id: S.flatId, label: label, url: url, active: true }).then(function () {
          U.toast('Enlace iCal guardado');
          return Promise.all([loadFlat(), root.Api.listIcalSources().then(function (r) { S.allSources = r; })]);
        }).then(paint).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(btn, false); });
      });
    }

    function loadFlat() {
      if (!S.flatId) return Promise.resolve();
      return Promise.all([
        root.Api.listBookings(S.flatId),
        root.Api.listIcalSources(S.flatId),
        root.Api.listIcalBlocks(S.flatId)
      ]).then(function (r) { S.bookings = r[0]; S.sources = r[1]; S.blocks = r[2]; });
    }

    el.innerHTML = '<p class="muted">Cargando calendario…</p>';
    el.onchange = function (e) {
      if (e.target.id === 'cflat') {
        S.flatId = e.target.value; S.selIn = ''; S.selOut = '';
        loadFlat().then(paint).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
        return;
      }
      var tog = e.target.closest('[data-act="ical-toggle"]');
      if (tog) {
        var id = tog.closest('.ical-row').getAttribute('data-id'), v = tog.checked;
        tog.disabled = true;
        root.Api.saveIcalSource({ id: id, active: v }).then(function () {
          U.toast(v ? 'Calendario activado' : 'Calendario pausado');
          return Promise.all([loadFlat(), root.Api.listIcalSources().then(function (r) { S.allSources = r; })]);
        }).then(paint).catch(function (x) { tog.checked = !v; U.toast(U.errMsg(x), 'err'); tog.disabled = false; });
      }
    };
    el.onclick = function (e) {
      var d = e.target.closest('[data-day]');
      if (d && !d.disabled) {
        var day = d.getAttribute('data-day');
        if (!S.selIn || (S.selIn && S.selOut) || day <= S.selIn) { S.selIn = day; S.selOut = ''; }
        else S.selOut = day;
        paint(); return;
      }
      var k = e.target.closest('[data-kind]');
      if (k) { S.kind = k.getAttribute('data-kind'); paint(); return; }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'prev' || act === 'next') { S.m += act === 'next' ? 1 : -1; if (S.m > 11) { S.m = 0; S.y++; } if (S.m < 0) { S.m = 11; S.y--; } paint(); return; }
      if (act === 'clear-sel') { S.selIn = ''; S.selOut = ''; paint(); return; }
      if (act === 'bk-del') {
        if (!window.confirm('¿Borrar esta reserva/bloqueo?')) return;
        var bid = b.closest('.bk-card').getAttribute('data-id');
        root.Api.removeBooking(bid).then(function () { U.toast('Eliminado'); return loadFlat(); }).then(paint)
          .catch(function (x) { U.toast(U.errMsg(x), 'err'); });
        return;
      }
      if (act === 'ical-del') {
        if (!window.confirm('¿Borrar este enlace iCal y sus fechas importadas?')) return;
        var sid = b.closest('.ical-row').getAttribute('data-id');
        root.Api.removeIcalSource(sid).then(function () {
          U.toast('Enlace iCal eliminado');
          return Promise.all([loadFlat(), root.Api.listIcalSources().then(function (r) { S.allSources = r; })]);
        }).then(paint).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
        return;
      }
      if (act === 'ical-sync') {
        U.busy(b, true, 'Sincronizando…');
        root.Api.syncIcal(S.flatId).then(function (res) {
          U.toast('Calendario sincronizado' + (res && res.blocks != null ? ' (' + res.blocks + ' reservas importadas)' : ''));
          return Promise.all([loadFlat(), root.Api.listIcalSources().then(function (r) { S.allSources = r; })]);
        }).then(paint).catch(function (x) {
          U.toast(U.errMsg(x), 'err');
          U.busy(b, false);
        });
      }
    };

    return Promise.all([root.Api.listFlats(), root.Api.listIcalSources()]).then(function (r) {
      S.flats = r[0]; S.allSources = r[1];
      if (!S.flatId || !S.flats.some(function (f) { return f.id === S.flatId; })) S.flatId = S.flats.length ? S.flats[0].id : null;
      return loadFlat();
    }).then(paint);
  }

  root.ViewCalendario = { render: render };
})(window);
