-- =========================================================
-- COMPLETE FIX SCRIPT V4 (Robust & Idempotent)
-- Run this ENTIRE file in Supabase SQL Editor.
-- It is designed to run successfully even if you run it multiple times.
-- =========================================================

-- PART 1: FIX NOTIFICATIONS (Urgent: This often blocks follows)
-- Drop the constraint first to avoid conflicts
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";

-- Add it back with ALL valid types
ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'friend_request', 'message', 'circle_invite', 'mention', 'system'));

-- PART 2: FIX FOLLOWS RLS (The "Failed to accept" fix)
ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

-- Drop ALL logical variations of policies to ensure a clean slate
DROP POLICY IF EXISTS "Manage follows" ON "public"."follows";
DROP POLICY IF EXISTS "Follow users" ON "public"."follows";
DROP POLICY IF EXISTS "Accept follow request" ON "public"."follows";
DROP POLICY IF EXISTS "Delete follow" ON "public"."follows";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."follows";

-- Create the ONE master policy
CREATE POLICY "Manage follows" 
ON "public"."follows" FOR ALL 
TO authenticated 
USING (auth.uid() = follower_id OR auth.uid() = following_id)
WITH CHECK (auth.uid() = follower_id OR auth.uid() = following_id);

-- PART 3: FIX FOLLOW REQUESTS RLS
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follow requests" ON "public"."follow_requests";
DROP POLICY IF EXISTS "Update own requests" ON "public"."follow_requests";
DROP POLICY IF EXISTS "Manage incoming requests" ON "public"."follow_requests";

CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR ALL 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- PART 4: BADGES & SCHEMA
-- Ensure column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'verification_status'
    ) THEN
        ALTER TABLE "public"."profiles" 
        ADD COLUMN "verification_status" text DEFAULT 'none' 
        CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));
    END IF;
END $$;

-- Reset verified titles to NULL (Icon only preference)
UPDATE "public"."profiles" SET "verified_title" = NULL;

NOTIFY pgrst, 'reload schema';
