/* Parser iCal -> rangos ocupados [inicio, fin). Solo lee fechas; ignora SUMMARY/DESCRIPTION (sin datos personales).
   Mantener sincronizado con apps-script/Code.gs. */
(function (root, f) { var m = f(root); if (typeof module === 'object' && module.exports) module.exports = m; root.VirandIcal = m; })(typeof self !== 'undefined' ? self : this, function (root) {
  var R = (typeof require === 'function' && typeof module === 'object') ? require('./ranges.js') : root.VirandRanges;

  function dateOf(value) {
    var m = /(\d{4})(\d{2})(\d{2})/.exec(value || '');
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }

  function parseIcal(text) {
    if (!text || typeof text !== 'string') return [];
    // Desplegar líneas plegadas (CRLF/LF + espacio o tab) y normalizar saltos.
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var ranges = [], ev = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
      if (line === 'END:VEVENT') {
        if (ev && ev.start && !ev.cancelled) {
          var end = ev.end || R.addDays(ev.start, 1); // día completo sin DTEND = +1 día
          if (end > ev.start) ranges.push([ev.start, end]);
        }
        ev = null; continue;
      }
      if (!ev) continue;
      var idx = line.indexOf(':');
      if (idx < 0) continue;
      var name = line.slice(0, idx).split(';')[0].toUpperCase();
      var value = line.slice(idx + 1);
      if (name === 'DTSTART') ev.start = dateOf(value);
      else if (name === 'DTEND') ev.end = dateOf(value);
      else if (name === 'STATUS' && value.trim().toUpperCase() === 'CANCELLED') ev.cancelled = true;
    }
    return R.mergeRanges(ranges);
  }

  return { parseIcal: parseIcal };
});
