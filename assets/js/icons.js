/* Iconos de trazo (24x24). Uso: VirandIcons.svg('wifi') */
(function (root) {
  var P = {
    'playa': 'M2 15c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0M2 20c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0M12 4a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z',
    'jacuzzi': 'M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3zM6 12V6a2 2 0 0 1 4 0M7 20l-1 2M17 20l1 2',
    'barbacoa': 'M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.6-2.5 1.5-3.5.5 1 1 2 1.500 2 .5-2 0-4 1-6.5z',
    'centro': 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
    'parking': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 17V7h4a3 3 0 0 1 0 6H9',
    'acogedor': 'M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z',
    'piscina': 'M8 3v11M16 3v11M8 7h8M8 11h8M2 18c1.500-1.500 3-1.500 4.500 0s3 1.500 4.500 0 3-1.500 4.500 0 3 1.500 4.500 0',
    'bicicletas': 'M6 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM18 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM6 15l4-8h5l3 8M10 7l2 8',
    'llegada-autonoma': 'M15 9a4 4 0 1 0-3.900 4.900L4 21h3v-2h2v-2h2l2.100-2.100A4 4 0 0 0 15 9z',
    'wifi': 'M2 9a15 15 0 0 1 20 0M5 12.500a10 10 0 0 1 14 0M8.500 16a5 5 0 0 1 7 0M12 19.500h.01',
    'user': 'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'shield': 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6l8-3zM8.500 12l2.500 2.500 5-5',
    'chat': 'M21 12a8 8 0 0 1-11.500 7.200L3 21l1.800-5.500A8 8 0 1 1 21 12z',
    'menu': 'M4 7h16M4 12h16M4 17h16',
    'x': 'M6 6l12 12M18 6L6 18'
  };
  root.VirandIcons = {
    svg: function (name) {
      var d = P[name]; if (!d) return '';
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
    }
  };
})(window);
