-- =========================================================
-- COMPLETE FIX SCRIPT (Run this entire file in Supabase SQL Editor)
-- This script fixes:
-- 1. "Failed to accept request" (Fixes RLS for inserting follows)
-- 2. "violates check constraint 'notifications_type_check'" (Fixes allowed notification types)
-- 3. "column verification_status does not exist" (Adds missing columns)
-- 4. Removes all existing fake verification badges
-- =========================================================

-- PART 1: FIX SCHEMA & BADGES
-- Safely add verification_status column if it's missing
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

-- Reset badges: Move verified users to 'pending' (except admin 'arun' if needed, but safer to reset all)
UPDATE "public"."profiles"
SET 
    "verification_status" = CASE WHEN "is_verified" = true THEN 'pending' ELSE "verification_status" END,
    "is_verified" = false,
    "verified_title" = NULL; -- Remove all custom titles

-- PART 2: FIX FOLLOW REQUESTS & ACCEPTANCE
-- Add Unique Constraint to prevent duplicates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'follow_requests_requester_id_target_id_key'
    ) THEN
        ALTER TABLE "public"."follow_requests" 
        ADD CONSTRAINT "follow_requests_requester_id_target_id_key" UNIQUE ("requester_id", "target_id");
    END IF;
END $$;

-- FIX RLS FOR 'FOLLOW_REQUESTS' (Allowing updates)
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follow requests" ON "public"."follow_requests";
DROP POLICY IF EXISTS "Update own requests" ON "public"."follow_requests";
DROP POLICY IF EXISTS "Manage incoming requests" ON "public"."follow_requests";

CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR ALL 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- FIX RLS FOR 'FOLLOWS' (Allowing acceptance)
ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follow users" ON "public"."follows";
DROP POLICY IF EXISTS "Accept follow request" ON "public"."follows";
DROP POLICY IF EXISTS "Delete follow" ON "public"."follows";

-- Policy: Allow follow if you are follower OR following (allows normal follow AND accepting requests)
CREATE POLICY "Manage follows" 
ON "public"."follows" FOR ALL 
TO authenticated 
USING (auth.uid() = follower_id OR auth.uid() = following_id)
WITH CHECK (auth.uid() = follower_id OR auth.uid() = following_id);

-- PART 3: FIX NOTIFICATIONS CONSTRAINT
-- Drop old constraint that blocks 'follow_request' type
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";

-- Add new constraint with ALL required types
ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'friend_request', 'message', 'circle_invite', 'mention', 'system'));

-- PART 4: CLEANUP & REFRESH
NOTIFY pgrst, 'reload schema';
