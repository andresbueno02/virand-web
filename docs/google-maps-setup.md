# Google Maps: clave, restricciones y límite de gasto

Gratis hasta 10.000 cargas de mapa al mes (precio orientativo; confirmar en https://developers.google.com/maps/billing-and-pricing/pricing). Más allá, ~7 $ por 1.000. **Google no corta solo al llegar al límite**: hay que poner el tope de cuota (paso 4), que es lo que protege de verdad.

## Pasos (en https://console.cloud.google.com, con la cuenta de la madre)
1. **Proyecto:** crear uno nuevo ("virand-web"). Activar la **facturación** (pide tarjeta).
2. **API:** *APIs y servicios → Biblioteca* → activar **Maps JavaScript API** (solo esa).
3. **Clave:** *APIs y servicios → Credenciales → Crear credenciales → Clave de API*, y editarla:
   - *Restricciones de la aplicación → Sitios web (referentes HTTP)*: añadir
     `https://virandluxuryrental.com/*`, `https://www.virandluxuryrental.com/*` y, para pruebas, `http://localhost:8765/*`.
   - *Restricciones de API → Restringir clave*: solo **Maps JavaScript API**.
4. **Tope de cargas (lo importante):** *APIs y servicios → Maps JavaScript API → Cuotas y límites del sistema* → buscar la cuota de **cargas de mapa por día (Map loads per day)** → *Editar* → poner p. ej. **300** (≈ 9.000 al mes, por debajo del cupo gratuito). Superado el tope, el mapa deja de cargar ese día y la lista de pisos sigue funcionando.
5. **Alerta de presupuesto:** *Facturación → Presupuestos y alertas* → crear presupuesto de 1–5 € con avisos al 50 %, 90 % y 100 %. Ojo: avisa, **no corta**.
6. Pegar la clave en `assets/js/config.js` → `mapsKey`.

## Protección en el código (ya hecha)
`assets/js/map.js` no descarga el script de Google hasta que el mapa es visible **y** hay un gesto real del usuario (clic, tecla, rueda o toque; los eventos simulados se ignoran), o se pulsa «Cargar mapa». En móvil el mapa empieza oculto tras el conmutador Lista/Mapa. Tras 3 cargas en la misma sesión del navegador solo se carga bajo petición expresa con el botón. Esto frena a la mayoría de bots y rastreadores, pero **no a bots avanzados**: el tope diario del paso 4 es la garantía.

## Comprobar
- Sin clave: se oculta el mapa y la lista ocupa todo el ancho.
- Con clave: abrir la web, mover el ratón/desplazarse hasta el mapa → carga; recargar 3 veces en la misma pestaña → aparece el botón.
- *APIs y servicios → Maps JavaScript API → Métricas*: ver las cargas diarias.
