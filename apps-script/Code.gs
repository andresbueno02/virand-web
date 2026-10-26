/**
 * VirAnd Web — disponibilidad desde iCal (Airbnb, Booking...) + precio "desde".
 *
 * GET ?action=disponibilidad  →
 * { "actualizado": ISO, "pisos": { "<slug>": { "ocupado": [["AAAA-MM-DD","AAAA-MM-DD"]], "precio_desde": 120, "obsoleto": false } } }
 *
 * Hoja `Web` (cabecera en la fila 1; las columnas se leen POR NOMBRE, el orden da igual):
 *   slug | ical_urls (una o varias, separadas por salto de línea) | precio_desde | activo (SI/NO)
 *
 * Rangos ocupados [inicio, fin): `fin` es el día de salida y queda libre para una nueva llegada.
 * Nunca se devuelve SUMMARY ni DESCRIPTION (pueden contener datos de huéspedes).
 */

var SHEET_ID = 'REPLACE_WITH_SHEET_ID';
var WEB_SHEET = 'Web';
var CACHE_SECONDS = 30 * 60;            // 30 minutos
var LAST_GOOD_KEY = 'virand_last_good'; // último resultado bueno por piso (guardado en ScriptProperties)
var CACHE_KEY = 'virand_disponibilidad';

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'disponibilidad') return jsonResponse(getDisponibilidad());
  return jsonResponse({ error: 'invalid_action' });
}

function getDisponibilidad() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) { /* sigue y recalcula */ }
  }

  var rows = readWebSheet();
  var lastGood = loadLastGood();
  var pisos = {};

  rows.forEach(function (row) {
    if (row.activo !== 'SI') return;
    var urls = String(row.ical_urls || '').split(/\r?\n/).map(function (u) { return u.trim(); }).filter(Boolean);
    var ranges = [];
    var failed = false;
    urls.forEach(function (url) {
      var text = fetchIcal(url);
      if (text === null) failed = true; else ranges = ranges.concat(parseIcal(text));
    });

    var entry;
    if (failed && lastGood[row.slug]) {
      // Un iCal falló: reutiliza el último resultado bueno y márcalo obsoleto.
      entry = { ocupado: lastGood[row.slug].ocupado, obsoleto: true };
    } else if (failed) {
      entry = { ocupado: [], obsoleto: true };
    } else {
      entry = { ocupado: mergeRanges(ranges), obsoleto: false };
      lastGood[row.slug] = { ocupado: entry.ocupado };
    }
    var precio = parseFloat(String(row.precio_desde).replace(',', '.'));
    entry.precio_desde = isNaN(precio) ? null : precio;
    pisos[row.slug] = entry;
  });

  saveLastGood(lastGood);
  var result = { actualizado: new Date().toISOString(), pisos: pisos };
  try { cache.put(CACHE_KEY, JSON.stringify(result), CACHE_SECONDS); } catch (err) { /* >100KB: sin caché */ }
  return result;
}

/* ---------- Hoja ---------- */

function readWebSheet() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(WEB_SHEET);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = {};
  ['slug', 'ical_urls', 'precio_desde', 'activo'].forEach(function (name) { col[name] = header.indexOf(name); });
  if (col.slug < 0) return [];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var slug = String(r[col.slug] || '').trim();
    if (!slug) continue;
    out.push({
      slug: slug,
      ical_urls: col.ical_urls >= 0 ? r[col.ical_urls] : '',
      precio_desde: col.precio_desde >= 0 ? r[col.precio_desde] : '',
      activo: col.activo >= 0 ? String(r[col.activo]).trim().toUpperCase() : ''
    });
  }
  return out;
}

function fetchIcal(url) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    return res.getContentText();
  } catch (err) {
    return null;
  }
}

/* ---------- Último resultado bueno ---------- */

function loadLastGood() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(LAST_GOOD_KEY) || '{}'); }
  catch (err) { return {}; }
}
function saveLastGood(obj) {
  PropertiesService.getScriptProperties().setProperty(LAST_GOOD_KEY, JSON.stringify(obj));
}

/* ---------- Fechas e iCal ----------
 * Mantener sincronizado con assets/js/ical.js y assets/js/ranges.js
 * (duplicado porque Apps Script no puede importar esos ficheros). */

var DAY_MS = 86400000;

function toMs_(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function fromMs_(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate()); }
function addDays(s, n) { return fromMs_(toMs_(s) + n * DAY_MS); }

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

function dateOf(value) {
  var m = /(\d{4})(\d{2})(\d{2})/.exec(value || '');
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function parseIcal(text) {
  if (!text || typeof text !== 'string') return [];
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  var ranges = [], ev = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') {
      if (ev && ev.start && !ev.cancelled) {
        var end = ev.end || addDays(ev.start, 1);
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
  return mergeRanges(ranges);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
