-- =========================================================
-- FINAL AURA FIX: TRIGGER-BASED COUNTING (NO CLIENT LOGIC)
-- =========================================================

-- 1. CLEANUP OLD TRIGGERS/FUNCTIONS (Reset State)
DROP TRIGGER IF EXISTS on_aura_change ON public.auras;
DROP FUNCTION IF EXISTS public.manage_post_aura_count();
DROP FUNCTION IF EXISTS public.increment_aura_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_aura_count(uuid);

-- 2. CREATE ROBUST TRIGGER FUNCTION
-- This function runs automatically whenever a row is inserted/deleted in 'auras'
CREATE OR REPLACE FUNCTION public.manage_post_aura_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts 
    SET aura_count = aura_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts 
    SET aura_count = GREATEST(aura_count - 1, 0) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY TRIGGER TO AURAS TABLE
CREATE TRIGGER on_aura_change
AFTER INSERT OR DELETE ON public.auras
FOR EACH ROW EXECUTE FUNCTION public.manage_post_aura_count();

-- 4. ENSURE PROFILE SYNC TRIGGER EXISTS (From previous fix)
-- Re-defining just in case it was missed
CREATE OR REPLACE FUNCTION public.sync_profile_aura()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    -- Only update profile if the aura count actually changed
    IF (OLD.aura_count IS DISTINCT FROM NEW.aura_count) THEN
      UPDATE public.profiles
      SET total_aura = (
        SELECT COALESCE(SUM(aura_count), 0)
        FROM public.posts
        WHERE user_id = NEW.user_id
      )
      WHERE user_id = NEW.user_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    -- If a post is deleted, recount the user's total aura
    UPDATE public.profiles
    SET total_aura = (
      SELECT COALESCE(SUM(aura_count), 0)
      FROM public.posts
      WHERE user_id = OLD.user_id
    )
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_aura_change ON public.posts;
CREATE TRIGGER on_post_aura_change
AFTER UPDATE OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_aura();

-- 5. RECALCULATE EVERYTHING (One-time Fix)
-- Reset post counts based on actual aura rows
UPDATE public.posts p
SET aura_count = (SELECT count(*) FROM public.auras a WHERE a.post_id = p.id);

-- Reset profile totals based on new post counts
UPDATE public.profiles p
SET total_aura = (SELECT COALESCE(SUM(aura_count), 0) FROM public.posts WHERE user_id = p.user_id);
