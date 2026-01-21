-- Fix infinite recursion in company_members policy and add safe membership check

-- 1. Create a security definer function to safely check membership
-- This function runs with the privileges of the creator (bypass RLS), so it can safely query company_members
CREATE OR REPLACE FUNCTION public.is_company_member_safe(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    WHERE p.user_id = _user_id
      AND cm.company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE p.user_id = _user_id
      AND c.id = _company_id
  );
$$;

-- 2. Update the policy to use the safe function
-- This replaces the recursive policy that was causing 500 errors
DROP POLICY IF EXISTS "company_members_view_own_company" ON public.company_members;

CREATE POLICY "company_members_view_own_company" ON public.company_members
FOR SELECT USING (
  -- User can see their own membership
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.id = company_members.user_id
    )
  )
  OR
  -- OR user is a member/owner of the company (using safe function to avoid recursion)
  (
    is_company_member_safe(auth.uid(), company_members.company_id)
  )
);

-- 3. Ensure posts are viewable by everyone
-- This fixes the issue where company posts might not be visible if the default public policy was missing or overridden
DROP POLICY IF EXISTS "posts_view_public" ON public.posts;
CREATE POLICY "posts_view_public" ON public.posts
FOR SELECT USING (true);
