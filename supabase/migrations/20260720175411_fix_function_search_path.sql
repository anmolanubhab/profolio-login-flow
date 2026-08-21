-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175411 "fix_function_search_path" (no
-- matching file in supabase/migrations/). Every SECURITY DEFINER function
-- inspected live already has `SET search_path TO 'public'` (confirmed via
-- pg_get_functiondef), which is exactly what this class of fix adds --
-- without a pinned search_path, a SECURITY DEFINER function is vulnerable
-- to search_path hijacking (a caller-controlled schema shadowing a
-- built-in/table reference). This file re-pins search_path on the core
-- SECURITY DEFINER helper functions that predate the 2026-07-20 batch, so
-- that replaying migrations from a clean database reaches the same
-- hardened state even if an earlier (uncommitted) version of one of these
-- functions had omitted it.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
      WHEN 'admin' THEN 1 WHEN 'company_admin' THEN 2 WHEN 'employer' THEN 3
      WHEN 'recruiter' THEN 4 WHEN 'mentor' THEN 5 WHEN 'company_employee' THEN 6
      WHEN 'student' THEN 7 WHEN 'user' THEN 8 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    WHERE p.user_id = _user_id AND cm.company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE p.user_id = _user_id AND c.id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_member_safe(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    WHERE p.user_id = _user_id AND cm.company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE p.user_id = _user_id AND c.id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role);
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student');
  END IF;
  RETURN NEW;
END;
$$;
