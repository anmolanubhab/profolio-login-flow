CREATE TABLE IF NOT EXISTS public.job_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME WITHOUT TIME ZONE NOT NULL,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('HR', 'Technical', 'Manager')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'selected', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_interviews_candidate_select
ON public.job_interviews
FOR SELECT
USING (
  candidate_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY job_interviews_company_select
ON public.job_interviews
FOR SELECT
USING (
  is_company_admin(auth.uid(), company_id)
);

CREATE POLICY job_interviews_company_insert
ON public.job_interviews
FOR INSERT
WITH CHECK (
  is_company_admin(auth.uid(), company_id)
);

CREATE POLICY job_interviews_company_update
ON public.job_interviews
FOR UPDATE
USING (
  is_company_admin(auth.uid(), company_id)
);

CREATE INDEX IF NOT EXISTS job_interviews_application_id_idx
ON public.job_interviews(application_id);

CREATE INDEX IF NOT EXISTS job_interviews_candidate_id_idx
ON public.job_interviews(candidate_id);

CREATE INDEX IF NOT EXISTS job_interviews_job_id_idx
ON public.job_interviews(job_id);

