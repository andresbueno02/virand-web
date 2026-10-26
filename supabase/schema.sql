-- VirAnd · esquema Supabase (hito 1). Idempotente: se puede ejecutar varias veces.
-- Pegar entero en Supabase → SQL Editor → Run.
-- Seguridad: RLS en TODAS las tablas; el público (anon) NO puede leer ni escribir tablas,
-- solo las vistas public_* y la función public_availability().

-- ============ 0. administradores ============
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ============ 1. tablas ============
create table if not exists public.flats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  name_es text not null,
  name_en text,
  zona text not null,
  barrio text,
  lat numeric(8,5),
  lng numeric(8,5),
  viajeros int not null check (viajeros > 0),
  dormitorios int check (dormitorios >= 0),
  camas int check (camas >= 0),
  banos int check (banos >= 0),
  servicios text[] not null default '{}',
  desc_es text,
  desc_en text,
  nota numeric(2,1) check (nota between 0 and 5),
  base_price numeric(8,2) check (base_price > 0),
  sort int not null default 0,
  export_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flat_photos (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats(id) on delete cascade,
  path text not null,            -- 'assets/img/pisos/<slug>/N' (local) o '<slug>/N' (Storage); sin sufijo de tamaño
  alt_es text,
  alt_en text,
  sort int not null default 0
);
create index if not exists flat_photos_flat_idx on public.flat_photos(flat_id, sort);

create table if not exists public.rates (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  price_night numeric(8,2) not null check (price_night > 0),
  label text,
  check (to_date >= from_date)
);
create index if not exists rates_flat_idx on public.rates(flat_id, to_date);

create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  q_es text not null, q_en text,
  a_es text not null, a_en text,
  needs_review boolean not null default false,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  text_es text not null, text_en text,
  author_es text, author_en text,
  rating int not null default 5 check (rating between 1 and 5),
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists public.site_texts (
  key text not null,
  lang text not null check (lang in ('es','en')),
  value text not null,
  primary key (key, lang)
);

-- PRIVADAS ---------------------------------------------------------------
create table if not exists public.bookings (       -- reservas directas y bloqueos manuales
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats(id) on delete cascade,
  check_in date not null,
  check_out date not null,                          -- semiabierto [check_in, check_out): el día de salida queda libre
  kind text not null default 'booking' check (kind in ('booking','block')),
  guest_name text,
  phone text,
  notes text,
  total_price numeric(9,2),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (check_in < check_out)
);
create index if not exists bookings_flat_idx on public.bookings(flat_id, check_in);

create table if not exists public.ical_sources (   -- URLs iCal de Airbnb/Booking: SECRETAS
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats(id) on delete cascade,
  label text,
  url text not null check (url ~ '^https://'),
  active boolean not null default true,
  last_fetch timestamptz,
  last_status text
);
create index if not exists ical_sources_flat_idx on public.ical_sources(flat_id);

create table if not exists public.ical_blocks (    -- caché de rangos importados (sin SUMMARY ni DESCRIPTION)
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ical_sources(id) on delete cascade,
  flat_id uuid not null references public.flats(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  uid text,
  fetched_at timestamptz not null default now(),
  check (start_date < end_date)
);
create index if not exists ical_blocks_flat_idx on public.ical_blocks(flat_id, start_date);

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists flats_touch on public.flats;
create trigger flats_touch before update on public.flats for each row execute function public.touch_updated_at();

-- ============ 2. RLS: solo admin sobre las tablas ============
do $$
declare t text;
begin
  foreach t in array array['admins','flats','flat_photos','rates','faq','reviews','site_texts','bookings','ical_sources','ical_blocks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Supabase concede permisos por defecto a anon/authenticated: retirarlos a anon por completo.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
-- las funciones que SÍ son públicas se conceden explícitamente más abajo
grant execute on function public.is_admin() to anon, authenticated;

-- ============ 3. vistas públicas (sin columnas ni filas privadas) ============
create or replace view public.public_flats as
  select f.slug, f.name_es, f.name_en, f.zona, f.barrio, f.lat, f.lng,
         f.viajeros, f.dormitorios, f.camas, f.banos, f.servicios,
         f.desc_es, f.desc_en, f.nota, f.sort,
         coalesce(
           (select min(r.price_night) from public.rates r where r.flat_id = f.id and r.to_date >= current_date),
           f.base_price
         ) as precio_desde
  from public.flats f
  where f.active;

create or replace view public.public_photos as
  select f.slug, p.path, p.alt_es, p.alt_en, p.sort
  from public.flat_photos p join public.flats f on f.id = p.flat_id
  where f.active;

create or replace view public.public_faq as
  select q_es, q_en, a_es, a_en, sort from public.faq where active;

create or replace view public.public_reviews as
  select text_es, text_en, author_es, author_en, rating, sort from public.reviews where active;

create or replace view public.public_texts as
  select key, lang, value from public.site_texts;

grant select on public.public_flats, public.public_photos, public.public_faq,
                public.public_reviews, public.public_texts to anon, authenticated;

-- ============ 4. disponibilidad pública (contrato de assets/js/availability.js) ============
-- Une reservas directas + bloqueos iCal, fusiona rangos solapados y contiguos, y NUNCA devuelve
-- nombres ni notas. 'obsoleto' = sin fuentes iCal activas, o alguna falló o está desactualizada (>3 h),
-- para que la web no afirme "libre" sin datos fiables.
create or replace function public.public_availability()
returns jsonb language sql stable security definer set search_path = '' as $$
  with occ as (
    select b.flat_id, b.check_in as s, b.check_out as e
      from public.bookings b where b.check_out > current_date
    union all
    select x.flat_id, x.start_date, x.end_date
      from public.ical_blocks x where x.end_date > current_date
  ),
  ordered as (
    select flat_id, s, e,
           max(e) over (partition by flat_id order by s, e rows between unbounded preceding and 1 preceding) as prev_max
      from occ
  ),
  grp as (
    select flat_id, s, e,
           sum(case when prev_max is null or s > prev_max then 1 else 0 end)
             over (partition by flat_id order by s, e) as g
      from ordered
  ),
  merged as (
    select flat_id, min(s) as s, max(e) as e from grp group by flat_id, g
  ),
  flat_rows as (
    select f.id, f.slug,
      coalesce((select jsonb_agg(jsonb_build_array(to_char(m.s, 'YYYY-MM-DD'), to_char(m.e, 'YYYY-MM-DD')) order by m.s)
                  from merged m where m.flat_id = f.id), '[]'::jsonb) as ocupado,
      (select pf.precio_desde from public.public_flats pf where pf.slug = f.slug) as precio_desde,
      (
        not exists (select 1 from public.ical_sources s where s.flat_id = f.id and s.active)
        or exists (select 1 from public.ical_sources s
                    where s.flat_id = f.id and s.active
                      and (s.last_status is distinct from 'ok' or s.last_fetch is null or s.last_fetch < now() - interval '3 hours'))
      ) as obsoleto
    from public.flats f where f.active
  )
  select jsonb_build_object(
    'actualizado', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'pisos', coalesce(jsonb_object_agg(slug, jsonb_build_object('ocupado', ocupado, 'precio_desde', precio_desde, 'obsoleto', obsoleto)), '{}'::jsonb)
  ) from flat_rows;
$$;
revoke all on function public.public_availability() from public;
grant execute on function public.public_availability() to anon, authenticated;

-- ============ 5. Storage: bucket público 'flats', escritura solo admin ============
insert into storage.buckets (id, name, public) values ('flats', 'flats', true) on conflict (id) do nothing;
drop policy if exists "flats admin insert" on storage.objects;
drop policy if exists "flats admin update" on storage.objects;
drop policy if exists "flats admin delete" on storage.objects;
create policy "flats admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'flats' and public.is_admin());
create policy "flats admin update" on storage.objects for update to authenticated using (bucket_id = 'flats' and public.is_admin()) with check (bucket_id = 'flats' and public.is_admin());
create policy "flats admin delete" on storage.objects for delete to authenticated using (bucket_id = 'flats' and public.is_admin());
