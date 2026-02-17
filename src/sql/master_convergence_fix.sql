-- =========================================================
-- MASTER CONVERGENCE FIX: AURA SYNC & PERMANENT DELETION
-- =========================================================

-- 1. UNIVERSAL ADMIN OVERRIDE FOR DELETIONS
-- This ensures admins can ALWAYS delete, bypassing any misconfigured RLS
DROP POLICY IF EXISTS "Admins can delete any confession" ON public.confessions;
CREATE POLICY "Admins can delete any confession"
ON public.confessions FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  OR auth.jwt() ->> 'email' = 'arunchoudhary@alliance.edu.in'
);

DROP POLICY IF EXISTS "Admins can delete any listing" ON public.marketplace_listings;
CREATE POLICY "Admins can delete any listing"
ON public.marketplace_listings FOR DELETE TO authenticated
USING (
  auth.uid() = seller_id 
  OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  OR auth.jwt() ->> 'email' = 'arunchoudhary@alliance.edu.in'
);

DROP POLICY IF EXISTS "Admins can delete any message" ON public.direct_messages;
CREATE POLICY "Admins can delete any message"
ON public.direct_messages FOR DELETE TO authenticated
USING (
  auth.uid() = sender_id 
  OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  OR auth.jwt() ->> 'email' = 'arunchoudhary@alliance.edu.in'
);

-- 2. ROBUST AURA (LIKES) SYNCHRONIZATION
-- This ensures that unliking/deleting posts correctly updates post & profile counts

-- First, update the post aura count trigger
CREATE OR REPLACE FUNCTION public.update_aura_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET aura_count = aura_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Only update if the post still exists (prevents error on cascading delete)
    UPDATE public.posts SET aura_count = GREATEST(aura_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Second, create a trigger on POSTS to update the PROFILE total_aura
-- This is the most reliable way: Profile = Sum of Post Auras
CREATE OR REPLACE FUNCTION public.sync_profile_aura()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
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

-- Apply the profile sync trigger
DROP TRIGGER IF EXISTS on_post_aura_change ON public.posts;
CREATE TRIGGER on_post_aura_change
AFTER UPDATE OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_aura();

-- 3. ONE-TIME RECALCULATION TO FIX MISMATCHES
UPDATE public.posts p
SET aura_count = (SELECT count(*) FROM public.auras a WHERE a.post_id = p.id);

UPDATE public.profiles p
SET total_aura = (SELECT COALESCE(SUM(aura_count), 0) FROM public.posts WHERE user_id = p.user_id);

NOTIFY pgrst, 'reload schema';
