/* Rangos de fechas ocupadas: [inicio, fin) con fin = día de salida (queda libre). Fechas 'AAAA-MM-DD', en UTC. */
(function (root, f) { var m = f(); if (typeof module === 'object' && module.exports) module.exports = m; root.VirandRanges = m; })(typeof self !== 'undefined' ? self : this, function () {
  var DAY = 86400000;

  function toMs(s) {
    var p = String(s).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fromMs(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function addDays(s, n) { return fromMs(toMs(s) + n * DAY); }
  function daysBetween(a, b) { return Math.round((toMs(b) - toMs(a)) / DAY); }
  function nights(a, b) { return daysBetween(a, b); }

  // Ordena y fusiona rangos solapados y contiguos ([a,b)+[b,c) -> [a,c)).
  function mergeRanges(ranges) {
    var r = [], i;
    for (i = 0; i < (ranges || []).length; i++) {
      var x = ranges[i];
      if (x && x[0] && x[1] && x[0] < x[1]) r.push([x[0], x[1]]);
    }
    r.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); });
    var out = [];
    for (i = 0; i < r.length; i++) {
      var last = out[out.length - 1];
      if (last && r[i][0] <= last[1]) { if (r[i][1] > last[1]) last[1] = r[i][1]; }
      else out.push([r[i][0], r[i][1]]);
    }
    return out;
  }

  // La noche del día `day` está ocupada si inicio <= day < fin.
  function isDayOccupied(ocupado, day) {
    for (var i = 0; i < (ocupado || []).length; i++) {
      if (day >= ocupado[i][0] && day < ocupado[i][1]) return true;
    }
    return false;
  }

  // Libre para [llegada, salida): ningún rango ocupado se solapa con él.
  function isRangeFree(ocupado, llegada, salida) {
    if (!llegada || !salida || llegada >= salida) return false;
    for (var i = 0; i < (ocupado || []).length; i++) {
      if (ocupado[i][0] < salida && llegada < ocupado[i][1]) return false;
    }
    return true;
  }

  return { addDays: addDays, nights: nights, daysBetween: daysBetween, mergeRanges: mergeRanges, isDayOccupied: isDayOccupied, isRangeFree: isRangeFree };
});
