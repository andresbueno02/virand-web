# Web principal de VirAnd Luxury Rental — Especificación de diseño

Fecha: 2026-10-23 · Estado: pendiente de revisión del usuario

## 1. Objetivo

Sustituir la web actual de `virandluxuryrental.com` (hecha con Lodgify, cuya suscripción se va a cancelar) por una web propia, **más completa y más elegante**, que cubra todo lo que hay hoy y añada lo que falta. La gestiona la madre del usuario; el usuario la construye y la mantiene.

### Qué hace hoy la web de Lodgify (se mantiene)
- Portada con buscador (ubicación, llegada, salida, personas).
- Listado de alojamientos con filtros, orden por precio y mapa.
- Fichas con capacidad (viajeros, dormitorios, camas, baños) y servicios.
- Opiniones de huéspedes.
- Consulta de disponibilidad y precio por WhatsApp (+34 654 584 843).
- Enlaces a Instagram (@alojamientos_luxy24) y Facebook.
- Idioma español, moneda EUR.

### Qué se añade
- Calendario de disponibilidad real por piso, sincronizado con Airbnb/Booking.
- Mapa de Google con un marcador por piso.
- Precio "desde X €/noche" visible.
- Preguntas frecuentes.
- Diseño nuevo (estilo A), versión en inglés, SEO y rendimiento cuidados.

## 2. Alcance

**Dentro:** una sola página principal con los **16 pisos**, buscador por fechas, mapa, calendarios, precio "desde", consulta por WhatsApp, por qué VirAnd, opiniones, preguntas frecuentes y contacto. Español e inglés.

**Fuera (decidido por el usuario):**
- Pagos y reservas automáticas.
- Páginas individuales por piso con instrucciones de check-in (ya existe una base en `~/virand-stays`; se hará más adelante).
- Zona privada de huéspedes.
- Sincronización automática de precios con Airbnb/Booking (no es posible con iCal; ver §6).

## 3. Decisiones de diseño

| Tema | Decisión |
|---|---|
| Estilo | **A · Mediterráneo luminoso**: fondo crema `#faf6ef`, azul profundo `#1f3a5f` para acciones, dorado arena `#b08a4f` para acentos, texto `#2a3140`. Títulos en Cormorant Garamond, texto en Inter. Fotos grandes a sangre. |
| Tecnología | HTML, CSS y JavaScript sin build, igual que `~/virand-stays`. Sin Node, sin frameworks. |
| Hosting | GitHub Pages, repo nuevo `virand-web`. Repo **público**: no contiene secretos (la clave de Maps es pública por naturaleza y va restringida al dominio). |
| Disponibilidad | Google Apps Script + Google Sheet privada, mismo patrón que `virand-stays`. |
| Reservas | Solo consulta por WhatsApp con mensaje prellenado. |
| Idioma | Español por defecto, inglés con selector. Cambio en cliente (textos en JSON); se recuerda la elección en `localStorage`. No hay URLs separadas por idioma. |
| Mapa | Google Maps JavaScript API. |
| Precio | Manual, campo `precio_desde` en la Sheet. |

## 4. Estructura de la página

Una página (`index.html`) con navegación fija y estas secciones en orden:

1. **Cabecera**: logo VirAnd, enlaces a las secciones, selector ES/EN, botón WhatsApp.
2. **Portada**: foto grande, titular, lema "Alquiler vacacional exclusivo en Málaga y la Costa del Sol" y buscador (zona, llegada, salida, personas) que se superpone al borde inferior de la foto.
3. **Alojamientos**: barra de filtros (zona, capacidad, orden por precio), lista de tarjetas de los 16 pisos y mapa de Google. En escritorio, lista y mapa lado a lado; en móvil, conmutador "Lista / Mapa".
4. **Por qué VirAnd**: atención personalizada, alojamientos verificados y equipados, ubicaciones premium, consulta directa sin intermediarios.
5. **Opiniones**: reseñas de huéspedes con nota.
6. **Preguntas frecuentes**: acordeón.
7. **Contacto**: WhatsApp, Instagram, Facebook. Pie con ©, y espacio para aviso legal y privacidad.

Móvil primero: gutter lateral de 16 px, sin scroll horizontal, objetivos táctiles de al menos 44 px.

## 5. Alojamientos, ficha y mapa

### 5.1 Tarjeta de piso
Foto, nombre, zona, capacidad, dos o tres servicios destacados, nota media y **"Desde X €/noche"**. Si el piso no tiene `precio_desde`, muestra "Consultar precio".

### 5.2 Ventana de detalle
Al pulsar una tarjeta o un marcador se abre una ventana emergente con:
- Galería de fotos con navegación por teclado y deslizamiento táctil.
- Nombre, zona, descripción y lista completa de servicios.
- Capacidad (viajeros, dormitorios, camas, baños) y precio "desde".
- **Calendario** de dos meses con las fechas ocupadas bloqueadas, selección de rango llegada/salida y contador de personas.
- Botón **"Consultar por WhatsApp"**.

Mensaje de WhatsApp (se envía a `https://wa.me/34654584843?text=…`, codificado):
> Hola, me interesa «{nombre del piso}» del {llegada} al {salida} para {n} personas. ¿Está disponible y cuál es el precio?

Sin fechas elegidas, el mensaje omite el tramo de fechas. En inglés se usa el equivalente.

### 5.3 Mapa de Google
- Un marcador por piso con la etiqueta del precio ("desde 95 €"). Al pulsarlo, mini-ficha con foto, nombre, precio y botón "Ver detalle".
- Las coordenadas guardadas en `pisos.json` son **aproximadas** (desplazadas a propósito, nunca el portal exacto) y se dibuja un círculo de unos 300 m. La dirección exacta se da tras la reserva.
- Filtrar por fechas, zona o personas actualiza a la vez lista y mapa. Los pisos que no cumplen se ocultan.
- La clave de API se restringe por referrer HTTP a `virandluxuryrental.com` y al dominio de pruebas, y se limita a la Maps JavaScript API. Se configura una alerta de presupuesto en Google Cloud.
- Si el mapa no carga (sin clave, bloqueado, sin red), la lista sigue funcionando y se muestra un aviso discreto en el hueco del mapa.

## 6. Disponibilidad y precio

### 6.1 Flujo
```
Airbnb/Booking (iCal) → Apps Script (lee Sheet, fusiona iCal, cachea) → JSON → web
```

### 6.2 Google Sheet privada, hoja `Pisos`
| Columna | Contenido |
|---|---|
| `slug` | Identificador del piso (igual que en `pisos.json`) |
| `ical_urls` | Una o varias URLs iCal separadas por salto de línea (Airbnb, Booking…) |
| `precio_desde` | Número en euros por noche, o vacío |
| `activo` | `SI`/`NO`; un piso en `NO` no aparece en la web |

Las URLs iCal viven **solo en la Sheet**, nunca en el repo.

### 6.3 Apps Script (Web App, acceso "cualquiera")
- Endpoint `GET ?action=disponibilidad` devuelve:
```json
{
  "actualizado": "2026-10-23T10:00:00Z",
  "pisos": {
    "atico-benalmadena": { "ocupado": [["2026-11-02","2026-11-09"]], "precio_desde": 120 }
  }
}
```
- Para cada piso descarga todos sus iCal, extrae los eventos `VEVENT` (`DTSTART`/`DTEND`), fusiona rangos solapados y los devuelve como `[inicio, fin)`: `fin` es el día de salida, que **queda libre para una nueva llegada**.
- Cachea la respuesta 30 minutos (`CacheService`). Si un iCal falla, se reutiliza el último resultado bueno de ese piso y se marca `"obsoleto": true` en ese piso.
- Eventos de bloqueo del propietario en Airbnb/Booking (por ejemplo "Not available") cuentan como ocupado.
- La respuesta no contiene datos personales de huéspedes: se descartan `SUMMARY` y `DESCRIPTION`.

### 6.4 Comportamiento en la web
- Al cargar, la web pide la disponibilidad una vez y la usa para calendarios, buscador, orden por precio y etiquetas de precio.
- Un piso está libre para `[llegada, salida)` si ningún rango ocupado se solapa con él.
- Si el endpoint no responde en 8 s o devuelve error, la web **sigue funcionando**: muestra pisos y mapa con los datos estáticos, no bloquea fechas y cambia el texto a "Consulta disponibilidad por WhatsApp". Nunca afirma que un piso está libre sin datos.
- Los datos de disponibilidad son orientativos: el texto de la ventana lo indica y la confirmación es siempre por WhatsApp.

### 6.5 Precio
Manual por ahora. Los iCal solo contienen fechas ocupadas, no precios, así que sincronizar precios con Airbnb/Booking requeriría un channel manager de pago o acceso a la API de Booking para socios. El campo `precio_desde` queda preparado por si se decide más adelante.

## 7. Datos estáticos

```
virand-web/
  index.html
  assets/css/        estilos
  assets/js/         main.js, i18n.js, search.js, map.js, calendar.js, availability.js, whatsapp.js
  assets/img/        logo, fotos de portada y de cada piso (WebP, varios tamaños)
  data/pisos.json    datos de los 16 pisos
  data/opiniones.json
  data/faq.json
  data/i18n/{es,en}.json   textos de la interfaz
  apps-script/       Code.gs y README con el despliegue
  tests/index.html   pruebas en el navegador
  robots.txt, sitemap.xml, CNAME
  docs/superpowers/specs/  esta especificación
```

### 7.1 `pisos.json` (por piso)
`slug`, `activo`, `nombre{es,en}`, `zona` (por ejemplo Málaga centro, Torremolinos, Benalmádena), `lat`/`lng` aproximadas, `viajeros`, `dormitorios`, `camas`, `banos`, `servicios[]`, `descripcion{es,en}`, `fotos[]` (ruta + texto alternativo), `nota` y `num_opiniones` (opcionales).

Alta de un piso nuevo: añadir su entrada en `pisos.json`, sus fotos en `assets/img/` y una fila en la Sheet. Sin tocar código.

### 7.2 Preguntas frecuentes
Acordeón accesible desde `faq.json` (`pregunta{es,en}`, `respuesta{es,en}`). Temas iniciales a redactar con el usuario: horarios y proceso de llegada, llegada autónoma, normas de la casa, política de cancelación y depósito, mascotas y fiestas, parking, ropa de cama y toallas, WiFi, estancia mínima, cómo reservar y pagar. Se publica también como datos estructurados `FAQPage` (JSON-LD). **Las respuestas de política (cancelación, depósito, mascotas, estancia mínima) las decide el usuario con su madre; hoy la web no las publica.**

### 7.3 Opiniones
Se parte de las tres reseñas que muestra la web actual. Se pueden añadir más desde Airbnb/Booking con permiso del huésped o citando la plataforma. No se inventan opiniones.

## 8. SEO, rendimiento y accesibilidad
- `title`, `meta description`, Open Graph, `lang`, `alt` en todas las fotos.
- JSON-LD: `LodgingBusiness`/`VacationRental` y `FAQPage`. `sitemap.xml` y `robots.txt`.
- Fotos en WebP con `srcset`, `loading="lazy"` salvo la portada. Objetivo de carga ≤ 3 s en móvil con 4G.
- Contraste AA, foco visible, navegación completa por teclado (menú, galería, calendario, acordeón, ventana emergente con trampa de foco y cierre con Esc), `prefers-reduced-motion` respetado.
- Limitación asumida: al cambiar de idioma en cliente, Google indexa principalmente el español.
- Aviso de privacidad y aviso legal en el pie. La web propia no usa cookies de seguimiento ni analítica. Google Maps y Google Fonts pueden registrar datos del visitante, y el aviso de privacidad debe mencionarlo. El texto legal lo aporta el usuario.

## 9. Migración y dominio
1. Construir y probar la web en un subdominio de pruebas o en `*.github.io`, **con Lodgify todavía activo**.
2. **No cancelar Lodgify hasta que la web nueva esté en producción** con el dominio apuntando a ella.
3. Antes de nada, comprobar **dónde está registrado `virandluxuryrental.com`** (Lodgify > Ajustes > Dominio, o un whois) y que el usuario tiene acceso al DNS. Si Lodgify es el registrador, hay que **transferir el dominio a otro registrador antes de cancelar** para no perderlo.
4. Cambio de DNS: registros `A`/`CNAME` hacia GitHub Pages y `CNAME` en el repo. `stay.virandluxuryrental.com` (landings de check-in) no se ve afectado.
5. Comprobar que no hay correo ni otros servicios colgando de los DNS actuales antes de cambiarlos.
6. Redirecciones: la web antigua tenía `/es/alojamientos/`; se crea una redirección a `/#alojamientos`.

## 10. Pruebas y verificación
- La lógica pura (parseo de iCal, fusión de rangos, solapes, filtros, mensaje de WhatsApp) va en módulos JS sin dependencias del DOM y se prueba en `tests/index.html` desde el navegador, ya que no hay Node en esta máquina. Casos: día de salida libre, rangos solapados, eventos de varios días, iCal vacío, estancias de una noche, año nuevo.
- Prueba del Apps Script con iCal de ejemplo antes de usar los reales.
- Verificación visual en navegador real: escritorio y móvil, español e inglés, ventana de detalle, calendario, mapa, preguntas frecuentes y fallos simulados (endpoint caído, sin clave de Maps).
- Revisión de accesibilidad y rendimiento (Lighthouse) antes del cambio de dominio.

## 11. Datos y tareas que aporta el usuario
- URLs iCal de los 16 pisos (Airbnb y/o Booking).
- Datos de los 11 pisos que hoy no están en la web (nombre, zona, capacidad, servicios, descripción, fotos) mediante una plantilla. Los 5 actuales los extraigo de la web de Lodgify.
- Precio "desde" inicial de cada piso.
- Crear la clave de Google Maps y activar facturación con límite de gasto (guía incluida en el README).
- Respuestas de política para las preguntas frecuentes y textos legales.
- Confirmación del registrador del dominio.
- Logo y colores de marca si existen. Si no, se usa un logotipo tipográfico.

## 12. Riesgos
- **Dominio atado a Lodgify**: ver §9, es la dependencia que más puede bloquear.
- **Retraso o fallo de los iCal**: las plataformas actualizan sus iCal con retrasos de hasta unas horas; por eso la disponibilidad es orientativa y se confirma por WhatsApp.
- **Cuota de Apps Script**: el caché de 30 minutos mantiene las llamadas por debajo de los límites con 16 pisos.
- **Dobles reservas**: al no haber reserva directa, el riesgo sigue gestionándose como hoy, por WhatsApp y calendarios de las plataformas.
