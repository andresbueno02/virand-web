# Apps Script — disponibilidad de la web

Lee los calendarios iCal de Airbnb/Booking de cada piso y devuelve a la web las fechas ocupadas y el precio "desde". Es gratis.

## 1. Crear la Google Sheet

1. Crea una hoja de cálculo nueva (por ejemplo "VirAnd Web"). **No uses la de `virand-stays`**: aquella tiene la pestaña `Pisos` con códigos de puerta y WiFi, y esta es otra cosa.
2. Renombra la pestaña a **`Web`** (con esa mayúscula).
3. Fila 1, cabecera exacta (el orden de las columnas da igual):

| slug | ical_urls | precio_desde | activo |
|---|---|---|---|
| atico-benalmadena | `https://…airbnb…ics` (salto de línea con Alt+Intro) `https://…booking…ics` | 120 | SI |

- `slug`: el mismo que en `data/pisos.json`.
- `ical_urls`: una o varias URLs, **una por línea dentro de la celda**.
- `precio_desde`: número en euros por noche. Vacío = "Consultar precio".
- `activo`: `SI` para mostrarlo. Cualquier otra cosa, el piso se omite.

La hoja contiene enlaces privados de tus calendarios: **no la compartas** públicamente.

## 2. Desplegar el script

1. En la hoja: **Extensiones > Apps Script**. Borra lo que haya y pega el contenido de `Code.gs`.
2. Sustituye `REPLACE_WITH_SHEET_ID` por el ID de la hoja (la parte larga de su URL entre `/d/` y `/edit`).
3. **Implementar > Nueva implementación > Aplicación web**:
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
4. Autoriza los permisos (Sheets y conexión a servicios externos) y copia la URL que acaba en `/exec`.
5. Prueba en el navegador: `URL/exec?action=disponibilidad` debe devolver un JSON con tus pisos.

Cada vez que cambies `Code.gs`, hay que crear **una nueva versión** de la implementación (Implementar > Gestionar implementaciones > Editar > Nueva versión) para que se apliquen los cambios. Si solo cambias la hoja, no hace falta tocar nada.

## 3. Conectarlo con la web

Pega la URL `/exec` en la constante `APPS_SCRIPT_URL` de `assets/js/availability.js`.

## 4. Cómo sacar el iCal

- **Airbnb**: Calendario del anuncio > Disponibilidad > Sincronización de calendarios > **Exportar calendario**. Copia el enlace.
- **Booking.com**: Extranet > Tarifas y disponibilidad > Sincronizar calendarios > **Exportar calendario** (a veces aparece como "Exportar iCal"). Copia el enlace.

Los enlaces son privados: quien los tenga ve las fechas ocupadas, así que no los publiques.

## Cómo funciona

- Respuesta: `{"actualizado": ISO, "pisos": {"slug": {"ocupado": [["2026-11-02","2026-11-09"]], "precio_desde": 120, "obsoleto": false}}}`.
- Los rangos son `[inicio, fin)`: el día de salida queda libre para una nueva llegada.
- Si un iCal falla, se reutiliza el último resultado bueno de ese piso y se marca `"obsoleto": true`. La web entonces no afirma que esté libre.
- Cache de 30 minutos. Nunca se devuelven nombres ni descripciones de huéspedes, solo fechas.
- La lógica de `parseIcal` está duplicada de `assets/js/ical.js`; si cambias una, cambia la otra.

## Aviso: los iCal se refrescan con retraso

Airbnb y Booking publican sus calendarios con un retraso que puede ir de minutos a varias horas, y esta lectura añade hasta 30 minutos. La disponibilidad que ve el visitante es **orientativa**; la confirmación siempre es por WhatsApp. Puede haber reservas dobles en ese hueco, así que conviene revisar los calendarios de las plataformas.
