-- 001_schema.sql
-- Core schema for Linkbook v1 (generic service-business bookings)

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Profiles table linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Shops
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Istanbul',
  phone text,
  address text,
  is_active boolean not null default true,

  reminder_next_day_enabled boolean not null default true,
  reminder_next_day_send_time_local time not null default '19:00:00',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ownership mapping
create table if not exists public.shop_owners (
  shop_id uuid not null references public.shops (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, owner_user_id)
);

-- Staff
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Services
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents int check (price_cents is null or price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Working hours (per staff)
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_local time not null,
  end_local time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_local > start_local)
);

-- Blocks (time off)
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_by_owner_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, phone_e164)
);

-- Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('confirmed','cancelled_by_customer','cancelled_by_shop','completed','no_show')),
  source text not null check (source in ('customer','walk_in','owner_move')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- Manage tokens (store only hash)
create table if not exists public.manage_tokens (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notification outbox
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  event_type text not null,
  channel text not null,
  payload_json jsonb not null,
  idempotency_key text not null unique,
  status text not null check (status in ('pending','sent','failed','cancelled')) default 'pending',
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
begin
  -- attach trigger to tables that have updated_at
  if not exists (select 1 from pg_trigger where tgname = 'trg_shops_updated_at') then
    create trigger trg_shops_updated_at before update on public.shops
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_staff_updated_at') then
    create trigger trg_staff_updated_at before update on public.staff
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_services_updated_at') then
    create trigger trg_services_updated_at before update on public.services
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_working_hours_updated_at') then
    create trigger trg_working_hours_updated_at before update on public.working_hours
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_blocks_updated_at') then
    create trigger trg_blocks_updated_at before update on public.blocks
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_customers_updated_at') then
    create trigger trg_customers_updated_at before update on public.customers
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_bookings_updated_at') then
    create trigger trg_bookings_updated_at before update on public.bookings
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_outbox_updated_at') then
    create trigger trg_outbox_updated_at before update on public.notification_outbox
    for each row execute function public.set_updated_at();
  end if;
end $$;
