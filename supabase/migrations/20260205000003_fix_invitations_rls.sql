-- Fix RLS policies for company_invitations to avoid accessing auth.users directly which causes permission errors

-- Drop existing policies that reference auth.users
DROP POLICY IF EXISTS "company_invitations_user_view_own" ON public.company_invitations;
DROP POLICY IF EXISTS "company_invitations_user_update_own" ON public.company_invitations;

-- Re-create policies using auth.jwt() to get email
CREATE POLICY "company_invitations_user_view_own" ON public.company_invitations
FOR SELECT USING (
  email = (auth.jwt() ->> 'email')
);

CREATE POLICY "company_invitations_user_update_own" ON public.company_invitations
FOR UPDATE USING (
  email = (auth.jwt() ->> 'email') AND status = 'pending'
);
