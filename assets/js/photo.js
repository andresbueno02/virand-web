/* Rutas y validación de fotos (puro, sin DOM). Una foto se guarda en dos tamaños (640 y 1280) y en WebP;
   si el navegador que las sube no sabe crear WebP (Safari), se guardan en JPEG y la ruta lleva ".jpg" al final.
   Convención de 'src'/'path': 'carpeta/nombre' → carpeta/nombre-640.webp ; 'carpeta/nombre.jpg' → carpeta/nombre-640.jpg */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  root.VirandPhoto = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var JPG = /\.(jpg|jpeg)$/i;
  var MAX_BYTES = 25 * 1024 * 1024;
  var OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function url(src, w) {
    return JPG.test(src) ? src.replace(JPG, '') + '-' + w + '.jpg' : src + '-' + w + '.webp';
  }
  // rutas dentro del bucket de Storage (para borrar), o [] si la foto es local del repositorio
  function storagePaths(path) {
    if (/^assets\//.test(path)) return [];
    return [url(path, 640), url(path, 1280)];
  }
  // tamaño destino con ancho máximo 'target', sin ampliar nunca
  function scaleSize(w, h, target) {
    if (!w || !h) return { w: 0, h: 0 };
    if (w <= target) return { w: w, h: h };
    return { w: target, h: Math.max(1, Math.round(h * target / w)) };
  }
  // nombre único dentro de la carpeta del piso; 'rnd' se inyecta para poder probarlo
  function newPath(slug, rnd, ext) { return slug + '/' + rnd + (ext === 'jpg' ? '.jpg' : ''); }
  // devuelve un mensaje en español si la foto no sirve, o null si es válida
  function validateFile(f) {
    var t = (f.type || '').toLowerCase(), n = (f.name || '').toLowerCase();
    if (/heic|heif/.test(t) || /\.(heic|heif)$/.test(n)) return 'Las fotos HEIC del iPhone no se pueden subir. Ajusta el iPhone a «Más compatible» (Ajustes › Cámara › Formatos) o expórtala como JPG.';
    if (OK_TYPES.indexOf(t) === -1) return '«' + f.name + '» no es una foto JPG, PNG o WebP.';
    if (f.size > MAX_BYTES) return '«' + f.name + '» pesa más de 25 MB.';
    if (f.size === 0) return '«' + f.name + '» está vacía.';
    return null;
  }
  return { url: url, storagePaths: storagePaths, scaleSize: scaleSize, newPath: newPath, validateFile: validateFile, MAX_BYTES: MAX_BYTES };
});
