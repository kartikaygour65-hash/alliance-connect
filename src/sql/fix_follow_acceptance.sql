-- =========================================================
-- FIX: Follow Acceptance RLS
-- The "Failed to accept request" error happens because the 'follows' table
-- typically only allows the FOLLOWER to insert. When accepting a request,
-- the FOLLOWING user (you) needs permission to insert the record.
-- =========================================================

-- 1. FIX 'FOLLOWS' TABLE RLS
ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

-- Allow user to insert if they are the FOLLOWER (normal follow)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."follows";
DROP POLICY IF EXISTS "Follow users" ON "public"."follows";
CREATE POLICY "Follow users" 
ON "public"."follows" FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = follower_id);

-- Allow user to insert if they are the FOLLOWING (accepting a request)
DROP POLICY IF EXISTS "Accept follow request" ON "public"."follows";
CREATE POLICY "Accept follow request" 
ON "public"."follows" FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = following_id);

-- Allow users to delete (Unfollow OR Remove Follower)
DROP POLICY IF EXISTS "Delete follow" ON "public"."follows";
CREATE POLICY "Delete follow" 
ON "public"."follows" FOR DELETE 
TO authenticated 
USING (auth.uid() = follower_id OR auth.uid() = following_id);


-- 2. ENSURE 'FOLLOW_REQUESTS' POLICIES (Redundant safety check)
DROP POLICY IF EXISTS "Manage follow requests" ON "public"."follow_requests";
CREATE POLICY "Manage follow requests" 
ON "public"."follow_requests" FOR UPDATE 
TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- 3. RESET BAD CUSTOM TITLES (Optional cleanup)
-- User requested no custom titles, so we can nullify them to be safe
UPDATE "public"."profiles" SET "verified_title" = NULL WHERE "verified_title" IS NOT NULL;

-- Force refresh
NOTIFY pgrst, 'reload schema';
