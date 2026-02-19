-- 004_rpc_get_availability.sql
-- RPC: Get available slots for a staff + service on a given shop-local date
-- Returns slot start times in UTC (timestamptz)

create or replace function public.rpc_get_availability(
  p_shop_slug text,
  p_staff_id uuid,
  p_service_id uuid,
  p_day_local text
)
returns table (
  start_at timestamptz
)
language plpgsql
stable
as $$
declare
  v_shop_id uuid;
  v_tz text;
  v_duration_mins int;
  v_day date;
  v_dow int;

  v_day_start_utc timestamptz;
  v_day_end_utc timestamptz;
begin
  -- 1) Validate shop + timezone
  select s.id, s.timezone
    into v_shop_id, v_tz
  from public.shops s
  where s.slug = p_shop_slug
    and s.is_active = true;

  if v_shop_id is null then
    -- Return empty set (API will validate and return 404/400)
    return;
  end if;

  -- 2) Validate staff belongs to shop and active
  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id
      and st.shop_id = v_shop_id
      and st.active = true
  ) then
    return;
  end if;

  -- 3) Validate service belongs to shop and active, get duration
  select sv.duration_minutes
    into v_duration_mins
  from public.services sv
  where sv.id = p_service_id
    and sv.shop_id = v_shop_id
    and sv.active = true;

  if v_duration_mins is null then
    return;
  end if;

  -- 4) Parse day_local to date + day_of_week (0=Sunday..6=Saturday)
  v_day := p_day_local::date;
  v_dow := extract(dow from v_day)::int;

  -- 5) Compute UTC bounds for that shop-local day
  -- shop local 00:00 -> UTC
  v_day_start_utc := ((v_day::text || ' 00:00:00')::timestamp at time zone v_tz);
  v_day_end_utc   := (((v_day + 1)::text || ' 00:00:00')::timestamp at time zone v_tz);

  /*
    Strategy:
    - Build candidate start times for each working-hours interval:
      start = (day_local + start_local) converted to UTC
      end   = (day_local + end_local) converted to UTC
    - Generate 15-min series between start and (end - duration)
    - Exclude any that overlap confirmed bookings or blocks
  */

  return query
  with wh as (
    select
      wh.start_local,
      wh.end_local,
      ((v_day::text || ' ' || wh.start_local::text)::timestamp at time zone v_tz) as wh_start_utc,
      ((v_day::text || ' ' || wh.end_local::text)::timestamp at time zone v_tz) as wh_end_utc
    from public.working_hours wh
    where wh.shop_id = v_shop_id
      and wh.staff_id = p_staff_id
      and wh.day_of_week = v_dow
  ),
  candidates as (
    select
      gs as slot_start_utc,
      gs + make_interval(mins => v_duration_mins) as slot_end_utc
    from wh
    cross join lateral generate_series(
      wh.wh_start_utc,
      (wh.wh_end_utc - make_interval(mins => v_duration_mins)),
      interval '15 minutes'
    ) as gs
    where wh.wh_end_utc > wh.wh_start_utc
  ),
  -- confirmed bookings in the day window (UTC)
  b as (
    select start_at, end_at
    from public.bookings
    where shop_id = v_shop_id
      and staff_id = p_staff_id
      and status = 'confirmed'
      and start_at < v_day_end_utc
      and end_at > v_day_start_utc
  ),
  -- blocks in the day window (UTC)
  bl as (
    select start_at, end_at
    from public.blocks
    where shop_id = v_shop_id
      and staff_id = p_staff_id
      and start_at < v_day_end_utc
      and end_at > v_day_start_utc
  )
  select c.slot_start_utc
  from candidates c
  where not exists (
    select 1 from b
    where tstzrange(b.start_at, b.end_at, '[)') && tstzrange(c.slot_start_utc, c.slot_end_utc, '[)')
  )
  and not exists (
    select 1 from bl
    where tstzrange(bl.start_at, bl.end_at, '[)') && tstzrange(c.slot_start_utc, c.slot_end_utc, '[)')
  )
  order by c.slot_start_utc;

end;
$$;

-- Optional: grant execute to anon/authenticated so your API can call it with anon key
grant execute on function public.rpc_get_availability(text, uuid, uuid, text) to anon, authenticated;



---------- TEST 
select
  s.id as shop_id,
  st.id as staff_id,
  sv.id as service_id,
  s.timezone
from shops s
join staff st on st.shop_id = s.id
join services sv on sv.shop_id = s.id
where s.slug = 'demo-barber'
limit 1;

and 

select * from public.rpc_get_availability(
  'demo-barber',
  '<STAFF_UUID>',
  '<SERVICE_UUID>',
  '2026-02-19'
) limit 20;


--------- if it fails , fix: 




-- 004_rpc_get_availability.sql (FIXED)
-- RPC: Get available slots for a staff + service on a given shop-local date
-- Returns slot start times in UTC (timestamptz)

create or replace function public.rpc_get_availability(
  p_shop_slug text,
  p_staff_id uuid,
  p_service_id uuid,
  p_day_local text
)
returns table (
  slot_start_at timestamptz
)
language plpgsql
stable
as $$
declare
  v_shop_id uuid;
  v_tz text;
  v_duration_mins int;
  v_day date;
  v_dow int;

  v_day_start_utc timestamptz;
  v_day_end_utc timestamptz;
begin
  -- 1) Validate shop + timezone
  select s.id, s.timezone
    into v_shop_id, v_tz
  from public.shops s
  where s.slug = p_shop_slug
    and s.is_active = true;

  if v_shop_id is null then
    return;
  end if;

  -- 2) Validate staff belongs to shop and active
  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id
      and st.shop_id = v_shop_id
      and st.active = true
  ) then
    return;
  end if;

  -- 3) Validate service belongs to shop and active, get duration
  select sv.duration_minutes
    into v_duration_mins
  from public.services sv
  where sv.id = p_service_id
    and sv.shop_id = v_shop_id
    and sv.active = true;

  if v_duration_mins is null then
    return;
  end if;

  -- 4) Parse day_local to date + day_of_week (0=Sunday..6=Saturday)
  v_day := p_day_local::date;
  v_dow := extract(dow from v_day)::int;

  -- 5) Compute UTC bounds for that shop-local day
  v_day_start_utc := ((v_day::text || ' 00:00:00')::timestamp at time zone v_tz);
  v_day_end_utc   := (((v_day + 1)::text || ' 00:00:00')::timestamp at time zone v_tz);

  return query
  with wh as (
    select
      wh.start_local,
      wh.end_local,
      ((v_day::text || ' ' || wh.start_local::text)::timestamp at time zone v_tz) as wh_start_utc,
      ((v_day::text || ' ' || wh.end_local::text)::timestamp at time zone v_tz) as wh_end_utc
    from public.working_hours wh
    where wh.shop_id = v_shop_id
      and wh.staff_id = p_staff_id
      and wh.day_of_week = v_dow
  ),
  candidates as (
    select
      gs as slot_start_utc,
      gs + make_interval(mins => v_duration_mins) as slot_end_utc
    from wh
    cross join lateral generate_series(
      wh.wh_start_utc,
      (wh.wh_end_utc - make_interval(mins => v_duration_mins)),
      interval '15 minutes'
    ) as gs
    where wh.wh_end_utc > wh.wh_start_utc
  ),
  b as (
    select
      bk.start_at as b_start_at,
      bk.end_at as b_end_at
    from public.bookings bk
    where bk.shop_id = v_shop_id
      and bk.staff_id = p_staff_id
      and bk.status = 'confirmed'
      and bk.start_at < v_day_end_utc
      and bk.end_at > v_day_start_utc
  ),
  bl as (
    select
      blc.start_at as bl_start_at,
      blc.end_at as bl_end_at
    from public.blocks blc
    where blc.shop_id = v_shop_id
      and blc.staff_id = p_staff_id
      and blc.start_at < v_day_end_utc
      and blc.end_at > v_day_start_utc
  )
  select c.slot_start_utc as slot_start_at
  from candidates c
  where not exists (
    select 1 from b
    where tstzrange(b.b_start_at, b.b_end_at, '[)') && tstzrange(c.slot_start_utc, c.slot_end_utc, '[)')
  )
  and not exists (
    select 1 from bl
    where tstzrange(bl.bl_start_at, bl.bl_end_at, '[)') && tstzrange(c.slot_start_utc, c.slot_end_utc, '[)')
  )
  order by c.slot_start_utc;

end;
$$;

grant execute on function public.rpc_get_availability(text, uuid, uuid, text) to anon, authenticated;
