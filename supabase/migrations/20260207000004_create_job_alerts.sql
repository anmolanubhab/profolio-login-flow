
-- Create job_alerts_log table
CREATE TABLE IF NOT EXISTS public.job_alerts_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT now(),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint to prevent duplicate alerts per channel
ALTER TABLE public.job_alerts_log ADD CONSTRAINT job_alerts_log_user_job_channel_unique UNIQUE (user_id, job_id, channel);

-- Create notifications table for in-app alerts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'job_alert', 'application_status', 'system', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    data JSONB, -- For storing related IDs (job_id, etc.)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for job_alerts_log
CREATE POLICY "Users can view their own alert logs"
ON public.job_alerts_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert logs"
ON public.job_alerts_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_job_alerts_log_user_job ON public.job_alerts_log(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
