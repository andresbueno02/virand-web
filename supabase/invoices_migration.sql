-- ============ Módulo de Facturación (multi-propietario · 10% IVA turístico RDL 29/2026) ============
-- Ejecutar una vez en Supabase → SQL Editor → New query → Run. Es seguro repetirlo (idempotente).

create table if not exists public.issuers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text not null,
  address text not null,
  series text not null unique check (series ~ '^[A-Z0-9]{1,8}$'),
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.flats
  add column if not exists issuer_id uuid references public.issuers(id) on delete set null;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references public.issuers(id),
  flat_id uuid references public.flats(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  year int not null,
  is_rect boolean not null default false,
  seq int not null,
  number text not null,
  issue_date date not null default current_date,
  kind text not null default 'complete' check (kind in ('complete','simplified','rectificative')),
  rectifies_id uuid references public.invoices(id),
  rectifies_number text,
  channel text not null default 'direct' check (channel in ('direct','airbnb','booking','vrbo','other')),
  issuer_name text not null,
  issuer_tax_id text not null,
  issuer_address text not null,
  guest_name text,
  guest_tax_id text,
  guest_address text,
  concept text not null,
  check_in date,
  check_out date,
  nights int,
  vat_rate numeric(5,2) not null default 10.00,
  base_amount numeric(10,2) not null,
  vat_amount numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (issuer_id, year, is_rect, seq)
);
create index if not exists invoices_issuer_date_idx on public.invoices(issuer_id, issue_date desc);

-- RLS: estrictamente privado para administradores
do $$
declare t text;
begin
  foreach t in array array['issuers','invoices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke all on public.issuers, public.invoices from anon;

-- Emisión atómica con numeración correlativa sin saltos por propietario, serie y año
create or replace function public.issue_invoice(p jsonb)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issuer public.issuers;
  v_date date := coalesce((p->>'issue_date')::date, current_date);
  v_year int := extract(year from v_date)::int;
  v_kind text := coalesce(p->>'kind', 'complete');
  v_is_rect boolean := (v_kind = 'rectificative');
  v_seq int;
  v_num text;
  v_rate numeric(5,2) := coalesce((p->>'vat_rate')::numeric, 10.00);
  v_total numeric(10,2) := round((p->>'total_amount')::numeric, 2);
  v_base numeric(10,2);
  v_vat numeric(10,2);
  v_out public.invoices;
begin
  if not public.is_admin() then
    raise exception 'permission denied';
  end if;

  select * into v_issuer from public.issuers where id = (p->>'issuer_id')::uuid for update;
  if not found then
    raise exception 'Propietario/emisor no encontrado';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
    from public.invoices
   where issuer_id = v_issuer.id and year = v_year and is_rect = v_is_rect;

  v_num := (case when v_is_rect then 'R-' else '' end) || v_issuer.series || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
  v_base := round(v_total / (1 + v_rate / 100.0), 2);
  v_vat := v_total - v_base;

  insert into public.invoices (
    issuer_id, flat_id, booking_id, year, is_rect, seq, number, issue_date, kind,
    rectifies_id, rectifies_number, channel,
    issuer_name, issuer_tax_id, issuer_address,
    guest_name, guest_tax_id, guest_address,
    concept, check_in, check_out, nights,
    vat_rate, base_amount, vat_amount, total_amount, notes
  ) values (
    v_issuer.id,
    nullif(p->>'flat_id', '')::uuid,
    nullif(p->>'booking_id', '')::uuid,
    v_year, v_is_rect, v_seq, v_num, v_date, v_kind,
    nullif(p->>'rectifies_id', '')::uuid,
    nullif(p->>'rectifies_number', ''),
    coalesce(nullif(p->>'channel', ''), 'direct'),
    v_issuer.name, v_issuer.tax_id, v_issuer.address,
    nullif(trim(coalesce(p->>'guest_name', '')), ''),
    nullif(trim(coalesce(p->>'guest_tax_id', '')), ''),
    nullif(trim(coalesce(p->>'guest_address', '')), ''),
    trim(p->>'concept'),
    nullif(p->>'check_in', '')::date,
    nullif(p->>'check_out', '')::date,
    nullif(p->>'nights', '')::int,
    v_rate, v_base, v_vat, v_total,
    nullif(trim(coalesce(p->>'notes', '')), '')
  ) returning * into v_out;

  return v_out;
end;
$$;

revoke all on function public.issue_invoice(jsonb) from public, anon;
grant execute on function public.issue_invoice(jsonb) to authenticated;
