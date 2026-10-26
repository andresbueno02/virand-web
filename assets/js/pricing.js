/* Precios por noche: día especial > temporada alta > baja. Sin DOM. Fechas 'AAAA-MM-DD'.
   p = { low, high, days:{ 'AAAA-MM-DD': precio } }   seasons = [{from,to,yearly,label}] (temporadas ALTAS) */
(function (root, f) { var m = f(root); if (typeof module === 'object' && module.exports) module.exports = m; root.VirandPricing = m; })(typeof self !== 'undefined' ? self : this, function (root) {
  var R = (typeof require === 'function' && typeof module === 'object') ? require('./ranges.js') : root.VirandRanges;
  var MAX_NIGHTS = 400;

  // '95', '95,5', '95.50' -> número; '' / null -> null; inválido, <=0 o más de 2 decimales -> NaN
  function parsePrice(s) {
    if (s === null || s === undefined) return null;
    var t = String(s).trim().replace(',', '.');
    if (t === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    var n = Number(t);
    return n > 0 ? n : NaN;
  }

  function num(v) { return v === null || v === undefined || v === '' || isNaN(+v) ? null : +v; }

  // ¿cae 'day' en alguna temporada alta? Inclusivo en ambos extremos.
  function isHigh(day, seasons) {
    var md = day.slice(5);
    for (var i = 0; i < (seasons || []).length; i++) {
      var s = seasons[i];
      if (!s.yearly) { if (day >= s.from && day <= s.to) return true; continue; }
      var a = s.from.slice(5), b = s.to.slice(5);
      if (a <= b ? (md >= a && md <= b) : (md >= a || md <= b)) return true;   // a > b: cruza fin de año
    }
    return false;
  }

  // Precio de la noche que EMPIEZA en 'day'; null si no hay ninguno.
  function priceFor(day, p, seasons) {
    if (!p) return null;
    var special = p.days ? num(p.days[day]) : null;
    if (special !== null) return special;
    var low = num(p.low), high = num(p.high);
    if (high !== null && isHigh(day, seasons)) return high;
    if (low !== null) return low;
    return high;
  }

  // Estancia llegada -> salida (la noche de salida no cuenta). total=null si falta el precio de alguna noche.
  function stayTotal(llegada, salida, p, seasons) {
    var empty = { nights: 0, total: null, complete: false, perNight: [] };
    if (!llegada || !salida || !(salida > llegada)) return empty;
    var n = R.daysBetween(llegada, salida);
    if (n < 1 || n > MAX_NIGHTS) return { nights: n > 0 ? n : 0, total: null, complete: false, perNight: [] };
    var per = [], cents = 0, complete = true;
    for (var i = 0; i < n; i++) {
      var day = R.addDays(llegada, i), price = priceFor(day, p, seasons);
      per.push({ day: day, price: price });
      if (price === null) complete = false; else cents += Math.round(price * 100);
    }
    return { nights: n, total: complete ? cents / 100 : null, complete: complete, perNight: per };
  }

  return { parsePrice: parsePrice, isHigh: isHigh, priceFor: priceFor, stayTotal: stayTotal };
});
