-- seed.sql
-- Demo data: 1 shop + 2 staff + 3 services + working hours

insert into public.shops (name, slug, timezone, phone, address, industry_template)
values ('Demo Barber', 'temp-barber', 'Europe/Istanbul', '+905551112233', 'Istanbul', 'barber')
on conflict (slug) do nothing;

-- Grab shop id
with s as (
  select id as shop_id from public.shops where slug = 'temp-barber'
),
st as (
  insert into public.staff (shop_id, name)
  select shop_id, unnest(array['Ahmet', 'Mehmet']) from s
  returning id, shop_id, name
),
sv as (
  insert into public.services (shop_id, name, duration_minutes, price_cents)
  select shop_id, name, duration_minutes, price_cents
  from s,
  (values
    ('Haircut', 30, 50000),
    ('Beard Trim', 15, 25000),
    ('Haircut + Beard', 45, 70000)
  ) as v(name, duration_minutes, price_cents)
  returning id
)
insert into public.working_hours (shop_id, staff_id, day_of_week, start_local, end_local)
select st.shop_id, st.id, d.day_of_week, '10:00', '20:00'
from st
cross join (values (0),(1),(2),(3),(4),(5),(6)) as d(day_of_week);
