-- Phase G: ads gain a pre-submission "draft" state, mirroring campaigns.
-- Split into its own migration because a new enum value cannot be USED in
-- the same transaction that adds it (the default change + RPCs land in
-- 20260902072528_phase_g_ad_creative.sql).
alter type public.ad_review_status add value if not exists 'draft' before 'pending';
