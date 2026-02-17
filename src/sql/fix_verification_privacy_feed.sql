-- =========================================================
-- FIX: Verification, Privacy, and Feed Logic
-- =========================================================

-- 1. VERIFICATION STATUS
-- Add verification_status column to track pending requests
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));

-- Ensure is_verified is false if not explicitly verified
UPDATE "public"."profiles" SET "is_verified" = false WHERE "verification_status" != 'verified';


-- 2. FIX FOLLOW REQUESTS PERMISSIONS
-- The user reported "Update Failed" when requesting to follow private accounts.
-- This is likely due to missing RLS policies on 'follow_requests' table.

ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

-- Allow users to create requests (Insert)
DROP POLICY IF EXISTS "Create follow requests" ON "public"."follow_requests";
CREATE POLICY "Create follow requests" 
ON "public"."follow_requests" FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = requester_id);

-- Allow users to view their own requests (incoming and outgoing)
DROP POLICY IF EXISTS "View follow requests" ON "public"."follow_requests";
CREATE POLICY "View follow requests" 
ON "public"."follow_requests" FOR SELECT 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Allow users to update requests sent to them (e.g., Accept/Reject)
DROP POLICY IF EXISTS "Manage incoming requests" ON "public"."follow_requests";
CREATE POLICY "Manage incoming requests" 
ON "public"."follow_requests" FOR UPDATE 
TO authenticated 
USING (auth.uid() = target_id);

-- Allow users to delete requests (Cancel own request or Reject incoming)
DROP POLICY IF EXISTS "Delete follow requests" ON "public"."follow_requests";
CREATE POLICY "Delete follow requests" 
ON "public"."follow_requests" FOR DELETE 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);


-- 3. ENSURE POST PRIVACY
-- Re-applying RLS on posts to ensure private posts don't leak to main feed.

ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

-- Redefine check_access to be absolutely sure
CREATE OR REPLACE FUNCTION public.check_access(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- 1. User viewing their own content
    (auth.uid() = target_id)
    OR
    -- 2. Content is from a Public Profile
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = target_id
      AND (is_private IS NULL OR is_private = false)
    )
    OR
    -- 3. User is following the target
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid()
      AND following_id = target_id
    );
$$;

-- Drop and Recreate the View Policy
DROP POLICY IF EXISTS "View posts (Privacy Aware)" ON "public"."posts";
CREATE POLICY "View posts (Privacy Aware)"
ON "public"."posts" FOR SELECT
TO authenticated
USING (
  public.check_access(user_id)
);

-- Force refresh schema cache by notifying (optional, mostly for Supabase dashboard)
NOTIFY pgrst, 'reload schema';
