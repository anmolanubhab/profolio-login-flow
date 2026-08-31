-- Expand post_reports.reason to a LinkedIn-parallel category set for the
-- stepped Report flow. The 7 legacy values stay in the allowed set so existing
-- rows and any older client remain valid. RLS, the UNIQUE(reporter_id, post_id)
-- constraint, and the FKs are untouched.
ALTER TABLE public.post_reports DROP CONSTRAINT IF EXISTS post_reports_reason_check;

ALTER TABLE public.post_reports ADD CONSTRAINT post_reports_reason_check CHECK (
  reason = ANY (ARRAY[
    -- legacy (kept valid)
    'spam','harassment','hate','misinformation','inappropriate','scam','other',
    -- LinkedIn-parallel additions
    'threats_or_violence','self_harm','graphic_content','dangerous_orgs',
    'sexual_content','fake_account','child_exploitation','restricted_goods',
    'nonconsensual_imagery'
  ]::text[])
);
