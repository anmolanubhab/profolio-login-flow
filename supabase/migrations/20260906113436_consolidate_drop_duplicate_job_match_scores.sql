-- Verified immediately beforehand: 0 rows, no FK dependents, no remaining
-- function references (calculate_job_match, refresh_job_recommendations_for_candidate,
-- and apply_to_job were all already repointed at hiring_match_scores in
-- prior migrations of this same consolidation). Safe to drop -- this table
-- never shipped to any UI and holds no production data.
drop table if exists public.job_match_scores;
