/* Pantalla de precios: temporadas altas, precio baja/alta por piso y precios por días (calendario). */
(function (root) {
  var L = root.AdminLogic, P = root.VirandPricing, U = root.UI, esc = U.esc;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(v) { return v == null ? '' : String(v).replace('.', ','); }
  function fmtEur(v) { return String(Math.round(v * 100) / 100).replace('.', ',') + ' €'; }
  function longDate(s) { var p = s.split('-'); return +p[2] + ' ' + MESES[+p[1] - 1].slice(0, 3) + ' ' + p[0]; }

  function render(el) {
    var S = { flats: [], seasons: [], flatId: null, over: {}, sel: {}, last: null, y: 0, m: 0 };
    var t = today(); S.y = +t.slice(0, 4); S.m = +t.slice(5, 7) - 1;

    function flat() { return S.flats.filter(function (f) { return f.id === S.flatId; })[0]; }
    function pricing() { var f = flat(); return { low: f && f.base_price != null ? +f.base_price : null, high: f && f.price_high != null ? +f.price_high : null, days: S.over }; }
    // las temporadas de la base (from_date/to_date) al formato del cálculo de precios (from/to)
    function sp() { return S.seasons.map(function (x) { return { from: x.from_date, to: x.to_date, yearly: !!x.yearly }; }); }
    function selDays() { return Object.keys(S.sel).sort(); }

    /* ---------- A. temporadas altas ---------- */
    function seasonRow(s) {
      var id = s.id || 'new';
      return '<div class="srow" data-id="' + esc(id) + '">' +
        '<label class="fld"><span>Nombre</span><input type="text" name="label" value="' + esc(s.label || '') + '" placeholder="Verano"></label>' +
        '<label class="fld"><span>Desde</span><input type="date" name="from_date" value="' + esc(s.from_date || '') + '"></label>' +
        '<label class="fld"><span>Hasta (incluido)</span><input type="date" name="to_date" value="' + esc(s.to_date || '') + '"></label>' +
        '<label class="chk"><input type="checkbox" name="yearly"' + (s.yearly ? ' checked' : '') + '><span>Se repite cada año</span></label>' +
        '<div class="sact"><button type="button" class="btn btn-primary" data-act="s-save">Guardar</button>' +
        (s.id ? '<button type="button" class="btn btn-danger" data-act="s-del">Borrar</button>' : '<button type="button" class="btn btn-ghost" data-act="s-cancel">Cancelar</button>') + '</div></div>';
    }
    function seasonsHtml() {
      return '<fieldset><legend>1 · Temporadas altas</legend>' +
        '<p class="muted">Los días que caen dentro de una temporada alta usan el «precio de temporada alta» de cada piso. El resto del año se aplica el de temporada baja. Si marcas «se repite cada año» solo cuentan el día y el mes (útil para verano o Navidad; para la Semana Santa, que cambia, déjalo sin marcar).</p>' +
        '<div id="sdraft"></div>' + (S.seasons.length ? S.seasons.map(seasonRow).join('') : '<p class="empty">Aún no hay ninguna temporada alta. Sin ellas se usa siempre el precio de temporada baja.</p>') +
        '<div class="actions"><button type="button" class="btn btn-ghost" data-act="s-add">＋ Añadir temporada alta</button></div></fieldset>';
    }

    /* ---------- B. precio por piso ---------- */
    function ratesHtml() {
      return '<fieldset><legend>2 · Precio por noche de cada piso</legend>' +
        '<p class="muted">«Desde X €» en la web es el más bajo de los dos. Déjalo vacío si aún no quieres publicar ese precio.</p>' +
        '<div class="prow head"><span>Piso</span><span>Temporada baja</span><span>Temporada alta</span></div>' +
        S.flats.map(function (f) {
          return '<div class="prow' + (f.active ? '' : ' off') + '" data-id="' + esc(f.id) + '"><span class="pn">' + esc(f.name_es) + '</span>' +
            '<label class="fld"><span class="sr-only">Temporada baja</span><input type="text" inputmode="decimal" name="low" value="' + esc(money(f.base_price)) + '" placeholder="—" data-orig="' + esc(money(f.base_price)) + '"></label>' +
            '<label class="fld"><span class="sr-only">Temporada alta</span><input type="text" inputmode="decimal" name="high" value="' + esc(money(f.price_high)) + '" placeholder="—" data-orig="' + esc(money(f.price_high)) + '"></label></div>';
        }).join('') + '<div class="actions"><button type="button" class="btn btn-primary" data-act="r-save">Guardar precios</button></div></fieldset>';
    }

    /* ---------- C. precios por días ---------- */
    function monthHtml(y, m) {
      var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), lead = (first + 6) % 7, days = L.monthDays(y, m), p = pricing(), t0 = today();
      var h = '<div class="pm"><h4>' + MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1) + ' ' + y + '</h4><div class="pg">' + DOW.map(function (d) { return '<span class="dw">' + d + '</span>'; }).join('');
      for (var i = 0; i < lead; i++) h += '<span></span>';
      days.forEach(function (d) {
        var price = P.priceFor(d, p, sp()), special = S.over[d] != null, high = P.isHigh(d, sp()), past = d < t0, sel = !!S.sel[d];
        h += '<button type="button" class="pc' + (high ? ' hi' : '') + (special ? ' sp' : '') + (sel ? ' on' : '') + '" data-day="' + d + '"' + (past ? ' disabled' : '') + ' aria-pressed="' + sel + '" aria-label="' + longDate(d) + (price != null ? ', ' + fmtEur(price) : '') + '">' +
          '<b>' + (+d.slice(8)) + '</b><i>' + (price != null ? String(Math.round(price)) : '') + '</i></button>';
      });
      return h + '</div></div>';
    }
    function nextMonth(y, m) { return m === 11 ? [y + 1, 0] : [y, m + 1]; }
    function daysHtml() {
      var f = flat(), n = selDays().length, nm = nextMonth(S.y, S.m);
      return '<fieldset><legend>3 · Precios por días concretos</legend>' +
        '<p class="muted">Elige un piso, marca uno o varios días (con <strong>Mayús</strong> pulsada seleccionas todo un tramo) y pon el precio especial por noche. Ese precio manda sobre la temporada. Los días con precio especial salen en azul; la temporada alta, en arena.</p>' +
        '<label class="fld"><span>Piso</span><select id="dflat">' + S.flats.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === S.flatId ? ' selected' : '') + '>' + esc(x.name_es) + '</option>'; }).join('') + '</select></label>' +
        (f && f.base_price == null && f.price_high == null ? '<p class="warn">Este piso aún no tiene precio base. Ponlo arriba (paso 2) para ver los precios en el calendario.</p>' : '') +
        '<div class="cnav"><button type="button" class="ico" data-act="prev" aria-label="Mes anterior">‹</button><div class="quick">' +
        '<button type="button" class="btn btn-ghost" data-act="q-weekend">Fines de semana del mes</button><button type="button" class="btn btn-ghost" data-act="q-month">Todo el mes</button></div>' +
        '<button type="button" class="ico" data-act="next" aria-label="Mes siguiente">›</button></div>' +
        '<div class="pcal">' + monthHtml(S.y, S.m) + monthHtml(nm[0], nm[1]) + '</div>' +
        '<div class="legend"><span><i class="lg hi"></i>Temporada alta</span><span><i class="lg sp"></i>Precio especial</span><span><i class="lg on"></i>Seleccionado</span></div>' +
        '<div class="selbar' + (n ? ' show' : '') + '" role="region" aria-label="Días seleccionados"><strong id="seln">' + n + ' día' + (n === 1 ? '' : 's') + ' seleccionado' + (n === 1 ? '' : 's') + '</strong>' +
        '<label class="fld inl"><span class="sr-only">Precio por noche</span><input type="text" inputmode="decimal" id="dprice" placeholder="Precio €/noche"></label>' +
        '<button type="button" class="btn btn-primary" data-act="d-apply">Aplicar precio</button><button type="button" class="btn btn-danger" data-act="d-clear">Quitar precio especial</button>' +
        '<button type="button" class="btn btn-ghost" data-act="d-none">Deseleccionar</button></div></fieldset>';
    }

    function paint() { el.innerHTML = '<div class="head"><h1>Precios</h1></div>' + seasonsHtml() + ratesHtml() + (S.flats.length ? daysHtml() : ''); }
    function repaintDays() {
      var cur = el.querySelector('fieldset:nth-of-type(3)'); if (!cur) return;
      var pi = document.getElementById('dprice'), keep = pi ? pi.value : '', scroll = window.scrollY;
      var tmp = document.createElement('div'); tmp.innerHTML = daysHtml(); cur.replaceWith(tmp.firstChild);
      var pn = document.getElementById('dprice'); if (pn && keep) pn.value = keep;
      window.scrollTo(0, scroll);
    }
    function loadOver() {
      if (!S.flatId) return Promise.resolve();
      return root.Api.dayPrices(S.flatId, today()).then(function (rows) { S.over = {}; rows.forEach(function (r) { S.over[r.day] = +r.price; }); });
    }

    el.innerHTML = '<p class="muted">Cargando precios…</p>';
    el.onchange = function (e) {
      if (e.target.id === 'dflat') { S.flatId = e.target.value; S.sel = {}; S.last = null; loadOver().then(repaintDays).catch(function (x) { U.toast(U.errMsg(x), 'err'); }); }
    };
    el.onclick = function (e) {
      var d = e.target.closest('[data-day]');
      if (d && !d.disabled) {
        var day = d.getAttribute('data-day');
        if (e.shiftKey && S.last) L.dayRange(S.last, day).forEach(function (x) { if (x >= today()) S.sel[x] = true; });
        else { if (S.sel[day]) delete S.sel[day]; else S.sel[day] = true; }
        S.last = day; repaintDays(); return;
      }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), box = b.closest('.srow');

      if (act === 'prev' || act === 'next') { S.m += act === 'next' ? 1 : -1; if (S.m > 11) { S.m = 0; S.y++; } if (S.m < 0) { S.m = 11; S.y--; } repaintDays(); return; }
      if (act === 'q-weekend') { L.weekendDays(S.y, S.m).forEach(function (x) { if (x >= today()) S.sel[x] = true; }); repaintDays(); return; }
      if (act === 'q-month') { L.monthDays(S.y, S.m).forEach(function (x) { if (x >= today()) S.sel[x] = true; }); repaintDays(); return; }
      if (act === 'd-none') { S.sel = {}; S.last = null; repaintDays(); return; }
      if (act === 'd-apply' || act === 'd-clear') {
        var days = selDays(); if (!days.length) return;
        var run;
        if (act === 'd-apply') {
          var price = P.parsePrice(document.getElementById('dprice').value);
          if (price === null || isNaN(price)) { U.toast('Escribe un precio válido, por ejemplo 120 o 99,5.', 'err'); return; }
          run = root.Api.setDayPrices(S.flatId, days, price).then(function () { return days.length + ' día(s) a ' + fmtEur(price); });
        } else run = root.Api.clearDayPrices(S.flatId, days).then(function () { return 'Precio especial quitado'; });
        U.busy(b, true);
        run.then(function (msg) { S.sel = {}; S.last = null; U.toast(msg); return loadOver(); }).then(repaintDays)
          .catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(b, false); });
        return;
      }
      if (act === 's-add') { var dr = document.getElementById('sdraft'); dr.innerHTML = seasonRow({ yearly: true }); dr.querySelector('input').focus(); return; }
      if (act === 's-cancel') { document.getElementById('sdraft').innerHTML = ''; return; }
      if (act === 's-del') {
        if (!window.confirm('¿Borrar esta temporada alta?')) return;
        root.Api.removeSeason(box.getAttribute('data-id')).then(function () { U.toast('Temporada borrada'); return root.Api.listSeasons(); })
          .then(function (rows) { S.seasons = rows; paint(); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
        return;
      }
      if (act === 's-save') {
        var row = { label: box.querySelector('[name=label]').value.trim() || null, from_date: box.querySelector('[name=from_date]').value, to_date: box.querySelector('[name=to_date]').value, yearly: box.querySelector('[name=yearly]').checked };
        var errs = L.validateSeason(row); if (errs.length) { U.toast(errs[0], 'err'); return; }
        if (box.getAttribute('data-id') !== 'new') row.id = box.getAttribute('data-id');
        U.busy(b, true);
        root.Api.saveSeason(row).then(function () { U.toast('Temporada guardada'); return root.Api.listSeasons(); })
          .then(function (rows) { S.seasons = rows; paint(); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(b, false); });
        return;
      }
      if (act === 'r-save') {
        var jobs = [], bad = null;
        el.querySelectorAll('.prow[data-id]').forEach(function (r) {
          var lowI = r.querySelector('[name=low]'), highI = r.querySelector('[name=high]');
          if (lowI.value.trim() === lowI.getAttribute('data-orig') && highI.value.trim() === highI.getAttribute('data-orig')) return;
          var low = P.parsePrice(lowI.value), high = P.parsePrice(highI.value);
          if ((low !== null && isNaN(low)) || (high !== null && isNaN(high))) { bad = r.querySelector('.pn').textContent; return; }
          jobs.push({ id: r.getAttribute('data-id'), low: low, high: high });
        });
        if (bad) { U.toast('Precio no válido en «' + bad + '». Usa solo números, por ejemplo 95 o 99,5.', 'err'); return; }
        if (!jobs.length) { U.toast('No hay cambios que guardar'); return; }
        U.busy(b, true);
        Promise.all(jobs.map(function (j) { return root.Api.updateFlatPrices(j.id, j.low, j.high); })).then(function () { U.toast(jobs.length + ' piso(s) actualizado(s)'); return root.Api.listFlats(); })
          .then(function (rows) { S.flats = rows; paint(); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(b, false); });
      }
    };

    return Promise.all([root.Api.listFlats(), root.Api.listSeasons()]).then(function (r) {
      S.flats = r[0]; S.seasons = r[1]; S.flatId = S.flats.length ? S.flats[0].id : null;
      return loadOver();
    }).then(paint);
  }

  root.ViewPrecios = { render: render };
})(window);
