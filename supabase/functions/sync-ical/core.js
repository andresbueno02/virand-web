/* Lógica pura del sincronizador iCal: extrae bloques [start_date, end_date) y uid de un fichero .ics.
   Nunca guarda SUMMARY ni DESCRIPTION (privacidad de huéspedes). */
(function (root) {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(ymd, n) {
    var p = ymd.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function parseDate(raw) {
    var m = /^(\d{4})(\d{2})(\d{2})/.exec(String(raw || '').trim());
    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : null;
  }
  function parseIcal(ics) {
    if (typeof ics !== 'string' || !ics) return [];
    var text = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    var lines = text.split(/\r?\n/), out = [], ev = null;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l === 'BEGIN:VEVENT') { ev = {}; continue; }
      if (l === 'END:VEVENT') {
        if (ev && ev.s && !ev.cancelled) {
          var e = ev.e || addDays(ev.s, 1);
          if (e > ev.s) out.push({ start_date: ev.s, end_date: e, uid: ev.uid || null });
        }
        ev = null; continue;
      }
      if (!ev) continue;
      var col = l.indexOf(':'); if (col < 0) continue;
      var key = l.slice(0, col).split(';')[0].toUpperCase(), val = l.slice(col + 1).trim();
      if (key === 'DTSTART') ev.s = parseDate(val);
      else if (key === 'DTEND') ev.e = parseDate(val);
      else if (key === 'UID') ev.uid = val.slice(0, 200);
      else if (key === 'STATUS' && val.toUpperCase() === 'CANCELLED') ev.cancelled = true;
    }
    return out;
  }
  root.SyncIcalCore = { parseIcal: parseIcal };
})(typeof globalThis !== 'undefined' ? globalThis : this);
