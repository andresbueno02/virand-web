# VirAnd — web pública

Web estática (HTML/CSS/JS sin build) de VirAnd Luxury Rental. Spec: `docs/superpowers/specs/2026-10-23-virand-web-design.md`.

## Probar en local
    python3 -m http.server 8765
    # http://localhost:8765/            → sin datos de calendario (todo "consultar")
    # http://localhost:8765/?mock=1     → con data/availability.mock.json (solo pruebas)
    bash tests/run.sh                   → pruebas de la lógica pura (JavaScriptCore, sin Node)

## Dar de alta un piso
1. Copiar `data/pisos.template.json` como nueva entrada en `data/pisos.json` (`activo: true`).
2. Fotos en `assets/img/pisos/<slug>/N-640.webp` y `N-1280.webp`.
3. Añadir su fila en la hoja `Web` de la Sheet (slug, ical_urls, precio_desde, activo).

## Pendiente de configurar (assets/js/config.js)
- `appsScriptUrl`: URL /exec del Apps Script (ver `apps-script/README.md`).
- `mapsKey`: clave de Google Maps restringida al dominio. Sin ella la web oculta el mapa y sigue funcionando.

## Fuente de disponibilidad
Solo `assets/js/availability.js` habla con el backend. Contrato en ese fichero; se puede sustituir Apps Script por otro servicio sin tocar la UI.
