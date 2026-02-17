-- =========================================================
-- FIX: Notifications Type Constraint
-- The database has a CHECK constraint on the 'type' column of the 'notifications' table.
-- It seems 'follow_request' is not in the allowed list, causing the insert error.
-- =========================================================

-- 1. DROP EXISTING CONSTRAINT
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";

-- 2. ADD UPDATED CONSTRAINT WITH ALL REQUIRED TYPES
ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'message', 'circle_invite', 'mention', 'system'));

-- 3. ENSURE RLS FOR UPDATING REQUESTS IS ACTIVE (Redundant but safe)
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

-- Allow users to update requests where they are the TARGET (to accept/reject)
DROP POLICY IF EXISTS "Manage incoming requests" ON "public"."follow_requests";
CREATE POLICY "Manage incoming requests" 
ON "public"."follow_requests" FOR UPDATE
TO authenticated 
USING (auth.uid() = target_id OR auth.uid() = requester_id);

-- Force refresh
NOTIFY pgrst, 'reload schema';
