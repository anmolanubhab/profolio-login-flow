-- LinkedIn-style company page needs a few more descriptive fields on
-- public.companies. No RLS change: existing per-column policies
-- (companies_select_public / companies_*_owner) already cover these.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[];

COMMENT ON COLUMN public.companies.tagline IS 'Short one-line descriptor shown under the company name (LinkedIn-style).';
COMMENT ON COLUMN public.companies.headquarters IS 'Primary/HQ location string, shown in the About panel and Locations section.';
COMMENT ON COLUMN public.companies.specialties IS 'Free-form list of focus areas / specialties, rendered as badges in About.';
