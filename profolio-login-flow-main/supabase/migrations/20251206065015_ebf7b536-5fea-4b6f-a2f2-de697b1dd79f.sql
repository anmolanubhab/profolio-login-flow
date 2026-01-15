-- Create skill endorsements table
CREATE TABLE public.skill_endorsements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  endorser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endorsed_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(skill_id, endorser_id)
);

-- Enable RLS
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

-- Everyone can view endorsements
CREATE POLICY "endorsements_view_all" ON public.skill_endorsements
  FOR SELECT USING (true);

-- Connected users can create endorsements (not for their own skills)
CREATE POLICY "endorsements_create" ON public.skill_endorsements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = skill_endorsements.endorser_id AND p.user_id = auth.uid()
    )
    AND skill_endorsements.endorser_id != skill_endorsements.endorsed_user_id
  );

-- Users can delete their own endorsements
CREATE POLICY "endorsements_delete_own" ON public.skill_endorsements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = skill_endorsements.endorser_id AND p.user_id = auth.uid()
    )
  );