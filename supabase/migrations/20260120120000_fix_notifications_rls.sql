
-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own notifications
-- We assume user_id in notifications table refers to profiles.id
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = notifications.user_id
    AND profiles.user_id = auth.uid()
  )
);

-- Allow authenticated users to insert notifications
-- This is necessary so User A (candidate) can notify User B (company owner)
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);
