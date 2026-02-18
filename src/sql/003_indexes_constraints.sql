-- 003_indexes_constraints.sql
-- Indexes + No-double-booking exclusion constraint

-- Helpful indexes
create index if not exists idx_staff_shop on public.staff (shop_id);
create index if not exists idx_services_shop on public.services (shop_id);
create index if not exists idx_working_hours_staff_day on public.working_hours (staff_id, day_of_week);

create index if not exists idx_blocks_staff_time on public.blocks (staff_id, start_at, end_at);
create index if not exists idx_bookings_staff_time on public.bookings (staff_id, start_at, end_at);
create index if not exists idx_bookings_shop_time on public.bookings (shop_id, start_at);

create index if not exists idx_customers_shop_phone on public.customers (shop_id, phone_e164);
create index if not exists idx_outbox_status_next on public.notification_outbox (status, next_attempt_at);

-- Exclusion constraint to prevent overlapping CONFIRMED bookings per staff
-- Uses btree_gist extension
alter table public.bookings
  add constraint bookings_no_overlap_confirmed
  exclude using gist (
    staff_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status = 'confirmed');
