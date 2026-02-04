-- Create enum for company member roles
CREATE TYPE public.company_role AS ENUM ('super_admin', 'content_admin');

-- Create company_members table for managing company access
CREATE TABLE public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role company_role NOT NULL DEFAULT 'content_admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- Enable RLS
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Add company posting columns to posts table
ALTER TABLE public.posts
ADD COLUMN posted_as TEXT NOT NULL DEFAULT 'user' CHECK (posted_as IN ('user', 'company')),
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN company_name TEXT,
ADD COLUMN company_logo TEXT;

-- Add engagement tracking columns to post_likes
ALTER TABLE public.post_likes
ADD COLUMN acted_as TEXT NOT NULL DEFAULT 'user' CHECK (acted_as IN ('user', 'company')),
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add engagement tracking columns to comments
ALTER TABLE public.comments
ADD COLUMN acted_as TEXT NOT NULL DEFAULT 'user' CHECK (acted_as IN ('user', 'company')),
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create function to check if user is company admin
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  )
$$;

-- RLS Policies for company_members
CREATE POLICY "company_members_view_own_company"
ON public.company_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.id = company_members.user_id
        OR EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = company_members.company_id
            AND c.owner_id = p.id
        )
      )
  )
);

CREATE POLICY "company_members_owner_manage"
ON public.company_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE c.id = company_members.company_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE c.id = company_members.company_id
      AND p.user_id = auth.uid()
  )
);

-- Update posts RLS to allow company admins to create company posts
CREATE POLICY "company_posts_create"
ON public.posts
FOR INSERT
WITH CHECK (
  (posted_as = 'user' AND auth.uid() = user_id) OR
  (posted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "company_posts_update"
ON public.posts
FOR UPDATE
USING (
  (posted_as = 'user' AND auth.uid() = user_id) OR
  (posted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "company_posts_delete"
ON public.posts
FOR DELETE
USING (
  (posted_as = 'user' AND auth.uid() = user_id) OR
  (posted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

-- Drop old restrictive policies to allow new ones
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- Update post_likes RLS for company engagement
DROP POLICY IF EXISTS "Users can create likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.post_likes;

CREATE POLICY "likes_create"
ON public.post_likes
FOR INSERT
WITH CHECK (
  (acted_as = 'user' AND auth.uid() = user_id) OR
  (acted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "likes_delete"
ON public.post_likes
FOR DELETE
USING (
  (acted_as = 'user' AND auth.uid() = user_id) OR
  (acted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

-- Update comments RLS for company engagement
DROP POLICY IF EXISTS "comments_create" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;

CREATE POLICY "comments_create_new"
ON public.comments
FOR INSERT
WITH CHECK (
  (acted_as = 'user' AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.id = comments.user_id)) OR
  (acted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "comments_delete_new"
ON public.comments
FOR DELETE
USING (
  (acted_as = 'user' AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.id = comments.user_id)) OR
  (acted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "comments_update_new"
ON public.comments
FOR UPDATE
USING (
  (acted_as = 'user' AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.id = comments.user_id)) OR
  (acted_as = 'company' AND company_id IS NOT NULL AND is_company_admin(auth.uid(), company_id))
);

-- Create trigger for updating updated_at on company_members
CREATE TRIGGER update_company_members_updated_at
BEFORE UPDATE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-add company owner as super_admin when company is created
CREATE OR REPLACE FUNCTION public.add_owner_as_company_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'super_admin')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created_add_owner
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_as_company_admin();

-- Add company_id index for performance
CREATE INDEX IF NOT EXISTS idx_posts_company_id ON public.posts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);