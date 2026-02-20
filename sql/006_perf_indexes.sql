-- 006_perf_indexes.sql
-- Extra indexes for v1 operational performance (10–50 stores)

-- Blocks: overlap checks and day view queries
create index if not exists idx_blocks_shop_staff_time
on public.blocks (shop_id, staff_id, start_at, end_at);

-- Outbox: support/debug queries by booking + type + status
create index if not exists idx_outbox_booking_event_status
on public.notification_outbox (booking_id, event_type, status);

-- Optional: bookings commonly filtered by shop+staff+time (dashboard/staff day view)
create index if not exists idx_bookings_shop_staff_start
on public.bookings (shop_id, staff_id, start_at);
