# Supabase · puesta en marcha (hito 1)

Proyecto: `https://mtjfvphlcwzkemtocyff.supabase.co` (la clave pública `anon` está en `assets/js/config.js`; la `service_role` NO se guarda en ningún fichero).

## Pasos (en https://supabase.com/dashboard → tu proyecto)
1. **Desactivar el registro público:** *Authentication → Sign In / Providers* → apaga **Allow new users to sign up**. (Hoy está activado.)
2. **Crear las tablas y reglas:** *SQL Editor → New query* → pega **todo** `supabase/schema.sql` → **Run**. Debe terminar en "Success".
3. **Cargar los datos actuales:** nueva consulta → pega **todo** `supabase/seed.sql` → **Run**. Es seguro repetirlo: no pisa lo ya editado. (Si cambias los JSON, regenera con `python3 supabase/make_seed.py`.)
4. **Crear los dos usuarios del panel:** *Authentication → Users → Add user → Create new user*, con correo y contraseña, marcando **Auto Confirm User** (tú y tu madre).
5. **Darles permiso de administrador:** *SQL Editor* →
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('TU_CORREO', 'CORREO_DE_TU_MADRE')
   on conflict do nothing;
   ```
6. **Comprobar la seguridad:** `bash supabase/rls_check.sh`. Debe acabar con **0 fallos**. Prueba con la clave pública que el mundo NO puede leer ni escribir nada privado.

## Qué protege qué
- Todas las tablas tienen RLS y solo las toca un usuario que esté en `admins`.
- El público solo lee las vistas `public_*` (sin tokens ni datos de huéspedes) y la función `public_availability()`, que devuelve solo rangos de fechas.
- Las vistas se ejecutan con permisos del propietario a propósito (para ocultar columnas y filas privadas); el aviso "Security Definer View" del linter de Supabase es esperado.
- `ical_sources` (URLs iCal) y `bookings` (nombres y teléfonos) son privadas.

## Traducción con Gemini (hito 8)
El panel tiene botones «✨ Traducir al inglés (IA)» en pisos, preguntas, opiniones y textos. Llaman a la Edge Function `translate`, que es la única que conoce la clave de Gemini (nunca llega al navegador) y solo responde a administradores. La propuesta se rellena en los campos de inglés y **no se guarda hasta que pulses Guardar**.

### 1. Clave de Gemini (gratis)
En https://aistudio.google.com/apikey → **Create API key** (con la cuenta de Google del negocio). Cópiala. Plan gratuito: sirve para traducir textos sueltos de vez en cuando. Aviso de privacidad: en el plan gratuito Google puede usar lo enviado para mejorar sus productos; aquí solo se envían textos públicos de la web, nunca datos de huéspedes.

### 2a. Desplegar con el CLI de Supabase (recomendado: sirve también para las funciones siguientes)
```
brew install supabase/tap/supabase
cd ~/virand-web
supabase login                                   # abre el navegador
supabase link --project-ref mtjfvphlcwzkemtocyff # pide la contraseña de la base de datos
supabase secrets set GEMINI_API_KEY=PEGA_AQUI_TU_CLAVE
supabase functions deploy translate
```
### 2b. Sin CLI (pegar en el panel de Supabase)
1. `python3 supabase/make_function.py translate` y `pbcopy < supabase/dist/translate.ts`.
2. Supabase → **Edge Functions → Deploy a new function → Via Editor**, nombre `translate`, pega y **Deploy**.
3. **Edge Functions → Secrets**: añade `GEMINI_API_KEY`.

### Modelo
Por defecto usa el alias `gemini-flash-lite-latest` (siempre el último Flash-Lite). Si Google retira o renombra modelos y falla con «modelo no disponible», fija otro con `supabase secrets set GEMINI_MODEL=nombre-del-modelo` (o en Secrets). Los límites gratuitos dependen del modelo y cambian: https://ai.google.dev/gemini-api/docs/rate-limits

### Comprobar
En el panel: Pisos → editar uno → «Traducir nombre y descripción al inglés». Si sale un mensaje en rojo, dice qué falta (clave, límite, modelo).
