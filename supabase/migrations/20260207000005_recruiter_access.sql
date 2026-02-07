
-- Allow job owners to view applications for their jobs
CREATE POLICY "Job owners can view applications for their jobs"
ON public.job_applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_applications.job_id
    AND jobs.posted_by = auth.uid()
  )
);

-- Allow job owners to update status of applications for their jobs
CREATE POLICY "Job owners can update application status"
ON public.job_applications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_applications.job_id
    AND jobs.posted_by = auth.uid()
  )
);

-- Allow job owners to view resumes attached to applications for their jobs
-- This overrides the 'recruiters' visibility restriction for the specific job owner
CREATE POLICY "Job owners can view applicant resumes"
ON public.resumes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.resume_id = resumes.id
    AND j.posted_by = auth.uid()
  )
);
