-- Post three-dot menu hardening:
-- 1) Company posts could never be deleted by anyone (isOwnPost compares a
--    profiles.id to a companies.id for company posts, so it's always false,
--    and RLS only allowed the literal auth.uid() that authored the row).
--    Extend the DELETE policy so a company admin/owner (is_company_admin)
--    can delete any post published as their company, matching how CTA
--    editing is already gated.
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND public.is_company_admin(auth.uid(), company_id))
);

-- 2) "Snooze company" / "Hide all from company" / "Block company" need their
--    own target tables -- the existing snoozed_users/blocked_users tables
--    FK to profiles(id), but a company post's author-identity in the UI is a
--    companies.id, so writing it into those columns would violate the FK
--    (or silently target the wrong entity if the FK were ever loosened).
CREATE TABLE public.blocked_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_company_id)
);

CREATE TABLE public.snoozed_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snoozed_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snoozed_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, snoozed_company_id)
);

ALTER TABLE public.blocked_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snoozed_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blocked companies" ON public.blocked_companies
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = blocked_companies.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = blocked_companies.user_id AND p.user_id = auth.uid())
);

CREATE POLICY "Users can manage their own snoozed companies" ON public.snoozed_companies
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = snoozed_companies.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = snoozed_companies.user_id AND p.user_id = auth.uid())
);

-- 3) Report Post: add an optional free-text description separate from the
--    fixed reason category, and prevent the same user from filing more than
--    one report against the same post (the UI already submits a single
--    reason string; going forward it sends one of a fixed set of category
--    slugs, enforced here so a stray value can't slip in from a stale client).
ALTER TABLE public.post_reports ADD COLUMN IF NOT EXISTS description TEXT;

-- Older rows (from before this migration) stored free-text in `reason`
-- rather than a fixed category slug -- move that text to the new
-- `description` column and normalize `reason` to 'other' so the CHECK
-- constraint below can be validated against existing data.
UPDATE public.post_reports
SET description = reason, reason = 'other'
WHERE reason NOT IN ('spam', 'harassment', 'hate', 'misinformation', 'inappropriate', 'scam', 'other')
  AND description IS NULL;

ALTER TABLE public.post_reports
  ADD CONSTRAINT post_reports_reason_check CHECK (
    reason IN ('spam', 'harassment', 'hate', 'misinformation', 'inappropriate', 'scam', 'other')
  ) NOT VALID;
ALTER TABLE public.post_reports VALIDATE CONSTRAINT post_reports_reason_check;

-- Duplicate (reporter_id, post_id) rows from before this migration (a user
-- who reported the same post more than once) would block the UNIQUE
-- constraint below -- keep only the earliest report per pair.
DELETE FROM public.post_reports a USING public.post_reports b
WHERE a.reporter_id = b.reporter_id AND a.post_id = b.post_id AND a.created_at > b.created_at;

ALTER TABLE public.post_reports ADD CONSTRAINT post_reports_unique_reporter_post UNIQUE (reporter_id, post_id);
