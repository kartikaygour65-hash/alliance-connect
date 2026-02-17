-- =========================================================
-- FINAL FIX FOR FOLLOWS & NOTIFICATIONS
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- =========================================================

-- 1. FIX THE NOTIFICATION ERROR (Critical)
-- The error "violates check constraint notifications_type_check" happens because
-- the database doesn't know about 'follow_request'. We must add it.

ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";

ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'friend_request', 'message', 'circle_invite', 'mention', 'system'));


-- 2. FIX "FAILED TO ACCEPT REQUEST"
-- This fixes the permission error when you try to accept a follower.

ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follows" ON "public"."follows";
DROP POLICY IF EXISTS "Follow users" ON "public"."follows";
DROP POLICY IF EXISTS "Accept follow request" ON "public"."follows";

CREATE POLICY "Manage follows" 
ON "public"."follows" FOR ALL 
TO authenticated 
USING (auth.uid() = follower_id OR auth.uid() = following_id)
WITH CHECK (auth.uid() = follower_id OR auth.uid() = following_id);


-- 3. FIX FOLLOW REQUEST MANAGEMENT
-- Allows you to update/delete requests.

ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follow requests" ON "public"."follow_requests";

CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR ALL 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);


-- 4. CLEANUP (Optional)
-- Remove duplicate policies if any exist with different names
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."follows";
DROP POLICY IF EXISTS "Delete follow" ON "public"."follows";

NOTIFY pgrst, 'reload schema';
