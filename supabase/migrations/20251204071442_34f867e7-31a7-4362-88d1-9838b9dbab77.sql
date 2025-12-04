-- Add culture and values fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS culture TEXT,
ADD COLUMN IF NOT EXISTS values TEXT[];