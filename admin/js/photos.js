/* Prepara las fotos en el navegador: reduce a 1280 y 640 px de ancho y las comprime.
   WebP si el navegador sabe crearlo; si no (Safari), JPEG. */
(function (root) {
  var PH = root.VirandPhoto;

  function decode(file) {
    if (root.createImageBitmap) {
      return root.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('No se puede leer «' + file.name + '». ¿Es una foto válida?')); };
      im.src = u;
    });
  }
  function draw(src, w, opaque) {
    var s = PH.scaleSize(src.width, src.height, w), c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (opaque) { g.fillStyle = '#fff'; g.fillRect(0, 0, s.w, s.h); }
    g.drawImage(src, 0, 0, s.w, s.h);
    return c;
  }
  function toBlob(c, type, q) { return new Promise(function (res) { c.toBlob(res, type, q); }); }

  // -> { ext: 'webp'|'jpg', b640: Blob, b1280: Blob }
  function process(file) {
    return decode(file).then(function (src) {
      if (!src.width || !src.height) throw new Error('«' + file.name + '» no tiene tamaño válido.');
      return toBlob(draw(src, 1280, false), 'image/webp', 0.82).then(function (b) {
        var webp = !!b && b.type === 'image/webp';
        var enc = function (w) { return webp ? toBlob(draw(src, w, false), 'image/webp', 0.82) : toBlob(draw(src, w, true), 'image/jpeg', 0.84); };
        return Promise.all([enc(1280), enc(640)]).then(function (r) {
          if (src.close) src.close();
          if (!r[0] || !r[1]) throw new Error('No se pudo preparar «' + file.name + '».');
          return { ext: webp ? 'webp' : 'jpg', b1280: r[0], b640: r[1] };
        });
      });
    });
  }

  root.PhotoPrep = { process: process };
})(window);
