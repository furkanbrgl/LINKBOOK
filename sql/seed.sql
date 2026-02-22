-- TODO: Seed data
-- Dev/test shops and bookings
-- Demo shop uses barber template (run after shop insert or adjust slug as needed)
UPDATE public.shops
  SET industry_template = 'barber'
  WHERE slug = 'temp-barber' AND industry_template = 'generic';
