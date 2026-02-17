-- =========================================================
-- FIX: Clear existing verified badges & Enable requester UPDATE
-- =========================================================

-- 1. CLEAR ALL VERIFIED BADGES
-- Remove currently verified status for all users, but keep the status 'pending' if it was verified.
-- This effectively resets the "auto-verified" badges while signaling they are waiting approval.
UPDATE "public"."profiles"
SET "is_verified" = false, 
    "verification_status" = CASE WHEN "is_verified" = true THEN 'pending' ELSE "verification_status" END,
    "verified_title" = CASE WHEN "is_verified" = true THEN "verified_title" ELSE NULL END;

-- 2. ENABLE UPDATE FOR FOLLOW REQUESTERS
-- Allow users to update their own sent requests (e.g. resend, change status back to pending)
DROP POLICY IF EXISTS "Update own requests" ON "public"."follow_requests";
CREATE POLICY "Update own requests" 
ON "public"."follow_requests" FOR UPDATE 
TO authenticated 
USING (auth.uid() = requester_id);

-- Ensure RLS is enabled
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

-- 3. VERIFY UNIQUE CONSTRAINT
-- Ensure the unique constraint exists for upsert to work properly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'follow_requests_requester_id_target_id_key'
    ) THEN
        ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_requester_id_target_id_key" UNIQUE ("requester_id", "target_id");
    END IF;
END $$;
