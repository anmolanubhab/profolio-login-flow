-- Migration: enable RLS and add a flexible companies INSERT policy
-- Date: 2025-12-12
-- WARNING: Run on staging first and back up production before applying.

-- Enable RLS
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;

-- Drop any old/incorrect policies that compared companies.owner_id to auth.uid()
DROP POLICY IF EXISTS companies_insert_owner_must_be_auth_uid ON public.companies;
DROP POLICY IF EXISTS companies_insert_owner_must_be_profile ON public.companies;
DROP POLICY IF EXISTS companies_insert_owner_maybe_null_or_profile ON public.companies;

-- Allow users to SELECT their own profile rows (used by company policy EXISTS checks)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Optional: allow users to INSERT their own profile on sign-up
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- FLEXIBLE companies INSERT policy:
-- Allow INSERT when:
--  - owner_id IS NULL (unowned companies allowed), OR
--  - owner_id references a profiles.id row whose user_id equals the authenticated user (owner must be caller's profile)
DROP POLICY IF EXISTS companies_insert_flexible ON public.companies;
CREATE POLICY companies_insert_flexible ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = owner_id
      AND p.user_id = auth.uid()
  )
);

-- (Optional) SELECT/UPDATE/DELETE policies to enforce ownership for other operations:
-- Allow owners to SELECT their company rows
DROP POLICY IF EXISTS companies_select_owner ON public.companies;
CREATE POLICY companies_select_owner ON public.companies
FOR SELECT
TO authenticated
USING (
  owner_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = owner_id
      AND p.user_id = auth.uid()
  )
);

-- Allow owners to UPDATE their company rows
DROP POLICY IF EXISTS companies_update_owner ON public.companies;
CREATE POLICY companies_update_owner ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = owner_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  owner_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.id = owner_id
      AND p2.user_id = auth.uid()
  )
);

-- Allow owners to DELETE their company rows
DROP POLICY IF EXISTS companies_delete_owner ON public.companies;
CREATE POLICY companies_delete_owner ON public.companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = owner_id
      AND p.user_id = auth.uid()
  )
);
