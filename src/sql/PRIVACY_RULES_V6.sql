-- =========================================================
-- PRIVACY VI (INSTAGRAM LOGIC - NUCLEAR RESET)
-- This script DYNAMICALLY finds and drops ALL existing policies
-- on posts and stories, then creates the strict ones.
-- =========================================================

-- =============================================
-- STEP 0: Fix profiles.is_private column
-- =============================================
UPDATE "public"."profiles" SET "is_private" = false WHERE "is_private" IS NULL;

-- =============================================
-- STEP 1: DROP *ALL* POLICIES on posts table
-- This is the key fix - we dynamically find every policy
-- =============================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop ALL policies on posts table
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'posts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', pol.policyname);
        RAISE NOTICE 'Dropped posts policy: %', pol.policyname;
    END LOOP;

    -- Drop ALL policies on stories table
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'stories'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stories', pol.policyname);
        RAISE NOTICE 'Dropped stories policy: %', pol.policyname;
    END LOOP;
END $$;

-- =============================================
-- STEP 2: Redefine check_access function
-- Instagram logic:
--   Own content = YES
--   Public account = YES
--   Following them = YES
--   Everything else = NO
-- =============================================
CREATE OR REPLACE FUNCTION public.check_access(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- 1. It is my own content
    (auth.uid() = target_id)
    OR
    -- 2. The target user has a PUBLIC account (is_private = false)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = target_id
      AND is_private = false
    )
    OR
    -- 3. I am following them (confirmed follower)
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid()
      AND following_id = target_id
    );
$$;

-- =============================================
-- STEP 3: Enable RLS and create STRICT policies
-- =============================================

-- POSTS
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."posts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_privacy"
ON "public"."posts" FOR SELECT
TO authenticated
USING (public.check_access(user_id));

CREATE POLICY "posts_insert_own"
ON "public"."posts" FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own"
ON "public"."posts" FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "posts_delete_own"
ON "public"."posts" FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- STORIES
ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."stories" FORCE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_privacy"
ON "public"."stories" FOR SELECT
TO authenticated
USING (public.check_access(user_id));

CREATE POLICY "stories_insert_own"
ON "public"."stories" FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_delete_own"
ON "public"."stories" FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- STEP 4: Force PostgREST to reload schema cache
-- =============================================
NOTIFY pgrst, 'reload schema';
