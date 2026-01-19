-- Phase 2: Company System - Employee Invitations and Followers

-- 1. Create company_invitations table for employee invitations
CREATE TABLE public.company_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  role company_role NOT NULL DEFAULT 'content_admin',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, email, status)
);

-- 2. Create company_followers table for users to follow companies
CREATE TABLE public.company_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- 3. Add unique constraint to company_members to prevent duplicate memberships
ALTER TABLE public.company_members 
ADD CONSTRAINT company_members_company_user_unique UNIQUE (company_id, user_id);

-- 4. Enable RLS on new tables
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_followers ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for company_invitations

-- Company admins can view all invitations for their companies
CREATE POLICY "company_invitations_admin_view" ON public.company_invitations
FOR SELECT USING (
  is_company_admin(auth.uid(), company_id)
);

-- Company admins can create invitations
CREATE POLICY "company_invitations_admin_create" ON public.company_invitations
FOR INSERT WITH CHECK (
  is_company_admin(auth.uid(), company_id)
);

-- Company admins can update invitations (cancel, etc.)
CREATE POLICY "company_invitations_admin_update" ON public.company_invitations
FOR UPDATE USING (
  is_company_admin(auth.uid(), company_id)
);

-- Company admins can delete invitations
CREATE POLICY "company_invitations_admin_delete" ON public.company_invitations
FOR DELETE USING (
  is_company_admin(auth.uid(), company_id)
);

-- Users can view invitations sent to their email
CREATE POLICY "company_invitations_user_view_own" ON public.company_invitations
FOR SELECT USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Users can accept/reject invitations sent to their email
CREATE POLICY "company_invitations_user_update_own" ON public.company_invitations
FOR UPDATE USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending'
);

-- 6. RLS Policies for company_followers

-- Anyone can view followers
CREATE POLICY "company_followers_view_public" ON public.company_followers
FOR SELECT USING (true);

-- Authenticated users can follow companies
CREATE POLICY "company_followers_create" ON public.company_followers
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = company_followers.user_id AND p.user_id = auth.uid()
  )
);

-- Users can unfollow companies
CREATE POLICY "company_followers_delete_own" ON public.company_followers
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = company_followers.user_id AND p.user_id = auth.uid()
  )
);

-- 7. Create trigger for updating invitation timestamp
CREATE TRIGGER update_company_invitations_updated_at
BEFORE UPDATE ON public.company_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Update company_members RLS to allow viewing by other employees of the same company
DROP POLICY IF EXISTS "company_members_view_own_company" ON public.company_members;
CREATE POLICY "company_members_view_own_company" ON public.company_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND (
      p.id = company_members.user_id OR
      EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = company_members.company_id AND c.owner_id = p.id
      ) OR
      EXISTS (
        SELECT 1 FROM company_members cm2
        WHERE cm2.company_id = company_members.company_id AND cm2.user_id = p.id
      )
    )
  )
);

-- 9. Allow public view of companies for company pages
DROP POLICY IF EXISTS "companies_select_public" ON public.companies;
CREATE POLICY "companies_select_public" ON public.companies
FOR SELECT USING (true);

-- 10. Create function to accept invitation and add user as company member
CREATE OR REPLACE FUNCTION public.accept_company_invitation(invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_profile_id UUID;
BEGIN
  -- Get the invitation
  SELECT * INTO inv
  FROM public.company_invitations
  WHERE id = invitation_id AND status = 'pending' AND expires_at > now();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Get the user's profile id
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = inv.email AND u.id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or email mismatch';
  END IF;
  
  -- Add user as company member
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (inv.company_id, user_profile_id, inv.role)
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = inv.role;
  
  -- Update invitation status
  UPDATE public.company_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = invitation_id;
  
  RETURN TRUE;
END;
$$;

-- 11. Create function to get company member count
CREATE OR REPLACE FUNCTION public.get_company_member_count(company_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.company_members WHERE company_id = company_uuid
$$;

-- 12. Create function to get company follower count
CREATE OR REPLACE FUNCTION public.get_company_follower_count(company_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.company_followers WHERE company_id = company_uuid
$$;