-- =========================================================
-- FINAL FIX V5: THE "REQUEST_ACCEPTED" FIX
-- =========================================================

-- PROBLEM:
-- When you accept a request, a trigger tries to create a notification of type 'request_accepted'.
-- But 'request_accepted' was missing from the allowed list of notification types.
-- This caused the entire "Accept" action to fail.

-- FIX:
-- 1. Drop the strict constraint on notification types.
-- 2. Add 'request_accepted' and all other types to the allowed list.
-- 3. Ensure RLS policies are permissive enough for the flow.

-- PART 1: FIX NOTIFICATION TYPES
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";

ALTER TABLE "public"."notifications" 
ADD CONSTRAINT "notifications_type_check" 
CHECK (type IN (
    'like', 
    'comment', 
    'follow', 
    'follow_request', 
    'friend_request', 
    'message', 
    'circle_invite', 
    'mention', 
    'system', 
    'request_accepted'  -- <--- THIS WAS MISSING
));

-- PART 2: ENSURE RLS FOR FOLLOWS (Redundant but safe)
ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follows" ON "public"."follows";
CREATE POLICY "Manage follows" 
ON "public"."follows" FOR ALL 
TO authenticated 
USING (auth.uid() = follower_id OR auth.uid() = following_id)
WITH CHECK (auth.uid() = follower_id OR auth.uid() = following_id);

-- PART 3: ENSURE RLS FOR FOLLOW REQUESTS
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage follow requests" ON "public"."follow_requests";
CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR ALL 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);

NOTIFY pgrst, 'reload schema';
