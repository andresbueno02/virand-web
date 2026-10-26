/* Mapa de Google con marcadores de precio y círculo de zona aproximada.
   Si no hay clave o falla la carga, muestra un aviso y la lista sigue funcionando. */
(function (root) {
  var state = { map: null, items: [], overlays: [], circles: [], iw: null, loaded: false, failed: false, el: null, opt: null, pending: null, Pill: null };

  function note(msg) {
    if (state.el) state.el.innerHTML = '<div class="map-note"><p>' + msg + '</p></div>';
    if (state.opt && state.opt.onUnavailable && msg !== '…') state.opt.onUnavailable();
  }

  function loadScript(key) {
    return new Promise(function (resolve, reject) {
      if (root.google && root.google.maps) return resolve();
      root.__virandMapReady = resolve;
      root.gm_authFailure = function () { state.failed = true; reject(new Error('auth')); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=__virandMapReady&loading=async&v=weekly';
      s.async = true; s.onerror = function () { reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }

  function buildPill() {
    function Pill(pos, text, onClick) { this.pos = pos; this.text = text; this.onClick = onClick; this.div = null; }
    Pill.prototype = new google.maps.OverlayView();
    Pill.prototype.onAdd = function () {
      var d = document.createElement('button');
      d.type = 'button'; d.className = 'pill'; d.textContent = this.text; d.style.position = 'absolute';
      d.addEventListener('click', this.onClick);
      this.div = d; this.getPanes().overlayMouseTarget.appendChild(d);
    };
    Pill.prototype.draw = function () {
      var p = this.getProjection().fromLatLngToDivPixel(this.pos);
      if (p && this.div) { this.div.style.left = p.x + 'px'; this.div.style.top = p.y + 'px'; }
    };
    Pill.prototype.onRemove = function () { if (this.div) { this.div.remove(); this.div = null; } };
    Pill.prototype.setText = function (t) { this.text = t; if (this.div) this.div.textContent = t; };
    Pill.prototype.setOn = function (on) { if (this.div) this.div.classList.toggle('on', on); };
    return Pill;
  }

  function clear() {
    state.overlays.forEach(function (o) { o.setMap(null); });
    state.circles.forEach(function (c) { c.setMap(null); });
    state.overlays = []; state.circles = [];
  }

  function draw() {
    if (!state.map) return;
    clear();
    var bounds = new google.maps.LatLngBounds(), any = false;
    state.items.forEach(function (it) {
      var pos = new google.maps.LatLng(it.lat, it.lng);
      var pill = new state.Pill(pos, it.label, function (ev) { ev.stopPropagation(); openIw(it, pos); });
      pill.setMap(state.map); pill.slug = it.slug; state.overlays.push(pill);
      state.circles.push(new google.maps.Circle({ map: state.map, center: pos, radius: 300, strokeColor: '#b08a4f', strokeOpacity: .7, strokeWeight: 1, fillColor: '#b08a4f', fillOpacity: .12, clickable: false }));
      bounds.extend(pos); any = true;
    });
    if (any) { state.map.fitBounds(bounds, 60); if (state.items.length === 1) state.map.setZoom(14); }
  }

  function openIw(it, pos) {
    if (!state.iw) state.iw = new google.maps.InfoWindow();
    var box = document.createElement('div'); box.className = 'iw';
    box.innerHTML = '<img src="' + it.thumb + '" alt="" loading="lazy"><b></b><span></span><button type="button"></button>';
    box.querySelector('b').textContent = it.name;
    box.querySelector('span').textContent = it.priceText;
    var btn = box.querySelector('button'); btn.textContent = state.opt.viewLabel();
    btn.addEventListener('click', function () { state.iw.close(); state.opt.onSelect(it.slug); });
    state.iw.setContent(box); state.iw.setPosition(pos); state.iw.open(state.map);
    if (state.opt.onHover) state.opt.onHover(it.slug);
  }

  var api = {
    init: function (opt) {
      state.opt = opt; state.el = opt.container;
      var key = (root.VIRAND_CONFIG || {}).mapsKey;
      if (!key) { note(opt.t('map.noKey')); return; }
      note('…');
      loadScript(key).then(function () {
        state.el.innerHTML = '';
        state.Pill = buildPill();
        state.map = new google.maps.Map(state.el, { center: { lat: 36.66, lng: -4.5 }, zoom: 10, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
        state.loaded = true; draw();
      }).catch(function () { state.failed = true; note(opt.t('map.error')); });
    },
    // items: [{slug,lat,lng,label,name,priceText,thumb}]
    update: function (items) { state.items = items; if (state.loaded) draw(); },
    highlight: function (slug) { state.overlays.forEach(function (o) { o.setOn(o.slug === slug); }); },
    refreshText: function (t) { if (state.failed || (!state.loaded && state.el)) { /* los avisos se regeneran al recargar el idioma */ } }
  };
  root.VirandMap = api;
})(window);
