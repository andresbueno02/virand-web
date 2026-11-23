/* Pantallas: lista de pisos y editor de ficha */
(function (root) {
  var L = root.AdminLogic, U = root.UI, esc = U.esc;

  function money(v) { return v == null ? '—' : String(v).replace('.', ',') + ' €'; }

  function list(el) {
    el.innerHTML = '<p class="muted">Cargando pisos…</p>';
    return Promise.all([root.Api.listFlats(), root.Api.listAllPhotos().catch(function () { return []; })]).then(function (res) {
      var flats = res[0], photos = res[1], coverBy = {};
      photos.forEach(function (p) { if (!coverBy[p.flat_id]) coverBy[p.flat_id] = p.path; });
      var zonas = [], vis = 0, noPrice = 0;
      flats.forEach(function (f) {
        if (f.zona && zonas.indexOf(f.zona) === -1) zonas.push(f.zona);
        if (f.active) vis++;
        if (f.base_price == null && f.price_high == null) noPrice++;
      });
      var q = '', curZone = '';
      el.innerHTML =
        '<div class="head"><h1>Pisos</h1><a class="btn btn-primary" href="#/pisos/nuevo">＋ Añadir piso</a></div>' +
        '<div class="stats">' +
        '<span class="stat"><strong>' + flats.length + '</strong> pisos</span>' +
        '<span class="stat ok"><strong>' + vis + '</strong> visibles</span>' +
        (flats.length - vis ? '<span class="stat"><strong>' + (flats.length - vis) + '</strong> ocultos</span>' : '') +
        (noPrice ? '<a class="stat warn" href="#/precios"><strong>' + noPrice + '</strong> sin precio →</a>' : '') + '</div>' +
        '<div class="toolbar"><input type="search" id="fsearch" placeholder="Buscar piso por nombre o barrio…" aria-label="Buscar piso">' +
        '<div class="zchips" id="zchips"><button type="button" class="zchip on" data-z="">Todas</button>' +
        zonas.map(function (z) { return '<button type="button" class="zchip" data-z="' + esc(z) + '">' + esc(z) + '</button>'; }).join('') + '</div></div>' +
        '<div class="rows" id="flatRows"></div>';

      function paintRows() {
        var box = document.getElementById('flatRows');
        var list = flats.filter(function (f) {
          if (curZone && f.zona !== curZone) return false;
          if (!q) return true;
          var txt = [f.name_es, f.name_en, f.zona, f.barrio].join(' ').toLowerCase();
          return txt.indexOf(q) !== -1;
        });
        box.innerHTML = list.length ? list.map(function (f) {
          var cov = coverBy[f.id], hasPrice = f.base_price != null || f.price_high != null;
          return '<div class="row' + (f.active ? '' : ' off') + '" data-id="' + esc(f.id) + '">' +
            '<a class="fthumb" href="#/pisos/' + esc(f.id) + '" aria-label="Editar ' + esc(f.name_es) + '">' +
            (cov ? '<img src="' + esc(photoUrl(cov, 640)) + '" alt="" loading="lazy">' : '<span class="nofoto">Sin foto</span>') + '</a>' +
            '<div class="grow"><a class="fname" href="#/pisos/' + esc(f.id) + '">' + esc(f.name_es) + '</a>' +
            '<span class="muted">' + esc(f.zona) + (f.barrio ? ' · ' + esc(f.barrio) : '') + ' · ' + esc(f.viajeros) + ' viajeros</span>' +
            '<span class="fmeta">' + (hasPrice ? 'Baja <strong>' + money(f.base_price) + '</strong> · Alta <strong>' + money(f.price_high) + '</strong>' : '<em class="tag warn">Sin precio</em>') + '</span></div>' +
            '<div class="ract"><label class="switch" title="Visible en la web"><input type="checkbox" data-act="toggle"' + (f.active ? ' checked' : '') + '><span></span><em>' + (f.active ? 'Visible' : 'Oculto') + '</em></label>' +
            '<a class="btn btn-ghost sm" href="../#piso=' + esc(f.slug) + '" target="_blank" rel="noopener" title="Ver en la web">' + U.ico('ext') + '</a>' +
            '<a class="btn btn-primary sm" href="#/pisos/' + esc(f.id) + '">Editar</a></div></div>';
        }).join('') : '<p class="empty">No hay pisos que coincidan con la búsqueda.</p>';
      }
      paintRows();

      document.getElementById('fsearch').addEventListener('input', function () { q = this.value.trim().toLowerCase(); paintRows(); });
      document.getElementById('zchips').addEventListener('click', function (e) {
        var b = e.target.closest('[data-z]'); if (!b) return;
        curZone = b.getAttribute('data-z');
        this.querySelectorAll('.zchip').forEach(function (x) { x.classList.toggle('on', x === b); });
        paintRows();
      });
      el.onchange = function (e) {
        var cb = e.target.closest('[data-act="toggle"]'); if (!cb) return;
        var row = cb.closest('.row'), id = row.getAttribute('data-id'), v = cb.checked;
        cb.disabled = true;
        root.Api.setActive(id, v).then(function () {
          flats.forEach(function (f) { if (f.id === id) f.active = v; });
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
      : '<input type="' + (opt.dec ? 'text" inputmode="decimal' : (opt.type || 'text')) + '"' + common + (opt.step ? ' step="' + opt.step + '"' : '') + (opt.min != null ? ' min="' + opt.min + '"' : '') + ' value="' + esc(val) + '">';
    return '<label class="fld' + (opt.cls ? ' ' + opt.cls : '') + '"><span>' + esc(label) + '</span>' + input + (opt.hint ? '<small>' + esc(opt.hint) + '</small>' : '') + '</label>';
  }

  function collect(form, original) {
    var f = Object.assign({}, original);
    ['slug', 'name_es', 'name_en', 'zona', 'barrio', 'viajeros', 'dormitorios', 'camas', 'banos', 'desc_es', 'desc_en', 'nota', 'base_price', 'price_high', 'lat', 'lng'].forEach(function (k) { f[k] = form.elements[k].value; });
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
      var hasCoords = form0.lat && form0.lng;
      el.innerHTML =
        '<div class="head"><h1>' + (isNew ? 'Nuevo piso' : esc(form0.name_es)) + '</h1><div class="hact">' +
        (!isNew ? '<a class="btn btn-ghost sm" href="../#piso=' + esc(form0.slug) + '" target="_blank" rel="noopener">' + U.ico('ext') + '<span>Ver en la web</span></a>' : '') +
        '<a class="btn btn-ghost sm" href="#/pisos">← Volver</a></div></div>' +
        '<div class="jumps" id="jumps">' +
        '<button type="button" data-jump="sec-basico">Básico</button>' +
        '<button type="button" data-jump="photosBox">Fotos' + (photos.length ? ' (' + photos.length + ')' : '') + '</button>' +
        '<button type="button" data-jump="sec-precios">Precios</button>' +
        '<button type="button" data-jump="sec-cap">Capacidad</button>' +
        '<button type="button" data-jump="sec-desc">Descripción</button>' +
        '<button type="button" data-jump="sec-mapa">Mapa</button></div>' +
        '<form id="flatForm" novalidate>' +
        '<fieldset id="sec-basico"><legend>Datos básicos</legend><div class="grid2">' +
        field('name_es', 'Nombre (español)', form0.name_es) + field('name_en', 'Nombre (inglés)', form0.name_en) +
        field('zona', 'Municipio / zona', form0.zona, { list: 'zonas', hint: 'Es el filtro de «Destino» de la web: Málaga, Torremolinos, Benalmádena, Fuengirola…' }) +
        field('barrio', 'Barrio (opcional)', form0.barrio) + '</div>' +
        '<label class="chk"><input type="checkbox" name="active"' + (form0.active ? ' checked' : '') + '><span><strong>Visible en la web</strong> (desmárcalo para ocultarlo sin borrarlo)</span></label>' +
        (isNew
          ? field('slug', 'Identificador', form0.slug, { hint: 'Se rellena solo a partir del nombre. No se podrá cambiar después.' })
          : '<details class="adv"><summary>Ajustes técnicos (identificador)</summary>' + field('slug', 'Identificador', form0.slug, { ro: true, hint: 'No se puede cambiar: lo usan las fotos y los calendarios.' }) + '</details>') +
        '<datalist id="zonas">' + zonas.map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist></fieldset>' +
        '<fieldset id="photosBox"><legend>Fotos</legend>' + (isNew ? '<p class="muted">Guarda el piso primero; después podrás subir sus fotos.</p>' :
          '<p class="muted">La <strong>primera foto</strong> es la portada. Usa las flechas para ordenarlas o «Portada» para llevar una al principio. Los cambios de fotos se guardan al momento.</p>' +
          '<div id="photoGrid" class="pgrid"></div><div class="upl"><label class="btn btn-primary">＋ Subir fotos<input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" multiple hidden></label><span id="upstat" class="muted"></span></div>') + '</fieldset>' +
        '<fieldset id="sec-precios"><legend>Precio y valoración</legend><div class="grid2">' +
        field('base_price', 'Precio temporada baja (€ por noche)', form0.base_price, { dec: true, ph: '95' }) +
        field('price_high', 'Precio temporada alta (€ por noche)', form0.price_high, { dec: true, ph: '140' }) +
        field('nota', 'Nota media (0-5, opcional)', form0.nota, { dec: true, ph: '4,8' }) + '</div><p class="muted">En la web aparece «desde X €» con el más bajo de los dos. Las fechas de temporada alta y días sueltos se editan en <a href="#/precios"><strong>Precios →</strong></a>.</p></fieldset>' +
        '<fieldset id="sec-cap"><legend>Capacidad y servicios</legend><div class="grid4">' +
        field('viajeros', 'Viajeros', form0.viajeros, { type: 'number', min: 1 }) + field('dormitorios', 'Dormitorios', form0.dormitorios, { type: 'number', min: 0 }) +
        field('camas', 'Camas (opcional)', form0.camas, { type: 'number', min: 0 }) + field('banos', 'Baños', form0.banos, { type: 'number', min: 0 }) +
        '</div><p class="muted" style="margin:6px 0 8px">Marca los servicios del piso (los tres primeros salen en la tarjeta):</p><div class="checks">' +
        L.SERVICIOS.map(function (s) { return '<label class="chk"><input type="checkbox" name="servicios" value="' + s[0] + '"' + (form0.servicios.indexOf(s[0]) !== -1 ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') +
        '</div></fieldset>' +
        '<fieldset id="sec-desc"><legend>Descripción</legend>' + field('desc_es', 'Español', form0.desc_es, { area: 5 }) + field('desc_en', 'Inglés', form0.desc_en, { area: 5 }) +
        '<button type="button" class="btn btn-ghost" id="trBtn">✨ Traducir nombre y descripción al inglés (IA)</button><p class="muted" style="margin-top:6px">Es una propuesta automática: revísala antes de guardar.</p></fieldset>' +
        '<fieldset id="sec-mapa"><legend>Ubicación en el mapa</legend><div class="grid2">' +
        field('lat', 'Latitud', form0.lat, { ph: '36.7213', hint: 'Posición aproximada de la zona, no el portal exacto.' }) + field('lng', 'Longitud', form0.lng, { ph: '-4.4214' }) + '</div>' +
        (hasCoords ? '<a class="btn btn-ghost sm" id="mapPreview" href="https://www.google.com/maps?q=' + encodeURIComponent(form0.lat + ',' + form0.lng) + '" target="_blank" rel="noopener">' + U.ico('ext') + '<span>Comprobar en Google Maps</span></a>' : '') + '</fieldset>' +
        '<div id="errs" class="errs" hidden></div>' +
        '<div class="savebar" id="savebar"><span class="sb-msg" id="sbMsg">Sin cambios pendientes</span><div class="sb-act"><a class="btn btn-ghost" href="#/pisos">Cancelar</a><button type="submit" class="btn btn-primary">Guardar cambios</button></div></div></form>';

      if (!isNew) photoManager(row, photos);
      var form = document.getElementById('flatForm'), slugTouched = !isNew, sb = document.getElementById('savebar'), sbMsg = document.getElementById('sbMsg');
      function markDirty() {
        U.setDirty(true);
        if (sb) sb.classList.add('dirty');
        if (sbMsg) sbMsg.textContent = 'Tienes cambios sin guardar';
      }
      document.getElementById('jumps').addEventListener('click', function (e) {
        var b = e.target.closest('[data-jump]'); if (!b) return;
        var tgt = document.getElementById(b.getAttribute('data-jump'));
        if (tgt) tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      form.addEventListener('input', function (e) { if (!e.target.closest('#photosBox')) markDirty(); });
      form.addEventListener('change', function (e) { if (!e.target.closest('#photosBox')) markDirty(); });
      document.getElementById('trBtn').addEventListener('click', function () {
        var btn = this, hasEn = form.elements.name_en.value.trim() || form.elements.desc_en.value.trim();
        if (hasEn && !window.confirm('Ya hay texto en inglés. ¿Sustituirlo por la traducción automática?')) return;
        U.translate([{ key: 'name', es: form.elements.name_es.value }, { key: 'desc', es: form.elements.desc_es.value }], btn).then(function (m) {
          if (!m) return;
          if (m.name) form.elements.name_en.value = m.name;
          if (m.desc) form.elements.desc_en.value = m.desc;
          markDirty();
        });
      });
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
        root.Api.saveFlat(out).then(function () { U.setDirty(false); U.toast('Piso guardado'); location.hash = '#/pisos'; })
          .catch(function (err) { U.toast(U.errMsg(err), 'err'); }).then(function () { U.busy(btn, false); });
      });
    });
  }

  function photoUrl(path, w) {
    var rel = root.VirandPhoto.url(path, w || 640);
    return /^assets\//.test(path) ? '../' + rel : root.VIRAND_CONFIG.supabaseUrl + '/storage/v1/object/public/flats/' + rel;
  }

  /* ---------- gestor de fotos (cambios inmediatos, sin pasar por «Guardar») ---------- */
  var MAX_PHOTOS = 40;
  function photoManager(flat, initial) {
    var photos = initial.slice(), grid = document.getElementById('photoGrid'), stat = document.getElementById('upstat'), inp = document.getElementById('photoFile'), working = false;

    function card(p, i, n) {
      return '<figure class="ph" data-id="' + esc(p.id) + '"><div class="pim"><img src="' + esc(photoUrl(p.path)) + '" alt="" loading="lazy">' + (i === 0 ? '<span class="cover">Portada</span>' : '') + '</div>' +
        '<div class="pbar"><button type="button" class="ico" data-act="left" aria-label="Mover antes"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
        '<span class="pn">' + (i + 1) + '/' + n + '</span><button type="button" class="ico" data-act="right" aria-label="Mover después"' + (i === n - 1 ? ' disabled' : '') + '>→</button></div>' +
        '<div class="pact">' + (i > 0 ? '<button type="button" class="btn btn-ghost sm" data-act="cover">Portada</button>' : '<span></span>') + '<button type="button" class="btn btn-danger sm" data-act="del" aria-label="Borrar foto">Borrar</button></div>' +
        '<input type="text" class="alt" data-act="alt" value="' + esc(p.alt_es || '') + '" placeholder="Qué se ve en la foto (opcional)" aria-label="Descripción de la foto"></figure>';
    }
    function paint() {
      grid.innerHTML = photos.length ? photos.map(function (p, i) { return card(p, i, photos.length); }).join('') : '<p class="empty">Este piso aún no tiene fotos.</p>';
    }
    function persistOrder(next) {
      var ch = L.changedSorts(photos, next); photos = next; paint();
      return Promise.all(ch.map(function (x) { return root.Api.setSort('flat_photos', x.id, x.sort); }));
    }
    function say(m) { stat.textContent = m || ''; }

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || working) return;
      var fig = b.closest('.ph'), id = fig.getAttribute('data-id'), i = photos.findIndex(function (x) { return x.id === id; }), act = b.getAttribute('data-act');
      if (act === 'left' || act === 'right') {
        persistOrder(L.moveItem(photos, i, act === 'left' ? -1 : 1)).then(function () { U.toast('Orden guardado'); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
      } else if (act === 'cover') {
        var next = photos.slice(); var it = next.splice(i, 1)[0]; next.unshift(it);
        persistOrder(L.reindex(next.map(function (x) { return Object.assign({}, x); }))).then(function () { U.toast('Nueva portada guardada'); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
      } else if (act === 'del') {
        if (!window.confirm('¿Borrar esta foto? No se puede deshacer.')) return;
        var p = photos[i]; working = true;
        root.Api.removePhoto(p.id).then(function () { return root.Api.removeStorage(root.VirandPhoto.storagePaths(p.path)).catch(function () {}); })
          .then(function () { return persistOrder(L.reindex(photos.filter(function (x) { return x.id !== id; }).map(function (x) { return Object.assign({}, x); }))); })
          .then(function () { U.toast('Foto borrada'); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); }).then(function () { working = false; });
      }
    });
    grid.addEventListener('change', function (e) {
      var t = e.target.closest('[data-act="alt"]'); if (!t) return;
      var id = t.closest('.ph').getAttribute('data-id'), v = t.value.trim() || null;
      root.Api.updatePhoto(id, { alt_es: v, alt_en: v }).then(function () { photos.forEach(function (p) { if (p.id === id) { p.alt_es = v; p.alt_en = v; } }); U.toast('Descripción guardada'); })
        .catch(function (x) { U.toast(U.errMsg(x), 'err'); });
    });

    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []); inp.value = ''; if (!files.length || working) return;
      if (photos.length + files.length > MAX_PHOTOS) { U.toast('Máximo ' + MAX_PHOTOS + ' fotos por piso.', 'err'); return; }
      var bad = files.map(function (f) { return root.VirandPhoto.validateFile(f); }).filter(Boolean);
      if (bad.length) { U.toast(bad[0], 'err'); return; }
      working = true; var done = 0, fails = [];
      function one(k) {
        if (k >= files.length) return Promise.resolve();
        say('Subiendo foto ' + (k + 1) + ' de ' + files.length + '…');
        return root.PhotoPrep.process(files[k]).then(function (r) {
          var path = root.VirandPhoto.newPath(flat.slug, Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4), r.ext);
          return root.Api.uploadPhoto(root.VirandPhoto.url(path, 1280), r.b1280).then(function () { return root.Api.uploadPhoto(root.VirandPhoto.url(path, 640), r.b640); })
            .then(function () { return root.Api.addPhoto({ flat_id: flat.id, path: path, alt_es: null, alt_en: null, sort: L.nextSort(photos) }); })
            .then(function (row) { photos.push(row); done++; paint(); });
        }).catch(function (x) { fails.push(files[k].name + ': ' + U.errMsg(x)); }).then(function () { return one(k + 1); });
      }
      one(0).then(function () {
        say(''); if (done) U.toast(done + ' foto(s) subida(s)' + (fails.length ? ', ' + fails.length + ' con error' : ''), fails.length ? 'err' : 'ok');
        if (fails.length) U.toast(fails[0], 'err');
      }).then(function () { working = false; });
    });
    paint();
  }

  root.ViewPisos = { list: list, edit: edit };
})(window);
