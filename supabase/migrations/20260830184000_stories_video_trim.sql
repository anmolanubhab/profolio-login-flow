-- Client-side video trim without re-encoding: the viewer seeks to trim.start
-- and stops at trim.end. Shape: { "start": number, "end": number } in seconds, or null.
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS trim jsonb;
