/* Textos generales de la web (portada, contacto…) */
(function (root) {
  var L = root.AdminLogic, U = root.UI, esc = U.esc;

  function render(el) {
    el.innerHTML = '<p class="muted">Cargando textos…</p>';
    return root.Api.listTexts().then(function (rows) {
      var groups = L.groupTexts(rows), orig = {};
      rows.forEach(function (r) { orig[r.key + '|' + r.lang] = r.value; });
      el.innerHTML = '<div class="head"><h1>Textos de la web</h1></div>' +
        '<p class="muted">Cambia los textos de la portada, el contacto y otras secciones. El texto con <code>{n}</code> o <code>{name}</code> lleva un dato que pone la web: déjalo tal cual.</p>' +
        '<input type="search" id="tsearch" class="search" placeholder="Buscar un texto…" aria-label="Buscar">' +
        groups.map(function (g, gi) {
          var adv = g.title === 'Avanzado';
          return '<details class="group"' + (adv ? '' : ' open') + '><summary><strong>' + esc(g.title) + '</strong><span class="muted"> · ' + g.keys.length + ' textos</span></summary>' +
            (adv ? '<p class="muted">Botones, mensajes y etiquetas de la web. Normalmente no hace falta tocarlos.</p>' : '') +
            g.keys.map(function (k) {
              return '<div class="trow" data-key="' + esc(k.key) + '"><code>' + esc(k.key) + '</code>' +
                '<label class="fld"><span>Español</span><textarea rows="' + (k.es.length > 90 ? 3 : 1) + '" data-lang="es">' + esc(k.es) + '</textarea></label>' +
                '<label class="fld"><span>Inglés</span><textarea rows="' + (k.en.length > 90 ? 3 : 1) + '" data-lang="en">' + esc(k.en) + '</textarea><button type="button" class="btn btn-ghost sm trs" data-tr="1">✨ Traducir</button></label></div>';
            }).join('') + '<div class="actions"><button type="button" class="btn btn-primary" data-save="' + gi + '">Guardar esta sección</button></div></details>';
        }).join('');

      el.onclick = function (e) {
        var tb = e.target.closest('[data-tr]');
        if (tb) {
          var row = tb.closest('.trow'), es = row.querySelector('[data-lang=es]'), en = row.querySelector('[data-lang=en]');
          if (en.value.trim() && !window.confirm('Ya hay texto en inglés. ¿Sustituirlo por la traducción automática?')) return;
          U.translate([{ key: row.getAttribute('data-key'), es: es.value }], tb).then(function (m) { if (m && m[row.getAttribute('data-key')]) { en.value = m[row.getAttribute('data-key')]; U.toast('Propuesta lista: revísala y pulsa «Guardar esta sección».'); } });
          return;
        }
        var b = e.target.closest('[data-save]'); if (!b) return;
        var det = b.closest('.group'), changed = [];
        det.querySelectorAll('.trow').forEach(function (r) {
          var key = r.getAttribute('data-key');
          r.querySelectorAll('textarea').forEach(function (t) {
            var lang = t.getAttribute('data-lang'), v = t.value.trim();
            if (v !== (orig[key + '|' + lang] || '') ) changed.push({ key: key, lang: lang, value: v });
          });
        });
        var empty = changed.filter(function (c) { return !c.value; });
        if (empty.length) { U.toast('No puede quedar ningún texto vacío (' + empty[0].key + ').', 'err'); return; }
        if (!changed.length) { U.toast('No hay cambios que guardar'); return; }
        U.busy(b, true);
        root.Api.saveTexts(changed).then(function () { changed.forEach(function (c) { orig[c.key + '|' + c.lang] = c.value; }); U.toast(changed.length + ' texto(s) guardado(s)'); })
          .catch(function (err) { U.toast(U.errMsg(err), 'err'); }).then(function () { U.busy(b, false); });
      };
      document.getElementById('tsearch').addEventListener('input', function () {
        var q = this.value.trim().toLowerCase();
        el.querySelectorAll('.trow').forEach(function (r) {
          var hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1 || Array.prototype.some.call(r.querySelectorAll('textarea'), function (t) { return t.value.toLowerCase().indexOf(q) !== -1; });
          r.hidden = !hit;
        });
        if (q) el.querySelectorAll('.group').forEach(function (g) { g.open = true; });
      });
    });
  }
  root.ViewTextos = { render: render };
})(window);
