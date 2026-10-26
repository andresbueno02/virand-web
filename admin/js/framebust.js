/* Anti-clickjacking: el panel solo se muestra si NO está dentro de un iframe de otra página. */
(function () {
  if (self === top) { var s = document.getElementById('fb'); if (s) s.parentNode.removeChild(s); }
  else { try { top.location = self.location; } catch (e) { /* iframe con sandbox: la página queda oculta */ } }
})();
