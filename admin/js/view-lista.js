/* Listas editables: preguntas frecuentes y opiniones */
(function (root) {
  var L = root.AdminLogic, U = root.UI, esc = U.esc;

  var CFG = {
    faq: {
      table: 'faq', title: 'Preguntas frecuentes', add: '＋ Añadir pregunta',
      intro: 'Aparecen en la web en este orden. Escribe en español; el inglés puedes rellenarlo tú (más adelante se propondrá solo).',
      label: function (r) { return r.q_es || 'Nueva pregunta'; },
      fields: [['q_es', 'Pregunta (español)', 'text'], ['q_en', 'Pregunta (inglés)', 'text'], ['a_es', 'Respuesta (español)', 'area'], ['a_en', 'Respuesta (inglés)', 'area']],
      flags: [['active', 'Visible en la web'], ['needs_review', 'Pendiente de revisar (solo aviso interno)']],
      required: ['q_es', 'a_es'], blank: { active: true, needs_review: false }
    },
    reviews: {
      table: 'reviews', title: 'Opiniones', add: '＋ Añadir opinión',
      intro: 'Solo publica opiniones reales, con permiso del huésped o citando la plataforma.',
      label: function (r) { return (r.author_es ? r.author_es + ': ' : '') + (r.text_es || 'Nueva opinión').slice(0, 70); },
      fields: [['text_es', 'Opinión (español)', 'area'], ['text_en', 'Opinión (inglés)', 'area'], ['author_es', 'Autor (español)', 'text'], ['author_en', 'Autor (inglés)', 'text'], ['rating', 'Estrellas (1-5)', 'number']],
      flags: [['active', 'Visible en la web']],
      required: ['text_es'], blank: { active: true, rating: 5 }
    }
  };

  function itemHtml(cfg, r, open) {
    var id = r.id || 'new';
    return '<details class="item" data-id="' + esc(id) + '"' + (open ? ' open' : '') + '><summary><span class="grow">' + esc(cfg.label(r)) + '</span>' +
      (r.active === false ? '<em class="tag">Oculta</em>' : '') + (r.needs_review ? '<em class="tag warn">Revisar</em>' : '') +
      (r.id ? '<span class="mv"><button type="button" class="ico" data-act="up" aria-label="Subir">↑</button><button type="button" class="ico" data-act="down" aria-label="Bajar">↓</button></span>' : '') +
      '</summary><div class="body">' +
      cfg.fields.map(function (f) {
        var v = r[f[0]] == null ? '' : r[f[0]];
        return '<label class="fld"><span>' + esc(f[1]) + '</span>' + (f[2] === 'area' ? '<textarea name="' + f[0] + '" rows="4">' + esc(v) + '</textarea>' :
          '<input type="' + (f[2] === 'number' ? 'number" min="1" max="5' : 'text') + '" name="' + f[0] + '" value="' + esc(v) + '">') + '</label>';
      }).join('') +
      cfg.flags.map(function (f) { return '<label class="chk"><input type="checkbox" name="' + f[0] + '"' + (r[f[0]] ? ' checked' : '') + '><span>' + esc(f[1]) + '</span></label>'; }).join('') +
      '<div class="actions"><button type="button" class="btn btn-primary" data-act="save">Guardar</button>' +
      (r.id ? '<button type="button" class="btn btn-danger" data-act="del">Borrar</button>' : '<button type="button" class="btn btn-ghost" data-act="cancel">Cancelar</button>') +
      '</div></div></details>';
  }

  function read(cfg, item) {
    var out = {};
    cfg.fields.forEach(function (f) {
      var v = item.querySelector('[name="' + f[0] + '"]').value.trim();
      out[f[0]] = f[2] === 'number' ? (v === '' ? null : Number(v)) : (v === '' ? null : v);
    });
    cfg.flags.forEach(function (f) { out[f[0]] = item.querySelector('[name="' + f[0] + '"]').checked; });
    return out;
  }

  function render(el, key) {
    var cfg = CFG[key], items = [];
    function paint(openId) {
      el.innerHTML = '<div class="head"><h1>' + esc(cfg.title) + '</h1><button type="button" class="btn btn-primary" data-act="add">' + esc(cfg.add) + '</button></div>' +
        '<p class="muted">' + esc(cfg.intro) + '</p><div id="draft"></div>' +
        '<div class="items">' + (items.length ? items.map(function (r) { return itemHtml(cfg, r, r.id === openId); }).join('') : '<p class="empty">Todavía no hay nada. Pulsa «' + esc(cfg.add) + '».</p>') + '</div>';
    }
    function load(openId) { return root.Api.list(cfg.table).then(function (rows) { items = rows; paint(openId); }); }

    el.innerHTML = '<p class="muted">Cargando…</p>';
    el.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), item = b.closest('.item'), id = item && item.getAttribute('data-id');
      if (act === 'add') { var d = document.getElementById('draft'); d.innerHTML = itemHtml(cfg, cfg.blank, true); d.querySelector('input,textarea').focus(); return; }
      if (act === 'cancel') { document.getElementById('draft').innerHTML = ''; return; }
      if (act === 'up' || act === 'down') {
        e.preventDefault(); e.stopPropagation();
        var idx = items.findIndex(function (x) { return x.id === id; }), moved = L.moveItem(items, idx, act === 'up' ? -1 : 1);
        var ch = L.changedSorts(items, moved); if (!ch.length) return;
        Promise.all(ch.map(function (x) { return root.Api.setSort(cfg.table, x.id, x.sort); })).then(function () { return load(id); })
          .then(function () { U.toast('Orden guardado'); }).catch(function (err) { U.toast(U.errMsg(err), 'err'); });
        return;
      }
      if (act === 'del') {
        if (!window.confirm('¿Borrar «' + cfg.label(items.find(function (x) { return x.id === id; })) + '»? No se puede deshacer.')) return;
        root.Api.remove(cfg.table, id).then(function () { U.toast('Borrado'); return load(); }).catch(function (err) { U.toast(U.errMsg(err), 'err'); });
        return;
      }
      if (act === 'save') {
        var row = read(cfg, item), missing = cfg.required.filter(function (k) { return !row[k]; });
        if (missing.length) { U.toast('Falta rellenar: ' + missing.map(function (k) { return cfg.fields.filter(function (f) { return f[0] === k; })[0][1]; }).join(', '), 'err'); return; }
        if (row.rating != null && (row.rating < 1 || row.rating > 5 || row.rating % 1)) { U.toast('Las estrellas deben ser un número del 1 al 5.', 'err'); return; }
        if (id !== 'new') row.id = id; else row.sort = L.nextSort(items);
        U.busy(b, true);
        root.Api.save(cfg.table, row).then(function (saved) { U.toast('Guardado'); return load(saved.id); })
          .catch(function (err) { U.toast(U.errMsg(err), 'err'); U.busy(b, false); });
      }
    };
    return load();
  }

  root.ViewLista = { render: render };
})(window);
