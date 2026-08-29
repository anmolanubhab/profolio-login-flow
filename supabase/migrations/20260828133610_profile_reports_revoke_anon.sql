-- =============================================================================
-- Phase 1 — harden profile_reports
--
-- Moderation data: not discoverable by anonymous users at all. RLS already
-- blocks row reads (policy is TO authenticated), and this also removes the
-- table from the anon GraphQL schema. `authenticated` keeps SELECT so a
-- reporter can read their own reports via profile_reports_select_own.
--
-- SAFE / NON-DESTRUCTIVE: a single REVOKE of a table-level grant; no data.
-- =============================================================================

REVOKE SELECT ON public.profile_reports FROM anon;
