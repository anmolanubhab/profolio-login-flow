-- First migration: Add new enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company_employee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';