-- Day 1 (Part 1): Add safe template columns to shops
-- Additive, backward compatible. No drops or rewrites.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS industry_template text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS branding jsonb NULL,
  ADD COLUMN IF NOT EXISTS template_overrides jsonb NULL;

-- Constrain template choices for v1 (expand later with new migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_industry_template_check'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_industry_template_check
      CHECK (industry_template IN ('generic','barber','dental'));
  END IF;
END $$;
