-- ==========================================
-- CREATE BLOCKS TABLE
-- Run this in Supabase SQL Editor
-- ==========================================

-- Create the blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage their own blocks
CREATE POLICY "Users can view their own blocks"
ON public.blocks FOR SELECT
TO authenticated
USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert their own blocks"
ON public.blocks FOR INSERT
TO authenticated
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete their own blocks"
ON public.blocks FOR DELETE
TO authenticated
USING (blocker_id = auth.uid());

-- Also allow users to check if THEY have been blocked by someone
-- (needed for the profile "you're blocked" check)
CREATE POLICY "Users can check if they are blocked"
ON public.blocks FOR SELECT
TO authenticated
USING (blocked_id = auth.uid());
