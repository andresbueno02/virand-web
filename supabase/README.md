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
