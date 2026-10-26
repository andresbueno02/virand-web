/* Calendario de rango (llegada/salida). Dos meses en escritorio, uno en móvil (CSS).
   VirandCalendar.create(el, { ocupado, known, llegada, salida, lang, labels, onChange }) */
(function (root) {
  var R = root.VirandRanges;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function today() { var d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }

  function monthName(y, m, lang) {
    return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
  }
  function dowNames(lang) {
    var f = new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'UTC' }), out = [];
    for (var i = 0; i < 7; i++) out.push(f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // lunes primero
    return out;
  }

  function create(el, opt) {
    var s = {
      ocupado: opt.ocupado || [], known: !!opt.known,
      llegada: opt.llegada || null, salida: opt.salida || null, lang: opt.lang || 'es',
      labels: opt.labels || { prev: '<', next: '>' }
    };
    var t0 = today();
    var base = (s.llegada || t0).split('-');
    var vy = +base[0], vm = +base[1] - 1;

    function canIn(day) {
      if (day < t0) return false;
      return !s.known || !R.isDayOccupied(s.ocupado, day);
    }
    function canOut(day) {
      if (!s.llegada || s.salida || day <= s.llegada) return false;
      return !s.known || R.isRangeFree(s.ocupado, s.llegada, day);
    }

    function render() {
      var months = [0, 1].map(function (k) {
        var y = vy, m = vm + k; if (m > 11) { y++; m -= 12; }
        var first = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0=domingo
        var lead = (first + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        var h = '<div class="cal-m"><h4>' + monthName(y, m, s.lang) + '</h4><div class="cal-g" role="grid">';
        dowNames(s.lang).forEach(function (n) { h += '<span class="dow" aria-hidden="true">' + n + '</span>'; });
        for (var i = 0; i < lead; i++) h += '<span class="d"></span>';
        for (var d = 1; d <= days; d++) {
          var day = ymd(y, m, d), past = day < t0, occ = s.known && R.isDayOccupied(s.ocupado, day);
          var ok = canIn(day) || canOut(day), cls = [];
          if (past) cls.push('past');
          var edge = day === s.llegada || day === s.salida;
          if (edge) cls.push('sel-edge');
          else if (s.llegada && s.salida && day > s.llegada && day < s.salida) cls.push('in-range');
          h += '<button type="button" data-day="' + day + '" class="' + cls.join(' ') + '"' +
            (ok ? '' : ' disabled') + (edge ? ' aria-pressed="true"' : '') +
            ' aria-label="' + day + (occ ? ' (' + esc(opt.labels.busy || '') + ')' : '') + '">' + d + '</button>';
        }
        return h + '</div></div>';
      }).join('');
      var cur = vy * 12 + vm, now = +t0.slice(0, 4) * 12 + (+t0.slice(5, 7) - 1);
      el.innerHTML = '<div class="cal"><div class="cal-head">' +
        '<button type="button" class="cal-nav" data-nav="-1" aria-label="' + esc(s.labels.prev) + '"' + (cur <= now ? ' disabled' : '') + '>‹</button>' +
        '<button type="button" class="cal-nav" data-nav="1" aria-label="' + esc(s.labels.next) + '">›</button></div>' +
        '<div class="cal-months">' + months + '</div>' +
        '<div class="cal-legend"><span><i style="background:var(--blue)"></i>' + esc(opt.labels.sel || '') + '</span>' +
        (s.known ? '<span><i style="background:var(--busy)"></i>' + esc(opt.labels.busy || '') + '</span>' : '') + '</div></div>';
    }

    el.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav && !nav.disabled) {
        vm += +nav.getAttribute('data-nav'); if (vm > 11) { vm = 0; vy++; } if (vm < 0) { vm = 11; vy--; }
        render(); return;
      }
      var b = e.target.closest('[data-day]');
      if (!b || b.disabled) return;
      var day = b.getAttribute('data-day');
      if (s.llegada && !s.salida && canOut(day)) s.salida = day;
      else if (canIn(day)) { s.llegada = day; s.salida = null; }
      else return;
      render();
      if (opt.onChange) opt.onChange({ llegada: s.llegada, salida: s.salida });
    });

    render();
    return {
      set: function (llegada, salida) { s.llegada = llegada || null; s.salida = salida || null; render(); },
      setLang: function (lang, labels) { s.lang = lang; if (labels) { s.labels = labels; opt.labels = labels; } render(); }
    };
  }

  root.VirandCalendar = { create: create };
})(window);
