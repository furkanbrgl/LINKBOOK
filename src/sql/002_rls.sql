-- 002_rls.sql
-- Row Level Security policies for multi-tenant owner access

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_owners enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocks enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.manage_tokens enable row level security;
alter table public.notification_outbox enable row level security;

-- Helper: is owner of shop
create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.shop_owners so
    where so.shop_id = p_shop_id
      and so.owner_user_id = auth.uid()
  );
$$;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- SHOPS (owners can manage their shops)
drop policy if exists "shops_owner_select" on public.shops;
create policy "shops_owner_select"
on public.shops for select
using (public.is_shop_owner(id));

drop policy if exists "shops_owner_update" on public.shops;
create policy "shops_owner_update"
on public.shops for update
using (public.is_shop_owner(id))
with check (public.is_shop_owner(id));

-- (Optional later) public read minimal fields by slug:
-- We'll do via API in v1, so skip public policy for now.

-- SHOP_OWNERS (owners can see their membership)
drop policy if exists "shop_owners_select_own" on public.shop_owners;
create policy "shop_owners_select_own"
on public.shop_owners for select
using (owner_user_id = auth.uid());

-- STAFF
drop policy if exists "staff_owner_all" on public.staff;
create policy "staff_owner_all"
on public.staff for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- SERVICES
drop policy if exists "services_owner_all" on public.services;
create policy "services_owner_all"
on public.services for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- WORKING_HOURS
drop policy if exists "working_hours_owner_all" on public.working_hours;
create policy "working_hours_owner_all"
on public.working_hours for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- BLOCKS
drop policy if exists "blocks_owner_all" on public.blocks;
create policy "blocks_owner_all"
on public.blocks for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- CUSTOMERS
drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all"
on public.customers for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- BOOKINGS
drop policy if exists "bookings_owner_all" on public.bookings;
create policy "bookings_owner_all"
on public.bookings for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- MANAGE_TOKENS
-- Owners do NOT need to select tokens (manage is via server/service role)
-- Allow no access from anon/authenticated by default:
drop policy if exists "manage_tokens_owner_none" on public.manage_tokens;
create policy "manage_tokens_owner_none"
on public.manage_tokens for select
using (false);

-- OUTBOX
drop policy if exists "outbox_owner_all" on public.notification_outbox;
create policy "outbox_owner_all"
on public.notification_outbox for all
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));
