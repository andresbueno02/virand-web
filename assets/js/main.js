/* VirAnd — lógica de la página. Los módulos puros (ranges, search, whatsapp) están probados en tests/. */
(function () {
  'use strict';
  var CFG = window.VIRAND_CONFIG, R = window.VirandRanges, S = window.VirandSearch, W = window.VirandWhatsApp, I = window.VirandIcons;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var st = {
    pricing: null, lang: 'es', dict: { es: {}, en: {} }, pisos: [], opiniones: [], faq: [], avail: null, availLoaded: false,
    f: { zona: '', personas: 1, llegada: '', salida: '', orden: 'recomendado', servicios: [] },
    modal: null, lb: false
  };
  var QUICK_SVCS = ['playa', 'piscina', 'parking', 'vistas-mar', 'jacuzzi', 'mascotas', 'llegada-autonoma'];
  var toastTimer = null;

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function t(key, vars) {
    var s = st.dict[st.lang][key] || st.dict.es[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function plural(base, n) { return t('u.' + base + (n === 1 ? '1' : 'N'), { n: n }); }
  function loc(o) { return o ? (o[st.lang] || o.es || '') : ''; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(s) { return new Intl.DateTimeFormat(st.lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')); }
  function priceOf(p) { return S.precioDesde(p, st.avail); }
  function waUrl(extra) {
    return W.buildLink(Object.assign({ numero: CFG.whatsapp, lang: st.lang }, extra || {}));
  }
  function sizes(p, i) {
    var f = p.fotos && (p.fotos[i] || p.fotos[0]);
    if (!f || !f.src) return { s: 'assets/img/hero-900.webp', l: 'assets/img/hero-2000.webp' };
    return { s: window.VirandPhoto.url(f.src, 640), l: window.VirandPhoto.url(f.src, 1280) };
  }
  function placeOf(p) { return p.zona + (p.barrio ? ' · ' + p.barrio : ''); }
  function showToast(msg) {
    var el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  /* ---------- i18n estático ---------- */
  function applyStatic() {
    document.documentElement.lang = st.lang;
    document.title = t('meta.title');
    var md = $('meta[name=description]'); if (md) md.content = t('meta.desc');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === st.lang)); });
    $('#menuBtn').innerHTML = I.svg('menu');
    $('#waMain').href = waUrl(); $('#waMain').textContent = t('nav.whatsapp');
    var wf = $('#waFloat'); if (wf) { wf.href = waUrl(); wf.innerHTML = I.svg('whatsapp') + '<span>' + esc(t('nav.whatsapp')) + '</span>'; }
    $('#igLink').href = CFG.instagram; $('#fbLink').href = CFG.facebook;
  }

  /* ---------- buscador ---------- */
  function fillSearchControls() {
    var zonas = []; st.pisos.forEach(function (p) { if (p.activo !== false && zonas.indexOf(p.zona) === -1) zonas.push(p.zona); });
    var z = $('#fZone'), cur = st.f.zona;
    z.innerHTML = '<option value="">' + esc(t('search.zone.all')) + '</option>' + zonas.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    z.value = cur;
    var max = Math.max.apply(null, st.pisos.map(function (p) { return p.viajeros || 1; }).concat([2]));
    var x = $('#fPax'), h = '';
    for (var n = 1; n <= max; n++) h += '<option value="' + n + '">' + esc(n === 1 ? t('search.pax.1') : t('search.pax.n', { n: n })) + '</option>';
    x.innerHTML = h; x.value = String(st.f.personas);
    var min = todayStr(); $('#fIn').min = min; $('#fOut').min = min;
  }

  function readSearch() {
    st.f.zona = $('#fZone').value; st.f.personas = +$('#fPax').value || 1;
    st.f.llegada = $('#fIn').value; st.f.salida = $('#fOut').value;
    if (st.f.llegada && st.f.salida && st.f.salida <= st.f.llegada) { st.f.salida = R.addDays(st.f.llegada, 1); $('#fOut').value = st.f.salida; }
    if (st.f.llegada) $('#fOut').min = R.addDays(st.f.llegada, 1);
    $('#clearDates').hidden = !(st.f.llegada || st.f.salida);
    renderList();
  }

  /* ---------- listado ---------- */
  function amenHtml(list, limit) {
    return (list || []).slice(0, limit || 99).map(function (k) { return '<span>' + I.svg(k) + esc(t('svc.' + k)) + '</span>'; }).join('');
  }
  function renderServiceFilters() {
    var box = $('#svcFilters'); if (!box) return;
    var avail = QUICK_SVCS.filter(function (k) { return st.pisos.some(function (p) { return (p.servicios || []).indexOf(k) !== -1; }); });
    if (!avail.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = avail.map(function (k) {
      var on = st.f.servicios.indexOf(k) !== -1;
      return '<button type="button" class="svc-chip" data-svc="' + esc(k) + '" aria-pressed="' + String(on) + '">' + I.svg(k) + esc(t('svc.' + k)) + '</button>';
    }).join('');
  }
  function cardHtml(p) {
    var pr = priceOf(p), im = sizes(p, 0), name = loc(p.nombre);
    var alt = p.fotos && p.fotos[0] ? loc(p.fotos[0].alt) : name;
    var dates = st.f.llegada && st.f.salida;
    var free = dates && S.estadoDisponibilidad(st.avail, p.slug, st.f.llegada, st.f.salida) === 'libre';
    return '<a class="card" href="#piso=' + esc(p.slug) + '" data-slug="' + esc(p.slug) + '">' +
      '<div class="im"><img src="' + esc(im.s) + '" srcset="' + esc(im.s) + ' 640w, ' + esc(im.l) + ' 1280w" sizes="(max-width:620px) 92vw, (max-width:1000px) 46vw, 30vw" width="640" height="480" loading="lazy" alt="' + esc(alt) + '">' +
      (free ? '<span class="badge">' + esc(t('card.free')) + '</span>' : '') + '</div>' +
      '<div class="body"><span class="zone">' + esc(placeOf(p)) + '</span><h3>' + esc(name) + '</h3>' +
      '<p class="meta">' + esc(plural('guest', p.viajeros)) + ' · ' + esc(plural('bedroom', p.dormitorios)) + ' · ' + esc(plural('bath', p.banos)) + '</p>' +
      '<div class="chips">' + amenHtml(p.servicios, 3) + '</div>' +
      '<div class="foot"><span class="price">' + (pr ? '<small>' + esc(t('card.from')) + '</small> <b>' + pr + ' €</b> <small>' + esc(t('card.night')) + '</small>' : '<small>' + esc(t('card.consult')) + '</small>') + '</span>' +
      (p.nota ? '<span class="rating">★ ' + String(p.nota).replace('.', st.lang === 'es' ? ',' : '.') + '</span>' : '') + '</div></div></a>';
  }

  function renderList() {
    var list = S.sortPisos(S.filterPisos(st.pisos, st.f, st.avail), st.f.orden, st.avail);
    $('#cards').innerHTML = list.length ? list.map(cardHtml).join('') : '<p class="empty">' + esc(t('empty')) + '</p>';
    $('#count').textContent = list.length === 1 ? t('count.1') : t('count.n', { n: list.length });
  }

  /* ---------- secciones estáticas ---------- */
  function renderWhy() {
    var items = [['user', 1], ['shield', 2], ['centro', 3], ['chat', 4]];
    $('#whyGrid').innerHTML = items.map(function (x) {
      return '<div class="why-item">' + I.svg(x[0]) + '<h3>' + esc(t('why.' + x[1] + '.t')) + '</h3><p>' + esc(t('why.' + x[1] + '.d')) + '</p></div>';
    }).join('');
  }
  function renderReviews() {
    $('#reviews').innerHTML = st.opiniones.map(function (o) {
      return '<figure class="review"><div class="stars" aria-label="' + o.nota + '/5">' + '★★★★★'.slice(0, o.nota) + '</div><blockquote>“' + esc(loc(o.texto)) + '”</blockquote><cite>' + esc(loc(o.autor)) + '</cite></figure>';
    }).join('');
  }
  function renderFaq() {
    $('#faqList').innerHTML = st.faq.map(function (q) {
      return '<details><summary>' + esc(loc(q.pregunta)) + '</summary><p>' + esc(loc(q.respuesta)) + '</p></details>';
    }).join('');
    var ld = $('#faqLd');
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'faqLd'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: st.faq.map(function (q) { return { '@type': 'Question', name: loc(q.pregunta), acceptedAnswer: { '@type': 'Answer', text: loc(q.respuesta) } }; }) });
  }

  /* ---------- modal de detalle y lightbox ---------- */
  var lastFocus = null;
  function shareFlat(name) {
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: name + ' · VirAnd', url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { showToast(t('wa.copy')); }).catch(function () { copyFallback(url); });
    } else copyFallback(url);
  }
  function copyFallback(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(t('wa.copy')); } catch (e) {}
    document.body.removeChild(ta);
  }
  function syncLightbox() {
    if (!st.lb || !st.modal) return;
    var p = st.modal.p, fotos = p.fotos || [], n = fotos.length;
    if (!n) { closeLightbox(); return; }
    var f = fotos[st.modal.g];
    var img = $('#lbImg'); img.src = window.VirandPhoto.url(f.src, 1280); img.alt = loc(f.alt);
    $('#lbCount').textContent = (st.modal.g + 1) + ' / ' + n;
    $('#lbPrev').hidden = n < 2; $('#lbNext').hidden = n < 2;
  }
  function openLightbox() {
    if (!st.modal || !(st.modal.p.fotos && st.modal.p.fotos.length)) return;
    st.lb = true;
    var lb = $('#lightbox'); lb.hidden = false;
    syncLightbox();
    $('#lbClose').focus();
  }
  function closeLightbox() {
    if (!st.lb) return;
    st.lb = false;
    $('#lightbox').hidden = true;
    var btn = $('#sheet .close'); if (btn) btn.focus();
  }

  function openModal(slug, push) {
    var p = st.pisos.filter(function (x) { return x.slug === slug; })[0];
    if (!p) return;
    if (!st.modal) lastFocus = document.activeElement;
    var m = { p: p, g: 0, llegada: st.f.llegada || '', salida: st.f.salida || '', personas: Math.min(st.f.personas, p.viajeros), cal: null };
    st.modal = m;
    var a = st.avail && st.avail.pisos && st.avail.pisos[slug];
    var known = window.VirandSearch.estadoDisponibilidad(st.avail, slug, '2000-01-01', '2000-01-02') !== 'desconocido';
    var obsoleto = a && a.obsoleto;
    var pr = priceOf(p);
    var name = loc(p.nombre);
    var fotos = p.fotos || [];
    $('#sheet').innerHTML =
      '<button class="close" type="button" aria-label="' + esc(t('modal.close')) + '">×</button>' +
      '<div class="gallery" id="gal" role="group" aria-label="' + esc(t('modal.photos', { name: name })) + '"><img alt="">' +
      (fotos.length > 1 ? '<button type="button" class="gal-btn prev" aria-label="' + esc(t('modal.prev')) + '">‹</button><button type="button" class="gal-btn next" aria-label="' + esc(t('modal.next')) + '">›</button>' : '') +
      (fotos.length ? '<button type="button" class="gal-zoom" id="galZoom" aria-label="' + esc(t('modal.zoom')) + '">' + I.svg('expand') + '</button><span class="gal-count"></span>' : '') + '</div>' +
      (fotos.length > 1 ? '<div class="thumbs" id="thumbs">' + fotos.map(function (f, i) { return '<button type="button" data-i="' + i + '" aria-label="' + (i + 1) + '"><img src="' + esc(window.VirandPhoto.url(f.src, 640)) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') +
      '<div class="detail"><div><div class="detail-top"><span class="eyebrow">' + esc(placeOf(p)) + '</span><button type="button" class="share-btn" id="shareFlat">' + I.svg('share') + '<span>' + esc(t('modal.share')) + '</span></button></div><h2 id="mTitle">' + esc(name) + '</h2>' +
      '<div class="facts"><span>' + esc([plural('guest', p.viajeros), plural('bedroom', p.dormitorios), p.camas ? plural('bed', p.camas) : '', plural('bath', p.banos)].filter(Boolean).join(' · ')) + '</span>' + (p.nota ? '<span class="rating">★ ' + String(p.nota).replace('.', st.lang === 'es' ? ',' : '.') + '</span>' : '') + '</div>' +
      '<p class="desc">' + esc(loc(p.descripcion)) + '</p><h3>' + esc(t('detail.amen')) + '</h3><div class="amen">' + amenHtml(p.servicios) + '</div>' +
      '<p class="hint" style="margin-top:18px">' + esc(t('detail.dir')) + '</p></div>' +
      '<aside class="booking"><div class="price">' + (pr ? '<small>' + esc(t('card.from')) + '</small> <b>' + pr + ' €</b> <small>' + esc(t('card.night')) + '</small>' : '<small>' + esc(t('card.consult')) + '</small>') + '</div>' +
      (!known ? '<p class="warn">' + esc(t('detail.nodata')) + '</p>' : (obsoleto ? '<p class="warn">' + esc(t('detail.old')) + '</p>' : '')) +
      '<div id="calBox"></div>' +
      '<button type="button" class="cal-clear" id="mClearDates" hidden>' + esc(t('filters.clear')) + '</button>' +
      '<div id="estimate" class="estimate" hidden></div>' +
      '<div class="sel"><div><small>' + esc(t('detail.in')) + '</small><span id="selIn"></span></div><div><small>' + esc(t('detail.out')) + '</small><span id="selOut"></span></div></div>' +
      '<div class="pax"><label for="mPax">' + esc(t('detail.pax')) + '</label><select id="mPax"></select></div>' +
      '<a class="btn btn-wa" id="mWa" target="_blank" rel="noopener">' + esc(t('detail.wa')) + '</a><p class="hint">' + esc(t('detail.hint')) + '</p></aside></div>';

    var pax = $('#mPax'), h = ''; for (var n = 1; n <= p.viajeros; n++) h += '<option value="' + n + '">' + n + '</option>';
    pax.innerHTML = h; pax.value = String(m.personas);
    pax.onchange = function () { m.personas = +pax.value; updateBooking(); };

    m.cal = window.VirandCalendar.create($('#calBox'), {
      ocupado: (a && a.ocupado) || [], known: known, llegada: m.llegada, salida: m.salida, lang: st.lang,
      labels: { prev: t('cal.prev'), next: t('cal.next'), busy: t('detail.busy'), sel: t('detail.in') + ' / ' + t('detail.out') },
      onChange: function (v) { m.llegada = v.llegada || ''; m.salida = v.salida || ''; updateBooking(); }
    });
    updateBooking(); showPhoto(0);

    var sheet = $('#sheet');
    sheet.querySelector('.close').onclick = function () { closeModal(false); };
    $('#shareFlat').onclick = function () { shareFlat(name); };
    $('#mClearDates').onclick = function () { m.llegada = ''; m.salida = ''; m.cal.set(null, null); updateBooking(); };
    var prevBtn = sheet.querySelector('.prev'), nextBtn = sheet.querySelector('.next'), thumbs = $('#thumbs'), zoomBtn = $('#galZoom');
    if (prevBtn) prevBtn.onclick = function () { showPhoto(m.g - 1); };
    if (nextBtn) nextBtn.onclick = function () { showPhoto(m.g + 1); };
    if (thumbs) thumbs.onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) showPhoto(+b.getAttribute('data-i')); };
    if (zoomBtn) zoomBtn.onclick = openLightbox;
    var x0 = null, gal = $('#gal');
    gal.querySelector('img').onclick = openLightbox;
    gal.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    gal.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) showPhoto(m.g + (dx < 0 ? 1 : -1)); x0 = null; });

    var modal = $('#modal'); modal.hidden = false; modal.classList.add('open'); modal.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    sheet.querySelector('.close').focus();
    if (push !== false && location.hash !== '#piso=' + slug) history.pushState({ modal: slug }, '', '#piso=' + slug);
  }

  function updateBooking() {
    var m = st.modal; if (!m) return;
    $('#selIn').textContent = m.llegada ? fmtDate(m.llegada) : t('detail.addDate');
    var nn = m.llegada && m.salida ? R.nights(m.llegada, m.salida) : 0;
    $('#selOut').textContent = m.salida ? fmtDate(m.salida) + ' · ' + (nn === 1 ? t('detail.night1') : t('detail.nights', { n: nn })) : t('detail.addDate');
    var clr = $('#mClearDates'); if (clr) clr.hidden = !(m.llegada || m.salida);
    var est = $('#estimate'), pz = st.pricing && st.pricing.pisos && st.pricing.pisos[m.p.slug], tot = pz && m.llegada && m.salida ? window.VirandPricing.stayTotal(m.llegada, m.salida, pz, st.pricing.seasons) : null;
    if (est) {
      est.hidden = !(tot && tot.complete);
      if (!est.hidden) {
        var amount = new Intl.NumberFormat(st.lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: tot.total % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(tot.total);
        est.innerHTML = '<strong>' + esc(t('detail.estimate', { total: amount, n: tot.nights })) + '</strong><small>' + esc(t('detail.estimateNote')) + '</small>';
      }
    }
    $('#mWa').href = waUrl({ nombre: loc(m.p.nombre), llegada: m.llegada || '', salida: m.salida || '', personas: m.personas });
  }
  function showPhoto(i) {
    var m = st.modal, p = m.p, fotos = p.fotos || [], n = fotos.length;
    var img = $('#gal img');
    if (!n) { img.src = 'assets/img/hero-900.webp'; img.alt = loc(p.nombre); return; }
    m.g = (i + n) % n;
    var f = fotos[m.g];
    img.src = window.VirandPhoto.url(f.src, 1280); img.srcset = window.VirandPhoto.url(f.src, 640) + ' 640w, ' + window.VirandPhoto.url(f.src, 1280) + ' 1280w'; img.sizes = '(min-width:900px) 1000px, 100vw';
    img.alt = loc(f.alt);
    var cnt = $('#gal .gal-count'); if (cnt) cnt.textContent = (m.g + 1) + ' / ' + n;
    document.querySelectorAll('#thumbs [data-i]').forEach(function (b) { b.setAttribute('aria-current', String(+b.getAttribute('data-i') === m.g)); });
    var cur = document.querySelector('#thumbs [aria-current="true"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    syncLightbox();
  }
  function closeModal(fromPop) {
    closeLightbox();
    var modal = $('#modal'); if (!st.modal) return;
    if (!fromPop && history.state && history.state.modal) { history.back(); return; }
    modal.classList.remove('open'); modal.hidden = true; st.modal = null;
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    if (!fromPop) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.addEventListener('popstate', function () {
    if (st.lb) closeLightbox();
    var m = /#piso=([\w-]+)/.exec(location.hash);
    if (m) { if (!st.modal || st.modal.p.slug !== m[1]) openModal(m[1], false); }
    else if (st.modal) closeModal(true);
  });
  document.addEventListener('keydown', function (e) {
    if (st.lb) {
      if (e.key === 'Escape') { closeLightbox(); return; }
      if (e.key === 'ArrowLeft' && st.modal) showPhoto(st.modal.g - 1);
      if (e.key === 'ArrowRight' && st.modal) showPhoto(st.modal.g + 1);
      return;
    }
    if (!st.modal) return;
    if (e.key === 'Escape') { closeModal(false); return; }
    if (e.key === 'ArrowLeft') showPhoto(st.modal.g - 1);
    if (e.key === 'ArrowRight') showPhoto(st.modal.g + 1);
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call($('#sheet').querySelectorAll('button,a[href],select,input,[tabindex]'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(false); });
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', function () { if (st.modal) showPhoto(st.modal.g - 1); });
  $('#lbNext').addEventListener('click', function () { if (st.modal) showPhoto(st.modal.g + 1); });
  $('#lightbox').addEventListener('click', function (e) { if (e.target === this) closeLightbox(); });
  var lbX0 = null;
  $('#lightbox').addEventListener('touchstart', function (e) { lbX0 = e.touches[0].clientX; }, { passive: true });
  $('#lightbox').addEventListener('touchend', function (e) { if (lbX0 == null || !st.modal) return; var dx = e.changedTouches[0].clientX - lbX0; if (Math.abs(dx) > 40) showPhoto(st.modal.g + (dx < 0 ? 1 : -1)); lbX0 = null; });

  /* ---------- eventos ---------- */
  $('#cards').addEventListener('click', function (e) {
    var a = e.target.closest('.card'); if (!a) return;
    e.preventDefault(); openModal(a.getAttribute('data-slug'));
  });
  var svcBox = $('#svcFilters');
  if (svcBox) svcBox.addEventListener('click', function (e) {
    var b = e.target.closest('[data-svc]'); if (!b) return;
    var k = b.getAttribute('data-svc'), idx = st.f.servicios.indexOf(k);
    if (idx === -1) st.f.servicios.push(k); else st.f.servicios.splice(idx, 1);
    b.setAttribute('aria-pressed', String(idx === -1));
    renderList();
  });
  ['#fZone', '#fIn', '#fOut', '#fPax'].forEach(function (s) { $(s).addEventListener('change', readSearch); });
  $('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); readSearch(); $('#alojamientos').scrollIntoView(); });
  $('#fSort').addEventListener('change', function () { st.f.orden = this.value; renderList(); });
  $('#clearDates').addEventListener('click', function () { $('#fIn').value = ''; $('#fOut').value = ''; readSearch(); });
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });
  $('#menuBtn').addEventListener('click', function () {
    var open = $('#nav').classList.toggle('open'); this.setAttribute('aria-expanded', String(open));
    this.innerHTML = I.svg(open ? 'x' : 'menu');
  });
  $('#nav').addEventListener('click', function (e) { if (e.target.closest('a')) { this.classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); $('#menuBtn').innerHTML = I.svg('menu'); } });
  var hdr = $('.site-header');
  function onScroll() { hdr.classList.toggle('solid', window.scrollY > 60); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  function setLang(l) {
    st.lang = l; ls('virand-lang', l);
    applyStatic(); fillSearchControls(); renderServiceFilters(); renderWhy(); renderReviews(); renderFaq(); renderList();
    if (st.modal) { var s = st.modal.p.slug; var keep = { l: st.modal.llegada, s: st.modal.salida }; st.f.llegada = keep.l || st.f.llegada; st.f.salida = keep.s || st.f.salida; openModal(s, false); }
  }

  /* ---------- arranque ---------- */
  var saved = ls('virand-lang'), nav = (navigator.language || 'es').slice(0, 2);
  st.lang = saved === 'en' || saved === 'es' ? saved : (nav === 'en' ? 'en' : 'es');

  window.VirandDataSource.load()
    .then(function (d) {
      document.documentElement.setAttribute('data-source', d.source || 'local');
      st.dict.es = d.i18n.es; st.dict.en = d.i18n.en;
      st.pisos = d.pisos.filter(function (p) { return p.activo !== false; });
      st.opiniones = d.opiniones; st.faq = d.faq; st.pricing = d.pricing || null;
      applyStatic(); fillSearchControls(); renderServiceFilters(); renderWhy(); renderReviews(); renderFaq();
      renderList();
      var m = /#piso=([\w-]+)/.exec(location.hash); if (m) openModal(m[1], false);
      return window.VirandAvailability.load();
    })
    .then(function (a) {
      st.avail = a; st.availLoaded = true; renderList();
      if (st.modal) { var s = st.modal.p.slug; openModal(s, false); }
    })
    .catch(function (e) { console.error(e); $('#cards').innerHTML = '<p class="empty">No se han podido cargar los alojamientos. Escríbenos por WhatsApp.</p>'; });
})();
