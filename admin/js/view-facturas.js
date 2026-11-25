/* Pantalla de facturación: multi-propietario (serie propia por NIF), desglose 10% IVA (RDL 29/2026),
   impresión/PDF limpia sin popups y exportación CSV/Excel trimestral para gestoría (Modelo 303). */
(function (root) {
  var L = root.AdminLogic, R = root.VirandRanges, P = root.VirandPricing, U = root.UI, esc = U.esc;
  var CHANNELS = [['direct', 'Directa / Web'], ['airbnb', 'Airbnb'], ['booking', 'Booking.com'], ['vrbo', 'Vrbo'], ['other', 'Otro']];
  var CH_MAP = { direct: 'Directa', airbnb: 'Airbnb', booking: 'Booking', vrbo: 'Vrbo', other: 'Otro' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtEur(n) {
    if (n == null || isNaN(+n)) return '0,00 €';
    return (+n).toFixed(2).replace('.', ',') + ' €';
  }
  function fmtDate(s) {
    if (!s) return '';
    var p = String(s).split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : s;
  }
  function quarterOf(ymd) {
    var m = +String(ymd || '').slice(5, 7);
    return m ? Math.ceil(m / 3) : 0;
  }

  /* ---------- Vista previa e impresión / PDF ---------- */
  function openPreview(inv, flatName) {
    var box = document.getElementById('invModal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'invModal';
      box.className = 'inv-modal';
      document.body.appendChild(box);
    }
    var kindTitle = inv.kind === 'rectificative' ? 'FACTURA RECTIFICATIVA' : (inv.kind === 'simplified' ? 'FACTURA SIMPLIFICADA' : 'FACTURA');
    var exemptNote = +inv.vat_rate === 0 ? '<p class="inv-legal">Operación exenta de IVA conforme al artículo 20.Uno.23º de la Ley 37/1992 del IVA (arrendamiento de vivienda superior a 30 noches sin servicios complementarios de hostelería).</p>' : '';
    box.hidden = false;
    document.body.classList.add('has-inv-modal');
    box.innerHTML =
      '<div class="inv-bar no-print">' +
      '<button type="button" class="btn btn-ghost sm" id="invClose">← Cerrar</button>' +
      '<div class="hact"><button type="button" class="btn btn-primary sm" id="invPrintBtn">🖨️ Guardar PDF / Imprimir</button></div></div>' +
      '<article class="inv-sheet">' +
      '<header class="inv-head">' +
      '<div><div class="inv-type">' + esc(kindTitle) + '</div><div class="inv-num">Nº ' + esc(inv.number) + '</div>' +
      '<div class="inv-date">Fecha de expedición: <strong>' + esc(fmtDate(inv.issue_date)) + '</strong></div>' +
      (inv.rectifies_number ? '<div class="inv-rect">Rectifica a la factura nº: <strong>' + esc(inv.rectifies_number) + '</strong></div>' : '') + '</div>' +
      '<div class="inv-brand"><span>VirAnd</span><small>Alquiler Vacacional</small></div></header>' +
      '<section class="inv-parties">' +
      '<div class="inv-party"><small>EMISOR</small><strong>' + esc(inv.issuer_name) + '</strong><div>NIF: ' + esc(inv.issuer_tax_id) + '</div><div>' + esc(inv.issuer_address) + '</div></div>' +
      '<div class="inv-party"><small>CLIENTE</small>' +
      (inv.guest_name ? '<strong>' + esc(inv.guest_name) + '</strong>' : '<strong>Cliente alojamiento turístico</strong>') +
      (inv.guest_tax_id ? '<div>NIF / Doc.: ' + esc(inv.guest_tax_id) + '</div>' : '') +
      (inv.guest_address ? '<div>' + esc(inv.guest_address) + '</div>' : '') + '</div></section>' +
      '<table class="inv-tbl"><thead><tr><th>Concepto</th><th>Base imp.</th><th>IVA</th><th>Cuota IVA</th><th>Total</th></tr></thead><tbody>' +
      '<tr><td><strong>' + esc(inv.concept) + '</strong>' +
      (flatName ? '<div class="inv-sub">Alojamiento: ' + esc(flatName) + '</div>' : '') +
      (inv.check_in && inv.check_out ? '<div class="inv-sub">Estancia: ' + esc(fmtDate(inv.check_in)) + ' al ' + esc(fmtDate(inv.check_out)) + (inv.nights ? ' (' + inv.nights + ' noche' + (inv.nights === 1 ? '' : 's') + ')' : '') + '</div>' : '') +
      '</td><td>' + fmtEur(inv.base_amount) + '</td><td>' + (+inv.vat_rate) + ' %</td><td>' + fmtEur(inv.vat_amount) + '</td><td><strong>' + fmtEur(inv.total_amount) + '</strong></td></tr></tbody></table>' +
      '<div class="inv-totals">' +
      '<div><span>Base imponible</span><strong>' + fmtEur(inv.base_amount) + '</strong></div>' +
      '<div><span>IVA (' + (+inv.vat_rate) + ' %)</span><strong>' + fmtEur(inv.vat_amount) + '</strong></div>' +
      '<div class="inv-grand"><span>TOTAL FACTURA</span><strong>' + fmtEur(inv.total_amount) + '</strong></div></div>' +
      exemptNote +
      (inv.notes ? '<p class="inv-notes"><strong>Observaciones:</strong> ' + esc(inv.notes) + '</p>' : '') +
      '</article>';

    document.getElementById('invClose').onclick = function () { box.hidden = true; document.body.classList.remove('has-inv-modal'); };
    document.getElementById('invPrintBtn').onclick = function () { window.print(); };
  }

  /* ---------- Exportar CSV para Excel / Gestoría ---------- */
  function downloadCsv(rows, flatMap, filename) {
    var head = ['Numero', 'Fecha', 'Tipo', 'Rectifica_a', 'Propietario_Emisor', 'NIF_Emisor', 'Piso', 'Canal', 'Cliente', 'NIF_Cliente', 'Direccion_Cliente', 'Entrada', 'Salida', 'Noches', 'Base_Imponible', 'Tipo_IVA', 'Cuota_IVA', 'Total'];
    function cell(v) {
      var s = v == null ? '' : String(v).replace(/"/g, '""');
      return /[;"\n\r]/.test(s) ? '"' + s + '"' : s;
    }
    function dec(n) { return n == null ? '' : (+n).toFixed(2).replace('.', ','); }
    var lines = [head.join(';')];
    rows.slice().reverse().forEach(function (r) {
      lines.push([
        r.number, fmtDate(r.issue_date), r.kind === 'rectificative' ? 'Rectificativa' : (r.kind === 'simplified' ? 'Simplificada' : 'Completa'),
        r.rectifies_number || '', r.issuer_name, r.issuer_tax_id, flatMap[r.flat_id] || '', CH_MAP[r.channel] || r.channel,
        r.guest_name || '', r.guest_tax_id || '', r.guest_address || '', fmtDate(r.check_in), fmtDate(r.check_out), r.nights || '',
        dec(r.base_amount), (+r.vat_rate) + '%', dec(r.vat_amount), dec(r.total_amount)
      ].map(cell).join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function render(el, bookingId) {
    var t0 = today(), curYear = +t0.slice(0, 4);
    var S = {
      flats: [], issuers: [], invoices: [], needSetup: false,
      fYear: curYear, fQuarter: 0, fIssuer: '',
      draft: {
        flat_id: '', issuer_id: '', booking_id: '', channel: 'direct', kind: 'complete',
        issue_date: t0, check_in: '', check_out: '', total_amount: '', vat_rate: 10, vatTouched: false,
        guest_name: '', guest_tax_id: '', guest_address: '', concept: '', conceptTouched: false, notes: ''
      }
    };

    function flatById(id) { return S.flats.filter(function (f) { return f.id === id; })[0]; }
    function autoConcept() {
      var f = flatById(S.draft.flat_id);
      var base = 'Alojamiento turístico' + (f ? ' — ' + f.name_es : '');
      if (S.draft.check_in && S.draft.check_out && S.draft.check_out > S.draft.check_in) {
        var n = R.nights(S.draft.check_in, S.draft.check_out);
        base += ' (' + fmtDate(S.draft.check_in) + ' a ' + fmtDate(S.draft.check_out) + ', ' + n + ' noche' + (n === 1 ? '' : 's') + ')';
      }
      return base;
    }

    function filteredInvoices() {
      return S.invoices.filter(function (x) {
        if (S.fIssuer && x.issuer_id !== S.fIssuer) return false;
        if (S.fQuarter && quarterOf(x.issue_date) !== S.fQuarter) return false;
        return true;
      });
    }

    function updateLiveBreakdown() {
      var box = document.getElementById('vatBox'); if (!box) return;
      var c = L.calcVatFromTotal(S.draft.total_amount, S.draft.vat_rate);
      if (!c || c.total <= 0) {
        box.innerHTML = '<span class="muted">Escribe el total cobrado al cliente para ver el desglose automático de IVA.</span>';
        return;
      }
      box.innerHTML =
        '<div class="vat-item"><small>Base imponible</small><strong>' + fmtEur(c.base) + '</strong></div>' +
        '<div class="vat-item"><small>IVA (' + c.rate + ' %)</small><strong>' + fmtEur(c.vat) + '</strong></div>' +
        '<div class="vat-item tot"><small>Total cobrado</small><strong>' + fmtEur(c.total) + '</strong></div>';
    }

    function paint() {
      if (S.needSetup) {
        el.innerHTML = '<div class="head"><h1>Facturas</h1></div>' +
          '<div class="warn"><strong>Falta activar las tablas de facturación en Supabase (1 minuto):</strong><br>Abre Supabase → <em>SQL Editor → New query</em>, pega el contenido de <code>supabase/invoices_migration.sql</code> y pulsa <strong>Run</strong>. Después recarga esta pantalla.</div>';
        return;
      }
      var flatMap = {}; S.flats.forEach(function (f) { flatMap[f.id] = f.name_es; });
      var list = filteredInvoices();
      var sumBase = 0, sumVat = 0, sumTot = 0;
      list.forEach(function (x) { sumBase += +x.base_amount; sumVat += +x.vat_amount; sumTot += +x.total_amount; });

      var d = S.draft;
      var nights = d.check_in && d.check_out && d.check_out > d.check_in ? R.nights(d.check_in, d.check_out) : 0;

      el.innerHTML =
        '<div class="head"><h1>Facturas</h1></div>' +
        (!S.issuers.length ? '<div class="warn"><strong>Paso previo:</strong> Antes de hacer tu primera factura, añade abajo los datos fiscales del propietario/emisor (sección 3) y asígnalo a sus pisos.</div>' : '') +

        '<fieldset><legend>1 · Emitir factura al instante</legend>' +
        '<form id="invForm" novalidate>' +
        '<div class="seg" role="group" aria-label="Tipo de factura">' +
        '<button type="button" data-ikind="complete" aria-pressed="' + String(d.kind === 'complete') + '">Factura completa</button>' +
        '<button type="button" data-ikind="simplified" aria-pressed="' + String(d.kind === 'simplified') + '">Simplificada (≤ 400 €)</button></div>' +
        '<div class="grid2">' +
        '<label class="fld"><span>Piso</span><select name="flat_id"><option value="">— Seleccionar piso —</option>' +
        S.flats.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === d.flat_id ? ' selected' : '') + '>' + esc(f.name_es) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld"><span>Propietario / Emisor fiscal</span><select name="issuer_id" required><option value="">— Seleccionar propietario —</option>' +
        S.issuers.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === d.issuer_id ? ' selected' : '') + '>' + esc(i.name) + ' (' + esc(i.series) + ' · ' + esc(i.tax_id) + ')</option>'; }).join('') + '</select></label>' +
        '<label class="fld"><span>Canal de reserva</span><select name="channel">' +
        CHANNELS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === d.channel ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld"><span>Fecha de factura</span><input type="date" name="issue_date" value="' + esc(d.issue_date) + '" required></label>' +
        '<label class="fld"><span>Entrada estancia</span><input type="date" name="check_in" value="' + esc(d.check_in) + '"></label>' +
        '<label class="fld"><span>Salida estancia' + (nights ? ' (' + nights + ' noche' + (nights === 1 ? '' : 's') + ')' : '') + '</span><input type="date" name="check_out" value="' + esc(d.check_out) + '"></label>' +
        '<label class="fld"><span>Total cobrado (€ IVA incluido)</span><input type="text" inputmode="decimal" name="total_amount" value="' + esc(d.total_amount) + '" placeholder="Ej. 450" required></label>' +
        '<label class="fld"><span>Tipo de IVA</span><select name="vat_rate">' +
        '<option value="10"' + (+d.vat_rate === 10 ? ' selected' : '') + '>10 % · Alquiler turístico (≤ 30 noches)</option>' +
        '<option value="0"' + (+d.vat_rate === 0 ? ' selected' : '') + '>0 % · Exento (> 30 noches sin hostelería)</option>' +
        '<option value="21"' + (+d.vat_rate === 21 ? ' selected' : '') + '>21 % · General / otros servicios</option></select></label></div>' +

        '<div class="vat-box" id="vatBox"></div>' +

        '<div class="grid2">' +
        '<label class="fld"><span>Nombre completo del cliente' + (d.kind === 'simplified' ? ' (opcional)' : '') + '</span><input type="text" name="guest_name" value="' + esc(d.guest_name) + '" placeholder="Nombre y apellidos / Empresa"></label>' +
        '<label class="fld"><span>DNI / Pasaporte / NIF' + (d.kind === 'simplified' ? ' (opcional)' : '') + '</span><input type="text" name="guest_tax_id" value="' + esc(d.guest_tax_id) + '" placeholder="Ej. 12345678A"></label></div>' +
        (d.kind === 'complete' ? '<label class="fld"><span>Dirección del cliente</span><input type="text" name="guest_address" value="' + esc(d.guest_address) + '" placeholder="Calle, CP, Ciudad, País"></label>' : '') +
        '<label class="fld"><span>Concepto en factura</span><input type="text" name="concept" value="' + esc(d.concept || autoConcept()) + '" required></label>' +
        '<label class="fld"><span>Observaciones (opcional)</span><input type="text" name="notes" value="' + esc(d.notes) + '" placeholder="Ej. Pagado por transferencia / Airbnb…"></label>' +
        '<div id="invErrs" class="errs" hidden></div>' +
        '<div class="actions"><button type="submit" class="btn btn-primary"' + (!S.issuers.length ? ' disabled' : '') + '>🧾 Emitir factura y generar PDF</button></div></form></fieldset>' +

        '<fieldset><legend>2 · Libro de facturas y exportación para gestoría (Modelo 303)</legend>' +
        '<div class="inv-filters">' +
        '<label class="fld"><span>Año</span><input type="number" id="fYear" value="' + S.fYear + '" min="2024" max="2035"></label>' +
        '<label class="fld"><span>Trimestre</span><select id="fQuarter">' +
        '<option value="0"' + (S.fQuarter === 0 ? ' selected' : '') + '>Todo el año</option>' +
        '<option value="1"' + (S.fQuarter === 1 ? ' selected' : '') + '>1T (Ene–Mar)</option>' +
        '<option value="2"' + (S.fQuarter === 2 ? ' selected' : '') + '>2T (Abr–Jun)</option>' +
        '<option value="3"' + (S.fQuarter === 3 ? ' selected' : '') + '>3T (Jul–Sep)</option>' +
        '<option value="4"' + (S.fQuarter === 4 ? ' selected' : '') + '>4T (Oct–Dic)</option></select></label>' +
        '<label class="fld"><span>Propietario / Emisor</span><select id="fIssuer"><option value="">Todos los propietarios</option>' +
        S.issuers.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === S.fIssuer ? ' selected' : '') + '>' + esc(i.name) + ' (' + esc(i.series) + ')</option>'; }).join('') + '</select></label></div>' +
        '<div class="stats">' +
        '<span class="stat"><strong>' + list.length + '</strong> facturas</span>' +
        '<span class="stat">Base: <strong>' + fmtEur(sumBase) + '</strong></span>' +
        '<span class="stat warn">IVA repercutido: <strong>' + fmtEur(sumVat) + '</strong></span>' +
        '<span class="stat ok">Total: <strong>' + fmtEur(sumTot) + '</strong></span></div>' +
        (list.length ? '<div class="actions" style="margin-bottom:14px"><button type="button" class="btn btn-ghost sm" data-act="csv">📥 Descargar Excel / CSV para gestoría</button></div>' +
          '<div class="bk-list">' + list.map(function (inv) {
            return '<div class="bk-card" data-inv="' + esc(inv.id) + '">' +
              '<div class="bk-main"><div class="bk-top"><span class="tag ' + (inv.kind === 'rectificative' ? 'warn' : 'bk') + '">' + esc(inv.number) + '</span>' +
              '<strong>' + fmtEur(inv.total_amount) + '</strong><span class="muted">(Base ' + fmtEur(inv.base_amount) + ' + IVA ' + (+inv.vat_rate) + '% ' + fmtEur(inv.vat_amount) + ')</span></div>' +
              '<div class="bk-who">' + esc(inv.guest_name || 'Factura simplificada') + ' · <span class="muted">' + esc(fmtDate(inv.issue_date)) + ' · ' + esc(inv.issuer_name) + (flatMap[inv.flat_id] ? ' · ' + esc(flatMap[inv.flat_id]) : '') + '</span></div></div>' +
              '<div class="bk-act"><button type="button" class="btn btn-primary sm" data-act="inv-pdf">Ver / PDF</button>' +
              (inv.kind !== 'rectificative' ? '<button type="button" class="btn btn-danger sm" data-act="inv-rect" title="Anular mediante factura rectificativa">Rectificar</button>' : '') + '</div></div>';
          }).join('') + '</div>' : '<p class="empty">No hay facturas emitidas en este periodo.</p>') + '</fieldset>' +

        '<details class="group"' + (!S.issuers.length ? ' open' : '') + '><summary><strong>3 · Propietarios / Emisores fiscales y asignación de pisos</strong><span class="muted"> · ' + S.issuers.length + ' dados de alta</span></summary>' +
        '<div style="padding:0 16px 16px">' +
        '<p class="muted" style="margin-bottom:12px">Cada propietario tiene su propio NIF y su propia serie correlativa (ej. <code>VBG</code> → <code>VBG-2026-0001</code>). Así nunca se mezclan facturas de distintos dueños.</p>' +
        (S.issuers.length ? '<div class="bk-list" style="margin-bottom:14px">' + S.issuers.map(function (i) {
          return '<div class="bk-card" data-iss="' + esc(i.id) + '"><div class="grow"><strong>' + esc(i.name) + '</strong> <span class="tag bk">Serie ' + esc(i.series) + '</span>' +
            '<span class="muted">NIF: ' + esc(i.tax_id) + ' · ' + esc(i.address) + '</span></div>' +
            '<button type="button" class="btn btn-danger sm" data-act="iss-del">Borrar</button></div>';
        }).join('') + '</div>' : '') +
        '<form id="issForm" class="ical-add" novalidate><div class="grid2">' +
        '<label class="fld"><span>Nombre completo o Razón social</span><input type="text" name="name" placeholder="Ej. Virginia Botella Gómez" required></label>' +
        '<label class="fld"><span>NIF / DNI / CIF</span><input type="text" name="tax_id" placeholder="Ej. 12345678Z" required></label>' +
        '<label class="fld"><span>Domicilio fiscal completo</span><input type="text" name="address" placeholder="Calle, nº, CP, Municipio, Provincia" required></label>' +
        '<label class="fld"><span>Prefijo de serie (1-8 letras/números)</span><input type="text" name="series" placeholder="Ej. VBG" maxlength="8" required></label></div>' +
        '<button type="submit" class="btn btn-primary sm">＋ Añadir propietario / emisor</button></form>' +

        (S.issuers.length && S.flats.length ? '<div class="ical-add" style="margin-top:18px"><strong style="display:block;margin-bottom:8px">Propietario asignado a cada piso</strong>' +
          S.flats.map(function (f) {
            return '<div class="prow" style="grid-template-columns:1fr 240px"><span class="pn">' + esc(f.name_es) + '</span>' +
              '<select data-flat-iss="' + esc(f.id) + '" aria-label="Propietario de ' + esc(f.name_es) + '"><option value="">— Sin asignar —</option>' +
              S.issuers.map(function (i) { return '<option value="' + esc(i.id) + '"' + (f.issuer_id === i.id ? ' selected' : '') + '>' + esc(i.name) + ' (' + esc(i.series) + ')</option>'; }).join('') + '</select></div>';
          }).join('') + '</div>' : '') +
        '</div></details>';

      updateLiveBreakdown();
      bindForms(flatMap, list);
    }

    function bindForms(flatMap, list) {
      var form = document.getElementById('invForm');
      if (form) {
        form.addEventListener('input', function (e) {
          var n = e.target.name;
          if (!n) return;
          S.draft[n] = e.target.value;
          if (n === 'concept') S.draft.conceptTouched = true;
          if (n === 'total_amount') updateLiveBreakdown();
        });
        form.addEventListener('change', function (e) {
          var n = e.target.name;
          if (!n) return;
          S.draft[n] = e.target.value;
          if (n === 'flat_id') {
            var f = flatById(S.draft.flat_id);
            if (f && f.issuer_id) S.draft.issuer_id = f.issuer_id;
            if (!S.draft.conceptTouched) S.draft.concept = autoConcept();
            paint();
          } else if (n === 'check_in' || n === 'check_out') {
            if (!S.draft.vatTouched) S.draft.vat_rate = L.autoVatRate(S.draft.check_in, S.draft.check_out);
            if (!S.draft.conceptTouched) S.draft.concept = autoConcept();
            paint();
          } else if (n === 'vat_rate') {
            S.draft.vatTouched = true;
            updateLiveBreakdown();
          }
        });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var d = S.draft;
          var tot = P.parsePrice(d.total_amount);
          var nights = d.check_in && d.check_out && d.check_out > d.check_in ? R.nights(d.check_in, d.check_out) : null;
          var payload = {
            issuer_id: d.issuer_id, flat_id: d.flat_id || '', booking_id: d.booking_id || '',
            issue_date: d.issue_date, kind: d.kind, channel: d.channel,
            guest_name: d.guest_name, guest_tax_id: d.guest_tax_id, guest_address: d.kind === 'complete' ? d.guest_address : '',
            concept: form.elements.concept.value.trim(), check_in: d.check_in || '', check_out: d.check_out || '',
            nights: nights, vat_rate: +d.vat_rate, total_amount: tot, notes: d.notes
          };
          var errs = L.validateInvoice(payload), box = document.getElementById('invErrs');
          if (errs.length) {
            box.hidden = false;
            box.innerHTML = '<strong>Revisa esto antes de emitir:</strong><ul>' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
            return;
          }
          box.hidden = true;
          var btn = form.querySelector('button[type=submit]'); U.busy(btn, true, 'Emitiendo…');
          root.Api.issueInvoice(payload).then(function (created) {
            U.toast('Factura ' + created.number + ' emitida');
            S.draft.total_amount = ''; S.draft.guest_name = ''; S.draft.guest_tax_id = ''; S.draft.guest_address = '';
            S.draft.booking_id = ''; S.draft.notes = ''; S.draft.conceptTouched = false; S.draft.concept = '';
            return root.Api.listInvoices(S.fYear).then(function (rows) { S.invoices = rows; paint(); openPreview(created, flatMap[created.flat_id]); });
          }).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(btn, false); });
        });
      }

      var issForm = document.getElementById('issForm');
      if (issForm) issForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target;
        var row = {
          name: f.elements.name.value.trim(),
          tax_id: f.elements.tax_id.value.trim().toUpperCase(),
          address: f.elements.address.value.trim(),
          series: f.elements.series.value.trim().toUpperCase()
        };
        var errs = L.validateIssuer(row);
        if (errs.length) { U.toast(errs[0], 'err'); return; }
        var btn = f.querySelector('button[type=submit]'); U.busy(btn, true, 'Guardando…');
        root.Api.saveIssuer(row).then(function (saved) {
          if (!S.draft.issuer_id) S.draft.issuer_id = saved.id;
          U.toast('Propietario añadido');
          return root.Api.listIssuers();
        }).then(function (rows) { S.issuers = rows; paint(); }).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(btn, false); });
      });

      var fy = document.getElementById('fYear'), fq = document.getElementById('fQuarter'), fi = document.getElementById('fIssuer');
      if (fy) fy.onchange = function () { S.fYear = +this.value || curYear; root.Api.listInvoices(S.fYear).then(function (r) { S.invoices = r; paint(); }); };
      if (fq) fq.onchange = function () { S.fQuarter = +this.value; paint(); };
      if (fi) fi.onchange = function () { S.fIssuer = this.value; paint(); };
    }

    el.innerHTML = '<p class="muted">Cargando facturación…</p>';
    el.onchange = function (e) {
      var sel = e.target.closest('[data-flat-iss]');
      if (sel) {
        var fid = sel.getAttribute('data-flat-iss'), iid = sel.value || null;
        root.Api.setFlatIssuer(fid, iid).then(function () {
          S.flats.forEach(function (f) { if (f.id === fid) f.issuer_id = iid; });
          if (S.draft.flat_id === fid && iid) { S.draft.issuer_id = iid; paint(); }
          U.toast('Propietario asignado al piso');
        }).catch(function (x) { U.toast(U.errMsg(x), 'err'); });
      }
    };
    el.onclick = function (e) {
      var ik = e.target.closest('[data-ikind]');
      if (ik) { S.draft.kind = ik.getAttribute('data-ikind'); paint(); return; }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      var flatMap = {}; S.flats.forEach(function (f) { flatMap[f.id] = f.name_es; });

      if (act === 'csv') {
        var qLbl = S.fQuarter ? ('-' + S.fQuarter + 'T') : '';
        downloadCsv(filteredInvoices(), flatMap, 'facturas-' + S.fYear + qLbl + '.csv');
        return;
      }
      if (act === 'inv-pdf') {
        var id = b.closest('[data-inv]').getAttribute('data-inv');
        var inv = S.invoices.filter(function (x) { return x.id === id; })[0];
        if (inv) openPreview(inv, flatMap[inv.flat_id]);
        return;
      }
      if (act === 'inv-rect') {
        var rid = b.closest('[data-inv]').getAttribute('data-inv');
        var orig = S.invoices.filter(function (x) { return x.id === rid; })[0];
        if (!orig) return;
        if (!window.confirm('¿Emitir factura rectificativa (abono por ' + fmtEur(-Math.abs(+orig.total_amount)) + ') para anular la factura ' + orig.number + '?')) return;
        U.busy(b, true, 'Emitiendo…');
        root.Api.issueInvoice({
          issuer_id: orig.issuer_id, flat_id: orig.flat_id || '', booking_id: orig.booking_id || '',
          issue_date: today(), kind: 'rectificative', rectifies_id: orig.id, rectifies_number: orig.number,
          channel: orig.channel, guest_name: orig.guest_name || '', guest_tax_id: orig.guest_tax_id || '', guest_address: orig.guest_address || '',
          concept: 'Rectificación (anulación) de factura ' + orig.number + ' — ' + orig.concept,
          check_in: orig.check_in || '', check_out: orig.check_out || '', nights: orig.nights,
          vat_rate: +orig.vat_rate, total_amount: -Math.abs(+orig.total_amount), notes: 'Factura rectificativa por anulación'
        }).then(function (rec) {
          U.toast('Rectificativa ' + rec.number + ' emitida');
          return root.Api.listInvoices(S.fYear).then(function (rows) { S.invoices = rows; paint(); openPreview(rec, flatMap[rec.flat_id]); });
        }).catch(function (x) { U.toast(U.errMsg(x), 'err'); U.busy(b, false); });
        return;
      }
      if (act === 'iss-del') {
        var iid = b.closest('[data-iss]').getAttribute('data-iss');
        if (!window.confirm('¿Borrar este propietario? (Solo es posible si aún no tiene facturas emitidas).')) return;
        root.Api.removeIssuer(iid).then(function () { U.toast('Propietario eliminado'); return root.Api.listIssuers(); })
          .then(function (rows) { S.issuers = rows; paint(); }).catch(function (x) { U.toast('No se puede borrar un propietario que ya tiene facturas emitidas.', 'err'); });
      }
    };

    return Promise.all([
      root.Api.listFlats(),
      root.Api.listIssuers().catch(function (err) {
        if (/issuers|relation|schema cache/i.test(err.message)) { S.needSetup = true; return []; }
        throw err;
      }),
      root.Api.listInvoices(curYear).catch(function () { return []; }),
      bookingId ? root.Api.getBooking(bookingId).catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (r) {
      S.flats = r[0]; S.issuers = r[1]; S.invoices = r[2];
      if (S.issuers.length === 1) S.draft.issuer_id = S.issuers[0].id;
      var bk = r[3];
      if (bk) {
        S.draft.booking_id = bk.id;
        S.draft.flat_id = bk.flat_id;
        var fl = flatById(bk.flat_id);
        if (fl && fl.issuer_id) S.draft.issuer_id = fl.issuer_id;
        S.draft.check_in = bk.check_in || '';
        S.draft.check_out = bk.check_out || '';
        S.draft.vat_rate = L.autoVatRate(S.draft.check_in, S.draft.check_out);
        S.draft.guest_name = bk.guest_name || '';
        if (bk.total_price != null) S.draft.total_amount = String(bk.total_price).replace('.', ',');
        S.draft.concept = autoConcept();
      }
      paint();
    });
  }

  root.ViewFacturas = { render: render };
})(window);
