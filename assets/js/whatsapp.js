/* Enlace de consulta por WhatsApp con mensaje prellenado (ES/EN). Fechas formateadas a mano: determinista. */
(function (root, f) { var m = f(); if (typeof module === 'object' && module.exports) module.exports = m; root.VirandWhatsApp = m; })(typeof self !== 'undefined' ? self : this, function () {
  var MESES = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  function fmt(s, lang) {
    var p = String(s).split('-'), d = +p[2], m = +p[1] - 1, y = p[0];
    return lang === 'en' ? MESES.en[m] + ' ' + d + ', ' + y : d + ' de ' + MESES.es[m] + ' de ' + y;
  }

  function buildMessage(o) {
    var lang = o.lang === 'en' ? 'en' : 'es';
    var n = +o.personas || 0;
    var fechas = o.llegada && o.salida;
    if (lang === 'en') {
      var s = 'Hi, I\'m interested in "' + o.nombre + '"';
      if (fechas) s += ' from ' + fmt(o.llegada, 'en') + ' to ' + fmt(o.salida, 'en');
      if (n) s += ' for ' + n + (n === 1 ? ' guest' : ' guests');
      return s + '. Is it available and what is the price?';
    }
    var t = 'Hola, me interesa «' + o.nombre + '»';
    if (fechas) t += ' del ' + fmt(o.llegada, 'es') + ' al ' + fmt(o.salida, 'es');
    if (n) t += ' para ' + n + (n === 1 ? ' persona' : ' personas');
    return t + '. ¿Está disponible y cuál es el precio?';
  }

  function buildLink(o) {
    var numero = String(o.numero || '').replace(/\D/g, '');
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(buildMessage(o));
  }

  return { buildLink: buildLink, buildMessage: buildMessage };
});
