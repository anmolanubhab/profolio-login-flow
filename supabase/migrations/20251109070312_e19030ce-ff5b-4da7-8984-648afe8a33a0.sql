-- Add description field to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS description text;

-- Add industry field for better categorization
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS industry text;

-- Add employee count range
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS employee_count text;

-- Add founded year
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS founded_year integer;

-- Update jobs table to make company_id NOT NULL for new jobs
-- (existing jobs can keep company_name for backward compatibility)
ALTER TABLE public.jobs 
ALTER COLUMN company_id DROP NOT NULL;