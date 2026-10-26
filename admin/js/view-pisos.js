/* Pantallas: lista de pisos y editor de ficha */
(function (root) {
  var L = root.AdminLogic, U = root.UI, esc = U.esc;

  function money(v) { return v == null ? '—' : String(v).replace('.', ',') + ' €'; }

  function list(el) {
    el.innerHTML = '<p class="muted">Cargando pisos…</p>';
    return root.Api.listFlats().then(function (flats) {
      el.innerHTML =
        '<div class="head"><h1>Pisos</h1><a class="btn btn-primary" href="#/pisos/nuevo">＋ Añadir piso</a></div>' +
        '<p class="muted">Desactiva un piso para ocultarlo de la web sin borrarlo. Pulsa «Editar» para cambiar sus datos.</p>' +
        '<div class="rows">' + flats.map(function (f) {
          return '<div class="row' + (f.active ? '' : ' off') + '" data-id="' + esc(f.id) + '">' +
            '<div class="grow"><strong>' + esc(f.name_es) + '</strong><span class="muted">' + esc(f.zona) + (f.barrio ? ' · ' + esc(f.barrio) : '') +
            ' · ' + esc(f.viajeros) + ' viajeros · desde ' + money(f.base_price) + '</span></div>' +
            '<label class="switch" title="Visible en la web"><input type="checkbox" data-act="toggle"' + (f.active ? ' checked' : '') + '><span></span><em>' + (f.active ? 'Visible' : 'Oculto') + '</em></label>' +
            '<a class="btn btn-ghost" href="#/pisos/' + esc(f.id) + '">Editar</a></div>';
        }).join('') + '</div>';
      el.onchange = function (e) {
        var cb = e.target.closest('[data-act="toggle"]'); if (!cb) return;
        var row = cb.closest('.row'), id = row.getAttribute('data-id'), v = cb.checked;
        cb.disabled = true;
        root.Api.setActive(id, v).then(function () {
          row.classList.toggle('off', !v); row.querySelector('em').textContent = v ? 'Visible' : 'Oculto';
          U.toast(v ? 'Piso visible en la web' : 'Piso oculto de la web');
        }).catch(function (err) { cb.checked = !v; U.toast(U.errMsg(err), 'err'); }).then(function () { cb.disabled = false; });
      };
    });
  }

  function field(id, label, val, opt) {
    opt = opt || {};
    var common = ' id="f_' + id + '" name="' + id + '"' + (opt.ro ? ' readonly' : '') + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '') + (opt.list ? ' list="' + opt.list + '"' : '');
    var input = opt.area
      ? '<textarea' + common + ' rows="' + opt.area + '">' + esc(val) + '</textarea>'
      : '<input type="' + (opt.type || 'text') + '"' + common + (opt.step ? ' step="' + opt.step + '"' : '') + (opt.min != null ? ' min="' + opt.min + '"' : '') + ' value="' + esc(val) + '">';
    return '<label class="fld' + (opt.cls ? ' ' + opt.cls : '') + '"><span>' + esc(label) + '</span>' + input + (opt.hint ? '<small>' + esc(opt.hint) + '</small>' : '') + '</label>';
  }

  function collect(form, original) {
    var f = Object.assign({}, original);
    ['slug', 'name_es', 'name_en', 'zona', 'barrio', 'viajeros', 'dormitorios', 'camas', 'banos', 'desc_es', 'desc_en', 'nota', 'base_price', 'lat', 'lng'].forEach(function (k) { f[k] = form.elements[k].value; });
    f.active = form.elements.active.checked;
    f.servicios = Array.prototype.filter.call(form.querySelectorAll('input[name="servicios"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    return f;
  }

  function edit(el, id) {
    var isNew = id === 'nuevo';
    el.innerHTML = '<p class="muted">Cargando…</p>';
    return Promise.all([isNew ? Promise.resolve(null) : root.Api.getFlat(id), root.Api.listFlats(), isNew ? Promise.resolve([]) : root.Api.photos(id)]).then(function (res) {
      var row = res[0], all = res[1], photos = res[2];
      var form0 = L.flatToForm(row || { active: true, viajeros: 2, servicios: [] });
      var zonas = []; all.forEach(function (f) { if (zonas.indexOf(f.zona) === -1) zonas.push(f.zona); });
      el.innerHTML =
        '<div class="head"><h1>' + (isNew ? 'Nuevo piso' : esc(form0.name_es)) + '</h1><a class="btn btn-ghost" href="#/pisos">← Volver</a></div>' +
        '<form id="flatForm" novalidate>' +
        '<fieldset><legend>Datos básicos</legend><div class="grid2">' +
        field('name_es', 'Nombre (español)', form0.name_es) + field('name_en', 'Nombre (inglés)', form0.name_en) +
        field('zona', 'Municipio / zona', form0.zona, { list: 'zonas', hint: 'Es el filtro de «Destino» de la web: Málaga, Torremolinos, Benalmádena, Fuengirola…' }) +
        field('barrio', 'Barrio (opcional)', form0.barrio) +
        field('slug', 'Identificador', form0.slug, { ro: !isNew, hint: isNew ? 'Se rellena solo a partir del nombre. No se podrá cambiar después.' : 'No se puede cambiar: lo usan las fotos y los calendarios.' }) +
        '</div><datalist id="zonas">' + zonas.map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist></fieldset>' +
        '<fieldset><legend>Capacidad</legend><div class="grid4">' +
        field('viajeros', 'Viajeros', form0.viajeros, { type: 'number', min: 1 }) + field('dormitorios', 'Dormitorios', form0.dormitorios, { type: 'number', min: 0 }) +
        field('camas', 'Camas (opcional)', form0.camas, { type: 'number', min: 0 }) + field('banos', 'Baños', form0.banos, { type: 'number', min: 0 }) +
        '</div></fieldset>' +
        '<fieldset><legend>Servicios destacados</legend><p class="muted">Los tres primeros aparecen en la tarjeta del piso; todos en su ficha.</p><div class="checks">' +
        L.SERVICIOS.map(function (s) { return '<label class="chk"><input type="checkbox" name="servicios" value="' + s[0] + '"' + (form0.servicios.indexOf(s[0]) !== -1 ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') +
        '</div></fieldset>' +
        '<fieldset><legend>Descripción</legend>' + field('desc_es', 'Español', form0.desc_es, { area: 6 }) + field('desc_en', 'Inglés', form0.desc_en, { area: 6, hint: 'Más adelante el panel propondrá la traducción automáticamente.' }) + '</fieldset>' +
        '<fieldset><legend>Precio y valoración</legend><div class="grid2">' +
        field('base_price', 'Precio «desde» (€ por noche)', form0.base_price, { type: 'number', step: '0.01', min: 0, hint: 'Es el que sale como «desde X €» en la web. Las temporadas se configuran en el siguiente paso.' }) +
        field('nota', 'Nota media (0-5, opcional)', form0.nota, { type: 'number', step: '0.1', min: 0 }) + '</div></fieldset>' +
        '<fieldset><legend>Ubicación en el mapa</legend><div class="grid2">' +
        field('lat', 'Latitud', form0.lat, { ph: '36.7213', hint: 'Pon una posición aproximada de la zona, no el portal exacto.' }) + field('lng', 'Longitud', form0.lng, { ph: '-4.4214' }) + '</div></fieldset>' +
        '<fieldset><legend>Fotos</legend>' + (isNew ? '<p class="muted">Guarda el piso primero. La gestión de fotos llega en el siguiente paso.</p>' :
          '<div class="thumbs">' + photos.slice(0, 14).map(function (p) { return '<img loading="lazy" alt="" src="' + esc(photoUrl(p.path)) + '">'; }).join('') + '</div><p class="muted">' + photos.length + ' fotos. Subir, ordenar y borrar fotos llega en el siguiente paso.</p>') + '</fieldset>' +
        '<fieldset><legend>Estado</legend><label class="chk"><input type="checkbox" name="active"' + (form0.active ? ' checked' : '') + '><span>Visible en la web</span></label></fieldset>' +
        '<div id="errs" class="errs" hidden></div>' +
        '<div class="actions"><button type="submit" class="btn btn-primary">Guardar</button><a class="btn btn-ghost" href="#/pisos">Cancelar</a></div></form>';

      var form = document.getElementById('flatForm'), slugTouched = !isNew;
      if (isNew) {
        form.elements.slug.addEventListener('input', function () { slugTouched = true; });
        form.elements.name_es.addEventListener('input', function () { if (!slugTouched) form.elements.slug.value = L.uniqueSlug(form.elements.name_es.value, all.map(function (f) { return f.slug; })); });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = L.formToRow(collect(form, form0)), errs = L.validateFlat(out), box = document.getElementById('errs');
        if (isNew && all.some(function (f) { return f.slug === out.slug; })) errs.push('Ya existe un piso con ese identificador.');
        if (errs.length) { box.hidden = false; box.innerHTML = '<strong>Revisa esto antes de guardar:</strong><ul>' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>'; box.scrollIntoView({ block: 'center' }); return; }
        box.hidden = true;
        if (isNew) out.sort = L.nextSort(all);
        var btn = form.querySelector('button[type=submit]'); U.busy(btn, true);
        root.Api.saveFlat(out).then(function () { U.toast('Piso guardado'); location.hash = '#/pisos'; })
          .catch(function (err) { U.toast(U.errMsg(err), 'err'); }).then(function () { U.busy(btn, false); });
      });
    });
  }

  function photoUrl(path) {
    if (/^assets\//.test(path)) return '../' + path + '-640.webp';
    return root.VIRAND_CONFIG.supabaseUrl + '/storage/v1/object/public/flats/' + path + '-640.webp';
  }

  root.ViewPisos = { list: list, edit: edit };
})(window);
