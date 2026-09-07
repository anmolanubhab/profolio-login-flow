-- Job Matching Phase 1: deterministic skill-name normalization, no AI.
-- Lowercases, trims, collapses internal whitespace, then strips a trailing
-- ".js"/"js" so "React.js" / "React JS" / "react" / "reactjs" all normalize
-- to "react", and "Node" / "Node.js" both normalize to "node". Deliberately
-- does NOT touch "javascript"/"typescript" (they end in "script", not "js").
create or replace function public.normalize_skill_name(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(lower(trim(p_name)), '\s+', '', 'g'),
    '\.?js$', '', 'i'
  );
$$;

comment on function public.normalize_skill_name(text) is 'Deterministic (non-AI) skill name normalization used by calculate_job_match() to compare job_skill_requirements.skill_name against skills.skill_name.';
