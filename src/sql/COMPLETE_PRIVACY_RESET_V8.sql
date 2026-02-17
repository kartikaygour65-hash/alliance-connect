-- =========================================================
-- COMPLETE PRIVACY RESET V8 (THE "FIX IT ALL" SCRIPT)
-- =========================================================

-- 1. CLEANUP OLD POLICIES (Aggressively)
-- We need to drop ANY policy that might be allowing access.
DO $$
BEGIN
    -- Posts
    DROP POLICY IF EXISTS "Enable all access for authenticated users to posts" ON "public"."posts";
    DROP POLICY IF EXISTS "Public posts are visible to everyone" ON "public"."posts";
    DROP POLICY IF EXISTS "View posts" ON "public"."posts";
    DROP POLICY IF EXISTS "View posts (Privacy Aware)" ON "public"."posts";
    DROP POLICY IF EXISTS "View posts (Strict)" ON "public"."posts";
    DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."posts";
    DROP POLICY IF EXISTS "Authenticated users can view all posts" ON "public"."posts";

    -- Stories
    DROP POLICY IF EXISTS "Enable all access for authenticated users to stories" ON "public"."stories";
    DROP POLICY IF EXISTS "View stories" ON "public"."stories";
    DROP POLICY IF EXISTS "View stories (Privacy Aware)" ON "public"."stories";
    DROP POLICY IF EXISTS "View stories (Strict)" ON "public"."stories";
END $$;

-- 2. RESET PROFILES (Ensure consistency)
UPDATE "public"."profiles" SET "is_private" = false WHERE "is_private" IS NULL;
ALTER TABLE "public"."profiles" ALTER COLUMN "is_private" SET DEFAULT false;
ALTER TABLE "public"."profiles" ALTER COLUMN "is_private" SET NOT NULL;

-- 3. REDEFINE CHECK_ACCESS (The Gatekeeper)
-- "Without following them or public account I cannot see their posts"
CREATE OR REPLACE FUNCTION public.check_access(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- A. Own content (Always see your own stuff)
    (auth.uid() = target_id)
    OR
    -- B. Public Profile AND NOT Private (Double check)
    (
       EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = target_id
        AND is_private = false
      )
    )
    OR
    -- C. Confirmed Follower (Only 'accepted' follows, assuming table only has them)
    (
      EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid()
        AND following_id = target_id
      )
    );
$$;

-- 4. APPLY STRICTEST POLICIES
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "STRICT_FEED_ACCESS"
ON "public"."posts" FOR SELECT
TO authenticated
USING (
  public.check_access(user_id)
);

ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "STRICT_STORY_ACCESS"
ON "public"."stories" FOR SELECT
TO authenticated
USING (
  public.check_access(user_id)
);

-- 5. ENSURE INSERT/UPDATE/DELETE POLICIES EXIST (To avoid locking users out of their own content)
-- Posts
DROP POLICY IF EXISTS "Create posts" ON "public"."posts";
CREATE POLICY "Create posts" ON "public"."posts" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own posts" ON "public"."posts";
CREATE POLICY "Update own posts" ON "public"."posts" FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own posts" ON "public"."posts";
CREATE POLICY "Delete own posts" ON "public"."posts" FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Stories
DROP POLICY IF EXISTS "Create stories" ON "public"."stories";
CREATE POLICY "Create stories" ON "public"."stories" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own stories" ON "public"."stories";
CREATE POLICY "Delete own stories" ON "public"."stories" FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 6. FLUSH CACHE
NOTIFY pgrst, 'reload schema';
