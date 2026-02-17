-- =========================================================
-- FINAL PRIVACY FIX V7 (NUCLEAR OPTION)
-- Run this to enforce strict privacy for Feed and Stories
-- =========================================================

-- 1. Ensure Profiles have 'is_private' boolean (Not Null)
UPDATE "public"."profiles" SET "is_private" = false WHERE "is_private" IS NULL;
ALTER TABLE "public"."profiles" ALTER COLUMN "is_private" SET DEFAULT false;
ALTER TABLE "public"."profiles" ALTER COLUMN "is_private" SET NOT NULL;

-- 2. Redefine Access Check Function (Security Definer)
CREATE OR REPLACE FUNCTION public.check_access(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- 1. Own content
    (auth.uid() = target_id)
    OR
    -- 2. Public Profile (Check explicit false)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = target_id
      AND is_private = false
    )
    OR
    -- 3. Confirmed Follower
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid()
      AND following_id = target_id
    );
$$;

-- 3. SECURE POSTS (Stories and Feed often mixed up, so locking both)
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

-- Drop ALL possible loose policies
DROP POLICY IF EXISTS "Enable all access for authenticated users to posts" ON "public"."posts";
DROP POLICY IF EXISTS "Public posts are visible to everyone" ON "public"."posts";
DROP POLICY IF EXISTS "View posts" ON "public"."posts";
DROP POLICY IF EXISTS "View posts (Privacy Aware)" ON "public"."posts";

-- Apply Strict Policy
CREATE POLICY "View posts (Strict)"
ON "public"."posts" FOR SELECT
TO authenticated
USING (
  public.check_access(user_id)
);

-- 4. SECURE STORIES
ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users to stories" ON "public"."stories";
DROP POLICY IF EXISTS "View stories" ON "public"."stories";
DROP POLICY IF EXISTS "View stories (Privacy Aware)" ON "public"."stories";

CREATE POLICY "View stories (Strict)"
ON "public"."stories" FOR SELECT
TO authenticated
USING (
  public.check_access(user_id)
);

-- 5. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
