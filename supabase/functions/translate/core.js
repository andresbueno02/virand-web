/* Lógica pura de la función «translate» (sin red ni DOM): validar la petición, construir la consulta a Gemini
   y comprobar su respuesta. Probada con tests/run.sh. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  root.TranslateCore = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LIMITS = { maxItems: 40, maxChars: 4000, maxTotal: 16000, maxKey: 60 };

  var SYSTEM = 'Eres traductor profesional de español a inglés británico para la web de alquileres vacacionales VirAnd en la Costa del Sol. ' +
    'Recibes un array JSON de objetos {key, es}. Traduce cada «es» al inglés con tono cálido, elegante y claro. ' +
    'Reglas: no añadas ni quites información; conserva nombres propios y de lugares (Málaga, Benalmádena, Torremolinos, Fuengirola, La Carihuela…); ' +
    'conserva tal cual los marcadores entre llaves como {n} o {name}, las cifras, los símbolos de moneda y los saltos de línea. ' +
    'Responde solo con un array JSON con un objeto {key, en} por cada entrada, con la misma «key».';

  function validateRequest(body) {
    if (!body || !Array.isArray(body.items) || !body.items.length) return { ok: false, error: 'No hay textos que traducir.' };
    if (body.items.length > LIMITS.maxItems) return { ok: false, error: 'Demasiados textos a la vez (máximo ' + LIMITS.maxItems + ').' };
    var items = [], total = 0, seen = {};
    for (var i = 0; i < body.items.length; i++) {
      var it = body.items[i] || {}, key = typeof it.key === 'string' ? it.key.trim() : '', es = typeof it.es === 'string' ? it.es.trim() : '';
      if (!key || key.length > LIMITS.maxKey) return { ok: false, error: 'Falta la clave de un texto.' };
      if (seen[key]) return { ok: false, error: 'Clave repetida: ' + key };
      seen[key] = 1;
      if (!es) continue;                       // los vacíos se ignoran, no son un error
      if (es.length > LIMITS.maxChars) return { ok: false, error: 'Un texto es demasiado largo (máximo ' + LIMITS.maxChars + ' caracteres).' };
      total += es.length; items.push({ key: key, es: es });
    }
    if (!items.length) return { ok: false, error: 'No hay textos que traducir.' };
    if (total > LIMITS.maxTotal) return { ok: false, error: 'Demasiado texto de una vez. Traduce en partes.' };
    return { ok: true, items: items };
  }

  function buildRequest(items) {
    return {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(items) }] }],
      generationConfig: {
        temperature: 0.2, responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { key: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['key', 'en'] } }
      }
    };
  }

  function tokens(s) { return (String(s).match(/\{[^{}\s]+\}/g) || []).sort(); }

  // Devuelve [{key, en, warn?}] o lanza Error con un mensaje en español.
  function parseResponse(g, items) {
    var cand = g && g.candidates && g.candidates[0];
    if (!cand) throw new Error(g && g.promptFeedback && g.promptFeedback.blockReason ? 'La IA no ha querido traducir este texto.' : 'La IA no ha devuelto ninguna traducción.');
    var text = cand.content && cand.content.parts && cand.content.parts.map(function (p) { return p.text || ''; }).join('');
    if (!text) throw new Error('La IA no ha devuelto ninguna traducción.');
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var arr; try { arr = JSON.parse(text); } catch (e) { throw new Error('No se ha podido leer la respuesta de la IA. Inténtalo de nuevo.'); }
    if (!Array.isArray(arr)) throw new Error('La respuesta de la IA no tiene el formato esperado.');
    var by = {}; arr.forEach(function (x) { if (x && typeof x.key === 'string' && typeof x.en === 'string' && x.en.trim()) by[x.key] = x.en.trim(); });
    return items.map(function (it) {
      var en = by[it.key];
      if (!en) throw new Error('Falta la traducción de «' + it.key + '». Inténtalo de nuevo.');
      var out = { key: it.key, en: en };
      if (tokens(it.es).join('|') !== tokens(en).join('|')) out.warn = 'Revisa los marcadores entre llaves: deben ser iguales que en español.';
      return out;
    });
  }

  return { LIMITS: LIMITS, SYSTEM: SYSTEM, validateRequest: validateRequest, buildRequest: buildRequest, parseResponse: parseResponse };
});
