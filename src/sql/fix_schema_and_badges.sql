-- =========================================================
-- MASTER FIX: Schema, Badges, and Permissions
-- Run this script to fix the "column does not exist" error and reset badges.
-- =========================================================

-- 1. ENSURE SCHEMA EXISTS
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

-- 2. RESET VERIFIED BADGES
-- Now that the column definitely exists, we can run the update.
UPDATE "public"."profiles"
SET 
    -- If they were verified, move them to 'pending' status so they don't lose their request
    "verification_status" = CASE WHEN "is_verified" = true THEN 'pending' ELSE "verification_status" END,
    -- Remove the active badge
    "is_verified" = false;

-- 3. FIX FOLLOW REQUESTS (Private Account Follow Error)
-- Ensure 'follow_requests' has the correct unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'follow_requests_requester_id_target_id_key'
    ) THEN
        ALTER TABLE "public"."follow_requests" 
        ADD CONSTRAINT "follow_requests_requester_id_target_id_key" UNIQUE ("requester_id", "target_id");
    END IF;
END $$;

-- Enable RLS
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

-- Allow users to UPDATE their own requests (Crucial for upsert/retry)
DROP POLICY IF EXISTS "Update own requests" ON "public"."follow_requests";
CREATE POLICY "Update own requests" 
ON "public"."follow_requests" FOR UPDATE 
TO authenticated 
USING (auth.uid() = requester_id);

-- Ensure other policies exist (Insert, Select, Delete)
DROP POLICY IF EXISTS "Create follow requests" ON "public"."follow_requests";
CREATE POLICY "Create follow requests" ON "public"."follow_requests" FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "View follow requests" ON "public"."follow_requests";
CREATE POLICY "View follow requests" ON "public"."follow_requests" FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "Delete follow requests" ON "public"."follow_requests";
CREATE POLICY "Delete follow requests" ON "public"."follow_requests" FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- 4. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
