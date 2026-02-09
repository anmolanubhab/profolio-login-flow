/*
  # Security Hardening: Company Invitation System

  1.  **Token Security**:
      *   Replace plain text `token` with `token_hash`.
      *   Add `used_at` and `accepted_by` for single-use enforcement.
      *   Shorten default expiry to 48 hours.
  2.  **Rate Limiting**:
      *   Create `invitation_attempts` table.
  3.  **Functions**:
      *   `create_company_invitation`: Generates token, hashes it, stores hash, returns plain token.
      *   `accept_company_invitation`: Verifies token hash, checks rate limits, enforces single-use.
  4.  **Policies**:
      *   Ensure `token_hash` is not exposed (handled via explicit SELECTs in app, but we can't hide columns via RLS easily without views. We'll rely on app logic + `security definer` functions).
*/

-- 1. Create invitation_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.invitation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  user_id UUID, -- Nullable (unauthenticated attempts)
  attempt_count INT DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.invitation_attempts ENABLE ROW LEVEL SECURITY;

-- 2. Alter company_invitations table
-- We need to handle existing tokens. Since we are moving to hashing, existing plain tokens are invalid unless we hash them.
-- For simplicity and security, we will expire all existing pending invitations or migrate them if possible.
-- Given "Login Flow" context, invalidating pending invites is safer/easier than handling migration logic for plain->hash without knowing the plain text in this script (we can, but `token` is UUID).
-- Let's add the columns first.

ALTER TABLE public.company_invitations
ADD COLUMN IF NOT EXISTS token_hash TEXT,
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.profiles(id);

-- Update default expiry for NEW rows (schema change)
ALTER TABLE public.company_invitations
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '48 hours');

-- 3. Create helper function to hash tokens (SHA-256)
CREATE OR REPLACE FUNCTION public.hash_token(token_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(token_input, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enable pgcrypto if not exists (usually available in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4. Create RPC to CREATE invitation (Server-Side Generation)
CREATE OR REPLACE FUNCTION public.create_company_invitation(
  company_id UUID,
  email TEXT,
  role company_role
)
RETURNS TEXT -- Returns the PLAIN token
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plain_token TEXT;
  token_hash_val TEXT;
  sender_id UUID;
BEGIN
  -- Check if sender is company admin
  sender_id := auth.uid();
  IF NOT is_company_admin(sender_id, create_company_invitation.company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Generate 32-byte random token (hex encoded)
  plain_token := encode(gen_random_bytes(32), 'hex');
  token_hash_val := public.hash_token(plain_token);

  INSERT INTO public.company_invitations (
    company_id,
    email,
    invited_by,
    role,
    status,
    token_hash, -- Store hash
    token,      -- Legacy column, fill with dummy or null? Constraint says NOT NULL DEFAULT uuid. 
                -- We should drop the constraint or column. For now, let's put a random uuid but ignore it.
    expires_at
  ) VALUES (
    create_company_invitation.company_id,
    create_company_invitation.email,
    sender_id,
    create_company_invitation.role,
    'pending',
    token_hash_val,
    gen_random_uuid(), -- Legacy token filler
    now() + INTERVAL '48 hours'
  );

  RETURN plain_token;
END;
$$;

-- 5. Create RPC to ACCEPT invitation (With Token Verification & Rate Limiting)
CREATE OR REPLACE FUNCTION public.accept_company_invitation_v2(
  invitation_id UUID,
  token_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_profile_id UUID;
  client_ip TEXT;
  attempt_record RECORD;
  is_blocked BOOLEAN;
  hashed_input TEXT;
BEGIN
  -- 1. Rate Limiting Check
  -- We use a simplified approach: Key is user_id (if logged in) or just fail.
  -- In a real edge function we'd have IP. In PG function, `current_setting('request.headers', true)::json->>'x-forwarded-for'` might work if configured, but unreliable.
  -- We'll rely on user_id for rate limiting since the user must be logged in to accept.
  
  user_profile_id := auth.uid();
  IF user_profile_id IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO attempt_record FROM public.invitation_attempts 
  WHERE user_id = user_profile_id 
  AND created_at > (now() - INTERVAL '1 hour');

  IF FOUND THEN
    IF attempt_record.blocked_until > now() THEN
       RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
    END IF;
    
    IF attempt_record.attempt_count >= 3 THEN
       -- Block for 15 mins
       UPDATE public.invitation_attempts 
       SET blocked_until = now() + INTERVAL '15 minutes' 
       WHERE id = attempt_record.id;
       RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
    END IF;
  END IF;

  -- 2. Verify Invitation
  SELECT * INTO inv
  FROM public.company_invitations
  WHERE id = invitation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Check status/expiry
  IF inv.status != 'pending' THEN
     RETURN jsonb_build_object('success', false, 'error', 'Invitation already ' || inv.status);
  END IF;
  
  IF inv.expires_at < now() THEN
     UPDATE public.company_invitations SET status = 'expired' WHERE id = invitation_id;
     RETURN jsonb_build_object('success', false, 'error', 'Invitation expired');
  END IF;

  -- Verify Token Hash
  hashed_input := public.hash_token(token_input);
  
  -- Handle legacy invitations (no hash) -> Fail securely or Allow?
  -- Security req: "Fix security warning... tokens could be hijacked".
  -- We should strictly enforce hash. Legacy invites will fail. This is acceptable for "Harden" task.
  IF inv.token_hash IS NULL OR inv.token_hash != hashed_input THEN
    -- Log attempt
    INSERT INTO public.invitation_attempts (user_id, attempt_count, last_attempt_at)
    VALUES (user_profile_id, 1, now())
    ON CONFLICT (id) DO NOTHING; -- Should update if we had a unique constraint, but we select first.
    
    -- Update existing attempt counter
    IF FOUND THEN
      UPDATE public.invitation_attempts 
      SET attempt_count = attempt_count + 1, last_attempt_at = now()
      WHERE id = attempt_record.id;
    ELSE
      INSERT INTO public.invitation_attempts (user_id, attempt_count) VALUES (user_profile_id, 1);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- 3. Verify Email Match
  -- Get user profile
  DECLARE
    user_email TEXT;
  BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_email IS NULL OR lower(user_email) != lower(inv.email) THEN
       RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
    END IF;
  END;

  -- 4. Execute Acceptance
  -- Add member
  -- Get profile ID (separate from auth id in this schema?)
  -- Schema says: company_members(user_id) references profiles(id).
  -- And profiles(id) is usually same as auth.uid() or linked?
  -- In `accept_company_invitation` (old):
  -- SELECT p.id INTO user_profile_id FROM public.profiles p JOIN auth.users u ON u.id = p.user_id ...
  
  DECLARE
     target_profile_id UUID;
  BEGIN
     SELECT id INTO target_profile_id FROM public.profiles WHERE user_id = auth.uid();
     
     INSERT INTO public.company_members (company_id, user_id, role)
     VALUES (inv.company_id, target_profile_id, inv.role)
     ON CONFLICT (company_id, user_id) DO UPDATE SET role = inv.role;
  END;

  -- Update Invitation
  UPDATE public.company_invitations
  SET status = 'accepted',
      used_at = now(),
      accepted_by = target_profile_id,
      updated_at = now()
  WHERE id = invitation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Cleanup & Security
-- Drop the legacy 'token' column to ensure it's never used/leaked.
-- WARNING: This deletes data. But per requirements, we must not store plain tokens.
ALTER TABLE public.company_invitations DROP COLUMN IF EXISTS token;

-- RLS Update: Ensure 'token_hash' is not selectable by public/users if possible?
-- We can't easily column-restrict without views.
-- But standard policies apply.
-- Admins can view invitations.
-- Users can view their own.
-- 'token_hash' is effectively a secret, but knowing the hash doesn't give the token.
-- Still, we rely on the API not selecting it.

-- Update Policies to be stricter if needed
-- Existing: "company_invitations_admin_view" -> is_company_admin
-- Existing: "company_invitations_user_view_own" -> email match

-- We should ensure that UPDATES are restricted.
-- Users should NOT be able to update invitations directly (status='accepted').
-- They must use the RPC.
-- Existing policy: "company_invitations_user_update_own" -> email match AND status='pending'.
-- We should DROP this policy to force usage of the secure RPC.
DROP POLICY IF EXISTS "company_invitations_user_update_own" ON public.company_invitations;

